/* Les gros caches locaux écrits au plus tous les quarts d'heure (js/utils.js,
   ecrireCacheLocal), et le verdict d'appariement mémorisé (js/match.js, isMatchPair).

   « Bien meilleure performance sur CCGTV » (29 octobre 2026). Mesuré dans Chromium,
   processeur ralenti six fois, une passe de chargement d'arrière-plan lecteur ouvert :
   une image tenue 624 à 726 ms. Dedans, 330 ms pour réécrire le calendrier du jour
   (683 Ko, dont 590 de liens) dans localStorage — réécrit aussi à chaque relève des
   scores en direct, chaque minute — et 220 ms d'isMatchPair sur les mêmes couples qu'à
   la passe précédente. Après : 272 à 300 ms. Ce test verrouille ce qui rend le report
   sûr : une lecture rend ce qu'on vient d'écrire, rien ne se perd quand la page est
   cachée ou quittée, et le verdict mémorisé suit les champs dont il dépend. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
  const w = dom.window;
  w.__NO_AUTOSTART__ = true;
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle'])
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.fetch = () => Promise.reject(new Error('réseau coupé'));

  await import('../js/scrapers.js');
  const utils = await import('../js/utils.js');
  const api = await import('../js/api.js');
  const match = await import('../js/match.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };
  const brut = (k) => JSON.parse(localStorage.getItem(k) || 'null');

  /* Le démarrage du module a pu écrire (main.js lit, n'écrit pas) : on part d'un état sans
     écriture en attente, et d'une dernière écriture « il y a longtemps ». */
  utils.viderCachesEnAttente();
  localStorage.clear();

  // ── 1. La première écriture part tout de suite, les suivantes attendent ──
  {
    const K = 'api_calendar_cache_20261029';
    // L'horloge réelle : la dernière écriture de ce processus date d'avant le test.
    const reel = Date.now;
    Date.now = () => reel() + 2 * utils.ECART_ECRITURE_CACHE_MS;
    try {
      utils.ecrireCacheLocal(K, { v: 1 });
      assert.deepStrictEqual(brut(K), { v: 1 }, 'la première écriture est faite tout de suite');
      utils.ecrireCacheLocal(K, { v: 2 });
      utils.ecrireCacheLocal(K, { v: 3 });
      assert.deepStrictEqual(brut(K), { v: 1 }, 'les suivantes, dans le quart d\'heure, attendent');
      assert.deepStrictEqual(utils.lireCacheLocal(K), { v: 3 }, 'mais une lecture rend la dernière valeur écrite');
      const copie = utils.lireCacheLocal(K);
      copie.v = 99;
      assert.deepStrictEqual(utils.lireCacheLocal(K), { v: 3 }, 'une lecture rend une copie, comme localStorage');
      assert.strictEqual(utils.viderCachesEnAttente(), 1, 'une clé attendait');
      assert.deepStrictEqual(brut(K), { v: 3 }, 'vidée : seule la dernière valeur est écrite');
      assert.strictEqual(utils.viderCachesEnAttente(), 0, 'plus rien n\'attend');
      utils.ecrireCacheLocal(K, { v: 4 });
      assert.deepStrictEqual(brut(K), { v: 3 }, 'vider compte comme une écriture : la suivante attend encore');
      Date.now = () => reel() + 4 * utils.ECART_ECRITURE_CACHE_MS;
      utils.ecrireCacheLocal(K, { v: 5 });
      assert.deepStrictEqual(brut(K), { v: 3 }, 'tant que le minuteur est armé, on ne double pas l\'écriture');
      assert.deepStrictEqual(utils.lireCacheLocal(K), { v: 5 });
    } finally { Date.now = reel; }
    utils.viderCachesEnAttente();
    assert.deepStrictEqual(brut(K), { v: 5 });
    ok('première écriture immédiate, les suivantes regroupées, la lecture voit ce qui attend');
  }

  // ── 2. Rien ne se perd quand la page est cachée ou quittée ───────────────
  {
    const K = 'last_scraped_matches';
    utils.ecrireCacheLocal(K, [{ id: 'a' }]);
    assert.strictEqual(localStorage.getItem(K), null, 'dans le quart d\'heure : en attente');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new w.Event('visibilitychange'));
    assert.deepStrictEqual(brut(K), [{ id: 'a' }], 'page cachée : écrit');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    utils.ecrireCacheLocal(K, [{ id: 'b' }]);
    document.dispatchEvent(new w.Event('visibilitychange'));
    assert.deepStrictEqual(brut(K), [{ id: 'a' }], 'page visible : rien ne part');
    w.dispatchEvent(new w.Event('pagehide'));
    assert.deepStrictEqual(brut(K), [{ id: 'b' }], 'page quittée : écrit');
    assert.strictEqual(typeof w.viderCachesEnAttente, 'function', 'exposée pour les tests de démarrage');
    ok('page cachée ou quittée : tout ce qui attend est écrit');
  }

  // ── 3. Deux relèves de scores dans la minute se cumulent ─────────────────
  {
    const JOUR = '20261029';
    const K = 'api_calendar_cache_' + JOUR;
    utils.viderCachesEnAttente();
    localStorage.setItem(K, JSON.stringify({ fetchDate: JOUR, savedAt: 1, matches: [
      { id: 'espn_1', status: 'live', score: [0, 0] },
      { id: 'espn_2', status: 'live', score: [0, 0] }
    ] }));
    api.majScoresDansCache(JOUR, [{ id: 'espn_1', status: 'live', score: [1, 0] }]);
    api.majScoresDansCache(JOUR, [{ id: 'espn_2', status: 'live', score: [0, 2] }]);
    const lu = utils.lireCacheLocal(K).matches;
    assert.deepStrictEqual(lu[0].score, [1, 0], 'la première relève n\'est pas perdue par la seconde');
    assert.deepStrictEqual(lu[1].score, [0, 2]);
    utils.viderCachesEnAttente();
    assert.deepStrictEqual(brut(K).matches.map((m) => m.score), [[1, 0], [0, 2]], 'et c\'est ce qui est écrit');
    ok('la relève suivante part de ce qui attend, pas du stockage');
  }

  // ── 4. Tout le code passe par là pour ces deux caches ────────────────────
  {
    const fichiers = fs.readdirSync(path.join(__dirname, '..', 'js')).filter((f) => f.endsWith('.js'));
    for (const f of fichiers) {
      const src = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
      assert.ok(!/safeStorage(Get|Set)JSON\(\s*'(api_calendar_cache_|last_scraped_matches)/.test(src),
        f + ' lit ou écrit un de ces caches sans lireCacheLocal / ecrireCacheLocal : il manquerait ce qui attend');
    }
    ok('aucun accès direct au calendrier du jour ni aux liens lus par le navigateur');
  }

  // ── 5. Le verdict d'appariement mémorisé suit ses champs ─────────────────
  {
    const a = { league: 'NHL', homeTeam: 'Montreal Canadiens', awayTeam: 'Toronto Maple Leafs', matchDate: '20261029', startTime: '19:00' };
    const b = { league: 'NHL', homeTeam: 'Canadiens', awayTeam: 'Maple Leafs', matchDate: '20261029', startTime: '19:00' };
    const attendu = match.debugMatchPair(a, b).isMatch;
    assert.strictEqual(attendu, true, 'le couple de référence s\'apparie');
    assert.strictEqual(match.isMatchPair(a, b), attendu);
    assert.strictEqual(match.isMatchPair(a, b), attendu, 'relu depuis la mémoire : même verdict');
    const autreJour = Object.assign({}, b, { matchDate: '20261102' });
    assert.strictEqual(match.isMatchPair(a, autreJour), match.debugMatchPair(a, autreJour).isMatch, 'la date compte dans la clé');
    assert.strictEqual(match.isMatchPair(a, autreJour), false, 'un autre jour, ce n\'est pas le même match');
    b.awayTeam = 'Boston Bruins';
    assert.strictEqual(match.isMatchPair(a, b), false, 'un objet modifié n\'hérite pas du verdict de son ancien nom');
    assert.strictEqual(match.isMatchPair(null, a), false);
    ok('isMatchPair mémorisé : même verdict que debugMatchPair, et la clé suit nom, ligue et date');
  }

  console.log(`unit_cachesdifferes : ${n} groupes OK`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

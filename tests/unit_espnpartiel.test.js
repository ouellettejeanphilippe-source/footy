/* Passe ESPN PARTIELLE (js/api.js).

   « ESPN, les scores sont parfois là, parfois pas là. »

   Le calendrier du jour est reconstruit à partir de 47 chemins ESPN. Le garde-fou
   existant ne voyait que le cas où AUCUN n'avait répondu. Quand 40 répondaient et 7
   échouaient, le résultat — amputé des ligues muettes — était écrit tel quel comme LE
   calendrier du jour, et renvoyé à l'appelant. La passe suivante lisait ce calendrier
   amputé : les matchs de ces ligues disparaissaient de la grille, leurs scores avec.
   Au tour d'après, leurs chemins répondaient et ils revenaient. D'où le clignotement.

   Deux règles fixées ici :
     - `fusionnerPassePartielle` : ce qui vient d'ESPN fait foi, ce qu'on connaissait
       déjà et qu'on n'a pas revu est conservé. Seule une passe complète élague.
     - `enPiscine` : les chemins sont interrogés six à la fois. Lancés tous ensemble,
       les derniers expiraient dans la file d'attente du navigateur (six connexions par
       hôte) sans avoir été envoyés — c'est ce qui rendait les échecs partiels courants. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="marea"></div></body></html>',
                        { url: 'https://exemple.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  globalThis.fetch = () => Promise.reject(new Error('réseau coupé'));

  const api = await import('../js/api.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  const JOUR = '20260908';
  const m = (id, extra) => Object.assign({ id, homeTeam: 'A' + id, awayTeam: 'B' + id, matchDate: '2026-09-08', startTime: '19:00' }, extra || {});

  // ── 1. Sans calendrier connu, la passe partielle vaut ce qu'elle vaut ─────
  {
    const frais = [m('espn_1'), m('espn_2')];
    assert.deepStrictEqual(api.fusionnerPassePartielle(frais, null, JOUR), frais, 'pas de cache');
    assert.deepStrictEqual(api.fusionnerPassePartielle(frais, { fetchDate: JOUR, matches: [] }, JOUR), frais, 'cache vide');
    assert.deepStrictEqual(api.fusionnerPassePartielle(frais, { fetchDate: '20260907', matches: [m('espn_9')] }, JOUR), frais,
      'un cache d\'un autre jour n\'a rien à conserver ici');
    assert.deepStrictEqual(api.fusionnerPassePartielle(frais, { fetchDate: JOUR, matches: 'pas un tableau' }, JOUR), frais);
    ok('sans calendrier connu du même jour, la passe est rendue telle quelle');
  }

  // ── 2. Le cas qui faisait clignoter les scores ────────────────────────────
  {
    /* La NBA a répondu (score frais), la MLB non : son match doit rester, avec le score
       qu'on lui connaissait, au lieu de disparaître jusqu'à la passe suivante. */
    const cache = { fetchDate: JOUR, matches: [
      m('espn_nba', { league: 'NBA', score: [88, 84], status: 'live' }),
      m('espn_mlb', { league: 'MLB', score: [3, 1], status: 'live' })
    ] };
    const frais = [m('espn_nba', { league: 'NBA', score: [91, 84], status: 'live' })];
    const sortie = api.fusionnerPassePartielle(frais, cache, JOUR);

    assert.strictEqual(sortie.length, 2, 'les deux matchs sont là');
    const parId = Object.fromEntries(sortie.map((x) => [x.id, x]));
    assert.deepStrictEqual(parId['espn_nba'].score, [91, 84], 'ESPN fait foi sur ce qu\'il a renvoyé');
    assert.deepStrictEqual(parId['espn_mlb'].score, [3, 1], 'la ligue muette garde le score connu, elle ne disparaît pas');
    ok('une ligue dont le chemin n\'a pas répondu reste dans la journée, avec son score');
  }

  // ── 3. Jamais de doublon ─────────────────────────────────────────────────
  {
    const cache = { fetchDate: JOUR, matches: [m('espn_1'), m('espn_1'), m('espn_2')] };
    const sortie = api.fusionnerPassePartielle([m('espn_1', { score: [1, 0] })], cache, JOUR);
    assert.strictEqual(sortie.length, 2, 'espn_1 une seule fois, espn_2 conservé');
    assert.deepStrictEqual(sortie.filter((x) => x.id === 'espn_1').length, 1);
    assert.deepStrictEqual(sortie[0].score, [1, 0], 'et c\'est la version fraîche qui reste');
    ok('un identifiant présent des deux côtés n\'apparaît qu\'une fois, dans sa version fraîche');
  }

  // ── 4. Un match sans identifiant est reconnu sur équipes, date et heure ───
  {
    const sansId = { homeTeam: 'Raw', awayTeam: '', matchDate: '2026-09-08', startTime: '20:00' };
    const cache = { fetchDate: JOUR, matches: [sansId] };
    assert.strictEqual(api.fusionnerPassePartielle([Object.assign({}, sansId)], cache, JOUR).length, 1,
      'le même événement sans identifiant n\'est pas dédoublé');
    assert.strictEqual(api.fusionnerPassePartielle([m('espn_1')], cache, JOUR).length, 2,
      'et il est conservé quand la passe ne le ramène pas');
    ok('un événement sans identifiant est apparié sur ses équipes, sa date et son heure');
  }

  // ── 5. Une passe qui n'a rien ramené ne perd rien ─────────────────────────
  {
    const cache = { fetchDate: JOUR, matches: [m('espn_1'), m('espn_2')] };
    assert.strictEqual(api.fusionnerPassePartielle([], cache, JOUR).length, 2, 'tout est conservé');
    assert.strictEqual(api.fusionnerPassePartielle(null, cache, JOUR).length, 2, 'entrée illisible : idem');
    ok('une passe partielle vide conserve le calendrier connu au lieu de l\'effacer');
  }

  // ── 6. La file : six à la fois, et une tâche qui échoue n'arrête pas sa voie
  {
    const items = Array.from({ length: 20 }, (_, i) => i);
    let enCours = 0, maxEnCours = 0;
    const faits = [];
    await api.enPiscine(items, 6, (i) => {
      enCours++;
      maxEnCours = Math.max(maxEnCours, enCours);
      return new Promise((r) => setTimeout(r, 1)).then(() => { enCours--; faits.push(i); });
    });
    assert.strictEqual(faits.length, 20, 'toutes les tâches ont été exécutées');
    assert.ok(maxEnCours <= 6, 'jamais plus de six en vol, mesuré : ' + maxEnCours);
    assert.ok(maxEnCours > 1, 'et bien en parallèle, pas une par une');
    ok('la file exécute tout, six à la fois au plus');
  }
  {
    /* Sans ce filet, une seule réponse illisible priverait la passe de tous les chemins
       restants de sa voie — un échec partiel bien plus large que nécessaire. */
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const faits = [];
    await api.enPiscine(items, 3, (i) => {
      if (i % 3 === 0) return Promise.reject(new Error('chemin ' + i + ' illisible'));
      faits.push(i);
      return Promise.resolve();
    });
    assert.deepStrictEqual(faits.sort((a, b) => a - b), [1, 2, 4, 5, 7, 8], 'les autres chemins ont tous été lus');
    ok('une tâche qui échoue n\'emporte pas le reste de sa voie');
  }
  {
    await api.enPiscine([], 6, () => Promise.reject(new Error('jamais appelé')));
    assert.strictEqual(api.ESPN_CONCURRENCE, 6, 'six connexions par hôte, comme le navigateur');
    ok('une liste vide se résout sans rien lancer');
  }

  console.log('unit_espnpartiel: ' + n + ' groupes de tests OK');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

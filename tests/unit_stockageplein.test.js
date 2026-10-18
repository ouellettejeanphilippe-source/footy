/* Stockage local plein (js/utils.js, safeStorageSet).

   Page Logs du 18 octobre 2026, Firefox : « Stockage local ❌ 1 écriture(s) refusée(s) ·
   QuotaExceededError · 4569 Ko ». La limite y est de 5 120 Ko ; le calendrier du jour
   avec ses liens fusionnés, celui d'hier autant, les matchs du dernier scraping et le
   cache des liens la remplissaient. Une écriture refusée, c'est un réglage, un favori ou
   l'état du lecteur qui ne prend pas. Plein, le stockage se vide désormais de ce qui se
   refait depuis le réseau, puis réessaie ; et le calendrier d'hier perd ses liens. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

/* Un stockage qui compte comme Firefox : longueur de la clé plus celle de la valeur. */
function stockage(quota) {
  const m = new Map();
  const taille = () => { let t = 0; for (const [k, v] of m) t += k.length + v.length; return t; };
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      v = String(v);
      const avant = m.has(k) ? k.length + m.get(k).length : 0;
      if (taille() - avant + k.length + v.length > quota) {
        const e = new Error('plein'); e.name = 'QuotaExceededError'; throw e;
      }
      m.set(k, v);
    },
    removeItem: (k) => { m.delete(k); },
    cles: () => [...m.keys()]
  };
}

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
  const w = dom.window;
  w.__NO_AUTOSTART__ = true;
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle'])
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.fetch = () => Promise.reject(new Error('réseau coupé'));

  const scrapers = await import('../js/scrapers.js');
  const utils = await import('../js/utils.js');
  const mv = await import('../js/multiview.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };
  const poser = (ls) => Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });
  const remplir = (c) => 'x'.repeat(c);

  // ── 1. Plein : les caches refaisables partent, l'écriture passe ───────────
  let ls = stockage(10000);
  poser(ls);
  ls.setItem('fav_teams', '["Canadiens"]');
  ls.setItem('user_prefs', '{"theme":"sombre"}');
  ls.setItem('debits', remplir(300));
  ls.setItem('journal_sorties', remplir(300));
  ls.setItem('direct_media', remplir(300));
  ls.setItem('api_calendar_cache_20261018', remplir(2500));
  ls.setItem('api_calendar_cache_20261017', remplir(2500));
  ls.setItem('last_scraped_matches', remplir(2000));
  ls.setItem('stream_cache', remplir(1500));
  utils.stockageInfo.liberees.length = 0;
  const echecsAvant = utils.stockageInfo.echecs;
  assert.strictEqual(utils.safeStorageSet('mv_state', remplir(1000)), true, 'l\'écriture passe');
  assert.strictEqual(ls.getItem('mv_state').length, 1000);
  assert.deepStrictEqual(utils.stockageInfo.liberees, ['stream_cache'], 'le cache des liens part le premier, et seul s\'il suffit');
  assert.strictEqual(utils.stockageInfo.echecs, echecsAvant, 'rien n\'est compté comme refusé');
  ok('stockage plein : le cache des liens est vidé et l\'écriture passe');

  // ── 2. L'ordre, et ce qui ne part jamais ──────────────────────────────────
  utils.stockageInfo.liberees.length = 0;
  assert.strictEqual(utils.safeStorageSet('user_prefs', remplir(7000)), true);
  assert.deepStrictEqual(utils.stockageInfo.liberees, ['last_scraped_matches', 'api_calendar_cache_20261017', 'api_calendar_cache_20261018'],
    'puis les matchs du dernier scraping, puis les calendriers, le plus ancien d\'abord');
  for (const k of ['fav_teams', 'debits', 'journal_sorties', 'direct_media', 'mv_state'])
    assert.ok(ls.getItem(k) !== null, k + ' est gardé');
  ok('ensuite les matchs du dernier scraping, puis les calendriers du plus ancien au plus récent ; favoris, réglages, débits, relevé et lecteur restent');

  // ── 3. La clé qu'on écrit n'est jamais sacrifiée à elle-même ──────────────
  ls = stockage(6000);
  poser(ls);
  ls.setItem('fav_teams', '["Canadiens"]');
  ls.setItem('api_calendar_cache_20261018', remplir(3000));
  ls.setItem('stream_cache', remplir(1000));
  utils.stockageInfo.liberees.length = 0;
  assert.strictEqual(utils.safeStorageSet('api_calendar_cache_20261018', remplir(5200)), true);
  assert.deepStrictEqual(utils.stockageInfo.liberees, ['stream_cache']);
  assert.strictEqual(ls.getItem('api_calendar_cache_20261018').length, 5200);
  ok('le calendrier qu\'on réécrit n\'est pas retiré pour se faire de la place');

  // ── 3 bis. Un cache n'en chasse pas un plus utile ─────────────────────────
  ls = stockage(6000);
  poser(ls);
  ls.setItem('api_calendar_cache_20261018', remplir(3000));
  ls.setItem('stream_cache', remplir(1000));
  utils.stockageInfo.liberees.length = 0;
  const e1 = utils.stockageInfo.echecs;
  assert.strictEqual(utils.safeStorageSet('last_scraped_matches', remplir(2500)), true, 'le cache des liens lui laisse sa place');
  assert.deepStrictEqual(utils.stockageInfo.liberees, ['stream_cache']);
  assert.strictEqual(utils.safeStorageSet('last_scraped_matches', remplir(4000)), false, 'mais il ne fait pas partir le calendrier');
  assert.strictEqual(ls.getItem('api_calendar_cache_20261018').length, 3000);
  assert.strictEqual(utils.stockageInfo.echecs, e1 + 1);
  ok('les matchs du dernier scraping ne chassent pas le calendrier du jour');

  // ── 4. Rien de jetable : refus compté, comme avant ────────────────────────
  ls = stockage(2000);
  poser(ls);
  ls.setItem('fav_teams', remplir(1500));
  const e0 = utils.stockageInfo.echecs;
  assert.strictEqual(utils.safeStorageSet('user_prefs', remplir(1000)), false);
  assert.strictEqual(utils.stockageInfo.echecs, e0 + 1);
  assert.strictEqual(utils.stockageInfo.derniereCle, 'user_prefs');
  assert.strictEqual(ls.getItem('fav_teams').length, 1500, 'les favoris ne sont pas touchés');
  ok('sans cache à vider, l\'écriture est refusée et comptée, et rien d\'autre ne part');

  // ── 5. Une autre erreur que le quota ne vide rien ─────────────────────────
  ls = stockage(100000);
  ls.setItem('stream_cache', remplir(100));
  const refus = Object.assign({}, ls, { get length() { return ls.length; }, setItem: () => { const e = new Error('interdit'); e.name = 'SecurityError'; throw e; } });
  poser(refus);
  utils.stockageInfo.liberees.length = 0;
  assert.strictEqual(utils.safeStorageSet('user_prefs', '{}'), false);
  assert.deepStrictEqual(utils.stockageInfo.liberees, []);
  assert.ok(ls.getItem('stream_cache') !== null);
  ok('un refus qui n\'est pas « plein » ne vide aucun cache');

  // ── 6. Le calendrier d'hier perd ses liens, garde ses matchs ──────────────
  ls = stockage(1e7);
  poser(ls);
  const lien = { name: 'Sky Sports', url: 'https://exemple.test/watch.php?id=38', source: 'daddylive' };
  const cal = { fetchDate: '20261017', savedAt: 1, matches: [
    { id: 'a', homeTeam: 'Canadiens', awayTeam: 'Bruins', matchDate: '2026-10-17', startTime: '19:00', streamLinks: Array(40).fill(lien), streamsLoaded: true },
    { id: 'b', homeTeam: 'Leafs', awayTeam: 'Senators', matchDate: '2026-10-17', startTime: '22:30', streamLinks: [], streamsLoaded: false }
  ] };
  ls.setItem('api_calendar_cache_20261017', JSON.stringify(cal));
  const avant = ls.getItem('api_calendar_cache_20261017').length;
  assert.strictEqual(utils.allegerCalendrier('20261017'), true);
  const apres = JSON.parse(ls.getItem('api_calendar_cache_20261017'));
  assert.strictEqual(apres.matches.length, 2, 'les matchs restent (la nuit appartient à la veille)');
  assert.strictEqual(apres.matches[0].homeTeam, 'Canadiens');
  assert.deepStrictEqual(apres.matches[0].streamLinks, []);
  assert.strictEqual(apres.matches[0].streamsLoaded, false, 'un match sans lien se relira');
  assert.ok(ls.getItem('api_calendar_cache_20261017').length < avant / 5);
  assert.strictEqual(utils.allegerCalendrier('20261017'), false, 'déjà allégé : pas de réécriture');
  assert.strictEqual(utils.allegerCalendrier('20261016'), false, 'absent : rien');
  ok('le calendrier d\'hier garde ses matchs et perd ses liens fusionnés');

  // ── 7. La page Logs dit ce qui a été vidé et ce qui pèse ──────────────────
  ls = stockage(1e7);
  poser(ls);
  ls.setItem('api_calendar_cache_20261018', remplir(620 * 1024));
  utils.stockageInfo.liberees.length = 0;
  utils.stockageInfo.liberees.push('stream_cache');
  w.stockageInfo = utils.stockageInfo;
  const html = mv.diagnosticAppareilHtml();
  assert.ok(/caches vidés pour faire de la place : stream_cache/.test(html), 'les caches vidés sont dits');
  assert.ok(/api_calendar_cache_20261018 620 Ko/.test(html), 'la plus grosse clé est nommée');
  ok('la ligne « Stockage local » nomme les caches vidés et la plus grosse clé');

  // ── 8. Le cache des liens est borné (3 125 Ko dans les Logs du même soir) ──
  ls = stockage(1e8);
  poser(ls);
  const liens = (k) => Array.from({ length: 200 }, (_, i) => ({ name: 'Lien ' + i, url: 'https://exemple.test/' + k + '/' + i, source: 'footybite', site: 'exemple.test' }));
  const debut = Date.now() - 60000;
  const plein = {};
  for (let i = 0; i < 60; i++) plein['m' + i] = { ts: debut + i * 100, streams: liens('m' + i) };
  ls.setItem('stream_cache', JSON.stringify(plein));
  assert.ok(ls.getItem('stream_cache').length > 2 * scrapers.STREAM_CACHE_MAX_CARS, 'le cache de départ dépasse largement la borne');
  scrapers.saveStreamCache('nouveau', liens('nouveau'));
  const borne = JSON.parse(ls.getItem('stream_cache'));
  assert.ok(ls.getItem('stream_cache').length <= scrapers.STREAM_CACHE_MAX_CARS, 'borné');
  assert.ok(borne.nouveau && borne.nouveau.streams.length === 200, 'le match qu\'on vient de lire reste');
  assert.ok(borne.m59 && !borne.m0, 'les plus anciennement lus partent d\'abord');
  assert.strictEqual(scrapers.getStreamCache('m59').length, 200, 'et ce qui reste se relit');
  ok('le cache des liens est borné, les matchs les plus anciennement lus partent');

  console.log('unit_stockageplein: ' + n + ' groupes de tests OK');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

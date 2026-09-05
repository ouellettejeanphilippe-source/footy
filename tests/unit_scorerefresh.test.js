/* Rafraîchissement des scores en direct (js/api.js).

   Signalé à l'usage : « les scores dans l'interface ne sont plus toujours à jour ». Le
   « plus toujours » est la clé — ils l'étaient à l'ouverture, puis se figeaient.

   L'intervalle de rafraîchissement était armé DANS la branche qui lit
   `data/schedule.json`, et cette branche n'est prise qu'au tout premier chargement de la
   journée. Ensuite, le calendrier du jour est servi depuis le stockage local et
   `getApiFirstMatches` rend son résultat AVANT d'y arriver : l'intervalle n'était donc
   jamais posé, et le `loadAll` périodique de main.js ne faisait que relire ce même cache,
   figé aux scores du premier chargement.

   Ces cas verrouillent la règle : l'armement ne dépend d'aucune branche, seulement de la
   date visée. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="marea"></div></body></html>',
                        { url: 'https://exemple.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  /* Aucun réseau : si l'armement dépendait d'un aller-retour réussi, le test le montrerait. */
  globalThis.fetch = () => Promise.reject(new Error('réseau coupé'));

  const api = await import('../js/api.js');
  const config = await import('../js/config.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ── 1. Le chemin du cache local arme quand même le rafraîchissement ───────────
  /* On place un calendrier du jour déjà en cache : c'est l'état de TOUT rechargement
     après le premier, donc le cas courant, et celui où plus rien ne se rafraîchissait. */
  const aujourdhui = api.getEspnDateStr(new Date());
  dom.window.localStorage.setItem('api_calendar_cache_' + aujourdhui,
    JSON.stringify({ fetchDate: aujourdhui, matches: [{ id: 'x', league: 'MLB', homeTeam: 'A', awayTeam: 'B' }] }));

  assert.strictEqual(dom.window._backgroundRefreshStarted, undefined, 'rien ne doit être armé avant l\'appel');
  const res = await api.getApiFirstMatches(new Date());
  assert.ok(Array.isArray(res) && res.length === 1, 'le cache local doit bien être servi');
  assert.strictEqual(dom.window._backgroundRefreshStarted, true,
    'le rafraîchissement doit être armé MÊME quand les matchs viennent du cache local');
  ok('le retour anticipé sur le cache local arme quand même le rafraîchissement');

  // ── 2. Il ne s'arme qu'une fois ───────────────────────────────────────────────
  assert.strictEqual(api.startLiveScoreRefresh(), false, 'un second appel ne doit pas réarmer');
  ok('l\'armement est idempotent');

  // ── 3. Un jour passé n'arme rien ──────────────────────────────────────────────
  /* Un calendrier d'hier n'a pas de score à suivre : l'armer ferait interroger l'API pour
     rien. On vérifie sur une instance neuve, l'armement étant global. */
  const dom2 = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
  assert.strictEqual(dom2.window._backgroundRefreshStarted, undefined);
  const hier = new Date(Date.now() - 24 * 3600 * 1000);
  assert.notStrictEqual(config.getEstDateStrFromDate(hier), config.getEstDateStrFromDate(new Date()),
    'hier et aujourd\'hui doivent bien différer');
  ok('seule la date du jour justifie un rafraîchissement');

  // ── 4. Deux retours au premier plan coup sur coup n'appellent pas deux fois ───
  /* Sur téléphone, un va-et-vient rapide entre applications déclencherait autant de
     requêtes. L'écart minimal les absorbe. */
  assert.ok(api.SCORE_REFRESH_MIN_GAP_MS >= 30000,
    'l\'écart minimal doit être assez large pour absorber des va-et-vient');
  assert.ok(api.SCORE_REFRESH_MS >= api.SCORE_REFRESH_MIN_GAP_MS,
    'l\'intervalle ne doit pas être plus court que l\'écart minimal');
  const premier = await api.refreshLiveScores('test');
  const second = await api.refreshLiveScores('test rapproché');
  assert.strictEqual(second, null, 'un second rafraîchissement immédiat doit être absorbé');
  ok('deux rafraîchissements rapprochés ne font qu\'une requête');

  console.log('\n' + n + ' groupes OK — rafraîchissement des scores');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

/* Le bloc « Cet appareil » de la page Logs (js/multiview.js).

   Capture du 8 septembre 2026 : sur un téléphone, la ligne « Calendrier » disait 30
   matchs et la ligne « Liens » 241 matchs — donc les deux fichiers étaient bien arrivés —
   et pourtant TOUTES les cartes portaient la loupe « aucun lien ». Les mêmes données
   rejouées ici, contexte téléphone compris, attachaient 19 grilles sur 30, dont les 46
   liens du match en direct. Les trois lignes existantes ne pouvaient pas trancher : il
   manquait ce que la FUSION a donné sur l'appareil, si le stockage local accepte encore
   les écritures, et quelle version du code y tourne. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="sources-status-container"></div></body></html>',
                        { url: 'https://exemple.test/' });
  const w = dom.window;
  w.__NO_AUTOSTART__ = true;
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle'])
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.fetch = () => Promise.reject(new Error('réseau coupé'));

  const mv = await import('../js/multiview.js');
  const utils = await import('../js/utils.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ── 1. Le cas de la capture : tout est chargé, rien n'est rattaché ─────────
  w.calendrierInfo = { source: 'schedule.json', ageMin: 0, count: 30 };
  w.prefetchedStreamsInfo = { count: 241, ageMin: 22 };
  w.prefetchedStreamsError = null;
  w.fusionInfo = { grille: 30, avecLiens: 0, at: Date.now() };
  let html = mv.diagnosticAppareilHtml();
  assert.ok(/30 matchs/.test(html) && /schedule\.json/.test(html), 'le calendrier est dit');
  assert.ok(/241 matchs/.test(html), 'les liens sont dits');
  assert.ok(/aucun des 30 matchs n'a reçu de lien/.test(html),
    'la fusion est dite EN ÉCHEC, ce que les trois lignes précédentes ne pouvaient pas montrer');
  assert.ok(/❌/.test(html), 'et marquée comme telle');
  ok('trois sources vertes et zéro lien sur les cartes : la ligne « Fusion » le dit');

  // ── 2. Le cas normal ──────────────────────────────────────────────────────
  w.fusionInfo = { grille: 30, avecLiens: 19, at: Date.now() };
  html = mv.diagnosticAppareilHtml();
  assert.ok(/19 matchs sur 30 ont des liens/.test(html));
  ok('quand la fusion aboutit, elle dit combien de matchs sont pourvus');

  // ── 3. Un stockage plein n'échoue plus en silence ─────────────────────────
  assert.strictEqual(utils.stockageInfo.echecs, 0, 'rien de refusé au départ');
  const vrai = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    value: { length: 0, key: () => null, getItem: () => null,
             setItem: () => { const e = new Error('plein'); e.name = 'QuotaExceededError'; throw e; } },
    configurable: true, writable: true
  });
  utils.safeStorageSet('essai', 'x');
  Object.defineProperty(globalThis, 'localStorage', { value: vrai, configurable: true, writable: true });
  assert.strictEqual(utils.stockageInfo.echecs, 1, 'l\'écriture refusée est comptée');
  assert.strictEqual(utils.stockageInfo.derniereErreur, 'QuotaExceededError', 'et sa raison retenue');
  assert.strictEqual(utils.stockageInfo.derniereCle, 'essai');
  html = mv.diagnosticAppareilHtml();
  assert.ok(/écriture\(s\) refusée\(s\)/.test(html) && /QuotaExceededError/.test(html),
    'la page Logs montre un stockage qui refuse d\'écrire');
  ok('une écriture refusée par le stockage local est comptée, sa raison retenue et affichée');

  // ── 4. Quelle version tourne sur cet appareil ─────────────────────────────
  assert.ok(/sports-guide-v/.test(mv.VERSION_APP), 'la version est nommée comme le cache du service worker');
  assert.ok(html.indexOf(mv.VERSION_APP) >= 0, 'et affichée : un appareil sur une copie ancienne se reconnaît');
  const sw = require('fs').readFileSync(require('path').join(__dirname, '..', 'sw.js'), 'utf8');
  assert.ok(sw.indexOf("'" + mv.VERSION_APP + "'") >= 0,
    'VERSION_APP et CACHE_NAME (sw.js) doivent rester en phase, sinon la ligne ment');
  ok('la version affichée est celle du cache du service worker, et les deux restent en phase');

  console.log(`unit_diagnosticappareil: ${n} groupes de tests OK`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

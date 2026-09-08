/* Bouton « Mettre à jour l'app » (js/multiview.js).

   « Ajouter bouton actualiser pour version pwa ? » (8 septembre 2026) Installée sur
   l'écran d'accueil, l'application est servie par son service worker : une version
   publiée peut mettre du temps à la remplacer, et recharger la page n'y change rien
   puisque c'est le service worker qui répond. C'est exactement le cas qu'on soupçonnait
   quand un appareil ne montrait pas la même chose qu'un autre.

   La règle que ces cas verrouillent : on retire le service worker et TOUS ses caches,
   et on ne touche PAS au stockage local — préférences, favoris, calendrier du jour. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/app/' });
  const w = dom.window;
  w.__NO_AUTOSTART__ = true;
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle'])
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.fetch = () => Promise.reject(new Error('réseau coupé'));

  const mv = await import('../js/multiview.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ── 1. Service worker retiré, tous les caches vidés ────────────────────────
  const retires = [];
  const supprimes = [];
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    value: { getRegistrations: () => Promise.resolve([
      { unregister: () => { retires.push('a'); return Promise.resolve(true); } },
      { unregister: () => { retires.push('b'); return Promise.resolve(true); } }
    ]) }, configurable: true
  });
  globalThis.caches = {
    keys: () => Promise.resolve(['sports-guide-v10', 'sports-guide-v11']),
    delete: (nom) => { supprimes.push(nom); return Promise.resolve(true); }
  };

  globalThis.localStorage.setItem('userPrefs', '{"cardColor":"gradient"}');
  globalThis.localStorage.setItem('fav_teams', '["Canadiens"]');

  const bilan = await mv.viderCachesApplication();
  assert.strictEqual(bilan.serviceWorkers, 2, 'les deux enregistrements sont comptés');
  assert.deepStrictEqual(retires, ['a', 'b'], 'et retirés');
  assert.strictEqual(bilan.caches, 2);
  assert.deepStrictEqual(supprimes, ['sports-guide-v10', 'sports-guide-v11'],
    'TOUS les caches sont vidés, pas seulement l\'ancien : c\'est la copie servie qu\'on veut remplacer');
  ok('le service worker est retiré et tous ses caches vidés');

  // ── 2. Les réglages de l'utilisateur ne sont PAS effacés ───────────────────
  assert.strictEqual(globalThis.localStorage.getItem('userPrefs'), '{"cardColor":"gradient"}',
    'les préférences survivent : on met à jour le code, pas les réglages');
  assert.strictEqual(globalThis.localStorage.getItem('fav_teams'), '["Canadiens"]', 'les favoris aussi');
  ok('le stockage local n\'est pas touché : préférences et favoris survivent');

  // ── 3. Un navigateur sans service worker ni caches ne fait pas d'histoire ──
  delete globalThis.caches;
  Object.defineProperty(globalThis.navigator, 'serviceWorker', { value: undefined, configurable: true });
  const vide = await mv.viderCachesApplication();
  assert.deepStrictEqual(vide, { serviceWorkers: 0, caches: 0 }, 'rien à retirer, et aucune exception');
  ok('sans service worker ni caches, la mise à jour ne lève rien');

  // ── 4. Le bouton est bien offert dans la page Logs ─────────────────────────
  const html = mv.diagnosticAppareilHtml();
  assert.ok(/mettreAJourApplication\(\)/.test(html), 'le bloc « Cet appareil » porte le bouton');
  assert.ok(html.indexOf(mv.VERSION_APP) >= 0, 'à côté de la version qui tourne, pour comparer avant/après');
  const sw = require('fs').readFileSync(require('path').join(__dirname, '..', 'sw.js'), 'utf8');
  assert.ok(sw.indexOf("'" + mv.VERSION_APP + "'") >= 0, 'VERSION_APP et CACHE_NAME restent en phase');
  const html2 = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(/id="btn-maj-app"[^>]*mettreAJourApplication\(\)/.test(html2), 'et le menu « Plus » aussi');
  ok('le bouton est offert dans la page Logs et dans le menu « Plus »');

  console.log(`unit_majapp: ${n} groupes de tests OK`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

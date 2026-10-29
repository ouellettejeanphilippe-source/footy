/* Le direct automatique (js/multiview.js, peutPasserEnDirect, toggleDirectAuto).

   « Passer seul en mode direct quand le test du flux répond » (29 octobre 2026, « fais tout
   ça »). Une page de site, c'est le lecteur et toute sa régie ; son flux direct, un seul
   <video>. La tuile y passe d'elle-même quand la sonde répond — mais jamais une tuile
   qu'on a remise en page à la main, jamais deux fois pour le même lien, jamais un flux qui a
   déjà échoué deux fois ici, et jamais réglage coupé. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="toast"><span id="toasttxt"></span></div></body></html>', { url: 'https://exemple.test/' });
  const w = dom.window;
  w.__NO_AUTOSTART__ = true;
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle'])
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.fetch = () => Promise.reject(new Error('réseau coupé'));

  await import('../js/scrapers.js');
  const mv = await import('../js/multiview.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };
  const neuf = { echecs: 0 };

  assert.strictEqual(mv.directAutoActif(), true, 'allumé par défaut');
  assert.strictEqual(mv.peutPasserEnDirect({ mode: 'page' }, neuf), true, 'une tuile sur sa page, un flux neuf : oui');
  assert.strictEqual(mv.peutPasserEnDirect({}, neuf), true, 'une tuile sans mode (pas encore posée) : oui');
  assert.strictEqual(mv.peutPasserEnDirect({ mode: 'direct' }, neuf), false, 'déjà en direct');
  assert.strictEqual(mv.peutPasserEnDirect({ mode: 'page', _pageChoisie: true }, neuf), false, 'remise en page à la main');
  assert.strictEqual(mv.peutPasserEnDirect({ mode: 'page', _directAutoFait: true }, neuf), false, 'une fois par lien');
  assert.strictEqual(mv.peutPasserEnDirect({ mode: 'page' }, { echecs: 2 }), false, 'un flux qui a échoué deux fois ici');
  assert.strictEqual(mv.peutPasserEnDirect({ mode: 'page' }, null), false, 'sans flux connu');
  ok('les règles : une fois par lien, jamais contre la main de l\'utilisateur, jamais un flux qui échoue');

  assert.strictEqual(mv.toggleDirectAuto(), false);
  assert.strictEqual(localStorage.getItem('direct_auto'), '0', 'le réglage est retenu');
  assert.strictEqual(mv.peutPasserEnDirect({ mode: 'page' }, neuf), false, 'coupé : rien ne bouge');
  assert.strictEqual(mv.toggleDirectAuto(), true);
  assert.strictEqual(localStorage.getItem('direct_auto'), '1');
  ok('le réglage direct_auto coupe et rallume');

  console.log(`unit_directauto : ${n} groupes OK`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

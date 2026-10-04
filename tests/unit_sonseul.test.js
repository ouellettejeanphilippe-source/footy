/* Le son avec UNE seule vidéo (js/multiview.js).

   « Ça unmute avec plusieurs players mais pas un » (4 octobre 2026). L'identifiant de
   l'iframe (`mv-iframe-N`) n'était posé qu'au redessin SUIVANT de la grille. Avec
   plusieurs vidéos, chaque ajout redessine, et les cadres finissent par l'avoir ; avec
   une seule, rien ne venait après. `cadreDeTuile(0)` ne trouvait donc rien : le signal
   « joue » du script utilisateur n'était rattaché à aucune tuile, et l'ordre `mv_unmute`
   n'était jamais envoyé. Ce test fait le parcours complet avec une vidéo seule. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="toast"><span id="toasttxt"></span></div></body></html>', { url: 'https://exemple.test/app/' });
  const w = dom.window;
  w.__NO_AUTOSTART__ = true;
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'CustomEvent', 'MessageEvent', 'KeyboardEvent', 'location', 'history', 'getComputedStyle'])
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.fetch = () => Promise.reject(new Error('réseau coupé'));

  await import('../js/scrapers.js');
  const mv = await import('../js/multiview.js');

  // Le lecteur réel : c'est `setupMultivisionUI` qui pose l'écouteur des messages du script.
  mv.setupMultivisionUI();
  document.getElementById('mv-container').style.display = 'flex';
  const grille = document.getElementById('mv-grid');

  mv.mvFlux.push({ url: 'https://flux.test/seul', name: 'Seul' });
  mv.updateMultivisionLayout();
  await new Promise(r => setTimeout(r, 30));   // le cadre est posé après resolveStreamUrl

  const cadre = grille.querySelector('iframe.mv-iframe');
  assert.ok(cadre, 'le cadre est posé');
  assert.strictEqual(cadre.id, 'mv-iframe-0', 'il porte son identifiant dès sa création, sans attendre un redessin');
  assert.strictEqual(mv.cadreDeTuile(0), cadre);
  console.log('  ✓ une vidéo seule : son cadre est retrouvé');

  // Le script utilisateur annonce « joue » : la tuile (la seule, donc l'active) reçoit le son.
  const recus = [];
  const fenCadre = cadre.contentWindow;
  fenCadre.postMessage = (m) => recus.push(m);
  w.dispatchEvent(new w.MessageEvent('message', { data: { __mv: 'video_state', playing: true, cause: 'joue' }, source: fenCadre }));
  assert.strictEqual(mv.mvFlux[0]._playing, true, 'le signal « joue » est rattaché à la tuile');
  assert.ok(recus.includes('mv_unmute'), 'l\'ordre de rendre le son est envoyé : ' + recus.join(','));
  console.log('  ✓ une vidéo seule : elle reçoit le son dès qu\'elle joue');

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

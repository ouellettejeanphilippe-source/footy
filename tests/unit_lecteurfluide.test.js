/* Le lecteur au quotidien : chargement, commandes, nom des tuiles (js/multiview.js).

   « Le multiview est vraiment cool, mais les emplacements des boutons, le fait que ça
   cache les menus et les lags de chargement font que c'est pas toujours évident »
   (9 octobre 2026). Ce que ces cas verrouillent :

   1. Au démarrage, les tuiles de la séance précédente ne se chargent pas derrière le
      guide, lecteur fermé : elles partent à l'ouverture du lecteur.
   2. Des tuiles posées ensemble partent l'une après l'autre, et chacune dit qu'elle
      charge, jusqu'au `load` de son cadre ou au premier signal « joue ».
   3. Chaque tuile porte le nom de son match.
   4. Le repos n'efface pas la barre sous un menu ouvert, et le lecteur qui revient au
      premier plan revient avec ses commandes. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="epg"></div><div id="toast"><span id="toasttxt"></span></div></body></html>', { url: 'https://exemple.test/app/' });
  const w = dom.window;
  w.__NO_AUTOSTART__ = true;
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'CustomEvent', 'MessageEvent', 'KeyboardEvent', 'location', 'history', 'getComputedStyle'])
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.fetch = () => Promise.reject(new Error('réseau coupé'));

  /* La séance précédente : trois vidéos. */
  localStorage.setItem('mv_state', JSON.stringify({
    flux: ['A', 'B', 'C'].map((x) => ({ url: 'https://flux' + x.toLowerCase() + '.test/live', name: 'Match ' + x, mid: 'm' + x })),
    layout: 'auto'
  }));

  await import('../js/scrapers.js');
  const mv = await import('../js/multiview.js');
  const menu = await import('../js/mv-menu.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

  mv.setupMultivisionUI();
  const mvc = document.getElementById('mv-container');
  const grille = document.getElementById('mv-grid');
  const barre = document.getElementById('mv-toolbar');

  // ── 1. Rien ne se charge lecteur fermé ─────────────────────────────────────
  assert.strictEqual(mvc.style.display, 'none', 'le lecteur démarre fermé');
  assert.strictEqual(mv.mvFlux.length, 3, 'la séance est restaurée');
  await attendre(650);   // la restauration redessinait 500 ms après le démarrage
  assert.strictEqual(grille.querySelectorAll('.mv-cell').length, 0, 'aucune tuile posée derrière le guide');
  assert.strictEqual(document.querySelectorAll('iframe').length, 0, 'aucune page de diffusion chargée');
  ok('au démarrage, rien ne se charge tant que le lecteur est fermé');

  // ── 2. À l'ouverture : l'une après l'autre, avec un indicateur ─────────────
  mv.toggleMultiview();
  const cellules = () => Array.from(grille.querySelectorAll('.mv-cell')).sort((a, b) => a.dataset.index - b.dataset.index);
  assert.strictEqual(cellules().length, 3, 'l\'ouverture pose les tuiles');
  cellules().forEach((c, i) => assert.ok(c.querySelector('.mv-chargement'), 'la tuile ' + (i + 1) + ' dit qu\'elle charge'));
  await attendre(30);
  const cadres = () => cellules().map((c) => c.querySelector('iframe.mv-iframe'));
  assert.ok(cadres()[0], 'la première part tout de suite');
  assert.ok(!cadres()[1] && !cadres()[2], 'les suivantes attendent leur tour');
  assert.ok(cellules()[1].querySelector('.mv-chargement'), 'et le disent');
  await attendre(2 * mv.ECART_CHARGEMENT_MS + 60);
  assert.ok(cadres().every(Boolean), 'toutes finissent par partir');
  assert.deepStrictEqual(cadres().map((f) => f.src), mv.mvFlux.map((s) => s.url), 'chacune sur sa propre source');
  assert.deepStrictEqual(cadres().map((f) => f.id), ['mv-iframe-0', 'mv-iframe-1', 'mv-iframe-2']);
  assert.ok(!cadres().some((f) => f.hasAttribute('sandbox')), 'toujours sans attribut sandbox');

  cadres()[0].dispatchEvent(new w.Event('load'));
  assert.strictEqual(cellules()[0].querySelector('.mv-chargement'), null, 'le chargement du cadre retire l\'indicateur');
  const fen1 = cadres()[1].contentWindow;
  fen1.postMessage = () => {};
  w.dispatchEvent(new w.MessageEvent('message', { data: { __mv: 'video_state', playing: true }, source: fen1 }));
  assert.strictEqual(cellules()[1].querySelector('.mv-chargement'), null, 'une vidéo qui joue aussi');
  assert.ok(cellules()[2].querySelector('.mv-chargement'), 'les autres le gardent');
  ok('les tuiles partent l\'une après l\'autre et disent qu\'elles chargent');

  // ── 3. Le nom du match sur chaque tuile ────────────────────────────────────
  assert.deepStrictEqual(cellules().map((c) => c.querySelector('.mv-tile-name').textContent), ['Match A', 'Match B', 'Match C']);
  assert.ok(cellules()[0].querySelector('.mv-tile-id .mv-source-pill'), 'la source reste dessous');
  ok('chaque tuile porte le nom de son match');

  // ── 4. Le repos ne cache pas la barre sous un menu ouvert ──────────────────
  /* On capture le minuteur du repos au lieu d'attendre trois secondes. */
  const vraiSet = globalThis.setTimeout;
  let repos = null;
  globalThis.setTimeout = (fn, ms, ...r) => { if (ms === 3000) { repos = fn; return 0; } return vraiSet(fn, ms, ...r); };
  w.resetMvIdleTimer();
  assert.strictEqual(barre.style.opacity, '1');
  menu.ouvrirMenu(document.getElementById('mv-more-btn'), [{ label: 'Mode cinéma', onSelect() {} }]);
  const premier = repos; repos = null;
  premier();
  const enTetes = () => cellules().map((c) => c.querySelector('.mv-hdr').style.opacity);
  assert.strictEqual(barre.style.opacity, '1', 'menu ouvert : la barre reste');
  assert.ok(enTetes().every((o) => o === '1'), 'et les en-têtes de tuiles aussi');
  assert.ok(repos, 'et le repos est simplement repoussé');
  menu.fermerMenus();
  const second = repos;
  second();
  assert.ok(enTetes().every((o) => o === '0'), 'menu fermé : le repos efface les en-têtes, posés sur la vidéo');
  assert.strictEqual(barre.style.opacity, '1', 'mais jamais la barre, qui a sa propre bande : l\'effacer ne rendait aucune place');
  w.resetMvIdleTimer();
  globalThis.setTimeout = vraiSet;
  ok('le repos n\'efface pas la barre sous un menu ouvert');

  // ── 5. Le lecteur qui revient au premier plan revient avec ses commandes ───
  mv.toggleMultiviewPip();   // on part sur le Live : le lecteur est masqué
  assert.strictEqual(mvc.style.display, 'none');
  assert.ok(cadres().every(Boolean), 'ses vidéos restent chargées');
  mv.toggleMultiviewPip();   // l'onglet Lecteur
  assert.strictEqual(mvc.style.display, 'flex');
  assert.strictEqual(barre.style.opacity, '1', 'la barre est là, pas effacée par le repos d\'avant');
  assert.ok(cellules().every((c) => c.querySelector('.mv-hdr').style.opacity === '1'), 'les en-têtes de tuiles aussi');
  ok('rouvrir le lecteur rend ses commandes, et ses vidéos n\'ont pas rechargé');

  // ── 6. La garde contre les redirections ────────────────────────────────────
  /* Armée seulement quand des vidéos sont chargées, levée pour les navigations voulues
     par l'application, et désactivable. Le comportement réel (dialogue du navigateur,
     clic dans un lecteur hostile) est vérifié dans tests/test_app_boot.spec.js. */
  const quitter = () => { const e = new w.Event('beforeunload', { cancelable: true }); w.dispatchEvent(e); return e.defaultPrevented; };
  assert.strictEqual(mv.gardeSortieArmee(), true, 'des vidéos chargées : armée');
  assert.strictEqual(quitter(), true, 'quitter la page est retenu');
  mv.autoriserSortie();
  assert.strictEqual(quitter(), false, 'une navigation voulue par l\'application passe');
  assert.strictEqual(mv.gardeSortieArmee(Date.now() + 6000), true, 'pour quelques secondes seulement');
  const flux = mv.mvFlux.splice(0);
  assert.strictEqual(mv.gardeSortieArmee(Date.now() + 6000), false, 'sans vidéo, rien à garder');
  mv.mvFlux.push(...flux);
  mv.toggleGardeSortie();
  assert.strictEqual(mv.gardeSortieArmee(Date.now() + 6000), false, 'le réglage la coupe');
  assert.strictEqual(localStorage.getItem('garde_sortie'), '0', 'et il est retenu');
  mv.toggleGardeSortie();
  ok('la garde contre les redirections est armée quand il le faut, et seulement alors');

  console.log(`unit_lecteurfluide: ${n} groupes de tests OK`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

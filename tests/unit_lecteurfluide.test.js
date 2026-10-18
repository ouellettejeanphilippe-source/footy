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
  /* Armée quand des vidéos sont chargées, levée pour les navigations voulues par
     l'application, désactivable, et levée quand c'est l'utilisateur qui s'en va
     (« ça me demande souvent si je veux quitter quand je ferme la page, ce qui devrait
     jamais arriver », 18 octobre 2026) : pointeur sorti par le haut, touche de
     raccourci. Mais armée sans geste dans une tuile : le même jour, « l'onglet de
     l'appli » est parti sur une régie « tout seul, sans clic », la garde n'étant armée
     qu'après un clic. Le comportement réel (dialogue du navigateur, clic dans un
     lecteur hostile, fermeture de l'onglet) est vérifié dans tests/test_app_boot.spec.js. */
  const quitter = () => { const e = new w.Event('beforeunload', { cancelable: true }); w.dispatchEvent(e); return e.defaultPrevented; };
  const souris = (type, init) => document.dispatchEvent(new w.MouseEvent(type, Object.assign({ bubbles: true }, init)));
  const touche = (type, key, init) => document.dispatchEvent(new w.KeyboardEvent(type, Object.assign({ key, bubbles: true }, init)));
  assert.strictEqual(mv.gardeSortieArmee(), true, 'des vidéos chargées, sans aucun geste : armée (un cadre peut emmener l\'onglet tout seul)');
  assert.strictEqual(quitter(), true, 'un lecteur qui emmène l\'onglet est retenu');

  souris('mouseout', { relatedTarget: null, clientX: 300, clientY: -2 });
  assert.strictEqual(mv.gardeSortieArmee(), false, 'pointeur sorti par le haut, vers les onglets ou la croix : fermer passe');
  assert.strictEqual(quitter(), false);
  souris('mousemove', { clientX: 300, clientY: 200 });
  assert.strictEqual(mv.gardeSortieArmee(), true, 'le pointeur revient : armée');
  souris('mouseout', { relatedTarget: null, clientX: 300, clientY: 400 });
  assert.strictEqual(mv.gardeSortieArmee(), true, 'sorti par le bas ou un côté (vers un autre écran) : on regarde encore');

  touche('keydown', 'Control', { ctrlKey: true });
  assert.strictEqual(mv.gardeSortieArmee(), false, 'Ctrl enfoncé (Ctrl+W, Ctrl+R) : le navigateur ne transmet pas la lettre, mais la touche Ctrl');
  touche('keyup', 'Control');
  assert.strictEqual(mv.gardeSortieArmee(), true, 'relâché : armée');
  const t0 = performance.now();
  mv.noterTouche(true, false, t0);
  assert.strictEqual(mv.gardeSortieArmee(undefined, t0 + mv.MODIFICATEUR_MAX_MS + 1), true, 'un relâchement perdu ne lève pas la garde indéfiniment');
  mv.noterTouche(false, true, t0);
  assert.strictEqual(mv.gardeSortieArmee(undefined, t0 + 100), false, 'F5 : on recharge soi-même');
  assert.strictEqual(mv.gardeSortieArmee(undefined, t0 + mv.TOUCHE_DEPART_MS + 1), true, 'pour un instant seulement');

  mv.autoriserSortie();
  assert.strictEqual(mv.gardeSortieArmee(undefined, t0 + 1e9), false, 'une navigation voulue par l\'application passe');
  assert.strictEqual(mv.gardeSortieArmee(Date.now() + 6000, t0 + 1e9), true, 'pour quelques secondes seulement');
  const flux = mv.mvFlux.splice(0);
  assert.strictEqual(mv.gardeSortieArmee(Date.now() + 6000, t0 + 1e9), false, 'sans vidéo, rien à garder');
  mv.mvFlux.push(...flux);
  /* Une tuile sans page de site (mode direct, chargement, panneau de sortie forcée) ne
     peut pas emmener l'onglet : rien à garder. */
  const pages = [...document.querySelectorAll('iframe[id^="mv-iframe-"]')];
  assert.ok(pages.length > 0 && mv.pagesDeSites() === pages.length, 'les tuiles affichent la page d\'un site');
  const srcs = pages.map((f) => f.getAttribute('src'));
  pages.forEach((f) => f.removeAttribute('src'));
  assert.strictEqual(mv.pagesDeSites(), 0);
  assert.strictEqual(mv.gardeSortieArmee(Date.now() + 6000, t0 + 1e9), false, 'aucune page de site dans les tuiles : rien à garder');
  pages.forEach((f, i) => f.setAttribute('src', srcs[i]));
  assert.strictEqual(mv.gardeSortieArmee(Date.now() + 6000, t0 + 1e9), true);
  souris('mouseout', { relatedTarget: null, clientX: 300, clientY: mv.MARGE_HAUT_PX });
  assert.strictEqual(mv.gardeSortieArmee(Date.now() + 6000, t0 + 1e9), false, 'sorti à quelques pixels du haut : Firefox ne rapporte que la dernière position vue');
  assert.strictEqual(mv.etatGarde().sortieFenetre.y, mv.MARGE_HAUT_PX, 'et le relevé le dit');
  souris('mousemove', { clientX: 300, clientY: 200 });
  souris('mouseout', { relatedTarget: null, clientX: 300, clientY: mv.MARGE_HAUT_PX + 30 });
  assert.strictEqual(mv.gardeSortieArmee(Date.now() + 6000, t0 + 1e9), true, 'plus bas, par un côté : on regarde encore');
  souris('mousemove', { clientX: 300, clientY: 200 });
  const t1 = performance.now();
  souris('mousedown', { button: 3, clientX: 300, clientY: 200 });
  assert.strictEqual(mv.gardeSortieArmee(Date.now() + 6000), false, 'bouton Précédent de la souris : on recule soi-même');
  assert.strictEqual(mv.etatGarde().derniereTouche.touche, 'bouton Précédent de la souris');
  assert.strictEqual(mv.gardeSortieArmee(Date.now() + 6000, t1 + mv.TOUCHE_DEPART_MS + 50), true, 'pour un instant seulement');
  mv.toggleGardeSortie();
  assert.strictEqual(mv.gardeSortieArmee(Date.now() + 6000, t0 + 1e9), false, 'le réglage la coupe');
  assert.strictEqual(localStorage.getItem('garde_sortie'), '0', 'et il est retenu');
  mv.toggleGardeSortie();
  ok('la garde contre les redirections reste armée, sauf quand c\'est l\'utilisateur qui s\'en va');

  console.log(`unit_lecteurfluide: ${n} groupes de tests OK`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

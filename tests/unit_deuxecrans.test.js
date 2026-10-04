/* Mode deux écrans (js/deuxecrans.js, js/multiview.js).

   « Créer mode deux écrans où un flux joue sur un écran, avec les trois autres qui se
   détachent pour mon deuxième écran. » Ce que ces cas verrouillent :

   1. la RÉPARTITION — la tuile 1 reste dans la page, les autres partent dans la seconde
      fenêtre, et la place de chacune y est fixée (trois tuiles : une grande, deux
      empilées) ;
   2. le CHOIX DE L'ÉCRAN — un autre écran que celui de la page, de préférence pas le
      principal, et toute sa surface ;
   3. le CÂBLAGE — une tuile posée dans une autre fenêtre a cette fenêtre pour parent :
      ses messages doivent être renvoyés à la page, les ordres doivent partir de cette
      fenêtre (le script utilisateur n'obéit qu'à elle), et les `onclick` des en-têtes y
      trouver leurs fonctions. Fermer la fenêtre ramène toutes les tuiles.

   `window.open` n'existe pas dans jsdom : une seconde instance joue la seconde fenêtre. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ══ A. Le module pur ═══════════════════════════════════════════════════════
  const D = await import('../js/deuxecrans.js');

  assert.strictEqual(D.ecranDeTuile(0), 1);
  assert.strictEqual(D.ecranDeTuile(1), 2);
  assert.strictEqual(D.ecranDeTuile(3), 2);
  ok('la tuile 1 reste sur l\'écran de la page, les autres partent');

  assert.deepStrictEqual(D.placementSecondEcran(0).places, []);
  assert.deepStrictEqual(D.placementSecondEcran(1), { colonnes: '1fr', lignes: 'repeat(1, 1fr)', places: [{ ligne: '1', colonne: '1' }] });
  assert.strictEqual(D.placementSecondEcran(2).lignes, 'repeat(2, 1fr)');
  const p3 = D.placementSecondEcran(3);
  assert.strictEqual(p3.colonnes, '1fr');
  assert.strictEqual(p3.lignes, 'repeat(3, 1fr)');
  assert.deepStrictEqual(p3.places.map(p => p.ligne + '|' + p.colonne), ['1|1', '2|1', '3|1']);
  ok('« les trois doivent être verticales » : une seule colonne, une tuile par ligne');

  const gauche = { availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040, isPrimary: true };
  const droite = { availLeft: 1920, availTop: 0, availWidth: 2560, availHeight: 1400, isPrimary: false };
  assert.strictEqual(D.ecranSecondaire([gauche, droite], gauche), droite);
  assert.strictEqual(D.ecranSecondaire([gauche, droite], droite), gauche);
  assert.strictEqual(D.ecranSecondaire([gauche], gauche), null);
  assert.strictEqual(D.ecranSecondaire([], gauche), null);
  assert.strictEqual(D.ecranSecondaire(null, gauche), null);
  // Une copie de l'écran courant (autre objet, mêmes mesures) reste l'écran courant.
  assert.strictEqual(D.ecranSecondaire([Object.assign({}, gauche), droite], gauche), droite);
  ok('l\'écran choisi est un autre que celui de la page');

  assert.strictEqual(D.optionsFenetre(droite), 'popup=yes,left=1920,top=0,width=2560,height=1400');
  assert.strictEqual(D.optionsFenetre(null), 'popup=yes,width=1280,height=720');
  ok('la fenêtre prend toute la surface de l\'autre écran, sinon une 16:9 à glisser');

  // ══ B. Le câblage dans le lecteur ══════════════════════════════════════════
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/app/' });
  const w = dom.window;
  w.__NO_AUTOSTART__ = true;
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'CustomEvent', 'MessageEvent', 'KeyboardEvent', 'location', 'history', 'getComputedStyle'])
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.fetch = () => Promise.reject(new Error('réseau coupé'));

  await import('../js/scrapers.js');
  const mv = await import('../js/multiview.js');

  // Le lecteur tel que `setupMultivisionUI` le construit, réduit à ce qui compte ici.
  const conteneur = document.createElement('div');
  conteneur.id = 'mv-container';
  conteneur.style.display = 'flex';
  const wrapper = document.createElement('div');
  wrapper.id = 'mv-grid-wrapper';
  const grille = document.createElement('div');
  grille.id = 'mv-grid';
  wrapper.appendChild(grille);
  conteneur.appendChild(wrapper);
  document.body.appendChild(conteneur);
  document.body.insertAdjacentHTML('beforeend', '<div id="toast"><span id="toasttxt"></span></div>');

  ['A', 'B', 'C', 'D'].forEach((x) => mv.mvFlux.push({ url: 'https://flux.test/' + x, name: 'Match ' + x }));
  mv.updateMultivisionLayout();
  assert.strictEqual(grille.querySelectorAll('.mv-cell').length, 4);

  // La seconde fenêtre.
  const dom2 = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/app/', runScripts: 'dangerously' });
  const fen = dom2.window;
  let optionsVues = null;
  w.open = (url, nom, options) => { optionsVues = options; return fen; };

  await mv.toggleDeuxEcrans();
  const grille2 = fen.document.getElementById('mv-grid-2');
  assert.ok(grille2, 'la seconde fenêtre porte sa grille');
  assert.strictEqual(optionsVues, 'popup=yes,width=1280,height=720', 'sans liste d\'écrans : une fenêtre à glisser');
  assert.ok(mv.deuxEcransActif());
  const ici = Array.from(grille.querySelectorAll('.mv-cell')).map(c => c.dataset.index);
  const labas = Array.from(grille2.querySelectorAll('.mv-cell')).map(c => c.dataset.index).sort();
  assert.deepStrictEqual(ici, ['0']);
  assert.deepStrictEqual(labas, ['1', '2', '3']);
  assert.strictEqual(grille2.style.gridTemplateColumns, '1fr');
  assert.strictEqual(grille2.style.gridTemplateRows, 'repeat(3, 1fr)');
  assert.deepStrictEqual([1, 2, 3].map(i => mv.celluleDeTuile(i).style.gridRow), ['1', '2', '3']);
  assert.strictEqual(grille.style.gridTemplateColumns, '1fr', 'la page n\'a plus qu\'une tuile, en grand');
  ok('la vidéo 1 reste dans la page, les trois autres partent sur le second écran');

  assert.strictEqual(mv.celluleDeTuile(2).ownerDocument, fen.document, 'une tuile se retrouve où qu\'elle soit');
  assert.strictEqual(mv.toutesLesCellules().length, 4);
  ok('les tuiles se retrouvent dans les deux fenêtres');

  // Les `onclick` des en-têtes se résolvent dans la seconde fenêtre.
  for (const f of ['ouvrirMenuTuile', 'removeFromMultivision', 'nextFluxForTile', 'cycleMvFit', 'mettreSurEcranPrincipal'])
    assert.strictEqual(typeof fen[f], 'function', f + ' manque à la seconde fenêtre');
  ok('les boutons des tuiles du second écran trouvent leurs fonctions');

  // Les ordres partent de la seconde fenêtre ; les messages des lecteurs reviennent.
  assert.strictEqual(typeof fen.__mvRelais, 'function', 'le relais est défini dans la seconde fenêtre');
  const recus = [];
  const cible = { postMessage: (m) => recus.push(m) };
  let relaye = null;
  const faux = { contentWindow: cible, ownerDocument: { defaultView: { __mvRelais: (c, m) => { relaye = m; c.postMessage(m, '*'); } } } };
  mv.posterATuile(faux, 'mv_unmute');
  assert.strictEqual(relaye, 'mv_unmute', 'une tuile d\'une autre fenêtre reçoit l\'ordre par le relais');
  const local = { contentWindow: cible, ownerDocument: document };
  mv.posterATuile(local, 'mv_mute');
  assert.deepStrictEqual(recus, ['mv_unmute', 'mv_mute']);
  ok('les ordres partent de la fenêtre qui encadre la tuile');

  let renvoye = null;
  const ecoute = (e) => { if (e.data === 'sonde_ecran2') renvoye = e; };
  w.addEventListener('message', ecoute);
  fen.dispatchEvent(new fen.MessageEvent('message', { data: 'sonde_ecran2', source: null }));
  w.removeEventListener('message', ecoute);
  assert.ok(renvoye, 'un message adressé à la seconde fenêtre arrive à la page');
  ok('les messages des lecteurs du second écran reviennent à la page');

  /* « Ça doit swap comme quand dans même fenêtre » : la vidéo choisie et la principale
     ÉCHANGENT leurs places, les autres ne bougent pas. */
  const noms = () => mv.mvFlux.map(s => s.name);
  const celluleDe = (nom) => mv.toutesLesCellules().find(c => mv.mvFlux[+c.dataset.index].name === nom);
  const avant = noms();                       // [A, B, C, D]
  const celluleB = celluleDe(avant[1]);
  mv.mettreSurEcranPrincipal(2);
  assert.deepStrictEqual(noms(), [avant[2], avant[1], avant[0], avant[3]], 'C et A échangent, B et D restent');
  assert.deepStrictEqual(Array.from(grille.querySelectorAll('.mv-cell')).map(c => c.dataset.index), ['0']);
  assert.strictEqual(celluleDe(avant[0]).ownerDocument, fen.document, 'l\'ancienne principale part sur le second écran');
  assert.strictEqual(celluleDe(avant[0]).style.gridRow, '2', 'à la place exacte de celle qui est venue');
  assert.strictEqual(celluleDe(avant[1]), celluleB, 'B n\'a pas été reconstruite');
  assert.strictEqual(celluleB.style.gridRow, '1', 'B garde sa place');
  assert.strictEqual(mv.activeMvIdx, 0, 'la vidéo qui arrive devant a le son');
  ok('⇄ échange la vidéo choisie avec la principale, sans déranger les autres');

  // Le bouton ⇄ est dans l'en-tête des tuiles du second écran, pas de la principale.
  assert.ok(mv.celluleDeTuile(1).querySelector('.mv-swap-btn'));
  assert.ok(!mv.celluleDeTuile(0).querySelector('.mv-swap-btn'));
  ok('le bouton ⇄ est sur les tuiles du second écran');

  // Glisser-déposer d'un écran à l'autre : rien au survol, l'échange au dépôt.
  const etat = noms();                        // [C, B, A, D]
  const depuis = mv.celluleDeTuile(3);        // D, second écran
  const vers = mv.celluleDeTuile(0);          // C, page
  const dt = { setData() {}, getData() { return '3'; } };
  const evt = (doc, type) => { const e = new doc.defaultView.Event(type, { bubbles: true, cancelable: true }); e.dataTransfer = dt; return e; };
  depuis.ondragstart(evt(fen.document, 'dragstart'));
  vers.ondragenter(evt(document, 'dragenter'));
  assert.deepStrictEqual(noms(), etat, 'survoler une tuile de l\'autre écran ne la déplace pas');
  vers.ondrop(evt(document, 'drop'));
  assert.deepStrictEqual(noms(), [etat[3], etat[1], etat[2], etat[0]], 'D et C échangent au dépôt');
  assert.strictEqual(w.draggedMvIdx, null, 'le glisser est terminé même sans dragend');
  assert.strictEqual(celluleDe(etat[0]).ownerDocument, fen.document);
  ok('glisser une vidéo d\'un écran à l\'autre l\'échange au dépôt');

  // Fermer une tuile : la disposition suit.
  mv.removeFromMultivision(3);
  assert.strictEqual(grille2.querySelectorAll('.mv-cell').length, 2);
  assert.strictEqual(grille2.style.gridTemplateRows, 'repeat(2, 1fr)');
  ok('fermer une vidéo du second écran redispose les autres');

  // Fermer la seconde fenêtre ramène toutes les tuiles.
  mv.fermerDeuxEcrans();
  assert.ok(!mv.deuxEcransActif());
  assert.strictEqual(grille.querySelectorAll('.mv-cell').length, 3);
  assert.strictEqual(grille2.querySelectorAll('.mv-cell').length, 0);
  ok('fermer le second écran ramène toutes les vidéos dans la page');

  // Le mode câble n'a qu'une vidéo : pas de second écran.
  w.open = () => { throw new Error('ne doit pas ouvrir'); };
  mv.toggleModeCable();
  await mv.toggleDeuxEcrans();
  assert.ok(!mv.deuxEcransActif());
  mv.toggleModeCable();
  ok('le mode câble refuse le second écran');

  console.log(n + ' cas vérifiés');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

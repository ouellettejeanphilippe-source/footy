/* La manette (js/manette.js).

   « Je veux l'APK avec les mêmes fonctions que le site, mais avec contrôle à la manette ;
   la manette pourrait marcher sur PC et Android aussi » (25 octobre 2026). Ce test garde :
   - la lecture d'une manette « standard » : croix et stick gauche confondus, seuils des
     gâchettes, zone morte du défilement, boutons donnés en nombres (anciens navigateurs) ;
   - les appuis : un bouton tenu ne compte qu'une fois, une flèche tenue se répète ;
   - l'action de chaque bouton selon l'écran (lecteur ou non, mode câble ou non) ;
   - le double emploi : quand la plateforme livre aussi la croix, A ou B comme des touches
     (Android), la manette se tait pour cette entrée au lieu de la jouer deux fois. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

let m;
test.before(async () => { m = await import(path.join(__dirname, '..', 'js', 'manette.js')); });

/* Une manette « standard » : 17 boutons, 4 axes. */
function manette(boutons, axes) {
  const b = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  Object.entries(boutons || {}).forEach(([i, v]) => { b[i] = typeof v === 'object' ? v : { pressed: !!v, value: v ? 1 : 0 }; });
  return { index: 0, connected: true, mapping: 'standard', buttons: b, axes: axes || [0, 0, 0, 0] };
}

test('lecture : croix et stick gauche confondus, gâchettes au seuil, défilement hors zone morte', () => {
  let e = m.etatManette(manette({ 12: true, 0: true }));
  assert.strictEqual(e.haut, true);
  assert.strictEqual(e.a, true);
  assert.strictEqual(e.bas, false);
  e = m.etatManette(manette({}, [0.8, -0.3, 0, 0]));
  assert.strictEqual(e.droite, true, 'stick à droite');
  assert.strictEqual(e.haut, false, 'sous le seuil');
  e = m.etatManette(manette({ 6: { pressed: false, value: 0.7 }, 7: { pressed: false, value: 0.2 } }));
  assert.strictEqual(e.lt, true, 'gâchette enfoncée aux trois quarts');
  assert.strictEqual(e.rt, false, 'gâchette effleurée');
  assert.strictEqual(m.etatManette(manette({}, [0, 0, 0, 0.1])).defilement, 0, 'zone morte');
  assert.strictEqual(m.etatManette(manette({}, [0, 0, 0, -0.9])).defilement, -0.9);
  const vieux = { buttons: [1, 0, 0, 0], axes: [] };
  assert.strictEqual(m.etatManette(vieux).a, true, 'boutons en nombres');
  assert.strictEqual(m.etatManette(null).a, false, 'sans manette, rien');
});

test('appuis : un bouton tenu compte une fois, une flèche tenue se répète', () => {
  const mem = {};
  const etat = (o) => Object.assign(m.etatManette(manette()), o);
  assert.deepStrictEqual(m.appuis(etat({ a: true, bas: true }), {}, 0, mem).sort(), ['a', 'bas']);
  assert.deepStrictEqual(m.appuis(etat({ a: true, bas: true }), etat({ a: true, bas: true }), 100, mem), [], 'tenus, pas encore de répétition');
  assert.deepStrictEqual(m.appuis(etat({ a: true, bas: true }), etat({ a: true, bas: true }), m.REPETITION_PREMIERE_MS, mem), ['bas'], 'la flèche se répète, A non');
  assert.deepStrictEqual(m.appuis(etat({ a: true, bas: true }), etat({ a: true, bas: true }), m.REPETITION_PREMIERE_MS + 10, mem), [], 'pas avant REPETITION_MS');
  assert.deepStrictEqual(m.appuis(etat({ a: true, bas: true }), etat({ a: true, bas: true }), m.REPETITION_PREMIERE_MS + m.REPETITION_MS, mem), ['bas']);
  assert.deepStrictEqual(m.appuis(etat({}), etat({ a: true, bas: true }), 2000, mem), [], 'relâchés');
  assert.deepStrictEqual(m.appuis(etat({ a: true }), etat({}), 2100, mem), ['a'], 'appuyé de nouveau');
});

test('actions : la télécommande partout, les boutons du lecteur dans le lecteur', () => {
  const hors = { lecteur: false, modeCable: false };
  const lecteur = { lecteur: true, modeCable: false };
  const cable = { lecteur: true, modeCable: true };
  assert.deepStrictEqual(m.actionManette('gauche', hors), { type: 'fleche', direction: 'gauche' });
  assert.deepStrictEqual(m.actionManette('a', hors), { type: 'ok' });
  assert.deepStrictEqual(m.actionManette('b', lecteur), { type: 'retour' });
  assert.deepStrictEqual(m.actionManette('start', hors), { type: 'lecteur' });
  assert.deepStrictEqual(m.actionManette('start', lecteur), { type: 'live' });
  assert.deepStrictEqual(m.actionManette('select', hors), { type: 'menu' });
  assert.deepStrictEqual(m.actionManette('rb', hors), { type: 'vue', sens: 1 }, 'hors du lecteur, LB/RB changent de vue');
  assert.deepStrictEqual(m.actionManette('lb', hors), { type: 'vue', sens: -1 });
  assert.strictEqual(m.actionManette('y', hors), null, 'Y hors du lecteur ne fait rien');
  assert.deepStrictEqual(m.actionManette('rb', lecteur), { type: 'tuile', sens: 1 });
  assert.deepStrictEqual(m.actionManette('lb', cable), { type: 'chaine', sens: -1 }, 'mode câble : le match');
  assert.deepStrictEqual(m.actionManette('lt', cable), { type: 'source', sens: -1 });
  assert.deepStrictEqual(m.actionManette('rt', lecteur), { type: 'source', sens: 1 });
  assert.deepStrictEqual(m.actionManette('y', lecteur), { type: 'pleinEcran' });
  assert.deepStrictEqual(m.actionManette('x', lecteur), { type: 'modeCable' });
  assert.strictEqual(m.tuileVoisine(0, 3, -1), 2, 'en boucle');
  assert.strictEqual(m.tuileVoisine(2, 3, 1), 0);
  assert.strictEqual(m.tuileVoisine(null, 3, 1), 1, 'sans tuile active : la première');
  assert.strictEqual(m.tuileVoisine(0, 0, 1), -1);
  assert.ok(m.AIDE_MANETTE.includes('A ok') && m.AIDE_MANETTE.includes('B retour'));
});

/* Une fenêtre factice : horloge, minuteries et images à la main. */
function fenetre() {
  const ecoute = {};
  const w = {
    t: 0, minuteurs: [], images: [], pad: null,
    navigator: { getGamepads: () => [w.pad] },
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    addEventListener: (n, f) => { (ecoute[n] = ecoute[n] || []).push(f); },
    removeEventListener: (n, f) => { ecoute[n] = (ecoute[n] || []).filter((g) => g !== f); },
    emettre: (n, e) => (ecoute[n] || []).forEach((f) => f(e || {})),
    setTimeout: (f, ms) => { const id = w.minuteurs.length + 1; w.minuteurs.push({ id, f, a: w.t + ms }); return id; },
    clearTimeout: (id) => { w.minuteurs = w.minuteurs.filter((x) => x.id !== id); },
    requestAnimationFrame: (f) => { w.images.push(f); return w.images.length; },
    cancelAnimationFrame: () => { w.images = []; },
    avancer(ms) {
      w.t += ms;
      const dus = w.minuteurs.filter((x) => x.a <= w.t);
      w.minuteurs = w.minuteurs.filter((x) => x.a > w.t);
      dus.forEach((x) => x.f());
    },
    image() { const f = w.images.shift(); if (f) f(); }
  };
  return w;
}

function brancher(w, ctx) {
  const faits = [];
  const aides = [];
  const action = (nom) => (...args) => faits.push([nom, ...args]);
  const actions = {};
  ['fleche', 'ok', 'retour', 'lecteur', 'live', 'menu', 'vue', 'tuile', 'chaine', 'source', 'pleinEcran', 'modeCable', 'defiler'].forEach((n) => { actions[n] = action(n); });
  const r = m.brancherManette({ win: w, actions, contexte: () => ctx, maintenant: () => w.t, aide: (t) => aides.push(t) });
  return { faits, aides, r };
}

test('à la manette : A et la croix partent après un court délai, les boutons du lecteur tout de suite', () => {
  const w = fenetre();
  w.pad = manette();
  const { faits, aides } = brancher(w, { lecteur: true, modeCable: false });
  w.image();
  w.pad = manette({ 0: true, 5: true });
  w.image();
  assert.deepStrictEqual(faits, [['tuile', 1]], 'RB tout de suite');
  assert.strictEqual(aides.length, 1, 'l\'aide à la première pression');
  w.avancer(m.DELAI_NATIF_MS);
  assert.deepStrictEqual(faits, [['tuile', 1], ['ok']], 'A ensuite');
  w.pad = manette({}, [0, 0, 0, 0.6]);
  w.image();
  assert.deepStrictEqual(faits.at(-1), ['defiler', 0.6]);
  w.pad = manette({ 13: true });
  w.image();
  w.avancer(m.DELAI_NATIF_MS);
  assert.deepStrictEqual(faits.at(-1), ['fleche', 'bas']);
  assert.strictEqual(aides.length, 1, 'une seule fois par séance');
});

test('double emploi : la plateforme livre aussi la touche, la manette se tait pour elle', () => {
  const w = fenetre();
  w.pad = manette();
  const { faits, r } = brancher(w, { lecteur: false });
  w.image();
  // La croix vers le bas, et Android livre aussi ArrowDown (vraie touche) dans la foulée.
  w.pad = manette({ 13: true });
  w.image();
  w.avancer(20);
  w.emettre('keydown', { key: 'ArrowDown', isTrusted: true });
  w.avancer(m.DELAI_NATIF_MS);
  assert.deepStrictEqual(faits, [], 'pas joué deux fois');
  assert.strictEqual(r.natives.bas, true, 'la plateforme s\'en charge désormais');
  // Les appuis suivants restent à la plateforme, sans délai ni double.
  w.pad = manette();
  w.image();
  w.pad = manette({ 13: true });
  w.image();
  w.avancer(500);
  assert.deepStrictEqual(faits, []);
  // Une touche synthétique (la nôtre, ou un script) ne compte pas.
  w.pad = manette();
  w.image();
  w.pad = manette({ 12: true });
  w.image();
  w.emettre('keydown', { key: 'ArrowUp', isTrusted: false });
  w.avancer(m.DELAI_NATIF_MS);
  assert.deepStrictEqual(faits, [['fleche', 'haut']]);
  // B : le Retour natif de l'APK (MainActivity) arrive comme un événement de la page.
  w.pad = manette();
  w.image();
  w.pad = manette({ 1: true });
  w.image();
  w.emettre('retourTeleNatif');
  w.avancer(m.DELAI_NATIF_MS);
  assert.deepStrictEqual(faits, [['fleche', 'haut']], 'B déjà fait par Android');
  assert.strictEqual(r.natives.b, true);
  r.arreter();
});

test('sans manette, rien ne tourne ; une manette vue qui disparaît un instant est retrouvée', () => {
  const w = fenetre();
  w.navigator.getGamepads = () => [null, null];
  brancher(w, {});
  assert.strictEqual(w.images.length, 0, 'aucune image demandée');
  assert.strictEqual(w.minuteurs.length, 0, 'ni recherche au ralenti : aucune manette vue');
  w.navigator.getGamepads = () => [manette()];
  w.emettre('gamepadconnected');
  assert.strictEqual(w.images.length, 1);
  w.image();
  /* « Après toast et sortie du multiview, plus de manette » : la liste revient vide un
     instant (page cachée, focus perdu), et aucun gamepadconnected ne suit. */
  w.navigator.getGamepads = () => [];
  w.image();
  assert.strictEqual(w.images.length, 0, 'plus d\'image tant qu\'elle manque');
  assert.strictEqual(w.minuteurs.length, 1, 'mais une recherche au ralenti');
  w.avancer(m.ATTENTE_MANETTE_MS);
  w.image();
  assert.strictEqual(w.minuteurs.length, 1, 'toujours absente : on cherche encore');
  w.navigator.getGamepads = () => [manette()];
  w.avancer(m.ATTENTE_MANETTE_MS);
  assert.strictEqual(w.images.length, 1, 'revenue : la boucle repart, sans événement');
});

test('page cachée : pas d\'image, recherche au ralenti, reprise au retour', () => {
  const w = fenetre();
  w.pad = manette();
  brancher(w, {});
  w.image();
  // La manette manque un instant, puis la page passe derrière le lecteur natif.
  w.pad = null;
  w.image();
  assert.strictEqual(w.minuteurs.length, 1);
  w.document.hidden = true;
  w.avancer(m.ATTENTE_MANETTE_MS);
  assert.strictEqual(w.images.length, 0, 'cachée : aucune image demandée');
  assert.strictEqual(w.minuteurs.length, 1, 'mais toujours recherchée au ralenti');
  // Retour à l'application, manette là : la boucle repart.
  w.document.hidden = false;
  w.pad = manette();
  w.avancer(m.ATTENTE_MANETTE_MS);
  assert.strictEqual(w.images.length, 1);
  w.image();
  w.pad = manette({ 0: true });
  w.image();
  w.avancer(m.DELAI_NATIF_MS);
});

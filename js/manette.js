/* La manette (« je veux l'APK avec les mêmes fonctions que le site, mais avec contrôle à la
   manette ; la manette pourrait marcher sur PC et Android aussi », 25 octobre 2026).

   L'API Gamepad du navigateur, la même partout : Chrome, Edge et Firefox sur ordinateur,
   Chrome sur Android, la WebView de l'APK (Chromecast avec Google TV), la version de
   bureau. Une manette Xbox, PlayStation ou générique en disposition « standard ».

   Principe : la manette EST la télécommande, plus quelques boutons.
     - croix ou stick gauche : les flèches (navigation du mode TV, js/tv-navigation.js ;
       dans le lecteur en mode câble, ◀ ▶ source et ▲ ▼ match, comme au doigt) ;
     - A : OK (le bouton qui a le focus) ; B : Retour (window.retourTele, js/main.js) ;
     - Start : le lecteur, ou le retour au Live ; Select : le menu ⋯ Plus ;
     - dans le lecteur : LB / RB tuile précédente / suivante (le son la suit ; en mode
       câble, match précédent / suivant), LT / RT source précédente / suivante, Y plein
       écran, X mode câble ;
     - stick droit : défilement.
   Une flèche tenue se répète (REPETITION_PREMIERE_MS, puis REPETITION_MS).

   Le double emploi. Sur Android, le système peut AUSSI livrer la croix, A et B comme des
   touches (DPAD, Entrée, Retour), que la page et l'APK traitent déjà. Chromium les garde
   pour l'API Gamepad dès qu'une page la lit, mais rien ne le garantit sur chaque
   appareil. Les flèches, A et B partent donc après DELAI_NATIF_MS ; si une vraie touche
   équivalente (`isTrusted`) arrive autour de l'appui, c'est que la plateforme s'en
   charge : on annule, et on lui laisse cette entrée pour la suite (`natives`).

   Module sans import : les actions viennent de l'appelant (brancherManetteApplication,
   js/multiview.js), la logique se teste sans navigateur. */

export var SEUIL_STICK = 0.5;
export var SEUIL_GACHETTE = 0.5;
export var MORT_DEFILEMENT = 0.2;
export var REPETITION_PREMIERE_MS = 400;
export var REPETITION_MS = 130;
export var DELAI_NATIF_MS = 80;
export var FENETRE_NATIVE_MS = 150;

/* La disposition « standard » de l'API Gamepad (w3c.github.io/gamepad, figure 1). */
var BOUTONS = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, haut: 12, bas: 13, gauche: 14, droite: 15 };
export var DIRECTIONS = ['haut', 'bas', 'gauche', 'droite'];
/* Les entrées que la plateforme peut livrer elle-même comme des touches. */
export var ENTREES_NATIVES = ['haut', 'bas', 'gauche', 'droite', 'a', 'b'];

function bouton(gp, nom, seuil) {
  var b = gp && gp.buttons && gp.buttons[BOUTONS[nom]];
  if (!b) return false;
  if (typeof b === 'number') return b > (seuil || 0.5);
  return !!b.pressed || (typeof b.value === 'number' && b.value > (seuil || 0.5));
}

function axe(gp, i) {
  var v = gp && gp.axes && gp.axes[i];
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

/* L'état logique d'une manette : quels boutons sont tenus, la croix et le stick gauche
   confondus, et le défilement du stick droit (-1 à 1, zéro dans la zone morte). */
export function etatManette(gp) {
  var e = {};
  ['a', 'b', 'x', 'y', 'lb', 'rb', 'select', 'start'].forEach(function (n) { e[n] = bouton(gp, n); });
  e.lt = bouton(gp, 'lt', SEUIL_GACHETTE);
  e.rt = bouton(gp, 'rt', SEUIL_GACHETTE);
  var sx = axe(gp, 0), sy = axe(gp, 1);
  e.haut = bouton(gp, 'haut') || sy < -SEUIL_STICK;
  e.bas = bouton(gp, 'bas') || sy > SEUIL_STICK;
  e.gauche = bouton(gp, 'gauche') || sx < -SEUIL_STICK;
  e.droite = bouton(gp, 'droite') || sx > SEUIL_STICK;
  var dy = axe(gp, 3);
  e.defilement = Math.abs(dy) > MORT_DEFILEMENT ? dy : 0;
  return e;
}

/* Ce qui vient d'être appuyé entre deux lectures, flèches tenues répétées comprises.
   `memoire` garde, par entrée, depuis quand elle est tenue et sa dernière répétition. */
export function appuis(etat, precedent, maintenant, memoire) {
  var p = precedent || {};
  var m = memoire || {};
  var sortie = [];
  Object.keys(etat).forEach(function (n) {
    if (n === 'defilement') return;
    if (!etat[n]) { delete m[n]; return; }
    if (!p[n]) { m[n] = { depuis: maintenant, repete: maintenant }; sortie.push(n); return; }
    if (DIRECTIONS.indexOf(n) < 0 || !m[n]) return;
    if (maintenant - m[n].depuis >= REPETITION_PREMIERE_MS && maintenant - m[n].repete >= REPETITION_MS) {
      m[n].repete = maintenant;
      sortie.push(n);
    }
  });
  return sortie;
}

/* L'action d'une entrée, selon l'écran. `ctx` : { lecteur, modeCable }. */
export function actionManette(entree, ctx) {
  var c = ctx || {};
  if (DIRECTIONS.indexOf(entree) >= 0) return { type: 'fleche', direction: entree };
  switch (entree) {
    case 'a': return { type: 'ok' };
    case 'b': return { type: 'retour' };
    case 'start': return { type: c.lecteur ? 'live' : 'lecteur' };
    case 'select': return { type: 'menu' };
  }
  if (!c.lecteur) return null;
  switch (entree) {
    case 'lb': return c.modeCable ? { type: 'chaine', sens: -1 } : { type: 'tuile', sens: -1 };
    case 'rb': return c.modeCable ? { type: 'chaine', sens: 1 } : { type: 'tuile', sens: 1 };
    case 'lt': return { type: 'source', sens: -1 };
    case 'rt': return { type: 'source', sens: 1 };
    case 'y': return { type: 'pleinEcran' };
    case 'x': return { type: 'modeCable' };
  }
  return null;
}

/* La touche du clavier (ou de la télécommande) qui vaut la même entrée : c'est elle que
   la plateforme livrerait si elle se chargeait de l'entrée. */
export function toucheEquivalente(entree) {
  return { haut: 'ArrowUp', bas: 'ArrowDown', gauche: 'ArrowLeft', droite: 'ArrowRight', a: 'Enter', b: 'Escape' }[entree] || null;
}

/* La tuile voisine, en boucle. */
export function tuileVoisine(actuelle, nombre, sens) {
  if (!nombre) return -1;
  var i = (actuelle == null || actuelle < 0 || actuelle >= nombre) ? 0 : actuelle;
  return ((i + sens) % nombre + nombre) % nombre;
}

/* Le texte d'aide montré à la première manette de la séance. */
export var AIDE_MANETTE = '🎮 Manette : ✚ naviguer · A ok · B retour · Start lecteur · Select menu · '
  + 'dans le lecteur : LB/RB tuile (match en mode câble) · LT/RT source · Y plein écran · X mode câble';

/* Branche la manette sur la page. `o` :
     win, actions { fleche(dir), ok(), retour(), lecteur(), live(), menu(), tuile(sens),
       chaine(sens), source(sens), pleinEcran(), modeCable(), defiler(dy), eveil() },
     contexte() → { lecteur, modeCable }, maintenant() (ms), aide(texte).
   Rend { arreter, natives } (natives : les entrées que la plateforme livre elle-même). */
export function brancherManette(o) {
  var win = o.win;
  var actions = o.actions || {};
  var maintenant = o.maintenant || function () { return Date.now(); };
  var precedents = {};
  var memoires = {};
  var natives = {};
  var enAttente = {};
  var dernieresTouches = {};
  var boucle = null;
  var aideMontree = false;

  function lire() {
    try { return Array.prototype.filter.call((win.navigator.getGamepads && win.navigator.getGamepads()) || [], Boolean); }
    catch (e) { return []; }
  }

  function executer(entree) {
    var a = actionManette(entree, o.contexte ? o.contexte() : {});
    if (!a) return;
    if (typeof actions.eveil === 'function') actions.eveil();
    var f = actions[a.type];
    if (typeof f !== 'function') return;
    if (a.type === 'fleche') f(a.direction);
    else if ('sens' in a) f(a.sens);
    else f();
  }

  /* Une vraie touche équivalente vue autour de l'appui : la plateforme s'en charge. */
  function noterToucheReelle(entree) {
    var t = maintenant();
    dernieresTouches[entree] = t;
    var att = enAttente[entree];
    if (att && t - att.at <= FENETRE_NATIVE_MS) {
      win.clearTimeout(att.minuteur);
      delete enAttente[entree];
      natives[entree] = true;
    }
  }

  function planifier(entree) {
    if (natives[entree]) return;
    var t = maintenant();
    if (dernieresTouches[entree] != null && t - dernieresTouches[entree] <= FENETRE_NATIVE_MS) { natives[entree] = true; return; }
    var att = { at: t };
    att.minuteur = win.setTimeout(function () {
      if (enAttente[entree] !== att) return;
      delete enAttente[entree];
      executer(entree);
    }, DELAI_NATIF_MS);
    if (enAttente[entree]) win.clearTimeout(enAttente[entree].minuteur);
    enAttente[entree] = att;
  }

  function tour() {
    boucle = null;
    var manettes = lire();
    if (!manettes.length) return;
    var t = maintenant();
    manettes.forEach(function (gp) {
      var cle = gp.index != null ? gp.index : 0;
      var etat = etatManette(gp);
      var nouveaux = appuis(etat, precedents[cle], t, memoires[cle] || (memoires[cle] = {}));
      precedents[cle] = etat;
      if (nouveaux.length && !aideMontree) {
        aideMontree = true;
        if (typeof o.aide === 'function') o.aide(AIDE_MANETTE);
      }
      nouveaux.forEach(function (n) {
        if (ENTREES_NATIVES.indexOf(n) >= 0) planifier(n);
        else executer(n);
      });
      if (etat.defilement && typeof actions.defiler === 'function') actions.defiler(etat.defilement);
    });
    demarrer();
  }

  function demarrer() {
    if (boucle != null || win.document.hidden) return;
    boucle = win.requestAnimationFrame(tour);
  }

  function surTouche(e) {
    if (!e || !e.isTrusted) return;
    ENTREES_NATIVES.forEach(function (n) { if (toucheEquivalente(n) === e.key) noterToucheReelle(n); });
  }

  win.addEventListener('gamepadconnected', demarrer);
  win.addEventListener('keydown', surTouche, true);
  win.document.addEventListener('visibilitychange', demarrer);
  /* Le Retour d'Android ne passe pas par une touche de la page : l'APK appelle
     window.retourTele (MainActivity). Le B de la manette qui le déclenche aussi est le
     même cas que les autres. */
  function surRetourNatif() { noterToucheReelle('b'); }
  win.addEventListener('retourTeleNatif', surRetourNatif);
  if (lire().length) demarrer();

  return {
    natives: natives,
    arreter: function () {
      if (boucle != null) win.cancelAnimationFrame(boucle);
      boucle = null;
      win.removeEventListener('gamepadconnected', demarrer);
      win.removeEventListener('keydown', surTouche, true);
      win.removeEventListener('retourTeleNatif', surRetourNatif);
      win.document.removeEventListener('visibilitychange', demarrer);
    }
  };
}

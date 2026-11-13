/* Les réactions des gens pendant un match (13 novembre 2026, « avoir un genre Twitter en direct,
   les commentaires des gens »).

   X refuse d'être encadré (`X-Frame-Options`, comme sa recherche) et ses widgets n'ont pas de
   recherche : rien ne peut s'afficher DANS la page. Ce qui marche : la recherche en direct de X
   (`f=live`, les plus récents d'abord), déjà remplie avec les équipes du match, dans une fenêtre
   étroite posée contre le bord droit de l'écran. Elle porte la session X du navigateur : connecté
   d'avance, on lit tout et on peut répondre.

   Ordinateur seulement : sur téléphone et dans l'APK, `window.open` ne pose pas de fenêtre à côté.

   Module sans import : `js/ui.js` (la fiche) et `js/multiview.js` (la barre du lecteur) le câblent. */

export var LARGEUR_REACTIONS = 440;
export var NOM_FENETRE_REACTIONS = 'footy_reactions_x';

/* Le second « nom » d'une course ou d'une séance n'est pas une équipe (`Race`, `FP1`, `Qualifying`). */
function estSeance(nom) {
    return /^(race|fp\d?|qual|sprint|practice)/i.test(nom);
}

function propre(nom) {
    return String(nom == null ? '' : nom).replace(/["“”«»]/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Les noms à chercher : les deux équipes, ou le seul nom d'un événement (course, gala). */
export function equipesAChercher(m) {
    if (!m) return [];
    var dom = propre(m.homeTeam), vis = propre(m.awayTeam);
    var noms = [];
    if (dom) noms.push(dom);
    if (vis && !estSeance(vis) && vis.toLowerCase() !== dom.toLowerCase()) noms.push(vis);
    return noms;
}

/* La requête : chaque nom entre guillemets, l'un OU l'autre (un message ne cite souvent
   qu'une des deux équipes). Vide quand le match n'a pas de nom. */
export function requeteReactions(m) {
    return equipesAChercher(m).map(function(n) { return '"' + n + '"'; }).join(' OR ');
}

/* L'adresse de la recherche en direct de X, ou '' sans requête. */
export function adresseReactionsX(m) {
    var q = requeteReactions(m);
    return q ? 'https://x.com/search?q=' + encodeURIComponent(q) + '&f=live' : '';
}

/* Les `features` de `window.open` : une colonne contre le bord droit de l'écran, sur toute sa
   hauteur. Sans mesures d'écran, une fenêtre de la même largeur que le navigateur place. */
export function optionsFenetreReactions(ecran) {
    var e = ecran || {};
    var l = Number(e.availWidth), h = Number(e.availHeight);
    if (!(l > 0) || !(h > 0)) return 'popup=yes,width=' + LARGEUR_REACTIONS + ',height=800';
    var largeur = Math.min(LARGEUR_REACTIONS, l);
    var gauche = (Number(e.availLeft) || 0) + l - largeur;
    return 'popup=yes,left=' + gauche + ',top=' + (Number(e.availTop) || 0)
        + ',width=' + largeur + ',height=' + h;
}

/* Une fenêtre à côté n'a de sens que sur un ordinateur (souris, pas l'APK ni la télé). */
export function reactionsPossibles(w) {
    if (!w || typeof w.open !== 'function') return false;
    if (w.__ANDROID_TV__ || w.Capacitor) return false;
    try { return !!(w.matchMedia && w.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches); } catch (e) { return false; }
}

/* Ouvre (ou réutilise, par son nom) la fenêtre des réactions du match. Rend 'ouverte',
   'bloquee' (le navigateur a refusé la fenêtre) ou 'rien' (match sans nom). */
export function ouvrirReactionsX(m, w) {
    var adresse = adresseReactionsX(m);
    if (!adresse || !w || typeof w.open !== 'function') return 'rien';
    var f = null;
    try { f = w.open(adresse, NOM_FENETRE_REACTIONS, optionsFenetreReactions(w.screen)); } catch (e) { f = null; }
    if (!f) return 'bloquee';
    try { f.focus(); } catch (e) {}
    return 'ouverte';
}

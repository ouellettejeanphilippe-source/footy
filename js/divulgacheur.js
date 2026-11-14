/* Mode anti-divulgâcheur (14 novembre 2026, « ya des idées à s'inspirer? » : le mode
   « anti-spoiler » d'une autre application, transposé au sport) : Réglages → Look →
   « Masquer les scores ». Pour le match qu'on regarde en retard : plus aucun score sur les
   cartes, le bandeau vedette, le Guide, la fiche, le lecteur et les panneaux ; les buteurs
   et les statistiques du match (tirs moins arrêts donne le score) partent avec, par la
   classe `sans-scores` (styles.css).

   Un seul interrupteur, lu partout par `scoreAffiche(m)` au lieu de `m.score` : masqué, un
   match se dessine comme s'il n'avait pas de score (« VS », « En direct »). L'état du match
   (direct, minute, terminé) reste : il ne dit pas qui gagne. Sans import. */

var masque = false;

export function scoresMasques() { return masque; }

/* Pose l'état, et la classe sur la racine du document (les blocs cachés par CSS). */
export function reglerScoresMasques(actif, doc) {
    masque = !!actif;
    var d = doc || (typeof document !== 'undefined' ? document : null);
    if (d && d.documentElement) d.documentElement.classList.toggle('sans-scores', masque);
    return masque;
}

/* Le score à montrer : celui du match, ou rien quand les scores sont masqués. */
export function scoreAffiche(m) {
    if (masque || !m) return null;
    return m.score || null;
}

/* Le match tel qu'un module sans import doit le voir (js/cable.js, js/statsmatch.js) :
   lui-même, ou une copie sans score. */
export function matchSansDivulgacher(m) {
    if (!masque || !m || !m.score) return m;
    var c = Object.assign({}, m);
    c.score = null;
    return c;
}

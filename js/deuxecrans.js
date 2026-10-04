/* Mode deux écrans (js/multiview.js pour le DOM).

   « Créer mode deux écrans où un flux joue sur un écran, avec les trois autres qui se
   détachent pour mon deuxième écran » (3 octobre 2026). La tuile 1 reste dans la page ;
   les suivantes partent dans une fenêtre ordinaire, posée sur l'autre écran quand le
   navigateur sait les nommer (Window Management API), et qu'on peut passer en plein
   écran. Pas le PiP de document : sa fenêtre reste au premier plan et ne passe jamais
   en plein écran.

   La tuile principale est la PREMIÈRE, pas la tuile active : déplacer une tuile d'une
   fenêtre à l'autre recharge son iframe, et suivre la tuile active rechargerait deux
   vidéos à chaque clic. On change de principale exprès (touches 1 à 4, ou le menu).

   Ce module ne touche pas au DOM et n'importe rien. */

/* Sur quel écran va la tuile d'index `idx` : 1 (la page) ou 2 (la fenêtre détachée). */
export function ecranDeTuile(idx) {
    return idx === 0 ? 1 : 2;
}

/* La grille du second écran pour `n` tuiles : modèle de colonnes, de lignes, et la place
   de chacune. Les tuiles sont EMPILÉES, une seule colonne (« les trois doivent être
   verticales », 4 octobre 2026). */
export function placementSecondEcran(n) {
    n = Math.max(0, n | 0);
    var places = [];
    for (var i = 0; i < n; i++) places.push({ ligne: String(i + 1), colonne: '1' });
    return { colonnes: '1fr', lignes: 'repeat(' + Math.max(1, n) + ', 1fr)', places: places };
}

/* Fenêtre ÉTIRÉE sur les deux écrans (« faire comme si c'était la même fenêtre, pour
   pas avoir à recharger », 4 octobre 2026) : une seule page, donc un échange ne déplace
   aucune iframe et ne recharge rien. Reste à caler la colonne de la vidéo principale sur
   le premier écran : rend la part de la grille (0 à 1) qui se trouve avant la frontière
   entre les deux écrans.

   `ecranGauche`/`ecranLargeur` décrivent `window.screen`, l'écran qui porte la plus grande
   part de la fenêtre. Si la fenêtre commence avant lui, la frontière est son bord gauche ;
   sinon, son bord droit. Une frontière introuvable ou collée à un bord (fenêtre pas encore
   étirée) donne la moitié. */
export function partPremierEcran(m) {
    if (!m || !(m.grilleLargeur > 0)) return 0.5;
    var frontiere = m.fenetreX < m.ecranGauche ? m.ecranGauche : m.ecranGauche + m.ecranLargeur;
    var f = (frontiere - m.fenetreX - (m.grilleGauche || 0)) / m.grilleLargeur;
    if (!isFinite(f) || f < 0.15 || f > 0.85) return 0.5;
    return Math.round(f * 1000) / 1000;
}

/* Parmi les écrans que rend `getScreenDetails()`, celui où poser la fenêtre : un autre
   que celui de la page. Rend null quand il n'y en a qu'un (ou aucune liste). */
export function ecranSecondaire(ecrans, courant) {
    if (!ecrans || !ecrans.length) return null;
    var memeEcran = function(a, b) {
        return !!(a && b) && (a === b || (a.availLeft === b.availLeft && a.availTop === b.availTop
            && a.availWidth === b.availWidth && a.availHeight === b.availHeight));
    };
    var autres = ecrans.filter(function(e) { return !memeEcran(e, courant); });
    if (!autres.length) return null;
    var nonPrincipal = autres.filter(function(e) { return !e.isPrimary; });
    return (nonPrincipal.length ? nonPrincipal : autres)[0];
}

/* Les `features` de `window.open` : toute la surface de l'écran choisi, sinon une
   fenêtre 16:9 qu'on glisse soi-même sur l'autre écran. `popup` évite l'onglet. */
export function optionsFenetre(ecran) {
    if (ecran && ecran.availWidth > 0 && ecran.availHeight > 0) {
        return 'popup=yes,left=' + ecran.availLeft + ',top=' + ecran.availTop
            + ',width=' + ecran.availWidth + ',height=' + ecran.availHeight;
    }
    return 'popup=yes,width=1280,height=720';
}

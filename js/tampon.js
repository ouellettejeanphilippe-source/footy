/* Le tampon d'historique (18 octobre 2026, le soir : « ça redirige encore contre mon gré
   sans intervention de ma part », relevé à l'appui : page quittée moins d'une seconde
   après la pose des vidéos, puis retour sur l'appli cinq secondes plus tard).

   Mesuré dans Firefox 158 : la page d'une vidéo qui appelle `history.back()` fait
   reculer tout l'onglet, sans clic, parce que l'historique est celui de l'onglet. Le
   script 1.17 rend cette fonction inerte dans les cadres, mais seulement une fois mis à
   jour dans Tampermonkey, et seulement là où il arrive à temps. L'application ne peut ni
   annuler ce recul (`navigate` arrive après `beforeunload`, non annulable) ni le voir
   venir.

   Elle peut l'absorber : une entrée d'historique de plus, dans le même document, au
   sommet de la pile. Le recul demandé par la vidéo y retombe sans quitter la page (un
   `popstate`, ni `beforeunload` ni dialogue, vérifié dans Firefox 158), et l'application
   repose le tampon. Quand c'est l'utilisateur qui recule (bouton ← du navigateur, pointeur
   parti vers lui ; Alt+← ; boutons de la souris ; balayage du pavé tactile), elle le
   laisse partir en reculant d'un cran de plus.

   Seulement sur ordinateur : sur téléphone et sur la télé, le Retour du système ne laisse
   aucun signe dans la page, et le tampon l'avalerait.

   Module sans import : `js/multiview.js` le câble. */

export var ETAT_TAMPON = { mvTampon: 1 };

export function estTampon(etat) {
    return !!(etat && typeof etat === 'object' && etat.mvTampon === 1);
}

/* Un balayage horizontal du pavé tactile (le geste « Précédent » de Firefox) compte comme
   un recul voulu pendant ce délai. */
export var BALAYAGE_MS = 1500;

export function tamponPossible(w) {
    if (!w || !w.history || typeof w.history.pushState !== 'function') return false;
    if (w.__ANDROID_TV__ || w.Capacitor) return false;
    try { return !!(w.matchMedia && w.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches); } catch (e) { return false; }
}

/* Le tampon vient d'être consommé : laisser l'onglet reculer, ou reposer le tampon.
   `etat` : { reglage, pages, utilisateurPart, balayage }. */
export function decisionRetour(etat) {
    var e = etat || {};
    if (e.reglage === false || !e.pages || e.utilisateurPart || e.balayage) return 'laisser';
    return 'bloquer';
}

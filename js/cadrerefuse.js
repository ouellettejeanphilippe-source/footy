/* Un cadre que le site refuse d'afficher dans l'application (31 octobre 2026, « Damitv et
   sportsurge marchent pas », « un lecteur grisé sans vidéo », Firefox + Tampermonkey).

   Un site peut interdire qu'on l'encadre : `X-Frame-Options`, ou la CSP `frame-ancestors`
   (gooz.aapmains.net, le flux d'isportsurge, n'autorise que ses sites partenaires). Sur
   Chromium, l'extension du dépôt retire ces en-têtes ; sur Firefox avec Tampermonkey, rien
   ne peut le faire, et la tuile restait sur la page d'erreur du navigateur jusqu'à la
   bascule automatique. Ici, ce qu'on décide quand on SAIT que le cadre est refusé : passer
   au lien suivant sans attendre, et laisser à la vidéo le temps d'arriver d'elle-même si une
   reconstruction a été tentée. Sans import. */

/* Ce que Firefox écrit dans la page d'erreur d'un cadre refusé. Doit rester identique à
   REFUS_CADRE de multiview-cleaner.user.js (unit_cadrerefuse le vérifie). */
export var REFUS_CADRE = /can.?t open this page|refused to (display|connect)|will not allow firefox to display|ne peut pas ouvrir cette page|n'autorise pas firefox|x-frame-options/i;

/* Une page d'erreur de navigateur, pas une page vide ni un about:blank. */
export var TEXTE_MIN = 40;
export function estPageDeRefus(texte) {
    var t = String(texte || '');
    return t.length >= TEXTE_MIN && REFUS_CADRE.test(t);
}

/* Combien attendre avant de passer au suivant, selon ce que le script a pu faire du cadre :
   `reconstruit` (le HTML a été recollé en srcdoc : la vidéo peut encore venir), `impossible`
   (rien à attendre), `direct` (l'application a lu la page d'erreur elle-même). */
export var DELAI_REFUS_MS = { impossible: 1500, direct: 1500, reconstruit: 8000 };
export function delaiRefus(etat) {
    return DELAI_REFUS_MS[etat] || DELAI_REFUS_MS.impossible;
}

/* Faut-il passer au lien suivant ? Non si la tuile joue (le cadre refusé était une pub, ou
   la reconstruction a réussi), si elle a changé d'adresse entre-temps, ou s'il n'y a pas
   d'autre lien. */
export function doitSauterRefus(o) {
    var x = o || {};
    if (x.joue) return false;
    if (x.adressePosee !== x.adresseAttendue) return false;
    return !!x.aSuivant;
}

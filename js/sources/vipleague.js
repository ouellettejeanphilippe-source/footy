/* VIPLeague : filtre des liens d'une page de match.

   Un fichier par domaine — voir js/sources/index.js pour le contrat.

   VIPLeague n'a rien à EXTRAIRE : il charge ses lecteurs en JavaScript, derrière un jeton
   CSRF, et le HTML servi ne contient que des publicités et des liens partenaires. Ce
   domaine n'apporte donc pas un extracteur mais un FILTRE : de tout ce que le moteur
   générique a ramassé sur sa page, seuls les liens du domaine lui-même valent quelque
   chose ; `/vl` est sa page d'index, pas un lecteur.

   C'est le second point d'entrée du contrat : un domaine peut fournir `extraireLiens`,
   `filtrerLiens`, ou les deux. */

export var hotes = ['vipleague'];

export function filtrerLiens(liens) {
    return (liens || []).filter(function (l) {
        return l && l.url && /vipleague/i.test(l.url) && !/\/vl$/.test(l.url);
    });
}

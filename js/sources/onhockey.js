/* OnHockey : lecture d'une page de match.

   Un fichier par domaine — voir js/sources/index.js pour le contrat.

   Particularité d'OnHockey : ses matchs ne pointent pas vers une page par match, mais tous
   vers `schedule_table.php`, sa seule grille. Lire « la page du match » revient donc à
   relire la grille entière et à y retrouver la ligne du match — d'où l'appel au parseur de
   liste du domaine (`ctx.aides.parseListe`) et à l'appariement (`ctx.aides.memeMatch`),
   fournis par l'appelant pour ne pas réimporter le module central.

   Garde-fou conservé tel quel : OnHockey ne déteint que sur du hockey. Sa grille est
   générique, et sans ce filtre ses liens atterrissaient sur des matchs de NBA, de MLB ou
   de football américain portant des noms voisins. */

export var hotes = ['onhockey'];

export function extraireLiens(ctx) {
    var html = ctx.html, m = ctx.match;
    var parseOnHockey = ctx.aides.parseListe;
    var isMatchPair = ctx.aides.memeMatch;
    var links = [];

        // Enforce that OnHockey only bleeds into actual Hockey matches to avoid generic match collision with other sports
        var mLeague = (m.league || '').toLowerCase();
        var isBball = mLeague.indexOf('nba') >= 0 || mLeague.indexOf('basketball') >= 0;
        var isBase = mLeague.indexOf('mlb') >= 0 || mLeague.indexOf('baseball') >= 0;
        var isFootball = mLeague.indexOf('nfl') >= 0 || mLeague.indexOf('american') >= 0;

        // If the match is explicitly confirmed as a non-hockey major sport, do not attempt OnHockey merge
        if (!isBball && !isBase && !isFootball) {
            var ohMatches = parseOnHockey(html);
            var matchingOh = ohMatches.find(function(oh) { return isMatchPair(m, oh); });
            if (matchingOh && matchingOh.streamLinks) {
                matchingOh.streamLinks.forEach(function(sl) {
                    if (!links.find(function(l) { return l.url === sl.url; })) {
                        links.push(sl);
                    }
                });
            }
        }

    return links;
}

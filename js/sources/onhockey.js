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

/* LA « PAGE DU MATCH » D'ONHOCKEY EST SA GRILLE ENTIÈRE.
   -----------------------------------------------------
   Tous ses matchs pointent vers `schedule_table.php`. Cet adaptateur fait donc la
   seule chose juste : il analyse la grille et ne retient QUE les liens de la ligne
   appariée au match courant.

   Mais `extractStreamLinks` (js/scrapers.js) enchaînait ensuite sur ses branches
   génériques, qui récoltent tout ce qui ressemble à un flux sur la page — sans
   aucun appariement. L'adaptateur prenait la bonne ligne, le générique ajoutait
   toutes les autres.

   Signalé le 26 septembre 2026 : « on hockey met des matchs lhjmq dans des matchs
   lnh ». Mesuré sur le cache du jour : 170 liens nommant une équipe de la LHJMQ,
   répartis sur 35 matchs de la LNH — « Shawinigan - Rimouski » se retrouvait sous
   Buffalo-Pittsburgh, sous Nashville-Carolina et sous Los Angeles-Anaheim à la
   fois. L'appariement n'y était pour rien : `isMatchPair` refuse bien ces paires
   (similarité mesurée 0,07). C'était le générique qui passait derrière.

   Ce drapeau le dit à `extractStreamLinks` : sur une grille, l'appariement de
   l'adaptateur fait loi, et ce qu'il n'a pas retenu n'appartient pas à ce match.
   Quand il ne retient rien, c'est que le match n'est pas sur la grille — et le
   lien « Page du match sur onhockey.tv » est alors la bonne réponse, pas
   soixante-dix liens appartenant à d'autres rencontres. */
export var pageEstUneGrille = true;

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

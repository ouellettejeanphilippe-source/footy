/* LHJMQ : le calendrier de la ligue, lu sur HockeyTech (le fournisseur de statistiques
   de la LCH), pour le guide.

   ESPN n'a pas la LHJMQ. Jusqu'ici, ses matchs n'apparaissaient qu'à travers OnHockey,
   comme flux sans fiche, et seulement quand OnHockey répondait. La ligue publie pourtant
   un tableau des matchs (`view=scorebar`) : date ISO avec fuseau, statut, pointage en
   direct, logos. C'est ce que lisent chl.ca/lhjmq et l'application de la ligue ; la clé
   est publique, présente dans leurs pages.

   Relevé le 12 octobre 2026 : 8 matchs sur deux jours, dont 5 en cours avec leur
   pointage et la période. L'en-tête CORS n'autorise que chl.ca : le navigateur passe
   donc par `fetchPage` (pont ou Jina, qui rend le JSON enveloppé, déballé par
   `parseJinaBody`), le script serveur en direct.

   Module sans import : `js/api.js` (l'application) et `scripts/scrape_schedule.mjs`
   (data/schedule.json) l'utilisent tous les deux. Les noms rendus sont « Ville Surnom »,
   la forme de la base d'équipes (js/teams.js) ; l'appelant les résout. */

export var CLE_HOCKEYTECH_LHJMQ = 'f1aa699db3d81487';

/* `avant`, `apres` : combien de jours avant et après aujourd'hui. La veille couvre la nuit
   (un match de 22 h 30 dans les Maritimes finit après minuit à New York), le lendemain
   la fenêtre du guide. */
export function urlScorebarLhjmq(avant, apres) {
    return 'https://lscluster.hockeytech.com/feed/index.php?feed=modulekit&view=scorebar'
        + '&key=' + CLE_HOCKEYTECH_LHJMQ + '&fmt=json&client_code=lhjmq&lang=en&site_id=0'
        + '&numberofdaysback=' + (avant === undefined ? 1 : avant)
        + '&numberofdaysahead=' + (apres === undefined ? 2 : apres);
}

function partiesNY(d) {
    var f = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    var p = {};
    f.formatToParts(d).forEach(function(x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, heure: (p.hour === '24' ? '00' : p.hour) + ':' + p.minute };
}

/* « Phœnix » : la ligue écrit la ligature, la base et les sources écrivent « Phoenix ». */
function nomEquipe(ville, surnom) {
    return (String(ville || '').trim() + ' ' + String(surnom || '').trim()).trim().replace(/œ/g, 'oe').replace(/Œ/g, 'Oe');
}

/* Statut HockeyTech : 1 pas commencé, 2 en cours, 3 fin non officielle, 4 final. */
export function statutLhjmq(g) {
    var s = String(g && g.GameStatus || '');
    var texte = String(g && g.GameStatusString || '');
    if (s === '3' || s === '4' || /^final/i.test(texte)) return 'finished';
    if (s === '1' || s === '') return 'upcoming';
    return 'live';
}

/* `json` : la réponse de `urlScorebarLhjmq`, objet ou texte. `jours` : les dates (heure
   de New York, AAAA-MM-JJ) à garder ; sans elles, tout est gardé. */
export function lireScorebarLhjmq(json, jours) {
    var data = json;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { return []; } }
    var liste = data && data.SiteKit && Array.isArray(data.SiteKit.Scorebar) ? data.SiteKit.Scorebar : [];
    var garder = Array.isArray(jours) && jours.length ? jours : null;
    var sortie = [];
    liste.forEach(function(g) {
        if (!g || !g.ID || !g.GameDateISO8601) return;
        var d = new Date(g.GameDateISO8601);
        if (isNaN(d.getTime())) return;
        var ny = partiesNY(d);
        if (garder && garder.indexOf(ny.date) < 0) return;
        var status = statutLhjmq(g);
        var m = {
            id: 'lhjmq_' + g.ID,
            homeTeam: nomEquipe(g.HomeCity, g.HomeNickname),
            awayTeam: nomEquipe(g.VisitorCity, g.VisitorNickname),
            homeLogo: g.HomeLogo || null,
            awayLogo: g.VisitorLogo || null,
            sport: 'hockey',
            league: 'LHJMQ',
            matchDate: ny.date,
            startTime: ny.heure,
            durationMinutes: 150,
            status: status,
            score: null,
            source: 'api',
            streamLinks: []
        };
        if (status !== 'upcoming') {
            var h = parseInt(g.HomeGoals, 10), a = parseInt(g.VisitorGoals, 10);
            if (!isNaN(h) && !isNaN(a)) m.score = [h, a];
        }
        /* Mêmes champs que les matchs ESPN (js/api.js) : « 18:48 3rd » s'affiche comme
           le chrono, la période sert à la fin présumée (js/finpresumee.js). */
        if (status === 'live') {
            m.minute = g.GameStatusString ? String(g.GameStatusString) : null;
            m.period = parseInt(g.Period, 10) || null;
            m.detail = g.GameStatusStringLong ? String(g.GameStatusStringLong) : null;
        }
        if (g.venue_name) m.venue = String(g.venue_name);
        sortie.push(m);
    });
    return sortie;
}

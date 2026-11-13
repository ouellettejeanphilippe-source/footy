/* Les statistiques d'un match, dessinées d'une seule façon (13 novembre 2026, « tout ce qui est
   stats et infos du genre, présenter de manière plus agréable et fonctionnelle »).

   Avant : la même comparaison des deux équipes (`boxscore.teams[].statistics` du `summary` ESPN)
   était écrite trois fois, en styles en ligne — des barres dans le panneau Scores et statistiques
   (`js/config.js`), un tableau nu dans le panneau du lecteur (`js/multiview.js`), un bouton à
   déplier dans la fiche (`js/ui.js`) — avec des libellés à moitié en anglais, jusqu'à 28 lignes
   sans ordre, et des pourcentages écrits « 0.3 ».

   Ici : une lecture (`statsDuMatch`), des libellés en français, l'essentiel du sport d'abord et
   le reste replié, une barre partagée aux couleurs des équipes où la part de chacune se lit d'un
   coup d'œil, et la valeur de l'équipe qui mène en clair. Relevé des noms sur site.api.espn.com le
   13 novembre 2026 (LNH, NBA, Premier League, NFL).

   Module sans import : `js/ui.js`, `js/multiview.js` et `js/config.js` le câblent. */

/* Ce qu'on regarde d'abord, dans cet ordre. Une statistique absente du match est sautée. */
export var ESSENTIELS = [
    // football
    'possessionPct', 'totalShots', 'shotsOnTarget', 'wonCorners', 'foulsCommitted', 'yellowCards', 'redCards', 'saves', 'passPct',
    // hockey (match, puis moyennes d'avant-match)
    'shotsTotal', 'avgGoals', 'avgGoalsAgainst', 'avgShots', 'avgShotsAgainst', 'powerPlayGoals', 'powerPlayPct', 'penaltyKillPct',
    'faceoffPercent', 'hits', 'blockedShots', 'penaltyMinutes', 'giveaways',
    // basket (moyennes d'avant-match, puis match)
    'avgPoints', 'avgPointsAgainst', 'avgRebounds', 'avgAssists', 'avgTotalTurnovers', 'Last Ten Games', 'streak',
    'fieldGoalPct', 'threePointFieldGoalPct', 'freeThrowPct', 'totalRebounds', 'assists', 'totalTurnovers', 'steals', 'blocks',
    // football américain
    'totalYards', 'firstDowns', 'netPassingYards', 'rushingYards', 'thirdDownEff', 'turnovers', 'possessionTime', 'totalPenaltiesYards'
];
export var ESSENTIELS_MAX = 8;

/* Là où le plus petit nombre est le meilleur : c'est l'autre équipe qui « mène ». */
var MOINS_EST_MIEUX = {
    foulsCommitted: 1, fouls: 1, yellowCards: 1, redCards: 1, offsides: 1, giveaways: 1, penalties: 1, penaltyMinutes: 1,
    turnovers: 1, totalTurnovers: 1, teamTurnovers: 1, technicalFouls: 1, totalTechnicalFouls: 1, flagrantFouls: 1,
    fumblesLost: 1, turnoverPoints: 1, sacksYardsLost: 1, totalPenaltiesYards: 1,
    avgGoalsAgainst: 1, avgShotsAgainst: 1, powerPlayGoalsAgainst: 1, shortHandedGoalsAgainst: 1,
    avgPointsAgainst: 1, avgTotalTurnovers: 1, avgTeamTurnovers: 1
};

export var LIBELLES = {
    possessionPct: 'Possession', possessionTime: 'Possession', totalShots: 'Tirs', shotsTotal: 'Tirs', shotsOnTarget: 'Tirs cadrés',
    shotPct: 'Tirs cadrés (%)', wonCorners: 'Corners', foulsCommitted: 'Fautes', fouls: 'Fautes', yellowCards: 'Cartons jaunes',
    redCards: 'Cartons rouges', offsides: 'Hors-jeu', saves: 'Arrêts', totalPasses: 'Passes', accuratePasses: 'Passes réussies',
    passPct: 'Passes réussies (%)', totalCrosses: 'Centres', accurateCrosses: 'Centres réussis', crossPct: 'Centres réussis (%)',
    totalLongBalls: 'Longs ballons', accurateLongBalls: 'Longs ballons réussis', longballPct: 'Longs ballons réussis (%)',
    blockedShots: 'Tirs bloqués', totalTackles: 'Tacles', effectiveTackles: 'Tacles réussis', tacklePct: 'Tacles réussis (%)',
    interceptions: 'Interceptions', totalClearance: 'Dégagements', effectiveClearance: 'Dégagements réussis',
    penaltyKickGoals: 'Penaltys marqués', penaltyKickShots: 'Penaltys tirés',
    hits: 'Mises en échec', takeaways: 'Revirements provoqués', giveaways: 'Revirements', powerPlayGoals: 'Buts en avantage numérique',
    powerPlayOpportunities: 'Avantages numériques', powerPlayPct: 'Avantage numérique (%)', shortHandedGoals: 'Buts en désavantage',
    shootoutGoals: 'Buts en fusillade', faceoffsWon: 'Mises au jeu gagnées', faceoffPercent: 'Mises au jeu (%)',
    penalties: 'Pénalités', penaltyMinutes: 'Minutes de pénalité',
    avgGoals: 'Buts par match', avgGoalsAgainst: 'Buts accordés par match', avgShots: 'Tirs par match',
    avgShotsAgainst: 'Tirs accordés par match', penaltyKillPct: 'Désavantage numérique (%)',
    powerPlayGoalsAgainst: 'Buts accordés en désavantage', shortHandedGoalsAgainst: 'Buts accordés en avantage',
    'fieldGoalsMade-fieldGoalsAttempted': 'Tirs réussis', fieldGoalPct: 'Tirs réussis (%)',
    'threePointFieldGoalsMade-threePointFieldGoalsAttempted': 'Trois points', threePointFieldGoalPct: 'Trois points (%)',
    'freeThrowsMade-freeThrowsAttempted': 'Lancers francs', freeThrowPct: 'Lancers francs (%)',
    totalRebounds: 'Rebonds', offensiveRebounds: 'Rebonds offensifs', defensiveRebounds: 'Rebonds défensifs', assists: 'Passes décisives',
    steals: 'Interceptions', blocks: 'Contres', turnovers: 'Pertes de balle', teamTurnovers: 'Pertes de balle d\'équipe',
    totalTurnovers: 'Pertes de balle', technicalFouls: 'Fautes techniques', totalTechnicalFouls: 'Fautes techniques (total)',
    flagrantFouls: 'Fautes flagrantes', turnoverPoints: 'Points accordés sur pertes', fastBreakPoints: 'Points en contre-attaque',
    pointsInPaint: 'Points dans la raquette', largestLead: 'Plus grande avance', leadChanges: 'Changements de meneur',
    leadPercentage: 'Temps en tête (%)',
    avgPoints: 'Points par match', avgPointsAgainst: 'Points accordés par match', avgRebounds: 'Rebonds par match',
    avgAssists: 'Passes décisives par match', avgBlocks: 'Contres par match', avgSteals: 'Interceptions par match',
    avgTeamTurnovers: 'Pertes de balle d\'équipe par match', avgTotalTurnovers: 'Pertes de balle par match',
    streak: 'Série en cours', 'Last Ten Games': 'Dix derniers matchs',
    firstDowns: 'Premiers essais', firstDownsPassing: 'Premiers essais par la passe', firstDownsRushing: 'Premiers essais au sol',
    firstDownsPenalty: 'Premiers essais sur pénalité', thirdDownEff: 'Troisièmes essais', fourthDownEff: 'Quatrièmes essais',
    totalOffensivePlays: 'Jeux offensifs', totalYards: 'Verges totales', yardsPerPlay: 'Verges par jeu', totalDrives: 'Séquences',
    netPassingYards: 'Verges par la passe', completionAttempts: 'Passes complétées', yardsPerPass: 'Verges par passe',
    sacksYardsLost: 'Sacs (verges perdues)', rushingYards: 'Verges au sol', rushingAttempts: 'Courses',
    yardsPerRushAttempt: 'Verges par course', redZoneAttempts: 'Zone payante', totalPenaltiesYards: 'Pénalités (verges)',
    fumblesLost: 'Échappés perdus', defensiveTouchdowns: 'Touchés défensifs'
};

/* Le libellé d'une statistique : le nôtre, sinon celui de `repli(nom)` s'il traduit, sinon celui d'ESPN. */
export function libelleStat(nom, brut, repli) {
    if (LIBELLES[nom]) return LIBELLES[nom];
    var r = typeof repli === 'function' ? repli(nom) : '';
    if (r && r !== nom) return r;
    return String(brut || nom || '');
}

/* Le nombre derrière une valeur affichée, pour la barre : « 37-90 » et « 24/29 » → le premier
   nombre, « 29:56 » → des secondes, « 51.5 » → 51,5. null quand il n'y a pas de nombre. */
export function nombreDe(valeur) {
    var s = String(valeur == null ? '' : valeur).trim();
    if (/^[A-Za-z]/.test(s)) return null; // « L1 », « W3 » : une série, pas une grandeur
    var t = /^(\d+):(\d{2})$/.exec(s);
    if (t) return Number(t[1]) * 60 + Number(t[2]);
    var n = /-?\d+(?:[.,]\d+)?/.exec(s);
    return n ? Number(n[0].replace(',', '.')) : null;
}

/* ESPN écrit certains pourcentages du football en fraction (« 0.3 » pour 30 %). */
function estFraction(nom, a, b) {
    return /Pct$/.test(nom) && /^[01](\.\d+)?$/.test(a) && /^[01](\.\d+)?$/.test(b) && (a.indexOf('.') > 0 || b.indexOf('.') > 0);
}
function enPourcent(v) { return Math.round(Number(v) * 100) + ' %'; }

/* Les statistiques comparées d'un `summary` : [{ nom, brut, dom, vis }], domicile à gauche.
   `idDom` (l'équipe à domicile d'après l'en-tête) tranche quand `homeAway` manque. */
export function statsDuMatch(data, idDom) {
    var ts = data && data.boxscore && Array.isArray(data.boxscore.teams) ? data.boxscore.teams : [];
    if (ts.length !== 2 || !Array.isArray(ts[0].statistics) || !Array.isArray(ts[1].statistics)) return [];
    var domEn0 = ts[0].homeAway === 'home';
    if (ts[0].homeAway !== 'home' && ts[1].homeAway === 'home') domEn0 = false;
    else if (idDom && ts[0].team && String(ts[0].team.id) === String(idDom)) domEn0 = true;
    else if (idDom && ts[1].team && String(ts[1].team.id) === String(idDom)) domEn0 = false;
    var dom = domEn0 ? ts[0].statistics : ts[1].statistics, vis = domEn0 ? ts[1].statistics : ts[0].statistics;
    var vus = {}, liste = [];
    dom.forEach(function(d) {
        if (!d || !d.name || vus[d.name]) return;
        var v = vis.filter(function(x) { return x && x.name === d.name; })[0];
        if (!v || d.displayValue == null || v.displayValue == null || d.displayValue === '' || v.displayValue === '') return;
        vus[d.name] = 1;
        var a = String(d.displayValue), b = String(v.displayValue);
        var fraction = estFraction(d.name, a, b);
        liste.push({ nom: d.name, brut: d.label || d.displayName || d.name, dom: fraction ? enPourcent(a) : a, vis: fraction ? enPourcent(b) : b });
    });
    return liste;
}

/* L'essentiel d'abord (dans l'ordre d'ESSENTIELS, `max` au plus, complété à six par les suivantes
   d'ESPN), le reste ensuite dans l'ordre d'ESPN. */
export function trierStats(stats, max) {
    var n = max || ESSENTIELS_MAX, liste = stats || [];
    var devant = [];
    ESSENTIELS.forEach(function(nom) {
        if (devant.length >= n) return;
        var s = liste.filter(function(x) { return x.nom === nom; })[0];
        if (s) devant.push(s);
    });
    /* Un sport ou un moment dont on connaît mal les noms : on complète avec les suivantes
       d'ESPN plutôt que de montrer deux lignes et d'en cacher douze. */
    for (var i = 0; devant.length < Math.min(n, 6) && i < liste.length; i++) if (devant.indexOf(liste[i]) < 0) devant.push(liste[i]);
    return { essentiel: devant, reste: liste.filter(function(x) { return devant.indexOf(x) < 0; }) };
}

/* Une ligne : la part de chaque équipe (en %, 50/50 sans nombre) et qui mène ('dom', 'vis' ou ''). */
export function mesureDeLigne(stat) {
    var a = nombreDe(stat.dom), b = nombreDe(stat.vis);
    if (a === null || b === null || a < 0 || b < 0) return { partDom: 50, mene: '' };
    var total = a + b;
    var part = total > 0 ? Math.round((a / total) * 1000) / 10 : 50;
    var mene = a === b ? '' : ((a > b) !== !!MOINS_EST_MIEUX[stat.nom] ? 'dom' : 'vis');
    return { partDom: part, mene: mene };
}

function ligneHtml(stat, esc, repli) {
    var m = mesureDeLigne(stat), libelle = libelleStat(stat.nom, stat.brut, repli);
    return '<div class="cmp-ligne' + (m.mene ? ' cmp-mene-' + m.mene : '') + '" data-stat="' + esc(stat.nom) + '">'
        + '<span class="cmp-v cmp-dom">' + esc(String(stat.dom)) + '</span>'
        + '<span class="cmp-l" title="' + esc(libelle) + '">' + esc(libelle) + '</span>'
        + '<span class="cmp-v cmp-vis">' + esc(String(stat.vis)) + '</span>'
        + '<span class="cmp-barre" aria-hidden="true"><i class="cmp-dom" style="width:' + m.partDom + '%"></i><i class="cmp-vis" style="width:' + (Math.round((100 - m.partDom) * 10) / 10) + '%"></i></span>'
        + '</div>';
}

/* La comparaison : l'essentiel, puis « Toutes les statistiques » replié. `o` : { repli, max,
   couleurDom, couleurVis, noms: [domicile, visiteur], ouvert }. '' sans statistique. */
export function comparaisonHtml(stats, esc, o) {
    var opt = o || {};
    var t = trierStats(stats, opt.max);
    if (!t.essentiel.length) return '';
    var couleur = function(c) { return /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : ''; };
    var style = (couleur(opt.couleurDom) ? '--cmp-dom:' + opt.couleurDom + ';' : '') + (couleur(opt.couleurVis) ? '--cmp-vis:' + opt.couleurVis + ';' : '');
    var noms = opt.noms && opt.noms.length === 2
        ? '<div class="cmp-noms"><span class="cmp-nom cmp-dom">' + esc(opt.noms[0]) + '</span><span class="cmp-nom cmp-vis">' + esc(opt.noms[1]) + '</span></div>' : '';
    return '<div class="cmp"' + (style ? ' style="' + style + '"' : '') + '>' + noms
        + t.essentiel.map(function(s) { return ligneHtml(s, esc, opt.repli); }).join('')
        + (t.reste.length ? '<details class="cmp-plus"' + (opt.ouvert ? ' open' : '') + '><summary>Toutes les statistiques (' + (t.essentiel.length + t.reste.length) + ')</summary>'
            + t.reste.map(function(s) { return ligneHtml(s, esc, opt.repli); }).join('') + '</details>' : '')
        + '</div>';
}

/* L'en-tête d'un match dans un panneau : logos, noms, score ou heure, état, et sous chaque nom
   son rang et son bilan. `f` : { dom, vis, logoDom, logoVis, score, etat, direct, ligue, sousDom, sousVis }
   (`sousDom` / `sousVis` : du HTML déjà sûr, voir `statsEquipeHtml` de js/bilan.js). */
export function enteteMatchHtml(f, esc) {
    var x = f || {};
    var logo = function(u, nom) {
        return /^https:\/\//.test(String(u || '')) ? '<img class="em-logo" src="' + esc(u) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">'
            : '<span class="em-logo em-logo-texte" aria-hidden="true">' + esc(String(nom || '?').trim().charAt(0).toUpperCase()) + '</span>';
    };
    var equipe = function(cote, nom, u, sous) {
        return '<div class="em-equipe em-' + cote + '">' + logo(u, nom) + '<span class="em-nom" title="' + esc(nom) + '">' + esc(nom) + '</span>'
            + '<span class="em-sous" data-cote="' + cote + '">' + (sous || '') + '</span></div>';
    };
    var score = Array.isArray(x.score) && x.score.length === 2
        ? '<span class="em-score">' + esc(String(x.score[0])) + '<i>–</i>' + esc(String(x.score[1])) + '</span>' : '<span class="em-vs">VS</span>';
    return '<div class="em' + (x.direct ? ' em-direct' : '') + '">'
        + (x.ligue ? '<div class="em-ligue">' + esc(x.ligue) + '</div>' : '')
        + '<div class="em-corps">' + equipe('dom', x.dom, x.logoDom, x.sousDom)
        + '<div class="em-centre">' + score + (x.etat ? '<span class="em-etat">' + esc(x.etat) + '</span>' : '') + '</div>'
        + (x.vis ? equipe('vis', x.vis, x.logoVis, x.sousVis) : '') + '</div></div>';
}

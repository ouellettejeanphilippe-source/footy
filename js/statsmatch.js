/* Les statistiques d'un match, dessinées d'une seule façon (13 novembre 2026, « tout ce qui est
   stats et infos du genre, présenter de manière plus agréable et fonctionnelle », puis « les
   graphiques stats, plus beau, mais aussi en ordre qui a du sens contextuellement »).

   Avant : la même comparaison des deux équipes (`boxscore.teams[].statistics` du `summary` ESPN)
   était écrite trois fois, en styles en ligne — des barres dans le panneau Scores et statistiques
   (`js/config.js`), un tableau nu dans le panneau du lecteur (`js/multiview.js`), un bouton à
   déplier dans la fiche (`js/ui.js`) — avec des libellés à moitié en anglais, jusqu'à 28 lignes
   dans l'ordre d'ESPN (fautes, cartons, hors-jeu, corners, arrêts, possession…), et des
   pourcentages écrits « 0.3 ».

   Ici : une lecture (`statsDuMatch`), des libellés en français, et un ORDRE QUI RACONTE LE MATCH :
   les statistiques sont rangées par thème (`THEMES` : forme, attaque, tirs, construction, défense,
   discipline…), les thèmes dans l'ordre où on se pose les questions (qui attaque, comment le
   jeu se construit, qui défend, qui se pénalise), et les lignes qui disent la
   même chose sont fondues en une (`FUSIONS` : « 246/310 · 79 % » au lieu de trois lignes passes
   réussies, passes, pourcentage). Avant le match, ESPN donne des moyennes de saison : elles
   tombent dans les mêmes thèmes, la forme d'abord. Une barre partagée aux couleurs des équipes
   montre la part de chacune, et la valeur de l'équipe qui mène est mise en avant. Relevé des noms
   sur site.api.espn.com le 13 novembre 2026 (LNH, NBA, Premier League, NFL ; avant-match LNH, NBA).

   Module sans import : `js/ui.js`, `js/multiview.js` et `js/config.js` le câblent. */

/* Les thèmes, dans l'ordre d'affichage, et dans chacun ses lignes dans l'ordre de lecture.
   Un nom entre crochets dans `FUSIONS` remplace ses composantes. Ce qui n'est rangé nulle part
   finit dans « Autres », dans l'ordre d'ESPN. */
export var THEMES = [
    { cle: 'forme', titre: 'Forme', noms: ['streak', 'Last Ten Games'] },
    { cle: 'attaque', titre: 'Attaque', noms: [
        'avgGoals', 'avgShots', 'shootingPct', 'avgPoints', 'avgAssists', 'totalPointsPerGame', 'yardsPerGame',
        'possessionPct', '[tirsCadres]', 'totalShots', 'shotsOnTarget', 'shotPct', 'wonCorners', 'offsides', '[penaltys]', 'penaltyKickGoals', 'penaltyKickShots',
        'shotsTotal', '[avantageNumerique]', 'powerPlayGoals', 'powerPlayOpportunities', 'powerPlayPct', 'shortHandedGoals', 'shootoutGoals',
        'totalYards', 'totalOffensivePlays', 'yardsPerPlay', 'totalDrives', 'firstDowns', 'firstDownsPassing', 'firstDownsRushing', 'firstDownsPenalty', 'possessionTime'] },
    { cle: 'tirs', titre: 'Adresse', noms: [
        '[tirsReussis]', 'fieldGoalsMade-fieldGoalsAttempted', 'fieldGoalPct', '[troisPoints]', 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', 'threePointFieldGoalPct',
        '[lancersFrancs]', 'freeThrowsMade-freeThrowsAttempted', 'freeThrowPct', 'pointsInPaint', 'fastBreakPoints'] },
    { cle: 'jeu', titre: 'Jeu', noms: [
        '[passes]', 'totalPasses', 'accuratePasses', 'passPct', '[centres]', 'totalCrosses', 'accurateCrosses', 'crossPct',
        '[longsBallons]', 'totalLongBalls', 'accurateLongBalls', 'longballPct',
        'assists', '[misesAuJeu]', 'faceoffsWon', 'faceoffPercent', 'takeaways',
        'netPassingYardsPerGame', 'netPassingYards', 'completionAttempts', 'yardsPerPass', 'yardsPerPassAttempt', 'rushingYardsPerGame', 'rushingYards', 'rushingAttempts', 'yardsPerRushAttempt'] },
    { cle: 'efficacite', titre: 'Efficacité', noms: ['thirdDownConvPct', 'thirdDownEff', 'fourthDownEff', 'redzoneScoringPct', 'redZoneAttempts'] },
    { cle: 'rebonds', titre: 'Rebonds', noms: ['avgRebounds', 'totalRebounds', 'offensiveRebounds', 'defensiveRebounds'] },
    { cle: 'defense', titre: 'Défense', noms: [
        'avgGoalsAgainst', 'avgShotsAgainst', 'penaltyKillPct', 'powerPlayGoalsAgainst', 'shortHandedGoalsAgainst', 'avgPointsAgainst', 'avgSteals', 'avgBlocks', 'savePct', 'sacks', 'totalTakeaways',
        'saves', '[tacles]', 'totalTackles', 'effectiveTackles', 'tacklePct', 'interceptions', '[degagements]', 'totalClearance', 'effectiveClearance', 'blockedShots',
        'hits', 'steals', 'blocks', 'defensiveTouchdowns'] },
    { cle: 'discipline', titre: 'Discipline et erreurs', noms: [
        'foulsCommitted', 'fouls', 'yellowCards', 'redCards', 'penalties', 'penaltyMinutes', 'avgPenaltyMinutes', 'giveaways',
        'avgFouls', 'avgTurnovers', 'totalGiveaways', 'turnOverDifferential', 'avgTotalTurnovers', 'avgTeamTurnovers', 'totalTurnovers', 'turnovers', 'teamTurnovers', 'turnoverPoints', 'technicalFouls', 'totalTechnicalFouls', 'flagrantFouls',
        'fumblesLost', 'sacksYardsLost', 'totalPenaltiesYards'] },
    { cle: 'deroulement', titre: 'Déroulement', noms: ['largestLead', 'leadChanges', 'leadPercentage'] }
];

/* Des lignes qui disent la même chose, fondues en une : `de` = [réussis, tentés] (ou une seule
   valeur), `pct` = le pourcentage qui va avec. La ligne n'existe que si `de[0]` est là. */
export var FUSIONS = {
    tirsCadres: { libelle: 'Tirs cadrés / tirs', de: ['shotsOnTarget', 'totalShots'], pct: 'shotPct' },
    penaltys: { libelle: 'Penaltys marqués / tirés', de: ['penaltyKickGoals', 'penaltyKickShots'] },
    passes: { libelle: 'Passes réussies', de: ['accuratePasses', 'totalPasses'], pct: 'passPct' },
    centres: { libelle: 'Centres réussis', de: ['accurateCrosses', 'totalCrosses'], pct: 'crossPct' },
    longsBallons: { libelle: 'Longs ballons réussis', de: ['accurateLongBalls', 'totalLongBalls'], pct: 'longballPct' },
    tacles: { libelle: 'Tacles réussis', de: ['effectiveTackles', 'totalTackles'], pct: 'tacklePct' },
    degagements: { libelle: 'Dégagements réussis', de: ['effectiveClearance', 'totalClearance'] },
    avantageNumerique: { libelle: 'Avantage numérique', de: ['powerPlayGoals', 'powerPlayOpportunities'], pct: 'powerPlayPct' },
    misesAuJeu: { libelle: 'Mises au jeu gagnées', de: ['faceoffsWon'], pct: 'faceoffPercent' },
    tirsReussis: { libelle: 'Tirs réussis', de: ['fieldGoalsMade-fieldGoalsAttempted'], pct: 'fieldGoalPct' },
    troisPoints: { libelle: 'Trois points', de: ['threePointFieldGoalsMade-threePointFieldGoalsAttempted'], pct: 'threePointFieldGoalPct' },
    lancersFrancs: { libelle: 'Lancers francs', de: ['freeThrowsMade-freeThrowsAttempted'], pct: 'freeThrowPct' }
};

/* Là où le plus petit nombre est le meilleur : c'est l'autre équipe qui « mène ». */
var MOINS_EST_MIEUX = {
    foulsCommitted: 1, fouls: 1, yellowCards: 1, redCards: 1, offsides: 1, giveaways: 1, penalties: 1, penaltyMinutes: 1,
    turnovers: 1, totalTurnovers: 1, teamTurnovers: 1, technicalFouls: 1, totalTechnicalFouls: 1, flagrantFouls: 1,
    fumblesLost: 1, turnoverPoints: 1, sacksYardsLost: 1, totalPenaltiesYards: 1,
    avgGoalsAgainst: 1, avgShotsAgainst: 1, powerPlayGoalsAgainst: 1, shortHandedGoalsAgainst: 1,
    avgPointsAgainst: 1, avgTotalTurnovers: 1, avgTeamTurnovers: 1,
    avgPenaltyMinutes: 1, avgFouls: 1, avgTurnovers: 1, totalGiveaways: 1
};

export var LIBELLES = {
    possessionPct: 'Possession', possessionTime: 'Temps de possession', totalShots: 'Tirs', shotsTotal: 'Tirs', shotsOnTarget: 'Tirs cadrés',
    shotPct: 'Tirs cadrés', wonCorners: 'Corners', foulsCommitted: 'Fautes', fouls: 'Fautes', yellowCards: 'Cartons jaunes',
    redCards: 'Cartons rouges', offsides: 'Hors-jeu', saves: 'Arrêts', totalPasses: 'Passes', accuratePasses: 'Passes réussies',
    passPct: 'Passes réussies', totalCrosses: 'Centres', accurateCrosses: 'Centres réussis', crossPct: 'Centres réussis',
    totalLongBalls: 'Longs ballons', accurateLongBalls: 'Longs ballons réussis', longballPct: 'Longs ballons réussis',
    blockedShots: 'Tirs bloqués', totalTackles: 'Tacles', effectiveTackles: 'Tacles réussis', tacklePct: 'Tacles réussis',
    interceptions: 'Interceptions', totalClearance: 'Dégagements', effectiveClearance: 'Dégagements réussis',
    penaltyKickGoals: 'Penaltys marqués', penaltyKickShots: 'Penaltys tirés',
    hits: 'Mises en échec', takeaways: 'Revirements provoqués', giveaways: 'Revirements', powerPlayGoals: 'Buts en avantage numérique',
    powerPlayOpportunities: 'Avantages numériques', powerPlayPct: 'Avantage numérique', shortHandedGoals: 'Buts en désavantage',
    shootoutGoals: 'Buts en fusillade', faceoffsWon: 'Mises au jeu gagnées', faceoffPercent: 'Mises au jeu',
    penalties: 'Pénalités', penaltyMinutes: 'Minutes de pénalité',
    avgGoals: 'Buts par match', avgGoalsAgainst: 'Buts accordés par match', avgShots: 'Tirs par match',
    avgShotsAgainst: 'Tirs accordés par match', penaltyKillPct: 'Désavantage numérique',
    powerPlayGoalsAgainst: 'Buts accordés en désavantage', shortHandedGoalsAgainst: 'Buts accordés en avantage',
    'fieldGoalsMade-fieldGoalsAttempted': 'Tirs réussis', fieldGoalPct: 'Tirs réussis',
    'threePointFieldGoalsMade-threePointFieldGoalsAttempted': 'Trois points', threePointFieldGoalPct: 'Trois points',
    'freeThrowsMade-freeThrowsAttempted': 'Lancers francs', freeThrowPct: 'Lancers francs',
    totalRebounds: 'Rebonds', offensiveRebounds: 'Rebonds offensifs', defensiveRebounds: 'Rebonds défensifs', assists: 'Passes décisives',
    steals: 'Interceptions', blocks: 'Contres', turnovers: 'Pertes de balle', teamTurnovers: 'Pertes de balle d\'équipe',
    totalTurnovers: 'Pertes de balle', technicalFouls: 'Fautes techniques', totalTechnicalFouls: 'Fautes techniques (total)',
    flagrantFouls: 'Fautes flagrantes', turnoverPoints: 'Points accordés sur pertes', fastBreakPoints: 'Points en contre-attaque',
    pointsInPaint: 'Points dans la raquette', largestLead: 'Plus grande avance', leadChanges: 'Changements de meneur',
    leadPercentage: 'Temps en tête',
    avgPoints: 'Points par match', avgPointsAgainst: 'Points accordés par match', avgRebounds: 'Rebonds par match',
    avgAssists: 'Passes décisives par match', avgBlocks: 'Contres par match', avgSteals: 'Interceptions par match',
    avgTeamTurnovers: 'Pertes de balle d\'équipe par match', avgTotalTurnovers: 'Pertes de balle par match',
    streak: 'Série en cours', 'Last Ten Games': 'Dix derniers matchs',
    shootingPct: 'Tirs convertis', savePct: 'Arrêts', avgPenaltyMinutes: 'Minutes de pénalité par match',
    avgFouls: 'Fautes par match', avgTurnovers: 'Pertes de balle par match', totalPointsPerGame: 'Points par match',
    yardsPerGame: 'Verges par match', netPassingYardsPerGame: 'Verges par la passe par match', rushingYardsPerGame: 'Verges au sol par match',
    yardsPerPassAttempt: 'Verges par passe', thirdDownConvPct: 'Troisièmes essais convertis', redzoneScoringPct: 'Zone payante convertie',
    sacks: 'Sacs', totalTakeaways: 'Revirements provoqués', totalGiveaways: 'Revirements', turnOverDifferential: 'Différentiel de revirements',
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

function pourcentLisible(v) { return /%/.test(v) ? v : String(v).replace('.', ',') + ' %'; }

/* Une fusion en ligne : { nom, libelle, dom, vis, sousDom, sousVis, mesureDom, mesureVis }.
   « 80 % » en valeur, « 246/310 » en petit ; la barre compare les pourcentages quand il y en a
   (réussir 8 passes sur 10 vaut mieux qu'en réussir plus en en ratant la moitié). */
function fusionner(cle, parNom) {
    var f = FUSIONS[cle], a = parNom[f.de[0]], b = f.de[1] ? parNom[f.de[1]] : null, p = f.pct ? parNom[f.pct] : null;
    /* Une fusion à moitié (les buts en avantage sans le nombre d'avantages) mentirait sur ce
       qu'elle montre : ses composantes restent alors des lignes à part. */
    if (!a || (f.de[1] && !b)) return null;
    var valeur = function(cote) { return b ? a[cote] + '/' + b[cote] : a[cote]; };
    /* Un seul nombre à lire par côté : le pourcentage quand il existe, et le détail (« 246/310 »)
       en petit à côté ; sans pourcentage, la fraction est la valeur. */
    return { nom: cle, libelle: f.libelle, dom: p ? pourcentLisible(p.dom) : valeur('dom'), vis: p ? pourcentLisible(p.vis) : valeur('vis'),
        sousDom: p ? valeur('dom') : '', sousVis: p ? valeur('vis') : '',
        mesureDom: p ? p.dom : a.dom, mesureVis: p ? p.vis : a.vis, composantes: f.de.concat(f.pct ? [f.pct] : []) };
}

/* Les statistiques rangées par thème : [{ cle, titre, lignes }], sans thème vide. Une fusion
   prend la place de ses composantes ; ce qui n'est rangé nulle part va dans « Autres ». */
export function grouperStats(stats) {
    var parNom = {}, pris = {};
    /* Zéro des deux côtés (buts en fusillade, cartons rouges) : rien à comparer, la ligne saute. */
    var nul = function(s) { return nombreDe(s.dom) === 0 && nombreDe(s.vis) === 0; };
    stats = (stats || []).filter(function(s) { return s && s.nom && !nul(s); });
    stats.forEach(function(s) { if (!parNom[s.nom]) parNom[s.nom] = s; });
    var groupes = [];
    THEMES.forEach(function(t) {
        var lignes = [];
        t.noms.forEach(function(n) {
            var cle = /^\[(.+)\]$/.exec(n);
            if (cle) {
                var f = fusionner(cle[1], parNom);
                if (!f || f.composantes.some(function(c) { return pris[c]; })) return;
                f.composantes.forEach(function(c) { pris[c] = 1; });
                lignes.push(f);
            } else if (parNom[n] && !pris[n]) {
                pris[n] = 1;
                lignes.push(parNom[n]);
            }
        });
        if (lignes.length) groupes.push({ cle: t.cle, titre: t.titre, lignes: lignes });
    });
    var autres = (stats || []).filter(function(s) { return s && s.nom && !pris[s.nom] && parNom[s.nom] === s; });
    if (autres.length) groupes.push({ cle: 'autres', titre: groupes.length ? 'Autres' : 'Statistiques', lignes: autres });
    return groupes;
}

/* Une ligne : la part de chaque équipe (en %, 50/50 sans nombre) et qui mène ('dom', 'vis' ou ''). */
export function mesureDeLigne(stat) {
    var a = nombreDe(stat.mesureDom !== undefined ? stat.mesureDom : stat.dom), b = nombreDe(stat.mesureVis !== undefined ? stat.mesureVis : stat.vis);
    if (a === null || b === null || a < 0 || b < 0) return { partDom: 50, mene: '' };
    var total = a + b;
    var part = total > 0 ? Math.round((a / total) * 1000) / 10 : 50;
    var mene = a === b ? '' : ((a > b) !== !!MOINS_EST_MIEUX[stat.nom] ? 'dom' : 'vis');
    return { partDom: part, mene: mene };
}

function ligneHtml(stat, esc, repli) {
    var m = mesureDeLigne(stat), libelle = stat.libelle || libelleStat(stat.nom, stat.brut, repli);
    /* Un pourcentage s'écrit avec son signe : « 60,8 % », pas « 60.8 ». */
    var pct = /(Pct|Percent|Percentage)$/.test(stat.nom);
    var valeur = function(cote, v, sous) {
        if (pct && /^\d+(\.\d+)?$/.test(String(v))) v = String(v).replace('.', ',') + ' %';
        return '<span class="cmp-v cmp-' + cote + '"><b>' + esc(String(v)) + '</b>' + (sous ? '<small>' + esc(String(sous)) + '</small>' : '') + '</span>';
    };
    return '<div class="cmp-ligne' + (m.mene ? ' cmp-mene-' + m.mene : '') + '" data-stat="' + esc(stat.nom) + '">'
        + valeur('dom', stat.dom, stat.sousDom)
        + '<span class="cmp-l" title="' + esc(libelle) + '">' + esc(libelle) + '</span>'
        + valeur('vis', stat.vis, stat.sousVis)
        + '<span class="cmp-barre" aria-hidden="true"><i class="cmp-dom" style="width:' + m.partDom + '%"></i><i class="cmp-vis" style="width:' + (Math.round((100 - m.partDom) * 10) / 10) + '%"></i></span>'
        + '</div>';
}

/* La comparaison : un bloc par thème, dans l'ordre de THEMES. `o` : { repli, couleurDom,
   couleurVis, noms: [domicile, visiteur] }. '' sans statistique. */
export function comparaisonHtml(stats, esc, o) {
    var opt = o || {};
    var groupes = grouperStats(stats);
    if (!groupes.length) return '';
    var couleur = function(c) { return /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : ''; };
    var style = (couleur(opt.couleurDom) ? '--cmp-dom:' + opt.couleurDom + ';' : '') + (couleur(opt.couleurVis) ? '--cmp-vis:' + opt.couleurVis + ';' : '');
    var noms = opt.noms && opt.noms.length === 2
        ? '<div class="cmp-noms"><span class="cmp-nom cmp-dom">' + esc(opt.noms[0]) + '</span><span class="cmp-nom cmp-vis">' + esc(opt.noms[1]) + '</span></div>' : '';
    return '<div class="cmp"' + (style ? ' style="' + style + '"' : '') + '>' + noms + '<div class="cmp-groupes">'
        + groupes.map(function(g) {
            return '<section class="cmp-groupe" data-theme="' + esc(g.cle) + '"><h5 class="cmp-theme">' + esc(g.titre) + '</h5>'
                + g.lignes.map(function(s) { return ligneHtml(s, esc, opt.repli); }).join('') + '</section>';
        }).join('') + '</div></div>';
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

/* ── « Séparer stats en direct et stats de la saison » (13 novembre 2026) ──────────────────────
   Le `summary` d'ESPN donne, dans le même champ, les moyennes de la saison AVANT le match et les
   statistiques du match une fois commencé : les deux n'ont rien à faire sous le même titre.
   Avant le match, il n'y a que la saison. Ensuite, deux onglets : « Ce match » (le summary) et
   « Saison », lue à la demande dans `/teams/<id>/statistics` (une requête par équipe, CORS `*`,
   relevé le 13 novembre 2026 : LNH, NBA, NFL ; rien pour le football). */

/* 'pre' (pas commencé), 'in' (en cours), 'post' (fini) d'après l'en-tête du summary ; '' sinon. */
export function etatDuSummary(data) {
    var c = data && data.header && data.header.competitions && data.header.competitions[0];
    var e = c && c.status && c.status.type && c.status.type.state;
    return e === 'pre' || e === 'in' || e === 'post' ? e : '';
}

/* Ce qu'on garde des statistiques de saison d'une équipe, sous les noms de THEMES. Le reste
   (présences, temps de glace, totaux bruts…) n'aide pas à comparer deux équipes. */
export var NOMS_SAISON = ['avgGoals', 'avgShots', 'shootingPct', 'powerPlayGoals', 'shortHandedGoals', 'faceoffPercent', 'avgGoalsAgainst',
    'avgShotsAgainst', 'savePct', 'avgPenaltyMinutes',
    'avgPoints', 'fieldGoalPct', 'threePointFieldGoalPct', 'freeThrowPct', 'avgRebounds', 'avgAssists', 'avgSteals', 'avgBlocks', 'avgTurnovers', 'avgFouls',
    'totalPointsPerGame', 'yardsPerGame', 'netPassingYardsPerGame', 'rushingYardsPerGame', 'yardsPerPassAttempt', 'yardsPerRushAttempt',
    'thirdDownConvPct', 'redzoneScoringPct', 'sacks', 'totalTakeaways', 'totalGiveaways', 'turnOverDifferential'];

/* Les statistiques de saison d'UNE équipe, à plat : { nom: valeur affichée }. Au hockey, ESPN
   donne des totaux : les moyennes par match sont calculées (buts, tirs, tirs accordés, minutes
   de pénalité), et le taux d'arrêts « .899 » devient « 89,9 % ». */
export function saisonDEquipe(json) {
    var cats = json && json.results && json.results.stats && Array.isArray(json.results.stats.categories) ? json.results.stats.categories : [];
    var brut = {};
    cats.forEach(function(c) { (c && c.stats || []).forEach(function(s) { if (s && s.name && brut[s.name] === undefined && s.displayValue != null && s.displayValue !== '') brut[s.name] = String(s.displayValue); }); });
    var n = function(k) { var v = brut[k] === undefined ? NaN : Number(String(brut[k]).replace(/,/g, '')); return isFinite(v) ? v : null; };
    var parMatch = function(total, decimales) {
        var t = n(total), j = n('games');
        return t === null || !j ? undefined : (t / j).toFixed(decimales);
    };
    var derive = { avgGoals: parMatch('goals', 2), avgShots: parMatch('shotsTotal', 1), avgShotsAgainst: parMatch('shotsAgainst', 1), avgPenaltyMinutes: parMatch('penaltyMinutes', 1) };
    Object.keys(derive).forEach(function(k) { if (brut[k] === undefined && derive[k] !== undefined) brut[k] = derive[k]; });
    if (brut.savePct !== undefined && /^0?\.\d+$/.test(brut.savePct)) brut.savePct = (Number(brut.savePct) * 100).toFixed(1);
    if (brut.threePointFieldGoalPct === undefined && brut.threePointPct !== undefined) brut.threePointFieldGoalPct = brut.threePointPct;
    var garde = {};
    NOMS_SAISON.forEach(function(k) { if (brut[k] !== undefined) garde[k] = brut[k]; });
    return garde;
}

/* Les deux équipes comparées : [{ nom, brut, dom, vis }], seulement ce que les deux ont. */
export function statsDeSaison(jsonDom, jsonVis) {
    var d = saisonDEquipe(jsonDom), v = saisonDEquipe(jsonVis);
    return NOMS_SAISON.filter(function(k) { return d[k] !== undefined && v[k] !== undefined; })
        .map(function(k) { return { nom: k, brut: k, dom: d[k], vis: v[k] }; });
}

/* L'onglet choisi vaut pour toute l'application : qui regarde la saison dans la fiche la
   retrouve dans le lecteur, et une relecture (chaque minute) ne le ramène pas au match. */
var ongletChoisi = 'match';
var saisons = {};
export function ongletDesStats() { return ongletChoisi; }
export function oublierSaisons() { saisons = {}; ongletChoisi = 'match'; }

/* Pose les statistiques dans `zone`. `o` : { data (summary), idDom, cle (identifiant du match),
   esc, options (celles de comparaisonHtml), chargerSaison() → Promise<[jsonDom, jsonVis]> }.
   Avant le match : la saison seule, dite telle. Après : les onglets « Ce match » / « Saison ».
   Rend false quand il n'y a rien à montrer (la zone est vidée). */
export function monterStats(zone, o) {
    if (!zone) return false;
    var esc = o.esc, etat = etatDuSummary(o.data);
    var duMatch = statsDuMatch(o.data, o.idDom);
    var titre = function(t, note) { return '<h4 class="cmp-titre">' + esc(t) + (note ? '<small>' + esc(note) + '</small>' : '') + '</h4>'; };
    if (etat === 'pre' || (!etat && !o.chargerSaison)) {
        var avant = comparaisonHtml(duMatch, esc, o.options);
        zone.innerHTML = avant ? titre(etat === 'pre' ? 'Saison' : 'Statistiques', etat === 'pre' ? 'moyennes avant le match' : '') + avant : '';
        return !!avant;
    }
    var peutSaison = typeof o.chargerSaison === 'function';
    if (!duMatch.length && !peutSaison) { zone.innerHTML = ''; return false; }
    var onglet = peutSaison && (ongletChoisi === 'saison' || !duMatch.length) ? 'saison' : 'match';
    var bouton = function(cle, texte) {
        return '<button type="button" class="cmp-onglet' + (onglet === cle ? ' on' : '') + '" role="tab" aria-selected="' + (onglet === cle ? 'true' : 'false') + '" data-onglet="' + cle + '">' + texte + '</button>';
    };
    var tete = '<div class="cmp-onglets" role="tablist" aria-label="Statistiques">' + bouton('match', etat === 'in' ? 'En direct' : 'Ce match') + (peutSaison ? bouton('saison', 'Saison') : '') + '</div>';
    var poser = function(corps) {
        zone.innerHTML = tete + '<div class="cmp-corps">' + corps + '</div>';
        Array.prototype.forEach.call(zone.querySelectorAll('.cmp-onglet'), function(b) {
            b.onclick = function() { ongletChoisi = b.getAttribute('data-onglet') === 'saison' ? 'saison' : 'match'; monterStats(zone, o); };
        });
    };
    var vide = function(texte) { return '<div class="cmp-vide">' + esc(texte) + '</div>'; };
    if (onglet === 'match') {
        poser(comparaisonHtml(duMatch, esc, o.options) || vide('Pas encore de statistiques pour ce match.'));
        return true;
    }
    var cle = String(o.cle || o.idDom || '');
    var deja = saisons[cle];
    if (deja && deja.stats) { poser(comparaisonHtml(deja.stats, esc, o.options) || vide('Pas de statistiques de saison pour cette ligue.')); return true; }
    poser(vide('Chargement de la saison…'));
    if (!deja) {
        deja = saisons[cle] = { attente: Promise.resolve().then(o.chargerSaison).then(function(r) { return statsDeSaison(r && r[0], r && r[1]); }, function() { return null; }) };
        deja.attente.then(function(stats) { if (stats) deja.stats = stats; else delete saisons[cle]; });
    }
    deja.attente.then(function(stats) {
        if (!zone.isConnected || ongletChoisi !== 'saison') return;
        if (stats) monterStats(zone, o); else poser(vide('La saison ne répond pas pour l\'instant.'));
    });
    return true;
}

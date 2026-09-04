import { S } from './state.js';
import { escJs, esc, lg, pad, safeStorageGetJSON, safeStorageSetJSON, formatTeamNameBreak } from './utils.js';
import { isMatch } from './match.js';
import { globalStatsInterval, setGlobalStatsInterval } from './multiview.js';
import { fetchGameStats, renderScorersHtml, formatStatLabel, fetchLeagueStandings, fetchTeamInfo, fetchTeamSchedule } from './api.js';
import { openMod, getOriginalMatchId } from './ui.js';
import { getLogo, normName, STATIC_TEAMS } from './db.js';
import { buildProxyList } from './fetcher.js';

/* ══ CONFIG ═════════════════════════════ */
export var SITE = 'https://footybite.bid/'; // Updated to new footybite.bid domain
export var MLBBITE_PLUS_URL = 'https://mlbbite.plus/';
export var SPORTSURGE_URL = 'https://v2.sportsurge.net/'; // sportsurge.net redirige vers v2.sportsurge.net/welcome/
export var BUFFSTREAMS_URL = 'https://app.buffstreams.is/indexcracked29';
export var STREAMEAST_URL = 'https://v2.gostreameast.is/'; // v2.streameast.ga renvoie 429 depuis sept. 2026
export var ONHOCKEY_URL = 'https://onhockey.tv/';
export var VIPLEAGUE_URL = 'https://vipleague.vg/live-now-streaming'; // vipleague.im/.io/.cc redirigent vers vipleague.vg ; la grille est sur /live-now-streaming
export var METHSTREAMS_URL = 'https://methstreams.gs/';
/* Seule source à exposer une API JSON plutôt que des pages HTML à deviner. */
export var STREAMED_URL = 'https://streamed.pk/';


/* Miroirs connus par source : essayés dans l'ordre si l'URL principale échoue.
   Surchargés par la clé MIRRORS de domains.json. */
export var SOURCE_MIRRORS = {
    footybite: ['https://footybite.bid/'],
    mlbbite: ['https://mlbbite.plus/'],
    sportsurge: ['https://v2.sportsurge.net/', 'https://sportsurge.net/'],
    buffstreams: ['https://app.buffstreams.is/indexcracked29'],
    streameast: ['https://v2.gostreameast.is/', 'https://v2.streameast.ga/'],
    onhockey: ['https://onhockey.tv/'],
    vipleague: ['https://vipleague.vg/live-now-streaming', 'https://vipleague.io/live-now-streaming', 'https://vipleague.cc/live-now-streaming'],
    methstreams: ['https://methstreams.gs/'],
    streamed: ['https://streamed.pk/', 'https://streamed.su/']
};

/* Clé de domains.json portant l'URL de chaque source. Exportée pour que le script
   serveur puisse RÉÉCRIRE ce fichier quand il découvre qu'un domaine est mort et
   qu'un miroir répond : sans cela, l'apprentissage restait dans l'exécution en cours
   et chaque lancement repayait le délai d'attente du domaine mort. */
export var SOURCE_VAR_NAMES = {
    footybite: 'SITE', mlbbite: 'MLBBITE_PLUS_URL', sportsurge: 'SPORTSURGE_URL',
    buffstreams: 'BUFFSTREAMS_URL', streameast: 'STREAMEAST_URL', onhockey: 'ONHOCKEY_URL', vipleague: 'VIPLEAGUE_URL',
    methstreams: 'METHSTREAMS_URL', streamed: 'STREAMED_URL'
};

/* Change l'URL d'une source (variable exportée, window.*, SCRAPERS_CONFIG) de façon cohérente,
   pour que les parseurs résolvent les liens relatifs contre le bon domaine. */
export function applySourceUrl(id, url) {
    if (!id || !url) return;
    switch (id) {
        case 'footybite': SITE = url; break;
        case 'mlbbite': MLBBITE_PLUS_URL = url; break;
        case 'sportsurge': SPORTSURGE_URL = url; break;
        case 'buffstreams': BUFFSTREAMS_URL = url; break;
        case 'streameast': STREAMEAST_URL = url; break;
        case 'onhockey': ONHOCKEY_URL = url; break;
        case 'vipleague': VIPLEAGUE_URL = url; break;
        case 'methstreams': METHSTREAMS_URL = url; break;
        case 'streamed': STREAMED_URL = url; break;
        default: return;
    }
    if (typeof window !== 'undefined') window[SOURCE_VAR_NAMES[id]] = url;
    for (var i = 0; i < SCRAPERS_CONFIG.length; i++) {
        if (SCRAPERS_CONFIG[i].id === id) SCRAPERS_CONFIG[i].url = url;
    }
}

/* Faut-il retenir l'adresse qui a répondu comme nouvelle adresse principale ?

   Répondre ne suffit pas : un domaine expiré puis racheté rend un 200 avec une page de
   parking. Le promouvoir sur ce seul critère remplacerait une source vivante par une
   source morte, en reléguant au passage le miroir qui marchait — l'inverse exact du
   but. On exige donc qu'elle ait LIVRÉ DES MATCHS. */
export function shouldPromoteSource(report, finding) {
    if (!report || !finding) return false;
    if (!finding.winner) return false;          // aucune adresse n'a répondu
    if (!report.ok) return false;
    return (report.matches || 0) > 0;
}

/* Nouvel ordre d'essai d'une source après une exécution, du plus prometteur au moins.

   L'adresse qui a répondu passe en tête. Celles qui ont ÉCHOUÉ cette fois-ci vont en
   queue plutôt que d'être supprimées : ces domaines reviennent souvent après une
   coupure, mais tant qu'ils sont morts, les garder devant ferait repayer leur délai
   d'attente à chaque exécution horaire. Les candidats ni gagnants ni testés (on s'arrête
   au premier qui répond) gardent leur rang entre les deux.

   Aucune adresse n'est inventée : la sortie est une permutation de l'entrée. */
export function reorderCandidates(winner, candidates, dead) {
    var list = (candidates || []).filter(function(u, i, a) { return u && a.indexOf(u) === i; });
    if (!winner) return list;
    var morts = dead || [];
    var estMort = function(u) { return morts.indexOf(u) >= 0; };
    return [winner]
        .concat(list.filter(function(u) { return u !== winner && !estMort(u); }))
        .concat(list.filter(function(u) { return u !== winner && estMort(u); }));
}

/* Liste ordonnée des URLs à essayer pour une source : URL courante puis miroirs. */
export function getSourceCandidates(id) {
    var current = null;
    for (var i = 0; i < SCRAPERS_CONFIG.length; i++) if (SCRAPERS_CONFIG[i].id === id) current = SCRAPERS_CONFIG[i].url;
    var out = current ? [current] : [];
    (SOURCE_MIRRORS[id] || []).forEach(function(u) { if (out.indexOf(u) < 0) out.push(u); });
    return out;
}

/* Dépôt GitHub de l'application : page du workflow qui pré-calcule data/streams.json. */
export var REPO_URL = 'https://github.com/ouellettejeanphilippe-source/footy';
export var STREAMS_WORKFLOW_URL = REPO_URL + '/actions/workflows/scrape_streams.yml';

// Dynamic Domain Resolution
/* Ce fetch est attendu (await) tout au début du premier chargement : tant qu'il ne
   répond pas, l'application n'affiche aucun match. Sans délai maximal, un réseau qui
   avale la requête au lieu de la refuser (portail captif, pare-feu d'entreprise,
   mandataire mal configuré) bloquait le démarrage indéfiniment. domains.json n'est
   qu'une surcharge optionnelle des domaines : au-delà de 5 s on démarre sans lui. */
export const REMOTE_CONFIG_TIMEOUT_MS = 5000;

export async function fetchRemoteConfig() {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, REMOTE_CONFIG_TIMEOUT_MS) : null;
    try {
        var remoteConfigUrl = 'https://raw.githubusercontent.com/ouellettejeanphilippe-source/footy/main/domains.json';
        var res = await fetch(remoteConfigUrl, ctrl ? { cache: 'no-cache', signal: ctrl.signal } : { cache: 'no-cache' });
        if (res.ok) {
            var data = await res.json();
            var keyToId = { SITE: 'footybite', MLBBITE_PLUS_URL: 'mlbbite', SPORTSURGE_URL: 'sportsurge',
                BUFFSTREAMS_URL: 'buffstreams', STREAMEAST_URL: 'streameast', ONHOCKEY_URL: 'onhockey', VIPLEAGUE_URL: 'vipleague',
                METHSTREAMS_URL: 'methstreams', STREAMED_URL: 'streamed' };
            Object.keys(keyToId).forEach(function(k) { if (data[k]) applySourceUrl(keyToId[k], data[k]); });
            if (data.MIRRORS && typeof data.MIRRORS === 'object') {
                Object.keys(data.MIRRORS).forEach(function(id) {
                    if (Array.isArray(data.MIRRORS[id]) && data.MIRRORS[id].length) SOURCE_MIRRORS[id] = data.MIRRORS[id].slice();
                });
            }
            console.log('Dynamic domains loaded successfully from remote config.');
        }
    } catch(e) {
        console.log('Failed to fetch dynamic domain config, using local fallbacks.');
    } finally {
        if (timer) clearTimeout(timer);
    }
}


/* Sources de streams.
   - url    : page d'accueil (résolution des liens relatifs, miroirs).
   - pages  : sous-pages par sport à lire en plus (les sites listent maintenant leurs matchs
              par ligue). Chaque entrée donne le chemin relatif et les sports couverts ;
              le client ne lit que les pages des sports présents dans la grille du jour,
              le script serveur les lit toutes.
   - homepageHasMatches : false quand l'accueil n'est qu'un menu (inutile de le parser). */
export const SCRAPERS_CONFIG = [
    { name: 'Footybite', url: SITE, id: 'footybite' },
    { name: 'MLBite+', url: MLBBITE_PLUS_URL, id: 'mlbbite' },
    { name: 'Sportsurge', url: SPORTSURGE_URL, id: 'sportsurge', homepageHasMatches: false, pages: [
        { path: 'watch-nfl-streams/', sports: ['nfl'] }, { path: 'watch-cfb-streams/', sports: ['cfb'] }, { path: 'watch-cfl-streams/', sports: ['cfl'] },
        { path: 'watch-basketball-streams/', sports: ['nba'] }, { path: 'watch-wnba-streams/', sports: ['wnba'] }, { path: 'watch-ncaab-streams/', sports: ['ncaab'] },
        { path: 'watch-baseball-streams/', sports: ['mlb'] }, { path: 'watch-hockey-streams/', sports: ['nhl'] },
        { path: 'watch-mma-streams/', sports: ['mma'] }, { path: 'watch-boxing-streams/', sports: ['boxing'] }, { path: 'watch-wwe-streams/', sports: ['wwe'] },
        { path: 'watch-rugby-streams/', sports: ['rugby'] }, { path: 'watch-ufl-streams/', sports: ['nfl'] }
    ] },
    { name: 'Buffstreams', url: BUFFSTREAMS_URL, id: 'buffstreams', homepageHasMatches: false, pages: [
        { path: 'mlb-streams-live-10', sports: ['mlb'] }, { path: 'nfl-streams-live-10', sports: ['nfl'] }, { path: 'nbabuffstreams15', sports: ['nba'] },
        { path: 'nhl-streams-live-10', sports: ['nhl'] }, { path: 'cfb-streams-live-10', sports: ['cfb'] }, { path: 'ncaamstreams', sports: ['ncaab'] },
        { path: 'boxinglivestreams14', sports: ['boxing'] }, { path: 'mmacracked24', sports: ['mma'] }, { path: 'motor-streams-live-10', sports: ['f1', 'motor'] }
    ] },
    { name: 'Streameast', url: STREAMEAST_URL, id: 'streameast' },
    // L'accueil d'OnHockey n'est qu'un jeu de cadres (frameset) : la grille des matchs et
    // leurs lecteurs sont dans schedule_table.php (le site exige un Referer onhockey.tv).
    { name: 'OnHockey', url: ONHOCKEY_URL, id: 'onhockey', homepageHasMatches: false, pages: [
        { path: 'schedule_table.php', sports: ['nhl'] }
    ] },
    { name: 'VIPLeague', url: VIPLEAGUE_URL, id: 'vipleague' },
    /* API JSON : `pages` désigne ici des points d'API, pas des pages HTML. Le parseur
       lit du JSON, et les flux vivent derrière un second appel posé en `matchUrl`.
       Ajoutée pour trois trous mesurés dans le cache du 3 septembre 2026 : aucun match
       de catch (AEW compris), 6 matchs de boxe et 43 de football universitaire, contre
       102 pour cette seule source. */
    { name: 'Streamed', url: STREAMED_URL, id: 'streamed', homepageHasMatches: false, pages: [
        { path: 'api/matches/american-football', sports: ['cfb', 'nfl'] },
        { path: 'api/matches/fight', sports: ['boxing', 'mma', 'wwe'] },
        { path: 'api/matches/basketball', sports: ['nba', 'ncaab', 'wnba'] },
        { path: 'api/matches/hockey', sports: ['nhl'] },
        { path: 'api/matches/baseball', sports: ['mlb'] },
        { path: 'api/matches/football', sports: ['soccer'] }
    ] },
    { name: 'Methstreams', url: METHSTREAMS_URL, id: 'methstreams', homepageHasMatches: false, pages: [
        { path: 'league/soccerstreams', sports: ['soccer'] }, { path: 'league/nflstreams', sports: ['nfl'] }, { path: 'league/nbastreams', sports: ['nba'] },
        // league/nhlstreams et league/cfbstreams redirigent vers crackstreams.mx qui répond 404 : retirées.
        { path: 'league/mlbstreams', sports: ['mlb'] }, { path: 'league/mmastreams', sports: ['mma'] },
        { path: 'league/boxingstreams', sports: ['boxing'] }, { path: 'league/f1streams', sports: ['f1'] },
        { path: 'league/wnbastreams', sports: ['wnba'] }, { path: 'league/wwestreams', sports: ['wwe'] }, { path: 'league/aew', sports: ['wwe'] }, { path: 'league/ncaab', sports: ['ncaab'] }
    ] }
];

/* Hôtes dont les pages de match ne répondent jamais depuis un serveur ou un proxy CORS :
   les interroger coûte un aller-retour et un délai d'attente pour rien.
   Mesuré le 2026-09-02 sur une exécution complète : footybite.bid a échoué 58 fois sur 58
   (403 Cloudflare sur /game/, alors que son accueil passe), les miroirs Streameast 14 fois
   sur 15 (429 « error code 1015 »). Leurs matchs restent découverts par l'accueil, et
   leurs flux récupérés via les pages du même match sur les autres sources (altUrls). */
export var MATCH_PAGE_BLOCKED_HOSTS = /(^|\.)(footybite\.[a-z.]+|(the)?streameast\.[a-z.]+|gostreameast\.[a-z.]+)$/i;
export function isMatchPageBlocked(url) {
    try { return MATCH_PAGE_BLOCKED_HOSTS.test(new URL(url).hostname); } catch (e) { return false; }
}

/* Un point d'API ne s'ouvre pas dans un onglet : on y verrait du JSON, pas un lecteur.
   Le repli « Page du match sur X » n'a donc aucun sens pour ces adresses. Sans ce test,
   les 31 matchs de football universitaire que streamed.pk annonce sans aucun flux
   recevaient un lien mort qui se présentait comme jouable. */
export function isApiEndpoint(url) {
    try { return /(^|\/)api\//.test(new URL(url).pathname); } catch (e) { return false; }
}

/* Sport « canonique » d'une ligue (clé utilisée par SCRAPERS_CONFIG[].pages[].sports). */
/* Sport « canonique » d'une ligue, à partir de son nom.

   ATTENTION AUX ANCRES `\b` DE CE BLOC. Le fichier a contenu, à leur place, 36
   caractères de contrôle « retour arrière » (U+0008) — le résultat d'un outil ayant
   interprété l'échappement au lieu de l'écrire. Les expressions cherchaient alors ce
   caractère de contrôle, qu'aucun nom de ligue ne contient : toutes les alternatives
   ainsi encadrées étaient MORTES. Les sigles (mlb, nfl, cfb, nba, mma, f1, aew…) ne
   correspondaient jamais, tandis que les mots entiers (baseball, hockey, soccer…)
   passaient — d'où un diagnostic trompeur, puisque la moitié de la fonction marchait.
   Relevé sur le cache du 4 septembre 2026 : **224 matchs sur 503 classés « other »**,
   dont les 124 de football universitaire, 29 de MLB et 17 de NFL, qui atterrissaient
   donc dans « Autres streams » au lieu de leur sport. Le défaut était invisible à la
   relecture : `console.log` de la source affiche le retour arrière comme un effacement,
   et le code semblait donc correct. `tests/unit_sports.test.js` le détecterait. */
export function sportOfLeague(league) {
    var l = String(league || '').toLowerCase();
    if (!l) return 'other';
    if (/\b(nhl|pwhl|khl|ahl|shl|liiga)\b|hockey|lhjmq|qmjhl/.test(l)) return 'nhl';
    if (/\bmlb\b|baseball/.test(l)) return 'mlb';
    if (/\bwnba\b/.test(l)) return 'wnba';
    if (/ncaa.*basket|college basket|\bncaab\b/.test(l)) return 'ncaab';
    if (/\bnba\b|basket/.test(l)) return 'nba';
    if (/\bcfl\b/.test(l)) return 'cfl';
    if (/ncaa.*foot|college foot|\bcfb\b|\bncaaf\b/.test(l)) return 'cfb';
    if (/\bnfl\b|\bufl\b|american football/.test(l)) return 'nfl';
    if (/\bufc\b|\bmma\b|bellator|\bpfl\b/.test(l)) return 'mma';
    if (/box/.test(l)) return 'boxing';
    if (/\bwwe\b|\baew\b|\btna\b|wrestl/.test(l)) return 'wwe';
    if (/\bf1\b|formula/.test(l)) return 'f1';
    if (/motogp|indycar|nascar|motor/.test(l)) return 'motor';
    if (/rugby/.test(l)) return 'rugby';
    if (/cricket/.test(l)) return 'cricket';
    if (/tennis|atp|wta/.test(l)) return 'tennis';
    if (/golf|pga/.test(l)) return 'golf';
    if (/\b(lcs|lec|lpl|lck|msi|worlds|cblol|ljl|pcs|vcs|lla|tcl|lcp|nlc)\b|league of legends|esport/.test(l)) return 'esports';
    if (/league|liga|serie|cup|coupe|\bmls\b|bundesliga|ligue|champions|europa|copa|premier|eredivisie|primeira|uefa|fifa|conmebol|concacaf|saudi|soccer|football|super lig|pokal|nations|friendly|primera|eliteserien|allsvenskan/.test(l)) return 'soccer';
    return 'other';
}

/* Pages à télécharger pour une source. `sports` = liste des sports à couvrir (null = tous). */
export function getSourcePages(scraper, sports) {
    var out = [];
    if (scraper.homepageHasMatches !== false) out.push({ url: scraper.url, sport: null });
    (scraper.pages || []).forEach(function(pg) {
        if (sports && !pg.sports.some(function(sp) { return sports.indexOf(sp) >= 0; })) return;
        var url = resolveUrl(pg.path, scraper.url);
        if (!out.some(function(o) { return o.url === url; })) out.push({ url: url, sport: pg.sports[0] });
    });
    return out;
}

/* Transports pour fetchPage : direct + proxys CORS publics, plus, si l'utilisateur
   les a renseignés dans les Options, un proxy personnalisé et des clés API.
   La liste est reconstruite par rebuildProxies() quand ces réglages changent. */
export function getProxySettings() {
    var read = function(k) { try { return (localStorage.getItem(k) || '').trim(); } catch(e) { return ''; } };
    return { customProxy: read('custom_proxy_url'), corsShKey: read('cors_sh_api_key'), corsProxyIoKey: read('corsproxy_io_api_key') };
}
export var PROXIES = buildProxyList(getProxySettings());
export function rebuildProxies() {
    PROXIES = buildProxyList(getProxySettings());
    window.PROXIES = PROXIES;
    return PROXIES;
}

/* Ces liaisons étaient collées DANS le corps de rebuildProxies : elles n'étaient donc
   posées que si la fonction s'exécutait, et elle ne pouvait pas s'exécuter puisque son
   seul appelant passe par window.rebuildProxies, qu'elle était censée définir.
   Conséquences : enregistrer un proxy ou une clé d'API n'avait aucun effet avant un
   rechargement complet, et l'écran Options n'affichait jamais les valeurs déjà saisies. */
window.applySourceUrl = applySourceUrl;
window.sportOfLeague = sportOfLeague;
window.getSourcePages = getSourcePages;
window.getSourceCandidates = getSourceCandidates;
window.isMatchPageBlocked = isMatchPageBlocked;
window.SOURCE_MIRRORS = SOURCE_MIRRORS;
window.STREAMS_WORKFLOW_URL = STREAMS_WORKFLOW_URL;
window.rebuildProxies = rebuildProxies;
window.getProxySettings = getProxySettings;
window.gstatsGoBack = gstatsGoBack;
window.toggleGlobalStats = toggleGlobalStats;

/* ══ COULEURS ═══════════════════════════ */


/* ══ TEAM COLORS ════════════ */








// Global to track which logos we're already fetching




// Manually add some important overrides that might not map perfectly via the simple stripping


export function toggleGlobalStats() {
    var sidebar = document.getElementById('global-stats-sidebar');
    if (!sidebar) return;
    sidebar.style.transform = 'translateX(100%)';
    gstatsHistory = [];
    updateGstatsBackBtn();
}

/* Pile de navigation de la barre latérale. Depuis la fiche d'un match, chaque logo
   ouvre onclick="openGlobalStats(...)" la fiche de l'équipe : le bouton « ← Retour »
   existe dans index.html pour revenir au match, mais gstatsGoBack() n'était défini
   nulle part — le clic levait une ReferenceError silencieuse dans la console, et rien
   ne rendait le bouton visible de toute façon. */
var gstatsHistory = [];
export var currentGstatsView = null;

export function updateGstatsBackBtn() {
    var backBtn = document.getElementById('gstats-back-btn');
    if (backBtn) backBtn.style.display = gstatsHistory.length > 0 ? '' : 'none';
}

export function pushGstatsView(view) {
    gstatsHistory.push(view);
    if (gstatsHistory.length > 10) gstatsHistory.shift();
    updateGstatsBackBtn();
}

export function gstatsGoBack() {
    var prev = gstatsHistory.pop();
    updateGstatsBackBtn();
    if (!prev) { toggleGlobalStats(); return; }
    if (prev.type === 'match') openGlobalStatsFromMatch(prev.id, true);
    else if (prev.type === 'team') openGlobalStats(prev.name, true);
}

export function openGlobalStatsFromMatch(mid, isBack) {
    var m = S.matchMap.get(String(mid));
    if (!m) return;
    var sidebar = document.getElementById('global-stats-sidebar');
    sidebar.style.transform = 'translateX(0px)';
    var content = document.getElementById('gstats-content');
    var title = document.getElementById('gstats-title');

    /* globalStatsInterval est importé de multiview.js : en modules ES, une liaison
       importée est en lecture seule et toute affectation lève « Assignment to constant
       variable ». La barre de statistiques cassait donc systématiquement sur un match
       EN DIRECT, seul cas où la minuterie est armée. On passe par un setter. */
    if (globalStatsInterval) {
        clearInterval(globalStatsInterval);
        setGlobalStatsInterval(null);
    }
    if (m.status === 'live') {
        setGlobalStatsInterval(setInterval(function() {
            if (document.getElementById('global-stats-sidebar').style.transform === 'translateX(0px)' && document.getElementById('gstats-title').textContent.indexOf(m.homeTeam) > -1) {
                openGlobalStatsFromMatch(mid); // just call it again quietly to update
            } else {
                clearInterval(globalStatsInterval);
                setGlobalStatsInterval(null);
            }
        }, 300000));
    }

    // isBack ne rejoue pas l'empilement (déjà fait par gstatsGoBack), mais la vue
    // courante doit rester exacte : sinon un aller-retour suivant pousserait la
    // mauvaise vue dans l'historique.
    currentGstatsView = { type: 'match', id: mid };
    updateGstatsBackBtn();

    title.textContent = m.homeTeam + ' vs ' + m.awayTeam;

    content.innerHTML = '<div style="text-align:center;color:var(--muted);margin-top:20px;">Chargement des données du match...</div>';

    fetchGameStats(mid).then(function(res) {
        var html = '<div style="display:flex; flex-direction:column; gap:20px;">';

        // Enhanced The Score style header
        html += '<div style="display:flex; flex-direction:column; gap:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); padding:20px 16px; border-radius:16px;">';
        var hLogo = getLogo(m.homeTeam);
        var aLogo = getLogo(m.awayTeam);

        // Top: League & Metadata centered
        var liveBadge = m.status === 'live' ? '<span style="color:var(--red); font-weight:800; font-size:12px; margin-left:8px;">🔴 ' + (m.minute ? esc(m.minute) + "'" : 'LIVE') + '</span>' : '';
        var statusStr = m.startTime;
        if (m.status === 'finished' && m.score) {
            statusStr = 'Terminé';
        } else if (m.status === 'live' && !m.score) {
            statusStr = 'Pas de stats lives disponibles';
        } else if (m.status === 'finished' && !m.score) {
            statusStr = 'Pas de stats disponibles';
        }
        html += '<div style="text-align:center; font-size:11px; font-weight:700; color:var(--muted2); text-transform:uppercase; letter-spacing:0.5px;">';
        html += m.flag + ' ' + esc(m.league) + ' <span style="margin:0 8px; opacity:0.5;">•</span> ' + statusStr + liveBadge;
        html += '</div>';

        // Middle: Teams & Score
        html += '<div style="display:flex; justify-content:space-between; align-items:center; width: 100%; padding: 0 10px;">';

        // Home
        var hRankFormStr = (res.hRank ? '#' + res.hRank + ' ' : '') + (res.hForm ? '[' + res.hForm + ']' : '');
        html += '<div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; flex: 1;" onclick="openGlobalStats(\''+escJs(m.homeTeam)+'\')">';
        if (hRankFormStr) html += '<span style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:-4px;">' + hRankFormStr + '</span>';
        if(hLogo) html += '<div class="prime-logo" style="width:60px; height:60px; display:flex; justify-content:center; align-items:center;"><img src="'+esc(hLogo)+'" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.style.display=\'none\'"></div>';
        html += '<span style="font-weight:700; font-size:14px; text-align:center; line-height:1.2;">'+formatTeamNameBreak(m.homeTeam)+'</span></div>';

        // Score
        html += '<div style="flex: 0.8; display:flex; justify-content:center; align-items:center; flex-direction:column;">';
        if(m.score) {
            html += '<div style="font-weight:800; font-size:36px; color:var(--text); letter-spacing:1px; line-height:1;">' + m.score[0] + ' <span style="color:var(--muted); font-size:24px;">-</span> ' + m.score[1] + '</div>';
        } else {
            html += '<div style="font-weight:700; font-size:20px; color:var(--muted); line-height:1;">VS</div>';
        }
        html += '</div>';

        // Away
        var aRankFormStr = (res.aRank ? '#' + res.aRank + ' ' : '') + (res.aForm ? '[' + res.aForm + ']' : '');
        html += '<div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; flex: 1;" onclick="openGlobalStats(\''+escJs(m.awayTeam)+'\')">';
        if (aRankFormStr) html += '<span style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:-4px;">' + aRankFormStr + '</span>';
        if(aLogo) html += '<div class="prime-logo" style="width:60px; height:60px; display:flex; justify-content:center; align-items:center;"><img src="'+esc(aLogo)+'" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.style.display=\'none\'"></div>';
        html += '<span style="font-weight:700; font-size:14px; text-align:center; line-height:1.2;">'+formatTeamNameBreak(m.awayTeam)+'</span></div>';

        html += '</div>';

        html += '</div>';

        // Stats section if available
        var mHomeId = null, mAwayId = null;
        if (res.data && res.data.header && res.data.header.competitions && res.data.header.competitions[0] && res.data.header.competitions[0].competitors) {
            var c = res.data.header.competitions[0].competitors;
            var hC = c.find(function(x) { return x.homeAway === 'home'; });
            var aC = c.find(function(x) { return x.homeAway === 'away'; });
            if(hC) mHomeId = hC.id;
            if(aC) mAwayId = aC.id;
        }

        if (res.scorers && res.scorers.length > 0) {
            html += renderScorersHtml(res.scorers, m, mHomeId, mAwayId);
        }

        if (res.data) {
            var stats = [];
            // Parse ESPN stats if available
            if (res.source === 'espn' && res.data.boxscore && res.data.boxscore.teams) {
                var ts = res.data.boxscore.teams;
                if(ts.length === 2 && ts[0].statistics && ts[1].statistics) {
                    var hIsTs0 = ts[0].homeAway === 'home';
                    if (ts[0].homeAway !== 'home' && ts[1].homeAway === 'home') hIsTs0 = false;
                    else if (typeof mHomeId !== 'undefined' && mHomeId && ts[0].team && ts[0].team.id === mHomeId) hIsTs0 = true;
                    else if (typeof mHomeId !== 'undefined' && mHomeId && ts[1].team && ts[1].team.id === mHomeId) hIsTs0 = false;

                    var homeStats = hIsTs0 ? ts[0].statistics : ts[1].statistics;
                    var awayStats = hIsTs0 ? ts[1].statistics : ts[0].statistics;

                    homeStats.forEach(function(hStat) {
                        var aStat = awayStats.find(function(s) { return s.name === hStat.name; });
                        if (aStat && hStat.displayValue && aStat.displayValue) {
                            stats.push({
                                label: hStat.name,
                                displayLabel: hStat.label || hStat.displayName || hStat.name,
                                h: hStat.displayValue,
                                a: aStat.displayValue
                            });
                        }
                    });
                }
            }

            if(stats.length > 0) {
                html += '<h4 style="color:#fff;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">Statistiques du match</h4>';
                html += '<div style="display:flex;flex-direction:column;gap:12px;background:rgba(255,255,255,0.02);padding:12px;border-radius:12px;">';

                stats.forEach(function(st) {
                    var formattedLabel = formatStatLabel(st.label);
                    if (!formattedLabel || formattedLabel === st.label) formattedLabel = formatStatLabel(st.displayLabel) || st.displayLabel;

                    var valH = parseFloat(String(st.h).replace(/[^0-9.]/g, '')) || 0;
                    var valA = parseFloat(String(st.a).replace(/[^0-9.]/g, '')) || 0;
                    var maxVal = Math.max(valH, valA);
                    var pctH = maxVal > 0 ? (valH / maxVal) * 100 : 0;
                    var pctA = maxVal > 0 ? (valA / maxVal) * 100 : 0;
                    if (valH === 0 && valA === 0 && String(st.h).trim() !== '0' && String(st.a).trim() !== '0') {
                        pctH = 50; pctA = 50; // Fallback for purely non-numeric strings
                    }

                    html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;">';
                    html += '<div style="display:flex;justify-content:space-between;font-size:13px;align-items:center;">';
                    html += '<span style="font-weight:bold;width:40px;text-align:left;white-space:nowrap;">'+st.h+'</span>';
                    html += '<span style="color:var(--muted);flex:1;text-align:center;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="'+esc(formattedLabel)+'">'+formattedLabel+'</span>';
                    html += '<span style="font-weight:bold;width:40px;text-align:right;white-space:nowrap;">'+st.a+'</span>';
                    html += '</div>';
                    html += '<div style="display:flex;height:4px;width:100%;gap:4px;">';
                    html += '<div style="flex:1;background:rgba(255,255,255,0.05);border-radius:2px;display:flex;justify-content:flex-end;overflow:hidden;">';
                    html += '<div style="height:100%;width:'+pctH+'%;background:var(--accent);border-radius:2px;"></div>';
                    html += '</div>';
                    html += '<div style="flex:1;background:rgba(255,255,255,0.05);border-radius:2px;display:flex;justify-content:flex-start;overflow:hidden;">';
                    html += '<div style="height:100%;width:'+pctA+'%;background:#f59e0b;border-radius:2px;"></div>';
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                });
                html += '</div>';
            } else {
                html += '<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px;">Statistiques détaillées non disponibles.</div>';
            }
        }

        html += '</div>';
        content.innerHTML = html;

    }).catch(function(e) {
        content.innerHTML = '<div style="text-align:center;color:var(--muted);margin-top:20px;">Oups, les données ne sont pas disponibles pour ce match.<br><br>Source: Non supportée ou API absente.</div>';
        console.error(e);
    });
}

export function openGlobalStats(teamName, isBack) {
    var sidebar = document.getElementById('global-stats-sidebar');
    sidebar.style.transform = 'translateX(0px)';
    var content = document.getElementById('gstats-content');
    var title = document.getElementById('gstats-title');

    if (teamName) {
        // Venant d'une fiche de match, on garde de quoi y revenir (mais pas en
        // rejouant un retour : gstatsGoBack a déjà dépilé cette entrée).
        if (!isBack && currentGstatsView) pushGstatsView(currentGstatsView);
        currentGstatsView = { type: 'team', name: teamName };
        updateGstatsBackBtn();

        title.textContent = teamName;
        content.innerHTML = '<div style="text-align:center;color:var(--muted);margin-top:20px;">Chargement de la fiche de ' + esc(teamName) + '...</div>';

        fetchTeamStats(teamName);
    }
}

export function fetchTeamStats(teamName) {
    var content = document.getElementById('gstats-content');

    var teamMatches = S.matches.filter(function(m) {
        return normName(m.homeTeam) === normName(teamName) || normName(m.awayTeam) === normName(teamName);
    });

    var html = '<div style="display:flex;flex-direction:column;gap:20px;">';

    // Placeholder pour Standings / Last 5
    var lg = teamMatches.length > 0 ? teamMatches[0].league : '';

    var logoUrl = getLogo(teamName);
    html += '<div id="team-stats-header" style="display:flex; flex-direction:column; align-items:center; gap:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); padding:24px 20px; border-radius:16px;">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; width: 100%;">';
    html += '<div style="display:flex; align-items:center; gap:16px;">';
    if (logoUrl) {
        html += '<div class="prime-logo" style="width:60px; height:60px; display:flex; justify-content:center; align-items:center;"><img id="gstats-team-logo" src="'+esc(logoUrl)+'" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.style.display=\'none\'"></div>';
    }
    html += '<div>';
    html += '<h2 style="margin:0 0 4px 0; font-size:20px; font-weight:800; color:#fff; letter-spacing:-0.5px; line-height: 1;">'+esc(teamName)+'</h2>';
    if(lg) html += '<div style="color:var(--muted2); font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">'+esc(lg)+'</div>';
    html += '</div>';
    html += '</div>';
    html += '<div id="team-record-header" style="display:flex; gap: 16px; text-align:center;"></div>';
    html += '</div>';
    html += '</div>';

    // Try to find league from team name if teamMatches is empty
    if (!lg) {
        for (var k in STATIC_TEAMS) {
            var teams = STATIC_TEAMS[k];
            for (var t in teams) {
                if (normName(teams[t]) === normName(teamName)) {
                    lg = k;
                    break;
                }
            }
            if (lg) break;
        }
    }

    if (lg) {
        html += '<div>';
        html += '<h4 style="color:#fff;margin-bottom:12px;display:flex;align-items:center;gap:8px;">🏆 Classement '+esc(lg)+'</h4>';
        html += '<div id="gstats-standings" style="background:rgba(255,255,255,0.02);padding:16px;border-radius:12px;font-size:13px;color:var(--muted);text-align:center;">Recherche des classements...</div>';
        html += '</div>';

        // Calendrier à venir
        html += '<div>';
        html += '<h4 style="color:#fff;margin-top:16px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">📅 Matchs à venir</h4>';
        html += '<div id="gstats-upcoming" style="color:var(--muted);font-size:13px;padding:16px;background:rgba(255,255,255,0.02);border-radius:12px;text-align:center;">Recherche des matchs à venir...</div>';
        html += '</div>';

        // Async fetch standings and upcoming matches
        fetchLeagueStandings(lg).then(function(res) {
            var stDiv = document.getElementById('gstats-standings');
            var foundTeamId = null;

            if(stDiv) {
                if (res.source === 'espn' && res.data) {
                    var sTypes = [];
                    if (res.seasonTypes && res.seasonTypes.length > 0) {
                        sTypes = res.seasonTypes.filter(function(t) {
                            return t.hasStandings && (t.id === '1' || t.id === '2' || t.id === '3');
                        }).sort(function(a, b) {
                            return parseInt(b.id) - parseInt(a.id); // Prioritize regular season/playoffs over preseason
                        });
                    }

                    if (sTypes.length === 0) {
                        // Fallback if no specific season types are identified, but we have data
                        sTypes = [{ id: null, name: 'Actuel', abbreviation: 'Actuel' }];
                    }

                    var htmlTabs = '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px;" class="hide-scrollbar">';
                    sTypes.forEach(function(st, idx) {
                        var name = st.name;
                        if (name.indexOf('Regular') > -1) name = 'Saison Régulière';
                        if (name.indexOf('Postseason') > -1 || name.indexOf('Playoffs') > -1) name = 'Séries';
                        if (name.indexOf('Preseason') > -1) name = 'Présaison';

                        htmlTabs += '<button id="seasontab-'+(st.id||'base')+'" onclick="window.loadStandingsTab(\''+escJs(lg)+'\', \''+escJs(teamName)+'\', \''+(st.id||'')+'\')" class="seasontab-btn" style="background:rgba(255,255,255,0.1);border:none;color:#fff;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:bold;cursor:pointer;white-space:nowrap;opacity:'+(idx===0?'1':'0.5')+';">'+esc(name)+'</button>';
                    });
                    htmlTabs += '</div>';
                    htmlTabs += '<div id="gstats-standings-content" style="position:relative;min-height:100px;">Chargement...</div>';

                    stDiv.innerHTML = htmlTabs;
                    stDiv.style.background = 'transparent';
                    stDiv.style.padding = '0';

                    // Load the first available season type by default
                    if (sTypes.length > 0) {
                        // Only pass initial res if it actually matches the season type we are prioritizing
                        var cache = null;
                        var rSeasonType = null;
                        if (res.data && res.data.children && res.data.children.length > 0 && res.data.children[0].standings) {
                             rSeasonType = res.data.children[0].standings.seasonType;
                        }

                        if (rSeasonType && String(rSeasonType) === String(sTypes[0].id)) {
                            cache = res;
                        } else if (!sTypes[0].id) {
                            cache = res;
                        }
                        window.loadStandingsTab(lg, teamName, sTypes[0].id, cache);
                    }
                } else {
                    stDiv.innerHTML = 'Données de classement non disponibles via ESPN pour cette ligue.';
                }
            }

            // Fetch upcoming schedule and team info if team ID is found
            var upcDiv = document.getElementById('gstats-upcoming');
            if(foundTeamId && upcDiv) {
                // Fetch Team Info (roster & stats)
                fetchTeamInfo(lg, foundTeamId).then(function(infoRes) {
                    var statsContainer = document.createElement('div');
                    var tHtml = '';
                    var teamObj = infoRes.team && infoRes.team.team ? infoRes.team.team : infoRes.team;
                    if (teamObj && teamObj.record && teamObj.record.items) {
                        var totalRec = teamObj.record.items.find(function(r) { return r.type === 'total'; });
                        if (totalRec && totalRec.summary) {
                            tHtml += '<div><h4 style="color:#fff;margin-top:16px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">📊 Statistiques de l\'équipe (' + esc(totalRec.summary) + ')</h4>';
                            tHtml += '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(110px, 1fr));gap:8px;margin-bottom:16px;">';
                            var statTranslations = {
                                'otLosses': 'Défaites (Prol.)', 'OTLosses': 'Défaites (Prol.)',
                                'otWins': 'Victoires (Prol.)', 'OTWins': 'Victoires (Prol.)',
                                'overtimeLosses': 'Défaites (Prol.)', 'overtimeWins': 'Victoires (Prol.)',
                                'shootoutLosses': 'Défaites (Fus.)', 'shootoutWins': 'Victoires (Fus.)',
                                'avgPointsAgainst': 'Moy. Pts Contre', 'avgPointsFor': 'Moy. Pts Pour',
                                'differential': 'Différentiel', 'gamesBehind': 'Retard',
                                'divisionGamesBehind': 'Retard (Div.)', 'pointDifferential': 'Diff. Points',
                                'pointsAgainst': 'Points Contre', 'pointsFor': 'Points Pour',
                                'streak': 'Séquence', 'winPercent': '% Victoire',
                                'leagueWinPercent': '% Vict. (Ligue)', 'divisionWinPercent': '% Vict. (Div.)',
                                'playoffPercent': '% Séries', 'wildCardPercent': '% Quatrième',
                                'penaltyKillPct': '% Infériorité', 'powerPlayPct': '% Avantage',
                                'powerPlayGoals': 'Buts (Avantage)', 'powerPlayGoalsAgainst': 'Buts Contre (Avantage)',
                                'powerPlayOpportunities': 'Occasions (Avantage)',
                                'regLosses': 'Défaites (Rég.)', 'regWins': 'Victoires (Rég.)',
                                'rotLosses': 'Défaites (T.R./Prol.)', 'rotWins': 'Victoires (T.R./Prol.)',
                                'timesShortHanded': 'Fois en Inf.', 'pointsDiff': 'Diff. Points',
                                'homeLosses': 'Défaites (Dom.)', 'homeWins': 'Victoires (Dom.)', 'homeTies': 'Nuls (Dom.)',
                                'roadLosses': 'Défaites (Ext.)', 'roadWins': 'Victoires (Ext.)', 'roadTies': 'Nuls (Ext.)',
                                'divisionLosses': 'Défaites (Div.)', 'divisionWins': 'Victoires (Div.)', 'divisionTies': 'Nuls (Div.)',
                                'divisionRecord': 'Fiche (Div.)', 'divisionPercent': '% Vict. (Div.)',
                                'gamesAhead': 'Avance'
                            };
                            var TEAM_STAT_CATEGORIES = {
                                'Général': ['streak', 'winPercent', 'differential', 'pointDifferential', 'pointsDiff', 'gamesBehind', 'gamesAhead', 'leagueWinPercent', 'playoffPercent', 'wildCardPercent'],
                                'Offensive / Défensive': ['avgPointsFor', 'avgPointsAgainst', 'pointsFor', 'pointsAgainst'],
                                'Domicile': ['homeWins', 'homeLosses', 'homeTies'],
                                'Extérieur': ['roadWins', 'roadLosses', 'roadTies'],
                                'Division': ['divisionWins', 'divisionLosses', 'divisionTies', 'divisionRecord', 'divisionPercent', 'divisionWinPercent', 'divisionGamesBehind'],
                                'Spécialité (Prol. / Infériorité)': ['otWins', 'otLosses', 'OTWins', 'OTLosses', 'overtimeWins', 'overtimeLosses', 'shootoutWins', 'shootoutLosses', 'regWins', 'regLosses', 'rotWins', 'rotLosses', 'powerPlayPct', 'penaltyKillPct', 'powerPlayGoals', 'powerPlayGoalsAgainst', 'powerPlayOpportunities', 'timesShortHanded']
                            };

                            var groupedTeamStats = {};
                            var usedTeamKeys = new Set();

                            for (var cat in TEAM_STAT_CATEGORIES) {
                                groupedTeamStats[cat] = [];
                            }
                            groupedTeamStats['Autres'] = [];

                            totalRec.stats.forEach(function(s) {
                                // Skip boring stats or repetitive ones
                                if(s.name === 'gamesPlayed' || s.name === 'points' || s.name === 'wins' || s.name === 'losses' || s.name === 'ties' || s.name === 'playoffSeed' || s.name === 'clincher' || s.name === 'magicNumberDivision' || s.name === 'magicNumberWildcard') return;

                                var rawName = s.shortDisplayName || s.displayName || s.name || '';
                                var statName = statTranslations[rawName] || statTranslations[s.name] || rawName.replace(/([A-Z])/g, " $1").trim();
                                statName = statName.charAt(0).toUpperCase() + statName.slice(1);

                                var displayVal = s.displayValue !== undefined ? s.displayValue : s.value;
                                if (typeof displayVal === 'number' && !Number.isInteger(displayVal)) {
                                    displayVal = displayVal.toFixed(2);
                                } else if (typeof displayVal === 'string' && !isNaN(Number(displayVal)) && displayVal.indexOf('.') > -1) {
                                    displayVal = Number(displayVal).toFixed(2);
                                }

                                var statObj = { name: statName, val: displayVal };
                                var foundCat = false;

                                for (var cat in TEAM_STAT_CATEGORIES) {
                                    if (TEAM_STAT_CATEGORIES[cat].indexOf(s.name) > -1 || TEAM_STAT_CATEGORIES[cat].indexOf(rawName) > -1) {
                                        groupedTeamStats[cat].push(statObj);
                                        foundCat = true;
                                        break;
                                    }
                                }

                                if (!foundCat) {
                                    groupedTeamStats['Autres'].push(statObj);
                                }
                            });

                            tHtml = '<div><h4 style="color:#fff;margin-top:16px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">📊 Statistiques de l\'équipe (' + esc(totalRec.summary) + ')</h4>';

                            var recStats = groupedTeamStats['Général'] || [];
                            var wVal = '0', lVal = '0', dVal = '0', ptsVal = '0', streakVal = '', rankVal = '';

                            // Try to extract main record stats to display in the header
                            recStats.forEach(function(s) {
                                if(s.name.toLowerCase().indexOf('victoire') > -1 && s.name.indexOf('%') === -1) wVal = s.val;
                                if(s.name.toLowerCase().indexOf('défaite') > -1 && s.name.indexOf('%') === -1) lVal = s.val;
                                if(s.name.toLowerCase().indexOf('nul') > -1 && s.name.indexOf('%') === -1) dVal = s.val;
                                if(s.name.toLowerCase().indexOf('séquence') > -1) streakVal = s.val;
                                if(s.name.toLowerCase().indexOf('points') > -1 && s.name.indexOf('diff') === -1) ptsVal = s.val;
                            });

                            // Fallback extraction
                            if(wVal === '0' && totalRec.summary) {
                                var parts = totalRec.summary.split('-');
                                if (parts.length >= 2) {
                                    wVal = parts[0];
                                    lVal = parts[1];
                                    if(parts.length > 2) dVal = parts[2];
                                }
                            }

                            // Inject header stats if the target exists
                            var recHeader = document.getElementById('team-record-header');
                            if (recHeader) {
                                var rhHtml = '';
                                rhHtml += '<div style="display:flex; flex-direction:column; align-items:center;"><div style="font-size:24px; font-weight:800; color:#fff; line-height: 1;">'+esc(wVal)+'-'+esc(lVal)+(dVal!=='0'?'-'+esc(dVal):'')+'</div><div style="font-size:11px; color:var(--muted); text-transform:uppercase;">Fiche</div></div>';
                                if (ptsVal !== '0') rhHtml += '<div style="display:flex; flex-direction:column; align-items:center;"><div style="font-size:24px; font-weight:800; color:#fff; line-height: 1;">'+esc(ptsVal)+'</div><div style="font-size:11px; color:var(--muted); text-transform:uppercase;">Pts</div></div>';
                                if (streakVal) rhHtml += '<div style="display:flex; flex-direction:column; align-items:center;"><div style="font-size:24px; font-weight:800; color:#fff; line-height: 1;">'+esc(streakVal)+'</div><div style="font-size:11px; color:var(--muted); text-transform:uppercase;">Séquence</div></div>';
                                recHeader.innerHTML = rhHtml;
                            }

                            for (var cat in groupedTeamStats) {
                                if (groupedTeamStats[cat].length > 0 && cat !== 'Général') {
                                    tHtml += '<div style="margin-top:16px; margin-bottom: 8px; font-size: 11px; font-weight: 700; color: var(--muted2); text-transform: uppercase; letter-spacing: 0.5px;">' + esc(cat) + '</div>';
                                    tHtml += '<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;">';
                                    groupedTeamStats[cat].forEach(function(st) {
                                        tHtml += '<div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.02);padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.03);">';
                                        tHtml += '<div style="font-size:13px;color:var(--muted2);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="'+esc(st.name)+'">'+esc(st.name)+'</div>';
                                        tHtml += '<div style="font-size:14px;font-weight:800;color:#fff;">'+esc(st.val)+'</div>';
                                        tHtml += '</div>';
                                    });
                                    tHtml += '</div>';
                                }
                            }
                            tHtml += '</div>';
                        }
                    }

                    // Render Leaders directly from team roster if available
                    if (infoRes.roster && infoRes.roster.team && infoRes.roster.team.athletes) {
                        var athletes = infoRes.roster.team.athletes;

                        // We will group leaders by primary stats if no explicit leaders object is given
                        // For simplicity, we just check if teamObj.leaders exists first
                        if (teamObj && teamObj.leaders && teamObj.leaders.length > 0) {
                             tHtml += '<div><h4 style="color:#fff;margin-top:16px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">🌟 Meneurs</h4>';
                             tHtml += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">';
                             teamObj.leaders.forEach(function(l) {
                                 if(l.leaders && l.leaders.length > 0) {
                                     var lead = l.leaders[0];
                                     tHtml += '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);padding:12px;border-radius:12px;flex:1;min-width:140px;display:flex;align-items:center;gap:12px;">';
                                     var headshot = lead.athlete && lead.athlete.headshot ? lead.athlete.headshot.href : '';
                                     if(headshot) {
                                         tHtml += '<img src="'+esc(headshot)+'" style="width:40px;height:40px;border-radius:50%;object-fit:cover;background:#111;">';
                                     } else {
                                         tHtml += '<div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:12px;">'+(lead.athlete?lead.athlete.shortName.charAt(0):'')+'</div>';
                                     }
                                     tHtml += '<div>';
                                     tHtml += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;">'+esc(l.displayName)+'</div>';
                                     tHtml += '<div style="font-size:14px;font-weight:bold;color:#fff;">'+(lead.athlete?esc(lead.athlete.shortName):'')+'</div>';
                                     tHtml += '<div style="font-size:12px;color:var(--accent);font-weight:bold;">'+esc(lead.displayValue)+'</div>';
                                     tHtml += '</div></div>';
                                 }
                             });
                             tHtml += '</div></div>';
                        } else if (teamObj && teamObj.nextEvent && teamObj.nextEvent[0] && teamObj.nextEvent[0].competitions[0].competitors) {
                             // Fallback to next match leaders if team roster leaders are missing
                             var myC = teamObj.nextEvent[0].competitions[0].competitors.find(function(c) { return String(c.id) === String(foundTeamId); }) || teamObj.nextEvent[0].competitions[0].competitors[0];
                             if (myC.leaders && myC.leaders.length > 0) {
                                 tHtml += '<div><h4 style="color:#fff;margin-top:16px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">🌟 Meneurs (Match)</h4>';
                                 tHtml += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">';
                                 myC.leaders.forEach(function(l) {
                                     if(l.leaders && l.leaders.length > 0) {
                                         var lead = l.leaders[0];
                                         tHtml += '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);padding:12px;border-radius:12px;flex:1;min-width:140px;display:flex;align-items:center;gap:12px;">';
                                         var headshot = lead.athlete && lead.athlete.headshot ? lead.athlete.headshot.href : '';
                                         if(headshot) {
                                             tHtml += '<img src="'+esc(headshot)+'" style="width:40px;height:40px;border-radius:50%;object-fit:cover;background:#111;">';
                                         } else {
                                             tHtml += '<div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:12px;">'+(lead.athlete?lead.athlete.shortName.charAt(0):'')+'</div>';
                                         }
                                         tHtml += '<div>';
                                         tHtml += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;">'+esc(l.displayName)+'</div>';
                                         tHtml += '<div style="font-size:14px;font-weight:bold;color:#fff;">'+(lead.athlete?esc(lead.athlete.shortName):'')+'</div>';
                                         tHtml += '<div style="font-size:12px;color:var(--accent);font-weight:bold;">'+esc(lead.displayValue)+'</div>';
                                         tHtml += '</div></div>';
                                     }
                                 });
                                 tHtml += '</div></div>';
                             }
                        }
                    }

                    if(tHtml) {
                        statsContainer.innerHTML = tHtml;
                        stDiv.parentNode.insertBefore(statsContainer, stDiv.nextSibling);
                    }
                }).catch(function(e) {
                    console.error('Stats not available', e);
                });

                fetchTeamSchedule(lg, foundTeamId).then(function(schedRes) {
                    if(schedRes.source === 'espn' && schedRes.data && schedRes.data.events) {
                        var events = schedRes.data.events;
                        // Filter events from today onwards
                        var now = new Date();
                        now.setHours(0,0,0,0);
                        var futureEvents = events.filter(function(e) {
                            var eDate = new Date(e.date);
                            return eDate >= now;
                        }).slice(0, 5); // take next 5

                        if(futureEvents.length > 0) {
                            var uHtml = '';
                            futureEvents.forEach(function(ev) {
                                var comp = ev.competitions[0];
                                var hComp = comp.competitors.find(function(c){return c.homeAway==='home';}) || comp.competitors[0];
                                var aComp = comp.competitors.find(function(c){return c.homeAway==='away';}) || comp.competitors[1];

                                var dateObj = new Date(ev.date);
                                var timeStr = getEstTimeStrFromDate(dateObj);
                                var dateStr = getEstDateStrFromDate(dateObj); // YYYY-MM-DD

                                var isHome = String(hComp.team.id) === String(foundTeamId) || (hComp.team.id === undefined && normName(hComp.team.name) === normName(teamName));
                                var oppComp = isHome ? aComp : hComp;
                                var opponentName = oppComp.team ? (oppComp.team.displayName || oppComp.team.name || 'TBD') : 'TBD';
                                var oppLogo = oppComp.team && oppComp.team.logos && oppComp.team.logos.length > 0 ? oppComp.team.logos[0].href : getLogo(opponentName);

                                uHtml += '<div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:12px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.05);">';
                                uHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
                                uHtml += '<span style="font-size:11px;color:var(--muted);font-weight:bold;background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;">'+esc(dateStr)+' ' + esc(timeStr)+'</span>';
                                if (ev.status && ev.status.type && ev.status.type.state === 'in') {
                                    uHtml += '<span style="color:var(--red);font-size:11px;font-weight:bold;background:rgba(255,69,58,0.1);padding:2px 6px;border-radius:4px;">🔴 En Direct</span>';
                                }
                                uHtml += '</div>';

                                uHtml += '<div style="display:flex;align-items:center;gap:8px;">';
                                uHtml += '<div style="flex:1;">';
                                uHtml += '<div style="font-size:12px;color:var(--muted);">'+(isHome ? 'vs (Domicile)' : '@ (Extérieur)')+'</div>';
                                uHtml += '<div style="font-size:15px;font-weight:bold;color:#fff;display:flex;align-items:center;gap:8px;">';
                                if(oppLogo) uHtml += '<img src="'+esc(oppLogo)+'" style="width:20px;height:20px;object-fit:contain;background:#fff;border-radius:50%;padding:2px;">';
                                uHtml += esc(opponentName)+'</div>';
                                uHtml += '</div>';

                                if(ev.status && ev.status.type && ev.status.type.state !== 'pre') {
                                    var hScore = hComp.score ? hComp.score.displayValue : '0';
                                    var aScore = aComp.score ? aComp.score.displayValue : '0';
                                    var tScore = isHome ? parseInt(hScore) : parseInt(aScore);
                                    var oScore = isHome ? parseInt(aScore) : parseInt(hScore);
                                    var resColor = tScore > oScore ? 'var(--accent-green)' : (tScore < oScore ? 'var(--red)' : 'var(--muted)');
                                    uHtml += '<div style="font-size:20px;font-weight:800;color:'+resColor+';background:rgba(0,0,0,0.4);padding:4px 12px;border-radius:8px;">'+hScore+' - '+aScore+'</div>';
                                }

                                uHtml += '</div></div>';
                            });
                            upcDiv.innerHTML = uHtml;
                            upcDiv.style.background = 'transparent';
                            upcDiv.style.padding = '0';
                        } else {
                            upcDiv.innerHTML = 'Aucun match prévu trouvé dans le calendrier.';
                        }
                    } else {
                        upcDiv.innerHTML = 'Calendrier non disponible.';
                    }
                }).catch(function() {
                    upcDiv.innerHTML = 'Erreur de récupération du calendrier.';
                });
            } else if (upcDiv) {
                 upcDiv.innerHTML = 'Impossible de lier l\'équipe pour le calendrier.';
            }

        }).catch(function(e){
            var stDiv = document.getElementById('gstats-standings');
            if(stDiv) stDiv.innerHTML = 'Erreur de récupération du classement.';
            var upcDiv = document.getElementById('gstats-upcoming');
            if(upcDiv) upcDiv.innerHTML = 'Erreur lors de l\'initialisation.';
        });
    } else {
        // Hide upcoming if no league
        var upcDiv = document.getElementById('gstats-upcoming');
        if(upcDiv) upcDiv.innerHTML = 'Ligue introuvable pour afficher le calendrier.';
    }

    html += '</div>';
    content.innerHTML = html;
}


/* Formatteur d'heure EST commun pour l'API et l'horloge système */
export var estFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hourCycle: 'h23',
    hour: 'numeric',
    minute: 'numeric'
});

export function getEstDateStrFromDate(d) {
    var formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(d);
}

/* Minutes signées entre maintenant et le coup d'envoi : négatif = déjà commencé.

   Pourquoi une fonction plutôt que la soustraction d'heures qui traînait recopiée à
   trois endroits : `startTime` est une heure du jour sans date, si bien qu'un match à
   01:00 et un « maintenant » à 19:34 donnaient un écart de −1114 minutes. Le
   rattrapage de minuit qui l'accompagnait (`if (currentMins >= 1380 && mMins <= 60)`)
   ne couvrait que la fenêtre 23:00 → 01:00 et laissait passer tout le reste. Or les
   matchs portent un `matchDate` : on s'en sert, et le décalage de jour se calcule sur
   les dates civiles EST, sans que l'heure d'été n'intervienne puisqu'on ne prend
   qu'une différence de jours entiers.

   Rend `null` si l'heure est absente ou illisible — l'appelant décide quoi en faire
   plutôt que d'hériter d'un 0 qui signifierait « commence maintenant ». */
export function minutesUntilStart(m, now) {
    var t = /^(\d{1,2}):(\d{2})$/.exec(String(m && m.startTime || '').trim());
    if (!t) return null;
    var startMins = parseInt(t[1], 10) * 60 + parseInt(t[2], 10);
    if (startMins > 1439) return null;

    now = now || new Date();
    var cur = getEstTimeStrFromDate(now).split(':');
    var diff = startMins - (parseInt(cur[0], 10) * 60 + parseInt(cur[1], 10));

    var day = String(m && m.matchDate || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        var today = getEstDateStrFromDate(now);
        if (day !== today) {
            diff += Math.round((Date.parse(day + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 60000);
        }
    } else if (diff < -720) {
        // Sans date, on retient l'occurrence la plus proche : à 23:30, un « 00:15 »
        // est le lendemain, pas seize heures plus tôt.
        diff += 1440;
    }
    return diff;
}

/* Un match commencé il y a plus de ce délai n'est plus en cours, quoi qu'en dise la
   source. Quatre heures couvrent large : un match de football en dure deux, un match
   de baseball ou un cinq sets rarement plus de quatre. Sans cette borne, un statut
   `live` périmé — il y en avait 50 dans le cache d'un soir, dont un commencé 19 h plus
   tôt — garde sa place dans l'onglet Live jusqu'au lendemain. */
export var LIVE_MAX_DURATION_MIN = 240;

/* « Dans l'heure » : la portée de l'onglet Live au-delà de ce qui est en cours. */
export var LIVE_WINDOW_MIN = 60;

/* Fenêtre d'avance pendant laquelle un match qui n'a pas encore commencé est déjà
   montré comme en cours : le direct commence avant le coup d'envoi. */
export var LIVE_GRACE_BEFORE_MIN = 15;

/* En cours maintenant : soit la source l'annonce, soit l'heure est passée (ou tout
   proche) — dans les deux cas à condition que ce ne soit pas terminé depuis longtemps. */
export function isLiveNow(m, now) {
    if (!m || m.status === 'finished') return false;
    var diff = minutesUntilStart(m, now);
    if (diff === null) return m.status === 'live';
    if (diff <= -LIVE_MAX_DURATION_MIN) return false;
    return m.status === 'live' || diff <= LIVE_GRACE_BEFORE_MIN;
}

/* À venir dans les `withinMin` minutes, et pas encore considéré comme en cours. */
export function startsWithin(m, withinMin, now) {
    if (!m || m.status === 'finished' || m.status === 'live') return false;
    var diff = minutesUntilStart(m, now);
    if (diff === null) return false;
    return diff > LIVE_GRACE_BEFORE_MIN && diff <= withinMin;
}

export function getEstTimeStrFromDate(d) {
    // Force format extraction even if older browsers fallback to AM/PM despite hourCycle
    var str = estFormatter.format(d);
    var m = str.match(/(\d+):(\d+)\s*(AM|PM|am|pm)?/i);
    if(m) {
        var h = parseInt(m[1], 10);
        var mins = m[2];
        var ampm = m[3] ? m[3].toUpperCase() : '';

        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;

        h = h % 24;
        return pad(h) + ':' + pad(mins);
    }
    return '00:00';
}

/* ══ DOMAIN PREFS ════════════════════════ */
export function getDomain(url) {
  if (!url) return '';
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (url.startsWith('//')) {
            url = 'http:' + url;
        } else if (!url.includes('://')) {
            url = 'http://' + url;
        }
    }
    var u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch(e) {
    try {
        var match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/i);
        return match && match[1] ? match[1] : url;
    } catch(err) {
        return url;
    }
  }
}


export var domainPrefs = {};
domainPrefs = safeStorageGetJSON('domain_prefs', {});

export function saveDomainPrefs() {
  try {
    safeStorageSetJSON('domain_prefs', domainPrefs);
  } catch(e) {}
}

export function toggleDomainPref(domain, type, mid) {
  mid = getOriginalMatchId(mid);
  var current = domainPrefs[domain] || 0;
  if (type === 'fav') {
    if (current === 1) delete domainPrefs[domain];
    else domainPrefs[domain] = 1;
  } else if (type === 'dep') {
    if (current === -1) delete domainPrefs[domain];
    else domainPrefs[domain] = -1;
  }
  saveDomainPrefs();

  // Refresh the UI if necessary
  if (mid) {
    var m = S.matchMap.get(String(mid));
    if(m) {
      if (document.getElementById('mbg').classList.contains('open')) {
        openMod(m);
      }
    }
  }
}

export function sortFluxLinks(links) {
  return links.slice().sort(function(a, b) {
    var nameA = (a.name || '').toLowerCase();
    var nameB = (b.name || '').toLowerCase();
    var qualA = (a.quality || '').toLowerCase();
    var qualB = (b.quality || '').toLowerCase();
    var urlA = (a.url || '').toLowerCase();
    var urlB = (b.url || '').toLowerCase();

    function getQualityScore(qualStr, nameStr) {
      var str = (qualStr + ' ' + nameStr).toLowerCase();
      var bitrateMatch = str.match(/(\d+)\s*(kbps|kbs|kb\/s)/);
      if (bitrateMatch) {
          return 1000000 + parseInt(bitrateMatch[1], 10);
      }
      if (str.includes('4k')) return 100000;
      if (str.includes('1080p') || str.includes('1080')) return 10000;
      if (str.includes('720p') || str.includes('720') || str.includes('hd')) return 1000;
      return 0; // SD or unknown
    }

    var scoreA = getQualityScore(qualA, nameA);
    var scoreB = getQualityScore(qualB, nameB);
    if (scoreA !== scoreB) {
        return scoreB - scoreA;
    }

    var isBuffA = (urlA.includes('buffstreams') || nameA.includes('buffstream')) ? 1 : 0;
    var isBuffB = (urlB.includes('buffstreams') || nameB.includes('buffstream')) ? 1 : 0;
    if (isBuffA !== isBuffB) {
      return isBuffB - isBuffA;
    }

    var isFavA = nameA.includes('sheri') || nameA.includes('4kplayer') ? 1 : 0;
    var isFavB = nameB.includes('sheri') || nameB.includes('4kplayer') ? 1 : 0;

    if (isFavA !== isFavB) {
      return isFavB - isFavA; // 1 goes before 0
    }

    var domA = getDomain(a.url);
    var domB = getDomain(b.url);
    var prefA = domainPrefs[domA] || 0;
    var prefB = domainPrefs[domB] || 0;
    if (prefA !== prefB) {
      return prefB - prefA; // Favs (1) first, dep (-1) last
    }
    return 0; // Keep original order if preferences are equal
  });
}



// Global bindings for HTML compatibility
window.SITE = SITE;
window.MLBBITE_PLUS_URL = MLBBITE_PLUS_URL;
window.SPORTSURGE_URL = SPORTSURGE_URL;
window.BUFFSTREAMS_URL = BUFFSTREAMS_URL;
window.STREAMEAST_URL = STREAMEAST_URL;
window.ONHOCKEY_URL = ONHOCKEY_URL;
window.VIPLEAGUE_URL = VIPLEAGUE_URL;
window.METHSTREAMS_URL = METHSTREAMS_URL;
window.PROXIES = PROXIES;
window.toggleGlobalStats = toggleGlobalStats;
window.openGlobalStatsFromMatch = openGlobalStatsFromMatch;
window.openGlobalStats = openGlobalStats;
window.fetchTeamStats = fetchTeamStats;
window.estFormatter = estFormatter;
window.getEstDateStrFromDate = getEstDateStrFromDate;
window.getEstTimeStrFromDate = getEstTimeStrFromDate;




export function resolveUrl(href, base) {
    if (!href) return href;
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('javascript')) return href;
    try {
        return new URL(href, base).href;
    } catch(e) {
        try {
            var baseDom = base;
            if (!baseDom.startsWith('http://') && !baseDom.startsWith('https://')) {
                baseDom = 'https://' + baseDom;
            }
            return new URL(href, baseDom).href;
        } catch(e2) {
            return href; // Return original if all parsing fails
        }
    }
}

window.getDomain = getDomain;
window.resolveUrl = resolveUrl;
window.domainPrefs = domainPrefs;
window.saveDomainPrefs = saveDomainPrefs;
window.toggleDomainPref = toggleDomainPref;
window.sortFluxLinks = sortFluxLinks;

window.loadStandingsTab = function(lg, teamName, seasonTypeId, cachedRes) {
    var contentDiv = document.getElementById('gstats-standings-content');
    if (!contentDiv) return;

    // Update active state of season tabs
    document.querySelectorAll('.seasontab-btn').forEach(function(b) {
        b.style.opacity = '0.5';
    });
    var activeBtn = document.getElementById('seasontab-' + (seasonTypeId || 'base'));
    if (activeBtn) activeBtn.style.opacity = '1';

    contentDiv.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);background:rgba(255,255,255,0.02);border-radius:12px;">Chargement...</div>';

    var fetchPromise = cachedRes ? Promise.resolve(cachedRes) : fetchLeagueStandings(lg, seasonTypeId);

    fetchPromise.then(function(res) {
        if (!res || !res.data || !res.data.children || res.data.children.length === 0 || !res.data.children[0].standings) {
            contentDiv.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);background:rgba(255,255,255,0.02);border-radius:12px;">Données non disponibles pour cette saison.</div>';
            return;
        }

        var tableHtml = '';
        var lgLower = lg.toLowerCase();
        var isSoccer = lgLower.indexOf('premier') > -1 || lgLower.indexOf('ligue 1') > -1 || lgLower.indexOf('liga') > -1 || lgLower.indexOf('serie a') > -1 || lgLower.indexOf('bundesliga') > -1 || lgLower.indexOf('mls') > -1 || lgLower.indexOf('champions league') > -1 || lgLower.indexOf('europa') > -1;
        var isHockey = lgLower.indexOf('nhl') > -1 || lgLower.indexOf('lhjmq') > -1;
        var isBaseball = lgLower.indexOf('mlb') > -1;

        var tableHeader = '';
        if(isSoccer) {
            tableHeader += '<tr style="color:var(--muted2);border-bottom:1px solid rgba(255,255,255,0.1);"><th style="padding:4px;">#</th><th style="padding:4px;min-width:100px;">Équipe</th><th style="padding:4px;">MJ</th><th style="padding:4px;">V</th><th style="padding:4px;">N</th><th style="padding:4px;">D</th><th style="padding:4px;">BP</th><th style="padding:4px;">BC</th><th style="padding:4px;">Diff</th><th style="padding:4px;">Pts</th></tr>';
        } else if (isHockey) {
            tableHeader += '<tr style="color:var(--muted2);border-bottom:1px solid rgba(255,255,255,0.1);"><th style="padding:4px;">#</th><th style="padding:4px;min-width:100px;">Équipe</th><th style="padding:4px;">MJ</th><th style="padding:4px;">V</th><th style="padding:4px;">D</th><th style="padding:4px;">DP</th><th style="padding:4px;">BP</th><th style="padding:4px;">BC</th><th style="padding:4px;">Diff</th><th style="padding:4px;">Pts</th></tr>';
        } else if (isBaseball) {
            tableHeader += '<tr style="color:var(--muted2);border-bottom:1px solid rgba(255,255,255,0.1);"><th style="padding:4px;">#</th><th style="padding:4px;min-width:100px;">Équipe</th><th style="padding:4px;">MJ</th><th style="padding:4px;">V</th><th style="padding:4px;">D</th><th style="padding:4px;">Pct</th><th style="padding:4px;">GB</th></tr>';
        } else {
            tableHeader += '<tr style="color:var(--muted2);border-bottom:1px solid rgba(255,255,255,0.1);"><th style="padding:4px;">#</th><th style="padding:4px;min-width:100px;">Équipe</th><th style="padding:4px;">MJ</th><th style="padding:4px;">V</th><th style="padding:4px;">D</th><th style="padding:4px;">N</th><th style="padding:4px;">BP</th><th style="padding:4px;">BC</th><th style="padding:4px;">Diff</th><th style="padding:4px;">Pts</th></tr>';
        }

        var hasTabs = res.data.children.length > 1;
        var activeGroupIdx = 0;

        // First pass: detect which group the team belongs to
        res.data.children.forEach(function(group, groupIdx) {
            var groupEntries = [];
            if (group.standings && group.standings.entries) {
                groupEntries = group.standings.entries;
            }
            groupEntries.forEach(function(row) {
                var isTeam = normName(row.team.name) === normName(teamName) || isMatch(normName(row.team.name), normName(teamName)) || normName(teamName).indexOf(normName(row.team.name)) > -1 || normName(row.team.name).indexOf(normName(teamName)) > -1;
                if(isTeam) {
                    activeGroupIdx = groupIdx;
                }
            });
        });

        if (hasTabs) {
            tableHtml += '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:8px;" class="hide-scrollbar">';
            res.data.children.forEach(function(c, i) {
                tableHtml += '<button onclick="document.querySelectorAll(\'#gstats-standings-content .st-tab-group\').forEach(e=>e.style.display=\'none\'); document.getElementById(\'st-tab-'+i+'\').style.display=\'block\'; document.querySelectorAll(\'#gstats-standings-content .st-tab-btn\').forEach(b=>b.style.opacity=\'0.5\'); this.style.opacity=\'1\';" class="st-tab-btn" style="background:rgba(255,255,255,0.1);border:none;color:#fff;padding:6px 12px;border-radius:12px;font-size:12px;cursor:pointer;white-space:nowrap;opacity:'+(i===activeGroupIdx?'1':'0.5')+';">'+esc(c.name || c.abbreviation || 'Grp '+(i+1))+'</button>';
            });
            tableHtml += '</div>';
        }

        var globalTeamFound = false;

        res.data.children.forEach(function(group, groupIdx) {
            var isFirst = groupIdx === activeGroupIdx;
            tableHtml += '<div id="st-tab-'+groupIdx+'" class="st-tab-group" style="display:'+(isFirst?'block':'none')+';background:rgba(255,255,255,0.02);padding:16px;border-radius:12px;">';
            tableHtml += '<div style="overflow-x:auto;max-height:400px;" class="hide-scrollbar"><table style="width:100%;border-collapse:collapse;text-align:left;font-size:12px;white-space:nowrap;">';
            tableHtml += tableHeader;

            var groupEntries = [];
            if (group.standings && group.standings.entries) {
                groupEntries = group.standings.entries;
            }

            var groupTeamFound = false;

            groupEntries.forEach(function(row, idx) {
                var isTeam = normName(row.team.name) === normName(teamName) || isMatch(normName(row.team.name), normName(teamName)) || normName(teamName).indexOf(normName(row.team.name)) > -1 || normName(row.team.name).indexOf(normName(teamName)) > -1;
                if(isTeam) {
                    groupTeamFound = true;
                    globalTeamFound = true;
                }

                var getStat = function(n) { var st = row.stats.find(s => s.name === n); return st ? st.displayValue : '0'; };
                var pts = getStat('points');
                var gp = getStat('gamesPlayed');
                var wins = getStat('wins');
                var losses = getStat('losses');
                var ties = getStat('ties');
                var otl = getStat('otLosses'); // Hockey
                var pf = getStat('pointsFor');
                var pa = getStat('pointsAgainst');
                var diff = getStat('pointDifferential');
                var pct = getStat('winPercent'); // Baseball
                var gb = getStat('gamesBehind'); // Baseball

                tableHtml += '<tr style="background:'+(isTeam?'rgba(255,255,255,0.1)':'transparent')+'; border-bottom:1px solid rgba(255,255,255,0.05);">';
                tableHtml += '<td style="padding:6px 4px;font-weight:bold;">'+(idx+1)+'</td>';
                tableHtml += '<td style="padding:6px 4px;color:#fff;">'+esc(row.team.shortDisplayName || row.team.name)+'</td>';
                tableHtml += '<td style="padding:6px 4px;">'+gp+'</td>';
                tableHtml += '<td style="padding:6px 4px;">'+wins+'</td>';

                if (isBaseball) {
                    tableHtml += '<td style="padding:6px 4px;">'+losses+'</td>';
                    tableHtml += '<td style="padding:6px 4px;">'+pct+'</td>';
                    tableHtml += '<td style="padding:6px 4px;">'+gb+'</td>';
                } else if (isHockey) {
                    tableHtml += '<td style="padding:6px 4px;">'+losses+'</td>';
                    tableHtml += '<td style="padding:6px 4px;">'+otl+'</td>';
                    tableHtml += '<td style="padding:6px 4px;">'+pf+'</td>';
                    tableHtml += '<td style="padding:6px 4px;">'+pa+'</td>';
                    tableHtml += '<td style="padding:6px 4px;color:'+(diff.toString().indexOf('-')>-1?'var(--red)':'#4cd964')+';">'+diff+'</td>';
                    tableHtml += '<td style="padding:6px 4px;font-weight:bold;color:var(--accent);">'+pts+'</td>';
                } else {
                    tableHtml += '<td style="padding:6px 4px;">'+losses+'</td>';
                    tableHtml += '<td style="padding:6px 4px;">'+ties+'</td>';
                    tableHtml += '<td style="padding:6px 4px;">'+pf+'</td>';
                    tableHtml += '<td style="padding:6px 4px;">'+pa+'</td>';
                    tableHtml += '<td style="padding:6px 4px;color:'+(diff.toString().indexOf('-')>-1?'var(--red)':'#4cd964')+';">'+diff+'</td>';
                    tableHtml += '<td style="padding:6px 4px;font-weight:bold;color:var(--accent);">'+pts+'</td>';
                }
                tableHtml += '</tr>';
            });
            tableHtml += '</table></div>';
            if(!groupTeamFound && groupEntries.length > 0) tableHtml += '<div style="margin-top:8px;font-size:11px;color:var(--muted);">(Équipe non trouvée dans ce classement)</div>';
            tableHtml += '</div>';
        });

        contentDiv.innerHTML = tableHtml;

    }).catch(function(e) {
        contentDiv.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);background:rgba(255,255,255,0.02);border-radius:12px;">Erreur lors du chargement des données.</div>';
    });
};

import { S } from './state.js';
import { escJs, esc, lg, pad, safeStorageGetJSON, safeStorageSetJSON } from './utils.js';
import { isMatch, stringSimilarity } from './match.js';
import { globalStatsInterval } from './multiview.js';
import { fetchGameStats, renderScorersHtml, formatStatLabel, fetchLeagueStandings, fetchTeamInfo, fetchTeamSchedule } from './api.js';
import { openMod, getOriginalMatchId } from './ui.js';
import { getLogo, normName, STATIC_TEAMS } from './db.js';

/* ══ CONFIG ═════════════════════════════ */
export var SITE = 'https://www.footybite.do/';
export var MLBITE_URL = 'https://nflbite.is/'; // nflbite.is is dead, using nflbite.is as a working fallback on the same network
export var MLBBITE_PLUS_URL = 'https://mlbbite.plus';
export var SPORTSURGE_URL = 'https://v2.sportsurge.net/home5/';
export var BUFFSTREAMS_URL = 'https://buffstreams.com.co/index2';
export var STREAMEAST_URL = 'https://naturallyyou.fit/';
export var ONHOCKEY_URL = 'https://onhockey.tv/schedule_table.php';
export var VIPLEAGUE_URL = 'https://vipleague.im/top-streaming';
export var METHSTREAMS_URL = 'https://methstreams.com/';
export var TOTALSPORTEK_URL = 'https://totalsportek-real.com/';
export var STREAMONSPORT_URL = 'https://www.stremonsport.net/';
export var PROXIES = [
  function(u){ return 'https://api.allorigins.win/get?url='+encodeURIComponent(u); },
  function(u){ return 'https://api.codetabs.com/v1/proxy/?quest='+encodeURIComponent(u); },
  function(u){ return 'https://corsproxy.io/?'+encodeURIComponent(u); }
];

/* ══ COULEURS ═══════════════════════════ */


/* ══ TEAM COLORS ════════════ */








// Global to track which logos we're already fetching




// Manually add some important overrides that might not map perfectly via the simple stripping


export function toggleGlobalStats() {
    var sidebar = document.getElementById('global-stats-sidebar');
    if (sidebar.style.transform === 'translateX(0px)') {
        sidebar.style.transform = 'translateX(100%)';
    }
}

export function openGlobalStatsFromMatch(mid) {
    var m = S.matchMap.get(String(mid));
    if (!m) return;
    var sidebar = document.getElementById('global-stats-sidebar');
    sidebar.style.transform = 'translateX(0px)';
    var content = document.getElementById('gstats-content');
    var title = document.getElementById('gstats-title');
    var backBtn = document.getElementById('gstats-back-btn');

    if (globalStatsInterval) {
        clearInterval(globalStatsInterval);
        globalStatsInterval = null;
    }
    if (m.status === 'live') {
        globalStatsInterval = setInterval(function() {
            if (document.getElementById('global-stats-sidebar').style.transform === 'translateX(0px)' && document.getElementById('gstats-title').textContent.indexOf(m.homeTeam) > -1) {
                openGlobalStatsFromMatch(mid); // just call it again quietly to update
            } else {
                clearInterval(globalStatsInterval);
            }
        }, 300000);
    }

    title.textContent = m.homeTeam + ' vs ' + m.awayTeam;
    backBtn.style.display = 'none';

    content.innerHTML = '<div style="text-align:center;color:var(--muted);margin-top:20px;">Chargement des données du match...</div>';

    fetchGameStats(mid).then(function(res) {
        var html = '<div style="display:flex; flex-direction:column; gap:20px;">';

        // Enhanced The Score style header
        html += '<div style="display:flex; flex-direction:column; gap:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); padding:20px 16px; border-radius:16px;">';
        var hLogo = getLogo(m.homeTeam);
        var aLogo = getLogo(m.awayTeam);

        // Top: League & Metadata centered
        var liveBadge = m.status === 'live' ? '<span style="color:var(--red); font-weight:800; font-size:12px; margin-left:8px;">🔴 ' + (m.minute ? esc(m.minute) + "'" : 'LIVE') + '</span>' : '';
        var statusStr = m.status === 'finished' ? 'Terminé' : esc(m.startTime);
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
        html += '<span style="font-weight:700; font-size:14px; text-align:center; line-height:1.2;">'+esc(m.homeTeam)+'</span></div>';

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
        html += '<span style="font-weight:700; font-size:14px; text-align:center; line-height:1.2;">'+esc(m.awayTeam)+'</span></div>';

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
                    var statNames = {};
                    ts[0].statistics.forEach(s => statNames[s.name] = {h: s.displayValue});
                    ts[1].statistics.forEach(s => {
                        if(statNames[s.name]) statNames[s.name].a = s.displayValue;
                    });
                    for(var k in statNames) {
                        if(statNames[k].h && statNames[k].a) {
                            stats.push({label: k, h: statNames[k].h, a: statNames[k].a});
                        }
                    }
                }
            }

            if(stats.length > 0) {
                html += '<h4 style="color:#fff;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">Statistiques du match</h4>';

                var STAT_CATEGORIES = {
                    'Possession & Passes': ['possession', 'possessionTime', 'passes', 'passAccuracy'],
                    'Attaque': ['shots', 'shotsOnTarget', 'expectedGoals'],
                    'Défense': ['tackles', 'interceptions', 'clearances', 'blocks', 'saves'],
                    'Discipline & Coups de pied arrêtés': ['fouls', 'yellowCards', 'redCards', 'offsides', 'cornerKicks', 'freeKicks', 'goalKicks', 'throwIns']
                };

                var groupedStats = {};
                var usedKeys = new Set();

                for (var cat in STAT_CATEGORIES) {
                    groupedStats[cat] = [];
                    STAT_CATEGORIES[cat].forEach(function(key) {
                        var st = stats.find(function(s) { return s.label === key; });
                        if (st) {
                            groupedStats[cat].push(st);
                            usedKeys.add(key);
                        }
                    });
                }

                var autres = stats.filter(function(st) { return !usedKeys.has(st.label); });
                if (autres.length > 0) {
                    groupedStats['Autres'] = autres;
                }

                for (var cat in groupedStats) {
                    if (groupedStats[cat].length > 0) {
                        html += '<div style="margin-top:12px; margin-bottom: 4px; font-size: 11px; font-weight: 700; color: var(--muted2); text-transform: uppercase; letter-spacing: 0.5px;">' + esc(cat) + '</div>';
                        html += '<div style="display:flex;flex-direction:column;gap:12px;background:rgba(255,255,255,0.02);padding:12px;border-radius:12px;">';
                        groupedStats[cat].forEach(function(st) {
                            var formattedLabel = formatStatLabel(st.label);
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
                    }
                }
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

export function openGlobalStats(teamName) {
    var sidebar = document.getElementById('global-stats-sidebar');
    sidebar.style.transform = 'translateX(0px)';
    var content = document.getElementById('gstats-content');
    var title = document.getElementById('gstats-title');
    var backBtn = document.getElementById('gstats-back-btn');

    if (teamName) {
        title.textContent = teamName;
        backBtn.style.display = 'none';
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
  try {
    var u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch(e) {
    return url;
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
window.MLBITE_URL = MLBITE_URL;
window.MLBBITE_PLUS_URL = MLBBITE_PLUS_URL;
window.SPORTSURGE_URL = SPORTSURGE_URL;
window.BUFFSTREAMS_URL = BUFFSTREAMS_URL;
window.STREAMEAST_URL = STREAMEAST_URL;
window.ONHOCKEY_URL = ONHOCKEY_URL;
window.VIPLEAGUE_URL = VIPLEAGUE_URL;
window.METHSTREAMS_URL = METHSTREAMS_URL;
window.TOTALSPORTEK_URL = TOTALSPORTEK_URL;
window.STREAMONSPORT_URL = STREAMONSPORT_URL;
window.PROXIES = PROXIES;
window.toggleGlobalStats = toggleGlobalStats;
window.openGlobalStatsFromMatch = openGlobalStatsFromMatch;
window.openGlobalStats = openGlobalStats;
window.fetchTeamStats = fetchTeamStats;
window.estFormatter = estFormatter;
window.getEstDateStrFromDate = getEstDateStrFromDate;
window.getEstTimeStrFromDate = getEstTimeStrFromDate;
window.getDomain = getDomain;
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

import { S, favTeams, sourcesStatus, scrapeLogs } from './state.js';
import { esc, showToast, escJs, applyFilter } from './utils.js';
import { fetchGameStats, renderScorersHtml, formatStatLabel } from './api.js';
import { getOriginalMatchId, QI, QC, userPrefs, openMod, closeMod, buildEPG } from './ui.js';
import { sortFluxLinks, getDomain, openGlobalStatsFromMatch } from './config.js';
import { scrapeMatchFlux } from './scrapers.js';
import { loadAll } from './main.js';

/* ══ MULTIVISION (SPLIT SCREEN) ═════════ */

/* ══ MULTIVIEW GAME MODE ═══════════════ */
export var mvGameModeActive = false;
export var mvGameModeInterval = null;
export var gmCurrentTab = 'stats'; // 'stats' | 'scores'
export var gmPinnedMatches = JSON.parse(localStorage.getItem('gmPinnedMatches') || '[]');
export var globalStatsInterval = null;
export var currentGlobalStatsMatchId = null;
export var activeMvStatsCards = [];

export function toggleMvGameMode() {
    mvGameModeActive = !mvGameModeActive;
    var mvContainer = document.getElementById('mv-container');
    var gmBtn = document.getElementById('mv-gm-btn');

    if (mvGameModeActive) {
        if (gmBtn) {
            gmBtn.style.background = 'rgba(255,69,58,0.2)';
            gmBtn.style.borderColor = 'rgba(255,69,58,0.4)';
            gmBtn.style.color = '#fff';
        }

        // Add stats sidebar to multiview if not present
        if (!document.getElementById('mv-stats-sidebar')) {
            var statsSidebar = document.createElement('div');
            statsSidebar.id = 'mv-stats-sidebar';
            statsSidebar.style.cssText = 'width: 350px; background: rgba(20, 20, 20, 0.95); border-left: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; transition: width 0.3s;';

            var headerHtml = '<div style="display:flex; border-bottom:1px solid rgba(255,255,255,0.1); padding:0;">' +
                             '<button id="gm-tab-stats" class="gm-tab active" onclick="switchGmTab(\'stats\')" style="flex:1; background:none; border:none; color:#fff; padding:15px 0; cursor:pointer; font-weight:bold; border-bottom: 2px solid var(--accent);">Stats du Match</button>' +
                             '<button id="gm-tab-scores" class="gm-tab" onclick="switchGmTab(\'scores\')" style="flex:1; background:none; border:none; color:var(--muted); padding:15px 0; cursor:pointer; font-weight:bold; border-bottom: 2px solid transparent;">Scores Live</button>' +
                             '</div>';

            var contentHtml = '<div id="gm-content-wrapper" style="flex:1; overflow-y:auto; padding:15px;">' +
                              '<div id="mv-stats-content" style="color:var(--muted); font-size:13px; text-align:center; padding-top:20px;">Chargement...</div>' +
                              '<div id="mv-scores-content" style="display:none; color:var(--muted); font-size:13px; text-align:center; padding-top:20px;">Chargement...</div>' +
                              '</div>';

            statsSidebar.innerHTML = headerHtml + contentHtml;

            var gridWrapper = document.getElementById('mv-grid-wrapper');
            if (gridWrapper) {
                gridWrapper.appendChild(statsSidebar);
            }
        } else {
            document.getElementById('mv-stats-sidebar').style.display = 'flex';
            document.getElementById('mv-stats-sidebar').style.width = '350px';
        }

        updateGmCurrentTab();
        if (typeof mvGameModeInterval !== 'undefined' && mvGameModeInterval) clearInterval(mvGameModeInterval);
        mvGameModeInterval = setInterval(updateGmCurrentTab, 30000); // Update every 30s
    } else {
        if (gmBtn) {
            gmBtn.style.background = '';
            gmBtn.style.borderColor = '';
            gmBtn.style.color = '';
        }

        var statsSidebar = document.getElementById('mv-stats-sidebar');
        if (statsSidebar) {
            statsSidebar.style.display = 'none';
            statsSidebar.style.width = '0px';
        }

        if (mvGameModeInterval) {
            clearInterval(mvGameModeInterval);
            mvGameModeInterval = null;
        }
    }
}

export function switchGmTab(tab) {
    gmCurrentTab = tab;

    var tabStats = document.getElementById('gm-tab-stats');
    var tabScores = document.getElementById('gm-tab-scores');
    var contentStats = document.getElementById('mv-stats-content');
    var contentScores = document.getElementById('mv-scores-content');

    if (tab === 'stats') {
        if(tabStats) { tabStats.style.color = '#fff'; tabStats.style.borderBottomColor = 'var(--accent)'; }
        if(tabScores) { tabScores.style.color = 'var(--muted)'; tabScores.style.borderBottomColor = 'transparent'; }
        if(contentStats) contentStats.style.display = 'block';
        if(contentScores) contentScores.style.display = 'none';
        updateMvGameModeStats();
    } else {
        if(tabScores) { tabScores.style.color = '#fff'; tabScores.style.borderBottomColor = 'var(--accent)'; }
        if(tabStats) { tabStats.style.color = 'var(--muted)'; tabStats.style.borderBottomColor = 'transparent'; }
        if(contentScores) contentScores.style.display = 'block';
        if(contentStats) contentStats.style.display = 'none';
        updateGmScoresTab();
    }
}

export function toggleGmPinMatch(matchId, e) {
    if (e) e.stopPropagation();
    matchId = String(matchId);
    var idx = gmPinnedMatches.indexOf(matchId);
    if (idx > -1) {
        gmPinnedMatches.splice(idx, 1);
    } else {
        gmPinnedMatches.push(matchId);
    }
    localStorage.setItem('gmPinnedMatches', JSON.stringify(gmPinnedMatches));
    updateGmScoresTab();
}

export function updateGmScoresTab() {
    if (!mvGameModeActive) return;

    var content = document.getElementById('mv-scores-content');
    if (!content) return;

    var liveMatches = S.matches.filter(function(m) {
        return (m.status === 'live' || gmPinnedMatches.indexOf(String(m.id)) > -1) && m.league !== 'Autres Flux';
    });

    if (liveMatches.length === 0) {
        content.innerHTML = '<div style="padding:20px; text-align:center;">Aucun match en direct pour le moment.</div>';
        return;
    }

    // Sort: Pinned first, then by time/league
    liveMatches.sort(function(a, b) {
        var aPin = gmPinnedMatches.indexOf(String(a.id)) > -1 ? 1 : 0;
        var bPin = gmPinnedMatches.indexOf(String(b.id)) > -1 ? 1 : 0;
        if (aPin !== bPin) return bPin - aPin;
        if (a.league !== b.league) return a.league.localeCompare(b.league);
        return a.startTime.localeCompare(b.startTime);
    });

    var html = '<div style="display:flex; flex-direction:column; gap:10px;">';

    liveMatches.forEach(function(m) {
        var isPinned = gmPinnedMatches.indexOf(String(m.id)) > -1;
        var pinIcon = isPinned ? '📌' : '📍';
        var pinColor = isPinned ? 'var(--accent)' : 'var(--muted)';

        var scoreStr = m.score ? (esc(m.score[0]) + ' - ' + esc(m.score[1])) : 'À venir';
        var timeStr = (m.status === 'live' && m.minute) ? esc(m.minute) + "'" : esc(m.startTime);
        var statusColor = m.status === 'live' ? 'var(--accent)' : 'var(--muted)';

        html += '<div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:10px; display:flex; align-items:center; gap:10px;">';

        html += '<div style="flex:1;">';
        html += '<div style="font-size:11px; color:var(--muted); margin-bottom:4px;">' + esc(m.flag) + ' ' + esc(m.league) + '</div>';

        html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">';
        html += '<div style="font-size:13px; font-weight:bold; color:#fff; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(m.homeTeam) + '</div>';
        html += '<div style="font-size:14px; font-weight:bold; color:' + statusColor + '; min-width:30px; text-align:right;">' + (m.score ? esc(m.score[0]) : '-') + '</div>';
        html += '</div>';

        html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
        html += '<div style="font-size:13px; font-weight:bold; color:#fff; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(m.awayTeam) + '</div>';
        html += '<div style="font-size:14px; font-weight:bold; color:' + statusColor + '; min-width:30px; text-align:right;">' + (m.score ? esc(m.score[1]) : '-') + '</div>';
        html += '</div>';

        html += '<div style="font-size:11px; color:' + statusColor + '; margin-top:4px; text-align:right;">' + timeStr + '</div>';
        html += '</div>'; // End flex:1

        html += '<button onclick="toggleGmPinMatch(\'' + m.id + '\', event)" style="background:none; border:none; cursor:pointer; font-size:16px; color:' + pinColor + '; padding:5px; transition:transform 0.2s;" onmouseover="this.style.transform=\'scale(1.2)\'" onmouseout="this.style.transform=\'none\'" title="Épingler le match">' + pinIcon + '</button>';

        html += '</div>'; // End card
    });

    html += '</div>';
    content.innerHTML = html;
}

export function updateGmCurrentTab() {
    if (gmCurrentTab === 'stats') {
        updateMvGameModeStats();
    } else {
        updateGmScoresTab();
    }
}

export function closePinnedStats(matchId) {
    var idx = activeMvStatsCards.indexOf(String(matchId));
    if (idx > -1) {
        activeMvStatsCards.splice(idx, 1);
        updateMvGameModeStats();
    }
}

export function openPinnedStats(matchId) {
    if (!mvGameModeActive) return;
    var idx = activeMvStatsCards.indexOf(String(matchId));
    if (idx === -1) {
        activeMvStatsCards.push(String(matchId));
    }
    updateMvGameModeStats();
    setTimeout(function() {
        var container = document.getElementById('mv-stats-carousel');
        if (container) {
            container.scrollLeft = container.scrollWidth;
        }
    }, 100);
}

export function updateMvGameModeStats() {
    if (!mvGameModeActive) return;

    var content = document.getElementById('mv-stats-content');
    if (!content) return;

    var pinnedHtml = '';
    if (gmPinnedMatches.length > 0) {
        var pinnedList = S.matches.filter(function(m) { return gmPinnedMatches.indexOf(String(m.id)) > -1; });
        if (pinnedList.length > 0) {
            pinnedHtml += '<div style="margin-bottom: 15px;">';
            pinnedHtml += '<h4 style="color:#fff; margin-bottom:10px; font-size:14px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">Matchs Épinglés</h4>';
            pinnedHtml += '<div style="display:flex; flex-direction:column; gap:8px;">';
            pinnedList.forEach(function(pm) {
                var scoreStr = pm.score ? (esc(pm.score[0]) + ' - ' + esc(pm.score[1])) : 'À venir';
                var timeStr = (pm.status === 'live' && pm.minute) ? esc(pm.minute) + "'" : esc(pm.startTime);
                var statusColor = pm.status === 'live' ? 'var(--accent)' : 'var(--muted)';
                pinnedHtml += '<div onclick="openPinnedStats(\'' + pm.id + '\')" style="background:rgba(255,255,255,0.05); border-radius:8px; padding:10px; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\'">';
                pinnedHtml += '<div style="font-size:11px; color:var(--muted); margin-bottom:4px;">' + esc(pm.flag) + ' ' + esc(pm.league) + '</div>';
                pinnedHtml += '<div style="display:flex; justify-content:space-between; align-items:center;">';
                pinnedHtml += '<div style="font-size:13px; font-weight:bold; color:#fff;">' + esc(pm.homeTeam) + ' - ' + esc(pm.awayTeam) + '</div>';
                pinnedHtml += '<div style="font-size:14px; font-weight:bold; color:' + statusColor + ';">' + scoreStr + '</div>';
                pinnedHtml += '</div>';
                pinnedHtml += '<div style="font-size:11px; color:' + statusColor + '; margin-top:4px; text-align:right;">' + timeStr + '</div>';
                pinnedHtml += '</div>';
            });
            pinnedHtml += '</div></div>';
        }
    }

    var matchCardsToFetch = [];
    var mainMatchId = null;

    if (activeMvIdx !== null && activeMvIdx < mvFlux.length) {
        var activeFlux = mvFlux[activeMvIdx];
        var mainM = S.matches.find(function(x) { return String(x.id) === String(activeFlux.mid); });
        if (mainM) {
            mainMatchId = mainM.id;
            matchCardsToFetch.push(mainM);
        }
    }

    activeMvStatsCards.forEach(function(cid) {
        if (String(cid) !== String(mainMatchId)) {
            var cardM = S.matches.find(function(x) { return String(x.id) === String(cid); });
            if (cardM) {
                matchCardsToFetch.push(cardM);
            }
        }
    });

    if (matchCardsToFetch.length === 0) {
        content.innerHTML = pinnedHtml + '<div style="padding:20px; text-align:center;">Sélectionnez un match (cliquez sur un écran) pour voir les statistiques.</div>';
        return;
    }

    var carouselHtml = '<div id="mv-stats-carousel" style="display:flex; overflow-x:auto; scroll-snap-type: x mandatory; gap:15px; padding-bottom:10px; scrollbar-width: none;">';

    matchCardsToFetch.forEach(function(m) {
        var isMain = String(m.id) === String(mainMatchId);
        carouselHtml += '<div id="mv-stat-card-' + m.id + '" style="min-width: 100%; scroll-snap-align: start; flex: 0 0 100%; position:relative;">';

        if (!isMain) {
            carouselHtml += '<button onclick="closePinnedStats(\'' + m.id + '\')" style="position:absolute; top:0; right:0; background:rgba(255,255,255,0.1); border:none; border-radius:50%; width:24px; height:24px; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:10;" title="Fermer">✕</button>';
        }

        carouselHtml += '<div id="mv-gm-header-' + m.id + '" style="font-size:16px; font-weight:bold; color:#fff; text-align:center; padding: 0 25px;">' + esc(m.homeTeam) + ' vs ' + esc(m.awayTeam) + '</div>';
        carouselHtml += (m.score ? '<div style="font-size:24px; font-weight:bold; color:var(--accent); text-align:center;">' + esc(m.score[0]) + ' - ' + esc(m.score[1]) + '</div>' : '<div style="text-align:center; color:var(--muted);">À venir</div>');
        carouselHtml += '<div style="font-size:12px; color:var(--muted); text-align:center;">' + esc(m.flag) + ' ' + esc(m.league) + ' | ' + esc(m.startTime) + (m.status === 'live' && m.minute ? ' • ' + esc(m.minute) + "\'" : '') + '</div>';

        carouselHtml += '<div id="mv-stat-body-' + m.id + '"><div style="text-align:center; margin-top:20px; color:var(--muted);">Chargement des stats...</div></div>';
        carouselHtml += '</div>';
    });

    carouselHtml += '</div>';
    content.innerHTML = pinnedHtml + carouselHtml;

    // Fetch stats for all cards
    matchCardsToFetch.forEach(function(m) {
        fetchGameStats(m.id).then(function(res) {
            if (!mvGameModeActive || !res.data) return;

            var bodyEl = document.getElementById('mv-stat-body-' + m.id);
            if (!bodyEl) return;

            var html = '';
            var mHomeId = null, mAwayId = null;
            if (res.data && res.data.header && res.data.header.competitions && res.data.header.competitions[0] && res.data.header.competitions[0].competitors) {
                var c = res.data.header.competitions[0].competitors;
                var hC = c.find(function(x) { return x.homeAway === 'home'; });
                var aC = c.find(function(x) { return x.homeAway === 'away'; });
                if(hC) mHomeId = hC.id;
                if(aC) mAwayId = aC.id;
            }

            var hRankFormStr = (res.hRank ? '#' + res.hRank + ' ' : '') + (res.hForm ? '[' + res.hForm + ']' : '');
            var aRankFormStr = (res.aRank ? '#' + res.aRank + ' ' : '') + (res.aForm ? '[' + res.aForm + ']' : '');

            var hdr = document.getElementById('mv-gm-header-' + m.id);
            if (hdr && (hRankFormStr || aRankFormStr)) {
                 hdr.innerHTML = '<div style="display:flex; justify-content:space-between; font-size:11px; color:rgba(255,255,255,0.5); font-weight:normal;">' +
                                 '<span>' + esc(hRankFormStr) + '</span><span>' + esc(aRankFormStr) + '</span></div>' +
                                 '<div>' + esc(m.homeTeam) + ' vs ' + esc(m.awayTeam) + '</div>';
            }

            if (res.scorers && res.scorers.length > 0) {
                html += renderScorersHtml(res.scorers, m, mHomeId, mAwayId);
                html += '<div style="height:15px;"></div>';
            }

            var stats = [];
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
                html += '<h4 style="color:#fff;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">Statistiques</h4>';
                html += '<div style="display:flex;flex-direction:column;gap:8px;background:rgba(255,255,255,0.02);padding:10px;border-radius:12px;">';
                stats.forEach(function(st) {
                    var label = formatStatLabel(st.label);
                    html += '<div style="display:flex;justify-content:space-between;font-size:12px;align-items:center;">';
                    html += '<span style="font-weight:bold;width:30px;text-align:right;">'+esc(st.h)+'</span>';
                    html += '<span style="color:var(--muted);flex:1;text-align:center;">'+esc(label)+'</span>';
                    html += '<span style="font-weight:bold;width:30px;text-align:left;">'+esc(st.a)+'</span>';
                    html += '</div>';
                });
                html += '</div>';
            }

            bodyEl.innerHTML = html ? '<div style="margin-top:15px;">' + html + '</div>' : '<div style="margin-top:15px; color:var(--muted); text-align:center;">Aucune statistique détaillée disponible.</div>';
        }).catch(function() {
            var bodyEl = document.getElementById('mv-stat-body-' + m.id);
            if (bodyEl) bodyEl.innerHTML = '<div style="margin-top:15px; color:var(--muted); text-align:center;">Erreur lors du chargement des statistiques.</div>';
        });
    });
}

export var mvFlux = [];


/* ══ MULTIVISION STREAM SELECTOR ════════ */
export function showFluxSelector(idx, mid, event) {
    mid = getOriginalMatchId(mid);
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    var m = S.matches.find(function(x) { return String(x.id) === String(mid); });

    var existing = document.getElementById('mv-flux-selector');
    if (existing) existing.remove();

    var selector = document.createElement('div');
    selector.id = 'mv-flux-selector';
    selector.style.cssText = 'position:fixed;z-index:9999;background:rgba(20,20,20,0.95);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:16px;backdrop-filter:blur(15px);display:flex;flex-direction:column;gap:16px;max-height:80vh;overflow-y:auto;box-shadow:0 15px 40px rgba(0,0,0,0.8);width:90%;max-width:360px;top:50%;left:50%;transform:translate(-50%, -50%);';

    // Add close button for mobile
    var closeBtn = document.createElement('div');
    closeBtn.innerHTML = '<span class="ic ic-close"></span>';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border-radius:50%;cursor:pointer;color:#fff;font-size:14px;';
    closeBtn.onclick = function() { selector.remove(); };
    selector.appendChild(closeBtn);

    // Section 1: Alternative Flux for current match
    if (m && m.streamLinks && m.streamLinks.length > 0) {
        var titleFlux = document.createElement('div');
        titleFlux.style.cssText = 'font-size:11px;font-weight:bold;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;';
        titleFlux.textContent = 'Sources pour ce match';
        selector.appendChild(titleFlux);

        var streamsContainer = document.createElement('div');
        streamsContainer.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

        var sortedLinks = sortFluxLinks(m.streamLinks);
        sortedLinks.forEach(function(s) {
            var dom = getDomain(s.url);
            var isActive = mvFlux[idx].url === s.url;

            var btn = document.createElement('div');
            btn.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px;min-height:44px;border-radius:8px;cursor:pointer;transition:all 0.2s;background:' + (isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)') + ';border:1px solid ' + (isActive ? 'rgba(255,255,255,0.3)' : 'transparent') + ';';

            btn.onmouseenter = function() { if(!isActive) this.style.background = 'rgba(255,255,255,0.1)'; };
            btn.onmouseleave = function() { if(!isActive) this.style.background = 'rgba(255,255,255,0.05)'; };

            btn.onclick = function(e) {
                e.stopPropagation();
                if(!isActive) {
                    mvFlux[idx].url = s.url;
                    // name and mid stays the same
                    saveMultivisionState(); updateMultivisionLayout();
                }
                selector.remove();
            };

            btn.innerHTML = '<div style="font-size:16px;">' + (s.icon||QI[s.quality]||'📺') + '</div>' +
                            '<div style="flex:1;overflow:hidden;">' +
                            '<div style="font-size:13px;font-weight:bold;color:#fff;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">' + esc(s.name) + '</div>' +
                            '<div style="font-size:11px;color:var(--muted);">' + esc(dom) + '</div>' +
                            '</div>' +
                            (isActive ? '<div style="font-size:9px;background:var(--accent);color:#fff;padding:2px 4px;border-radius:4px;font-weight:bold;margin-right:4px;">ACTIF</div>' : '') +
                            '<span class="sbadge ' + (QC[s.quality]||'bSD') + '" style="font-size:9px;padding:2px 4px;">' + (s.quality||'SD') + '</span>';

            streamsContainer.appendChild(btn);
        });
        selector.appendChild(streamsContainer);
    }

    // Section 2: Other Live Matches
    var titleMatches = document.createElement('div');
    titleMatches.style.cssText = 'font-size:11px;font-weight:bold;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;margin-top:8px;';
    titleMatches.textContent = 'Remplacer par un autre match';
    selector.appendChild(titleMatches);

    var matchesContainer = document.createElement('div');
    matchesContainer.style.cssText = 'display:flex;flex-direction:column;gap:6px;';


    var availableMatches = S.matches.filter(function(x) {
        return x.streamsLoaded && x.streamLinks && x.streamLinks.length > 0 && String(x.id) !== String(mid);
    });

    availableMatches.sort(function(a, b) {
        var f1 = (favTeams[a.homeTeam] || favTeams[a.awayTeam]) ? -1 : 0;
        var f2 = (favTeams[b.homeTeam] || favTeams[b.awayTeam]) ? -1 : 0;
        if (f1 !== f2) return f1 - f2;

        if (a.status === 'live' && b.status !== 'live') return -1;
        if (a.status !== 'live' && b.status === 'live') return 1;
        return a.startTime.localeCompare(b.startTime);
    });


    if (availableMatches.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 'padding:10px;text-align:center;color:var(--muted);font-size:12px;background:rgba(255,255,255,0.02);border-radius:8px;';
        empty.innerHTML = 'Aucun autre match avec flux disponible.';
        matchesContainer.appendChild(empty);
    } else {
        availableMatches.forEach(function(sm) {
            // Already in multiview?
            var alreadyIn = mvFlux.some(function(ms) { return String(ms.mid) === String(sm.id); });

            var btn = document.createElement('div');
            btn.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px;min-height:44px;border-radius:8px;cursor:pointer;transition:all 0.2s;background:rgba(255,255,255,0.05);' + (alreadyIn ? 'opacity:0.5;pointer-events:none;' : '');

            btn.onmouseenter = function() { if(!alreadyIn) this.style.background = 'rgba(255,255,255,0.1)'; };
            btn.onmouseleave = function() { if(!alreadyIn) this.style.background = 'rgba(255,255,255,0.05)'; };

            var thumb = '<div style="width:36px; height:36px; border-radius:4px; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; font-size:16px;">' + (sm.flag || '⚽') + '</div>';
            if(sm.homeLogo) {
                thumb = '<div style="width:36px; height:36px; border-radius:4px; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; overflow:hidden; padding:2px;flex-shrink:0;">'
                  +'<img src="'+esc(sm.homeLogo)+'" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.style.display=\\\'none\\\'">'
                +'</div>';
            }

            var score = sm.score ? '<div style="font-size:13px; font-weight:bold; color:var(--accent); display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px;flex-shrink:0;"><span>'+esc(sm.score[0])+'</span><span>'+esc(sm.score[1])+'</span></div>' : '';

            btn.innerHTML = thumb +
                '<div style="flex:1; overflow:hidden;">' +
                    '<div style="font-size:10px; color:var(--red); font-weight:bold; margin-bottom:2px;">🔴 '+(sm.minute?esc(sm.minute)+"'":'EN DIRECT')+' <span style="color:var(--muted); font-weight:normal; margin-left:4px;">'+esc(sm.flag)+' '+esc(sm.league)+'</span></div>' +
                    '<div style="font-size:12px; font-weight:bold; color:#fff; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">'+esc(sm.homeTeam)+'</div>' +
                    '<div style="font-size:12px; font-weight:bold; color:#fff; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">'+esc(sm.awayTeam)+'</div>' +
                '</div>' + score + (alreadyIn ? '<div style="font-size:10px;background:rgba(255,255,255,0.2);color:#fff;padding:2px 4px;border-radius:4px;margin-left:4px;">AJOUTÉ</div>' : '');

            btn.onclick = function(e) {
                e.stopPropagation();
                if(sm.streamsLoaded && sm.streamLinks && sm.streamLinks.length > 0) {
                    var sortedSmLinks = sortFluxLinks(sm.streamLinks);
                    mvFlux[idx].url = sortedSmLinks[0].url;
                    mvFlux[idx].name = sm.homeTeam + ' vs ' + sm.awayTeam;
                    mvFlux[idx].mid = sm.id;
                    saveMultivisionState(); updateMultivisionLayout();
                    selector.remove();
                } else {
                    // Si pas chargé
                    showToast('Chargement des streams...');
                    scrapeMatchFlux(sm).then(function() {
                        sm.streamsLoaded = true;
                        if(sm.streamLinks && sm.streamLinks.length > 0) {
                            var sortedSmLinks = sortFluxLinks(sm.streamLinks);
                            mvFlux[idx].url = sortedSmLinks[0].url;
                            mvFlux[idx].name = sm.homeTeam + ' vs ' + sm.awayTeam;
                            mvFlux[idx].mid = sm.id;
                            saveMultivisionState(); updateMultivisionLayout();
                        } else {
                            showToast('Aucun flux trouvé pour ce match.');
                        }
                        selector.remove();
                    }).catch(function() {
                        showToast('Erreur lors du chargement des streams.');
                        selector.remove();
                    });
                }
            };

            matchesContainer.appendChild(btn);
        });
    }
    selector.appendChild(matchesContainer);

    document.body.appendChild(selector);

    // Close on outside click
    setTimeout(function() {
        var closeListener = function(e) {
            if (!selector.contains(e.target)) {
                selector.remove();
                document.removeEventListener('click', closeListener);
            }
        };
        document.addEventListener('click', closeListener);
    }, 10);
}







/* ══ MULTIVISION MATCH SELECTOR ════════ */
export function showMatchSelector(event, replaceIdx) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    var isReplace = replaceIdx !== undefined;

    window.multiviewPendingAction = {
        type: isReplace ? 'replace' : 'add',
        replaceIdx: replaceIdx
    };

    var mvc = document.getElementById('mv-container');
    if (mvc && !mvc.classList.contains('mv-pip') && mvc.style.display !== 'none') {
        toggleMultiviewPip();
    }

    applyFilter('live');

    // Show a toast to instruct the user
    showToast(isReplace ? 'Sélectionnez un match en direct pour remplacer' : 'Sélectionnez un match en direct pour ajouter');
}


export function toggleMultiviewPip() {
    var mvc = document.getElementById('mv-container');
    var epg = document.getElementById('epg');
    if(!mvc || !epg) return;

    if(mvc.classList.contains('mv-pip')) {
        // Restore to full screen multiview
        mvc.classList.remove('mv-pip');
        mvc.style.cssText = 'position:fixed;top:' + (window.innerWidth <= 768 ? '0' : 'var(--hdr-height, 70px)') + ';left:0;right:0;bottom:' + (window.innerWidth <= 768 ? '60px' : '0') + ';background:transparent;z-index:90;display:flex;flex-direction:column;';
        epg.style.display = 'none';
        epg.style.paddingRight = '0';
        var sf = document.getElementById('sport-filters-container');
        if(sf) sf.style.display = 'none';

        var optionsPage = document.getElementById('options-page');
        if (optionsPage) optionsPage.style.display = 'none';
        var logsPage = document.getElementById('logs-page');
        if (logsPage) logsPage.style.display = 'none';
        var scriptPage = document.getElementById('script-page');
        if (scriptPage) scriptPage.style.display = 'none';

        updateMultivisionLayout();
    } else {
        // Switch to PIP mode
        mvc.classList.add('mv-pip');

        var isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // On mobile, completely hide it in the background
            mvc.style.cssText = 'display:none;';
            epg.style.display = 'flex';
            epg.style.paddingRight = '0';
            var sf = document.getElementById('sport-filters-container');
            if(sf) sf.style.display = 'flex';
        } else {
            // On tablet/desktop, show column
            mvc.style.cssText = 'position:fixed;right:20px;bottom:20px;width:350px;max-height:500px;background:rgba(0,0,0,0.9);backdrop-filter:blur(10px);z-index:999;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,0.1);box-shadow:0 10px 30px rgba(0,0,0,0.8);border-radius:12px;overflow:hidden;';
            epg.style.display = 'flex';
            epg.style.paddingRight = '0';
            var sf = document.getElementById('sport-filters-container');
            if(sf) sf.style.display = 'flex';

            // Note: The vertical stack layout logic is now handled entirely within updateMultivisionLayout
            updateMultivisionLayout();
        }
    }
}

// Ensure resize events also apply the correct PIP mode styling if resizing while in PIP
window.addEventListener('resize', function() {
    var mvc = document.getElementById('mv-container');
    if (mvc && !mvc.classList.contains('mv-pip') && mvc.style.display !== 'none') {
        mvc.style.bottom = (window.innerWidth <= 768 ? '60px' : '0');
    }

    var epg = document.getElementById('epg');
    if(mvc && mvc.classList.contains('mv-pip')) {
        if(window.innerWidth <= 768) {
            mvc.style.display = 'none';
            if(epg) epg.style.paddingRight = '0';
        } else {
            mvc.style.display = 'flex';
            if(epg) epg.style.paddingRight = '350px';
        }
    }

    if (mvc && mvc.style.display !== 'none' && !mvc.classList.contains('mv-pip')) {
        if (window.innerHeight > window.innerWidth && mvLayout !== 'vertical' && mvFlux.length > 0) {
            mvLayout = 'vertical';
            saveMultivisionState();
            updateMultivisionLayout();
        }
    }
});



export function setupMultivisionUI() {
    if(document.getElementById('mv-container')) return;

    // Create Multivision Container
    var mvContainer = document.createElement('div');
    mvContainer.id = 'mv-container';
    mvContainer.style.cssText = 'position:fixed;top:' + (window.innerWidth <= 768 ? '0' : 'var(--hdr-height, 70px)') + ';left:0;right:0;bottom:' + (window.innerWidth <= 768 ? '60px' : '0') + ';background:transparent;z-index:90;display:none;flex-direction:column;';

    var mvToolbar = document.createElement('div');
    mvToolbar.id = 'mv-toolbar';
    mvToolbar.style.cssText = 'position:relative;min-height:40px;background:var(--bg2);display:flex;align-items:center;padding:8px 16px;gap:12px;border-bottom:1px solid var(--border);flex-shrink:0; transition:all 0.3s; flex-wrap:wrap;';
    var mvToolbarHtml = '<span style="font-weight:bold;color:var(--text);"><span class="hide-pip hide-mobile">Mode </span>Multivision</span>'
      + '<div class="sp" style="flex:1;"></div>'
      + '<button class="nav-btn" onclick="document.getElementById(\'mv-actions-menu\').classList.toggle(\'open\'); event.stopPropagation();" style="padding: 8px; display:none; font-size: 18px; border-radius: 8px;" id="mv-menu-btn">☰</button>'
      + '<div id="mv-actions-menu" class="mv-actions" style="display:flex; gap:8px; align-items:center;">'
      + '<button class="nav-btn" onclick="showMatchSelector(event)" aria-label="Ajouter un match" title="Ajouter un match" style="padding: 8px; min-width: auto; font-size: 16px;">➕</button>'
      + '<div style="position:relative; display:flex; align-items:center;" class="hide-pip">'
      +   '<button id="mv-layout-toggle-btn" class="nav-btn" onclick="var d=document.getElementById(\'mv-layout-dropdown\'); d.style.display = d.style.display === \'flex\' ? \'none\' : \'flex\'; event.stopPropagation();" aria-label="Choisir la disposition" title="Layouts" style="padding: 8px; min-width: auto; font-size: 16px;">⊞</button>'
      +   '<div id="mv-layout-dropdown" style="display:none; position:absolute; top:100%; right:0; background:var(--bg2); border:1px solid var(--border); border-radius:8px; padding:4px; z-index:100; flex-direction:column; gap:4px; margin-top:4px; min-width:130px;">'
      +     '<button class="nav-btn mv-layout-btn" onclick="setMvLayout(\'auto\'); saveMultivisionState(); updateMultivisionLayout(); document.getElementById(\'mv-layout-dropdown\').style.display=\'none\';" data-layout="auto" aria-label="Auto Layout" title="Auto Layout" style="padding: 8px; font-size: 14px; text-align:left; display:flex; gap:8px;"><span>⊞</span> Auto</button>'
      +     '<button class="nav-btn mv-layout-btn" onclick="setMvLayout(\'focus\'); saveMultivisionState(); updateMultivisionLayout(); document.getElementById(\'mv-layout-dropdown\').style.display=\'none\';" data-layout="focus" aria-label="Focus Layout" title="Focus Layout" style="padding: 8px; font-size: 14px; text-align:left; display:flex; gap:8px;"><span>⭐</span> Focus</button>'
      +     '<button class="nav-btn mv-layout-btn" onclick="setMvLayout(\'vertical\'); saveMultivisionState(); updateMultivisionLayout(); document.getElementById(\'mv-layout-dropdown\').style.display=\'none\';" data-layout="vertical" aria-label="Vertical Layout" title="Vertical Layout" style="padding: 8px; font-size: 14px; text-align:left; display:flex; gap:8px;"><span>⊟</span> Vertical</button>'
      +     '<button class="nav-btn mv-layout-btn" onclick="setMvLayout(\'horizontal\'); saveMultivisionState(); updateMultivisionLayout(); document.getElementById(\'mv-layout-dropdown\').style.display=\'none\';" data-layout="horizontal" aria-label="Horizontal Layout" title="Horizontal Layout" style="padding: 8px; font-size: 14px; text-align:left; display:flex; gap:8px;"><span>⊟</span> Horizontal</button>'
      +   '</div>'
      + '</div>'
      + '<button class="nav-btn hide-pip" onclick="toggleTheaterMode(document.getElementById(\'mv-grid-wrapper\'))" aria-label="Mode Cinéma" title="Mode Cinéma" style="padding: 8px; min-width: auto; font-size: 16px;">🎬</button>'
      + '<button class="nav-btn hide-pip" onclick="toggleFullscreen(document.getElementById(\'mv-grid-wrapper\'))" aria-label="Plein écran" title="Plein écran" style="padding: 8px; min-width: auto; font-size: 16px;">⛶</button>'
      + '<button class="nav-btn hide-pip" id="mv-gm-btn" onclick="toggleMvGameMode()" aria-label="Game Mode" title="Game Mode" style="padding: 8px; min-width: auto; font-size: 16px;">📊</button>'
      + '<button class="nav-btn" onclick="hideMultivision()" aria-label="Fermer le Multivision" title="Fermer le Multivision" style="padding: 8px; min-width: auto; font-size: 16px;">❌</button>'
      + '<button class="nav-btn" onclick="clearMultivision()" aria-label="Tout vider" title="Tout vider" style="padding: 8px; min-width: auto; font-size: 16px;">🗑️</button>'
      + '</div>';

    mvToolbar.innerHTML = mvToolbarHtml;

    var mvGridWrapper = document.createElement('div');
    mvGridWrapper.id = 'mv-grid-wrapper';
    mvGridWrapper.style.cssText = 'display:flex; flex:1; width:100%; overflow:hidden; background:transparent;';

    var mvGrid = document.createElement('div');
    mvGrid.id = 'mv-grid';
    mvGrid.style.cssText = 'flex:1;display:grid;gap:2px;background:transparent;';

    mvGridWrapper.appendChild(mvGrid);

    var exitTheaterBtn = document.createElement('button');
    exitTheaterBtn.id = 'mv-exit-theater';
    exitTheaterBtn.innerHTML = 'Quitter le Plein Onglet';
    exitTheaterBtn.style.cssText = 'position:absolute;top:20px;left:50%;transform:translateX(-50%);z-index:999;background:rgba(0,0,0,0.8);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:8px 16px;cursor:pointer;display:none;backdrop-filter:blur(5px);font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.5);opacity:0;transition:opacity 0.3s;';

    setInterval(applyMvAudioState, 2000);

    window.addEventListener('message', function(e) {
        if (e.data === 'mv_frame_clicked') {
            mvFlux.forEach(function(s, idx) {
                var iframe = document.getElementById('mv-iframe-' + idx);
                if (iframe && iframe.contentWindow === e.source) {
                    focusStream(idx);
                }
            });
        }
    });

    window.addEventListener('blur', function() {
        setTimeout(function() {
            var activeElement = document.activeElement;
            if (activeElement && activeElement.tagName === 'IFRAME' && activeElement.classList.contains('mv-iframe')) {
                var idx = parseInt(activeElement.id.replace('mv-iframe-', ''));
                if (!isNaN(idx)) {
                    focusStream(idx);
                }
            }
        }, 100);
    });

    // Auto-hide the exit theater button after 3 seconds
    var theaterTimeout;
    mvContainer.addEventListener('mousemove', function() {
        if (mvContainer.classList.contains('theater-mode')) {
            exitTheaterBtn.style.opacity = '1';
            clearTimeout(theaterTimeout);
            theaterTimeout = setTimeout(function() {
                exitTheaterBtn.style.opacity = '0';
            }, 3000);
        }
    });

    exitTheaterBtn.onclick = function() { toggleTheaterMode(document.getElementById('mv-grid-wrapper')); };

    mvContainer.appendChild(mvToolbar);
    mvContainer.appendChild(mvGridWrapper);
    mvContainer.appendChild(exitTheaterBtn);
    document.body.appendChild(mvContainer); restoreMultivisionState();

window.mvIdleTimer = null;
window.resetMvIdleTimer = function() {
        var tb = document.getElementById('mv-toolbar');
        if (tb) { tb.style.opacity = '1'; tb.style.pointerEvents = 'auto'; }
        mvContainer.style.cursor = 'default';

        var hdrs = mvContainer.querySelectorAll('.mv-hdr');
        hdrs.forEach(function(h) { h.style.opacity = '1'; h.style.pointerEvents = 'auto'; });

        var overlays = mvContainer.querySelectorAll('.mv-idle-overlay');
        overlays.forEach(function(o) { o.style.display = 'none'; });

        clearTimeout(window.mvIdleTimer);
        window.mvIdleTimer = setTimeout(function() {
            var mvc = document.getElementById('mv-container');
            if (mvc && !mvc.classList.contains('mv-pip')) {
                var tb = document.getElementById('mv-toolbar');
                if (tb) { tb.style.opacity = '0'; tb.style.pointerEvents = 'none'; }
                mvc.style.cursor = 'none';

                var latestHdrs = mvc.querySelectorAll('.mv-hdr');
                latestHdrs.forEach(function(h) { h.style.opacity = '0'; h.style.pointerEvents = 'none'; });

                var latestOverlays = mvc.querySelectorAll('.mv-idle-overlay');
                latestOverlays.forEach(function(o) { o.style.display = 'block'; o.style.pointerEvents = 'auto'; });
            }
        }, 3000);
    }

    mvContainer.addEventListener('mousemove', window.resetMvIdleTimer);
    mvContainer.addEventListener('click', window.resetMvIdleTimer);
    mvContainer.addEventListener('touchstart', window.resetMvIdleTimer, {passive: true});

}



export function moveMultiviewStream(idx, direction) {
    if (idx < 0 || idx >= mvFlux.length) return;

    var targetIdx;
    if (direction === 'left' || direction === 'up') {
        targetIdx = idx - 1;
    } else if (direction === 'right' || direction === 'down') {
        targetIdx = idx + 1;
    }

    if (targetIdx < 0 || targetIdx >= mvFlux.length) return;

    // Swap the elements in the array
    var temp = mvFlux[idx];
    mvFlux[idx] = mvFlux[targetIdx];
    mvFlux[targetIdx] = temp;

    saveMultivisionState();
    updateMultivisionLayout();
}

/* ══ PERSISTENCE MULTIVISION ═══════════ */
export function saveMultivisionState() {
    try {
        localStorage.setItem('mv_state', JSON.stringify({
            flux: mvFlux,
            layout: mvLayout
        }));
    } catch(e) {}
}

export function restoreMultivisionState() {
    try {
        var saved = localStorage.getItem('mv_state');
        if(saved) {
            var parsed = JSON.parse(saved);

            // Backward compatibility with just array
            if(Array.isArray(parsed) && parsed.length > 0) {
                mvFlux = parsed;
                setTimeout(function() {
                    updateMultivisionLayout();
                }, 500);
            } else if (parsed && parsed.flux && Array.isArray(parsed.flux)) {
                mvFlux = parsed.flux;
                if (parsed.layout) mvLayout = parsed.layout;
                setTimeout(function() {
                    updateMultivisionLayout();
                }, 500);
            }
        }
    } catch(e) {}
}

// Layout state
export var mvLayout = 'auto'; // auto, focus, vertical, horizontal, custom

export function setMvLayout(l) {
    mvLayout = l;
    window.mvLayout = l;
}
export var activeMvIdx = null;

export function focusStream(idx) {
    if (idx < 0 || idx >= mvFlux.length) return;

    // Auto swap if in focus mode and clicking on a non-focus item
    if (mvLayout === 'focus' && idx !== 0) {
        var temp = mvFlux[0];
        mvFlux[0] = mvFlux[idx];
        mvFlux[idx] = temp;
        activeMvIdx = 0; // Focus always moves to main slot
        saveMultivisionState();
        updateMultivisionLayout();
    } else {
        activeMvIdx = idx;
        applyMvFocusStyling();
        applyMvAudioState();
    }

    if (typeof updateMvGameModeStats === 'function') {
        updateMvGameModeStats();
    }
}

export function applyMvFocusStyling() {
    var cells = document.querySelectorAll('.mv-cell');
    cells.forEach(function(cell) {
        var idx = parseInt(cell.dataset.index);
        if (idx === activeMvIdx) {
            cell.style.boxShadow = 'inset 0 0 0 2px rgba(150, 150, 150, 0.6)';
        } else {
            cell.style.boxShadow = 'none';
        }
    });
}

export function applyMvAudioState() {
    // Determine which stream should be unmuted.
    // If activeMvIdx is null or out of bounds, unmute the first one (0) or default logic.
    var targetIdx = activeMvIdx !== null && activeMvIdx < mvFlux.length ? activeMvIdx : (mvFlux.length > 0 ? 0 : null);

    mvFlux.forEach(function(s, idx) {
        var iframe = document.getElementById('mv-iframe-' + idx);
        if (iframe && iframe.contentWindow) {
            if (idx === targetIdx) {
                iframe.contentWindow.postMessage('mv_unmute', '*');
            } else {
                iframe.contentWindow.postMessage('mv_mute', '*');
            }
        }
    });
}


export function updateMultivisionLayout() {
    document.querySelectorAll('.mv-layout-btn').forEach(function(btn) {
        if(btn.getAttribute('data-layout') === mvLayout) {
            btn.classList.add('active-toggle');
        } else {
            btn.classList.remove('active-toggle');
        }
    });

    // Update toggle button icon to reflect active layout
    var icons = { 'auto': '⊞', 'focus': '⭐', 'vertical': '⊟', 'horizontal': '⊟' };
    var toggleBtn = document.getElementById('mv-layout-toggle-btn');
    if (toggleBtn && icons[mvLayout]) {
        toggleBtn.innerHTML = icons[mvLayout];
    }

    var grid = document.getElementById('mv-grid');
    if(!grid) return;

    var count = mvFlux.length;

    // Assign internal IDs to streams for tracking DOM elements
    mvFlux.forEach(function(s, idx) {
        if (!s._internalId) s._internalId = 'mv-flux-' + Date.now() + '-' + idx;
    });

    // Remove old empty message if any
    var emptyMsg = document.getElementById('mv-empty-msg');
    if(count === 0) {
        if (!emptyMsg) {
            grid.innerHTML = '<div id="mv-empty-msg" style="display:flex;align-items:center;justify-content:center;color:var(--muted);height:100%;">Ajoutez des matchs depuis la modale pour utiliser le Multivision.</div>';
        } else {
            // keep it
            var children = Array.from(grid.children);
            children.forEach(function(child) {
                if (child.id !== 'mv-empty-msg') {
                    grid.removeChild(child);
                }
            });
        }
        return;
    } else if (emptyMsg) {
        emptyMsg.remove();
    }

    var mvc = document.getElementById('mv-container');

    // Ensure we track custom column widths
    if (!grid._customCols) grid._customCols = {};

    // Reset grid styles before applying layout
    grid.style.display = 'grid';
    grid.style.flexWrap = '';
    grid.style.flexDirection = '';
    grid.style.overflowAuto = '';
    grid.style.alignContent = '';

    if (mvc) {
        if (mvc.classList.contains('mv-pip')) {
            // Always force vertical layout in PiP mode
            grid.style.gridTemplateColumns = '1fr';
            grid.style.gridTemplateRows = 'repeat(' + Math.max(1, count) + ', 1fr)';
        } else {
            if (mvLayout === 'focus' && count >= 2) {
                var col1 = grid._customCols[0] ? grid._customCols[0] + 'fr' : '3fr';
                var col2 = grid._customCols[0] ? (1 - grid._customCols[0]).toFixed(3) + 'fr' : '1fr';
                grid.style.gridTemplateColumns = col1 + ' ' + col2;
                grid.style.gridTemplateRows = 'repeat(' + (count - 1) + ', 1fr)';
            } else if (mvLayout === 'vertical') {
                grid.style.gridTemplateColumns = '1fr';
                grid.style.gridTemplateRows = 'repeat(' + count + ', 1fr)';
            } else if (mvLayout === 'horizontal') {
                var template = '';
                var usedFr = 0;
                var remainingCols = count - Object.keys(grid._customCols).length;
                for (var c in grid._customCols) usedFr += parseFloat(grid._customCols[c]);
                var remainingFr = 1 - usedFr;

                for (var i = 0; i < count; i++) {
                    template += (grid._customCols[i] ? grid._customCols[i] + 'fr ' : (remainingCols > 0 ? (remainingFr / remainingCols).toFixed(3) : 0) + 'fr ');
                }
                grid.style.gridTemplateColumns = template.trim();
                grid.style.gridTemplateRows = '1fr';
            } else {
                // auto / Grid Mode Layout
                if(count === 1) {
                    grid.style.gridTemplateColumns = '1fr';
                    grid.style.gridTemplateRows = '1fr';
                } else if(count === 2) {
                    var col1 = grid._customCols[0] ? grid._customCols[0] + 'fr' : '1fr';
                    var col2 = grid._customCols[0] ? (1 - grid._customCols[0]).toFixed(3) + 'fr' : '1fr';
                    grid.style.gridTemplateColumns = col1 + ' ' + col2;
                    grid.style.gridTemplateRows = '1fr';
                } else if(count === 3) {
                    var col1 = grid._customCols[0] ? grid._customCols[0] + 'fr' : '1fr';
                    var col2 = grid._customCols[0] ? (1 - grid._customCols[0]).toFixed(3) + 'fr' : '1fr';
                    grid.style.gridTemplateColumns = col1 + ' ' + col2;
                    grid.style.gridTemplateRows = '1fr 1fr';
                } else if(count >= 4) {
                    var col1 = grid._customCols[0] ? grid._customCols[0] + 'fr' : '1fr';
                    var col2 = grid._customCols[0] ? (1 - grid._customCols[0]).toFixed(3) + 'fr' : '1fr';
                    grid.style.gridTemplateColumns = col1 + ' ' + col2;
                    grid.style.gridTemplateRows = '1fr 1fr';
                }
            }
        }
    }    // Existing cells
    var existingCells = Array.from(grid.children).filter(function(child) {
        return child.hasAttribute('data-internal-id');
    });

    // Create or update cells
    mvFlux.forEach(function(s, idx) {
        var cellId = s._internalId;
        var cellClass = 'mv-cell';
        var cell = existingCells.find(function(c) { return c.getAttribute('data-internal-id') === cellId; });

        if (!cell) {
            cell = document.createElement('div');
            cell.setAttribute('data-internal-id', cellId);
            cell.classList.add('mv-cell');
            cell.dataset.index = idx;
            cell.style.cssText = 'position:relative;background:#111;display:flex;flex-direction:column;cursor:default;overflow:hidden;resize:both;';

            var hdr = document.createElement('div');
            hdr.className = 'mv-hdr';
            hdr.style.cssText = 'position:absolute;top:0;left:0;right:0;background:linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%);color:#fff;padding:8px 12px;font-size:12px;display:flex;justify-content:space-between;align-items:center;z-index:10;pointer-events:none;';

            var videoContainer = document.createElement('div');
            videoContainer.className = 'mv-video-container';
            videoContainer.style.cssText = 'flex:1;position:relative;width:100%;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:transparent;';

            var overlay = document.createElement('div');
            overlay.className = 'mv-idle-overlay';
            overlay.style.cssText = 'position:absolute;inset:0;z-index:5;display:none;';

            cell.appendChild(hdr);
            cell.appendChild(videoContainer);
            cell.appendChild(overlay);
            grid.appendChild(cell);

            overlay.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                window.resetMvIdleTimer();
            });
            overlay.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                window.resetMvIdleTimer();
            }, {passive: true});

            fallbackToIframe(s.url, videoContainer, cell, s);
        }

        // Helper function for fallback
        function fallbackToIframe(url, container, cell, s) {
            container.innerHTML = '';
            var iframe = document.createElement('iframe');
            iframe.className = 'mv-media mv-iframe';
            iframe.style.cssText = 'width:100%;height:100%;border:none;pointer-events:auto;transition:transform 0.2s;';
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('allow', 'fullscreen; autoplay; presentation');
            iframe.src = url;
            container.appendChild(iframe);
            cell.addEventListener('mousedown', function() { iframe.style.pointerEvents = 'none'; });
            cell.addEventListener('mouseup', function() { iframe.style.pointerEvents = 'auto'; });
            cell.addEventListener('mouseleave', function() { iframe.style.pointerEvents = 'auto'; });
            s._currentUrl = url;

            if (s.cropped) {
                iframe.style.transform = 'scale(1.15)';
            } else {
                iframe.style.transform = 'scale(1)';
            }
        }

        // Use CSS flex/grid order to reorder elements without removing them from the DOM
        cell.style.order = idx;

        cell.dataset.index = idx;


        // Update styling/gridRow
        if (!document.getElementById('mv-container').classList.contains('mv-pip')) {
            cell.style.width = '100%';
            cell.style.height = '100%';
            // Enable horizontal resize only on elements that represent a column boundary
            cell.style.resize = 'horizontal';
            cell.style.overflow = 'hidden';

            var colIndex = 0;


            if (mvLayout === 'focus' && count >= 2) {
                if (idx === 0) {
                    cell.style.gridRow = 'span ' + (count - 1);
                    cell.style.gridColumn = '1';
                    colIndex = 0;
                } else {
                    cell.style.gridRow = 'auto';
                    cell.style.gridColumn = '2';
                    colIndex = 1;
                    cell.style.resize = 'none'; // Only resize main focus col
                }
            } else if (mvLayout === 'auto' && count === 3 && idx === 0) {
                cell.style.gridRow = 'span 2';
                cell.style.gridColumn = '1'; // Force column 1
                colIndex = 0;
            } else {
                cell.style.gridRow = 'auto';

                if (mvLayout === 'horizontal') {
                    cell.style.gridColumn = 'auto';
                    colIndex = idx;
                    if (idx === count - 1) cell.style.resize = 'none'; // No need to resize last col
                } else if (mvLayout === 'vertical') {
                    cell.style.gridColumn = '1';
                    colIndex = 0;
                    cell.style.resize = 'none'; // Only one column, no horizontal resizing
                } else {
                    // Standard auto mode (usually 2 cols)
                    if (count === 3) {
                        cell.style.gridColumn = '2';
                        colIndex = 1;
                    } else {
                        colIndex = (idx % 2 === 0) ? 0 : 1;
                        cell.style.gridColumn = 'auto';
                    }
                    if (colIndex === 1 || count === 1) cell.style.resize = 'none';
                }
            }
            // Assign col index for tracking
            cell.dataset.col = colIndex.toString();

            // Reset inline width from previous resizes so CSS Grid takes over
            cell.style.width = '';

            // Attach observer to detect resizing and update the grid template
            if (!cell._hasResizeObserver && cell.style.resize !== 'none') {
                cell._hasResizeObserver = new ResizeObserver(function(entries) {
                    var isPip = document.getElementById('mv-container').classList.contains('mv-pip');
                    if (isPip) return;

                    for (var i = 0; i < entries.length; i++) {
                        var target = entries[i].target;
                        // Only react if width was injected via user resizing
                        if (target.style.width && target.style.width !== '' && target.style.width !== '100%') {
                            var w = target.offsetWidth;
                            var gridWidth = grid.offsetWidth;

                            // Convert pixel width to fractional unit (fr)
                            var fraction = w / gridWidth;
                            // Ensure fraction stays within bounds (5% to 95%)
                            fraction = Math.max(0.05, Math.min(0.95, fraction));

                            var colIdx = parseInt(target.dataset.col);
                            if (!isNaN(colIdx)) {
                                grid._customCols[colIdx] = fraction.toFixed(3); // Store as fr
                                // clear the inline width so the grid template enforces it
                                target.style.width = '';

                                // Calculate total custom fr applied to other columns (for horizontal)
                                var usedFr = 0;
                                for (var c in grid._customCols) {
                                    if (parseInt(c) !== colIdx) usedFr += parseFloat(grid._customCols[c] || 0);
                                }


                                // Re-apply grid template proportionally
                                if (mvLayout === 'focus' && count >= 2) {
                                    grid.style.gridTemplateColumns = grid._customCols[0] + 'fr ' + (1 - fraction).toFixed(3) + 'fr';
                                } else if (mvLayout === 'horizontal') {
                                    var template = '';
                                    var remainingFr = 1 - usedFr - fraction;
                                    if (remainingFr < 0.05 * count) remainingFr = 0.05 * count; // Clamp remaining to minimum
                                    var remainingCols = count - Object.keys(grid._customCols).length;

                                    for (var j = 0; j < count; j++) {
                                        if (grid._customCols[j]) {
                                            template += grid._customCols[j] + 'fr ';
                                        } else {
                                            template += (remainingCols > 0 ? (remainingFr / remainingCols).toFixed(3) : 0) + 'fr ';
                                        }
                                    }
                                    grid.style.gridTemplateColumns = template.trim();
                                } else {
                                    // Default 2 cols (auto, count >= 2)
                                    grid.style.gridTemplateColumns = grid._customCols[0] + 'fr ' + (1 - fraction).toFixed(3) + 'fr';
                                }                            }
                        }
                    }
                });
                cell._hasResizeObserver.observe(cell);
            } else if (cell.style.resize === 'none' && cell._hasResizeObserver) {
                cell._hasResizeObserver.disconnect();
                cell._hasResizeObserver = null;
            }

        } else {
            // Force pure vertical in PiP mode
            cell.style.width = '100%';
            cell.style.height = '100%';
            cell.style.resize = 'none';
            cell.style.gridRow = 'auto';
            cell.style.gridColumn = '1';
        }
        // Make cell clickable for focus logic
        cell.onmousedown = function(e) {
            if (!e.target.closest('.mv-hdr')) {
                focusStream(idx);
            }
        };

        // Update drag/drop indices as they can change
        cell.ondragstart = function(e) {
            e.dataTransfer.setData('text/plain', idx.toString());
            cell.style.opacity = '0.5';
        };
        cell.ondragend = function(e) {
            cell.style.opacity = '1';
            cell.draggable = false;
        };
        cell.ondragover = function(e) {
            e.preventDefault();
            cell.style.boxShadow = 'inset 0 0 0 2px var(--accent)';
        };
        cell.ondragleave = function(e) {
            cell.style.boxShadow = 'none';
        };
        cell.ondrop = function(e) {
            e.preventDefault();
            cell.style.boxShadow = 'none';
            var fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            var toIdx = idx;
            if (fromIdx !== toIdx && !isNaN(fromIdx)) {
                var temp = mvFlux[fromIdx];
                mvFlux[fromIdx] = mvFlux[toIdx];
                mvFlux[toIdx] = temp;
                saveMultivisionState();
                updateMultivisionLayout();
            }
        };

        // Update header HTML
        var hdr = cell.querySelector('.mv-hdr');
        // Make the header semi-transparent by default so it doesn't block the video too much
        hdr.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)';
        hdr.style.transition = 'background 0.2s';
        hdr.onmouseenter = function() { this.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)'; };
        hdr.onmouseleave = function() { this.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)'; };

        var domain = s.url ? getDomain(s.url) : 'Flux';
        var svgDrag = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';

        var hdrHtml = '<div style="display:flex;align-items:center;gap:8px;pointer-events:auto;">' +
            '<div class="mv-drag-handle" style="cursor: grab; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: rgba(0,0,0,0.4); border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.8);" onmousedown="this.closest(\'.mv-cell\').draggable=true;" title="Déplacer">' + svgDrag + '</div>' +
            '<span style="background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);padding:4px 8px;border-radius:4px;font-size:10px;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);">' + esc(domain) + '</span>' +
            '<span style="font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;text-shadow:0 1px 2px #000;color:rgba(255,255,255,0.8);" title="' + esc(s.name) + '">' + esc(s.name) + '</span>' +
            '</div>';

        var controlsHtml = '<div style="display:flex;gap:6px;pointer-events:auto;background:rgba(0,0,0,0.3);padding:4px;border-radius:8px;backdrop-filter:blur(5px);position:relative;">';

        // SVG Constants
        var svgMenu = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>';
        var svgLeft = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
        var svgRight = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
        var svgFlux = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>';
        var svgMatch = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path d="M9 12l2 2 4-4"/></svg>';
        var svgReload = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c0-5.52 4.48-10 10-10 2.21 0 4.25.71 5.91 1.91L21 6V2h-4"/><path d="M22 12c0 5.52-4.48 10-10 10-2.21 0-4.25-.71-5.91-1.91L3 18v4h4"/></svg>';
        var svgClose = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
        var svgStats = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>';

        // Dropdown Toggle
        var ddId = 'mv-dd-' + idx;
        controlsHtml += '<div style="position:relative;">';
        controlsHtml += '<button title="Menu" aria-label="Menu" style="background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:4px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.2)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.1)\'" onclick="var d = document.getElementById(\'' + ddId + '\'); d.style.display = d.style.display === \'block\' ? \'none\' : \'block\'; event.stopPropagation();">' + svgMenu + '</button>';

        // Dropdown Menu
        controlsHtml += '<div id="' + ddId + '" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;background:rgba(20,20,20,0.95);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:4px;min-width:160px;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,0.5);">';

        var btnStyle = 'background:transparent;color:#fff;border:none;border-radius:4px;width:100%;text-align:left;padding:8px 12px;font-size:13px;display:flex;align-items:center;gap:8px;cursor:pointer;transition:background 0.2s;';
        var hoverAttr = ' onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'transparent\'" ';

        if (idx > 0) {
             controlsHtml += '<button title="Déplacer à gauche" aria-label="Déplacer à gauche" style="' + btnStyle + '" ' + hoverAttr + ' onclick="moveMultiviewStream(' + idx + ', \'left\');event.stopPropagation();">' + svgLeft + ' Déplacer à gauche</button>';
        }
        if (idx < mvFlux.length - 1) {
             controlsHtml += '<button title="Déplacer à droite" aria-label="Déplacer à droite" style="' + btnStyle + '" ' + hoverAttr + ' onclick="moveMultiviewStream(' + idx + ', \'right\');event.stopPropagation();">' + svgRight + ' Déplacer à droite</button>';
        }

        var svgCast = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><line x1="2" y1="20" x2="2.01" y2="20"/></svg>';

        if (s.mid) {
             controlsHtml += '<button title="Infos & Stats" aria-label="Infos & Stats" style="' + btnStyle + '" ' + hoverAttr + ' onclick="document.getElementById(\'' + ddId + '\').style.display=\'none\'; openGlobalStatsFromMatch(\'' + escJs(s.mid) + '\');event.stopPropagation();">' + svgStats + ' Infos & Stats</button>';
             controlsHtml += '<button title="Changer de flux" aria-label="Changer de flux" style="' + btnStyle + '" ' + hoverAttr + ' onclick="showFluxSelector(' + idx + ', \'' + escJs(s.mid) + '\', event);event.stopPropagation();">' + svgFlux + ' Changer de flux</button>';
        }

        controlsHtml += '<button title="Caster (Nouvelle fenêtre)" aria-label="Caster" style="' + btnStyle + '" ' + hoverAttr + ' onclick="window.open(\'' + escJs(s.url) + '\', \'_blank\', \'width=800,height=600\'); document.getElementById(\'' + ddId + '\').style.display=\'none\'; event.stopPropagation();">' + svgCast + ' Caster (Chromecast)</button>';
        controlsHtml += '<button title="Changer de match" aria-label="Changer de match" style="' + btnStyle + '" ' + hoverAttr + ' onclick="showMatchSelector(event, ' + idx + ');event.stopPropagation();">' + svgMatch + ' Changer de match</button>';
        controlsHtml += '<button title="Recharger" aria-label="Recharger" style="' + btnStyle + '" ' + hoverAttr + ' onclick="var fr = document.getElementById(\'mv-iframe-' + idx + '\'); if(fr) { var sr = fr.src; fr.src = \'\'; setTimeout(function(){fr.src=sr;}, 100); }; document.getElementById(\'' + ddId + '\').style.display=\'none\'; event.stopPropagation();">' + svgReload + ' Recharger</button>';

        controlsHtml += '</div></div>'; // Close dropdown container

        // Close Button
        controlsHtml += '<button title="Fermer" aria-label="Fermer" style="background:rgba(220,53,69,0.5);color:#fff;border:none;border-radius:4px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(220,53,69,0.8)\'" onmouseout="this.style.background=\'rgba(220,53,69,0.5)\'" onclick="removeFromMultivision(' + idx + ')">' + svgClose + '</button>';

        controlsHtml += '</div>';

        hdr.innerHTML = hdrHtml + controlsHtml;

        // Update URL/Src if changed (for existing cells)
        if (s._currentUrl !== s.url) {
            var videoContainer = cell.querySelector('.mv-video-container');
            if (videoContainer) {
                if (typeof fallbackToIframe === 'function') fallbackToIframe(s.url, videoContainer, cell, s);
                s._currentUrl = s.url;
            }
        } else {
            // Update crop transform
            var media = cell.querySelector('.mv-media');
            if (media) {
                media.id = 'mv-iframe-' + idx;
                if (s.cropped) {
                    media.style.transform = 'scale(1.15)';
                } else {
                    media.style.transform = 'scale(1)';
                }
            }
        }
    });

    // Remove cells that are no longer in mvFlux
    existingCells.forEach(function(cell) {
        var cellId = cell.getAttribute('data-internal-id');
        if (!mvFlux.find(function(s) { return s._internalId === cellId; })) {
            cell.remove();
        }
    });

    if (activeMvIdx === null || activeMvIdx >= mvFlux.length) {
        activeMvIdx = mvFlux.length > 0 ? mvFlux.length - 1 : null;
    }

    applyMvFocusStyling();
    applyMvAudioState();
}

export function addToMultivision(url, name, mid) {
    mid = getOriginalMatchId(mid);
    if(mvFlux.length >= 4) {
        showToast('Maximum 4 streams en Multivision.');
        return;
    }
    mvFlux.push({url: url, name: name, mid: mid, cropped: false}); saveMultivisionState(); updateMultivisionLayout();

    // Auto-open multiview if it's the first flux added
    var mvc = document.getElementById('mv-container');
    if(mvc && mvc.style.display === 'none') {
        toggleMultiview();
    }
    showToast('Ajouté au Multivision: ' + name);
}

export function removeFromMultivision(idx) {
    mvFlux.splice(idx, 1); saveMultivisionState(); updateMultivisionLayout();
    // Do not auto-close multiview when empty, keep the empty state visible
}

export function clearMultivision() {
    mvFlux = []; saveMultivisionState(); updateMultivisionLayout();
    // Do not auto-close multiview when clearing all
}

export function hideMultivision() {
    var mvc = document.getElementById('mv-container');
    var epg = document.getElementById('epg');

    // Clear pending actions when closing multiview
    window.multiviewPendingAction = null;
    if(!mvc || !epg) return;

    mvc.style.display = 'none';
    epg.style.display = 'flex';
    epg.style.paddingRight = '0';
    var sf = document.getElementById('sport-filters-container');
    if(sf) sf.style.display = 'flex';
    mvc.classList.remove('mv-pip');

    var mvBtn = document.getElementById('mv-toggle-btn');
    if(mvBtn) {
        mvBtn.classList.remove('active-toggle');
        mvBtn.style = '';
    }
    applyFilter(S.filter); // Re-apply current tab style
}

export function toggleMultiview() {
    var mvc = document.getElementById('mv-container');
    var epg = document.getElementById('epg');

    // Clear pending actions when manually toggling multiview state
    window.multiviewPendingAction = null;
    if(!mvc || !epg) return;

    if(mvc.style.display === 'none') {
        // Open Multivision full screen
        mvc.classList.remove('mv-pip');
        mvc.style.cssText = 'position:fixed;top:' + (window.innerWidth <= 768 ? '0' : 'var(--hdr-height, 70px)') + ';left:0;right:0;bottom:' + (window.innerWidth <= 768 ? '60px' : '0') + ';background:transparent;z-index:90;display:flex;flex-direction:column;';
        epg.style.paddingRight = '0';
        mvc.style.display = 'flex';
        epg.style.display = 'none';
        var sf = document.getElementById('sport-filters-container');
        if(sf) sf.style.display = 'none';

        var optionsPage = document.getElementById('options-page');
        if (optionsPage) optionsPage.style.display = 'none';
        var logsPage = document.getElementById('logs-page');
        if (logsPage) logsPage.style.display = 'none';
        var scriptPage = document.getElementById('script-page');
        if (scriptPage) scriptPage.style.display = 'none';

        updateMultivisionLayout();
    } else if (!mvc.classList.contains('mv-pip')) {
        // Full screen -> Switch to PiP
        toggleMultiviewPip();
    } else {
        // PiP -> Return to Full Screen
        toggleMultiviewPip(); // This will remove pip class and restore full view
    }
}

export function toggleTheaterMode(elem) {
  elem = elem || document.getElementById('mv-grid-wrapper');
  if (!elem) return;

  if (elem.classList.contains('mv-theater')) {
      elem.classList.remove('mv-theater');
      var closeBtn = document.getElementById('mv-close-theater');
      if(closeBtn) closeBtn.remove();
      // Restore overflow
      document.body.style.overflow = '';
  } else {
      elem.classList.add('mv-theater');
      // Hide body overflow to avoid double scrollbars
      document.body.style.overflow = 'hidden';

      var closeBtn = document.getElementById('mv-close-theater');
      if(!closeBtn) {
          closeBtn = document.createElement('button');
          closeBtn.id = 'mv-close-theater';
          closeBtn.className = 'theater-close-btn';
          closeBtn.innerHTML = '<span class="ic ic-close"></span>';
          closeBtn.title = 'Quitter le mode Cinéma';
          closeBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999999;background:rgba(0,0,0,0.8);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:8px 16px;cursor:pointer;backdrop-filter:blur(5px);font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.5);opacity:1;';
          closeBtn.onclick = function() { toggleTheaterMode(elem); };
          elem.appendChild(closeBtn);
      }
  }
}

export function toggleFullscreen(elem) {
  elem = elem || document.documentElement;
  if (!document.fullscreenElement && !document.mozFullScreenElement &&
    !document.webkitFullscreenElement && !document.msFullscreenElement) {

    // Si c'est la grille Multiview qui passe en plein écran, on cache la barre d'outils
    if (elem.id === 'mv-grid' || elem.id === 'mv-grid-wrapper') {
        elem.classList.add('mv-fullscreen');
        var closeFsBtn = document.getElementById('mv-close-fs');
        if(!closeFsBtn) {
            closeFsBtn = document.createElement('button');
            closeFsBtn.id = 'mv-close-fs';
            closeFsBtn.innerHTML = '<span class="ic ic-close" style="margin-right:4px;"></span> Quitter plein écran';
            closeFsBtn.style.cssText = 'position:fixed; top:10px; right:10px; z-index:99999; background:rgba(0,0,0,0.8); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:20px; padding:8px 16px; cursor:pointer; font-weight:bold; backdrop-filter:blur(5px); box-shadow:0 4px 12px rgba(0,0,0,0.5); opacity:0; transition:opacity 0.3s;';
            closeFsBtn.onclick = function() { toggleFullscreen(); };
            elem.appendChild(closeFsBtn);

            // Auto hide
            var fsTimer;
            elem.addEventListener('mousemove', function() {
                if (document.fullscreenElement) {
                    closeFsBtn.style.opacity = '1';
                    clearTimeout(fsTimer);
                    fsTimer = setTimeout(function(){ closeFsBtn.style.opacity = '0'; }, 3000);
                }
            });
        }
    }

    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    // Restaurer le state si on quitte le plein écran de la grille
    var grid = document.getElementById('mv-grid-wrapper');
    if (!grid) grid = document.getElementById('mv-grid'); // Fallback

    if (grid && grid.classList.contains('mv-fullscreen')) {
        grid.classList.remove('mv-fullscreen');
        var closeFsBtn = document.getElementById('mv-close-fs');
        if(closeFsBtn) closeFsBtn.remove();
    }

    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

// Ensure the button disappears if we exit fullscreen via ESC key
document.addEventListener("fullscreenchange", function() {
    if (!document.fullscreenElement) {
        var grid = document.getElementById('mv-grid');
        if (grid && grid.classList.contains('mv-fullscreen')) {
            grid.classList.remove('mv-fullscreen');
            var closeFsBtn = document.getElementById('mv-close-fs');
            if(closeFsBtn) closeFsBtn.remove();
        }
    }
});

/* ══ OPEN FLUX (MULTIVISION) ═══════════ */
export function openFlux(e, eu, en, mid){
  mid = getOriginalMatchId(mid);
  if(e) e.preventDefault();
  var url=decodeURIComponent(eu), name=decodeURIComponent(en);

  var m = S.matches.find(function(x) { return String(x.id) === String(mid); });
  var matchName = m ? (m.homeTeam + ' vs ' + m.awayTeam) : name;

  if (window.multiviewPendingAction) {
      var action = window.multiviewPendingAction;

      if(action.type === 'replace' && action.replaceIdx !== undefined) {
          mvFlux[action.replaceIdx].url = url;
          mvFlux[action.replaceIdx].name = matchName;
          mvFlux[action.replaceIdx].mid = mid;
          saveMultivisionState(); updateMultivisionLayout();
      } else {
          addToMultivision(url, matchName, mid);
      }

      window.multiviewPendingAction = null;
      closeMod();
      if(document.getElementById('mv-container') && document.getElementById('mv-container').classList.contains('mv-pip')){
          toggleMultiviewPip();
      }
      return;
  }

  // Close modal if open
  var mbg = document.getElementById('mbg');
  if(mbg) mbg.classList.remove('open');

  addToMultivision(url, matchName, mid);
}

export function applyBgStyle() {
  var s = userPrefs.bgStyle || 'gradient';

  // Theme styling
  if(userPrefs.theme === 'metallic') {
      document.body.classList.add('theme-metallic');
  } else {
      document.body.classList.remove('theme-metallic');
  }

  // Icon Pack
  document.body.setAttribute('data-icon-pack', userPrefs.iconPack || 'standard');

  var c1 = userPrefs.c1 || '#000000';
  var c2 = userPrefs.c2 || '#111111';
  var c3 = userPrefs.c3 || '#222222';
  var blurVal = userPrefs.bgBlur || 0;
  var darkenVal = userPrefs.bgDarken || 0;

  document.documentElement.style.setProperty('--bg', c1);

  // Use a dedicated background container
  var appBg = document.getElementById('app-bg-container');
  if(!appBg) {
      appBg = document.createElement('div');
      appBg.id = 'app-bg-container';
      appBg.style.position = 'fixed';
      appBg.style.top = '0';
      appBg.style.left = '0';
      appBg.style.width = '100vw';
      appBg.style.height = '100vh';
      appBg.style.zIndex = '-3';
      appBg.style.pointerEvents = 'none';
      document.body.appendChild(appBg);
  }

  // Clear body background styles to avoid interference
  document.body.style.background = 'transparent';
  document.body.style.backgroundColor = 'transparent';

  appBg.style.backgroundColor = '';
  appBg.style.backgroundBlendMode = '';

  // Handle Blur and Darken via a dynamic pseudo-element or overlay
  var bgModifier = document.getElementById('bg-modifier-overlay');
  if(!bgModifier) {
      bgModifier = document.createElement('div');
      bgModifier.id = 'bg-modifier-overlay';
      bgModifier.style.position = 'fixed';
      bgModifier.style.top = '0';
      bgModifier.style.left = '0';
      bgModifier.style.width = '100vw';
      bgModifier.style.height = '100vh';
      bgModifier.style.pointerEvents = 'none';
      bgModifier.style.zIndex = '-1'; // just above the app-bg-container and behind content
      document.body.appendChild(bgModifier);
  }

  bgModifier.style.backdropFilter = blurVal > 0 ? 'blur(' + (blurVal / 5) + 'px)' : 'none';
  bgModifier.style.webkitBackdropFilter = blurVal > 0 ? 'blur(' + (blurVal / 5) + 'px)' : 'none';
  bgModifier.style.backgroundColor = darkenVal > 0 ? 'rgba(0, 0, 0, ' + (darkenVal / 100) + ')' : 'transparent';

  var fallbackBaseColor = userPrefs.removeBlack ? c1 : '#000';

  if (s === 'solid') {
    appBg.style.background = c1;
  } else if (s === 'gradient') {
    appBg.style.background = 'radial-gradient(circle at top right, ' + c2 + ' 0%, ' + c1 + ' 60%, ' + c3 + ' 100%)';
  } else if (s === 'grid') {
    appBg.style.backgroundColor = c1;
    appBg.style.backgroundImage = 'radial-gradient(' + c2 + ' 1px, transparent 1px)';
    appBg.style.backgroundSize = '24px 24px';
    appBg.style.backgroundPosition = '0 0';
  } else if (s === 'mesh_flou_1') {
    appBg.style.background = 'radial-gradient(at 20% 20%, '+c1+' 0, transparent 40%), radial-gradient(at 80% 10%, '+c2+' 0, transparent 40%), radial-gradient(at 90% 80%, '+c3+' 0, transparent 50%), radial-gradient(at 10% 90%, '+c1+' 0, transparent 40%)';
    appBg.style.backgroundColor = fallbackBaseColor;
  } else if (s === 'mesh_random') {
    var p1x = Math.floor(Math.random() * 100); var p1y = Math.floor(Math.random() * 100);
    var p2x = Math.floor(Math.random() * 100); var p2y = Math.floor(Math.random() * 100);
    var p3x = Math.floor(Math.random() * 100); var p3y = Math.floor(Math.random() * 100);
    var p4x = Math.floor(Math.random() * 100); var p4y = Math.floor(Math.random() * 100);
    appBg.style.background = 'radial-gradient(at '+p1x+'% '+p1y+'%, '+c1+' 0, transparent 50%), radial-gradient(at '+p2x+'% '+p2y+'%, '+c2+' 0, transparent 50%), radial-gradient(at '+p3x+'% '+p3y+'%, '+c3+' 0, transparent 50%), radial-gradient(at '+p4x+'% '+p4y+'%, '+c1+' 0, transparent 50%)';
    appBg.style.backgroundColor = fallbackBaseColor;
  } else if (s === 'mesh_diagonal') {
    appBg.style.background = 'radial-gradient(at 0% 0%, '+c1+' 0, transparent 60%), radial-gradient(at 50% 50%, '+c2+' 0, transparent 60%), radial-gradient(at 100% 100%, '+c3+' 0, transparent 60%), radial-gradient(at 100% 0%, '+c2+' 0, transparent 50%)';
    appBg.style.backgroundColor = fallbackBaseColor;
  } else if (s === 'mesh_center') {
    appBg.style.background = 'radial-gradient(at 50% 50%, '+c1+' 0, transparent 40%), radial-gradient(at 30% 70%, '+c2+' 0, transparent 50%), radial-gradient(at 70% 30%, '+c3+' 0, transparent 50%), radial-gradient(at 10% 10%, '+c1+' 0, transparent 20%)';
    appBg.style.backgroundColor = fallbackBaseColor;
  } else if (s === 'mesh_corner') {
    appBg.style.background = 'radial-gradient(at 0% 0%, '+c1+' 0, transparent 30%), radial-gradient(at 100% 0%, '+c2+' 0, transparent 30%), radial-gradient(at 100% 100%, '+c3+' 0, transparent 30%), radial-gradient(at 0% 100%, '+c1+' 0, transparent 30%)';
    appBg.style.backgroundColor = fallbackBaseColor;
  } else if (s === 'glow') {
    appBg.style.background = 'radial-gradient(circle at top left, '+c2+' 0%, transparent 40%), radial-gradient(circle at bottom right, '+c3+' 0%, transparent 40%), '+c1;
  } else if (s === 'aurora') {
    appBg.style.background = 'linear-gradient(to bottom, '+c1+', '+c1+'), radial-gradient(ellipse at top left, '+c2+' 0%, transparent 50%), radial-gradient(ellipse at top right, '+c3+' 0%, transparent 50%), radial-gradient(ellipse at bottom center, '+c2+' 0%, transparent 50%)';
    appBg.style.backgroundBlendMode = 'screen, screen, screen, normal';
    appBg.style.backgroundColor = c1;
  } else {
    appBg.style.background = c1 + ' radial-gradient(circle at 50% -20%, rgba(255,255,255,0.05) 0%, transparent 70%)';
  }
}

export function initPrefs() {
  var saved = localStorage.getItem('user_prefs');
  if(saved) {
    try { Object.assign(userPrefs, JSON.parse(saved)); } catch(e){}
  }

  if(document.getElementById('pref-bg-darken')) document.getElementById('pref-bg-darken').value = userPrefs.bgDarken || 0;

  applyBgStyle();

  // Accent Color
  var accent = userPrefs.accent || '#0a84ff';
  document.documentElement.style.setProperty('--accent', accent);


  // Special UI Effects overlay
  var effectOverlay = document.getElementById('ui-effect-overlay');
  if(!effectOverlay) {
      effectOverlay = document.createElement('div');
      effectOverlay.id = 'ui-effect-overlay';
      effectOverlay.style.position = 'fixed';
      effectOverlay.style.top = '0';
      effectOverlay.style.left = '0';
      effectOverlay.style.width = '100vw';
      effectOverlay.style.height = '100vh';
      effectOverlay.style.pointerEvents = 'none';
      effectOverlay.style.zIndex = '9999';
      document.body.appendChild(effectOverlay);
  }

  effectOverlay.style.background = 'none';
  effectOverlay.style.backdropFilter = 'none';
  effectOverlay.style.boxShadow = 'none';
  effectOverlay.style.animation = 'none';
  effectOverlay.innerHTML = '';
  document.body.classList.remove('neon-glow-effect', 'glassmorphism-effect');

  var effects = userPrefs.uiEffects || [];
  // Migrate old setting if needed
  if (userPrefs.uiEffect && userPrefs.uiEffect !== 'none') {
      if (!effects.includes(userPrefs.uiEffect)) {
          effects.push(userPrefs.uiEffect);
      }
      delete userPrefs.uiEffect;
  }

  var overlayBgs = [];

  if (effects.includes('glassmorphism')) {
      document.body.classList.add('glassmorphism-effect');
      overlayBgs.push('url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.05\'/%3E%3C/svg%3E")');
  }
  if (effects.includes('neon_glow')) {
      document.body.classList.add('neon-glow-effect');
  }

  if (overlayBgs.length > 0) {
      effectOverlay.style.background = overlayBgs.join(', ');
  }


  // Btn Shape and Custom Button Styles
  var br = '12px';
  var btnBg = 'rgba(255,255,255,0.05)';
  var btnBorder = '1px solid rgba(255,255,255,0.15)';
  var btnShadow = '0 4px 10px rgba(0,0,0,0.3)';
  var btnBlur = 'blur(12px)';
  var cr = '16px';

  if(userPrefs.btnShape === 'square') { br = '4px'; cr = '8px'; }
  else if(userPrefs.btnShape === 'pill') br = '24px';
  else if(userPrefs.btnShape === 'soft') {
      br = '16px';
      cr = '16px';
      btnBg = 'rgba(255,255,255,0.08)';
      btnBorder = '1px solid rgba(255,255,255,0.05)';
      btnShadow = '0 2px 8px rgba(0,0,0,0.1)';
  }
  else if(userPrefs.btnShape === 'ghost') {
      br = '8px';
      cr = '12px';
      btnBg = 'transparent';
      btnBorder = '1px solid rgba(255,255,255,0.3)';
      btnShadow = 'none';
      btnBlur = 'none';
  }
  else if(userPrefs.btnShape === 'apple') {
      br = '18px';
      cr = '20px';
      btnBg = 'rgba(255,255,255,0.1)';
      btnBorder = '1px solid rgba(255,255,255,0.2)';
      btnBlur = 'blur(20px)';
      btnShadow = '0 8px 24px rgba(0,0,0,0.15)';
  } else if(userPrefs.btnShape === 'windows') {
      br = '4px';
      cr = '8px';
      btnBg = 'rgba(255,255,255,0.05)';
      btnBorder = '1px solid rgba(255,255,255,0.1)';
      btnBlur = 'blur(30px)';
  } else if(userPrefs.btnShape === 'steam') {
      br = '2px';
      cr = '4px';
      btnBg = 'linear-gradient(to bottom, #3a3f44, #272b30)';
      btnBorder = '1px solid #1a1c1f';
      btnShadow = 'inset 0 1px 0 rgba(255,255,255,0.1)';
  }

  document.documentElement.style.setProperty('--radius-btn', br);
  document.documentElement.style.setProperty('--btn-bg', btnBg);
  document.documentElement.style.setProperty('--btn-border', btnBorder);
  document.documentElement.style.setProperty('--btn-shadow', btnShadow);
  document.documentElement.style.setProperty('--btn-blur', btnBlur);
  document.documentElement.style.setProperty('--radius-card', cr);

  document.documentElement.style.setProperty('--card-opacity', (userPrefs.cardOpacity || 15) / 100);

  // Match Card Styles
  var cStyle = userPrefs.cardStyle || 'glass';
  var cardBorder = 'none';
  var cardBgOpac = (userPrefs.cardOpacity || 15) / 100;
  var cardShadow = '0 8px 20px rgba(0,0,0,0.5)';

  if (cStyle === 'solid') {
      cardBgOpac = Math.max(cardBgOpac, 0.8); // Ensure it's mostly solid
      document.documentElement.style.setProperty('--card-opacity', cardBgOpac);
      cardShadow = '0 4px 12px rgba(0,0,0,0.3)';
  } else if (cStyle === 'bordered') {
      cardBorder = '1px solid rgba(255,255,255,0.1)';
      cardShadow = 'none';
      document.documentElement.style.setProperty('--card-opacity', Math.min(cardBgOpac, 0.1)); // Very light bg
  } else if (cStyle === 'elevated') {
      cardBorder = '1px solid rgba(255,255,255,0.05)';
      cardShadow = '0 10px 30px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.1)';
  }

  document.documentElement.style.setProperty('--card-border', cardBorder);
  document.documentElement.style.setProperty('--card-shadow', cardShadow);

  // Card Size
  document.body.classList.remove('card-size-small', 'card-size-normal', 'card-size-large');
  if (userPrefs.cardSize) {
      document.body.classList.add('card-size-' + userPrefs.cardSize);
  } else {
      document.body.classList.add('card-size-normal');
  }


  // Nav Layout Styles
  // Removed dynamic JS nav layout injection to rely on CSS media queries for responsiveness.

  // Toggle Button Styles
  var tStyle = userPrefs.toggleStyle || 'default';
  var tGlow = 'none';
  var tBg = 'rgba(255,255,255,0.2)';
  var tBorder = '1px solid var(--accent)';

  if (tStyle === 'solid') {
      tBg = 'var(--accent)';
      tBorder = '1px solid var(--accent)';
      tGlow = '0 4px 12px rgba(0,0,0,0.5)';
  } else if (tStyle === 'underlined') {
      tBg = 'rgba(255,255,255,0.05)';
      tBorder = 'none';
      tGlow = 'inset 0 -3px 0 var(--accent)';
  } else if (tStyle === 'dot') {
      tBg = 'transparent';
      tBorder = 'none';
      tGlow = 'inset 0 -4px 0 -2px var(--accent)'; // Simulate a dot using inset shadow trick or just a subtle bottom border
  }

  document.documentElement.style.setProperty('--toggle-glow', tGlow);
  document.documentElement.style.setProperty('--toggle-bg-active', tBg);
  document.documentElement.style.setProperty('--toggle-border-active', tBorder);

  // Hover Effects
  var hoverStyle = userPrefs.hoverStyle || 'default';
  var hTransform = 'translateY(-1px)';
  var hShadow = 'none';
  var hBrightness = 'brightness(1.1)';

  if (hoverStyle === 'float') {
      hTransform = 'translateY(-3px)';
      hShadow = '0 10px 20px rgba(0,0,0,0.6)';
  } else if (hoverStyle === 'glow') {
      hShadow = '0 0 15px var(--accent)';
      hBrightness = 'brightness(1.3)';
  } else if (hoverStyle === 'scale') {
      hTransform = 'scale(1.05)';
      hShadow = '0 5px 15px rgba(0,0,0,0.4)';
  } else if (hoverStyle === 'none') {
      hTransform = 'none';
      hBrightness = 'none';
  }

  document.documentElement.style.setProperty('--btn-hover-transform', hTransform);
  document.documentElement.style.setProperty('--btn-hover-shadow', hShadow);
  document.documentElement.style.setProperty('--btn-hover-brightness', hBrightness);

  // Header Style
  var hStyle = userPrefs.hdrStyle || 'transparent';
  var hBg = 'transparent';
  var hBlur = 'blur(0px)';
  var hShadow = 'none';
  var hBorder = 'none';

  if (hStyle === 'glass') {
      hBg = 'rgba(10, 10, 12, 0.65)';
      hBlur = 'blur(20px)';
      hBorder = '1px solid rgba(255,255,255,0.05)';
  } else if (hStyle === 'solid') {
      hBg = 'var(--bg)';
      hBorder = '1px solid var(--border)';
  } else if (hStyle === 'floating') {
      hBg = 'rgba(20,20,22,0.85)';
      hBlur = 'blur(15px)';
      hShadow = '0 10px 30px rgba(0,0,0,0.8)';
      hBorder = '1px solid rgba(255,255,255,0.1)';
  }

  document.documentElement.style.setProperty('--hdr-bg', hBg);
  document.documentElement.style.setProperty('--hdr-blur', hBlur);
  document.documentElement.style.setProperty('--hdr-shadow', hShadow);
  document.documentElement.style.setProperty('--hdr-border', hBorder);


  // Update DOM selectors
  var selTheme = document.getElementById('pref-theme');
  var selBgStyle = document.getElementById('pref-bg-style');
  var selC1 = document.getElementById('pref-c1');
  var selC2 = document.getElementById('pref-c2');
  var selC3 = document.getElementById('pref-c3');
  var selCardSize = document.getElementById('pref-card-size');
  var selCard = document.getElementById('pref-card-color');
  var selCardStyle = document.getElementById('pref-card-style');
  var selBtn = document.getElementById('pref-btn-shape');
  var selAccentColor = document.getElementById('pref-accent-color');
  var selOpacity = document.getElementById('pref-card-opacity');

  if(selTheme) selTheme.value = userPrefs.theme || 'custom';
  if(selBgStyle) selBgStyle.value = userPrefs.bgStyle || 'gradient';
  if(selC1) {
      selC1.value = userPrefs.c1 || '#000000';
      var hexC1 = document.getElementById('hex-c1');
      if(hexC1) hexC1.textContent = selC1.value;
  }
  if(selC2) {
      selC2.value = userPrefs.c2 || '#111111';
      var hexC2 = document.getElementById('hex-c2');
      if(hexC2) hexC2.textContent = selC2.value;
  }
  if(selCardSize) selCardSize.value = userPrefs.cardSize || 'normal';
  if(selCard) selCard.value = userPrefs.cardColor || 'gradient-45';
  if(selC3) {
      selC3.value = userPrefs.c3 || '#222222';
      var hexC3 = document.getElementById('hex-c3');
      if(hexC3) hexC3.textContent = selC3.value;
  }

  if(selCardStyle) selCardStyle.value = userPrefs.cardStyle || 'glass';
  if(selBtn) selBtn.value = userPrefs.btnShape || 'rounded';
  if(selAccentColor) {
      selAccentColor.value = userPrefs.accent || '#0a84ff';
      var hexAccent = document.getElementById('hex-accent-color');
      if(hexAccent) hexAccent.textContent = selAccentColor.value;
  }
  if(selOpacity) selOpacity.value = userPrefs.cardOpacity || 15;

  var cbRemoveBlack = document.getElementById('pref-remove-black');
  if(cbRemoveBlack) cbRemoveBlack.checked = !!userPrefs.removeBlack;

  var selHover = document.getElementById('pref-hover-style');
  if(selHover) selHover.value = userPrefs.hoverStyle || 'default';
  var selToggle = document.getElementById('pref-toggle-style');
  if(selToggle) selToggle.value = userPrefs.toggleStyle || 'default';
  var selHdr = document.getElementById('pref-hdr-style');
  if(selHdr) selHdr.value = userPrefs.hdrStyle || 'transparent';

  var effectsContainer = document.getElementById('pref-ui-effects-container');
  if(effectsContainer) {
      var checkboxes = effectsContainer.querySelectorAll('input[type="checkbox"]');
      var effects = userPrefs.uiEffects || [];
      // migrate if needed
      if (userPrefs.uiEffect && userPrefs.uiEffect !== 'none') {
          if (!effects.includes(userPrefs.uiEffect)) {
              effects.push(userPrefs.uiEffect);
          }
      }
      checkboxes.forEach(cb => {
          cb.checked = effects.includes(cb.value);
      });

      var glassCb = document.getElementById('pref-glassmorphism');
      if (glassCb) {
          glassCb.checked = effects.includes('glassmorphism');
      }
  }
}

export function applyUserPrefs() {
  var themeSel = document.getElementById('pref-theme');
  var bgStyleSel = document.getElementById('pref-bg-style');
  var c1Sel = document.getElementById('pref-c1');
  var c2Sel = document.getElementById('pref-c2');
  var c3Sel = document.getElementById('pref-c3');
  var cardSizeSel = document.getElementById('pref-card-size');
  var cardSel = document.getElementById('pref-card-color');
  var cardStyleSel = document.getElementById('pref-card-style');
  var btnSel = document.getElementById('pref-btn-shape');
  var accentColorSel = document.getElementById('pref-accent-color');
  var opacSel = document.getElementById('pref-card-opacity');
  var effectsContainer = document.getElementById('pref-ui-effects-container');
  var removeBlackCb = document.getElementById('pref-remove-black');

  if(themeSel) userPrefs.theme = themeSel.value;
  if(bgStyleSel) userPrefs.bgStyle = bgStyleSel.value;
  if(c1Sel) userPrefs.c1 = c1Sel.value;
  if(c2Sel) userPrefs.c2 = c2Sel.value;
  if(c3Sel) userPrefs.c3 = c3Sel.value;
  if(cardSizeSel) userPrefs.cardSize = cardSizeSel.value;
  if(cardSel) userPrefs.cardColor = cardSel.value;
  userPrefs.cardStyle = 'glass';
  if(btnSel) userPrefs.btnShape = btnSel.value;
  if(accentColorSel) userPrefs.accent = accentColorSel.value;
  var hoverSel = document.getElementById('pref-hover-style');
  if(hoverSel) userPrefs.hoverStyle = hoverSel.value;
  var toggleSel = document.getElementById('pref-toggle-style');
  if(toggleSel) userPrefs.toggleStyle = toggleSel.value;
  var hdrSel = document.getElementById('pref-hdr-style');
  if(hdrSel) userPrefs.hdrStyle = hdrSel.value;
  userPrefs.cardOpacity = '15';

  var darkenSel = document.getElementById('pref-bg-darken');
  if(darkenSel) userPrefs.bgDarken = darkenSel.value;

  if(removeBlackCb) userPrefs.removeBlack = removeBlackCb.checked;

  if(effectsContainer) {
      var checkboxes = effectsContainer.querySelectorAll('input[type="checkbox"]');
      var activeEffects = [];
      checkboxes.forEach(cb => {
          if(cb.checked) activeEffects.push(cb.value);
      });

      var glassCb = document.getElementById('pref-glassmorphism');
      if (glassCb && glassCb.checked) {
          activeEffects.push('glassmorphism');
      }

      userPrefs.uiEffects = activeEffects;
  }

  localStorage.setItem('user_prefs', JSON.stringify(userPrefs));
  initPrefs();
  setTimeout(function() { buildEPG(S.matches); }, 0); // Rebuild to apply card colors
  showToast('Préférences sauvegardées');
}

export function markCustomTheme() {
  var themeSel = document.getElementById('pref-theme');
  if(themeSel) themeSel.value = 'custom';
  // when a user changes a color manually, we set theme to custom, and then save
  applyUserPrefs();
}

export function applyUserBgStyleOnly() {
  var themeSel = document.getElementById('pref-theme');
  if(themeSel) themeSel.value = 'custom'; // mark custom so it doesn't revert to preset
  applyUserPrefs();
}

export function applyPredefinedTheme() {
  var themeSel = document.getElementById('pref-theme');
  if(!themeSel) return;
  var theme = themeSel.value;
  if(theme === 'custom') return;

  var presets = {
    // Épuré & Minimaliste
        'midnight': { bgStyle: 'solid', c1: '#0a0a0c', c2: '#121214', c3: '#18181a', accent: '#38bdf8', btnShape: 'soft' },
    'slate': { bgStyle: 'gradient', c1: '#1e293b', c2: '#334155', c3: '#475569', accent: '#cbd5e1', btnShape: 'rounded' },
    'minimal_light': { bgStyle: 'solid', c1: '#f8fafc', c2: '#f1f5f9', c3: '#e2e8f0', accent: '#0f172a', btnShape: 'rounded' }
  };

  if(presets[theme]) {
    userPrefs.bgStyle = presets[theme].bgStyle;
    userPrefs.c1 = presets[theme].c1;
    userPrefs.c2 = presets[theme].c2;
    userPrefs.c3 = presets[theme].c3;
    userPrefs.accent = presets[theme].accent;
    if(presets[theme].btnShape) userPrefs.btnShape = presets[theme].btnShape;
    if(presets[theme].iconPack) userPrefs.iconPack = presets[theme].iconPack;
    if(presets[theme].toggleStyle) userPrefs.toggleStyle = presets[theme].toggleStyle;
    if(presets[theme].hdrStyle) userPrefs.hdrStyle = presets[theme].hdrStyle;

    if(presets[theme].uiEffects !== undefined) {
        userPrefs.uiEffects = presets[theme].uiEffects;
    } else {
        userPrefs.uiEffects = [];
    }
    userPrefs.theme = theme;

    // Reset darken when applying predefined theme
    userPrefs.bgDarken = 0;

    // Update inputs
    if(document.getElementById('pref-bg-darken')) document.getElementById('pref-bg-darken').value = userPrefs.bgDarken || 0;
    document.getElementById('pref-bg-style').value = userPrefs.bgStyle;
    document.getElementById('pref-c1').value = userPrefs.c1;
    document.getElementById('pref-c2').value = userPrefs.c2;
    document.getElementById('pref-c3').value = userPrefs.c3;
    document.getElementById('pref-accent-color').value = userPrefs.accent;

    var hexC1 = document.getElementById('hex-c1');
    if(hexC1) hexC1.textContent = userPrefs.c1;
    var hexC2 = document.getElementById('hex-c2');
    if(hexC2) hexC2.textContent = userPrefs.c2;
    var hexC3 = document.getElementById('hex-c3');
    if(hexC3) hexC3.textContent = userPrefs.c3;
    var hexAccent = document.getElementById('hex-accent-color');
    if(hexAccent) hexAccent.textContent = userPrefs.accent;
    if(document.getElementById('pref-icon-pack') && presets[theme].iconPack) {
      document.getElementById('pref-icon-pack').value = presets[theme].iconPack;
    }
    if(document.getElementById('pref-btn-shape') && presets[theme].btnShape) {
      document.getElementById('pref-btn-shape').value = presets[theme].btnShape;
    }
    if(document.getElementById('pref-toggle-style') && presets[theme].toggleStyle) {
      document.getElementById('pref-toggle-style').value = presets[theme].toggleStyle;
    }
    if(document.getElementById('pref-hdr-style') && presets[theme].hdrStyle) {
      document.getElementById('pref-hdr-style').value = presets[theme].hdrStyle;
    }

    var effectsContainer = document.getElementById('pref-ui-effects-container');
    if(effectsContainer) {
        var checkboxes = effectsContainer.querySelectorAll('input[type="checkbox"]');
        var effects = userPrefs.uiEffects || [];
        checkboxes.forEach(cb => {
            cb.checked = effects.includes(cb.value);
        });

        var glassCb = document.getElementById('pref-glassmorphism');
        if (glassCb) {
            glassCb.checked = effects.includes('glassmorphism');
        }
    }

    applyUserPrefs();
  }
}


export const PALETTES = [
    // Épuré & Dashboards (Tailwind/Vercel/GitHub inspired)
    { id: 'midnight', name: 'Minuit', c1: '#0f172a', c2: '#1e293b', c3: '#334155', accent: '#38bdf8' },
    { id: 'vercel', name: 'Vercel', c1: '#000000', c2: '#111111', c3: '#333333', accent: '#ffffff' },
    { id: 'github_dark', name: 'Code Sombre', c1: '#0d1117', c2: '#161b22', c3: '#21262d', accent: '#58a6ff' },
    { id: 'minimal_light', name: 'Minimal Clair', c1: '#f8fafc', c2: '#f1f5f9', c3: '#e2e8f0', accent: '#0f172a' },
    { id: 'slate', name: 'Ardoise', c1: '#1e293b', c2: '#334155', c3: '#475569', accent: '#cbd5e1' },
    { id: 'zinc', name: 'Zinc', c1: '#18181b', c2: '#27272a', c3: '#3f3f46', accent: '#f4f4f5' },

    // Steam & Tech (Material / Interfaces)
    { id: 'steam', name: 'Steam', c1: '#171a21', c2: '#1b2838', c3: '#2a475e', accent: '#66c0f4' },
    { id: 'macos_dark', name: 'macOS Sombre', c1: '#1c1c1e', c2: '#2c2c2e', c3: '#3a3a3c', accent: '#0a84ff' },
    { id: 'win_fluent', name: 'Windows 11', c1: '#202020', c2: '#282828', c3: '#333333', accent: '#60cdff' },

    // Nature & Éléments (Couleurs douces, Material HIG)
    { id: 'ocean', name: 'Océan', c1: '#0c4a6e', c2: '#075985', c3: '#0369a1', accent: '#38bdf8' },
    { id: 'forest', name: 'Forêt', c1: '#064e3b', c2: '#065f46', c3: '#047857', accent: '#34d399' },
    { id: 'nordic', name: 'Nordique', c1: '#2e3440', c2: '#3b4252', c3: '#434c5e', accent: '#88c0d0' },
    { id: 'sand', name: 'Sable', c1: '#451a03', c2: '#78350f', c3: '#92400e', accent: '#fbbf24' },

    // Vibrants maîtrisés (Accents forts sur fond très sombre)
    { id: 'cyberpunk', name: 'Cyberpunk', c1: '#09090b', c2: '#18181b', c3: '#27272a', accent: '#e11d48' },
    { id: 'aurora', name: 'Aurore', c1: '#022c22', c2: '#064e3b', c3: '#065f46', accent: '#10b981' },
    { id: 'sunset', name: 'Crépuscule', c1: '#2e1065', c2: '#4c1d95', c3: '#5b21b6', accent: '#f43f5e' },

    // Multi-teintes Vibrantes (Idéal pour les maillages)
    { id: 'synthwave', name: 'Synthwave', c1: '#2e0249', c2: '#570a57', c3: '#a91079', accent: '#f806cc' },
    { id: 'northern_lights', name: 'Aurore Boréale', c1: '#013a20', c2: '#0b8a53', c3: '#18c985', accent: '#a1ffce' },
    { id: 'neon_city', name: 'Ville Néon', c1: '#0a043c', c2: '#03506f', c3: '#bb1010', accent: '#ffe400' },
    { id: 'deep_ocean', name: 'Océan Profond', c1: '#03001c', c2: '#301e67', c3: '#5b8fb9', accent: '#b6eada' },
    { id: 'sunset_vibes', name: 'Coucher de Soleil', c1: '#3f0071', c2: '#fb2576', c3: '#ff6c00', accent: '#f7c04a' },
    { id: 'toxic_glow', name: 'Lueur Toxique', c1: '#111d13', c2: '#2a4d14', c3: '#72b01d', accent: '#e2f7ce' },
    { id: 'galactic', name: 'Galactique', c1: '#1b1a17', c2: '#1f1e2c', c3: '#6a0dad', accent: '#ffd700' },
    { id: 'miami_vice', name: 'Miami Vice', c1: '#120052', c2: '#7f00ff', c3: '#e100ff', accent: '#00f2fe' },
    { id: 'lava_lamp', name: 'Lampe à Lave', c1: '#2b0000', c2: '#800000', c3: '#ff4500', accent: '#ff8c00' },
    { id: 'frozen_berry', name: 'Baie Givrée', c1: '#18122B', c2: '#393053', c3: '#635985', accent: '#d2d0eb' },
    { id: 'neon_nights', name: 'Nuits Néon', c1: '#0b0033', c2: '#3700b3', c3: '#b300ff', accent: '#00e5ff' },
    { id: 'tropical_breeze', name: 'Brise Tropicale', c1: '#004d40', c2: '#00796b', c3: '#009688', accent: '#ffc107' },
    { id: 'desert_dune', name: 'Dune du Désert', c1: '#4a3b32', c2: '#8b5a2b', c3: '#cd853f', accent: '#ffdead' },
    { id: 'candy_pop', name: 'Pop Bonbon', c1: '#4a0e4e', c2: '#81176b', c3: '#b62a83', accent: '#f55c9b' },
    { id: 'emerald_dream', name: 'Rêve Émeraude', c1: '#01200f', c2: '#044a26', c3: '#0b8244', accent: '#50c878' },
    { id: 'royal_amethyst', name: 'Améthyste Royale', c1: '#2a004f', c2: '#4c007d', c3: '#7a00ba', accent: '#c68cff' },
    { id: 'fiery_comet', name: 'Comète Enflammée', c1: '#3d0c02', c2: '#8c1c04', c3: '#d93608', accent: '#ffcc00' },
    { id: 'aqua_marine', name: 'Aqua Marine', c1: '#00293b', c2: '#005470', c3: '#0083a3', accent: '#00e6e6' },
    { id: 'golden_hour', name: 'Heure Dorée', c1: '#4d2b00', c2: '#995a00', c3: '#e68a00', accent: '#ffe066' },
    { id: 'mystic_forest', name: 'Forêt Mystique', c1: '#0c2e1f', c2: '#1b5e3f', c3: '#2d9362', accent: '#9cedb4' }

];

export function buildSwatches() {
    var container = document.querySelector('.swatches-container');
    if (!container) return;

    container.innerHTML = '';

    // Convert PALETTES object to an array and add favTeams
    var palettesToRender = [];

    // Add dynamic palettes for favorite teams
    if (typeof favTeams !== 'undefined') {
        Object.keys(favTeams).forEach(function(teamName) {
            if (favTeams[teamName] === 1) {
                var colors = getTeamColors(teamName); // from config.js
                if (colors && colors.length >= 2) {
                    var c1 = colors[0];
                    var accent = colors[1];
                    // Create darker shades for gradient from c1
                    var c2 = c1;
                    var c3 = c1;

                    // Simple heuristic to create gradients if they are hex
                    if (c1.startsWith('#') && c1.length === 7) {
                        var r = parseInt(c1.substring(1,3), 16);
                        var g = parseInt(c1.substring(3,5), 16);
                        var b = parseInt(c1.substring(5,7), 16);

                        c2 = '#' + Math.max(0, r-30).toString(16).padStart(2,'0') + Math.max(0, g-30).toString(16).padStart(2,'0') + Math.max(0, b-30).toString(16).padStart(2,'0');
                        c3 = '#' + Math.max(0, r-60).toString(16).padStart(2,'0') + Math.max(0, g-60).toString(16).padStart(2,'0') + Math.max(0, b-60).toString(16).padStart(2,'0');
                    }

                    palettesToRender.push({
                        name: '⭐️ ' + esc(teamName),
                        c1: c1,
                        c2: c2,
                        c3: c3,
                        accent: accent
                    });
                }
            }
        });
    }

    // Add predefined palettes
    PALETTES.forEach(function(p) { palettesToRender.push(p); });

    palettesToRender.forEach(function(p) {
        var swatch = document.createElement('div');
        swatch.className = 'swatch-item';
        swatch.title = p.name;
        swatch.style.width = '32px';
        swatch.style.height = '32px';
        swatch.style.borderRadius = '50%';
        swatch.style.cursor = 'pointer';
        swatch.style.border = '2px solid ' + p.accent;
        swatch.style.background = 'linear-gradient(135deg, ' + p.c1 + ' 0%, ' + p.c2 + ' 50%, ' + p.c3 + ' 100%)';
        swatch.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
        swatch.style.transition = 'transform 0.2s, box-shadow 0.2s';

        swatch.onmouseenter = function() {
            swatch.style.transform = 'scale(1.15)';
            swatch.style.boxShadow = '0 0 8px ' + p.accent;
        };
        swatch.onmouseleave = function() {
            swatch.style.transform = 'scale(1)';
            swatch.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
        };

        swatch.onclick = function() {
            document.getElementById('pref-c1').value = p.c1.length === 7 ? p.c1 : '#000000';
            document.getElementById('pref-c2').value = p.c2.length === 7 ? p.c2 : '#111111';
            document.getElementById('pref-c3').value = p.c3.length === 7 ? p.c3 : '#222222';
            document.getElementById('pref-accent-color').value = p.accent.length === 7 ? p.accent : '#0a84ff';

            var hexC1 = document.getElementById('hex-c1');
            if(hexC1) hexC1.textContent = p.c1;
            var hexC2 = document.getElementById('hex-c2');
            if(hexC2) hexC2.textContent = p.c2;
            var hexC3 = document.getElementById('hex-c3');
            if(hexC3) hexC3.textContent = p.c3;
            var hexAccent = document.getElementById('hex-accent-color');
            if(hexAccent) hexAccent.textContent = p.accent;

            markCustomTheme();
        };

        container.appendChild(swatch);
    });
}


export function renderSourcesStatus() {
    var container = document.getElementById('sources-status-container');
    if (!container) return;
    if (sourcesStatus.length === 0) {
        container.innerHTML = '<div style="color: var(--muted2); text-align: center;">Aucune donnée (Scraping en attente...)</div>';
        return;
    }

    var html = '';
    sourcesStatus.forEach(function(s) {
        var icon = s.status === 'success' ? '✅' : (s.status === 'warning' ? '⚠️' : '❌');
        var color = s.status === 'success' ? '#34c759' : (s.status === 'warning' ? '#ffcc00' : 'var(--red)');

        html += '<div style="display:flex; justify-content:space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 4px 0;">' +
                  '<div style="display:flex; align-items:center; gap: 8px;">' +
                      '<span style="font-size: 14px;">' + icon + '</span>' +
                      '<span style="font-weight: bold; color: var(--text);">' + esc(s.name) + '</span>' +
                  '</div>' +
                  '<div style="display:flex; align-items:center; gap: 10px; font-size: 12px;">' +
                      '<span style="color: ' + color + ';">' + esc(s.message) + '</span>' +
                      '<span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: var(--muted);">' + esc(s.matchCount) + ' matchs</span>' +
                      '<span style="color: var(--muted2); font-size: 10px; width: 50px; text-align:right;">' + esc(s.time) + '</span>' +
                  '</div>' +
                '</div>';
    });
    container.innerHTML = html;
}

export function renderScrapeLogs() {
    renderSourcesStatus();
    var container = document.getElementById('scrape-logs-container');
    if(!container) return;
    if(scrapeLogs.length === 0) {
        container.innerHTML = '<div style="color: var(--muted2); text-align: center; padding: 10px;">Aucun log récent.</div>';
        return;
    }
    var html = '';
    scrapeLogs.forEach(function(log) {
        var color = log.status === 'error' ? 'var(--red)' : (log.status === 'success' ? '#34c759' : 'var(--text)');
        var icon = log.status === 'error' ? '❌' : (log.status === 'success' ? '✅' : 'ℹ️');
        html += '<div style="display:flex; flex-direction:column; gap:2px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">' +
                  '<div style="display:flex; justify-content:space-between;">' +
                      '<span style="color:var(--muted);">' + esc(log.time) + '</span>' +
                      '<span style="color:' + color + ';">' + icon + ' ' + esc(log.status.toUpperCase()) + '</span>' +
                  '</div>' +
                  '<div style="word-break: break-all; color: #a1a1aa;">' + esc(log.url) + '</div>' +
                  (log.error ? '<div style="color:var(--red); font-size: 11px;">' + esc(log.error) + '</div>' : '') +
                '</div>';
    });
    container.innerHTML = html;
}

export function openOptionsPage() {
    var favPage = document.getElementById('fav-page');
    if (favPage) favPage.style.display = 'none';
    var epgContainer = document.getElementById('epg');
    if (epgContainer) epgContainer.style.display = 'none';
    var mareaContainer = document.getElementById('marea');
    if (mareaContainer) mareaContainer.style.display = 'none';
    var sportFiltersContainer = document.getElementById('sport-filters-container');
    if (sportFiltersContainer) sportFiltersContainer.style.display = 'none';

    var logsPage = document.getElementById('logs-page');
    if (logsPage) logsPage.style.display = 'none';
    var scriptPage = document.getElementById('script-page');
    if (scriptPage) scriptPage.style.display = 'none';

    var optionsPage = document.getElementById('options-page');
    if (optionsPage) {
        optionsPage.style.display = 'flex';
        buildSwatches();

        initPrefs();
    }
}

export function openLogsPage() {
    var favPage = document.getElementById('fav-page');
    if (favPage) favPage.style.display = 'none';
    var epgContainer = document.getElementById('epg');
    if (epgContainer) epgContainer.style.display = 'none';
    var mareaContainer = document.getElementById('marea');
    if (mareaContainer) mareaContainer.style.display = 'none';
    var sportFiltersContainer = document.getElementById('sport-filters-container');
    if (sportFiltersContainer) sportFiltersContainer.style.display = 'none';

    var optionsPage = document.getElementById('options-page');
    if (optionsPage) optionsPage.style.display = 'none';
    var scriptPage = document.getElementById('script-page');
    if (scriptPage) scriptPage.style.display = 'none';

    var logsPage = document.getElementById('logs-page');
    if (logsPage) {
        logsPage.style.display = 'flex';
        renderScrapeLogs();
    }
}

export function openScriptPage() {
    var favPage = document.getElementById('fav-page');
    if (favPage) favPage.style.display = 'none';
    var epgContainer = document.getElementById('epg');
    if (epgContainer) epgContainer.style.display = 'none';
    var mareaContainer = document.getElementById('marea');
    if (mareaContainer) mareaContainer.style.display = 'none';
    var sportFiltersContainer = document.getElementById('sport-filters-container');
    if (sportFiltersContainer) sportFiltersContainer.style.display = 'none';

    var optionsPage = document.getElementById('options-page');
    if (optionsPage) optionsPage.style.display = 'none';
    var logsPage = document.getElementById('logs-page');
    if (logsPage) logsPage.style.display = 'none';

    var scriptPage = document.getElementById('script-page');
    if (scriptPage) {
        scriptPage.style.display = 'flex';
    }
}

// Kept for backward compatibility if called elsewhere, though shouldn't be needed



initPrefs(); // Run once on load


export function installTampermonkey() {
    var existing = document.getElementById('tm-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'tm-modal';
    modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);z-index:9999;background:rgba(20,20,20,0.95);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:20px;backdrop-filter:blur(15px);display:flex;flex-direction:column;gap:16px;max-height:80vh;overflow-y:auto;box-shadow:0 15px 40px rgba(0,0,0,0.8);width:90%;max-width:500px;-webkit-overflow-scrolling:touch;color:#fff;';

    var closeBtn = document.createElement('div');
    closeBtn.innerHTML = '<span class="ic ic-close"></span>';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border-radius:50%;cursor:pointer;color:#fff;font-size:14px;';
    closeBtn.onclick = function() { modal.remove(); };
    modal.appendChild(closeBtn);

    var title = document.createElement('h2');
    title.style.cssText = 'margin:0;font-size:18px;font-weight:bold;display:flex;align-items:center;gap:8px;';
    title.innerHTML = '🧩 Installation des Scripts';
    modal.appendChild(title);

    var contentDiv = document.createElement('div');
    contentDiv.style.cssText = 'font-size:14px;line-height:1.5;color:#ddd;display:flex;flex-direction:column;gap:12px;';

    contentDiv.innerHTML = `
        <p>Pour profiter pleinement du Multivision sans publicités et avec le lecteur vidéo isolé, vous devez installer notre script utilisateur.</p>

        <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1); margin-bottom: 8px;">
            <strong style="color:var(--accent);">🦊 Recommandation : Firefox + uBlock Origin</strong>
            <p style="margin-top:4px;font-size:13px;">Nous recommandons fortement d'utiliser Firefox. Bien que le script fonctionne sur Chrome, le bloqueur de publicités uBlock Origin y est beaucoup moins efficace en raison des récentes restrictions de Manifest V3 par Google.</p>
        </div>

        <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
            <strong style="color:#4285F4;">🌍 Navigateurs Chrome / Chromium (Edge, Brave, Opera)</strong>
            <p style="margin-top:4px;font-size:13px;">Vous pouvez également utiliser le script sur les navigateurs basés sur Chromium. Assurez-vous d'installer les extensions appropriées depuis le Chrome Web Store.</p>
        </div>

        <ol style="padding-left:20px;margin:0;display:flex;flex-direction:column;gap:8px; margin-top: 8px;">
            <li>Installez l'extension <strong>Tampermonkey</strong> sur votre navigateur :
                <a href="https://addons.mozilla.org/fr/firefox/addon/tampermonkey/" target="_blank" style="color:var(--accent);">Firefox</a> |
                <a href="https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo" target="_blank" style="color:#4285F4;">Chrome</a>
            </li>
            <li>Installez l'extension <strong>uBlock Origin</strong> :
                <a href="https://addons.mozilla.org/fr/firefox/addon/ublock-origin/" target="_blank" style="color:var(--accent);">Firefox</a> |
                <a href="https://chrome.google.com/webstore/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm" target="_blank" style="color:#4285F4;">Chrome</a>
            </li>
            <li>Cliquez sur le bouton ci-dessous pour installer le script de nettoyage Multivision.</li>
        </ol>
    `;
    modal.appendChild(contentDiv);

    var btn = document.createElement('button');
    btn.className = 'btn g';
    btn.style.cssText = 'padding:12px;font-size:16px;font-weight:bold;justify-content:center;margin-top:8px;';
    btn.innerHTML = 'Installer le Script Multivision';
    btn.onclick = function() {
        window.location.href = './multiview-cleaner.user.js';
    };
    modal.appendChild(btn);

    document.body.appendChild(modal);

    setTimeout(function() {
        var closeListener = function(e) {
            if (!modal.contains(e.target)) {
                modal.remove();
                document.removeEventListener('click', closeListener);
            }
        };
        document.addEventListener('click', closeListener);
    }, 10);
}




// Global bindings for HTML compatibility
window.mvGameModeActive = mvGameModeActive;
window.mvGameModeInterval = mvGameModeInterval;
window.gmCurrentTab = gmCurrentTab;
window.gmPinnedMatches = gmPinnedMatches;
window.globalStatsInterval = globalStatsInterval;
window.currentGlobalStatsMatchId = currentGlobalStatsMatchId;
window.activeMvStatsCards = activeMvStatsCards;
window.toggleMvGameMode = toggleMvGameMode;
window.switchGmTab = switchGmTab;
window.toggleGmPinMatch = toggleGmPinMatch;
window.updateGmScoresTab = updateGmScoresTab;
window.updateGmCurrentTab = updateGmCurrentTab;
window.closePinnedStats = closePinnedStats;
window.openPinnedStats = openPinnedStats;
window.updateMvGameModeStats = updateMvGameModeStats;
window.mvFlux = mvFlux;
window.showFluxSelector = showFluxSelector;
window.showMatchSelector = showMatchSelector;
window.toggleMultiviewPip = toggleMultiviewPip;
window.setupMultivisionUI = setupMultivisionUI;
window.moveMultiviewStream = moveMultiviewStream;
window.saveMultivisionState = saveMultivisionState;
window.restoreMultivisionState = restoreMultivisionState;
window.mvLayout = mvLayout;
window.setMvLayout = setMvLayout;
window.activeMvIdx = activeMvIdx;
window.focusStream = focusStream;
window.applyMvFocusStyling = applyMvFocusStyling;
window.applyMvAudioState = applyMvAudioState;
window.updateMultivisionLayout = updateMultivisionLayout;
window.addToMultivision = addToMultivision;
window.removeFromMultivision = removeFromMultivision;
window.clearMultivision = clearMultivision;
window.hideMultivision = hideMultivision;
window.toggleMultiview = toggleMultiview;
window.toggleTheaterMode = toggleTheaterMode;
window.toggleFullscreen = toggleFullscreen;
window.openFlux = openFlux;
window.applyBgStyle = applyBgStyle;
window.initPrefs = initPrefs;
window.applyUserPrefs = applyUserPrefs;
window.markCustomTheme = markCustomTheme;
window.applyUserBgStyleOnly = applyUserBgStyleOnly;
window.applyPredefinedTheme = applyPredefinedTheme;
window.PALETTES = PALETTES;
window.buildSwatches = buildSwatches;
window.renderSourcesStatus = renderSourcesStatus;
window.renderScrapeLogs = renderScrapeLogs;
window.openOptionsPage = openOptionsPage;
window.openLogsPage = openLogsPage;
window.openScriptPage = openScriptPage;
window.installTampermonkey = installTampermonkey;

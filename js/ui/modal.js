function openMod(m,col){
  document.getElementById('mdot').style.background=col||'#888';
  document.getElementById('mname').textContent=m.homeTeam+' — '+m.awayTeam;
  document.getElementById('mmeta').innerHTML=
    '<span class="mtag">'+m.flag+' '+esc(m.league)+'</span>'
    +'<span class="mtag">'+esc(m.startTime)+'</span>'
    +(m.status==='live'?'<span class="mtag" style="color:var(--red);background:rgba(255,59,59,.1)">🔴 '+(m.minute?esc(m.minute)+"'":'EN DIRECT')+'</span>':'');
  document.getElementById('mscore').innerHTML=m.score?'<div class="msc">'+m.score[0]+'–'+m.score[1]+'</div>':'';

  if (window.modalStatsInterval) { clearInterval(window.modalStatsInterval); window.modalStatsInterval = null; }

  function fetchAndRenderModalStats() {
      if (m.id && (m.id.startsWith('espn_') || m.id.startsWith('api_'))) {
          fetchGameStats(m.id).then(function(res) {
              var scoreCont = document.getElementById('mscore');
              if (!scoreCont || document.getElementById('mname').textContent.indexOf(m.homeTeam) === -1) {
                  if (window.modalStatsInterval) { clearInterval(window.modalStatsInterval); window.modalStatsInterval = null; }
                  return;
              }

              var mHomeId = null, mAwayId = null;
              if (res.data && res.data.header && res.data.header.competitions && res.data.header.competitions[0] && res.data.header.competitions[0].competitors) {
                  var c = res.data.header.competitions[0].competitors;
                  var hC = c.find(function(x) { return x.homeAway === 'home'; });
                  var aC = c.find(function(x) { return x.homeAway === 'away'; });
                  if(hC) mHomeId = hC.id;
                  if(aC) mAwayId = aC.id;
              }

              var extraHtml = '';
              if (res.scorers && res.scorers.length > 0) {
                  extraHtml += renderScorersHtml(res.scorers, m, mHomeId, mAwayId);
              }
              if (res.hRank || res.aRank || res.hForm || res.aForm) {
                  extraHtml += '<div style="display:flex; justify-content:space-between; width:100%; font-size:11px; color:rgba(255,255,255,0.5); margin-top:10px;">';
                  extraHtml += '<div>' + (res.hRank ? '#' + res.hRank + ' ' : '') + (res.hForm ? '[' + res.hForm + ']' : '') + '</div>';
                  extraHtml += '<div>' + (res.aRank ? '#' + res.aRank + ' ' : '') + (res.aForm ? '[' + res.aForm + ']' : '') + '</div>';
                  extraHtml += '</div>';
              }

              var existingStats = document.getElementById('modal-extra-stats');
              if (existingStats) existingStats.remove();

              if (extraHtml) {
                  var stDiv = document.createElement('div');
                  stDiv.id = 'modal-extra-stats';
                  stDiv.style.cssText = 'padding:15px; width:100%; background:rgba(0,0,0,0.2); border-bottom:1px solid rgba(255,255,255,0.05);';
                  stDiv.innerHTML = '<div style="max-width:400px; margin:0 auto;">' + extraHtml + '</div>';
                  // Prepend inside mbody so it spans full width and looks clean before the links
                  var mbody = document.getElementById('mbody');
                  mbody.insertBefore(stDiv, mbody.firstChild);
              }
          }).catch(function(e) {});
      }
  }

  fetchAndRenderModalStats();
  if (window.modalStatsInterval) clearInterval(window.modalStatsInterval);
  if (m.status === 'live') {
      window.modalStatsInterval = setInterval(fetchAndRenderModalStats, 60000);
  }

  var addMvBtn = document.createElement('button');
  addMvBtn.className = 'btn o';
  addMvBtn.style.marginTop = '12px';
  addMvBtn.style.alignSelf = 'flex-start';
  addMvBtn.innerHTML = '⊞ Ajouter au Multivision (Attente du flux)';
  addMvBtn.id = 'mv-add-btn';
  addMvBtn.disabled = true;
  document.getElementById('mmeta').appendChild(addMvBtn);

  var body=document.getElementById('mbody');

  // Wait if streams are still loading, but fetch them specifically if they aren't loading
  if(!m.streamsLoaded && m.matchUrl) {
      body.innerHTML='<div style="text-align:center;padding:20px;color:var(--muted2);">Chargement asynchrone des streams... <span style="font-size: 0.8em; opacity: 0.5;">(Patientez, ne bloque pas)</span></div>';
      document.getElementById('mbg').classList.add('open');

      // Force load the streams for this specific match right away if they aren't loaded yet
      lg('Force loading flux', m.homeTeam);
      scrapeMatchFlux(m).then(function() {
          lg('Force loaded flux ok', m.homeTeam);
          m.streamsLoaded = true;
          if (document.getElementById('mbg').classList.contains('open') && document.getElementById('mname').textContent.indexOf(m.homeTeam) >= 0) {
              openMod(m, col); // Re-render modal only if still open and matching
          }
      }).catch(function(e) {
          lg('Force loaded flux failed', e.message);
          m.streamsLoaded = true;
          if (document.getElementById('mbg').classList.contains('open') && document.getElementById('mname').textContent.indexOf(m.homeTeam) >= 0) {
              openMod(m, col); // Re-render modal only if still open and matching
          }
      });
  } else if(!m.streamsLoaded){
      body.innerHTML='<div style="text-align:center;padding:20px;color:var(--muted2);">Chargement des streams...</div>';
      document.getElementById('mbg').classList.add('open');
  } else {
      var sortedLinks = [];
      if (m.streamLinks && m.streamLinks.length > 0) {
          sortedLinks = sortFluxLinks(m.streamLinks);
      }

      var mvBtn = document.getElementById('mv-add-btn');
      if(mvBtn && sortedLinks.length > 0) {
          mvBtn.disabled = false;
          mvBtn.innerHTML = '⊞ Ajouter au Multivision (' + esc(m.homeTeam) + ')';
          mvBtn.onclick = function() {
              addToMultivision(sortedLinks[0].url, m.homeTeam + ' vs ' + m.awayTeam, m.id);
              closeMod();
          };
      } else if (mvBtn) {
          mvBtn.style.display = 'none';
      }

      var contentHtml = '';
      if (sortedLinks.length === 0) {
          contentHtml = '<div style="text-align:center;padding:20px;color:var(--muted2);">Aucun flux trouvé.<br>';
          if (m.matchUrl) {
              contentHtml += '<a href="'+esc(m.matchUrl)+'" target="_blank" style="color:var(--accent);margin-top:10px;display:inline-block;">Ouvrir la page du match</a>';
          }
          contentHtml += '</div>';
      } else {
          contentHtml = sortedLinks.map(function(s,i){
              return renderFluxItem(s, i, m);
          }).join('');
      }

      // Fallback manual links search
      contentHtml += '<div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">';
      contentHtml += '<details style="color: var(--muted); cursor: pointer;"><summary style="outline:none; font-weight: 500;">Recherche manuelle & Sites de base (Fallback)</summary>';
      contentHtml += '<div style="padding: 10px 0; display: flex; flex-wrap: wrap; gap: 8px;">';

      var searchQuery = encodeURIComponent(m.homeTeam + ' ' + m.awayTeam);
      var singleTeam = encodeURIComponent(m.homeTeam);

      var baseSites = [
          { name: 'Buffstreams', url: 'https://buffstreams.com.co/' },
          { name: 'Footybite', url: 'https://footybite.to/' },
          { name: 'Streameast', url: 'https://naturallyyou.fit/' },
          { name: 'VIPLeague', url: 'https://vipleague.io/' },
          { name: 'Totalsportek', url: 'https://www.totalsportek-real.com/' },
          { name: 'Sportsurge', url: 'https://v2.sportsurge.net/home5/' }
      ];

      baseSites.forEach(function(site) {
          contentHtml += '<a href="'+site.url+'" target="_blank" class="mtag" style="background: rgba(255,255,255,0.05); color: #fff; text-decoration: none;">'+site.name+' 🔗</a>';
      });
      contentHtml += '</div>';

      contentHtml += '<div style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">';
      contentHtml += '<div style="font-size: 12px; margin-bottom: 8px;">Ajouter un flux manuellement au Multiview (m3u8, iframe, url):</div>';
      contentHtml += '<div style="display:flex; gap: 8px;">';
      contentHtml += '<input type="text" id="manual-flux-input" placeholder="https://..." style="flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:4px; padding:6px;">';
      contentHtml += '<button class="btn o" onclick="var v=document.getElementById(\'manual-flux-input\').value; if(v){ addToMultivision(v, \''+escJs(m.homeTeam)+' vs '+escJs(m.awayTeam)+'\', \''+escJs(m.id)+'\'); closeMod(); }">Ajouter ⊞</button>';
      contentHtml += '</div></div>';

      // Look for scraped links that didn't merge
      var unmerged = (S.matches || []).filter(function(x) {
          return x.id.startsWith('scraped_') || x.id.startsWith('bs_') || x.id.startsWith('se_') || x.id.startsWith('ts_') || x.id.startsWith('vip_');
      });
      var possibleMatches = [];
      var mH = normName(m.homeTeam);
      var mA = normName(m.awayTeam);

      unmerged.forEach(function(u) {
          if (u.id === m.id || u.league !== 'Autres Flux') return; // ignore self or already merged ones
          var uH = normName(u.homeTeam);
          var uA = normName(u.awayTeam);
          // Very loose fuzzy match for suggestions
          if (isMatch(mH, uH) || isMatch(mH, uA) || isMatch(mA, uH) || isMatch(mA, uA)) {
              possibleMatches.push(u);
          }
      });

      if (possibleMatches.length > 0) {
          contentHtml += '<div style="margin-top: 15px;">';
          contentHtml += '<div style="font-size: 12px; margin-bottom: 8px; color: var(--accent);">Flux isolés pouvant correspondre :</div>';
          contentHtml += '<div style="display: flex; flex-direction: column; gap: 8px;">';
          possibleMatches.forEach(function(pm) {
              contentHtml += '<div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">';
              contentHtml += '<div style="font-size: 12px;">' + esc(pm.homeTeam) + ' vs ' + esc(pm.awayTeam) + ' <span style="opacity:0.5;">('+esc(pm.source)+')</span></div>';
              if (pm.matchUrl) {
                  contentHtml += '<button class="btn o" style="padding: 4px 8px; font-size: 11px;" onclick="addToMultivision(\''+escJs(pm.matchUrl)+'\', \''+escJs(pm.homeTeam)+' vs '+escJs(pm.awayTeam)+'\', \''+escJs(pm.id)+'\'); closeMod();">Lancer ⊞</button>';
              }
              contentHtml += '</div>';
          });
          contentHtml += '</div></div>';
      }

      contentHtml += '</details></div>';

      body.innerHTML = contentHtml;
      document.getElementById('mbg').classList.add('open');
  }
}
function closeMod(){
  document.getElementById('mbg').classList.remove('open');
  window.multiviewPendingAction = null;
  if (window.modalStatsInterval) { clearInterval(window.modalStatsInterval); window.modalStatsInterval = null; }
}

/* ══ MULTIVISION (SPLIT SCREEN) ═════════ */

/* ══ MULTIVIEW GAME MODE ═══════════════ */
var mvGameModeActive = false;
var mvGameModeInterval = null;
var gmCurrentTab = 'stats'; // 'stats' | 'scores'
var gmPinnedMatches = JSON.parse(localStorage.getItem('gmPinnedMatches') || '[]');
var globalStatsInterval = null;
var currentGlobalStatsMatchId = null;
var activeMvStatsCards = [];

function toggleMvGameMode() {
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

function switchGmTab(tab) {
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

function toggleGmPinMatch(matchId, e) {
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

function updateGmScoresTab() {
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

        var scoreStr = m.score ? (m.score[0] + ' - ' + m.score[1]) : 'À venir';
        var timeStr = (m.status === 'live' && m.minute) ? m.minute + "'" : m.startTime;
        var statusColor = m.status === 'live' ? 'var(--accent)' : 'var(--muted)';

        html += '<div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:10px; display:flex; align-items:center; gap:10px;">';

        html += '<div style="flex:1;">';
        html += '<div style="font-size:11px; color:var(--muted); margin-bottom:4px;">' + m.flag + ' ' + esc(m.league) + '</div>';

        html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">';
        html += '<div style="font-size:13px; font-weight:bold; color:#fff; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(m.homeTeam) + '</div>';
        html += '<div style="font-size:14px; font-weight:bold; color:' + statusColor + '; min-width:30px; text-align:right;">' + (m.score ? m.score[0] : '-') + '</div>';
        html += '</div>';

        html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
        html += '<div style="font-size:13px; font-weight:bold; color:#fff; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(m.awayTeam) + '</div>';
        html += '<div style="font-size:14px; font-weight:bold; color:' + statusColor + '; min-width:30px; text-align:right;">' + (m.score ? m.score[1] : '-') + '</div>';
        html += '</div>';

        html += '<div style="font-size:11px; color:' + statusColor + '; margin-top:4px; text-align:right;">' + timeStr + '</div>';
        html += '</div>'; // End flex:1

        html += '<button onclick="toggleGmPinMatch(\'' + m.id + '\', event)" style="background:none; border:none; cursor:pointer; font-size:16px; color:' + pinColor + '; padding:5px; transition:transform 0.2s;" onmouseover="this.style.transform=\'scale(1.2)\'" onmouseout="this.style.transform=\'none\'" title="Épingler le match">' + pinIcon + '</button>';

        html += '</div>'; // End card
    });

    html += '</div>';
    content.innerHTML = html;
}

function updateGmCurrentTab() {
    if (gmCurrentTab === 'stats') {
        updateMvGameModeStats();
    } else {
        updateGmScoresTab();
    }
}

function closePinnedStats(matchId) {
    var idx = activeMvStatsCards.indexOf(String(matchId));
    if (idx > -1) {
        activeMvStatsCards.splice(idx, 1);
        updateMvGameModeStats();
    }
}

function openPinnedStats(matchId) {
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

function updateMvGameModeStats() {
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
                var scoreStr = pm.score ? (pm.score[0] + ' - ' + pm.score[1]) : 'À venir';
                var timeStr = (pm.status === 'live' && pm.minute) ? pm.minute + "'" : pm.startTime;
                var statusColor = pm.status === 'live' ? 'var(--accent)' : 'var(--muted)';
                pinnedHtml += '<div onclick="openPinnedStats(\'' + pm.id + '\')" style="background:rgba(255,255,255,0.05); border-radius:8px; padding:10px; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\'">';
                pinnedHtml += '<div style="font-size:11px; color:var(--muted); margin-bottom:4px;">' + pm.flag + ' ' + esc(pm.league) + '</div>';
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
        carouselHtml += (m.score ? '<div style="font-size:24px; font-weight:bold; color:var(--accent); text-align:center;">' + m.score[0] + ' - ' + m.score[1] + '</div>' : '<div style="text-align:center; color:var(--muted);">À venir</div>');
        carouselHtml += '<div style="font-size:12px; color:var(--muted); text-align:center;">' + m.flag + ' ' + esc(m.league) + ' | ' + esc(m.startTime) + (m.status === 'live' && m.minute ? ' • ' + esc(m.minute) + "\'" : '') + '</div>';

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
                                 '<span>' + hRankFormStr + '</span><span>' + aRankFormStr + '</span></div>' +
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
            } else if (res.source === 'api-sports' && res.data.statistics) {
                var sData = res.data.statistics;
                if(sData.length === 2) {
                    var sHome = sData[0].statistics;
                    var sAway = sData[1].statistics;
                    sHome.forEach(sh => {
                        var sa = sAway.find(x => x.type === sh.type);
                        if(sa && sh.value !== null && sa.value !== null) {
                            stats.push({label: sh.type, h: sh.value, a: sa.value});
                        }
                    });
                }
            }

            if(stats.length > 0) {
                html += '<h4 style="color:#fff;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">Statistiques</h4>';
                html += '<div style="display:flex;flex-direction:column;gap:8px;background:rgba(255,255,255,0.02);padding:10px;border-radius:12px;">';
                stats.forEach(function(st) {
                    var label = formatStatLabel(st.label);
                    html += '<div style="display:flex;justify-content:space-between;font-size:12px;align-items:center;">';
                    html += '<span style="font-weight:bold;width:30px;text-align:right;">'+st.h+'</span>';
                    html += '<span style="color:var(--muted);flex:1;text-align:center;">'+label+'</span>';
                    html += '<span style="font-weight:bold;width:30px;text-align:left;">'+st.a+'</span>';
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

var mvFlux = [];


/* ══ MULTIVISION STREAM SELECTOR ════════ */
function showFluxSelector(idx, mid, event) {
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

            var score = sm.score ? '<div style="font-size:13px; font-weight:bold; color:var(--accent); display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px;flex-shrink:0;"><span>'+sm.score[0]+'</span><span>'+sm.score[1]+'</span></div>' : '';

            btn.innerHTML = thumb +
                '<div style="flex:1; overflow:hidden;">' +
                    '<div style="font-size:10px; color:var(--red); font-weight:bold; margin-bottom:2px;">🔴 '+(sm.minute?esc(sm.minute)+"'":'EN DIRECT')+' <span style="color:var(--muted); font-weight:normal; margin-left:4px;">'+sm.flag+' '+esc(sm.league)+'</span></div>' +
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
function showMatchSelector(event, replaceIdx) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    var existing = document.getElementById('mv-match-selector');
    if (existing) {
        existing.remove();
        return;
    }

    if (replaceIdx === undefined && mvFlux.length >= 9) {
        showToast('Maximum 9 streams en Multivision.');
        return;
    }

    var isReplace = replaceIdx !== undefined;

    var selector = document.createElement('div');
    selector.id = 'mv-match-selector';
    selector.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:var(--bg);display:flex;flex-direction:column;';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;padding:16px;background:rgba(20,20,20,0.95);border-bottom:1px solid rgba(255,255,255,0.1);position:sticky;top:0;z-index:10;';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'btn o';
    closeBtn.innerHTML = '<span class="ic ic-close"></span>';
    closeBtn.onclick = function() { selector.remove(); };
    header.appendChild(closeBtn);

    var title = document.createElement('div');
    title.style.cssText = 'flex:1;text-align:center;font-weight:bold;font-size:18px;color:var(--text);';
    title.textContent = isReplace ? 'Remplacer le stream' : 'Ajouter un match';
    header.appendChild(title);

    var spacer = document.createElement('div');
    spacer.style.width = '40px';
    header.appendChild(spacer);

    selector.appendChild(header);

    var scrollArea = document.createElement('div');
    scrollArea.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px;';

    var now = new Date();
    var currentEst = getEstTimeStrFromDate(now);
    var currentParts = currentEst.split(':');
    var currentMins = parseInt(currentParts[0], 10) * 60 + parseInt(currentParts[1], 10);

    var availableMatches = S.matches.filter(function(m) {
        if (!m.streamsLoaded || !m.streamLinks || m.streamLinks.length === 0) return false;

        var isLiveOrSoon = m.status === 'live';
        if(m.status === 'upcoming' && m.startTime) {
            var mParts = m.startTime.split(':');
            var mMins = parseInt(mParts[0], 10) * 60 + parseInt(mParts[1], 10);
            var diff = mMins - currentMins;
            if (currentMins >= 1380 && mMins <= 60) diff += 1440; // wrap around
            if (diff <= 60 && diff > -1440) {
                isLiveOrSoon = true;
            }
        }
        return isLiveOrSoon;
    });

    availableMatches.sort(function(a, b) {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (a.status !== 'live' && b.status === 'live') return 1;
        return a.startTime.localeCompare(b.startTime);
    });

    if (availableMatches.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 'padding:20px;text-align:center;color:var(--muted);font-size:14px;';
        empty.innerHTML = 'Aucun flux disponible pour le moment.<br><br>Astuce: Ouvrez un match dans le guide TV pour charger ses streams.';
        scrollArea.appendChild(empty);
    } else {
        var grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:12px;';

        availableMatches.forEach(function(m) {
            var alreadyIn = mvFlux.some(function(s) { return String(s.mid) === String(m.id); });
            if (alreadyIn && !isReplace) return;
            if (alreadyIn && isReplace && String(mvFlux[replaceIdx].mid) === String(m.id)) return;

            var b = document.createElement('div');
            b.className = 'match-card' + (m.status==='live' ? ' live' : '') + (m.status==='finished' ? ' finished' : '');
                  b.id = 'mb-'+m.id;

            var homeTeamName = normName(m.homeTeam) || 'A';
            var awayTeamName = normName(m.awayTeam) || 'B';
            var homeColor = lgColor(homeTeamName);
            var awayColor = lgColor(awayTeamName);
            var lgCol = lgColor(m.league);

            var tColorsH = getTeamColors(m.homeTeam);
            var tColorsA = getTeamColors(m.awayTeam);
            if (tColorsH) homeColor = tColorsH[0];
            if (tColorsA) awayColor = tColorsA[0];

            var cardBg = '';
            if (userPrefs.cardColor === 'home') {
                cardBg = homeColor;
            } else if (userPrefs.cardColor === 'league') {
                cardBg = lgCol;
            } else if (userPrefs.cardColor === 'dark') {
                cardBg = 'rgba(255,255,255,0.05)';
            } else {
                cardBg = 'linear-gradient(105deg, ' + homeColor + ' 53%, ' + awayColor + ' 53%)';
            }

            var statusHtml = '';
            if(m.status === 'live') {
                statusHtml = '<div class="live-indicator"><span class="mb-ld"></span>'+(m.minute?esc(m.minute):'LIVE')+'</div>';
            } else if(m.status === 'finished') {
                statusHtml = '<div>Fin</div>';
            } else {
                statusHtml = '<div>'+m.startTime+'</div>';
            }

            var homeScore = m.score && typeof m.score[0] !== 'undefined' ? m.score[0] : '';
            var awayScore = m.score && typeof m.score[1] !== 'undefined' ? m.score[1] : '';

            var homeLogoUrl = m.homeLogo || getLogo(m.homeTeam);
            var awayLogoUrl = m.awayLogo || getLogo(m.awayTeam);

            var homeLogoHtmlPrime = homeLogoUrl ? '<img src="'+esc(homeLogoUrl)+'" class="prime-logo" onerror="this.style.display=\'none\'" alt="'+esc(m.homeTeam)+'">' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>';
            var awayLogoHtmlPrime = awayLogoUrl ? '<img src="'+esc(awayLogoUrl)+'" class="prime-logo" onerror="this.style.display=\'none\'" alt="'+esc(m.awayTeam)+'">' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>';

            var streamsBadgePrime = m.streamLinks && m.streamLinks.length>0 ? '<div class="prime-stream-count">'+m.streamLinks.length+' flux</div>' : '';
            var lgBadge = '<div class="prime-league-badge">'+lgFlag(m.league)+'</div>';

            var logosHtml = m.awayTeam ?
                            '<div class="prime-logo-wrapper home">' + homeLogoHtmlPrime + '</div><div class="prime-logo-wrapper away">' + awayLogoHtmlPrime + '</div>' :
                            '<div class="prime-logo-wrapper home" style="width: 100%; display: flex; justify-content: center;">' + homeLogoHtmlPrime + '</div>';

            var teamsHtml = m.awayTeam ?
                            '<div class="prime-team-name" title="'+esc(m.homeTeam)+'">'+esc(m.homeTeam)+'</div><div class="prime-team-name" title="'+esc(m.awayTeam)+'">'+esc(m.awayTeam)+'</div>' :
                            '<div class="prime-team-name" style="text-align: center; justify-content: center;" title="'+esc(m.homeTeam)+'">'+esc(m.homeTeam)+'</div>';

            var scoresHtml = m.awayTeam ?
                            '<div class="prime-score">'+homeScore+'</div><div class="prime-score">'+awayScore+'</div>' :
                            '<div class="prime-score"></div>';

            b.innerHTML = '<div class="prime-thumbnail" style="background:'+cardBg+';">'
                        +   lgBadge
                        +   streamsBadgePrime
                        +   '<div class="prime-logos">'
                        +     logosHtml
                        +   '</div>'
                        + '</div>'
                        + '<div class="prime-info">'
                        +   '<div class="prime-col-teams">'
                        +     teamsHtml
                        +   '</div>'
                        +   '<div class="prime-col-scores">'
                        +     scoresHtml
                        +   '</div>'
                        +   '<div class="prime-col-status">'
                        +     statusHtml
                        +   '</div>'
                        + '</div>';

            b.addEventListener('click', function(e) {
                e.stopPropagation();
                selector.remove();
                window.multiviewPendingAction = {
                    type: isReplace ? 'replace' : 'add',
                    replaceIdx: replaceIdx
                };
                openMod(m, lgCol);
            });
            grid.appendChild(b);
        });
        scrollArea.appendChild(grid);
    }

    selector.appendChild(scrollArea);
    document.body.appendChild(selector);
}



function toggleMultiviewPip() {
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
            mvc.style.cssText = 'position:fixed;top:70px;right:0;bottom:0;width:350px;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);z-index:90;display:flex;flex-direction:column;border-left:1px solid var(--border);box-shadow:-5px 0 20px rgba(0,0,0,0.5);';
            epg.style.display = 'flex';
            epg.style.paddingRight = '350px';
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
            var ls = document.getElementById('mv-layout-select');
            if (ls) ls.value = 'vertical';
            saveMultivisionState();
            updateMultivisionLayout();
        }
    }
});



function setupMultivisionUI() {
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
      + '<select class="nav-btn hide-pip" onchange="mvLayout=this.value; saveMultivisionState(); updateMultivisionLayout();" style="padding: 8px 32px 8px 12px; min-width: auto; height: 38px; -webkit-appearance: none; appearance: none; background: url(\'data:image/svg+xml;utf8,<svg fill=%22white%22 height=%2224%22 viewBox=%220 0 24 24%22 width=%2224%22 xmlns=%22http://www.w3.org/2000/svg%22><path d=%22M7 10l5 5 5-5z%22/><path d=%22M0 0h24v24H0z%22 fill=%22none%22/></svg>\') no-repeat right 4px center; background-size: 16px;" id="mv-layout-select">'
      +   '<option value="auto">⊞ Auto</option>'
      +   '<option value="focus">⭐ Focus</option>'
      +   '<option value="vertical">⊟ Vertical</option>'
      +   '<option value="horizontal">⊟ Horizontal</option>'
      + '</select>'
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

    // Removed Multivision Idle Timer for Auto-Hide (keep toolbar and headers visible)
    mvContainer.addEventListener('mousemove', function() {
        var tb = document.getElementById('mv-toolbar');
        if (tb) { tb.style.opacity = '1'; tb.style.pointerEvents = 'auto'; }
        mvContainer.style.cursor = 'default';

        // Show all cell headers
        var hdrs = mvContainer.querySelectorAll('.mv-hdr');
        hdrs.forEach(function(h) { h.style.opacity = '1'; h.style.pointerEvents = 'auto'; });
    });

}



function moveMultiviewStream(idx, direction) {
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
function saveMultivisionState() {
    try {
        localStorage.setItem('mv_state', JSON.stringify({
            flux: mvFlux,
            layout: mvLayout
        }));
    } catch(e) {}
}

function restoreMultivisionState() {
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
var mvLayout = 'auto'; // auto, focus, vertical, horizontal, custom
var activeMvIdx = null;

function focusStream(idx) {
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

function applyMvFocusStyling() {
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

function applyMvAudioState() {
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


function updateMultivisionLayout() {
    var ls = document.getElementById('mv-layout-select');
    if(ls) ls.value = mvLayout;
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { openMod, showFluxSelector, showMatchSelector };
}

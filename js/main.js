import { matchCardCache, S, addScrapeLog, updateSourceStatus, customLgOrder, setCustomLgOrder, favTeams, toggleFavTeam, saveCustomLgOrder } from './state.js';
import { esc, showToast, fetchPage, applySportFilter, escJs, toggleAutresFlux, lg } from './utils.js';
import { setupMultivisionUI, installTampermonkey } from './multiview.js';
import { getApiFirstMatches, TARGET_DATE, mergeFluxToApi, getEspnDateStr } from './api.js';
import { getEstDateStrFromDate, SITE, MLBITE_URL, SPORTSURGE_URL, BUFFSTREAMS_URL, STREAMEAST_URL, ONHOCKEY_URL, MLBBITE_PLUS_URL, VIPLEAGUE_URL, METHSTREAMS_URL, TOTALSPORTEK_URL } from './config.js';
import { lgFlag, STATIC_TEAMS, getLogo, normName, TEAM_ALIASES } from './db.js';
import { parseFootybite, parseNflbite, parseSportsurge, parseBuffstreams, parseStreameast, parseOnHockey, parseMlbbite, parseVipleague, parseMethstreams, parseTotalsportek, updateMatchUiAfterScrape, fetchSubPages } from './scrapers.js';
import { mergeMatches } from './match.js';
import { buildEPG, scrollToNow } from './ui.js';

/* ══ MAIN ═══════════════════════════════ */

export function stepOk(n) {
  var el = document.getElementById('s' + n);
  if (!el) return;
  el.style.opacity = '1';
  el.style.color = '#fff';
  var ic = el.querySelector('.sic');
  if (ic) {
    ic.classList.add('ok');
    ic.innerHTML = '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/></svg>';
  }
  var next = document.getElementById('s' + (n + 1));
  if (next) {
    next.style.opacity = '1';
  }
}

export function updateLiveScores(matches) {
    matches.forEach(function(m) {
        // Update main card, live copy, and fav copy
        var cardIds = ['mb-' + m.id, 'mb-' + m.id + '_live_copy', 'mb-' + m.id + '_fav_copy'];

        cardIds.forEach(function(cid) {
            var cached = matchCardCache.get(cid);
            if (!cached) {
                var card = document.getElementById(cid);
                if (card) {
                    cached = {
                        el: card,
                        minEl: card.querySelector('.status-minute'),
                        scoreEls: card.querySelectorAll('.prime-score')
                    };
                    matchCardCache.set(cid, cached);
                }
            }

            if (cached) {
                var card = cached.el;
                var minEl = cached.minEl;
                // Update time/status
                if (minEl) {
                    if (m.status === 'live') {
                        minEl.textContent = m.minute || 'LIVE';
                        var ind = card.querySelector('.live-indicator');
                        if (!ind) {
                            minEl.parentElement.className = 'live-indicator status-text';
                            minEl.parentElement.innerHTML = '<span class="mb-ld"></span><span class="status-minute">'+esc(m.minute||'LIVE')+'</span>';
                            // Re-cache minEl because innerHTML replacement
                            cached.minEl = card.querySelector('.status-minute');
                        }
                        card.classList.add('live');
                        card.classList.remove('finished');
                    } else if (m.status === 'finished') {
                        minEl.textContent = 'Fin';
                        minEl.parentElement.className = 'status-text';
                        var ld = minEl.parentElement.querySelector('.mb-ld');
                        if (ld) ld.remove();
                        card.classList.remove('live');
                        card.classList.add('finished');
                    } else {
                        minEl.textContent = m.startTime || '';
                    }
                }

                // Update scores
                var scoreEls = cached.scoreEls;
                if (scoreEls && scoreEls.length === 2) {
                    if (m.score && m.score.length === 2) {
                        scoreEls[0].textContent = m.score[0];
                        scoreEls[1].textContent = m.score[1];
                    } else {
                        scoreEls[0].textContent = '';
                        scoreEls[1].textContent = '';
                    }
                }
            }
        });
    });
}

export function loadAll(isBackground, forceScrape){
  if (!isBackground) { S.log=[];S.raw='';S.matches=[];S.proxy=''; }
  setupMultivisionUI();

  var btn=document.getElementById('relBtn');if(btn) btn.disabled=true;
  var errbox = document.getElementById('errbox'); if(errbox) errbox.classList.remove('show');
  if (!isBackground && !window.hasLoadedOnce) {
      var ovElement = document.getElementById('ov');
      var errBoxElement = document.getElementById('errbox');
      var marea2 = document.getElementById('marea'); if(marea2) marea2.innerHTML = '';
      if (ovElement) document.getElementById('marea').appendChild(ovElement); // Move ov to marea
      if (errBoxElement) document.getElementById('marea').appendChild(errBoxElement); // Move errbox to marea
      if (ovElement) ovElement.style.display='flex';
      [1,2,3].forEach(function(n){
        var el=document.getElementById('s'+n);if(!el)return;
        el.style.opacity=n===1?'1':'.4';el.style.color='';
        var ic=el.querySelector('.sic');ic.classList.remove('ok');
        ic.innerHTML='<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
      });
      var ovmsg = document.getElementById('ovmsg'); if(ovmsg) ovmsg.textContent='Connexion au Guide télé (API)...';
      var s1 = document.getElementById('s1'); if(s1 && s1.querySelector('span')) s1.querySelector('span').textContent = 'Téléchargement Guide télé Officiel';
      var s2 = document.getElementById('s2'); if(s2 && s2.querySelector('span')) s2.querySelector('span').textContent = 'Recherche de streams...';
      var s3 = document.getElementById('s3'); if(s3 && s3.querySelector('span')) s3.querySelector('span').textContent = 'Fusion et Affichage';
  } else {
      showToast('Actualisation des matchs en arrière-plan...');
      // Ensure it is definitely hidden if we've already loaded once
      document.getElementById('ov').style.display='none';
  }

  getApiFirstMatches(TARGET_DATE).then(function(apiMatches) {
      if (!isBackground) { stepOk(1);  }


      // Async scrape sites
      var nowTime = Date.now();
      var skipScraping = !forceScrape && (nowTime - window.lastScrapeTime < 15 * 60 * 1000) && window.hasLoadedOnce;

      if (skipScraping) {
                    // Just merge with existing scrapedMatches and update API
          var finalMatches = mergeFluxToApi(apiMatches, window.lastScrapedMatches || [], true);

          // Persist the updated scores/statuses back to cache even when skipping scraping
          try {
              var todayStr = getEspnDateStr(TARGET_DATE);
              var cacheRaw = localStorage.getItem('api_calendar_cache');
              var cache = cacheRaw ? JSON.parse(cacheRaw) : null;
              var fetchDateToSave = todayStr;
              if (cache && cache.fetchDate) fetchDateToSave = cache.fetchDate;

              localStorage.setItem('api_calendar_cache', JSON.stringify({
                  fetchDate: fetchDateToSave,
                  matches: finalMatches
              }));
          } catch(e) {}

          var targetDateStr = getEstDateStrFromDate(TARGET_DATE);
          S.matches = finalMatches.filter(function(m) {
              return m.matchDate === targetDateStr;
          });
          updateLiveScores(S.matches); // New function to update scores smoothly
          if (!isBackground) { document.getElementById('ov').style.display='none'; }
          return Promise.reject('SKIP_SCRAPING_SUCCESS'); // Reject to skip the rest of the promise chain cleanly
      }

            return Promise.allSettled([
          fetchPage(SITE),
          fetchPage(MLBITE_URL),
          fetchPage(SPORTSURGE_URL),
          fetchPage(BUFFSTREAMS_URL),
          fetchPage(STREAMEAST_URL),
          fetchPage(ONHOCKEY_URL),
          fetchPage(MLBBITE_PLUS_URL),
          fetchPage(VIPLEAGUE_URL),
          fetchPage(METHSTREAMS_URL),
          fetchPage(TOTALSPORTEK_URL)
      ]).then(function(results) {
          if (!results) return;
          if (!isBackground) { stepOk(2);  }


          // Check for failures and notify user
          var sources = [SITE, MLBITE_URL, SPORTSURGE_URL, BUFFSTREAMS_URL, STREAMEAST_URL, ONHOCKEY_URL, MLBBITE_PLUS_URL, VIPLEAGUE_URL, METHSTREAMS_URL, TOTALSPORTEK_URL];
          results.forEach(function(r, idx) {
              if (r.status === 'rejected') {
                  var domain = new URL(sources[idx]).hostname;
                  console.error('Failed to fetch:', sources[idx], r.reason);
                  var errMsg = (r.reason && r.reason.message ? r.reason.message : 'Échec de la connexion');
                  addScrapeLog(sources[idx], 'error', errMsg);
                  updateSourceStatus(domain, 'error', 0, errMsg);
                  setTimeout(function() { showToast('Échec de la connexion à ' + domain); }, idx * 1000);
              } else {
                  addScrapeLog(sources[idx], 'success', '');
              }
          });

          var scrapedMatches = [];

          var tasks = [
              { fn: parseFootybite, url: SITE, setRaw: true },
              { fn: parseNflbite, url: MLBITE_URL },
              { fn: parseSportsurge, url: SPORTSURGE_URL },
              { fn: parseBuffstreams, url: BUFFSTREAMS_URL },
              { fn: parseStreameast, url: STREAMEAST_URL },
              { fn: parseOnHockey, url: ONHOCKEY_URL },
              { fn: parseMlbbite, url: MLBBITE_PLUS_URL },
              { fn: parseVipleague, url: VIPLEAGUE_URL },
              { fn: parseMethstreams, url: METHSTREAMS_URL },
              { fn: parseTotalsportek, url: TOTALSPORTEK_URL }
          ];

          var p = Promise.resolve();

          tasks.forEach(function(task, idx) {
              p = p.then(function() {
                  return new Promise(function(resolve) {
                      setTimeout(function() {
                          if (results[idx] && results[idx].status === 'fulfilled' && results[idx].value) {
                              if (task.setRaw) S.raw = results[idx].value;
                              try {
                                  var m = task.fn(results[idx].value);
                                  updateSourceStatus(new URL(task.url).hostname, 'success', m.length, 'OK');
                                  scrapedMatches = mergeMatches(scrapedMatches, m);
                              } catch(e) {
                                  console.error('Error parsing ' + task.url, e);
                              }
                          }
                          resolve();
                      }, 0);
                  });
              });
          });

          return p.then(function() {
              var finalMatches = mergeFluxToApi(apiMatches, scrapedMatches, false);

          window.lastScrapeTime = Date.now();
          window.lastScrapedMatches = scrapedMatches;

          // Persist the merged data (which now includes streams) back to localStorage
          try {
              var todayStr = getEspnDateStr(TARGET_DATE);
              var cacheRaw = localStorage.getItem('api_calendar_cache');
              var cache = cacheRaw ? JSON.parse(cacheRaw) : null;
              var fetchDateToSave = todayStr;
              if (cache && cache.fetchDate) fetchDateToSave = cache.fetchDate;

              localStorage.setItem('api_calendar_cache', JSON.stringify({
                  fetchDate: fetchDateToSave,
                  matches: finalMatches
              }));
          } catch(e) {
              console.error('Failed to cache merged calendar:', e);
          }

                    var targetDateStr = getEstDateStrFromDate(TARGET_DATE);
          S.matches = finalMatches.filter(function(m) {
              return m.matchDate === targetDateStr;
          });
          if (!isBackground) { document.getElementById('ov').style.display='none'; }

          // Populate sports filter
          var sports = {};
          S.matches.forEach(function(m){ sports[m.league]=true; });
          var sportNames = Object.keys(sports).sort();
          var sf = document.getElementById('sport-filters');
          if(sf){
              var anyHidden = false;
              Object.keys(S.hiddenLg).forEach(function(k) {
                  if (k !== 'Autres Flux' && S.hiddenLg[k]) anyHidden = true;
              });
              var isAllSel = !anyHidden;

              var optionsHtml = '<button class="btn sport-btn '+(isAllSel?'active-toggle':'')+'" onclick="applySportFilter(\'all\');">Tous les sports</button>';
              sportNames.forEach(function(sp){
                  if (sp !== 'EN DIRECT' && sp !== 'Autres Flux') {
                      var isSel = !S.hiddenLg[sp];
                      optionsHtml += '<button class="btn sport-btn '+(isSel?'active-toggle':'')+'" onclick="applySportFilter(\''+escJs(sp)+'\');"><span style="margin-right:4px;">'+lgFlag(sp)+'</span> '+esc(sp)+'</button>';
                  }
              });
              // Add a toggle for 'Autres Flux' at the end if it exists in matches
              if (sports['Autres Flux']) {
                  var isAutresFluxVisible = !S.hiddenLg['Autres Flux'];
                  optionsHtml += '<div style="width:1px; background:rgba(255,255,255,0.1); margin:4px 8px;"></div>'; // separator
                  optionsHtml += '<button id="btn-autres-flux" class="btn sport-btn '+(isAutresFluxVisible?'active-toggle':'')+'" onclick="toggleAutresFlux();" style="border:1px dashed var(--border2) !important;"><span style="margin-right:4px;">📡</span> Autres Flux</button>';
              }
              sf.innerHTML = optionsHtml;
          }

          setTimeout(function() {
              if (isBackground && window.hasLoadedOnce) {
                  updateLiveScores(S.matches);

                  // Process UI updates asynchronously in chunks to prevent blocking the UI thread
                  var i = 0;
                  function processChunk() {
                      var chunkEnd = Math.min(i + 20, S.matches.length);
                      for (; i < chunkEnd; i++) {
                          updateMatchUiAfterScrape(S.matches[i]);
                      }
                      if (i < S.matches.length) {
                          setTimeout(processChunk, 0);
                      } else {
                          fetchSubPages(S.matches);
                      }
                  }
                  processChunk();

              } else {
                  buildEPG(S.matches);
                  fetchSubPages(S.matches);
              }
                        }, 0);
          var live=S.matches.filter(function(m){return m.status==='live';}).length;
          showToast(S.matches.length+' matchs'+(live?' · '+live+' live':''));
          });
      });
  }).catch(function(err){
      if (err === 'SKIP_SCRAPING_SUCCESS') return; // Smooth update finished, no errors to show
      if (!isBackground) { document.getElementById('ov').style.display='none'; }
      var lines=(err.message||'Erreur').split('\n');
      document.getElementById('errmsg').textContent=lines[0];
      var ec=document.getElementById('errcode');
      if(lines.length>1){ec.textContent=lines.slice(1).join('\n');ec.style.display='block';}
      document.getElementById('errbox').classList.add('show');
  }).finally(function(){
      if(btn) btn.disabled=false;
            if (!isBackground) { document.getElementById('ov').style.display='none'; }
      if (!localStorage.getItem('hasSeenScriptModal')) {
          localStorage.setItem('hasSeenScriptModal', 'true');
          setTimeout(function() { installTampermonkey(); }, 500);
      }
      window.hasLoadedOnce = true;
  });
}


/* ══ INIT ═══════════════════════════════ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.error('SW registration failed: ', err);
    });
  });
}


(function(){
  var n = new Date();
  var todayStr = getEspnDateStr(TARGET_DATE);
  var cacheRaw = localStorage.getItem('api_calendar_cache');
  var cache = cacheRaw ? JSON.parse(cacheRaw) : null;

  if (cache && cache.fetchDate === todayStr && cache.matches && cache.matches.length > 0) {
            S.matches = cache.matches.filter(function(m) {
          return m.matchDate === getEstDateStrFromDate(TARGET_DATE);
      });
      if (S.matches.length > 0) {
          setTimeout(function() { buildEPG(S.matches); }, 0);
      }
      if (!localStorage.getItem('hasSeenScriptModal')) {
          localStorage.setItem('hasSeenScriptModal', 'true');
          setTimeout(function() { installTampermonkey(); }, 500);
      }
      loadAll(true, true); // background update for fresh streams/stats
  } else {
      loadAll(window.hasLoadedOnce, true);
  }

  // Background auto-update every 60 seconds
  setInterval(function() {
      if (window.hasLoadedOnce) {
          loadAll(true, false);
      }
  }, 60000);
})();









export function toggleSportFilters(e) {
    if (e) e.stopPropagation();
    var sf = document.getElementById('sport-filters');
    if(sf) {
        sf.classList.toggle('open');
    }
}


// Close menus when clicking elsewhere
document.addEventListener('click', function(e) {
    var mvActions = document.getElementById('mv-actions-menu');
    var mvBtn = document.getElementById('mv-menu-btn');
    if(mvActions && mvActions.classList.contains('open') && !mvActions.contains(e.target) && (!mvBtn || !mvBtn.contains(e.target))) {
        mvActions.classList.remove('open');
    }

    var layoutDropdown = document.getElementById('mv-layout-dropdown');
    var layoutToggleBtn = document.getElementById('mv-layout-toggle-btn');
    if(layoutDropdown && layoutDropdown.style.display === 'flex' && !layoutDropdown.contains(e.target) && (!layoutToggleBtn || !layoutToggleBtn.contains(e.target))) {
        layoutDropdown.style.display = 'none';
    }
});

export var appTheaterTimer;

// Menu toggle logic
export function toggleMenu(e) {
  if (e) e.stopPropagation();
  var menu = document.getElementById('main-menu');
  var btn = document.getElementById('menu-btn');
  if (menu) {
      menu.classList.toggle('open');
      // Remove inline display style to let CSS handle it via !important
      menu.style.display = '';
      if (menu.classList.contains('open')) {
          if (btn) btn.innerHTML = '✕';
      } else {
          if (btn) btn.innerHTML = '☰';
      }
  }
}

// Close menu when clicking outside
document.addEventListener('click', function(e) {
  var menu = document.getElementById('main-menu');
  var btn = document.getElementById('menu-btn');
  if (menu && menu.classList.contains('open') && e.target !== btn && !btn.contains(e.target) && !menu.contains(e.target)) {
      menu.style.display = '';
      menu.classList.remove('open');
      if (btn) btn.innerHTML = '☰';
  }
});



// --- ZOOM SYSTEM ---
export var currentZoomLevel = 1.0;

export function updateZoomDisplay() {
    var display = document.getElementById('zoom-level-display');
    if (display) {
        display.textContent = Math.round(currentZoomLevel * 100) + '%';
    }
}

export function zoomIn() {
    if (currentZoomLevel < 3.0) {
        currentZoomLevel += 0.2;
        document.documentElement.style.setProperty('--zoom-level', currentZoomLevel);
        updateZoomDisplay();
        scrollToNow(); // Re-center
    }
}

export function zoomOut() {
    if (currentZoomLevel > 0.4) {
        currentZoomLevel -= 0.2;
        document.documentElement.style.setProperty('--zoom-level', currentZoomLevel);
        updateZoomDisplay();
        scrollToNow(); // Re-center
    }
}

// Ensure the initial zoom displays correctly
document.addEventListener('DOMContentLoaded', updateZoomDisplay);


export function openFavPage() {
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
    if (scriptPage) scriptPage.style.display = 'none';

    var favPage = document.getElementById('fav-page');
    if (favPage) {
        favPage.style.display = 'flex';
        renderFavPage();
    }
}


export var DEFAULT_LEAGUES = {
    'NHL': { icon: '🏒' },
    'NFL': { icon: '🏈' },
    'MLB': { icon: '⚾' },
    'NBA': { icon: '🏀' },
    'PREMIER LEAGUE': { icon: '⚽' },
    'CHAMPIONS LEAGUE': { icon: '⚽' },
    'F1': { icon: '🏎️' },
    'LIGUE 1': { icon: '⚽' },
    'LA LIGA': { icon: '⚽' },
    'SERIE A': { icon: '⚽' },
    'BUNDESLIGA': { icon: '⚽' },
    'MLS': { icon: '⚽' },
    'PWHL': { icon: '🏒' },
    'LHJMQ': { icon: '🏒' },
    'AHL': { icon: '🏒' }
};

export function getLeagueIcon(lgName) {
    if(!lgName) return '🏆';
    var norm = lgName.toUpperCase();
    if(DEFAULT_LEAGUES[norm]) return DEFAULT_LEAGUES[norm].icon;
    if(norm.indexOf('HOCKEY') > -1 || norm === 'PWHL' || norm === 'LHJMQ' || norm === 'AHL') return '🏒';
    if(norm.indexOf('FOOTBALL') > -1 || norm.indexOf('LIGUE') > -1 || norm.indexOf('SOCCER') > -1) return '⚽';
    if(norm.indexOf('BASKETBALL') > -1) return '🏀';
    if(norm.indexOf('BASEBALL') > -1) return '⚾';
    if(norm.indexOf('F1') > -1 || norm.indexOf('FORMULA 1') > -1) return '🏎️';
    if(norm.indexOf('TENNIS') > -1) return '🎾';
    if(norm.indexOf('RUGBY') > -1) return '🏉';
    return '🏆';
}

export function renderFavPage() {
    // Render leagues
    var leaguesContainer = document.getElementById('fav-leagues-list');
    if (leaguesContainer) {
        var lgHtml = '';
        var displayOrder = customLgOrder.length > 0 ? customLgOrder : Object.keys(DEFAULT_LEAGUES);

        // Ensure all mainLeagues are in the list
        var allLgs = Object.keys(DEFAULT_LEAGUES);
        allLgs.forEach(function(l) {
            if (displayOrder.indexOf(l) === -1) displayOrder.push(l);
        });

        displayOrder.forEach(function(lgKey, idx) {
            var lgIcon = getLeagueIcon(lgKey);
            var isFirst = idx === 0;
            var isLast = idx === displayOrder.length - 1;

            lgHtml += '<div draggable="true" ondragstart="handleDragStartLg(event, \'' + escJs(lgKey) + '\')" ondragend="handleDragEndLg(event)" ondragover="handleDragOverLg(event)" ondrop="handleDropLg(event, \'' + escJs(lgKey) + '\')" ondragenter="handleDragEnterLg(event)" ondragleave="handleDragLeaveLg(event)" style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.05); cursor: grab;">'
                   + '<div style="display:flex; align-items:center; gap:8px; pointer-events:none;">'
                   + '<span style="font-size:16px; pointer-events:none;">' + lgIcon + '</span>'
                   + '<span style="font-size:14px; font-weight:bold; pointer-events:none;">' + esc(lgKey) + '</span>'
                   + '</div>'
                   + '<div style="display:flex; gap:4px;">'
                   + '<button class="btn o" style="padding:4px; font-size:12px; opacity:' + (isFirst ? '0.3' : '1') + ';" onclick="moveLeagueOrder(\'' + escJs(lgKey) + '\', -1)" ' + (isFirst ? 'disabled' : '') + '>▲</button>'
                   + '<button class="btn o" style="padding:4px; font-size:12px; opacity:' + (isLast ? '0.3' : '1') + ';" onclick="moveLeagueOrder(\'' + escJs(lgKey) + '\', 1)" ' + (isLast ? 'disabled' : '') + '>▼</button>'
                   + '</div>'
                   + '</div>';
        });
        leaguesContainer.innerHTML = lgHtml;
    }

    // Render teams
    var teamsContainer = document.getElementById('fav-teams-list');
    if (teamsContainer) {
        var teamsByLeague = {};

        // Populate from STATIC_TEAMS
        if (typeof STATIC_TEAMS !== 'undefined') {
            STATIC_TEAMS.forEach(function(t) {
                var lg = t.league ? t.league.toUpperCase() : 'AUTRES';
                if (!teamsByLeague[lg]) teamsByLeague[lg] = [];
                if (!teamsByLeague[lg].find(function(x) { return x.name === t.name; })) {
                    teamsByLeague[lg].push({ name: t.name, source: 'static' });
                }
            });
        }

        // Also populate from matches currently in memory to catch unlisted teams
        if (typeof S !== 'undefined' && S.matches) {
            S.matches.forEach(function(m) {
                var lg = m.league || 'AUTRES';
                if (!teamsByLeague[lg]) teamsByLeague[lg] = [];

                [m.homeTeam, m.awayTeam].forEach(function(tName) {
                    if (tName && !teamsByLeague[lg].find(function(x) { return x.name === tName; })) {
                        teamsByLeague[lg].push({ name: tName, source: 'live' });
                    }
                });
            });
        }

        var tHtml = '';

        // Helper to render a team item
        function renderTeam(t) {
            var isFav = favTeams[t.name] === 1;
            var logoUrl = getLogo(t.name);
            var logoHtml = logoUrl ? '<img src="'+esc(logoUrl)+'" style="width:24px; height:24px; object-fit:contain;" onerror="this.style.display=\'none\'">' : '<div style="font-size:16px;">🛡️</div>';

            // Find aliases
            var aliases = [];
            var nName = normName(t.name);
            if (typeof TEAM_ALIASES !== 'undefined') {
                for (var key in TEAM_ALIASES) {
                    if (TEAM_ALIASES[key] === nName) {
                        aliases.push(key);
                    }
                }
            }

            var aliasText = aliases.length > 0 ? ('<div style="font-size:11px; color:var(--muted2); margin-top:2px; font-family:monospace;">Alias: ' + esc(aliases.join(', ')) + '</div>') : '';

            return '<div class="team-item" data-team-name="'+esc(t.name)+'" data-aliases="'+esc(aliases.join(' '))+'" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:8px 12px; border-radius:6px; cursor:pointer;" onclick="openGlobalStats(\'' + escJs(t.name) + '\')">'
                   + '<div style="display:flex; align-items:center; gap:12px;">'
                   + '<div style="width:24px; display:flex; justify-content:center;">' + logoHtml + '</div>'
                   + '<div>'
                   + '<div style="font-size:14px; font-weight:bold; color:' + (isFav ? 'var(--text)' : 'var(--muted)') + ';">' + esc(t.name) + '</div>'
                   + aliasText
                   + '</div>'
                   + '</div>'
                   + '<button style="background:none; border:none; color:' + (isFav ? 'var(--accent)' : 'var(--border2)') + '; font-size:20px; cursor:pointer;" onclick="toggleFavPageTeam(\'' + escJs(t.name) + '\'); event.stopPropagation();">★</button>'
                   + '</div>';
        }

        // Render Favoris section
        var favorisList = [];
        var allTeams = [];
        for (var lg in teamsByLeague) {
            teamsByLeague[lg].forEach(function(t) {
                if (!allTeams.find(function(x) { return x.name === t.name; })) {
                    allTeams.push(t);
                    if (favTeams[t.name] === 1) {
                        favorisList.push(t);
                    }
                }
            });
        }

        if (favorisList.length > 0) {
            tHtml += '<div class="fav-section-header" style="margin-top:8px; font-size:13px; font-weight:bold; color:var(--accent); text-transform:uppercase;">⭐️ MES FAVORIS</div>';
            favorisList.sort(function(a, b) {
                return a.name.localeCompare(b.name);
            });
            favorisList.forEach(function(t) {
                tHtml += renderTeam(t);
            });
            tHtml += '<div class="fav-section-padding" style="height: 16px;"></div>'; // padding before leagues
        }

        var sortedLeagues = Object.keys(teamsByLeague).sort(function(a,b) {
            var idxA = customLgOrder.indexOf(a);
            var idxB = customLgOrder.indexOf(b);
            if(idxA > -1 && idxB > -1) return idxA - idxB;
            if(idxA > -1) return -1;
            if(idxB > -1) return 1;
            return a.localeCompare(b);
        });

        sortedLeagues.forEach(function(lg) {
            var lgId = 'fav-lg-' + lg.replace(/[^a-zA-Z0-9]/g, '-');
            var isCollapsed = S.collapsedFavLg && S.collapsedFavLg[lg];
            var chevTransform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';

            tHtml += '<div class="lg-header" data-target="'+lgId+'" style="margin-top:8px; font-size:13px; font-weight:bold; color:var(--muted); text-transform:uppercase; display:flex; align-items:center; cursor:pointer;" onclick="toggleFavPageAccordion(\''+escJs(lg)+'\')">';
            tHtml += '<svg id="chev-'+lgId+'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px; transition:transform 0.2s; transform:'+chevTransform+';"><path d="M6 9l6 6 6-6"/></svg>';
            tHtml += esc(lg);
            tHtml += '</div>';

            var displayStyle = isCollapsed ? 'none' : 'flex';
            tHtml += '<div id="'+lgId+'" class="lg-container" style="display:'+displayStyle+'; flex-direction:column; gap:0;">';

            var sortedTeams = teamsByLeague[lg].sort(function(a, b) {
                return a.name.localeCompare(b.name);
            });

            sortedTeams.forEach(function(t) {
                tHtml += renderTeam(t);
            });
            tHtml += '</div>';
        });

        teamsContainer.innerHTML = tHtml;
    }
}

export function toggleFavPageAccordion(lgName) {
    if (!S.collapsedFavLg) S.collapsedFavLg = {};
    S.collapsedFavLg[lgName] = !S.collapsedFavLg[lgName];

    var lgId = 'fav-lg-' + lgName.replace(/[^a-zA-Z0-9]/g, '-');
    var container = document.getElementById(lgId);
    var chev = document.getElementById('chev-' + lgId);

    if (container) {
        if (S.collapsedFavLg[lgName]) {
            container.style.display = 'none';
            if(chev) chev.style.transform = 'rotate(-90deg)';
        } else {
            container.style.display = 'flex';
            if(chev) chev.style.transform = 'rotate(0deg)';
        }
    }
}

export function toggleFavPageTeam(teamName) {
    toggleFavTeam(teamName); // Re-uses existing function which sets localStorage
    renderFavPage(); // Re-render to update UI (star color)
}

var draggedLgKey = null;

export function handleDragStartLg(event, lgKey) {
    draggedLgKey = lgKey;
    event.dataTransfer.effectAllowed = 'move';
    event.target.style.opacity = '0.5';
}

export function handleDragEndLg(event) {
    event.target.style.opacity = '1';
    draggedLgKey = null;
}

export function handleDragOverLg(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    return false;
}

export function handleDragEnterLg(event) {
    event.preventDefault();
    var target = event.currentTarget;
    if (target) {
        target.style.border = '1px dashed var(--accent)';
        target.style.background = 'rgba(255,255,255,0.1)';
    }
}

export function handleDragLeaveLg(event) {
    var target = event.currentTarget;
    if (target) {
        target.style.border = '1px solid rgba(255,255,255,0.05)';
        target.style.background = 'rgba(0,0,0,0.3)';
    }
}

export function handleDropLg(event, dropLgKey) {
    event.stopPropagation();
    var target = event.currentTarget;
    if (target) {
        target.style.border = '1px solid rgba(255,255,255,0.05)';
        target.style.background = 'rgba(0,0,0,0.3)';
    }
    if (draggedLgKey && draggedLgKey !== dropLgKey) {
        var displayOrder = customLgOrder.length > 0 ? customLgOrder : Object.keys(DEFAULT_LEAGUES);
        var allLgs = Object.keys(DEFAULT_LEAGUES);
        allLgs.forEach(function(l) {
            if (displayOrder.indexOf(l) === -1) displayOrder.push(l);
        });

        var draggedIdx = displayOrder.indexOf(draggedLgKey);
        var dropIdx = displayOrder.indexOf(dropLgKey);

        if (draggedIdx > -1 && dropIdx > -1) {
            displayOrder.splice(draggedIdx, 1);
            displayOrder.splice(dropIdx, 0, draggedLgKey);
            setCustomLgOrder(displayOrder);
            renderFavPage();
        }
    }
    draggedLgKey = null;
    return false;
}

export function moveLeagueOrder(lgKey, direction) {
    var displayOrder = customLgOrder.length > 0 ? customLgOrder : Object.keys(DEFAULT_LEAGUES);
    var allLgs = Object.keys(DEFAULT_LEAGUES);
    allLgs.forEach(function(l) {
        if (displayOrder.indexOf(l) === -1) displayOrder.push(l);
    });

    var idx = displayOrder.indexOf(lgKey);
    if (idx === -1) return;

    var newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= displayOrder.length) return;

    // Swap
    var temp = displayOrder[idx];
    displayOrder[idx] = displayOrder[newIdx];
    displayOrder[newIdx] = temp;

    setCustomLgOrder(displayOrder);
    renderFavPage();
}

export function resetLgOrder() {
    setCustomLgOrder([]);
    renderFavPage();
}

export function switchFavTab(tab) {
    var container = document.getElementById('fav-container');
    var tabTeams = document.getElementById('fav-tab-teams');
    var tabLeagues = document.getElementById('fav-tab-leagues');

    if (tab === 'leagues') {
        container.classList.add('show-leagues');
        tabTeams.classList.remove('active-toggle');
        tabLeagues.classList.add('active-toggle');
    } else {
        container.classList.remove('show-leagues');
        tabLeagues.classList.remove('active-toggle');
        tabTeams.classList.add('active-toggle');
    }
}

export function filterFavTeams(query) {
    var q = normName(query);
    var teamsContainer = document.getElementById('fav-teams-list');
    if (!teamsContainer) return;

    // Si la recherche est vide, on affiche tout et on ferme les accordéons
    if (!q) {
        var favHeaders = teamsContainer.querySelectorAll('.fav-section-header, .fav-section-padding');
        favHeaders.forEach(function(el) { el.style.display = 'block'; });

        var teamEls = teamsContainer.querySelectorAll('.team-item');
        teamEls.forEach(function(el) { el.style.display = 'flex'; });

        var lgHeaders = teamsContainer.querySelectorAll('.lg-header');
        lgHeaders.forEach(function(el) { el.style.display = 'flex'; });

        var lgContainers = teamsContainer.querySelectorAll('.lg-container');
        lgContainers.forEach(function(c) {
            var lgName = c.id.replace('fav-lg-', '').replace(/-/g, ' ');
            // Utiliser toggleFavPageAccordion pour restaurer l'état (ou on force fermé)
            c.style.display = (S.collapsedFavLg && S.collapsedFavLg[lgName]) ? 'none' : 'flex';
        });
        return;
    }

    // On parcourt toutes les équipes et on masque les en-têtes pour une liste simple
    var favHeaders = teamsContainer.querySelectorAll('.fav-section-header, .fav-section-padding');
    favHeaders.forEach(function(el) { el.style.display = 'none'; });

    var lgHeaders = teamsContainer.querySelectorAll('.lg-header');
    lgHeaders.forEach(function(el) { el.style.display = 'none'; });

    var allTeamEls = teamsContainer.querySelectorAll('.team-item');
    // Set for keeping track of already displayed names to avoid duplicates since teams might be in favorites and league
    var displayedNames = {};
    allTeamEls.forEach(function(el) {
        var teamName = el.getAttribute('data-team-name');
        var nName = normName(teamName);
        var aliasesStr = el.getAttribute('data-aliases') || '';

        if (!displayedNames[teamName] && (nName.indexOf(q) > -1 || aliasesStr.indexOf(q) > -1)) {
            el.style.display = 'flex';
            displayedNames[teamName] = true;
        } else {
            el.style.display = 'none';
        }
    });

    // Force open the containers that have visible results
    var lgContainers = teamsContainer.querySelectorAll('.lg-container');
    lgContainers.forEach(function(c) {
        var visibleTeams = c.querySelectorAll('.team-item[style="display: flex;"]');
        if (visibleTeams.length > 0) {
            c.style.display = 'flex'; // Forcer l'ouverture pendant la recherche
        } else {
            c.style.display = 'none';
        }
    });
}



// Global bindings for HTML compatibility
window.stepOk = stepOk;
window.updateLiveScores = updateLiveScores;
window.loadAll = loadAll;
window.toggleSportFilters = toggleSportFilters;
window.appTheaterTimer = appTheaterTimer;
window.toggleMenu = toggleMenu;
window.currentZoomLevel = currentZoomLevel;
window.updateZoomDisplay = updateZoomDisplay;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.openFavPage = openFavPage;
window.DEFAULT_LEAGUES = DEFAULT_LEAGUES;
window.getLeagueIcon = getLeagueIcon;
window.renderFavPage = renderFavPage;
window.toggleFavPageAccordion = toggleFavPageAccordion;
window.toggleFavPageTeam = toggleFavPageTeam;
window.handleDragStartLg = handleDragStartLg;
window.handleDragEndLg = handleDragEndLg;
window.handleDragOverLg = handleDragOverLg;
window.handleDragEnterLg = handleDragEnterLg;
window.handleDragLeaveLg = handleDragLeaveLg;
window.handleDropLg = handleDropLg;
window.moveLeagueOrder = moveLeagueOrder;
window.resetLgOrder = resetLgOrder;
window.filterFavTeams = filterFavTeams;
window.switchFavTab = switchFavTab;

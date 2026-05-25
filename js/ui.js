import { getEstTimeStrFromDate, getDomain, domainPrefs, toggleDomainPref, sortFluxLinks, SCRAPERS_CONFIG } from './config.js';
import { normName, lgColor, getTeamColors, getLogo } from './db.js';
import { S, customLgOrder, favTeams, matchCardCache, toggleFavTeam } from './state.js';
import { lg, esc, toggleAccordion, escJs, pad, toggleLeague, safeStorageGetJSON, safeStorageSetJSON, formatTeamNameBreak, resolveStreamUrl } from './utils.js';
import { TARGET_DATE, fetchGameStats, renderScorersHtml, fetchTeamInfo } from './api.js';
import { openFlux, mvFlux, saveMultivisionState, updateMultivisionLayout, addToMultivision } from './multiview.js';
import { scrapeMatchFlux } from './scrapers.js';
import { isMatch, debugMatchPair, stringSimilarity } from './match.js';
import { DEFAULT_LEAGUES, OTHER_LEAGUES, lgFlag } from './db.js';

/* ══ DIAGNOSTIC SCRAPE ══════════════════ */
export function diagnosticScrape(matchId, url) {
    var repContainer = document.getElementById('diagnostic-report-container');
    if(repContainer) repContainer.innerHTML = '<span style="color:var(--accent);">Scraping en cours...</span>';

    // Find our current API match
    var m = (S.matches || []).find(function(x) { return x.id === matchId; });
    if(!m) {
        if(repContainer) repContainer.innerHTML = '<span style="color:var(--red);">Erreur: Match non trouvé en mémoire.</span>';
        return;
    }

    // Update match source URL
    m.matchUrl = url;
    m.streamLinks = [];
    m.streamsLoaded = false;

    // Trigger force scrape
    scrapeMatchFlux(m, true).then(function() {
        if(repContainer) {
            var unmerged = (S.matches || []).filter(function(x) {
               return x.id.startsWith('scraped_') || x.id.startsWith('bs_') || x.id.startsWith('se_') || x.id.startsWith('ts_') || x.id.startsWith('vip_');
            });
            var scrapedMatch = null;
            // The scraping might have added a new "unmerged" match, or it just added streams to the passed match 'm' because of fallback scraper.
            // ScrapeMatchFlux modifies `m` directly. It passes `m` to scraper, but generic scraper creates a new 'scraped_' match if it finds links on the page?
            // Actually, in our application logic, `scrapeMatchFlux` passes the current match `m` down to the scrapers. Scrapers usually use the passed `m` and push to its `m.streamLinks` directly.
            // Let's re-verify the matches list for any unmerged match that has this URL.

            var newScraped = unmerged.find(function(x) { return x.matchUrl === url; });
            var html = '<div style="margin-top:8px; padding:8px; background:rgba(255,255,255,0.05); border-radius:4px;">';
            html += '<div style="font-weight:bold; margin-bottom:4px; color:var(--text);">Résultat :</div>';
            html += '<div>Flux trouvés : ' + (m.streamLinks ? m.streamLinks.length : 0) + '</div>';

            var logPayload = '=== DIAGNOSTIC LOG ===\n';
            logPayload += 'URL: ' + url + '\n';
            logPayload += 'Match Attendu: ' + m.homeTeam + ' vs ' + m.awayTeam + ' (ID: ' + m.id + ')\n';
            logPayload += 'Flux Trouvés: ' + (m.streamLinks ? m.streamLinks.length : 0) + '\n';

            if (newScraped) {
                html += '<div style="margin-top: 8px; font-weight:bold; color:var(--text);">Diagnostic d\'association (Pourquoi isMatchPair a échoué ?) :</div>';
                var diag = debugMatchPair(m, newScraped);
                html += '<div style="color:var(--red); font-family:monospace; margin-top:4px; padding:4px; background:rgba(0,0,0,0.3); border-radius:4px;">' + esc(diag.reason) + '</div>';
                html += '<div style="margin-top:4px;"><strong>Scrapé :</strong> ' + esc(newScraped.homeTeam) + ' vs ' + esc(newScraped.awayTeam) + '</div>';
                html += '<div><strong>Attendu :</strong> ' + esc(m.homeTeam) + ' vs ' + esc(m.awayTeam) + '</div>';

                logPayload += '\n=== DEBUG MATCH PAIR ===\n';
                logPayload += 'Raison: ' + diag.reason + '\n';
                logPayload += 'Scrapé: ' + newScraped.homeTeam + ' vs ' + newScraped.awayTeam + '\n';

                // Simulation automatique contre tous les matchs de l'API
                var simMatches = [];
                var apiOnly = (S.matches || []).filter(function(x) { return DEFAULT_LEAGUES[(x.league||'').toUpperCase()] && !x.id.toString().startsWith('scraped_') && !x.id.toString().startsWith('bs_') && !x.id.toString().startsWith('se_') && !x.id.toString().startsWith('ts_') && !x.id.toString().startsWith('vip_'); });

                var matchedSim = null;
                apiOnly.forEach(function(apiM) {
                    var apiDiag = debugMatchPair(apiM, newScraped);
                    if (apiDiag.isMatch) {
                        matchedSim = apiM;
                    } else {
                        // Basic similarity score to find top closest matches if no match found
                        var simH = stringSimilarity(apiM.homeTeam, newScraped.homeTeam);
                        var simA = stringSimilarity(apiM.awayTeam, newScraped.awayTeam);
                        var simHA = stringSimilarity(apiM.homeTeam, newScraped.awayTeam);
                        var simAH = stringSimilarity(apiM.awayTeam, newScraped.homeTeam);

                        var maxSim = Math.max(simH + simA, simHA + simAH) / 2;
                        simMatches.push({ match: apiM, score: maxSim, reason: apiDiag.reason });
                    }
                });

                logPayload += '\n=== SIMULATION AUTOMATIQUE ===\n';
                if (matchedSim) {
                    logPayload += 'SUCCÈS: Si ce lien n\'avait pas été manuel, il aurait été associé automatiquement au match:\n';
                    logPayload += '- ' + matchedSim.homeTeam + ' vs ' + matchedSim.awayTeam + ' (ID: ' + matchedSim.id + ')\n';

                    html += '<div style="margin-top:8px; font-weight:bold; color:var(--text);">Simulation Automatique :</div>';
                    html += '<div style="color:var(--green); font-size:12px;">✅ Associé automatiquement à :<br><strong>' + esc(matchedSim.homeTeam) + ' vs ' + esc(matchedSim.awayTeam) + '</strong></div>';
                } else {
                    logPayload += 'ÉCHEC: Aucun match de l\'API ne correspondrait à ce flux.\n';
                    logPayload += 'Les matchs les plus proches dans la base de données et pourquoi ils échouent :\n';
                    simMatches.sort(function(a, b) { return b.score - a.score; });
                    var topSims = simMatches.slice(0, 3);
                    topSims.forEach(function(sim) {
                        logPayload += '\n> ' + sim.match.homeTeam + ' vs ' + sim.match.awayTeam + ' (Score: ' + sim.score.toFixed(2) + ')\n';
                        logPayload += '  Raison de l\'échec: ' + sim.reason + '\n';
                    });

                    html += '<div style="margin-top:8px; font-weight:bold; color:var(--text);">Simulation Automatique :</div>';
                    html += '<div style="color:var(--red); font-size:12px;">❌ Aucun match API correspondant. (Voir le log complet)</div>';
                }
            }

            // Save stream cache
            if (window.saveStreamCache) {
                window.saveStreamCache(m.id, m.streamLinks);
            }

            // Add copy button
            html += '<div style="margin-top: 10px;"><button class="btn o" style="font-size: 11px; padding: 4px 8px;" onclick="window.copyToClipboard(\'' + escJs(logPayload) + '\').then(function(){ window.showToast(\'Log copié !\'); }).catch(function(){ window.showToast(\'Erreur copie\'); });">📋 Copier le log de debug</button></div>';
            html += '</div>';

            // Also add to global scrape logs
            if (window.addScrapeLog) {
                window.addScrapeLog(url, 'success', logPayload);
            }

            // Because openMod wipes the right column, we must append this report AFTER openMod is called, but openMod redraws this section.
            m._diagnosticReportHtml = html; // Store temporarily

            // Re-render modal right column to show new links and the report
            var btnContainer = document.getElementById('modal-btn-container');
            if (btnContainer && document.getElementById('mname').dataset.matchName.indexOf(m.homeTeam) >= 0) {
               openMod(m, lgColor(normName(m.homeTeam)));
            }
        }
    }).catch(function(e) {
        var repContainer2 = document.getElementById('diagnostic-report-container');
        if(repContainer2) repContainer2.innerHTML = '<span style="color:var(--red);">Erreur: ' + esc(e.message) + '</span>';
    });
}

/* ══ EPG / LISTE ════════════════════════ */
export function getOriginalMatchId(id) {
    if (typeof id === 'string') {
        if (id.endsWith('_live_copy')) return id.replace('_live_copy', '');
        if (id.endsWith('_fav_copy')) return id.replace('_fav_copy', '');
    }
    return id;
}

export function buildEPG(matches){
  // Current time minus 15 minutes to treat soon-to-start matches as "live"
  var now = new Date();
  var currentEst = getEstTimeStrFromDate(now);
  var currentParts = currentEst.split(':');
  var currentMins = parseInt(currentParts[0], 10) * 60 + parseInt(currentParts[1], 10);

  var filtered = matches.filter(function(m){
    var isLiveOrSoon = m.status === 'live';
    var isUpcomingInHour = false;
    if(m.status === 'upcoming' && m.startTime) {
        var mParts = m.startTime.split(':');
        var mMins = parseInt(mParts[0], 10) * 60 + parseInt(mParts[1], 10);

        var diff = mMins - currentMins;
        if (currentMins >= 1380 && mMins <= 60) diff += 1440; // wrap around

        // Live or soon (within 15 min or already started)
        if(diff <= 15 && diff > -1440) {
            isLiveOrSoon = true;
        } else if (diff > 15 && diff <= 60) {
            isUpcomingInHour = true;
        }
    }

    // In Live tab: show live matches and matches starting in <= 60 mins
    var isUpcomingIn60 = false;
    if (m.status === 'upcoming' && m.startTime) {
        var mParts = m.startTime.split(':');
        var mMins = parseInt(mParts[0], 10) * 60 + parseInt(mParts[1], 10);
        var diff = mMins - currentMins;
        if (currentMins >= 1380 && mMins <= 60) diff += 1440; // wrap around
        if (diff > 0 && diff <= 60) {
            isUpcomingIn60 = true;
        }
    }


    if (S.filter === 'live') {
        if (!isLiveOrSoon && !isUpcomingIn60 && m.status !== 'live') return false;
    }

    if(S.searchQuery) {
        var q = normName(S.searchQuery);
        var hN = normName(m.homeTeam);
        var aN = normName(m.awayTeam);
        var lN = normName(m.league);

        if(hN.indexOf(q) === -1 &&
           aN.indexOf(q) === -1 &&
           lN.indexOf(q) === -1 &&
           m.homeTeam.toLowerCase().indexOf(S.searchQuery) === -1 &&
           m.awayTeam.toLowerCase().indexOf(S.searchQuery) === -1 &&
           m.league.toLowerCase().indexOf(S.searchQuery) === -1) {
            return false;
        }
    }
    return true;
  });

  var epgMatches = filtered.slice();

  var lgOrder=[],lgMap={};
  epgMatches.forEach(function(m){
    if(!lgMap[m.league]){lgMap[m.league]=Object.assign({},m,{matches:[]});lgOrder.push(m.league);}
    lgMap[m.league].matches.push(m);
  });

  lgOrder.sort(function(a,b) {
      if (a === 'FAVORIS') return -1;
      if (b === 'FAVORIS') return 1;
      if (a === 'EN DIRECT') return -1;
      if (b === 'EN DIRECT') return 1;

      // Ensure 'Autres Flux' is always sorted last globally in the main feed
      if (!DEFAULT_LEAGUES[(a||'').toUpperCase()] && (!OTHER_LEAGUES || !OTHER_LEAGUES[(a||'').toUpperCase()])) return 1;
      if (!DEFAULT_LEAGUES[(b||'').toUpperCase()] && (!OTHER_LEAGUES || !OTHER_LEAGUES[(b||'').toUpperCase()])) return -1;

      // Custom League Order User Preference
      var displayOrder = customLgOrder.length > 0 ? customLgOrder.slice() : Object.keys(DEFAULT_LEAGUES).slice();
      var allLgs = Object.keys(DEFAULT_LEAGUES);
      allLgs.forEach(function(l) {
          if (displayOrder.indexOf(l) === -1) displayOrder.push(l);
      });

      var idxA = -1;
      var idxB = -1;
      for (var i = 0; i < displayOrder.length; i++) {
          if (displayOrder[i].toUpperCase() === a.toUpperCase()) idxA = i;
          if (displayOrder[i].toUpperCase() === b.toUpperCase()) idxB = i;
      }

      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;

      var getSortTime = function(lgMatches) {
          var active = lgMatches.filter(function(x){return x.status!=='finished';});
          if(active.length>0) {
              active.sort(function(x,y){return x.startTime.localeCompare(y.startTime);});
              return active[0].startTime;
          }
          return "99:99";
      };

      var aStart = getSortTime(lgMap[a].matches);
      var bStart = getSortTime(lgMap[b].matches);
      if (aStart !== bStart) return aStart.localeCompare(bStart);
      return a.localeCompare(b);
  });

  var leagues=lgOrder.map(function(k){
    lgMap[k].matches.sort(function(m1,m2){
        var f1 = (favTeams[m1.homeTeam] || favTeams[m1.awayTeam] || favTeams[m1.league]) ? -1 : 0;
        var f2 = (favTeams[m2.homeTeam] || favTeams[m2.awayTeam] || favTeams[m2.league]) ? -1 : 0;
        if(f1 !== f2) return f1 - f2;
        var w1 = m1.status==='live'?0:(m1.status==='upcoming'?1:2);
        var w2 = m2.status==='live'?0:(m2.status==='upcoming'?1:2);
        if(w1 !== w2) return w1 - w2;
        return m1.startTime.localeCompare(m2.startTime);
    });
    return lgMap[k];
  });

  var epgContainer = document.getElementById('marea');
  matchCardCache.clear();
  epgContainer.style.cssText = '';
  epgContainer.style.display = 'flex';
  epgContainer.style.flexDirection = 'column';
  epgContainer.style.gap = '24px';
  epgContainer.style.maxWidth = '1200px';
  epgContainer.style.margin = '0 auto';
  epgContainer.style.width = '100%';

  var ovElement = document.getElementById('ov');
  var errBoxElement = document.getElementById('errbox');
  epgContainer.innerHTML = '';
  if (ovElement) {
      epgContainer.appendChild(ovElement);
  }
  if (errBoxElement) {
      epgContainer.appendChild(errBoxElement);
  }

  if (S.filter === 'live' || S.filter === 'upcoming') {
      epgContainer.style.display = 'block';
      epgContainer.style.padding = '0';
      epgContainer.style.overflowY = 'auto';
      epgContainer.style.height = '100%';
      epgContainer.style.WebkitOverflowScrolling = 'touch';

      var renderMatches = function(matchesToRender, container, titleStr, isCollapsible, sectionId) {
          if (!matchesToRender || matchesToRender.length === 0) return;

          var grid = document.createElement('div');
          grid.className = 'match-grid';

          if (titleStr) {
              var secTitle = document.createElement('div');
              secTitle.style.cssText = 'padding: 16px 24px 8px; font-weight: bold; font-size: 18px; color: var(--text); border-bottom: 1px solid var(--border); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;';

              if (isCollapsible) {
                  secTitle.style.cursor = 'pointer';
                  var isCollapsed = S.collapsedSections[sectionId] || false;

                  var icon = document.createElement('span');
                  icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
                  icon.style.transition = 'transform 0.2s';
                  if (isCollapsed) {
                      icon.style.transform = 'rotate(-90deg)';
                      grid.style.display = 'none';
                  }
                  secTitle.appendChild(icon);

                  secTitle.addEventListener('click', function() {
                      S.collapsedSections[sectionId] = !S.collapsedSections[sectionId];
                      if (S.collapsedSections[sectionId]) {
                          icon.style.transform = 'rotate(-90deg)';
                          grid.style.display = 'none';
                      } else {
                          icon.style.transform = '';
                          grid.style.display = '';
                      }
                  });
              }

              var textSpan = document.createElement('span');
              var prefix = '';
              if (window.getLeagueIcon && titleStr && titleStr !== "Plus tard aujourd'hui" && titleStr !== "À venir dans l'heure" && titleStr !== "Autres streams" && titleStr !== "Favoris aujourd'hui" && titleStr !== "Live") {
                  var icon = window.getLeagueIcon(titleStr);
                  if (icon && icon !== '🏆') {
                      prefix = icon + ' ';
                  }
              }
              textSpan.textContent = prefix + titleStr;
              secTitle.appendChild(textSpan);
              container.appendChild(secTitle);
          }

          container.appendChild(grid);

          // Group by league inside this section
          var lgMap = {};
          matchesToRender.forEach(function(m) {
              if(!lgMap[m.league]){lgMap[m.league]=Object.assign({},m,{matches:[]});}
              lgMap[m.league].matches.push(m);
          });

          var lgOrder = Object.keys(lgMap);
          lgOrder.sort(function(a, b) {
              if (!DEFAULT_LEAGUES[(a||'').toUpperCase()] && (!OTHER_LEAGUES || !OTHER_LEAGUES[(a||'').toUpperCase()])) return 1;
              if (!DEFAULT_LEAGUES[(b||'').toUpperCase()] && (!OTHER_LEAGUES || !OTHER_LEAGUES[(b||'').toUpperCase()])) return -1;
              var displayOrder = customLgOrder.length > 0 ? customLgOrder.slice() : Object.keys(DEFAULT_LEAGUES).slice();
              var allLgs = Object.keys(DEFAULT_LEAGUES);
              allLgs.forEach(function(l) {
                  if (displayOrder.indexOf(l) === -1) displayOrder.push(l);
              });

              var idxA = -1;
              var idxB = -1;
              for (var i = 0; i < displayOrder.length; i++) {
                  if (displayOrder[i].toUpperCase() === a.toUpperCase()) idxA = i;
                  if (displayOrder[i].toUpperCase() === b.toUpperCase()) idxB = i;
              }

              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return a.localeCompare(b);
          });

          lgOrder.forEach(function(lgName) {
              var lg = lgMap[lgName];
              if(!lg || lg.matches.length === 0) return;
              if(S.hiddenLg[lg.league]) return;
              var isCollapsed = S.collapsedLg[lg.league];

              // League Header (Hidden via CSS but code remains for logic/state)
              var lHdr = document.createElement('div');
              lHdr.className = 'lg-hdr' + (isCollapsed ? ' collapsed' : '');
              lHdr.style.gridColumn = '1 / -1'; // Span full width
              lHdr.style.marginBottom = '8px';
              lHdr.style.display = 'none'; // explicitly hiding it here to satisfy requirement if CSS fails
              lHdr.innerHTML = '<svg class="lg-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>'
                + '<span class="ch-flag">'+(lg.flag || lgFlag(lg.league) || '')+'</span>'
                + '<span class="lg-title">'+esc(lg.league)+'</span>'
                + '<span class="lg-cnt">'+lg.matches.length+'</span>';
              lHdr.addEventListener('click', function(){ toggleAccordion(lg.league); });
              grid.appendChild(lHdr);

              lg.matches.forEach(function(m) {
                  var b = document.createElement('div');
                  b.className = 'match-card' + (m.status==='live' ? ' live' : '') + (m.status==='finished' ? ' finished' : '');
                  b.id = 'mb-'+m.id;
                  b.setAttribute('data-lg', lg.league);
                  b.style.display = isCollapsed ? 'none' : 'flex';

                  var homeTeamName = normName(m.homeTeam) || 'A';
                  var awayTeamName = normName(m.awayTeam) || 'B';
                  var homeColor = lgColor(homeTeamName);
                  var awayColor = lgColor(awayTeamName);
                  var lgCol = lg.color || lgColor(lg.league);


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
                  } else if (userPrefs.cardColor === 'split') {
                      cardBg = 'linear-gradient(135deg, ' + homeColor + ' 50%, ' + awayColor + ' 50%)';
                  } else if (userPrefs.cardColor === 'gradient') {
                      cardBg = 'linear-gradient(90deg, ' + homeColor + ' 0%, ' + awayColor + ' 100%)';
                  } else {
                      cardBg = 'linear-gradient(135deg, ' + homeColor + ' 0%, ' + awayColor + ' 100%)';
                  }

                  var statusHtml = '';
                  if(m.status === 'live') {
                      statusHtml = '<div class="live-indicator status-text"><span class="mb-ld"></span><span class="status-minute">'+(m.minute?esc(m.minute):'LIVE')+'</span></div>';
                  } else if(m.status === 'finished') {
                      statusHtml = '<div class="status-text"><span class="status-minute">' + (m.score ? 'Fin' : m.startTime) + '</span></div>';
                  } else {
                      statusHtml = '<div class="status-text"><span class="status-minute">'+m.startTime+'</span></div>';
                  }

                  var homeScore = m.score && typeof m.score[0] !== 'undefined' ? m.score[0] : '';
                  var awayScore = m.score && typeof m.score[1] !== 'undefined' ? m.score[1] : '';

                  var homeLogoUrl = m.homeLogo || getLogo(m.homeTeam);
                  var awayLogoUrl = m.awayLogo || getLogo(m.awayTeam);

                  var homeLogoHtmlPrime = homeLogoUrl ? (homeLogoUrl.startsWith('emoji:') ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">' + esc(homeLogoUrl.split(':')[1]) + '</div>' : '<img src="'+esc(homeLogoUrl)+'" class="prime-logo" onerror="this.style.display=\'none\'" alt="'+esc(m.homeTeam)+'">') : (m.flag === '🎮' ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🎮</div>' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>');
                  var awayLogoHtmlPrime = awayLogoUrl ? (awayLogoUrl.startsWith('emoji:') ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">' + esc(awayLogoUrl.split(':')[1]) + '</div>' : '<img src="'+esc(awayLogoUrl)+'" class="prime-logo" onerror="this.style.display=\'none\'" alt="'+esc(m.awayTeam)+'">') : (m.flag === '🎮' ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🎮</div>' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>');

                  var streamsBadgePrime = "";
                  var lgBadge = '<div class="prime-league-badge">'+(lg.flag || lgFlag(lg.league) || '')+'</div>';

                  var homeFavBtn = '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.homeTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;padding:0;margin-right:4px;" onclick="toggleFavTeam(\''+escJs(m.homeTeam)+'\'); event.stopPropagation();">★</button>';
                  var awayFavBtn = '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.awayTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;padding:0;margin-right:4px;" onclick="toggleFavTeam(\''+escJs(m.awayTeam)+'\'); event.stopPropagation();">★</button>';

                  var isRacing = !m.awayTeam || m.awayTeam.toLowerCase() === 'race' || m.awayTeam.toLowerCase().startsWith('fp') || m.awayTeam.toLowerCase().startsWith('qual');

                  var logosHtml = !isRacing ?
                                  '<div class="prime-logo-wrapper home">' + homeLogoHtmlPrime + '</div><div class="prime-logo-wrapper away">' + awayLogoHtmlPrime + '</div>' :
                                  '<div class="prime-logo-wrapper home" style="width: 100%; display: flex; justify-content: center;">' + homeLogoHtmlPrime + '</div>';

                  var teamsHtml = !isRacing ?
                                  '<div class="prime-team-name" title="'+esc(m.homeTeam)+'">'+homeFavBtn+esc(m.homeTeam)+'</div><div class="prime-team-name" title="'+esc(m.awayTeam)+'">'+awayFavBtn+esc(m.awayTeam)+'</div>' :
                                  '<div class="prime-team-name" style="text-align: center; justify-content: center; width: 100%;" title="'+esc(m.homeTeam)+'">'+homeFavBtn+esc(m.homeTeam) + (m.awayTeam ? ' - ' + esc(m.awayTeam) : '') + '</div>';

                  var scoresHtml = !isRacing ?
                                  '<div class="prime-score">'+homeScore+'</div><div class="prime-score">'+awayScore+'</div>' :
                                  '<div class="prime-score"></div>';

                  b.innerHTML = '<div class="prime-thumbnail" style="background:'+cardBg+';">'
                              +   lgBadge

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

                  b.addEventListener('click', function(){ openMod(m, lgCol); });
                  grid.appendChild(b);
              });
          });
          return grid;
      };

      // Split live and upcoming in 60 mins and later today if filter is live
      if (S.filter === 'live') {
          var favorisAujourdhui = [];
          var liveNow = [];
          var upNext = [];
          var laterToday = [];
          var autresFluxMatches = [];

          var now = new Date();
          var currentEst = getEstTimeStrFromDate(now);
          var currentParts = currentEst.split(':');
          var currentMins = parseInt(currentParts[0], 10) * 60 + parseInt(currentParts[1], 10);

          filtered.forEach(function(m) {
              if (favTeams[m.homeTeam] || favTeams[m.awayTeam] || favTeams[m.league]) {
                  favorisAujourdhui.push(m);
              }

              if (!DEFAULT_LEAGUES[(m.league||'').toUpperCase()] && m.league !== 'FAVORIS' && m.league !== 'EN DIRECT') {
                  autresFluxMatches.push(m);
                  return;
              }

              if (m.status === 'live') {
                  liveNow.push(m);
              } else {
                  if (m.startTime) {
                      var mParts = m.startTime.split(':');
                      var mMins = parseInt(mParts[0], 10) * 60 + parseInt(mParts[1], 10);
                      var diff = mMins - currentMins;
                      if (currentMins >= 1380 && mMins <= 60) diff += 1440; // wrap around

                      if (diff <= 60) {
                          upNext.push(m);
                      } else {
                          laterToday.push(m);
                      }
                  } else {
                      laterToday.push(m);
                  }
              }
          });
          if (favorisAujourdhui.length > 0) renderMatches(favorisAujourdhui, epgContainer, "Favoris aujourd'hui");
          if (liveNow.length > 0) renderMatches(liveNow, epgContainer, "Live");
          if (upNext.length > 0) renderMatches(upNext, epgContainer, "À venir dans l'heure");
          if (laterToday.length > 0) renderMatches(laterToday, epgContainer, "Plus tard aujourd'hui", true, 'laterToday');
          if (favorisAujourdhui.length === 0 && liveNow.length === 0 && upNext.length === 0 && laterToday.length === 0) {
              epgContainer.innerHTML = '<div style="color:var(--muted); padding:20px; text-align:center;">Aucun match en direct pour le moment.</div>';
          }
          if (autresFluxMatches.length > 0) {
              if (S.collapsedSections['autresStreams'] === undefined) {
                  S.collapsedSections['autresStreams'] = true;
              }

                            // Render the parent "Autres streams" category
              var autresContainer = renderMatches(autresFluxMatches, epgContainer, "Autres streams", true, 'autresStreams');

              // If the user has expanded "Autres streams", group and display the specific leagues inside it
              if (autresContainer) {
                  // Remove the match-grid class from defaultGrid so that renderMatches doesn't append nested grids into a grid.
                  // Since renderMatches returns the grid itself if there was no title wrapper, we just use it directly.
                  var defaultGrid = autresContainer;

                  // If it's expanded, render sub-leagues inside it.
                  if (!S.collapsedSections['autresStreams']) {
                      defaultGrid.innerHTML = ''; // Clear out the flattened matches
                      defaultGrid.className = 'autres-streams-sub-container'; // Make it a normal block wrapper
                      defaultGrid.style.display = 'block';

                      var secondaryLeagues = {};
                      autresFluxMatches.forEach(function(m) {
                          var lg = m.scrapedLeagueName || 'Autres Flux';
                          if (!secondaryLeagues[lg]) secondaryLeagues[lg] = [];
                          secondaryLeagues[lg].push(m);
                      });

                      // Group matches by time or league as requested ("Should find a way to match the times...")
                      // We will sort leagues alphabetically
                      Object.keys(secondaryLeagues).sort().forEach(function(lg) {
                          var subSectionId = 'autresStreams_' + lg.replace(/[^a-zA-Z0-9]/g, '');
                          if (S.collapsedSections[subSectionId] === undefined) {
                              S.collapsedSections[subSectionId] = true;
                          }

                          // Sort matches by time before passing them to renderMatches
                          var sortedMatches = secondaryLeagues[lg].sort(function(a, b) {
                              if (!a.startTime && !b.startTime) return 0;
                              if (!a.startTime) return 1;
                              if (!b.startTime) return -1;
                              return a.startTime.localeCompare(b.startTime);
                          });

                          renderMatches(sortedMatches, defaultGrid, lg, true, subSectionId);
                      });
                  }
              }
          }
      } else {
          // Render matches normally for upcoming
          var mainMatches = [];
          var autresFluxMatches = [];
          filtered.forEach(function(m) {
              if (!DEFAULT_LEAGUES[(m.league||'').toUpperCase()] && m.league !== 'FAVORIS' && m.league !== 'EN DIRECT') {
                  autresFluxMatches.push(m);
              } else {
                  mainMatches.push(m);
              }
          });
          renderMatches(mainMatches, epgContainer, "");
          if (autresFluxMatches.length > 0) {
              if (S.collapsedSections['autresStreams'] === undefined) {
                  S.collapsedSections['autresStreams'] = true;
              }

                            // Render the parent "Autres streams" category
              var autresContainer = renderMatches(autresFluxMatches, epgContainer, "Autres streams", true, 'autresStreams');

              // If the user has expanded "Autres streams", group and display the specific leagues inside it
              if (autresContainer) {
                  // Remove the match-grid class from defaultGrid so that renderMatches doesn't append nested grids into a grid.
                  var defaultGrid = autresContainer;

                  if (!S.collapsedSections['autresStreams']) {
                      defaultGrid.innerHTML = '';
                      defaultGrid.className = 'autres-streams-sub-container'; // Make it a normal block wrapper
                      defaultGrid.style.display = 'block';

                      var secondaryLeagues = {};
                      autresFluxMatches.forEach(function(m) {
                          var lg = m.scrapedLeagueName || 'Autres Flux';
                          if (!secondaryLeagues[lg]) secondaryLeagues[lg] = [];
                          secondaryLeagues[lg].push(m);
                      });

                      Object.keys(secondaryLeagues).sort().forEach(function(lg) {
                          var subSectionId = 'autresStreams_' + lg.replace(/[^a-zA-Z0-9]/g, '');
                          if (S.collapsedSections[subSectionId] === undefined) {
                              S.collapsedSections[subSectionId] = true;
                          }

                          // Sort matches by time
                          var sortedMatches = secondaryLeagues[lg].sort(function(a, b) {
                              if (!a.startTime && !b.startTime) return 0;
                              if (!a.startTime) return 1;
                              if (!b.startTime) return -1;
                              return a.startTime.localeCompare(b.startTime);
                          });

                          renderMatches(sortedMatches, defaultGrid, lg, true, subSectionId);
                      });
                  }
              }
          }
      }

  } else { // Timeline EPG

  epgContainer.style.display = 'block';
  epgContainer.style.flexDirection = '';
  epgContainer.style.maxWidth = 'none';
  epgContainer.style.margin = '0';
  epgContainer.style.width = '100%';
  epgContainer.style.height = '100%';
  epgContainer.style.overflow = 'auto'; // allow natural scrolling
  epgContainer.style.position = 'relative';

var renderTimelineGuide = function(leaguesToRender, containerToAppend) {
    if (!leaguesToRender || leaguesToRender.length === 0) return null;

    var wrapper = document.createElement('div');
    wrapper.className = 'epg-wrapper';

    // Ruler Row
    var rulerRow = document.createElement('div');
    rulerRow.className = 'ruler-row';

    var corner = document.createElement('div');
    corner.className = 'corner';
    corner.textContent = 'Compétition';
    rulerRow.appendChild(corner);

    var rulerTimes = document.createElement('div');
    rulerTimes.className = 'ruler-times';
    var hhtml = '';
    for(var h=0; h<=24; h++){
        hhtml += '<div class="tc">' + pad(h) + ':00</div>';
    }
    rulerTimes.innerHTML = hhtml;
    rulerRow.appendChild(rulerTimes);

    wrapper.appendChild(rulerRow);

    // Now Line element will be appended to the wrapper to span all the way down
    var nowLineHtml = document.createElement('div');
    nowLineHtml.className = 'now-line';
    wrapper.appendChild(nowLineHtml);

    leaguesToRender.forEach(function(lg){
      if(!lg || lg.matches.length === 0) return;
      if(S.hiddenLg[lg.league]) return;
      var isCollapsed = S.collapsedLg[lg.league];
      var lgCol = lg.color||lgColor(lg.league);

      // League Header Row
      var lHdrRow = document.createElement('div');
      lHdrRow.className = 'marea-row';
      lHdrRow.setAttribute('data-lg', lg.league);

      var lHdrCell = document.createElement('div');
      lHdrCell.className = 'lg-hdr' + (isCollapsed ? ' collapsed' : '');
      lHdrCell.setAttribute('data-lg-hdr', lg.league);
      lHdrCell.innerHTML = '<svg class="lg-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>'
        + '<span class="ch-flag">'+(lg.flag || lgFlag(lg.league) || '')+'</span>'
        + '<span class="lg-title">'+esc(lg.league)+'</span>'
        + '<span class="lg-cnt">'+lg.matches.length+'</span>';
      lHdrCell.addEventListener('click', function(){ toggleAccordion(lg.league); });

      var lHdrMarea = document.createElement('div');
      lHdrMarea.className = 'marea';
      // Add grid background to header marea as well to match
      lHdrRow.appendChild(lHdrCell);
      lHdrRow.appendChild(lHdrMarea);
      wrapper.appendChild(lHdrRow);

      if(!isCollapsed) {
          lg.matches.forEach(function(m){
              var row = document.createElement('div');
              row.className = 'mrow' + (isCollapsed ? ' hidden-lg' : '');
              row.setAttribute('data-lg', lg.league);

              // Channel cell
              var homeLogoUrl = m.homeLogo || getLogo(m.homeTeam);
              var awayLogoUrl = m.awayLogo || getLogo(m.awayTeam);
              var homeLogoHtml = homeLogoUrl ? (homeLogoUrl.startsWith('emoji:') ? '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">' + esc(homeLogoUrl.split(':')[1]) + '</div>' : '<img src="'+esc(homeLogoUrl)+'" class="chan-logo" onerror="this.style.display=\'none\'">') : (m.flag === '🎮' ? '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">🎮</div>' : '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">🛡️</div>');
              var awayLogoHtml = awayLogoUrl ? (awayLogoUrl.startsWith('emoji:') ? '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">' + esc(awayLogoUrl.split(':')[1]) + '</div>' : '<img src="'+esc(awayLogoUrl)+'" class="chan-logo" onerror="this.style.display=\'none\'">') : (m.flag === '🎮' ? '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">🎮</div>' : '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">🛡️</div>');

              var cCell = document.createElement('div');
              cCell.className = 'chan-cell';

              var isRacingEvent = !m.awayTeam || m.awayTeam.toLowerCase() === 'race' || m.awayTeam.toLowerCase().startsWith('fp') || m.awayTeam.toLowerCase().startsWith('qual');

              if (isRacingEvent) {
                  cCell.innerHTML = '<div class="chan-team" style="justify-content: center; width: 100%; height: 100%;">'
                                  + '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.homeTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;" onclick="toggleFavTeam(\''+escJs(m.homeTeam)+'\')">★</button>'
                                  + homeLogoHtml
                                  + '<span class="ch-name" title="'+esc(m.homeTeam)+'">'+esc(m.homeTeam) + (m.awayTeam ? ' - ' + esc(m.awayTeam) : '') + '</span></div>';
              } else {
                  cCell.innerHTML = '<div class="chan-team">'
                                  + '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.homeTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;" onclick="toggleFavTeam(\''+escJs(m.homeTeam)+'\')">★</button>'
                                  + homeLogoHtml
                                  + '<span class="ch-name" title="'+esc(m.homeTeam)+'">'+esc(m.homeTeam)+'</span></div>'
                                  + '<div class="chan-team">'
                                  + '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.awayTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;" onclick="toggleFavTeam(\''+escJs(m.awayTeam)+'\')">★</button>'
                                  + awayLogoHtml
                                  + '<span class="ch-name" title="'+esc(m.awayTeam)+'">'+esc(m.awayTeam)+'</span></div>';
              }

              var marea = document.createElement('div');
              marea.className = 'marea';

              var b = document.createElement('div');
              b.id = 'mb-'+m.id;

              var isLiveOrSoonLoc = m.status === 'live';
              var now = new Date();
              var currentEst = getEstTimeStrFromDate(now);
              var currentParts = currentEst.split(':');
              var currentMins = parseInt(currentParts[0], 10) * 60 + parseInt(currentParts[1], 10);

              if(m.status === 'upcoming' && m.startTime) {
                  var mParts = m.startTime.split(':');
                  var mMins = parseInt(mParts[0], 10) * 60 + parseInt(mParts[1], 10);
                  var diff = mMins - currentMins;
                  if (currentMins >= 1380 && mMins <= 60) diff += 1440;
                  if(diff <= 15 && diff > -1440) isLiveOrSoonLoc = true;
              }

              b.className = 'mb' + (m.status==='live' ? ' live' : '') + (m.status==='finished' ? ' finished' : '');
              b.setAttribute('data-home', m.homeTeam);
              b.setAttribute('data-away', m.awayTeam);
              b.setAttribute('data-lg', lg.league);
              if (isLiveOrSoonLoc) b.classList.add('is-live');
              if (favTeams[m.homeTeam] || favTeams[m.awayTeam] || favTeams[m.league]) b.classList.add('is-fav');

              var homeTeamName = normName(m.homeTeam) || 'A';
              var awayTeamName = normName(m.awayTeam) || 'B';
              var homeColor = lgColor(homeTeamName);
              var awayColor = lgColor(awayTeamName);
              var tColorsH = getTeamColors(m.homeTeam);
              var tColorsA = getTeamColors(m.awayTeam);
              if (tColorsH) homeColor = tColorsH[0];
              if (tColorsA) awayColor = tColorsA[0];

              if (userPrefs.cardColor === 'home') {
                  b.style.background = homeColor;
              } else if (userPrefs.cardColor === 'league') {
                  b.style.background = lgCol;
              } else if (userPrefs.cardColor === 'dark') {
                  b.style.background = 'rgba(255,255,255,0.05)';
              } else if (userPrefs.cardColor === 'split') {
                  b.style.background = 'linear-gradient(135deg, ' + homeColor + ' 50%, ' + awayColor + ' 50%)';
              } else if (userPrefs.cardColor === 'gradient') {
                  b.style.background = 'linear-gradient(90deg, ' + homeColor + ' 0%, ' + awayColor + ' 100%)';
              } else {
                  b.style.background = 'linear-gradient(135deg, ' + homeColor + ' 0%, ' + awayColor + ' 100%)';
              }

              var homeScore = m.score && typeof m.score[0] !== 'undefined' ? m.score[0] : '';
              var awayScore = m.score && typeof m.score[1] !== 'undefined' ? m.score[1] : '';

              var matchScoreText = (homeScore !== '' && awayScore !== '') ? homeScore + ' - ' + awayScore : '';
              var timeBadge = '';

              if (m.status === 'live') {
                  timeBadge = '<div class="mb-time" style="background:rgba(255,255,255,0.2);color:#fff;padding:2px 8px;border-radius:6px;font-weight:bold;">' + (m.minute ? esc(m.minute) : 'LIVE') + (matchScoreText ? ' | ' + matchScoreText : '') + '</div>';
              } else if (m.status === 'finished') {
                  timeBadge = '<div class="mb-time" style="background:rgba(255,255,255,0.1);color:#fff;padding:2px 8px;border-radius:6px;font-weight:bold;">' + (matchScoreText ? 'Terminé | ' + matchScoreText : 'Terminé') + '</div>';
                  if (!matchScoreText) {
                      timeBadge = '<div class="mb-time" style="background:rgba(255,255,255,0.1);color:var(--muted);padding:2px 8px;border-radius:6px;font-weight:bold;">' + m.startTime + '</div>';
                  }
              } else {
                  timeBadge = '<div class="mb-time" style="padding:2px 8px;border-radius:6px;font-weight:bold;background:rgba(0,0,0,0.3);">' + m.startTime + '</div>';
              }

              var streamsBadge = m.streamLinks && m.streamLinks.length>0 ? '<div class="mb-sn">'+m.streamLinks.length+' flux</div>' : '';

              if (m.awayTeam) {
                  b.innerHTML = '<div class="mb-teams" style="flex-direction: row; justify-content: space-between; align-items: center; gap: 12px;">'
                              +   '<div class="mb-team-row" style="flex: 1; justify-content: flex-end; text-align: right; width: auto;">'
                              +     '<div class="mb-t" style="text-align: right;" title="'+esc(m.homeTeam)+'">'+esc(m.homeTeam)+'</div>'
                              +     homeLogoHtml
                              +   '</div>'
                              +   '<div class="mb-team-row" style="flex: 1; justify-content: flex-start; text-align: left; width: auto;">'
                              +     awayLogoHtml
                              +     '<div class="mb-t" title="'+esc(m.awayTeam)+'">'+esc(m.awayTeam)+'</div>'
                              +   '</div>'
                              + '</div>'
                              + '<div class="mb-m" style="justify-content: center; margin-top: 4px;">'+timeBadge+streamsBadge+'</div>';
              } else {
                  b.innerHTML = '<div class="mb-teams" style="flex-direction: row; justify-content: center; align-items: center; gap: 12px;">'
                              +   '<div class="mb-team-row" style="flex: 1; justify-content: center; text-align: center; width: auto;">'
                              +     homeLogoHtml
                              +     '<div class="mb-t" style="text-align: center;" title="'+esc(m.homeTeam)+'">'+esc(m.homeTeam)+'</div>'
                              +   '</div>'
                              + '</div>'
                              + '<div class="mb-m" style="justify-content: center; margin-top: 4px;">'+timeBadge+streamsBadge+'</div>';
              }

              // Calculate position via CSS vars
              var parts = m.startTime.split(':');
              var mH = parseInt(parts[0], 10);
              var mM = parseInt(parts[1], 10);

              var duration = m.durationMinutes || 105;
              if (m.status === 'live') {
                  var matchStartMins = mH * 60 + mM;
                  var tempCurrentMins = currentMins;
                  if (tempCurrentMins < matchStartMins && (matchStartMins - tempCurrentMins) > 12 * 60) {
                      tempCurrentMins += 24 * 60; // wrap around midnight
                  } else if (matchStartMins < tempCurrentMins && (tempCurrentMins - matchStartMins) > 12 * 60) {
                      matchStartMins += 24 * 60; // match start is near midnight previous day
                  }
                  var matchEndMins = matchStartMins + duration;
                  if (tempCurrentMins > matchEndMins - 15) {
                      duration = (tempCurrentMins - matchStartMins) + 15;
                  }
              }

              b.style.setProperty('--start-h', mH);
              b.style.setProperty('--start-m', mM);
              b.style.setProperty('--duration-m', duration);

              b.addEventListener('click', function(){ openMod(m, lgCol); });
              marea.appendChild(b);

              row.appendChild(cCell);
              row.appendChild(marea);
              wrapper.appendChild(row);
          });
      }
    });

    containerToAppend.appendChild(wrapper);
    return wrapper;
};

var mainLeagues = [];
var autresLeagues = [];

leagues.forEach(function(lg) {
    if (!lg) return;
    if (!DEFAULT_LEAGUES[(lg.league||'').toUpperCase()] && (!OTHER_LEAGUES || !OTHER_LEAGUES[(lg.league||'').toUpperCase()]) && lg.league !== 'FAVORIS' && lg.league !== 'EN DIRECT') {
        autresLeagues.push(lg);
    } else {
        mainLeagues.push(lg);
    }
});

renderTimelineGuide(mainLeagues, epgContainer);

if (autresLeagues.length > 0) {
    var sectionId = 'autresStreamsEpg';
    if (S.collapsedSections[sectionId] === undefined) {
        S.collapsedSections[sectionId] = true;
    }

    var autresSecTitle = document.createElement('div');
    autresSecTitle.style.cssText = 'padding: 16px 24px 8px; font-weight: bold; font-size: 18px; color: var(--text); border-bottom: 1px solid var(--border); margin-bottom: 16px; margin-top: 24px; display: flex; align-items: center; gap: 8px; cursor: pointer;';

    var isCollapsed = S.collapsedSections[sectionId];

    var icon = document.createElement('span');
    icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
    icon.style.transition = 'transform 0.2s';
    if (isCollapsed) {
        icon.style.transform = 'rotate(-90deg)';
    }
    autresSecTitle.appendChild(icon);

    var textSpan = document.createElement('span');
    textSpan.textContent = "Autres streams";
    autresSecTitle.appendChild(textSpan);
    epgContainer.appendChild(autresSecTitle);

    var autresWrapperContainer = document.createElement('div');
    autresWrapperContainer.style.display = isCollapsed ? 'none' : 'block';
    epgContainer.appendChild(autresWrapperContainer);

    var autresRendered = false;

    var toggleAutres = function() {
        S.collapsedSections[sectionId] = !S.collapsedSections[sectionId];
        if (S.collapsedSections[sectionId]) {
            icon.style.transform = 'rotate(-90deg)';
            autresWrapperContainer.style.display = 'none';
        } else {
            icon.style.transform = '';
            autresWrapperContainer.style.display = 'block';
            if (!autresRendered) {
                renderTimelineGuide(autresLeagues, autresWrapperContainer);
                autresRendered = true;
                updateNowLine();
            }
        }
    };

    autresSecTitle.addEventListener('click', toggleAutres);

    // If initially expanded, render it
    if (!isCollapsed) {
        renderTimelineGuide(autresLeagues, autresWrapperContainer);
        autresRendered = true;
    }
}

  // Note: we can remove the old gl/glh DOM grid lines because we added repeating-linear-gradient in CSS!
  } // End of else block for timeline EPG

  /* Legend Toggle Bar */
  var bar=document.getElementById('sbar');
  if (bar) bar.querySelectorAll('.lchip,.vsep:not(:first-child)').forEach(function(e){e.remove();});

  var allLeaguesMap = {};
  matches.forEach(function(m){
      if(m.league !== 'EN DIRECT') {
          allLeaguesMap[m.league] = {flag: m.flag, color: m.color};
      }
  });
  var allLeagues = Object.keys(allLeaguesMap).sort();

  if(bar) allLeagues.forEach(function(lgName,i){
    if(i>0){var s=document.createElement('div');s.className='vsep';bar.appendChild(s);}
    var ch=document.createElement('div');
    ch.className='lchip' + (S.hiddenLg[lgName] ? ' off' : '');
    ch.innerHTML='<div class="ldotc" style="background:'+(allLeaguesMap[lgName].color||lgColor(lgName))+'"></div>'+allLeaguesMap[lgName].flag+' '+esc(lgName);
    ch.addEventListener('click', function() { toggleLeague(lgName); });
    bar.appendChild(ch);
  });



  updateNowLine();
}

// Event listeners for automatic scrolling based on the load sequence and filter changes
window.addEventListener('loadSequenceComplete', function() {
    requestAnimationFrame(function() {
        scrollToNow();
    });
});

window.addEventListener('filterChanged', function() {
    requestAnimationFrame(function() {
        scrollToNow();
    });
});

export function updateNowLine() {
    var lines = document.querySelectorAll('.now-line');
    if(lines.length === 0) return;

    var now = new Date();
    var isToday = (TARGET_DATE.toDateString() === now.toDateString());

    lines.forEach(function(line) {
        if(isToday) {
            var estStr = getEstTimeStrFromDate(now);
            var parts = estStr.split(':');
            var h = parseInt(parts[0], 10);
            var m = parseInt(parts[1], 10);

            line.style.setProperty('--now-h', h);
            line.style.setProperty('--now-m', m);
            line.style.display = 'block';
            line.setAttribute('data-t', estStr);
        } else {
            line.style.display = 'none';
        }
    });
}

setInterval(updateNowLine, 60000);

export function scrollToNow(){
    var epgContainer = document.getElementById('marea');
    if(!epgContainer || epgContainer.style.display === 'none') return;

    var now = new Date();
    var isToday = (TARGET_DATE.toDateString() === now.toDateString());
    if(!isToday) return;

    var rootStyles = getComputedStyle(document.documentElement);
    var hourPx = parseFloat(rootStyles.getPropertyValue('--hour-px')) || (window.innerWidth <= 768 ? 140 : 220);
    var minPx = hourPx / 60;

    var estStr = getEstTimeStrFromDate(now);
    var parts = estStr.split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);

    var w = epgContainer.clientWidth;
    var hClient = epgContainer.clientHeight;
    var chanW = parseFloat(rootStyles.getPropertyValue('--chan-w')) || (window.innerWidth <= 768 ? 100 : 240);
    var offsetPx = (h * hourPx) + (m * minPx) + chanW; // using chanW as offset for the ruler height/width

    if (window.innerWidth <= 768) {
        epgContainer.scrollTop = Math.max(0, offsetPx - chanW);
    } else {
        epgContainer.scrollLeft = Math.max(0, offsetPx - chanW);
    }
}


/* ══ MODAL ══════════════════════════════ */
export var QC ={'HD':'bHD','SD':'bSD','4K':'b4K','4k':'b4K'};
export var QI ={'HD':'📺','SD':'📱','4K':'🖥','4k':'🖥'};

export function renderFluxItem(s, i, m) {
    var ev="openFlux(event,'"+escJs(encodeURIComponent(s.url||'#'))+"','"+escJs(encodeURIComponent(s.name||'Flux'))+"','"+escJs(m.id)+"')";

    var addMvEv = "";
    if (window.multiviewPendingAction && window.multiviewPendingAction.type === 'replace') {
        addMvEv = "mvFlux[" + window.multiviewPendingAction.replaceIdx + "].url='" + escJs(s.url||'#') + "'; mvFlux[" + window.multiviewPendingAction.replaceIdx + "].name='" + escJs(m.homeTeam) + " vs " + escJs(m.awayTeam) + "'; mvFlux[" + window.multiviewPendingAction.replaceIdx + "].mid='" + escJs(m.id) + "'; saveMultivisionState(); updateMultivisionLayout(); window.multiviewPendingAction=null; closeMod(); if(document.getElementById('mv-container') && document.getElementById('mv-container').classList.contains('mv-pip')){ toggleMultiviewPip(); } event.stopPropagation(); event.preventDefault();";
    } else if (window.multiviewPendingAction && window.multiviewPendingAction.type === 'add') {
        addMvEv = "addToMultivision('"+escJs(s.url||'#')+"','"+escJs(m.homeTeam)+' vs '+escJs(m.awayTeam)+"', '"+escJs(m.id)+"'); window.multiviewPendingAction=null; closeMod(); if(document.getElementById('mv-container') && document.getElementById('mv-container').classList.contains('mv-pip')){ toggleMultiviewPip(); } event.stopPropagation(); event.preventDefault();";
    } else {
        addMvEv = "addToMultivision('"+escJs(s.url||'#')+"','"+escJs(m.homeTeam)+' vs '+escJs(m.awayTeam)+"', '"+escJs(m.id)+"'); closeMod(); event.stopPropagation(); event.preventDefault();";
    }

    var dom = getDomain(s.url);
    var pref = domainPrefs[dom] || 0;
    var favEv = "toggleDomainPref('"+escJs(dom)+"', 'fav', '"+escJs(m.id)+"');event.stopPropagation();event.preventDefault();";
    var depEv = "toggleDomainPref('"+escJs(dom)+"', 'dep', '"+escJs(m.id)+"');event.stopPropagation();event.preventDefault();";

    return '<div class="si" style="display:flex; flex-direction:row; align-items:center; flex-wrap:wrap; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:12px; overflow:hidden; transition:all 0.2s; margin-bottom: 12px; padding-right:8px;">'
      +'<a href="#" onclick="'+ev+'" style="flex:1; display:flex; align-items:center; gap:16px; padding:16px; color:var(--text); text-decoration:none; min-width:200px;">'
      +'<div class="si-ic" style="font-size:24px;">'+(s.icon||QI[s.quality]||'📺')+'</div>'
      +'<div class="si-inf" style="flex:1; overflow:hidden;"><div class="si-n" style="font-weight:600; font-size:13px; word-break:break-all;">'+esc(s.name||'Flux '+(i+1))+'</div></div>'
      +'<span class="sbadge '+(QC[s.quality]||'bSD')+'">'+(s.quality||'SD')+'</span>'
      +'</a>'
      +'<div style="display:flex; align-items:center; padding:8px; gap:2px; margin-left:auto;">'
        +'<button title="Prioriser ce domaine" aria-label="Prioriser ce domaine" onclick="'+favEv+'" style="width:28px; height:28px; border-radius:8px; background:'+(pref===1?'var(--accent)':'rgba(255,255,255,0.05)')+'; border:none; color:'+(pref===1?'#fff':'var(--muted)')+'; cursor:pointer; font-size:12px; transition:all 0.2s; display:flex; align-items:center; justify-content:center;">⭐</button>'
        +'<button title="Déprioriser ce domaine" aria-label="Déprioriser ce domaine" onclick="'+depEv+'" style="width:28px; height:28px; border-radius:8px; background:'+(pref===-1?'var(--red)':'rgba(255,255,255,0.05)')+'; border:none; color:'+(pref===-1?'#fff':'var(--muted)')+'; cursor:pointer; font-size:12px; transition:all 0.2s; display:flex; align-items:center; justify-content:center;">👎</button>'
        +'<button title="Ajouter au Multivision" aria-label="Ajouter au Multivision" onclick="'+addMvEv+'" style="width:28px; height:28px; border-radius:8px; background:rgba(255,255,255,0.05); border:none; color:var(--text); cursor:pointer; font-weight:600; font-size:14px; display:flex; align-items:center; justify-content:center; margin-left:4px;">⊞</button>'
      +'</div>'
      +'</div>';
}

export function openMod(m,col){
  document.getElementById('mdot').style.background=col||'#888';

  var hLogo = m.homeLogo || getLogo(m.homeTeam);
  var aLogo = m.awayLogo || getLogo(m.awayTeam);


  document.getElementById('mname').innerHTML = '';
  document.getElementById('mname').dataset.matchName = m.homeTeam+' — '+m.awayTeam;


  document.getElementById('mmeta').innerHTML = '';
  document.getElementById('mscore').innerHTML = '';

  if (window.modalStatsInterval) { clearInterval(window.modalStatsInterval); window.modalStatsInterval = null; }

  function fetchAndRenderModalStats() {
      if (m.id && m.id.startsWith('espn_')) {
          fetchGameStats(m.id).then(function(res) {
              var scoreCont = document.getElementById('mscore');
              if (!scoreCont || document.getElementById('mname').dataset.matchName.indexOf(m.homeTeam) === -1) {
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

              var recordsContainer = document.getElementById('records-container');
              if (recordsContainer) {
                  if (res.hRank || res.aRank || res.hForm || res.aForm) {
                      var hFmt = (res.hRank ? '<span style="font-weight:bold; color:var(--text);">#' + res.hRank + '</span> ' : '') + (res.hForm ? '<span style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; margin-left:4px;">' + res.hForm + '</span>' : '');
                      var aFmt = (res.aRank ? '<span style="font-weight:bold; color:var(--text);">#' + res.aRank + '</span> ' : '') + (res.aForm ? '<span style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; margin-left:4px;">' + res.aForm + '</span>' : '');
                      var rHtml = '<div style="display:flex; justify-content:space-between; width:100%; font-size:11px; color:rgba(255,255,255,0.7); padding: 0 10px;">';
                      rHtml += '<div style="flex:1; text-align:center; display:flex; justify-content:center; align-items:center;">' + hFmt + '</div>';
                      rHtml += '<div style="flex:0.2;"></div>';
                      rHtml += '<div style="flex:1; text-align:center; display:flex; justify-content:center; align-items:center;">' + aFmt + '</div>';
                      rHtml += '</div>';
                      recordsContainer.innerHTML = rHtml;
                      recordsContainer.style.display = 'block';
                  }
              }

              if (res.scorers && res.scorers.length > 0) {
                  var hScorers = [], aScorers = [];
                  res.scorers.forEach(function(s) {
                      if (s.isHome !== undefined) {
                          if (s.isHome) hScorers.push(s);
                          else aScorers.push(s);
                      } else if (s.teamId) {
                          if (mHomeId && s.teamId == mHomeId) hScorers.push(s);
                          else if (mAwayId && s.teamId == mAwayId) aScorers.push(s);
                          else aScorers.push(s);
                      } else {
                          aScorers.push(s);
                      }
                  });

                  var homeScorersModal = document.getElementById('home-scorers-modal');
                  if (homeScorersModal) {
                      var hHtml = '';
                      hScorers.forEach(function(s) {
                          var passerHtml = s.passer ? ' <span style="font-size:10px; opacity:0.8;">(' + esc(s.passer) + ')</span>' : '';
                          hHtml += '<div style="margin-top:4px;">⚽ <span style="color:#fff;">' + esc(s.player) + '</span> <span style="color:var(--accent);">' + esc(s.time) + '</span>' + passerHtml + '</div>';
                      });
                      homeScorersModal.innerHTML = hHtml;
                  }

                  var awayScorersModal = document.getElementById('away-scorers-modal');
                  if (awayScorersModal) {
                      var aHtml = '';
                      aScorers.forEach(function(s) {
                          var passerHtml = s.passer ? ' <span style="font-size:10px; opacity:0.8;">(' + esc(s.passer) + ')</span>' : '';
                          aHtml += '<div style="margin-top:4px;">⚽ <span style="color:#fff;">' + esc(s.player) + '</span> <span style="color:var(--accent);">' + esc(s.time) + '</span>' + passerHtml + '</div>';
                      });
                      awayScorersModal.innerHTML = aHtml;
                  }
              }

              var espnBtnContainer = document.getElementById('espn-btn-container');
              if (espnBtnContainer && res.espnLink) {
                  var espnBtn = document.createElement('a');
                  espnBtn.href = esc(res.espnLink);
                  espnBtn.target = '_blank';
                  espnBtn.innerHTML = '📰 Stats complètes sur ESPN';
                  espnBtn.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:6px; color:var(--text); text-decoration:none; background:rgba(255,255,255,0.05); padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600; border:1px solid rgba(255,255,255,0.1); transition:all 0.2s;';
                  espnBtn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.1)'; };
                  espnBtn.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.05)'; };
                  espnBtnContainer.appendChild(espnBtn);
                  espnBtnContainer.style.display = 'block';
              }

              if (mHomeId && mAwayId) {
                  Promise.all([
                      fetchTeamInfo(m.league, mHomeId),
                      fetchTeamInfo(m.league, mAwayId)
                  ]).then(function(teamResults) {
                      var hTeam = teamResults[0].team && teamResults[0].team.team ? teamResults[0].team.team : teamResults[0].team;
                      var aTeam = teamResults[1].team && teamResults[1].team.team ? teamResults[1].team.team : teamResults[1].team;

                      if (hTeam && aTeam && hTeam.record && aTeam.record && hTeam.record.items && aTeam.record.items) {
                          var hTotalRec = hTeam.record.items.find(function(r) { return r.type === 'total'; });
                          var aTotalRec = aTeam.record.items.find(function(r) { return r.type === 'total'; });

                          if (hTotalRec && aTotalRec && hTotalRec.stats && aTotalRec.stats) {
                              // Global Stats Toggle
                              var globalStatsToggleContainer = document.getElementById('global-stats-toggle-container');
                              if (globalStatsToggleContainer) {
                                  var toggleBtn = document.createElement('button');
                                  toggleBtn.innerHTML = '📊 Voir les statistiques de la saison';
                                  toggleBtn.style.cssText = 'display:flex; width:100%; align-items:center; justify-content:center; gap:6px; color:var(--text); background:transparent; border:none; padding:8px 16px; font-size:13px; font-weight:600; cursor:pointer; opacity:0.8; transition:all 0.2s;';
                                  toggleBtn.onmouseover = function() { this.style.opacity = '1'; };
                                  toggleBtn.onmouseout = function() { this.style.opacity = '0.8'; };

                                  var statsContentId = 'inline-global-stats';
                                  toggleBtn.onclick = function() {
                                      var cont = document.getElementById(statsContentId);
                                      if (cont) {
                                          cont.style.display = cont.style.display === 'none' ? 'block' : 'none';
                                      }
                                  };

                                  globalStatsToggleContainer.appendChild(toggleBtn);

                                  var inlineStats = document.createElement('div');
                                  inlineStats.id = statsContentId;
                                  inlineStats.style.display = 'none';
                                  inlineStats.style.marginTop = '12px';
                                  inlineStats.style.paddingTop = '12px';
                                  inlineStats.style.borderTop = '1px dashed rgba(255,255,255,0.05)';

                                  var statsListHtml = '<div style="display:flex; flex-direction:column; gap:8px;">';

                                  var statsToCompare = ['wins', 'losses', 'winPercent', 'streak'];
                                  var statLabels = {
                                      'wins': 'Victoires', 'losses': 'Défaites', 'differential': 'Différentiel', 'streak': 'Séquence',
                                      'points': 'Pts', 'ties': 'Nuls', 'otLosses': 'DP', 'winPercent': 'Pourcentage', 'gamesBehind': 'Retard',
                                      'pointsFor': 'Buts', 'pointDifferential': 'Différentiel', 'assists': 'Passes décisives', 'pointsAgainst': 'Buts encaissés'
                                  };

                                  var __lg = m.league ? m.league.toUpperCase() : '';
                                  if (__lg.indexOf('LIGUE 1') > -1 || __lg.indexOf('PREMIER LEAGUE') > -1 || __lg.indexOf('LA LIGA') > -1 || __lg.indexOf('SERIE A') > -1 || __lg.indexOf('BUNDESLIGA') > -1 || __lg.indexOf('MLS') > -1 || __lg.indexOf('CHAMPIONS LEAGUE') > -1 || __lg.indexOf('EUROPA') > -1 || __lg.indexOf('SOCCER') > -1) {
                                      statsToCompare = ['pointsFor', 'pointDifferential', 'assists', 'pointsAgainst'];
                                  } else if (__lg === 'NHL' || __lg === 'PWHL' || __lg.indexOf('HOCKEY') > -1 || __lg === 'AHL' || __lg === 'QMJHL' || __lg === 'OHL' || __lg === 'WHL') {
                                      statsToCompare = ['points', 'wins', 'losses', 'otLosses'];
                                  } else if (__lg === 'MLB' || __lg.indexOf('BASEBALL') > -1) {
                                      statsToCompare = ['wins', 'losses', 'winPercent', 'gamesBehind'];
                                  }

                                  statsToCompare.forEach(function(sName) {
                                      var hStat = hTotalRec.stats.find(function(s) { return s.name === sName; });
                                      var aStat = aTotalRec.stats.find(function(s) { return s.name === sName; });

                                      if (hStat || aStat) {
                                          var hVal = '-';
                                          if (hStat) {
                                              hVal = hStat.displayValue !== undefined ? hStat.displayValue : (hStat.value !== undefined ? hStat.value : '-');
                                          }
                                          var aVal = '-';
                                          if (aStat) {
                                              aVal = aStat.displayValue !== undefined ? aStat.displayValue : (aStat.value !== undefined ? aStat.value : '-');
                                          }
                                          var lbl = statLabels[sName] || sName;

                                          statsListHtml += '<div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">';
                                          statsListHtml += '<div style="flex:1; text-align:center; font-weight:bold;">' + esc(hVal) + '</div>';
                                          statsListHtml += '<div style="flex:1; text-align:center; color:var(--muted);">' + esc(lbl) + '</div>';
                                          statsListHtml += '<div style="flex:1; text-align:center; font-weight:bold;">' + esc(aVal) + '</div>';
                                          statsListHtml += '</div>';
                                      }
                                  });

                                  statsListHtml += '</div>';
                                  statsListHtml += '<div style="text-align:center; margin-top:12px;"><button onclick="openGlobalStatsFromMatch(\'' + escJs(m.id) + '\'); closeMod();" style="background:var(--accent); color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">Ouvrir le panneau complet</button></div>';

                                  inlineStats.innerHTML = statsListHtml;

                                  globalStatsToggleContainer.appendChild(inlineStats);
                                  globalStatsToggleContainer.style.display = 'block';
                              }
                          }
                      }
                  }).catch(function(e) {
                      console.error("Failed to load team info for modal stats", e);
                  });
              }


          }).catch(function(e) {});
      }
  }

  fetchAndRenderModalStats();
  if (window.modalStatsInterval) clearInterval(window.modalStatsInterval);
  if (m.status === 'live') {
      window.modalStatsInterval = setInterval(fetchAndRenderModalStats, 300000);
  }

  var body=document.getElementById('mbody');

  var homeScore = m.score && typeof m.score[0] !== 'undefined' ? m.score[0] : '';
  var awayScore = m.score && typeof m.score[1] !== 'undefined' ? m.score[1] : '';
  var homeColor = lgColor(normName(m.homeTeam));
  var awayColor = lgColor(normName(m.awayTeam));
  var tColorsH = getTeamColors(m.homeTeam);
  var tColorsA = getTeamColors(m.awayTeam);
  if (tColorsH) homeColor = tColorsH[0];
  if (tColorsA) awayColor = tColorsA[0];
  var lgCol2 = m.color || lgColor(m.league);

  var cardBg = '';
  if (userPrefs.cardColor === 'home') {
      cardBg = homeColor;
  } else if (userPrefs.cardColor === 'league') {
      cardBg = lgCol2;
  } else if (userPrefs.cardColor === 'dark') {
      cardBg = 'rgba(255,255,255,0.05)';
  } else if (userPrefs.cardColor === 'split') {
      cardBg = 'linear-gradient(135deg, ' + homeColor + ' 50%, ' + awayColor + ' 50%)';
  } else if (userPrefs.cardColor === 'gradient') {
      cardBg = 'linear-gradient(90deg, ' + homeColor + ' 0%, ' + awayColor + ' 100%)';
  } else {
      cardBg = 'linear-gradient(135deg, ' + homeColor + ' 0%, ' + awayColor + ' 100%)';
  }

  var streamsBadgePrime = "";
  var lgBadge = '<div class="prime-league-badge">'+m.flag+'</div>';

  var homeLogoHtmlPrime = hLogo ? (hLogo.startsWith('emoji:') ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">' + esc(hLogo.split(':')[1]) + '</div>' : '<img src="'+esc(hLogo)+'" class="prime-logo" onerror="this.style.display=\'none\'" alt="'+esc(m.homeTeam)+'">') : (m.flag === '🎮' ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🎮</div>' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>');
  var awayLogoHtmlPrime = aLogo ? (aLogo.startsWith('emoji:') ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">' + esc(aLogo.split(':')[1]) + '</div>' : '<img src="'+esc(aLogo)+'" class="prime-logo" onerror="this.style.display=\'none\'" alt="'+esc(m.awayTeam)+'">') : (m.flag === '🎮' ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🎮</div>' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>');

  var isRacing = !m.awayTeam || m.awayTeam.toLowerCase() === 'race' || m.awayTeam.toLowerCase().startsWith('fp') || m.awayTeam.toLowerCase().startsWith('qual');

  var logosHtml = !isRacing ?
                  '<div class="prime-logo-wrapper home" style="flex:1; display:flex; justify-content:center;">' + homeLogoHtmlPrime + '</div><div style="flex:0.2;"></div><div class="prime-logo-wrapper away" style="flex:1; display:flex; justify-content:center;">' + awayLogoHtmlPrime + '</div>' :
                  '<div class="prime-logo-wrapper home" style="width: 100%; display: flex; justify-content: center;">' + homeLogoHtmlPrime + '</div>';

  var statusHtml = '';
  if(m.status === 'live') {
      statusHtml = '<div class="live-indicator status-text" style="color:var(--red); font-weight:800; display:flex; align-items:center; justify-content:center; gap:6px; font-size:13px; margin-top:8px;"><span class="mb-ld" style="width:8px;height:8px;border-radius:50%;background:var(--red);display:inline-block;"></span><span class="status-minute">'+(m.minute?esc(m.minute):'LIVE')+'</span></div>';
  } else if(m.status === 'finished') {
      statusHtml = '<div class="status-text" style="color:var(--muted); font-size:14px; font-weight:600; text-align:center; margin-top:8px;"><span class="status-minute">' + (m.score ? 'Fin' : m.startTime) + '</span></div>';
  } else {
      statusHtml = '<div class="status-text" style="color:var(--muted); font-size:14px; font-weight:600; text-align:center; margin-top:8px;"><span class="status-minute">'+m.startTime+'</span></div>';
  }

  var centerScoreHtml = '';
  if (!isRacing) {
      if (homeScore !== '' && awayScore !== '') {
          centerScoreHtml = '<div style="font-size: 32px; font-weight: 800; line-height: 1; display:flex; gap: 12px; align-items:center; justify-content:center; letter-spacing:-1px;"><span>'+homeScore+'</span><span style="color:var(--muted2); font-size:24px;">-</span><span>'+awayScore+'</span></div>';
      } else {
          centerScoreHtml = '<div style="font-size: 20px; font-weight: 800; line-height: 1; display:flex; align-items:center; justify-content:center; color:var(--muted2);">VS</div>';
      }
  }

  var teamsHtml = !isRacing ?
                  '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-top:12px; font-size:13px; font-weight:700; color:#fff; text-align:center; line-height:1.2; padding:0 8px;">' +
                      '<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;">' +
                          '<div title="'+esc(m.homeTeam)+'">'+esc(m.homeTeam)+' <button style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.homeTeam]?'var(--accent)':'var(--muted)')+';" onclick="toggleFavTeam(\''+escJs(m.homeTeam)+'\'); event.stopPropagation();">★</button></div>' +
                      '</div>' +
                      '<div style="flex:0.2;"></div>' +
                      '<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;">' +
                          '<div title="'+esc(m.awayTeam)+'"><button style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.awayTeam]?'var(--accent)':'var(--muted)')+';" onclick="toggleFavTeam(\''+escJs(m.awayTeam)+'\'); event.stopPropagation();">★</button> '+esc(m.awayTeam)+'</div>' +
                      '</div>' +
                  '</div>' :
                  '<div style="display:flex; justify-content:center; align-items:center; margin-top:12px; font-size:16px; font-weight:700; color:#fff; text-align:center; flex-direction:column;">' +
                      '<div title="'+esc(m.homeTeam)+'"><button style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.homeTeam]?'var(--accent)':'var(--muted)')+';margin-right:4px;" onclick="toggleFavTeam(\''+escJs(m.homeTeam)+'\'); event.stopPropagation();">★</button>'+esc(m.homeTeam) + (m.awayTeam ? ' - ' + esc(m.awayTeam) : '') + '</div>' +
                  '</div>';


  var mhd = document.querySelector('.mhd');
  if (mhd) mhd.style.display = 'none';
  var mft = document.querySelector('.mft');
  if (mft) mft.style.display = 'none';

  var wrapperHtml = '<div style="display:flex; flex-direction:row; flex-wrap:wrap; gap: 24px; align-items: flex-start; width: 100%; position: relative;">' +
      '<button class="mx" aria-label="Fermer la modale" title="Fermer" onclick="closeMod()" style="position: absolute; top: -10px; right: -10px; z-index: 100; pointer-events: auto;"><span class="ic ic-close"></span></button>' +
      '<div id="modal-left-col" style="flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 16px; z-index: 10; padding-bottom: 10px; padding-top: 10px;">' +
          '<div class="match-card scoreboard" style="display:flex; flex-direction:column; position:relative; pointer-events:none;">' +
              '<div class="prime-thumbnail" style="background:'+cardBg+'; position:relative; width:100%; aspect-ratio:21/9; border-radius:var(--radius-card,12px); overflow:hidden; box-shadow:0 10px 20px rgba(0,0,0,0.3); display:flex; background-color:var(--bg2); z-index: 1;">' +
                  lgBadge +

                  '<div class="prime-logos" style="position:absolute; inset:0; display:flex; z-index:2;">' +
                      logosHtml +
                  '</div>' +
              '</div>' +
              '<div class="prime-info" style="display:flex; flex-direction:column; padding: 16px; pointer-events:auto; z-index: 2;">' +
                  teamsHtml +
                  '<div style="margin-top:16px;">' + centerScoreHtml + '</div>' +
                  statusHtml +
                  '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-top:12px; font-size:13px; color:#fff; text-align:center; padding:0 8px;">' +
                      '<div id="home-scorers-modal" style="flex:1; font-size:11px; font-weight:500; color:var(--muted); text-align:center;"></div>' +
                      '<div style="flex:0.2;"></div>' +
                      '<div id="away-scorers-modal" style="flex:1; font-size:11px; font-weight:500; color:var(--muted); text-align:center;"></div>' +
                  '</div>' +
                  '<div id="records-container" style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 12px; padding-top: 12px; display: none;"></div>' +
                  '<div id="goal-stats-container" style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 12px; padding-top: 12px; display: none;"></div>' +
                  '<div id="global-stats-toggle-container" style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 12px; padding-top: 12px; display: none;"></div>' +
                  '<div id="espn-btn-container" style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 12px; padding-top: 12px; display: none;"></div>' +
              '</div>' +
          '</div>' +
          '<div id="modal-stats-container"></div>' +
      '</div>' +
      '<div id="modal-right-col" style="flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 12px;"></div>' +
  '</div>';

  body.innerHTML = wrapperHtml;

  var rightCol = document.getElementById('modal-right-col');

  // When a user clicks a match, we ALWAYS fetch streams if there are none available yet,
  // bypassing background state checks that might erroneously be true.
  var hasEnoughStreams = m.streamLinks && m.streamLinks.length > 0;
  var needsScraping = !hasEnoughStreams && m.matchUrl;

  // Header section for right column (Refresh + Random Multiview)
  var rightHeaderHtml = '<div style="display:flex; justify-content:flex-end; align-items:center; gap:8px; margin-bottom:8px;">';

  // Refresh button
  rightHeaderHtml += '<button id="mv-refresh-btn" title="Mettre à jour les streams" style="background:transparent; border:none; color:var(--text); font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:0.8; transition:all 0.2s; padding:4px;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.8\'" ' + (!m.matchUrl ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : '') + '>🔄</button>';

  // Random Multiview button
  rightHeaderHtml += '<button id="mv-random-btn" title="Ajouter un stream aléatoire à la Multivision" style="background:transparent; border:none; color:var(--text); font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:0.8; transition:all 0.2s; padding:4px;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.8\'">⊞</button>';

  rightHeaderHtml += '</div>';

  // This will attach events to the header buttons once rightCol.innerHTML is set
  function attachHeaderEvents() {
      var refreshBtn = document.getElementById('mv-refresh-btn');
      if (refreshBtn) {
          refreshBtn.onclick = function() {
              this.style.opacity = '0.5';
              this.disabled = true;

              var rightCol = document.getElementById('modal-right-col');
              if(rightCol) {
                  rightCol.innerHTML = rightHeaderHtml + '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; color:var(--muted2); gap: 16px;"><div class="spinner"></div><div style="font-weight: 600;">Recherche de streams...</div><div style="font-size: 12px; opacity: 0.6;">(Actualisation en cours)</div></div>';
                  attachHeaderEvents();
              }

              m.streamLinks = [];
              m.streamsLoaded = false;

              scrapeMatchFlux(m, true).finally(function() {
                  if (document.getElementById('mbg').classList.contains('open') && document.getElementById('mname').dataset.matchName.indexOf(m.homeTeam) >= 0) {
                      openMod(m, col);
                  }
              });
          };
      }
      var randomBtn = document.getElementById('mv-random-btn');
      if (randomBtn) {
          randomBtn.onclick = function(e) {
              e.stopPropagation();
              e.preventDefault();
              if (m && m.streamLinks && m.streamLinks.length > 0) {
                  var sList = m.streamLinks;
                  var s4k = sList.filter(function(s) {
                      return (s.quality && s.quality.toUpperCase() === '4K') || (s.name && s.name.toUpperCase().indexOf('4K') > -1);
                  });
                  var sel = s4k.length > 0 ? s4k[0] : sList[Math.floor(Math.random() * sList.length)];
                  addToMultivision(sel.url || '#', m.homeTeam + ' vs ' + m.awayTeam, m.id);
                  closeMod();
              }
          };
      }
  }

  // Look for scraped links that didn't merge
  var unmerged = (S.matches || []).filter(function(x) {
      return x.id.startsWith('scraped_') || x.id.startsWith('bs_') || x.id.startsWith('se_') || x.id.startsWith('ts_') || x.id.startsWith('vip_');
  });
  var possibleMatches = [];
  var mH = normName(m.homeTeam);
  var mA = normName(m.awayTeam);

  var didAbsorbNewStream = false;

  unmerged.forEach(function(u) {
      if (u.id === m.id || DEFAULT_LEAGUES[(u.league||'').toUpperCase()]) return; // ignore self or already merged ones
      var uH = normName(u.homeTeam);
      var uA = normName(u.awayTeam);

      // Stronger fuzzy match for suggestions: MUST match both teams (or inverted) to automatically absorb
      var isStrongMatch = (isMatch(mH, uH) && isMatch(mA, uA)) || (isMatch(mH, uA) && isMatch(mA, uH));
      // Loose fuzzy match for UI suggestions ONLY (requires user to click)
      var isLooseMatch = isMatch(mH, uH) || isMatch(mH, uA) || isMatch(mA, uH) || isMatch(mA, uA);

      if (isStrongMatch) {
          // Absorb streams automatically into the match ONLY IF BOTH teams match, so they stay in the UI safely
          if (!m.streamLinks) m.streamLinks = [];
          if (u.streamLinks) {
              u.streamLinks.forEach(function(sl) {
                  if (!m.streamLinks.find(function(ex) { return ex.url === sl.url; })) {
                      m.streamLinks.push(sl);
                      didAbsorbNewStream = true;
                  }
              });
          }
          if (u.matchUrl && !m.matchUrl) m.matchUrl = u.matchUrl;
          m.streamsLoaded = true;
      } else if (isLooseMatch) {
          possibleMatches.push(u);
      }
  });

  // Save any absorbed streams to cache immediately so they survive UI redraws
  if (didAbsorbNewStream && window.saveStreamCache) {
      window.saveStreamCache(m.id, m.streamLinks);

      // Since we mutated m, recalculate the scraping needs flag so the UI generates correctly
      hasEnoughStreams = m.streamLinks && m.streamLinks.length > 0;
      needsScraping = !hasEnoughStreams && m.matchUrl;
  }


  if(needsScraping) {
      rightCol.innerHTML= rightHeaderHtml + '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; color:var(--muted2); gap: 16px;"><div class="spinner"></div><div style="font-weight: 600;">Recherche de streams...</div><div style="font-size: 12px; opacity: 0.6;">(Chargement en arrière-plan)</div></div>';
      attachHeaderEvents();
      document.getElementById('mbg').classList.add('open');

      // Force load the streams for this specific match right away if they aren't loaded yet
      lg('Force loading flux', m.homeTeam);
      scrapeMatchFlux(m).then(function() {
          lg('Force loaded flux ok', m.homeTeam);
          m.streamsLoaded = true;
          if (document.getElementById('mbg').classList.contains('open') && document.getElementById('mname').dataset.matchName.indexOf(m.homeTeam) >= 0) {
              openMod(m, col); // Re-render modal only if still open and matching
          }
      }).catch(function(e) {
          lg('Force loaded flux failed', e.message);
          m.streamsLoaded = true;
          if (document.getElementById('mbg').classList.contains('open') && document.getElementById('mname').dataset.matchName.indexOf(m.homeTeam) >= 0) {
              openMod(m, col); // Re-render modal only if still open and matching
          }
      });
  } else {
      var sortedLinks = [];
      if (m.streamLinks && m.streamLinks.length > 0) {
          sortedLinks = sortFluxLinks(m.streamLinks);
      }

      var contentHtml = rightHeaderHtml;
      if (sortedLinks.length === 0) {
          contentHtml += '<div style="text-align:center;padding:20px;color:var(--muted2);">Aucun flux trouvé.<br>';
          if (m.matchUrl) {
              contentHtml += '<a href="'+esc(m.matchUrl)+'" target="_blank" style="color:var(--accent);margin-top:10px;display:inline-block;">Ouvrir la page du match</a>';
          }
          contentHtml += '</div>';
      } else {
          contentHtml += sortedLinks.map(function(s,i){
              return renderFluxItem(s, i, m);
          }).join('');
      }

      // Fallback manual links search
      contentHtml += '<div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">';
      contentHtml += '<details style="color: var(--muted); cursor: pointer;"><summary style="outline:none; font-weight: 500;">Recherche manuelle & Sites de base (Fallback)</summary>';
      contentHtml += '<div style="padding: 10px 0; display: flex; flex-wrap: wrap; gap: 8px;">';

      var searchQuery = encodeURIComponent(m.homeTeam + ' ' + m.awayTeam);
      var singleTeam = encodeURIComponent(m.homeTeam);

      SCRAPERS_CONFIG.forEach(function(site) {
          contentHtml += '<a href="'+site.url+'" target="_blank" class="mtag" style="background: rgba(255,255,255,0.05); color: #fff; text-decoration: none;">'+site.name+' 🔗</a>';
      });
      contentHtml += '</div>';

      contentHtml += '<div style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">';
      contentHtml += '<div style="font-size: 12px; margin-bottom: 8px;">Ajouter un flux manuellement au Multiview (m3u8, iframe, url):</div>';
      contentHtml += '<div style="display:flex; gap: 8px;">';
      contentHtml += '<input type="text" id="manual-flux-input" placeholder="https://..." style="flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:4px; padding:6px;">';
      contentHtml += '<button class="btn o" onclick="var v=document.getElementById(\'manual-flux-input\').value; if(v){ window.addManualStream(\''+escJs(m.id)+'\', v); }">Ajouter ⊞</button>';
      contentHtml += '</div></div>';

      contentHtml += '<div style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">';
      contentHtml += '<div style="font-size: 12px; margin-bottom: 8px;">Corriger et extraire via URL source (Diagnostic) :</div>';
      contentHtml += '<div style="display:flex; gap: 8px;">';
      contentHtml += '<input type="text" id="diagnostic-url-input" placeholder="https://site-de-streaming.com/match-xyz" value="'+(m.matchUrl ? esc(m.matchUrl) : '')+'" style="flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:4px; padding:6px;">';
      contentHtml += '<button class="btn" style="background:var(--accent); color:#fff;" onclick="var u=document.getElementById(\'diagnostic-url-input\').value; if(u){ window.diagnosticScrape(\''+escJs(m.id)+'\', u); }">Scraper</button>';
      contentHtml += '</div>';
      contentHtml += '<div id="diagnostic-report-container" style="margin-top: 10px; font-size: 12px; color: var(--muted2);">';
      if (m._diagnosticReportHtml) {
          contentHtml += m._diagnosticReportHtml;
          delete m._diagnosticReportHtml; // Consume it
      }
      contentHtml += '</div>';
      contentHtml += '</div>';

      if (possibleMatches.length > 0) {
          contentHtml += '<div style="margin-top: 15px;">';
          contentHtml += '<div style="font-size: 12px; margin-bottom: 8px; color: var(--accent);">Flux isolés trouvés :</div>';
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

      rightCol.innerHTML = contentHtml;
      attachHeaderEvents();
      document.getElementById('mbg').classList.add('open');
  }
}
export function closeMod(){
  document.getElementById('mbg').classList.remove('open');
    if (window.modalStatsInterval) { clearInterval(window.modalStatsInterval); window.modalStatsInterval = null; }

  var mhd = document.querySelector('.mhd');
  if (mhd) mhd.style.display = '';
  var mft = document.querySelector('.mft');
  if (mft) mft.style.display = '';
}

/* ══ SETTINGS & PERSONALIZATION ═════════ */
export var userPrefs = {
  bgStyle: 'gradient',
  iconPack: 'standard',
  c1: '#000000',
  c2: '#111111',
  c3: '#222222',
  accent: '#0a84ff',
  cardColor: 'gradient-45',
  btnShape: 'rounded',
  cardOpacity: '15',
  removeBlack: false
};

var storedPrefs = safeStorageGetJSON('user_prefs');
if (storedPrefs) userPrefs = Object.assign(userPrefs, storedPrefs);




// Global bindings for HTML compatibility
window.diagnosticScrape = diagnosticScrape;
window.getOriginalMatchId = getOriginalMatchId;
window.buildEPG = buildEPG;
window.updateNowLine = updateNowLine;
window.scrollToNow = scrollToNow;
window.QC = QC;
window.QI = QI;
window.renderFluxItem = renderFluxItem;
window.openMod = openMod;
window.closeMod = closeMod;
window.userPrefs = userPrefs;

export function addManualStream(matchId, rawUrl) {
    if (!rawUrl) return;
    var m = (S.matches || []).find(function(x) { return x.id === matchId; });
    if (!m) return;

    resolveStreamUrl(rawUrl).then(function(url) {
        // Temporary match to capture scraping results cleanly
        var tempMatch = {
            id: 'manual_tmp_' + Date.now(),
            matchUrl: url,
            streamLinks: [],
            streamsLoaded: false,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            sport: m.sport,
            league: m.league,
            status: m.status
        };

        window.showToast("Scraping du flux manuel...");

        scrapeMatchFlux(tempMatch, true).then(function() {
            var unmerged = (S.matches || []).filter(function(x) {
               return x.id.startsWith('scraped_') || x.id.startsWith('bs_') || x.id.startsWith('se_') || x.id.startsWith('ts_') || x.id.startsWith('vip_');
            });
        var newScraped = unmerged.find(function(x) { return x.matchUrl === url; });

        var logPayload = '=== DIAGNOSTIC LOG ===\n';
        logPayload += 'URL: ' + url + '\n';
        logPayload += 'Match Attendu: ' + m.homeTeam + ' vs ' + m.awayTeam + ' (ID: ' + m.id + ')\n';
        logPayload += 'Flux Trouvés: ' + (tempMatch.streamLinks ? tempMatch.streamLinks.length : 0) + '\n';

        if (newScraped) {
            var diag = debugMatchPair(m, newScraped);
            logPayload += '\n=== DEBUG MATCH PAIR ===\n';
            logPayload += 'Raison de l\'échec: ' + diag.reason + '\n';
            logPayload += 'Scrapé: ' + newScraped.homeTeam + ' vs ' + newScraped.awayTeam + '\n';

            var simMatches = [];
            var apiOnly = (S.matches || []).filter(function(x) { return DEFAULT_LEAGUES[(x.league||'').toUpperCase()] && !x.id.toString().startsWith('scraped_') && !x.id.toString().startsWith('bs_') && !x.id.toString().startsWith('se_') && !x.id.toString().startsWith('ts_') && !x.id.toString().startsWith('vip_'); });

            var matchedSim = null;
            apiOnly.forEach(function(apiM) {
                var apiDiag = debugMatchPair(apiM, newScraped);
                if (apiDiag.isMatch) {
                    matchedSim = apiM;
                } else {
                    var simH = stringSimilarity(apiM.homeTeam, newScraped.homeTeam);
                    var simA = stringSimilarity(apiM.awayTeam, newScraped.awayTeam);
                    var simHA = stringSimilarity(apiM.homeTeam, newScraped.awayTeam);
                    var simAH = stringSimilarity(apiM.awayTeam, newScraped.homeTeam);
                    var maxSim = Math.max(simH + simA, simHA + simAH) / 2;
                    simMatches.push({ match: apiM, score: maxSim, reason: apiDiag.reason });
                }
            });

            logPayload += '\n=== SIMULATION AUTOMATIQUE ===\n';
            if (matchedSim) {
                logPayload += 'SUCCÈS: Si ce lien n\'avait pas été manuel, il aurait été associé automatiquement au match:\n';
                logPayload += '- ' + matchedSim.homeTeam + ' vs ' + matchedSim.awayTeam + ' (ID: ' + matchedSim.id + ')\n';
            } else {
                logPayload += 'ÉCHEC: Aucun match de l\'API ne correspondrait à ce flux.\n';
                logPayload += 'Les matchs les plus proches dans la base de données et pourquoi ils échouent :\n';
                simMatches.sort(function(a, b) { return b.score - a.score; });
                var topSims = simMatches.slice(0, 3);
                topSims.forEach(function(sim) {
                    logPayload += '\n> ' + sim.match.homeTeam + ' vs ' + sim.match.awayTeam + ' (Score: ' + sim.score.toFixed(2) + ')\n';
                    logPayload += '  Raison de l\'échec: ' + sim.reason + '\n';
                });
            }
        }

        if (window.addManualStreamLog) {
            window.addManualStreamLog(m.homeTeam + ' vs ' + m.awayTeam, url, logPayload, tempMatch.streamLinks.length > 0 ? 'success' : 'error');
        }

        m.streamLinks = m.streamLinks || [];
        if (tempMatch.streamLinks && tempMatch.streamLinks.length > 0) {
            tempMatch.streamLinks.forEach(function(stream) {
                stream.name = stream.name + ' (Manuel)';
                stream.source = 'manual';
                m.streamLinks.push(stream);
            });
            window.showToast(tempMatch.streamLinks.length + " flux extraits avec succès !");
        } else {
            m.streamLinks.push({url: url, name: 'Stream Manuel (URL Brute)', source: 'manual'});
            window.showToast("Aucun flux extrait, utilisation de l'URL brute.");
        }

        m.streamsLoaded = true;

        if (window.saveStreamCache) {
            window.saveStreamCache(m.id, m.streamLinks);
        }

        var streamUrlToLaunch = (tempMatch.streamLinks && tempMatch.streamLinks.length > 0) ? tempMatch.streamLinks[0].url : url;
        addToMultivision(streamUrlToLaunch, m.homeTeam + ' vs ' + m.awayTeam, m.id);
        closeMod();
    }).catch(function(e) {
        window.showToast("Erreur lors de l'extraction: " + e.message);

        // Fallback to manual URL directly
        m.streamLinks = m.streamLinks || [];
        m.streamLinks.push({url: url, name: 'Stream Manuel (URL Brute)', source: 'manual'});
        m.streamsLoaded = true;

        if (window.addManualStreamLog) {
            window.addManualStreamLog(m.homeTeam + ' vs ' + m.awayTeam, url, 'Erreur de scraping: ' + e.message, 'error');
        }

        if (window.saveStreamCache) {
            window.saveStreamCache(m.id, m.streamLinks);
        }

        addToMultivision(url, m.homeTeam + ' vs ' + m.awayTeam, m.id);
        closeMod();
    });
    });
}
window.addManualStream = addManualStream;

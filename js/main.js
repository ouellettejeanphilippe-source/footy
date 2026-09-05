import { matchCardCache, S, addScrapeLog, updateSourceStatus, customLgOrder, setCustomLgOrder, favTeams, toggleFavTeam, setLeagueTier, resetLeagueTiers } from './state.js';
import { esc, showToast, fetchPage, applySportFilter, escJs, lg, safeStorageGetJSON, safeStorageSetJSON, safeStorageGet, safeStorageSet, purgeStaleCalendarCache } from './utils.js';
import { setupMultivisionUI, installTampermonkey } from './multiview.js';
import { getApiFirstMatches, TARGET_DATE, setApiTargetDate, mergeFluxToApi, getEspnDateStr } from './api.js';
import { getDomain, getEstDateStrFromDate, SCRAPERS_CONFIG, fetchRemoteConfig, getSourceCandidates, applySourceUrl, getSourcePages, sportOfLeague } from './config.js';
import { lgFlag, STATIC_TEAMS, getLogo, normName, TEAM_ALIASES, DEFAULT_LEAGUES, OTHER_LEAGUES, leagueTier, defaultLeagueTier } from './db.js';
import { parseFootybite, parseSportsurge, parseBuffstreams, parseStreameast, parseOnHockey, parseMlbbite, parseVipleague, parseMethstreams, parseFlexfitness, updateMatchUiAfterScrape, fetchSubPages, getEmbedRegistry, saveEmbedRegistry } from './scrapers.js';
import { noteEmbedResult } from './extractors.js';
import { mergeMatches } from './match.js';
import { isMatchPair } from './match.js';
import { buildEPG, scrollToNow } from './ui.js';
import { setMatches } from './state.js';

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
    var i = 0;
    function processChunk() {
        var start = performance.now();
        for (; i < matches.length && performance.now() - start < 15; i++) {
            var m = matches[i];
            // Update main card, live copy, and fav copy
            var cardIds = ['mb-' + m.id, 'mb-' + m.id + '_live_copy', 'mb-' + m.id + '_fav_copy'];

            for(var j=0; j<cardIds.length; j++) {
                var cid = cardIds[j];
                var cached = matchCardCache.get(cid);
                if (!cached) {
                    var card = document.getElementById(cid);
                    if (card) {
                        cached = {
                            el: card
                        };
                        matchCardCache.set(cid, cached);
                    }
                }

                if (cached && cached.el && !cached.hasMainQueries) {
                    cached.minEl = cached.el.querySelector('.status-minute');
                    cached.scoreEls = cached.el.querySelectorAll('.prime-score');
                    cached.ind = cached.el.querySelector('.live-indicator');
                    cached.ld = cached.el.querySelector('.mb-ld');
                    cached.hasMainQueries = true;
                }

                if (cached) {
                    var card = cached.el;
                    var minEl = cached.minEl;
                    // Update time/status
                    if (minEl) {
                        if (m.status === 'live') {
                            minEl.textContent = m.minute || 'LIVE';
                            if (!cached.ind) {
                                minEl.parentElement.className = 'live-indicator status-text';
                                minEl.parentElement.innerHTML = '<span class="mb-ld"></span><span class="status-minute">'+esc(m.minute||'LIVE')+'</span>';
                                // Re-cache minEl because innerHTML replacement
                                cached.minEl = card.querySelector('.status-minute');
                                cached.ind = card.querySelector('.live-indicator');
                                cached.ld = card.querySelector('.mb-ld');
                            } else {
                                if (cached.ld) {
                                    cached.ld.classList.add('refreshing');
                                    var ldRef = cached.ld;
                                    setTimeout(function() {
                                        if(ldRef) ldRef.classList.remove('refreshing');
                                    }, 2000);
                                }
                            }
                            card.classList.add('live');
                            card.classList.remove('finished');
                        } else if (m.status === 'finished') {
                            minEl.textContent = m.score ? 'Fin' : m.startTime;
                            minEl.parentElement.className = 'status-text';
                            if (cached.ld) { cached.ld.remove(); cached.ld = null; }
                            if (cached.ind) { cached.ind = null; }
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
            }
        }
        if (i < matches.length) {
            requestAnimationFrame(processChunk);
        }
    }
    processChunk();
}

/* Télécharge les pages d'une source (accueil + sous-pages par sport pertinentes) en
   essayant l'URL courante puis ses miroirs pour la page d'accueil. Quand un miroir répond,
   il devient l'URL courante de la source (applySourceUrl). Résout en [{url, html}]. */
export function fetchSourcePages(scraper, sports) {
    var candidates = getSourceCandidates(scraper.id);
    var errs = [];
    var i = 0;
    function tryBase() {
        if (i >= candidates.length) return Promise.reject(new Error(errs.join(' | ') || 'Aucune URL'));
        var url = candidates[i++];
        return fetchPage(url).then(function(html) {
            if (url !== scraper.url) {
                lg('Miroir actif ' + scraper.id, url);
                applySourceUrl(scraper.id, url);
            }
            return { url: url, html: html };
        }).catch(function(e) {
            errs.push(getDomain(url) + ': ' + (e && e.message ? e.message.split('\n')[0] : e));
            return tryBase();
        });
    }
    return tryBase().then(function(home) {
        var pages = getSourcePages(scraper, sports).filter(function(pg) { return pg.url !== home.url; });
        var out = scraper.homepageHasMatches === false ? [] : [home];
        // Sous-pages en parallèle (petit nombre : seulement les sports du jour)
        return Promise.allSettled(pages.map(function(pg) {
            return fetchPage(pg.url).then(function(html) { return { url: pg.url, html: html }; });
        })).then(function(res) {
            res.forEach(function(r, k) {
                if (r.status === 'fulfilled') out.push(r.value);
                else lg('Sous-page KO ' + scraper.id, pages[k].url + ' ' + (r.reason && r.reason.message ? r.reason.message.split('\n')[0] : ''));
            });
            if (out.length === 0) throw new Error('Aucune page exploitable (' + pages.length + ' sous-pages en échec)');
            return out;
        });
    });
}

/* Charge data/streams.json (généré toutes les heures par GitHub Actions) : liste de matchs
   déjà associés à leur page et à leurs flux. Servi depuis la même origine, donc sans proxy. */
export function loadPrefetchedStreams(force) {
    // Clé de cache par tranche de 5 min ; `force` (bouton des Options) lit la version fraîche.
    return fetch('data/streams.json?t=' + (force ? Date.now() : Math.floor(Date.now() / 300000)), force ? { cache: 'no-cache' } : undefined)
        .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function(data) {
            if (!data || !Array.isArray(data.matches)) throw new Error('format');
            var ageMin = data.generatedAt ? Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 60000) : null;
            var todayStr = getEstDateStrFromDate(new Date());
            var list = data.matches.filter(function(m) { return !m.matchDate || m.matchDate === todayStr; });
            list.forEach(function(m) { m.prefetched = true; m.streamsLoaded = !!(m.streamLinks && m.streamLinks.length); });
            window.prefetchedStreamMatches = list;
            window.prefetchedStreamsInfo = { generatedAt: data.generatedAt, ageMin: ageMin, count: list.length, sources: data.sources || [], hostPolicy: data.hostPolicy || {} };
            window.prefetchedStreamsLoadedAt = Date.now();

            /* Politique d'intégration relevée côté serveur (en-têtes X-Frame-Options /
               CSP frame-ancestors, illisibles depuis le navigateur). On l'injecte dans
               le registre appris : le classement « iframe ou onglet » repose ainsi sur
               une mesure réelle dès le premier chargement, sans attendre qu'un échec
               visible l'apprenne à l'utilisateur. */
            var policy = data.hostPolicy || {};
            var reg = getEmbedRegistry();
            var known = 0;
            Object.keys(policy).forEach(function(host) {
                var p = policy[host];
                if (!p || p.embeddable === null || p.embeddable === undefined) return;
                if (p.embeddable) {
                    noteEmbedResult(reg, host, true);
                } else {
                    // Deux refus sans succès font basculer l'hôte (voir noteEmbedResult) ;
                    // une seule mesure serveur suffit à faire foi, donc on la compte double.
                    noteEmbedResult(reg, host, false);
                    noteEmbedResult(reg, host, false);
                }
                known++;
            });
            if (known) { saveEmbedRegistry(); lg('Politique d\'intégration', known + ' hôtes connus du serveur'); }
            (data.sources || []).forEach(function(src) {
                if (src && src.url) updateSourceStatus(getDomain(src.url), src.ok ? 'success' : 'warning', src.matches || 0, (src.ok ? 'serveur OK' : 'serveur: ' + (src.error || 'échec')) + (ageMin !== null ? ' (' + ageMin + ' min)' : ''));
            });
            lg('Flux pré-calculés', list.length + ' matchs, généré il y a ' + ageMin + ' min');
            return list;
        })
        .catch(function(e) {
            lg('Flux pré-calculés indisponibles', e.message);
            window.prefetchedStreamMatches = [];
            window.prefetchedStreamsLoadedAt = Date.now(); // sinon on réessaierait à chaque passe
            return [];
        });
}

var loadInFlight = null;

/* Six déclencheurs appellent un chargement complet : démarrage, minuterie de 5 minutes,
   changement de date, bouton « Réessayer », enregistrement des réglages réseau et
   rechargement du cache serveur. Rien n'empêchait deux passes de se chevaucher : chacune
   fusionne ses flux dans la même grille (mergeFluxToApi n'ajoute que ce qui manque), donc
   le nombre de liens affichés changeait d'un instant à l'autre selon l'ordre d'arrivée.
   Une passe d'arrière-plan est désormais ignorée si une autre est déjà en cours ; une
   passe demandée par l'utilisateur (premier plan, ou rafraîchissement forcé) passe
   toujours, car elle réinitialise l'état. */
export function loadAll(isBackground, forceScrape) {
    if (loadInFlight && isBackground && !forceScrape) {
        lg('Chargement déjà en cours', 'passe d\'arrière-plan ignorée');
        return loadInFlight;
    }
    var p = loadAllRun(isBackground, forceScrape);
    loadInFlight = p;
    Promise.resolve(p).catch(function() {}).then(function() {
        if (loadInFlight === p) loadInFlight = null;
    });
    return p;
}

/* #ov et #errbox vivent dans #marea, que buildEPG vide à chaque rendu. Toute lecture
   directe de document.getElementById('ov').style plantait donc dès que le guide avait
   été rendu une fois — et l'exception, levée depuis le .finally de loadAll, empêchait
   window.hasLoadedOnce et l'événement loadSequenceComplete (donc l'actualisation
   automatique des scores toutes les 60 s). Toutes les lectures passent par ces aides. */
function hideLoadingOverlay() {
  var ov = document.getElementById('ov');
  if (ov) ov.style.display = 'none';
}

function showLoadError(message) {
  var lines = String(message || 'Erreur').split('\n');
  var msg = document.getElementById('errmsg');
  if (msg) msg.textContent = lines[0];
  var ec = document.getElementById('errcode');
  if (ec) {
    if (lines.length > 1) { ec.textContent = lines.slice(1).join('\n'); ec.style.display = 'block'; }
    else { ec.style.display = 'none'; }
  }
  var box = document.getElementById('errbox');
  if (box) box.classList.add('show');
  else showToast(lines[0]);
}

async function loadAllRun(isBackground, forceScrape){
  if (!isBackground) { S.log=[];S.raw='';S.matches=[];S.proxy=''; }

  // Load dynamic domain configuration on initial load
  if (!window.hasLoadedOnce && !isBackground) {
      await fetchRemoteConfig();
  }
  /* Le cache serveur (data/streams.json) est régénéré chaque heure. La condition
     précédente (`!window.prefetchedStreamMatches || !isBackground`) ne le relisait
     jamais lors d'une passe d'arrière-plan : après le premier chargement la variable
     reste définie, même quand elle vaut []. Une session laissée ouverte plusieurs
     heures restait donc sur les liens du démarrage. On le relit quand il a plus de
     10 minutes, en forçant pour contourner la clé de cache de 5 minutes. */
  var prefetchAge = window.prefetchedStreamsLoadedAt ? Date.now() - window.prefetchedStreamsLoadedAt : Infinity;
  var prefetchStale = prefetchAge > 10 * 60 * 1000;
  if (!window.prefetchedStreamMatches || !isBackground || prefetchStale) {
      await loadPrefetchedStreams(prefetchStale);
  }
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
      var ovmsg = document.getElementById('ovmsg'); if(ovmsg) ovmsg.innerHTML='<div class="spinner"></div> Connexion API...';
      var s1 = document.getElementById('s1'); if(s1 && s1.querySelector('span')) s1.querySelector('span').textContent = 'Téléchargement Guide télé';
      var s2 = document.getElementById('s2'); if(s2 && s2.querySelector('span')) s2.querySelector('span').textContent = 'Recherche de streams...';
      var s3 = document.getElementById('s3'); if(s3 && s3.querySelector('span')) s3.querySelector('span').textContent = 'Fusion et Affichage';
  } else {
      showToast('Actualisation des matchs en arrière-plan...');
      // Ensure it is definitely hidden if we've already loaded once
      hideLoadingOverlay();
  }

  getApiFirstMatches(TARGET_DATE).then(function(apiMatches) {
      if (!isBackground) { stepOk(1);  }


      // Async scrape sites
      var nowTime = Date.now();
      var isToday = (TARGET_DATE.toDateString() === new Date().toDateString());
      /* Le cache serveur (data/streams.json) agrège déjà les huit sources toutes les
         heures, sans proxy et de façon déterministe. Le scraping en direct des pages de
         liste n'est donc qu'un secours : on ne l'exécute que si ce cache manque, est vide
         ou date de plus de trois heures (workflow GitHub en panne). Cela supprime des
         centaines de requêtes via proxys CORS à chaque chargement, qui étaient la
         principale cause de lenteur et de variation du nombre de liens. */
      var prefetchInfo = window.prefetchedStreamsInfo;
      var prefetchUsable = !!(prefetchInfo && prefetchInfo.count > 0 && prefetchInfo.ageMin !== null && prefetchInfo.ageMin < 180);
      var skipScraping = !isToday
          || (!forceScrape && (prefetchUsable || nowTime - window.lastScrapeTime < 15 * 60 * 1000));
      if (prefetchUsable && !forceScrape) lg('Cache serveur utilisé', prefetchInfo.count + ' matchs, ' + prefetchInfo.ageMin + ' min — scraping en direct inutile');

      if (skipScraping) {
                    // Just merge with existing scrapedMatches and update API
          var prev = isToday ? (window.lastScrapedMatches || []) : [];
          if (isToday && window.prefetchedStreamMatches && window.prefetchedStreamMatches.length) prev = mergeMatches(window.prefetchedStreamMatches.slice(), prev);
          var finalMatches = mergeFluxToApi(apiMatches, prev, true);

          // Persist the updated scores/statuses back to cache even when skipping scraping
          var todayStr = getEspnDateStr(TARGET_DATE || new Date());
              var cache = safeStorageGetJSON('api_calendar_cache_' + todayStr);
              var fetchDateToSave = todayStr;
              if (cache && cache.fetchDate) fetchDateToSave = cache.fetchDate;

              safeStorageSetJSON('api_calendar_cache_' + todayStr, { fetchDate: fetchDateToSave, matches: finalMatches });

          var targetDateStr = getEstDateStrFromDate(TARGET_DATE);
          setMatches(finalMatches.filter(function(m) {
              return m.matchDate === targetDateStr;
          }));

          if (!window.hasLoadedOnce) {
              buildEPG(S.matches);
              window.hasLoadedOnce = true;
          } else {
              updateLiveScores(S.matches); // New function to update scores smoothly
          }

          if (!isBackground) { hideLoadingOverlay(); }
          window.dispatchEvent(new Event('loadSequenceComplete'));

          // Run background fetch completely asynchronously so it never blocks the UI
          setTimeout(function() {

            /* Pré-scraping des pages de match au démarrage : une centaine de requêtes via
               proxys CORS. Inutile quand le cache serveur fournit déjà les liens ; le
               scraping d'un match précis reste déclenché à l'ouverture de sa fiche
               (scrapeMatchFlux). On ne le lance donc qu'en mode secours. */
            if (!prefetchUsable) {
                var startupMatches = S.matches.filter(function(m) {
                    var t = leagueTier(m.league);
                    return t === 'main' || t === 'secondary';
                });
                fetchSubPages(startupMatches);
            }

          }, 0);

          return Promise.reject('SKIP_SCRAPING_SUCCESS'); // Reject to skip the rest of the promise chain cleanly
      }

            // Sports présents dans la grille du jour : limite les sous-pages à télécharger
            var todaySports = [];
            apiMatches.forEach(function(am) { var sp = sportOfLeague(am.league); if (todaySports.indexOf(sp) < 0) todaySports.push(sp); });

            return Promise.allSettled(
          SCRAPERS_CONFIG.map(function(scraper) { return fetchSourcePages(scraper, todaySports); })
      ).then(function(results) {
          if (!results) return;
          if (!isBackground) { stepOk(2);  }


          // Check for failures and notify user (un seul toast regroupé)
          var sources = SCRAPERS_CONFIG.map(function(s) { return s.url; });
          var failedDomains = [];
          results.forEach(function(r, idx) {
              if (r.status === 'rejected') {
                  var domain = getDomain(sources[idx]);
                  console.error('Failed to fetch:', sources[idx], r.reason);
                  var errMsg = (r.reason && r.reason.message ? r.reason.message : 'Échec de la connexion');
                  addScrapeLog(sources[idx], 'error', errMsg);
                  updateSourceStatus(domain, 'error', 0, errMsg.split('\n')[0]);
                  failedDomains.push(domain);
              } else {
                  addScrapeLog(sources[idx], 'success', '');
              }
          });
          if (failedDomains.length > 0 && failedDomains.length < SCRAPERS_CONFIG.length) {
              showToast('Sources injoignables : ' + failedDomains.join(', '));
          } else if (failedDomains.length === SCRAPERS_CONFIG.length) {
              showToast('Aucune source de streams joignable (proxys CORS hors service ?). Liens pré-calculés utilisés.');
          }

          // Flux pré-calculés côté serveur (data/streams.json) : servent de base même si tous les proxys sont morts
          var scrapedMatches = window.prefetchedStreamMatches ? window.prefetchedStreamMatches.slice() : [];

                    var scraperFunctions = {
              'footybite': parseFootybite,
              'mlbbite': parseMlbbite,
              'sportsurge': parseSportsurge,
              'buffstreams': parseBuffstreams,
              'streameast': parseStreameast,
              'onhockey': parseOnHockey,
              'vipleague': parseVipleague,
              'methstreams': parseMethstreams,
              'flexfitness': parseFlexfitness
          };
          var tasks = SCRAPERS_CONFIG.map(function(sc) {
              return { fn: scraperFunctions[sc.id], url: sc.url, id: sc.id };
          });

          window.scraperStats = safeStorageGetJSON('scraper_stats') || {};

          var p = Promise.resolve();

          tasks.forEach(function(task, idx) {
              p = p.then(function() {
                  return new Promise(function(resolve) {
                      setTimeout(function() {
                          if (results[idx] && results[idx].status === 'fulfilled' && results[idx].value) {
                              try {
                                  var pages = results[idx].value;
                                  var m = [];
                                  pages.forEach(function(pg) {
                                      var parsed = [];
                                      try { parsed = task.fn(pg.html, pg.url) || []; } catch(pe) { console.error('Parse error', task.id, pg.url, pe); }
                                      m = mergeMatches(m, parsed);
                                  });
                                  var matchedCount = 0;
                                  m.forEach(function(scrapedMatch) {
                                      if (apiMatches.find(function(am) { return isMatchPair(am, scrapedMatch); })) {
                                          matchedCount++;
                                      }
                                  });
                                  window.scraperStats[task.id] = { total: m.length, matched: matchedCount };
                                  safeStorageSetJSON('scraper_stats', window.scraperStats);

                                  updateSourceStatus(getDomain(task.url), 'success', m.length, 'OK');
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

          safeStorageSet('last_scrape_time', window.lastScrapeTime.toString());
              safeStorageSetJSON('last_scraped_matches', window.lastScrapedMatches);

          // Persist the merged data (which now includes streams) back to localStorage
          var todayStr = getEspnDateStr(TARGET_DATE || new Date());
              var cache = safeStorageGetJSON('api_calendar_cache_' + todayStr);
              var fetchDateToSave = todayStr;
              if (cache && cache.fetchDate) fetchDateToSave = cache.fetchDate;

              safeStorageSetJSON('api_calendar_cache_' + todayStr, { fetchDate: fetchDateToSave, matches: finalMatches });

                    var targetDateStr = getEstDateStrFromDate(TARGET_DATE);
          setMatches(finalMatches.filter(function(m) {
              return m.matchDate === targetDateStr;
          }));
          if (!isBackground) { hideLoadingOverlay(); }

          // Populate sports filter
          var sports = {};
          for(var i=0; i<S.matches.length; i++) { sports[S.matches[i].league]=true; }
          var sportNames = Object.keys(sports).sort();
          var sf = document.getElementById('sport-filters');
          if(sf){
              var anyHidden = false;
              var keys = Object.keys(S.hiddenLg); for(var i=0; i<keys.length; i++) { if(S.hiddenLg[keys[i]]) { anyHidden = true; break; } }
              var isAllSel = !anyHidden;

              var optionsHtml = '<button class="btn sport-btn '+(isAllSel?'active-toggle':'')+'" onclick="applySportFilter(\'all\');">Tous les sports</button>';
              sportNames.forEach(function(sp){
                  if (sp !== 'EN DIRECT') {
                      var isSel = !S.hiddenLg[sp];
                      optionsHtml += '<button class="btn sport-btn '+(isSel?'active-toggle':'')+'" onclick="applySportFilter(\''+escJs(sp)+'\');"><span style="margin-right:4px;">'+lgFlag(sp)+'</span> '+esc(sp)+'</button>';
                  }
              });
              sf.innerHTML = optionsHtml;
          }

          setTimeout(function() {
              if (isBackground && window.hasLoadedOnce) {
                  updateLiveScores(S.matches);

                  // Process UI updates asynchronously in chunks to prevent blocking the UI thread
                  var i = 0;
                  function processChunk() {
                      var start = performance.now();
                      for (; i < S.matches.length && performance.now() - start < 15; i++) {
                          updateMatchUiAfterScrape(S.matches[i]);
                      }
                      if (i < S.matches.length) {
                          requestAnimationFrame(processChunk);
                      } else {

            /* Pré-scraping des pages de match au démarrage : une centaine de requêtes via
               proxys CORS. Inutile quand le cache serveur fournit déjà les liens ; le
               scraping d'un match précis reste déclenché à l'ouverture de sa fiche
               (scrapeMatchFlux). On ne le lance donc qu'en mode secours. */
            if (!prefetchUsable) {
                var startupMatches = S.matches.filter(function(m) {
                    var t = leagueTier(m.league);
                    return t === 'main' || t === 'secondary';
                });
                fetchSubPages(startupMatches);
            }

                      }
                  }
                  processChunk();

              } else {
                  buildEPG(S.matches);
                  setTimeout(function() {
            /* Pré-scraping des pages de match au démarrage : une centaine de requêtes via
               proxys CORS. Inutile quand le cache serveur fournit déjà les liens ; le
               scraping d'un match précis reste déclenché à l'ouverture de sa fiche
               (scrapeMatchFlux). On ne le lance donc qu'en mode secours. */
            if (!prefetchUsable) {
                var startupMatches = S.matches.filter(function(m) {
                    var t = leagueTier(m.league);
                    return t === 'main' || t === 'secondary';
                });
                fetchSubPages(startupMatches);
            }
 }, 0);
              }
                        }, 0);
          var live=0; for(var i=0; i<S.matches.length; i++) { if(S.matches[i].status==='live') live++; }
          showToast(S.matches.length+' matchs'+(live?' · '+live+' live':''));
          });
      });
  }).catch(function(err){
      if (err === 'SKIP_SCRAPING_SUCCESS') return; // Smooth update finished, no errors to show
      if (!isBackground) { hideLoadingOverlay(); }
      showLoadError(err && err.message);
  }).finally(function(){
      if(btn) btn.disabled=false;
            if (!isBackground) { hideLoadingOverlay(); }
      if (!safeStorageGet('hasSeenScriptModal')) {
          safeStorageSet('hasSeenScriptModal', 'true');
          setTimeout(function() { installTampermonkey(); }, 500);
      }
      window.hasLoadedOnce = true;
      window.dispatchEvent(new Event('loadSequenceComplete'));
  });
}


/* ══ INIT ═══════════════════════════════ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.error('SW registration failed: ', err);
      lg('SW Reg Error', err.message || err);
    });
  });
}


// Démarrage automatique de l'app (désactivé quand le module est importé côté serveur,
// par ex. par scripts/scrape_streams.mjs qui ne veut que les parseurs).
if (typeof window === 'undefined' || !window.__NO_AUTOSTART__) (function(){
  var n = new Date();
  var todayStr = getEspnDateStr(TARGET_DATE || new Date());

  // Une clé de cache par jour visité, jamais purgée jusqu'ici : voir
  // purgeStaleCalendarCache (js/utils.js). On garde hier et aujourd'hui.
  var yEst = new Date(n); yEst.setDate(yEst.getDate() - 1);
  var removed = purgeStaleCalendarCache([getEspnDateStr(n), getEspnDateStr(yEst)]);
  if (removed) lg('Cache calendrier nettoyé', removed + ' jour(s) obsolète(s)');

  var lst = safeStorageGet('last_scrape_time');
  var lsm = safeStorageGetJSON('last_scraped_matches');
  if (lst) window.lastScrapeTime = parseInt(lst, 10);
  if (lsm) window.lastScrapedMatches = lsm;

  var cache = safeStorageGetJSON('api_calendar_cache_' + todayStr);

  if (cache && cache.fetchDate === todayStr && cache.matches && cache.matches.length > 0) {
            setMatches(cache.matches.filter(function(m) {
          return m.matchDate === getEstDateStrFromDate(TARGET_DATE);
      }));
      if (S.matches.length > 0) {
          setTimeout(function() { buildEPG(S.matches); }, 0);
      }
      if (!safeStorageGet('hasSeenScriptModal')) {
          safeStorageSet('hasSeenScriptModal', 'true');
          setTimeout(function() { installTampermonkey(); }, 500);
      }
      // Delay to ensure the initial cache render doesn't block the dynamic domain fetch
      setTimeout(() => loadAll(true, false), 10);
  } else {
      loadAll(false, false); // premier chargement sans cache : passe visible, avec l'écran d'attente
  }

  // Background auto-update every 60 seconds
  setInterval(function() {
      if (window.hasLoadedOnce) {
          loadAll(true, false);
      }
  }, 300000);
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


export function getLeagueIcon(lgName) {
    if(!lgName) return '🏆';
    var norm = lgName.toUpperCase();
    if(DEFAULT_LEAGUES[norm]) return DEFAULT_LEAGUES[norm].icon;
    if(OTHER_LEAGUES[norm]) return OTHER_LEAGUES[norm].icon;
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
        var displayOrder = customLgOrder.length > 0 ? customLgOrder.slice() : Object.keys(DEFAULT_LEAGUES);

        // Toutes les ligues connues : principales, secondaires, plus celles vues dans la
        // grille du jour (une ligue absente des listes reste réglable par l'utilisateur).
        var allLgs = Object.keys(DEFAULT_LEAGUES).concat(Object.keys(OTHER_LEAGUES || {}));
        if (typeof S !== 'undefined' && S.matches) {
            S.matches.forEach(function(m) {
                var k = (m.league || '').toUpperCase();
                if (k && k !== 'FAVORIS' && k !== 'EN DIRECT' && k !== 'AUTRES FLUX' && allLgs.indexOf(k) === -1) allLgs.push(k);
            });
        }
        allLgs.forEach(function(l) {
            if (displayOrder.indexOf(l) === -1) displayOrder.push(l);
        });

        var tierBtn = function(lgKey, tier, label, title, current) {
            var on = current === tier;
            var bg = on ? (tier === 'main' ? 'var(--accent)' : tier === 'secondary' ? '#5a5a7a' : 'var(--red)') : 'rgba(255,255,255,0.05)';
            return '<button class="btn o" title="' + title + '" aria-pressed="' + on + '" onclick="setLeagueTierPref(\'' + escJs(lgKey) + '\', \'' + tier + '\')"'
                 + ' style="padding:3px 8px; font-size:11px; border-radius:6px; white-space:nowrap; background:' + bg + '; color:' + (on ? '#fff' : 'var(--muted)') + ';">' + label + '</button>';
        };

        displayOrder.forEach(function(lgKey, idx) {
            var lgIcon = getLeagueIcon(lgKey);
            var isFirst = idx === 0;
            var isLast = idx === displayOrder.length - 1;
            var curTier = leagueTier(lgKey);
            var isCustom = curTier !== defaultLeagueTier(lgKey);
            var tierCtrl = '<div style="display:flex; gap:4px; flex-wrap:wrap;">'
                + tierBtn(lgKey, 'main', 'Principale', 'Afficher parmi les ligues principales', curTier)
                + tierBtn(lgKey, 'secondary', 'Secondaire', 'Regrouper dans la section « Ligues secondaires »', curTier)
                + tierBtn(lgKey, 'ignored', 'Ignorée', 'Masquer cette ligue partout', curTier)
                + (isCustom ? '<button class="btn o" title="Revenir au réglage par défaut" onclick="setLeagueTierPref(\'' + escJs(lgKey) + '\', \'\')" style="padding:3px 6px; font-size:11px; border-radius:6px;">↺</button>' : '')
                + '</div>';

            lgHtml += '<div draggable="true" ondragstart="handleDragStartLg(event, \'' + escJs(lgKey) + '\')" ondragend="handleDragEndLg(event)" ondragover="handleDragOverLg(event)" ondrop="handleDropLg(event, \'' + escJs(lgKey) + '\')" ondragenter="handleDragEnterLg(event)" ondragleave="handleDragLeaveLg(event)" style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.05); cursor: grab; flex-wrap:wrap; gap:8px;">'
                   + '<div style="display:flex; align-items:center; gap:8px; pointer-events:none; min-width:120px; flex:1;">'
                   + '<span style="font-size:16px; pointer-events:none;">' + lgIcon + '</span>'
                   + '<span style="font-size:14px; font-weight:bold; pointer-events:none;">' + esc(lgKey) + '</span>'
                   + '</div>'
                   + '<div style="display:flex; gap:4px;">'
                   + '<button class="btn o" aria-label="Monter ' + esc(lgKey) + '" style="padding:4px; font-size:12px; opacity:' + (isFirst ? '0.3' : '1') + ';" onclick="moveLeagueOrder(\'' + escJs(lgKey) + '\', -1)" ' + (isFirst ? 'disabled' : '') + '>▲</button>'
                   + '<button class="btn o" aria-label="Descendre ' + esc(lgKey) + '" style="padding:4px; font-size:12px; opacity:' + (isLast ? '0.3' : '1') + ';" onclick="moveLeagueOrder(\'' + escJs(lgKey) + '\', 1)" ' + (isLast ? 'disabled' : '') + '>▼</button>'
                   + '</div>'
                   + tierCtrl
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
        var seenTeams = new Set();
        for (var lg in teamsByLeague) {
            teamsByLeague[lg].forEach(function(t) {
                if (!seenTeams.has(t.name)) {
                    seenTeams.add(t.name);
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
            if (a === b) return 0;
            var tA = leagueTier(a), tB = leagueTier(b);
            var rA = tA === 'main' ? 0 : (tA === 'secondary' ? 1 : 2);
            var rB = tB === 'main' ? 0 : (tB === 'secondary' ? 1 : 2);
            if (rA !== rB) return rA - rB;

            var displayOrder = customLgOrder.length > 0 ? customLgOrder : Object.keys(DEFAULT_LEAGUES);

            // Les ligues dans customLgOrder sont typiquement en Title Case, ou comme a/b.
            // On s'assure d'une comparaison tolérante.
            var idxA = -1;
            var idxB = -1;
            for (var i = 0; i < displayOrder.length; i++) {
                if (displayOrder[i].toUpperCase() === a.toUpperCase()) idxA = i;
                if (displayOrder[i].toUpperCase() === b.toUpperCase()) idxB = i;
            }

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
            tHtml += '<svg id="chev-'+lgId+'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px; transition:transform 0.15s; transform:'+chevTransform+';"><path d="M6 9l6 6 6-6"/></svg>';
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

/* Classe une ligue en principale / secondaire / ignorée (chaîne vide = valeur par défaut),
   puis reconstruit la grille pour que le changement soit visible immédiatement. */
export function setLeagueTierPref(lgKey, tier) {
    setLeagueTier(lgKey, tier);
    renderFavPage();
    if (typeof buildEPG === 'function' && S && S.matches) buildEPG(S.matches);
    var labels = { main: 'principale', secondary: 'secondaire', ignored: 'ignorée' };
    showToast(lgKey + ' : ' + (labels[tier] || 'réglage par défaut'));
}

export function resetLeagueTiersPref() {
    resetLeagueTiers();
    renderFavPage();
    if (typeof buildEPG === 'function' && S && S.matches) buildEPG(S.matches);
    showToast('Classement des ligues réinitialisé');
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
        var visibleTeams = Array.from(c.querySelectorAll('.team-item')).filter(function(el) {
            return el.style.display === 'flex';
        });
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
window.setLeagueTierPref = setLeagueTierPref;
window.resetLeagueTiersPref = resetLeagueTiersPref;
window.filterFavTeams = filterFavTeams;
window.switchFavTab = switchFavTab;

export function applyTargetDate(d) {
    setApiTargetDate(d);

    var now = new Date();
    var isToday = (d.toDateString() === now.toDateString());

    var d2 = new Date(now);
    d2.setDate(now.getDate() - 1);
    var isYesterday = (d.toDateString() === d2.toDateString());

    var d3 = new Date(now);
    d3.setDate(now.getDate() + 1);
    var isTomorrow = (d.toDateString() === d3.toDateString());

    var text = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
    text = text.charAt(0).toUpperCase() + text.slice(1);

    if (isToday) text = "Aujourd'hui";
    else if (isYesterday) text = "Hier";
    else if (isTomorrow) text = "Demain";

    var displayEl = document.getElementById('current-date-display');
    if (displayEl) {
        displayEl.textContent = text;
    }

    window.hasLoadedOnce = false; // Force a full reload sequence with UI
    loadAll(false, false);
}

export function changeTargetDate(offsetDays) {
    var newDate = new Date(TARGET_DATE);
    newDate.setDate(newDate.getDate() + offsetDays);
    applyTargetDate(newDate);
}

export function setTargetDate(dateStr) {
    if (!dateStr) return;
    // dateStr is YYYY-MM-DD
    var parts = dateStr.split('-');
    // Create date at noon to avoid timezone issues
    var newDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
    applyTargetDate(newDate);
}

window.applyTargetDate = applyTargetDate;
window.changeTargetDate = changeTargetDate;
window.setTargetDate = setTargetDate;


window.toggleTvMode = function(enabled) {
    localStorage.setItem('pref-tv-mode', enabled ? 'true' : 'false');

    if (enabled) {
        document.body.classList.add('tv-mode');

        // Charger tv.css s'il n'est pas déjà là
        if (!document.getElementById('tv-css')) {
            const link = document.createElement('link');
            link.id = 'tv-css';
            link.rel = 'stylesheet';
            link.href = 'tv.css';
            document.head.appendChild(link);
        }

        // Charger tv-navigation.js s'il n'est pas déjà là
        if (!document.getElementById('tv-nav-script')) {
            const script = document.createElement('script');
            script.id = 'tv-nav-script';
            script.src = 'js/tv-navigation.js';
            document.body.appendChild(script);
        }
    } else {
        document.body.classList.remove('tv-mode');

        // Retirer css
        const link = document.getElementById('tv-css');
        if (link) link.remove();

        // Exécuter le nettoyage complet
        if (window.__tvNavigationCleanup) {
            window.__tvNavigationCleanup();
            window.__tvNavigationCleanup = null;
        }

        // Retirer le script TV
        const script = document.getElementById('tv-nav-script');
        if (script) script.remove();
    }
};

// Auto-init at boot
document.addEventListener('DOMContentLoaded', () => {
    const isTvMode = localStorage.getItem('pref-tv-mode') === 'true';
    const tvCheckbox = document.getElementById('pref-tv-mode');
    if (tvCheckbox) tvCheckbox.checked = isTvMode;
    if (isTvMode) window.toggleTvMode(true);
});

import { getEstTimeStrFromDate, getEstDateStrFromDate, getDomain, domainPrefs, toggleDomainPref, sortFluxLinks, SCRAPERS_CONFIG,
         minutesUntilStart, isLiveNow, finPresumee, raisonFinPresumee, startsWithin, LIVE_WINDOW_MIN } from './config.js';
import { minutesDansLaJournee, comparerHeures, libelleJour } from './nuit.js';
import { normName, lgColor, getTeamColors, getLogo, libelleSport } from './db.js';
import { S, customLgOrder, favTeams, matchCardCache, toggleFavTeam } from './state.js';
import { lg, esc, toggleAccordion, escJs, pad, toggleLeague, safeStorageGetJSON, resolveStreamUrl } from './utils.js';
import { primaryDomain, matchDomainStats } from './links.js';
import { TARGET_DATE, fetchGameStats, fetchTeamInfo } from './api.js';
import { openFlux, mvFlux, saveMultivisionState, updateMultivisionLayout, addToMultivision } from './multiview.js';
import { scrapeMatchFlux, compterFluxUtiles, doitRelireLaPage, doitRafraichirFiche, INTERVALLE_FICHE_MS } from './scrapers.js';
import { mesurePour, formaterMesure } from './debit.js';
import { isMatch, debugMatchPair, stringSimilarity } from './match.js';
import { DEFAULT_LEAGUES, lgFlag, leagueTier } from './db.js';

/* `lg` (le journal de bord) est masqué par la variable locale `lg` (l'objet ligue)
   dans les boucles de rendu. Alias stable pour pouvoir journaliser depuis celles-ci. */
const logLine = lg;

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

/* Libellé d'état d'un match en cours. Plusieurs API renvoient « 0:00 » ou « 0' » comme
   minute de jeu, ce qui n'apprend rien : on retombe alors sur « DIRECT ». */
export function formatLiveMinute(m) {
    var raw = m && m.minute ? String(m.minute).trim() : '';
    if (!raw || /^0+\s*[:'h]?\s*0*$/.test(raw)) return 'DIRECT';
    return raw;
}

/* Un seul match malformé (nom d'équipe manquant, couleur absente…) ne doit pas
   effacer tout le guide : buildEPGInner vide #marea avant de le reconstruire, et
   #ov / #errbox y vivent. Une exception laissait donc l'application sur un écran
   vide, sans overlay ni bouton « Réessayer ». On restaure ici ce qui a pu être
   construit, puis on relance l'erreur pour qu'elle reste visible en console. */
/* Forme des cartes de match : « affiche » verticale (2/3, à la Netflix) ou « large »
   (16:6,7, la forme historique). Le réglage par défaut suit l'écran — l'affiche est
   faite pour le pouce et le portrait, la carte large pour une souris et un moniteur —
   et l'utilisateur peut le forcer dans Options → Style des Cartes.

   Une seule classe sur <body> pilote toute la mise en page (voir styles.css) : le HTML
   des cartes est identique dans les deux formes, ce qui évite d'entretenir deux
   générateurs de cartes divergents. */
export function cardShapePref() {
  var pref = (userPrefs && userPrefs.cardShape) || 'auto';
  if (pref === 'poster' || pref === 'wide') return pref;
  return (typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(max-width: 900px)').matches) ? 'poster' : 'wide';
}

export function applyCardShape() {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('cards-poster', cardShapePref() === 'poster');
}

/* Le mode « auto » dépend de la largeur : une rotation d'écran doit changer la forme
   sans recharger l'application. */
if (typeof window !== 'undefined') {
  window.addEventListener('resize', function() {
    var before = document.body.classList.contains('cards-poster');
    applyCardShape();
    if (before !== document.body.classList.contains('cards-poster')) {
      /* Rien à re-générer : la classe suffit. On rafraîchit seulement la ligne du temps,
         dont la position dépend de la largeur réelle. */
      if (typeof updateNowLine === 'function') updateNowLine();
    }
  });
}

export function buildEPG(matches){
  /* Compteur de rendus, lu par les tests : « la grille est stable » veut dire que ce
     nombre n'a pas bougé depuis un moment. Le premier chargement dessine la grille
     avec les liens déjà connus, puis la redessine quand la lecture des sources finit
     (js/main.js) ; un test qui lisait le DOM entre les deux tenait des éléments
     détachés — c'est ce qui rendait « chaque section repliable… » instable. */
  if (typeof window !== 'undefined') window.rendusGrille = (window.rendusGrille || 0) + 1;
  try {
    buildEPGInner(matches);
  } catch (e) {
    var container = document.getElementById('marea');
    var ov = document.getElementById('ov');
    var errbox = document.getElementById('errbox');
    if (container && !ov) { var o = document.createElement('div'); o.className = 'ov'; o.id = 'ov'; o.style.display = 'none'; container.appendChild(o); }
    if (container && !errbox) {
      var b = document.createElement('div'); b.className = 'err'; b.id = 'errbox';
      b.innerHTML = '<div style="font-size:36px">📡</div><div class="err-msg" id="errmsg"></div>'
        + '<div class="err-code" id="errcode" style="display:none"></div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px">'
        + '<button class="btn g" onclick="loadAll(false, true)">↺ Réessayer</button></div>';
      container.appendChild(b);
    }
    logLine('Erreur de rendu du guide', e && (e.stack || e.message) || String(e));
    throw e;
  }
}

function buildEPGInner(matches){
  // Current time minus 15 minutes to treat soon-to-start matches as "live"
  var now = new Date();
  var currentEst = getEstTimeStrFromDate(now);
  var currentParts = currentEst.split(':');
  var currentMins = parseInt(currentParts[0], 10) * 60 + parseInt(currentParts[1], 10);
  /* Jour affiché : les heures se comparent et se placent par rapport à SON minuit —
     un match d'hier soir qui déborde sur cette nuit passe avant 00:00 (js/nuit.js). */
  var jourGrille = getEstDateStrFromDate(TARGET_DATE);
  var grilleDuJour = jourGrille === getEstDateStrFromDate(now);

  var filtered = matches.filter(function(m){
    /* Onglet Live : en cours, ou coup d'envoi dans l'heure. Rien d'autre.
       L'ancien prédicat gardait tout ce qui avait commencé dans les 24 dernières
       heures (`diff > -1440`) : un soir à 19:34, 128 matchs passaient à ce titre, dont
       un de 01:00 le matin même, et 50 autres sur un statut `live` périmé — l'onglet
       affichait plus de 200 matchs pour 2 réellement en cours. */
    if (S.filter === 'live' && !isLiveNow(m, now) && !startsWithin(m, LIVE_WINDOW_MIN, now)) return false;

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
      // Niveau d'abord : principales, puis secondaires, puis flux non identifiés
      var rankA = { main: 0, secondary: 1 }[leagueTier(a)] !== undefined ? { main: 0, secondary: 1 }[leagueTier(a)] : 2;
      var rankB = { main: 0, secondary: 1 }[leagueTier(b)] !== undefined ? { main: 0, secondary: 1 }[leagueTier(b)] : 2;
      if (rankA !== rankB) return rankA - rankB;

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
              active.sort(function(x,y){return comparerHeures(x, y, jourGrille);});
              var t = minutesDansLaJournee(active[0], jourGrille);
              return t === null ? 9999 : t;
          }
          return 9999;
      };

      var aStart = getSortTime(lgMap[a].matches);
      var bStart = getSortTime(lgMap[b].matches);
      if (aStart !== bStart) return aStart - bStart;
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
        return comparerHeures(m1, m2, jourGrille);
    });
    return lgMap[k];
  });

  var epgContainer = document.getElementById('marea');
  var fragment = document.createDocumentFragment();
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
      fragment.appendChild(ovElement);
  }
  if (errBoxElement) {
      fragment.appendChild(errBoxElement);
  }


      var renderMatches = function(matchesToRender, container, titleStr, isCollapsible, sectionId) {
          if (!matchesToRender || matchesToRender.length === 0) return;

          var grid = document.createElement('div');
          grid.className = 'match-grid';

          /* UN SEUL AXE DE DÉFILEMENT, le vertical.

             Les affiches « à la Netflix » étaient d'abord posées en rails horizontaux, une
             section par rail. Ça règle bien le problème d'origine — la carte large prenait
             toute la largeur d'un téléphone pour un seul match — mais ça en crée un autre,
             signalé à l'usage : deux axes de balayage sur le même écran. Le pouce ne sait
             plus lequel il pilote, un geste un peu oblique fait défiler la mauvaise chose,
             et la position horizontale de chaque rail devient un état à retenir.

             Les affiches restent donc, en GRILLE : trois par ligne sur un téléphone, ce qui
             garde le gain de densité, et un seul geste pour tout parcourir. Le bouton du
             titre permet de repasser une section en rail pour qui préfère — le choix est
             offert, il n'est simplement plus le défaut. */
          var railId = sectionId || ('sec_' + String(titleStr || '').replace(/[^a-zA-Z0-9]/g, ''));
          if (titleStr) grid.setAttribute('data-rail', railId);
          if (titleStr && !S.railSections[railId]) grid.classList.add('expanded');

          if (titleStr) {
              var secTitle = document.createElement('div');
              secTitle.className = 'section-title';

              if (isCollapsible) {
                  /* `chevron`, pas `icon` : une seconde `var icon` plus bas (l'icône de
                     ligue) partageait la portée de fonction et écrasait celle-ci. Au clic,
                     le gestionnaire trouvait une chaîne — ou `undefined` — à la place de
                     l'élément, levait « Cannot set properties of undefined » avant la ligne
                     qui masque la grille, et AUCUNE section ne se repliait : l'état basculait,
                     l'affichage jamais. */
                  var chevron = document.createElement('span');
                  chevron.className = 'section-chevron';
                  chevron.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
                  secTitle.appendChild(chevron);

                  /* Un titre qui se replie est un bouton : il doit s'annoncer comme tel
                     aux lecteurs d'écran et répondre au clavier, pas seulement à la souris. */
                  secTitle.setAttribute('role', 'button');
                  secTitle.setAttribute('tabindex', '0');

                  var syncCollapse = function() {
                      var closed = !!S.collapsedSections[sectionId];
                      secTitle.classList.toggle('collapsed', closed);
                      secTitle.setAttribute('aria-expanded', closed ? 'false' : 'true');
                      /* '' rend la valeur de la feuille de style, qui convient à une
                         grille ; un conteneur de sous-sections, lui, a besoin de 'block'
                         (renderGroupedSection le pose). On restitue ce qu'il avait. */
                      grid.style.display = closed ? 'none' : (grid._openDisplay || '');
                  };
                  syncCollapse();

                  var toggleCollapse = function(ev) {
                      if (ev) ev.preventDefault();
                      S.collapsedSections[sectionId] = !S.collapsedSections[sectionId];
                      syncCollapse();
                  };
                  secTitle.addEventListener('click', toggleCollapse);
                  secTitle.addEventListener('keydown', function(ev) {
                      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') toggleCollapse(ev);
                  });
              }

              var textSpan = document.createElement('span');
              var prefix = '';
              if (window.getLeagueIcon && titleStr && titleStr !== "À venir dans l'heure" && titleStr !== "Autres streams" && titleStr !== "Favoris" && titleStr !== "Live") {
                  var leagueIcon = window.getLeagueIcon(titleStr);
                  if (leagueIcon && leagueIcon !== '🏆') {
                      prefix = leagueIcon + ' ';
                  }
              }
              textSpan.textContent = prefix + titleStr;
              secTitle.appendChild(textSpan);

              /* Bascule grille ↔ rail, visible seulement en affiche verticale (CSS).
                 `aria-pressed` décrit l'état du RAIL, que le bouton propose d'activer. */
              var railBtn = document.createElement('button');
              railBtn.type = 'button';
              railBtn.className = 'rail-toggle';
              var syncRailBtn = function() {
                  var enRail = !!S.railSections[railId];
                  railBtn.textContent = enRail ? '⊞ Grille' : '⇥ Rail';
                  railBtn.setAttribute('aria-pressed', enRail ? 'true' : 'false');
                  grid.classList.toggle('expanded', !enRail);
              };
              syncRailBtn();
              grid._railBtn = railBtn;
              railBtn.addEventListener('click', function(ev) {
                  ev.stopPropagation();
                  S.railSections[railId] = !S.railSections[railId];
                  syncRailBtn();
              });
              secTitle.appendChild(railBtn);

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
              var rkA = { main: 0, secondary: 1 }[leagueTier(a)]; if (rkA === undefined) rkA = 2;
              var rkB = { main: 0, secondary: 1 }[leagueTier(b)]; if (rkB === undefined) rkB = 2;
              if (rkA !== rkB) return rkA - rkB;
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
                try {
                  var b = document.createElement('div');
                  var presume = m.status === 'live' && finPresumee(m);
                  b.className = 'match-card' + (m.status==='live' && !presume ? ' live' : '') + (m.status==='finished' || presume ? ' finished' : '');
                  /* La section Favoris montre un match qui figure AUSSI dans Live ou À venir :
                     deux cartes pour un match. Avec le même `id`, getElementById ne voyait
                     que la première et la seconde ne suivait plus les scores (relevé le
                     9 septembre 2026 : CF Montréal, favori par défaut, en cours). La copie
                     porte le suffixe que la mise à jour des scores (js/main.js) et la fiche
                     (getOriginalMatchId) attendaient déjà. */
                  b.id = 'mb-' + m.id + (sectionId === 'liveFavoris' ? '_fav_copy' : '');
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

                  /* Bandeau d'état en tête de carte (look du 7 septembre 2026 : « j'aime ce look…
                     plus clair », capture d'une carte à bandeau LIVE, blasons ronds, lignes
                     équipe/score et sport en pied). Le bandeau dit l'essentiel — DIRECT,
                     heure, Fin — ; la minute ou la période du direct va au pied, à côté du
                     sport, pour ne pas charger le bandeau. */
                  /* « Où t'as le bleu dans les cartes, mettre les couleurs des équipes en
                     dégradés quand même » (7 septembre 2026) : le panneau entier porte le
                     dégradé, assombri par la feuille de style pour que le texte reste lisible. */
                  b.style.setProperty('--card-grad', cardBg);

                  var statusHtml = '', minuteHtml = '';
                  if (presume) {
                      statusHtml = '<div class="status-text presume" title="' + esc(raisonFinPresumee(m)) + '"><span class="status-minute">Fin ?</span></div>';
                  } else if(m.status === 'live') {
                      statusHtml = '<div class="live-indicator status-text"><span class="mb-ld"></span><span class="status-minute">Direct</span></div>';
                      var minuteLive = formatLiveMinute(m);
                      if (minuteLive && minuteLive !== 'DIRECT') minuteHtml = '<span class="prime-minute">' + esc(minuteLive) + '</span>';
                  } else if(m.status === 'finished') {
                      statusHtml = '<div class="status-text"><span class="status-minute">' + (m.score ? 'Fin' : m.startTime) + '</span></div>';
                  } else {
                      statusHtml = '<div class="status-text"><span class="status-minute">'+m.startTime+'</span></div>';
                  }

                  /* Nombre de flux : l'information qui décide d'un clic (un match sans flux
                     n'est pas regardable). Quand il n'y en a aucun, le badge devient le
                     bouton qui lance la recherche — auparavant il fallait ouvrir la fiche
                     du match et attendre, sans savoir que c'était là que ça se passait. */
                  var streamCount = (m.streamLinks || []).length;
                  /* Deux « zéro lien » différents : le cache serveur a été lu et ne connaît
                     rien pour ce match (🔎 lance une recherche par proxys, lente) ; ou le
                     cache serveur n'a PAS pu être lu (⚠ le relit — c'est la vraie cause,
                     bien plus fréquente sur téléphone, et la recherche par proxys n'y
                     changerait rien). */
                  var cacheEnEchec = !!(typeof window !== 'undefined' && window.prefetchedStreamsError);
                  var streamsHtml = streamCount > 0
                      ? '<div class="card-streams" data-mid="' + esc(String(m.id)) + '" title="' + streamCount + ' flux disponibles">▶ ' + streamCount + '</div>'
                      : (cacheEnEchec
                          ? '<button type="button" class="card-streams card-streams-retry" data-mid="' + esc(String(m.id)) + '" title="Les liens n\'ont pas pu être chargés : toucher pour réessayer" aria-label="Liens non chargés, réessayer" onclick="cardRetryLinks(event)">⚠</button>'
                          : '<button type="button" class="card-streams card-streams-search" data-mid="' + esc(String(m.id)) + '" title="Aucun lien : chercher maintenant" aria-label="Chercher des liens pour ce match" onclick="cardSearchLinks(event, \'' + escJs(m.id) + '\')">🔎</button>');

                  var homeScore = m.score && typeof m.score[0] !== 'undefined' ? m.score[0] : '';
                  var awayScore = m.score && typeof m.score[1] !== 'undefined' ? m.score[1] : '';

                  var homeLogoUrl = m.homeLogo || getLogo(m.homeTeam);
                  var awayLogoUrl = m.awayLogo || getLogo(m.awayTeam);

                  var homeLogoHtmlPrime = homeLogoUrl ? (homeLogoUrl.startsWith('emoji:') ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">' + esc(homeLogoUrl.split(':')[1]) + '</div>' : '<img src="'+esc(homeLogoUrl)+'" class="prime-logo" loading="lazy" decoding="async" onerror="this.style.display=\'none\'" alt="'+esc(m.homeTeam)+'">') : (m.flag === '🎮' ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🎮</div>' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>');
                  var awayLogoHtmlPrime = awayLogoUrl ? (awayLogoUrl.startsWith('emoji:') ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">' + esc(awayLogoUrl.split(':')[1]) + '</div>' : '<img src="'+esc(awayLogoUrl)+'" class="prime-logo" loading="lazy" decoding="async" onerror="this.style.display=\'none\'" alt="'+esc(m.awayTeam)+'">') : (m.flag === '🎮' ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🎮</div>' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>');

                  // Le nom de la ligue manquait : une icône seule ne dit pas de quelle compétition il s'agit.
                  var lgBadge = '<div class="prime-league-badge"><span class="plb-ic">' + (lg.flag || lgFlag(lg.league) || '') + '</span>'
                              + '<span class="plb-name">' + esc(lg.league || '') + '</span></div>';

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

                  /* Carte en panneau : bandeau d'état, vignette au dégradé des couleurs
                     d'équipes (le gradient reste), ligue en titre, lignes équipe/score,
                     sport et minute en pied. Les classes .prime-* sont conservées : les
                     tests et la feuille classique les connaissent. */
                  /* « hier » / « demain » à part du bandeau d'état : la mise à jour des scores
                     en place (js/main.js) réécrit .status-text et ne doit pas l'effacer. */
                  var jourHtml = libelleJour(m, jourGrille) ? '<span class="prime-day">' + libelleJour(m, jourGrille) + '</span>' : '';
                  b.innerHTML = '<div class="prime-head">'
                              +   jourHtml
                              +   statusHtml
                              +   streamsHtml
                              + '</div>'
                              + '<div class="prime-thumbnail" style="background:'+cardBg+';">'
                              +   '<div class="prime-logos">'
                              +     logosHtml
                              +   '</div>'
                              + '</div>'
                              + '<div class="prime-title">' + lgBadge + '</div>'
                              + '<div class="prime-info">'
                              +   '<div class="prime-col-teams">'
                              +     teamsHtml
                              +   '</div>'
                              +   '<div class="prime-col-scores">'
                              +     scoresHtml
                              +   '</div>'
                              + '</div>'
                              + '<div class="prime-foot">'
                              +   '<span class="prime-sport">' + esc(libelleSport(m.league || lg.league)) + '</span>'
                              +   minuteHtml
                              + '</div>';

                  b.addEventListener('click', function(){ openMod(m, lgCol); });
                  grid.appendChild(b);
                } catch (cardErr) {
                  /* Données agrégées : un match malformé est ignoré, pas fatal. */
                  logLine('Carte de match ignorée', (m && m.id ? m.id + ' — ' : '') + (cardErr && cardErr.message || cardErr));
                }
              });
          });
          return grid;
      };

      /* Section repliable regroupée par sous-titre (ligues secondaires, autres flux).
         Remplace trois blocs identiques : rend d'abord la liste à plat, puis, si la
         section est dépliée, la redécoupe par groupe (ligue) trié par heure. */
      var renderGroupedSection = function(matchesToRender, container, titleStr, sectionId, defaultCollapsed, groupKeyFn) {
          if (!matchesToRender || matchesToRender.length === 0) return;
          if (S.collapsedSections[sectionId] === undefined) S.collapsedSections[sectionId] = !!defaultCollapsed;

          var host = renderMatches(matchesToRender, container, titleStr + ' (' + matchesToRender.length + ')', true, sectionId);
          if (!host) return;

          /* Les sous-groupes sont construits même quand la section est repliée, et
             seulement masqués. Auparavant on sortait ici : la section gardait alors la
             grille à plat posée par renderMatches, si bien que la déplier montrait tous
             les matchs en vrac au lieu des groupes par ligue — et le repli ne pouvait pas
             se corriger tout seul puisque rien ne re-rendait au clic. */
          var replie = !!S.collapsedSections[sectionId];

          /* Cette section n'est plus un rail mais un conteneur de sous-sections, chacune
             avec son propre rail et son propre bouton : celui du titre englobant n'a plus
             rien à déplier, on le retire plutôt que de le laisser sans effet. */
          if (host._railBtn && host._railBtn.parentNode) host._railBtn.remove();
          host.innerHTML = '';
          host.className = 'autres-streams-sub-container';
          host._openDisplay = 'block';
          host.style.display = replie ? 'none' : 'block';

          var groups = {};
          matchesToRender.forEach(function(m) {
              var k = groupKeyFn(m) || 'Autres Flux';
              if (!groups[k]) groups[k] = [];
              groups[k].push(m);
          });

          Object.keys(groups).sort().forEach(function(k) {
              var subId = sectionId + '_' + k.replace(/[^a-zA-Z0-9]/g, '');
              if (S.collapsedSections[subId] === undefined) S.collapsedSections[subId] = !!defaultCollapsed;
              var sorted = groups[k].slice().sort(function(a, b) {
                  var wa = a.status === 'live' ? 0 : (a.status === 'finished' ? 2 : 1);
                  var wb = b.status === 'live' ? 0 : (b.status === 'finished' ? 2 : 1);
                  if (wa !== wb) return wa - wb;
                  return comparerHeures(a, b, getEstDateStrFromDate(TARGET_DATE));
              });
              renderMatches(sorted, host, k, true, subId);
          });
      };

  /* Les contrôles de zoom (« Maintenant », ± ) ne pilotent que la grille temporelle du
     Guide. Ailleurs ils flottaient au-dessus des cartes sans rien faire : on les réserve
     à la vue concernée (voir .zoom-controls dans styles.css). */
  document.body.classList.toggle('view-timeline', S.filter === 'all');
  applyCardShape();

  /* Le Guide (grille temporelle) couvre déjà le programme de la journée : la vue
     « À venir », qui n'en était qu'une liste à plat, a été retirée de la navigation. */
  if (S.filter === 'live') {
      epgContainer.style.display = 'block';
      epgContainer.style.padding = '0';
      epgContainer.style.overflowY = 'auto';
      epgContainer.style.height = '100%';
      epgContainer.style.WebkitOverflowScrolling = 'touch';


      var favorisAujourdhui = [];
      var liveNow = [];
      var upNext = [];
      var secondaryMatches = [];
      var autresFluxMatches = [];

      var now = new Date();

      filtered.forEach(function(m) {
          var tier = leagueTier(m.league);
          if (tier === 'ignored') return; // ligue masquée par l'utilisateur

          if (favTeams[m.homeTeam] || favTeams[m.awayTeam] || favTeams[m.league]) {
              favorisAujourdhui.push(m);
          }

          if (tier === 'other' || m.league === 'Autres Flux') {
              autresFluxMatches.push(m);
              return;
          }

          if (tier === 'secondary') {
              secondaryMatches.push(m);
              return;
          }

          /* Deux issues seulement, et elles couvrent tout ce que `filtered` a
             laissé passer : il n'y a plus de troisième panier « plus tard ». */
          if (isLiveNow(m, now)) liveNow.push(m);
          else upNext.push(m);
      });
      /* « Favoris aujourd'hui » aurait menti ici : la section ne peut plus contenir
         que des favoris en cours ou imminents, comme le reste de l'onglet. */
      /* Repliables comme les autres : l'onglet mêlait jusqu'ici des titres qui
         réagissaient au clic et d'autres non, sans rien qui les distingue à l'œil.
         Chaque section porte donc son chevron et retient son état. */
      if (favorisAujourdhui.length > 0) renderMatches(favorisAujourdhui, fragment, "Favoris", true, 'liveFavoris');
      if (liveNow.length > 0) renderMatches(liveNow, fragment, "Live", true, 'liveNow');
      if (upNext.length > 0) renderMatches(upNext, fragment, "À venir dans l'heure", true, 'liveUpNext');
      if (favorisAujourdhui.length === 0 && liveNow.length === 0 && upNext.length === 0 && secondaryMatches.length === 0) {
          var vide = document.createElement('div');
          vide.className = 'empty-state';
          vide.innerHTML = '<div style="font-size:34px;">' + (S.searchQuery ? '🔍' : '📺') + '</div>'
            + '<div style="font-weight:700; font-size:16px; color:var(--text);">' + (S.searchQuery ? 'Aucun match ne correspond à « ' + esc(S.searchQuery) + ' »' : 'Aucun match en direct pour le moment') + '</div>'
            + '<div>' + (S.searchQuery ? 'Essayez un autre nom d\'équipe ou de ligue.' : 'Le Guide montre tout le programme du jour.') + '</div>'
            + (S.searchQuery
                ? '<button class="btn sm" onclick="setSearchQuery(\'\'); var i=document.getElementById(\'search-input\'); if(i) i.value=\'\';">Effacer la recherche</button>'
                : '<button class="btn sm" onclick="applyFilter(\'all\')">Ouvrir le Guide</button>');
          fragment.appendChild(vide);
      }
      // Ligues secondaires : dépliées par défaut (ce sont de vraies ligues reconnues)
      renderGroupedSection(secondaryMatches, fragment, "Ligues secondaires", 'secondaryLeaguesLive', false, function(m) { return m.league; });
      renderGroupedSection(autresFluxMatches, fragment, "Autres streams", 'autresStreams', true,
          function(m) { return m.scrapedLeagueName || m.league || 'Autres Flux'; });


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
              var homeLogoHtml = homeLogoUrl ? (homeLogoUrl.startsWith('emoji:') ? '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">' + esc(homeLogoUrl.split(':')[1]) + '</div>' : '<img src="'+esc(homeLogoUrl)+'" class="chan-logo" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">') : (m.flag === '🎮' ? '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">🎮</div>' : '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">🛡️</div>');
              var awayLogoHtml = awayLogoUrl ? (awayLogoUrl.startsWith('emoji:') ? '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">' + esc(awayLogoUrl.split(':')[1]) + '</div>' : '<img src="'+esc(awayLogoUrl)+'" class="chan-logo" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">') : (m.flag === '🎮' ? '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">🎮</div>' : '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">🛡️</div>');

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

              // Même définition que l'onglet Live : la pastille et la liste ne peuvent
              // pas se contredire.
              var isLiveOrSoonLoc = isLiveNow(m);

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

              var timeBadge = timelineBadgeHtml(m);

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
              /* Match d'hier soir qui déborde sur cette nuit (js/nuit.js) : son départ est
                 négatif par rapport au minuit de la grille ; sa case commence à 00:00, sur
                 ce qui lui reste. */
              var debutGrille = minutesDansLaJournee(m, jourGrille);
              var dHierSoir = debutGrille !== null && debutGrille < 0;
              if (m.status === 'live' && (!dHierSoir || grilleDuJour)) {
                  var matchStartMins = dHierSoir ? debutGrille : mH * 60 + mM;
                  var tempCurrentMins = currentMins;
                  if (!dHierSoir) {
                      if (tempCurrentMins < matchStartMins && (matchStartMins - tempCurrentMins) > 12 * 60) {
                          tempCurrentMins += 24 * 60; // wrap around midnight
                      } else if (matchStartMins < tempCurrentMins && (tempCurrentMins - matchStartMins) > 12 * 60) {
                          matchStartMins += 24 * 60; // match start is near midnight previous day
                      }
                  }
                  var matchEndMins = matchStartMins + duration;
                  if (tempCurrentMins > matchEndMins - 15) {
                      duration = (tempCurrentMins - matchStartMins) + 15;
                  }
              }
              if (dHierSoir) {
                  duration = Math.max(duration + debutGrille, 15);
                  mH = 0; mM = 0;
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
var secondaryLeaguesEpg = [];
var autresFluxMatchesEpg = [];

leagues.forEach(function(lg) {
    if (!lg) return;
    var tier = leagueTier(lg.league);
    if (tier === 'ignored') return;            // ligue masquée par l'utilisateur
    if (tier === 'secondary') { secondaryLeaguesEpg.push(lg); return; }
    if (tier === 'other' || lg.league === 'Autres Flux') {
        if (lg.matches) lg.matches.forEach(function(m) { autresFluxMatchesEpg.push(m); });
        return;
    }
    mainLeagues.push(lg);
});

renderTimelineGuide(mainLeagues, fragment);

/* Ligues secondaires : leur propre grille temporelle, sous un titre repliable,
   pour qu'elles restent lisibles sans se mélanger aux ligues principales. */
if (secondaryLeaguesEpg.length > 0) {
    var secId = 'secondaryLeaguesEpg';
    if (S.collapsedSections[secId] === undefined) S.collapsedSections[secId] = false;
    var secCount = secondaryLeaguesEpg.reduce(function(n, lg) { return n + (lg.matches ? lg.matches.length : 0); }, 0);

    var secTitle = document.createElement('div');
    secTitle.className = 'section-title';
    secTitle.setAttribute('role', 'button');
    secTitle.setAttribute('tabindex', '0');
    var secChev = document.createElement('span');
    secChev.className = 'section-chevron';
    secChev.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
    secTitle.appendChild(secChev);
    var secLabel = document.createElement('span');
    secLabel.textContent = 'Ligues secondaires (' + secCount + ')';
    secTitle.appendChild(secLabel);
    fragment.appendChild(secTitle);

    var secWrap = renderTimelineGuide(secondaryLeaguesEpg, fragment);
    var syncSec = function() {
        var closed = !!S.collapsedSections[secId];
        secTitle.classList.toggle('collapsed', closed);
        secTitle.setAttribute('aria-expanded', closed ? 'false' : 'true');
        if (secWrap) secWrap.style.display = closed ? 'none' : '';
    };
    syncSec();
    var toggleSec = function(ev) {
        if (ev) ev.preventDefault();
        S.collapsedSections[secId] = !S.collapsedSections[secId];
        syncSec();
    };
    secTitle.addEventListener('click', toggleSec);
    secTitle.addEventListener('keydown', function(ev) { if (ev.key === 'Enter' || ev.key === ' ') toggleSec(ev); });
}

renderGroupedSection(autresFluxMatchesEpg, fragment, "Autres streams", 'autresStreamsEpg', true,
    function(m) { return m.scrapedLeagueName || m.league || 'Autres Flux'; });

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



  epgContainer.appendChild(fragment);
  renderSportChips(matches);

  updateNowLine();
}

/* Pastilles de filtre par ligue, dans la barre d'outils.

   Elles n'étaient construites que dans la branche « scraping en direct » de loadAllRun :
   dès que le cache serveur suffisait (le cas normal), la rangée restait vide. Rendues ici,
   à chaque construction de la grille, elles suivent la journée affichée et l'état des
   filtres. Une seule pastille active suffit à cliquer ; « Toutes » rétablit tout. */
export function renderSportChips(matches) {
  var sf = document.getElementById('sport-filters');
  if (!sf) return;
  var counts = {};
  (matches || []).forEach(function(m) {
      if (!m.league || m.league === 'EN DIRECT' || leagueTier(m.league) === 'ignored') return;
      counts[m.league] = (counts[m.league] || 0) + 1;
  });
  var names = Object.keys(counts);
  if (names.length < 2) { sf.innerHTML = ''; return; }
  names.sort(function(a, b) {
      var ra = { main: 0, secondary: 1 }[leagueTier(a)]; if (ra === undefined) ra = 2;
      var rb = { main: 0, secondary: 1 }[leagueTier(b)]; if (rb === undefined) rb = 2;
      if (ra !== rb) return ra - rb;
      if (counts[b] !== counts[a]) return counts[b] - counts[a];
      return a.localeCompare(b);
  });
  var anyHidden = names.some(function(n) { return S.hiddenLg[n]; });
  var html = '<button type="button" class="btn sport-btn sport-all' + (anyHidden ? '' : ' active-toggle') + '" aria-pressed="' + !anyHidden + '" onclick="applySportFilter(\'all\')">Toutes</button>';
  names.forEach(function(n) {
      var on = !S.hiddenLg[n];
      html += '<button type="button" class="btn sport-btn' + (on && anyHidden ? ' active-toggle' : '') + '" aria-pressed="' + (on && anyHidden) + '" onclick="applySportFilter(\'' + escJs(n) + '\')">'
            + '<span>' + (lgFlag(n) || '') + '</span> ' + esc(n) + ' <span class="sb-n">' + counts[n] + '</span></button>';
  });
  sf.innerHTML = html;
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

/* Pastille « heure / minute / score » d'un bloc de la grille temporelle. Partagée avec la
   mise à jour des scores en direct (js/main.js) : jusqu'ici celle-ci ne touchait que les
   cartes du Live (`.status-minute`, `.prime-score`) et laissait les blocs du Guide figés
   sur leur texte de construction — un match pouvait y afficher « 19:05 » une heure après
   le coup d'envoi, et le score n'y bougeait jamais. */
export function timelineBadgeHtml(m) {
    // « hier · » / « demain · » devant un match qui n'est pas daté du jour affiché (js/nuit.js).
    var prefixe = libelleJour(m, getEstDateStrFromDate(TARGET_DATE));
    prefixe = prefixe ? prefixe + ' · ' : '';
    var homeScore = m.score && typeof m.score[0] !== 'undefined' ? m.score[0] : '';
    var awayScore = m.score && typeof m.score[1] !== 'undefined' ? m.score[1] : '';
    var scoreTxt = (homeScore !== '' && awayScore !== '') ? esc(String(homeScore)) + ' - ' + esc(String(awayScore)) : '';
    if (m.status === 'live' && finPresumee(m)) {
        return '<div class="mb-time" title="' + esc(raisonFinPresumee(m)) + '" style="background:rgba(255,255,255,0.1);color:#fff;padding:2px 8px;border-radius:6px;font-weight:bold;">' + prefixe + 'Fin ?' + (scoreTxt ? ' | ' + scoreTxt : '') + '</div>';
    }
    if (m.status === 'live') {
        return '<div class="mb-time mb-time-live" style="background:rgba(255,255,255,0.2);color:#fff;padding:2px 8px;border-radius:6px;font-weight:bold;">' + prefixe + esc(formatLiveMinute(m) === 'DIRECT' ? 'LIVE' : formatLiveMinute(m)) + (scoreTxt ? ' | ' + scoreTxt : '') + '</div>';
    }
    if (m.status === 'finished') {
        if (scoreTxt) return '<div class="mb-time" style="background:rgba(255,255,255,0.1);color:#fff;padding:2px 8px;border-radius:6px;font-weight:bold;">' + prefixe + 'Terminé | ' + scoreTxt + '</div>';
        return '<div class="mb-time" style="background:rgba(255,255,255,0.1);color:var(--muted);padding:2px 8px;border-radius:6px;font-weight:bold;">' + prefixe + esc(m.startTime || '') + '</div>';
    }
    return '<div class="mb-time" style="padding:2px 8px;border-radius:6px;font-weight:bold;background:rgba(0,0,0,0.3);">' + prefixe + esc(m.startTime || '') + '</div>';
}

/* Un match a-t-il sa place dans l'onglet Live ? Même règle que le filtre de buildEPG :
   en cours, ou coup d'envoi dans l'heure — et jamais terminé, quoi qu'ait dit la source
   il y a cinq minutes. Exposée pour que la mise à jour des scores puisse décider si la
   vue doit être reconstruite (un match terminé selon ESPN doit disparaître du Live). */
export function belongsToLive(m, now) {
    now = now || new Date();
    return isLiveNow(m, now) || startsWithin(m, LIVE_WINDOW_MIN, now);
}

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
    var rootContainer = document.getElementById('epg');
    if(!rootContainer || rootContainer.style.display === 'none' || !epgContainer) return;

    var now = new Date();
    var isToday = (TARGET_DATE.toDateString() === now.toDateString());

    var rootStyles = getComputedStyle(document.documentElement);
    var hourPx = parseFloat(rootStyles.getPropertyValue('--hour-px')) || (window.innerWidth <= 768 ? 140 : 220);
    var minPx = hourPx / 60;

    var estStr = getEstTimeStrFromDate(now);
    var parts = estStr.split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);

    var viewWidth = epgContainer.clientWidth;
    var chanW = parseFloat(rootStyles.getPropertyValue('--chan-w')) || (window.innerWidth <= 768 ? 100 : 240);
    var offsetPx = (h * hourPx) + (m * minPx);
    var scrollLeft = offsetPx - 40;

    try {
        epgContainer.scrollTo({
            left: Math.max(0, scrollLeft),
            behavior: 'smooth'
        });
    } catch (e) {
        epgContainer.scrollLeft = Math.max(0, scrollLeft);
    }
}


/* ══ MODAL ══════════════════════════════ */
export var QC ={'HD':'bHD','SD':'bSD','4K':'b4K','4k':'b4K'};
export var QI ={'HD':'📺','SD':'📱','4K':'🖥','4k':'🖥'};

export function renderFluxItem(s, i, m) {
    var ev="openFlux(event,'"+escJs(encodeURIComponent(s.url||'#'))+"','"+escJs(encodeURIComponent(s.name||'Flux'))+"','"+escJs(m.id)+"',"+(s.topLevel?'true':'false')+")";
    /* Le clic envoie toujours vers le Multivision, intégrable ou non : ouvrir
       automatiquement un nouvel onglet pour les liens « page » ne faisait pas mieux
       sur certains navigateurs mobiles (onglet vide). Le badge « onglet » ci-dessous
       prévient que ce lien précis risque de refuser l'affichage intégré, et le
       bouton dédié ↗ (à droite de la ligne) reste le moyen explicite de l'ouvrir
       hors de l'application. Le classement lui-même vient du moteur d'extraction
       (js/extractors.js) et du registre appris, pas d'une supposition de l'interface. */
    var openExtEv = "window.open('"+escJs(s.url||'#')+"','_blank','noopener');event.stopPropagation();event.preventDefault();";

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

    /* Domaine primaire porté par la ligne : c'est ce qui permet aux pastilles de filtre
       (renderDomainChips) de masquer les autres sans re-générer la liste. */
    /* Provenance du flux (chaîne, site, langue) et débit/définition RÉELLEMENT mesurés la
       dernière fois que ce flux a joué chez l'utilisateur (js/debit.js). La qualité annoncée
       par la source est du déclaratif souvent faux ; la mesure, elle, est constatée — et rien
       n'est affiché tant que rien n'a été mesuré. */
    var mesure = formaterMesure(mesurePour(safeStorageGetJSON('debits', {}) || {}, s.url));
    var metaInner = (s.channel ? '<span class="si-chan">📡 '+esc(s.channel)+'</span>' : '')
        + (s.site ? '<span>'+esc(s.site)+'</span>' : '')
        + (s.lang && !/^multi$/i.test(s.lang) ? '<span class="si-lang">'+esc(String(s.lang).toUpperCase())+'</span>' : '')
        + (mesure ? '<span class="si-mesure" title="Mesuré chez vous la dernière fois que ce flux a joué">' + esc(mesure) + '</span>' : '');
    var meta = metaInner ? '<div class="si-meta">' + metaInner + '</div>' : '';
    return '<div class="si" data-dom="'+esc(primaryDomain(s.url))+'">'
      +'<a href="#" class="si-main" onclick="'+ev+'">'
      +'<div class="si-ic">'+(s.icon||QI[s.quality]||'📺')+'</div>'
      +'<div class="si-inf">'
        +'<div class="si-n"><span>'+esc(s.name||'Flux '+(i+1))+'</span>'
        +(s.topLevel?'<span class="si-tab" title="Cette page refuse l\'affichage intégré : le clic l\'ouvre dans un onglet">onglet</span>':'')+'</div>'
        + meta
      +'</div>'
      /* Badge de qualité seulement quand elle est réellement connue. */
      +(s.quality ? '<span class="sbadge '+(QC[s.quality]||'bSD')+'">'+esc(s.quality)+'</span>' : '')
      +'</a>'
      +'<div class="si-actions">'
        +'<button type="button" class="si-btn'+(pref===1?' on-fav':'')+'" title="Prioriser ce domaine" aria-label="Prioriser ce domaine" aria-pressed="'+(pref===1)+'" onclick="'+favEv+'">⭐</button>'
        +'<button type="button" class="si-btn'+(pref===-1?' on-dep':'')+'" title="Déprioriser ce domaine" aria-label="Déprioriser ce domaine" aria-pressed="'+(pref===-1)+'" onclick="'+depEv+'">👎</button>'
        +'<button type="button" class="si-btn si-add" title="Ajouter au Multivision" aria-label="Ajouter au Multivision" onclick="'+addMvEv+'">⊞</button>'
        +'<button type="button" class="si-btn si-ext'+(s.topLevel?' hint':'')+'" title="Ouvrir dans un nouvel onglet" aria-label="Ouvrir dans un nouvel onglet" onclick="'+openExtEv+'">↗</button>'
      +'</div>'
      +'</div>';
}

/* Répartition des liens d'un match par domaine primaire, en pastilles de filtre.

   Sur un match bien fourni la liste dépasse trente lignes, presque toutes intitulées
   « Lecteur direct » ou du nom d'une chaîne : savoir combien de liens vient de quel
   fournisseur — et n'afficher que ceux-là — est ce qui rend la liste exploitable.

   Seuls les six premiers domaines ont leur pastille ; la queue (un lien chacun, souvent
   vingt domaines vus une seule fois) est repliée dans une pastille « Autres ». Sans
   cela, la rangée de pastilles repoussait la liste des flux sous le bas de l'écran d'un
   téléphone — l'inverse du service rendu. */
export var DOM_CHIPS_MAX = 6;

export function renderDomainChips(m) {
  var links = (m && m.streamLinks) || [];
  var stats = matchDomainStats(m);
  if (stats.length < 2 || links.length < 6) return '';

  var head = stats.slice(0, DOM_CHIPS_MAX);
  var tail = stats.slice(DOM_CHIPS_MAX);

  var chip = function(doms, label, count, title) {
    return '<button type="button" class="dom-chip" data-doms="' + esc(doms.join(',')) + '"'
      + (title ? ' title="' + esc(title) + '"' : '')
      + ' onclick="filterFluxByDomain(this.getAttribute(\'data-doms\'))">'
      + esc(label) + ' <b>' + count + '</b></button>';
  };

  var html = '<button type="button" class="dom-chip active" data-doms="" onclick="filterFluxByDomain(\'\')">Tous <b>'
    + links.length + '</b></button>';

  html += head.map(function(d) {
    return chip([d.domain], d.domain, d.links, d.embeds + ' intégrables · ' + d.pages + ' pages');
  }).join('');

  if (tail.length) {
    var rest = tail.reduce(function(n, d) { return n + d.links; }, 0);
    html += chip(tail.map(function(d) { return d.domain; }),
      'Autres (' + tail.length + ')', rest,
      tail.map(function(d) { return d.domain + ' ×' + d.links; }).join(', '));
  }

  return '<div class="dom-chips">' + html + '</div>';
}

/* Relit la page du match tant que sa fiche est ouverte, et complète la liste des flux
   sans la faire clignoter : le scrape fusionne, et on ne redessine que si le nombre de
   flux a réellement augmenté. Un seul minuteur pour toute l'application. */
export var rafraichissementFiche = null;
export function arreterRafraichissementFiche() {
    if (rafraichissementFiche) { clearInterval(rafraichissementFiche); rafraichissementFiche = null; }
}
function ficheOuvertePour(m) {
    var fen = document.getElementById('mbg');
    var titre = document.getElementById('mname');
    return !!(fen && fen.classList.contains('open') && titre && titre.dataset.matchName
        && titre.dataset.matchName.indexOf(m.homeTeam) >= 0);
}
function armerRafraichissementFiche(m, col) {
    arreterRafraichissementFiche();
    if (!m || !m.matchUrl) return;
    rafraichissementFiche = setInterval(function() {
        if (!ficheOuvertePour(m)) { arreterRafraichissementFiche(); return; }
        if (m._relectureEnCours || !doitRafraichirFiche(m)) return;
        m._relectureEnCours = true;
        var avant = compterFluxUtiles(m);
        m.pageLueA = Date.now();
        scrapeMatchFlux(m, true, true).then(function() {
            m._relectureEnCours = false;
            if (compterFluxUtiles(m) <= avant) return;
            if (ficheOuvertePour(m)) openMod(m, col);
        }).catch(function() { m._relectureEnCours = false; });
    }, INTERVALLE_FICHE_MS);
}

export function openMod(m,col){
  document.getElementById('mdot').style.background=col||'#888';

  var hLogo = m.homeLogo || getLogo(m.homeTeam);
  var aLogo = m.awayLogo || getLogo(m.awayTeam);


  /* L'en-tête est la bannière du match (logos, couleurs, score) : posée plus bas, une
     fois logos, couleurs, score et statut calculés (voir « Bannière »). */
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
                  espnBtn.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:6px; color:var(--text); text-decoration:none; background:rgba(255,255,255,0.05); padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600; border:1px solid rgba(255,255,255,0.1); transition:all 0.15s;';
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
                                  toggleBtn.style.cssText = 'display:flex; width:100%; align-items:center; justify-content:center; gap:6px; color:var(--text); background:transparent; border:none; padding:8px 16px; font-size:13px; font-weight:600; cursor:pointer; opacity:0.8; transition:all 0.15s;';
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

  var homeLogoHtmlPrime = hLogo ? (hLogo.startsWith('emoji:') ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">' + esc(hLogo.split(':')[1]) + '</div>' : '<img src="'+esc(hLogo)+'" class="prime-logo" loading="lazy" decoding="async" onerror="this.style.display=\'none\'" alt="'+esc(m.homeTeam)+'">') : (m.flag === '🎮' ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🎮</div>' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>');
  var awayLogoHtmlPrime = aLogo ? (aLogo.startsWith('emoji:') ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">' + esc(aLogo.split(':')[1]) + '</div>' : '<img src="'+esc(aLogo)+'" class="prime-logo" loading="lazy" decoding="async" onerror="this.style.display=\'none\'" alt="'+esc(m.awayTeam)+'">') : (m.flag === '🎮' ? '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🎮</div>' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>');

  var isRacing = !m.awayTeam || m.awayTeam.toLowerCase() === 'race' || m.awayTeam.toLowerCase().startsWith('fp') || m.awayTeam.toLowerCase().startsWith('qual');

  var statusHtml = '';
  if (m.status === 'live' && finPresumee(m)) {
      statusHtml = '<div class="status-text presume" title="' + esc(raisonFinPresumee(m)) + '" style="color:var(--muted); font-size:14px; font-weight:600; text-align:center; margin-top:8px;"><span class="status-minute">Fin ?</span></div>';
  } else if(m.status === 'live') {
      statusHtml = '<div class="live-indicator status-text" style="color:var(--red); font-weight:800; display:flex; align-items:center; justify-content:center; gap:6px; font-size:13px; margin-top:8px;"><span class="mb-ld" style="width:8px;height:8px;border-radius:50%;background:var(--red);display:inline-block;"></span><span class="status-minute">'+esc(formatLiveMinute(m))+'</span></div>';
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

  /* ── Bannière (7 septembre 2026, « intégrer les logos et couleurs des équipes dans le
     haut ») ─────────────────────────────────────────────────────────────────────────
     L'en-tête de la fiche portait une ligne de texte tronquée (« MLB Chicago White Sox —
     Min… ») et le tableau d'affichage vivait plus bas, dans le corps. Le haut devient la
     bannière : le dégradé aux couleurs des équipes (le même que la carte), les deux
     blasons, les noms avec l'étoile de favori, le score et l'état, la ligue en petit.
     Le corps ne garde que les compléments (buteurs, classement, statistiques). */
  var etoile = function(nom) { return '<button type="button" class="fb-fav" title="Équipe favorite" aria-label="Équipe favorite" style="color:' + (favTeams[nom] ? 'var(--accent)' : 'rgba(255,255,255,0.55)') + ';" onclick="toggleFavTeam(\'' + escJs(nom) + '\'); event.stopPropagation();">★</button>'; };
  var banniereHtml = '<div class="fiche-banner' + (isRacing ? ' racing' : '') + '">'
      + '<div class="fb-team home">' + homeLogoHtmlPrime + '<div class="fb-name" title="' + esc(m.homeTeam) + '">' + esc(m.homeTeam) + ' ' + etoile(m.homeTeam) + '</div></div>'
      + '<div class="fb-center">'
      +   '<div class="fb-league">' + (m.flag || lgFlag(m.league) || '') + ' ' + esc(m.league || '') + '</div>'
      +   (isRacing ? '' : centerScoreHtml)
      +   (libelleJour(m, getEstDateStrFromDate(TARGET_DATE)) ? '<span class="prime-day">' + libelleJour(m, getEstDateStrFromDate(TARGET_DATE)) + '</span>' : '')
      +   statusHtml
      + '</div>'
      + (isRacing ? '' : '<div class="fb-team away">' + awayLogoHtmlPrime + '<div class="fb-name" title="' + esc(m.awayTeam) + '">' + etoile(m.awayTeam) + ' ' + esc(m.awayTeam) + '</div></div>')
      + '</div>';
  var mhd = document.querySelector('#mbg .mhd');
  if (mhd) { mhd.classList.add('has-banner'); mhd.style.background = cardBg; }
  document.getElementById('mname').innerHTML = banniereHtml;

  var wrapperHtml = '<div class="fiche-cols" style="display:flex; flex-direction:row; flex-wrap:wrap; gap: 24px; align-items: flex-start; width: 100%; position: relative;">' +
      '<div id="modal-left-col" style="flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 16px; z-index: 10; padding-bottom: 10px; padding-top: 10px;">' +
          '<div class="match-card scoreboard fiche-complements" style="display:flex; flex-direction:column; position:relative; pointer-events:none;">' +
              '<div class="prime-info" style="display:flex; flex-direction:column; padding: 4px 16px; pointer-events:auto; z-index: 2;">' +
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

  /* Les compléments (buteurs, classement, statistiques) n'arrivent qu'après coup, pour
     les matchs ESPN seulement : la colonne qui les porte ne s'affiche que quand l'un
     d'eux a quelque chose à montrer (classe has-content, lue par la feuille de style),
     sinon la liste des flux prend toute la largeur. */
  var complements = body.querySelector('.fiche-complements');
  if (complements && window.MutationObserver) {
      var majComplements = function() {
          var visibles = Array.prototype.some.call(complements.querySelectorAll('[id$="-container"], #home-scorers-modal, #away-scorers-modal'), function(el) {
              return el.style.display !== 'none' && el.innerHTML.trim() !== '';
          });
          complements.classList.toggle('has-content', visibles);
      };
      new MutationObserver(majComplements).observe(complements, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
      majComplements();
  }

  var rightCol = document.getElementById('modal-right-col');

  // When a user clicks a match, we ALWAYS fetch streams if there are none available yet,
  // bypassing background state checks that might erroneously be true.
  /* « Assez de flux » se compte en liens JOUABLES : un repli « Page du match » n'en est
     pas un, et c'est lui qui faisait passer un match démuni pour un match servi. */
  var hasEnoughStreams = compterFluxUtiles(m) > 0;
  var needsScraping = !hasEnoughStreams && m.matchUrl;

  // Barre d'actions de la colonne des flux : rafraîchir, et « meilleur flux au Multivision »
  var rightHeaderHtml = '<div class="flux-head"><span class="flux-title">Flux</span><div class="flux-actions">'
      + '<button id="mv-refresh-btn" class="icon-btn" aria-label="Mettre à jour les flux" title="Mettre à jour les flux"' + (!m.matchUrl ? ' disabled' : '') + '>🔄</button>'
      + '<button id="mv-random-btn" class="icon-btn" aria-label="Ajouter le meilleur flux au Multivision" title="Ajouter le meilleur flux au Multivision">⊞</button>'
      + '</div></div>';

  // This will attach events to the header buttons once rightCol.innerHTML is set
  function attachHeaderEvents() {
      var refreshBtn = document.getElementById('mv-refresh-btn');
      if (refreshBtn) {
          refreshBtn.onclick = function() {
              this.style.opacity = '0.5';
              this.disabled = true;

              var rightCol = document.getElementById('modal-right-col');
              if(rightCol) {
                  rightCol.innerHTML = rightHeaderHtml + '<div class="flux-loading"><div class="spinner"></div><div>Recherche de flux…</div><small>Actualisation en cours</small></div>';
                  attachHeaderEvents();
              }

              m.streamLinks = [];
              m.streamsLoaded = false;

              scrapeMatchFlux(m, true, true).finally(function() {
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
                  if (!sl.source && u.source) sl.source = u.source;
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
      hasEnoughStreams = compterFluxUtiles(m) > 0;
      needsScraping = !hasEnoughStreams && m.matchUrl;
  }


  if(needsScraping) {
      rightCol.innerHTML= rightHeaderHtml + '<div class="flux-loading"><div class="spinner"></div><div>Recherche de flux…</div><small>Les liens déjà connus s\'affichent dès qu\'ils arrivent</small></div>';
      attachHeaderEvents();
      document.getElementById('mbg').classList.add('open');

      // Force load the streams for this specific match right away if they aren't loaded yet
      lg('Force loading flux', m.homeTeam);
      scrapeMatchFlux(m, false, true).then(function() {
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
      /* Le cache horaire est un point de départ, jamais le dernier mot.

         Il est produit par GitHub Actions, depuis une adresse de centre de données que
         plusieurs sources refusent, et il a jusqu'à une heure de retard. Le navigateur de
         l'utilisateur, lui, lit la même page depuis SON adresse — celle qui passe. Alors
         dès qu'on ouvre un match venu du cache, on relit sa page en fond, sans rien
         bloquer : les liens déjà connus s'affichent tout de suite, et la fenêtre se
         redessine seulement si la relecture apporte vraiment quelque chose de plus.

         Une seule fois par match et par session : rouvrir la même fiche dix fois ne doit
         pas rescanner dix fois. */
      if (doitRelireLaPage(m)) {
          m.relueLocalement = true;
          m.pageLueA = Date.now();
          var avant = compterFluxUtiles(m);
          /* Relecture FORCÉE : sans cela, le cache local du navigateur renverrait aussitôt
             ce que le serveur avait déjà déposé, et la relecture ne relirait rien. Le
             scrape fusionne, il n'écrase pas — les liens déjà connus survivent à un échec. */
          scrapeMatchFlux(m, true, true).then(function() {
              if (compterFluxUtiles(m) <= avant) return;
              var fen = document.getElementById('mbg');
              var titre = document.getElementById('mname');
              if (fen && fen.classList.contains('open') && titre && titre.dataset.matchName.indexOf(m.homeTeam) >= 0) openMod(m, col);
          }).catch(function() { /* la relecture est un bonus : son échec ne doit rien casser */ });
      }

      /* Puis on continue de relire tant que la fiche reste ouverte : ces sites publient
         leurs liens au fil du match (voir doitRafraichirFiche, js/scrapers.js). Un seul
         minuteur à la fois — il est coupé ici même avant d'être réarmé, et à la
         fermeture de la fiche. */
      armerRafraichissementFiche(m, col);

      var sortedLinks = [];
      if (m.streamLinks && m.streamLinks.length > 0) {
          sortedLinks = sortFluxLinks(m.streamLinks);
      }

      var contentHtml = rightHeaderHtml;
      if (sortedLinks.length === 0) {
          contentHtml += '<div class="flux-empty"><div>Aucun flux trouvé pour l\'instant.</div>';
          if (m.matchUrl) {
              contentHtml += '<a href="'+esc(m.matchUrl)+'" target="_blank" rel="noopener" class="btn sm o">Ouvrir la page du match ↗</a>';
          }
          contentHtml += '</div>';
      } else {
          contentHtml += renderDomainChips(m);
          contentHtml += sortedLinks.map(function(s,i){
              return renderFluxItem(s, i, m);
          }).join('');
      }

            // Fetch League VODs
      if (m.id && m.id.toString().startsWith('lol_') && m.status === 'finished') {
          import('./api.js').then(api => {
              var eventId = m.id.split('_')[1];
              api.fetchLolEsportsEventDetails(eventId).then(function(res) {
                  if (res && res.data && res.data.event && res.data.event.match && res.data.event.match.games) {
                      var newStreams = [];
                      res.data.event.match.games.forEach(function(game) {
                          if (game.vods && game.vods.length > 0) {
                              var vod = game.vods[0];
                              var url = '';
                              if (vod.provider === 'youtube') {
                                  url = 'https://www.youtube.com/watch?v=' + vod.parameter;
                              } else if (vod.provider === 'twitch') {
                                  url = 'https://www.twitch.tv/videos/' + vod.parameter;
                              }

                              if (url) {
                                  newStreams.push({
                                      name: 'VOD Game ' + game.number + ' (' + vod.provider + ')',
                                      url: url,
                                      source: 'vod',
                                      quality: '1080p'
                                  });
                              }
                          }
                      });

                      if (newStreams.length > 0) {
                          m.streamLinks = m.streamLinks || [];
                          var added = false;
                          newStreams.forEach(function(ns) {
                              if (!m.streamLinks.find(sl => sl.url === ns.url)) {
                                  m.streamLinks.push(ns);
                                  added = true;
                              }
                          });
                          if (added) {
                              // Force redraw modal
                              if (document.getElementById('mbg').classList.contains('open') && document.getElementById('mname').dataset.matchName.indexOf(m.homeTeam) >= 0) {
                                  openMod(m, col);
                              }
                          }
                      }
                  }
              });
          });
      }

      // Fallback manual links search
      contentHtml += '<details class="flux-more"><summary>Recherche manuelle et sites sources</summary>';
      contentHtml += '<div class="flux-sites">';

      var searchQuery = encodeURIComponent(m.homeTeam + ' ' + m.awayTeam);
      var singleTeam = encodeURIComponent(m.homeTeam);

      var feedCountsBySource = {};
      if (m.streamLinks) {
          m.streamLinks.forEach(function(sl) {
              if (sl.source) {
                  feedCountsBySource[sl.source] = (feedCountsBySource[sl.source] || 0) + 1;
              }
          });
      }

      SCRAPERS_CONFIG.forEach(function(site) {
          var feedCount = feedCountsBySource[site.id] || 0;
          var statHtml = '';

          if (m.streamsLoaded) {
              var statColor = 'var(--muted)';
              if (feedCount > 0) {
                  statColor = '#34c759';
              } else {
                  statColor = 'var(--red)';
              }
              statHtml = ' <span style="font-size: 10px; margin-left: 4px; color: '+statColor+';" title="Flux extraits pour ce match">('+feedCount+' flux)</span>';
          }

          contentHtml += '<a href="'+site.url+'" target="_blank" rel="noopener" class="mtag">'+site.name+' 🔗' + statHtml + '</a>';
      });
      contentHtml += '</div>';

      contentHtml += '<div class="sub">';
      contentHtml += '<div class="sub-title">Ajouter un flux manuellement au Multivision (m3u8, iframe, URL) :</div>';
      contentHtml += '<div class="sub-row">';
      contentHtml += '<input type="text" id="manual-flux-input" class="input" placeholder="https://...">';
      contentHtml += '<button class="btn o" onclick="var v=document.getElementById(\'manual-flux-input\').value; if(v){ window.addManualStream(\''+escJs(m.id)+'\', v); }">Ajouter ⊞</button>';
      contentHtml += '</div></div>';

      contentHtml += '<div class="sub">';
      contentHtml += '<div class="sub-title">Corriger et extraire via une URL source (diagnostic) :</div>';
      contentHtml += '<div class="sub-row">';
      contentHtml += '<input type="text" id="diagnostic-url-input" class="input" placeholder="https://site-de-streaming.com/match-xyz" value="'+(m.matchUrl ? esc(m.matchUrl) : '')+'">';
      contentHtml += '<button class="btn primary" onclick="var u=document.getElementById(\'diagnostic-url-input\').value; if(u){ window.diagnosticScrape(\''+escJs(m.id)+'\', u); }">Scraper</button>';
      contentHtml += '</div>';
      contentHtml += '<div id="diagnostic-report-container" style="margin-top: 10px; font-size: 12px; color: var(--muted2);">';
      if (m._diagnosticReportHtml) {
          contentHtml += m._diagnosticReportHtml;
          delete m._diagnosticReportHtml; // Consume it
      }
      contentHtml += '</div>';
      contentHtml += '</div>';

      if (possibleMatches.length > 0) {
          contentHtml += '<div class="flux-isolated">';
          contentHtml += '<div class="sub-title" style="color:var(--accent);">Flux isolés trouvés :</div>';
          contentHtml += '<div>';
          possibleMatches.forEach(function(pm) {
              contentHtml += '<div class="row-i">';
              contentHtml += '<div>' + esc(pm.homeTeam) + ' vs ' + esc(pm.awayTeam) + ' <span style="opacity:0.5;">('+esc(pm.source)+')</span></div>';
              if (pm.matchUrl) {
                  contentHtml += '<button class="btn o" style="padding: 4px 8px; font-size: 11px;" onclick="addToMultivision(\''+escJs(pm.matchUrl)+'\', \''+escJs(pm.homeTeam)+' vs '+escJs(pm.awayTeam)+'\', \''+escJs(pm.id)+'\'); closeMod();">Lancer ⊞</button>';
              }
              contentHtml += '</div>';
          });
          contentHtml += '</div></div>';
      }

      contentHtml += '</details>';

      rightCol.innerHTML = contentHtml;
      attachHeaderEvents();
      document.getElementById('mbg').classList.add('open');
  }
}
export function closeMod(){
  document.getElementById('mbg').classList.remove('open');
  arreterRafraichissementFiche();
  if (window.modalStatsInterval) { clearInterval(window.modalStatsInterval); window.modalStatsInterval = null; }
}

/* Échap ferme la fiche, ou le menu « Plus » s'il est ouvert. */
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    var mbg = document.getElementById('mbg');
    if (mbg && mbg.classList.contains('open')) { closeMod(); return; }
    var inv = document.getElementById('investigator-modal');
    if (inv && inv.style.display === 'flex') { inv.style.display = 'none'; return; }
    var menu = document.getElementById('main-menu');
    if (menu && menu.classList.contains('open') && typeof window.toggleMenu === 'function') window.toggleMenu();
  });
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
window.timelineBadgeHtml = timelineBadgeHtml;
window.belongsToLive = belongsToLive;
window.renderSportChips = renderSportChips;
window.applyCardShape = applyCardShape;
window.cardShapePref = cardShapePref;
window.updateNowLine = updateNowLine;
window.scrollToNow = scrollToNow;
window.QC = QC;
window.QI = QI;
window.renderFluxItem = renderFluxItem;
window.renderDomainChips = renderDomainChips;
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

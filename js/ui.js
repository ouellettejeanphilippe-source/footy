import { getEstTimeStrFromDate, getDomain, domainPrefs, toggleDomainPref, sortFluxLinks } from './config.js';
import { normName, lgColor, getTeamColors, getLogo } from './db.js';
import { S, customLgOrder, favTeams, matchCardCache, toggleFavTeam } from './state.js';
import { lg, esc, toggleAccordion, escJs, pad, toggleLeague, safeStorageGetJSON, safeStorageSetJSON } from './utils.js';
import { TARGET_DATE, fetchGameStats, renderScorersHtml } from './api.js';
import { openFlux, mvFlux, saveMultivisionState, updateMultivisionLayout, addToMultivision } from './multiview.js';
import { scrapeMatchFlux } from './scrapers.js';
import { isMatch } from './match.js';
import { DEFAULT_LEAGUES } from './main.js';

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
      if (a === 'Autres Flux') return 1;
      if (b === 'Autres Flux') return -1;

      // Custom League Order User Preference
      var displayOrder = customLgOrder.length > 0 ? customLgOrder : Object.keys(DEFAULT_LEAGUES);
      var idxA = displayOrder.indexOf(a);
      var idxB = displayOrder.indexOf(b);

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
        var f1 = (favTeams[m1.homeTeam] || favTeams[m1.awayTeam]) ? -1 : 0;
        var f2 = (favTeams[m2.homeTeam] || favTeams[m2.awayTeam]) ? -1 : 0;
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
              textSpan.textContent = titleStr;
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
              if (a === 'Autres Flux') return 1;
              if (b === 'Autres Flux') return -1;
              var displayOrder = customLgOrder.length > 0 ? customLgOrder : Object.keys(DEFAULT_LEAGUES);
      var idxA = displayOrder.indexOf(a);
      var idxB = displayOrder.indexOf(b);
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
                + '<span class="ch-flag">'+lg.flag+'</span>'
                + '<span class="lg-title">'+esc(lg.league)+'</span>'
                + '<span class="lg-cnt">'+lg.matches.length+'</span>';
              lHdr.addEventListener('click', function(){ toggleAccordion(lg.league); });
              grid.appendChild(lHdr);

              if (!isCollapsed) {
                  lg.matches.forEach(function(m) {
                      var b = document.createElement('div');
                      b.className = 'match-card' + (m.status==='live' ? ' live' : '') + (m.status==='finished' ? ' finished' : '');
                      b.id = 'mb-'+m.id;

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
                      statusHtml = '<div class="status-text"><span class="status-minute">Fin</span></div>';
                  } else {
                      statusHtml = '<div class="status-text"><span class="status-minute">'+m.startTime+'</span></div>';
                  }

                  var homeScore = m.score && typeof m.score[0] !== 'undefined' ? m.score[0] : '';
                  var awayScore = m.score && typeof m.score[1] !== 'undefined' ? m.score[1] : '';

                  var homeLogoUrl = m.homeLogo || getLogo(m.homeTeam);
                  var awayLogoUrl = m.awayLogo || getLogo(m.awayTeam);

                  var homeLogoHtmlPrime = homeLogoUrl ? '<img src="'+esc(homeLogoUrl)+'" class="prime-logo" onerror="this.style.display=\'none\'" alt="'+esc(m.homeTeam)+'">' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>';
                  var awayLogoHtmlPrime = awayLogoUrl ? '<img src="'+esc(awayLogoUrl)+'" class="prime-logo" onerror="this.style.display=\'none\'" alt="'+esc(m.awayTeam)+'">' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>';

                  var streamsBadgePrime = m.streamLinks && m.streamLinks.length>0 ? '<div class="prime-stream-count">'+m.streamLinks.length+' flux</div>' : '';
                  var lgBadge = '<div class="prime-league-badge">'+lg.flag+'</div>';

                  var homeFavBtn = '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.homeTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;padding:0;margin-right:4px;" onclick="toggleFavTeam(\''+escJs(m.homeTeam)+'\'); event.stopPropagation();">★</button>';
                  var awayFavBtn = '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.awayTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;padding:0;margin-right:4px;" onclick="toggleFavTeam(\''+escJs(m.awayTeam)+'\'); event.stopPropagation();">★</button>';

                  var logosHtml = m.awayTeam ?
                                  '<div class="prime-logo-wrapper home">' + homeLogoHtmlPrime + '</div><div class="prime-logo-wrapper away">' + awayLogoHtmlPrime + '</div>' :
                                  '<div class="prime-logo-wrapper home" style="width: 100%; display: flex; justify-content: center;">' + homeLogoHtmlPrime + '</div>';

                  var teamsHtml = m.awayTeam ?
                                  '<div class="prime-team-name" title="'+esc(m.homeTeam)+'">'+homeFavBtn+esc(m.homeTeam)+'</div><div class="prime-team-name" title="'+esc(m.awayTeam)+'">'+awayFavBtn+esc(m.awayTeam)+'</div>' :
                                  '<div class="prime-team-name" style="text-align: center; justify-content: center;" title="'+esc(m.homeTeam)+'">'+homeFavBtn+esc(m.homeTeam)+'</div>';

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

                  b.addEventListener('click', function(){ openMod(m, lgCol); });
                  grid.appendChild(b);
              });
          }
          });
      };

      // Split live and upcoming in 60 mins and later today if filter is live
      if (S.filter === 'live') {
          var liveNow = [];
          var upNext = [];
          var laterToday = [];

          var now = new Date();
          var currentEst = getEstTimeStrFromDate(now);
          var currentParts = currentEst.split(':');
          var currentMins = parseInt(currentParts[0], 10) * 60 + parseInt(currentParts[1], 10);

          filtered.forEach(function(m) {
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
          if (liveNow.length > 0) renderMatches(liveNow, epgContainer, "");
          if (upNext.length > 0) renderMatches(upNext, epgContainer, "À venir dans l'heure");
          if (laterToday.length > 0) renderMatches(laterToday, epgContainer, "Plus tard aujourd'hui", true, 'laterToday');
          if (liveNow.length === 0 && upNext.length === 0 && laterToday.length === 0) {
              epgContainer.innerHTML = '<div style="color:var(--muted); padding:20px; text-align:center;">Aucun match en direct pour le moment.</div>';
          }
      } else {
          // Render matches normally for upcoming
          renderMatches(filtered, epgContainer, "");
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

  var epgWrapper = document.createElement('div');
  epgWrapper.className = 'epg-wrapper';
  epgWrapper.id = 'epg-wrapper';

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

  epgWrapper.appendChild(rulerRow);

  // Now Line element will be appended to the first marea so it spans down
  var nowLineAdded = false;
  var nowLineHtml = '<div class="now-line" id="nowline"></div>';

  leagues.forEach(function(lg){
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
      + '<span class="ch-flag">'+lg.flag+'</span>'
      + '<span class="lg-title">'+esc(lg.league)+'</span>'
      + '<span class="lg-cnt">'+lg.matches.length+'</span>';
    lHdrCell.addEventListener('click', function(){ toggleAccordion(lg.league); });

    var lHdrMarea = document.createElement('div');
    lHdrMarea.className = 'marea';
    // Add grid background to header marea as well to match
    lHdrRow.appendChild(lHdrCell);
    lHdrRow.appendChild(lHdrMarea);
    epgWrapper.appendChild(lHdrRow);

    if(!nowLineAdded) {
        lHdrMarea.innerHTML += nowLineHtml;
        nowLineAdded = true;
    }

    if(!isCollapsed) {
        lg.matches.forEach(function(m){
            var row = document.createElement('div');
            row.className = 'mrow' + (isCollapsed ? ' hidden-lg' : '');
            row.setAttribute('data-lg', lg.league);

            // Channel cell
            var homeLogoUrl = m.homeLogo || getLogo(m.homeTeam);
            var awayLogoUrl = m.awayLogo || getLogo(m.awayTeam);
            var homeLogoHtml = homeLogoUrl ? '<img src="'+esc(homeLogoUrl)+'" class="chan-logo" onerror="this.style.display=\x27none\x27">' : '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">🛡️</div>';
            var awayLogoHtml = awayLogoUrl ? '<img src="'+esc(awayLogoUrl)+'" class="chan-logo" onerror="this.style.display=\x27none\x27">' : '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">🛡️</div>';

            var cCell = document.createElement('div');
            cCell.className = 'chan-cell';
            cCell.innerHTML = '<div class="chan-team">'
                            + '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.homeTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;" onclick=\"toggleFavTeam(\'"+escJs(m.homeTeam)+"\')\">★</button>'
                            + homeLogoHtml
                            + '<span class="ch-name" title="'+esc(m.homeTeam)+'">'+esc(m.homeTeam)+'</span></div>'
                            + '<div class="chan-team">'
                            + '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.awayTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;" onclick=\"toggleFavTeam(\'"+escJs(m.awayTeam)+"\')\">★</button>'
                            + awayLogoHtml
                            + '<span class="ch-name" title="'+esc(m.awayTeam)+'">'+esc(m.awayTeam)+'</span></div>';

            var marea = document.createElement('div');
            marea.className = 'marea';

            var b = document.createElement('div');
            b.id = 'mb-'+m.id;

            var isLiveOrSoonLoc = m.status === 'live';
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
            if (favTeams[m.homeTeam] || favTeams[m.awayTeam]) b.classList.add('is-fav');

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
                timeBadge = '<div class="mb-time" style="background:rgba(255,255,255,0.1);color:#fff;padding:2px 8px;border-radius:6px;font-weight:bold;">Terminé' + (matchScoreText ? ' | ' + matchScoreText : '') + '</div>';
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
            epgWrapper.appendChild(row);
        });
    }
  });

  epgContainer.appendChild(epgWrapper);

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
    var line = document.getElementById('nowline');
    if(!line) return;

    var now = new Date();
    var isToday = (TARGET_DATE.toDateString() === now.toDateString());

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
}

setInterval(updateNowLine, 60000);

export function scrollToNow(){
    var epgContainer = document.getElementById('epg');
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
        epgContainer.scrollTop = Math.max(0, offsetPx - (hClient / 2));
    } else {
        epgContainer.scrollLeft = Math.max(0, offsetPx - (w / 2));
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

    return '<div class="si">'
      +'<a href="#" onclick="'+ev+'" style="flex:1;min-width:0;display:flex;align-items:center;gap:16px;padding:16px;color:var(--text);text-decoration:none;">'
      +'<div class="si-ic">'+(s.icon||QI[s.quality]||'📺')+'</div>'
      +'<div class="si-inf"><div class="si-n">'+esc(s.name||'Flux '+(i+1))+'</div>'
      +'<div class="si-s">'+(i===0?'Recommandé':'Alternatif')+'</div></div>'
      +'<span class="sbadge '+(QC[s.quality]||'bSD')+'">'+(s.quality||'SD')+'</span>'
      +'</a>'
      +'<div style="display:flex;flex-direction:column;border-left:1px solid rgba(255,255,255,0.08);flex-shrink:0;width:40px;">'
        +'<button title="Prioriser ce domaine" aria-label="Prioriser ce domaine" onclick="'+favEv+'" style="flex:1;background:'+(pref===1?'var(--accent)':'rgba(255,255,255,0.02)')+';border:none;border-bottom:1px solid rgba(255,255,255,0.08);color:'+(pref===1?'#fff':'var(--muted)')+';cursor:pointer;font-size:14px;transition:all 0.2s;display:flex;align-items:center;justify-content:center;">⭐</button>'
        +'<button title="Déprioriser ce domaine" aria-label="Déprioriser ce domaine" onclick="'+depEv+'" style="flex:1;background:'+(pref===-1?'var(--red)':'rgba(255,255,255,0.02)')+';border:none;color:'+(pref===-1?'#fff':'var(--muted)')+';cursor:pointer;font-size:14px;transition:all 0.2s;display:flex;align-items:center;justify-content:center;">👎</button>'
      +'</div>'
      +'<button title="Ajouter au Multivision" aria-label="Ajouter au Multivision" onclick="'+addMvEv+'" style="background:rgba(255,255,255,0.02);border:none;border-left:1px solid rgba(255,255,255,0.08);color:var(--text);width:50px;cursor:pointer;transition:background 0.2s;flex-shrink:0;font-size:20px;display:flex;align-items:center;justify-content:center;">⊞</button>'
      +'</div>';
}

export function openMod(m,col){
  document.getElementById('mdot').style.background=col||'#888';

  var hLogo = m.homeLogo || getLogo(m.homeTeam);
  var aLogo = m.awayLogo || getLogo(m.awayTeam);

  // Create a layout inspired by "The Score" scoreboard
  var html = '<div style="display:flex; flex-direction:column; width: 100%; gap: 16px;">';

  // Top: League & Metadata centered
  var liveBadge = m.status === 'live' ? '<span style="color:var(--red); font-weight:800; font-size:12px; margin-left:8px;">🔴 ' + (m.minute ? esc(m.minute) + "'" : 'LIVE') + '</span>' : '';
  html += '<div style="text-align:center; font-size:12px; font-weight:700; color:var(--muted2); text-transform:uppercase; letter-spacing:0.5px;">';
  html += m.flag + ' ' + esc(m.league) + ' <span style="margin:0 8px; opacity:0.5;">•</span> ' + esc(m.startTime) + liveBadge;
  html += '</div>';

  // Middle: Home Team | Score | Away Team
  html += '<div style="display:flex; justify-content:space-between; align-items:center; width: 100%; padding: 0 10px;">';

  // Home Team
  html += '<div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; flex: 1;" onclick="openGlobalStats(\'' + escJs(m.homeTeam) + '\')">';
  if(hLogo) html += '<div class="prime-logo" style="width:50px; height:50px; display:flex; justify-content:center; align-items:center;"><img src="'+esc(hLogo)+'" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.style.display=\'none\'"></div>';
  html += '<span style="font-weight:700; font-size:14px; text-align:center; line-height:1.2;">' + esc(m.homeTeam) + '</span>';
  html += '</div>';

  // Score
  html += '<div style="flex: 0.8; display:flex; justify-content:center; align-items:center; flex-direction:column;">';
  if(m.score) {
      html += '<div style="font-weight:800; font-size:32px; color:var(--text); letter-spacing:1px; line-height:1;">' + m.score[0] + ' <span style="color:var(--muted); font-size:24px;">-</span> ' + m.score[1] + '</div>';
  } else {
      html += '<div style="font-weight:700; font-size:20px; color:var(--muted); line-height:1;">VS</div>';
  }
  html += '</div>';

  // Away Team
  html += '<div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; flex: 1;" onclick="openGlobalStats(\'' + escJs(m.awayTeam) + '\')">';
  if(aLogo) html += '<div class="prime-logo" style="width:50px; height:50px; display:flex; justify-content:center; align-items:center;"><img src="'+esc(aLogo)+'" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.style.display=\'none\'"></div>';
  html += '<span style="font-weight:700; font-size:14px; text-align:center; line-height:1.2;">' + esc(m.awayTeam) + '</span>';
  html += '</div>';

  html += '</div></div>';

  document.getElementById('mname').innerHTML = html;
  document.getElementById('mname').dataset.matchName = m.homeTeam+' — '+m.awayTeam; // for the stats checker

  // Clear the original elements since we combined them
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

              var extraHtml = '';
              if (res.hRank || res.aRank || res.hForm || res.aForm) {
                  extraHtml += '<div style="display:flex; justify-content:space-between; width:100%; font-size:11px; color:rgba(255,255,255,0.5); margin-bottom:10px; padding: 0 10px;">';
                  extraHtml += '<div style="flex:1; text-align:center;">' + (res.hRank ? '#' + res.hRank + ' ' : '') + (res.hForm ? '[' + res.hForm + ']' : '') + '</div>';
                  extraHtml += '<div style="flex:0.8;"></div>'; // Spacer for score
                  extraHtml += '<div style="flex:1; text-align:center;">' + (res.aRank ? '#' + res.aRank + ' ' : '') + (res.aForm ? '[' + res.aForm + ']' : '') + '</div>';
                  extraHtml += '</div>';
              }

              if (res.scorers && res.scorers.length > 0) {
                  extraHtml += renderScorersHtml(res.scorers, m, mHomeId, mAwayId);
              }

              var existingStats = document.getElementById('modal-extra-stats');
              if (existingStats) existingStats.remove();

              if (extraHtml) {
                  var stDiv = document.createElement('div');
                  stDiv.id = 'modal-extra-stats';
                  stDiv.style.cssText = 'padding:12px 16px; width:100%; background:rgba(255,255,255,0.03); border-radius: 12px; margin-bottom: 16px; cursor:pointer; transition: all 0.2s ease; border: 1px solid rgba(255,255,255,0.05);';
                  stDiv.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.06)'; this.style.borderColor = 'rgba(255,255,255,0.1)'; };
                  stDiv.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.03)'; this.style.borderColor = 'rgba(255,255,255,0.05)'; };
                  stDiv.onclick = function() { closeMod(); openGlobalStatsFromMatch(m.id); };
                  stDiv.innerHTML = '<div style="max-width:100%; margin:0 auto;">' + extraHtml + '<div style="text-align:center; margin-top:12px; font-size:12px; font-weight:600; color:var(--accent);">Analyses du match <span style="font-size:10px;">➔</span></div></div>';
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
      window.modalStatsInterval = setInterval(fetchAndRenderModalStats, 300000);
  }

  var btnContainer = document.createElement('div');
  btnContainer.style.display = 'flex';
  btnContainer.style.gap = '8px';
  btnContainer.style.width = '100%';
  btnContainer.style.marginTop = '16px';

  var addMvBtn = document.createElement('button');
  addMvBtn.className = 'btn o';
  addMvBtn.style.flex = '1';
  addMvBtn.style.alignSelf = 'center';
  addMvBtn.innerHTML = '⊞ Ajouter au Multivision (Attente du flux)';
  addMvBtn.id = 'mv-add-btn';
  addMvBtn.disabled = true;

  var refreshBtn = document.createElement('button');
  refreshBtn.className = 'btn o';
  refreshBtn.style.flex = '1';
  refreshBtn.style.alignSelf = 'center';
  refreshBtn.innerHTML = '🔄 Rafraîchir les flux';
  refreshBtn.id = 'mv-refresh-btn';
  refreshBtn.onclick = function() {
      refreshBtn.innerHTML = 'Chargement...';
      refreshBtn.disabled = true;
      scrapeMatchFlux(m, true).finally(function() {
          openMod(m, col);
      });
  };

  if (!m.matchUrl) {
      refreshBtn.disabled = true;
  }

  btnContainer.appendChild(addMvBtn);
  btnContainer.appendChild(refreshBtn);

  // Since mmeta is cleared, append to mname which is our unified header
  document.getElementById('mname').appendChild(btnContainer);

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
export function closeMod(){
  document.getElementById('mbg').classList.remove('open');
    if (window.modalStatsInterval) { clearInterval(window.modalStatsInterval); window.modalStatsInterval = null; }
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

import re

with open('app.js', 'r') as f:
    js = f.read()

# Replace the inner block of `} else { // Timeline EPG`
start_marker = "  } else { // Timeline EPG"
end_marker = "  } // End of else block for timeline EPG"

start_idx = js.find(start_marker)
end_idx = js.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find Timeline EPG block")
    exit(1)

new_epg_block = """  } else { // Timeline EPG

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

    var lHdrCell = document.createElement('div');
    lHdrCell.className = 'lg-hdr' + (isCollapsed ? ' collapsed' : '');
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
            row.className = 'mrow';

            // Channel cell
            var homeLogoUrl = m.homeLogo || getLogo(m.homeTeam);
            var awayLogoUrl = m.awayLogo || getLogo(m.awayTeam);
            var homeLogoHtml = homeLogoUrl ? '<img src="'+esc(homeLogoUrl)+'" class="chan-logo" onerror="this.style.display=\'none\'">' : '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">🛡️</div>';
            var awayLogoHtml = awayLogoUrl ? '<img src="'+esc(awayLogoUrl)+'" class="chan-logo" onerror="this.style.display=\'none\'">' : '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">🛡️</div>';

            var cCell = document.createElement('div');
            cCell.className = 'chan-cell';
            cCell.innerHTML = '<div class="chan-team">'
                            + '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.homeTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;" onclick="toggleFavTeam(\''+escJs(m.homeTeam)+'\')">★</button>'
                            + homeLogoHtml
                            + '<span class="ch-name" title="'+esc(m.homeTeam)+'">'+esc(m.homeTeam)+'</span></div>'
                            + '<div class="chan-team">'
                            + '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.awayTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;" onclick="toggleFavTeam(\''+escJs(m.awayTeam)+'\')">★</button>'
                            + awayLogoHtml
                            + '<span class="ch-name" title="'+esc(m.awayTeam)+'">'+esc(m.awayTeam)+'</span></div>';

            var marea = document.createElement('div');
            marea.className = 'marea';

            var b = document.createElement('div');
            b.id = 'mb-'+m.id;
            b.className = 'mb' + (m.status==='live' ? ' live' : '') + (m.status==='finished' ? ' finished' : '');

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
            } else {
                b.style.background = 'linear-gradient(105deg, ' + homeColor + ' 53%, ' + awayColor + ' 53%)';
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
            // Fallback for older browsers
            b.style.left = 'calc((var(--start-h) * var(--hour-px)) + (var(--start-m) * var(--min-px)))';
            b.style.width = 'calc(var(--duration-m) * var(--min-px))';

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
"""

js = js[:start_idx] + new_epg_block + js[end_idx:]

with open('app.js', 'w') as f:
    f.write(js)

<<<<<<< SEARCH
  var hLogo = m.homeLogo || getLogo(m.homeTeam);
  var aLogo = m.awayLogo || getLogo(m.awayTeam);
  var mnameHtml = '';

  mnameHtml += '<div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="openGlobalStats(\'' + escJs(m.homeTeam) + '\')">';
  if(hLogo) mnameHtml += '<img src="'+esc(hLogo)+'" style="width:24px;height:24px;object-fit:contain;" onerror="this.style.display=\'none\'">';
  mnameHtml += '<span>' + esc(m.homeTeam) + '</span></div>';

  mnameHtml += '<span style="color:var(--muted); font-size: 16px; margin: 0 4px;">—</span>';

  mnameHtml += '<div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="openGlobalStats(\'' + escJs(m.awayTeam) + '\')">';
  if(aLogo) mnameHtml += '<img src="'+esc(aLogo)+'" style="width:24px;height:24px;object-fit:contain;" onerror="this.style.display=\'none\'">';
  mnameHtml += '<span>' + esc(m.awayTeam) + '</span></div>';

  document.getElementById('mname').innerHTML = '<div style="display:flex; align-items:center; flex-wrap:wrap;">' + mnameHtml + '</div>';
  document.getElementById('mname').dataset.matchName = m.homeTeam+' — '+m.awayTeam; // for the stats checker

  document.getElementById('mmeta').innerHTML=
    '<span class="mtag">'+m.flag+' '+esc(m.league)+'</span>'
    +'<span class="mtag">'+esc(m.startTime)+'</span>'
    +(m.status==='live'?'<span class="mtag" style="color:var(--red);background:rgba(255,59,59,.1)">🔴 '+(m.minute?esc(m.minute)+"'":'EN DIRECT')+'</span>':'');
  document.getElementById('mscore').innerHTML=m.score?'<div class="msc">'+m.score[0]+'–'+m.score[1]+'</div>':'';
=======
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
>>>>>>> REPLACE

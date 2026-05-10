<<<<<<< SEARCH
        var html = '<div style="display:flex; flex-direction:column; gap:16px;">';

        // Simple header
        html += '<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:16px; border-radius:12px;">';
        var hLogo = getLogo(m.homeTeam);
        var aLogo = getLogo(m.awayTeam);

        var hRankFormStr = (res.hRank ? '#' + res.hRank + ' ' : '') + (res.hForm ? '[' + res.hForm + ']' : '');
        html += '<div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer;" onclick="openGlobalStats(\''+escJs(m.homeTeam)+'\')">';
        if (hRankFormStr) html += '<span style="font-size:10px; color:rgba(255,255,255,0.5);">' + hRankFormStr + '</span>';
        html += '<img src="'+esc(hLogo)+'" style="height:40px;object-fit:contain;" onerror="this.style.display=\'none\'"><span style="font-weight:bold;font-size:12px;">'+esc(m.homeTeam)+'</span></div>';

        html += '<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">';
        if(m.score) {
            html += '<div style="font-size:24px;font-weight:800;">'+m.score[0]+' - '+m.score[1]+'</div>';
        }
        var statusStr = m.status === 'live' ? '<span style="color:var(--red);">🔴 '+(m.minute?m.minute+'\'':'Live')+'</span>' : (m.status === 'finished' ? 'Terminé' : m.startTime);
        html += '<div style="font-size:12px;color:var(--muted);font-weight:bold;">'+statusStr+'</div>';
        html += '</div>';

        var aRankFormStr = (res.aRank ? '#' + res.aRank + ' ' : '') + (res.aForm ? '[' + res.aForm + ']' : '');
        html += '<div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer;" onclick="openGlobalStats(\''+escJs(m.awayTeam)+'\')">';
        if (aRankFormStr) html += '<span style="font-size:10px; color:rgba(255,255,255,0.5);">' + aRankFormStr + '</span>';
        html += '<img src="'+esc(aLogo)+'" style="height:40px;object-fit:contain;" onerror="this.style.display=\'none\'"><span style="font-weight:bold;font-size:12px;">'+esc(m.awayTeam)+'</span></div>';
        html += '</div>';
=======
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
>>>>>>> REPLACE

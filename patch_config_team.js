<<<<<<< SEARCH
    // Header Equipe
    html += '<div style="display:flex;align-items:center;gap:16px;background:rgba(255,255,255,0.05);padding:20px;border-radius:16px;">';
    var logoUrl = getLogo(teamName);
    if (logoUrl) {
        html += '<img id="gstats-team-logo" src="'+esc(logoUrl)+'" style="width:60px;height:60px;object-fit:contain;" onerror="this.style.display=\'none\'">';
    }
    html += '<div style="flex:1;">';
    html += '<h2 style="margin:0;font-size:22px;color:#fff;">'+esc(teamName)+'</h2>';
    var lg = teamMatches.length > 0 ? teamMatches[0].league : '';
    if(lg) html += '<div style="color:var(--muted);font-size:13px;">'+esc(lg)+'</div>';
    html += '</div>';
    html += '</div>';
=======
    // Header Equipe The Score style
    html += '<div style="display:flex; flex-direction:column; align-items:center; gap:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); padding:24px 20px; border-radius:16px;">';
    var logoUrl = getLogo(teamName);
    if (logoUrl) {
        html += '<div class="prime-logo" style="width:80px; height:80px; display:flex; justify-content:center; align-items:center;"><img id="gstats-team-logo" src="'+esc(logoUrl)+'" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.style.display=\'none\'"></div>';
    }
    html += '<div style="text-align:center;">';
    html += '<h2 style="margin:0 0 4px 0; font-size:24px; font-weight:800; color:#fff; letter-spacing:-0.5px;">'+esc(teamName)+'</h2>';
    var lg = teamMatches.length > 0 ? teamMatches[0].league : '';
    if(lg) html += '<div style="color:var(--muted2); font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">'+esc(lg)+'</div>';
    html += '</div>';
    html += '</div>';
>>>>>>> REPLACE

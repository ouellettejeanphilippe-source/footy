<<<<<<< SEARCH
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
                  stDiv.style.cssText = 'padding:15px; width:100%; background:rgba(0,0,0,0.2); border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; transition: background 0.2s;';
                  stDiv.onmouseover = function() { this.style.background = 'rgba(0,0,0,0.3)'; };
                  stDiv.onmouseout = function() { this.style.background = 'rgba(0,0,0,0.2)'; };
                  stDiv.onclick = function() { closeMod(); openGlobalStatsFromMatch(m.id); };
                  stDiv.innerHTML = '<div style="max-width:400px; margin:0 auto;">' + extraHtml + '<div style="text-align:center; margin-top:8px; font-size:11px; color:var(--accent);">🔍 Voir toutes les stats</div></div>';
                  // Prepend inside mbody so it spans full width and looks clean before the links
                  var mbody = document.getElementById('mbody');
                  mbody.insertBefore(stDiv, mbody.firstChild);
              }
=======
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
>>>>>>> REPLACE

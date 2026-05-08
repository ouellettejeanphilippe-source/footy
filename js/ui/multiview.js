            cell.dataset.index = idx;
            cell.style.cssText = 'position:relative;background:#111;display:flex;flex-direction:column;cursor:grab;overflow:hidden;resize:both;';
            cell.draggable = true;

            var hdr = document.createElement('div');
            hdr.className = 'mv-hdr';
            hdr.style.cssText = 'position:absolute;top:0;left:0;right:0;background:linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%);color:#fff;padding:8px 12px;font-size:12px;display:flex;justify-content:space-between;align-items:center;z-index:10;pointer-events:none;';

            var videoContainer = document.createElement('div');
            videoContainer.className = 'mv-video-container';
            videoContainer.style.cssText = 'flex:1;position:relative;width:100%;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:transparent;';

            cell.appendChild(hdr);
            cell.appendChild(videoContainer);
            grid.appendChild(cell);

            fallbackToIframe(s.url, videoContainer, cell, s);
        }

        // Helper function for fallback
        function fallbackToIframe(url, container, cell, s) {
            container.innerHTML = '';
            var iframe = document.createElement('iframe');
            iframe.className = 'mv-media mv-iframe';
            iframe.style.cssText = 'width:100%;height:100%;border:none;pointer-events:auto;transition:transform 0.2s;';
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('allow', 'fullscreen; autoplay; presentation');
            iframe.src = url;
            container.appendChild(iframe);
            cell.addEventListener('mousedown', function() { iframe.style.pointerEvents = 'none'; });
            cell.addEventListener('mouseup', function() { iframe.style.pointerEvents = 'auto'; });
            cell.addEventListener('mouseleave', function() { iframe.style.pointerEvents = 'auto'; });
            s._currentUrl = url;

            if (s.cropped) {
                iframe.style.transform = 'scale(1.15)';
            } else {
                iframe.style.transform = 'scale(1)';
            }
        }

        // Use CSS flex/grid order to reorder elements without removing them from the DOM
        cell.style.order = idx;

        cell.dataset.index = idx;


        // Update styling/gridRow
        if (!document.getElementById('mv-container').classList.contains('mv-pip')) {
            cell.style.width = '100%';
            cell.style.height = '100%';
            // Enable horizontal resize only on elements that represent a column boundary
            cell.style.resize = 'horizontal';
            cell.style.overflow = 'hidden';

            var colIndex = 0;


            if (mvLayout === 'focus' && count >= 2) {
                if (idx === 0) {
                    cell.style.gridRow = 'span ' + (count - 1);
                    cell.style.gridColumn = '1';
                    colIndex = 0;
                } else {
                    cell.style.gridRow = 'auto';
                    cell.style.gridColumn = '2';
                    colIndex = 1;
                    cell.style.resize = 'none'; // Only resize main focus col
                }
            } else if (mvLayout === 'auto' && count === 3 && idx === 0) {
                cell.style.gridRow = 'span 2';
                cell.style.gridColumn = '1'; // Force column 1
                colIndex = 0;
            } else {
                cell.style.gridRow = 'auto';

                if (mvLayout === 'horizontal') {
                    cell.style.gridColumn = 'auto';
                    colIndex = idx;
                    if (idx === count - 1) cell.style.resize = 'none'; // No need to resize last col
                } else if (mvLayout === 'vertical') {
                    cell.style.gridColumn = '1';
                    colIndex = 0;
                    cell.style.resize = 'none'; // Only one column, no horizontal resizing
                } else {
                    // Standard auto mode (usually 2 cols)
                    if (count === 3) {
                        cell.style.gridColumn = '2';
                        colIndex = 1;
                    } else {
                        colIndex = (idx % 2 === 0) ? 0 : 1;
                        cell.style.gridColumn = 'auto';
                    }
                    if (colIndex === 1 || count === 1) cell.style.resize = 'none';
                }
            }
            // Assign col index for tracking
            cell.dataset.col = colIndex.toString();

            // Reset inline width from previous resizes so CSS Grid takes over
            cell.style.width = '';

            // Attach observer to detect resizing and update the grid template
            if (!cell._hasResizeObserver && cell.style.resize !== 'none') {
                cell._hasResizeObserver = new ResizeObserver(function(entries) {
                    var isPip = document.getElementById('mv-container').classList.contains('mv-pip');
                    if (isPip) return;

                    for (var i = 0; i < entries.length; i++) {
                        var target = entries[i].target;
                        // Only react if width was injected via user resizing
                        if (target.style.width && target.style.width !== '' && target.style.width !== '100%') {
                            var w = target.offsetWidth;
                            var gridWidth = grid.offsetWidth;

                            // Convert pixel width to fractional unit (fr)
                            var fraction = w / gridWidth;
                            // Ensure fraction stays within bounds (5% to 95%)
                            fraction = Math.max(0.05, Math.min(0.95, fraction));

                            var colIdx = parseInt(target.dataset.col);
                            if (!isNaN(colIdx)) {
                                grid._customCols[colIdx] = fraction.toFixed(3); // Store as fr
                                // clear the inline width so the grid template enforces it
                                target.style.width = '';

                                // Calculate total custom fr applied to other columns (for horizontal)
                                var usedFr = 0;
                                for (var c in grid._customCols) {
                                    if (parseInt(c) !== colIdx) usedFr += parseFloat(grid._customCols[c] || 0);
                                }


                                // Re-apply grid template proportionally
                                if (mvLayout === 'focus' && count >= 2) {
                                    grid.style.gridTemplateColumns = grid._customCols[0] + 'fr ' + (1 - fraction).toFixed(3) + 'fr';
                                } else if (mvLayout === 'horizontal') {
                                    var template = '';
                                    var remainingFr = 1 - usedFr - fraction;
                                    if (remainingFr < 0.05 * count) remainingFr = 0.05 * count; // Clamp remaining to minimum
                                    var remainingCols = count - Object.keys(grid._customCols).length;

                                    for (var j = 0; j < count; j++) {
                                        if (grid._customCols[j]) {
                                            template += grid._customCols[j] + 'fr ';
                                        } else {
                                            template += (remainingCols > 0 ? (remainingFr / remainingCols).toFixed(3) : 0) + 'fr ';
                                        }
                                    }
                                    grid.style.gridTemplateColumns = template.trim();
                                } else {
                                    // Default 2 cols (auto, count >= 2)
                                    grid.style.gridTemplateColumns = grid._customCols[0] + 'fr ' + (1 - fraction).toFixed(3) + 'fr';
                                }                            }
                        }
                    }
                });
                cell._hasResizeObserver.observe(cell);
            } else if (cell.style.resize === 'none' && cell._hasResizeObserver) {
                cell._hasResizeObserver.disconnect();
                cell._hasResizeObserver = null;
            }

        } else {
            // Force pure vertical in PiP mode
            cell.style.width = '100%';
            cell.style.height = '100%';
            cell.style.resize = 'none';
            cell.style.gridRow = 'auto';
            cell.style.gridColumn = '1';
        }
        // Make cell clickable for focus logic
        cell.onmousedown = function(e) {
            if (!e.target.closest('.mv-hdr')) {
                focusStream(idx);
            }
        };

        // Update drag/drop indices as they can change
        cell.ondragstart = function(e) {
            e.dataTransfer.setData('text/plain', idx.toString());
            cell.style.opacity = '0.5';
        };
        cell.ondragend = function(e) {
            cell.style.opacity = '1';
        };
        cell.ondragover = function(e) {
            e.preventDefault();
            cell.style.boxShadow = 'inset 0 0 0 2px var(--accent)';
        };
        cell.ondragleave = function(e) {
            cell.style.boxShadow = 'none';
        };
        cell.ondrop = function(e) {
            e.preventDefault();
            cell.style.boxShadow = 'none';
            var fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            var toIdx = idx;
            if (fromIdx !== toIdx && !isNaN(fromIdx)) {
                var temp = mvFlux[fromIdx];
                mvFlux[fromIdx] = mvFlux[toIdx];
                mvFlux[toIdx] = temp;
                saveMultivisionState();
                updateMultivisionLayout();
            }
        };

        // Update header HTML
        var hdr = cell.querySelector('.mv-hdr');
        // Make the header semi-transparent by default so it doesn't block the video too much
        hdr.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)';
        hdr.style.transition = 'background 0.2s';
        hdr.onmouseenter = function() { this.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)'; };
        hdr.onmouseleave = function() { this.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)'; };

        var domain = s.url ? getDomain(s.url) : 'Flux';
        var hdrHtml = '<div style="display:flex;align-items:center;gap:8px;pointer-events:auto;">' +
            '<span style="background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);padding:4px 8px;border-radius:4px;font-size:10px;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);">' + esc(domain) + '</span>' +
            '<span style="font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;text-shadow:0 1px 2px #000;color:rgba(255,255,255,0.8);" title="' + esc(s.name) + '">' + esc(s.name) + '</span>' +
            '</div>';

        var controlsHtml = '<div style="display:flex;gap:6px;pointer-events:auto;background:rgba(0,0,0,0.3);padding:4px;border-radius:8px;backdrop-filter:blur(5px);position:relative;">';

        // SVG Constants
        var svgMenu = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>';
        var svgLeft = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
        var svgRight = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
        var svgFlux = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>';
        var svgMatch = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path d="M9 12l2 2 4-4"/></svg>';
        var svgReload = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c0-5.52 4.48-10 10-10 2.21 0 4.25.71 5.91 1.91L21 6V2h-4"/><path d="M22 12c0 5.52-4.48 10-10 10-2.21 0-4.25-.71-5.91-1.91L3 18v4h4"/></svg>';
        var svgClose = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
        var svgStats = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>';

        // Dropdown Toggle
        var ddId = 'mv-dd-' + idx;
        controlsHtml += '<div style="position:relative;">';
        controlsHtml += '<button title="Menu" aria-label="Menu" style="background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:4px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.2)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.1)\'" onclick="var d = document.getElementById(\'' + ddId + '\'); d.style.display = d.style.display === \'block\' ? \'none\' : \'block\'; event.stopPropagation();">' + svgMenu + '</button>';

        // Dropdown Menu
        controlsHtml += '<div id="' + ddId + '" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;background:rgba(20,20,20,0.95);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:4px;min-width:160px;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,0.5);">';

        var btnStyle = 'background:transparent;color:#fff;border:none;border-radius:4px;width:100%;text-align:left;padding:8px 12px;font-size:13px;display:flex;align-items:center;gap:8px;cursor:pointer;transition:background 0.2s;';
        var hoverAttr = ' onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'transparent\'" ';

        if (idx > 0) {
             controlsHtml += '<button title="Déplacer à gauche" aria-label="Déplacer à gauche" style="' + btnStyle + '" ' + hoverAttr + ' onclick="moveMultiviewStream(' + idx + ', \'left\');event.stopPropagation();">' + svgLeft + ' Déplacer à gauche</button>';
        }
        if (idx < mvFlux.length - 1) {
             controlsHtml += '<button title="Déplacer à droite" aria-label="Déplacer à droite" style="' + btnStyle + '" ' + hoverAttr + ' onclick="moveMultiviewStream(' + idx + ', \'right\');event.stopPropagation();">' + svgRight + ' Déplacer à droite</button>';
        }

        if (s.mid) {
             controlsHtml += '<button title="Infos & Stats" aria-label="Infos & Stats" style="' + btnStyle + '" ' + hoverAttr + ' onclick="document.getElementById(\'' + ddId + '\').style.display=\'none\'; openGlobalStatsFromMatch(\'' + escJs(s.mid) + '\');event.stopPropagation();">' + svgStats + ' Infos & Stats</button>';
             controlsHtml += '<button title="Changer de flux" aria-label="Changer de flux" style="' + btnStyle + '" ' + hoverAttr + ' onclick="showFluxSelector(' + idx + ', \'' + escJs(s.mid) + '\', event);event.stopPropagation();">' + svgFlux + ' Changer de flux</button>';
        }
        controlsHtml += '<button title="Changer de match" aria-label="Changer de match" style="' + btnStyle + '" ' + hoverAttr + ' onclick="showMatchSelector(event, ' + idx + ');event.stopPropagation();">' + svgMatch + ' Changer de match</button>';
        controlsHtml += '<button title="Recharger" aria-label="Recharger" style="' + btnStyle + '" ' + hoverAttr + ' onclick="var fr = document.getElementById(\'mv-iframe-' + idx + '\'); if(fr) { var sr = fr.src; fr.src = \'\'; setTimeout(function(){fr.src=sr;}, 100); }; document.getElementById(\'' + ddId + '\').style.display=\'none\'; event.stopPropagation();">' + svgReload + ' Recharger</button>';

        controlsHtml += '</div></div>'; // Close dropdown container

        // Close Button
        controlsHtml += '<button title="Fermer" aria-label="Fermer" style="background:rgba(220,53,69,0.5);color:#fff;border:none;border-radius:4px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(220,53,69,0.8)\'" onmouseout="this.style.background=\'rgba(220,53,69,0.5)\'" onclick="removeFromMultivision(' + idx + ')">' + svgClose + '</button>';

        controlsHtml += '</div>';

        hdr.innerHTML = hdrHtml + controlsHtml;

        // Update URL/Src if changed (for existing cells)
        if (s._currentUrl !== s.url) {
            var videoContainer = cell.querySelector('.mv-video-container');
            if (videoContainer) {
                if (typeof fallbackToIframe === 'function') fallbackToIframe(s.url, videoContainer, cell, s);
                s._currentUrl = s.url;
            }
        } else {
            // Update crop transform
            var media = cell.querySelector('.mv-media');
            if (media) {
                media.id = 'mv-iframe-' + idx;
                if (s.cropped) {
                    media.style.transform = 'scale(1.15)';
                } else {
                    media.style.transform = 'scale(1)';
                }
            }
        }
    });

    // Remove cells that are no longer in mvFlux
    existingCells.forEach(function(cell) {
        var cellId = cell.getAttribute('data-internal-id');
        if (!mvFlux.find(function(s) { return s._internalId === cellId; })) {
            cell.remove();
        }
    });

    if (activeMvIdx === null || activeMvIdx >= mvFlux.length) {
        activeMvIdx = mvFlux.length > 0 ? mvFlux.length - 1 : null;
    }

    applyMvFocusStyling();
    applyMvAudioState();
}

function addToMultivision(url, name, mid) {
    mid = getOriginalMatchId(mid);
    if(mvFlux.length >= 4) {
        showToast('Maximum 4 streams en Multivision.');
        return;
    }
    mvFlux.push({url: url, name: name, mid: mid, cropped: false}); saveMultivisionState(); updateMultivisionLayout();

    // Auto-open multiview if it's the first flux added
    var mvc = document.getElementById('mv-container');
    if(mvc && mvc.style.display === 'none') {
        toggleMultiview();
    }
    showToast('Ajouté au Multivision: ' + name);
}

function removeFromMultivision(idx) {
    mvFlux.splice(idx, 1); saveMultivisionState(); updateMultivisionLayout();
    // Do not auto-close multiview when empty, keep the empty state visible
}

function clearMultivision() {
    mvFlux = []; saveMultivisionState(); updateMultivisionLayout();
    // Do not auto-close multiview when clearing all
}

function hideMultivision() {
    var mvc = document.getElementById('mv-container');
    var epg = document.getElementById('epg');
    if(!mvc || !epg) return;

    mvc.style.display = 'none';
    epg.style.display = 'flex';
    epg.style.paddingRight = '0';
    var sf = document.getElementById('sport-filters-container');
    if(sf) sf.style.display = 'flex';
    mvc.classList.remove('mv-pip');

    var mvBtn = document.getElementById('mv-toggle-btn');
    if(mvBtn) {
        mvBtn.classList.remove('active-toggle');
        mvBtn.style = '';
    }
    applyFilter(S.filter); // Re-apply current tab style
}

function toggleMultiview() {
    var mvc = document.getElementById('mv-container');
    var epg = document.getElementById('epg');
    if(!mvc || !epg) return;

    if(mvc.style.display === 'none') {
        // Open Multivision full screen
        mvc.classList.remove('mv-pip');
        mvc.style.cssText = 'position:fixed;top:' + (window.innerWidth <= 768 ? '0' : 'var(--hdr-height, 70px)') + ';left:0;right:0;bottom:' + (window.innerWidth <= 768 ? '60px' : '0') + ';background:transparent;z-index:90;display:flex;flex-direction:column;';
        epg.style.paddingRight = '0';
        mvc.style.display = 'flex';
        epg.style.display = 'none';
        var sf = document.getElementById('sport-filters-container');
        if(sf) sf.style.display = 'none';

        var optionsPage = document.getElementById('options-page');
        if (optionsPage) optionsPage.style.display = 'none';
        var logsPage = document.getElementById('logs-page');
        if (logsPage) logsPage.style.display = 'none';
        var scriptPage = document.getElementById('script-page');
        if (scriptPage) scriptPage.style.display = 'none';

        updateMultivisionLayout();
    } else if (!mvc.classList.contains('mv-pip')) {
        // Full screen -> Switch to PiP
        toggleMultiviewPip();
    } else {
        // PiP -> Return to Full Screen
        toggleMultiviewPip(); // This will remove pip class and restore full view
    }
}

function toggleTheaterMode(elem) {
  elem = elem || document.getElementById('mv-grid-wrapper');
  if (!elem) return;

  if (elem.classList.contains('mv-theater')) {
      elem.classList.remove('mv-theater');
      var closeBtn = document.getElementById('mv-close-theater');
      if(closeBtn) closeBtn.remove();
      // Restore overflow
      document.body.style.overflow = '';
  } else {
      elem.classList.add('mv-theater');
      // Hide body overflow to avoid double scrollbars
      document.body.style.overflow = 'hidden';

      var closeBtn = document.getElementById('mv-close-theater');
      if(!closeBtn) {
          closeBtn = document.createElement('button');
          closeBtn.id = 'mv-close-theater';
          closeBtn.className = 'theater-close-btn';
          closeBtn.innerHTML = '<span class="ic ic-close"></span>';
          closeBtn.title = 'Quitter le mode Cinéma';
          closeBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999999;background:rgba(0,0,0,0.8);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:8px 16px;cursor:pointer;backdrop-filter:blur(5px);font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.5);opacity:1;';
          closeBtn.onclick = function() { toggleTheaterMode(elem); };
          elem.appendChild(closeBtn);
      }
  }
}

function toggleFullscreen(elem) {
  elem = elem || document.documentElement;
  if (!document.fullscreenElement && !document.mozFullScreenElement &&
    !document.webkitFullscreenElement && !document.msFullscreenElement) {

    // Si c'est la grille Multiview qui passe en plein écran, on cache la barre d'outils
    if (elem.id === 'mv-grid' || elem.id === 'mv-grid-wrapper') {
        elem.classList.add('mv-fullscreen');
        var closeFsBtn = document.getElementById('mv-close-fs');
        if(!closeFsBtn) {
            closeFsBtn = document.createElement('button');
            closeFsBtn.id = 'mv-close-fs';
            closeFsBtn.innerHTML = '<span class="ic ic-close" style="margin-right:4px;"></span> Quitter plein écran';
            closeFsBtn.style.cssText = 'position:fixed; top:10px; right:10px; z-index:99999; background:rgba(0,0,0,0.8); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:20px; padding:8px 16px; cursor:pointer; font-weight:bold; backdrop-filter:blur(5px); box-shadow:0 4px 12px rgba(0,0,0,0.5); opacity:0; transition:opacity 0.3s;';
            closeFsBtn.onclick = function() { toggleFullscreen(); };
            elem.appendChild(closeFsBtn);

            // Auto hide
            var fsTimer;
            elem.addEventListener('mousemove', function() {
                if (document.fullscreenElement) {
                    closeFsBtn.style.opacity = '1';
                    clearTimeout(fsTimer);
                    fsTimer = setTimeout(function(){ closeFsBtn.style.opacity = '0'; }, 3000);
                }
            });
        }
    }

    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    // Restaurer le state si on quitte le plein écran de la grille
    var grid = document.getElementById('mv-grid-wrapper');
    if (!grid) grid = document.getElementById('mv-grid'); // Fallback

    if (grid && grid.classList.contains('mv-fullscreen')) {
        grid.classList.remove('mv-fullscreen');
        var closeFsBtn = document.getElementById('mv-close-fs');
        if(closeFsBtn) closeFsBtn.remove();
    }

    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

// Ensure the button disappears if we exit fullscreen via ESC key
document.addEventListener("fullscreenchange", function() {
    if (!document.fullscreenElement) {
        var grid = document.getElementById('mv-grid');
        if (grid && grid.classList.contains('mv-fullscreen')) {
            grid.classList.remove('mv-fullscreen');
            var closeFsBtn = document.getElementById('mv-close-fs');
            if(closeFsBtn) closeFsBtn.remove();
        }
    }
});

/* ══ SETTINGS & PERSONALIZATION ═════════ */
var userPrefs = {
  theme: 'custom',
  bgStyle: 'gradient',
  iconPack: 'standard',
  c1: '#000000',
  c2: '#111111',
  c3: '#222222',
  accent: '#0a84ff',
  cardColor: 'gradient-45',
  btnShape: 'rounded',
  cardOpacity: '15'
};

try {
  var storedPrefs = localStorage.getItem('user_prefs');
  if(storedPrefs) userPrefs = Object.assign(userPrefs, JSON.parse(storedPrefs));
} catch(e) {}


/* ══ OPEN FLUX (MULTIVISION) ═══════════ */
function openFlux(e, eu, en, mid){
  mid = getOriginalMatchId(mid);
  if(e) e.preventDefault();
  var url=decodeURIComponent(eu), name=decodeURIComponent(en);

  var m = S.matches.find(function(x) { return String(x.id) === String(mid); });
  var matchName = m ? (m.homeTeam + ' vs ' + m.awayTeam) : name;

  if (window.multiviewPendingAction) {
      var action = window.multiviewPendingAction;
      window.multiviewPendingAction = null;

      if(action.type === 'replace' && action.replaceIdx !== undefined) {
          mvFlux[action.replaceIdx].url = url;
          mvFlux[action.replaceIdx].name = matchName;
          mvFlux[action.replaceIdx].mid = mid;
          saveMultivisionState(); updateMultivisionLayout();
      } else {
          addToMultivision(url, matchName, mid);
      }
      closeMod();
      return;
  }

  // Close modal if open
  var mbg = document.getElementById('mbg');
  if(mbg) mbg.classList.remove('open');

  addToMultivision(url, matchName, mid);
}

function applyBgStyle() {
  var s = userPrefs.bgStyle || 'gradient';

  // Theme styling
  if(userPrefs.theme === 'metallic') {
      document.body.classList.add('theme-metallic');
  } else {
      document.body.classList.remove('theme-metallic');
  }

  // Icon Pack
  document.body.setAttribute('data-icon-pack', userPrefs.iconPack || 'standard');

  var c1 = userPrefs.c1 || '#000000';
  var c2 = userPrefs.c2 || '#111111';
  var c3 = userPrefs.c3 || '#222222';
  var blurVal = userPrefs.bgBlur || 0;
  var darkenVal = userPrefs.bgDarken || 0;

  document.documentElement.style.setProperty('--bg', c1);

  // Use a dedicated background container
  var appBg = document.getElementById('app-bg-container');
  if(!appBg) {
      appBg = document.createElement('div');
      appBg.id = 'app-bg-container';
      appBg.style.position = 'fixed';
      appBg.style.top = '0';
      appBg.style.left = '0';
      appBg.style.width = '100vw';
      appBg.style.height = '100vh';
      appBg.style.zIndex = '-3';
      appBg.style.pointerEvents = 'none';
      document.body.appendChild(appBg);
  }

  // Clear body background styles to avoid interference
  document.body.style.background = 'transparent';
  document.body.style.backgroundColor = 'transparent';

  appBg.style.backgroundColor = '';
  appBg.style.backgroundBlendMode = '';

  // Handle Blur and Darken via a dynamic pseudo-element or overlay
  var bgModifier = document.getElementById('bg-modifier-overlay');
  if(!bgModifier) {
      bgModifier = document.createElement('div');
      bgModifier.id = 'bg-modifier-overlay';
      bgModifier.style.position = 'fixed';
      bgModifier.style.top = '0';
      bgModifier.style.left = '0';
      bgModifier.style.width = '100vw';
      bgModifier.style.height = '100vh';
      bgModifier.style.pointerEvents = 'none';
      bgModifier.style.zIndex = '-1'; // just above the app-bg-container and behind content
      document.body.appendChild(bgModifier);
  }

  bgModifier.style.backdropFilter = blurVal > 0 ? 'blur(' + (blurVal / 5) + 'px)' : 'none';
  bgModifier.style.webkitBackdropFilter = blurVal > 0 ? 'blur(' + (blurVal / 5) + 'px)' : 'none';
  bgModifier.style.backgroundColor = darkenVal > 0 ? 'rgba(0, 0, 0, ' + (darkenVal / 100) + ')' : 'transparent';

  if (s === 'solid') {
    appBg.style.background = c1;
  } else if (s === 'gradient') {
    appBg.style.background = 'radial-gradient(circle at top right, ' + c2 + ' 0%, ' + c1 + ' 60%, ' + c3 + ' 100%)';
  } else if (s === 'grid') {
    appBg.style.backgroundColor = c1;
    appBg.style.backgroundImage = 'radial-gradient(' + c2 + ' 1px, transparent 1px)';
    appBg.style.backgroundSize = '24px 24px';
    appBg.style.backgroundPosition = '0 0';
  } else if (s === 'mesh_flou_1') {
    appBg.style.background = 'radial-gradient(at 20% 20%, '+c1+' 0, transparent 40%), radial-gradient(at 80% 10%, '+c2+' 0, transparent 40%), radial-gradient(at 90% 80%, '+c3+' 0, transparent 50%), radial-gradient(at 10% 90%, '+c1+' 0, transparent 40%)';
    appBg.style.backgroundColor = '#000';
  } else if (s === 'mesh_random') {
    var p1x = Math.floor(Math.random() * 100); var p1y = Math.floor(Math.random() * 100);
    var p2x = Math.floor(Math.random() * 100); var p2y = Math.floor(Math.random() * 100);
    var p3x = Math.floor(Math.random() * 100); var p3y = Math.floor(Math.random() * 100);
    var p4x = Math.floor(Math.random() * 100); var p4y = Math.floor(Math.random() * 100);
    appBg.style.background = 'radial-gradient(at '+p1x+'% '+p1y+'%, '+c1+' 0, transparent 50%), radial-gradient(at '+p2x+'% '+p2y+'%, '+c2+' 0, transparent 50%), radial-gradient(at '+p3x+'% '+p3y+'%, '+c3+' 0, transparent 50%), radial-gradient(at '+p4x+'% '+p4y+'%, '+c1+' 0, transparent 50%)';
    appBg.style.backgroundColor = '#000';
  } else if (s === 'mesh_diagonal') {
    appBg.style.background = 'radial-gradient(at 0% 0%, '+c1+' 0, transparent 60%), radial-gradient(at 50% 50%, '+c2+' 0, transparent 60%), radial-gradient(at 100% 100%, '+c3+' 0, transparent 60%), radial-gradient(at 100% 0%, '+c2+' 0, transparent 50%)';
    appBg.style.backgroundColor = '#000';
  } else if (s === 'mesh_center') {
    appBg.style.background = 'radial-gradient(at 50% 50%, '+c1+' 0, transparent 40%), radial-gradient(at 30% 70%, '+c2+' 0, transparent 50%), radial-gradient(at 70% 30%, '+c3+' 0, transparent 50%), radial-gradient(at 10% 10%, '+c1+' 0, transparent 20%)';
    appBg.style.backgroundColor = '#000';
  } else if (s === 'mesh_corner') {
    appBg.style.background = 'radial-gradient(at 0% 0%, '+c1+' 0, transparent 30%), radial-gradient(at 100% 0%, '+c2+' 0, transparent 30%), radial-gradient(at 100% 100%, '+c3+' 0, transparent 30%), radial-gradient(at 0% 100%, '+c1+' 0, transparent 30%)';
    appBg.style.backgroundColor = '#000';
  } else if (s === 'glow') {
    appBg.style.background = 'radial-gradient(circle at top left, '+c2+' 0%, transparent 40%), radial-gradient(circle at bottom right, '+c3+' 0%, transparent 40%), '+c1;
  } else if (s === 'aurora') {
    appBg.style.background = 'linear-gradient(to bottom, '+c1+', '+c1+'), radial-gradient(ellipse at top left, '+c2+' 0%, transparent 50%), radial-gradient(ellipse at top right, '+c3+' 0%, transparent 50%), radial-gradient(ellipse at bottom center, '+c2+' 0%, transparent 50%)';
    appBg.style.backgroundBlendMode = 'screen, screen, screen, normal';
    appBg.style.backgroundColor = c1;
  } else {
    appBg.style.background = c1 + ' radial-gradient(circle at 50% -20%, rgba(255,255,255,0.05) 0%, transparent 70%)';
  }
}

function initPrefs() {
  var saved = localStorage.getItem('user_prefs');
  if(saved) {
    try { Object.assign(userPrefs, JSON.parse(saved)); } catch(e){}
  }

  if(document.getElementById('pref-bg-blur')) document.getElementById('pref-bg-blur').value = userPrefs.bgBlur || 0;
  if(document.getElementById('pref-bg-darken')) document.getElementById('pref-bg-darken').value = userPrefs.bgDarken || 0;

  applyBgStyle();

  // Accent Color
  var accent = userPrefs.accent || '#0a84ff';
  document.documentElement.style.setProperty('--accent', accent);


  // Special UI Effects overlay
  var effectOverlay = document.getElementById('ui-effect-overlay');
  if(!effectOverlay) {
      effectOverlay = document.createElement('div');
      effectOverlay.id = 'ui-effect-overlay';
      effectOverlay.style.position = 'fixed';
      effectOverlay.style.top = '0';
      effectOverlay.style.left = '0';
      effectOverlay.style.width = '100vw';
      effectOverlay.style.height = '100vh';
      effectOverlay.style.pointerEvents = 'none';
      effectOverlay.style.zIndex = '9999';
      document.body.appendChild(effectOverlay);
  }

  effectOverlay.style.background = 'none';
  effectOverlay.style.backdropFilter = 'none';
  effectOverlay.style.boxShadow = 'none';
  effectOverlay.style.animation = 'none';
  effectOverlay.innerHTML = '';
  document.body.classList.remove('neon-glow-effect', 'glassmorphism-effect');

  var effects = userPrefs.uiEffects || [];
  // Migrate old setting if needed
  if (userPrefs.uiEffect && userPrefs.uiEffect !== 'none') {
      if (!effects.includes(userPrefs.uiEffect)) {
          effects.push(userPrefs.uiEffect);
      }
      delete userPrefs.uiEffect;
  }

  var overlayBgs = [];

  if (effects.includes('glassmorphism')) {
      document.body.classList.add('glassmorphism-effect');
      overlayBgs.push('url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.05\'/%3E%3C/svg%3E")');
  }
  if (effects.includes('neon_glow')) {
      document.body.classList.add('neon-glow-effect');
  }

  if (overlayBgs.length > 0) {
      effectOverlay.style.background = overlayBgs.join(', ');
  }


  // Btn Shape and Custom Button Styles
  var br = '12px';
  var btnBg = 'rgba(255,255,255,0.05)';
  var btnBorder = '1px solid rgba(255,255,255,0.15)';
  var btnShadow = '0 4px 10px rgba(0,0,0,0.3)';
  var btnBlur = 'blur(12px)';
  var cr = '16px';

  if(userPrefs.btnShape === 'square') { br = '4px'; cr = '8px'; }
  else if(userPrefs.btnShape === 'pill') br = '24px';
  else if(userPrefs.btnShape === 'soft') {
      br = '16px';
      cr = '16px';
      btnBg = 'rgba(255,255,255,0.08)';
      btnBorder = '1px solid rgba(255,255,255,0.05)';
      btnShadow = '0 2px 8px rgba(0,0,0,0.1)';
  }
  else if(userPrefs.btnShape === 'ghost') {
      br = '8px';
      cr = '12px';
      btnBg = 'transparent';
      btnBorder = '1px solid rgba(255,255,255,0.3)';
      btnShadow = 'none';
      btnBlur = 'none';
  }
  else if(userPrefs.btnShape === 'apple') {
      br = '18px';
      cr = '20px';
      btnBg = 'rgba(255,255,255,0.1)';
      btnBorder = '1px solid rgba(255,255,255,0.2)';
      btnBlur = 'blur(20px)';
      btnShadow = '0 8px 24px rgba(0,0,0,0.15)';
  } else if(userPrefs.btnShape === 'windows') {
      br = '4px';
      cr = '8px';
      btnBg = 'rgba(255,255,255,0.05)';
      btnBorder = '1px solid rgba(255,255,255,0.1)';
      btnBlur = 'blur(30px)';
  } else if(userPrefs.btnShape === 'steam') {
      br = '2px';
      cr = '4px';
      btnBg = 'linear-gradient(to bottom, #3a3f44, #272b30)';
      btnBorder = '1px solid #1a1c1f';
      btnShadow = 'inset 0 1px 0 rgba(255,255,255,0.1)';
  }

  document.documentElement.style.setProperty('--radius-btn', br);
  document.documentElement.style.setProperty('--btn-bg', btnBg);
  document.documentElement.style.setProperty('--btn-border', btnBorder);
  document.documentElement.style.setProperty('--btn-shadow', btnShadow);
  document.documentElement.style.setProperty('--btn-blur', btnBlur);
  document.documentElement.style.setProperty('--radius-card', cr);

  document.documentElement.style.setProperty('--card-opacity', (userPrefs.cardOpacity || 15) / 100);

  // Match Card Styles
  var cStyle = userPrefs.cardStyle || 'glass';
  var cardBorder = 'none';
  var cardBgOpac = (userPrefs.cardOpacity || 15) / 100;
  var cardShadow = '0 8px 20px rgba(0,0,0,0.5)';

  if (cStyle === 'solid') {
      cardBgOpac = Math.max(cardBgOpac, 0.8); // Ensure it's mostly solid
      document.documentElement.style.setProperty('--card-opacity', cardBgOpac);
      cardShadow = '0 4px 12px rgba(0,0,0,0.3)';
  } else if (cStyle === 'bordered') {
      cardBorder = '1px solid rgba(255,255,255,0.1)';
      cardShadow = 'none';
      document.documentElement.style.setProperty('--card-opacity', Math.min(cardBgOpac, 0.1)); // Very light bg
  } else if (cStyle === 'elevated') {
      cardBorder = '1px solid rgba(255,255,255,0.05)';
      cardShadow = '0 10px 30px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.1)';
  }

  document.documentElement.style.setProperty('--card-border', cardBorder);
  document.documentElement.style.setProperty('--card-shadow', cardShadow);


  // Nav Layout Styles
  // Removed dynamic JS nav layout injection to rely on CSS media queries for responsiveness.

  // Toggle Button Styles
  var tStyle = userPrefs.toggleStyle || 'default';
  var tGlow = 'none';
  var tBg = 'rgba(255,255,255,0.2)';
  var tBorder = '1px solid var(--accent)';

  if (tStyle === 'solid') {
      tBg = 'var(--accent)';
      tBorder = '1px solid var(--accent)';
      tGlow = '0 4px 12px rgba(0,0,0,0.5)';
  } else if (tStyle === 'underlined') {
      tBg = 'rgba(255,255,255,0.05)';
      tBorder = 'none';
      tGlow = 'inset 0 -3px 0 var(--accent)';
  } else if (tStyle === 'dot') {
      tBg = 'transparent';
      tBorder = 'none';
      tGlow = 'inset 0 -4px 0 -2px var(--accent)'; // Simulate a dot using inset shadow trick or just a subtle bottom border
  }

  document.documentElement.style.setProperty('--toggle-glow', tGlow);
  document.documentElement.style.setProperty('--toggle-bg-active', tBg);
  document.documentElement.style.setProperty('--toggle-border-active', tBorder);

  // Hover Effects
  var hoverStyle = userPrefs.hoverStyle || 'default';
  var hTransform = 'translateY(-1px)';
  var hShadow = 'none';
  var hBrightness = 'brightness(1.1)';

  if (hoverStyle === 'float') {
      hTransform = 'translateY(-3px)';
      hShadow = '0 10px 20px rgba(0,0,0,0.6)';
  } else if (hoverStyle === 'glow') {
      hShadow = '0 0 15px var(--accent)';
      hBrightness = 'brightness(1.3)';
  } else if (hoverStyle === 'scale') {
      hTransform = 'scale(1.05)';
      hShadow = '0 5px 15px rgba(0,0,0,0.4)';
  } else if (hoverStyle === 'none') {
      hTransform = 'none';
      hBrightness = 'none';
  }

  document.documentElement.style.setProperty('--btn-hover-transform', hTransform);
  document.documentElement.style.setProperty('--btn-hover-shadow', hShadow);
  document.documentElement.style.setProperty('--btn-hover-brightness', hBrightness);

  // Header Style
  var hStyle = userPrefs.hdrStyle || 'transparent';
  var hBg = 'transparent';
  var hBlur = 'blur(0px)';
  var hShadow = 'none';
  var hBorder = 'none';

  if (hStyle === 'glass') {
      hBg = 'rgba(10, 10, 12, 0.65)';
      hBlur = 'blur(20px)';
      hBorder = '1px solid rgba(255,255,255,0.05)';
  } else if (hStyle === 'solid') {
      hBg = 'var(--bg)';
      hBorder = '1px solid var(--border)';
  } else if (hStyle === 'floating') {
      hBg = 'rgba(20,20,22,0.85)';
      hBlur = 'blur(15px)';
      hShadow = '0 10px 30px rgba(0,0,0,0.8)';
      hBorder = '1px solid rgba(255,255,255,0.1)';
  }

  document.documentElement.style.setProperty('--hdr-bg', hBg);
  document.documentElement.style.setProperty('--hdr-blur', hBlur);
  document.documentElement.style.setProperty('--hdr-shadow', hShadow);
  document.documentElement.style.setProperty('--hdr-border', hBorder);


  // Update DOM selectors
  var selTheme = document.getElementById('pref-theme');
  var selBgStyle = document.getElementById('pref-bg-style');
  var selC1 = document.getElementById('pref-c1');
  var selC2 = document.getElementById('pref-c2');
  var selC3 = document.getElementById('pref-c3');
  var selCard = document.getElementById('pref-card-color');
  var selCardStyle = document.getElementById('pref-card-style');
  var selBtn = document.getElementById('pref-btn-shape');
  var selAccentColor = document.getElementById('pref-accent-color');
  var selOpacity = document.getElementById('pref-card-opacity');

  if(selTheme) selTheme.value = userPrefs.theme || 'custom';
  if(selBgStyle) selBgStyle.value = userPrefs.bgStyle || 'gradient';
  if(selC1) {
      selC1.value = userPrefs.c1 || '#000000';
      var hexC1 = document.getElementById('hex-c1');
      if(hexC1) hexC1.textContent = selC1.value;
  }
  if(selC2) {
      selC2.value = userPrefs.c2 || '#111111';
      var hexC2 = document.getElementById('hex-c2');
      if(hexC2) hexC2.textContent = selC2.value;
  }
  if(selC3) {
      selC3.value = userPrefs.c3 || '#222222';
      var hexC3 = document.getElementById('hex-c3');
      if(hexC3) hexC3.textContent = selC3.value;
  }
  if(selCard) selCard.value = userPrefs.cardColor || 'gradient-45';
  if(selCardStyle) selCardStyle.value = userPrefs.cardStyle || 'glass';
  if(selBtn) selBtn.value = userPrefs.btnShape || 'rounded';
  if(selAccentColor) {
      selAccentColor.value = userPrefs.accent || '#0a84ff';
      var hexAccent = document.getElementById('hex-accent-color');
      if(hexAccent) hexAccent.textContent = selAccentColor.value;
  }
  if(selOpacity) selOpacity.value = userPrefs.cardOpacity || 15;
  var selHover = document.getElementById('pref-hover-style');
  if(selHover) selHover.value = userPrefs.hoverStyle || 'default';
  var selToggle = document.getElementById('pref-toggle-style');
  if(selToggle) selToggle.value = userPrefs.toggleStyle || 'default';
  var selHdr = document.getElementById('pref-hdr-style');
  if(selHdr) selHdr.value = userPrefs.hdrStyle || 'transparent';

  var effectsContainer = document.getElementById('pref-ui-effects-container');
  if(effectsContainer) {
      var checkboxes = effectsContainer.querySelectorAll('input[type="checkbox"]');
      var effects = userPrefs.uiEffects || [];
      // migrate if needed
      if (userPrefs.uiEffect && userPrefs.uiEffect !== 'none') {
          if (!effects.includes(userPrefs.uiEffect)) {
              effects.push(userPrefs.uiEffect);
          }
      }
      checkboxes.forEach(cb => {
          cb.checked = effects.includes(cb.value);
      });

      var glassCb = document.getElementById('pref-glassmorphism');
      if (glassCb) {
          glassCb.checked = effects.includes('glassmorphism');
      }
  }
}

function applyUserPrefs() {
  var themeSel = document.getElementById('pref-theme');
  var bgStyleSel = document.getElementById('pref-bg-style');
  var c1Sel = document.getElementById('pref-c1');
  var c2Sel = document.getElementById('pref-c2');
  var c3Sel = document.getElementById('pref-c3');
  var cardSel = document.getElementById('pref-card-color');
  var cardStyleSel = document.getElementById('pref-card-style');
  var btnSel = document.getElementById('pref-btn-shape');
  var accentColorSel = document.getElementById('pref-accent-color');
  var opacSel = document.getElementById('pref-card-opacity');
  var effectsContainer = document.getElementById('pref-ui-effects-container');

  if(themeSel) userPrefs.theme = themeSel.value;
  if(bgStyleSel) userPrefs.bgStyle = bgStyleSel.value;
  if(c1Sel) userPrefs.c1 = c1Sel.value;
  if(c2Sel) userPrefs.c2 = c2Sel.value;
  if(c3Sel) userPrefs.c3 = c3Sel.value;
  userPrefs.cardColor = 'gradient-45';
  userPrefs.cardStyle = 'glass';
  if(btnSel) userPrefs.btnShape = btnSel.value;
  if(accentColorSel) userPrefs.accent = accentColorSel.value;
  var hoverSel = document.getElementById('pref-hover-style');
  if(hoverSel) userPrefs.hoverStyle = hoverSel.value;
  var toggleSel = document.getElementById('pref-toggle-style');
  if(toggleSel) userPrefs.toggleStyle = toggleSel.value;
  var hdrSel = document.getElementById('pref-hdr-style');
  if(hdrSel) userPrefs.hdrStyle = hdrSel.value;
  userPrefs.cardOpacity = '15';

  var blurSel = document.getElementById('pref-bg-blur');
  if(blurSel) userPrefs.bgBlur = blurSel.value;
  var darkenSel = document.getElementById('pref-bg-darken');
  if(darkenSel) userPrefs.bgDarken = darkenSel.value;

  if(effectsContainer) {
      var checkboxes = effectsContainer.querySelectorAll('input[type="checkbox"]');
      var activeEffects = [];
      checkboxes.forEach(cb => {
          if(cb.checked) activeEffects.push(cb.value);
      });

      var glassCb = document.getElementById('pref-glassmorphism');
      if (glassCb && glassCb.checked) {
          activeEffects.push('glassmorphism');
      }

      userPrefs.uiEffects = activeEffects;
  }

  localStorage.setItem('user_prefs', JSON.stringify(userPrefs));
  initPrefs();
  setTimeout(function() { buildEPG(S.matches); }, 0); // Rebuild to apply card colors
  showToast('Préférences sauvegardées');
}

function markCustomTheme() {
  var themeSel = document.getElementById('pref-theme');
  if(themeSel) themeSel.value = 'custom';
  // when a user changes a color manually, we set theme to custom, and then save
  applyUserPrefs();
}

function applyUserBgStyleOnly() {
  var themeSel = document.getElementById('pref-theme');
  if(themeSel) themeSel.value = 'custom'; // mark custom so it doesn't revert to preset
  applyUserPrefs();
}

function applyPredefinedTheme() {
  var themeSel = document.getElementById('pref-theme');
  if(!themeSel) return;
  var theme = themeSel.value;
  if(theme === 'custom') return;

  var presets = {
    // Épuré & Minimaliste
        'midnight': { bgStyle: 'solid', c1: '#0a0a0c', c2: '#121214', c3: '#18181a', accent: '#38bdf8', btnShape: 'soft' },
    'slate': { bgStyle: 'gradient', c1: '#1e293b', c2: '#334155', c3: '#475569', accent: '#cbd5e1', btnShape: 'rounded' },
    'minimal_light': { bgStyle: 'solid', c1: '#f8fafc', c2: '#f1f5f9', c3: '#e2e8f0', accent: '#0f172a', btnShape: 'rounded' }
  };

  if(presets[theme]) {
    userPrefs.bgStyle = presets[theme].bgStyle;
    userPrefs.c1 = presets[theme].c1;
    userPrefs.c2 = presets[theme].c2;
    userPrefs.c3 = presets[theme].c3;
    userPrefs.accent = presets[theme].accent;
    if(presets[theme].btnShape) userPrefs.btnShape = presets[theme].btnShape;
    if(presets[theme].iconPack) userPrefs.iconPack = presets[theme].iconPack;
    if(presets[theme].toggleStyle) userPrefs.toggleStyle = presets[theme].toggleStyle;
    if(presets[theme].hdrStyle) userPrefs.hdrStyle = presets[theme].hdrStyle;

    if(presets[theme].uiEffects !== undefined) {
        userPrefs.uiEffects = presets[theme].uiEffects;
    } else {
        userPrefs.uiEffects = [];
    }
    userPrefs.theme = theme;

    // Reset blur and darken when applying predefined theme
    userPrefs.bgBlur = 0;
    userPrefs.bgDarken = 0;

    // Update inputs
    if(document.getElementById('pref-bg-blur')) document.getElementById('pref-bg-blur').value = userPrefs.bgBlur || 0;
    if(document.getElementById('pref-bg-darken')) document.getElementById('pref-bg-darken').value = userPrefs.bgDarken || 0;
    document.getElementById('pref-bg-style').value = userPrefs.bgStyle;
    document.getElementById('pref-c1').value = userPrefs.c1;
    document.getElementById('pref-c2').value = userPrefs.c2;
    document.getElementById('pref-c3').value = userPrefs.c3;
    document.getElementById('pref-accent-color').value = userPrefs.accent;

    var hexC1 = document.getElementById('hex-c1');
    if(hexC1) hexC1.textContent = userPrefs.c1;
    var hexC2 = document.getElementById('hex-c2');
    if(hexC2) hexC2.textContent = userPrefs.c2;
    var hexC3 = document.getElementById('hex-c3');
    if(hexC3) hexC3.textContent = userPrefs.c3;
    var hexAccent = document.getElementById('hex-accent-color');
    if(hexAccent) hexAccent.textContent = userPrefs.accent;
    if(document.getElementById('pref-icon-pack') && presets[theme].iconPack) {
      document.getElementById('pref-icon-pack').value = presets[theme].iconPack;
    }
    if(document.getElementById('pref-btn-shape') && presets[theme].btnShape) {
      document.getElementById('pref-btn-shape').value = presets[theme].btnShape;
    }
    if(document.getElementById('pref-toggle-style') && presets[theme].toggleStyle) {
      document.getElementById('pref-toggle-style').value = presets[theme].toggleStyle;
    }
    if(document.getElementById('pref-hdr-style') && presets[theme].hdrStyle) {
      document.getElementById('pref-hdr-style').value = presets[theme].hdrStyle;
    }

    var effectsContainer = document.getElementById('pref-ui-effects-container');
    if(effectsContainer) {
        var checkboxes = effectsContainer.querySelectorAll('input[type="checkbox"]');
        var effects = userPrefs.uiEffects || [];
        checkboxes.forEach(cb => {
            cb.checked = effects.includes(cb.value);
        });

        var glassCb = document.getElementById('pref-glassmorphism');
        if (glassCb) {
            glassCb.checked = effects.includes('glassmorphism');
        }
    }

    applyUserPrefs();
  }
}


const PALETTES = [
    // Épuré & Dashboards (Tailwind/Vercel/GitHub inspired)
    { id: 'midnight', name: 'Minuit', c1: '#0f172a', c2: '#1e293b', c3: '#334155', accent: '#38bdf8' },
    { id: 'vercel', name: 'Vercel', c1: '#000000', c2: '#111111', c3: '#333333', accent: '#ffffff' },
    { id: 'github_dark', name: 'Code Sombre', c1: '#0d1117', c2: '#161b22', c3: '#21262d', accent: '#58a6ff' },
    { id: 'minimal_light', name: 'Minimal Clair', c1: '#f8fafc', c2: '#f1f5f9', c3: '#e2e8f0', accent: '#0f172a' },
    { id: 'slate', name: 'Ardoise', c1: '#1e293b', c2: '#334155', c3: '#475569', accent: '#cbd5e1' },
    { id: 'zinc', name: 'Zinc', c1: '#18181b', c2: '#27272a', c3: '#3f3f46', accent: '#f4f4f5' },

    // Steam & Tech (Material / Interfaces)
    { id: 'steam', name: 'Steam', c1: '#171a21', c2: '#1b2838', c3: '#2a475e', accent: '#66c0f4' },
    { id: 'macos_dark', name: 'macOS Sombre', c1: '#1c1c1e', c2: '#2c2c2e', c3: '#3a3a3c', accent: '#0a84ff' },
    { id: 'win_fluent', name: 'Windows 11', c1: '#202020', c2: '#282828', c3: '#333333', accent: '#60cdff' },

    // Nature & Éléments (Couleurs douces, Material HIG)
    { id: 'ocean', name: 'Océan', c1: '#0c4a6e', c2: '#075985', c3: '#0369a1', accent: '#38bdf8' },
    { id: 'forest', name: 'Forêt', c1: '#064e3b', c2: '#065f46', c3: '#047857', accent: '#34d399' },
    { id: 'nordic', name: 'Nordique', c1: '#2e3440', c2: '#3b4252', c3: '#434c5e', accent: '#88c0d0' },
    { id: 'sand', name: 'Sable', c1: '#451a03', c2: '#78350f', c3: '#92400e', accent: '#fbbf24' },

    // Vibrants maîtrisés (Accents forts sur fond très sombre)
    { id: 'cyberpunk', name: 'Cyberpunk', c1: '#09090b', c2: '#18181b', c3: '#27272a', accent: '#e11d48' },
    { id: 'aurora', name: 'Aurore', c1: '#022c22', c2: '#064e3b', c3: '#065f46', accent: '#10b981' },
    { id: 'sunset', name: 'Crépuscule', c1: '#2e1065', c2: '#4c1d95', c3: '#5b21b6', accent: '#f43f5e' },

    // Multi-teintes Vibrantes (Idéal pour les maillages)
    { id: 'synthwave', name: 'Synthwave', c1: '#2e0249', c2: '#570a57', c3: '#a91079', accent: '#f806cc' },
    { id: 'northern_lights', name: 'Aurore Boréale', c1: '#013a20', c2: '#0b8a53', c3: '#18c985', accent: '#a1ffce' },
    { id: 'neon_city', name: 'Ville Néon', c1: '#0a043c', c2: '#03506f', c3: '#bb1010', accent: '#ffe400' },
    { id: 'deep_ocean', name: 'Océan Profond', c1: '#03001c', c2: '#301e67', c3: '#5b8fb9', accent: '#b6eada' },
    { id: 'sunset_vibes', name: 'Coucher de Soleil', c1: '#3f0071', c2: '#fb2576', c3: '#ff6c00', accent: '#f7c04a' },
    { id: 'toxic_glow', name: 'Lueur Toxique', c1: '#111d13', c2: '#2a4d14', c3: '#72b01d', accent: '#e2f7ce' },
    { id: 'galactic', name: 'Galactique', c1: '#1b1a17', c2: '#1f1e2c', c3: '#6a0dad', accent: '#ffd700' },
    { id: 'miami_vice', name: 'Miami Vice', c1: '#120052', c2: '#7f00ff', c3: '#e100ff', accent: '#00f2fe' },
    { id: 'lava_lamp', name: 'Lampe à Lave', c1: '#2b0000', c2: '#800000', c3: '#ff4500', accent: '#ff8c00' },
    { id: 'frozen_berry', name: 'Baie Givrée', c1: '#18122B', c2: '#393053', c3: '#635985', accent: '#d2d0eb' },
    { id: 'neon_nights', name: 'Nuits Néon', c1: '#0b0033', c2: '#3700b3', c3: '#b300ff', accent: '#00e5ff' },
    { id: 'tropical_breeze', name: 'Brise Tropicale', c1: '#004d40', c2: '#00796b', c3: '#009688', accent: '#ffc107' },
    { id: 'desert_dune', name: 'Dune du Désert', c1: '#4a3b32', c2: '#8b5a2b', c3: '#cd853f', accent: '#ffdead' },
    { id: 'candy_pop', name: 'Pop Bonbon', c1: '#4a0e4e', c2: '#81176b', c3: '#b62a83', accent: '#f55c9b' },
    { id: 'emerald_dream', name: 'Rêve Émeraude', c1: '#01200f', c2: '#044a26', c3: '#0b8244', accent: '#50c878' },
    { id: 'royal_amethyst', name: 'Améthyste Royale', c1: '#2a004f', c2: '#4c007d', c3: '#7a00ba', accent: '#c68cff' },
    { id: 'fiery_comet', name: 'Comète Enflammée', c1: '#3d0c02', c2: '#8c1c04', c3: '#d93608', accent: '#ffcc00' },
    { id: 'aqua_marine', name: 'Aqua Marine', c1: '#00293b', c2: '#005470', c3: '#0083a3', accent: '#00e6e6' },
    { id: 'golden_hour', name: 'Heure Dorée', c1: '#4d2b00', c2: '#995a00', c3: '#e68a00', accent: '#ffe066' },
    { id: 'mystic_forest', name: 'Forêt Mystique', c1: '#0c2e1f', c2: '#1b5e3f', c3: '#2d9362', accent: '#9cedb4' }

];

function buildSwatches() {
    var container = document.querySelector('.swatches-container');
    if (!container) return;

    container.innerHTML = '';
    PALETTES.forEach(function(p) {
        var swatch = document.createElement('div');
        swatch.className = 'swatch-item';
        swatch.title = p.name;
        swatch.style.width = '32px';
        swatch.style.height = '32px';
        swatch.style.borderRadius = '50%';
        swatch.style.cursor = 'pointer';
        swatch.style.border = '2px solid ' + p.accent;
        swatch.style.background = 'linear-gradient(135deg, ' + p.c1 + ' 0%, ' + p.c2 + ' 50%, ' + p.c3 + ' 100%)';
        swatch.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
        swatch.style.transition = 'transform 0.2s, box-shadow 0.2s';

        swatch.onmouseenter = function() {
            swatch.style.transform = 'scale(1.15)';
            swatch.style.boxShadow = '0 0 8px ' + p.accent;
        };
        swatch.onmouseleave = function() {
            swatch.style.transform = 'scale(1)';
            swatch.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
        };

        swatch.onclick = function() {
            document.getElementById('pref-c1').value = p.c1;
            document.getElementById('pref-c2').value = p.c2;
            document.getElementById('pref-c3').value = p.c3;
            document.getElementById('pref-accent-color').value = p.accent;

            var hexC1 = document.getElementById('hex-c1');
            if(hexC1) hexC1.textContent = p.c1;
            var hexC2 = document.getElementById('hex-c2');
            if(hexC2) hexC2.textContent = p.c2;
            var hexC3 = document.getElementById('hex-c3');
            if(hexC3) hexC3.textContent = p.c3;
            var hexAccent = document.getElementById('hex-accent-color');
            if(hexAccent) hexAccent.textContent = p.accent;

            markCustomTheme();
        };

        container.appendChild(swatch);
    });
}


function renderSourcesStatus() {
    var container = document.getElementById('sources-status-container');
    if (!container) return;
    if (sourcesStatus.length === 0) {
        container.innerHTML = '<div style="color: var(--muted2); text-align: center;">Aucune donnée (Scraping en attente...)</div>';
        return;
    }

    var html = '';
    sourcesStatus.forEach(function(s) {
        var icon = s.status === 'success' ? '✅' : (s.status === 'warning' ? '⚠️' : '❌');
        var color = s.status === 'success' ? '#34c759' : (s.status === 'warning' ? '#ffcc00' : 'var(--red)');

        html += '<div style="display:flex; justify-content:space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 4px 0;">' +
                  '<div style="display:flex; align-items:center; gap: 8px;">' +
                      '<span style="font-size: 14px;">' + icon + '</span>' +
                      '<span style="font-weight: bold; color: var(--text);">' + s.name + '</span>' +
                  '</div>' +
                  '<div style="display:flex; align-items:center; gap: 10px; font-size: 12px;">' +
                      '<span style="color: ' + color + ';">' + s.message + '</span>' +
                      '<span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: var(--muted);">' + s.matchCount + ' matchs</span>' +
                      '<span style="color: var(--muted2); font-size: 10px; width: 50px; text-align:right;">' + s.time + '</span>' +
                  '</div>' +
                '</div>';
    });
    container.innerHTML = html;
}

function renderScrapeLogs() {
    renderSourcesStatus();
    var container = document.getElementById('scrape-logs-container');
    if(!container) return;
    if(scrapeLogs.length === 0) {
        container.innerHTML = '<div style="color: var(--muted2); text-align: center; padding: 10px;">Aucun log récent.</div>';
        return;
    }
    var html = '';
    scrapeLogs.forEach(function(log) {
        var color = log.status === 'error' ? 'var(--red)' : (log.status === 'success' ? '#34c759' : 'var(--text)');
        var icon = log.status === 'error' ? '❌' : (log.status === 'success' ? '✅' : 'ℹ️');
        html += '<div style="display:flex; flex-direction:column; gap:2px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">' +
                  '<div style="display:flex; justify-content:space-between;">' +
                      '<span style="color:var(--muted);">' + log.time + '</span>' +
                      '<span style="color:' + color + ';">' + icon + ' ' + log.status.toUpperCase() + '</span>' +
                  '</div>' +
                  '<div style="word-break: break-all; color: #a1a1aa;">' + log.url + '</div>' +
                  (log.error ? '<div style="color:var(--red); font-size: 11px;">' + log.error + '</div>' : '') +
                '</div>';
    });
    container.innerHTML = html;
}

function openOptionsPage() {
    var favPage = document.getElementById('fav-page');
    if (favPage) favPage.style.display = 'none';
    var epgContainer = document.getElementById('epg');
    if (epgContainer) epgContainer.style.display = 'none';
    var mareaContainer = document.getElementById('marea');
    if (mareaContainer) mareaContainer.style.display = 'none';
    var sportFiltersContainer = document.getElementById('sport-filters-container');
    if (sportFiltersContainer) sportFiltersContainer.style.display = 'none';

    var logsPage = document.getElementById('logs-page');
    if (logsPage) logsPage.style.display = 'none';
    var scriptPage = document.getElementById('script-page');
    if (scriptPage) scriptPage.style.display = 'none';

    var optionsPage = document.getElementById('options-page');
    if (optionsPage) {
        optionsPage.style.display = 'flex';
        buildSwatches();
        var apiKeyInput = document.getElementById('apiKeyInput');
        if (apiKeyInput) {
            apiKeyInput.value = localStorage.getItem('apiSportsKey') || '';
        }
        initPrefs();
    }
}

function openLogsPage() {
    var favPage = document.getElementById('fav-page');
    if (favPage) favPage.style.display = 'none';
    var epgContainer = document.getElementById('epg');
    if (epgContainer) epgContainer.style.display = 'none';
    var mareaContainer = document.getElementById('marea');
    if (mareaContainer) mareaContainer.style.display = 'none';
    var sportFiltersContainer = document.getElementById('sport-filters-container');
    if (sportFiltersContainer) sportFiltersContainer.style.display = 'none';

    var optionsPage = document.getElementById('options-page');
    if (optionsPage) optionsPage.style.display = 'none';
    var scriptPage = document.getElementById('script-page');
    if (scriptPage) scriptPage.style.display = 'none';

    var logsPage = document.getElementById('logs-page');
    if (logsPage) {
        logsPage.style.display = 'flex';
        renderScrapeLogs();
    }
}

function openScriptPage() {
    var favPage = document.getElementById('fav-page');
    if (favPage) favPage.style.display = 'none';
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
    if (scriptPage) {
        scriptPage.style.display = 'flex';
    }
}

// Kept for backward compatibility if called elsewhere, though shouldn't be needed
function openOptions() { openOptionsPage(); }
function closeOptions() { /* no-op now */ }
function openLogs() { openLogsPage(); }
function closeLogs() { /* no-op now */ }

function saveApiKey() {
  var key = document.getElementById('apiKeyInput').value.trim();
  if (key) {
    localStorage.setItem('apiSportsKey', key);
    showToast('Clé API sauvegardée');
  } else {
    localStorage.removeItem('apiSportsKey');
    showToast('Clé API supprimée');
  }
  loadAll(false); // Reload to fetch api-sports
}

initPrefs(); // Run once on load


function installTampermonkey() {
    var existing = document.getElementById('tm-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'tm-modal';
    modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);z-index:9999;background:rgba(20,20,20,0.95);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:20px;backdrop-filter:blur(15px);display:flex;flex-direction:column;gap:16px;max-height:80vh;overflow-y:auto;box-shadow:0 15px 40px rgba(0,0,0,0.8);width:90%;max-width:500px;-webkit-overflow-scrolling:touch;color:#fff;';

    var closeBtn = document.createElement('div');
    closeBtn.innerHTML = '<span class="ic ic-close"></span>';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border-radius:50%;cursor:pointer;color:#fff;font-size:14px;';
    closeBtn.onclick = function() { modal.remove(); };
    modal.appendChild(closeBtn);

    var title = document.createElement('h2');
    title.style.cssText = 'margin:0;font-size:18px;font-weight:bold;display:flex;align-items:center;gap:8px;';
    title.innerHTML = '🧩 Installation des Scripts';
    modal.appendChild(title);

    var contentDiv = document.createElement('div');
    contentDiv.style.cssText = 'font-size:14px;line-height:1.5;color:#ddd;display:flex;flex-direction:column;gap:12px;';

    contentDiv.innerHTML = `
        <p>Pour profiter pleinement du Multivision sans publicités et avec le lecteur vidéo isolé, vous devez installer notre script utilisateur.</p>

        <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1); margin-bottom: 8px;">
            <strong style="color:var(--accent);">🦊 Recommandation : Firefox + uBlock Origin</strong>
            <p style="margin-top:4px;font-size:13px;">Nous recommandons fortement d'utiliser Firefox. Bien que le script fonctionne sur Chrome, le bloqueur de publicités uBlock Origin y est beaucoup moins efficace en raison des récentes restrictions de Manifest V3 par Google.</p>
        </div>

        <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
            <strong style="color:#4285F4;">🌍 Navigateurs Chrome / Chromium (Edge, Brave, Opera)</strong>
            <p style="margin-top:4px;font-size:13px;">Vous pouvez également utiliser le script sur les navigateurs basés sur Chromium. Assurez-vous d'installer les extensions appropriées depuis le Chrome Web Store.</p>
        </div>

        <ol style="padding-left:20px;margin:0;display:flex;flex-direction:column;gap:8px; margin-top: 8px;">
            <li>Installez l'extension <strong>Tampermonkey</strong> sur votre navigateur :
                <a href="https://addons.mozilla.org/fr/firefox/addon/tampermonkey/" target="_blank" style="color:var(--accent);">Firefox</a> |
                <a href="https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo" target="_blank" style="color:#4285F4;">Chrome</a>
            </li>
            <li>Installez l'extension <strong>uBlock Origin</strong> :
                <a href="https://addons.mozilla.org/fr/firefox/addon/ublock-origin/" target="_blank" style="color:var(--accent);">Firefox</a> |
                <a href="https://chrome.google.com/webstore/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm" target="_blank" style="color:#4285F4;">Chrome</a>
            </li>
            <li>Cliquez sur le bouton ci-dessous pour installer le script de nettoyage Multivision.</li>
        </ol>
    `;
    modal.appendChild(contentDiv);

    var btn = document.createElement('button');
    btn.className = 'btn g';
    btn.style.cssText = 'padding:12px;font-size:16px;font-weight:bold;justify-content:center;margin-top:8px;';
    btn.innerHTML = 'Installer le Script Multivision';
    btn.onclick = function() {
        window.location.href = './multiview-cleaner.user.js';
    };
    modal.appendChild(btn);

    document.body.appendChild(modal);

    setTimeout(function() {
        var closeListener = function(e) {
            if (!modal.contains(e.target)) {
                modal.remove();
                document.removeEventListener('click', closeListener);
            }
        };
        document.addEventListener('click', closeListener);
    }, 10);
}


/* ══ TOAST ══════════════════════════════ */

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { addToMultivision, hideMultivision, clearMultivision, toggleMultiviewPip, moveMultiviewStream, toggleMultiview };
}

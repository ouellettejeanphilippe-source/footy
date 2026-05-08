function renderFavPage() {
    // Render leagues
    var leaguesContainer = document.getElementById('fav-leagues-list');
    if (leaguesContainer) {
        var lgHtml = '';
        var displayOrder = customLgOrder.length > 0 ? customLgOrder : Object.keys(DEFAULT_LEAGUES);

        // Ensure all mainLeagues are in the list
        var allLgs = Object.keys(DEFAULT_LEAGUES);
        allLgs.forEach(function(l) {
            if (displayOrder.indexOf(l) === -1) displayOrder.push(l);
        });

        displayOrder.forEach(function(lgKey, idx) {
            var lgIcon = getLeagueIcon(lgKey);
            var isFirst = idx === 0;
            var isLast = idx === displayOrder.length - 1;

            lgHtml += '<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">'
                   + '<div style="display:flex; align-items:center; gap:8px;">'
                   + '<span style="font-size:16px;">' + lgIcon + '</span>'
                   + '<span style="font-size:14px; font-weight:bold;">' + esc(lgKey) + '</span>'
                   + '</div>'
                   + '<div style="display:flex; gap:4px;">'
                   + '<button class="btn o" style="padding:4px; font-size:12px; opacity:' + (isFirst ? '0.3' : '1') + ';" onclick="moveLeagueOrder(\'' + escJs(lgKey) + '\', -1)" ' + (isFirst ? 'disabled' : '') + '>▲</button>'
                   + '<button class="btn o" style="padding:4px; font-size:12px; opacity:' + (isLast ? '0.3' : '1') + ';" onclick="moveLeagueOrder(\'' + escJs(lgKey) + '\', 1)" ' + (isLast ? 'disabled' : '') + '>▼</button>'
                   + '</div>'
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
        var sortedLeagues = Object.keys(teamsByLeague).sort(function(a,b) {
            var idxA = customLgOrder.indexOf(a);
            var idxB = customLgOrder.indexOf(b);
            if(idxA > -1 && idxB > -1) return idxA - idxB;
            if(idxA > -1) return -1;
            if(idxB > -1) return 1;
            return a.localeCompare(b);
        });

        sortedLeagues.forEach(function(lg) {
            tHtml += '<div style="margin-top:8px; font-size:13px; font-weight:bold; color:var(--muted); text-transform:uppercase;">' + esc(lg) + '</div>';

            var sortedTeams = teamsByLeague[lg].sort(function(a, b) {
                return a.name.localeCompare(b.name);
            });

            sortedTeams.forEach(function(t) {
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

                tHtml += '<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:8px 12px; border-radius:6px; cursor:pointer;" onclick="toggleFavPageTeam(\'' + escJs(t.name) + '\')">'
                       + '<div style="display:flex; align-items:center; gap:12px;">'
                       + '<div style="width:24px; display:flex; justify-content:center;">' + logoHtml + '</div>'
                       + '<div>'
                       + '<div style="font-size:14px; font-weight:bold; color:' + (isFav ? 'var(--text)' : 'var(--muted)') + ';">' + esc(t.name) + '</div>'
                       + aliasText
                       + '</div>'
                       + '</div>'
                       + '<button style="background:none; border:none; color:' + (isFav ? 'var(--accent)' : 'var(--border2)') + '; font-size:20px; cursor:pointer;">★</button>'
                       + '</div>';
            });
        });

        teamsContainer.innerHTML = tHtml;
    }
}

function toggleFavPageTeam(teamName) {
    toggleFavTeam(teamName); // Re-uses existing function which sets localStorage
    renderFavPage(); // Re-render to update UI (star color)
}

function moveLeagueOrder(lgKey, direction) {
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

    customLgOrder = displayOrder;
    saveCustomLgOrder();
    renderFavPage();
}

function resetLgOrder() {
    customLgOrder = [];
    saveCustomLgOrder();
    renderFavPage();
}

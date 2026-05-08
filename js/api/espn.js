// ══ ESPN API INTEGRATION ═══════════════════════════

function getEspnDateStr(d) {
    if (!d) return '';
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

function fetchEspnSchedule(leaguePath, dateStr) {
    var url = 'https://site.api.espn.com/apis/site/v2/sports/' + leaguePath + '/scoreboard?dates=' + dateStr;
    return fetchJSON(url).catch(function(){ return null; });
}

function getLeagueInfo(leagueName) {
    var path = '';
    var lower = leagueName.toLowerCase();

    // Fallback to constants if available
    if (typeof ESPN_LEAGUES !== 'undefined') {
        for (var key in ESPN_LEAGUES) {
            if (key.toLowerCase() === lower || (typeof LEAGUE_FORMAT_NAMES !== 'undefined' && LEAGUE_FORMAT_NAMES[lower] === key)) {
                path = ESPN_LEAGUES[key];
                break;
            }
        }
    }

    if (path) return { path: path };
    return null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getEspnDateStr, fetchEspnSchedule, getLeagueInfo };
}

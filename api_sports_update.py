import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace footybite URL
content = content.replace("var SITE = 'https://www.footybite.do/';", "var SITE = 'https://footybite.to/';")
content = content.replace("footybite.do", "footybite.to")

# Add API-Sports mapping and logic in JS
# We need to insert the mapping and API functions

api_logic = """
/* ══ API-SPORTS INTEGRATION ════════════ */
var SPORT_MAP = {
  'nba': { sport: 'basketball', api: 'v1.basketball.api-sports.io', leagueId: 12 },
  'nhl': { sport: 'hockey', api: 'v1.hockey.api-sports.io', leagueId: 57 },
  'nfl': { sport: 'american-football', api: 'v1.american-football.api-sports.io', leagueId: 1 },
  'mlb': { sport: 'baseball', api: 'v1.baseball.api-sports.io', leagueId: 1 },
  'premier league': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 39 },
  'la liga': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 140 },
  'serie a': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 135 },
  'bundesliga': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 78 },
  'ligue 1': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 61 },
  'champions league': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 2 },
  'europa league': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 3 },
  'conference league': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 848 },
  'mls': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 253 },
  'saudi pro league': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 307 },
  'eredivisie': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 88 },
  'primeira liga': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 94 },
  'fa cup': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 45 },
  'copa del rey': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 143 },
  'coupe de france': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 66 },
  'dfb pokal': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 81 },
  'coppa italia': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 137 },
  'nations league': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 5 }
};

function getLeagueInfo(leagueName) {
  var l = leagueName.toLowerCase();
  for (var key in SPORT_MAP) {
    if (l.indexOf(key) >= 0) return SPORT_MAP[key];
  }
  // Default to football if unknown, though it might fail
  return { sport: 'football', api: 'v3.football.api-sports.io', leagueId: null };
}

function fetchApiSportsFixtures(sportInfo, dateStr) {
  var key = localStorage.getItem('apiSportsKey');
  if (!key) return Promise.resolve(null);

  var cacheKey = 'apisports_' + sportInfo.sport + '_' + (sportInfo.leagueId || 'all') + '_' + dateStr;
  var cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      var data = JSON.parse(cached);
      // Cache expires after 4 hours for non-live sync
      if (Date.now() - data.ts < 4 * 3600 * 1000) {
        lg('API-Sports Cache Hit', cacheKey);
        return Promise.resolve(data.response);
      }
    } catch(e){}
  }

  var url = 'https://' + sportInfo.api + '/fixtures?date=' + dateStr;
  if (sportInfo.sport !== 'football') {
      url = 'https://' + sportInfo.api + '/games?date=' + dateStr;
  }
  if (sportInfo.leagueId) {
    var season = new Date().getFullYear();
    // Some logic for season year overlap (e.g. 2023-2024 usually uses 2023 for football)
    if (new Date().getMonth() < 6 && sportInfo.sport === 'football') season -= 1;
    if (sportInfo.sport === 'football') {
        url += '&league=' + sportInfo.leagueId + '&season=' + season;
    } else {
        url += '&league=' + sportInfo.leagueId + '&season=' + season;
    }
  }

  lg('API-Sports Req', url);
  return fetch(url, {
    headers: {
      'x-apisports-key': key,
      'x-rapidapi-key': key
    }
  }).then(function(res) { return res.json(); }).then(function(data) {
    if (data && data.response) {
      localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), response: data.response }));
      return data.response;
    }
    return null;
  }).catch(function(e) {
    lg('API-Sports Err', e.message);
    return null;
  });
}

function syncMatchesWithApiSports(matches) {
  var key = localStorage.getItem('apiSportsKey');
  if (!key || matches.length === 0) return Promise.resolve(matches);

  var today = new Date().toISOString().split('T')[0];
  var sportGroups = {};

  // Group matches by sport info
  matches.forEach(function(m) {
    var info = getLeagueInfo(m.league);
    var groupKey = info.sport + '_' + (info.leagueId || 'unknown');
    if (!sportGroups[groupKey]) sportGroups[groupKey] = { info: info, matches: [] };
    sportGroups[groupKey].matches.push(m);
  });

  var promises = [];
  Object.keys(sportGroups).forEach(function(gKey) {
    var group = sportGroups[gKey];
    if (group.info.leagueId) {
      promises.push(
        fetchApiSportsFixtures(group.info, today).then(function(apiData) {
          if (!apiData) return;
          group.matches.forEach(function(m) {
            // Find match by team names (fuzzy match)
            var mHome = m.homeTeam.toLowerCase().replace(/[^a-z0-9]/g, '');
            var mAway = m.awayTeam.toLowerCase().replace(/[^a-z0-9]/g, '');

            var matchedApiFixture = apiData.find(function(f) {
              var fHome = '', fAway = '';
              if (group.info.sport === 'football') {
                 fHome = f.teams.home.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                 fAway = f.teams.away.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              } else { // basketball, hockey, nfl
                 fHome = f.teams.home.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                 fAway = f.teams.away.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              }
              // Simple check if one contains the other
              return (mHome.includes(fHome) || fHome.includes(mHome)) &&
                     (mAway.includes(fAway) || fAway.includes(mAway));
            });

            if (matchedApiFixture) {
              updateMatchDataFromApi(m, matchedApiFixture, group.info.sport);
            }
          });
        })
      );
    }
  });

  return Promise.all(promises).then(function() { return matches; });
}

function updateMatchDataFromApi(match, apiFixture, sport) {
  if (sport === 'football') {
    var fixture = apiFixture.fixture;
    var goals = apiFixture.goals;
    var status = fixture.status.short; // NS, 1H, HT, 2H, FT, etc.

    // Convert API status to our status
    if (['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(status)) {
      match.status = 'live';
      match.minute = fixture.status.elapsed ? fixture.status.elapsed + "'" : 'HT';
      if(status === 'HT') match.minute = 'HT';
      match.score = [goals.home !== null ? goals.home : 0, goals.away !== null ? goals.away : 0];
    } else if (['FT', 'AET', 'PEN'].includes(status)) {
      match.status = 'finished';
      match.minute = 'FT';
      match.score = [goals.home !== null ? goals.home : 0, goals.away !== null ? goals.away : 0];
    } else {
      // NS (Not Started), TBD
      match.status = 'upcoming';
      // Time is usually correct from footybite, but we can override it
      var d = new Date(fixture.date);
      match.startTime = pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
  } else {
    // Basketball / Hockey / NFL (v1 APIs)
    var status = apiFixture.status.short;
    var scores = apiFixture.scores;
    if (['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'HT', 'LIVE', 'P1', 'P2', 'P3'].includes(status)) {
       match.status = 'live';
       match.minute = apiFixture.status.timer ? apiFixture.status.timer : status;
       match.score = [scores.home.total !== null ? scores.home.total : 0, scores.away.total !== null ? scores.away.total : 0];
    } else if (['FT', 'AOT'].includes(status)) {
       match.status = 'finished';
       match.minute = 'FT';
       match.score = [scores.home.total !== null ? scores.home.total : 0, scores.away.total !== null ? scores.away.total : 0];
    } else {
       match.status = 'upcoming';
       var d = new Date(apiFixture.date);
       match.startTime = pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
  }
}
"""

content = content.replace("/* ══ FETCH SUB-PAGES (STREAMS) ════════════ */", api_logic + "\n/* ══ FETCH SUB-PAGES (STREAMS) ════════════ */")

# Modify loadAll to include API-Sports sync
loadAll_replace_target = """
      buildEPG(S.matches);
      var live=S.matches.filter(function(m){return m.status==='live';}).length;
      showToast(S.matches.length+' matchs'+(live?' · '+live+' live':''));

      // Start fetching stream links in background
      fetchSubPages(S.matches);
"""

new_loadAll = """
      document.getElementById('ovmsg').textContent='Sync API-Sports...';
      return syncMatchesWithApiSports(S.matches);
    })
    .then(function(syncedMatches) {
      if(!syncedMatches) return;
      S.matches = syncedMatches;
      buildEPG(S.matches);
      var live=S.matches.filter(function(m){return m.status==='live';}).length;
      showToast(S.matches.length+' matchs'+(live?' · '+live+' live':''));

      // Start fetching stream links in background
      fetchSubPages(S.matches);
"""
content = content.replace(loadAll_replace_target, new_loadAll)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

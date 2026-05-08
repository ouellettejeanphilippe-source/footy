import { pad, lg, cacheLogo, getLeagueDuration, fetchPage, esc } from './utils.js';
import { getEstTimeStrFromDate, getEstDateStrFromDate, formatLeagueName, lgFlag, lgColor, getOfficialTeamName } from './config.js';
import { isMatch, isMatchPair } from './match.js';
import { parsePWHLSchedule } from './scrapers.js';
import { addScrapeLog, S } from './state.js';

/* ══ ESPN API FALLBACK & API-SPORTS ════════════ */
export var ESPN_LEAGUES = {
  'premier league': 'soccer/eng.1',
  'la liga': 'soccer/esp.1',
  'serie a': 'soccer/ita.1',
  'bundesliga': 'soccer/ger.1',
  'ligue 1': 'soccer/fra.1',
  'champions league': 'soccer/uefa.champions',
  'europa league': 'soccer/uefa.europa',
  'conference league': 'soccer/uefa.europa.conf',
  'mls': 'soccer/usa.1',
  'eredivisie': 'soccer/ned.1',
  'primeira liga': 'soccer/por.1',
  'nations league': 'soccer/uefa.nations',
  'fa cup': 'soccer/eng.fa',
  'league cup': 'soccer/eng.league_cup',
  'copa del rey': 'soccer/esp.copa_del_rey',
  'dfb pokal': 'soccer/ger.dfb_pokal',
  'saudi pro league': 'soccer/ksa.1',
  'nba': 'basketball/nba',
  'basketball': 'basketball/nba',
  'nhl': 'hockey/nhl',
  'hockey': 'hockey/nhl',
  'ice hockey': 'hockey/nhl',
  'nfl': 'football/nfl',
  'american football': 'football/nfl',
  'american-football': 'football/nfl',
  'mlb': 'baseball/mlb',
  'baseball': 'baseball/mlb',
  'f1': 'racing/f1',
  'formula 1': 'racing/f1'
};

export function getEspnDateStr(d) {
  return d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate());
}

export function fetchEspnSchedule(leaguePath, dateStr) {
  var url = 'https://site.api.espn.com/apis/site/v2/sports/' + leaguePath + '/scoreboard?dates=' + dateStr;
  return fetch(url, { signal: AbortSignal.timeout(8000) }).then(function(res) { return res.json(); }).catch(function(){ return null; });
}

/* ══ API-SPORTS INTEGRATION ════════════ */
export var SPORT_MAP = {
  'nba': { sport: 'basketball', api: 'v1.basketball.api-sports.io', leagueId: 12 },
  'basketball': { sport: 'basketball', api: 'v1.basketball.api-sports.io', leagueId: 12 },
  'nhl': { sport: 'hockey', api: 'v1.hockey.api-sports.io', leagueId: 57 },
  'hockey': { sport: 'hockey', api: 'v1.hockey.api-sports.io', leagueId: 57 },
  'ice hockey': { sport: 'hockey', api: 'v1.hockey.api-sports.io', leagueId: 57 },
  'nfl': { sport: 'american-football', api: 'v1.american-football.api-sports.io', leagueId: 1 },
  'american football': { sport: 'american-football', api: 'v1.american-football.api-sports.io', leagueId: 1 },
  'american-football': { sport: 'american-football', api: 'v1.american-football.api-sports.io', leagueId: 1 },
  'mlb': { sport: 'baseball', api: 'v1.baseball.api-sports.io', leagueId: 1 },
  'baseball': { sport: 'baseball', api: 'v1.baseball.api-sports.io', leagueId: 1 },
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
  'dfb pokal': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 81 },
  'coppa italia': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 137 },
  'nations league': { sport: 'football', api: 'v3.football.api-sports.io', leagueId: 5 },
  'f1': { sport: 'formula-1', api: 'v1.formula-1.api-sports.io', leagueId: 1 },
  'formula 1': { sport: 'formula-1', api: 'v1.formula-1.api-sports.io', leagueId: 1 }
};

export function getLeagueInfo(leagueName) {
  var l = leagueName.toLowerCase();
  for (var key in SPORT_MAP) {
    if (l.indexOf(key) >= 0) return SPORT_MAP[key];
  }
  // Default to football if unknown, though it might fail
  return { sport: 'football', api: 'v3.football.api-sports.io', leagueId: null };
}


export function filterBuggyMatches(matches) {
    var today = new Date();
    var dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday

    return matches.filter(function(m) {
        var lowerHome = m.homeTeam.toLowerCase();
        var lowerAway = m.awayTeam.toLowerCase();
        var isWWE = lowerHome.includes('wwe') || lowerAway.includes('wwe') || m.league.toLowerCase().includes('wwe');
        var isRaw = lowerHome.includes('raw') || lowerAway.includes('raw');
        var isSmackdown = lowerHome.includes('smackdown') || lowerAway.includes('smackdown');

        if (isWWE) {
            // WWE Raw happens on Monday (1).
            // We might allow Tuesday (2) if it's past midnight EST.
            if (isRaw && dayOfWeek !== 1 && dayOfWeek !== 2) return false;

            // WWE Smackdown happens on Friday (5).
            // We might allow Saturday (6) if it's past midnight EST.
            if (isSmackdown && dayOfWeek !== 5 && dayOfWeek !== 6) return false;
        }

        return true;
    });
}

export function fetchApiSportsFixtures(sportInfo, dateStr) {
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
    signal: AbortSignal.timeout(8000),
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



export function updateMatchDataFromApi(match, apiFixture, sport) {
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
      match.startTime = getEstTimeStrFromDate(d);
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
       match.startTime = getEstTimeStrFromDate(d);
    }
  }

  // Update logos from API-Sports if available
  if(apiFixture.teams) {
      if(apiFixture.teams.home && apiFixture.teams.home.logo) {
          match.homeLogo = apiFixture.teams.home.logo;
          cacheLogo(match.homeTeam, match.homeLogo);
      }
      if(apiFixture.teams.away && apiFixture.teams.away.logo) {
          match.awayLogo = apiFixture.teams.away.logo;
          cacheLogo(match.awayTeam, match.awayLogo);
      }
  }
}

/* ══ API FIRST LOGIC ══════════════════ */
export var TARGET_DATE = new Date();

export function getApiFirstMatches(targetDate) {
  var todayStr = getEspnDateStr(targetDate);
  var cacheRaw = localStorage.getItem('api_calendar_cache');
  var cache = cacheRaw ? JSON.parse(cacheRaw) : null;

  var needsFullFetch = !cache || cache.fetchDate !== todayStr;

  var promises = [];
  var baseMatches = [];

  if (!needsFullFetch && cache && cache.matches) {
      baseMatches = cache.matches;
  }

  var espnPaths = [];
  for(var key in ESPN_LEAGUES) { if(espnPaths.indexOf(ESPN_LEAGUES[key])===-1) espnPaths.push(ESPN_LEAGUES[key]); }

  if (needsFullFetch || baseMatches.length === 0) {
      espnPaths.forEach(function(path) {
          promises.push(
            fetchEspnSchedule(path, todayStr).then(function(data) {
              if(!data || !data.events) return;
              var leagueName = data.leagues && data.leagues[0] ? data.leagues[0].name : path;

              data.events.forEach(function(ev) {
                var comp = ev.competitions[0];
                if(!comp || !comp.competitors) return;
                var home = comp.competitors.find(function(c){return c.homeAway==='home';});
                var away = comp.competitors.find(function(c){return c.homeAway==='away';});
                if(!home || !away) return;

                var status = 'upcoming';
                if(ev.status.type.state === 'in') status = 'live';
                if(ev.status.type.state === 'post') status = 'finished';

                var score = null;
                if(status !== 'upcoming') {
                  score = [parseInt(home.score), parseInt(away.score)];
                }

                var minute = null;
                if(status === 'live' && ev.status.displayClock) {
                  minute = ev.status.displayClock;
                } else if(status === 'live' && ev.status.period) {
                  minute = 'P' + ev.status.period;
                }

                var dateObj = new Date(ev.date);
                var startTime = getEstTimeStrFromDate(dateObj);
                var matchDate = getEstDateStrFromDate(dateObj);

                var matchObj = {
                  id: 'espn_' + ev.id,
                  league: formatLeagueName(leagueName),
                  flag: lgFlag(leagueName),
                  color: lgColor(leagueName),
                  homeTeam: getOfficialTeamName(home.team.name),
                  awayTeam: getOfficialTeamName(away.team.name),
                  matchDate: matchDate,
                  homeLogo: home.team.logo || null,
                  awayLogo: away.team.logo || null,
                  startTime: startTime,
                  durationMinutes: getLeagueDuration(leagueName),
                  status: status,
                  score: score,
                  minute: minute,
                  streamLinks: [],
                  streamsLoaded: false,
                  source: 'api'
                };

                var existingIdx = baseMatches.findIndex(function(m) { return m.id === matchObj.id; });
                if (existingIdx >= 0) {
                  baseMatches[existingIdx].status = matchObj.status;
                  baseMatches[existingIdx].score = matchObj.score;
                  baseMatches[existingIdx].minute = matchObj.minute;
                  baseMatches[existingIdx].startTime = matchObj.startTime;
                  baseMatches[existingIdx].matchDate = matchObj.matchDate;
                } else {
                  baseMatches.push(matchObj);
                }
              });
            })
          );
      });

      promises.push(
          fetchPage('https://www.thepwhl.com/en/schedule').then(function(html) {
              if (html) {
                  var pwhlMatches = parsePWHLSchedule(html);
                  pwhlMatches.forEach(function(m) {
                      m.flag = lgFlag('PWHL');
                      m.color = lgColor('PWHL');
                      m.source = 'api';

                      var dateObj = new Date(m.date);
                      m.matchDate = getEstDateStrFromDate(dateObj);
                      m.startTime = ('0' + dateObj.getHours()).slice(-2) + ':' + ('0' + dateObj.getMinutes()).slice(-2);

                      m.status = m.time === 'LIVE' ? 'live' : 'upcoming';
                      if (m.homeScore && m.awayScore && m.status !== 'live') {
                           m.status = 'finished';
                           m.score = [parseInt(m.homeScore), parseInt(m.awayScore)];
                      } else if (m.homeScore && m.awayScore) {
                           m.score = [parseInt(m.homeScore), parseInt(m.awayScore)];
                      } else {
                           m.score = null;
                      }

                      var existingIdx = baseMatches.findIndex(function(existing) {
                          return existing.id === m.id || (isMatch(existing.homeTeam, m.homeTeam) && isMatch(existing.awayTeam, m.awayTeam) && existing.matchDate === m.matchDate);
                      });

                      if (existingIdx >= 0) {
                          baseMatches[existingIdx].status = m.status;
                          baseMatches[existingIdx].score = m.score;
                          baseMatches[existingIdx].startTime = m.startTime;
                      } else {
                          baseMatches.push(m);
                      }
                  });
              }
          }).catch(function(e) { lg('Error fetching PWHL API schedule', e); })
      );
  } else {
      espnPaths.forEach(function(path) {
          promises.push(
            fetchEspnSchedule(path, todayStr).then(function(data) {
            if(!data || !data.events) return;
            data.events.forEach(function(ev) {
              var comp = ev.competitions[0];
              if(!comp || !comp.competitors) return;
              var home = comp.competitors.find(function(c){return c.homeAway==='home';});
              var away = comp.competitors.find(function(c){return c.homeAway==='away';});
              if(!home || !away) return;

              var status = 'upcoming';
              if(ev.status.type.state === 'in') status = 'live';
              if(ev.status.type.state === 'post') status = 'finished';

              var score = null;
              if(status !== 'upcoming') {
                score = [parseInt(home.score), parseInt(away.score)];
              }

              var minute = null;
              if(status === 'live' && ev.status.displayClock) {
                minute = ev.status.displayClock;
              } else if(status === 'live' && ev.status.period) {
                minute = 'P' + ev.status.period;
              }

              var matchId = 'espn_' + ev.id;
              var existingIdx = baseMatches.findIndex(function(m) { return m.id === matchId; });
              if (existingIdx >= 0) {
                  baseMatches[existingIdx].status = status;
                  baseMatches[existingIdx].score = score;
                  baseMatches[existingIdx].minute = minute;
              }
            });
          })
        );
      });
  }

  return Promise.allSettled(promises).then(function(){
    var filtered = filterBuggyMatches(baseMatches);
    try {
        var fetchDateToSave = todayStr;
        if (!needsFullFetch && cache && cache.fetchDate) {
            fetchDateToSave = cache.fetchDate; // Keep original fetch date if not full fetch
        }
        var cacheData = filtered.map(function(m) {
            // we no longer want to strip out streams if they exist so they aren't lost on refresh
            return Object.assign({}, m);
        });
        localStorage.setItem('api_calendar_cache', JSON.stringify({
            fetchDate: fetchDateToSave,
            matches: cacheData
        }));
    } catch (e) {
        console.error('Failed to cache calendar:', e);
    }
    return filtered;
  });
}

export function mergeFluxToApi(apiMatches, scrapedMatches, skipScraping) {
  var targetDateStr = getEstDateStrFromDate(TARGET_DATE);

  if (typeof window.streamMissingCounts === 'undefined') window.streamMissingCounts = {};

  scrapedMatches.forEach(function(sm) {

      var matched = false;
      for(var i=0; i<apiMatches.length; i++) {
         var am = apiMatches[i];

         if(isMatchPair(am, sm)) {
            if(!am.streamLinks) am.streamLinks = [];
            if(sm.streamLinks) {
                sm.streamLinks.forEach(function(sl) {
                    if(!am.streamLinks.find(function(e){ return e.url === sl.url; })) {
                        am.streamLinks.push(sl);
                    }
                });
            }
            if(sm.matchUrl && !am.matchUrl) am.matchUrl = sm.matchUrl;

            // For time and status, trust API (am) over scraped (sm),
            // but if API somehow has no time and sm does, use sm time.
            if(am.startTime === '00:00' && sm.startTime && sm.startTime !== '00:00') {
               am.startTime = sm.startTime;
            }

            matched = true;
            break;
         }
      }

      if(!matched) {
         if (sm.status === 'finished') return; // Skip finished matches that have no API counterpart

         // Flux that do not match an API match are kept but categorized distinctly
         // so they appear separated from the official API timeline, usually at the bottom.
         sm.id = 'scraped_' + Date.now() + '_' + Math.floor(Math.random()*1000);
         if (!sm.matchDate) sm.matchDate = targetDateStr;
         sm.league = 'Autres Flux';
         sm.flag = '📡';
         sm.color = '#555555';

         apiMatches.push(sm);

         if (!skipScraping) {
             addScrapeLog('Merge Failure', 'error', 'Unmerged: ' + sm.homeTeam + ' vs ' + sm.awayTeam + ' (' + (sm.source || 'unknown') + ')');
         }
      }
  });

  // Stream retention logic:
  // If a stream link from the PREVIOUS state is missing in the NEW state,
  // increment its missing count. If missing count < 3, add it back to the match.
  // Reset missing count if the stream is found in the NEW state.
  apiMatches.forEach(function(am) {
      if (!am.streamLinks) am.streamLinks = [];

      // Get previous match state if it exists
      var prevMatch = S.matches ? S.matches.find(function(m) { return m.id === am.id; }) : null;
      if (prevMatch && prevMatch.streamLinks) {
          prevMatch.streamLinks.forEach(function(oldSl) {
              var found = am.streamLinks.find(function(sl) { return sl.url === oldSl.url; });
              if (found) {
                  // Link still exists, reset missing count
                  window.streamMissingCounts[oldSl.url] = 0;
              } else {
                  // Link is missing
                  var count = window.streamMissingCounts[oldSl.url] || 0;
                  if (!skipScraping) count++;
                  window.streamMissingCounts[oldSl.url] = count;

                  if (count < 3) {
                      // Retain the stream if missed less than 3 times
                      am.streamLinks.push(oldSl);
                  }
              }
          });
      }

      if (prevMatch) {
          // Carry over streamsLoaded state if we have streams
          if (am.streamLinks && am.streamLinks.length > 0) {
              am.streamsLoaded = prevMatch.streamsLoaded;
          }
          if (prevMatch.matchUrl && !am.matchUrl) {
              am.matchUrl = prevMatch.matchUrl;
          }
      }
  });

  return apiMatches;
}



/* ══ EXTENDED API LOGIC FOR STATS & STANDINGS ══════════════ */

export function formatStatLabel(key) {
    if (!key) return '';
    var map = {
        'possessionTime': 'Possession',
        'possession': 'Possession',
        'shots': 'Tirs',
        'shotsOnTarget': 'Tirs Cadrés',
        'fouls': 'Fautes',
        'yellowCards': 'Cartons Jaunes',
        'redCards': 'Cartons Rouges',
        'cornerKicks': 'Corners',
        'offsides': 'Hors-jeux',
        'saves': 'Arrêts',
        'expectedGoals': 'Buts Attendus (xG)',
        'passes': 'Passes',
        'passAccuracy': 'Précision Passes',
        'tackles': 'Tacles',
        'interceptions': 'Interceptions',
        'clearances': 'Dégagements',
        'aerialsWon': 'Duels Aériens Gagnés',
        'blocks': 'Contres',
        'freeKicks': 'Coups Francs',
        'goalKicks': 'Six Mètres',
        'throwIns': 'Touches'
    };
    if (map[key]) return map[key];

    var spaced = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
    var capitalized = spaced.charAt(0).toUpperCase() + spaced.slice(1);
    return capitalized.trim();
}

export function renderScorersHtml(scorers, m, hId, aId) {
    if (!scorers || scorers.length === 0) return '';
    var hScorers = [], aScorers = [];

    scorers.forEach(function(s) {
        if (s.isHome !== undefined) {
            if (s.isHome) hScorers.push(s);
            else aScorers.push(s);
        } else if (s.teamId) {
            if (hId && s.teamId == hId) hScorers.push(s);
            else if (aId && s.teamId == aId) aScorers.push(s);
            else aScorers.push(s);
        } else {
            aScorers.push(s);
        }
    });

    if (hScorers.length === 0 && aScorers.length === 0) return '';

    var html = '<div style="display:flex; justify-content:space-between; width:100%; font-size:12px; color:var(--muted); margin-top:8px;">';
    html += '<div style="flex:1; text-align:right; padding-right:10px;">';
    hScorers.forEach(function(s) {
        html += '<div style="margin-bottom:2px;">' + esc(s.player) + ' ⚽ ' + esc(s.time) + '</div>';
    });
    html += '</div>';
    html += '<div style="width:1px; background:rgba(255,255,255,0.1);"></div>';
    html += '<div style="flex:1; text-align:left; padding-left:10px;">';
    aScorers.forEach(function(s) {
        html += '<div style="margin-bottom:2px;">⚽ ' + esc(s.time) + ' ' + esc(s.player) + '</div>';
    });
    html += '</div>';
    html += '</div>';
    return html;
}

export function fetchGameStats(matchId) {
    if(matchId.startsWith('espn_')) {
        var espnId = matchId.split('_')[1];
        var m = S.matches.find(function(x) { return x.id === matchId; });
        var path = 'soccer/eng.1'; // fallback

        if (m) {
            for (var k in ESPN_LEAGUES) {
                if (k.toLowerCase() === m.league.toLowerCase() || m.league.toLowerCase().indexOf(k.toLowerCase()) > -1) {
                    path = ESPN_LEAGUES[k];
                    break;
                }
            }
        }

        var url = 'https://site.api.espn.com/apis/site/v2/sports/' + path + '/summary?event=' + espnId;
        return fetch(url, { signal: AbortSignal.timeout(8000) }).then(function(r){ return r.json(); }).then(function(data) {
            var scorers = [];
            var hRank = '', aRank = '', hForm = '', aForm = '';
            if (data.header && data.header.competitions && data.header.competitions[0]) {
                var comp = data.header.competitions[0];
                if (comp.details) {
                    comp.details.forEach(function(d) {
                        if (d.scoringPlay && d.participants && d.participants[0] && d.participants[0].athlete) {
                            var time = d.clock && d.clock.displayValue ? d.clock.displayValue : '';
                            var player = d.participants[0].athlete.shortName || d.participants[0].athlete.displayName;
                            var teamId = d.team && d.team.id ? d.team.id : null;
                            scorers.push({ time: time, player: player, teamId: teamId });
                        }
                    });
                }
                if (comp.competitors) {
                    var hComp = comp.competitors.find(function(c) { return c.homeAway === 'home'; });
                    var aComp = comp.competitors.find(function(c) { return c.homeAway === 'away'; });
                    if (hComp && hComp.record && hComp.record.length > 0) hForm = hComp.record[0].summary;
                    if (aComp && aComp.record && aComp.record.length > 0) aForm = aComp.record[0].summary;
                }
            }
            if (data.standings && data.standings.groups && data.standings.groups[0] && data.standings.groups[0].standings) {
                var entries = data.standings.groups[0].standings.entries;
                if (entries) {
                    var mHomeId = null, mAwayId = null;
                    if (data.header && data.header.competitions && data.header.competitions[0] && data.header.competitions[0].competitors) {
                        var c = data.header.competitions[0].competitors;
                        var hComp = c.find(function(x) { return x.homeAway === 'home'; });
                        var aComp = c.find(function(x) { return x.homeAway === 'away'; });
                        if(hComp) mHomeId = hComp.id;
                        if(aComp) mAwayId = aComp.id;
                    }
                    entries.forEach(function(e) {
                        var rankObj = e.stats.find(function(s) { return s.name === 'rank'; });
                        var rank = rankObj ? rankObj.displayValue : '';
                        if (mHomeId && e.id === mHomeId) hRank = rank;
                        if (mAwayId && e.id === mAwayId) aRank = rank;
                    });
                }
            }
            return { source: 'espn', data: data, scorers: scorers, hRank: hRank, aRank: aRank, hForm: hForm, aForm: aForm };
        }).catch(function(e) {
            return Promise.reject(e);
        });
    } else if (matchId.startsWith('api_')) {
        var apiId = matchId.split('_')[1];
        var key = localStorage.getItem('apiSportsKey');
        if (!key) return Promise.reject('No API key');

        var m = S.matches.find(function(x) { return x.id === matchId; });
        var sport = 'football'; // default api-sports
        if(m && m.league.toLowerCase().indexOf('nba')!==-1) sport = 'basketball';
        else if(m && m.league.toLowerCase().indexOf('nhl')!==-1) sport = 'hockey';

        return fetch('https://v3.' + sport + '.api-sports.io/fixtures?id=' + apiId, {
            signal: AbortSignal.timeout(8000),
            headers: { 'x-rapidapi-key': key }
        }).then(function(r){return r.json();}).then(function(data) {
            var resData = data.response[0];
            var scorers = [];
            if (resData && resData.events) {
                resData.events.forEach(function(e) {
                    if (e.type === 'Goal') {
                        var time = e.time.elapsed + (e.time.extra ? '+' + e.time.extra : '') + '\'';
                        var player = e.player.name;
                        var isHome = resData.teams && resData.teams.home && resData.teams.home.id === e.team.id;
                        scorers.push({ time: time, player: player, isHome: isHome });
                    }
                });
            }
            return { source: 'api-sports', data: resData, scorers: scorers, hRank: '', aRank: '', hForm: '', aForm: '' };
        });
    }
    return Promise.reject('Unsupported source');
}

export function fetchLeagueStandings(leagueName) {
    var path = 'soccer/eng.1'; // fallback
    for (var k in ESPN_LEAGUES) {
        if (k.toLowerCase() === leagueName.toLowerCase() || leagueName.toLowerCase().indexOf(k.toLowerCase()) > -1) {
            path = ESPN_LEAGUES[k];
            break;
        }
    }
    var url = 'https://site.api.espn.com/apis/v2/sports/' + path + '/standings';
    return fetch(url, { signal: AbortSignal.timeout(8000) }).then(function(r){ return r.json(); }).then(function(data) {
        return { source: 'espn', data: data };
    }).catch(function(e) {
        return Promise.reject(e);
    });
}



// Global bindings for HTML compatibility
window.ESPN_LEAGUES = ESPN_LEAGUES;
window.getEspnDateStr = getEspnDateStr;
window.fetchEspnSchedule = fetchEspnSchedule;
window.SPORT_MAP = SPORT_MAP;
window.getLeagueInfo = getLeagueInfo;
window.filterBuggyMatches = filterBuggyMatches;
window.fetchApiSportsFixtures = fetchApiSportsFixtures;
window.updateMatchDataFromApi = updateMatchDataFromApi;
window.TARGET_DATE = TARGET_DATE;
window.getApiFirstMatches = getApiFirstMatches;
window.mergeFluxToApi = mergeFluxToApi;
window.formatStatLabel = formatStatLabel;
window.renderScorersHtml = renderScorersHtml;
window.fetchGameStats = fetchGameStats;
window.fetchLeagueStandings = fetchLeagueStandings;

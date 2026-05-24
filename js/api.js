import { pad, lg, getLeagueDuration, fetchPage, esc } from './utils.js';
import { getEstTimeStrFromDate, getEstDateStrFromDate } from './config.js';
import { formatLeagueName, lgFlag, lgColor, getOfficialTeamName, normName } from './db.js';
import { isMatch, isMatchPair } from './match.js';
import { parsePWHLSchedule, parseWWEIcs, parseF1Ics, parseIndycarIcs, getStreamCache } from './scrapers.js';
import { addScrapeLog, S } from './state.js';
import { safeStorageGet, safeStorageSet, safeStorageGetJSON, safeStorageSetJSON } from './utils.js';

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
  'cfl': 'football/cfl',
  'world baseball classic': 'baseball/world-baseball-classic',
  'fiba world cup': 'basketball/fiba',
  'ncaa men\'s basketball': 'basketball/mens-college-basketball',
  'olympics men\'s basketball': 'basketball/mens-olympics-basketball',
  'ncaa women\'s basketball': 'basketball/womens-college-basketball',
  'ncaa football': 'football/college-football',
  'world hockey championships': 'hockey/hockey-world-cup',
  'world cup of hockey': 'hockey/hockey-world-cup',
  'ncaa men\'s ice hockey': 'hockey/mens-college-hockey',
  'olympics men\'s ice hockey': 'hockey/olympics-mens-ice-hockey',
  'olympics women\'s ice hockey': 'hockey/olympics-womens-ice-hockey',
  'ncaa women\'s hockey': 'hockey/womens-college-hockey',
  'fifa world cup': 'soccer/fifa.world',
  'fifa women\'s world cup': 'soccer/fifa.wwc',
  'nwsl': 'soccer/usa.nwsl'
};

export function getEspnDateStr(d) {
  return d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate());
}

export function fetchEspnSchedule(leaguePath, dateStr) {
  var url = 'https://site.api.espn.com/apis/site/v2/sports/' + leaguePath + '/scoreboard?dates=' + dateStr;
  return fetch(url, { signal: AbortSignal.timeout(8000) }).then(function(res) { return res.json(); }).catch(function(){ return null; });
}

export function fetchLolEsportsSchedule(targetDate) {
    var url = 'https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=en-US';
    return fetch(url, {
        headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' },
        signal: AbortSignal.timeout(8000)
    }).then(function(res) { return res.json(); }).catch(function(){ return null; });
}

export function fetchLolEsportsLiveStreams() {
    var url = 'https://esports-api.lolesports.com/persisted/gw/getLive?hl=en-US';
    return fetch(url, {
        headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' },
        signal: AbortSignal.timeout(8000)
    }).then(function(res) { return res.json(); }).catch(function(){ return null; });
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

        // Note: The previous logic aggressively filtered Raw/SmackDown by dayOfWeek,
        // which caused legitimate WWE streams (now parsed accurately from wwe.com/events)
        // to vanish. We no longer filter WWE by day of week here to allow the official schedule to dictate visibility.
        // If other buggy stream matching rules are needed in the future, they should go here.

        return true;
    });
}


/* ══ API FIRST LOGIC ══════════════════ */
export var TARGET_DATE = new Date();

export function setApiTargetDate(d) {
  TARGET_DATE = d;
  window.TARGET_DATE = d;
}

export function getApiFirstMatches(targetDate) {
  var targetDateObj = targetDate || new Date();
  var targetDateStr = getEstDateStrFromDate(targetDateObj);
  var todayStr = getEspnDateStr(targetDateObj);
  var cache = safeStorageGetJSON('api_calendar_cache_' + todayStr);

  var needsFullFetch = !cache || cache.fetchDate !== todayStr;

  var promises = [];
  var baseMatches = [];

  if (!needsFullFetch && cache && cache.matches) {
      baseMatches = cache.matches;
  }

  var baseMatchesById = {};
  for (var i = 0; i < baseMatches.length; i++) {
      if (baseMatches[i].id) {
          baseMatchesById[baseMatches[i].id] = baseMatches[i];
      }
  }

  var espnPaths = Array.from(new Set(Object.values(ESPN_LEAGUES || {})));

  if (needsFullFetch || baseMatches.length === 0) {
      espnPaths.forEach(function(path) {
          promises.push(
            fetchEspnSchedule(path, todayStr).then(function(data) {
              if(!data || !data.events) return;
              var leagueName = data.leagues && data.leagues[0] ? data.leagues[0].name : path;

              data.events.forEach(function(ev) {
                var isRacing = leagueName.toLowerCase().indexOf('f1') > -1 || leagueName.toLowerCase().indexOf('indycar') > -1 || path.indexOf('racing') > -1;

                var compsToProcess = isRacing ? ev.competitions : (ev.competitions.length > 0 ? [ev.competitions[0]] : []);

                compsToProcess.forEach(function(comp) {
                  if(!comp) return;

                  var homeName, awayName;
                  if (isRacing) {
                      homeName = ev.name || 'Racing Event';
                      awayName = comp.type && comp.type.abbreviation ? comp.type.abbreviation : 'Race';
                  } else {
                      if (!comp.competitors) return;
                      var homeC = comp.competitors.find(function(c){return c.homeAway==='home';});
                      var awayC = comp.competitors.find(function(c){return c.homeAway==='away';});
                      if(!homeC || !awayC) return;
                      homeName = homeC.team.name;
                      awayName = awayC.team.name;
                  }


                var status = 'upcoming';
                if(ev.status.type.state === 'in') status = 'live';
                if(ev.status.type.state === 'post') status = 'finished';

                var score = null;
                if(status !== 'upcoming' && !isRacing) {
                  var homeScoreObj = comp.competitors.find(function(c){return c.homeAway==='home';});
                  var awayScoreObj = comp.competitors.find(function(c){return c.homeAway==='away';});
                  if (homeScoreObj && awayScoreObj && homeScoreObj.score !== undefined && awayScoreObj.score !== undefined) {
                      score = [parseInt(homeScoreObj.score), parseInt(awayScoreObj.score)];
                  }
                }


                var minute = null;
                if(status === 'live' && ev.status.displayClock) {
                  minute = ev.status.displayClock;
                } else if(status === 'live' && ev.status.period) {
                  minute = 'P' + ev.status.period;
                }

                var dateObj = new Date(comp.date || ev.date);
                var startTime = getEstTimeStrFromDate(dateObj);
                var matchDate = isRacing ? targetDateStr : getEstDateStrFromDate(dateObj);
                var isPlayoff = ev.season && ev.season.type === 3;

                var matchObj = {
                  id: isRacing ? 'espn_' + ev.id + '_' + comp.id : 'espn_' + ev.id,
                  league: formatLeagueName(leagueName),
                  flag: lgFlag(leagueName),
                  color: lgColor(leagueName),
                  homeTeam: getOfficialTeamName(homeName),
                  awayTeam: getOfficialTeamName(awayName),
                  matchDate: matchDate,
                  homeLogo: isRacing ? null : (comp.competitors.find(function(c){return c.homeAway==='home';}).team.logo || null),
                  awayLogo: isRacing ? null : (comp.competitors.find(function(c){return c.homeAway==='away';}).team.logo || null),
                  startTime: startTime,
                  durationMinutes: getLeagueDuration(leagueName),
                  status: status,
                  score: score,
                  minute: minute,
                  streamLinks: [],
                  streamsLoaded: false,
                  source: 'api',
                  isPlayoff: isPlayoff
                };

                var existingMatch = baseMatchesById[matchObj.id];
                if (existingMatch) {
                  existingMatch.status = matchObj.status;
                  existingMatch.score = matchObj.score;
                  existingMatch.minute = matchObj.minute;
                  existingMatch.startTime = matchObj.startTime;
                  existingMatch.matchDate = matchObj.matchDate;
                  existingMatch.isPlayoff = isPlayoff;
                } else {
                  baseMatches.push(matchObj);
                  baseMatchesById[matchObj.id] = matchObj;
                }
                }); // end compsToProcess
              });
            })
          );
      });

      promises.push(
          Promise.all([
              fetchPage('https://www.thepwhl.com/en/schedule').catch(function() { return ''; }),
              fetchPage('https://www.thepwhl.com/en/schedule-25-26').catch(function() { return ''; })
          ]).then(function(htmls) {
              var allMatches = [];
              var seenIds = new Set();

              htmls.forEach(function(html) {
                  if (html) {
                      var matches = parsePWHLSchedule(html);
                      matches.forEach(function(m) {
                          if (!seenIds.has(m.id)) {
                              seenIds.add(m.id);
                              allMatches.push(m);
                          }
                      });
                  }
              });

              if (allMatches.length > 0) {
                  var pwhlMatches = allMatches;
                  pwhlMatches.forEach(function(m) {
                      m.flag = lgFlag('PWHL');
                      m.color = lgColor('PWHL');
                      m.source = 'api';
                      m.league = formatLeagueName('PWHL');


                      var dateObj = new Date(m.date);
                      m.matchDate = getEstDateStrFromDate(dateObj);
                      m.startTime = ('0' + dateObj.getHours()).slice(-2) + ':' + ('0' + dateObj.getMinutes()).slice(-2);

                      m.status = m.time === 'LIVE' ? 'live' : 'upcoming';
                      if (m.isFinished || (m.isFinished === undefined && m.homeScore && m.awayScore && m.status !== 'live')) {
                           m.status = 'finished';
                           if (m.homeScore && m.awayScore) m.score = [parseInt(m.homeScore), parseInt(m.awayScore)];
                      } else if (m.homeScore && m.awayScore && (m.status === 'live' || m.isFinished === undefined)) {
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
          }).catch(function(e) { console.error('Error fetching PWHL API schedule', e); lg('Error fetching PWHL API schedule', e); })
      );

      // Synthesize weekly WWE shows that might not be on wwe.com/events, or could disappear when live.
      var dateObjTarget = new Date(targetDateStr + "T12:00:00Z"); // Use noon UTC to reliably get the day of week for the target date string
      var dayOfWeekTarget = dateObjTarget.getUTCDay();

      var synthesizedWWE = [];
      if (dayOfWeekTarget === 1) { // Monday
          synthesizedWWE.push({ id: 'wwe_raw_' + targetDateStr, homeTeam: 'WWE', awayTeam: 'Raw', matchDate: targetDateStr, startTime: '20:00' });
      } else if (dayOfWeekTarget === 2) { // Tuesday
          synthesizedWWE.push({ id: 'wwe_nxt_' + targetDateStr, homeTeam: 'WWE', awayTeam: 'NXT', matchDate: targetDateStr, startTime: '20:00' });
      } else if (dayOfWeekTarget === 5) { // Friday
          synthesizedWWE.push({ id: 'wwe_smackdown_' + targetDateStr, homeTeam: 'WWE', awayTeam: 'Smackdown', matchDate: targetDateStr, startTime: '20:00' });
      }

      synthesizedWWE.forEach(function(m) {
          m.flag = lgFlag('WWE');
          m.color = lgColor('WWE');
          m.source = 'api';
          m.league = formatLeagueName('WWE');
          m.status = 'upcoming';
          m.score = null;
          baseMatches.push(m);
      });

      promises.push(
          fetchPage('https://ics.ecal.com/ecal-sub/6a1306ca7b50220002db8201/Formula%201.ics').catch(function() { return ''; }).then(function(icsText) {
              if (icsText) {
                  var matches = parseF1Ics(icsText);
                  matches.forEach(function(m) {
                      m.flag = lgFlag('F1');
                      m.color = lgColor('F1');
                      m.source = 'api';
                      m.league = formatLeagueName('F1');

                      var dateObj = new Date(m.date);
                      m.matchDate = getEstDateStrFromDate(dateObj);
                      m.startTime = ('0' + dateObj.getHours()).slice(-2) + ':' + ('0' + dateObj.getMinutes()).slice(-2);

                      var now = new Date();
                      var durationMs = 120 * 60 * 1000; // 2 hours default

                      if (now > new Date(dateObj.getTime() + durationMs)) {
                          m.status = 'finished';
                      } else if (now >= dateObj) {
                          m.status = 'live';
                      } else {
                          m.status = 'upcoming';
                      }

                      m.score = null;

                      if (m.matchDate === targetDateStr) {
                          var existingIdx = baseMatches.findIndex(function(existing) {
                              return existing.id === m.id || (isMatch(existing.homeTeam, m.homeTeam) && isMatch(existing.awayTeam, m.awayTeam) && existing.matchDate === m.matchDate);
                          });

                          if (existingIdx >= 0) {
                              baseMatches[existingIdx].status = m.status;
                              baseMatches[existingIdx].startTime = m.startTime;
                          } else {
                              baseMatches.push(m);
                          }
                      }
                  });
              }
          }).catch(function(e) { console.error('Error fetching F1 ICS schedule', e); lg('Error fetching F1 ICS schedule', e); })
      );

      promises.push(
          fetchPage('https://ics.ecal.com/ecal-sub/6a130e1f7b50220002db8220/INDYCAR.ics').catch(function() { return ''; }).then(function(icsText) {
              if (icsText) {
                  var matches = parseIndycarIcs(icsText);
                  matches.forEach(function(m) {
                      m.flag = lgFlag('INDYCAR');
                      m.color = lgColor('INDYCAR');
                      m.source = 'api';
                      m.league = formatLeagueName('INDYCAR');

                      var dateObj = new Date(m.date);
                      m.matchDate = getEstDateStrFromDate(dateObj);
                      m.startTime = ('0' + dateObj.getHours()).slice(-2) + ':' + ('0' + dateObj.getMinutes()).slice(-2);

                      var now = new Date();
                      var durationMs = 120 * 60 * 1000; // 2 hours default

                      if (now > new Date(dateObj.getTime() + durationMs)) {
                          m.status = 'finished';
                      } else if (now >= dateObj) {
                          m.status = 'live';
                      } else {
                          m.status = 'upcoming';
                      }

                      m.score = null;

                      if (m.matchDate === targetDateStr) {
                          var existingIdx = baseMatches.findIndex(function(existing) {
                              return existing.id === m.id || (isMatch(existing.homeTeam, m.homeTeam) && isMatch(existing.awayTeam, m.awayTeam) && existing.matchDate === m.matchDate);
                          });

                          if (existingIdx >= 0) {
                              baseMatches[existingIdx].status = m.status;
                              baseMatches[existingIdx].startTime = m.startTime;
                          } else {
                              baseMatches.push(m);
                          }
                      }
                  });
              }
          }).catch(function(e) { console.error('Error fetching IndyCar ICS schedule', e); lg('Error fetching IndyCar ICS schedule', e); })
      );

      promises.push(
          fetchPage('https://calendar.google.com/calendar/ical/335cea66edf27097e6a689c1067382ac1cd69f6795cac889f2acf87911f0d473%40group.calendar.google.com/public/basic.ics').catch(function() { return ''; }).then(function(icsText) {
              if (icsText) {
                  var matches = parseWWEIcs(icsText);
                  matches.forEach(function(m) {
                      m.flag = lgFlag('WWE');
                      m.color = lgColor('WWE');
                      m.source = 'api';
                      m.league = formatLeagueName('WWE');
                      if (m.matchDate === targetDateStr) {
                          baseMatches.push(m);
                      }
                  });
              }
          }).catch(function(e) { console.error('Error fetching WWE ICS schedule', e); lg('Error fetching WWE ICS schedule', e); })
      );

      promises.push(
          fetchLolEsportsSchedule(todayStr).then(function(data) {
              if(!data || !data.data || !data.data.schedule || !data.data.schedule.events) return;
              data.data.schedule.events.forEach(function(ev) {
                  if (ev.type !== 'match') return;
                  var targetLeagues = ['LCS', 'LEC', 'LPL', 'LCK', 'MSI', 'Worlds'];
                  if (!targetLeagues.includes(ev.league.name)) return;

                  var dateObj = new Date(ev.startTime);
                  var matchDate = getEstDateStrFromDate(dateObj);

                  // Use todayStr or targetDate since targetDateStr is not defined here yet
                  var matchDateTarget = targetDate ? getEstDateStrFromDate(targetDate) : getEstDateStrFromDate(new Date());
                  if (matchDate !== matchDateTarget) return;

                  var startTime = getEstTimeStrFromDate(dateObj);

                  var status = 'upcoming';
                  if (ev.state === 'inProgress') status = 'live';
                  else if (ev.state === 'completed') status = 'finished';

                  var score = null;
                  if (status !== 'upcoming' && ev.match.teams && ev.match.teams.length >= 2) {
                      var homeWins = ev.match.teams[0].result ? ev.match.teams[0].result.gameWins : 0;
                      var awayWins = ev.match.teams[1].result ? ev.match.teams[1].result.gameWins : 0;
                      score = [homeWins, awayWins];
                  }

                  if (!ev.match.teams || ev.match.teams.length < 2) return;

                  var m = {
                      id: 'lol_' + ev.match.id,
                      league: formatLeagueName(ev.league.name),
                      flag: lgFlag(ev.league.name),
                      color: lgColor(ev.league.name),
                      homeTeam: getOfficialTeamName(ev.match.teams[0].name || 'TBD'),
                      awayTeam: getOfficialTeamName(ev.match.teams[1].name || 'TBD'),
                      matchDate: matchDate,
                      homeLogo: ev.match.teams[0].image || null,
                      awayLogo: ev.match.teams[1].image || null,
                      startTime: startTime,
                      durationMinutes: getLeagueDuration(ev.league.name),
                      status: status,
                      score: score,
                      minute: null,
                      streamLinks: [],
                      streamsLoaded: false,
                      source: 'api',
                      isPlayoff: ev.blockName && ev.blockName.toLowerCase().indexOf('playoff') > -1
                  };

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

              return fetchLolEsportsLiveStreams().then(function(liveData) {
                  if (!liveData || !liveData.data || !liveData.data.schedule || !liveData.data.schedule.events) return;
                  liveData.data.schedule.events.forEach(function(liveEv) {
                      if (liveEv.type !== 'match') return;
                      var matchId = 'lol_' + liveEv.match.id;
                      var matchObj = baseMatches.find(function(m) { return m.id === matchId; });
                      if (matchObj && liveEv.match.streams) {
                          liveEv.match.streams.forEach(function(stream) {
                              var url = '';
                              if (stream.provider === 'twitch') {
                                  url = 'https://www.twitch.tv/' + stream.parameter;
                              } else if (stream.provider === 'youtube') {
                                  url = 'https://www.youtube.com/watch?v=' + stream.parameter;
                              }

                              if (url && !matchObj.streamLinks.find(function(s) { return s.url === url; })) {
                                  var language = stream.mediaLocale && stream.mediaLocale.englishName ? stream.mediaLocale.englishName : stream.locale;
                                  matchObj.streamLinks.push({
                                      name: stream.provider + ' (' + language + ')',
                                      url: url,
                                      res: '1080p',
                                      lang: language,
                                      type: 'video'
                                  });
                              }
                          });
                          if (matchObj.streamLinks.length > 0) {
                              matchObj.streamsLoaded = true;
                          }
                      }
                  });
              });
          }).catch(function(e) { console.error('Error fetching LoL schedule', e); lg('Error fetching LoL schedule', e); })
      );

      promises.push(
          fetchPage('https://www.wwe.com/events').catch(function() { return ''; }).then(function(html) {
              if (html) {
                  var matches = parseWWEEvents(html);
                  matches.forEach(function(m) {
                      m.flag = lgFlag('WWE');
                      m.color = lgColor('WWE');
                      m.source = 'api';
                      m.league = formatLeagueName('WWE');

                      var dateObj = new Date(m.date);
                      m.matchDate = getEstDateStrFromDate(dateObj);
                      m.startTime = ('0' + dateObj.getHours()).slice(-2) + ':' + ('0' + dateObj.getMinutes()).slice(-2);
                      if (m.startTime === '00:00') {
                          m.startTime = '20:00';
                      }

                      m.status = 'upcoming';
                      m.score = null;

                      if (m.matchDate === targetDateStr) {
                          var existingIdx = baseMatches.findIndex(function(existing) {
                              return existing.id === m.id || (isMatch(existing.homeTeam, m.homeTeam) && isMatch(existing.awayTeam, m.awayTeam) && existing.matchDate === m.matchDate);
                          });

                          if (existingIdx >= 0) {
                              // It might be a synthesized match (like Raw/SmackDown). Update its info if we scraped better data.
                              baseMatches[existingIdx].status = m.status;
                              baseMatches[existingIdx].startTime = m.startTime;
                          } else {
                              baseMatches.push(m);
                          }
                      }
                  });
              }
          }).catch(function(e) { console.error('Error fetching WWE events schedule', e); lg('Error fetching WWE events schedule', e); })
      );
  } else {
      espnPaths.forEach(function(path) {
          promises.push(
            fetchEspnSchedule(path, todayStr).then(function(data) {
            if(!data || !data.events) return;
            data.events.forEach(function(ev) {
              var leagueName = data.leagues && data.leagues[0] ? data.leagues[0].name : path;
              var isRacing = leagueName && (leagueName.toLowerCase().indexOf('f1') > -1 || leagueName.toLowerCase().indexOf('indycar') > -1 || path.indexOf('racing') > -1) || path.indexOf('racing') > -1;
              var compsToProcess = isRacing ? ev.competitions : (ev.competitions.length > 0 ? [ev.competitions[0]] : []);

              compsToProcess.forEach(function(comp) {
                if(!comp) return;

                if (!isRacing) {
                  if(!comp.competitors) return;
                  var home = comp.competitors.find(function(c){return c.homeAway==='home';});
                  var away = comp.competitors.find(function(c){return c.homeAway==='away';});
                  if(!home || !away) return;
                }

              var status = 'upcoming';
              if(ev.status.type.state === 'in') status = 'live';
              if(ev.status.type.state === 'post') status = 'finished';

              var score = null;
              if(status !== 'upcoming' && !isRacing) {
                var homeScoreObj = comp.competitors.find(function(c){return c.homeAway==='home';});
                var awayScoreObj = comp.competitors.find(function(c){return c.homeAway==='away';});
                if (homeScoreObj && awayScoreObj && homeScoreObj.score !== undefined && awayScoreObj.score !== undefined) {
                    score = [parseInt(homeScoreObj.score), parseInt(awayScoreObj.score)];
                }
              }

              var minute = null;
              if(status === 'live' && ev.status.displayClock) {
                minute = ev.status.displayClock;
              } else if(status === 'live' && ev.status.period) {
                minute = 'P' + ev.status.period;
              }

              var isPlayoff = ev.season && ev.season.type === 3;

              var matchId = isRacing ? 'espn_' + ev.id + '_' + comp.id : 'espn_' + ev.id;
              var existingMatch = baseMatchesById[matchId];
              if (existingMatch) {
                  existingMatch.status = status;
                  existingMatch.score = score;
                  existingMatch.minute = minute;
                  existingMatch.isPlayoff = isPlayoff;
              }
              }); // end compsToProcess
            });
          })
        );
      });
  }

  return Promise.allSettled(promises).then(function(){
    var filtered = filterBuggyMatches(baseMatches);

    // Inject stream cache before returning
    filtered.forEach(function(m) {
        var cachedStreams = getStreamCache(m.id);
        if (cachedStreams && cachedStreams.length > 0) {
            if (!m.streamLinks) m.streamLinks = [];
            var combinedLinks = m.streamLinks.slice();
            cachedStreams.forEach(function(cs) {
                if (!combinedLinks.find(function(ex) { return ex.url === cs.url; })) {
                    combinedLinks.push(cs);
                }
            });
            m.streamLinks = combinedLinks;
            m.streamsLoaded = true;
        }
    });

    try {
        var fetchDateToSave = todayStr;
        if (!needsFullFetch && cache && cache.fetchDate) {
            fetchDateToSave = cache.fetchDate; // Keep original fetch date if not full fetch
        }
        var cacheData = filtered.map(function(m) {
            // we no longer want to strip out streams if they exist so they aren't lost on refresh
            return Object.assign({}, m);
        });
        safeStorageSetJSON('api_calendar_cache_' + todayStr, { fetchDate: fetchDateToSave, matches: cacheData });
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

         // Filter out nonsense matches (TBD, TBA, Winner, missing teams)
         var htLower = (sm.homeTeam || '').toLowerCase().trim();
         var atLower = (sm.awayTeam || '').toLowerCase().trim();
         var isInvalidTeam = function(t) {
             return t === 'tbd' || t === 'tba' || t === 'tbc' || t === 'winner' || t.indexOf('vainqueur') !== -1;
         };
         // Drop if BOTH teams are empty, or if any team is explicitly invalid
         if ((!htLower && !atLower) || isInvalidTeam(htLower) || isInvalidTeam(atLower)) {
             return;
         }

         // Flux that do not match an API match are kept but categorized distinctly
         // so they appear separated from the official API timeline, usually at the bottom.
         var safeH = sm.homeTeam ? normName(sm.homeTeam) : 'unk';
         var safeA = sm.awayTeam ? normName(sm.awayTeam) : 'unk';

         // Use a deterministic ID based on teams if available. If both are unknown, fallback to a unique identifier
         // incorporating the URL or name to prevent colliding all unknown streams into a single "undefined" card.
         var determStr = safeH + '_' + safeA;
         if (safeH === 'unk' && safeA === 'unk') {
             var hashStr = (sm.matchUrl || '') + '_' + (sm.name || '') + '_' + (sm.source || '');
             var hash = 0;
             for (var j = 0; j < hashStr.length; j++) {
                 hash = ((hash << 5) - hash) + hashStr.charCodeAt(j);
                 hash |= 0;
             }
             determStr = 'unk_' + Math.abs(hash);
         }
         sm.id = 'scraped_' + encodeURIComponent(determStr);
         if (!sm.matchDate) sm.matchDate = targetDateStr;
         sm.scrapedLeagueName = sm.league ? formatLeagueName(sm.league) : 'Autres Flux';
         sm.league = 'Autres Flux';
         sm.streamsLoaded = true;
         sm.flag = '📡';
         sm.color = '#555555';

         apiMatches.push(sm);

         if (!skipScraping) {
             addScrapeLog(sm.matchUrl || 'Merge Failure', 'error', 'Unmerged: ' + sm.homeTeam + ' vs ' + sm.awayTeam + ' (' + (sm.source || 'unknown') + ')');
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
      var prevMatch = S.matchMap ? S.matchMap.get(String(am.id)) : null;
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
          am.refreshedOnStart = prevMatch.refreshedOnStart;
          am.refreshedOnStartScrape = prevMatch.refreshedOnStartScrape;
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
        'possessionPct': 'Possession',
        'shots': 'Tirs',
        'totalShots': 'Tirs',
        'shotsTotal': 'Tirs',
        'shotsOnTarget': 'Tirs Cadrés',
        'shotPct': 'Précision Tirs',
        'fouls': 'Fautes',
        'foulsCommitted': 'Fautes',
        'yellowCards': 'Cartons Jaunes',
        'redCards': 'Cartons Rouges',
        'cornerKicks': 'Corners',
        'wonCorners': 'Corners',
        'offsides': 'Hors-jeux',
        'saves': 'Arrêts',
        'expectedGoals': 'Buts Attendus (xG)',
        'passes': 'Passes',
        'totalPasses': 'Passes',
        'accuratePasses': 'Passes Précises',
        'passAccuracy': 'Précision Passes',
        'passPct': 'Précision Passes',
        'tackles': 'Tacles',
        'totalTackles': 'Tacles',
        'effectiveTackles': 'Tacles Réussis',
        'tacklePct': 'Précision Tacles',
        'interceptions': 'Interceptions',
        'clearances': 'Dégagements',
        'totalClearance': 'Dégagements',
        'effectiveClearance': 'Dégagements Réussis',
        'aerialsWon': 'Duels Aériens Gagnés',
        'blocks': 'Contres',
        'blockedShots': 'Tirs Contrés',
        'freeKicks': 'Coups Francs',
        'goalKicks': 'Six Mètres',
        'throwIns': 'Touches',
        'penaltyKickGoals': 'Buts sur Penalty',
        'penaltyKickShots': 'Penaltys Tirés',
        'accurateCrosses': 'Centres Précis',
        'totalCrosses': 'Centres',
        'crossPct': 'Précision Centres',
        'totalLongBalls': 'Passes Longues',
        'accurateLongBalls': 'Passes Longues Précises',
        'longballPct': 'Précision Passes Longues',
        'hits': 'Mises en échec',
        'takeaways': 'Revirements provoqués',
        'giveaways': 'Revirements',
        'faceoffsWon': 'Mises en jeu gagnées',
        'faceoffPercent': 'Précision Mises en jeu',
        'penalties': 'Pénalités',
        'penaltyMinutes': 'Minutes de pénalité',
        'powerPlayGoals': 'Buts Avantage Numérique',
        'powerPlayOpportunities': 'Occasions Avantage Num.',
        'powerPlayPct': 'Précision Avantage Num.',
        'shortHandedGoals': 'Buts Désavantage Numérique',
        'shootoutGoals': 'Buts Tirs au but'
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

    // Sort all events by time to create a chronological timeline
    var allScorers = [];
    hScorers.forEach(function(s) { s._side = 'home'; allScorers.push(s); });
    aScorers.forEach(function(s) { s._side = 'away'; allScorers.push(s); });

    allScorers.sort(function(a, b) {
        var tA = parseInt(a.time) || 0;
        var tB = parseInt(b.time) || 0;
        return tA - tB;
    });

    var html = '<div style="display:flex; flex-direction:column; gap:8px; width:100%; font-size:13px; margin-top:8px; background:rgba(255,255,255,0.02); padding:12px; border-radius:12px;">';

    var lgUpper = m && m.league ? m.league.toUpperCase() : '';
    var isBaseball = lgUpper === 'MLB' || lgUpper.indexOf('BASEBALL') > -1;
    var timeLabel = isBaseball ? 'Manches' : 'Temps';

    // Header
    html += '<div style="display:flex; justify-content:space-between; padding-bottom:8px; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); font-weight:700; color:var(--muted2); font-size:11px; text-transform:uppercase;">';
    html += '<div style="flex:1;">' + esc(m.homeTeam) + '</div>';
    html += '<div style="width:60px; text-align:center;">' + timeLabel + '</div>';
    html += '<div style="flex:1; text-align:right;">' + esc(m.awayTeam) + '</div>';
    html += '</div>';

    allScorers.forEach(function(s) {
        html += '<div style="display:flex; align-items:center; width:100%; gap:8px;">';
        if (s._side === 'home') {
            html += '<div style="flex:1; display:flex; align-items:center; gap:8px; color:#fff; font-weight:600;"><div style="width:20px; height:20px; border-radius:10px; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:10px;">⚽</div><div style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(s.player) + '</div></div>';
            html += '<div style="width:60px; text-align:center; font-weight:700; color:var(--accent);">' + esc(s.time) + '</div>';
            html += '<div style="flex:1;"></div>';
        } else {
            html += '<div style="flex:1;"></div>';
            html += '<div style="width:60px; text-align:center; font-weight:700; color:var(--accent);">' + esc(s.time) + '</div>';
            html += '<div style="flex:1; display:flex; align-items:center; justify-content:flex-end; gap:8px; color:#fff; font-weight:600;"><div style="flex:1; text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(s.player) + '</div><div style="width:20px; height:20px; border-radius:10px; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:10px;">⚽</div></div>';
        }
        html += '</div>';
    });

    html += '</div>';
    return html;
}

export function fetchGameStats(matchId) {
    if(matchId.startsWith('espn_')) {
        var espnId = matchId.split('_')[1];
        var m = S.matchMap.get(String(matchId));
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
            var articlePhoto = null, articleText = null, espnLink = null;

            if (data.article) {
                var article = Array.isArray(data.article) ? data.article[0] : data.article;
                if (article) {
                    articleText = article.description || article.headline || null;
                    if (article.images && article.images.length > 0) {
                        articlePhoto = article.images[0].url;
                    }
                }
            }
            if (data.header && data.header.links) {
                var sumLink = data.header.links.find(function(l) { return l.rel && l.rel.indexOf('summary') > -1; });
                if (sumLink) {
                    espnLink = sumLink.href;
                }
            }

            if (data.header && data.header.competitions && data.header.competitions[0]) {
                var comp = data.header.competitions[0];
                if (comp.details) {
                    comp.details.forEach(function(d) {
                        if (d.scoringPlay && d.participants && d.participants[0] && d.participants[0].athlete) {
                            var time = d.clock && d.clock.displayValue ? d.clock.displayValue : '';
                            var player = d.participants[0].athlete.shortName || d.participants[0].athlete.displayName;
                            var passer = (d.participants.length > 1 && d.participants[1].athlete) ? (d.participants[1].athlete.shortName || d.participants[1].athlete.displayName) : null;
                            var teamId = d.team && d.team.id ? d.team.id : null;
                            scorers.push({ time: time, player: player, teamId: teamId, passer: passer });
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
            return { source: 'espn', data: data, scorers: scorers, hRank: hRank, aRank: aRank, hForm: hForm, aForm: aForm, articlePhoto: articlePhoto, articleText: articleText, espnLink: espnLink };
        }).catch(function(e) {
            return Promise.reject(e);
        });
    }

    return Promise.reject('Unsupported source');
}


export function fetchTeamInfo(leagueName, teamId) {
    var path = 'soccer/eng.1'; // fallback
    for (var k in ESPN_LEAGUES) {
        if (k.toLowerCase() === leagueName.toLowerCase() || leagueName.toLowerCase().indexOf(k.toLowerCase()) > -1) {
            path = ESPN_LEAGUES[k];
            break;
        }
    }
    // Fetch base team info and roster info in parallel
    var teamUrl = 'https://site.api.espn.com/apis/site/v2/sports/' + path + '/teams/' + teamId;
    var rosterUrl = 'https://site.api.espn.com/apis/site/v2/sports/' + path + '/teams/' + teamId + '/roster';

    return Promise.all([
        fetch(teamUrl, { signal: AbortSignal.timeout(8000) }).then(function(r){ return r.json(); }),
        fetch(rosterUrl, { signal: AbortSignal.timeout(8000) }).then(function(r){ return r.json(); }).catch(function(){ return null; }) // Roster might 404 for some sports
    ]).then(function(results) {
        return { source: 'espn', team: results[0], roster: results[1] };
    }).catch(function(e) {
        return Promise.reject(e);
    });
}

export function fetchTeamSchedule(leagueName, teamId) {
    var path = 'soccer/eng.1'; // fallback
    for (var k in ESPN_LEAGUES) {
        if (k.toLowerCase() === leagueName.toLowerCase() || leagueName.toLowerCase().indexOf(k.toLowerCase()) > -1) {
            path = ESPN_LEAGUES[k];
            break;
        }
    }
    var url = 'https://site.api.espn.com/apis/site/v2/sports/' + path + '/teams/' + teamId + '/schedule';
    return fetch(url, { signal: AbortSignal.timeout(8000) }).then(function(r){ return r.json(); }).then(function(data) {
        if (data && data.events && data.events.length === 0) {
            // If empty, try regular season (seasontype=2)
            var rsUrl = url + '?seasontype=2';
            return fetch(rsUrl, { signal: AbortSignal.timeout(8000) }).then(function(rs){ return rs.json(); }).then(function(rsData) {
                return { source: 'espn', data: rsData };
            });
        }
        return { source: 'espn', data: data };
    }).catch(function(e) {
        return Promise.reject(e);
    });
}

export function fetchLeagueStandings(leagueName, seasonType) {
    var path = 'soccer/eng.1'; // fallback
    for (var k in ESPN_LEAGUES) {
        if (k.toLowerCase() === leagueName.toLowerCase() || leagueName.toLowerCase().indexOf(k.toLowerCase()) > -1) {
            path = ESPN_LEAGUES[k];
            break;
        }
    }
    var url = 'https://site.api.espn.com/apis/v2/sports/' + path + '/standings' + (seasonType ? '?seasontype=' + seasonType : '');
    return fetch(url, { signal: AbortSignal.timeout(8000) }).then(function(r){ return r.json(); }).then(function(data) {
        var seasons = data.seasons && data.seasons.length > 0 && data.seasons[0].types ? data.seasons[0].types : [];
        return { source: 'espn', data: data, seasonTypes: seasons, leaguePath: path };
    }).catch(function(e) {
        return Promise.reject(e);
    });
}



// Global bindings for HTML compatibility
window.ESPN_LEAGUES = ESPN_LEAGUES;
window.getEspnDateStr = getEspnDateStr;
window.fetchEspnSchedule = fetchEspnSchedule;
window.filterBuggyMatches = filterBuggyMatches;
window.TARGET_DATE = TARGET_DATE;
window.setApiTargetDate = setApiTargetDate;
window.getApiFirstMatches = getApiFirstMatches;
window.mergeFluxToApi = mergeFluxToApi;
window.formatStatLabel = formatStatLabel;
window.renderScorersHtml = renderScorersHtml;
window.fetchGameStats = fetchGameStats;
window.fetchLeagueStandings = fetchLeagueStandings;
window.fetchTeamSchedule = fetchTeamSchedule;

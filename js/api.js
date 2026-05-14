import { pad, lg, getLeagueDuration, fetchPage, esc } from './utils.js';
import { getEstTimeStrFromDate, getEstDateStrFromDate } from './config.js';
import { formatLeagueName, lgFlag, lgColor, getOfficialTeamName } from './db.js';
import { isMatch, isMatchPair } from './match.js';
import { parsePWHLSchedule } from './scrapers.js';
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
  'f1': 'racing/f1',
  'formula 1': 'racing/f1',
  'cfl': 'football/cfl',
  'indycar': 'racing/irl'
};

export function getEspnDateStr(d) {
  return d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate());
}

export function fetchEspnSchedule(leaguePath, dateStr) {
  var url = 'https://site.api.espn.com/apis/site/v2/sports/' + leaguePath + '/scoreboard?dates=' + dateStr;
  return fetch(url, { signal: AbortSignal.timeout(8000) }).then(function(res) { return res.json(); }).catch(function(){ return null; });
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


/* ══ API FIRST LOGIC ══════════════════ */
export var TARGET_DATE = new Date();

export function setApiTargetDate(d) {
  TARGET_DATE = d;
  window.TARGET_DATE = d;
}

export function getApiFirstMatches(targetDate) {
  var todayStr = getEspnDateStr(targetDate || new Date());
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
                var isPlayoff = ev.season && ev.season.type === 3;

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

              var isPlayoff = ev.season && ev.season.type === 3;

              var matchId = 'espn_' + ev.id;
              var existingMatch = baseMatchesById[matchId];
              if (existingMatch) {
                  existingMatch.status = status;
                  existingMatch.score = score;
                  existingMatch.minute = minute;
                  existingMatch.isPlayoff = isPlayoff;
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

         // Flux that do not match an API match are kept but categorized distinctly
         // so they appear separated from the official API timeline, usually at the bottom.
         sm.id = 'scraped_' + Date.now() + '_' + Math.floor(Math.random()*1000);
         if (!sm.matchDate) sm.matchDate = targetDateStr;
         sm.league = 'Autres Flux';
         sm.streamsLoaded = true;
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

    // Header
    html += '<div style="display:flex; justify-content:space-between; padding-bottom:8px; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); font-weight:700; color:var(--muted2); font-size:11px; text-transform:uppercase;">';
    html += '<div style="flex:1;">' + esc(m.homeTeam) + '</div>';
    html += '<div style="width:40px; text-align:center;">Temps</div>';
    html += '<div style="flex:1; text-align:right;">' + esc(m.awayTeam) + '</div>';
    html += '</div>';

    allScorers.forEach(function(s) {
        html += '<div style="display:flex; align-items:center; width:100%; gap:8px;">';
        if (s._side === 'home') {
            html += '<div style="flex:1; display:flex; align-items:center; gap:8px; color:#fff; font-weight:600;"><div style="width:20px; height:20px; border-radius:10px; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:10px;">⚽</div><div style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(s.player) + '</div></div>';
            html += '<div style="width:40px; text-align:center; font-weight:700; color:var(--accent);">' + esc(s.time) + '</div>';
            html += '<div style="flex:1;"></div>';
        } else {
            html += '<div style="flex:1;"></div>';
            html += '<div style="width:40px; text-align:center; font-weight:700; color:var(--accent);">' + esc(s.time) + '</div>';
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
                    espnLink = sumLink.href.replace('/match/', '/preview/').replace('/game/', '/preview/');
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

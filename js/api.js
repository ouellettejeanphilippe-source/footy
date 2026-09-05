import { lg, getLeagueDuration, fetchPage, esc } from './utils.js';
import { getEstTimeStrFromDate, getEstDateStrFromDate } from './config.js';
import { formatLeagueName, lgFlag, lgColor, getOfficialTeamName, normName, leagueTier, resolvePairing } from './db.js';
import { isMatch, isMatchPair, mergeAltUrls } from './match.js';
import { parsePWHLSchedule, parseF1Ics, parseIndycarIcs, parseSportsDbEvents } from './scrapers.js';
import { addScrapeLog, S } from './state.js';
import { safeStorageGetJSON, safeStorageSetJSON } from './utils.js';

/* ══ ESPN API FALLBACK & API-SPORTS ════════════ */
/* Endpoints ESPN partagés par le client et par scripts/scrape_schedule.mjs.
   Les deux listes DOIVENT rester identiques : tests/unit_leagues.test.js le vérifie.
   Chaque chemin a été testé (scoreboard HTTP 200) ; les endpoints morts (wwe/wwe,
   boxing/boxing, hockey/…-professional-hockey-league renvoient 400) ont été retirés :
   WWE et la boxe viennent des agrégateurs, la PWHL de thepwhl.com (parsePWHLSchedule). */
export var ESPN_LEAGUES = {
  // Soccer
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
  'fifa world cup': 'soccer/fifa.world',
  'fifa women\'s world cup': 'soccer/fifa.wwc',
  'nwsl': 'soccer/usa.nwsl',
  // Basketball
  'nba': 'basketball/nba',
  'basketball': 'basketball/nba',
  'wnba': 'basketball/wnba',
  'euroleague': 'basketball/euroleague',
  'fiba world cup': 'basketball/fiba',
  'ncaa men\'s basketball': 'basketball/mens-college-basketball',
  'olympics men\'s basketball': 'basketball/mens-olympics-basketball',
  'ncaa women\'s basketball': 'basketball/womens-college-basketball',
  // Hockey
  'nhl': 'hockey/nhl',
  'hockey': 'hockey/nhl',
  'ice hockey': 'hockey/nhl',
  'world hockey championships': 'hockey/hockey-world-cup',
  'world cup of hockey': 'hockey/hockey-world-cup',
  'ncaa men\'s ice hockey': 'hockey/mens-college-hockey',
  'olympics men\'s ice hockey': 'hockey/olympics-mens-ice-hockey',
  'olympics women\'s ice hockey': 'hockey/olympics-womens-ice-hockey',
  'ncaa women\'s hockey': 'hockey/womens-college-hockey',
  // Football américain et baseball
  'nfl': 'football/nfl',
  'american football': 'football/nfl',
  'american-football': 'football/nfl',
  'cfl': 'football/cfl',
  'ncaa football': 'football/college-football',
  'mlb': 'baseball/mlb',
  'baseball': 'baseball/mlb',
  'world baseball classic': 'baseball/world-baseball-classic',
  // Sports mécaniques
  'f1': 'racing/f1',
  'formula 1': 'racing/f1',
  'formula-1': 'racing/f1',
  'indycar': 'racing/irl',
  'nascar': 'racing/nascar-premier',
  // Combat, tennis, golf, rugby
  'mma': 'mma/ufc',
  'ufc': 'mma/ufc',
  'tennis': 'tennis/atp',
  'atp': 'tennis/atp',
  'wta': 'tennis/wta',
  'golf': 'golf/pga',
  'pga': 'golf/pga',
  'top 14': 'rugby/270559',
  'premiership rugby': 'rugby/267979'
};

var _leaguePathCache = Object.create(null);
export function getEspnPath(leagueName) {
    if (!leagueName) return 'soccer/eng.1';
    var lower = leagueName.toLowerCase();
    if (_leaguePathCache[lower]) {
        return _leaguePathCache[lower];
    }

    var path = 'soccer/eng.1';
    for (var k in ESPN_LEAGUES) {
        var lowerK = k.toLowerCase();
        if (lowerK === lower || lower.indexOf(lowerK) > -1) {
            path = ESPN_LEAGUES[k];
            break;
        }
    }
    _leaguePathCache[lower] = path;
    return path;
}

export function getEspnDateStr(d) {
  var formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
  });
  return formatter.format(d).replace(/-/g, '');
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

export function fetchLolEsportsEventDetails(id) {
    var url = 'https://esports-api.lolesports.com/persisted/gw/getEventDetails?hl=en-US&id=' + id;
    return fetch(url, {
        headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' },
        signal: AbortSignal.timeout(8000)
    }).then(function(res) { return res.json(); }).catch(function(){ return null; });
}


/* ══ API FIRST LOGIC ══════════════════ */
export var TARGET_DATE = new Date();

export function setApiTargetDate(d) {
  TARGET_DATE = d;
  window.TARGET_DATE = d;
}

/* Rafraîchissement des scores en direct.

   Il était armé DANS la seule branche qui lit `data/schedule.json`, et cette branche
   n'est prise qu'au tout premier chargement de la journée : ensuite, le calendrier du
   jour est servi depuis le stockage local et la fonction rend son résultat avant même
   d'y arriver. L'intervalle n'était donc jamais posé sur un rechargement, et le
   `loadAll` périodique de main.js ne faisait que relire ce même cache — figé aux scores
   du premier chargement. D'où des scores justes à l'ouverture, puis qui ne bougent plus.

   On l'arme donc à part, une fois, quel que soit le chemin qui a fourni les matchs, et
   seulement pour aujourd'hui : un jour passé n'a pas de score à suivre.

   Le retour au premier plan compte autant que l'intervalle : sur téléphone, l'onglet est
   gelé en arrière-plan et les minuteries ne s'exécutent pas. Sans cela, revenir sur
   l'application après une heure affiche les scores d'il y a une heure jusqu'au prochain
   tic. On rafraîchit donc aussi dès que la page redevient visible, en espaçant d'une
   minute au minimum pour ne pas marteler l'API à chaque va-et-vient. */
export var SCORE_REFRESH_MS = 5 * 60 * 1000;
export var SCORE_REFRESH_MIN_GAP_MS = 60 * 1000;
var dernierRafraichissement = 0;

export function refreshLiveScores(raison) {
    var maintenant = Date.now();
    if (maintenant - dernierRafraichissement < SCORE_REFRESH_MIN_GAP_MS) return Promise.resolve(null);
    dernierRafraichissement = maintenant;
    lg('scores: rafraîchissement (' + (raison || 'intervalle') + ')');
    return backgroundUpdateGuide(new Date());
}

export function startLiveScoreRefresh() {
    if (typeof window === 'undefined' || window._backgroundRefreshStarted) return false;
    window._backgroundRefreshStarted = true;
    setInterval(function() { refreshLiveScores('intervalle'); }, SCORE_REFRESH_MS);
    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) refreshLiveScores('retour au premier plan');
        });
    }
    return true;
}

export function getApiFirstMatches(targetDate, forceRefresh) {
  var targetDateObj = targetDate || new Date();
  var targetDateStr = getEstDateStrFromDate(targetDateObj);
  var todayStr = getEspnDateStr(targetDateObj);
  var cache = safeStorageGetJSON('api_calendar_cache_' + todayStr);

  /* Avant tout retour anticipé : c'est justement le retour anticipé sur le cache local
     qui empêchait l'armement. */
  if (targetDateStr === getEstDateStrFromDate(new Date())) startLiveScoreRefresh();

  var needsFullFetch = !cache || cache.fetchDate !== todayStr || forceRefresh;

  if (!needsFullFetch && cache && cache.matches) {
      return Promise.resolve(cache.matches);
  }

  // Always try to load the server-generated schedule.json on startup for today
  if (!forceRefresh && targetDateStr === getEstDateStrFromDate(new Date())) {
      return fetch('data/schedule.json?t=' + Date.now())
          .then(function(res) {
              if (!res.ok) throw new Error("JSON Cache not found");
              return res.json();
          })
          .then(function(cacheData) {
              if (cacheData && cacheData.fetchDate === todayStr && cacheData.matches) {
                  safeStorageSetJSON('api_calendar_cache_' + todayStr, { fetchDate: todayStr, matches: cacheData.matches });

                  return cacheData.matches;
              } else {
                  throw new Error("Cache outdated");
              }
          })
          .catch(function(err) {
              // Fallback if schedule.json is missing or invalid: do it the old way.
              return fetchAndProcessApiMatches(targetDateObj, todayStr, targetDateStr);
          });
  }

  return fetchAndProcessApiMatches(targetDateObj, todayStr, targetDateStr);
}

export function backgroundUpdateGuide(targetDateObj) {
    var todayStr = getEspnDateStr(targetDateObj || new Date());
    var targetDateStr = getEstDateStrFromDate(targetDateObj || new Date());

    return fetchAndProcessApiMatches(targetDateObj || new Date(), todayStr, targetDateStr).then(function(matches) {
        if (typeof window.updateLiveScores === 'function') {
            window.updateLiveScores(matches); // Pass the updated matches array
        }
        return matches;
    }).catch(function(err) {
        console.error("Background update failed", err);
    });
}

window.backgroundUpdateGuide = backgroundUpdateGuide;

function fetchAndProcessApiMatches(targetDateObj, todayStr, targetDateStr) {
  var promises = [];
  var baseMatches = [];

  var baseMatchesById = {};
  for (var i = 0; i < baseMatches.length; i++) {
      if (baseMatches[i].id) {
          baseMatchesById[baseMatches[i].id] = baseMatches[i];
      }
  }

  var espnPaths = Array.from(new Set(Object.values(ESPN_LEAGUES || {})));

  function processEspnData(data, path) {
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
        });
      });
  }

  // Always fetch directly when falling back to this method
  espnPaths.forEach(function(path) {
      promises.push(
        fetchEspnSchedule(path, todayStr).then(function(data) {
          if(!data || !data.events) return;
          processEspnData(data, path);
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
                  m.startTime = getEstTimeStrFromDate(dateObj);

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

  /* Combat (WWE, AEW, boxe, UFC, ONE...) : ESPN n'expose aucun de ces sports — son
     répertoire ne contient ni « wwe » ni « boxing », et sports/wwe/wwe comme
     boxing/boxing renvoient HTTP 400. TheSportsDB les fournit (CORS ouvert, appel direct).
     Voir parseSportsDbEvents (js/scrapers.js). */
  var addFightIfNew = function(m) {
      var existingIdx = baseMatches.findIndex(function(existing) {
          if (existing.matchDate !== m.matchDate) return false;
          return existing.id === m.id || (isMatch(existing.homeTeam, m.homeTeam) && isMatch(existing.awayTeam, m.awayTeam));
      });
      if (existingIdx === -1) baseMatches.push(m);
      return existingIdx === -1;
  };

  /* Repli quand TheSportsDB ne répond pas : les rendez-vous hebdomadaires de catch, qui
     reviennent aux mêmes jours. Utilisé uniquement si la vraie source n'a rien donné,
     sinon on afficherait un doublon à côté de l'événement réel (« NXT #853 »). */
  var addWeeklyWrestlingFallback = function() {
      var dateObjTarget = new Date(targetDateStr + 'T12:00:00Z'); // midi UTC : jour de semaine fiable
      var byDay = {
          1: { id: 'wwe_raw_', home: 'WWE', away: 'Raw' },
          2: { id: 'wwe_nxt_', home: 'WWE', away: 'NXT' },
          3: { id: 'aew_dynamite_', home: 'AEW', away: 'Dynamite' },
          5: { id: 'wwe_smackdown_', home: 'WWE', away: 'SmackDown' }
      };
      var show = byDay[dateObjTarget.getUTCDay()];
      if (!show) return;
      var m = { id: show.id + targetDateStr, homeTeam: show.home, awayTeam: show.away, matchDate: targetDateStr, startTime: '20:00' };
      m.league = formatLeagueName(show.home);
      m.flag = lgFlag(m.league);
      m.color = lgColor(m.league);
      m.source = 'api';
      m.status = 'upcoming';
      m.durationMinutes = getLeagueDuration(m.league);
      addFightIfNew(m);
  };

  promises.push(
      /* Sans délai maximal, cette requête était la seule du lot à pouvoir suspendre
         Promise.all indéfiniment (les autres appels ESPN/LoL portent déjà un
         AbortSignal.timeout de 8 s) : le calendrier entier restait alors en attente. */
      fetch('https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=' + targetDateStr + '&s=Fighting', { signal: AbortSignal.timeout(8000) })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
            var fights = data ? parseSportsDbEvents(data, targetDateStr) : [];
            fights.forEach(addFightIfNew);
            lg('Combat (TheSportsDB)', fights.length + ' événements');
            var hasWrestling = fights.some(function(m) { return /^(WWE|AEW)$/i.test(m.league); });
            if (!hasWrestling) addWeeklyWrestlingFallback();
        }).catch(function(e) {
            lg('TheSportsDB indisponible', e && e.message ? e.message : e);
            addWeeklyWrestlingFallback();
        })
  );

  // Fetch F1 Schedule
  promises.push(
      fetchPage('https://ics.ecal.com/ecal-sub/65cfbda721adce1847679093/Formula%201.ics').then(function(icsData) {
          if (icsData) {
              var f1Events = parseF1Ics(icsData, targetDateStr);
              f1Events.forEach(function(m) {
                  m.flag = lgFlag('F1');
                  m.color = lgColor('F1');
                  m.source = 'api';
                  m.league = formatLeagueName('F1');
                  m.status = 'upcoming';
                  m.durationMinutes = getLeagueDuration('F1');

                  var existingIdx = baseMatches.findIndex(function(existing) {
                      return isMatch(existing.homeTeam, m.homeTeam) && isMatch(existing.awayTeam, m.awayTeam) && existing.matchDate === m.matchDate;
                  });

                  if (existingIdx >= 0) {
                      baseMatches[existingIdx].startTime = m.startTime;
                  } else {
                      baseMatches.push(m);
                  }
              });
          }
      }).catch(function(e) { console.error('Error fetching F1 ICS schedule', e); lg('Error fetching F1 ICS schedule', e); })
  );

  // Fetch IndyCar Schedule
  promises.push(
      fetchPage('https://www.indycar.com/-/media/Files/2024/ICS/INDYCAR.ics').then(function(icsData) {
          if (icsData) {
              var indyEvents = parseIndycarIcs(icsData, targetDateStr);
              indyEvents.forEach(function(m) {
                  m.flag = lgFlag('IndyCar');
                  m.color = lgColor('IndyCar');
                  m.source = 'api';
                  m.league = formatLeagueName('IndyCar');
                  m.status = 'upcoming';
                  m.durationMinutes = getLeagueDuration('IndyCar');

                  var existingIdx = baseMatches.findIndex(function(existing) {
                      return isMatch(existing.homeTeam, m.homeTeam) && isMatch(existing.awayTeam, m.awayTeam) && existing.matchDate === m.matchDate;
                  });

                  if (existingIdx >= 0) {
                      baseMatches[existingIdx].startTime = m.startTime;
                  } else {
                      baseMatches.push(m);
                  }
              });
          }
      }).catch(function(e) { console.error('Error fetching IndyCar ICS schedule', e); lg('Error fetching IndyCar ICS schedule', e); })
  );

  // Fetch WWE PLE Schedule
  promises.push(
      fetchPage('https://wwe.com/events').then(function(html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var scripts = doc.querySelectorAll('script');
          var evtData = null;
          for(var i=0; i<scripts.length; i++) {
              if (scripts[i].textContent.includes('window.__PRELOADED_STATE__')) {
                  var js_m = scripts[i].textContent.match(/window\.__PRELOADED_STATE__\s*=\s*(\{.*?\});/);
                  if (js_m && js_m[1]) {
                      try {
                          var st = JSON.parse(js_m[1]);
                          evtData = st;
                          break;
                      }catch(e){}
                  }
              }
          }
          if (evtData && evtData.events && evtData.events.events) {
              var evList = evtData.events.events;
              evList.forEach(function(ev) {
                  var dateObj = new Date(ev.startDate);
                  var evDateStr = getEstDateStrFromDate(dateObj);
                  if (evDateStr === targetDateStr) {
                      var title = ev.title || ev.description || 'WWE Event';
                      if (title.toLowerCase().includes('raw') || title.toLowerCase().includes('smackdown') || title.toLowerCase().includes('nxt')) {
                          return; // Handled by weekly synthesizer above
                      }
                      var matchObj = {
                          id: 'wwe_ple_' + ev.id,
                          homeTeam: 'WWE',
                          awayTeam: title.replace(/^wwe\s+/i, '').trim(),
                          matchDate: evDateStr,
                          startTime: getEstTimeStrFromDate(dateObj),
                          league: formatLeagueName('WWE'),
                          flag: lgFlag('WWE'),
                          color: lgColor('WWE'),
                          source: 'api',
                          status: 'upcoming',
                          durationMinutes: getLeagueDuration('WWE')
                      };

                      var existingIdx = baseMatches.findIndex(function(existing) {
                          return existing.id === matchObj.id || (isMatch(existing.homeTeam, matchObj.homeTeam) && isMatch(existing.awayTeam, matchObj.awayTeam) && existing.matchDate === matchObj.matchDate);
                      });
                      if (existingIdx === -1) {
                          baseMatches.push(matchObj);
                      }
                  }
              });
          }
      }).catch(function(e) { console.error('Error fetching WWE events schedule', e); lg('Error fetching WWE events schedule', e); })
  );

  var targetLeagues = ['lcs', 'lec', 'lck', 'lpl', 'pcs', 'vcs', 'ljl', 'lla', 'cblol', 'world_championship', 'msi'];

  promises.push(
      fetchLolEsportsSchedule(targetDateObj).then(function(data) {
          if (!data || !data.data || !data.data.schedule || !data.data.schedule.events) return;
          data.data.schedule.events.forEach(function(ev) {
              if (ev.type !== 'match') return;
              if (!ev.match || !ev.match.teams || ev.match.teams.length < 2) return;
              if (!ev.league || !ev.league.slug) return;

              var leagueSlug = ev.league.slug.toLowerCase();
              if (targetLeagues.indexOf(leagueSlug) === -1) return;

              var dateObj = new Date(ev.startTime);
              var mDate = getEstDateStrFromDate(dateObj);
              if (mDate !== targetDateStr) return;

              var t1 = ev.match.teams[0];
              var t2 = ev.match.teams[1];

              var status = ev.state === 'inProgress' ? 'live' : (ev.state === 'completed' ? 'finished' : 'upcoming');
              var score = null;
              if (status !== 'upcoming') {
                  score = [t1.result && t1.result.gameWins ? t1.result.gameWins : 0, t2.result && t2.result.gameWins ? t2.result.gameWins : 0];
              }

              var m = {
                  id: 'lol_' + ev.match.id,
                  league: formatLeagueName(ev.league.name),
                  flag: lgFlag(ev.league.name),
                  color: lgColor(ev.league.name),
                  homeTeam: t1.name || t1.code,
                  awayTeam: t2.name || t2.code,
                  homeLogo: t1.image,
                  awayLogo: t2.image,
                  matchDate: mDate,
                  startTime: getEstTimeStrFromDate(dateObj),
                  durationMinutes: getLeagueDuration(ev.league.name),
                  status: status,
                  score: score,
                  source: 'api'
              };

              var existingIdx = baseMatches.findIndex(function(existing) { return existing.id === m.id; });
              if (existingIdx >= 0) {
                  baseMatches[existingIdx].status = m.status;
                  baseMatches[existingIdx].score = m.score;
                  baseMatches[existingIdx].startTime = m.startTime;
              } else {
                  baseMatches.push(m);
              }
          });

          // Fetch LoL live events to get stream links
          return fetchLolEsportsLiveStreams().then(function(liveData) {
              if (!liveData || !liveData.data || !liveData.data.schedule || !liveData.data.schedule.events) return;
              liveData.data.schedule.events.forEach(function(liveEv) {
                  if (liveEv.type !== 'match') return;
                  var liveMatchId = 'lol_' + liveEv.match.id;
                  var existingIdx = baseMatches.findIndex(function(existing) { return existing.id === liveMatchId; });

                  if (existingIdx >= 0) {
                      baseMatches[existingIdx].status = 'live';
                      if (liveEv.streams && liveEv.streams.length > 0) {
                          if (!baseMatches[existingIdx].streamLinks) baseMatches[existingIdx].streamLinks = [];
                          liveEv.streams.forEach(function(s) {
                              var sUrl = null;
                              if (s.provider === 'youtube') sUrl = 'https://youtube.com/watch?v=' + s.parameter;
                              if (s.provider === 'twitch') sUrl = 'https://twitch.tv/' + s.parameter;

                              if (sUrl && !baseMatches[existingIdx].streamLinks.some(function(sl){ return sl.url === sUrl; })) {
                                  baseMatches[existingIdx].streamLinks.push({
                                      name: s.locale ? ('(' + s.locale + ') ' + s.provider) : s.provider,
                                      url: sUrl,
                                      quality: '1080p',
                                      source: 'lol_esports'
                                  });
                              }
                          });
                      }
                  } else {
                       // Live match not found in today's schedule (might have started yesterday or API date mismatch)
                       // Add it manually to today's base matches if it's in target leagues
                       if (liveEv.league && liveEv.league.slug && targetLeagues.indexOf(liveEv.league.slug.toLowerCase()) > -1) {
                           if (!liveEv.match || !liveEv.match.teams || liveEv.match.teams.length < 2) return;
                           var lt1 = liveEv.match.teams[0];
                           var lt2 = liveEv.match.teams[1];
                           var lDateObj = new Date(liveEv.startTime);

                           var lm = {
                              id: liveMatchId,
                              league: formatLeagueName(liveEv.league.name),
                              flag: lgFlag(liveEv.league.name),
                              color: lgColor(liveEv.league.name),
                              homeTeam: lt1.name || lt1.code,
                              awayTeam: lt2.name || lt2.code,
                              homeLogo: lt1.image,
                              awayLogo: lt2.image,
                              matchDate: targetDateStr, // Force today's date so it appears
                              startTime: getEstTimeStrFromDate(lDateObj),
                              durationMinutes: getLeagueDuration(liveEv.league.name),
                              status: 'live',
                              score: [lt1.result && lt1.result.gameWins ? lt1.result.gameWins : 0, lt2.result && lt2.result.gameWins ? lt2.result.gameWins : 0],
                              source: 'api',
                              streamLinks: []
                          };

                          if (liveEv.streams && liveEv.streams.length > 0) {
                              liveEv.streams.forEach(function(s) {
                                  var sUrl = null;
                                  if (s.provider === 'youtube') sUrl = 'https://youtube.com/watch?v=' + s.parameter;
                                  if (s.provider === 'twitch') sUrl = 'https://twitch.tv/' + s.parameter;
                                  if (sUrl) {
                                      lm.streamLinks.push({
                                          name: s.locale ? ('(' + s.locale + ') ' + s.provider) : s.provider,
                                          url: sUrl,
                                          quality: '1080p',
                                          source: 'lol_esports'
                                      });
                                  }
                              });
                          }
                          baseMatches.push(lm);
                       }
                  }
              });
          }).catch(function(e) { console.error('Error fetching LoL live streams', e); lg('Error fetching LoL live streams', e); });

      }).catch(function(e) { console.error('Error fetching LoL schedule', e); lg('Error fetching LoL schedule', e); })
  );

  return Promise.all(promises).then(function() {
      baseMatches.sort(function(a, b) {
          return (a.startTime > b.startTime) ? 1 : ((a.startTime < b.startTime) ? -1 : 0);
      });
      safeStorageSetJSON('api_calendar_cache_' + todayStr, { fetchDate: todayStr, matches: baseMatches });
      return baseMatches;
  });
}

/* « HH:MM » en minutes depuis minuit, ou null si l'heure est absente ou factice.
   « 00:00 » est la valeur que posent les parseurs quand ils n'ont RIEN trouvé : la
   traiter comme minuit ferait croire à un écart énorme et fausserait le choix. */
function minutesOfTime(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
    if (!m) return null;
    var h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
    if (h > 23 || mi > 59) return null;
    if (h === 0 && mi === 0) return null;
    return h * 60 + mi;
}

export function mergeFluxToApi(apiMatches, scrapedMatches, skipScraping) {
  var targetDateStr = getEstDateStrFromDate(TARGET_DATE);

  if (typeof window.streamMissingCounts === 'undefined') window.streamMissingCounts = {};

  /* Ligues déjà couvertes par la grille officielle. Un flux non fusionné dont la ligue
     figure ici est un doublon potentiel (la fusion a échoué sur les noms d'équipes) :
     il reste dans « Autres streams », conformément au principe API-First. Mais quand
     l'API ne renvoie rien du tout pour cette ligue — ESPN injoignable, ou ligue absente
     d'ESPN_LEAGUES — aucun doublon n'est possible et le match garde son vrai nom de
     ligue, donc sa place dans le Guide. Sans cela, une panne d'ESPN faisait basculer
     toute la grille (NFL, MLB, NBA…) dans une section repliée « Autres streams ». */
  var apiLeagues = {};
  for (var ai = 0; ai < apiMatches.length; ai++) {
      var alKey = String(apiMatches[ai].league || '').toUpperCase().trim();
      if (alKey) apiLeagues[alKey] = true;
  }

  scrapedMatches.forEach(function(sm) {

      /* Appariement ligue / équipes / ville, AVANT la fusion avec la grille officielle :
         un flux annoncé « Baseball — Cleveland vs Detroit » devient « MLB — Cleveland
         Guardians vs Detroit Tigers », donc il a une chance de retrouver son match ESPN
         au lieu de finir dans « Autres streams ». */
      var apparie = resolvePairing(sm);
      sm.league = apparie.league;
      sm.homeTeam = apparie.homeTeam;
      sm.awayTeam = apparie.awayTeam;

      var matched = false;
      /* Programme double : deux matchs entre les MÊMES équipes le même jour.

         `isMatchPair` ne regarde que les noms — il ne connaît pas l'heure. Les deux
         rencontres s'appariaient donc aussi bien l'une que l'autre, et la boucle
         s'arrêtait à la PREMIÈRE : tous les flux atterrissaient sur le match du début
         d'après-midi, déjà terminé, et celui du soir — celui qu'on regarde — restait sans
         aucun lien. Relevé le 5 septembre 2026 sur les données réelles : « Guardians vs
         Tigers » figure deux fois dans la grille ESPN (14 h 10 terminé, 19 h 45 en
         direct) ; les 27 liens partaient sur le match terminé, et la carte en direct
         affichait la loupe « aucun lien ».

         On retient donc, parmi les candidats appariés, celui dont l'heure de début est la
         plus proche. Sans heure exploitable des deux côtés, le premier l'emporte comme
         avant : on ne dégrade jamais le cas simple, qui est aussi le cas courant. */
      var candidats = [];
      for(var ci=0; ci<apiMatches.length; ci++) {
         if(isMatchPair(apiMatches[ci], sm)) candidats.push(ci);
      }
      if(candidats.length > 1) {
         var mnFlux = minutesOfTime(sm.startTime);
         if(mnFlux !== null) {
            var meilleur = candidats[0], ecartMin = Infinity;
            for(var cj=0; cj<candidats.length; cj++) {
               var mnApi = minutesOfTime(apiMatches[candidats[cj]].startTime);
               if(mnApi === null) continue;
               var ecart = Math.abs(mnApi - mnFlux);
               if(ecart < ecartMin) { ecartMin = ecart; meilleur = candidats[cj]; }
            }
            candidats = [meilleur];
         } else {
            candidats = [candidats[0]];
         }
      }

      for(var i=0; i<apiMatches.length; i++) {
         var am = apiMatches[i];

         if(candidats.length ? candidats[0] === i : isMatchPair(am, sm)) {
            if(!am.streamLinks) am.streamLinks = [];
            if(sm.streamLinks) {
                sm.streamLinks.forEach(function(sl) {
                    if(!sl.source && sm.source) sl.source = sm.source;
                    if(!am.streamLinks.find(function(e){ return e.url === sl.url; })) {
                        am.streamLinks.push(sl);
                    }
                });
            }
            if(sm.matchUrl && !am.matchUrl) am.matchUrl = sm.matchUrl;
            mergeAltUrls(am, sm);

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
         var keepLeague = sm.scrapedLeagueName !== 'Autres Flux'
             && leagueTier(sm.scrapedLeagueName) !== 'other'
             && !apiLeagues[sm.scrapedLeagueName.toUpperCase()];
         sm.league = keepLeague ? sm.scrapedLeagueName : 'Autres Flux';
         sm.streamsLoaded = true;
         if (!keepLeague) {
             sm.flag = '📡';
             sm.color = '#555555';
         } else {
             if (!sm.flag) sm.flag = lgFlag(sm.league);
             if (!sm.color) sm.color = lgColor(sm.league);
         }

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
        var path = m ? getEspnPath(m.league) : 'soccer/eng.1';

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
    var path = getEspnPath(leagueName);
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
    var path = getEspnPath(leagueName);
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
    var path = getEspnPath(leagueName);
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
window.TARGET_DATE = TARGET_DATE;
window.setApiTargetDate = setApiTargetDate;
window.getApiFirstMatches = getApiFirstMatches;
window.mergeFluxToApi = mergeFluxToApi;
window.formatStatLabel = formatStatLabel;
window.renderScorersHtml = renderScorersHtml;
window.fetchGameStats = fetchGameStats;
window.fetchLeagueStandings = fetchLeagueStandings;
window.fetchTeamSchedule = fetchTeamSchedule;

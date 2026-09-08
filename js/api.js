import { lg, getLeagueDuration, fetchPage, esc } from './utils.js';
import { getEstTimeStrFromDate, getEstDateStrFromDate } from './config.js';
import { formatLeagueName, lgFlag, lgColor, getOfficialTeamName, normName, leagueTier, resolvePairing } from './db.js';
import { isMatch, isMatchPair, mergeAltUrls, spectacleDeCatch } from './match.js';
import { parsePWHLSchedule, parseF1Ics, parseIndycarIcs, parseSportsDbEvents } from './scrapers.js';
import { addScrapeLog, S } from './state.js';
import { safeStorageGetJSON, safeStorageSetJSON } from './utils.js';
import { liensDunEvenementEsports } from './esports.js';

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

/* Santé des appels à ESPN, par appareil.

   Ces appels partent EN DIRECT du navigateur vers site.api.espn.com, sans proxy : un
   appareil qui n'y arrive pas (bloqueur de publicités qui filtre le domaine, résolveur
   d'entreprise, VPN, portail captif, réseau lent au-delà des 8 s) n'obtient AUCUN score,
   et l'échec était avalé en silence (`catch → null`). D'où « selon l'appareil, ça voit ou
   non les scores » sans que rien ne le dise. On compte, et la page Logs peut le montrer. */
export var espnInfo = { tentatives: 0, echecs: 0, dernierSucces: null, derniereErreur: null };
function noterEspn(ok, err) {
  espnInfo.tentatives++;
  if (ok) { espnInfo.dernierSucces = Date.now(); espnInfo.derniereErreur = null; }
  else { espnInfo.echecs++; espnInfo.derniereErreur = String((err && err.message) || err || 'échec'); }
  if (typeof window !== 'undefined') window.espnInfo = espnInfo;
  return ok;
}

export function fetchEspnSchedule(leaguePath, dateStr) {
  var url = 'https://site.api.espn.com/apis/site/v2/sports/' + leaguePath + '/scoreboard?dates=' + dateStr;
  return fetch(url, { signal: AbortSignal.timeout(8000) })
    .then(function(res) { return res.json(); })
    .then(function(data) { noterEspn(true); return data; })
    .catch(function(e) { noterEspn(false, e); return null; });
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

/* Âge au-delà duquel le calendrier du jour rangé en local est relu. Même seuil que le
   cache des liens (`PREFETCH_STALE_MS`, js/main.js) : dix minutes. */
export var CALENDAR_STALE_MS = 10 * 60 * 1000;

/* Le calendrier local du jour est-il encore bon ?

   Il ne l'était QUE par sa date : `cache.fetchDate === todayStr`. Le premier chargement
   de la journée écrivait donc un instantané — la plupart des matchs « à venir », sans
   score — et tous les chargements suivants le resservaient tel quel jusqu'à minuit, sans
   jamais relire `data/schedule.json` (régénéré par le serveur toutes les demi-heures avec
   les scores et les états réels). Restait le rafraîchissement des scores, qui appelle
   ESPN EN DIRECT : sur un appareil où cet appel échoue, plus rien ne bougeait de la
   journée — grille figée, aucun score, et l'onglet Live montrant les états du matin. Sur
   un autre appareil, ouvert plus tard ou avec un réseau qui laisse passer ESPN, tout
   s'affichait. C'est ce qui rendait scores ET flux dépendants de l'appareil.

   Un cache sans `savedAt` (écrit par une version antérieure) est tenu pour périmé : les
   appareils déjà figés se remettent à jour au prochain chargement, ce qui est le but. */
export function calendrierPerime(cache, todayStr, now) {
  if (!cache || cache.fetchDate !== todayStr || !cache.matches || !cache.matches.length) return true;
  if (!cache.savedAt) return true;
  var age = (now || Date.now()) - cache.savedAt;
  return age < 0 || age > CALENDAR_STALE_MS;
}

export function getApiFirstMatches(targetDate, forceRefresh) {
  var targetDateObj = targetDate || new Date();
  var targetDateStr = getEstDateStrFromDate(targetDateObj);
  var todayStr = getEspnDateStr(targetDateObj);
  var cache = safeStorageGetJSON('api_calendar_cache_' + todayStr);

  /* Avant tout retour anticipé : c'est justement le retour anticipé sur le cache local
     qui empêchait l'armement. */
  if (targetDateStr === getEstDateStrFromDate(new Date())) startLiveScoreRefresh();

  var perime = calendrierPerime(cache, todayStr, Date.now());
  var needsFullFetch = perime || forceRefresh;

  if (!needsFullFetch && cache && cache.matches) {
      if (typeof window !== 'undefined') window.calendrierInfo = { source: 'local', ageMin: Math.round((Date.now() - cache.savedAt) / 60000), count: cache.matches.length };
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
                  safeStorageSetJSON('api_calendar_cache_' + todayStr, { fetchDate: todayStr, savedAt: Date.now(), matches: cacheData.matches });
                  if (typeof window !== 'undefined') window.calendrierInfo = { source: 'schedule.json', ageMin: 0, count: cacheData.matches.length };
                  lg('Calendrier', cacheData.matches.length + ' matchs relus depuis data/schedule.json');
                  return cacheData.matches;
              } else {
                  throw new Error("Cache outdated");
              }
          })
          .catch(function(err) {
              // Fallback if schedule.json is missing or invalid: do it the old way.
              return apiOuCacheLocal(targetDateObj, todayStr, targetDateStr, cache);
          });
  }

  return apiOuCacheLocal(targetDateObj, todayStr, targetDateStr, cache);
}

/* L'API, et à défaut le calendrier local du jour (forceRefresh sur un réseau absent,
   par exemple) : mieux vaut la grille d'il y a une heure qu'une page vide. */
function apiOuCacheLocal(targetDateObj, todayStr, targetDateStr, cache) {
  return fetchAndProcessApiMatches(targetDateObj, todayStr, targetDateStr).then(function(matches) {
      if ((!matches || !matches.length) && cache && cache.fetchDate === todayStr && Array.isArray(cache.matches) && cache.matches.length) {
          /* Ni data/schedule.json ni ESPN : on garde la grille précédente plutôt qu'une page
             vide, mais on le DIT — c'est cet appareil-là qui n'a pas de scores, et jusqu'ici
             rien ne l'indiquait. */
          if (typeof window !== 'undefined') {
              window.calendrierInfo = { source: 'local (périmé)', ageMin: cache.savedAt ? Math.round((Date.now() - cache.savedAt) / 60000) : null, count: cache.matches.length };
              /* Sous try : `showToast` écrit dans un élément de la page, qui peut ne pas
                 exister encore (démarrage) — un message de diagnostic ne doit jamais faire
                 échouer le chargement du calendrier qu'il décrit. */
              if (typeof window.showToast === 'function' && !window._calendrierAvertissement) {
                  window._calendrierAvertissement = true;
                  try { window.showToast('Scores indisponibles sur cet appareil : ni le cache du serveur ni ESPN ne répondent.'); } catch (e) {}
              }
          }
          lg('Calendrier', 'API injoignable : ' + cache.matches.length + ' matchs du cache local (ESPN ' + espnInfo.echecs + '/' + espnInfo.tentatives + ' en échec)');
          return cache.matches;
      }
      return matches;
  });
}

export function backgroundUpdateGuide(targetDateObj) {
    var todayStr = getEspnDateStr(targetDateObj || new Date());
    var targetDateStr = getEstDateStrFromDate(targetDateObj || new Date());

    return fetchAndProcessApiMatches(targetDateObj || new Date(), todayStr, targetDateStr).then(function(matches) {
        /* D'abord dans S.matches (statut, score, minute, par identifiant), puis le DOM :
           sans le premier pas, la fiche et le filtre du Live raisonnaient sur des objets
           d'il y a cinq minutes (voir applyScoreUpdates, js/main.js). */
        if (typeof window.applyScoreUpdates === 'function') {
            window.applyScoreUpdates(matches);
        } else if (typeof window.updateLiveScores === 'function') {
            window.updateLiveScores(matches);
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
  /* Combien d'appels à ESPN ont RÉPONDU pendant cette passe. Voir le garde-fou en fin
     de fonction : c'est ESPN qui porte le calendrier, les autres sources n'en fournissent
     que des miettes. */
  var espnAvant = { tentatives: espnInfo.tentatives, echecs: espnInfo.echecs };

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
              // Nom complet (« Texas Longhorns ») : voir scripts/scrape_schedule.mjs, même règle.
              homeName = homeC.team.displayName || homeC.team.name;
              awayName = awayC.team.displayName || awayC.team.name;
          }

        var status = 'upcoming';
        // Épreuve : l'état de LA séance, pas celui du week-end (voir scripts/scrape_schedule.mjs).
        var etat = (isRacing && comp.status && comp.status.type && comp.status.type.state) || ev.status.type.state;
        if(etat === 'in') status = 'live';
        if(etat === 'post') status = 'finished';

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
        var matchDate = getEstDateStrFromDate(dateObj);
        var isPlayoff = ev.season && ev.season.type === 3;

        var stObj = (isRacing && comp.status && comp.status.type) ? comp.status : ev.status;
        var matchObj = {
          id: isRacing ? 'espn_' + ev.id + '_' + comp.id : 'espn_' + ev.id,
          /* Période et libellé (« Top 10th », « OT », « End of 3rd ») : la fin présumée
             (js/finpresumee.js) y lit une prolongation connue. */
          period: (stObj && stObj.period) || null,
          detail: (stObj && stObj.type && (stObj.type.shortDetail || stObj.type.detail)) || null,
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
                      /* Adresses ENCADRABLES : `twitch.tv/<chaîne>` répond
                         « X-Frame-Options: SAMEORIGIN » et `youtube.com/watch` n'est pas un
                         lecteur — les deux formes construites ici jusqu'au 6 septembre 2026
                         ne pouvaient donc pas jouer dans une tuile. Voir js/esports.js. */
                      var liensLive = liensDunEvenementEsports(liveEv.streams);
                      if (liensLive.length) {
                          if (!baseMatches[existingIdx].streamLinks) baseMatches[existingIdx].streamLinks = [];
                          liensLive.forEach(function(l) {
                              if (!baseMatches[existingIdx].streamLinks.some(function(sl){ return sl.url === l.url; })) {
                                  baseMatches[existingIdx].streamLinks.push(l);
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

                          lm.streamLinks = liensDunEvenementEsports(liveEv.streams);
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
      /* Relevé du 6 septembre 2026 : ce résultat est écrit tel quel, même VIDE. Le
         rafraîchissement des scores (toutes les cinq minutes, retour au premier plan)
         passe par ici ; un réseau qui lâche — cellulaire, tunnel — fait échouer toutes
         les requêtes ESPN, et le calendrier du jour était remplacé par une liste vide.
         La passe suivante lisait ce vide et la grille disparaissait, jusqu'à un
         « Réessayer » ou au lendemain. Un jour sans aucun match n'existe pas dans les
         ligues suivies : un résultat vide est un échec, pas une donnée. */
      /* Le garde-fou ci-dessus ne voyait que le cas VIDE. Relevé le 7 septembre 2026 en
         instrumentant le test « un cache serveur momentanément injoignable… » : quand
         ESPN est injoignable mais qu'une source annexe répond quand même — le calendrier
         des galas de catch, lu ailleurs qu'à l'API —, `baseMatches` vaut 1. Ce n'est pas
         vide, donc c'était écrit comme LE calendrier du jour : la grille tombait de
         plusieurs dizaines de matchs à un seul, ses liens avec, et le cache local était
         écrasé par ce fragment, qui survivait aux passes suivantes.

         C'est l'autre moitié de « selon le device, ça voit ou non les scores et les
         streams » : sur l'appareil où ESPN ne passe pas, la grille ne se figeait pas
         seulement, elle pouvait s'effondrer. ESPN porte le calendrier ; si AUCUNE de ses
         requêtes n'a répondu, ce qu'on tient n'est pas un calendrier, c'est une miette —
         un échec, comme la liste vide. */
      var tentatives = espnInfo.tentatives - espnAvant.tentatives;
      var reponses = tentatives - (espnInfo.echecs - espnAvant.echecs);
      if (tentatives > 0 && reponses === 0) {
          lg('Calendrier', 'ESPN injoignable (' + tentatives + ' requêtes sans réponse) : ' + baseMatches.length + ' match(s) d\'autres sources écartés, le calendrier local est conservé');
          return [];
      }
      if (!baseMatches.length) {
          lg('Calendrier', 'aucune réponse de l\'API : le calendrier local est conservé');
          return baseMatches;
      }
      safeStorageSetJSON('api_calendar_cache_' + todayStr, { fetchDate: todayStr, savedAt: Date.now(), matches: baseMatches });
      if (typeof window !== 'undefined') window.calendrierInfo = { source: 'espn', ageMin: 0, count: baseMatches.length };
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
  var _t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (typeof window.streamMissingCounts === 'undefined') window.streamMissingCounts = {};
  S.unmatchedStreams = [];   // flux sans match dans la grille, pour le diagnostic (voir plus bas)

  /* ── Index des matchs de la grille par nom d'équipe ────────────────────────
     `isMatchPair` coûte 401 µs par appel (mesuré sur les données du 5 septembre 2026 :
     6 240 appels en 2,5 s). La fusion le lançait pour CHAQUE couple flux × grille, soit
     636 × 156 = 99 216 appels, c'est-à-dire 39,8 secondes de calcul synchrone — et le
     double depuis que le choix du programme double ajoutait une seconde passe complète.

     Pendant tout ce temps le fil principal est bloqué : rien ne s'affiche, `hasLoadedOnce`
     n'est jamais posé, et l'application semble ne jamais finir de charger. Les dix tests
     d'interface qui démarrent l'application échouaient tous là-dessus, sur cette branche
     comme sur main, chez moi comme en intégration continue. C'est aussi ce que voit
     l'utilisateur : un démarrage qui s'éternise, d'autant plus que la grille grossit.

     On indexe donc les matchs de la grille par nom d'équipe normalisé, une seule fois, et
     on ne compare qu'aux candidats plausibles. Le repli sur le balayage complet est
     conservé quand aucun candidat ne ressort : `isMatchPair` sait apparier des épreuves
     (F1, WWE, e-sport) sur le nom combiné, sans que les noms d'équipe correspondent. */
  var indexEquipes = {};
  /* Deux niveaux de clé. Le nom normalisé apparie « Detroit Tigers » à « Detroit
     Tigers » ; les MOTS significatifs rattrapent « Marist » à « Marist Red Foxes »,
     que `isMatchPair` sait apparier mais que le nom entier manque. Sans ce second
     niveau, le dédoublonnage entre flux perdait 53 cartes sur 735 — des doublons qui
     réapparaissaient dans « Autres streams ». */
  /* Mémorisées par nom. `getOfficialTeamName` fait un appariement approximatif sur toute
     la base d'équipes : c'est ce qui coûte. Profilé dans le navigateur, `indicesPlausibles`
     pesait 23,6 s sur 41,5 s de fusion, tandis qu'`isMatchPair` — le suspect évident — n'en
     pesait que 1,4 s pour 2 292 appels. Le même nom revient d'un flux à l'autre, et chaque
     nom était retraité deux fois (passe exacte puis passe par mots). */
  var cacheCles = {};
  function clesDe(nom) {
      var memo = cacheCles[nom];
      if (memo) return memo;
      var cles = {};
      var n = normName(nom);
      if (n) cles[n] = true;
      /* Pas de `getOfficialTeamName` ici. C'est un appariement approximatif sur toute la
         base d'équipes, et il coûte une vingtaine de millisecondes par nom dans le
         navigateur : mille appels suffisaient à immobiliser le démarrage. `normName`
         applique déjà les alias, et les mots significatifs rattrapent le reste — ce que
         confirme le relevé : même nombre de cartes qu'avec le balayage complet. */
      String(nom).toLowerCase().split(/[^a-z0-9]+/).forEach(function(mot) {
          if (mot.length >= 4) cles['mot:' + mot] = true;
      });
      cacheCles[nom] = cles;
      return cles;
  }
  function ajouterAuxIndex(nom, idx) {
      if (!nom) return;
      var cles = clesDe(nom);
      for (var c in cles) (indexEquipes[c] = indexEquipes[c] || []).push(idx);
  }
  var tailleGrilleOrigine = apiMatches.length;
  for (var ii = 0; ii < apiMatches.length; ii++) {
      ajouterAuxIndex(apiMatches[ii].homeTeam, ii);
      ajouterAuxIndex(apiMatches[ii].awayTeam, ii);
  }
  /* Une épreuve — Grand Prix, gala WWE, match d'e-sport — n'a pas de « domicile » ni
     d'« extérieur » : `isMatchPair` l'apparie sur le nom COMBINÉ, sans que les noms
     d'équipe se correspondent. C'est le seul cas où l'index ne peut rien, et le seul qui
     justifie encore un balayage complet. Elles sont peu nombreuses ; les 86 % de flux
     restants sans candidat n'ont simplement aucun match dans la grille, et les comparer
     un à un ne faisait que confirmer une absence, très cher. */
  function estEvenement(m) {
      var l = String(m.league || '').toUpperCase();
      if (l === 'F1' || l === 'INDYCAR' || l === 'WWE' || l === 'MOTOGP' || l === 'NASCAR') return true;
      var t = (String(m.homeTeam || '') + ' ' + String(m.awayTeam || '')).toLowerCase();
      return /grand prix|formula 1|\bf1\b|\bindy|\bwwe\b|esports|\braw\b|smackdown|\bnxt\b/.test(t);
  }

  /* Deux recours, dans cet ordre : le nom entier d'abord — précis et peu coûteux — puis
     les mots seulement s'il n'a rien donné. Chercher d'emblée par mots élargit trop les
     candidats (5,1 s contre 0,7 s mesurées sur les données du 5 septembre 2026) pour un
     gain qui ne concerne que les noms partiels. */
  function hits(nom, avecMots) {
      var vus = {};
      if (!nom) return vus;
      var cles = clesDe(nom);
      for (var cle in cles) {
          var estMot = cle.indexOf('mot:') === 0;
          if (avecMots !== estMot) continue;
          var liste = indexEquipes[cle];
          if (!liste) continue;
          for (var k = 0; k < liste.length; k++) vus[liste[k]] = true;
      }
      return vus;
  }

  /* Un vrai match oppose DEUX équipes : un candidat n'est plausible que si les deux noms
     le désignent. L'intersection, plutôt que la réunion, est ce qui rend l'index utile —
     avec la réunion, un mot courant (« United », « State ») ramenait des dizaines de
     candidats et l'on repayait `isMatchPair` sur chacun.

     Deux recours, dans cet ordre : le nom entier d'abord, précis ; les mots ensuite,
     seulement s'il n'a rien donné, pour rattraper « Marist » face à « Marist Red Foxes ».
     Quand un seul des deux noms est connu, on se rabat sur ses candidats à lui : mieux
     vaut quelques comparaisons de trop qu'un appariement manqué. */
  function croiser(m, avecMots) {
      var a = hits(m.homeTeam, avecMots), b = hits(m.awayTeam, avecMots);
      var cleA = Object.keys(a), cleB = Object.keys(b);
      if (!cleA.length && !cleB.length) return [];
      if (!cleA.length) return cleB.map(Number);
      if (!cleB.length) return cleA.map(Number);
      var communs = cleA.filter(function(i) { return b[i]; }).map(Number);
      return communs.length ? communs : cleA.map(Number).concat(cleB.map(Number));
  }
  function indicesPlausibles(m) {
      var exact = croiser(m, false);
      return exact.length ? exact : croiser(m, true);
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
      var aExaminer = indicesPlausibles(sm);
      if (aExaminer.length === 0 && estEvenement(sm)) {
         /* Balayage complet réservé aux épreuves, et borné à la grille D'ORIGINE : les
            flux non fusionnés sont ajoutés à `apiMatches` au fil de la boucle, si bien
            qu'un balayage complet parcourait une liste qui grossit — 156 entrées au
            départ, 682 à l'arrivée sur les données du 5 septembre 2026. C'est ce
            balayage d'une liste croissante, et non le nombre de flux, qui faisait
            exploser le coût. */
         aExaminer = [];
         for(var ai2=0; ai2<tailleGrilleOrigine; ai2++) aExaminer.push(ai2);
      }
      var candidats = [];
      for(var ci=0; ci<aExaminer.length; ci++) {
         if(isMatchPair(apiMatches[aExaminer[ci]], sm)) candidats.push(aExaminer[ci]);
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

      /* L'indice de la cible est connu : on y va directement. Le balayage qui restait ne
         faisait que chercher un numéro qu'on avait déjà, sur une liste qui grossit au fil
         de la boucle — 156 entrées au départ, plus de 650 à l'arrivée. */
      var cible = candidats.length ? candidats[0] : -1;
      if(cible >= 0) {
         var am = apiMatches[cible];
         {
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
         }
      }

      if(!matched) {
         /* La grille, c'est ESPN et les sources de calendrier acceptées ; les scrapers ne
            font qu'y attacher des liens. Un flux sans match dans la grille ne crée donc
            PAS de carte — ni dans Live, ni dans le Guide, ni dans « Autres streams ».

            Décision du 6 septembre 2026, devant un onglet Live qui affichait à 22 h 15
            « Money In The Bank » en DIRECT (footybite marque « Match Started » des galas
            vieux de plusieurs mois), « NFL Schedule Release 2021 » et « Toronto Raptors vs
            Denver Nuggets 18:30 » (pages hors saison de Buffstreams, sans date) : tout ce
            qui n'a pas de source de calendrier derrière lui est invérifiable, et c'est
            précisément ce qui rendait la page illisible. Ces flux restent consultables
            dans le journal des sources et dans `S.unmatchedStreams`, pour le diagnostic. */
         S.unmatchedStreams.push(sm);
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

  /* Deux entrées pour la MÊME soirée de catch. ESPN en livre deux (relevées le
     8 septembre 2026 à une minute d'écart : « RAW #1737 » à 19:59 et « WWE / Raw » à
     20:00), et la grille montrait donc deux cartes pour une seule émission — dont une
     seule recevait les liens. On n'en garde qu'une, et elle reçoit ceux de l'autre.

     Le regroupement se fait sur le SPECTACLE et le jour, jamais sur les lettres : deux
     soirées différentes (Raw et NXT) ne se rejoignent pas, et un club dont le nom contient
     « raw » n'est pas un spectacle (voir spectacleDeCatch, js/match.js). */
  var parSpectacle = {};
  var sansDoublon = [];
  for (var iS = 0; iS < apiMatches.length; iS++) {
      var mS = apiMatches[iS];
      var spectacle = spectacleDeCatch((mS.homeTeam || '') + ' ' + (mS.awayTeam || ''));
      if (!spectacle) { sansDoublon.push(mS); continue; }
      var cleS = spectacle + '|' + (mS.matchDate || '');
      var garde = parSpectacle[cleS];
      if (!garde) { parSpectacle[cleS] = mS; sansDoublon.push(mS); continue; }
      garde.streamLinks = garde.streamLinks || [];
      var aAjouter = mS.streamLinks || [];
      for (var jS = 0; jS < aAjouter.length; jS++) {
          var lS = aAjouter[jS];
          if (!lS || !lS.url) continue;
          var connu = false;
          for (var kS = 0; kS < garde.streamLinks.length; kS++) { if (garde.streamLinks[kS].url === lS.url) { connu = true; break; } }
          if (!connu) garde.streamLinks.push(lS);
      }
      /* Les blasons suivent : deux entrées de la même soirée n'ont pas forcément les
         mêmes, et garder la première ne doit pas coûter son logo à la carte. */
      if (!garde.homeLogo && mS.homeLogo) garde.homeLogo = mS.homeLogo;
      if (!garde.awayLogo && mS.awayLogo) garde.awayLogo = mS.awayLogo;
      if (!garde.matchUrl && mS.matchUrl) garde.matchUrl = mS.matchUrl;
      if (garde.streamLinks.length) garde.streamsLoaded = true;
  }
  if (sansDoublon.length !== apiMatches.length) {
      lg('Spectacles en double', (apiMatches.length - sansDoublon.length) + ' entrée(s) réunie(s) — même soirée, plusieurs noms');
      apiMatches = sansDoublon;
  }

  /* Durée de la fusion, pour la page Logs. Relevé le 8 septembre 2026 : sur un
     téléphone, « Fusion : pas encore faite » alors que le calendrier et les liens étaient
     tous deux chargés — l'étape était simplement encore EN COURS, et les cartes
     montraient la loupe en attendant. C'est ce qui explique « je reload les streams sont
     là, je reload c'est vide » : selon le moment où l'on regarde, la fusion a fini ou
     non. On mesure donc, au lieu de supposer. */
  var _t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (typeof window !== 'undefined') window.fusionMs = Math.round(_t1 - _t0);

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

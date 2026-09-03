import { pad, getLeagueDuration, lg, fetchPage, safeStorageGetJSON, safeStorageSetJSON } from './utils.js';
import { extractPlayers, canonical, createRegistry, noteEmbedResult } from './extractors.js';
import { STREAMEAST_URL, SPORTSURGE_URL, ONHOCKEY_URL, getEstDateStrFromDate, getEstTimeStrFromDate, BUFFSTREAMS_URL, MLBBITE_PLUS_URL, SITE, VIPLEAGUE_URL, METHSTREAMS_URL, sortFluxLinks, resolveUrl, isMatchPageBlocked } from './config.js';
import { formatLeagueName, lgFlag, lgColor, getOfficialTeamName } from './db.js';
import { TARGET_DATE } from './api.js';
import { getTeamInfo, isMatchPair } from './match.js';
import { S, addScrapeLog, favTeams, matchCardCache } from './state.js';
import { renderFluxItem } from './ui.js';


export function extractQuality(text) {
    if (!text) return 'SD';
    text = String(text).toLowerCase();
    var bitrateMatch = text.match(/(\d+)\s*(kbps|kbs|kb\/s)/i);
    if (bitrateMatch) return bitrateMatch[1] + ' Kbps';
    if (text.indexOf('4k') >= 0) return '4K';
    if (text.indexOf('1080') >= 0) return '1080p';
    if (text.indexOf('720') >= 0) return '720p';
    if (text.indexOf('hd') >= 0) return 'HD';
    return 'SD';
}

/* ══ PARSE STREAMEAST ════════════════ */
export function parseStreameast(html){
  var matches=[];
  var doc = new DOMParser().parseFromString(html, 'text/html');
  var cards = doc.querySelectorAll('.match-card');

  if (cards.length > 0) {
      [].forEach.call(cards, function(card, index) {
          var home = card.getAttribute('data-team1');
          var away = card.getAttribute('data-team2');
          var category = card.getAttribute('data-league') || 'Sports';
          var timeStr = card.getAttribute('data-time2'); // format "ET 08:50 PM"
          var playerLink = card.getAttribute('data-player');
          var logo1 = card.getAttribute('data-logo1');
          var logo2 = card.getAttribute('data-logo2');

          if(!home || !away || !playerLink) return;

          var startTime = '00:00';
          if(timeStr) {
              // Convert "ET 08:50 PM" to "HH:MM"
              var matchTime = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
              if(matchTime) {
                  var h = parseInt(matchTime[1], 10);
                  var m = matchTime[2];
                  var ampm = matchTime[3] ? matchTime[3].toUpperCase() : '';

                  if(ampm === 'PM' && h < 12) h += 12;
                  if(ampm === 'AM' && h === 12) h = 0;

                  // It's ET time, we keep it as is (or convert based on logic if needed, but our standard seems to accept local/ET depending on source)
                  startTime = pad(h) + ':' + (m.length === 1 ? '0' + m : m);
              }
          }

          var streamLinks = finalizeStreamLinks([{
              name: 'Streameast - Flux',
              quality: extractQuality(playerLink) === 'SD' ? 'HD' : extractQuality(playerLink),
              lang: 'MULTI',
              url: playerLink,
              icon: '📺',
              topLevel: true
          }]);

          var l = category.toLowerCase().replace(/-/g, ' ');

          matches.push({
              id: 'se_' + index,
              league: formatLeagueName(l),
              flag: lgFlag(l),
              color: lgColor(l),
              homeTeam: getOfficialTeamName(home),
              awayTeam: getOfficialTeamName(away),
              homeLogo: logo1,
              awayLogo: logo2,
              startTime: startTime,
              durationMinutes: getLeagueDuration(l),
              status: 'upcoming', // Streameast doesn't give clear live status in the data attrs directly, rely on API fallback or default to upcoming
              streamLinks: streamLinks,
              streamsLoaded: false,
              matchUrl: playerLink || STREAMEAST_URL,
              source: 'streameast'
          });
      });
  } else {
      // Fallback
      var possibleMatches = doc.querySelectorAll('li, .match-row, a[href*="/player/"], a[href*="/live/"]');
      var added = {};
      [].forEach.call(possibleMatches, function(el, index) {
          var text = el.textContent.replace(/\s+/g, ' ').trim();
          var link = el.tagName.toLowerCase() === 'a' ? el : el.querySelector('a');
          if (link && text) {
              var href = link.getAttribute('href');
              if (!href || added[href]) return;

              var textToParse = (link.textContent || text).trim();
              var teams = textToParse.split(/ vs | v | - /i);
              if (teams.length >= 2 && textToParse.length < 80) {
                  var home = teams[0].trim();
                  var away = teams.slice(1).join(' - ').trim();

                  var startTimeStr = '00:00';
                  var matchTime = text.match(/(\d{1,2}):(\d{2})/);
                  if (matchTime) {
                      startTimeStr = pad(parseInt(matchTime[1], 10)) + ':' + matchTime[2];
                  }

                  var streamUrl = href;
                  if (!streamUrl.startsWith('http')) {
                      streamUrl = resolveUrl(streamUrl, STREAMEAST_URL);
                  }

                  matches.push({
                      id: 'se_fb_' + index,
                      league: formatLeagueName('Sports'),
                      flag: lgFlag('Sports'),
                      color: lgColor('Sports'),
                      homeTeam: getOfficialTeamName(home),
                      awayTeam: getOfficialTeamName(away),
                      startTime: startTimeStr,
                      durationMinutes: getLeagueDuration('Sports'),
                      status: 'upcoming',
                      streamLinks: [{
                          name: 'Streameast - Flux',
                          quality: 'HD',
                          lang: 'MULTI',
                          url: streamUrl,
                          icon: '📺',
                          topLevel: true // page du miroir (défi Cloudflare) : s'ouvre dans un onglet, pas en iframe
                      }],
                      streamsLoaded: false,
                      matchUrl: streamUrl,
                      source: 'streameast'
                  });
                  added[href] = true;
              } else if (textToParse.length > 3 && textToParse.length < 40) {
                  var streamUrl2 = href;
                  if (!streamUrl2.startsWith('http')) streamUrl2 = resolveUrl(streamUrl2, STREAMEAST_URL);
                  matches.push({
                      id: 'se_fb_' + index,
                      league: formatLeagueName('Sports'),
                      flag: lgFlag('Sports'),
                      color: lgColor('Sports'),
                      homeTeam: getOfficialTeamName(textToParse),
                      awayTeam: 'TBD',
                      startTime: '00:00',
                      durationMinutes: getLeagueDuration('Sports'),
                      status: 'upcoming',
                      streamLinks: [{ name: 'Streameast - Flux', quality: extractQuality(href), lang: 'MULTI', url: streamUrl2, icon: '📺', topLevel: true }],
                      streamsLoaded: false,
                      matchUrl: streamUrl2,
                      source: 'streameast'
                  });
                  added[href] = true;
              }
          }
      });
  }


  // Next.js Payload fallback for Streameast
  if (matches.length === 0) {
      try {
          var scriptRegex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g;
          var matchData;
          var concatenatedData = "";

          while ((matchData = scriptRegex.exec(html)) !== null) {
              var chunk = matchData[1];
              chunk = chunk.replace(/\\"/g, '"')
                           .replace(/\\\\/g, '\\')
                           .replace(/\\n/g, '\n');
              concatenatedData += chunk;
          }

          var matchUrlRegex = /"href":"(\/[a-z0-9-]+-streams[^"]*)"(?:(?!"href":)[\s\S])*?"children":"([^"]+)"(?:(?!"href":)[\s\S])*?"children":"([^"]+)"(?:(?!"href":)[\s\S])*?"children":"([^"]+)"/gi;
          var mData;

          while ((mData = matchUrlRegex.exec(concatenatedData)) !== null) {
              var href = mData[1];
              var home = mData[2];
              var timeStr = mData[3];
              var away = mData[4];

              var startTime = '00:00';
              if (timeStr.toLowerCase().indexOf('starts in') > -1) {
                  var startsInM = timeStr.match(/Starts in (?:(\d+)hr:)?(\d+)min/i);
                  if (startsInM) {
                      var n = new Date();
                      var hAdd = startsInM[1] ? parseInt(startsInM[1]) : 0;
                      var mAdd = startsInM[2] ? parseInt(startsInM[2]) : 0;
                      n.setMinutes(n.getMinutes() + mAdd);
                      n.setHours(n.getHours() + hAdd);
                      startTime = pad(n.getHours()) + ':' + pad(n.getMinutes());
                  }
              }

              var matchUrl = resolveUrl(href, STREAMEAST_URL);

              matches.push({
                  id: 'se_nx_' + Math.random().toString(36).substr(2, 9),
                  league: formatLeagueName('Sports'),
                  flag: lgFlag('Sports'),
                  color: lgColor('Sports'),
                  homeTeam: getOfficialTeamName(home),
                  awayTeam: getOfficialTeamName(away),
                  startTime: startTime,
                  durationMinutes: getLeagueDuration('Sports'),
                  status: 'upcoming',
                  matchUrl: matchUrl,
                  streamLinks: [],
                  streamsLoaded: false,
                  source: 'streameast'
              });
          }
      } catch(e) { }
  }

  lg('Streameast extraits', matches.length);
  return matches;
}


/* ══ PARSE ONHOCKEY ═══════════════════ */

/* TheSportsDB (clé publique gratuite « 3 ») : seule source trouvée pour la WWE, l'AEW et la
   boxe, qu'ESPN n'expose pas du tout (son répertoire ne contient ni wwe ni boxing, et
   sports/wwe/wwe comme boxing/boxing renvoient HTTP 400).
   Endpoint : /eventsday.php?d=AAAA-MM-JJ&s=Fighting -> WWE, AEW, Boxing, UFC, ONE, Sumo...
   `strTimestamp` est en UTC ; on convertit en heure de l'Est, fuseau de référence de la grille.
   Un événement « A vs B » est scindé en deux camps pour l'affichage des cartes. */
export function parseSportsDbEvents(json, targetDateStr) {
    var out = [];
    var events = json && Array.isArray(json.events) ? json.events : [];
    for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        if (!ev || !ev.strEvent) continue;
        if (String(ev.strPostponed || '').toLowerCase() === 'yes') continue;

        /* Date/heure. strTimestamp est en UTC. Attention : quand l'heure n'est pas connue,
           TheSportsDB met « 00:00:00 », ce qui ferait basculer l'événement à la veille une
           fois converti en heure de l'Est. On ne convertit donc que si une heure réelle
           existe (strTime renseignée, ou strTimeLocal fournie comme pour « NXT #853 » à
           20:00 locales) ; sinon on garde la date telle quelle, à une heure de soirée. */
        var hasRealTime = (ev.strTime && ev.strTime !== '00:00:00') || (ev.strTimeLocal && ev.strTimeLocal !== '');
        var when = null, matchDate = null, startTime = null;
        if (ev.strTimestamp && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(ev.strTimestamp)) when = new Date(ev.strTimestamp + 'Z');
        else if (ev.dateEvent) when = new Date(ev.dateEvent + 'T00:00:00Z');
        if (!when || isNaN(when.getTime())) continue;

        if (hasRealTime) {
            matchDate = getEstDateStrFromDate(when);
            startTime = getEstTimeStrFromDate(when);
        } else {
            matchDate = ev.dateEvent || getEstDateStrFromDate(when);
            startTime = '20:00'; // heure inconnue : ces cartes sont diffusées en soirée
        }
        if (targetDateStr && matchDate !== targetDateStr) continue;

        var title = String(ev.strEvent).replace(/\s+/g, ' ').trim();
        var home = title, away = '';
        var vs = title.split(/\s+vs\.?\s+/i);
        if (vs.length === 2 && vs[0].trim() && vs[1].trim()) { home = vs[0].trim(); away = vs[1].trim(); }

        var league = ev.strLeague || ev.strSport || 'Autres';
        out.push({
            id: 'tsdb_' + (ev.idEvent || i),
            league: formatLeagueName(league),
            flag: lgFlag(league),
            color: lgColor(league),
            homeTeam: getOfficialTeamName(home),
            awayTeam: away ? getOfficialTeamName(away) : '',
            startTime: startTime,
            matchDate: matchDate,
            durationMinutes: getLeagueDuration(league),
            status: 'upcoming',
            venue: ev.strVenue || '',
            poster: ev.strThumb || ev.strPoster || '',
            matchUrl: null,
            streamLinks: [],
            streamsLoaded: false,
            source: 'api'
        });
    }
    return out;
}

export function parseF1Ics(txt) {
    var matches = [];
    try {
        var lines = txt.split(/\r?\n/);
        var unfoldedLines = [];
        for (var j = 0; j < lines.length; j++) {
            if (lines[j].startsWith(' ') || lines[j].startsWith('\t')) {
                if (unfoldedLines.length > 0) {
                    unfoldedLines[unfoldedLines.length - 1] += lines[j].substring(1);
                }
            } else {
                unfoldedLines.push(lines[j]);
            }
        }

        var currentEvent = null;

        for (var i = 0; i < unfoldedLines.length; i++) {
            var line = unfoldedLines[i];
            if (line === 'BEGIN:VEVENT') {
                currentEvent = {};
            } else if (line === 'END:VEVENT') {
                if (currentEvent && currentEvent.SUMMARY && currentEvent.DTSTART) {
                    var dtstart = currentEvent.DTSTART;
                    // Support standard ISO 8601 YYYYMMDDTHHMMSSZ format
                    var dateObj = new Date(
                        dtstart.substring(0, 4) + '-' +
                        dtstart.substring(4, 6) + '-' +
                        dtstart.substring(6, 8) + 'T' +
                        dtstart.substring(9, 11) + ':' +
                        dtstart.substring(11, 13) + ':' +
                        dtstart.substring(13, 15) + 'Z'
                    );

                    if (!isNaN(dateObj)) {
                        var summary = currentEvent.SUMMARY;

                        if (summary.toLowerCase().includes('in your calendar') || summary.toLowerCase() === 'formula 1') {
                            currentEvent = null;
                            continue;
                        }

                        // Strip leading emojis and symbols (e.g. 🏎, 🏁, ⏱️)
                        summary = summary.replace(/^[^a-zA-Z0-9]+/, '').trim();

                        var homeTeam = summary;
                        var awayTeam = 'Race';

                        if (summary.indexOf(' - ') !== -1) {
                            var parts = summary.split(' - ');
                            homeTeam = parts[0].trim();
                            awayTeam = parts.slice(1).join(' - ').trim();
                        }

                        matches.push({
                            id: 'f1_ics_' + homeTeam.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_' + dtstart,
                            homeTeam: homeTeam,
                            awayTeam: awayTeam,
                            date: dateObj.toISOString()
                        });
                    }
                }
                currentEvent = null;
            } else if (currentEvent) {
                var splitIndex = line.indexOf(':');
                if (splitIndex !== -1) {
                    var keyRaw = line.substring(0, splitIndex);
                    var value = line.substring(splitIndex + 1);
                    var key = keyRaw.split(';')[0];
                    currentEvent[key] = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ');
                }
            }
        }
    } catch (e) {
        console.error('Error parsing F1 ICS', e);
        lg('Error parsing F1 ICS', e);
    }
    return matches;
}

export function parseIndycarIcs(txt) {
    var matches = [];
    try {
        var lines = txt.split(/\r?\n/);
        var unfoldedLines = [];
        for (var j = 0; j < lines.length; j++) {
            if (lines[j].startsWith(' ') || lines[j].startsWith('\t')) {
                if (unfoldedLines.length > 0) {
                    unfoldedLines[unfoldedLines.length - 1] += lines[j].substring(1);
                }
            } else {
                unfoldedLines.push(lines[j]);
            }
        }

        var currentEvent = null;

        for (var i = 0; i < unfoldedLines.length; i++) {
            var line = unfoldedLines[i];
            if (line === 'BEGIN:VEVENT') {
                currentEvent = {};
            } else if (line === 'END:VEVENT') {
                if (currentEvent && currentEvent.SUMMARY && currentEvent.DTSTART) {
                    var dtstart = currentEvent.DTSTART;
                    // Support standard ISO 8601 YYYYMMDDTHHMMSSZ format
                    var dateObj = new Date(
                        dtstart.substring(0, 4) + '-' +
                        dtstart.substring(4, 6) + '-' +
                        dtstart.substring(6, 8) + 'T' +
                        dtstart.substring(9, 11) + ':' +
                        dtstart.substring(11, 13) + ':' +
                        dtstart.substring(13, 15) + 'Z'
                    );

                    if (!isNaN(dateObj)) {
                        var summary = currentEvent.SUMMARY;
                        // Strip leading emojis and symbols (e.g. 🏎, 🏁, ⏱️)
                        summary = summary.replace(/^[^a-zA-Z0-9]+/, '').trim();

                        var homeTeam = summary;
                        var awayTeam = 'Race';

                        // Example parsing: "Practice 1 for the XPEL Grand Prix at Road America" -> "XPEL Grand Prix at Road America", "Practice 1"
                        var forIndex = summary.toLowerCase().indexOf(' for ');
                        var atIndex = summary.toLowerCase().indexOf(' at ');

                        if (forIndex !== -1) {
                            awayTeam = summary.substring(0, forIndex).trim();
                            homeTeam = summary.substring(forIndex + 5).trim();
                            // If it says "for the ...", remove "the "
                            if (homeTeam.toLowerCase().startsWith('the ')) {
                                homeTeam = homeTeam.substring(4).trim();
                            }
                        } else if (atIndex !== -1 && summary.toLowerCase().includes('race ')) {
                            // Example: "Race 1 at the Milwaukee Mile"
                            awayTeam = summary.substring(0, atIndex).trim();
                            homeTeam = summary.substring(atIndex + 4).trim();
                            if (homeTeam.toLowerCase().startsWith('the ')) {
                                homeTeam = homeTeam.substring(4).trim();
                            }
                        } else {
                            // If it's just "WeatherTech Raceway Laguna Seca", homeTeam = summary, awayTeam = Race
                            // This is handled by default
                        }

                        matches.push({
                            id: 'indycar_ics_' + homeTeam.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_' + dtstart,
                            homeTeam: homeTeam,
                            awayTeam: awayTeam,
                            date: dateObj.toISOString()
                        });
                    }
                }
                currentEvent = null;
            } else if (currentEvent) {
                var splitIndex = line.indexOf(':');
                if (splitIndex !== -1) {
                    var keyRaw = line.substring(0, splitIndex);
                    var value = line.substring(splitIndex + 1);
                    var key = keyRaw.split(';')[0];
                    currentEvent[key] = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ');
                }
            }
        }
    } catch (e) {
        console.error('Error parsing IndyCar ICS', e);
        lg('Error parsing IndyCar ICS', e);
    }
    return matches;
}

export function parseWWEIcs(txt) {
    var matches = [];
    try {
        var lines = txt.split(/\r?\n/);
        var unfoldedLines = [];
        for (var j = 0; j < lines.length; j++) {
            if (lines[j].startsWith(' ') || lines[j].startsWith('\t')) {
                if (unfoldedLines.length > 0) {
                    unfoldedLines[unfoldedLines.length - 1] += lines[j].substring(1);
                }
            } else {
                unfoldedLines.push(lines[j]);
            }
        }

        var currentEvent = null;

        for (var i = 0; i < unfoldedLines.length; i++) {
            var line = unfoldedLines[i];
            if (line === 'BEGIN:VEVENT') {
                currentEvent = {};
            } else if (line === 'END:VEVENT') {
                if (currentEvent && currentEvent.SUMMARY && currentEvent.DTSTART) {
                    var dtstart = currentEvent.DTSTART;
                    var dateObj = new Date(
                        dtstart.substring(0, 4) + '-' +
                        dtstart.substring(4, 6) + '-' +
                        dtstart.substring(6, 8) + 'T' +
                        (dtstart.length > 8 ? dtstart.substring(9, 11) + ':' + dtstart.substring(11, 13) + ':' + dtstart.substring(13, 15) + 'Z' : '00:00:00Z')
                    );

                    if (!isNaN(dateObj)) {
                        var summary = currentEvent.SUMMARY.trim();

                        matches.push({
                            id: 'wwe_ics_' + summary.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_' + dtstart,
                            homeTeam: 'WWE',
                            awayTeam: summary,
                            date: dateObj.toISOString()
                        });
                    }
                }
                currentEvent = null;
            } else if (currentEvent) {
                var splitIndex = line.indexOf(':');
                if (splitIndex !== -1) {
                    var keyRaw = line.substring(0, splitIndex);
                    var value = line.substring(splitIndex + 1);
                    var key = keyRaw.split(';')[0];
                    currentEvent[key] = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ');
                }
            }
        }
    } catch (e) {
        console.error('Error parsing WWE ICS', e);
        lg('Error parsing WWE ICS', e);
    }
    return matches;
}


/* ══ PARSE SPORTSURGE ═════════════════ */
export function parsePWHLSchedule(html) {
  var matches = [];
  try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var scripts = doc.querySelectorAll('script');
      for (var i = 0; i < scripts.length; i++) {
          var txt = scripts[i].textContent || '';
          if (txt.indexOf('games') !== -1) {
              var start = txt.indexOf('{');
              var end = txt.lastIndexOf('}');
              if (start !== -1 && end !== -1) {
                  var jsonStr = txt.substring(start, end + 1);
                  var data = JSON.parse(jsonStr);

                  var found = false;
                  var findSchedule = function(obj) {
                      if (!obj || typeof obj !== 'object') return;
                      if (obj.games && Array.isArray(obj.games) && obj.games.length > 0 && obj.games[0].home_team) {
                          obj.games.forEach(function(g) {
                              if (!g.home_team || !g.visiting_team) return;

                              var home = getOfficialTeamName(g.home_team.home_team_name);
                              var away = getOfficialTeamName(g.visiting_team.visiting_team_name);

                              var isLive = false;
                              var status = g.game_status ? g.game_status.toLowerCase() : '';
                              var isFinished = status.indexOf('final') >= 0;
                              if (status.indexOf('in progress') >= 0 || status === 'live' || status.indexOf('period') >= 0 || status.indexOf('intermission') >= 0) {
                                  isLive = true;
                              }

                              var homeScore = g.home_team.home_goal_count;
                              var awayScore = g.visiting_team.visiting_goal_count;

                              var timeStr = '';
                              if (g.date_played) {
                                  var d = new Date(g.date_played);
                                  timeStr = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
                              }

                              var homeLogo = g.home_team.home_team_logo && g.home_team.home_team_logo.length > 0 ? g.home_team.home_team_logo[0].secure_url : null;
                              var awayLogo = g.visiting_team.visiting_team_logo && g.visiting_team.visiting_team_logo.length > 0 ? g.visiting_team.visiting_team_logo[0].secure_url : null;

                              var m = {
                                  id: 'pwhl_' + g.game_id,
                                  homeTeam: home,
                                  awayTeam: away,
                                  homeLogo: homeLogo,
                                  awayLogo: awayLogo,
                                  sport: 'hockey',
                                  league: 'PWHL',
                                  time: isLive ? "LIVE" : timeStr,
                                  date: g.date_played,
                                  isFinished: isFinished,
                                  streamLinks: []
                              };

                              if (homeScore !== undefined && awayScore !== undefined) {
                                  m.homeScore = homeScore.toString();
                                  m.awayScore = awayScore.toString();
                              }

                              matches.push(m);
                          });
                          found = true;
                          return;
                      }
                      for (var key in obj) {
                          if (found) break;
                          findSchedule(obj[key]);
                      }
                  };

                  findSchedule(data);
                  if (found) break;
              }
          }
      }
  } catch(e) { lg('Error parsing PWHL schedule', e); }
  return matches;
}

export function parseSportsurge(html, pageUrl) {
  // v2.sportsurge.net (2026) : pages par sport (/watch-<sport>-streams/), une ligne par match :
  //   <a href="watch-63082-baseball-a-b-8/" class="match-row" title="A - B" data-category="2">
  //     ... <span class="match-time" data-timestamp="1788367200">...</span>
  //     ... <span class="match-row-mobile-category">Baseball</span> ... <span class="watch-pill">18 Streams</span>
  var matches = [];
  var doc = new DOMParser().parseFromString(html, 'text/html');
  var base = pageUrl || SPORTSURGE_URL;
  // Le site déclare <base href="https://v2.sportsurge.net/"> : ses liens relatifs
  // ("watch-63082-…-8/") se résolvent à la racine, PAS sous /watch-<sport>-streams/
  // (sinon 404 : c'est ce qui vidait les pages de match côté serveur).
  var baseEl = doc.querySelector('base[href]');
  if (baseEl && /^https?:\/\//i.test(baseEl.getAttribute('href') || '')) base = baseEl.getAttribute('href');
  var rows = doc.querySelectorAll('a.match-row[href]');
  [].forEach.call(rows, function(a) {
      var href = a.getAttribute('href') || '';
      var title = (a.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
      var names = [].map.call(a.querySelectorAll('.match-row-team-name'), function(n) { return n.textContent.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
      var home = names[0] || '', away = names[1] || '';
      if (!home && title) {
          var tSplit = title.split(/\s+(?:-|vs?\.?)\s+/i);
          home = tSplit[0].trim(); away = tSplit.length > 1 ? tSplit.slice(1).join(' ').trim() : '';
      }
      if (!home) return;

      var catEl = a.querySelector('.match-row-mobile-category');
      var league = catEl ? catEl.textContent.replace(/\s+/g, ' ').trim() : 'Sports';
      if (!catEl && base) {
          var pm = /watch-([a-z0-9-]+)-streams/i.exec(base);
          if (pm) league = pm[1].replace(/-/g, ' ');
      }

      var startTime = '00:00', matchDate = null, status = 'upcoming';
      var timeEl = a.querySelector('.match-time[data-timestamp]');
      var ts = timeEl ? parseInt(timeEl.getAttribute('data-timestamp'), 10) : NaN;
      if (!isNaN(ts) && ts > 0) {
          var d = new Date(ts * 1000);
          startTime = getEstTimeStrFromDate(d);
          matchDate = getEstDateStrFromDate(d);
          if (Date.now() >= d.getTime() && Date.now() - d.getTime() < 4 * 3600 * 1000) status = 'live';
      }
      var rowText = (a.textContent || '').toLowerCase();
      if (/\blive\b|\bnow\b/.test(rowText) && a.querySelector('.match-row-status') && /live/i.test(a.querySelector('.match-row-status').textContent)) status = 'live';

      var matchUrl = href.indexOf('http') === 0 ? href : resolveUrl(href, base);
      if (!matchUrl || matchUrl.indexOf('http') !== 0 || matches.find(function(ex) { return ex.matchUrl === matchUrl; })) return;

      matches.push({
          id: 'ss_' + Math.random().toString(36).substr(2, 9),
          homeTeam: getOfficialTeamName(home),
          awayTeam: away ? getOfficialTeamName(away) : '',
          league: formatLeagueName(league),
          flag: lgFlag(league),
          color: lgColor(league),
          startTime: startTime,
          matchDate: matchDate,
          durationMinutes: getLeagueDuration(league),
          status: status,
          matchUrl: matchUrl,
          streamLinks: [],
          streamsLoaded: false,
          source: 'sportsurge'
      });
  });

  lg('Sportsurge extraits', matches.length);
  return matches;
}

/* OnHockey enveloppe chaque lecteur dans une page pleine de pubs :
     np_stream400.php?channel=//embedsports.me/nhl/nhl-network-stream-1  -> https://embedsports.me/nhl/...
     np_youtube.php?channel=SfoxJmONsPQ                                   -> https://www.youtube.com/embed/SfoxJmONsPQ
   On renvoie directement le lecteur (embarquable dans le Multiview) ; l'enveloppe reste
   utilisée si le paramètre est absent ou illisible. */
export function unwrapOnHockeyPlayer(href) {
    var url = String(href || '').trim();
    var qm = /^(?:https?:\/\/[^/]+\/)?(np_[a-z0-9_]+\.php)\?(?:.*&)?channel=([^&#]+)/i.exec(url);
    if (qm) {
        var wrapper = qm[1].toLowerCase();
        var channel = qm[2];
        try { channel = decodeURIComponent(channel); } catch(e) {}
        channel = channel.trim();
        if (wrapper === 'np_youtube.php' && /^[A-Za-z0-9_-]{6,}$/.test(channel)) return 'https://www.youtube.com/embed/' + channel;
        if (/^\/\//.test(channel)) return 'https:' + channel;
        if (/^https?:\/\//i.test(channel)) return channel;
        if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(channel)) return 'https://' + channel;
    }
    if (url.indexOf('//') === 0) return 'https:' + url;
    if (url.indexOf('http') !== 0) return resolveUrl(url, 'https://onhockey.tv/');
    return url;
}

/* OnHockey n'a pas de page par match : sa grille et ses lecteurs vivent tous dans
   schedule_table.php (l'accueil n'est qu'un frameset). Pointer les matchs vers
   l'accueil les rendait inexploitables — le script serveur écarte les adresses qui
   sont l'accueil d'une source, si bien qu'aucune page n'était jamais relue et que
   les matchs dont le lecteur n'est publié qu'à l'approche du coup d'envoi restaient
   vides jusqu'au lendemain. En pointant vers la grille elle-même, le serveur ET
   l'ouverture d'une fiche la relisent et récupèrent les lecteurs parus depuis. */
export function ONHOCKEY_SCHEDULE_URL() {
    return resolveUrl('schedule_table.php', ONHOCKEY_URL);
}

export function parseOnHockey(html) {
  var doc = new DOMParser().parseFromString(html, 'text/html');
  var matches = [];

  // onhockey.tv groups matches by league inside <tbody> elements in schedule_table.php
  var tbodies = doc.querySelectorAll('tbody');
  var matchIndex = 0;

  if (tbodies.length > 0) {
      for (var i = 0; i < tbodies.length; i++) {
          var tbody = tbodies[i];

          // onhockey structure: first tr in tbody usually contains the league name
          var firstTr = tbody.querySelector('tr');
          var leagueName = 'Hockey';
          if (firstTr && firstTr.textContent.trim() !== '') {
              leagueName = firstTr.textContent.replace(/standings|draw/gi, '').trim();
          }

          var textContent = tbody.textContent || '';
          var upText = textContent.toUpperCase();

          if (upText.indexOf('PWHL') >= 0) leagueName = 'PWHL';
          else if (upText.indexOf('LHJMQ') >= 0 || upText.indexOf('QMJHL') >= 0) leagueName = 'LHJMQ';

          var rows = tbody.querySelectorAll('tr.game');
          for (var r = 0; r < rows.length; r++) {
              var row = rows[r];
                  var tds = row.querySelectorAll('td');
                  if (tds.length >= 2) {
                      // The team names are usually in the second td.
                      // We clone it and remove .gamelinks to just get the text.
                      var tdClone = tds[1].cloneNode(true);
                      var gamelinksNode = tdClone.querySelector('.gamelinks');
                      if (gamelinksNode) gamelinksNode.remove();

                      // Remove extraneous geo-blocked messages or 'live stream will be available' messages
                      var matchText = tdClone.textContent.replace(/geo-blocked for[A-Z\/]+:[a-z\s]+|live stream will be available closer to the game time/gi, '').trim();

                      var teams = matchText.split(/ vs | v | - /i);
                      var home = 'Team 1';
                      var away = 'Team 2';

                      if (teams.length >= 2) {
                          home = teams[0].trim();
                          away = teams.slice(1).join(' - ').trim();
                      } else {
                          home = matchText.trim() || 'TBA';
                          away = 'TBA';
                      }

                      // Find all the stream links for this match
                      var streamLinksArr = [];
                      var linksContainer = row.querySelector('.gamelinks') || row; // fallback to entire row if .gamelinks is missing
                      if (linksContainer) {
                          var currentCategory = '';
                          for (var l = 0; l < linksContainer.childNodes.length; l++) {
                              var child = linksContainer.childNodes[l];

                              if (child.nodeType === 3) { // Text node
                                  var text = child.textContent.trim();
                                  if (text && text.endsWith(':')) {
                                      currentCategory = text.replace(':', '').trim();
                                  } else if (text && text.length > 0 && text !== '--' && text.indexOf('geo-blocked') === -1) {
                                      // Sometimes there's just a raw text without colon
                                      var parts = text.split(':');
                                      if(parts.length > 1) {
                                          currentCategory = parts[0].trim();
                                      } else {
                                          currentCategory = text.trim();
                                      }
                                  }
                              } else if (child.tagName === 'A') {
                                  var linkEl = child;
                                  var href = linkEl.getAttribute('href');
                                  if (!href) continue;

                                  var streamUrl = unwrapOnHockeyPlayer(href);

                                  var linkName = (linkEl.title || linkEl.textContent || 'Flux').trim();
                                  var finalName = 'OnHockey ' + (currentCategory ? currentCategory + ' - ' : '') + linkName;

                                  streamLinksArr.push({
                                      name: finalName,
                                      url: streamUrl,
                                      quality: 'HD',
                                      lang: currentCategory.toUpperCase().indexOf('FRENCH') >= 0 || currentCategory.toUpperCase().indexOf('FR') === 0 ? 'FR' : 'MULTI',
                                      icon: '🏒'
                                  });
                              }
                          }
                      }

                      // Heure : "<text class='game_hour'>15</text>:00" dans la 1re cellule, affichée en GMT
                      // (le site décale ensuite en JS selon le fuseau choisi) -> convertie en heure de l'Est.
                      var startTimeStr = '00:00';
                      var timeText = (tds[0].textContent || '').replace(/\s+/g, '');
                      var timeParts = timeText.match(/(\d{1,2}):(\d{2})/);
                      if (timeParts) {
                          var gmt = new Date(TARGET_DATE.getTime());
                          gmt.setUTCHours(parseInt(timeParts[1], 10), parseInt(timeParts[2], 10), 0, 0);
                          startTimeStr = getEstTimeStrFromDate(gmt);
                      }

                      streamLinksArr = finalizeStreamLinks(streamLinksArr);
                      matches.push({
                          id: 'onhockey_' + Date.now() + '_' + matchIndex++,
                          league: formatLeagueName(leagueName),
                          homeTeam: getOfficialTeamName(home),
                          awayTeam: getOfficialTeamName(away),
                          startTime: startTimeStr,
                          durationMinutes: getLeagueDuration('hockey'),
                          status: 'upcoming',
                          streamLinks: streamLinksArr,
                          streamsLoaded: streamLinksArr.length > 0,
                          matchUrl: ONHOCKEY_SCHEDULE_URL(),
                          source: 'onhockey',
                          matchDate: getEstDateStrFromDate(TARGET_DATE)
                      });
                  }
              }
      }
  } else {
      // Fallback: If tbodies are not found, look for general list items or div blocks containing links
      var lists = doc.querySelectorAll('li, .match-row, .event');
      for (var i = 0; i < lists.length; i++) {
          var item = lists[i];
          var links = item.querySelectorAll('a');
          if (links.length > 0) {
              var text = item.textContent.replace(/\s+/g, ' ').trim();

              var teams = text.split(/ vs | v | - /i);
              var home = 'Team 1';
              var away = 'Team 2';
              if (teams.length >= 2) {
                  home = teams[0].trim();
                  away = teams.slice(1).join(' - ').trim();
              } else {
                  home = text.trim();
              }

              var streamLinksArr = [];
              for (var l = 0; l < links.length; l++) {
                  var linkEl = links[l];
                  var href = linkEl.getAttribute('href');
                  if (!href) continue;

                  var streamUrl = unwrapOnHockeyPlayer(href);

                  streamLinksArr.push({
                      name: 'OnHockey ' + (linkEl.title || linkEl.textContent || 'Flux').trim(),
                      url: streamUrl,
                      quality: 'HD',
                      lang: 'MULTI',
                      icon: '🏒'
                  });
              }

              var startTimeStr = '00:00';
              var timeParts = text.match(/(\d+):(\d+)/);
              if (timeParts) {
                   startTimeStr = timeParts[1].padStart(2, '0') + ':' + timeParts[2];
              }

              var leagueName = 'Hockey';
              if (text.toUpperCase().indexOf('PWHL') >= 0) leagueName = 'PWHL';
              else if (text.toUpperCase().indexOf('LHJMQ') >= 0 || text.toUpperCase().indexOf('QMJHL') >= 0) leagueName = 'LHJMQ';

              matches.push({
                  id: 'onhockey_' + Date.now() + '_' + matchIndex++,
                  league: formatLeagueName(leagueName),
                  homeTeam: getOfficialTeamName(home),
                  awayTeam: getOfficialTeamName(away),
                  startTime: startTimeStr,
                  durationMinutes: getLeagueDuration('hockey'),
                  status: 'upcoming',
                  streamLinks: streamLinksArr,
                  streamsLoaded: streamLinksArr.length > 0,
                  matchUrl: ONHOCKEY_SCHEDULE_URL(),
                          source: 'onhockey',
                  matchDate: getEstDateStrFromDate(TARGET_DATE)
              });
          }
      }
  }

  lg('OnHockey extraits', matches.length);
  return matches;
}


/* ══ PARSE BUFFSTREAMS ════════════════ */
export function parseBuffstreams(html, pageUrl){
  // app.buffstreams.is (2026) : pages par ligue (mlb-streams-live-10, nfl-streams-live-10...),
  // un tableau avec une ligne par match :
  //   <tr><td><a href=".../<away>-live-stream"><p>Away Live Stream</p></a></td>
  //       <td><h4>2026-09-02</h4><h4>12:40 pm ET</h4></td>
  //       <td><a href=".../<home>-live-stream"><p>Home Live Stream</p></a></td></tr>
  var matches = [];
  var doc = new DOMParser().parseFromString(html, 'text/html');
  var base = pageUrl || BUFFSTREAMS_URL;
  var league = 'Sports';
  var lm = /\/(mlb|nfl|nba|nhl|cfb|ncaam|boxing|mma|motor|wnba|ncaab)[a-z-]*/i.exec(base || '');
  if (lm) {
      var key = lm[1].toLowerCase();
      league = { ncaam: 'NCAAB', motor: 'Motorsport', mma: 'MMA', boxing: 'Boxing', cfb: 'NCAAF' }[key] || key.toUpperCase();
  }
  var rows = doc.querySelectorAll('tr');
  [].forEach.call(rows, function(tr) {
      var links = [].filter.call(tr.querySelectorAll('a[href]'), function(a) { return /-live-stream/i.test(a.getAttribute('href') || ''); });
      if (links.length < 2) return;
      var clean = function(a) { return (a.textContent || '').replace(/live\s*stream/ig, '').replace(/\s+/g, ' ').trim(); };
      var away = clean(links[0]);
      var home = clean(links[links.length - 1]);
      if (!home || !away || home === away) return;

      var startTime = '00:00', matchDate = null;
      var text = tr.textContent || '';
      var dm = /(\d{4}-\d{2}-\d{2})/.exec(text);
      var tm = /(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(text);
      if (dm) matchDate = dm[1];
      if (tm) {
          var hh = parseInt(tm[1], 10), mm = parseInt(tm[2], 10);
          if (tm[3].toLowerCase() === 'pm' && hh < 12) hh += 12;
          if (tm[3].toLowerCase() === 'am' && hh === 12) hh = 0;
          startTime = pad(hh) + ':' + pad(mm); // le site affiche l'heure de l'Est
      }

      var href = links[links.length - 1].getAttribute('href');
      var matchUrl = href.indexOf('http') === 0 ? href : resolveUrl(href, base);
      if (matches.find(function(ex) { return ex.matchUrl === matchUrl && ex.awayTeam === away; })) return;

      matches.push({
          id: 'buff_' + Math.random().toString(36).substr(2, 9),
          league: formatLeagueName(league),
          flag: lgFlag(league),
          color: lgColor(league),
          homeTeam: getOfficialTeamName(home),
          awayTeam: getOfficialTeamName(away),
          startTime: startTime,
          matchDate: matchDate,
          durationMinutes: getLeagueDuration(league),
          status: 'upcoming',
          matchUrl: matchUrl,
          streamLinks: [],
          streamsLoaded: false,
          source: 'buffstreams'
      });
  });
  return matches;
}

/* ══ FOOTYBITE LOGOS SCRAPING ═════════ */
// Add footybite logo parsing
export function extractFootybiteLogos(doc) {
    var teams = doc.querySelectorAll('.txt-team');
    teams.forEach(function(teamEl) {
        var teamName = teamEl.textContent.trim();
        var box = teamEl.closest('.row');
        if(!box) return;
        var img = box.querySelector('img.img-icone');
        if(img && img.getAttribute('src') && img.getAttribute('src').indexOf('http') === 0 && img.getAttribute('src').indexOf('default') < 0) {
            // Logos are no longer cached
        }
    });
}



/* ══ PARSE STREAMONSPORT ═══════════════ */


/* ══ PARSE TOTALSPORTEK ════════════════ */

/* ══ PARSE VIPLEAGUE ════════════════ */
export function parseVipleague(html) {
    // vipleague.vg (2026) : page /live-now-streaming, une ligne par événement :
    //   <a href="/watch/<sport>/<home>-vs-<away>" title="Home - Away">
    //       <span content="2026-09-02T10:30" ...>10:30</span> Home - Away</a>
    // L'heure est en heure de Londres (fuseau du serveur), convertie ici en heure de l'Est.
    var matches = [];
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var links = doc.querySelectorAll('a[href*="/watch/"]');
    [].forEach.call(links, function(a) {
        var href = a.getAttribute('href') || '';
        var parts = href.split('/').filter(Boolean); // ['watch', sport, slug]
        var wi = parts.indexOf('watch');
        if (wi < 0 || parts.length < wi + 3) return;
        var sport = parts[wi + 1];
        var slug = parts[wi + 2];

        var title = (a.getAttribute('title') || a.textContent || '').replace(/\s+/g, ' ').trim();
        var home = '', away = '';
        var tSplit = title.split(/\s+(?:-|vs?\.?)\s+/i);
        if (tSplit.length >= 2) { home = tSplit[0].trim(); away = tSplit.slice(1).join(' ').trim(); }
        else if (slug.indexOf('-vs-') > 0) {
            var sp = slug.split('-vs-');
            home = sp[0].replace(/-/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
            away = sp.slice(1).join(' ').replace(/-/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
        } else {
            home = title || slug.replace(/-/g, ' ');
        }
        home = home.replace(/^\d{1,2}:\d{2}\s*/, '').trim();
        if (!home) return;

        var startTime = '00:00', matchDate = null;
        var span = a.querySelector('span[content]');
        var iso = span ? span.getAttribute('content') : null; // "2026-09-02T10:30" heure de Londres
        if (iso && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso)) {
            var naive = new Date(iso + ':00Z');
            var d = new Date(naive.getTime() - zoneOffsetMinutes(naive, 'Europe/London') * 60000);
            startTime = getEstTimeStrFromDate(d);
            matchDate = getEstDateStrFromDate(d);
        }

        var matchUrl = href.startsWith('http') ? href : resolveUrl(href, VIPLEAGUE_URL);
        if (!matchUrl.startsWith('http') || matches.find(function(m) { return m.matchUrl === matchUrl; })) return;

        var league = sport.replace(/-/g, ' ');
        var status = 'upcoming';
        var cls = (a.className || '') + ' ' + (a.parentElement ? a.parentElement.className || '' : '');
        if (/\blive\b/i.test(cls) || /\blive\b/i.test(a.textContent || '')) status = 'live';

        matches.push({
            id: 'vip_' + matches.length,
            league: formatLeagueName(league),
            flag: lgFlag(league),
            color: lgColor(league),
            homeTeam: getOfficialTeamName(home),
            awayTeam: away ? getOfficialTeamName(away) : '',
            matchUrl: matchUrl,
            startTime: startTime,
            matchDate: matchDate,
            durationMinutes: getLeagueDuration(league),
            status: status,
            streamLinks: [],
            streamsLoaded: false,
            source: 'vipleague'
        });
    });
    return matches;
}

/* Décalage (minutes) d'un fuseau IANA par rapport à UTC à une date donnée. */
export function zoneOffsetMinutes(date, tz) {
    try {
        var f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        var p = {};
        f.formatToParts(date).forEach(function(x) { p[x.type] = x.value; });
        var asUTC = Date.UTC(parseInt(p.year, 10), parseInt(p.month, 10) - 1, parseInt(p.day, 10), parseInt(p.hour, 10) % 24, parseInt(p.minute, 10));
        return Math.round((asUTC - date.getTime()) / 60000);
    } catch (e) { return 0; }
}

/* ══ PARSE METHSTREAMS ════════════════ */
export function parseMethstreams(html, pageUrl) {
    // methstreams.gs (2026) : pages par ligue (/league/mlbstreams...), une carte par match :
    //   <a class="card" href="/stream/a-vs-b"><div class="card-title">A vs B</div>
    //                                          <div class="card-subtitle">Start time: 12:40 PM ET</div></a>
    var matches = [];
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var base = pageUrl || METHSTREAMS_URL;
    var league = 'Sports';
    var lm = /\/league\/([a-z0-9]+)/i.exec(base || '');
    if (lm) league = lm[1].replace(/streams?$/i, '').toUpperCase();
    var h1 = doc.querySelector('h1');
    if (h1 && /streams schedule/i.test(h1.textContent)) league = h1.textContent.replace(/streams schedule/i, '').trim() || league;

    var cards = doc.querySelectorAll('a[href*="/stream/"]');
    [].forEach.call(cards, function(a) {
        var href = a.getAttribute('href') || '';
        var titleEl = a.querySelector('.card-title');
        var subEl = a.querySelector('.card-subtitle');
        var title = (titleEl ? titleEl.textContent : a.textContent).replace(/\s+/g, ' ').trim();
        title = title.replace(/start time:.*$/i, '').trim();
        var teams = title.split(/\s+vs\.?\s+|\s+v\s+|\s+-\s+/i);
        var home = teams[0] ? teams[0].trim() : '';
        var away = teams.length > 1 ? teams.slice(1).join(' ').trim() : '';
        if (!home || home.length < 2) return;

        var startTime = '00:00';
        var sub = subEl ? subEl.textContent : (a.textContent || '');
        var tm = /(\d{1,2}):(\d{2})\s*(AM|PM)?\s*(ET|EST|EDT)?/i.exec(sub);
        if (tm) {
            var hh = parseInt(tm[1], 10), mm = parseInt(tm[2], 10);
            if (tm[3] && tm[3].toUpperCase() === 'PM' && hh < 12) hh += 12;
            if (tm[3] && tm[3].toUpperCase() === 'AM' && hh === 12) hh = 0;
            startTime = pad(hh) + ':' + pad(mm);
        }

        var matchUrl = href.startsWith('http') ? href : resolveUrl(href, base);
        if (!matchUrl.startsWith('http') || matches.find(function(m) { return m.matchUrl === matchUrl; })) return;

        matches.push({
            id: 'meth_' + matches.length,
            league: formatLeagueName(league),
            flag: lgFlag(league),
            color: lgColor(league),
            homeTeam: getOfficialTeamName(home),
            awayTeam: away ? getOfficialTeamName(away) : '',
            matchUrl: matchUrl,
            startTime: startTime,
            durationMinutes: getLeagueDuration(league),
            status: /\blive\b/i.test(sub) ? 'live' : 'upcoming',
            streamLinks: [],
            streamsLoaded: false,
            source: 'methstreams'
        });
    });
    return matches;
}

/* ══ PARSER CHIRURGICAL ════════════════
   Classes footybite confirmées:
   .div-child-box  → chaque match (133x)
   .txt-team       → noms équipes (266x = 2 par match)
   .time-txt       → heure/score (133x)
   .btn-danger     → bouton flux (133x)
   .text-dark-light → titre de ligue (21x)
   .img-icone      → icône de ligue (20x)
═══════════════════════════════════════ */

export function parseMlbbite(html) {
    var matches = [];
    try {
        var doc = new DOMParser().parseFromString(html, "text/html");

        var items = doc.querySelectorAll(".inline-match-item, a[href*='/watch/live/'], a[href*='/match/']");

        var uniqueItems = [];
        var hrefs = new Set();
        [].forEach.call(items, function(el) {
            var href = el.getAttribute("href");
            if (href && !hrefs.has(href)) {
                hrefs.add(href);
                uniqueItems.push(el);
            }
        });

        uniqueItems.forEach(function(el, i) {
            var href = el.getAttribute("href");
            if (!href) return;

            var matchUrl = href.indexOf("http") === 0 ? href : resolveUrl(href, MLBBITE_PLUS_URL);

            var home = "TBD";
            var away = "TBD";
            var score = null;
            var status = "upcoming";
            var startTime = "00:00";

            var teams = el.querySelectorAll(".team---item b, .team-name, .name");
            if (teams.length >= 2) {
                home = teams[0].textContent.trim();
                away = teams[1].textContent.trim();
            } else {
                var urlMatch = href.match(/live\/([a-z0-9-]+)-(?:at|vs)-([a-z0-9-]+?)(?:-\d*-?free-live-stream(?:s)?|-live-stream)?(?:\.html|\/)?$/);
                if (urlMatch) {
                    away = urlMatch[1].replace(/-/g, ' ');
                    home = urlMatch[2].replace(/-/g, ' ');
                }
            }

            if (home === "TBD") {
                 var elText = el.textContent.replace(/\s+/g, ' ').trim();
                 var splitT = elText.split(/ vs | v | - /i);
                 if(splitT.length >= 2) {
                     home = splitT[0];
                     away = splitT.slice(1).join(' ');
                 }
            }

            if (home === "TBA" && away === "TBA") return;

            var dateEl = el.querySelector(".match-date, .time");
            if (dateEl) {
                var rawTime = (dateEl.getAttribute('title') || dateEl.textContent).replace(/\s+/g, ' ').trim();
                var timeM = rawTime.match(/(\d{1,2}):(\d{2})/);
                if (timeM) {
                    startTime = timeM[1].padStart(2, "0") + ":" + timeM[2];
                } else {
                    // Le site n'affiche qu'un délai relatif : "15 minutes from now", "2 hours from now", "9 minutes ago"
                    var relM = rawTime.match(/(\d+)\s*(minute|hour|day)s?\s*(from now|ago)/i);
                    if (relM) {
                        var delta = parseInt(relM[1], 10) * (relM[2].toLowerCase() === 'hour' ? 60 : relM[2].toLowerCase() === 'day' ? 1440 : 1);
                        var when = new Date(Date.now() + (relM[3].toLowerCase() === 'ago' ? -delta : delta) * 60000);
                        startTime = getEstTimeStrFromDate(when);
                    }
                }
            }
            var statusEl = el.querySelector(".result-status-text");
            var statusTxt = statusEl ? statusEl.textContent.trim().toLowerCase() : '';
            if (/\blive\b/.test(statusTxt) || /\blive-background\b/.test(el.className || '')) status = "live";
            else if (/finished|final|ended|\bft\b/.test(statusTxt)) status = "finished";

            matches.push({
                id: "mlbbite_" + i,
                homeTeam: getOfficialTeamName(home),
                awayTeam: getOfficialTeamName(away),
                status: status,
                score: score,
                startTime: startTime,
                matchUrl: matchUrl,
                streamLinks: [],
                streamsLoaded: false,
                league: "MLB",
                source: "mlbbite"
            });
        });

        // Next.js fallback for MLBite just in case they switched
        if (matches.length === 0) {
            var scriptRegex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g;
            var matchData;
            var concatenatedData = "";

            while ((matchData = scriptRegex.exec(html)) !== null) {
                var chunk = matchData[1];
                chunk = chunk.replace(/\\"/g, '"')
                             .replace(/\\\\/g, '\\')
                             .replace(/\\n/g, '\n');
                concatenatedData += chunk;
            }

            var matchUrlRegex = /"href":"(\/[a-z0-9-]+-streams[^"]*|\/game\/[^"]*)"(?:(?!"href":)[\s\S])*?"children":"([^"]+)"(?:(?!"href":)[\s\S])*?"children":"([^"]+)"(?:(?!"href":)[\s\S])*?"children":"([^"]+)"/gi;
            var mData;

            while ((mData = matchUrlRegex.exec(concatenatedData)) !== null) {
                var href2 = mData[1];
                var home2 = mData[2];
                var timeStr2 = mData[3];
                var away2 = mData[4];

                var startTime2 = '00:00';
                if (timeStr2.toLowerCase().indexOf('starts in') > -1) {
                    var startsInM = timeStr2.match(/Starts in (?:(\d+)hr:)?(\d+)min/i);
                    if (startsInM) {
                        var n = new Date();
                        var hAdd = startsInM[1] ? parseInt(startsInM[1]) : 0;
                        var mAdd = startsInM[2] ? parseInt(startsInM[2]) : 0;
                        n.setMinutes(n.getMinutes() + mAdd);
                        n.setHours(n.getHours() + hAdd);
                        startTime2 = pad(n.getHours()) + ':' + pad(n.getMinutes());
                    }
                }

                var matchUrl2 = resolveUrl(href2, MLBBITE_PLUS_URL);

                matches.push({
                    id: 'mlbbite_nx_' + Math.random().toString(36).substr(2, 9),
                    league: formatLeagueName('MLB'),
                    flag: lgFlag('MLB'),
                    color: lgColor('MLB'),
                    homeTeam: getOfficialTeamName(home2),
                    awayTeam: getOfficialTeamName(away2),
                    startTime: startTime2,
                    durationMinutes: getLeagueDuration('MLB'),
                    status: 'upcoming',
                    matchUrl: matchUrl2,
                    streamLinks: [],
                    streamsLoaded: false,
                    source: 'mlbbite'
                });
            }
        }
    } catch (e) {}
    lg("MLBBite extraits", matches.length);
    return matches;
}

export function parseFootybite(html){
  var matches = [];
  try {
      var scriptRegex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g;
      var match;
      var concatenatedData = "";

      while ((match = scriptRegex.exec(html)) !== null) {
          var chunk = match[1];
          chunk = chunk.replace(/\\"/g, '"')
                       .replace(/\\\\/g, '\\')
                       .replace(/\\n/g, '\n');
          concatenatedData += chunk;
      }

      // Format Next.js (2026) : chaque ligne de match est
      //   {"href":"/game/<slug>", "className":"match-row ...", "children":[ <titre>, <heure/état>, <bouton> ]}
      // Les enfants sont soit inline ("children":"Qatar vs Oman"), soit des références
      // paresseuses ("$L21") résolues plus loin dans le payload sur une ligne "21:[...]".
      // Les lignes sont regroupées par ["$","section","<sport>", ...].
      var sectionRe = /"\$","section","([^"]+)"/g;
      var sections = [];
      var sm;
      while ((sm = sectionRe.exec(concatenatedData)) !== null) sections.push({ idx: sm.index, name: sm[1] });

      function childrenStrings(segment) {
          var out = [], re = /"children":"([^"]*)"/g, cm;
          while ((cm = re.exec(segment)) !== null) out.push(cm[1]);
          return out;
      }
      function resolveLazy(id) {
          var re = new RegExp('(?:^|\\n)' + id.replace('$L', '') + ':(.*)');
          var lm = re.exec(concatenatedData);
          return lm ? childrenStrings(lm[1]) : [];
      }

      // Le payload contient aussi un ItemList JSON-LD : {"url":"https://.../game/<slug>","name":"A vs B"} pour chaque match.
      // C'est la source la plus fiable pour les noms (les lignes du tableau ont des enfants chargés paresseusement).
      var ldNames = {};
      var ldRe = /"url":"(https?:\/\/[^"]*\/game\/[^"]+)","name":"([^"]+)"/g;
      var ldm;
      while ((ldm = ldRe.exec(concatenatedData)) !== null) {
          try { ldNames[new URL(ldm[1]).pathname] = ldm[2]; } catch(e) {}
      }

      var hrefRe = /"href":"(\/game\/[^"]+)"/g;
      var hm;
      var seen = {};
      while ((hm = hrefRe.exec(concatenatedData)) !== null) {
          var href = hm[1];
          if (seen[href]) continue;
          var rowStart = hm.index;
          var nextHref = concatenatedData.indexOf('"href":"', rowStart + 8);
          var nextSection = concatenatedData.indexOf('"$","section"', rowStart + 8);
          var rowEnd = Math.min(nextHref < 0 ? Infinity : nextHref, nextSection < 0 ? Infinity : nextSection, rowStart + 4000);
          var segment = concatenatedData.slice(rowStart, rowEnd);
          if (segment.indexOf('match-row') < 0) continue; // lien de navigation, pas une ligne de match
          seen[href] = true;

          var strs = childrenStrings(segment);
          var lazy = /"children":\[("\$L[0-9a-f]+"(?:,"\$L[0-9a-f]+")*)\]/.exec(segment);
          if (strs.length < 2 && lazy) {
              strs = [];
              lazy[1].split(',').forEach(function(idq) { strs = strs.concat(resolveLazy(idq.replace(/"/g, ''))); });
          }
          var ldName = ldNames[href.split('?')[0]] || '';
          if (strs.length === 0 && !ldName) continue;

          // Les chaînes d'une ligne : [titre | équipe1, équipe2] puis heure/état puis bouton.
          var isTimeLike = function(t) { return /starts in|match started|\blive\b|\bft\b|full ?time|ended|\d{1,2}:\d{2}|\bvs\.?$/i.test(t); };
          var timeIdx = -1;
          for (var ti = 0; ti < strs.length; ti++) { if (isTimeLike(strs[ti]) && !/\svs\.?\s/i.test(strs[ti])) { timeIdx = ti; break; } }
          var titleParts = timeIdx > 0 ? strs.slice(0, timeIdx) : [strs[0]];
          var timeStr = timeIdx >= 0 ? strs[timeIdx] : (strs.length > 1 ? strs[1] : '');
          var home = '', away = '';
          if (ldName) {
              home = ldName;
              var ldSplit = ldName.split(/\s+vs?\.?\s+/i);
              if (ldSplit.length >= 2) { home = ldSplit[0].trim(); away = ldSplit.slice(1).join(' vs ').trim(); }
              if (timeIdx < 0) { for (var tj = 0; tj < strs.length; tj++) { if (isTimeLike(strs[tj])) { timeStr = strs[tj]; break; } } }
          } else if (titleParts.length >= 2) { home = titleParts[0].trim(); away = titleParts[1].trim(); }
          else {
              var title = titleParts[0] || '';
              home = title;
              var vsSplit = title.split(/\s+vs?\.?\s+/i);
              if (vsSplit.length >= 2) { home = vsSplit[0].trim(); away = vsSplit.slice(1).join(' vs ').trim(); }
          }
          if (!home) continue;

          var sectionName = 'Football';
          for (var si = 0; si < sections.length; si++) { if (sections[si].idx < rowStart) sectionName = sections[si].name; else break; }

          var startTime = '00:00';
          var status = 'upcoming';
          var minute = null;
          var tl = timeStr.toLowerCase();

          if (tl.indexOf('starts in') > -1) {
              var startsInM = timeStr.match(/Starts in (?:(\d+)\s*hr:?)?\s*(\d+)\s*min/i);
              if (startsInM) {
                  var n = new Date();
                  var hAdd = startsInM[1] ? parseInt(startsInM[1]) : 0;
                  var mAdd = startsInM[2] ? parseInt(startsInM[2]) : 0;
                  n.setMinutes(n.getMinutes() + mAdd);
                  n.setHours(n.getHours() + hAdd);
                  startTime = getEstTimeStrFromDate(n);
              }
          } else if (tl.indexOf('match started') > -1 || tl.indexOf('live') > -1) {
              startTime = getEstTimeStrFromDate(new Date());
              status = 'live';
          } else if (tl.indexOf('ft') > -1 || tl.indexOf('full') > -1 || tl.indexOf('ended') > -1) {
              status = 'finished';
              minute = 'FT';
          } else {
              var hhmm = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
              if (hhmm) {
                  var hh = parseInt(hhmm[1], 10), mm2 = parseInt(hhmm[2], 10);
                  if (hhmm[3] && hhmm[3].toLowerCase() === 'pm' && hh < 12) hh += 12;
                  if (hhmm[3] && hhmm[3].toLowerCase() === 'am' && hh === 12) hh = 0;
                  startTime = pad(hh) + ':' + pad(mm2);
              }
          }

          var matchUrl = href.startsWith("http") ? href : resolveUrl(href, SITE);
          var league = sectionName.replace(/-/g, ' ');

          matches.push({
              id: 'fb_nx_' + Math.random().toString(36).substr(2, 9),
              league: formatLeagueName(league),
              flag: lgFlag(league),
              color: lgColor(league),
              homeTeam: getOfficialTeamName(home),
              awayTeam: away ? getOfficialTeamName(away) : '',
              startTime: startTime,
              durationMinutes: getLeagueDuration(league),
              status: status,
              minute: minute,
              matchUrl: matchUrl,
              streamLinks: [],
              streamsLoaded: false,
              source: 'footybite'
          });
      }
  } catch(e) { }

  // Fallback to legacy DOM parsing if Next.js extraction yields nothing
  if (matches.length === 0) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var possibleMatches = doc.querySelectorAll('a[href*="/game/"]');

      extractFootybiteLogos(doc);

      [].forEach.call(possibleMatches, function(el, i) {
          var spans = el.querySelectorAll('span');
          if (spans.length < 2) return;

          var home = '';
          var away = '';
          var timeStr = '';

          if (spans.length === 3) {
              home = spans[0].textContent.trim();
              away = '';
              timeStr = spans[1].textContent.trim();
          } else if (spans.length >= 4) {
              home = spans[0].textContent.trim();
              timeStr = spans[1].textContent.trim();
              away = spans[2].textContent.trim();
          }

          if (!home) return;

          var startTime = '00:00';
          var status = 'upcoming';
          var score = null;
          var minute = null;

          if (timeStr.toLowerCase().indexOf('starts in') > -1) {
              var startsInM = timeStr.match(/Starts in (?:(\d+)hr:)?(\d+)min/i);
              if (startsInM) {
                  var n = new Date();
                  var hAdd = startsInM[1] ? parseInt(startsInM[1]) : 0;
                  var mAdd = startsInM[2] ? parseInt(startsInM[2]) : 0;
                  n.setMinutes(n.getMinutes() + mAdd);
                  n.setHours(n.getHours() + hAdd);
                  startTime = pad(n.getHours()) + ':' + pad(n.getMinutes());
                  status = 'upcoming';
              }
          } else if (timeStr.toLowerCase().indexOf('match started') > -1 || timeStr.toLowerCase().indexOf('live') > -1) {
              var n2 = new Date();
              startTime = pad(n2.getHours()) + ':' + pad(n2.getMinutes());
              status = 'live';
          } else if (timeStr.toLowerCase().indexOf('ft') > -1 || timeStr.toLowerCase().indexOf('full') > -1) {
              status = 'finished';
              minute = 'FT';
          }

          var matchUrl = resolveUrl(el.getAttribute('href') || '', SITE);
          var league = 'Football';
          if (home.toLowerCase().indexOf('gp') > -1 || home.toLowerCase().indexOf('sprint race') > -1) {
              league = 'F1';
          }

          matches.push({
              id: 'fb_fb_' + i,
              league: formatLeagueName(league),
              flag: lgFlag(league),
              color: lgColor(league),
              homeTeam: getOfficialTeamName(home),
              awayTeam: getOfficialTeamName(away),
              startTime: startTime,
              durationMinutes: getLeagueDuration(league),
              status: status,
              score: score,
              minute: minute,
              matchUrl: matchUrl,
              streamLinks: [],
              streamsLoaded: false,
              source: 'footybite'
          });
      });
  }

  lg('Matchs extraits', matches.length);
  return matches;
}


/* ══ CACHE STREAMS (2 hours) ══════════════ */
export function getStreamCache(mid) {
    var globalCache = safeStorageGetJSON('stream_cache', {});
    var matchCache = globalCache[mid];

    if (matchCache && matchCache.streams && matchCache.streams.length > 0) {
        // Shorter cache lifespan: 30 minutes. Let's make sure we have fresh streams.
        if (Date.now() - matchCache.ts < 30 * 60 * 1000) {
            return matchCache.streams;
        } else {
            delete globalCache[mid];
            safeStorageSetJSON('stream_cache', globalCache);
        }
    }
    return null;
}

export function saveStreamCache(mid, streams) {
    // Only cache if there are actual streams to avoid caching empty results
    if (!streams || streams.length === 0) return;

    var globalCache = safeStorageGetJSON('stream_cache', {});
    var now = Date.now();

    // Clean up older items to avoid large local storage footprint
    for (var k in globalCache) {
        if (now - globalCache[k].ts >= 30 * 60 * 1000) {
            delete globalCache[k];
        }
    }

    globalCache[mid] = { ts: now, streams: streams };
    safeStorageSetJSON('stream_cache', globalCache);
}

/* ══ REGISTRE D'INTÉGRABILITÉ ══════════════════════════════════════════════
   Quels hôtes acceptent d'être affichés dans une <iframe> ? Ce n'est pas
   devinable depuis l'adresse : c'est le serveur distant qui le décide, par ses
   en-têtes X-Frame-Options / frame-ancestors, illisibles depuis une iframe
   cross-origin en JavaScript. Deux sources l'alimentent : le script serveur, qui
   lit ces en-têtes directement (readFramePolicy, scripts/scrape_streams.mjs) et
   les publie dans data/streams.json — c'est la source fiable ; et le lecteur
   Multivision, qui enregistre un refus quand l'utilisateur clique « Ouvrir dans
   un onglet » depuis l'avertissement affiché sur un lien classé « page »
   (js/multiview.js: fallbackToIframe) — un signal plus rare mais couvrant les
   hôtes que le serveur n'a pas sondés. Le verdict est persisté et réinjecté dans
   la notation : c'est ce qui rend l'extraction adaptative plutôt que figée dans
   une liste écrite à la main. */
var _embedRegistry = null;
export function getEmbedRegistry() {
    if (_embedRegistry) return _embedRegistry;
    var stored = safeStorageGetJSON('embed_registry', null);
    _embedRegistry = (stored && stored.players) ? stored : createRegistry();
    return _embedRegistry;
}
export function saveEmbedRegistry() {
    safeStorageSetJSON('embed_registry', getEmbedRegistry());
}
/* Appelé par le lecteur : `embedded` vaut false quand l'iframe est restée vide
   (X-Frame-Options). Deux refus sans aucun succès suffisent à basculer l'hôte
   en ouverture d'onglet pour tous ses liens, présents et futurs. */
export function recordEmbedResult(host, embedded) {
    if (!host) return;
    noteEmbedResult(getEmbedRegistry(), host, embedded);
    saveEmbedRegistry();
}

/* ══ FETCH SUB-PAGES (STREAMS) ════════════ */
export function fetchSubPages(matches){
  var now = new Date();
  var currentEstDateStr = getEstDateStrFromDate(now);
  var currentEstTimeStr = getEstTimeStrFromDate(now);
  var currentParts = currentEstTimeStr.split(':');

  // Calculate absolute current minutes (since epoch) using EST date string and time string
  var currentAbsoluteMins = Math.floor(new Date(currentEstDateStr + 'T00:00:00Z').getTime() / 60000) +
                            parseInt(currentParts[0], 10) * 60 + parseInt(currentParts[1], 10);

  // We use a limited concurrency pool so we don't spam the proxy/network
  var concurrency=5;
  var queue=matches.filter(function(m){
      if (m.status === 'live' && !m.refreshedOnStart) {
          m.refreshedOnStart = true;
          m.streamsLoaded = false;
      }

      // if it has >= 100 streams, skip
      if (m.streamLinks && m.streamLinks.length >= 1000) {
          m.streamsLoaded = true;
          return false;
      }
      // Si on a très peu/pas de flux, on ne considère pas les streams comme "définitivement" chargés
      // pour le background refresh. Cela permet de réessayer si on a ouvert le modal trop tôt.
      var hasEnoughStreams = m.streamLinks && m.streamLinks.length > 0;
      if (!m.matchUrl || (m.streamsLoaded && hasEnoughStreams)) return false;

      if (m.startTime && m.matchDate) {
          var mParts = m.startTime.split(':');
          var matchAbsoluteStartMins = Math.floor(new Date(m.matchDate + 'T00:00:00Z').getTime() / 60000) +
                                       parseInt(mParts[0], 10) * 60 + parseInt(mParts[1], 10);

          var matchAbsoluteEndMins = matchAbsoluteStartMins + (m.durationMinutes || 120);

          var diffStart = matchAbsoluteStartMins - currentAbsoluteMins;
          var diffEnd = matchAbsoluteEndMins - currentAbsoluteMins;

          // Only fetch if current time is within [start - 60, end + 60]
          // which means current is >= start - 60 (diffStart <= 60)
          // and current is <= end + 60 (diffEnd >= -60)
          if (diffStart > 60) {
              return false; // Too early, don't fetch (even if playoff)
          }
          if (diffEnd < -60 && !(m.isPlayoff && m.status !== 'finished')) {
              return false; // Too late, unless it's an unfinished playoff game
          }
      }
      return true;
  });
  queue.sort(function(a, b) {
    var aLive = a.status === 'live' ? 1 : 0;
    var bLive = b.status === 'live' ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;

    var aFooty = a.matchUrl && a.matchUrl.includes('footybite') ? 1 : 0;
    var bFooty = b.matchUrl && b.matchUrl.includes('footybite') ? 1 : 0;
    if (aFooty !== bFooty) return bFooty - aFooty;

    var aFav = (favTeams[a.homeTeam] || favTeams[a.awayTeam]) ? 1 : 0;
    var bFav = (favTeams[b.homeTeam] || favTeams[b.awayTeam]) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;

    var aNhl = (a.league && a.league.toLowerCase() === 'nhl') ? 1 : 0;
    var bNhl = (b.league && b.league.toLowerCase() === 'nhl') ? 1 : 0;
    if (aNhl !== bNhl) return bNhl - aNhl;

    return 0;
  });
  var active=0;

  function next(){
    if(queue.length===0 && active===0){
      lg('Scrape streams','Terminé pour tous les matchs');
      return;
    }
    while(active<concurrency && queue.length>0){
      active++;
      /* `let` et non `var` : avec var, une seule variable était partagée par les cinq
         promesses en vol, si bien que le rappel d'échec marquait `streamsLoaded` sur le
         DERNIER match dépilé — celui qui avait réellement échoué restait bloqué en
         chargement, précisément ce que le commentaire ci-dessous prétend éviter. */
      let m=queue.shift();
      scrapeMatchFlux(m).then(function(){
        active--;
        setTimeout(next, 0);
      }).catch(function(e){
        lg('Err scrape '+m.homeTeam,e.message);
        addScrapeLog(m.matchUrl, 'error', 'Match scrape failed: ' + e.message);
        m.streamsLoaded = true; // Empêche un blocage infini dans l'UI
        m.streamLinks = m.streamLinks || [];
        updateMatchUiAfterScrape(m);
        active--;
        setTimeout(next, 0);
      });
    }
  }
  next();
}

/* Extraction pure des liens de flux depuis le HTML d'une page de match.
   Aucune E/S ni DOM global (hormis DOMParser) : réutilisée par scrapeMatchFlux côté client
   et par scripts/scrape_streams.mjs côté serveur (GitHub Actions). */
/* Hôtes qui ne sont jamais des lecteurs : réseaux sociaux ("Follow us"), messageries, et les
   clones partenaires que MLBBite/Methstreams affichent en pied de page ("Watch on …") : ce sont
   des pages de match d'autres agrégateurs, pas des flux. */
var JUNK_STREAM_HOSTS = /(^|\.)(x\.com|twitter\.com|facebook\.com|instagram\.com|tiktok\.com|t\.me|telegram\.(me|org)|discord\.(gg|com)|reddit\.com|youtube\.com|youtu\.be|chatango\.com|thestreameast\.top|isportsurge\.ws|mybuffstreams\.plus|crackstreams\.page|footybite\.ir|methstreams\.click|1stream\.ws|thetvapp\.plus|nflbite\.im|nbabite\.im|totalsportek\.bet)$/i;
export function isJunkStreamHost(hostname, path) {
    var h = String(hostname || '').toLowerCase();
    if (!JUNK_STREAM_HOSTS.test(h)) return false;
    // les lecteurs YouTube embarqués restent valides
    if (/youtube\.com$/.test(h) && /^\/embed\//.test(path || '')) return false;
    return true;
}

/* Chaînes de télévision reconnues dans l'adresse ou le libellé d'un lecteur.
   Ordre important : les entrées les plus spécifiques d'abord (« sky sports f1 » avant
   « sky sports »), sinon la moins précise gagnerait. */
var TV_CHANNELS = [
    ['sky sports f1', 'Sky Sports F1'], ['sky sports main event', 'Sky Sports Main Event'],
    ['sky sports football', 'Sky Sports Football'], ['sky sports arena', 'Sky Sports Arena'],
    ['sky sports action', 'Sky Sports Action'], ['sky sports', 'Sky Sports'], ['sky f1', 'Sky Sports F1'],
    ['nfl redzone', 'NFL RedZone'], ['redzone', 'NFL RedZone'],
    ['nfl network', 'NFL Network'], ['nflnetwork', 'NFL Network'],
    ['nhl network', 'NHL Network'], ['nhlnetwork', 'NHL Network'],
    ['nba tv', 'NBA TV'], ['nbatv', 'NBA TV'],
    ['mlb network', 'MLB Network'], ['mlbnetwork', 'MLB Network'],
    ['espn deportes', 'ESPN Deportes'], ['espnu', 'ESPNU'], ['espn2', 'ESPN2'], ['espn', 'ESPN'],
    ['tsn', 'TSN'], ['rds', 'RDS'], ['sportsnet', 'Sportsnet'],
    ['bein sports', 'beIN Sports'], ['beinsports', 'beIN Sports'], ['bein', 'beIN Sports'],
    ['fox sports', 'Fox Sports'], ['foxsports', 'Fox Sports'],
    ['tnt sports', 'TNT Sports'], ['tntsports', 'TNT Sports'],
    ['dazn', 'DAZN'], ['peacock', 'Peacock'], ['paramount', 'Paramount+'],
    ['prime video', 'Prime Video'], ['amazon prime', 'Prime Video'],
    ['canal+', 'Canal+'], ['canalplus', 'Canal+'], ['eurosport', 'Eurosport'],
    ['belarus 5', 'Belarus 5'], ['belarus5', 'Belarus 5'],
    ['usa network', 'USA Network'], ['abc', 'ABC'], ['cbs', 'CBS'], ['nbc', 'NBC']
];

var LANG_HINTS = [
    [/\b(english|anglais|\ben\b|uk|usa|\bus\b)\b/i, 'EN'],
    [/\b(french|fran[cç]ais|\bfr\b|rds|canal\+)\b/i, 'FR'],
    [/\b(spanish|espa[nñ]ol|\bes\b|deportes)\b/i, 'ES'],
    [/\b(german|deutsch|\bde\b)\b/i, 'DE'],
    [/\b(italian|italiano|\bit\b)\b/i, 'IT'],
    [/\b(portuguese|portugu[eê]s|\bpt\b|brasil)\b/i, 'PT'],
    [/\b(arabic|arab|\bar\b)\b/i, 'AR']
];

/* Décrit un lien de lecteur à partir de son adresse et de son libellé :
     site    : hôte lisible (« embedsports.me »), pour savoir d'où vient le flux ;
     channel : chaîne de télévision diffusée, quand elle est identifiable ;
     quality : uniquement si l'adresse ou le libellé l'annonce réellement ;
     lang    : langue déduite du libellé, de la chaîne ou du pays dans l'adresse.
   Ces informations servent à choisir un flux sans l'ouvrir. */
export function describeStreamLink(url, label) {
    var out = { site: '', channel: '', quality: '', lang: '' };
    var host = '', path = '';
    try { var u = new URL(url); host = u.hostname.replace(/^www\./, ''); path = decodeURIComponent(u.pathname + u.search); }
    catch (e) { path = String(url || ''); }
    out.site = host;

    var slug = path.replace(/[_+%]/g, ' ').replace(/[/.-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    var text = (String(label || '') + ' ' + slug).toLowerCase();

    // Une adresse « équipe-vs-équipe » désigne un match, pas une chaîne.
    var looksLikeMatch = /\bvs\b|\bv\b\s|-vs-/.test(path.toLowerCase());
    for (var i = 0; i < TV_CHANNELS.length; i++) {
        var needle = TV_CHANNELS[i][0];
        if (text.indexOf(needle) >= 0) {
            if (looksLikeMatch && /^(abc|cbs|nbc|espn|tsn|rds)$/.test(needle)) continue; // trop court pour trancher
            out.channel = TV_CHANNELS[i][1];
            break;
        }
    }

    var qm = /\b(4k|2160p?|1440p|1080p|720p|480p|360p|full ?hd|uhd)\b/i.exec(text);
    if (qm) {
        var q = qm[1].toLowerCase();
        out.quality = q === 'full hd' || q === 'fullhd' ? '1080p' : (q === 'uhd' ? '4K' : q.toUpperCase().replace('P', 'p'));
    } else if (/\bhd\b/i.test(String(label || ''))) {
        out.quality = 'HD';
    }

    for (var j = 0; j < LANG_HINTS.length; j++) {
        if (LANG_HINTS[j][0].test(text)) { out.lang = LANG_HINTS[j][1]; break; }
    }
    if (!out.lang && out.channel) {
        if (/rds|canal\+/i.test(out.channel)) out.lang = 'FR';
        else if (/espn deportes/i.test(out.channel)) out.lang = 'ES';
    }
    return out;
}

/* Libellés qui ne désignent jamais un flux.
   Deux familles, volontairement séparées :
     - des phrases parasites qui peuvent apparaître n'importe où dans le libellé, souvent
       accolées au nom de la source (« OnHockey (opens in a new tab) ») ;
     - des mots de navigation qui ne sont parasites qu'en tête de libellé, sinon on
       écarterait à tort un flux légitime nommé « Home ice feed » par exemple. */
var JUNK_LABEL_ANYWHERE = /(opens in a new tab|click if you want|watch a different game|regarder un autre match)/i;
var JUNK_LABEL_PREFIX = /^(voir tous|see all|more games|autres matchs|home|accueil|menu)\b/i;
function isJunkStreamLabel(name) {
    var t = String(name || '').trim();
    if (!t) return false;
    return JUNK_LABEL_ANYWHERE.test(t) || JUNK_LABEL_PREFIX.test(t);
}

/* Adresses qui pointent vers l'accueil ou une page d'index d'un site de lecteurs plutôt
   que vers un flux : « index-version-27 », « /index.php », « /home ». Elles arrivaient
   attachées à plusieurs matchs différents, ce qui trompait l'utilisateur. */
export function isIndexPageUrl(url) {
    var path = '';
    try { path = new URL(url).pathname.toLowerCase(); } catch (e) { return false; }
    if (/^\/?(index|home|accueil)([.-][a-z0-9-]*)?\/?$/.test(path)) return true;
    if (/\/index([.-][a-z0-9-]*)?(\.[a-z]+)?$/.test(path)) return true;
    return false;
}

/* Deux adresses ne différant que par le protocole, « www. », une barre finale ou la
   casse de l'hôte désignent le même lecteur : on les compare sous forme normalisée. */
export function normalizeStreamUrl(url) {
    var raw = String(url || '').trim();
    try {
        var u = new URL(raw);
        var host = u.hostname.toLowerCase().replace(/^www\./, '');
        var path = u.pathname.replace(/\/+$/, '');
        return host + path + (u.search || '');
    } catch (e) { return raw.toLowerCase().replace(/\/+$/, ''); }
}

/* Passage obligé de tout lien de lecteur, quelle que soit sa provenance (extraction
   générique, parseur OnHockey, parseur Streameast, cache serveur). Il écarte les faux
   liens, dédoublonne réellement et renseigne site / chaîne / qualité / langue.
   Avant, seule l'extraction générique nettoyait et enrichissait : un tiers des liens
   arrivaient sans provenance, avec une qualité « HD » inventée par défaut. */
/* Lien de repli vers la page du match sur le site source : ce n'est pas un lecteur
   intégrable, mais l'utilisateur peut l'ouvrir dans un onglet. Renvoie un tableau vide
   si ce lien est déjà présent. */
export function matchPageFallbackLink(matchUrl, existing) {
    if (!matchUrl) return [];
    if ((existing || []).some(function(l) { return l && l.url === matchUrl; })) return [];
    var siteName = matchUrl;
    try { siteName = new URL(matchUrl).hostname.replace(/^(www|v2)\./, ''); } catch (e) {}
    return [{ name: 'Page du match sur ' + siteName, quality: '', lang: '', url: matchUrl, icon: '🔗', topLevel: true }];
}

export function finalizeStreamLinks(links) {
    var seen = {};
    var out = [];
    (links || []).forEach(function(l) {
        if (!l || !l.url || typeof l.url !== 'string') return;
        var u = l.url.trim();
        if (u.indexOf('http') !== 0) return;
        if (isJunkStreamLabel(l.name)) return;
        if (isIndexPageUrl(u)) return;

        var key = normalizeStreamUrl(u);
        if (seen[key]) return;
        seen[key] = true;

        l.url = u;
        l.name = String(l.name || 'Flux').replace(/\s+/g, ' ').trim();
        if (l.name.length > 60) l.name = l.name.slice(0, 57) + '...';

        var info = describeStreamLink(u, l.name);
        l.site = info.site;
        if (info.channel) l.channel = info.channel;

        /* Qualité : les parseurs mettaient « HD » ou « SD » par défaut, si bien que le
           badge affichait la même chose pour tout le monde. On ne garde une valeur que
           si l'adresse ou le libellé l'annonce vraiment ; sinon le badge est masqué. */
        if (info.quality) l.quality = info.quality;
        else if (!/\d{3,4}p|4k|kbps/i.test(String(l.quality || ''))) l.quality = '';

        if (info.lang) l.lang = info.lang;
        else l.lang = String(l.lang || '').toUpperCase() === 'MULTI' ? 'MULTI' : String(l.lang || '').toUpperCase();

        out.push(l);
    });
    return out;
}

export function extractStreamLinks(html, m) {
    var doc=new DOMParser().parseFromString(html,'text/html');
    var links=[];
    var pageTextContext = doc.body ? doc.body.textContent || '' : '';
    var pageLinksContext = [];

    // === TOUTES SOURCES : RECHERCHE LARGE DE FLUX ===

    // OnHockey specific logic for stream extraction from aggregate page
    var pageHost = ''; try { pageHost = new URL(m.matchUrl).hostname.toLowerCase(); } catch(e) { pageHost = String(m.matchUrl || '').toLowerCase(); }
    // Les branches spécifiques dépendent du site de la PAGE lue (pas de m.source, qui peut venir d'une autre source après fusion)
    if (m.matchUrl === ONHOCKEY_URL || pageHost.indexOf('onhockey') >= 0) {
        // Enforce that OnHockey only bleeds into actual Hockey matches to avoid generic match collision with other sports
        var mLeague = (m.league || '').toLowerCase();
        var isBball = mLeague.indexOf('nba') >= 0 || mLeague.indexOf('basketball') >= 0;
        var isBase = mLeague.indexOf('mlb') >= 0 || mLeague.indexOf('baseball') >= 0;
        var isFootball = mLeague.indexOf('nfl') >= 0 || mLeague.indexOf('american') >= 0;

        // If the match is explicitly confirmed as a non-hockey major sport, do not attempt OnHockey merge
        if (!isBball && !isBase && !isFootball) {
            var ohMatches = parseOnHockey(html);
            var matchingOh = ohMatches.find(function(oh) { return isMatchPair(m, oh); });
            if (matchingOh && matchingOh.streamLinks) {
                matchingOh.streamLinks.forEach(function(sl) {
                    if (!links.find(function(l) { return l.url === sl.url; })) {
                        links.push(sl);
                    }
                });
            }
        }
    }

        // StreamEast specific logic (Next.js data extraction)

    // Footybite subpage specific Next.js logic for streams
    if (pageHost.indexOf('footybite') >= 0) {
        var scriptRegex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g;
        var match;
        var concatenatedData = "";

        while ((match = scriptRegex.exec(html)) !== null) {
            var chunk = match[1];
            chunk = chunk.replace(/\\"/g, '"')
                         .replace(/\\\\/g, '\\')
                         .replace(/\\n/g, '\n');
            concatenatedData += chunk;
        }

        try {
            var serverIndex = 1;

            // Legacy / alternate direct extraction
            var urlRegex = /"url":"(https?:\/\/[^"]+)"/g;
            var urlMatch;

            while ((urlMatch = urlRegex.exec(concatenatedData)) !== null) {
                var streamUrl = urlMatch[1];
                if (!streamUrl.includes('w3.org') && !streamUrl.includes('cloudflare') && !streamUrl.includes('dashgenius') && !streamUrl.includes('gstatic')) {
                    if (isMatchOrLeaguePage(streamUrl, m)) continue;
                    links.push({
                        name: 'Serveur ' + serverIndex,
                        quality: 'HD',
                        lang: 'MULTI',
                        url: streamUrl,
                        icon: '📺',
                        scrapeContext: { blockText: streamUrl, pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                    });
                    serverIndex++;
                }
            }

            // Stream arrays matching directStreams and iframeStreams
            var directMatch = /"directStreams":(\[.*?\])/.exec(concatenatedData);
            var iframeMatch = /"iframeStreams":(\[.*?\])/.exec(concatenatedData);

            if (directMatch) {
                var directStreams = JSON.parse(directMatch[1]);
                directStreams.forEach(function(s) {
                    if (s.link && !links.find(l => l.url === s.link)) {
                        if (isMatchOrLeaguePage(s.link, m)) return;
                        links.push({
                            name: 'Serveur ' + serverIndex + (s.name ? ' - ' + s.name : ''),
                            quality: extractQuality((s.name || '') + ' ' + (s.quality || '')),
                            lang: 'MULTI',
                            url: s.link,
                            icon: '📺',
                            scrapeContext: { blockText: JSON.stringify(s), pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                        });
                        serverIndex++;
                    }
                });
            }

            if (iframeMatch) {
                var iframeStreams = JSON.parse(iframeMatch[1]);
                iframeStreams.forEach(function(s) {
                    if (s.src && !links.find(l => l.url === s.src)) {
                        if (isMatchOrLeaguePage(s.src, m)) return;
                        links.push({
                            name: 'Serveur ' + serverIndex + (s.name ? ' - ' + s.name : ''),
                            quality: 'HD',
                            lang: 'MULTI',
                            url: s.src,
                            icon: '📺',
                            scrapeContext: { blockText: JSON.stringify(s), pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                        });
                        serverIndex++;
                    }
                });
            }
        } catch(e) {}

        // Site-Specific DOM Fallback for Footybite
        if (links.length === 0) {
            var fbBtns = doc.querySelectorAll('a');
            [].forEach.call(fbBtns, function(btn) {
                var url = btn.getAttribute('href');
                if (url && url.indexOf('http') === 0 && (btn.textContent.trim().toLowerCase() === 'watch' || url.toLowerCase().includes('stream'))) {
                    var wrapper = btn.closest('div');
                    var name = wrapper ? wrapper.textContent.replace(btn.textContent, '').trim() : 'Serveur';
                    if (!name) name = 'Serveur';

                    var quality = extractQuality(name);
                    var lang = 'MULTI';
                    if (name.toLowerCase().includes('english')) lang = 'EN';
                    if (name.toLowerCase().includes('spanish')) lang = 'ES';

                    // Cleanup name for UI display
                    var cleanName = name.replace(/\s*-\s*english.*/i, '')
                                        .replace(/\s*·\s*english.*/i, '')
                                        .replace(/\s*-\s*spanish.*/i, '')
                                        .replace(/\s*·\s*spanish.*/i, '')
                                        .replace(/\s*-\s*HD/i, '')
                                        .replace(/\s*·\s*HD/i, '')
                                        .trim();
                    if (!cleanName) cleanName = 'Serveur';

                    if (!links.find(l => l.url === url)) {
                        if (isMatchOrLeaguePage(url, m)) return;
                        links.push({
                            name: cleanName,
                            quality: quality,
                            lang: lang,
                            url: url,
                            icon: '📺',
                            scrapeContext: { blockText: name + ' ' + url, pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                        });
                    }
                }
            });
        }
    }

    if (pageHost.indexOf('streameast') >= 0) {
        var scriptRegex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g;
        var match;
        var concatenatedData = "";

        while ((match = scriptRegex.exec(html)) !== null) {
            var chunk = match[1];
            chunk = chunk.replace(/\\"/g, '"')
                         .replace(/\\\\/g, '\\')
                         .replace(/\\n/g, '\n');
            concatenatedData += chunk;
        }

        try {
            var directMatch = /"directStreams":(\[.*?\])/.exec(concatenatedData);
            var iframeMatch = /"iframeStreams":(\[.*?\])/.exec(concatenatedData);

            var directStreams = directMatch ? JSON.parse(directMatch[1]) : [];
            var iframeStreams = iframeMatch ? JSON.parse(iframeMatch[1]) : [];

            var serverIndex = 1;

                if (Array.isArray(directStreams)) {
                    directStreams.forEach(function(s) {
                        if (s.link) {
                            if (isMatchOrLeaguePage(s.link, m)) return;
                            var langStr = (s.language || '').toLowerCase();
                            links.push({
                                name: 'Server ' + serverIndex + ' - ' + (s.name || 'Flux'),
                                quality: extractQuality((s.name || '') + ' ' + (s.quality || '')),
                                lang: langStr.includes('english') ? 'EN' : (langStr || 'MULTI').toUpperCase(),
                                url: s.link,
                                icon: '📺',
                                scrapeContext: { blockText: JSON.stringify(s), pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                            });
                            serverIndex++;
                        }
                    });
                }

                if (Array.isArray(iframeStreams)) {
                    iframeStreams.forEach(function(s) {
                        if (s.src) {
                            if (isMatchOrLeaguePage(s.src, m)) return;
                            links.push({
                                name: 'Server ' + serverIndex + ' - ' + (s.name || 'Flux'),
                                quality: 'HD',
                                lang: 'MULTI',
                                url: s.src,
                                icon: '📺',
                                scrapeContext: { blockText: JSON.stringify(s), pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                            });
                            serverIndex++;
                        }
                    });
                }
        } catch(e) {
            console.error("Error parsing Streameast streams:", e);
        }
    }

    // Sportsurge v2 (2026) : <div class="stream-item" data-href="https://..."> avec .stream-row-site-name et .stream-row-spec (1080p, fps, bitrate, langue...)
    var ssItems = doc.querySelectorAll('.stream-item[data-href]');
    [].forEach.call(ssItems, function(item) {
        var u = item.getAttribute('data-href') || '';
        if (u.indexOf('http') !== 0 || links.find(function(l) { return l.url === u; })) return;
        var siteEl = item.querySelector('.stream-row-site-name');
        var specs = [].map.call(item.querySelectorAll('.stream-row-spec'), function(sp) { return sp.textContent.trim(); });
        var langSpec = specs.find(function(sp) { return /^[a-z]{3,}$/i.test(sp) && !/^\d/.test(sp); }) || '';
        var lang = /english/i.test(langSpec) ? 'EN' : (/spanish|español/i.test(langSpec) ? 'ES' : (/french|français/i.test(langSpec) ? 'FR' : (langSpec ? langSpec.slice(0, 5).toUpperCase() : 'MULTI')));
        var tier = item.querySelector('.stream-tier-badge');
        links.push({
            name: 'Sportsurge · ' + (siteEl ? siteEl.textContent.trim() : 'Flux') + (tier ? ' (' + tier.textContent.trim() + ')' : ''),
            quality: extractQuality(specs.join(' ')),
            lang: lang,
            url: u,
            icon: '📺',
            scrapeContext: { blockText: item.textContent.replace(/\s+/g, ' ').trim().slice(0, 300), pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
        });
    });

    // Methstreams (2026) : liste JS  const allStreams = [{"label":"Link-1 HD","type":"external","value":"https://.../embed/..."}]
    var allStreamsMatch = /allStreams\s*=\s*(\[[\s\S]*?\])\s*;/.exec(html);
    if (allStreamsMatch) {
        try {
            var arr = JSON.parse(allStreamsMatch[1]);
            if (Array.isArray(arr)) {
                arr.forEach(function(st, idx) {
                    var u = st && (st.value || st.url || st.src);
                    if (!u || typeof u !== 'string' || u.indexOf('http') !== 0) return;
                    if (links.find(function(l) { return l.url === u; })) return;
                    links.push({
                        name: 'Methstreams ' + (st.label || ('Link ' + (idx + 1))),
                        quality: extractQuality(st.label || ''),
                        lang: 'MULTI',
                        url: u,
                        icon: '📺',
                        scrapeContext: { blockText: JSON.stringify(st), pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                    });
                });
            }
        } catch(e) {}
    }

    // Buffstreams and MLBite/Methstreams and VIPLeague fallback handling
    // Try to find generic data URLs inside any script tag if iframe searching fails
    var scriptElements = doc.querySelectorAll('script');
    scriptElements.forEach(function(script) {
        var text = script.textContent || '';
        if (text.includes('iframeStreams') || text.includes('directStreams') || text.includes('url":"http')) {
             var streamRegex = /"url":"(https?:\/\/[^"]+)"/g;
             var sMatch;
             var serverIndex = 1;
             while ((sMatch = streamRegex.exec(text)) !== null) {
                 var streamUrl = sMatch[1];
                 if (!streamUrl.includes('w3.org') && !streamUrl.includes('cloudflare')) {
                     if (isMatchOrLeaguePage(streamUrl, m)) continue;
                     links.push({
                         name: 'Source ' + serverIndex,
                         quality: 'HD',
                         lang: 'MULTI',
                         url: streamUrl,
                         icon: '📺',
                         scrapeContext: { blockText: 'Script JSON Extraction', pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                     });
                     serverIndex++;
                 }
             }
        }
    });

    // 1. Chercher des iframes directs
    var iframes = doc.querySelectorAll('iframe');
    [].forEach.call(iframes, function(ifr) {
        var src = ifr.getAttribute('src');
        if(src && src.indexOf('http') === 0 && src.indexOf('ads') < 0) {
            if (isMatchOrLeaguePage(src, m)) return;
            var ifrHost = ''; try { ifrHost = new URL(src).hostname.replace(/^www\./, ''); } catch(e) {}
            links.push({
                name: 'Lecteur direct' + (ifrHost ? ' · ' + ifrHost : ''),
                quality: 'HD',
                lang: 'MULTI',
                url: src,
                icon: '▶️',
                scrapeContext: { blockText: ifr.parentElement ? ifr.parentElement.textContent || '' : '', pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
            });
        }
    });

    // 2. Chercher dans les tables (Footybite, etc.)
    var rows = doc.querySelectorAll('tr');
    [].forEach.call(rows, function(row){
        var tds = row.querySelectorAll('td');
        if(tds.length < 2) return;

        var url = '';
        var input = row.querySelector('input');
        if(input && input.value && input.value.indexOf('http') === 0) {
            url = input.value;
        } else {
            var as = row.querySelectorAll('a[href]');
            for(var i=0; i<as.length; i++) {
                 var href = as[i].getAttribute('href');
                 if(href && !href.startsWith('http') && !href.startsWith('javascript')) { href = resolveUrl(href, m.matchUrl); }
                 if(href && href.indexOf('http')===0) {
                     url = href;
                     break;
                 }
            }
        }

        if(url && typeof url === 'string') {
            var lowerUrl = url.toLowerCase();
            if (lowerUrl.includes('1xbet') || lowerUrl.includes('bet365') || lowerUrl.includes('ads') || lowerUrl.length < 5) return;

            var name = tds[1] ? tds[1].textContent.replace(/\s+/g, ' ').trim() : 'Flux externe';
            if(!name && tds[2]) name = tds[2].textContent.replace(/\s+/g, ' ').trim();
            if(!name) name = 'Flux';
            if(name.length > 50) name = name.substring(0, 47) + '...';

            var upperName = name.toUpperCase();
            var isPartnerSite = ['FOOTYBITE', 'NFLBITE', 'NBABITE', 'SPORTSURGE', 'HESGOAL', 'SOCCER STREAMS', 'DISCORD', 'TWITTER', 'TELEGRAM', 'REDDIT'].some(function(partner) {
                return upperName.includes(partner);
            });
            if (isPartnerSite) return;

            var rowText = row.textContent.toLowerCase();
            var qual = extractQuality(rowText);

            if (isMatchOrLeaguePage(url, m)) return;
            links.push({
                name: name,
                quality: qual,
                url: url,
                scrapeContext: { blockText: rowText, pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
            });
        }
    });

    // 3. Fallback: boutons ou liens génériques
    var btns = doc.querySelectorAll('.btn-danger, a.nav-link2, a.btn-3d, a.stream-button, a[href*="/watch/"], a[href*="/live/"], a[href*="stream"], a[target="_blank"]');
    [].forEach.call(btns,function(btn){
       if(btn.tagName==='A' && btn.getAttribute('href')){
          var url=btn.getAttribute('href');
          if(url && !url.startsWith('http') && !url.startsWith('javascript')) { url = resolveUrl(url, m.matchUrl); }
          if(url && url.indexOf('http')===0) {
              var lowerUrl = url.toLowerCase();
              if (lowerUrl.includes('1xbet') || lowerUrl.includes('bet365') || lowerUrl.includes('ads') || lowerUrl.includes('f1streamsi') || lowerUrl.length < 5) return;
              var name = btn.textContent.replace(/\s+/g, ' ').trim() || 'Flux externe';
              if(name.length > 50) name = name.substring(0, 47) + '...';

              var upperName = name.toUpperCase();
              var isPartnerSite = ['FOOTYBITE', 'NFLBITE', 'NBABITE', 'SPORTSURGE', 'HESGOAL', 'SOCCER STREAMS', 'DISCORD', 'TWITTER', 'TELEGRAM', 'REDDIT'].some(function(partner) {
                  return upperName.includes(partner);
              });
              if (isPartnerSite) return;

              var isOtherMatch = false;
              if (lowerUrl.indexOf('match') >= 0 || name.toLowerCase().indexOf('match') >= 0 || name.toLowerCase().indexOf('started') >= 0 || name.toLowerCase().indexOf(' vs ') >= 0) {
                  // Use the context to see if it matches our team
                  var hName = (m.homeTeam || '').toLowerCase();
                  var aName = (m.awayTeam || '').toLowerCase();

                  // Get team info if available
                  var hInfo = { city: hName, teamName: hName };
                  var aInfo = { city: aName, teamName: aName };
                  if (typeof getTeamInfo !== 'undefined') {
                      hInfo = getTeamInfo(hName);
                      aInfo = getTeamInfo(aName);
                  }

                  var checkWords = function(normStr, normWords) {
                      return normWords.split(' ').some(function(w) { return w.length >= 3 && normStr.indexOf(w) >= 0; });
                  };

                  var searchStr = (name + " " + lowerUrl).toLowerCase();
                  var normSearchStr = searchStr.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                  var normHName = hName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  var normHCity = hInfo.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  var normHTeamName = hInfo.teamName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                  var normAName = aName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  var normACity = aInfo.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  var normATeamName = aInfo.teamName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                  var hasHome = checkWords(normSearchStr, normHName) || checkWords(normSearchStr, normHCity) || checkWords(normSearchStr, normHTeamName);
                  var hasAway = checkWords(normSearchStr, normAName) || checkWords(normSearchStr, normACity) || checkWords(normSearchStr, normATeamName);

                  if (!hasHome && !hasAway && (name.toLowerCase().length > 10 || lowerUrl.indexOf('match') >= 0)) {
                      // Si on est déjà sur la page spécifique du match, on ne rejette pas ces liens !
                      if (m.matchUrl && m.matchUrl !== SITE && m.matchUrl !== SPORTSURGE_URL && m.matchUrl !== VIPLEAGUE_URL && m.matchUrl !== ONHOCKEY_URL) {
                          isOtherMatch = false; // Ne pas rejeter, on est sur la page du match
                      } else {
                          isOtherMatch = true;
                      }
                  }
              }
              if (isOtherMatch) return;

              if (isMatchOrLeaguePage(url, m)) return;
              links.push({
                 name:name,
                 quality: extractQuality((btn.parentElement ? btn.parentElement.textContent : btn.textContent) + ' ' + url),
                 lang:'MULTI',
                 url:url,
                 scrapeContext: { blockText: btn.parentElement ? btn.parentElement.textContent || '' : btn.textContent || '', pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
              });
          }
       }
    });

    // 4. Fallback: attributs de données cachées (data-stream, etc)
    var elementsWithData = doc.querySelectorAll('[data-stream], [data-url], [data-src], [data-link]');
    [].forEach.call(elementsWithData, function(el) {
        var url = el.getAttribute('data-stream') || el.getAttribute('data-url') || el.getAttribute('data-src') || el.getAttribute('data-link');
        if(url) {
            if (url.startsWith('aHR0c')) {
                try { url = atob(url); } catch(e) {}
            }
            if(!url.startsWith('http') && !url.startsWith('javascript')) { url = resolveUrl(url, m.matchUrl); }
            if(url.indexOf('http') === 0) {
                var lowerUrl = url.toLowerCase();
                if (!lowerUrl.includes('1xbet') && !lowerUrl.includes('bet365') && !lowerUrl.includes('ads') && lowerUrl.length >= 5) {
                    if (isMatchOrLeaguePage(url, m)) return;
                    links.push({
                        name: 'Lecteur caché',
                        quality: 'HD',
                        lang: 'MULTI',
                        url: url,
                        icon: '▶️',
                        scrapeContext: { blockText: el.parentElement ? el.parentElement.textContent || '' : el.textContent || '', pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
                    });
                }
            }
        }
    });

    // VIPLeague charge ses lecteurs en JS (jeton CSRF) : le HTML ne contient que des pubs et des liens partenaires.
    if (pageHost.indexOf('vipleague') >= 0) {
        links = links.filter(function(l) { return l && l.url && /vipleague/i.test(l.url) && !/\/vl$/.test(l.url); });
    }

    // 5. Nettoyage générique : on écarte ce qui n'est manifestement pas un lecteur
    // (images, feuilles de style, racine du site, pages d'accueil des agrégateurs partenaires).
    var selfOrigin = '';
    try { selfOrigin = new URL(m.matchUrl).origin; } catch(e) {}
    var seenNormalized = {};
    var partnerHosts = ['footybite', 'nbabite', 'nflbite', 'mlbbite', 'totalsportek', 'sportsurge', 'buffstreams', 'streameast', 'methstreams', 'vipleague', 'hesgoal'];
    links = links.filter(function(l) {
        if (!l || !l.url || typeof l.url !== 'string') return false;
        var u = l.url.trim();
        var low = u.toLowerCase().split('?')[0];
        if (/\.(png|jpe?g|gif|svg|webp|ico|css|js|json|xml|txt|woff2?)$/.test(low)) return false;
        if (selfOrigin && (u === selfOrigin || u === selfOrigin + '/')) return false;
        if (isJunkStreamLabel(l.name)) return false; // « Click if you want… », « (opens in a new tab) »
        if (isIndexPageUrl(u)) return false;                              // accueil / index d'un site de lecteurs
        // Dédoublonnage réel : deux adresses ne différant que par le protocole, « www. »
        // ou une barre finale étaient conservées toutes les deux.
        var key = normalizeStreamUrl(u);
        if (seenNormalized[key]) return false;
        seenNormalized[key] = true;
        try {
            var pu = new URL(u);
            var path = pu.pathname || '/';
            if (isJunkStreamHost(pu.hostname, path)) return false; // réseaux sociaux, clones partenaires
            if ((path === '/' || path === '') && !pu.search) return false; // page d'accueil d'un site : jamais un lecteur (mais "/?stream_id=…" est un lecteur)
            var isPartner = partnerHosts.some(function(ph) { return pu.hostname.indexOf(ph) >= 0; });
            // Pages de navigation (catégories / ligues) : "…streams", "…streams15", "indexcracked29", "…cracked15"
            if (/\/[a-z-]*(streams?|cracked)\d*\/?$/i.test(path) && !/-vs-|\/game\/|\/watch|\/stream\//i.test(path)) return false;
            if (isPartner && u !== m.matchUrl && !/-vs-|\/game\/|\/watch|\/stream\/|\/embed|\/(mlb|nba|nfl|nhl|soccer|ufc|mma|boxing|f1)\/[a-z0-9-]+/i.test(path)) return false; // lien interne d'un agrégateur
        } catch(e) { return false; }
        return true;
    });

    /* 5 bis. Moteur générique (js/extractors.js).
       Les branches ci-dessus connaissent chacune un site et lui donnent de bons
       libellés ; elles restent donc en place. Mais elles ne voient rien d'un site
       qu'elles ne connaissent pas, et rien d'un site connu qui a changé de DOM —
       c'est ce qui laissait des sources entières à zéro lien. Le moteur repasse
       donc sur la même page sans rien savoir d'elle : iframes, boutons qui
       remplacent l'iframe (data-* ou onclick), blobs JSON, adresses encodées,
       liens vers un autre domaine. Ce qu'il trouve en plus est ajouté ; ce que
       les branches avaient déjà trouvé garde son libellé et reçoit le classement
       du moteur. */
    var engineLinks = [];
    try {
        engineLinks = extractPlayers(html, m.matchUrl, { doc: doc, matchUrl: m.matchUrl, registry: getEmbedRegistry() });
    } catch (e) { lg('Moteur d\'extraction en échec', e && e.message ? e.message : e); }

    var byCanon = {};
    links.forEach(function(l) { if (l && l.url) byCanon[canonical(l.url)] = l; });

    engineLinks.forEach(function(p) {
        var existing = byCanon[canonical(p.url)];
        if (existing) {
            /* Déjà trouvé par une branche : on ne touche pas au libellé, mais le
               classement du moteur fait autorité — c'est lui qui décide si le lien
               peut vivre dans une iframe ou doit s'ouvrir dans un onglet. */
            existing.topLevel = p.kind === 'page';
            existing.via = p.via;
            existing.score = p.score;
            return;
        }
        var host = ''; try { host = new URL(p.url).hostname.replace(/^www\./, ''); } catch (e) {}
        links.push({
            name: p.label || ('Lecteur' + (host ? ' · ' + host : '')),
            quality: extractQuality(p.label || ''),
            lang: 'MULTI',
            url: p.url,
            icon: p.kind === 'embed' ? '▶️' : '🔗',
            topLevel: p.kind === 'page',
            via: p.via,
            score: p.score,
            scrapeContext: { blockText: (p.reasons || []).join(' · '), pageText: pageTextContext, pageLink: m.matchUrl, allLinks: pageLinksContext }
        });
        byCanon[canonical(p.url)] = links[links.length - 1];
    });

    links = finalizeStreamLinks(links); // dédoublonnage, faux liens, provenance

    /* Les lecteurs intégrables d'abord : c'est ce que l'utilisateur peut réellement
       regarder sans quitter l'application. Les pages à ouvrir en onglet ensuite. */
    links.sort(function(a, b) {
        var ta = a.topLevel ? 1 : 0, tb = b.topLevel ? 1 : 0;
        if (ta !== tb) return ta - tb;
        return (b.score || 0) - (a.score || 0);
    });

    // 6. Ultime fallback : Si la source ne donne vraiment aucun autre flux et qu'on a le matchUrl.
    if(links.length===0 && m.matchUrl){
        var siteName = m.matchUrl;
        try { siteName = new URL(m.matchUrl).hostname.replace(/^(www|v2)\./, ''); } catch(e) {}
        links.push({name:'Page du match sur ' + siteName, quality:'', lang:'', url:m.matchUrl, icon:'🔗', topLevel: true});
    }

    // Populate pageLinksContext for all contexts
    links.forEach(function(l) {
        if (l.url) pageLinksContext.push(l.url);
    });

    return links;
}

export function scrapeMatchFlux(m, forceRefresh, deep){
  // deep=true (fiche de match ouverte) : on lit aussi les pages du même match sur les autres sources (altUrls)
  if (deep && Array.isArray(m.altUrls) && m.altUrls.length) {
      // On n'interroge pas les hôtes qui refusent systématiquement (voir js/config.js) :
      // c'était jusqu'ici jusqu'à 4 attentes de proxy pour rien à l'ouverture d'une fiche.
      var extra = m.altUrls.filter(function(u) { return !isMatchPageBlocked(u); }).slice(0, 4);
      var mainP = scrapeMatchFlux(m, forceRefresh, false);
      return mainP.catch(function() {}).then(function() {
          return Promise.allSettled(extra.map(function(u) {
              return fetchPage(u, { force: !!forceRefresh }).then(function(html) {
                  var links = extractStreamLinks(html, { id: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, league: m.league, matchUrl: u, source: null, streamLinks: [] });
                  m.streamLinks = m.streamLinks || [];
                  links.forEach(function(l) { if (!m.streamLinks.some(function(e) { return e.url === l.url; })) m.streamLinks.push(l); });
              });
          })).then(function() {
              m.streamsLoaded = true;
              saveStreamCache(m.id, m.streamLinks);
              updateMatchUiAfterScrape(m);
          });
      });
  }

  // Ignore artificial limits to allow robust fetch
  // Check cache first unless explicitly forcing refresh
  if (!forceRefresh) {
      var cachedStreams = getStreamCache(m.id);
      if (cachedStreams && cachedStreams.length > 0) {
          lg('Scrape streams cached', m.homeTeam);
          m.streamLinks = cachedStreams;
          m.streamsLoaded = true;
          updateMatchUiAfterScrape(m);
          return Promise.resolve();
      }
  }

  /* Page du match elle-même : inutile de la télécharger quand son hôte refuse
     systématiquement les serveurs et les proxys (Footybite /game/ en 403, miroirs
     Streameast en 429). On garde malgré tout le lien : dans le navigateur de
     l'utilisateur, ces pages s'ouvrent normalement (bouton ↗). Les flux intégrables du
     match viennent, eux, des autres sources via altUrls. */
  if (isMatchPageBlocked(m.matchUrl)) {
      m.streamLinks = m.streamLinks || [];
      m.streamLinks = m.streamLinks.concat(matchPageFallbackLink(m.matchUrl, m.streamLinks));
      m.streamsLoaded = true;
      return Promise.resolve(m.streamLinks);
  }

  // Timeout for individual match scrape
  return Promise.race([
    fetchPage(m.matchUrl, { force: !!forceRefresh }),
    new Promise(function(_, reject) { setTimeout(function() { reject(new Error('Timeout match streams')); }, 30000); })
  ]).then(function(html){
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        try {
    var links = extractStreamLinks(html, m);

    // Preserve existing streams and avoid duplicates
    var existingLinks = m.streamLinks || [];
    var combinedLinks = existingLinks.slice();

    var targetSource = m.source;
    if (!targetSource && m.matchUrl) {
        if (m.matchUrl.indexOf('footybite') > -1) targetSource = 'footybite';
        else if (m.matchUrl.indexOf('mlbbite') > -1) targetSource = 'mlbbite';
        else if (m.matchUrl.indexOf('sportsurge') > -1) targetSource = 'sportsurge';
        else if (m.matchUrl.indexOf('buffstreams') > -1) targetSource = 'buffstreams';
        else if (m.matchUrl.indexOf('streameast') > -1) targetSource = 'streameast';
        else if (m.matchUrl.indexOf('onhockey') > -1) targetSource = 'onhockey';
        else if (m.matchUrl.indexOf('vipleague') > -1) targetSource = 'vipleague';
        else if (m.matchUrl.indexOf('methstreams') > -1) targetSource = 'methstreams';
    }

    links.forEach(function(newLink) {
        if (!newLink.source && targetSource) newLink.source = targetSource;
        var isDuplicate = combinedLinks.some(function(existingLink) {
            return existingLink.url === newLink.url;
        });
        if (!isDuplicate) {
            combinedLinks.push(newLink);
        }
    });

    // S'assurer qu'on affiche un maximum de streams
    m.streamLinks = combinedLinks;
    m.streamsLoaded=true;
    saveStreamCache(m.id, m.streamLinks);
    updateMatchUiAfterScrape(m);

    // Add success log with number of streams found
    addScrapeLog(m.matchUrl, 'success', 'Scraping terminé: ' + combinedLinks.length + ' streams trouvés.');

        resolve();
        } catch(e) {
            addScrapeLog(m.matchUrl, 'error', 'Match scrape flux failed: ' + e.message);
            reject(e);
        }
      }, 0);
    });
  });
}

export function isMatchOrLeaguePage(urlStr, m) {
    if (!urlStr || typeof urlStr !== 'string') return false;
    var u = urlStr.toLowerCase();

    // Si l'url est exactement celle du match, c'est la page du match, pas un flux
    if (m && m.matchUrl && u === m.matchUrl.toLowerCase()) return true;

    // Autoriser explicitement les pages embed / player / direct streams
    if (u.includes('/embed') || u.includes('/player') || u.includes('player.php') || u.includes('embed.php') || u.includes('stream.php') || u.includes('play.php') || u.includes('.m3u8') || u.includes('.mpd') || u.includes('youtube.com/embed') || u.includes('player.twitch.tv')) return false;

    // Si ça pointe vers une page de base du domaine connu
    var isSelfDomain = false;
    if (m && m.matchUrl) {
        try {
            var domainMatchUrl = new URL(m.matchUrl).hostname.replace('www.', '');
            var domainUrlStr = new URL(urlStr).hostname.replace('www.', '');
            if (domainMatchUrl === domainUrlStr) isSelfDomain = true;
        } catch(e) {}
    }

    // Détection de motifs d'URL de pages de match ou de ligue
    if (u.includes('-vs-') ||
        u.includes('-v-') ||
        u.includes('/game/') ||
        u.includes('/match/') ||
        u.includes('/matches/') ||
        u.includes('/tag-') ||
        u.includes('/schedule/') ||
        u.includes('/category/') ||
        u.includes('/sports/') ||
        u.includes('/sport/') ||
        u.includes('/league/') ||
        (u.includes('-stream') && !u.includes('iframe') && !u.includes('/embed') && !u.includes('.php')) ||
        (u.includes('-live') && !u.includes('iframe') && !u.includes('/embed') && !u.includes('.php'))) {
        return true;
    }

    // Si c'est sur le même domaine, et que ça ressemble à une page de match
    if (isSelfDomain && !u.includes('iframe') && !u.includes('embed') && !u.includes('player') && !u.includes('.php') && urlStr.length > 20) {
        if (u.endsWith('-streaming') || u.endsWith('-live') || u.includes('/match/') || u.includes('/teams/')) {
            return true;
        }
    }

    return false;
}

export function updateMatchUiAfterScrape(m) {
    // Refresh UI for this specific match if needed
    var i = 0;
    function processChunk() {
        var start = performance.now();
        // We only process one match in this function, but use RAF for async layout handling
        for (; i < 1 && performance.now() - start < 15; i++) {
            var cids = ['mb-'+m.id, 'mb-'+m.id+'_live_copy', 'mb-'+m.id+'_fav_copy'];
            cids.forEach(function(cid) {
                var cached = matchCardCache.get(cid);
                if (!cached) {
                    var card = document.getElementById(cid);
                    if (card) {
                        cached = { el: card };
                        matchCardCache.set(cid, cached);
                    }
                }

                if (cached && cached.el) {
                    var mb = cached.el;
                    var sn = m.streamLinks ? m.streamLinks.length : 0;

                    if (!cached.snEl && sn > 0) {
                        cached.snEl = mb.querySelector('.mb-sn');
                        if (!cached.snEl) {
                            var mbM = mb.querySelector('.mb-m');
                            if (mbM) {
                                cached.snEl = document.createElement('span');
                                cached.snEl.className = 'mb-sn';
                                mbM.appendChild(cached.snEl);
                            }
                        }
                    }
                    if (cached.snEl) {
                        cached.snEl.textContent = sn + ' flux' + (sn > 1 ? 's' : '');
                    }

                    if (!cached.primeSnEl && sn > 0) {
                        cached.primeSnEl = mb.querySelector('.prime-stream-count');
                        if (!cached.primeSnEl) {
                            var primeThumb = mb.querySelector('.prime-thumbnail');
                            if (primeThumb) {
                                cached.primeSnEl = document.createElement('div');
                                cached.primeSnEl.className = 'prime-stream-count';
                                primeThumb.appendChild(cached.primeSnEl);
                            }
                        }
                    }
                    if (cached.primeSnEl) {
                        cached.primeSnEl.textContent = sn + ' flux';
                    }
                }
            });
        }
        if (i < 1) {
            requestAnimationFrame(processChunk);
        } else {
            // We keep updateMatchModalAfterScrape logic here
            var mnameEl=document.getElementById('mname');
            if(document.getElementById('mbg').classList.contains('open') && mnameEl && mnameEl.textContent.indexOf(m.homeTeam) >= 0){
                var targetContainer = document.getElementById('modal-right-col') || document.getElementById('mbody');
                if(targetContainer) {
                    // Check if we already have the rightHeaderHtml structure from openMod to preserve it
                    var headerHtml = '';
                    var existingHeader = targetContainer.querySelector('div[style*="display:flex; justify-content:flex-end; align-items:center; gap:8px; margin-bottom:8px;"]');
                    if (existingHeader) {
                        headerHtml = existingHeader.outerHTML;
                    }

                    var linksHtml = '';
                    if(!m.streamLinks || m.streamLinks.length===0){
                        linksHtml='<div style="text-align:center;padding:20px;color:var(--muted2);">Aucun flux trouvé.</div>';
                    } else {
                        var sortedLinks = sortFluxLinks(m.streamLinks);
                        linksHtml=sortedLinks.map(function(s,idx){
                            return renderFluxItem(s, idx, m);
                        }).join('');
                    }

                    // Preserve the manual links fallback section at the bottom if it exists
                    var fallbackHtml = '';
                    var detailsArr = targetContainer.querySelectorAll('details');
                    for(var d=0; d<detailsArr.length; d++) {
                        var sum = detailsArr[d].querySelector('summary');
                        if(sum && sum.textContent.indexOf('Fallback') > -1) {
                            fallbackHtml = '<div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">' + detailsArr[d].outerHTML + '</div>';
                            break;
                        }
                    }

                    targetContainer.innerHTML = headerHtml + linksHtml + fallbackHtml;

                    // Re-attach events for the header buttons if they exist
                    var refreshBtn = document.getElementById('mv-refresh-btn');
                    if (refreshBtn) {
                        refreshBtn.onclick = function() {
                            this.style.opacity = '0.5';
                            this.disabled = true;
                            var rightCol = document.getElementById('modal-right-col');
                            if(rightCol) {
                                rightCol.innerHTML = headerHtml + '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; color:var(--muted2); gap: 16px;"><div class="spinner"></div><div style="font-weight: 600;">Recherche de streams...</div><div style="font-size: 12px; opacity: 0.6;">(Actualisation en cours)</div></div>';
                            }
                            m.streamLinks = [];
                            m.streamsLoaded = false;
                            scrapeMatchFlux(m, true);
                        };
                    }
                    var randomBtn = document.getElementById('mv-random-btn');
                    if (randomBtn) {
                        randomBtn.onclick = function(e) {
                            e.stopPropagation();
                            e.preventDefault();
                            if (m && m.streamLinks && m.streamLinks.length > 0) {
                                var sList = m.streamLinks;
                                var s4k = sList.filter(function(s) {
                                    return (s.quality && s.quality.toUpperCase() === '4K') || (s.name && s.name.toUpperCase().indexOf('4K') > -1);
                                });
                                var sel = s4k.length > 0 ? s4k[0] : sList[Math.floor(Math.random() * sList.length)];
                                if(typeof window.addToMultivision === 'function') {
                                    window.addToMultivision(sel.url || '#', m.homeTeam + ' vs ' + m.awayTeam, m.id);
                                }
                                if(typeof window.closeMod === 'function') {
                                    window.closeMod();
                                }
                            }
                        };
                    }
                }
            }
        }
    }
    processChunk();
}




// Global bindings for HTML compatibility
window.parseStreameast = parseStreameast;
window.parseF1Ics = parseF1Ics;
window.parseIndycarIcs = parseIndycarIcs;
window.parsePWHLSchedule = parsePWHLSchedule;
window.parseWWEIcs = parseWWEIcs;
window.parseSportsDbEvents = parseSportsDbEvents;
window.describeStreamLink = describeStreamLink;
window.isIndexPageUrl = isIndexPageUrl;
window.finalizeStreamLinks = finalizeStreamLinks;
window.matchPageFallbackLink = matchPageFallbackLink;
window.parseSportsurge = parseSportsurge;
window.parseOnHockey = parseOnHockey;
window.parseBuffstreams = parseBuffstreams;
window.extractFootybiteLogos = extractFootybiteLogos;
window.parseVipleague = parseVipleague;
window.parseMethstreams = parseMethstreams;
window.parseMlbbite = parseMlbbite;
window.parseFootybite = parseFootybite;
window.getStreamCache = getStreamCache;
window.saveStreamCache = saveStreamCache;
window.fetchSubPages = fetchSubPages;
window.scrapeMatchFlux = scrapeMatchFlux;
window.updateMatchUiAfterScrape = updateMatchUiAfterScrape;
window.recordEmbedResult = recordEmbedResult;
window.getEmbedRegistry = getEmbedRegistry;

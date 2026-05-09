import { pad, getLeagueDuration, lg, cacheLogo, fetchPage } from './utils.js';
import { STREAMEAST_URL, SPORTSURGE_URL, ONHOCKEY_URL, getEstDateStrFromDate, getEstTimeStrFromDate, BUFFSTREAMS_URL, MLBITE_URL, SITE, sortFluxLinks } from './config.js';
import { formatLeagueName, lgFlag, lgColor, getOfficialTeamName } from './db.js';
import { TARGET_DATE } from './api.js';
import { S, addScrapeLog } from './state.js';
import { renderFluxItem } from './ui.js';

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
                  startTime = pad(h) + ':' + pad(m);
              }
          }

          var streamLinks = [{
              name: 'Streameast - Flux',
              quality: 'HD',
              lang: 'MULTI',
              url: playerLink,
              icon: '📺'
          }];

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
                      streamUrl = STREAMEAST_URL.slice(0, -1) + (streamUrl.startsWith('/') ? streamUrl : '/' + streamUrl);
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
                          icon: '📺'
                      }],
                      streamsLoaded: false,
                      matchUrl: streamUrl,
                      source: 'streameast'
                  });
                  added[href] = true;
              } else if (textToParse.length > 3 && textToParse.length < 40) {
                  var streamUrl2 = href;
                  if (!streamUrl2.startsWith('http')) streamUrl2 = STREAMEAST_URL.slice(0, -1) + (streamUrl2.startsWith('/') ? streamUrl2 : '/' + streamUrl2);
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
                      streamLinks: [{ name: 'Streameast - Flux', quality: 'HD', lang: 'MULTI', url: streamUrl2, icon: '📺' }],
                      streamsLoaded: false,
                      matchUrl: streamUrl2,
                      source: 'streameast'
                  });
                  added[href] = true;
              }
          }
      });
  }

  lg('Streameast extraits', matches.length);
  return matches;
}


/* ══ PARSE ONHOCKEY ═══════════════════ */

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

                              if (homeLogo) cacheLogo(home, homeLogo);
                              if (awayLogo) cacheLogo(away, awayLogo);

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

export function parseSportsurge(html) {
  var matches = [];
  try {
      var doc = new DOMParser().parseFromString(html, 'text/html');

      // Sportsurge v2 uses .MatchListItem or similar, but often it's rendered.
      // Sometimes it has direct <a> links.
      var matchLinks = doc.querySelectorAll('a[href*="/live/"], .MatchListItem a, a.match-link');

      [].forEach.call(matchLinks, function(a) {
          var titleEl = a.querySelector('.MatchTitle') || a;
          var titleText = titleEl.textContent.trim();
          var url = a.getAttribute('href');

          if(titleText && url) {
              var home = titleText;
              var away = 'TBD';
              if(titleText.includes(' vs ')) {
                 var pts = titleText.split(' vs ');
                 home = pts[0].trim();
                 away = pts[1].trim();
              } else if (titleText.includes('-')) {
                 var pts = titleText.split('-');
                 home = pts[0].trim();
                 away = pts[1].trim();
              }

              var m = {
                  id: 'surge_' + Math.random().toString(36).substr(2, 9),
                  homeTeam: getOfficialTeamName(home),
                  awayTeam: getOfficialTeamName(away),
                  league: 'Sports',
                  flag: lgFlag('Sports'),
                  color: lgColor('Sports'),
                  startTime: '00:00',
                  status: 'upcoming',
                  matchUrl: url.indexOf('http') === 0 ? url : (SPORTSURGE_URL.slice(0, -1) + (url.startsWith('/') ? url : '/' + url)),
                  streamLinks: [],
                  streamsLoaded: false,
                  source: 'sportsurge'
              };
              if (!matches.find(ex => ex.matchUrl === m.matchUrl)) {
                  matches.push(m);
              }
          }
      });
  } catch(e) {}
  lg('Sportsurge extraits', matches.length);
  return matches;
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
                          var links = linksContainer.querySelectorAll('a');
                          for (var l = 0; l < links.length; l++) {
                              var linkEl = links[l];
                              var href = linkEl.getAttribute('href');
                              if (!href) continue;

                              var streamUrl = href;
                              if (streamUrl.indexOf('//') === 0) {
                                  streamUrl = 'https:' + streamUrl;
                              } else if (streamUrl.indexOf('http') !== 0) {
                                  streamUrl = 'https://onhockey.tv' + (streamUrl.charAt(0) === '/' ? '' : '/') + streamUrl;
                              }

                              streamLinksArr.push({
                                  name: 'OnHockey ' + (linkEl.title || linkEl.textContent || 'Flux').trim(),
                                  url: streamUrl,
                                  quality: 'HD',
                                  lang: 'MULTI',
                                  icon: '🏒'
                              });
                          }
                      }

                      // Try to extract start time if available
                      var startTimeStr = '00:00';
                      var hourEl = row.querySelector('.game_hour') || tds[0];
                      if (hourEl) {
                           var timeText = hourEl.textContent.trim();
                           var timeParts = timeText.match(/(\d+):(\d+)/);
                           if (timeParts) {
                               startTimeStr = timeParts[1].padStart(2, '0') + ':' + timeParts[2];
                           }
                      }

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
                          matchUrl: streamLinksArr.length > 0 ? streamLinksArr[0].url : ONHOCKEY_URL,
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

                  var streamUrl = href;
                  if (streamUrl.indexOf('//') === 0) {
                      streamUrl = 'https:' + streamUrl;
                  } else if (streamUrl.indexOf('http') !== 0) {
                      streamUrl = 'https://onhockey.tv' + (streamUrl.charAt(0) === '/' ? '' : '/') + streamUrl;
                  }

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
                  matchUrl: streamLinksArr.length > 0 ? streamLinksArr[0].url : ONHOCKEY_URL,
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
export function parseBuffstreams(html){
  var matches=[];
  var index = 0;
  var doc = new DOMParser().parseFromString(html, 'text/html');

  // New Buffstreams doesn't load all data in home page JSON always, but it often does list categories
  // Let's try to extract what we can from React chunks
  var scriptRegex = /self\.__next_f\.push\(\[1,"(.*)"\]\)/g;
  var match;
  var concatenatedData = "";

  while ((match = scriptRegex.exec(html)) !== null) {
      var chunk = match[1];
      chunk = chunk.replace(/\\"/g, '"')
                   .replace(/\\\\/g, '\\')
                   .replace(/\\n/g, '\n');
      concatenatedData += chunk;
  }

  // 1. First attempt: Full event objects
  var eventRegex = /"event":({(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*})/g;
  var evMatch;

  while ((evMatch = eventRegex.exec(concatenatedData)) !== null) {
      try {
          var evObj = JSON.parse(evMatch[1]);
          var home = evObj.details ? evObj.details.text2 : '';
          var away = evObj.details ? evObj.details.text3 : '';
          var category = evObj.category || 'Sports';

          if(!home || !away) continue;
          if(home === 'null' || away === 'null') continue;

          var status = 'upcoming';
          if (evObj.status === 'live' || evObj.status === 'Live') status = 'live';

          var startTime = '00:00';
          if (evObj.matchStartTime) {
              var d = new Date(evObj.matchStartTime);
              startTime = getEstTimeStrFromDate(d);
          }

          var streamLinks = [];
          if (evObj.iframeStreams) {
              evObj.iframeStreams.forEach(function(s) {
                  streamLinks.push({
                      name: 'Buffstreams - ' + (s.name || 'Flux'),
                      quality: 'HD',
                      lang: 'MULTI',
                      url: s.src,
                      icon: '📺'
                  });
              });
          }

          // Generate a unique ID using the event ID if available
          var mId = evObj._id ? 'buff_' + evObj._id : 'buff_' + index;

          var l = category.toLowerCase().replace(/-/g, ' ');
          matches.push({
              id: mId,
              league: formatLeagueName(l),
              flag: lgFlag(l),
              color: lgColor(l),
              homeTeam: getOfficialTeamName(home),
              awayTeam: getOfficialTeamName(away),
              homeLogo: evObj.teamA_logo ? (evObj.teamA_logo.indexOf('http') === 0 ? evObj.teamA_logo : 'https://buffstreams.com.co' + evObj.teamA_logo) : null,
              awayLogo: evObj.teamB_logo ? (evObj.teamB_logo.indexOf('http') === 0 ? evObj.teamB_logo : 'https://buffstreams.com.co' + evObj.teamB_logo) : null,
              startTime: startTime,
              durationMinutes: getLeagueDuration(l),
              status: status,
              score: null,
              streamLinks: streamLinks,
              streamsLoaded: false,
              matchUrl: (evObj.link ? (evObj.link.indexOf('http')===0 ? evObj.link : 'https://buffstreams.com.co' + evObj.link) : (streamLinks.length > 0 ? streamLinks[0].url : BUFFSTREAMS_URL)),
              source: 'buffstreams'
          });
          index++;
      } catch(e) {}
  }

  lg('Buffstreams extraits', matches.length);
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
            cacheLogo(teamName, img.getAttribute('src'));
        }
    });
}



/* ══ PARSE TOTALSPORTEK ════════════════ */
export function parseTotalsportek(html) {
    var matches = [];
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var links = doc.querySelectorAll('a[href]');
    [].forEach.call(links, function(a) {
        var href = a.getAttribute('href');
        if(href && href.includes('/game/') && href.includes('-vs-')) {
            var urlParts = href.split('/game/')[1].split('/')[0].split('-vs-');
            if(urlParts.length === 2) {
                var home = urlParts[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                var away = urlParts[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                if(home && away) {
                    var matchUrl = href;
                    if(!matchUrl.startsWith('http') && !matchUrl.startsWith('javascript')) {
                        matchUrl = 'https://www.totalsportek-real.com' + (matchUrl.startsWith('/') ? matchUrl : '/' + matchUrl);
                    }
                    if(matchUrl && !matchUrl.startsWith('javascript') && !matches.find(m => m.matchUrl === matchUrl)) {
                        matches.push({
                            id: 'ts_' + matches.length,
                            league: 'Sports',
                            flag: lgFlag('Sports'),
                            color: lgColor('Sports'),
                            homeTeam: getOfficialTeamName(home),
                            awayTeam: getOfficialTeamName(away),
                            matchUrl: matchUrl,
                            startTime: '00:00',
                            status: 'upcoming',
                            streamLinks: [],
                            streamsLoaded: false,
                            source: 'totalsportek'
                        });
                    }
                }
            }
        }
    });
    return matches;
}

/* ══ PARSE VIPLEAGUE ════════════════ */
export function parseVipleague(html) {
    var matches = [];
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var links = doc.querySelectorAll('a[href]');
    [].forEach.call(links, function(a) {
        var href = a.getAttribute('href');
        if(href && href.includes('-streaming') && !href.includes('-links')) {
            var urlParts = href.split('/').pop().split('-streaming')[0].split('-vs-');
            if(urlParts.length >= 2) {
                var home = urlParts[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                var away = urlParts.slice(1).join(' ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                if(home && away) {
                    var matchUrl = href;
                    if(!matchUrl.startsWith('http') && !matchUrl.startsWith('javascript')) {
                        matchUrl = 'https://vipleague.io' + (matchUrl.startsWith('/') ? matchUrl : '/' + matchUrl);
                    }
                    if(matchUrl.startsWith('http') && !matches.find(m => m.matchUrl === matchUrl)) {
                        matches.push({
                            id: 'vip_' + matches.length,
                            league: 'Sports',
                            flag: lgFlag('Sports'),
                            color: lgColor('Sports'),
                            homeTeam: getOfficialTeamName(home),
                            awayTeam: getOfficialTeamName(away),
                            matchUrl: matchUrl,
                            startTime: '00:00',
                            status: 'upcoming',
                            streamLinks: [],
                            streamsLoaded: false,
                            source: 'vipleague'
                        });
                    }
                }
            }
        }
    });
    return matches;
}

/* ══ PARSE METHSTREAMS ════════════════ */
export function parseMethstreams(html) {
    var matches = [];
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var links = doc.querySelectorAll('a[href]');
    [].forEach.call(links, function(a) {
        if(a.href && a.href.includes('stream')) {
            var text = a.textContent.replace(/\s+/g, ' ').trim();
            var teams = text.split(/ vs | v | - /i);
            if(teams.length >= 2 && text.length < 100) {
                var home = teams[0].trim();
                var away = teams.slice(1).join(' - ').trim();
                if(home && away) {
                    var matchUrl = a.getAttribute('href');
                    if(!matchUrl.startsWith('http') && !matchUrl.startsWith('javascript')) {
                        try { matchUrl = new URL(matchUrl, 'https://methstreams.com/').href; } catch(e) {}
                    }
                    if(matchUrl.startsWith('http')) {
                        matches.push({
                            id: 'meth_' + matches.length,
                            homeTeam: home,
                            awayTeam: away,
                            matchUrl: matchUrl,
                            source: 'methstreams'
                        });
                    }
                }
            }
        }
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
export function parseNflbite(html) {
    var matches = [];
    var regex = /<a class="teams-logo" href="([^"]*\/teams\/([^"]*)-live-stream\/)">[\s\S]*?<img class="team-logo-img" src="([^"]*)"/g;
    var match;
    var i = 0;
    while ((match = regex.exec(html)) !== null) {
        var url = match[1];
        var teamName = match[2].replace(/-/g, " ").trim();
        var logo = match[3];

        var streamLinks = [];

        matches.push({
            id: "nflbite_" + i,
            homeTeam: getOfficialTeamName(teamName),
            awayTeam: 'TBD',
            homeLogo: logo,
            status: "upcoming",
            score: null,
            startTime: "00:00",
            matchUrl: url.indexOf("http") === 0 ? url : "https://nflbite.is" + url,
            streamLinks: streamLinks,
            streamsLoaded: false,
            league: "NFL",
            source: "nflbite"
        });
        i++;
    }

    // Fallback: Just parse any team-like link
    if (matches.length === 0) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var links = doc.querySelectorAll('a[href*="/teams/"]');
        [].forEach.call(links, function(a) {
             var href = a.getAttribute('href');
             if(href.includes('-live-stream')) {
                 var teamPart = href.split('/teams/')[1].split('-live-stream')[0];
                 var teamN = teamPart.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                 if (teamN && !matches.find(m => m.homeTeam === teamN)) {
                     var matchUrl = href.startsWith('http') ? href : MLBITE_URL.replace(/\/$/, '') + (href.startsWith('/') ? href : '/' + href);
                     matches.push({
                        id: "nflbite_fb_" + i++,
                        homeTeam: getOfficialTeamName(teamN),
                        awayTeam: 'TBD',
                        status: "upcoming",
                        startTime: "00:00",
                        matchUrl: matchUrl,
                        streamLinks: [],
                        streamsLoaded: false,
                        league: "NFL",
                        source: "nflbite"
                     });
                 }
             }
        });
    }
    lg("NFLBite extraits", matches.length);
    return matches;
}

export function parseMlbbite(html) {
    var matches = [];
    try {
        var doc = new DOMParser().parseFromString(html, "text/html");

        // MLBBite new format: <a href="/watch/..." class="inline-match-item"> or similar
        // Just find any link that looks like a match link if .inline-match-item is missing
        var items = doc.querySelectorAll(".inline-match-item, a[href*='/watch/live/']");

        // Remove duplicates based on href
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

            var matchUrl = href.indexOf("http") === 0 ? href : "https://mlbbite.plus" + href;

            var home = "TBD";
            var away = "TBD";
            var score = null;
            var status = "upcoming";
            var startTime = "00:00";

            // Try different team selectors depending on mlbbite layout
            var teams = el.querySelectorAll(".team---item b, .team-name, .name");
            if (teams.length >= 2) {
                home = teams[0].textContent.trim();
                away = teams[1].textContent.trim();
            } else {
                // Try parsing from the URL: /watch/live/san-francisco-giants-at-tampa-bay-rays-5-free-live-stream
                var urlMatch = href.match(/live\/([a-z0-9-]+)-(?:at|vs)-([a-z0-9-]+?)(?:-\d*-?free-live-stream(?:s)?|-live-stream)?(?:\.html|\/)?$/);
                if (urlMatch) {
                    away = urlMatch[1].replace(/-/g, ' ');
                    home = urlMatch[2].replace(/-/g, ' ');
                }
            }

            if (home === "TBA" && away === "TBA") return;

            // Find logos
            var imgs = el.querySelectorAll(".img img, img.logo");
            var homeLogo = imgs.length > 0 ? imgs[0].getAttribute("src") : null;
            var awayLogo = imgs.length > 1 ? imgs[1].getAttribute("src") : null;

            var scoreEl = el.querySelector(".first-team-result, .score");
            if (scoreEl) {
                var s = scoreEl.textContent.trim().split("-");
                if (s.length === 2) {
                    score = [parseInt(s[0]), parseInt(s[1])];
                }
            }

            var statusEl = el.querySelector(".result-status-text, .status");
            if (statusEl) {
                var sTxt = statusEl.textContent.toLowerCase();
                if (sTxt.indexOf("live") !== -1 || sTxt.indexOf("in progress") !== -1 || sTxt.indexOf("top") !== -1 || sTxt.indexOf("bot") !== -1) {
                    status = "live";
                } else if (sTxt.indexOf("finished") !== -1 || sTxt.indexOf("ft") !== -1 || sTxt.indexOf("final") !== -1) {
                    status = "finished";
                }
            }

            var dateEl = el.querySelector(".match-date, .time");
            if (dateEl && !scoreEl) {
                var rawTime = dateEl.textContent.trim();
                var timeM = rawTime.match(/(\d{1,2}):(\d{2})/);
                if (timeM) {
                    startTime = timeM[1].padStart(2, "0") + ":" + timeM[2];
                }
            } else if (dateEl && dateEl.hasAttribute("title") && status === "upcoming") {
                var rawTime = dateEl.getAttribute("title").trim() || dateEl.textContent.trim();
                var timeM = rawTime.match(/(\d{1,2}):(\d{2})/);
                if (timeM) {
                    startTime = timeM[1].padStart(2, "0") + ":" + timeM[2];
                }
            }

            var streamLinks = [];

            matches.push({
                id: "mlbbite_" + i,
                homeTeam: getOfficialTeamName(home),
                awayTeam: getOfficialTeamName(away),
                homeLogo: homeLogo,
                awayLogo: awayLogo,
                status: status,
                score: score,
                startTime: startTime,
                matchUrl: matchUrl,
                streamLinks: streamLinks,
                streamsLoaded: false,
                league: "MLB",
                source: "mlbbite"
            });
        });
    } catch (e) {}
    lg("MLBBite extraits", matches.length);
    return matches;
}

export function parseFootybite(html){
  var doc=new DOMParser().parseFromString(html,'text/html');
  lg('Title',doc.title);
  lg('HTML len',html.length);

  /* Compte les sélecteurs clés pour validation */
  var counts={
    'div-child-box': doc.querySelectorAll('.div-child-box').length,
    'txt-team':      doc.querySelectorAll('.txt-team').length,
    'time-txt':      doc.querySelectorAll('.time-txt').length,
    'btn-danger':    doc.querySelectorAll('.btn-danger').length,
    'text-dark-light':doc.querySelectorAll('.text-dark-light').length,
    'img-icone':     doc.querySelectorAll('.img-icone').length,
    'my-1':          doc.querySelectorAll('.my-1').length,
  };
  lg('Counts clés',JSON.stringify(counts));

  /* Snapshot du body pour debug */
  lg('body[5000]',doc.body.innerHTML.slice(0,5000));

  extractFootybiteLogos(doc);

  /* Si aucun .div-child-box → page différente */
  var matchEls=doc.querySelectorAll('.div-child-box');
  var matches=[];
  var currentLeague='Football';

  if(matchEls.length===0){
    // Fallback: If strict classes are missing, find typical match containers (e.g. ones with two teams and a time)
    var possibleMatches = doc.querySelectorAll('a[href*="/"], .match-row, .event-block, li');
    [].forEach.call(possibleMatches, function(el, i) {
        var text = el.textContent.replace(/\s+/g, ' ').trim();
        var teams = text.split(/ vs | v | - /i);
        if (teams.length >= 2 && text.length < 100) {
            var home = teams[0].trim();
            var away = teams.slice(1).join(' - ').trim();
            var timeM = text.match(/(\d{1,2}):(\d{2})/);
            var startTime = '00:00';
            if (timeM) {
                startTime = pad(parseInt(timeM[1])) + ':' + timeM[2];
                startTime = getEstTime(startTime);
            }

            var matchUrl = '';
            if (el.tagName.toLowerCase() === 'a') {
                matchUrl = el.getAttribute('href') || '';
            } else {
                var a = el.querySelector('a');
                if (a) matchUrl = a.getAttribute('href') || '';
            }
            if (matchUrl && !matchUrl.startsWith('http')) {
                matchUrl = SITE.slice(0, -1) + (matchUrl.startsWith('/') ? matchUrl : '/' + matchUrl);
            }

            matches.push({
                id: 'fb_fb_' + i,
                league: formatLeagueName('Football'),
                flag: lgFlag('Football'),
                color: lgColor('Football'),
                homeTeam: getOfficialTeamName(home),
                awayTeam: getOfficialTeamName(away),
                startTime: startTime,
                durationMinutes: getLeagueDuration('Football'),
                status: 'upcoming',
                score: null,
                minute: null,
                matchUrl: matchUrl,
                streamLinks: [],
                streamsLoaded: false
            });
        }
    });

    if (matches.length > 0) return matches;

    /* Fallback: scan toutes les classes présentes */
    var cls={};
    [].forEach.call(doc.querySelectorAll('[class]'),function(el){
      el.className.split(/\s+/).forEach(function(c){if(c)cls[c]=(cls[c]||0)+1;});
    });
    var top=Object.keys(cls).sort(function(a,b){return cls[b]-cls[a];}).slice(0,30);
    lg('Top classes',top.map(function(c){return c+'('+cls[c]+')';}).join(', '));
    lg('IDs',[].map.call(doc.querySelectorAll('[id]'),function(e){return e.id;}).filter(Boolean).slice(0,20).join(', '));
    return [];
  }

  [].forEach.call(matchEls,function(el,i){
    /* ─ Cherche le titre de ligue courant ─
       Le site organise: [league-header] [div-child-box] [div-child-box] … [league-header] …
       On remonte les siblings précédents pour trouver le dernier header */
    var lhdr=findLeagueHeader(el);
    if(lhdr) currentLeague=lhdr;
    var league=currentLeague;

    /* ─ Équipes (.txt-team) ─ */
    var teams=el.querySelectorAll('.txt-team');
    if(teams.length === 0){
      lg('Skip #'+i,'0 .txt-team');
      return;
    }
    var home=teams[0].textContent.trim();
    var away=teams.length>1 ? teams[1].textContent.trim() : '';

    if(away.toLowerCase() === 'live') {
      away = '';
    }

    if(!home) return;
    if(!away && home.toLowerCase().indexOf('f1') === -1 && home.toLowerCase().indexOf('nascar') === -1 && home.toLowerCase().indexOf('golf') === -1 && league.toLowerCase().indexOf('f1') === -1 && league.toLowerCase().indexOf('nascar') === -1 && league.toLowerCase().indexOf('golf') === -1 && league.toLowerCase().indexOf('nhl') === -1 && league.toLowerCase().indexOf('mlb') === -1) {
       return;
    }

    /* ─ Heure/score (.time-txt) ─ */
    var timeEl=el.querySelector('.time-txt');
    var rawTime=timeEl?timeEl.textContent.replace(/\s+/g,' ').trim():'';
    lg('raw time #'+i,rawTime);

    var startTime='00:00';
    var score=null;
    var status='upcoming';
    var minute=null;

    /* Cas 1: "19:45" → upcoming */
    var timeM=rawTime.match(/^(\d{1,2}):(\d{2})$/);
    /* Cas 2: "2 - 1" ou "2-1" → finished/live avec score */
    var scoreM=rawTime.match(/(\d+)\s*[-–]\s*(\d+)/);
    /* Cas 3: "45'" ou "HT" → live */
    var minM=rawTime.match(/(\d{1,3})'|HT|FT|Live/i);
    /* Cas 4: "Starts in 1hr:47min" ou "Starts in 17min" */
    var startsInM=rawTime.match(/Starts in (?:(\d+)hr:)?(\d+)min/i);
    /* Cas 5: "Match Started" */
    var matchStartedM=rawTime.match(/Match Started/i);

    if(timeM){
      startTime=pad(parseInt(timeM[1]))+':'+timeM[2];
      startTime=getEstTime(startTime);
      status='upcoming';
    } else if(startsInM){
      var n = new Date();
      var hAdd = startsInM[1]?parseInt(startsInM[1]):0;
      var mAdd = startsInM[2]?parseInt(startsInM[2]):0;
      n.setMinutes(n.getMinutes() + mAdd);
      n.setHours(n.getHours() + hAdd);
      startTime=pad(n.getHours())+':'+pad(n.getMinutes());
      status='upcoming';
    } else if(matchStartedM){
      var n = new Date();
      startTime=pad(n.getHours())+':'+pad(n.getMinutes());
      status='live';
    } else if(scoreM){
      score=[parseInt(scoreM[1]),parseInt(scoreM[2])];
      /* Cherche aussi l'heure dans un autre élément */
      var parentText=el.parentElement?el.parentElement.textContent:'';
      var ptime=parentText.match(/\b(\d{1,2}):(\d{2})\b/);
      startTime=ptime?pad(parseInt(ptime[1]))+':'+ptime[2]:'00:00';
      startTime=getEstTime(startTime);
      /* Live si minute trouvée */
      var liveEl=el.querySelector('.time-txt,[class*="live"],[class*="minute"]');
      var liveText=liveEl?liveEl.textContent:'';
      var lm=liveText.match(/(\d{1,3})'/);
      if(lm){status='live';minute=lm[1];}
      else if(/FT|Full/i.test(liveText)){status='finished';minute='FT';}
      else{status='live';}
    } else if(minM){
      var mText = minM[0];
      if (/FT/i.test(mText)) {
        status='finished';
        minute='FT';
      } else {
        status='live';
        minute=minM[1]||mText;
      }
    } else {
        /* Fallback: essai de trouver une heure qq part */
        var parentText=el.parentElement?el.parentElement.textContent:'';
        var ptime=parentText.match(/\b(\d{1,2}):(\d{2})\b/);
        if (ptime) {
            startTime=pad(parseInt(ptime[1]))+':'+ptime[2];
            startTime=getEstTime(startTime);
        }
    }

    /* On page d'accueil: lien vers la page du match */
    var matchUrl='';
    var matchLink=el.parentElement && el.parentElement.tagName.toLowerCase() === 'a' ? el.parentElement : null;
    if(!matchLink) matchLink=el.querySelector('a[target="_blank"][href*="/"]');
    if(!matchLink) matchLink=el.querySelector('a[href]');

    if(matchLink){
      var mhref=(matchLink.getAttribute('href')||'').trim();
      if(mhref&&mhref!=='#'){
        matchUrl=mhref.indexOf('http')===0?mhref:SITE.slice(0,-1)+mhref;
      }
    }

    matches.push({
      id:i, league:formatLeagueName(league), flag:lgFlag(league), color:lgColor(league),
      homeTeam:getOfficialTeamName(home), awayTeam:getOfficialTeamName(away),
      startTime:startTime, durationMinutes:getLeagueDuration(league),
      status:status, score:score, minute:minute,
      matchUrl:matchUrl || SITE,
      streamLinks:[], /* Sera rempli par le scrape asynchrone */
      streamsLoaded:false
    });
  });

  lg('Matchs extraits',matches.length);
  return matches;
}


/* ══ CACHE STREAMS (2 hours) ══════════════ */
export function getStreamCache(mid) {
    try {
        var cached = localStorage.getItem('streams_' + mid);
        if (cached) {
            var data = JSON.parse(cached);
            if (Date.now() - data.ts < 2 * 60 * 60 * 1000) {
                return data.streams;
            } else {
                localStorage.removeItem('streams_' + mid);
            }
        }
    } catch(e) {}
    return null;
}

export function saveStreamCache(mid, streams) {
    try {
        localStorage.setItem('streams_' + mid, JSON.stringify({ ts: Date.now(), streams: streams }));
    } catch(e) {}
}

/* ══ FETCH SUB-PAGES (STREAMS) ════════════ */
export function fetchSubPages(matches){
  // We use a limited concurrency pool so we don't spam the proxy/network
  var concurrency=3;
  var queue=matches.filter(function(m){return m.matchUrl&&!m.streamsLoaded;});
  var active=0;

  function next(){
    if(queue.length===0 && active===0){
      lg('Scrape streams','Terminé pour tous les matchs');
      return;
    }
    while(active<concurrency && queue.length>0){
      active++;
      var m=queue.shift();
      scrapeMatchFlux(m).then(function(){
        active--;
        next();
      }).catch(function(e){
        lg('Err scrape '+m.homeTeam,e.message);
        addScrapeLog(m.matchUrl, 'error', 'Match scrape failed: ' + e.message);
        m.streamsLoaded = true; // Empêche un blocage infini dans l'UI
        m.streamLinks = m.streamLinks || [];
        updateMatchUiAfterScrape(m);
        active--;
        next();
      });
    }
  }
  next();
}

export function scrapeMatchFlux(m){
  // Check cache first
  var cachedStreams = getStreamCache(m.id);
  if (cachedStreams) {
      lg('Scrape streams cached', m.homeTeam);
      m.streamLinks = cachedStreams;
      m.streamsLoaded = true;
      updateMatchUiAfterScrape(m);
      return Promise.resolve();
  }

  // Timeout for individual match scrape
  return Promise.race([
    fetchPage(m.matchUrl),
    new Promise(function(_, reject) { setTimeout(function() { reject(new Error('Timeout match streams')); }, 10000); })
  ]).then(function(html){
    addScrapeLog(m.matchUrl, 'success', '');
    var doc=new DOMParser().parseFromString(html,'text/html');
    var links=[];

    // === TOUTES SOURCES : RECHERCHE LARGE DE FLUX ===

    // 1. Chercher des iframes directs
    var iframes = doc.querySelectorAll('iframe');
    [].forEach.call(iframes, function(ifr) {
        var src = ifr.getAttribute('src');
        if(src && src.indexOf('http') === 0 && src.indexOf('ads') < 0) {
            links.push({
                name: 'Lecteur direct',
                quality: 'HD',
                lang: 'MULTI',
                url: src,
                icon: '▶️'
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
                 if(href && !href.startsWith('http') && !href.startsWith('javascript')) { try { href = new URL(href, m.matchUrl).href; } catch(e) {} }
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
            var qual = 'SD';
            if(rowText.indexOf('hd') >= 0 || rowText.indexOf('1080') >= 0 || rowText.indexOf('720') >= 0) qual = 'HD';
            if(rowText.indexOf('4k') >= 0) qual = '4K';

            links.push({
                name: name,
                quality: qual,
                url: url
            });
        }
    });

    // 3. Fallback: boutons ou liens génériques
    var btns = doc.querySelectorAll('.btn-danger, a.nav-link2, a.btn-3d, a.stream-button, a[href*="/watch/"], a[href*="/live/"], a[href*="stream"], a[target="_blank"]');
    [].forEach.call(btns,function(btn){
       if(btn.tagName==='A' && btn.getAttribute('href')){
          var url=btn.getAttribute('href');
          if(url && !url.startsWith('http') && !url.startsWith('javascript')) { try { url = new URL(url, m.matchUrl).href; } catch(e) {} }
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

              links.push({
                 name:name,
                 quality:'HD',
                 lang:'MULTI',
                 url:url
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
            if(!url.startsWith('http') && !url.startsWith('javascript')) { try { url = new URL(url, m.matchUrl).href; } catch(e) {} }
            if(url.indexOf('http') === 0) {
                var lowerUrl = url.toLowerCase();
                if (!lowerUrl.includes('1xbet') && !lowerUrl.includes('bet365') && !lowerUrl.includes('ads') && lowerUrl.length >= 5) {
                    links.push({
                        name: 'Lecteur caché',
                        quality: 'HD',
                        lang: 'MULTI',
                        url: url,
                        icon: '▶️'
                    });
                }
            }
        }
    });

    // 5. Ultime fallback : Si la source ne donne vraiment aucun autre flux et qu'on a le matchUrl.
    if(links.length===0 && m.matchUrl){
        links.push({name:'Voir streams sur le site', quality:'HD', lang:'Multi', url:m.matchUrl, icon:'🔗'});
    }

    // Preserve existing streams and avoid duplicates
    var existingLinks = m.streamLinks || [];
    var combinedLinks = existingLinks.slice();

    links.forEach(function(newLink) {
        var isDuplicate = combinedLinks.some(function(existingLink) {
            return existingLink.url === newLink.url;
        });
        if (!isDuplicate) {
            combinedLinks.push(newLink);
        }
    });

    // S'assurer qu'on affiche un maximum de streams (40)
    m.streamLinks = combinedLinks.slice(0, 40);
    m.streamsLoaded=true;
    saveStreamCache(m.id, m.streamLinks);
    updateMatchUiAfterScrape(m);
  });
}

export function updateMatchUiAfterScrape(m) {
    // Refresh UI for this specific match if needed
    var mbs = [document.getElementById('mb-'+m.id), document.getElementById('mb-'+m.id+'_live_copy')];
    mbs.forEach(function(mb) {
        if(mb){
            var sn=m.streamLinks ? m.streamLinks.length : 0;
            var snEl=mb.querySelector('.mb-sn');
            if(snEl){
                snEl.textContent=sn+' flux'+(sn>1?'s':'');
            }else if(sn>0){
                var mbM=mb.querySelector('.mb-m');
                if(mbM){
                    var span=document.createElement('span');
                    span.className='mb-sn';
                    span.textContent=sn+' flux'+(sn>1?'s':'');
                    mbM.appendChild(span);
                }
            }
        }
    });

    // Si la modale est ouverte pour CE match, on la met à jour
    var mnameEl=document.getElementById('mname');
    if(document.getElementById('mbg').classList.contains('open') && mnameEl && mnameEl.textContent.indexOf(m.homeTeam) >= 0){
        var body=document.getElementById('mbody');
        if(!m.streamLinks || m.streamLinks.length===0){
            body.innerHTML='<div style="text-align:center;padding:20px;color:var(--muted2);">Aucun flux trouvé.</div>';
        } else {
            var sortedLinks = sortFluxLinks(m.streamLinks);
            body.innerHTML=sortedLinks.map(function(s,i){
                return renderFluxItem(s, i, m);
            }).join('');
        }
    }
}

/* Remonte les siblings/parents pour trouver le header de ligue */
export function findLeagueHeader(el) {
    var curr = el;
    while (curr && curr !== document.body) {
        if (curr.classList && curr.classList.contains('my-1') && curr.querySelector('.img-icone')) {
            var span = curr.querySelector('span');
            if (span) return span.textContent.trim();
        }
        var prev = curr.previousElementSibling;
        while (prev) {
            if (prev.classList && prev.classList.contains('my-1') && prev.querySelector('.img-icone')) {
                var spanPrev = prev.querySelector('span');
                if (spanPrev) return spanPrev.textContent.trim();
            }
            if (prev.classList && prev.classList.contains('league-header')) {
                var text = prev.textContent.replace(/\s+/g, ' ').trim();
                return text;
            }
            prev = prev.previousElementSibling;
        }
        curr = curr.parentElement;
    }
    return null;
}

/* Convert UK time to EST */
export function getEstTime(ukTimeStr){
    var parts = ukTimeStr.split(':');
    if(parts.length !== 2) return ukTimeStr;
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    // UK is UTC+0 or +1 (BST). EST is UTC-5 or EDT is UTC-4.
    // Usually a 5 hours difference.
    var estH = h - 5;
    if(estH < 0) estH += 24;
    estH = estH % 24;
    return pad(estH) + ':' + pad(m);
}



// Global bindings for HTML compatibility
window.parseStreameast = parseStreameast;
window.parsePWHLSchedule = parsePWHLSchedule;
window.parseSportsurge = parseSportsurge;
window.parseOnHockey = parseOnHockey;
window.parseBuffstreams = parseBuffstreams;
window.extractFootybiteLogos = extractFootybiteLogos;
window.parseTotalsportek = parseTotalsportek;
window.parseVipleague = parseVipleague;
window.parseMethstreams = parseMethstreams;
window.parseNflbite = parseNflbite;
window.parseMlbbite = parseMlbbite;
window.parseFootybite = parseFootybite;
window.getStreamCache = getStreamCache;
window.saveStreamCache = saveStreamCache;
window.fetchSubPages = fetchSubPages;
window.scrapeMatchFlux = scrapeMatchFlux;
window.updateMatchUiAfterScrape = updateMatchUiAfterScrape;
window.findLeagueHeader = findLeagueHeader;
window.getEstTime = getEstTime;

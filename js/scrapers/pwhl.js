function parsePWHLSchedule(html) {
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

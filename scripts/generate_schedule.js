const fs = require('fs');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

const ESPN_LEAGUES = {
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

const LGC = {
  'champions league':'#f59e0b','europa league':'#ea580c','conference league':'#84cc16',
  'premier league':'#7c3aed','ligue 1':'#2563eb','la liga':'#dc2626',
  'bundesliga':'#b91c1c','serie a':'#059669','eredivisie':'#f97316',
  'primeira liga':'#15803d','mls':'#1e40af','fa cup':'#9333ea',
  'copa del rey':'#b45309','nations league':'#6d28d9','world cup':'#0891b2',
  'nba':'#17408b','nhl':'#000000','nfl':'#013369','mlb':'#002d72'
};

const FLAGS = {
  'england':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','france':'🇫🇷','spain':'🇪🇸','germany':'🇩🇪','italy':'🇮🇹',
  'netherlands':'🇳🇱','portugal':'🇵🇹','turkey':'🇹🇷','usa':'🇺🇸','brazil':'🇧🇷',
  'argentina':'🇦🇷','europe':'🌍','world':'🌐','scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','belgium':'🇧🇪',
};

function pad(n) { return String(n).padStart(2, '0'); }

function getEspnDateStr(d) {
  return d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate());
}

function getEstTimeStrFromDate(dateObj) {
  return ('0' + dateObj.getHours()).slice(-2) + ':' + ('0' + dateObj.getMinutes()).slice(-2);
}

function getEstDateStrFromDate(dateObj) {
  const y = dateObj.getFullYear();
  const m = pad(dateObj.getMonth() + 1);
  const d = pad(dateObj.getDate());
  return `${y}-${m}-${d}`;
}

function lgColor(n) {
  const l = (n || '').toLowerCase();
  for (const k in LGC) { if (l.indexOf(k) >= 0) return LGC[k]; }
  const h = [].reduce.call(n || 'X', (a, c) => a + c.charCodeAt(0), 0);
  return 'hsl(' + [200, 240, 280, 320, 150, 180, 210][h % 7] + ',55%,30%)';
}

function lgFlag(n) {
  const l = (n || '').toLowerCase();
  for (const k in FLAGS) { if (l.indexOf(k) >= 0) return FLAGS[k]; }
  if (l.indexOf('mlb') >= 0 || l.indexOf('baseball') >= 0) return '⚾';
  if (l.indexOf('nfl') >= 0 || l.indexOf('american football') >= 0) return '🏈';
  if (l.indexOf('nba') >= 0 || l.indexOf('basketball') >= 0) return '🏀';
  if (l.indexOf('nhl') >= 0 || l.indexOf('hockey') >= 0) return '🏒';
  if (l.indexOf('f1') >= 0 || l.indexOf('formula 1') >= 0) return '🏎️';
  if (l.indexOf('pwhl') >= 0) return '🏒';
  return '⚽';
}

function getLeagueDuration(league) {
  if (!league) return 105;
  const l = league.toLowerCase();
  if (l.indexOf('mlb') >= 0 || l.indexOf('baseball') >= 0) return 180;
  if (l.indexOf('nfl') >= 0 || l.indexOf('american football') >= 0) return 180;
  if (l.indexOf('nba') >= 0 || l.indexOf('basketball') >= 0) return 150;
  if (l.indexOf('nhl') >= 0 || l.indexOf('hockey') >= 0) return 150;
  if (l.indexOf('f1') >= 0 || l.indexOf('formula 1') >= 0) return 120;
  if (l.indexOf('indycar') >= 0 || l.indexOf('indy') >= 0) return 120;
  if (l.indexOf('wwe') >= 0 || l.indexOf('wrestling') >= 0) return 180;
  return 105;
}

function formatLeagueName(n) {
  let s = n.replace(' - ', ' ').replace(' - ', ' ').trim();
  s = s.replace('English ', '');
  s = s.replace('Spanish ', '');
  s = s.replace('French ', '');
  s = s.replace('Italian ', '');
  s = s.replace('German ', '');
  return s;
}

const TEAM_ALIASES = {
  'ny yankees': 'New York Yankees', 'new york yankees': 'New York Yankees', 'yankees': 'New York Yankees',
  'ny mets': 'New York Mets', 'new york mets': 'New York Mets', 'mets': 'New York Mets',
  'boston red sox': 'Boston Red Sox', 'red sox': 'Boston Red Sox',
  'toronto blue jays': 'Toronto Blue Jays', 'blue jays': 'Toronto Blue Jays',
  'baltimore orioles': 'Baltimore Orioles', 'orioles': 'Baltimore Orioles',
  'tampa bay rays': 'Tampa Bay Rays', 'rays': 'Tampa Bay Rays',
  'la dodgers': 'Los Angeles Dodgers', 'los angeles dodgers': 'Los Angeles Dodgers', 'dodgers': 'Los Angeles Dodgers',
  'sf giants': 'San Francisco Giants', 'san francisco giants': 'San Francisco Giants', 'giants': 'San Francisco Giants',
  'sd padres': 'San Diego Padres', 'san diego padres': 'San Diego Padres', 'padres': 'San Diego Padres',
  'colorado rockies': 'Colorado Rockies', 'rockies': 'Colorado Rockies',
  'arizona diamondbacks': 'Arizona Diamondbacks', 'diamondbacks': 'Arizona Diamondbacks',
  'chicago cubs': 'Chicago Cubs', 'cubs': 'Chicago Cubs',
  'st. louis cardinals': 'St. Louis Cardinals', 'st louis cardinals': 'St. Louis Cardinals', 'cardinals': 'St. Louis Cardinals',
  'milwaukee brewers': 'Milwaukee Brewers', 'brewers': 'Milwaukee Brewers',
  'pittsburgh pirates': 'Pittsburgh Pirates', 'pirates': 'Pittsburgh Pirates',
  'cincinnati reds': 'Cincinnati Reds', 'reds': 'Cincinnati Reds',
  'atlanta braves': 'Atlanta Braves', 'braves': 'Atlanta Braves',
  'philadelphia phillies': 'Philadelphia Phillies', 'phillies': 'Philadelphia Phillies',
  'miami marlins': 'Miami Marlins', 'marlins': 'Miami Marlins',
  'ny knicks': 'New York Knicks', 'new york knicks': 'New York Knicks', 'knicks': 'New York Knicks',
  'la lakers': 'Los Angeles Lakers', 'los angeles lakers': 'Los Angeles Lakers', 'lakers': 'Los Angeles Lakers',
  'boston celtics': 'Boston Celtics', 'celtics': 'Boston Celtics',
  'golden state warriors': 'Golden State Warriors', 'warriors': 'Golden State Warriors',
  'miami heat': 'Miami Heat', 'heat': 'Miami Heat',
  'chicago bulls': 'Chicago Bulls', 'bulls': 'Chicago Bulls',
  'dallas mavericks': 'Dallas Mavericks', 'mavericks': 'Dallas Mavericks',
  'toronto raptors': 'Toronto Raptors', 'raptors': 'Toronto Raptors',
  'vegas golden knights': 'Vegas Golden Knights', 'golden knights': 'Vegas Golden Knights',
  'toronto maple leafs': 'Toronto Maple Leafs', 'maple leafs': 'Toronto Maple Leafs',
  'boston bruins': 'Boston Bruins', 'bruins': 'Boston Bruins',
  'tampa bay lightning': 'Tampa Bay Lightning', 'lightning': 'Tampa Bay Lightning',
  'colorado avalanche': 'Colorado Avalanche', 'avalanche': 'Colorado Avalanche',
  'edmonton oilers': 'Edmonton Oilers', 'oilers': 'Edmonton Oilers',
  'montreal canadiens': 'Montréal Canadiens', 'canadiens': 'Montréal Canadiens', 'montréal canadiens': 'Montréal Canadiens',
  'ny rangers': 'New York Rangers', 'new york rangers': 'New York Rangers', 'rangers': 'New York Rangers',
  'dallas cowboys': 'Dallas Cowboys', 'cowboys': 'Dallas Cowboys',
  'ne england patriots': 'New England Patriots', 'patriots': 'New England Patriots',
  'pittsburgh steelers': 'Pittsburgh Steelers', 'steelers': 'Pittsburgh Steelers',
  'gb packers': 'Green Bay Packers', 'packers': 'Green Bay Packers',
  'kc chiefs': 'Kansas City Chiefs', 'chiefs': 'Kansas City Chiefs',
  'san francisco 49ers': 'San Francisco 49ers', '49ers': 'San Francisco 49ers',
  'philadelphia eagles': 'Philadelphia Eagles', 'eagles': 'Philadelphia Eagles',
  'seattle seahawks': 'Seattle Seahawks', 'seahawks': 'Seattle Seahawks',
};

function getOfficialTeamName(n) {
  if (!n) return '';
  let s = n.trim();
  const lower = s.toLowerCase();
  if (TEAM_ALIASES[lower]) {
    return TEAM_ALIASES[lower];
  }
  return s;
}

async function fetchEspnSchedule(leaguePath, dateStr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${leaguePath}/scoreboard?dates=${dateStr}`;
  try {
    const res = await fetch(url, { timeout: 8000 });
    return await res.json();
  } catch (err) {
    console.error(`Failed to fetch ${leaguePath} for ${dateStr}:`, err);
    return null;
  }
}

function isMatch(a, b) {
    if(!a || !b) return false;
    a = a.toLowerCase(); b = b.toLowerCase();
    if(a===b) return true;
    if(a.indexOf(b)>=0 || b.indexOf(a)>=0) return true;
    return false;
}

function parsePWHLSchedule(html) {
  var matches = [];
  try {
      var dom = new JSDOM(html);
      var doc = dom.window.document;
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
                              var dateStr = '';
                              if (g.date_played) {
                                  var d = new Date(g.date_played);
                                  timeStr = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
                                  dateStr = g.date_played;
                              } else {
                                  return;
                              }

                              var homeLogo = g.home_team.home_team_logo && g.home_team.home_team_logo.length > 0 ? g.home_team.home_team_logo[0].secure_url : null;
                              var awayLogo = g.visiting_team.visiting_team_logo && g.visiting_team.visiting_team_logo.length > 0 ? g.visiting_team.visiting_team_logo[0].secure_url : null;

                              var dateObj = new Date(dateStr);
                              var mDate = getEstDateStrFromDate(dateObj);
                              var startTime = ('0' + dateObj.getHours()).slice(-2) + ':' + ('0' + dateObj.getMinutes()).slice(-2);

                              var mStatus = isLive ? 'live' : 'upcoming';
                              var score = null;
                              if (homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined) {
                                  if (!isLive && status.indexOf('final') >= 0) mStatus = 'finished';
                                  score = [parseInt(homeScore), parseInt(awayScore)];
                              }

                              matches.push({
                                  id: 'pwhl_' + g.game_id,
                                  league: 'PWHL',
                                  flag: lgFlag('PWHL'),
                                  color: lgColor('PWHL'),
                                  homeTeam: home,
                                  awayTeam: away,
                                  matchDate: mDate,
                                  homeLogo: homeLogo,
                                  awayLogo: awayLogo,
                                  startTime: startTime,
                                  durationMinutes: 150,
                                  status: mStatus,
                                  score: score,
                                  minute: isLive ? status : null,
                                  streamLinks: [],
                                  streamsLoaded: false,
                                  source: 'api'
                              });
                          });
                          found = true;
                      } else {
                          for (var k in obj) {
                              if (!found) findSchedule(obj[k]);
                          }
                      }
                  };
                  findSchedule(data);
                  if (found) break;
              }
          }
      }
  } catch (e) {
      console.log('pwhl error', e);
  }
  return matches;
}


async function generateSchedule() {
  const baseMatches = [];
  const promises = [];

  const targetDate = new Date(); // Use actual current date for the generator
  const yesterday = new Date(targetDate); yesterday.setDate(yesterday.getDate() - 1);
  const nextMonth = new Date(targetDate); nextMonth.setDate(nextMonth.getDate() + 30);

  const espnDatesToFetch = [`${getEspnDateStr(yesterday)}-${getEspnDateStr(nextMonth)}`];

  const espnPaths = [];
  for (const key in ESPN_LEAGUES) {
    if (espnPaths.indexOf(ESPN_LEAGUES[key]) === -1) espnPaths.push(ESPN_LEAGUES[key]);
  }

  espnPaths.forEach(path => {
    espnDatesToFetch.forEach(dateStr => {
      promises.push(
        fetchEspnSchedule(path, dateStr).then(data => {
          if (!data || !data.events) return;
          data.events.forEach(ev => {
            const comp = ev.competitions[0];
            if (!comp || !comp.competitors) return;
            const home = comp.competitors.find(c => c.homeAway === 'home');
            const away = comp.competitors.find(c => c.homeAway === 'away');
            if (!home || !away) return;

            const leagueName = data.leagues && data.leagues[0] ? data.leagues[0].name : path;

            let status = 'upcoming';
            if (ev.status.type.state === 'in') status = 'live';
            if (ev.status.type.state === 'post') status = 'finished';

            let score = null;
            if (status !== 'upcoming') {
              score = [parseInt(home.score), parseInt(away.score)];
            }

            let minute = null;
            if (status === 'live' && ev.status.displayClock) {
              minute = ev.status.displayClock;
            } else if (status === 'live' && ev.status.period) {
              minute = 'P' + ev.status.period;
            }

            const dateObj = new Date(ev.date);
            const startTime = getEstTimeStrFromDate(dateObj);
            const matchDate = getEstDateStrFromDate(dateObj);

            const matchObj = {
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

            const existingIdx = baseMatches.findIndex(m => m.id === matchObj.id);
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
  });

  promises.push(
      fetch('https://www.thepwhl.com/en/schedule', { timeout: 8000 })
      .then(res => res.text())
      .then(html => {
          if (html) {
              const pwhlMatches = parsePWHLSchedule(html);
              pwhlMatches.forEach(m => {
                  const existingIdx = baseMatches.findIndex(existing => {
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
      }).catch(e => console.error('Error fetching PWHL:', e))
  );

  await Promise.allSettled(promises);

  const fetchDate = getEspnDateStr(targetDate);
  const cacheData = {
    fetchDate: fetchDate,
    matches: baseMatches
  };

  fs.writeFileSync('schedule.json', JSON.stringify(cacheData));
  console.log('Successfully generated schedule.json with', baseMatches.length, 'matches.');
}

generateSchedule();

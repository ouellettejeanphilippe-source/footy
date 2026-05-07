



'use strict';

/* ══ STATE ══════════════════════════════ */

var sourcesStatus = [];
var scrapeLogs = [];
function updateSourceStatus(name, status, matchCount, message) {
    var existing = sourcesStatus.find(function(s) { return s.name === name; });
    if (existing) {
        existing.status = status;
        existing.matchCount = matchCount;
        existing.message = message || '';
        existing.time = new Date().toLocaleTimeString('fr-CA', {hour12: false});
    } else {
        sourcesStatus.push({
            name: name,
            status: status,
            matchCount: matchCount,
            message: message || '',
            time: new Date().toLocaleTimeString('fr-CA', {hour12: false})
        });
    }
}

function addScrapeLog(url, status, errorMsg) {
    var entry = {
        time: new Date().toLocaleTimeString('fr-CA', {hour12: false}),
        url: url,
        status: status,
        error: errorMsg || ''
    };
    scrapeLogs.unshift(entry);
    if(scrapeLogs.length > 50) scrapeLogs.pop();
}

var favTeams = {};
var customLgOrder = [];
try {
  var storedFavs = localStorage.getItem('fav_teams');
  if (storedFavs) favTeams = JSON.parse(storedFavs);
  var storedLgOrder = localStorage.getItem('custom_lg_order');
  if (storedLgOrder) customLgOrder = JSON.parse(storedLgOrder);
} catch(e) {}

function saveCustomLgOrder() {
    localStorage.setItem('custom_lg_order', JSON.stringify(customLgOrder));
}

function toggleFavTeam(teamName) {
  if (favTeams[teamName]) {
    delete favTeams[teamName];
  } else {
    favTeams[teamName] = 1;
  }
  localStorage.setItem('fav_teams', JSON.stringify(favTeams));

  // Update DOM directly instead of rebuilding EPG
  var allCards = document.querySelectorAll('.mb');
  allCards.forEach(function(c) {
      var h = c.getAttribute('data-home');
      var a = c.getAttribute('data-away');
      if (h && a) {
          if (favTeams[h] || favTeams[a]) {
              c.classList.add('is-fav');
              var starH = c.querySelector('.chan-team:first-child button');
              var starA = c.querySelector('.chan-team:last-child button');
              if (starH) starH.style.color = favTeams[h] ? 'var(--accent)' : 'var(--muted)';
              if (starA) starA.style.color = favTeams[a] ? 'var(--accent)' : 'var(--muted)';
          } else {
              c.classList.remove('is-fav');
              var starH = c.querySelector('.chan-team:first-child button');
              var starA = c.querySelector('.chan-team:last-child button');
              if (starH) starH.style.color = 'var(--muted)';
              if (starA) starA.style.color = 'var(--muted)';
          }
      }
  });
}

var logoCache = {};
var matchCardCache = new Map();
var S = { searchQuery:'',  log:[], raw:'', matches:[], proxy:'', filter:'live', sportFilter:'all', hiddenLg:{'Autres Flux':true}, collapsedLg:{}, collapsedSections:{} };

/* ══ CONFIG ═════════════════════════════ */
var SITE = 'https://www.footybite.do/';
var MLBITE_URL = 'https://nflbite.is/'; // nflbite.is is dead, using nflbite.is as a working fallback on the same network
var MLBBITE_PLUS_URL = 'https://mlbbite.plus';
var SPORTSURGE_URL = 'https://v2.sportsurge.net/home5/';
var BUFFSTREAMS_URL = 'https://buffstreams.com.co/index2';
var STREAMEAST_URL = 'https://naturallyyou.fit/';
var ONHOCKEY_URL = 'https://onhockey.tv/schedule_table.php';
var VIPLEAGUE_URL = 'https://vipleague.im/top-streaming';
var METHSTREAMS_URL = 'https://methstreams.com/';
var TOTALSPORTEK_URL = 'https://totalsportek-real.com/';
var PROXIES = [
  function(u){ return 'https://api.allorigins.win/get?url='+encodeURIComponent(u); },
  function(u){ return 'https://api.codetabs.com/v1/proxy/?quest='+encodeURIComponent(u); },
  function(u){ return 'https://corsproxy.io/?'+encodeURIComponent(u); }
];

/* ══ COULEURS ═══════════════════════════ */
var LGC = {
  'champions league':'#f59e0b','europa league':'#ea580c','conference league':'#84cc16',
  'premier league':'#7c3aed','ligue 1':'#2563eb','la liga':'#dc2626',
  'bundesliga':'#b91c1c','serie a':'#059669','eredivisie':'#f97316',
  'primeira liga':'#15803d','mls':'#1e40af','fa cup':'#9333ea',
  'copa del rey':'#b45309','nations league':'#6d28d9','world cup':'#0891b2',
  'nba':'#17408b','nhl':'#000000','nfl':'#013369','mlb':'#002d72'
};
var FLAGS = {
  'england':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','france':'🇫🇷','spain':'🇪🇸','germany':'🇩🇪','italy':'🇮🇹',
  'netherlands':'🇳🇱','portugal':'🇵🇹','turkey':'🇹🇷','usa':'🇺🇸','brazil':'🇧🇷',
  'argentina':'🇦🇷','europe':'🌍','world':'🌐','scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','belgium':'🇧🇪',
};

function lgColor(n){
  var l=(n||'').toLowerCase();
  for(var k in LGC){ if(l.indexOf(k)>=0) return LGC[k]; }
  var h=[].reduce.call(n||'X',function(a,c){return a+c.charCodeAt(0);},0);
  return 'hsl('+[200,240,280,320,150,180,210][h%7]+',55%,30%)';
}
function lgFlag(n){
  var l=(n||'').toLowerCase();
  for(var k in FLAGS){ if(l.indexOf(k)>=0) return FLAGS[k]; }
  if(l.indexOf('mlb') >= 0 || l.indexOf('baseball') >= 0) return '⚾';
  if(l.indexOf('nfl') >= 0 || l.indexOf('american football') >= 0) return '🏈';
  if(l.indexOf('nba') >= 0 || l.indexOf('basketball') >= 0) return '🏀';
  if(l.indexOf('nhl') >= 0 || l.indexOf('hockey') >= 0 || l.indexOf('pwhl') >= 0 || l.indexOf('qmjhl') >= 0) return '🏒';
  if(l.indexOf('f1') >= 0 || l.indexOf('formula 1') >= 0 || l.indexOf('indycar') >= 0 || l.indexOf('indy') >= 0) return '🏎️';
  if(l.indexOf('wwe') >= 0 || l.indexOf('wrestling') >= 0 || l.indexOf('ufc') >= 0 || l.indexOf('mma') >= 0 || l.indexOf('boxing') >= 0) return '🥊';
  if(l.indexOf('tennis') >= 0) return '🎾';
  if(l.indexOf('rugby') >= 0) return '🏉';
  if(l.indexOf('golf') >= 0) return '⛳';
  if(l.indexOf('cricket') >= 0) return '🏏';
  if(l.indexOf('volleyball') >= 0) return '🏐';
  if(l.indexOf('darts') >= 0) return '🎯';
  if(l.indexOf('snooker') >= 0) return '🎱';
  if(l.indexOf('cycling') >= 0 || l.indexOf('tour de france') >= 0) return '🚴';
  return '⚽';
}

/* ══ HELPERS ═══════════════════════════ */
function pad(n){return String(n).padStart(2,'0');}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function getLeagueDuration(league) {
  if(!league) return 105;
  var l = league.toLowerCase();

  if(l.indexOf('mlb') >= 0 || l.indexOf('baseball') >= 0) return 180;
  if(l.indexOf('nfl') >= 0 || l.indexOf('american football') >= 0) return 180;
  if(l.indexOf('nba') >= 0 || l.indexOf('basketball') >= 0) return 150;
  if(l.indexOf('nhl') >= 0 || l.indexOf('hockey') >= 0) return 150;
  if(l.indexOf('f1') >= 0 || l.indexOf('formula 1') >= 0) return 120;
  if(l.indexOf('indycar') >= 0 || l.indexOf('indy') >= 0) return 120;
  if(l.indexOf('wwe') >= 0 || l.indexOf('wrestling') >= 0) return 180;

  return 105; // Default for soccer and others
}
function escJs(s){var e=String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"');return e.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function lg(label,val){S.log.push({l:String(label),v:String(val||'')});}


/* ══ TEAM COLORS ════════════ */
var TEAM_COLORS = {
  'montreal canadiens': ['#af1e2d', '#192168'],
  'toronto maple leafs': ['#00205b', '#ffffff'],
  'boston bruins': ['#ffb81c', '#000000'],
  'new york rangers': ['#0038a8', '#ce1126'],
  'colorado avalanche': ['#6f263d', '#236192'],
  'tampa bay lightning': ['#002868', '#ffffff'],
  'dallas stars': ['#006847', '#8f8f8c'],
  'edmonton oilers': ['#041e42', '#ff4c00'],
  'vancouver canucks': ['#00205b', '#00843d'],
  'calgary flames': ['#c8102e', '#f15a24'],
  'winnipeg jets': ['#041e42', '#004c97'],
  'ottawa senators': ['#c52032', '#000000'],

  // MLB
  'blue jays': ['#134a8e', '#1d2d5c'],
  'new york yankees': ['#003087', '#e4002c'],
  'boston red sox': ['#bd3039', '#0c2340'],
  'los angeles dodgers': ['#005a9c', '#a5acaf'],

  // Soccer
  'manchester city': ['#6cabdd', '#1c2c5b'],
  'manchester united': ['#da291c', '#fbe122'],
  'arsenal': ['#ef0107', '#063672'],
  'liverpool': ['#c8102e', '#00b2a9'],
  'real madrid': ['#ffffff', '#00529f'],
  'barcelona': ['#004d98', '#a50044'],
  'parissaintgermain': ['#004170', '#da291c'],
  'bayern munich': ['#dc052d', '#0066b2'],

  // NFL
  'kansas city chiefs': ['#e31837', '#ffb81c'],
  'san francisco 49ers': ['#aa0000', '#b3995d'],
  'dallas cowboys': ['#003594', '#041e42'],
  'philadelphia eagles': ['#004c54', '#a5acaf'],

  // NBA
  'los angeles lakers': ['#552583', '#fdb927'],
  'golden state warriors': ['#1d428a', '#ffc72c'],
  'boston celtics': ['#007a33', '#ba9653'],
  'chicago bulls': ['#ce1141', '#000000'],
  'miami heat': ['#98002e', '#f9a01b'],
  'toronto raptors': ['#ce1141', '#000000']
};

var STATIC_TEAMS = [
  { name: 'AFC Bournemouth', league: 'premier league' },
  { name: 'Arsenal', league: 'premier league' },
  { name: 'Aston Villa', league: 'premier league' },
  { name: 'Brentford', league: 'premier league' },
  { name: 'Brighton & Hove Albion', league: 'premier league' },
  { name: 'Burnley', league: 'premier league' },
  { name: 'Chelsea', league: 'premier league' },
  { name: 'Crystal Palace', league: 'premier league' },
  { name: 'Everton', league: 'premier league' },
  { name: 'Fulham', league: 'premier league' },
  { name: 'Leeds United', league: 'premier league' },
  { name: 'Liverpool', league: 'premier league' },
  { name: 'Manchester City', league: 'premier league' },
  { name: 'Manchester United', league: 'premier league' },
  { name: 'Newcastle United', league: 'premier league' },
  { name: 'Nottingham Forest', league: 'premier league' },
  { name: 'Sunderland', league: 'premier league' },
  { name: 'Tottenham Hotspur', league: 'premier league' },
  { name: 'West Ham United', league: 'premier league' },
  { name: 'Wolverhampton Wanderers', league: 'premier league' },
  { name: 'Alavés', league: 'la liga' },
  { name: 'Athletic Club', league: 'la liga' },
  { name: 'Atlético Madrid', league: 'la liga' },
  { name: 'Barcelona', league: 'la liga' },
  { name: 'Celta Vigo', league: 'la liga' },
  { name: 'Elche', league: 'la liga' },
  { name: 'Espanyol', league: 'la liga' },
  { name: 'Getafe', league: 'la liga' },
  { name: 'Girona', league: 'la liga' },
  { name: 'Levante', league: 'la liga' },
  { name: 'Mallorca', league: 'la liga' },
  { name: 'Osasuna', league: 'la liga' },
  { name: 'Rayo Vallecano', league: 'la liga' },
  { name: 'Real Betis', league: 'la liga' },
  { name: 'Real Madrid', league: 'la liga' },
  { name: 'Real Oviedo', league: 'la liga' },
  { name: 'Real Sociedad', league: 'la liga' },
  { name: 'Sevilla', league: 'la liga' },
  { name: 'Valencia', league: 'la liga' },
  { name: 'Villarreal', league: 'la liga' },
  { name: 'AC Milan', league: 'serie a' },
  { name: 'AS Roma', league: 'serie a' },
  { name: 'Atalanta', league: 'serie a' },
  { name: 'Bologna', league: 'serie a' },
  { name: 'Cagliari', league: 'serie a' },
  { name: 'Como', league: 'serie a' },
  { name: 'Cremonese', league: 'serie a' },
  { name: 'Fiorentina', league: 'serie a' },
  { name: 'Genoa', league: 'serie a' },
  { name: 'Hellas Verona', league: 'serie a' },
  { name: 'Internazionale', league: 'serie a' },
  { name: 'Juventus', league: 'serie a' },
  { name: 'Lazio', league: 'serie a' },
  { name: 'Lecce', league: 'serie a' },
  { name: 'Napoli', league: 'serie a' },
  { name: 'Parma', league: 'serie a' },
  { name: 'Pisa', league: 'serie a' },
  { name: 'Sassuolo', league: 'serie a' },
  { name: 'Torino', league: 'serie a' },
  { name: 'Udinese', league: 'serie a' },
  { name: '1. FC Heidenheim 1846', league: 'bundesliga' },
  { name: '1. FC Union Berlin', league: 'bundesliga' },
  { name: 'Bayer Leverkusen', league: 'bundesliga' },
  { name: 'Bayern Munich', league: 'bundesliga' },
  { name: 'Borussia Dortmund', league: 'bundesliga' },
  { name: 'Borussia Mönchengladbach', league: 'bundesliga' },
  { name: 'Eintracht Frankfurt', league: 'bundesliga' },
  { name: 'FC Augsburg', league: 'bundesliga' },
  { name: 'FC Cologne', league: 'bundesliga' },
  { name: 'Hamburg SV', league: 'bundesliga' },
  { name: 'Mainz', league: 'bundesliga' },
  { name: 'RB Leipzig', league: 'bundesliga' },
  { name: 'SC Freiburg', league: 'bundesliga' },
  { name: 'St. Pauli', league: 'bundesliga' },
  { name: 'TSG Hoffenheim', league: 'bundesliga' },
  { name: 'VfB Stuttgart', league: 'bundesliga' },
  { name: 'VfL Wolfsburg', league: 'bundesliga' },
  { name: 'Werder Bremen', league: 'bundesliga' },
  { name: 'AJ Auxerre', league: 'ligue 1' },
  { name: 'AS Monaco', league: 'ligue 1' },
  { name: 'Angers', league: 'ligue 1' },
  { name: 'Brest', league: 'ligue 1' },
  { name: 'Le Havre AC', league: 'ligue 1' },
  { name: 'Lens', league: 'ligue 1' },
  { name: 'Lille', league: 'ligue 1' },
  { name: 'Lorient', league: 'ligue 1' },
  { name: 'Lyon', league: 'ligue 1' },
  { name: 'Marseille', league: 'ligue 1' },
  { name: 'Metz', league: 'ligue 1' },
  { name: 'Nantes', league: 'ligue 1' },
  { name: 'Nice', league: 'ligue 1' },
  { name: 'Paris FC', league: 'ligue 1' },
  { name: 'Paris Saint-Germain', league: 'ligue 1' },
  { name: 'Stade Rennais', league: 'ligue 1' },
  { name: 'Strasbourg', league: 'ligue 1' },
  { name: 'Toulouse', league: 'ligue 1' },
  { name: 'AS Monaco', league: 'champions league' },
  { name: 'Ajax Amsterdam', league: 'champions league' },
  { name: 'Arsenal', league: 'champions league' },
  { name: 'Atalanta', league: 'champions league' },
  { name: 'Athletic Club', league: 'champions league' },
  { name: 'Atlético Madrid', league: 'champions league' },
  { name: 'Barcelona', league: 'champions league' },
  { name: 'Bayer Leverkusen', league: 'champions league' },
  { name: 'Bayern Munich', league: 'champions league' },
  { name: 'Benfica', league: 'champions league' },
  { name: 'Bodo/Glimt', league: 'champions league' },
  { name: 'Borussia Dortmund', league: 'champions league' },
  { name: 'Chelsea', league: 'champions league' },
  { name: 'Club Brugge', league: 'champions league' },
  { name: 'Eintracht Frankfurt', league: 'champions league' },
  { name: 'F.C. København', league: 'champions league' },
  { name: 'FK Qarabag', league: 'champions league' },
  { name: 'Galatasaray', league: 'champions league' },
  { name: 'Internazionale', league: 'champions league' },
  { name: 'Juventus', league: 'champions league' },
  { name: 'Kairat Almaty', league: 'champions league' },
  { name: 'Liverpool', league: 'champions league' },
  { name: 'Manchester City', league: 'champions league' },
  { name: 'Marseille', league: 'champions league' },
  { name: 'Napoli', league: 'champions league' },
  { name: 'Newcastle United', league: 'champions league' },
  { name: 'Olympiacos', league: 'champions league' },
  { name: 'PSV Eindhoven', league: 'champions league' },
  { name: 'Pafos', league: 'champions league' },
  { name: 'Paris Saint-Germain', league: 'champions league' },
  { name: 'Real Madrid', league: 'champions league' },
  { name: 'Slavia Prague', league: 'champions league' },
  { name: 'Sporting CP', league: 'champions league' },
  { name: 'Tottenham Hotspur', league: 'champions league' },
  { name: 'Union St.-Gilloise', league: 'champions league' },
  { name: 'Villarreal', league: 'champions league' },
  { name: 'AS Roma', league: 'europa league' },
  { name: 'Aston Villa', league: 'europa league' },
  { name: 'Bologna', league: 'europa league' },
  { name: 'Braga', league: 'europa league' },
  { name: 'Celta Vigo', league: 'europa league' },
  { name: 'Celtic', league: 'europa league' },
  { name: 'Dinamo Zagreb', league: 'europa league' },
  { name: 'FC Basel', league: 'europa league' },
  { name: 'FC Midtjylland', league: 'europa league' },
  { name: 'FC Porto', league: 'europa league' },
  { name: 'FC Utrecht', league: 'europa league' },
  { name: 'FCSB', league: 'europa league' },
  { name: 'Fenerbahce', league: 'europa league' },
  { name: 'Ferencvaros', league: 'europa league' },
  { name: 'Feyenoord Rotterdam', league: 'europa league' },
  { name: 'Go Ahead Eagles', league: 'europa league' },
  { name: 'Lille', league: 'europa league' },
  { name: 'Ludogorets Razgrad', league: 'europa league' },
  { name: 'Lyon', league: 'europa league' },
  { name: 'Maccabi Tel-Aviv', league: 'europa league' },
  { name: 'Malmö FF', league: 'europa league' },
  { name: 'Nice', league: 'europa league' },
  { name: 'Nottingham Forest', league: 'europa league' },
  { name: 'PAOK Salonika', league: 'europa league' },
  { name: 'Panathinaikos', league: 'europa league' },
  { name: 'RB Salzburg', league: 'europa league' },
  { name: 'Racing Genk', league: 'europa league' },
  { name: 'Rangers', league: 'europa league' },
  { name: 'Real Betis', league: 'europa league' },
  { name: 'Red Star Belgrade', league: 'europa league' },
  { name: 'SC Freiburg', league: 'europa league' },
  { name: 'SK Brann', league: 'europa league' },
  { name: 'SK Sturm Graz', league: 'europa league' },
  { name: 'VfB Stuttgart', league: 'europa league' },
  { name: 'Viktoria Plzen', league: 'europa league' },
  { name: 'Young Boys', league: 'europa league' },
  { name: 'AEK Athens', league: 'conference league' },
  { name: 'AEK Larnaca', league: 'conference league' },
  { name: 'AZ Alkmaar', league: 'conference league' },
  { name: 'Aberdeen', league: 'conference league' },
  { name: 'BK Häcken', league: 'conference league' },
  { name: 'Breidablik', league: 'conference league' },
  { name: 'CSU Craiova', league: 'conference league' },
  { name: 'Crystal Palace', league: 'conference league' },
  { name: 'Drita Gjilan', league: 'conference league' },
  { name: 'Dynamo Kyiv', league: 'conference league' },
  { name: 'FC Noah', league: 'conference league' },
  { name: 'Fiorentina', league: 'conference league' },
  { name: 'Hamrun Spartans', league: 'conference league' },
  { name: 'Jagiellonia Bialystok', league: 'conference league' },
  { name: 'KF Shkëndija', league: 'conference league' },
  { name: 'KuPS Kuopio', league: 'conference league' },
  { name: 'Lausanne Sports', league: 'conference league' },
  { name: 'Lech Poznan', league: 'conference league' },
  { name: 'Legia Warsaw', league: 'conference league' },
  { name: 'Lincoln Red Imps', league: 'conference league' },
  { name: 'Mainz', league: 'conference league' },
  { name: 'NK Celje', league: 'conference league' },
  { name: 'Omonia Nicosia', league: 'conference league' },
  { name: 'Raków Czestochowa', league: 'conference league' },
  { name: 'Rapid Vienna', league: 'conference league' },
  { name: 'Rayo Vallecano', league: 'conference league' },
  { name: 'Rijeka', league: 'conference league' },
  { name: 'Samsunspor', league: 'conference league' },
  { name: 'Shakhtar Donetsk', league: 'conference league' },
  { name: 'Shamrock Rovers', league: 'conference league' },
  { name: 'Shelbourne', league: 'conference league' },
  { name: 'Sigma Olomouc', league: 'conference league' },
  { name: 'Slovan Bratislava', league: 'conference league' },
  { name: 'Sparta Prague', league: 'conference league' },
  { name: 'Strasbourg', league: 'conference league' },
  { name: 'Zrinjski Mostar', league: 'conference league' },
  { name: 'Atlanta United FC', league: 'mls' },
  { name: 'Austin FC', league: 'mls' },
  { name: 'CF Montréal', league: 'mls' },
  { name: 'Charlotte FC', league: 'mls' },
  { name: 'Chicago Fire FC', league: 'mls' },
  { name: 'Colorado Rapids', league: 'mls' },
  { name: 'Columbus Crew', league: 'mls' },
  { name: 'D.C. United', league: 'mls' },
  { name: 'FC Cincinnati', league: 'mls' },
  { name: 'FC Dallas', league: 'mls' },
  { name: 'Houston Dynamo FC', league: 'mls' },
  { name: 'Inter Miami CF', league: 'mls' },
  { name: 'LA Galaxy', league: 'mls' },
  { name: 'LAFC', league: 'mls' },
  { name: 'Minnesota United FC', league: 'mls' },
  { name: 'Nashville SC', league: 'mls' },
  { name: 'New England Revolution', league: 'mls' },
  { name: 'New York City FC', league: 'mls' },
  { name: 'Orlando City SC', league: 'mls' },
  { name: 'Philadelphia Union', league: 'mls' },
  { name: 'Portland Timbers', league: 'mls' },
  { name: 'Real Salt Lake', league: 'mls' },
  { name: 'Red Bull New York', league: 'mls' },
  { name: 'San Diego FC', league: 'mls' },
  { name: 'San Jose Earthquakes', league: 'mls' },
  { name: 'Seattle Sounders FC', league: 'mls' },
  { name: 'Sporting Kansas City', league: 'mls' },
  { name: 'St. Louis CITY SC', league: 'mls' },
  { name: 'Toronto FC', league: 'mls' },
  { name: 'Vancouver Whitecaps', league: 'mls' },
  { name: 'AZ Alkmaar', league: 'eredivisie' },
  { name: 'Ajax Amsterdam', league: 'eredivisie' },
  { name: 'Excelsior', league: 'eredivisie' },
  { name: 'FC Groningen', league: 'eredivisie' },
  { name: 'FC Twente', league: 'eredivisie' },
  { name: 'FC Utrecht', league: 'eredivisie' },
  { name: 'FC Volendam', league: 'eredivisie' },
  { name: 'Feyenoord Rotterdam', league: 'eredivisie' },
  { name: 'Fortuna Sittard', league: 'eredivisie' },
  { name: 'Go Ahead Eagles', league: 'eredivisie' },
  { name: 'Heerenveen', league: 'eredivisie' },
  { name: 'Heracles Almelo', league: 'eredivisie' },
  { name: 'NAC Breda', league: 'eredivisie' },
  { name: 'NEC Nijmegen', league: 'eredivisie' },
  { name: 'PEC Zwolle', league: 'eredivisie' },
  { name: 'PSV Eindhoven', league: 'eredivisie' },
  { name: 'Sparta Rotterdam', league: 'eredivisie' },
  { name: 'Telstar', league: 'eredivisie' },
  { name: 'AVS', league: 'primeira liga' },
  { name: 'Alverca', league: 'primeira liga' },
  { name: 'Arouca', league: 'primeira liga' },
  { name: 'Benfica', league: 'primeira liga' },
  { name: 'Braga', league: 'primeira liga' },
  { name: 'C.D. Nacional', league: 'primeira liga' },
  { name: 'Casa Pia', league: 'primeira liga' },
  { name: 'Estoril', league: 'primeira liga' },
  { name: 'Estrela', league: 'primeira liga' },
  { name: 'FC Famalicao', league: 'primeira liga' },
  { name: 'FC Porto', league: 'primeira liga' },
  { name: 'Gil Vicente', league: 'primeira liga' },
  { name: 'Moreirense', league: 'primeira liga' },
  { name: 'Rio Ave', league: 'primeira liga' },
  { name: 'Santa Clara', league: 'primeira liga' },
  { name: 'Sporting CP', league: 'primeira liga' },
  { name: 'Tondela', league: 'primeira liga' },
  { name: 'Vitória de Guimaraes', league: 'primeira liga' },
  { name: 'Albania', league: 'nations league' },
  { name: 'Andorra', league: 'nations league' },
  { name: 'Armenia', league: 'nations league' },
  { name: 'Austria', league: 'nations league' },
  { name: 'Azerbaijan', league: 'nations league' },
  { name: 'Belarus', league: 'nations league' },
  { name: 'Belgium', league: 'nations league' },
  { name: 'Bosnia-Herzegovina', league: 'nations league' },
  { name: 'Bulgaria', league: 'nations league' },
  { name: 'Croatia', league: 'nations league' },
  { name: 'Cyprus', league: 'nations league' },
  { name: 'Czechia', league: 'nations league' },
  { name: 'Denmark', league: 'nations league' },
  { name: 'England', league: 'nations league' },
  { name: 'Estonia', league: 'nations league' },
  { name: 'Faroe Islands', league: 'nations league' },
  { name: 'Finland', league: 'nations league' },
  { name: 'France', league: 'nations league' },
  { name: 'Georgia', league: 'nations league' },
  { name: 'Germany', league: 'nations league' },
  { name: 'Gibraltar', league: 'nations league' },
  { name: 'Greece', league: 'nations league' },
  { name: 'Hungary', league: 'nations league' },
  { name: 'Iceland', league: 'nations league' },
  { name: 'Israel', league: 'nations league' },
  { name: 'Italy', league: 'nations league' },
  { name: 'Kazakhstan', league: 'nations league' },
  { name: 'Kosovo', league: 'nations league' },
  { name: 'Latvia', league: 'nations league' },
  { name: 'Liechtenstein', league: 'nations league' },
  { name: 'Lithuania', league: 'nations league' },
  { name: 'Luxembourg', league: 'nations league' },
  { name: 'Malta', league: 'nations league' },
  { name: 'Moldova', league: 'nations league' },
  { name: 'Montenegro', league: 'nations league' },
  { name: 'Netherlands', league: 'nations league' },
  { name: 'North Macedonia', league: 'nations league' },
  { name: 'Northern Ireland', league: 'nations league' },
  { name: 'Norway', league: 'nations league' },
  { name: 'Poland', league: 'nations league' },
  { name: 'Portugal', league: 'nations league' },
  { name: 'Republic of Ireland', league: 'nations league' },
  { name: 'Romania', league: 'nations league' },
  { name: 'San Marino', league: 'nations league' },
  { name: 'Scotland', league: 'nations league' },
  { name: 'Serbia', league: 'nations league' },
  { name: 'Slovakia', league: 'nations league' },
  { name: 'Slovenia', league: 'nations league' },
  { name: 'Spain', league: 'nations league' },
  { name: 'Sweden', league: 'nations league' },
  { name: 'Switzerland', league: 'nations league' },
  { name: 'Türkiye', league: 'nations league' },
  { name: 'Ukraine', league: 'nations league' },
  { name: 'Wales', league: 'nations league' },
  { name: 'AFC Bournemouth', league: 'fa cup' },
  { name: 'AFC Telford United', league: 'fa cup' },
  { name: 'AFC Totton', league: 'fa cup' },
  { name: 'AFC Wimbledon', league: 'fa cup' },
  { name: 'Accrington Stanley', league: 'fa cup' },
  { name: 'Aldershot Town', league: 'fa cup' },
  { name: 'Altrincham', league: 'fa cup' },
  { name: 'Arsenal', league: 'fa cup' },
  { name: 'Aston Villa', league: 'fa cup' },
  { name: 'Barnet', league: 'fa cup' },
  { name: 'Barnsley', league: 'fa cup' },
  { name: 'Barrow', league: 'fa cup' },
  { name: 'Birmingham City', league: 'fa cup' },
  { name: 'Blackburn Rovers', league: 'fa cup' },
  { name: 'Blackpool', league: 'fa cup' },
  { name: 'Bolton Wanderers', league: 'fa cup' },
  { name: 'Boreham Wood', league: 'fa cup' },
  { name: 'Brackley Town', league: 'fa cup' },
  { name: 'Bradford City', league: 'fa cup' },
  { name: 'Braintree Town', league: 'fa cup' },
  { name: 'Brentford', league: 'fa cup' },
  { name: 'Brighton & Hove Albion', league: 'fa cup' },
  { name: 'Bristol City', league: 'fa cup' },
  { name: 'Bristol Rovers', league: 'fa cup' },
  { name: 'Bromley', league: 'fa cup' },
  { name: 'Burnley', league: 'fa cup' },
  { name: 'Burton Albion', league: 'fa cup' },
  { name: 'Buxton', league: 'fa cup' },
  { name: 'Cambridge United', league: 'fa cup' },
  { name: 'Cardiff City', league: 'fa cup' },
  { name: 'Carlisle United', league: 'fa cup' },
  { name: 'Charlton Athletic', league: 'fa cup' },
  { name: 'Chatham Town', league: 'fa cup' },
  { name: 'Chelmsford', league: 'fa cup' },
  { name: 'Chelsea', league: 'fa cup' },
  { name: 'Cheltenham Town', league: 'fa cup' },
  { name: 'Chester FC', league: 'fa cup' },
  { name: 'Chesterfield', league: 'fa cup' },
  { name: 'Colchester United', league: 'fa cup' },
  { name: 'Coventry City', league: 'fa cup' },
  { name: 'Crawley Town', league: 'fa cup' },
  { name: 'Crewe Alexandra', league: 'fa cup' },
  { name: 'Crystal Palace', league: 'fa cup' },
  { name: 'Derby County', league: 'fa cup' },
  { name: 'Doncaster Rovers', league: 'fa cup' },
  { name: 'Eastleigh', league: 'fa cup' },
  { name: 'Ebbsfleet United', league: 'fa cup' },
  { name: 'Everton', league: 'fa cup' },
  { name: 'Exeter City', league: 'fa cup' },
  { name: 'FC Halifax Town', league: 'fa cup' },
  { name: 'Fleetwood Town', league: 'fa cup' },
  { name: 'Forest Green Rovers', league: 'fa cup' },
  { name: 'Fulham', league: 'fa cup' },
  { name: 'Gainsborough Trinity', league: 'fa cup' },
  { name: 'Gateshead', league: 'fa cup' },
  { name: 'Gillingham', league: 'fa cup' },
  { name: 'Grimsby Town', league: 'fa cup' },
  { name: 'Harrogate Town', league: 'fa cup' },
  { name: 'Hemel Hempstead Town', league: 'fa cup' },
  { name: 'Huddersfield Town', league: 'fa cup' },
  { name: 'Hull City', league: 'fa cup' },
  { name: 'Ipswich Town', league: 'fa cup' },
  { name: 'Leeds United', league: 'fa cup' },
  { name: 'Leicester City', league: 'fa cup' },
  { name: 'Leyton Orient', league: 'fa cup' },
  { name: 'Lincoln City', league: 'fa cup' },
  { name: 'Liverpool', league: 'fa cup' },
  { name: 'Luton Town', league: 'fa cup' },
  { name: 'Macclesfield FC', league: 'fa cup' },
  { name: 'Maldon & Tiptree', league: 'fa cup' },
  { name: 'Manchester City', league: 'fa cup' },
  { name: 'Manchester United', league: 'fa cup' },
  { name: 'Mansfield Town', league: 'fa cup' },
  { name: 'Middlesbrough', league: 'fa cup' },
  { name: 'Millwall', league: 'fa cup' },
  { name: 'Milton Keynes Dons', league: 'fa cup' },
  { name: 'Newcastle United', league: 'fa cup' },
  { name: 'Newport County', league: 'fa cup' },
  { name: 'Northampton Town', league: 'fa cup' },
  { name: 'Norwich City', league: 'fa cup' },
  { name: 'Nottingham Forest', league: 'fa cup' },
  { name: 'Notts County', league: 'fa cup' },
  { name: 'Oldham Athletic', league: 'fa cup' },
  { name: 'Oxford United', league: 'fa cup' },
  { name: 'Peterborough United', league: 'fa cup' },
  { name: 'Plymouth Argyle', league: 'fa cup' },
  { name: 'Port Vale', league: 'fa cup' },
  { name: 'Portsmouth', league: 'fa cup' },
  { name: 'Preston North End', league: 'fa cup' },
  { name: 'Queens Park Rangers', league: 'fa cup' },
  { name: 'Reading', league: 'fa cup' },
  { name: 'Rotherham United', league: 'fa cup' },
  { name: 'Salford City', league: 'fa cup' },
  { name: 'Scunthorpe United', league: 'fa cup' },
  { name: 'Sheffield United', league: 'fa cup' },
  { name: 'Sheffield Wednesday', league: 'fa cup' },
  { name: 'Shrewsbury Town', league: 'fa cup' },
  { name: 'Slough Town', league: 'fa cup' },
  { name: 'South Shields', league: 'fa cup' },
  { name: 'Southampton', league: 'fa cup' },
  { name: 'Southend United', league: 'fa cup' },
  { name: 'Spennymoor Town', league: 'fa cup' },
  { name: 'St Albans City', league: 'fa cup' },
  { name: 'Stevenage', league: 'fa cup' },
  { name: 'Stockport County', league: 'fa cup' },
  { name: 'Stoke City', league: 'fa cup' },
  { name: 'Sunderland', league: 'fa cup' },
  { name: 'Sutton United', league: 'fa cup' },
  { name: 'Swansea City', league: 'fa cup' },
  { name: 'Swindon Town', league: 'fa cup' },
  { name: 'Tamworth', league: 'fa cup' },
  { name: 'Tottenham Hotspur', league: 'fa cup' },
  { name: 'Tranmere Rovers', league: 'fa cup' },
  { name: 'Walsall', league: 'fa cup' },
  { name: 'Watford', league: 'fa cup' },
  { name: 'Wealdstone', league: 'fa cup' },
  { name: 'West Bromwich Albion', league: 'fa cup' },
  { name: 'West Ham United', league: 'fa cup' },
  { name: 'Weston-super-Mare', league: 'fa cup' },
  { name: 'Wigan Athletic', league: 'fa cup' },
  { name: 'Wolverhampton Wanderers', league: 'fa cup' },
  { name: 'Wrexham', league: 'fa cup' },
  { name: 'Wycombe Wanderers', league: 'fa cup' },
  { name: 'York City', league: 'fa cup' },
  { name: 'AFC Bournemouth', league: 'league cup' },
  { name: 'AFC Wimbledon', league: 'league cup' },
  { name: 'Accrington Stanley', league: 'league cup' },
  { name: 'Arsenal', league: 'league cup' },
  { name: 'Aston Villa', league: 'league cup' },
  { name: 'Barnet', league: 'league cup' },
  { name: 'Barnsley', league: 'league cup' },
  { name: 'Barrow', league: 'league cup' },
  { name: 'Birmingham City', league: 'league cup' },
  { name: 'Blackburn Rovers', league: 'league cup' },
  { name: 'Blackpool', league: 'league cup' },
  { name: 'Bolton Wanderers', league: 'league cup' },
  { name: 'Bradford City', league: 'league cup' },
  { name: 'Brentford', league: 'league cup' },
  { name: 'Brighton & Hove Albion', league: 'league cup' },
  { name: 'Bristol City', league: 'league cup' },
  { name: 'Bristol Rovers', league: 'league cup' },
  { name: 'Bromley', league: 'league cup' },
  { name: 'Burnley', league: 'league cup' },
  { name: 'Burton Albion', league: 'league cup' },
  { name: 'Cambridge United', league: 'league cup' },
  { name: 'Cardiff City', league: 'league cup' },
  { name: 'Charlton Athletic', league: 'league cup' },
  { name: 'Chelsea', league: 'league cup' },
  { name: 'Cheltenham Town', league: 'league cup' },
  { name: 'Chesterfield', league: 'league cup' },
  { name: 'Colchester United', league: 'league cup' },
  { name: 'Coventry City', league: 'league cup' },
  { name: 'Crawley Town', league: 'league cup' },
  { name: 'Crewe Alexandra', league: 'league cup' },
  { name: 'Crystal Palace', league: 'league cup' },
  { name: 'Derby County', league: 'league cup' },
  { name: 'Doncaster Rovers', league: 'league cup' },
  { name: 'Everton', league: 'league cup' },
  { name: 'Exeter City', league: 'league cup' },
  { name: 'Fleetwood Town', league: 'league cup' },
  { name: 'Fulham', league: 'league cup' },
  { name: 'Gillingham', league: 'league cup' },
  { name: 'Grimsby Town', league: 'league cup' },
  { name: 'Harrogate Town', league: 'league cup' },
  { name: 'Huddersfield Town', league: 'league cup' },
  { name: 'Hull City', league: 'league cup' },
  { name: 'Ipswich Town', league: 'league cup' },
  { name: 'Leeds United', league: 'league cup' },
  { name: 'Leicester City', league: 'league cup' },
  { name: 'Leyton Orient', league: 'league cup' },
  { name: 'Lincoln City', league: 'league cup' },
  { name: 'Liverpool', league: 'league cup' },
  { name: 'Luton Town', league: 'league cup' },
  { name: 'Manchester City', league: 'league cup' },
  { name: 'Manchester United', league: 'league cup' },
  { name: 'Mansfield Town', league: 'league cup' },
  { name: 'Middlesbrough', league: 'league cup' },
  { name: 'Millwall', league: 'league cup' },
  { name: 'Milton Keynes Dons', league: 'league cup' },
  { name: 'Newcastle United', league: 'league cup' },
  { name: 'Newport County', league: 'league cup' },
  { name: 'Northampton Town', league: 'league cup' },
  { name: 'Norwich City', league: 'league cup' },
  { name: 'Nottingham Forest', league: 'league cup' },
  { name: 'Notts County', league: 'league cup' },
  { name: 'Oldham Athletic', league: 'league cup' },
  { name: 'Oxford United', league: 'league cup' },
  { name: 'Peterborough United', league: 'league cup' },
  { name: 'Plymouth Argyle', league: 'league cup' },
  { name: 'Port Vale', league: 'league cup' },
  { name: 'Portsmouth', league: 'league cup' },
  { name: 'Preston North End', league: 'league cup' },
  { name: 'Queens Park Rangers', league: 'league cup' },
  { name: 'Reading', league: 'league cup' },
  { name: 'Rotherham United', league: 'league cup' },
  { name: 'Salford City', league: 'league cup' },
  { name: 'Sheffield United', league: 'league cup' },
  { name: 'Sheffield Wednesday', league: 'league cup' },
  { name: 'Shrewsbury Town', league: 'league cup' },
  { name: 'Southampton', league: 'league cup' },
  { name: 'Stevenage', league: 'league cup' },
  { name: 'Stockport County', league: 'league cup' },
  { name: 'Stoke City', league: 'league cup' },
  { name: 'Sunderland', league: 'league cup' },
  { name: 'Swansea City', league: 'league cup' },
  { name: 'Swindon Town', league: 'league cup' },
  { name: 'Tottenham Hotspur', league: 'league cup' },
  { name: 'Tranmere Rovers', league: 'league cup' },
  { name: 'Walsall', league: 'league cup' },
  { name: 'Watford', league: 'league cup' },
  { name: 'West Bromwich Albion', league: 'league cup' },
  { name: 'West Ham United', league: 'league cup' },
  { name: 'Wigan Athletic', league: 'league cup' },
  { name: 'Wolverhampton Wanderers', league: 'league cup' },
  { name: 'Wrexham', league: 'league cup' },
  { name: 'Wycombe Wanderers', league: 'league cup' },
  { name: 'Alavés', league: 'copa del rey' },
  { name: 'Albacete', league: 'copa del rey' },
  { name: 'Alberite', league: 'copa del rey' },
  { name: 'Alcalá', league: 'copa del rey' },
  { name: 'Almería', league: 'copa del rey' },
  { name: 'Antequera CF', league: 'copa del rey' },
  { name: 'Arenas Club', league: 'copa del rey' },
  { name: 'Athletic Club', league: 'copa del rey' },
  { name: 'Atletico Astorga', league: 'copa del rey' },
  { name: 'Atlètic Lleida', league: 'copa del rey' },
  { name: 'Atlètic Sant Just', league: 'copa del rey' },
  { name: 'Atlético Baleares', league: 'copa del rey' },
  { name: 'Atlético Calatayud', league: 'copa del rey' },
  { name: 'Atlético Madrid', league: 'copa del rey' },
  { name: 'Atlético Melilla', league: 'copa del rey' },
  { name: 'Atlético Tordesillas', league: 'copa del rey' },
  { name: 'Azuaga', league: 'copa del rey' },
  { name: 'Barcelona', league: 'copa del rey' },
  { name: 'Betis CF', league: 'copa del rey' },
  { name: 'Burgos', league: 'copa del rey' },
  { name: 'CD Artistico Navalcarnero', league: 'copa del rey' },
  { name: 'CD Ebro', league: 'copa del rey' },
  { name: 'CD Estepona', league: 'copa del rey' },
  { name: 'CD Extremadura', league: 'copa del rey' },
  { name: 'CD Guadalajara', league: 'copa del rey' },
  { name: 'CD Sabadell', league: 'copa del rey' },
  { name: 'CE Europa', league: 'copa del rey' },
  { name: 'CE Sant Jordi', league: 'copa del rey' },
  { name: 'Cacereno', league: 'copa del rey' },
  { name: 'Campanario', league: 'copa del rey' },
  { name: 'Castellón', league: 'copa del rey' },
  { name: 'Caudal Deportivo', league: 'copa del rey' },
  { name: 'Celta Vigo', league: 'copa del rey' },
  { name: 'Ceuta', league: 'copa del rey' },
  { name: 'Cieza', league: 'copa del rey' },
  { name: 'Club Atlético Antoniano', league: 'copa del rey' },
  { name: 'Constancia', league: 'copa del rey' },
  { name: 'Cultural Leonesa', league: 'copa del rey' },
  { name: 'Cádiz', league: 'copa del rey' },
  { name: 'Córdoba', league: 'copa del rey' },
  { name: 'Deportivo La Coruña', league: 'copa del rey' },
  { name: 'Egüés', league: 'copa del rey' },
  { name: 'Eibar', league: 'copa del rey' },
  { name: 'Elche', league: 'copa del rey' },
  { name: 'Eldense', league: 'copa del rey' },
  { name: 'Espanyol', league: 'copa del rey' },
  { name: 'FC Andorra', league: 'copa del rey' },
  { name: 'FC Cartagena', league: 'copa del rey' },
  { name: 'Getafe', league: 'copa del rey' },
  { name: 'Getxo', league: 'copa del rey' },
  { name: 'Gimnàstic de Tarragona', league: 'copa del rey' },
  { name: 'Girona', league: 'copa del rey' },
  { name: 'Granada', league: 'copa del rey' },
  { name: 'Huesca', league: 'copa del rey' },
  { name: 'Inter de Valdemoro', league: 'copa del rey' },
  { name: 'Juventud Torremolinos', league: 'copa del rey' },
  { name: 'La Unión Atlético', league: 'copa del rey' },
  { name: 'Langreo', league: 'copa del rey' },
  { name: 'Las Palmas', league: 'copa del rey' },
  { name: 'Leganés', league: 'copa del rey' },
  { name: 'Levante', league: 'copa del rey' },
  { name: 'Lorca Deportiva', league: 'copa del rey' },
  { name: 'Lourdes', league: 'copa del rey' },
  { name: 'Lucena CF', league: 'copa del rey' },
  { name: 'Mallorca', league: 'copa del rey' },
  { name: 'Manises CF', league: 'copa del rey' },
  { name: 'Maracena', league: 'copa del rey' },
  { name: 'Mirandés', league: 'copa del rey' },
  { name: 'Mutilvera', league: 'copa del rey' },
  { name: 'Málaga', league: 'copa del rey' },
  { name: 'Mérida', league: 'copa del rey' },
  { name: 'Naxara', league: 'copa del rey' },
  { name: 'Negreira', league: 'copa del rey' },
  { name: 'Numancia', league: 'copa del rey' },
  { name: 'Orihuela', league: 'copa del rey' },
  { name: 'Osasuna', league: 'copa del rey' },
  { name: 'Ourense CF', league: 'copa del rey' },
  { name: 'Palma del Río', league: 'copa del rey' },
  { name: 'Poblense', league: 'copa del rey' },
  { name: 'Ponferradina', league: 'copa del rey' },
  { name: 'Pontevedra', league: 'copa del rey' },
  { name: 'Portugalete', league: 'copa del rey' },
  { name: 'Puente Genil', league: 'copa del rey' },
  { name: 'Puerto De Vega', league: 'copa del rey' },
  { name: 'Quintanar del Rey', league: 'copa del rey' },
  { name: 'Racing Ferrol', league: 'copa del rey' },
  { name: 'Racing Santander', league: 'copa del rey' },
  { name: 'Rayo Majadahonda', league: 'copa del rey' },
  { name: 'Rayo Vallecano', league: 'copa del rey' },
  { name: 'Real Aviles Industrial', league: 'copa del rey' },
  { name: 'Real Betis', league: 'copa del rey' },
  { name: 'Real Jaen CF', league: 'copa del rey' },
  { name: 'Real Madrid', league: 'copa del rey' },
  { name: 'Real Murcia', league: 'copa del rey' },
  { name: 'Real Oviedo', league: 'copa del rey' },
  { name: 'Real Sociedad', league: 'copa del rey' },
  { name: 'Real Valladolid', league: 'copa del rey' },
  { name: 'Real Zaragoza', league: 'copa del rey' },
  { name: 'Real Ávila', league: 'copa del rey' },
  { name: 'Reddis', league: 'copa del rey' },
  { name: 'Roda', league: 'copa del rey' },
  { name: 'SD Logroñés', league: 'copa del rey' },
  { name: 'Sant Andreu', league: 'copa del rey' },
  { name: 'Sevilla', league: 'copa del rey' },
  { name: 'Sporting Ceuta', league: 'copa del rey' },
  { name: 'Sporting Gijón', league: 'copa del rey' },
  { name: 'Sámano', league: 'copa del rey' },
  { name: 'Talavera', league: 'copa del rey' },
  { name: 'Tarazona', league: 'copa del rey' },
  { name: 'Tenerife', league: 'copa del rey' },
  { name: 'Teruel', league: 'copa del rey' },
  { name: 'Textil Escudo', league: 'copa del rey' },
  { name: 'Toledo', league: 'copa del rey' },
  { name: 'Torrent', league: 'copa del rey' },
  { name: 'Tropezón', league: 'copa del rey' },
  { name: 'UCAM Murcia', league: 'copa del rey' },
  { name: 'UD Ibiza', league: 'copa del rey' },
  { name: 'UD Logroñés', league: 'copa del rey' },
  { name: 'UD Ourense', league: 'copa del rey' },
  { name: 'UD San Fernando', league: 'copa del rey' },
  { name: 'Universitario FC', league: 'copa del rey' },
  { name: 'Unión Deportiva Los Garres', league: 'copa del rey' },
  { name: 'Utebo', league: 'copa del rey' },
  { name: 'Valencia', league: 'copa del rey' },
  { name: 'Villarreal', league: 'copa del rey' },
  { name: 'Yuncos', league: 'copa del rey' },
  { name: '1. FC Heidenheim 1846', league: 'dfb pokal' },
  { name: '1. FC Lokomotive Leipzig', league: 'dfb pokal' },
  { name: '1. FC Magdeburg', league: 'dfb pokal' },
  { name: '1. FC Nürnberg', league: 'dfb pokal' },
  { name: '1. FC Schweinfurt 05', league: 'dfb pokal' },
  { name: '1. FC Union Berlin', league: 'dfb pokal' },
  { name: 'Arminia Bielefeld', league: 'dfb pokal' },
  { name: 'BFC Dynamo Berlin', league: 'dfb pokal' },
  { name: 'Bahlinger SC 1929', league: 'dfb pokal' },
  { name: 'Bayer Leverkusen', league: 'dfb pokal' },
  { name: 'Bayern Munich', league: 'dfb pokal' },
  { name: 'Borussia Dortmund', league: 'dfb pokal' },
  { name: 'Borussia Mönchengladbach', league: 'dfb pokal' },
  { name: 'Dynamo Dresden', league: 'dfb pokal' },
  { name: 'Eintracht Frankfurt', league: 'dfb pokal' },
  { name: 'Energie Cottbus', league: 'dfb pokal' },
  { name: 'FC 08 Homburg', league: 'dfb pokal' },
  { name: 'FC Augsburg', league: 'dfb pokal' },
  { name: 'FC Cologne', league: 'dfb pokal' },
  { name: 'FC Eintracht Norderstedt', league: 'dfb pokal' },
  { name: 'FC Gütersloh 2000', league: 'dfb pokal' },
  { name: 'FK Pirmasens', league: 'dfb pokal' },
  { name: 'FV Engers 07', league: 'dfb pokal' },
  { name: 'FV Illertissen', league: 'dfb pokal' },
  { name: 'Fortuna Düsseldorf', league: 'dfb pokal' },
  { name: 'Hallescher FC', league: 'dfb pokal' },
  { name: 'Hamburg SV', league: 'dfb pokal' },
  { name: 'Hannover 96', league: 'dfb pokal' },
  { name: 'Hansa Rostock', league: 'dfb pokal' },
  { name: 'Hemelingen', league: 'dfb pokal' },
  { name: 'Hertha Berlin', league: 'dfb pokal' },
  { name: 'Holstein Kiel', league: 'dfb pokal' },
  { name: 'Kaiserslautern', league: 'dfb pokal' },
  { name: 'Karlsruher SC', league: 'dfb pokal' },
  { name: 'Lohne', league: 'dfb pokal' },
  { name: 'Mainz', league: 'dfb pokal' },
  { name: 'Preußen Münster', league: 'dfb pokal' },
  { name: 'RB Leipzig', league: 'dfb pokal' },
  { name: 'RSV Eintracht', league: 'dfb pokal' },
  { name: 'Rot-Weiss Essen', league: 'dfb pokal' },
  { name: 'SC Freiburg', league: 'dfb pokal' },
  { name: 'SC Paderborn 07', league: 'dfb pokal' },
  { name: 'SG Sonnenhof Großaspach', league: 'dfb pokal' },
  { name: 'SSV Jahn Regensburg', league: 'dfb pokal' },
  { name: 'SSV Ulm 1846', league: 'dfb pokal' },
  { name: 'SV 07 Elversberg', league: 'dfb pokal' },
  { name: 'SV Atlas Delmenhorst', league: 'dfb pokal' },
  { name: 'SV Darmstadt 98', league: 'dfb pokal' },
  { name: 'SV Sandhausen', league: 'dfb pokal' },
  { name: 'SV Wehen Wiesbaden', league: 'dfb pokal' },
  { name: 'Saarbrücken', league: 'dfb pokal' },
  { name: 'Schalke 04', league: 'dfb pokal' },
  { name: 'SpVgg Greuther Fürth', league: 'dfb pokal' },
  { name: 'Sportfreunde Lotte', league: 'dfb pokal' },
  { name: 'St. Pauli', league: 'dfb pokal' },
  { name: 'TSG Hoffenheim', league: 'dfb pokal' },
  { name: 'TSV Eintracht Braunschweig', league: 'dfb pokal' },
  { name: 'VfB Lübeck', league: 'dfb pokal' },
  { name: 'VfB Stuttgart', league: 'dfb pokal' },
  { name: 'VfL Bochum', league: 'dfb pokal' },
  { name: 'VfL Wolfsburg', league: 'dfb pokal' },
  { name: 'Viktoria Köln', league: 'dfb pokal' },
  { name: 'Werder Bremen', league: 'dfb pokal' },
  { name: 'ZFC Meuselwitz', league: 'dfb pokal' },
  { name: 'Al Ahli', league: 'saudi pro league' },
  { name: 'Al Ettifaq', league: 'saudi pro league' },
  { name: 'Al Fateh', league: 'saudi pro league' },
  { name: 'Al Fayha', league: 'saudi pro league' },
  { name: 'Al Hazem', league: 'saudi pro league' },
  { name: 'Al Hilal', league: 'saudi pro league' },
  { name: 'Al Ittihad', league: 'saudi pro league' },
  { name: 'Al Khaleej', league: 'saudi pro league' },
  { name: 'Al Kholood', league: 'saudi pro league' },
  { name: 'Al Najma', league: 'saudi pro league' },
  { name: 'Al Nassr', league: 'saudi pro league' },
  { name: 'Al Okhdood', league: 'saudi pro league' },
  { name: 'Al Qadsiah', league: 'saudi pro league' },
  { name: 'Al Riyadh', league: 'saudi pro league' },
  { name: 'Al Shabab', league: 'saudi pro league' },
  { name: 'Al Taawoun', league: 'saudi pro league' },
  { name: 'Damac', league: 'saudi pro league' },
  { name: 'Neom SC', league: 'saudi pro league' },
  { name: 'Atlanta Hawks', league: 'nba' },
  { name: 'Boston Celtics', league: 'nba' },
  { name: 'Brooklyn Nets', league: 'nba' },
  { name: 'Charlotte Hornets', league: 'nba' },
  { name: 'Chicago Bulls', league: 'nba' },
  { name: 'Cleveland Cavaliers', league: 'nba' },
  { name: 'Dallas Mavericks', league: 'nba' },
  { name: 'Denver Nuggets', league: 'nba' },
  { name: 'Detroit Pistons', league: 'nba' },
  { name: 'Golden State Warriors', league: 'nba' },
  { name: 'Houston Rockets', league: 'nba' },
  { name: 'Indiana Pacers', league: 'nba' },
  { name: 'LA Clippers', league: 'nba' },
  { name: 'Los Angeles Lakers', league: 'nba' },
  { name: 'Memphis Grizzlies', league: 'nba' },
  { name: 'Miami Heat', league: 'nba' },
  { name: 'Milwaukee Bucks', league: 'nba' },
  { name: 'Minnesota Timberwolves', league: 'nba' },
  { name: 'New Orleans Pelicans', league: 'nba' },
  { name: 'New York Knicks', league: 'nba' },
  { name: 'Oklahoma City Thunder', league: 'nba' },
  { name: 'Orlando Magic', league: 'nba' },
  { name: 'Philadelphia 76ers', league: 'nba' },
  { name: 'Phoenix Suns', league: 'nba' },
  { name: 'Portland Trail Blazers', league: 'nba' },
  { name: 'Sacramento Kings', league: 'nba' },
  { name: 'San Antonio Spurs', league: 'nba' },
  { name: 'Toronto Raptors', league: 'nba' },
  { name: 'Utah Jazz', league: 'nba' },
  { name: 'Washington Wizards', league: 'nba' },
  { name: 'Anaheim Ducks', league: 'nhl' },
  { name: 'Boston Bruins', league: 'nhl' },
  { name: 'Buffalo Sabres', league: 'nhl' },
  { name: 'Calgary Flames', league: 'nhl' },
  { name: 'Carolina Hurricanes', league: 'nhl' },
  { name: 'Chicago Blackhawks', league: 'nhl' },
  { name: 'Colorado Avalanche', league: 'nhl' },
  { name: 'Columbus Blue Jackets', league: 'nhl' },
  { name: 'Dallas Stars', league: 'nhl' },
  { name: 'Detroit Red Wings', league: 'nhl' },
  { name: 'Edmonton Oilers', league: 'nhl' },
  { name: 'Florida Panthers', league: 'nhl' },
  { name: 'Los Angeles Kings', league: 'nhl' },
  { name: 'Minnesota Wild', league: 'nhl' },
  { name: 'Montreal Canadiens', league: 'nhl' },
  { name: 'Nashville Predators', league: 'nhl' },
  { name: 'New Jersey Devils', league: 'nhl' },
  { name: 'New York Islanders', league: 'nhl' },
  { name: 'New York Rangers', league: 'nhl' },
  { name: 'Ottawa Senators', league: 'nhl' },
  { name: 'Philadelphia Flyers', league: 'nhl' },
  { name: 'Pittsburgh Penguins', league: 'nhl' },
  { name: 'San Jose Sharks', league: 'nhl' },
  { name: 'Seattle Kraken', league: 'nhl' },
  { name: 'St. Louis Blues', league: 'nhl' },
  { name: 'Tampa Bay Lightning', league: 'nhl' },
  { name: 'Toronto Maple Leafs', league: 'nhl' },
  { name: 'Utah Mammoth', league: 'nhl' },
  { name: 'Vancouver Canucks', league: 'nhl' },
  { name: 'Vegas Golden Knights', league: 'nhl' },
  { name: 'Washington Capitals', league: 'nhl' },
  { name: 'Winnipeg Jets', league: 'nhl' },
  { name: 'Arizona Cardinals', league: 'nfl' },
  { name: 'Atlanta Falcons', league: 'nfl' },
  { name: 'Baltimore Ravens', league: 'nfl' },
  { name: 'Buffalo Bills', league: 'nfl' },
  { name: 'Carolina Panthers', league: 'nfl' },
  { name: 'Chicago Bears', league: 'nfl' },
  { name: 'Cincinnati Bengals', league: 'nfl' },
  { name: 'Cleveland Browns', league: 'nfl' },
  { name: 'Dallas Cowboys', league: 'nfl' },
  { name: 'Denver Broncos', league: 'nfl' },
  { name: 'Detroit Lions', league: 'nfl' },
  { name: 'Green Bay Packers', league: 'nfl' },
  { name: 'Houston Texans', league: 'nfl' },
  { name: 'Indianapolis Colts', league: 'nfl' },
  { name: 'Jacksonville Jaguars', league: 'nfl' },
  { name: 'Kansas City Chiefs', league: 'nfl' },
  { name: 'Las Vegas Raiders', league: 'nfl' },
  { name: 'Los Angeles Chargers', league: 'nfl' },
  { name: 'Los Angeles Rams', league: 'nfl' },
  { name: 'Miami Dolphins', league: 'nfl' },
  { name: 'Minnesota Vikings', league: 'nfl' },
  { name: 'New England Patriots', league: 'nfl' },
  { name: 'New Orleans Saints', league: 'nfl' },
  { name: 'New York Giants', league: 'nfl' },
  { name: 'New York Jets', league: 'nfl' },
  { name: 'Philadelphia Eagles', league: 'nfl' },
  { name: 'Pittsburgh Steelers', league: 'nfl' },
  { name: 'San Francisco 49ers', league: 'nfl' },
  { name: 'Seattle Seahawks', league: 'nfl' },
  { name: 'Tampa Bay Buccaneers', league: 'nfl' },
  { name: 'Tennessee Titans', league: 'nfl' },
  { name: 'Washington Commanders', league: 'nfl' },
  { name: 'Arizona Diamondbacks', league: 'mlb' },
  { name: 'Athletics', league: 'mlb' },
  { name: 'Atlanta Braves', league: 'mlb' },
  { name: 'Baltimore Orioles', league: 'mlb' },
  { name: 'Boston Red Sox', league: 'mlb' },
  { name: 'Chicago Cubs', league: 'mlb' },
  { name: 'Chicago White Sox', league: 'mlb' },
  { name: 'Cincinnati Reds', league: 'mlb' },
  { name: 'Cleveland Guardians', league: 'mlb' },
  { name: 'Colorado Rockies', league: 'mlb' },
  { name: 'Detroit Tigers', league: 'mlb' },
  { name: 'Houston Astros', league: 'mlb' },
  { name: 'Kansas City Royals', league: 'mlb' },
  { name: 'Los Angeles Angels', league: 'mlb' },
  { name: 'Los Angeles Dodgers', league: 'mlb' },
  { name: 'Miami Marlins', league: 'mlb' },
  { name: 'Milwaukee Brewers', league: 'mlb' },
  { name: 'Minnesota Twins', league: 'mlb' },
  { name: 'New York Mets', league: 'mlb' },
  { name: 'New York Yankees', league: 'mlb' },
  { name: 'Philadelphia Phillies', league: 'mlb' },
  { name: 'Pittsburgh Pirates', league: 'mlb' },
  { name: 'San Diego Padres', league: 'mlb' },
  { name: 'San Francisco Giants', league: 'mlb' },
  { name: 'Seattle Mariners', league: 'mlb' },
  { name: 'St. Louis Cardinals', league: 'mlb' },
  { name: 'Tampa Bay Rays', league: 'mlb' },
  { name: 'Texas Rangers', league: 'mlb' },
  { name: 'Toronto Blue Jays', league: 'mlb' },
  { name: 'Washington Nationals', league: 'mlb' },
  { name: 'Alpine', league: 'f1' },
  { name: 'Aston Martin', league: 'f1' },
  { name: 'Ferrari', league: 'f1' },
  { name: 'Haas', league: 'f1' },
  { name: 'McLaren', league: 'f1' },
  { name: 'Mercedes', league: 'f1' },
  { name: 'Racing Bulls', league: 'f1' },
  { name: 'Red Bull', league: 'f1' },
  { name: 'Williams', league: 'f1' },
  // PWHL
  { name: 'Boston Fleet', league: 'pwhl' },
  { name: 'Minnesota Frost', league: 'pwhl' },
  { name: 'Montréal Victoire', league: 'pwhl' },
  { name: 'New York Sirens', league: 'pwhl' },
  { name: 'Ottawa Charge', league: 'pwhl' },
  { name: 'Toronto Sceptres', league: 'pwhl' },
  { name: 'Seattle', league: 'pwhl' },
  { name: 'Vancouver', league: 'pwhl' },
  // LHJMQ
  { name: 'Acadie-Bathurst Titan', league: 'lhjmq' },
  { name: 'Baie-Comeau Drakkar', league: 'lhjmq' },
  { name: 'Blainville-Boisbriand Armada', league: 'lhjmq' },
  { name: 'Cape Breton Eagles', league: 'lhjmq' },
  { name: 'Charlottetown Islanders', league: 'lhjmq' },
  { name: 'Chicoutimi Saguenéens', league: 'lhjmq' },
  { name: 'Drummondville Voltigeurs', league: 'lhjmq' },
  { name: 'Gatineau Olympiques', league: 'lhjmq' },
  { name: 'Halifax Mooseheads', league: 'lhjmq' },
  { name: 'Moncton Wildcats', league: 'lhjmq' },
  { name: 'Québec Remparts', league: 'lhjmq' },
  { name: 'Rimouski Océanic', league: 'lhjmq' },
  { name: 'Rouyn-Noranda Huskies', league: 'lhjmq' },
  { name: 'Saint John Sea Dogs', league: 'lhjmq' },
  { name: 'Shawinigan Cataractes', league: 'lhjmq' },
  { name: 'Sherbrooke Phoenix', league: 'lhjmq' },
  { name: 'Val-d\'Or Foreurs', league: 'lhjmq' },
  { name: 'Victoriaville Tigres', league: 'lhjmq' },
  { name: 'Argentina', league: 'world cup' },
  { name: 'France', league: 'world cup' },
  { name: 'Brazil', league: 'world cup' },
  { name: 'England', league: 'world cup' },
  { name: 'Belgium', league: 'world cup' },
  { name: 'Croatia', league: 'world cup' },
  { name: 'Netherlands', league: 'world cup' },
  { name: 'Portugal', league: 'world cup' },
  { name: 'Spain', league: 'world cup' },
  { name: 'Italy', league: 'world cup' },
  { name: 'Germany', league: 'world cup' },
  { name: 'USA', league: 'world cup' },
  { name: 'Mexico', league: 'world cup' },
  { name: 'Canada', league: 'world cup' },
  { name: 'Japan', league: 'world cup' },
  { name: 'Morocco', league: 'world cup' },
  { name: 'Senegal', league: 'world cup' },
];
Object.assign(TEAM_COLORS, {
  'afc bournemouth': ['#f42727', '#0000CC'],
  'arsenal': ['#e20520', '#003399'],
  'aston villa': ['#660e36', '#333333'],
  'brentford': ['#f42727', '#f8ced9'],
  'brighton & hove albion': ['#0606fa', '#ffdd00'],
  'burnley': ['#6C1D45', '#00FFFF'],
  'chelsea': ['#144992', '#FFFFFF'],
  'crystal palace': ['#0202fb', '#ffdd00'],
  'everton': ['#0606fa', '#132257'],
  'fulham': ['#ffffff', '#00CC00'],
  'leeds united': ['#ffffff', '#0000FF'],
  'liverpool': ['#d11317', '#FFFFFF'],
  'manchester city': ['#99c5ea', '#000000'],
  'manchester united': ['#da020e', '#FFFFFF'],
  'newcastle united': ['#000000', '#ffffff'],
  'nottingham forest': ['#c8102e', '#132257'],
  'sunderland': ['#EB172B', '#87cced'],
  'tottenham hotspur': ['#ffffff', '#000000'],
  'west ham united': ['#7c2c3b', '#F1E7E0'],
  'wolverhampton wanderers': ['#fdb913', '#32A8DD'],
  'argentina': ['#43A1D5', '#ffffff'],
  'france': ['#002654', '#ed2939'],
  'brazil': ['#FEDF00', '#009b3a'],
  'england': ['#ffffff', '#cf081f'],
  'belgium': ['#e30613', '#000000'],
  'croatia': ['#ff0000', '#ffffff'],
  'netherlands': ['#f36c21', '#1e248b'],
  'portugal': ['#ff0000', '#006600'],
  'spain': ['#c60b1e', '#ffc400'],
  'italy': ['#0066cc', '#ffffff'],
  'germany': ['#000000', '#ffffff'],
  'usa': ['#002868', '#bf0a30'],
  'mexico': ['#006847', '#ce1126'],
  'canada': ['#ff0000', '#ffffff'],
  'japan': ['#00008b', '#ffffff'],
  'morocco': ['#c1272d', '#006233'],
  'senegal': ['#00853f', '#fdef42'],
  'acadie-bathurst titan': ['#b89947', '#aa1025'],
  'baie-comeau drakkar': ['#000000', '#fdb813'],
  'blainville-boisbriand armada': ['#000000', '#ffffff'],
  'cape breton eagles': ['#000000', '#fdb813'],
  'charlottetown islanders': ['#000000', '#cfab7a'],
  'chicoutimi saguenéens': ['#041e42', '#a2aaad'],
  'drummondville voltigeurs': ['#d31145', '#000000'],
  'gatineau olympiques': ['#000000', '#a2aaad'],
  'halifax mooseheads': ['#005a3b', '#cc181e'],
  'moncton wildcats': ['#041e42', '#cc181e'],
  'québec remparts': ['#cc181e', '#000000'],
  'rimouski océanic': ['#041e42', '#ffffff'],
  'rouyn-noranda huskies': ['#000000', '#cc181e'],
  'saint john sea dogs': ['#041e42', '#000000'],
  'shawinigan cataractes': ['#ffc80c', '#041e42'],
  'sherbrooke phoenix': ['#041e42', '#bba06b'],
  'val-d\'or foreurs': ['#005a3b', '#fdb813'],
  'victoriaville tigres': ['#000000', '#fdb813'],
  'boston fleet': ['#004732', '#000000'],
  'minnesota frost': ['#3a105a', '#ffffff'],
  'montréal victoire': ['#851c36', '#e0ded1'],
  'new york sirens': ['#1782a2', '#000000'],
  'ottawa charge': ['#c61234', '#ffb81c'],
  'toronto sceptres': ['#00205b', '#73c2ed'],
  'alavés': ['#0000ff', '#c3c3c3'],
  'athletic club': ['#C8142F', '#0000ff'],
  'atlético madrid': ['#ca3624', '#000099'],
  'barcelona': ['#990000', '#FCE38A'],
  'celta vigo': ['#6cace4', '#004996'],
  'elche': ['#ffffff', '#288A00'],
  'espanyol': ['#3366CC', '#C8142F'],
  'getafe': ['#0000ff', '#C8142F'],
  'girona': ['#C60000', '#004996'],
  'levante': ['#C8142F', '#000000'],
  'mallorca': ['#C8142F', '#ccff00'],
  'osasuna': ['#cd0000', '#ffffff'],
  'rayo vallecano': ['#ffffff', '#cd0000'],
  'real betis': ['#288A00', '#ccff00'],
  'real madrid': ['#ffffff', '#00529F'],
  'real oviedo': ['#000000', '#000000'],
  'real sociedad': ['#3366CC', '#ffdd00'],
  'sevilla': ['#ffffff', '#d81022'],
  'valencia': ['#ffffff', '#004996'],
  'villarreal': ['#ffff00', '#6cace4'],
  'ac milan': ['#e4002b', '#ffffff'],
  'as roma': ['#990a2c', '#eae9e7'],
  'atalanta': ['#1157bf', '#ffffff'],
  'bologna': ['#04043d', '#ffffff'],
  'cagliari': ['#282846', '#ffffff'],
  'como': ['#3933FF', '#FFFFFF'],
  'cremonese': ['#FF0000', '#ffffff'],
  'fiorentina': ['#4c1d84', '#ffffff'],
  'genoa': ['#08305d', '#ffffff'],
  'hellas verona': ['#00239c', '#ffffff'],
  'internazionale': ['#00239c', '#ffffff'],
  'juventus': ['#000000', '#ffef32'],
  'lazio': ['#74bde7', '#ffef32'],
  'lecce': ['#e4002b', '#08305d'],
  'napoli': ['#0677d2', '#ffffff'],
  'parma': ['#19161D', '#ffdd30'],
  'pisa': ['#1a1a1a', '#1a1a1a'],
  'sassuolo': ['#0fa653', '#000000'],
  'torino': ['#9f0000', '#ffffff'],
  'udinese': ['#19161D', '#ffef32'],
  '1. fc heidenheim 1846': ['#DA0308', '#003399'],
  '1. fc union berlin': ['#DA0308', '#d4d4d4'],
  'bayer leverkusen': ['#DA0308', '#f9fbfc'],
  'bayern munich': ['#dc052d', '#1a1a1a'],
  'borussia dortmund': ['#ffee00', '#272726'],
  'borussia mönchengladbach': ['#ffffff', '#03915c'],
  'eintracht frankfurt': ['#ffffff', '#272726'],
  'fc augsburg': ['#ffffff', '#03915c'],
  'fc cologne': ['#ffffff', '#DA0308'],
  'hamburg sv': ['#1a26af', '#1a1a1a'],
  'mainz': ['#DA0308', '#000055'],
  'rb leipzig': ['#ffffff', '#740c14'],
  'sc freiburg': ['#DA0308', '#ffffff'],
  'st. pauli': ['#442e23', '#ffffff'],
  'tsg hoffenheim': ['#003399', '#000055'],
  'vfb stuttgart': ['#ffffff', '#DA0308'],
  'vfl wolfsburg': ['#81f733', '#1a1a1a'],
  'werder bremen': ['#03915c', '#ffffff'],
  'aj auxerre': ['#ffffff', '#1a1a1a'],
  'as monaco': ['#E91514', '#004c37'],
  'angers': ['#1a1a1a', '#ffffff'],
  'brest': ['#ef2f24', '#ffffff'],
  'le havre ac': ['#011F68', '#ededed'],
  'lens': ['#E91514', '#004c37'],
  'lille': ['#c2051b', '#e2d3d7'],
  'lorient': ['#f46100', '#1a1a1a'],
  'lyon': ['#ffffff', '#1a1a1a'],
  'marseille': ['#ffffff', '#011F68'],
  'metz': ['#8C3140', '#e6c168'],
  'nantes': ['#ffff00', '#011F68'],
  'nice': ['#ef2f24', '#e2d3d7'],
  'paris fc': ['#000000', '#000000'],
  'paris saint-germain': ['#011F68', '#ffffff'],
  'stade rennais': ['#ef2f24', '#ffffff'],
  'strasbourg': ['#0000bf', '#ffffff'],
  'toulouse': ['#560080', '#ffff00'],
  'ajax amsterdam': ['#DF1B27', '#4d6286'],
  'benfica': ['#ca281d', '#1a1a1a'],
  'bodo/glimt': ['#FCEE33', '#ffffff'],
  'club brugge': ['#0081ff', '#ffffff'],
  'f.c. københavn': ['#ffffff', '#1a1a1a'],
  'fk qarabag': ['#000000', '#ffffff'],
  'galatasaray': ['#aa0031', '#ffffff'],
  'kairat almaty': ['#FCEE33', '#81c0ff'],
  'olympiacos': ['#d01729', '#0202fb'],
  'psv eindhoven': ['#ef2f24', '#000000'],
  'pafos': ['#82c0fe', '#003399'],
  'slavia prague': ['#dc1f26', '#81c0ff'],
  'sporting cp': ['#008127', '#ffffff'],
  'union st.-gilloise': ['#FCEE33', '#ffffff'],
  'braga': ['#de1f26', '#2b6a36'],
  'celtic': ['#009921', '#f9e900'],
  'dinamo zagreb': ['#0000bb', '#ccff00'],
  'fc basel': ['#C8142F', '#ffffff'],
  'fc midtjylland': ['#000000', '#ff0900'],
  'fc porto': ['#0000dd', '#ffa000'],
  'fc utrecht': ['#F31522', '#1a316b'],
  'fcsb': ['#0000dd', '#dc1f26'],
  'fenerbahce': ['#ffff00', '#ffffff'],
  'ferencvaros': ['#239B56', '#000000'],
  'feyenoord rotterdam': ['#ef2f24', '#000000'],
  'go ahead eagles': ['#F80017', '#8f0058'],
  'ludogorets razgrad': ['#008000', '#ffffff'],
  'maccabi tel-aviv': ['#ffff00', '#020202'],
  'malmö ff': ['#5699eb', '#052a87'],
  'paok salonika': ['#000000', '#ffffff'],
  'panathinaikos': ['#2b6a36', '#ffffff'],
  'rb salzburg': ['#d82c3a', '#052a87'],
  'racing genk': ['#0000ff', '#cccccc'],
  'rangers': ['#0046ff', '#ffffff'],
  'red star belgrade': ['#FF0000', '#0000dd'],
  'sk brann': ['#FF0000', '#32CD32'],
  'sk sturm graz': ['#ffffff', '#000000'],
  'viktoria plzen': ['#0000dd', '#000000'],
  'young boys': ['#ffdd00', '#FFFFFF'],
  'aek athens': ['#ffff00', '#000000'],
  'aek larnaca': ['#FDE100', '#008741'],
  'az alkmaar': ['#ef2f24', '#ffffff'],
  'aberdeen': ['#C8142F', '#f9e900'],
  'bk häcken': ['#000000', '#f7ee09'],
  'breidablik': ['#000000', '#000000'],
  'csu craiova': ['#000000', '#C60000'],
  'drita gjilan': ['#000000', '#C60000'],
  'dynamo kyiv': ['#ffffff', '#0000bf'],
  'fc noah': ['#000000', '#ffffff'],
  'hamrun spartans': ['#C60000', '#000000'],
  'jagiellonia bialystok': ['#000000', '#C60000'],
  'kf shkëndija': ['#E91514', '#000000'],
  'kups kuopio': ['#000000', '#000000'],
  'lausanne sports': ['#000099', '#C60000'],
  'lech poznan': ['#000000', '#000000'],
  'legia warsaw': ['#2b6a36', '#ffffff'],
  'lincoln red imps': ['#C60000', '#ffffff'],
  'nk celje': ['#000099', '#ff6600'],
  'omonia nicosia': ['#025719', '#ffffff'],
  'raków czestochowa': ['#EE2E24', '#164BA0'],
  'rapid vienna': ['#2b6a36', '#dc1f26'],
  'rijeka': ['#42BEFD', '#000000'],
  'samsunspor': ['#000000', '#C60000'],
  'shakhtar donetsk': ['#ff5900', '#1a1a1a'],
  'shamrock rovers': ['#288A00', '#000000'],
  'shelbourne': ['#000000', '#C60000'],
  'sigma olomouc': ['#000000', '#000000'],
  'slovan bratislava': ['#81c0ff', '#1a1a1a'],
  'sparta prague': ['#791b29', '#ffffff'],
  'zrinjski mostar': ['#000000', '#000000'],
  'atlanta united fc': ['#9d2235', '#aa9767'],
  'austin fc': ['#00b140', '#000000'],
  'cf montréal': ['#003da6', '#c1c5c8'],
  'charlotte fc': ['#0085ca', '#000000'],
  'chicago fire fc': ['#7ccdef', '#ff0000'],
  'colorado rapids': ['#8a2432', '#8ab7e9'],
  'columbus crew': ['#000000', '#fedd00'],
  'd.c. united': ['#000000', '#d61018'],
  'fc cincinnati': ['#003087', '#fe5000'],
  'fc dallas': ['#c6093b', '#001f5b'],
  'houston dynamo fc': ['#ff6b00', '#101820'],
  'inter miami cf': ['#231f20', '#f7b5cd'],
  'la galaxy': ['#00235d', '#ffffff'],
  'lafc': ['#000000', '#c7a36f'],
  'minnesota united fc': ['#000000', '#9bcde4'],
  'nashville sc': ['#ece83a', '#1f1646'],
  'new england revolution': ['#022166', '#ce0e2d'],
  'new york city fc': ['#9fd2ff', '#000229'],
  'orlando city sc': ['#60269e', '#f0d283'],
  'philadelphia union': ['#051f31', '#e0d0a6'],
  'portland timbers': ['#2c5234', '#c99700'],
  'real salt lake': ['#a32035', '#daa900'],
  'red bull new york': ['#ba0c2f', '#ffc72c'],
  'san diego fc': ['#697a7C', '#F89E1A'],
  'san jose earthquakes': ['#003da6', '#ffffff'],
  'seattle sounders fc': ['#2dc84d', '#0033a0'],
  'sporting kansas city': ['#a7c6ed', '#0a2240'],
  'st. louis city sc': ['#ec1458', '#001544'],
  'toronto fc': ['#aa182c', '#a2a9ad'],
  'vancouver whitecaps': ['#ffffff', '#12284c'],
  'excelsior': ['#000000', '#b41226'],
  'fc groningen': ['#ffffff', '#30565c'],
  'fc twente': ['#F31522', '#9df9f7'],
  'fc volendam': ['#F7AA25', '#9de1ff'],
  'fortuna sittard': ['#FCEE33', '#ffffff'],
  'heerenveen': ['#003eff', '#1a316b'],
  'heracles almelo': ['#000000', '#ffffff'],
  'nac breda': ['#FCEE33', '#ffffff'],
  'nec nijmegen': ['#ef2f24', '#84aee7'],
  'pec zwolle': ['#0000d4', '#000000'],
  'sparta rotterdam': ['#F31522', '#84aee7'],
  'telstar': ['#C60000', '#FCEE33'],
  'avs': ['#C60000', '#FFFFFF'],
  'alverca': ['#0047AB', '#C60000'],
  'arouca': ['#ffea01', '#293dc2'],
  'c.d. nacional': ['#000000', '#000099'],
  'casa pia': ['#000000', '#C60000'],
  'estoril': ['#ffea01', '#293dc2'],
  'estrela': ['#3B8132', '#DE0A26'],
  'fc famalicao': ['#FFFFFF', '#183760'],
  'gil vicente': ['#de1f26', '#FFFFFF'],
  'moreirense': ['#288A00', '#000000'],
  'rio ave': ['#3b8649', '#FF621A'],
  'santa clara': ['#C60000', '#ddbf64'],
  'tondela': ['#ffea01', '#293dc2'],
  'vitória de guimaraes': ['#ffffff', '#000000'],
  'albania': ['#E70000', '#ffffff'],
  'andorra': ['#E70000', '#0000cd'],
  'armenia': ['#DE2400', '#ffffff'],
  'austria': ['#d72b2c', '#ffffff'],
  'azerbaijan': ['#2D4AB0', '#ffffff'],
  'belarus': ['#ffffff', '#E70000'],
  'belgium': ['#ef3340', '#d7e9f6'],
  'bosnia-herzegovina': ['#112855', '#ffffff'],
  'bulgaria': ['#d62612', '#ffffff'],
  'croatia': ['#ff0000', '#0c2fff'],
  'cyprus': ['#195ccd', '#ffffff'],
  'czechia': ['#d7141a', '#ffffff'],
  'denmark': ['#d02a3e', '#ffffff'],
  'england': ['#ffffff', '#4a2942'],
  'estonia': ['#195ccd', '#ffffff'],
  'faroe islands': ['#ffffff', '#195ccd'],
  'finland': ['#003580', '#ffffff'],
  'france': ['#0c2fff', '#ffffff'],
  'georgia': ['#ffffff', '#4a2942'],
  'germany': ['#000000', '#db41a9'],
  'gibraltar': ['#DE2918', '#ffffff'],
  'greece': ['#295da8', '#ffffff'],
  'hungary': ['#ce2029', '#ffffff'],
  'iceland': ['#0c2fff', '#ffffff'],
  'israel': ['#2f4fa2', '#ffffff'],
  'italy': ['#103cd6', '#ffffff'],
  'kazakhstan': ['#00abc2', '#ffec2d'],
  'kosovo': ['#0000cd', '#ffec00'],
  'latvia': ['#992242', '#ffffff'],
  'liechtenstein': ['#0000cd', '#E70000'],
  'lithuania': ['#ffe400', '#DE2918'],
  'luxembourg': ['#E70000', '#ffffff'],
  'malta': ['#DE2400', '#ffffff'],
  'moldova': ['#0046ae', '#ffd200'],
  'montenegro': ['#E70000', '#ffffff'],
  'netherlands': ['#fb5d00', '#010080'],
  'north macedonia': ['#E70000', '#ddddea'],
  'northern ireland': ['#cc0000', '#ffffff'],
  'norway': ['#ef2b2d', '#002868'],
  'poland': ['#ffffff', '#dc143c'],
  'portugal': ['#da291c', '#d7e9f6'],
  'republic of ireland': ['#049a64', '#f58241'],
  'romania': ['#fcd116', '#ce1126'],
  'san marino': ['#00bfff', '#ffffff'],
  'scotland': ['#1a2d69', '#dcf5f7'],
  'serbia': ['#E70000', '#ffffff'],
  'slovakia': ['#0c2fff', '#ffffff'],
  'slovenia': ['#ffffff', '#0c2fff'],
  'spain': ['#c60b1e', '#f1ff91'],
  'sweden': ['#fecb00', '#006aa7'],
  'switzerland': ['#d72b2c', '#ffffff'],
  'türkiye': ['#ffffff', '#ef3340'],
  'ukraine': ['#fede00', '#0c2fff'],
  'wales': ['#E70000', '#174A3F'],
  'afc telford united': ['#000000', '#FFFFFF'],
  'afc totton': ['#000000', '#000000'],
  'afc wimbledon': ['#0000d4', '#ffff00'],
  'accrington stanley': ['#C8142F', '#5CBFEB'],
  'aldershot town': ['#C8142F', '#cdff00'],
  'altrincham': ['#C8142F', '#cdcdcd'],
  'barnet': ['#fe7a00', '#ffffff'],
  'barnsley': ['#f42727', '#065035'],
  'barrow': ['#ffffff', '#deb887'],
  'birmingham city': ['#0000fa', '#fe5442'],
  'blackburn rovers': ['#0000fa', '#1a1a1a'],
  'blackpool': ['#F5A12D', '#ffffff'],
  'bolton wanderers': ['#ffffff', '#1a1a1a'],
  'boreham wood': ['#ffffff', '#aeeaff'],
  'brackley town': ['#C60000', '#ffff00'],
  'bradford city': ['#890000', '#ffffff'],
  'braintree town': ['#FF6600', '#000099'],
  'bristol city': ['#f42727', '#ffffff'],
  'bristol rovers': ['#000099', '#425679'],
  'bromley': ['#ffffff', '#C60000'],
  'burton albion': ['#ffff00', '#ffffff'],
  'buxton': ['#000080', '#964B00'],
  'cambridge united': ['#FECD32', '#82dbf5'],
  'cardiff city': ['#0000fa', '#c6d4db'],
  'carlisle united': ['#0e00f7', '#b0ffe1'],
  'charlton athletic': ['#C8142F', '#020202'],
  'chatham town': ['#C60000', '#ffffff'],
  'chelmsford': ['#800000', '#FFFFFF'],
  'cheltenham town': ['#C8142F', '#82dbf5'],
  'chester fc': ['#2D55B7', '#C60000'],
  'chesterfield': ['#000099', '#1a1a1a'],
  'colchester united': ['#0e00f7', '#1a1a1a'],
  'coventry city': ['#87cced', '#ffffff'],
  'crawley town': ['#C8142F', '#ffffff'],
  'crewe alexandra': ['#C8142F', '#FECD32'],
  'derby county': ['#ffffff', '#abebc5'],
  'doncaster rovers': ['#C8142F', '#000099'],
  'eastleigh': ['#0000FF', '#e1e1e1'],
  'ebbsfleet united': ['#C8142F', '#0000FF'],
  'exeter city': ['#C8142F', '#ffff00'],
  'fc halifax town': ['#0000FF', '#b9ff4d'],
  'fleetwood town': ['#C8142F', '#ffff00'],
  'forest green rovers': ['#aeff2b', '#1a1a1a'],
  'gainsborough trinity': ['#000000', '#C60000'],
  'gateshead': ['#ffffff', '#00fa9a'],
  'gillingham': ['#000099', '#C60000'],
  'grimsby town': ['#1a1a1a', '#0e00f7'],
  'harrogate town': ['#ffff00', '#aeeaff'],
  'hemel hempstead town': ['#000000', '#000000'],
  'huddersfield town': ['#0074d0', '#f4e874'],
  'hull city': ['#f28800', '#ffffff'],
  'ipswich town': ['#0000fa', '#cd1937'],
  'leicester city': ['#0202fb', '#000000'],
  'leyton orient': ['#C8142F', '#0e00f7'],
  'lincoln city': ['#C8142F', '#c6d4db'],
  'luton town': ['#ff4f00', '#1D428A'],
  'macclesfield fc': ['#01153E', '#ffffff'],
  'maldon & tiptree': ['#C60000', '#FECD32'],
  'mansfield town': ['#FECD32', '#1a1a1a'],
  'middlesbrough': ['#f42727', '#87cced'],
  'millwall': ['#091453', '#007066'],
  'milton keynes dons': ['#ffffff', '#ff4f00'],
  'newport county': ['#FECD32', '#cdcdcd'],
  'northampton town': ['#8E003B', '#1a1a1a'],
  'norwich city': ['#ffff00', '#1D428A'],
  'notts county': ['#1a1a1a', '#378464'],
  'oldham athletic': ['#0e00f7', '#F7AA25'],
  'oxford united': ['#ffff00', '#ffffff'],
  'peterborough united': ['#0000fa', '#ebebeb'],
  'plymouth argyle': ['#003e00', '#ffffff'],
  'port vale': ['#ffffff', '#FECD32'],
  'portsmouth': ['#0000fa', '#1a1a1a'],
  'preston north end': ['#ffffff', '#87cced'],
  'queens park rangers': ['#0000d4', '#1a1a1a'],
  'reading': ['#0000fa', '#e4c8de'],
  'rotherham united': ['#f42727', '#1a1a1a'],
  'salford city': ['#C8142F', '#ffffff'],
  'scunthorpe united': ['#82dbf5', '#228b22'],
  'sheffield united': ['#f42727', '#1D428A'],
  'sheffield wednesday': ['#0000ff', '#ff4f00'],
  'shrewsbury town': ['#0000fa', '#29088a'],
  'slough town': ['#000000', '#000000'],
  'south shields': ['#000000', '#C60000'],
  'southampton': ['#ED1A3B', '#f1ee13'],
  'southend united': ['#000099', '#ffde00'],
  'spennymoor town': ['#000000', '#C60000'],
  'st albans city': ['#000000', '#C60000'],
  'stevenage': ['#ffffff', '#091453'],
  'stockport county': ['#0000FF', '#ffffff'],
  'stoke city': ['#f42727', '#1a1a1a'],
  'sutton united': ['#ffd700', '#ffffff'],
  'swansea city': ['#ffffff', '#1D428A'],
  'swindon town': ['#C8142F', '#cdcdcd'],
  'tamworth': ['#C8142F', '#000000'],
  'tranmere rovers': ['#ffffff', '#4c00b3'],
  'walsall': ['#C8142F', '#74f544'],
  'watford': ['#ffff00', '#1D428A'],
  'wealdstone': ['#000000', '#000000'],
  'west bromwich albion': ['#091453', '#ffff00'],
  'weston-super-mare': ['#000000', '#C60000'],
  'wigan athletic': ['#0000fa', '#1a1a1a'],
  'wrexham': ['#C8142F', '#ffffff'],
  'wycombe wanderers': ['#4cb8e5', '#ffff00'],
  'york city': ['#C8142F', '#C60000'],
  'albacete': ['#BC0814', '#C60000'],
  'alberite': ['#000000', '#C60000'],
  'alcalá': ['#000000', '#C60000'],
  'almería': ['#C8142F', '#1a1a1a'],
  'antequera cf': ['#000000', '#C60000'],
  'arenas club': ['#000000', '#C60000'],
  'atletico astorga': ['#000000', '#C60000'],
  'atlètic lleida': ['#000000', '#C60000'],
  'atlètic sant just': ['#000000', '#C60000'],
  'atlético baleares': ['#000000', '#C60000'],
  'atlético calatayud': ['#000000', '#C60000'],
  'atlético melilla': ['#000000', '#C60000'],
  'atlético tordesillas': ['#000000', '#C60000'],
  'azuaga': ['#000000', '#C60000'],
  'betis cf': ['#000000', '#C60000'],
  'burgos': ['#000000', '#C60000'],
  'cd artistico navalcarnero': ['#000000', '#C60000'],
  'cd ebro': ['#000000', '#C60000'],
  'cd estepona': ['#000000', '#C60000'],
  'cd extremadura': ['#000000', '#C60000'],
  'cd guadalajara': ['#000000', '#C60000'],
  'cd sabadell': ['#000000', '#C60000'],
  'ce europa': ['#000000', '#C60000'],
  'ce sant jordi': ['#000000', '#C60000'],
  'cacereno': ['#000000', '#000000'],
  'campanario': ['#000000', '#C60000'],
  'castellón': ['#000000', '#000000'],
  'caudal deportivo': ['#000000', '#000000'],
  'ceuta': ['#000000', '#000000'],
  'cieza': ['#000000', '#C60000'],
  'club atlético antoniano': ['#000000', '#C60000'],
  'constancia': ['#000000', '#C60000'],
  'cultural leonesa': ['#000000', '#C60000'],
  'cádiz': ['#ffff00', '#1a1a1a'],
  'córdoba': ['#288A00', '#1a1a1a'],
  'deportivo la coruña': ['#3366CC', '#b9e8f0'],
  'egüés': ['#000000', '#C60000'],
  'eibar': ['#c00000', '#000099'],
  'eldense': ['#000000', '#C60000'],
  'fc andorra': ['#000000', '#C60000'],
  'fc cartagena': ['#000000', '#000000'],
  'getxo': ['#000000', '#C60000'],
  'gimnàstic de tarragona': ['#EF2000', '#000000'],
  'granada': ['#C8142F', '#3366CC'],
  'huesca': ['#000099', '#C60000'],
  'inter de valdemoro': ['#000000', '#C60000'],
  'juventud torremolinos': ['#000000', '#C60000'],
  'la unión atlético': ['#000000', '#C60000'],
  'langreo': ['#000000', '#C60000'],
  'las palmas': ['#ffff00', '#3366CC'],
  'leganés': ['#6cace4', '#32cd32'],
  'lorca deportiva': ['#000000', '#C60000'],
  'lourdes': ['#000000', '#C60000'],
  'lucena cf': ['#000000', '#C60000'],
  'manises cf': ['#000000', '#C60000'],
  'maracena': ['#000000', '#C60000'],
  'mirandés': ['#000000', '#C60000'],
  'mutilvera': ['#000000', '#C60000'],
  'málaga': ['#b9e8f0', '#ffff00'],
  'mérida': ['#000000', '#C60000'],
  'naxara': ['#000000', '#C60000'],
  'negreira': ['#000000', '#C60000'],
  'numancia': ['#C42A32', '#1a1a1a'],
  'orihuela': ['#000000', '#000000'],
  'ourense cf': ['#000000', '#C60000'],
  'palma del río': ['#000000', '#C60000'],
  'poblense': ['#000000', '#C60000'],
  'ponferradina': ['#000000', '#000000'],
  'pontevedra': ['#000000', '#000000'],
  'portugalete': ['#000000', '#000000'],
  'puente genil': ['#000000', '#C60000'],
  'puerto de vega': ['#000000', '#C60000'],
  'quintanar del rey': ['#000000', '#C60000'],
  'racing ferrol': ['#000000', '#000000'],
  'racing santander': ['#3B6C1A', '#0EB214'],
  'rayo majadahonda': ['#000000', '#000000'],
  'real aviles industrial': ['#000000', '#000000'],
  'real jaen cf': ['#000000', '#000000'],
  'real murcia': ['#C8142F', '#C8142F'],
  'real valladolid': ['#7a2d9d', '#ffffff'],
  'real zaragoza': ['#000099', '#1a1a1a'],
  'real ávila': ['#000000', '#C60000'],
  'reddis': ['#000000', '#C60000'],
  'roda': ['#000000', '#C60000'],
  'sd logroñés': ['#000000', '#C60000'],
  'sant andreu': ['#000000', '#000000'],
  'sporting ceuta': ['#000000', '#C60000'],
  'sporting gijón': ['#C8142F', '#1a1a1a'],
  'sámano': ['#000000', '#C60000'],
  'talavera': ['#000000', '#000000'],
  'tarazona': ['#000000', '#000000'],
  'tenerife': ['#008bc4', '#1a1a1a'],
  'teruel': ['#000000', '#C60000'],
  'textil escudo': ['#000000', '#C60000'],
  'torrent': ['#000000', '#C60000'],
  'tropezón': ['#000000', '#C60000'],
  'ucam murcia': ['#000000', '#C60000'],
  'ud ibiza': ['#000000', '#C60000'],
  'ud logroñés': ['#C60000', '#000000'],
  'ud ourense': ['#000000', '#C60000'],
  'ud san fernando': ['#000000', '#C60000'],
  'universitario fc': ['#000000', '#C60000'],
  'unión deportiva los garres': ['#000000', '#C60000'],
  'utebo': ['#000000', '#C60000'],
  'yuncos': ['#000000', '#C60000'],
  'as le gosier': ['#00008B', '#C60000'],
  'as nancy lorraine': ['#ef2f24', '#0000bf'],
  'arcachon': ['#000000', '#C60000'],
  'avranches': ['#000000', '#000000'],
  'bastia': ['#0000bf', '#fafafc'],
  'bayeux': ['#000000', '#C60000'],
  'biesheim': ['#000000', '#C60000'],
  'blois foot 41': ['#000000', '#C60000'],
  'bordeaux': ['#011F68', '#ffffff'],
  'bourg-peronnas': ['#000000', '#C60000'],
  'canet roussillon fc': ['#000000', '#C60000'],
  'chantilly': ['#000000', '#C60000'],
  'concarneau': ['#000000', '#000000'],
  'dieppe': ['#000000', '#C60000'],
  'dunkerque': ['#005a9c', '#000000'],
  'fc freyming': ['#FFAC1C', '#000000'],
  'fc istres': ['#452BB3', '#C60000'],
  'fc périgny': ['#000000', '#C60000'],
  'feignies': ['#000000', '#000000'],
  'fontenay foot': ['#000000', '#C60000'],
  'gsi pontivy': ['#000000', '#C60000'],
  'grenoble': ['#005da3', '#000000'],
  'guingamp': ['#ef2f24', '#1a1a1a'],
  'hauts lyonnais': ['#000000', '#C60000'],
  'ic croix': ['#000000', '#C60000'],
  'le mans': ['#d62b11', '#d62b11'],
  'le puy': ['#000000', '#C60000'],
  'les herbiers': ['#000000', '#C60000'],
  'les sables': ['#00008B', '#C60000'],
  'lyon-duchère': ['#000000', '#C60000'],
  'montpellier': ['#011F68', '#ffffff'],
  'montreuil fc': ['#4cbb17', '#000000'],
  'olympique marcquois': ['#000000', '#C60000'],
  'orléans': ['#000000', '#C60000'],
  'raon-l\'etape': ['#000000', '#C60000'],
  'sc amiens': ['#ffffff', '#1a1a1a'],
  'saint-cyr collonges': ['#000000', '#C60000'],
  'saint-étienne': ['#51cc5f', '#ffffff'],
  'sochaux': ['#ffff00', '#000040'],
  'sport athlétique mérignacais': ['#000000', '#C60000'],
  'stade béthunois': ['#000000', '#C60000'],
  'stade laval': ['#1a1a1a', '#1a1a1a'],
  'stade de reims': ['#ef2f24', '#0000bf'],
  'tbd away': ['#000000', '#C60000'],
  'troyes': ['#0000bf', '#fafafc'],
  'us chauvigny': ['#000000', '#C60000'],
  'us lusitanos saint-maur': ['#000000', '#C60000'],
  '1. fc lokomotive leipzig': ['#000000', '#C60000'],
  '1. fc magdeburg': ['#0068B2', '#ffffff'],
  '1. fc nürnberg': ['#9f0000', '#1a1a1a'],
  '1. fc schweinfurt 05': ['#000000', '#C60000'],
  'arminia bielefeld': ['#00599f', '#2c2d37'],
  'bfc dynamo berlin': ['#000000', '#C60000'],
  'bahlinger sc 1929': ['#000000', '#000000'],
  'dynamo dresden': ['#f2a71d', '#962807'],
  'energie cottbus': ['#cc0000', '#ffff00'],
  'fc 08 homburg': ['#000000', '#000000'],
  'fc eintracht norderstedt': ['#000000', '#C60000'],
  'fc gütersloh 2000': ['#000000', '#C60000'],
  'fk pirmasens': ['#000000', '#000000'],
  'fv engers 07': ['#000000', '#C60000'],
  'fv illertissen': ['#000000', '#C60000'],
  'fortuna düsseldorf': ['#ffffff', '#1a1a1a'],
  'hallescher fc': ['#1a1a1a', '#1a1a1a'],
  'hannover 96': ['#179D33', '#1a1a1a'],
  'hansa rostock': ['#324CBA', '#C60000'],
  'hemelingen': ['#000000', '#C60000'],
  'hertha berlin': ['#0000dd', '#091453'],
  'holstein kiel': ['#0754ba', '#f9fbfc'],
  'kaiserslautern': ['#8C273D', '#1a1a1a'],
  'karlsruher sc': ['#2563B8', '#2563B8'],
  'lohne': ['#000000', '#C60000'],
  'preußen münster': ['#000000', '#C60000'],
  'rsv eintracht': ['#000000', '#C60000'],
  'rot-weiss essen': ['#000000', '#C60000'],
  'sc paderborn 07': ['#0000dd', '#ffffff'],
  'sg sonnenhof großaspach': ['#000000', '#000000'],
  'ssv jahn regensburg': ['#ce1b0e', '#f9f9f9'],
  'ssv ulm 1846': ['#000000', '#C60000'],
  'sv 07 elversberg': ['#000000', '#C60000'],
  'sv atlas delmenhorst': ['#000000', '#C60000'],
  'sv darmstadt 98': ['#003399', '#fafafc'],
  'sv sandhausen': ['#1a1a1a', '#fafafc'],
  'sv wehen wiesbaden': ['#000000', '#000000'],
  'saarbrücken': ['#000000', '#C60000'],
  'schalke 04': ['#0000dd', '#ffffff'],
  'spvgg greuther fürth': ['#288A00', '#1a1a1a'],
  'sportfreunde lotte': ['#0000dd', '#0000dd'],
  'tsv eintracht braunschweig': ['#ffde16', '#1a1a1a'],
  'vfb lübeck': ['#000000', '#C60000'],
  'vfl bochum': ['#000055', '#aac4f2'],
  'viktoria köln': ['#000000', '#C60000'],
  'zfc meuselwitz': ['#000000', '#000000'],
  'al ahli': ['#078543', '#193b67'],
  'al ettifaq': ['#00b32c', '#E40010'],
  'al fateh': ['#26ba09', '#0999ba'],
  'al fayha': ['#fa8228', '#0000FF'],
  'al hazem': ['#ffd700', '#cccccc'],
  'al hilal': ['#1c31ce', '#e3e4ed'],
  'al ittihad': ['#ffff00', '#000000'],
  'al khaleej': ['#196F3D', '#FFEE58'],
  'al kholood': ['#008000', '#C60000'],
  'al najma': ['#015617', '#000000'],
  'al nassr': ['#f7f316', '#1c31ce'],
  'al okhdood': ['#87CEEB', '#000000'],
  'al qadsiah': ['#ffd700', '#C60000'],
  'al riyadh': ['#000000', '#C60000'],
  'al shabab': ['#FFAC1C', '#ffffff'],
  'al taawoun': ['#eef209', '#000000'],
  'damac': ['#C60000', '#FFBF00'],
  'neom sc': ['#259EEE', '#FF9300'],
  'atlanta hawks': ['#c8102e', '#fdb927'],
  'boston celtics': ['#008348', '#ffffff'],
  'brooklyn nets': ['#000000', '#ffffff'],
  'charlotte hornets': ['#008ca8', '#1d1060'],
  'chicago bulls': ['#ce1141', '#000000'],
  'cleveland cavaliers': ['#860038', '#bc945c'],
  'dallas mavericks': ['#0064b1', '#bbc4ca'],
  'denver nuggets': ['#0e2240', '#fec524'],
  'detroit pistons': ['#1d428a', '#c8102e'],
  'golden state warriors': ['#fdb927', '#1d428a'],
  'houston rockets': ['#ce1141', '#000000'],
  'indiana pacers': ['#0c2340', '#ffd520'],
  'la clippers': ['#12173f', '#c8102e'],
  'los angeles lakers': ['#552583', '#fdb927'],
  'memphis grizzlies': ['#5d76a9', '#12173f'],
  'miami heat': ['#98002e', '#000000'],
  'milwaukee bucks': ['#00471b', '#eee1c6'],
  'minnesota timberwolves': ['#266092', '#79bc43'],
  'new orleans pelicans': ['#0a2240', '#b4975a'],
  'new york knicks': ['#1d428a', '#f58426'],
  'oklahoma city thunder': ['#007ac1', '#ef3b24'],
  'orlando magic': ['#0150b5', '#9ca0a3'],
  'philadelphia 76ers': ['#1d428a', '#e01234'],
  'phoenix suns': ['#29127a', '#e56020'],
  'portland trail blazers': ['#e03a3e', '#000000'],
  'sacramento kings': ['#5a2d81', '#6a7a82'],
  'san antonio spurs': ['#000000', '#c4ced4'],
  'toronto raptors': ['#d91244', '#000000'],
  'utah jazz': ['#4e008e', '#79a3dc'],
  'washington wizards': ['#e31837', '#002b5c'],
  'anaheim ducks': ['#fc4c02', '#000000'],
  'boston bruins': ['#231f20', '#fdb71a'],
  'buffalo sabres': ['#00468b', '#fdb71a'],
  'calgary flames': ['#dd1a32', '#000000'],
  'carolina hurricanes': ['#e30426', '#000000'],
  'chicago blackhawks': ['#e31937', '#000000'],
  'colorado avalanche': ['#860038', '#005ea3'],
  'columbus blue jackets': ['#002d62', '#e31937'],
  'dallas stars': ['#20864c', '#000000'],
  'detroit red wings': ['#e30526', '#ffffff'],
  'edmonton oilers': ['#00205b', '#ff4c00'],
  'florida panthers': ['#e51937', '#002d62'],
  'los angeles kings': ['#121212', '#a2aaad'],
  'minnesota wild': ['#124734', '#ae122a'],
  'montreal canadiens': ['#c41230', '#013a81'],
  'nashville predators': ['#fdba31', '#002d62'],
  'new jersey devils': ['#e30b2b', '#000000'],
  'new york islanders': ['#00529b', '#f47d31'],
  'new york rangers': ['#0056ae', '#e51937'],
  'ottawa senators': ['#dd1a32', '#b79257'],
  'philadelphia flyers': ['#fe5823', '#000000'],
  'pittsburgh penguins': ['#000000', '#fdb71a'],
  'san jose sharks': ['#00788a', '#070707'],
  'seattle kraken': ['#000d33', '#a3dce4'],
  'st. louis blues': ['#0070b9', '#fdb71a'],
  'tampa bay lightning': ['#003e7e', '#ffffff'],
  'toronto maple leafs': ['#003e7e', '#ffffff'],
  'utah mammoth': ['#000000', '#7ab2e1'],
  'vancouver canucks': ['#003e7e', '#008752'],
  'vegas golden knights': ['#344043', '#b4975a'],
  'washington capitals': ['#d71830', '#0b1f41'],
  'winnipeg jets': ['#002d62', '#c41230'],
  'arizona cardinals': ['#a40227', '#ffffff'],
  'atlanta falcons': ['#a71930', '#000000'],
  'baltimore ravens': ['#29126f', '#000000'],
  'buffalo bills': ['#00338d', '#d50a0a'],
  'carolina panthers': ['#0085ca', '#000000'],
  'chicago bears': ['#0b1c3a', '#e64100'],
  'cincinnati bengals': ['#fb4f14', '#000000'],
  'cleveland browns': ['#472a08', '#ff3c00'],
  'dallas cowboys': ['#002a5c', '#b0b7bc'],
  'denver broncos': ['#0a2343', '#fc4c02'],
  'detroit lions': ['#0076b6', '#bbbbbb'],
  'green bay packers': ['#204e32', '#ffb612'],
  'houston texans': ['#00143f', '#c41230'],
  'indianapolis colts': ['#003b75', '#ffffff'],
  'jacksonville jaguars': ['#007487', '#d7a22a'],
  'kansas city chiefs': ['#e31837', '#ffb612'],
  'las vegas raiders': ['#000000', '#a5acaf'],
  'los angeles chargers': ['#0080c6', '#ffc20e'],
  'los angeles rams': ['#003594', '#ffd100'],
  'miami dolphins': ['#008e97', '#fc4c02'],
  'minnesota vikings': ['#4f2683', '#ffc62f'],
  'new england patriots': ['#002a5c', '#c60c30'],
  'new orleans saints': ['#d3bc8d', '#000000'],
  'new york giants': ['#003c7f', '#c9243f'],
  'new york jets': ['#115740', '#ffffff'],
  'philadelphia eagles': ['#06424d', '#000000'],
  'pittsburgh steelers': ['#000000', '#ffb612'],
  'san francisco 49ers': ['#aa0000', '#b3995d'],
  'seattle seahawks': ['#002a5c', '#69be28'],
  'tampa bay buccaneers': ['#bd1c36', '#3e3a35'],
  'tennessee titans': ['#4495d2', '#001532'],
  'washington commanders': ['#5a1414', '#ffb612'],
  'arizona diamondbacks': ['#aa182c', '#000000'],
  'athletics': ['#003831', '#efb21e'],
  'atlanta braves': ['#0c2340', '#ba0c2f'],
  'baltimore orioles': ['#df4601', '#000000'],
  'boston red sox': ['#0d2b56', '#bd3039'],
  'chicago cubs': ['#0e3386', '#cc3433'],
  'chicago white sox': ['#000000', '#c4ced4'],
  'cincinnati reds': ['#c6011f', '#ffffff'],
  'cleveland guardians': ['#002b5c', '#e31937'],
  'colorado rockies': ['#33006f', '#000000'],
  'detroit tigers': ['#0a2240', '#ff4713'],
  'houston astros': ['#002d62', '#eb6e1f'],
  'kansas city royals': ['#004687', '#7ab2dd'],
  'los angeles angels': ['#ba0021', '#c4ced4'],
  'los angeles dodgers': ['#005a9c', '#ffffff'],
  'miami marlins': ['#00a3e0', '#000000'],
  'milwaukee brewers': ['#13294b', '#ffc72c'],
  'minnesota twins': ['#031f40', '#e20e32'],
  'new york mets': ['#002d72', '#ff5910'],
  'new york yankees': ['#132448', '#c4ced4'],
  'philadelphia phillies': ['#e81828', '#003278'],
  'pittsburgh pirates': ['#000000', '#fdb827'],
  'san diego padres': ['#2f241d', '#ffc425'],
  'san francisco giants': ['#000000', '#fd5a1e'],
  'seattle mariners': ['#005c5c', '#0c2c56'],
  'st. louis cardinals': ['#be0a14', '#001541'],
  'tampa bay rays': ['#092c5c', '#8fbce6'],
  'texas rangers': ['#003278', '#c0111f'],
  'toronto blue jays': ['#134a8e', '#6cace5'],
  'washington nationals': ['#ab0003', '#11225b'],
  'alpine': ['#FFF500', '#ffffff'],
  'aston martin': ['#006F62', '#ffffff'],
  'ferrari': ['#DC0000', '#ffffff'],
  'haas': ['#5A5A5A', '#ffffff'],
  'mclaren': ['#FF8700', '#ffffff'],
  'mercedes': ['#00D2BE', '#ffffff'],
  'racing bulls': ['#6692FF', '#ffffff'],
  'red bull': ['#00327D', '#ffffff'],
  'williams': ['#FFFFFF', '#ffffff'],
  // PWHL Colors
  'boston fleet': ['#1B4332', '#B9E28C'],
  'minnesota frost': ['#3B225D', '#9A85B8'],
  'montréal victoire': ['#6C1A31', '#E3C1B4'],
  'new york sirens': ['#195861', '#ECA921'],
  'ottawa charge': ['#C2002F', '#FFC107'],
  'toronto sceptres': ['#0033A0', '#FFC72C'],
  'seattle': ['#00314A', '#7EC3E4'],
  'vancouver': ['#450849', '#EC145A'],
  // LHJMQ Colors
  'acadie-bathurst titan': ['#D0202E', '#F6B221'],
  'baie-comeau drakkar': ['#D51820', '#FFCD00'],
  'blainville-boisbriand armada': ['#000000', '#FFFFFF'],
  'cape breton eagles': ['#000000', '#FDBA31'],
  'charlottetown islanders': ['#000000', '#C4A052'],
  'chicoutimi saguenéens': ['#002147', '#A0C6EB'],
  'drummondville voltigeurs': ['#E31837', '#000000'],
  'gatineau olympiques': ['#000000', '#B0B2B5'],
  'halifax mooseheads': ['#004C2E', '#CF152D'],
  'moncton wildcats': ['#000000', '#F2A900'],
  'québec remparts': ['#E31837', '#000000'],
  'rimouski océanic': ['#00205B', '#FFFFFF'],
  'rouyn-noranda huskies': ['#C8102E', '#000000'],
  'saint john sea dogs': ['#003E7E', '#000000'],
  'shawinigan cataractes': ['#003A70', '#FFC72C'],
  'sherbrooke phoenix': ['#002D62', '#E4B61C'],
  'val-d\'or foreurs': ['#00573F', '#FFC72C'],
  'victoriaville tigres': ['#000000', '#FFD100'],
  // Missing Teams Colors
  'toledo': ['#009A44', '#FFFFFF'],

});

function getTeamColors(teamName) {
    if (!teamName) return ['#333333', '#ffffff']; // Fallback absolu
    var norm = normName(teamName);
    for (var key in TEAM_COLORS) {
        var normKey = normName(key);
        if (norm === normKey || norm.includes(normKey) || normKey.includes(norm)) {
            return TEAM_COLORS[key];
        }
    }
    // Génération pseudo-aléatoire basée sur le nom si aucune couleur trouvée
    var hash = 0;
    for (var i = 0; i < norm.length; i++) hash = norm.charCodeAt(i) + ((hash << 5) - hash);
    var hue = Math.abs(hash % 360);
    return ['hsl('+hue+', 60%, 30%)', '#ffffff'];
}

var TEAM_ALIASES = {
  'montreal victoire': 'montréal victoire',
  'canadeins': 'montreal canadiens',
  'wild': 'minnesota wild',
  'tb': 'tampa bay lightning',
  'tampa bay': 'tampa bay lightning',
  'lightning': 'tampa bay lightning',
  'sabres': 'buffalo sabres',
  'bruins': 'boston bruins',
  'habs': 'montreal canadiens',
  'nyr': 'new york rangers',
  'nyi': 'new york islanders',
  'lak': 'los angeles kings',
  'sjs': 'san jose sharks',
  'njd': 'new jersey devils',
  'phi': 'philadelphia flyers',
  'pit': 'pittsburgh penguins',
  'wsh': 'washington capitals',
  'wpg': 'winnipeg jets',
  'cgy': 'calgary flames',
  'edm': 'edmonton oilers',
  'van': 'vancouver canucks',
  'tor': 'toronto maple leafs',
  'ott': 'ottawa senators',
  'mtl': 'montreal canadiens',
  // Common Sports general
  'psg': 'parissaintgermain',
  'paris sg': 'parissaintgermain',
  'bayern': 'bayernmunich',
  'munchen': 'bayernmunich',
  'bayern munchen': 'bayernmunich',
  // Soccer - France
  'psg': 'parissaintgermain',
  'paris sg': 'parissaintgermain',
  'om': 'olympique marseille',
  'marseille': 'olympique marseille',
  'ol': 'olympique lyonnais',
  'lyon': 'olympique lyonnais',
  'asse': 'saint etienne',
  'lille osc': 'lille',
  'losca lille': 'lille',

  // Soccer - England
  'man utd': 'manchester united',
  'man united': 'manchester united',
  'man city': 'manchester city',
  'spurs': 'tottenham',
  'tottenham hotspur': 'tottenham',
  'wolves': 'wolverhampton',
  'wolverhampton wanderers': 'wolverhampton',
  'nottm forest': 'nottingham forest',
  'newcastle': 'newcastle united',

  // Soccer - Spain
  'real': 'real madrid',
  'barca': 'barcelona',
  'fc barcelona': 'barcelona',
  'atletico': 'atletico madrid',
  'atl madrid': 'atletico madrid',

  // Soccer - Italy/Germany
  'juve': 'juventus',
  'inter': 'inter milan',
  'internazionale': 'inter milan',
  'ac milan': 'milan',
  'bayern': 'bayern munich',
  'bayer': 'bayer leverkusen',
  'bvb': 'borussia dortmund',
  'dortmund': 'borussia dortmund',

  // NHL
  'habs': 'montreal canadiens',
  'canadiens de montreal': 'montreal canadiens',
  'avs': 'colorado avalanche',
  'caps': 'washington capitals',
  'pens': 'pittsburgh penguins',
  'preds': 'nashville predators',
  'canes': 'carolina hurricanes',
  'jackets': 'columbus blue jackets',
  'leafs': 'toronto maple leafs',
  'wings': 'detroit red wings',

  // NBA
  'cavs': 'cleveland cavaliers',
  'mavs': 'dallas mavericks',
  't-wolves': 'minnesota timberwolves',
  'timberwolves': 'minnesota timberwolves',
  'blazers': 'portland trail blazers',
  'sixers': 'philadelphia 76ers',

  // NFL
  'pats': 'new england patriots',
  'bucs': 'tampa bay buccaneers',
  'jags': 'jacksonville jaguars',
  'niners': 'san francisco 49ers',
  '49ers': 'san francisco 49ers',

  // MLB
  'yanks': 'new york yankees',
  'sox': 'boston red sox', // Note: could also be white sox, usually red sox context
  'd-backs': 'arizona diamondbacks',
  'diamondbacks': 'arizona diamondbacks',

  // F1/WWE/Others
  'red bull': 'red bull racing',
  'mercedes amg': 'mercedes',
  'smackdown': 'wwe smackdown',
  'raw': 'wwe raw',

  'montreal canadiens': 'montreal canadiens',
  'canadiens de montreal': 'montreal canadiens',
  'canadiens': 'montreal canadiens',
  'habs': 'montreal canadiens',
  'toronto maple leafs': 'toronto maple leafs',
  'maple leafs': 'toronto maple leafs',
  'leafs': 'toronto maple leafs',
  'boston bruins': 'boston bruins',
  'bruins': 'boston bruins',
  'psg': 'paris saint-germain',
  'paris sg': 'paris saint-germain',
  'parissaintgermain': 'paris saint-germain',
  'om': 'marseille',
  'olympique marseille': 'marseille',
  'ol': 'lyon',
  'olympique lyonnais': 'lyon',
  'man utd': 'manchester united',
  'man united': 'manchester united',
  'man city': 'manchester city',
  'spurs': 'tottenham hotspur',
  'tottenham': 'tottenham hotspur',
  'wolves': 'wolverhampton wanderers',
  'nottm forest': 'nottingham forest',
  'real': 'real madrid',
  'barca': 'barcelona',
  'fc barcelona': 'barcelona',
  'atletico': 'atlético madrid',
  'atl madrid': 'atlético madrid',
  'juve': 'juventus',
  'inter': 'internazionale',
  'inter milan': 'internazionale',
  'ac milan': 'ac milan',
  'milan': 'ac milan',
  'bayern': 'bayern munich',
  'bayer': 'bayer leverkusen',
  'bvb': 'borussia dortmund',
  'dortmund': 'borussia dortmund',


  // --- NHL COMPREHENSIVE ALIASES ---
  'bos bruins': 'boston bruins',
  'buf sabres': 'buffalo sabres',
  'car hurricanes': 'carolina hurricanes',
  'col avalanche': 'colorado avalanche',
  'dal stars': 'dallas stars',
  'det red wings': 'detroit red wings',
  'edm oilers': 'edmonton oilers',
  'fla panthers': 'florida panthers',
  'la kings': 'los angeles kings',
  'min wild': 'minnesota wild',
  'nj devils': 'new jersey devils',
  'nsh predators': 'nashville predators',
  'ny islanders': 'new york islanders',
  'ny rangers': 'new york rangers',
  'phi flyers': 'philadelphia flyers',
  'pit penguins': 'pittsburgh penguins',
  'sj sharks': 'san jose sharks',
  'tb lightning': 'tampa bay lightning',
  'tor maple leafs': 'toronto maple leafs',
  'van canucks': 'vancouver canucks',
  'vgk': 'vegas golden knights',
  'wsh capitals': 'washington capitals',

  'avs': 'colorado avalanche',
  'caps': 'washington capitals',
  'pens': 'pittsburgh penguins',
  'preds': 'nashville predators',
  'canes': 'carolina hurricanes',
  'jackets': 'columbus blue jackets',
  'leafs': 'toronto maple leafs',
  'wings': 'detroit red wings',
  'habs': 'montreal canadiens',
  'canadiens de montreal': 'montreal canadiens',

  // --- MLB COMPREHENSIVE ALIASES ---
  'ari diamondbacks': 'arizona diamondbacks',
  'atl braves': 'atlanta braves',
  'bal orioles': 'baltimore orioles',
  'bos red sox': 'boston red sox',
  'chi cubs': 'chicago cubs',
  'chi white sox': 'chicago white sox',
  'cin reds': 'cincinnati reds',
  'cle guardians': 'cleveland guardians',
  'col rockies': 'colorado rockies',
  'det tigers': 'detroit tigers',
  'hou astros': 'houston astros',
  'kc royals': 'kansas city royals',
  'la angels': 'los angeles angels',
  'la dodgers': 'los angeles dodgers',
  'mia marlins': 'miami marlins',
  'mil brewers': 'milwaukee brewers',
  'min twins': 'minnesota twins',
  'ny mets': 'new york mets',
  'ny yankees': 'new york yankees',
  'oak athletics': 'oakland athletics',
  'phi phillies': 'philadelphia phillies',
  'pit pirates': 'pittsburgh pirates',
  'sd padres': 'san diego padres',
  'sf giants': 'san francisco giants',
  'sea mariners': 'seattle mariners',
  'stl cardinals': 'st. louis cardinals',
  'tb rays': 'tampa bay rays',
  'tex rangers': 'texas rangers',
  'tor blue jays': 'toronto blue jays',
  'wsh nationals': 'washington nationals',
  'athletics': 'oakland athletics',
  'twins': 'minnesota twins',
  'orioles': 'baltimore orioles',
  'marlins': 'miami marlins',
  'nationals': 'washington nationals',

  'd-backs': 'arizona diamondbacks',
  'dbacks': 'arizona diamondbacks',
  'yanks': 'new york yankees',
};

var LEAGUE_ALIASES = {
  'formula 1': 'f1',
  'formula1': 'f1',
  'f1': 'f1',
  'nba': 'nba',
  'national basketball association': 'nba',
  'nhl': 'nhl',
  'national hockey league': 'nhl',
  'ligue nationale de hockey': 'nhl',
  'nfl': 'nfl',
  'national football league': 'nfl',
  'mlb': 'mlb',
  'major league baseball': 'mlb',
  'mls': 'mls',
  'major league soccer': 'mls',
  'pl': 'premier league',
  'premier league anglaise': 'premier league',
  'epl': 'premier league',
  'champions league': 'uefa champions league',
  'ligue des champions': 'uefa champions league',
  'ldc': 'uefa champions league',
  'pwhl': 'pwhl',
  'professional womens hockey league': 'pwhl',
  'lhjmq': 'lhjmq',
  'qmjhl': 'lhjmq',
  'quebec maritimes junior hockey league': 'lhjmq',
  'ligue de hockey junior maritimes quebec': 'lhjmq'
};

var LEAGUE_FORMAT_NAMES = {
    'nba': 'NBA',
    'nhl': 'NHL',
    'nfl': 'NFL',
    'mlb': 'MLB',
    'mls': 'MLS',
    'premier league': 'Premier League',
    'la liga': 'La Liga',
    'serie a': 'Serie A',
    'bundesliga': 'Bundesliga',
    'ligue 1': 'Ligue 1',
    'uefa champions league': 'Champions League',
    'uefa europa league': 'Europa League',
    'f1': 'F1',
    'pwhl': 'PWHL',
    'lhjmq': 'LHJMQ'
};

function formatLeagueName(league) {
    if (!league) return 'Autres Flux';
    var lower = league.toLowerCase().trim();
    if (LEAGUE_ALIASES[lower]) {
        lower = LEAGUE_ALIASES[lower];
    }

    if (LEAGUE_FORMAT_NAMES[lower]) {
        return LEAGUE_FORMAT_NAMES[lower];
    }

    // Capitalize first letters if not in map
    return lower.replace(/\b\w/g, function(l){ return l.toUpperCase(); });
}

var _normCache = {};
function cacheLogo(teamName, url) {
  var k = normName(teamName);
  if(!logoCache[k] && url && url.indexOf("default") === -1) {
    logoCache[k] = url;
  }
}

function getLogo(teamName) {
    if(!teamName) return null;
    var key = normName(teamName);
    if (logoCache[key]) return logoCache[key];

    var colors = getTeamColors(teamName);
    var bg = colors[0].replace('#', '');
    if (bg.startsWith('hsl')) bg = '333333'; // fallback for hsl
    var fg = colors[1].replace('#', '');
    if (fg.startsWith('hsl')) fg = 'ffffff';

    // UI Avatars as ultimate fallback
    return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(teamName) + '&background=' + bg + '&color=' + fg + '&size=200&font-size=0.4';
}

function fetchAndCacheLogoDynamically(teamName) {
    var key = normName(teamName);
    if(logoCache[key] && logoCache[key].indexOf('ui-avatars') === -1) return Promise.resolve(logoCache[key]);

    // Essaie d'aller chercher sur TheSportsDB (API publique sans clé)
    var url = 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=' + encodeURIComponent(teamName);
    return fetch(url, { signal: AbortSignal.timeout(8000) }).then(r => r.json()).then(data => {
        if(data && data.teams && data.teams.length > 0) {
            var badge = data.teams[0].strTeamBadge || data.teams[0].strBadge;
            if(badge) {
                cacheLogo(teamName, badge);
                return badge;
            }
        }
        return getLogo(teamName);
    }).catch(e => {
        return getLogo(teamName);
    });
}


var STATIC_TEAM_MAP = {};
if (typeof STATIC_TEAMS !== 'undefined') {
    STATIC_TEAMS.forEach(function(t) {
        var lower = t.name.toLowerCase().trim();
        var stripped = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(fc|afc|sc|cf|de|sporting|cd|racing)\b/g, '').trim().replace(/[^a-z0-9]/g, '');
        if (stripped) {
            STATIC_TEAM_MAP[stripped] = t.name;
        }
    });
}
// Manually add some important overrides that might not map perfectly via the simple stripping
STATIC_TEAM_MAP["abudhabigrandprix"] = "Abu Dhabi Grand Prix";
STATIC_TEAM_MAP["bahraingrandprix"] = "Bahrain Grand Prix";
STATIC_TEAM_MAP["saudiarabiangrandprix"] = "Saudi Arabian Grand Prix";

function getOfficialTeamName(n) {
    if (!n) return n;

    // For F1 Grand Prix events, remove the "F1 " prefix so it looks cleaner
    if (n.toLowerCase().startsWith('f1 ') || n.toLowerCase().includes('grand prix') || n.toLowerCase().includes('formula 1') || n.toLowerCase().includes('f1 - ')) {
        n = n.replace(/f1\s*[-–]?\s*/i, '').replace(/formula 1\s*[-–]?\s*/i, '').trim();
    }

    var lower = n.toLowerCase().trim();

    // Custom replaces for cities with common abbreviations before aliases
    lower = lower.replace(/\bny\b/g, 'new york');
    lower = lower.replace(/l\.a\./g, 'los angeles');

    if (typeof TEAM_ALIASES !== 'undefined' && TEAM_ALIASES[lower]) lower = TEAM_ALIASES[lower];

    var stripped = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    stripped = stripped.replace(/\b(fc|afc|sc|cf|de|sporting|cd|racing)\b/g, '').trim();
    stripped = stripped.replace(/[^a-z0-9]/g, '');

    if (typeof STATIC_TEAM_MAP !== 'undefined' && STATIC_TEAM_MAP[stripped]) {
        return STATIC_TEAM_MAP[stripped];
    }

    // Fuzzy matching against STATIC_TEAM_MAP keys
    if (typeof STATIC_TEAM_MAP !== 'undefined' && typeof isMatch === 'function' && typeof stringSimilarity === 'function') {
        var bestMatch = null;
        var bestSim = 0;

        for (var key in STATIC_TEAM_MAP) {
            if (isMatch(stripped, key)) {
                var sim = stringSimilarity(stripped, key);
                // If one contains the other, artificially boost similarity so it picks the best substring match
                if (key.includes(stripped) || stripped.includes(key)) {
                    sim += 0.5;
                }
                if (sim > bestSim) {
                    bestSim = sim;
                    bestMatch = STATIC_TEAM_MAP[key];
                }
            }
        }

        if (bestMatch) return bestMatch;
    }

    return n;
}

function toggleGlobalStats() {
    var sidebar = document.getElementById('global-stats-sidebar');
    if (sidebar.style.transform === 'translateX(0px)') {
        sidebar.style.transform = 'translateX(100%)';
    }
}

function openGlobalStatsFromMatch(mid) {
    var m = S.matches.find(function(x) { return x.id === mid; });
    if (!m) return;
    var sidebar = document.getElementById('global-stats-sidebar');
    sidebar.style.transform = 'translateX(0px)';
    var content = document.getElementById('gstats-content');
    var title = document.getElementById('gstats-title');
    var backBtn = document.getElementById('gstats-back-btn');

    if (globalStatsInterval) {
        clearInterval(globalStatsInterval);
        globalStatsInterval = null;
    }
    if (m.status === 'live') {
        globalStatsInterval = setInterval(function() {
            if (document.getElementById('global-stats-sidebar').style.transform === 'translateX(0px)' && document.getElementById('gstats-title').textContent.indexOf(m.homeTeam) > -1) {
                openGlobalStatsFromMatch(mid); // just call it again quietly to update
            } else {
                clearInterval(globalStatsInterval);
            }
        }, 60000);
    }

    title.textContent = m.homeTeam + ' vs ' + m.awayTeam;
    backBtn.style.display = 'none';

    content.innerHTML = '<div style="text-align:center;color:var(--muted);margin-top:20px;">Chargement des données du match...</div>';

    fetchGameStats(mid).then(function(res) {
        var html = '<div style="display:flex; flex-direction:column; gap:16px;">';

        // Simple header
        html += '<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:16px; border-radius:12px;">';
        var hLogo = getLogo(m.homeTeam);
        var aLogo = getLogo(m.awayTeam);

        var hRankFormStr = (res.hRank ? '#' + res.hRank + ' ' : '') + (res.hForm ? '[' + res.hForm + ']' : '');
        html += '<div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer;" onclick="openGlobalStats(\''+escJs(m.homeTeam)+'\')">';
        if (hRankFormStr) html += '<span style="font-size:10px; color:rgba(255,255,255,0.5);">' + hRankFormStr + '</span>';
        html += '<img src="'+esc(hLogo)+'" style="height:40px;object-fit:contain;" onerror="this.style.display=\'none\'"><span style="font-weight:bold;font-size:12px;">'+esc(m.homeTeam)+'</span></div>';

        html += '<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">';
        if(m.score) {
            html += '<div style="font-size:24px;font-weight:800;">'+m.score[0]+' - '+m.score[1]+'</div>';
        }
        var statusStr = m.status === 'live' ? '<span style="color:var(--red);">🔴 '+(m.minute?m.minute+'\'':'Live')+'</span>' : (m.status === 'finished' ? 'Terminé' : m.startTime);
        html += '<div style="font-size:12px;color:var(--muted);font-weight:bold;">'+statusStr+'</div>';
        html += '</div>';

        var aRankFormStr = (res.aRank ? '#' + res.aRank + ' ' : '') + (res.aForm ? '[' + res.aForm + ']' : '');
        html += '<div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer;" onclick="openGlobalStats(\''+escJs(m.awayTeam)+'\')">';
        if (aRankFormStr) html += '<span style="font-size:10px; color:rgba(255,255,255,0.5);">' + aRankFormStr + '</span>';
        html += '<img src="'+esc(aLogo)+'" style="height:40px;object-fit:contain;" onerror="this.style.display=\'none\'"><span style="font-weight:bold;font-size:12px;">'+esc(m.awayTeam)+'</span></div>';
        html += '</div>';

        // Stats section if available
        var mHomeId = null, mAwayId = null;
        if (res.data && res.data.header && res.data.header.competitions && res.data.header.competitions[0] && res.data.header.competitions[0].competitors) {
            var c = res.data.header.competitions[0].competitors;
            var hC = c.find(function(x) { return x.homeAway === 'home'; });
            var aC = c.find(function(x) { return x.homeAway === 'away'; });
            if(hC) mHomeId = hC.id;
            if(aC) mAwayId = aC.id;
        }

        if (res.scorers && res.scorers.length > 0) {
            html += renderScorersHtml(res.scorers, m, mHomeId, mAwayId);
        }

        if (res.data) {
            var stats = [];
            // Parse ESPN stats if available
            if (res.source === 'espn' && res.data.boxscore && res.data.boxscore.teams) {
                var ts = res.data.boxscore.teams;
                if(ts.length === 2 && ts[0].statistics && ts[1].statistics) {
                    var statNames = {};
                    ts[0].statistics.forEach(s => statNames[s.name] = {h: s.displayValue});
                    ts[1].statistics.forEach(s => {
                        if(statNames[s.name]) statNames[s.name].a = s.displayValue;
                    });
                    for(var k in statNames) {
                        if(statNames[k].h && statNames[k].a) {
                            stats.push({label: k, h: statNames[k].h, a: statNames[k].a});
                        }
                    }
                }
            } else if (res.source === 'api-sports' && res.data.statistics) {
                var sData = res.data.statistics;
                if(sData.length === 2) {
                    var sHome = sData[0].statistics;
                    var sAway = sData[1].statistics;
                    sHome.forEach(sh => {
                        var sa = sAway.find(x => x.type === sh.type);
                        if(sa && sh.value !== null && sa.value !== null) {
                            stats.push({label: sh.type, h: sh.value, a: sa.value});
                        }
                    });
                }
            }

            if(stats.length > 0) {
                html += '<h4 style="color:#fff;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">Statistiques du match</h4>';
                html += '<div style="display:flex;flex-direction:column;gap:12px;background:rgba(255,255,255,0.02);padding:12px;border-radius:12px;">';
                stats.forEach(function(st) {
                    var label = st.label;
                    var formattedLabel = formatStatLabel(st.label);
                    html += '<div style="display:flex;justify-content:space-between;font-size:13px;align-items:center;">';
                    html += '<span style="font-weight:bold;width:40px;text-align:right;">'+st.h+'</span>';
                    html += '<span style="color:var(--muted);flex:1;text-align:center;">'+formattedLabel+'</span>';
                    html += '<span style="font-weight:bold;width:40px;text-align:left;">'+st.a+'</span>';
                    html += '</div>';
                });
                html += '</div>';
            } else {
                html += '<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px;">Statistiques détaillées non disponibles.</div>';
            }
        }

        html += '</div>';
        content.innerHTML = html;

    }).catch(function(e) {
        content.innerHTML = '<div style="text-align:center;color:var(--muted);margin-top:20px;">Oups, les données ne sont pas disponibles pour ce match.<br><br>Source: Non supportée ou API absente.</div>';
        console.error(e);
    });
}

function openGlobalStats(teamName) {
    var sidebar = document.getElementById('global-stats-sidebar');
    sidebar.style.transform = 'translateX(0px)';
    var content = document.getElementById('gstats-content');
    var title = document.getElementById('gstats-title');
    var backBtn = document.getElementById('gstats-back-btn');

    if (teamName) {
        title.textContent = teamName;
        backBtn.style.display = 'none';
        content.innerHTML = '<div style="text-align:center;color:var(--muted);margin-top:20px;">Chargement de la fiche de ' + esc(teamName) + '...</div>';

        fetchTeamStats(teamName);
    }
}

function fetchTeamStats(teamName) {
    var content = document.getElementById('gstats-content');

    var teamMatches = S.matches.filter(function(m) {
        return normName(m.homeTeam) === normName(teamName) || normName(m.awayTeam) === normName(teamName);
    });

    var html = '<div style="display:flex;flex-direction:column;gap:20px;">';

    // Fetch real logo dynamically if not in cache (or if fallback)
    fetchAndCacheLogoDynamically(teamName).then(function(realLogo) {
        var imgEl = document.getElementById('gstats-team-logo');
        if(imgEl && realLogo) imgEl.src = realLogo;
    });

    // Header Equipe
    html += '<div style="display:flex;align-items:center;gap:16px;background:rgba(255,255,255,0.05);padding:20px;border-radius:16px;">';
    var logoUrl = getLogo(teamName);
    if (logoUrl) {
        html += '<img id="gstats-team-logo" src="'+esc(logoUrl)+'" style="width:60px;height:60px;object-fit:contain;" onerror="this.style.display=\'none\'">';
    }
    html += '<div style="flex:1;">';
    html += '<h2 style="margin:0;font-size:22px;color:#fff;">'+esc(teamName)+'</h2>';
    var lg = teamMatches.length > 0 ? teamMatches[0].league : '';
    if(lg) html += '<div style="color:var(--muted);font-size:13px;">'+esc(lg)+'</div>';
    html += '</div>';
    html += '</div>';

    // Calendrier d'aujourd'hui
    html += '<div>';
    html += '<h4 style="color:#fff;margin-bottom:12px;display:flex;align-items:center;gap:8px;">📅 Matchs (Aujourd\'hui)</h4>';

    if (teamMatches.length > 0) {
        teamMatches.forEach(function(m) {
            html += '<div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:12px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.05);cursor:pointer;transition:background 0.2s;" onmouseenter="this.style.background=\'rgba(255,255,255,0.08)\'" onmouseleave="this.style.background=\'rgba(255,255,255,0.03)\'" onclick="openMod(S.matches.find(x=>x.id===\''+escJs(m.id)+'\'))">';

            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
            html += '<span style="font-size:11px;color:var(--muted);font-weight:bold;background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;">'+esc(m.startTime)+'</span>';
            if (m.status === 'live') {
                html += '<span style="color:var(--red);font-size:11px;font-weight:bold;background:rgba(255,69,58,0.1);padding:2px 6px;border-radius:4px;">🔴 '+(m.minute?esc(m.minute)+'\'' : 'En Direct')+'</span>';
            } else if (m.status === 'finished') {
                html += '<span style="color:var(--muted);font-size:11px;font-weight:bold;background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;">Terminé</span>';
            }
            html += '</div>';

            html += '<div style="display:flex;align-items:center;gap:8px;">';
            var isHome = normName(m.homeTeam) === normName(teamName);
            var opponent = isHome ? m.awayTeam : m.homeTeam;
            var oppLogo = getLogo(opponent);

            html += '<div style="flex:1;">';
            html += '<div style="font-size:12px;color:var(--muted);">'+(isHome ? 'vs (Domicile)' : '@ (Extérieur)')+'</div>';
            html += '<div style="font-size:15px;font-weight:bold;color:#fff;display:flex;align-items:center;gap:8px;">';
            if(oppLogo) html += '<img src="'+esc(oppLogo)+'" style="width:20px;height:20px;object-fit:contain;">';
            html += esc(opponent)+'</div>';
            html += '</div>';

            if(m.score) {
                var teamScore = isHome ? m.score[0] : m.score[1];
                var oppScore = isHome ? m.score[1] : m.score[0];
                var resColor = teamScore > oppScore ? 'var(--accent-green)' : (teamScore < oppScore ? 'var(--red)' : 'var(--muted)');
                html += '<div style="font-size:20px;font-weight:800;color:'+resColor+';background:rgba(0,0,0,0.4);padding:4px 12px;border-radius:8px;">'+m.score[0]+' - '+m.score[1]+'</div>';
            }

            html += '</div>';
            html += '</div>';
        });
    } else {
        html += '<div style="color:var(--muted);font-size:13px;padding:16px;background:rgba(255,255,255,0.02);border-radius:12px;text-align:center;">Aucun match prévu aujourd\'hui.</div>';
    }
    html += '</div>';

    // Placeholder pour Standings / Last 5
    if (teamMatches.length > 0 && teamMatches[0].league) {
        var lg = teamMatches[0].league;
        html += '<div>';
        html += '<h4 style="color:#fff;margin-bottom:12px;display:flex;align-items:center;gap:8px;">🏆 Classement '+esc(lg)+'</h4>';
        html += '<div id="gstats-standings" style="background:rgba(255,255,255,0.02);padding:16px;border-radius:12px;font-size:13px;color:var(--muted);text-align:center;">Recherche des classements...</div>';
        html += '</div>';

        // Async fetch standings
        fetchLeagueStandings(lg).then(function(res) {
            var stDiv = document.getElementById('gstats-standings');
            if(stDiv) {
                if(res.source === 'espn' && res.data && res.data.children && res.data.children[0].standings) {
                    var sData = res.data.children[0].standings.entries;
                    var tableHtml = '<table style="width:100%;border-collapse:collapse;text-align:left;font-size:12px;">';
                    tableHtml += '<tr style="color:var(--muted2);border-bottom:1px solid rgba(255,255,255,0.1);"><th style="padding:4px;">#</th><th style="padding:4px;">Équipe</th><th style="padding:4px;">MJ</th><th style="padding:4px;">Pts</th></tr>';

                    var teamFound = false;
                    sData.forEach(function(row, idx) {
                        var isTeam = normName(row.team.name) === normName(teamName) || isMatch(normName(row.team.name), normName(teamName));
                        if(isTeam) teamFound = true;

                        // Show top 3 + the team itself (+ surrounding)
                        if(idx < 3 || isTeam) {
                            var pts = row.stats.find(s => s.name === 'points') ? row.stats.find(s => s.name === 'points').displayValue : '-';
                            var gp = row.stats.find(s => s.name === 'gamesPlayed') ? row.stats.find(s => s.name === 'gamesPlayed').displayValue : '-';

                            tableHtml += '<tr style="background:'+(isTeam?'rgba(255,255,255,0.1)':'transparent')+'; border-bottom:1px solid rgba(255,255,255,0.05);">';
                            tableHtml += '<td style="padding:6px 4px;font-weight:bold;">'+(idx+1)+'</td>';
                            tableHtml += '<td style="padding:6px 4px;color:#fff;">'+esc(row.team.name)+'</td>';
                            tableHtml += '<td style="padding:6px 4px;">'+gp+'</td>';
                            tableHtml += '<td style="padding:6px 4px;font-weight:bold;color:var(--accent);">'+pts+'</td>';
                            tableHtml += '</tr>';
                        }
                    });
                    tableHtml += '</table>';
                    if(sData.length > 3 && !teamFound) tableHtml += '<div style="margin-top:8px;font-size:11px;">(Position complète non trouvée dans le top)</div>';
                    stDiv.innerHTML = tableHtml;
                } else {
                    stDiv.innerHTML = 'Données de classement non disponibles via ESPN pour cette ligue.';
                }
            }
        }).catch(function(e){
            var stDiv = document.getElementById('gstats-standings');
            if(stDiv) stDiv.innerHTML = 'Erreur de récupération du classement.';
        });
    }

    html += '</div>';
    content.innerHTML = html;
}

function normName(n) {
  if (!n) return '';
  var cached = _normCache[n];
  if (cached) return cached;

  var lower = n.toLowerCase().trim();

  // Custom replaces for cities with common abbreviations before aliases
  // Using very specific replacements to avoid breaking 'la liga' or 'deportivo la coruna'
  lower = lower.replace(/\bny\b/g, 'new york');
  lower = lower.replace(/l\.a\./g, 'los angeles');
  lower = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Apply aliases before stripping characters
  if (TEAM_ALIASES[lower]) {
      lower = TEAM_ALIASES[lower];
  } else if (LEAGUE_ALIASES[lower]) {
      lower = LEAGUE_ALIASES[lower];
  }

  // Basic fallback replacements (e.g. fc, afc, sc, cf, united, city)
  lower = lower.replace(/\b(fc|afc|sc|cf|de|sporting|cd|racing|club|athletic|united|city|rovers|wanderers)\b/gi, '').trim();

  var norm = lower.replace(/[^a-z0-9]/g, '');
  _normCache[n] = norm;
  return norm;
}

/* Formatteur d'heure EST commun pour l'API et l'horloge système */
var estFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hourCycle: 'h23',
    hour: 'numeric',
    minute: 'numeric'
});

function getEstDateStrFromDate(d) {
    var formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(d);
}

function getEstTimeStrFromDate(d) {
    // Force format extraction even if older browsers fallback to AM/PM despite hourCycle
    var str = estFormatter.format(d);
    var m = str.match(/(\d+):(\d+)\s*(AM|PM|am|pm)?/i);
    if(m) {
        var h = parseInt(m[1], 10);
        var mins = m[2];
        var ampm = m[3] ? m[3].toUpperCase() : '';

        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;

        h = h % 24;
        return pad(h) + ':' + pad(mins);
    }
    return '00:00';
}

/* ══ PARSE STREAMEAST ════════════════ */
function parseStreameast(html){
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

function parseSportsurge(html) {
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

function parseOnHockey(html) {
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
function parseBuffstreams(html){
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
function extractFootybiteLogos(doc) {
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
function parseTotalsportek(html) {
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
function parseVipleague(html) {
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
function parseMethstreams(html) {
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

/* ══ FETCH ══════════════════════════════ */

function fetchPage(url){
  return new Promise(function(resolve,reject){
    var i=0,errs=[];
    var maxTries = 3; // Try a maximum of 3 proxies to avoid long hangs

    // OnHockey specific: skip allorigins since it strips headers and fails/timeouts for schedule_table.php
    if (url.indexOf('onhockey.tv') >= 0) {
        i = 1;
    }

    function next(){
      if(i>=PROXIES.length || i>=maxTries){reject(new Error(errs.join('\n')));return;}
      var pu=PROXIES[i++](url);
      lg('Proxy '+i,pu.slice(0,70)+'…');

      var headers = {'Accept':'text/html,*/*'};
      // OnHockey specific headers to trick the API/Proxy into thinking it's an AJAX request
      if(url.indexOf('onhockey.tv') >= 0) {
          headers['X-Requested-With'] = 'XMLHttpRequest';
          headers['Referer'] = 'https://onhockey.tv/';
      }

      // Use a slightly shorter timeout for each proxy try so we don't hang too long on bad proxies
      fetch(pu,{signal:AbortSignal.timeout(8000),headers:headers})
        .then(function(r){
          if(!r.ok){errs.push('HTTP '+r.status+' p'+i);next();return null;}
          return r.text().then(t => {
            if (pu.indexOf('allorigins.win/get') > -1) {
                try {
                    let j = JSON.parse(t);
                    return j.contents;
                } catch(e) {
                    return t;
                }
            }
            return t;
          });
        })
        .then(function(t){
          if(t===null) return;
          if(!t||t.length<200){errs.push('Vide p'+i+' ('+t.length+'c)');next();return;}

          // API AllOrigins returns a 522/520 as text sometimes but with a 200/502 status, catch it
          if(t.indexOf('Oops... Request Timeout') >= 0 || t.indexOf('500 Internal Server Error') >= 0 || t.indexOf('502 Bad Gateway') >= 0 || t.indexOf('522 Connection timed out') >= 0) {
              errs.push('Proxy Error Content p'+i);
              next();
              return;
          }

          lg('OK proxy '+i,'len='+t.length);
          S.proxy='proxy '+i;
          resolve(t);
        })
        .catch(function(e){errs.push(e.message+' p'+i);next();});
    }
    next();
  });
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
function parseNflbite(html) {
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

function parseMlbbite(html) {
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

function parseFootybite(html){
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


/* ══ MATCH MERGING LOGIC ══════════════ */
function mergeMatches(mainList, newList) {
  newList.forEach(function(nm) {
    var merged = false;

    for (var i = 0; i < mainList.length; i++) {
      var mm = mainList[i];

      if (isMatchPair(mm, nm)) {
        // It's the same match. Merge streams.
        mm.streamLinks = mm.streamLinks || [];
        nm.streamLinks = nm.streamLinks || [];

        nm.streamLinks.forEach(function(sl) {
          // Avoid exact duplicates
          if(!mm.streamLinks.find(function(existing) { return existing.url === sl.url; })) {
            mm.streamLinks.push(sl);
          }
        });

        // Update logos if the new source has them and we don't
        if(!mm.homeLogo && nm.homeLogo && nm.homeLogo.indexOf('default') === -1) {
            mm.homeLogo = nm.homeLogo;
            cacheLogo(mm.homeTeam, nm.homeLogo);
        }
        if(!mm.awayLogo && nm.awayLogo && nm.awayLogo.indexOf('default') === -1) {
            mm.awayLogo = nm.awayLogo;
            cacheLogo(mm.awayTeam, nm.awayLogo);
        }

        // Status resolution: if one says live and other says upcoming, prioritize live
        if(nm.status === 'live' && mm.status !== 'live') mm.status = 'live';
        if(nm.status === 'finished' && mm.status !== 'finished') mm.status = 'finished';

        // If API doesn't have time but source does
        if(mm.startTime === '00:00' && nm.startTime && nm.startTime !== '00:00') mm.startTime = nm.startTime;

        merged = true;
        break;
      }
    }

    if (!merged) {
      // If no match found, we add it as a new match to the list
      // Generate a new ID based on the array length to avoid conflicts
      nm.id = mainList.length;
      mainList.push(nm);
    }
  });

  return mainList;
}

/* ══ SIMILARITY ALGORITHM ════════════ */
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  var matrix = [];
  for (var i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (var j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  for (var i = 1; i <= b.length; i++) {
    for (var j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

function stringSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  var maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  var dist = levenshtein(s1, s2);
  return (maxLen - dist) / maxLen;
}

function isMatchPair(m1, m2) {
  if (!m1 || !m2) return false;

  // League strict check if both have leagues defined and aren't generic
  var l1 = (m1.league || '').toLowerCase();
  var l2 = (m2.league || '').toLowerCase();

  // Some basic sport/league exclusions (only exclude if we are absolutely sure they mismatch)
  if (l1 && l2 && l1 !== l2) {
      var is1Hockey = l1.includes('nhl') || l1.includes('hockey') || l1.includes('pwhl') || l1.includes('lhjmq');
      var is2Hockey = l2.includes('nhl') || l2.includes('hockey') || l2.includes('pwhl') || l2.includes('lhjmq');
      var is1Bball = l1.includes('nba') || l1.includes('basketball');
      var is2Bball = l2.includes('nba') || l2.includes('basketball');
      var is1Base = l1.includes('mlb') || l1.includes('baseball');
      var is2Base = l2.includes('mlb') || l2.includes('baseball');
      var is1Football = l1.includes('nfl') || l1.includes('american');
      var is2Football = l2.includes('nfl') || l2.includes('american');

      if ((is1Hockey && (is2Bball || is2Base || is2Football)) ||
          (is1Bball && (is2Hockey || is2Base || is2Football)) ||
          (is1Base && (is2Hockey || is2Bball || is2Football)) ||
          (is1Football && (is2Hockey || is2Bball || is2Base))) {
          return false;
      }
  }

  var m1H = normName(m1.homeTeam);
  var m1A = normName(m1.awayTeam);
  var m2H = normName(m2.homeTeam);
  var m2A = normName(m2.awayTeam);

  // Check explicitly for different dates before ANY matching
  if (m1.matchDate && m2.matchDate && m1.matchDate !== m2.matchDate) {
      return false;
  }

  // Check for TBD or missing teams (some scrapers only provide one team from URL)
  var is1HomeTbd = m1.homeTeam === 'TBD' || m1.homeTeam === 'tbd' || m1H === '';
  var is1AwayTbd = m1.awayTeam === 'TBD' || m1.awayTeam === 'tbd' || m1A === '';
  var is2HomeTbd = m2.homeTeam === 'TBD' || m2.homeTeam === 'tbd' || m2H === '';
  var is2AwayTbd = m2.awayTeam === 'TBD' || m2.awayTeam === 'tbd' || m2A === '';

  if (is1AwayTbd || is2AwayTbd || is1HomeTbd || is2HomeTbd) {
      if ((is1AwayTbd || is2AwayTbd) && isMatch(m1H, m2H)) return true;
      if ((is1AwayTbd || is2AwayTbd) && isMatch(m1H, m2A)) return true; // Could be reversed
      if ((is1HomeTbd || is2HomeTbd) && isMatch(m1A, m2A)) return true;
      if ((is1HomeTbd || is2HomeTbd) && isMatch(m1A, m2H)) return true;
      return false;
  }

  // Standard direct match
  if (isMatch(m1H, m2H) && isMatch(m1A, m2A)) {
      return true;
  }

  // Reversed match (away vs home)
  if (isMatch(m1H, m2A) && isMatch(m1A, m2H)) {
      return true;
  }

  // Advanced Cross-Validation Match
  // Create combined strings for both matches
  var combined1 = m1H + " " + m1A;
  var combined2 = m2H + " " + m2A;

  // We check if the smaller combo is essentially contained in the larger combo
  // by comparing words or high substring overlap.
  var shorterCombo = combined1.length < combined2.length ? combined1 : combined2;
  var longerCombo = combined1.length < combined2.length ? combined2 : combined1;

  // Let's break the original shorter names (from the object, not normalized) into words
  var rawShortH = m1H.length + m1A.length < m2H.length + m2A.length ? m1.homeTeam : m2.homeTeam;
  var rawShortA = m1H.length + m1A.length < m2H.length + m2A.length ? m1.awayTeam : m2.awayTeam;

  // Use normName on parts to match how the longer string is built
  var shortWordsRaw = (rawShortH + " " + rawShortA).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  var shortWords = [];
  shortWordsRaw.forEach(function(w) {
      var nw = normName(w);
      if (nw.length >= 3) shortWords.push(nw);
      else if (w.length >= 3) shortWords.push(w);
  });

  // Remove duplicates
  shortWords = shortWords.filter(function(item, pos) { return shortWords.indexOf(item) == pos; });

  if (shortWords.length === 0) return false;

  var matchedWords = 0;
  for (var i = 0; i < shortWords.length; i++) {
      var word = shortWords[i];
      if (longerCombo.includes(word)) {
          matchedWords++;
      } else {
          // Last resort sliding window for this word on the entire longer combo
          var maxW = Math.min(longerCombo.length, word.length + 2);
          var minW = Math.max(1, word.length - 2);
          var bestSubSim = 0;
          for (var w = minW; w <= maxW; w++) {
              for (var k = 0; k <= longerCombo.length - w; k++) {
                  var sub = longerCombo.substring(k, k + w);
                  var subSim = stringSimilarity(sub, word);
                  if (subSim > bestSubSim) bestSubSim = subSim;
              }
          }
          if (bestSubSim > 0.80) {
              matchedWords++;
          }
      }
  }

  // If a significant portion of words match, consider it the same matchup
  // (e.g. if we have "tigers" and "rangers", that's 2 words. If both match, it's 100%)
  if (matchedWords >= shortWords.length * 0.75 && matchedWords >= 2) {
      return true;
  }

  // Final permissive fallback: pure substring overlap for extreme abbreviations (e.g. 'Rangers' vs 'Texas Rangers')
  if (m1H && m1A && m2H && m2A) {
      var hMatch = m1H.includes(m2H) || m2H.includes(m1H);
      var aMatch = m1A.includes(m2A) || m2A.includes(m1A);
      if (hMatch && aMatch) return true;

      // Check reversed teams with subset matching
      var crossHMatch = m1H.includes(m2A) || m2A.includes(m1H);
      var crossAMatch = m1A.includes(m2H) || m2H.includes(m1A);
      if (crossHMatch && crossAMatch) return true;
  }

  // Cross-check dates and exact matches (already handled by early return, so we can just return true here)
  if (m1H === m2H && m1A === m2A) return true;

  return false;
}

function isMatch(name1, name2) {
  if (!name1 || !name2) return false;
  if (name1 === name2) return true;

  // Clean empty strings might happen after normName replacements
  if (name1.length < 3 || name2.length < 3) return name1 === name2;

  // Check if one contains the other (e.g. 'manchester' in 'manchesterunited')
  if (name1.includes(name2) || name2.includes(name1)) return true;

  var sim = stringSimilarity(name1, name2);

  // Specific fallback for short names
  if (name1.length <= 4 || name2.length <= 4) {
      if (sim > 0.8) return true;
  } else {
      if (sim > 0.65) return true;
  }

  // If one name is significantly longer but contains a typo-version of the shorter one
  // Handled by sliding window below...

  // Sliding window substring similarity
  // This allows catching scraped names like "tampa" within "tampabaylightning" even with typos (e.g., "tanpa")
  var shorter = name1.length < name2.length ? name1 : name2;
  var longer = name1.length < name2.length ? name2 : name1;

  if (longer.length > shorter.length) {
      // Window size accounts for possible missing or extra characters
      var maxWindow = Math.min(longer.length, shorter.length + 2);
      var minWindow = Math.max(1, shorter.length - 2);

      var bestSubSim = 0;
      for (var w = minWindow; w <= maxWindow; w++) {
          for (var i = 0; i <= longer.length - w; i++) {
              var sub = longer.substring(i, i + w);
              var subSim = stringSimilarity(sub, shorter);
              if (subSim > bestSubSim) bestSubSim = subSim;
          }
      }

      // Since isMatch is usually called for BOTH home and away teams concurrently,
      // a loose match (70% on a substring) is very safe here.
      if (bestSubSim > 0.70) {
          return true;
      }
  }

  return false;
}

/* ══ ESPN API FALLBACK & API-SPORTS ════════════ */
var ESPN_LEAGUES = {
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

function getEspnDateStr(d) {
  return d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate());
}

function fetchEspnSchedule(leaguePath, dateStr) {
  var url = 'https://site.api.espn.com/apis/site/v2/sports/' + leaguePath + '/scoreboard?dates=' + dateStr;
  return fetch(url, { signal: AbortSignal.timeout(8000) }).then(function(res) { return res.json(); }).catch(function(){ return null; });
}

/* ══ API-SPORTS INTEGRATION ════════════ */
var SPORT_MAP = {
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

function getLeagueInfo(leagueName) {
  var l = leagueName.toLowerCase();
  for (var key in SPORT_MAP) {
    if (l.indexOf(key) >= 0) return SPORT_MAP[key];
  }
  // Default to football if unknown, though it might fail
  return { sport: 'football', api: 'v3.football.api-sports.io', leagueId: null };
}


function filterBuggyMatches(matches) {
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

/* ══ LOGO CACHE ═══════════════════════════ */
var STATIC_LOGOS_RAW = {
  'boston fleet': "https://upload.wikimedia.org/wikipedia/en/2/27/Boston_Fleet_logo.svg",
  'minnesota frost': "https://upload.wikimedia.org/wikipedia/en/5/5a/Minnesota_Frost_logo.svg",
  'montréal victoire': "https://upload.wikimedia.org/wikipedia/en/c/cd/Montreal_Victoire_logo.svg",
  'new york sirens': "https://upload.wikimedia.org/wikipedia/en/1/1a/New_York_Sirens_logo.svg",
  'ottawa charge': "https://upload.wikimedia.org/wikipedia/en/a/ad/Ottawa_Charge_logo.svg",
  'toronto sceptres': "https://upload.wikimedia.org/wikipedia/en/4/4b/Toronto_Sceptres_logo.svg",
  'acadie-bathurst titan': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/acadiebathursttitan.png",
  'baie-comeau drakkar': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/baiecomeaudrakkar.png",
  'blainville-boisbriand armada': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/blainvilleboisbriandarmada.png",
  'cape breton eagles': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/capebretoneagles.png",
  'charlottetown islanders': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/charlottetownislanders.png",
  'chicoutimi saguenéens': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/chicoutimisaguenens.png",
  'drummondville voltigeurs': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/drummondvillevoltigeurs.png",
  'gatineau olympiques': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/gatineauolympiques.png",
  'halifax mooseheads': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/halifaxmooseheads.png",
  'moncton wildcats': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/monctonwildcats.png",
  'québec remparts': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/qubecremparts.png",
  'rimouski océanic': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/rimouskiocanic.png",
  'rouyn-noranda huskies': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/rouynnorandahuskies.png",
  'saint john sea dogs': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/saintjohnseadogs.png",
  'shawinigan cataractes': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/shawinigancataractes.png",
  'sherbrooke phoenix': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/sherbrookephoenix.png",
  'val-d\'or foreurs': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/valdorforeurs.png",
  'victoriaville tigres': "https://chl.ca/lhjmq/wp-content/uploads/sites/2/logos/victoriavilletigres.png",
  'boston fleet': "https://upload.wikimedia.org/wikipedia/en/2/27/Boston_Fleet_logo.svg",
  'minnesota frost': "https://upload.wikimedia.org/wikipedia/en/5/5a/Minnesota_Frost_logo.svg",
  'montréal victoire': "https://upload.wikimedia.org/wikipedia/en/c/cd/Montreal_Victoire_logo.svg",
  'new york sirens': "https://upload.wikimedia.org/wikipedia/en/1/1a/New_York_Sirens_logo.svg",
  'ottawa charge': "https://upload.wikimedia.org/wikipedia/en/a/ad/Ottawa_Charge_logo.svg",
  'toronto sceptres': "https://upload.wikimedia.org/wikipedia/en/4/4b/Toronto_Sceptres_logo.svg",


// premier league
  'afc bournemouth': "https://a.espncdn.com/i/teamlogos/soccer/500/349.png",
  'arsenal': "https://a.espncdn.com/i/teamlogos/soccer/500/359.png",
  'aston villa': "https://a.espncdn.com/i/teamlogos/soccer/500/362.png",
  'brentford': "https://a.espncdn.com/i/teamlogos/soccer/500/337.png",
  'brighton & hove albion': "https://a.espncdn.com/i/teamlogos/soccer/500/331.png",
  'burnley': "https://a.espncdn.com/i/teamlogos/soccer/500/379.png",
  'chelsea': "https://a.espncdn.com/i/teamlogos/soccer/500/363.png",
  'crystal palace': "https://a.espncdn.com/i/teamlogos/soccer/500/384.png",
  'everton': "https://a.espncdn.com/i/teamlogos/soccer/500/368.png",
  'fulham': "https://a.espncdn.com/i/teamlogos/soccer/500/370.png",
  'leeds united': "https://a.espncdn.com/i/teamlogos/soccer/500/357.png",
  'liverpool': "https://a.espncdn.com/i/teamlogos/soccer/500/364.png",
  'manchester city': "https://a.espncdn.com/i/teamlogos/soccer/500/382.png",
  'manchester united': "https://a.espncdn.com/i/teamlogos/soccer/500/360.png",
  'newcastle united': "https://a.espncdn.com/i/teamlogos/soccer/500/361.png",
  'nottingham forest': "https://a.espncdn.com/i/teamlogos/soccer/500/393.png",
  'sunderland': "https://a.espncdn.com/i/teamlogos/soccer/500/366.png",
  'tottenham hotspur': "https://a.espncdn.com/i/teamlogos/soccer/500/367.png",
  'west ham united': "https://a.espncdn.com/i/teamlogos/soccer/500/371.png",
  'wolverhampton wanderers': "https://a.espncdn.com/i/teamlogos/soccer/500/380.png",

// la liga
  'alavés': "https://a.espncdn.com/i/teamlogos/soccer/500/96.png",
  'athletic club': "https://a.espncdn.com/i/teamlogos/soccer/500/93.png",
  'atlético madrid': "https://a.espncdn.com/i/teamlogos/soccer/500/1068.png",
  'barcelona': "https://a.espncdn.com/i/teamlogos/soccer/500/83.png",
  'celta vigo': "https://a.espncdn.com/i/teamlogos/soccer/500/85.png",
  'elche': "https://a.espncdn.com/i/teamlogos/soccer/500/3751.png",
  'espanyol': "https://a.espncdn.com/i/teamlogos/soccer/500/88.png",
  'getafe': "https://a.espncdn.com/i/teamlogos/soccer/500/2922.png",
  'girona': "https://a.espncdn.com/i/teamlogos/soccer/500/9812.png",
  'levante': "https://a.espncdn.com/i/teamlogos/soccer/500/1538.png",
  'mallorca': "https://a.espncdn.com/i/teamlogos/soccer/500/84.png",
  'osasuna': "https://a.espncdn.com/i/teamlogos/soccer/500/97.png",
  'rayo vallecano': "https://a.espncdn.com/i/teamlogos/soccer/500/101.png",
  'real betis': "https://a.espncdn.com/i/teamlogos/soccer/500/244.png",
  'real madrid': "https://a.espncdn.com/i/teamlogos/soccer/500/86.png",
  'real oviedo': "https://a.espncdn.com/i/teamlogos/soccer/500/92.png",
  'real sociedad': "https://a.espncdn.com/i/teamlogos/soccer/500/89.png",
  'sevilla': "https://a.espncdn.com/i/teamlogos/soccer/500/243.png",
  'valencia': "https://a.espncdn.com/i/teamlogos/soccer/500/94.png",
  'villarreal': "https://a.espncdn.com/i/teamlogos/soccer/500/102.png",

// serie a
  'ac milan': "https://a.espncdn.com/i/teamlogos/soccer/500/103.png",
  'as roma': "https://a.espncdn.com/i/teamlogos/soccer/500/104.png",
  'atalanta': "https://a.espncdn.com/i/teamlogos/soccer/500/105.png",
  'bologna': "https://a.espncdn.com/i/teamlogos/soccer/500/107.png",
  'cagliari': "https://a.espncdn.com/i/teamlogos/soccer/500/2925.png",
  'como': "https://a.espncdn.com/i/teamlogos/soccer/500/2572.png",
  'cremonese': "https://a.espncdn.com/i/teamlogos/soccer/500/4050.png",
  'fiorentina': "https://a.espncdn.com/i/teamlogos/soccer/500/109.png",
  'genoa': "https://a.espncdn.com/i/teamlogos/soccer/500/3263.png",
  'hellas verona': "https://a.espncdn.com/i/teamlogos/soccer/500/119.png",
  'internazionale': "https://a.espncdn.com/i/teamlogos/soccer/500/110.png",
  'juventus': "https://a.espncdn.com/i/teamlogos/soccer/500/111.png",
  'lazio': "https://a.espncdn.com/i/teamlogos/soccer/500/112.png",
  'lecce': "https://a.espncdn.com/i/teamlogos/soccer/500/113.png",
  'napoli': "https://a.espncdn.com/i/teamlogos/soccer/500/114.png",
  'parma': "https://a.espncdn.com/i/teamlogos/soccer/500/115.png",
  'pisa': "https://a.espncdn.com/i/teamlogos/soccer/500/3956.png",
  'sassuolo': "https://a.espncdn.com/i/teamlogos/soccer/500/3997.png",
  'torino': "https://a.espncdn.com/i/teamlogos/soccer/500/239.png",
  'udinese': "https://a.espncdn.com/i/teamlogos/soccer/500/118.png",

// bundesliga
  '1. fc heidenheim 1846': "https://a.espncdn.com/i/teamlogos/soccer/500/6418.png",
  '1. fc union berlin': "https://a.espncdn.com/i/teamlogos/soccer/500/598.png",
  'bayer leverkusen': "https://a.espncdn.com/i/teamlogos/soccer/500/131.png",
  'bayern munich': "https://a.espncdn.com/i/teamlogos/soccer/500/132.png",
  'borussia dortmund': "https://a.espncdn.com/i/teamlogos/soccer/500/124.png",
  'borussia mönchengladbach': "https://a.espncdn.com/i/teamlogos/soccer/500/268.png",
  'eintracht frankfurt': "https://a.espncdn.com/i/teamlogos/soccer/500/125.png",
  'fc augsburg': "https://a.espncdn.com/i/teamlogos/soccer/500/3841.png",
  'fc cologne': "https://a.espncdn.com/i/teamlogos/soccer/500/122.png",
  'hamburg sv': "https://a.espncdn.com/i/teamlogos/soccer/500/127.png",
  'mainz': "https://a.espncdn.com/i/teamlogos/soccer/500/2950.png",
  'rb leipzig': "https://a.espncdn.com/i/teamlogos/soccer/500/11420.png",
  'sc freiburg': "https://a.espncdn.com/i/teamlogos/soccer/500/126.png",
  'st. pauli': "https://a.espncdn.com/i/teamlogos/soccer/500/270.png",
  'tsg hoffenheim': "https://a.espncdn.com/i/teamlogos/soccer/500/7911.png",
  'vfb stuttgart': "https://a.espncdn.com/i/teamlogos/soccer/500/134.png",
  'vfl wolfsburg': "https://a.espncdn.com/i/teamlogos/soccer/500/138.png",
  'werder bremen': "https://a.espncdn.com/i/teamlogos/soccer/500/137.png",

// ligue 1
  'aj auxerre': "https://a.espncdn.com/i/teamlogos/soccer/500/172.png",
  'as monaco': "https://a.espncdn.com/i/teamlogos/soccer/500/174.png",
  'angers': "https://a.espncdn.com/i/teamlogos/soccer/500/7868.png",
  'brest': "https://a.espncdn.com/i/teamlogos/soccer/500/6997.png",
  'le havre ac': "https://a.espncdn.com/i/teamlogos/soccer/500/3236.png",
  'lens': "https://a.espncdn.com/i/teamlogos/soccer/500/175.png",
  'lille': "https://a.espncdn.com/i/teamlogos/soccer/500/166.png",
  'lorient': "https://a.espncdn.com/i/teamlogos/soccer/500/273.png",
  'lyon': "https://a.espncdn.com/i/teamlogos/soccer/500/167.png",
  'marseille': "https://a.espncdn.com/i/teamlogos/soccer/500/176.png",
  'metz': "https://a.espncdn.com/i/teamlogos/soccer/500/177.png",
  'nantes': "https://a.espncdn.com/i/teamlogos/soccer/500/165.png",
  'nice': "https://a.espncdn.com/i/teamlogos/soccer/500/2502.png",
  'paris fc': "https://a.espncdn.com/i/teamlogos/soccer/500/6851.png",
  'paris saint-germain': "https://a.espncdn.com/i/teamlogos/soccer/500/160.png",
  'stade rennais': "https://a.espncdn.com/i/teamlogos/soccer/500/169.png",
  'strasbourg': "https://a.espncdn.com/i/teamlogos/soccer/500/180.png",
  'toulouse': "https://a.espncdn.com/i/teamlogos/soccer/500/179.png",

// champions league
  'as monaco': "https://a.espncdn.com/i/teamlogos/soccer/500/174.png",
  'ajax amsterdam': "https://a.espncdn.com/i/teamlogos/soccer/500/139.png",
  'arsenal': "https://a.espncdn.com/i/teamlogos/soccer/500/359.png",
  'atalanta': "https://a.espncdn.com/i/teamlogos/soccer/500/105.png",
  'athletic club': "https://a.espncdn.com/i/teamlogos/soccer/500/93.png",
  'atlético madrid': "https://a.espncdn.com/i/teamlogos/soccer/500/1068.png",
  'barcelona': "https://a.espncdn.com/i/teamlogos/soccer/500/83.png",
  'bayer leverkusen': "https://a.espncdn.com/i/teamlogos/soccer/500/131.png",
  'bayern munich': "https://a.espncdn.com/i/teamlogos/soccer/500/132.png",
  'benfica': "https://a.espncdn.com/i/teamlogos/soccer/500/1929.png",
  'bodo/glimt': "https://a.espncdn.com/i/teamlogos/soccer/500/2980.png",
  'borussia dortmund': "https://a.espncdn.com/i/teamlogos/soccer/500/124.png",
  'chelsea': "https://a.espncdn.com/i/teamlogos/soccer/500/363.png",
  'club brugge': "https://a.espncdn.com/i/teamlogos/soccer/500/570.png",
  'eintracht frankfurt': "https://a.espncdn.com/i/teamlogos/soccer/500/125.png",
  'f.c. københavn': "https://a.espncdn.com/i/teamlogos/soccer/500/909.png",
  'fk qarabag': "https://a.espncdn.com/i/teamlogos/soccer/500/10414.png",
  'galatasaray': "https://a.espncdn.com/i/teamlogos/soccer/500/432.png",
  'internazionale': "https://a.espncdn.com/i/teamlogos/soccer/500/110.png",
  'juventus': "https://a.espncdn.com/i/teamlogos/soccer/500/111.png",
  'kairat almaty': "https://a.espncdn.com/i/teamlogos/soccer/500/2528.png",
  'liverpool': "https://a.espncdn.com/i/teamlogos/soccer/500/364.png",
  'manchester city': "https://a.espncdn.com/i/teamlogos/soccer/500/382.png",
  'marseille': "https://a.espncdn.com/i/teamlogos/soccer/500/176.png",
  'napoli': "https://a.espncdn.com/i/teamlogos/soccer/500/114.png",
  'newcastle united': "https://a.espncdn.com/i/teamlogos/soccer/500/361.png",
  'olympiacos': "https://a.espncdn.com/i/teamlogos/soccer/500/435.png",
  'psv eindhoven': "https://a.espncdn.com/i/teamlogos/soccer/500/148.png",
  'pafos': "https://a.espncdn.com/i/teamlogos/soccer/500/22281.png",
  'paris saint-germain': "https://a.espncdn.com/i/teamlogos/soccer/500/160.png",
  'real madrid': "https://a.espncdn.com/i/teamlogos/soccer/500/86.png",
  'slavia prague': "https://a.espncdn.com/i/teamlogos/soccer/500/494.png",
  'sporting cp': "https://a.espncdn.com/i/teamlogos/soccer/500/2250.png",
  'tottenham hotspur': "https://a.espncdn.com/i/teamlogos/soccer/500/367.png",
  'union st.-gilloise': "https://a.espncdn.com/i/teamlogos/soccer/500/5807.png",
  'villarreal': "https://a.espncdn.com/i/teamlogos/soccer/500/102.png",

// nba
  'atlanta hawks': "https://a.espncdn.com/i/teamlogos/nba/500/atl.png",
  'boston celtics': "https://a.espncdn.com/i/teamlogos/nba/500/bos.png",
  'brooklyn nets': "https://a.espncdn.com/i/teamlogos/nba/500/bkn.png",
  'charlotte hornets': "https://a.espncdn.com/i/teamlogos/nba/500/cha.png",
  'chicago bulls': "https://a.espncdn.com/i/teamlogos/nba/500/chi.png",
  'cleveland cavaliers': "https://a.espncdn.com/i/teamlogos/nba/500/cle.png",
  'dallas mavericks': "https://a.espncdn.com/i/teamlogos/nba/500/dal.png",
  'denver nuggets': "https://a.espncdn.com/i/teamlogos/nba/500/den.png",
  'detroit pistons': "https://a.espncdn.com/i/teamlogos/nba/500/det.png",
  'golden state warriors': "https://a.espncdn.com/i/teamlogos/nba/500/gs.png",
  'houston rockets': "https://a.espncdn.com/i/teamlogos/nba/500/hou.png",
  'indiana pacers': "https://a.espncdn.com/i/teamlogos/nba/500/ind.png",
  'la clippers': "https://a.espncdn.com/i/teamlogos/nba/500/lac.png",
  'los angeles lakers': "https://a.espncdn.com/i/teamlogos/nba/500/lal.png",
  'memphis grizzlies': "https://a.espncdn.com/i/teamlogos/nba/500/mem.png",
  'miami heat': "https://a.espncdn.com/i/teamlogos/nba/500/mia.png",
  'milwaukee bucks': "https://a.espncdn.com/i/teamlogos/nba/500/mil.png",
  'minnesota timberwolves': "https://a.espncdn.com/i/teamlogos/nba/500/min.png",
  'new orleans pelicans': "https://a.espncdn.com/i/teamlogos/nba/500/no.png",
  'new york knicks': "https://a.espncdn.com/i/teamlogos/nba/500/ny.png",
  'oklahoma city thunder': "https://a.espncdn.com/i/teamlogos/nba/500/okc.png",
  'orlando magic': "https://a.espncdn.com/i/teamlogos/nba/500/orl.png",
  'philadelphia 76ers': "https://a.espncdn.com/i/teamlogos/nba/500/phi.png",
  'phoenix suns': "https://a.espncdn.com/i/teamlogos/nba/500/phx.png",
  'portland trail blazers': "https://a.espncdn.com/i/teamlogos/nba/500/por.png",
  'sacramento kings': "https://a.espncdn.com/i/teamlogos/nba/500/sac.png",
  'san antonio spurs': "https://a.espncdn.com/i/teamlogos/nba/500/sa.png",
  'toronto raptors': "https://a.espncdn.com/i/teamlogos/nba/500/tor.png",
  'utah jazz': "https://a.espncdn.com/i/teamlogos/nba/500/utah.png",
  'washington wizards': "https://a.espncdn.com/i/teamlogos/nba/500/wsh.png",

// nfl
  'arizona cardinals': "https://a.espncdn.com/i/teamlogos/nfl/500/ari.png",
  'atlanta falcons': "https://a.espncdn.com/i/teamlogos/nfl/500/atl.png",
  'baltimore ravens': "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png",
  'buffalo bills': "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png",
  'carolina panthers': "https://a.espncdn.com/i/teamlogos/nfl/500/car.png",
  'chicago bears': "https://a.espncdn.com/i/teamlogos/nfl/500/chi.png",
  'cincinnati bengals': "https://a.espncdn.com/i/teamlogos/nfl/500/cin.png",
  'cleveland browns': "https://a.espncdn.com/i/teamlogos/nfl/500/cle.png",
  'dallas cowboys': "https://a.espncdn.com/i/teamlogos/nfl/500/dal.png",
  'denver broncos': "https://a.espncdn.com/i/teamlogos/nfl/500/den.png",
  'detroit lions': "https://a.espncdn.com/i/teamlogos/nfl/500/det.png",
  'green bay packers': "https://a.espncdn.com/i/teamlogos/nfl/500/gb.png",
  'houston texans': "https://a.espncdn.com/i/teamlogos/nfl/500/hou.png",
  'indianapolis colts': "https://a.espncdn.com/i/teamlogos/nfl/500/ind.png",
  'jacksonville jaguars': "https://a.espncdn.com/i/teamlogos/nfl/500/jax.png",
  'kansas city chiefs': "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png",
  'las vegas raiders': "https://a.espncdn.com/i/teamlogos/nfl/500/lv.png",
  'los angeles chargers': "https://a.espncdn.com/i/teamlogos/nfl/500/lac.png",
  'los angeles rams': "https://a.espncdn.com/i/teamlogos/nfl/500/lar.png",
  'miami dolphins': "https://a.espncdn.com/i/teamlogos/nfl/500/mia.png",
  'minnesota vikings': "https://a.espncdn.com/i/teamlogos/nfl/500/min.png",
  'new england patriots': "https://a.espncdn.com/i/teamlogos/nfl/500/ne.png",
  'new orleans saints': "https://a.espncdn.com/i/teamlogos/nfl/500/no.png",
  'new york giants': "https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png",
  'new york jets': "https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png",
  'philadelphia eagles': "https://a.espncdn.com/i/teamlogos/nfl/500/phi.png",
  'pittsburgh steelers': "https://a.espncdn.com/i/teamlogos/nfl/500/pit.png",
  'san francisco 49ers': "https://a.espncdn.com/i/teamlogos/nfl/500/sf.png",
  'seattle seahawks': "https://a.espncdn.com/i/teamlogos/nfl/500/sea.png",
  'tampa bay buccaneers': "https://a.espncdn.com/i/teamlogos/nfl/500/tb.png",
  'tennessee titans': "https://a.espncdn.com/i/teamlogos/nfl/500/ten.png",
  'washington commanders': "https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png",

// mlb
  'arizona diamondbacks': "https://a.espncdn.com/i/teamlogos/mlb/500/ari.png",
  'athletics': "https://a.espncdn.com/i/teamlogos/mlb/500/ath.png",
  'atlanta braves': "https://a.espncdn.com/i/teamlogos/mlb/500/atl.png",
  'baltimore orioles': "https://a.espncdn.com/i/teamlogos/mlb/500/bal.png",
  'boston red sox': "https://a.espncdn.com/i/teamlogos/mlb/500/bos.png",
  'chicago cubs': "https://a.espncdn.com/i/teamlogos/mlb/500/chc.png",
  'chicago white sox': "https://a.espncdn.com/i/teamlogos/mlb/500/chw.png",
  'cincinnati reds': "https://a.espncdn.com/i/teamlogos/mlb/500/cin.png",
  'cleveland guardians': "https://a.espncdn.com/i/teamlogos/mlb/500/cle.png",
  'colorado rockies': "https://a.espncdn.com/i/teamlogos/mlb/500/col.png",
  'detroit tigers': "https://a.espncdn.com/i/teamlogos/mlb/500/det.png",
  'houston astros': "https://a.espncdn.com/i/teamlogos/mlb/500/hou.png",
  'kansas city royals': "https://a.espncdn.com/i/teamlogos/mlb/500/kc.png",
  'los angeles angels': "https://a.espncdn.com/i/teamlogos/mlb/500/laa.png",
  'los angeles dodgers': "https://a.espncdn.com/i/teamlogos/mlb/500/lad.png",
  'miami marlins': "https://a.espncdn.com/i/teamlogos/mlb/500/mia.png",
  'milwaukee brewers': "https://a.espncdn.com/i/teamlogos/mlb/500/mil.png",
  'minnesota twins': "https://a.espncdn.com/i/teamlogos/mlb/500/min.png",
  'new york mets': "https://a.espncdn.com/i/teamlogos/mlb/500/nym.png",
  'new york yankees': "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png",
  'philadelphia phillies': "https://a.espncdn.com/i/teamlogos/mlb/500/phi.png",
  'pittsburgh pirates': "https://a.espncdn.com/i/teamlogos/mlb/500/pit.png",
  'san diego padres': "https://a.espncdn.com/i/teamlogos/mlb/500/sd.png",
  'san francisco giants': "https://a.espncdn.com/i/teamlogos/mlb/500/sf.png",
  'seattle mariners': "https://a.espncdn.com/i/teamlogos/mlb/500/sea.png",
  'st. louis cardinals': "https://a.espncdn.com/i/teamlogos/mlb/500/stl.png",
  'tampa bay rays': "https://a.espncdn.com/i/teamlogos/mlb/500/tb.png",
  'texas rangers': "https://a.espncdn.com/i/teamlogos/mlb/500/tex.png",
  'toronto blue jays': "https://a.espncdn.com/i/teamlogos/mlb/500/tor.png",
  'washington nationals': "https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png",

  'anaheim ducks': "https://a.espncdn.com/i/teamlogos/nhl/500/ana.png",
  'boston bruins': "https://a.espncdn.com/i/teamlogos/nhl/500/bos.png",
  'buffalo sabres': "https://a.espncdn.com/i/teamlogos/nhl/500/buf.png",
  'calgary flames': "https://a.espncdn.com/i/teamlogos/nhl/500/cgy.png",
  'carolina hurricanes': "https://a.espncdn.com/i/teamlogos/nhl/500/car.png",
  'chicago blackhawks': "https://a.espncdn.com/i/teamlogos/nhl/500/chi.png",
  'colorado avalanche': "https://a.espncdn.com/i/teamlogos/nhl/500/col.png",
  'columbus blue jackets': "https://a.espncdn.com/i/teamlogos/nhl/500/cbj.png",
  'dallas stars': "https://a.espncdn.com/i/teamlogos/nhl/500/dal.png",
  'detroit red wings': "https://a.espncdn.com/i/teamlogos/nhl/500/det.png",
  'edmonton oilers': "https://a.espncdn.com/i/teamlogos/nhl/500/edm.png",
  'florida panthers': "https://a.espncdn.com/i/teamlogos/nhl/500/fla.png",
  'los angeles kings': "https://a.espncdn.com/i/teamlogos/nhl/500/la.png",
  'minnesota wild': "https://a.espncdn.com/i/teamlogos/nhl/500/min.png",
  'montreal canadiens': "https://a.espncdn.com/i/teamlogos/nhl/500/mtl.png",
  'nashville predators': "https://a.espncdn.com/i/teamlogos/nhl/500/nsh.png",
  'new jersey devils': "https://a.espncdn.com/i/teamlogos/nhl/500/nj.png",
  'new york islanders': "https://a.espncdn.com/i/teamlogos/nhl/500/nyi.png",
  'new york rangers': "https://a.espncdn.com/i/teamlogos/nhl/500/nyr.png",
  'ottawa senators': "https://a.espncdn.com/i/teamlogos/nhl/500/ott.png",
  'philadelphia flyers': "https://a.espncdn.com/i/teamlogos/nhl/500/phi.png",
  'pittsburgh penguins': "https://a.espncdn.com/i/teamlogos/nhl/500/pit.png",
  'san jose sharks': "https://a.espncdn.com/i/teamlogos/nhl/500/sj.png",
  'seattle kraken': "https://a.espncdn.com/i/teamlogos/nhl/500/sea.png",
  'st. louis blues': "https://a.espncdn.com/i/teamlogos/nhl/500/stl.png",
  'tampa bay lightning': "https://a.espncdn.com/i/teamlogos/nhl/500/tb.png",
  'toronto maple leafs': "https://a.espncdn.com/i/teamlogos/nhl/500/tor.png",
  'utah mammoth': "https://a.espncdn.com/i/teamlogos/nhl/500/utah.png",
  'vancouver canucks': "https://a.espncdn.com/i/teamlogos/nhl/500/van.png",
  'vegas golden knights': "https://a.espncdn.com/i/teamlogos/nhl/500/vgk.png",
  'washington capitals': "https://a.espncdn.com/i/teamlogos/nhl/500/wsh.png",
  'winnipeg jets': "https://a.espncdn.com/i/teamlogos/nhl/500/wpg.png",
};




var logoCache = {};
if (typeof STATIC_LOGOS_RAW !== 'undefined') {
    for (var k in STATIC_LOGOS_RAW) {
        logoCache[normName(k)] = STATIC_LOGOS_RAW[k];
    }
}
try {
    var stored = localStorage.getItem('sports_logos');
    if(stored) Object.assign(logoCache, JSON.parse(stored));
} catch(e) {}

function cacheLogo(teamName, url) {
    if(!teamName || !url) return;
    var key = normName(teamName);
    if(logoCache[key] !== url) {
        logoCache[key] = url;
        try {
            localStorage.setItem('sports_logos', JSON.stringify(logoCache));
        } catch(e) {}
    }
}

// getLogo duplicate removed. It is already defined above with better implementation.

/* ══ DOMAIN PREFS ════════════════════════ */
function getDomain(url) {
  try {
    var u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch(e) {
    return url;
  }
}

var domainPrefs = {};
try {
  var storedPrefs = localStorage.getItem('domain_prefs');
  if (storedPrefs) domainPrefs = JSON.parse(storedPrefs);
} catch(e) {}

function saveDomainPrefs() {
  try {
    localStorage.setItem('domain_prefs', JSON.stringify(domainPrefs));
  } catch(e) {}
}

function toggleDomainPref(domain, type, mid) {
  mid = getOriginalMatchId(mid);
  var current = domainPrefs[domain] || 0;
  if (type === 'fav') {
    if (current === 1) delete domainPrefs[domain];
    else domainPrefs[domain] = 1;
  } else if (type === 'dep') {
    if (current === -1) delete domainPrefs[domain];
    else domainPrefs[domain] = -1;
  }
  saveDomainPrefs();

  // Refresh the UI if necessary
  if (mid) {
    var m = S.matches.find(function(x){ return x.id === mid; });
    if(m) {
      if (document.getElementById('mbg').classList.contains('open')) {
        openMod(m);
      }
      var pbg = document.getElementById('player-bg');
      if (pbg && pbg.classList.contains('open')) {
          var iframe = document.getElementById('p-frame');
          populatePlayerSidebar(m, iframe ? iframe.dataset.url : null);
      }
    }
  }
}

function sortFluxLinks(links) {
  return links.slice().sort(function(a, b) {
    var nameA = (a.name || '').toLowerCase();
    var nameB = (b.name || '').toLowerCase();

    var isFavA = nameA.includes('sheri') || nameA.includes('4kplayer') ? 1 : 0;
    var isFavB = nameB.includes('sheri') || nameB.includes('4kplayer') ? 1 : 0;

    if (isFavA !== isFavB) {
      return isFavB - isFavA; // 1 goes before 0
    }

    var domA = getDomain(a.url);
    var domB = getDomain(b.url);
    var prefA = domainPrefs[domA] || 0;
    var prefB = domainPrefs[domB] || 0;
    if (prefA !== prefB) {
      return prefB - prefA; // Favs (1) first, dep (-1) last
    }
    return 0; // Keep original order if preferences are equal
  });
}

/* ══ CACHE STREAMS (2 hours) ══════════════ */
function getStreamCache(mid) {
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

function saveStreamCache(mid, streams) {
    try {
        localStorage.setItem('streams_' + mid, JSON.stringify({ ts: Date.now(), streams: streams }));
    } catch(e) {}
}

/* ══ FETCH SUB-PAGES (STREAMS) ════════════ */
function fetchSubPages(matches){
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

function scrapeMatchFlux(m){
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



    // MLBBite/NFLbite stream extraction
    if (m.source === 'mlbbite' || m.source === 'nflbite' || m.matchUrl.indexOf('mlbbite') >= 0 || m.matchUrl.indexOf('nflbite') >= 0) {
        var iframes = doc.querySelectorAll('iframe');
        [].forEach.call(iframes, function(ifr) {
            var src = ifr.src;
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

        var btns = doc.querySelectorAll('.stream-button, a[href*="stream"]');
        [].forEach.call(btns, function(btn) {
            if (btn.tagName === 'A' && btn.href) {
                if(!btn.href.startsWith('http') && !btn.href.startsWith('javascript')) { try { btn.href = new URL(btn.href, m.matchUrl).href; } catch(e) {} }
                if(btn.href.indexOf('http') === 0) {
                var url = btn.href;
                var name = btn.textContent.trim() || 'Stream';
                if (!url.includes('ads') && !url.includes('bet') && !url.includes('f1streamsi') && !url.includes('soccer-streams100') && !url.includes('streameast100') && url.indexOf('teams') === -1) {
                    links.push({
                        name: name,
                        quality: 'HD',
                        lang: 'MULTI',
                        url: url,
                        icon: '▶️'
                    });
                }
            }
            }
        });

        // Sometimes streams are in table rows like other sites
        var tableRows = doc.querySelectorAll('table tbody tr');
        [].forEach.call(tableRows, function(row) {
            var a = row.querySelector('a');
            if (a && a.href) {
                if(!a.href.startsWith('http') && !a.href.startsWith('javascript')) { try { a.href = new URL(a.href, m.matchUrl).href; } catch(e) {} }
                if(a.href.indexOf('http') === 0) {
                var url = a.href;
                var name = a.textContent.trim() || row.cells[0].textContent.trim() || 'Stream';
                if (!url.includes('ads') && !url.includes('bet')) {
                    links.push({
                        name: name,
                        quality: 'HD',
                        lang: 'MULTI',
                        url: url,
                        icon: '▶️'
                    });
                }
            }
            }
        });
    }


    // Nouveau scraping pour footybite.do
    // Footybite.do utilise principalement des liens directs ou cachés dans des ancres

    // Nouveau scraping pour les tables de streams sur footybite.do/.to

    // Try to find iframes directly if available (rare but possible)
    var iframes = doc.querySelectorAll('iframe');
    [].forEach.call(iframes, function(ifr) {
        var src = ifr.src;
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

    var rows = doc.querySelectorAll('tr');
    [].forEach.call(rows, function(row){
        var tds = row.querySelectorAll('td');
        if(tds.length < 2) return; // Ignore les rows qui ne ressemblent pas à notre table

        // Chercher une balise input cachée qui contient l'URL du flux
        var input = row.querySelector('input');
        var url = '';
        if(input && input.value && input.value.indexOf('http') === 0) {
            url = input.value;
        } else {
            // Check dans les href ou onClick s'il n'y a pas d'input (rare mais possible)
            var as = row.querySelectorAll('a[href]');
            for(var i=0; i<as.length; i++) {
                 if(!as[i].href.startsWith('http') && !as[i].href.startsWith('javascript')) { try { as[i].href = new URL(as[i].href, m.matchUrl).href; } catch(e) {} }
                 if(as[i].href.indexOf('http')===0) {
                     url = as[i].href;
                     break;
                 }
            }
        }

        if(url && typeof url === 'string') {
            // Filter out ad/betting domains and empty urls
            var lowerUrl = url.toLowerCase();
            if (lowerUrl.includes('1xbet') || lowerUrl.includes('bet365') || lowerUrl.includes('ads') || lowerUrl.length < 5) {
                return;
            }

            // Le nom est généralement dans la deuxième ou troisième colonne
            var name = tds[1] ? tds[1].textContent.replace(/\s+/g, ' ').trim() : 'Flux externe';
            if(!name && tds[2]) name = tds[2].textContent.replace(/\s+/g, ' ').trim();
            if(!name) name = 'Flux';
            if(name.length > 50) name = name.substring(0, 47) + '...';

            // Chercher la qualité et la langue dans le texte des tds
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

    // Fallback limité aux boutons de flux si pas de table trouvée
    if(links.length===0){
       var btns=doc.querySelectorAll('.btn-danger, a.nav-link2, a.btn-3d, a.stream-button, a[href*="/watch/"], a[href*="/live/"], a[href*="stream"]');
       [].forEach.call(btns,function(btn){
          if(btn.tagName==='A' && btn.href){
             var url=btn.href;
             if(url && !url.startsWith('http') && !url.startsWith('javascript')) { try { url = new URL(url, m.matchUrl).href; } catch(e) {} }
             if(url && url.indexOf('http')===0) {
                 var lowerUrl = url.toLowerCase();
                 if (lowerUrl.includes('1xbet') || lowerUrl.includes('bet365') || lowerUrl.includes('ads') || lowerUrl.length < 5) return;
                 var name = btn.textContent.replace(/\s+/g, ' ').trim() || 'Flux externe';
                 if(name.length > 50) name = name.substring(0, 47) + '...';
                 links.push({
                    name:name,
                    quality:'HD',
                    lang:'MULTI',
                    url:url
                 });
             }
          }
       });
    }

    // fallback: search for data- attributes that might contain links or base64 streams
    if(links.length===0) {
        var elementsWithData = doc.querySelectorAll('[data-stream], [data-url], [data-src], [data-link]');
        [].forEach.call(elementsWithData, function(el) {
            var url = el.getAttribute('data-stream') || el.getAttribute('data-url') || el.getAttribute('data-src') || el.getAttribute('data-link');
            if(url) {
                // Check if it's base64 encoded
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
    }

    // fallback: si aucun flux externe, ajouter juste un lien vers la page
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

    // Limit to 40 streams maximum to prevent UI overload, allow more streams since we are combining
    m.streamLinks = combinedLinks.slice(0, 40);
    m.streamsLoaded=true;
    saveStreamCache(m.id, m.streamLinks);
    updateMatchUiAfterScrape(m);
  });
}

function updateMatchUiAfterScrape(m) {
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
function findLeagueHeader(el) {
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
function getEstTime(ukTimeStr){
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

/* ══ FILTERS ════════════════════════════ */



function applyFilter(f){
  S.filter=f;
  ['all','live','upcoming','fav','options','logs','script'].forEach(function(k){
    var el=document.getElementById('filter-'+k);
    if(el){
        if (k===f) {
            el.classList.add('active-toggle');
            el.style.color = 'var(--text)';
        } else {
            el.classList.remove('active-toggle');
            el.style.color = 'var(--muted2)';
            el.style.borderColor = 'var(--border2)';
            el.style.background = 'var(--btn-bg)';
            el.style.boxShadow = 'var(--btn-shadow)';
        }
    }
  });
  var mvBtn = document.getElementById('mv-toggle-btn');
  if(mvBtn) {
      mvBtn.classList.remove('active-toggle');
      mvBtn.classList.remove('has-streams');
      mvBtn.style = '';
      mvBtn.style.boxShadow = 'var(--btn-shadow)';

      // Keep it red if streams are active
      if(mvFlux.length > 0) {
          mvBtn.classList.add('has-streams');
          if (userPrefs.toggleStyle === 'default' || !userPrefs.toggleStyle) {
              mvBtn.style.background = 'rgba(255, 69, 58, 0.2)';
              mvBtn.style.borderColor = 'var(--red)';
          }
          mvBtn.style.color = '#fff';
      }
  }

  // Auto pip multiview if we click on Guide or Live
  var mvc = document.getElementById('mv-container');
  if(mvc && mvc.style.display !== 'none' && !mvc.classList.contains('mv-pip')) {
      toggleMultiviewPip();
  }

  if (f === 'options') {
      openOptionsPage();
  } else if (f === 'logs') {
      openLogsPage();
  } else if (f === 'script') {
      openScriptPage();
  } else {
      var optionsPage = document.getElementById('options-page');
      if (optionsPage) optionsPage.style.display = 'none';
      var logsPage = document.getElementById('logs-page');
      if (logsPage) logsPage.style.display = 'none';
      var scriptPage = document.getElementById('script-page');
      if (scriptPage) scriptPage.style.display = 'none';
      var errbox = document.getElementById('errbox');
      if (errbox && errbox.classList.contains('show')) {
          // Do not overwrite errbox if it has a real error
      } else {
          var epgContainer = document.getElementById('epg');
          if (epgContainer) epgContainer.style.display = 'flex';
          var mareaContainer = document.getElementById('marea');
          if (mareaContainer) mareaContainer.style.display = 'flex';
          var sportFiltersContainer = document.getElementById('sport-filters-container');
          if (sportFiltersContainer) sportFiltersContainer.style.display = 'flex';
      }

          document.body.setAttribute('data-filter', f);
    if(f === 'all') {
        setTimeout(scrollToNow, 100);
    }

  }
}

function openMultiviewTab() {
    ['all','live','upcoming','fav','options','logs','script'].forEach(function(k){
      var el=document.getElementById('filter-'+k);
      if(el){
          el.classList.remove('active-toggle');
          el.style.color = 'var(--muted2)';
          el.style.borderColor = 'var(--border2)';
          el.style.background = 'var(--btn-bg)';
          el.style.boxShadow = 'var(--btn-shadow)';
      }
    });

    var mvBtn = document.getElementById('mv-toggle-btn');
    if(mvBtn) {
        mvBtn.classList.add('active-toggle');
        mvBtn.classList.remove('has-streams');
        mvBtn.style = '';
    }

    var mvc = document.getElementById('mv-container');
    if(mvc) {
        if(mvc.style.display === 'none') {
            toggleMultiview(); // Open it
        } else if(mvc.classList.contains('mv-pip')) {
            toggleMultiviewPip(); // Restore from PIP to full
        }
    }
}

function applySportFilter(sport){
  var sfContainer = document.getElementById('sport-filters');

  if(sport) {
      if (sport === 'all') {
          S.hiddenLg = {'Autres Flux': true};
      } else {
          // If we were previously showing 'all' (none hidden), first hide all EXCEPT the clicked one
          // to easily select just one league to start with.
          var allWereVisible = true;
          var sports = {};
          S.matches.forEach(function(m){ sports[m.league]=true; });
          Object.keys(sports).forEach(function(k) {
              if (k !== 'Autres Flux' && S.hiddenLg[k]) allWereVisible = false;
          });

          if (allWereVisible) {
              Object.keys(sports).forEach(function(k) {
                  if (k !== 'Autres Flux') S.hiddenLg[k] = true;
              });
              S.hiddenLg[sport] = false; // Show only clicked
          } else {
              // Otherwise toggle normally
              S.hiddenLg[sport] = !S.hiddenLg[sport];

              // If user manually unhid everything one by one, effectively it's 'all'
              var anyHidden = false;
              Object.keys(sports).forEach(function(k) {
                  if (k !== 'Autres Flux' && S.hiddenLg[k]) anyHidden = true;
              });
              if (!anyHidden) S.hiddenLg = {'Autres Flux': true};
          }
      }
  }

  if(sfContainer) {
      var anyHidden = false;
      Object.keys(S.hiddenLg).forEach(function(k) {
          if (k !== 'Autres Flux' && S.hiddenLg[k]) anyHidden = true;
      });

      var buttons = sfContainer.querySelectorAll('.sport-btn');
      buttons.forEach(function(b) {
          if (b.id === 'btn-autres-flux') return;
          var onClickStr = b.getAttribute('onclick') || '';
          if (onClickStr.indexOf("'all'") !== -1) {
              if (!anyHidden) b.classList.add('active-toggle');
              else b.classList.remove('active-toggle');
          } else {
              var m = onClickStr.match(/applySportFilter\('([^']+)'\)/);
              if (m && m[1]) {
                  var spName = m[1];
                  if (!S.hiddenLg[spName]) b.classList.add('active-toggle');
                  else b.classList.remove('active-toggle');
              }
          }
      });
  }
  setTimeout(function() { buildEPG(S.matches); }, 0);
}

/* ══ TOGGLE ET ACCORDÉON ════════════════ */
function toggleLeague(lgName) {
  S.hiddenLg[lgName] = !S.hiddenLg[lgName];

  var sfContainer = document.getElementById('sport-filters');
  if(sfContainer) {
      var anyHidden = false;
      Object.keys(S.hiddenLg).forEach(function(k) {
          if (S.hiddenLg[k]) anyHidden = true;
      });

      var btns = sfContainer.querySelectorAll('.sport-filter-btn');
      btns.forEach(function(b) {
          var onClickStr = b.getAttribute('onclick') || '';
          if (onClickStr.indexOf("toggleLeague('") > -1) {
              var m = onClickStr.match(/toggleLeague\('([^']+)'\)/);
              if (m && m[1]) {
                  var lName = m[1];
                  if (!S.hiddenLg[lName]) b.classList.add('active-toggle');
                  else b.classList.remove('active-toggle');
              }
          }
      });
  }

  // Hide/Show elements using CSS based on data attribute
  var containers = document.querySelectorAll('.marea-row, .mrow, .lg-container');
  containers.forEach(function(c) {
      var lg = c.getAttribute('data-lg');
      if (lg === lgName) {
          c.style.display = S.hiddenLg[lgName] ? 'none' : (c.classList.contains('mrow') || c.classList.contains('marea-row') ? 'flex' : 'block');
      }
  });
}

function toggleAutresFlux() {
    S.hiddenLg['Autres Flux'] = !S.hiddenLg['Autres Flux'];
    var btn = document.getElementById('btn-autres-flux');
    if(btn) {
        if (!S.hiddenLg['Autres Flux']) btn.classList.add('active-toggle');
        else btn.classList.remove('active-toggle');
    }
    var containers = document.querySelectorAll('[data-lg="Autres Flux"]');
    containers.forEach(function(c) {
        c.style.display = S.hiddenLg['Autres Flux'] ? 'none' : (c.classList.contains('mrow') || c.classList.contains('marea-row') ? 'flex' : 'block');
    });
}

function toggleAccordion(lgName) {
  S.collapsedLg[lgName] = !S.collapsedLg[lgName];
  var isC = S.collapsedLg[lgName];

  var hdrs = document.querySelectorAll('.lg-hdr[data-lg-hdr="' + lgName + '"]');
  hdrs.forEach(function(h) {
      if(isC) h.classList.add('collapsed');
      else h.classList.remove('collapsed');
  });

  var rows = document.querySelectorAll('.mrow[data-lg="' + lgName + '"]');
  rows.forEach(function(r) {
      r.style.display = isC ? 'none' : 'flex';
  });
}

/* ══ EPG / LISTE ════════════════════════ */
function getOriginalMatchId(id) {
    if (typeof id === 'string') {
        if (id.endsWith('_live_copy')) return id.replace('_live_copy', '');
        if (id.endsWith('_fav_copy')) return id.replace('_fav_copy', '');
    }
    return id;
}

function buildEPG(matches){
  // Current time minus 15 minutes to treat soon-to-start matches as "live"
  var now = new Date();
  var currentEst = getEstTimeStrFromDate(now);
  var currentParts = currentEst.split(':');
  var currentMins = parseInt(currentParts[0], 10) * 60 + parseInt(currentParts[1], 10);

  var filtered = matches.filter(function(m){
    var isLiveOrSoon = m.status === 'live';
    var isUpcomingInHour = false;
    if(m.status === 'upcoming' && m.startTime) {
        var mParts = m.startTime.split(':');
        var mMins = parseInt(mParts[0], 10) * 60 + parseInt(mParts[1], 10);

        var diff = mMins - currentMins;
        if (currentMins >= 1380 && mMins <= 60) diff += 1440; // wrap around

        // Live or soon (within 15 min or already started)
        if(diff <= 15 && diff > -1440) {
            isLiveOrSoon = true;
        } else if (diff > 15 && diff <= 60) {
            isUpcomingInHour = true;
        }
    }

    // In Live tab: show live matches and matches starting in <= 60 mins
    var isUpcomingIn60 = false;
    if (m.status === 'upcoming' && m.startTime) {
        var mParts = m.startTime.split(':');
        var mMins = parseInt(mParts[0], 10) * 60 + parseInt(mParts[1], 10);
        var diff = mMins - currentMins;
        if (currentMins >= 1380 && mMins <= 60) diff += 1440; // wrap around
        if (diff > 0 && diff <= 60) {
            isUpcomingIn60 = true;
        }
    }
    // REMOVED JS FILTERING: CSS will handle visibility via data-filter attribute instead!
    if(S.searchQuery) {
        var q = normName(S.searchQuery);
        var hN = normName(m.homeTeam);
        var aN = normName(m.awayTeam);
        var lN = normName(m.league);

        if(hN.indexOf(q) === -1 &&
           aN.indexOf(q) === -1 &&
           lN.indexOf(q) === -1 &&
           m.homeTeam.toLowerCase().indexOf(S.searchQuery) === -1 &&
           m.awayTeam.toLowerCase().indexOf(S.searchQuery) === -1 &&
           m.league.toLowerCase().indexOf(S.searchQuery) === -1) {
            return false;
        }
    }
    return true;
  });

  var epgMatches = filtered.slice();

  var lgOrder=[],lgMap={};
  epgMatches.forEach(function(m){
    if(!lgMap[m.league]){lgMap[m.league]=Object.assign({},m,{matches:[]});lgOrder.push(m.league);}
    lgMap[m.league].matches.push(m);
  });

  lgOrder.sort(function(a,b) {
      if (a === 'FAVORIS') return -1;
      if (b === 'FAVORIS') return 1;
      if (a === 'EN DIRECT') return -1;
      if (b === 'EN DIRECT') return 1;

      // Ensure 'Autres Flux' is always sorted last globally in the main feed
      if (a === 'Autres Flux') return 1;
      if (b === 'Autres Flux') return -1;

      // Custom League Order User Preference
      var idxA = customLgOrder.indexOf(a);
      var idxB = customLgOrder.indexOf(b);

      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;

      var getSortTime = function(lgMatches) {
          var active = lgMatches.filter(function(x){return x.status!=='finished';});
          if(active.length>0) {
              active.sort(function(x,y){return x.startTime.localeCompare(y.startTime);});
              return active[0].startTime;
          }
          return "99:99";
      };

      var aStart = getSortTime(lgMap[a].matches);
      var bStart = getSortTime(lgMap[b].matches);
      if (aStart !== bStart) return aStart.localeCompare(bStart);
      return a.localeCompare(b);
  });

  var leagues=lgOrder.map(function(k){
    lgMap[k].matches.sort(function(m1,m2){
        var f1 = (favTeams[m1.homeTeam] || favTeams[m1.awayTeam]) ? -1 : 0;
        var f2 = (favTeams[m2.homeTeam] || favTeams[m2.awayTeam]) ? -1 : 0;
        if(f1 !== f2) return f1 - f2;
        var w1 = m1.status==='live'?0:(m1.status==='upcoming'?1:2);
        var w2 = m2.status==='live'?0:(m2.status==='upcoming'?1:2);
        if(w1 !== w2) return w1 - w2;
        return m1.startTime.localeCompare(m2.startTime);
    });
    return lgMap[k];
  });

  var epgContainer = document.getElementById('marea');
  matchCardCache.clear();
  epgContainer.style.cssText = '';
  epgContainer.style.display = 'flex';
  epgContainer.style.flexDirection = 'column';
  epgContainer.style.gap = '24px';
  epgContainer.style.maxWidth = '1200px';
  epgContainer.style.margin = '0 auto';
  epgContainer.style.width = '100%';
  epgContainer.innerHTML = '';

  if (S.filter === 'fav' && false) { // DISABLE THE SEPARATE FAV VIEW RENDER
      epgContainer.style.display = 'flex';
      epgContainer.style.flexDirection = 'column';
      epgContainer.style.gap = '16px';
      epgContainer.style.padding = '20px';
      epgContainer.style.overflowY = 'auto';
      epgContainer.style.height = '100%';

      var searchInput = '<input type="text" id="fav-search-input" placeholder="Rechercher une équipe..." oninput="renderFavTeams()" style="padding:12px; border-radius:8px; border:1px solid var(--border); background:rgba(0,0,0,0.3); color:var(--text); font-size:16px; width:100%; max-width:400px; margin-bottom:16px;">';

      epgContainer.innerHTML = '<div style="display:flex; gap: 24px; flex-wrap: wrap;">'
                             + '<div style="flex: 2; min-width: 300px;">'
                             + '<h2>Gestion des Équipes</h2><p style="color:var(--muted); font-size:13px; margin-bottom:16px;">Sélectionnez vos équipes favorites. Leurs matchs s\'afficheront en haut de la liste.</p>' + searchInput + '<div id="fav-list-container" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:12px;"></div>'
                             + '</div>'
                             + '<div style="flex: 1; min-width: 250px;">'
                             + '<h2>Ordre des Ligues</h2><p style="color:var(--muted); font-size:13px; margin-bottom:16px;">Glissez pour modifier l\'ordre ou utilisez les flèches.</p><div id="fav-lg-container" style="display:flex; flex-direction:column; gap:8px;"></div>'
                             + '</div>'
                             + '</div>';

      window.moveLgOrder = function(dir, idx) {
          if (dir === 'up' && idx > 0) {
              var temp = customLgOrder[idx];
              customLgOrder[idx] = customLgOrder[idx-1];
              customLgOrder[idx-1] = temp;
          } else if (dir === 'down' && idx < customLgOrder.length - 1) {
              var temp = customLgOrder[idx];
              customLgOrder[idx] = customLgOrder[idx+1];
              customLgOrder[idx+1] = temp;
          }
          saveCustomLgOrder();
          window.renderFavTeams();
      };

      window.renderFavTeams = function() {
          var container = document.getElementById('fav-list-container');
          var lgContainer = document.getElementById('fav-lg-container');
          if(!container || !lgContainer) return;

          // --- Leagues Sorting Manager ---
          var mainLeagues = ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'NHL', 'NBA', 'NFL', 'MLB', 'F1', 'PWHL', 'Champions League', 'World Cup', 'LHJMQ'];

          // Use purely the static mainLeagues definition for the right menu
          var newOrder = [];

          // Retain user order if it exists, but strictly filter out non-main leagues
          customLgOrder.forEach(function(lg) {
              var fmtLg = formatLeagueName(lg);
              if (mainLeagues.findIndex(l => l.toLowerCase() === fmtLg.toLowerCase()) !== -1) {
                  newOrder.push(fmtLg);
              }
          });

          // Add any missing mainLeagues to the end
          mainLeagues.forEach(function(lg) {
              if (newOrder.findIndex(l => l.toLowerCase() === lg.toLowerCase()) === -1) {
                  newOrder.push(lg);
              }
          });

          // If it's a completely fresh load, start with mainLeagues as default order
          if (newOrder.length === 0) {
              newOrder = mainLeagues.slice();
          }

          customLgOrder = newOrder;
          saveCustomLgOrder();

          var lgHtml = '';
          customLgOrder.forEach(function(lg, i) {
              lgHtml += '<div style="display:flex; align-items:center; padding:10px 16px; background:var(--bg3); border:1px solid var(--border); border-radius:8px;">'
                     + '<span style="margin-right:12px; font-size:16px;">'+lgFlag(lg)+'</span>'
                     + '<span style="flex:1; font-weight:bold; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">'+esc(formatLeagueName(lg))+'</span>'
                     + '<div style="display:flex; flex-direction:column; gap:2px; margin-left:8px;">'
                     + '<button onclick="moveLgOrder(\'up\', '+i+')" style="background:transparent; border:none; color:'+(i===0?'var(--muted2)':'var(--text)')+'; cursor:'+(i===0?'default':'pointer')+'; font-size:14px; padding:2px;">▲</button>'
                     + '<button onclick="moveLgOrder(\'down\', '+i+')" style="background:transparent; border:none; color:'+(i===customLgOrder.length-1?'var(--muted2)':'var(--text)')+'; cursor:'+(i===customLgOrder.length-1?'default':'pointer')+'; font-size:14px; padding:2px;">▼</button>'
                     + '</div></div>';
          });
          lgContainer.innerHTML = lgHtml;


          // --- Teams Manager ---
          var searchVal = (document.getElementById('fav-search-input').value || '').toLowerCase();

          // Get unique teams
          var allTeams = {};

          // 1. Fill with static API teams ONLY (pure static db approach)
          if (typeof STATIC_TEAMS !== 'undefined') {
              STATIC_TEAMS.forEach(function(t) {
                  // Keep the first league encountered (primary domestic leagues are first in STATIC_TEAMS)
                  if (!allTeams[t.name]) {
                      allTeams[t.name] = formatLeagueName(t.league);
                  }
              });
          }

          // 2. No dynamic extraction from S.matches anymore to keep database clean.

          // Sort teams
          var teamNames = Object.keys(allTeams).sort(function(a,b) {
              // Favorites first
              if (favTeams[a] && !favTeams[b]) return -1;
              if (!favTeams[a] && favTeams[b]) return 1;

              // Sort by league
              var lA = formatLeagueName(allTeams[a]);
              var lB = formatLeagueName(allTeams[b]);

              if (lA !== lB) {
                  var idxA = customLgOrder.indexOf(lA);
                  var idxB = customLgOrder.indexOf(lB);

                  var mainLgMatchA = mainLeagues.findIndex(l => l.toLowerCase() === lA.toLowerCase()) !== -1;
                  var mainLgMatchB = mainLeagues.findIndex(l => l.toLowerCase() === lB.toLowerCase()) !== -1;

                  if (mainLgMatchA && mainLgMatchB) return idxA - idxB;
                  if (mainLgMatchA && !mainLgMatchB) return -1;
                  if (!mainLgMatchA && mainLgMatchB) return 1;

                  // Ensure 'Autres Flux' is at the bottom
                  if (lA === 'Autres Flux') return 1;
                  if (lB === 'Autres Flux') return -1;
                  return lA.localeCompare(lB);
              }

              // Sort alphabetically
              return a.localeCompare(b);
          });

          var html = '';
          var htmlAutres = '';
          var currentGroup = null;
          var inAutresAccordion = false;

          teamNames.forEach(function(t) {
              if (searchVal && t.toLowerCase().indexOf(searchVal) === -1 && allTeams[t].toLowerCase().indexOf(searchVal) === -1) return;
              var isFav = !!favTeams[t];
              var lgGroup = isFav ? 'FAVORIS' : formatLeagueName(allTeams[t]);

              var isMainLeague = false;
              if (lgGroup !== 'FAVORIS') {
                  isMainLeague = mainLeagues.findIndex(function(l) { return l.toLowerCase() === lgGroup.toLowerCase(); }) !== -1;
              }
              var isAllowed = isFav || isMainLeague;

              var strHtml = '';

              if (lgGroup !== currentGroup) {
                  strHtml += '<div style="grid-column: 1 / -1; margin-top:16px; margin-bottom:8px; font-weight:bold; font-size:14px; color:var(--muted); border-bottom:1px solid var(--border); padding-bottom:4px; display:flex; align-items:center;">';
                  strHtml += '<span style="margin-right:8px;">' + (isFav ? '⭐' : lgFlag(lgGroup)) + '</span> ' + esc(lgGroup);
                  strHtml += '</div>';
                  currentGroup = lgGroup;
              }

              var logoUrl = getLogo(t) || '';
              var logoHtml = logoUrl ? '<img src="'+esc(logoUrl)+'" style="width:24px;height:24px;object-fit:contain;margin-right:12px;" onerror="this.style.display=\'none\'">' : '<div style="width:24px;height:24px;margin-right:12px;display:flex;align-items:center;justify-content:center;font-size:12px;">🛡️</div>';

              var tColors = getTeamColors(t);
              var bgCol = tColors ? tColors[0] : 'var(--card-bg, rgba(255,255,255,0.05))';
              var textCol = tColors ? '#ffffff' : 'var(--text)';

              strHtml += '<div style="display:flex; align-items:center; padding:12px; background:'+bgCol+'; border:1px solid '+(isFav?'var(--accent)':'var(--border)')+'; border-radius:8px; cursor:pointer; transition:all 0.2s;" onclick="openGlobalStats(\''+escJs(t)+'\');">'
                   + '<button style="background:transparent;border:none;color:'+(isFav?'var(--accent)':'var(--muted)')+';font-size:20px;margin-right:12px;cursor:pointer;flex-shrink:0;text-shadow:0 1px 3px rgba(0,0,0,0.8);" onclick="toggleFavTeam(\''+escJs(t)+'\'); event.stopPropagation();">'+(isFav?'★':'☆')+'</button>'
                   + logoHtml
                   + '<div style="flex:1;min-width:0;display:flex;flex-direction:column;">'
                   + '<span style="font-weight:bold;color:'+textCol+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px rgba(0,0,0,0.8);">'+esc(t)+'</span>'
                   + '<span style="font-size:11px;color:'+(tColors?'rgba(255,255,255,0.7)':'var(--muted)')+';text-shadow:0 1px 2px rgba(0,0,0,0.8);">' + esc(allTeams[t]) + '</span>'
                   + '</div>'
                   + '</div>';

              if (isAllowed || searchVal !== '') {
                  html += strHtml;
              } else {
                  htmlAutres += strHtml;
              }
          });

          if (html === '' && htmlAutres === '') {
              html = '<div style="color:var(--muted); padding:20px; grid-column: 1 / -1;">Aucune équipe trouvée.</div>';
          }

          if (htmlAutres !== '' && searchVal === '') {
              var accordionHtml = '<div style="grid-column: 1 / -1; margin-top:24px;">'
                  + '<button onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === \'none\' ? \'grid\' : \'none\'; this.querySelector(\'span.chev\').innerHTML = this.nextElementSibling.style.display === \'none\' ? \'▼\' : \'▲\';" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border); padding:12px 16px; border-radius:8px; color:var(--text); font-weight:bold; font-size:15px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\'">'
                  + '<span style="display:flex; align-items:center; gap:8px;"><span style="font-size:18px;">🌍</span> Autres Ligues</span>'
                  + '<span class="chev" style="font-size:12px; color:var(--muted);">▼</span>'
                  + '</button>'
                  + '<div style="display:none; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:12px; margin-top:16px;">'
                  + htmlAutres
                  + '</div></div>';
              html += accordionHtml;
          }

          container.innerHTML = html;
      };

      window.renderFavTeams();
      return;
  }

  if (S.filter === 'live' || S.filter === 'upcoming') {
      epgContainer.style.display = 'block';
      epgContainer.style.padding = '0';
      epgContainer.style.overflowY = 'auto';
      epgContainer.style.height = '100%';
      epgContainer.style.WebkitOverflowScrolling = 'touch';

      var renderMatches = function(matchesToRender, container, titleStr, isCollapsible, sectionId) {
          if (!matchesToRender || matchesToRender.length === 0) return;

          var grid = document.createElement('div');
          grid.className = 'match-grid';

          if (titleStr) {
              var secTitle = document.createElement('div');
              secTitle.style.cssText = 'padding: 16px 24px 8px; font-weight: bold; font-size: 18px; color: var(--text); border-bottom: 1px solid var(--border); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;';

              if (isCollapsible) {
                  secTitle.style.cursor = 'pointer';
                  var isCollapsed = S.collapsedSections[sectionId] || false;

                  var icon = document.createElement('span');
                  icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
                  icon.style.transition = 'transform 0.2s';
                  if (isCollapsed) {
                      icon.style.transform = 'rotate(-90deg)';
                      grid.style.display = 'none';
                  }
                  secTitle.appendChild(icon);

                  secTitle.addEventListener('click', function() {
                      S.collapsedSections[sectionId] = !S.collapsedSections[sectionId];
                      if (S.collapsedSections[sectionId]) {
                          icon.style.transform = 'rotate(-90deg)';
                          grid.style.display = 'none';
                      } else {
                          icon.style.transform = '';
                          grid.style.display = '';
                      }
                  });
              }

              var textSpan = document.createElement('span');
              textSpan.textContent = titleStr;
              secTitle.appendChild(textSpan);
              container.appendChild(secTitle);
          }

          container.appendChild(grid);

          // Group by league inside this section
          var lgMap = {};
          matchesToRender.forEach(function(m) {
              if(!lgMap[m.league]){lgMap[m.league]=Object.assign({},m,{matches:[]});}
              lgMap[m.league].matches.push(m);
          });

          var lgOrder = Object.keys(lgMap);
          lgOrder.sort(function(a, b) {
              if (a === 'Autres Flux') return 1;
              if (b === 'Autres Flux') return -1;
              var idxA = customLgOrder.indexOf(a);
              var idxB = customLgOrder.indexOf(b);
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return a.localeCompare(b);
          });

          lgOrder.forEach(function(lgName) {
              var lg = lgMap[lgName];
              if(!lg || lg.matches.length === 0) return;
              if(S.hiddenLg[lg.league]) return;
              var isCollapsed = S.collapsedLg[lg.league];

              // League Header (Hidden via CSS but code remains for logic/state)
              var lHdr = document.createElement('div');
              lHdr.className = 'lg-hdr' + (isCollapsed ? ' collapsed' : '');
              lHdr.style.gridColumn = '1 / -1'; // Span full width
              lHdr.style.marginBottom = '8px';
              lHdr.style.display = 'none'; // explicitly hiding it here to satisfy requirement if CSS fails
              lHdr.innerHTML = '<svg class="lg-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>'
                + '<span class="ch-flag">'+lg.flag+'</span>'
                + '<span class="lg-title">'+esc(lg.league)+'</span>'
                + '<span class="lg-cnt">'+lg.matches.length+'</span>';
              lHdr.addEventListener('click', function(){ toggleAccordion(lg.league); });
              grid.appendChild(lHdr);

              if (!isCollapsed) {
                  lg.matches.forEach(function(m) {
                      var b = document.createElement('div');
                      b.className = 'match-card' + (m.status==='live' ? ' live' : '') + (m.status==='finished' ? ' finished' : '');
                      b.id = 'mb-'+m.id;

                  var homeTeamName = normName(m.homeTeam) || 'A';
                  var awayTeamName = normName(m.awayTeam) || 'B';
                  var homeColor = lgColor(homeTeamName);
                  var awayColor = lgColor(awayTeamName);
                  var lgCol = lg.color || lgColor(lg.league);


                  var tColorsH = getTeamColors(m.homeTeam);
                  var tColorsA = getTeamColors(m.awayTeam);
                  if (tColorsH) homeColor = tColorsH[0];
                  if (tColorsA) awayColor = tColorsA[0];

                  var cardBg = '';
                  if (userPrefs.cardColor === 'home') {
                      cardBg = homeColor;
                  } else if (userPrefs.cardColor === 'league') {
                      cardBg = lgCol;
                  } else if (userPrefs.cardColor === 'dark') {
                      cardBg = 'rgba(255,255,255,0.05)';
                  } else {
                      cardBg = 'linear-gradient(105deg, ' + homeColor + ' 53%, ' + awayColor + ' 53%)';
                  }

                  var statusHtml = '';
                  if(m.status === 'live') {
                      statusHtml = '<div class="live-indicator status-text"><span class="mb-ld"></span><span class="status-minute">'+(m.minute?esc(m.minute):'LIVE')+'</span></div>';
                  } else if(m.status === 'finished') {
                      statusHtml = '<div class="status-text"><span class="status-minute">Fin</span></div>';
                  } else {
                      statusHtml = '<div class="status-text"><span class="status-minute">'+m.startTime+'</span></div>';
                  }

                  var homeScore = m.score && typeof m.score[0] !== 'undefined' ? m.score[0] : '';
                  var awayScore = m.score && typeof m.score[1] !== 'undefined' ? m.score[1] : '';

                  var homeLogoUrl = m.homeLogo || getLogo(m.homeTeam);
                  var awayLogoUrl = m.awayLogo || getLogo(m.awayTeam);

                  var homeLogoHtmlPrime = homeLogoUrl ? '<img src="'+esc(homeLogoUrl)+'" class="prime-logo" onerror="this.style.display=\'none\'" alt="'+esc(m.homeTeam)+'">' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>';
                  var awayLogoHtmlPrime = awayLogoUrl ? '<img src="'+esc(awayLogoUrl)+'" class="prime-logo" onerror="this.style.display=\'none\'" alt="'+esc(m.awayTeam)+'">' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>';

                  var streamsBadgePrime = m.streamLinks && m.streamLinks.length>0 ? '<div class="prime-stream-count">'+m.streamLinks.length+' flux</div>' : '';
                  var lgBadge = '<div class="prime-league-badge">'+lg.flag+'</div>';

                  var homeFavBtn = '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.homeTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;padding:0;margin-right:4px;" onclick="toggleFavTeam(\''+escJs(m.homeTeam)+'\'); event.stopPropagation();">★</button>';
                  var awayFavBtn = '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.awayTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;padding:0;margin-right:4px;" onclick="toggleFavTeam(\''+escJs(m.awayTeam)+'\'); event.stopPropagation();">★</button>';

                  var logosHtml = m.awayTeam ?
                                  '<div class="prime-logo-wrapper home">' + homeLogoHtmlPrime + '</div><div class="prime-logo-wrapper away">' + awayLogoHtmlPrime + '</div>' :
                                  '<div class="prime-logo-wrapper home" style="width: 100%; display: flex; justify-content: center;">' + homeLogoHtmlPrime + '</div>';

                  var teamsHtml = m.awayTeam ?
                                  '<div class="prime-team-name" title="'+esc(m.homeTeam)+'">'+homeFavBtn+esc(m.homeTeam)+'</div><div class="prime-team-name" title="'+esc(m.awayTeam)+'">'+awayFavBtn+esc(m.awayTeam)+'</div>' :
                                  '<div class="prime-team-name" style="text-align: center; justify-content: center;" title="'+esc(m.homeTeam)+'">'+homeFavBtn+esc(m.homeTeam)+'</div>';

                  var scoresHtml = m.awayTeam ?
                                  '<div class="prime-score">'+homeScore+'</div><div class="prime-score">'+awayScore+'</div>' :
                                  '<div class="prime-score"></div>';

                  b.innerHTML = '<div class="prime-thumbnail" style="background:'+cardBg+';">'
                              +   lgBadge
                              +   streamsBadgePrime
                              +   '<div class="prime-logos">'
                              +     logosHtml
                              +   '</div>'
                              + '</div>'
                              + '<div class="prime-info">'
                              +   '<div class="prime-col-teams">'
                              +     teamsHtml
                              +   '</div>'
                              +   '<div class="prime-col-scores">'
                              +     scoresHtml
                              +   '</div>'
                              +   '<div class="prime-col-status">'
                              +     statusHtml
                              +   '</div>'
                              + '</div>';

                  b.addEventListener('click', function(){ openMod(m, lgCol); });
                  grid.appendChild(b);
              });
          }
          });
      };

      // Split live and upcoming in 60 mins and later today if filter is live
      if (S.filter === 'live') {
          var liveNow = [];
          var upNext = [];
          var laterToday = [];

          var now = new Date();
          var currentEst = getEstTimeStrFromDate(now);
          var currentParts = currentEst.split(':');
          var currentMins = parseInt(currentParts[0], 10) * 60 + parseInt(currentParts[1], 10);

          filtered.forEach(function(m) {
              if (m.status === 'live') {
                  liveNow.push(m);
              } else {
                  if (m.startTime) {
                      var mParts = m.startTime.split(':');
                      var mMins = parseInt(mParts[0], 10) * 60 + parseInt(mParts[1], 10);
                      var diff = mMins - currentMins;
                      if (currentMins >= 1380 && mMins <= 60) diff += 1440; // wrap around

                      if (diff <= 60) {
                          upNext.push(m);
                      } else {
                          laterToday.push(m);
                      }
                  } else {
                      laterToday.push(m);
                  }
              }
          });
          if (liveNow.length > 0) renderMatches(liveNow, epgContainer, "");
          if (upNext.length > 0) renderMatches(upNext, epgContainer, "À venir dans l'heure");
          if (laterToday.length > 0) renderMatches(laterToday, epgContainer, "Plus tard aujourd'hui", true, 'laterToday');
          if (liveNow.length === 0 && upNext.length === 0 && laterToday.length === 0) {
              epgContainer.innerHTML = '<div style="color:var(--muted); padding:20px; text-align:center;">Aucun match en direct pour le moment.</div>';
          }
      } else {
          // Render matches normally for upcoming
          renderMatches(filtered, epgContainer, "");
      }

  } else { // Timeline EPG

  epgContainer.style.display = 'block';
  epgContainer.style.flexDirection = '';
  epgContainer.style.maxWidth = 'none';
  epgContainer.style.margin = '0';
  epgContainer.style.width = '100%';
  epgContainer.style.height = '100%';
  epgContainer.style.overflow = 'auto'; // allow natural scrolling
  epgContainer.style.position = 'relative';

  var epgWrapper = document.createElement('div');
  epgWrapper.className = 'epg-wrapper';
  epgWrapper.id = 'epg-wrapper';

  // Ruler Row
  var rulerRow = document.createElement('div');
  rulerRow.className = 'ruler-row';

  var corner = document.createElement('div');
  corner.className = 'corner';
  corner.textContent = 'Compétition';
  rulerRow.appendChild(corner);

  var rulerTimes = document.createElement('div');
  rulerTimes.className = 'ruler-times';
  var hhtml = '';
  for(var h=0; h<=24; h++){
      hhtml += '<div class="tc">' + pad(h) + ':00</div>';
  }
  rulerTimes.innerHTML = hhtml;
  rulerRow.appendChild(rulerTimes);

  epgWrapper.appendChild(rulerRow);

  // Now Line element will be appended to the first marea so it spans down
  var nowLineAdded = false;
  var nowLineHtml = '<div class="now-line" id="nowline"></div>';

  leagues.forEach(function(lg){
    if(!lg || lg.matches.length === 0) return;
    if(S.hiddenLg[lg.league]) return;
    var isCollapsed = S.collapsedLg[lg.league];
    var lgCol = lg.color||lgColor(lg.league);

    // League Header Row
    var lHdrRow = document.createElement('div');
    lHdrRow.className = 'marea-row';
    lHdrRow.setAttribute('data-lg', lg.league);

    var lHdrCell = document.createElement('div');
    lHdrCell.className = 'lg-hdr' + (isCollapsed ? ' collapsed' : '');
    lHdrCell.setAttribute('data-lg-hdr', lg.league);
    lHdrCell.innerHTML = '<svg class="lg-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>'
      + '<span class="ch-flag">'+lg.flag+'</span>'
      + '<span class="lg-title">'+esc(lg.league)+'</span>'
      + '<span class="lg-cnt">'+lg.matches.length+'</span>';
    lHdrCell.addEventListener('click', function(){ toggleAccordion(lg.league); });

    var lHdrMarea = document.createElement('div');
    lHdrMarea.className = 'marea';
    // Add grid background to header marea as well to match
    lHdrRow.appendChild(lHdrCell);
    lHdrRow.appendChild(lHdrMarea);
    epgWrapper.appendChild(lHdrRow);

    if(!nowLineAdded) {
        lHdrMarea.innerHTML += nowLineHtml;
        nowLineAdded = true;
    }

    if(!isCollapsed) {
        lg.matches.forEach(function(m){
            var row = document.createElement('div');
            row.className = 'mrow' + (isCollapsed ? ' hidden-lg' : '');
            row.setAttribute('data-lg', lg.league);

            // Channel cell
            var homeLogoUrl = m.homeLogo || getLogo(m.homeTeam);
            var awayLogoUrl = m.awayLogo || getLogo(m.awayTeam);
            var homeLogoHtml = homeLogoUrl ? '<img src="'+esc(homeLogoUrl)+'" class="chan-logo" onerror="this.style.display=\x27none\x27">' : '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">🛡️</div>';
            var awayLogoHtml = awayLogoUrl ? '<img src="'+esc(awayLogoUrl)+'" class="chan-logo" onerror="this.style.display=\x27none\x27">' : '<div class="chan-logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;">🛡️</div>';

            var cCell = document.createElement('div');
            cCell.className = 'chan-cell';
            cCell.innerHTML = '<div class="chan-team">'
                            + '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.homeTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;" onclick=\"toggleFavTeam(\'"+escJs(m.homeTeam)+"\')\">★</button>'
                            + homeLogoHtml
                            + '<span class="ch-name" title="'+esc(m.homeTeam)+'">'+esc(m.homeTeam)+'</span></div>'
                            + '<div class="chan-team">'
                            + '<button aria-label="Favori" title="Favori" style="background:transparent;border:none;font-size:14px;cursor:pointer;color:'+(favTeams[m.awayTeam]?'var(--accent)':'var(--muted)')+';flex-shrink:0;" onclick=\"toggleFavTeam(\'"+escJs(m.awayTeam)+"\')\">★</button>'
                            + awayLogoHtml
                            + '<span class="ch-name" title="'+esc(m.awayTeam)+'">'+esc(m.awayTeam)+'</span></div>';

            var marea = document.createElement('div');
            marea.className = 'marea';

            var b = document.createElement('div');
            b.id = 'mb-'+m.id;

            var isLiveOrSoonLoc = m.status === 'live';
            if(m.status === 'upcoming' && m.startTime) {
                var mParts = m.startTime.split(':');
                var mMins = parseInt(mParts[0], 10) * 60 + parseInt(mParts[1], 10);
                var diff = mMins - currentMins;
                if (currentMins >= 1380 && mMins <= 60) diff += 1440;
                if(diff <= 15 && diff > -1440) isLiveOrSoonLoc = true;
            }

            b.className = 'mb' + (m.status==='live' ? ' live' : '') + (m.status==='finished' ? ' finished' : '');
            b.setAttribute('data-home', m.homeTeam);
            b.setAttribute('data-away', m.awayTeam);
            b.setAttribute('data-lg', lg.league);
            if (isLiveOrSoonLoc) b.classList.add('is-live');
            if (favTeams[m.homeTeam] || favTeams[m.awayTeam]) b.classList.add('is-fav');

            var homeTeamName = normName(m.homeTeam) || 'A';
            var awayTeamName = normName(m.awayTeam) || 'B';
            var homeColor = lgColor(homeTeamName);
            var awayColor = lgColor(awayTeamName);
            var tColorsH = getTeamColors(m.homeTeam);
            var tColorsA = getTeamColors(m.awayTeam);
            if (tColorsH) homeColor = tColorsH[0];
            if (tColorsA) awayColor = tColorsA[0];

            if (userPrefs.cardColor === 'home') {
                b.style.background = homeColor;
            } else if (userPrefs.cardColor === 'league') {
                b.style.background = lgCol;
            } else {
                b.style.background = 'linear-gradient(105deg, ' + homeColor + ' 53%, ' + awayColor + ' 53%)';
            }

            var homeScore = m.score && typeof m.score[0] !== 'undefined' ? m.score[0] : '';
            var awayScore = m.score && typeof m.score[1] !== 'undefined' ? m.score[1] : '';

            var matchScoreText = (homeScore !== '' && awayScore !== '') ? homeScore + ' - ' + awayScore : '';
            var timeBadge = '';

            if (m.status === 'live') {
                timeBadge = '<div class="mb-time" style="background:rgba(255,255,255,0.2);color:#fff;padding:2px 8px;border-radius:6px;font-weight:bold;">' + (m.minute ? esc(m.minute) : 'LIVE') + (matchScoreText ? ' | ' + matchScoreText : '') + '</div>';
            } else if (m.status === 'finished') {
                timeBadge = '<div class="mb-time" style="background:rgba(255,255,255,0.1);color:#fff;padding:2px 8px;border-radius:6px;font-weight:bold;">Terminé' + (matchScoreText ? ' | ' + matchScoreText : '') + '</div>';
            } else {
                timeBadge = '<div class="mb-time" style="padding:2px 8px;border-radius:6px;font-weight:bold;background:rgba(0,0,0,0.3);">' + m.startTime + '</div>';
            }

            var streamsBadge = m.streamLinks && m.streamLinks.length>0 ? '<div class="mb-sn">'+m.streamLinks.length+' flux</div>' : '';

            if (m.awayTeam) {
                b.innerHTML = '<div class="mb-teams" style="flex-direction: row; justify-content: space-between; align-items: center; gap: 12px;">'
                            +   '<div class="mb-team-row" style="flex: 1; justify-content: flex-end; text-align: right; width: auto;">'
                            +     '<div class="mb-t" style="text-align: right;" title="'+esc(m.homeTeam)+'">'+esc(m.homeTeam)+'</div>'
                            +     homeLogoHtml
                            +   '</div>'
                            +   '<div class="mb-team-row" style="flex: 1; justify-content: flex-start; text-align: left; width: auto;">'
                            +     awayLogoHtml
                            +     '<div class="mb-t" title="'+esc(m.awayTeam)+'">'+esc(m.awayTeam)+'</div>'
                            +   '</div>'
                            + '</div>'
                            + '<div class="mb-m" style="justify-content: center; margin-top: 4px;">'+timeBadge+streamsBadge+'</div>';
            } else {
                b.innerHTML = '<div class="mb-teams" style="flex-direction: row; justify-content: center; align-items: center; gap: 12px;">'
                            +   '<div class="mb-team-row" style="flex: 1; justify-content: center; text-align: center; width: auto;">'
                            +     homeLogoHtml
                            +     '<div class="mb-t" style="text-align: center;" title="'+esc(m.homeTeam)+'">'+esc(m.homeTeam)+'</div>'
                            +   '</div>'
                            + '</div>'
                            + '<div class="mb-m" style="justify-content: center; margin-top: 4px;">'+timeBadge+streamsBadge+'</div>';
            }

            // Calculate position via CSS vars
            var parts = m.startTime.split(':');
            var mH = parseInt(parts[0], 10);
            var mM = parseInt(parts[1], 10);

            var duration = m.durationMinutes || 105;
            if (m.status === 'live') {
                var matchStartMins = mH * 60 + mM;
                var tempCurrentMins = currentMins;
                if (tempCurrentMins < matchStartMins && (matchStartMins - tempCurrentMins) > 12 * 60) {
                    tempCurrentMins += 24 * 60; // wrap around midnight
                } else if (matchStartMins < tempCurrentMins && (tempCurrentMins - matchStartMins) > 12 * 60) {
                    matchStartMins += 24 * 60; // match start is near midnight previous day
                }
                var matchEndMins = matchStartMins + duration;
                if (tempCurrentMins > matchEndMins - 15) {
                    duration = (tempCurrentMins - matchStartMins) + 15;
                }
            }

            b.style.setProperty('--start-h', mH);
            b.style.setProperty('--start-m', mM);
            b.style.setProperty('--duration-m', duration);
            // Fallback for older browsers
            b.style.left = 'calc((var(--start-h) * var(--hour-px)) + (var(--start-m) * var(--min-px)))';
            b.style.width = 'calc(var(--duration-m) * var(--min-px))';

            b.addEventListener('click', function(){ openMod(m, lgCol); });
            marea.appendChild(b);

            row.appendChild(cCell);
            row.appendChild(marea);
            epgWrapper.appendChild(row);
        });
    }
  });

  epgContainer.appendChild(epgWrapper);

  // Note: we can remove the old gl/glh DOM grid lines because we added repeating-linear-gradient in CSS!
  } // End of else block for timeline EPG

  /* Legend Toggle Bar */
  var bar=document.getElementById('sbar');
  if (bar) bar.querySelectorAll('.lchip,.vsep:not(:first-child)').forEach(function(e){e.remove();});

  var allLeaguesMap = {};
  matches.forEach(function(m){
      if(m.league !== 'EN DIRECT') {
          allLeaguesMap[m.league] = {flag: m.flag, color: m.color};
      }
  });
  var allLeagues = Object.keys(allLeaguesMap).sort();

  if(bar) allLeagues.forEach(function(lgName,i){
    if(i>0){var s=document.createElement('div');s.className='vsep';bar.appendChild(s);}
    var ch=document.createElement('div');
    ch.className='lchip' + (S.hiddenLg[lgName] ? ' off' : '');
    ch.innerHTML='<div class="ldotc" style="background:'+(allLeaguesMap[lgName].color||lgColor(lgName))+'"></div>'+allLeaguesMap[lgName].flag+' '+esc(lgName);
    ch.addEventListener('click', function() { toggleLeague(lgName); });
    bar.appendChild(ch);
  });



  updateNowLine();

  // Center to current time on first load if applicable
  if(!window.initialScrollDone) {
      setTimeout(scrollToNow, 100);
      window.initialScrollDone = true;
  }
}

function updateNowLine() {
    var line = document.getElementById('nowline');
    if(!line) return;

    var now = new Date();
    var isToday = (TARGET_DATE.toDateString() === now.toDateString());

    if(isToday) {
        var estStr = getEstTimeStrFromDate(now);
        var parts = estStr.split(':');
        var h = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10);

        line.style.setProperty('--now-h', h);
        line.style.setProperty('--now-m', m);
        line.style.display = 'block';
        line.setAttribute('data-t', estStr);
    } else {
        line.style.display = 'none';
    }
}

setInterval(updateNowLine, 60000);

function scrollToNow(){
    var epgContainer = document.getElementById('epg');
    if(!epgContainer || S.view !== 'epg' || epgContainer.style.display === 'none') return;

    var now = new Date();
    var isToday = (TARGET_DATE.toDateString() === now.toDateString());
    if(!isToday) return;

    var rootStyles = getComputedStyle(document.documentElement);
    var hourPx = parseFloat(rootStyles.getPropertyValue('--hour-px')) || (window.innerWidth <= 768 ? 140 : 220);
    var minPx = hourPx / 60;

    var estStr = getEstTimeStrFromDate(now);
    var parts = estStr.split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);

    var w = epgContainer.clientWidth;
    var chanW = parseFloat(rootStyles.getPropertyValue('--chan-w')) || (window.innerWidth <= 768 ? 100 : 240);
    var leftPx = (h * hourPx) + (m * minPx) + chanW;

    epgContainer.scrollLeft = Math.max(0, leftPx - (w / 2));
}


/* ══ MODAL ══════════════════════════════ */
var QC={'HD':'bHD','SD':'bSD','4K':'b4K','4k':'b4K'};
var QI={'HD':'📺','SD':'📱','4K':'🖥','4k':'🖥'};

function renderFluxItem(s, i, m) {
    var ev="openFlux(event,'"+escJs(encodeURIComponent(s.url||'#'))+"','"+escJs(encodeURIComponent(s.name||'Flux'))+"','"+escJs(m.id)+"')";

    var addMvEv = "";
    if (window.multiviewPendingAction && window.multiviewPendingAction.type === 'replace') {
        addMvEv = "mvFlux[" + window.multiviewPendingAction.replaceIdx + "].url='" + escJs(s.url||'#') + "'; mvFlux[" + window.multiviewPendingAction.replaceIdx + "].name='" + escJs(m.homeTeam) + " vs " + escJs(m.awayTeam) + "'; mvFlux[" + window.multiviewPendingAction.replaceIdx + "].mid='" + escJs(m.id) + "'; saveMultivisionState(); updateMultivisionLayout(); window.multiviewPendingAction=null; closeMod(); event.stopPropagation(); event.preventDefault();";
    } else if (window.multiviewPendingAction && window.multiviewPendingAction.type === 'add') {
        addMvEv = "addToMultivision('"+escJs(s.url||'#')+"','"+escJs(m.homeTeam)+' vs '+escJs(m.awayTeam)+"', '"+escJs(m.id)+"'); window.multiviewPendingAction=null; closeMod(); event.stopPropagation(); event.preventDefault();";
    } else {
        addMvEv = "addToMultivision('"+escJs(s.url||'#')+"','"+escJs(m.homeTeam)+' vs '+escJs(m.awayTeam)+"', '"+escJs(m.id)+"'); closeMod(); event.stopPropagation(); event.preventDefault();";
    }

    var dom = getDomain(s.url);
    var pref = domainPrefs[dom] || 0;
    var favEv = "toggleDomainPref('"+escJs(dom)+"', 'fav', '"+escJs(m.id)+"');event.stopPropagation();event.preventDefault();";
    var depEv = "toggleDomainPref('"+escJs(dom)+"', 'dep', '"+escJs(m.id)+"');event.stopPropagation();event.preventDefault();";

    return '<div class="si">'
      +'<a href="#" onclick="'+ev+'" style="flex:1;min-width:0;display:flex;align-items:center;gap:16px;padding:16px;color:var(--text);text-decoration:none;">'
      +'<div class="si-ic">'+(s.icon||QI[s.quality]||'📺')+'</div>'
      +'<div class="si-inf"><div class="si-n">'+esc(s.name||'Flux '+(i+1))+'</div>'
      +'<div class="si-s">'+(i===0?'Recommandé':'Alternatif')+'</div></div>'
      +'<span class="sbadge '+(QC[s.quality]||'bSD')+'">'+(s.quality||'SD')+'</span>'
      +'</a>'
      +'<div style="display:flex;flex-direction:column;border-left:1px solid rgba(255,255,255,0.08);flex-shrink:0;width:40px;">'
        +'<button title="Prioriser ce domaine" aria-label="Prioriser ce domaine" onclick="'+favEv+'" style="flex:1;background:'+(pref===1?'var(--accent)':'rgba(255,255,255,0.02)')+';border:none;border-bottom:1px solid rgba(255,255,255,0.08);color:'+(pref===1?'#fff':'var(--muted)')+';cursor:pointer;font-size:14px;transition:all 0.2s;display:flex;align-items:center;justify-content:center;">⭐</button>'
        +'<button title="Déprioriser ce domaine" aria-label="Déprioriser ce domaine" onclick="'+depEv+'" style="flex:1;background:'+(pref===-1?'var(--red)':'rgba(255,255,255,0.02)')+';border:none;color:'+(pref===-1?'#fff':'var(--muted)')+';cursor:pointer;font-size:14px;transition:all 0.2s;display:flex;align-items:center;justify-content:center;">👎</button>'
      +'</div>'
      +'<button title="Ajouter au Multivision" aria-label="Ajouter au Multivision" onclick="'+addMvEv+'" style="background:rgba(255,255,255,0.02);border:none;border-left:1px solid rgba(255,255,255,0.08);color:var(--text);width:50px;cursor:pointer;transition:background 0.2s;flex-shrink:0;font-size:20px;display:flex;align-items:center;justify-content:center;">⊞</button>'
      +'</div>';
}

function openMod(m,col){
  document.getElementById('mdot').style.background=col||'#888';
  document.getElementById('mname').textContent=m.homeTeam+' — '+m.awayTeam;
  document.getElementById('mmeta').innerHTML=
    '<span class="mtag">'+m.flag+' '+esc(m.league)+'</span>'
    +'<span class="mtag">'+esc(m.startTime)+'</span>'
    +(m.status==='live'?'<span class="mtag" style="color:var(--red);background:rgba(255,59,59,.1)">🔴 '+(m.minute?esc(m.minute)+"'":'EN DIRECT')+'</span>':'');
  document.getElementById('mscore').innerHTML=m.score?'<div class="msc">'+m.score[0]+'–'+m.score[1]+'</div>':'';

  if (window.modalStatsInterval) { clearInterval(window.modalStatsInterval); window.modalStatsInterval = null; }

  function fetchAndRenderModalStats() {
      if (m.id && (m.id.startsWith('espn_') || m.id.startsWith('api_'))) {
          fetchGameStats(m.id).then(function(res) {
              var scoreCont = document.getElementById('mscore');
              if (!scoreCont || document.getElementById('mname').textContent.indexOf(m.homeTeam) === -1) {
                  if (window.modalStatsInterval) { clearInterval(window.modalStatsInterval); window.modalStatsInterval = null; }
                  return;
              }

              var mHomeId = null, mAwayId = null;
              if (res.data && res.data.header && res.data.header.competitions && res.data.header.competitions[0] && res.data.header.competitions[0].competitors) {
                  var c = res.data.header.competitions[0].competitors;
                  var hC = c.find(function(x) { return x.homeAway === 'home'; });
                  var aC = c.find(function(x) { return x.homeAway === 'away'; });
                  if(hC) mHomeId = hC.id;
                  if(aC) mAwayId = aC.id;
              }

              var extraHtml = '';
              if (res.scorers && res.scorers.length > 0) {
                  extraHtml += renderScorersHtml(res.scorers, m, mHomeId, mAwayId);
              }
              if (res.hRank || res.aRank || res.hForm || res.aForm) {
                  extraHtml += '<div style="display:flex; justify-content:space-between; width:100%; font-size:11px; color:rgba(255,255,255,0.5); margin-top:10px;">';
                  extraHtml += '<div>' + (res.hRank ? '#' + res.hRank + ' ' : '') + (res.hForm ? '[' + res.hForm + ']' : '') + '</div>';
                  extraHtml += '<div>' + (res.aRank ? '#' + res.aRank + ' ' : '') + (res.aForm ? '[' + res.aForm + ']' : '') + '</div>';
                  extraHtml += '</div>';
              }

              var existingStats = document.getElementById('modal-extra-stats');
              if (existingStats) existingStats.remove();

              if (extraHtml) {
                  var stDiv = document.createElement('div');
                  stDiv.id = 'modal-extra-stats';
                  stDiv.style.cssText = 'padding:15px; width:100%; background:rgba(0,0,0,0.2); border-bottom:1px solid rgba(255,255,255,0.05);';
                  stDiv.innerHTML = '<div style="max-width:400px; margin:0 auto;">' + extraHtml + '</div>';
                  // Prepend inside mbody so it spans full width and looks clean before the links
                  var mbody = document.getElementById('mbody');
                  mbody.insertBefore(stDiv, mbody.firstChild);
              }
          }).catch(function(e) {});
      }
  }

  fetchAndRenderModalStats();
  if (window.modalStatsInterval) clearInterval(window.modalStatsInterval);
  if (m.status === 'live') {
      window.modalStatsInterval = setInterval(fetchAndRenderModalStats, 60000);
  }

  var addMvBtn = document.createElement('button');
  addMvBtn.className = 'btn o';
  addMvBtn.style.marginTop = '12px';
  addMvBtn.style.alignSelf = 'flex-start';
  addMvBtn.innerHTML = '⊞ Ajouter au Multivision (Attente du flux)';
  addMvBtn.id = 'mv-add-btn';
  addMvBtn.disabled = true;
  document.getElementById('mmeta').appendChild(addMvBtn);

  var body=document.getElementById('mbody');

  // Wait if streams are still loading, but fetch them specifically if they aren't loading
  if(!m.streamsLoaded && m.matchUrl) {
      body.innerHTML='<div style="text-align:center;padding:20px;color:var(--muted2);">Chargement asynchrone des streams... <span style="font-size: 0.8em; opacity: 0.5;">(Patientez, ne bloque pas)</span></div>';
      document.getElementById('mbg').classList.add('open');

      // Force load the streams for this specific match right away if they aren't loaded yet
      lg('Force loading flux', m.homeTeam);
      scrapeMatchFlux(m).then(function() {
          lg('Force loaded flux ok', m.homeTeam);
          m.streamsLoaded = true;
          if (document.getElementById('mbg').classList.contains('open') && document.getElementById('mname').textContent.indexOf(m.homeTeam) >= 0) {
              openMod(m, col); // Re-render modal only if still open and matching
          }
      }).catch(function(e) {
          lg('Force loaded flux failed', e.message);
          m.streamsLoaded = true;
          if (document.getElementById('mbg').classList.contains('open') && document.getElementById('mname').textContent.indexOf(m.homeTeam) >= 0) {
              openMod(m, col); // Re-render modal only if still open and matching
          }
      });
  } else if(!m.streamsLoaded){
      body.innerHTML='<div style="text-align:center;padding:20px;color:var(--muted2);">Chargement des streams...</div>';
      document.getElementById('mbg').classList.add('open');
  } else {
      var sortedLinks = [];
      if (m.streamLinks && m.streamLinks.length > 0) {
          sortedLinks = sortFluxLinks(m.streamLinks);
      }

      var mvBtn = document.getElementById('mv-add-btn');
      if(mvBtn && sortedLinks.length > 0) {
          mvBtn.disabled = false;
          mvBtn.innerHTML = '⊞ Ajouter au Multivision (' + esc(m.homeTeam) + ')';
          mvBtn.onclick = function() {
              addToMultivision(sortedLinks[0].url, m.homeTeam + ' vs ' + m.awayTeam, m.id);
              closeMod();
          };
      } else if (mvBtn) {
          mvBtn.style.display = 'none';
      }

      var contentHtml = '';
      if (sortedLinks.length === 0) {
          contentHtml = '<div style="text-align:center;padding:20px;color:var(--muted2);">Aucun flux trouvé.<br>';
          if (m.matchUrl) {
              contentHtml += '<a href="'+esc(m.matchUrl)+'" target="_blank" style="color:var(--accent);margin-top:10px;display:inline-block;">Ouvrir la page du match</a>';
          }
          contentHtml += '</div>';
      } else {
          contentHtml = sortedLinks.map(function(s,i){
              return renderFluxItem(s, i, m);
          }).join('');
      }

      // Fallback manual links search
      contentHtml += '<div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">';
      contentHtml += '<details style="color: var(--muted); cursor: pointer;"><summary style="outline:none; font-weight: 500;">Recherche manuelle & Sites de base (Fallback)</summary>';
      contentHtml += '<div style="padding: 10px 0; display: flex; flex-wrap: wrap; gap: 8px;">';

      var searchQuery = encodeURIComponent(m.homeTeam + ' ' + m.awayTeam);
      var singleTeam = encodeURIComponent(m.homeTeam);

      var baseSites = [
          { name: 'Buffstreams', url: 'https://buffstreams.com.co/' },
          { name: 'Footybite', url: 'https://footybite.to/' },
          { name: 'Streameast', url: 'https://naturallyyou.fit/' },
          { name: 'VIPLeague', url: 'https://vipleague.io/' },
          { name: 'Totalsportek', url: 'https://www.totalsportek-real.com/' },
          { name: 'Sportsurge', url: 'https://v2.sportsurge.net/home5/' }
      ];

      baseSites.forEach(function(site) {
          contentHtml += '<a href="'+site.url+'" target="_blank" class="mtag" style="background: rgba(255,255,255,0.05); color: #fff; text-decoration: none;">'+site.name+' 🔗</a>';
      });
      contentHtml += '</div>';

      contentHtml += '<div style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">';
      contentHtml += '<div style="font-size: 12px; margin-bottom: 8px;">Ajouter un flux manuellement au Multiview (m3u8, iframe, url):</div>';
      contentHtml += '<div style="display:flex; gap: 8px;">';
      contentHtml += '<input type="text" id="manual-flux-input" placeholder="https://..." style="flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:4px; padding:6px;">';
      contentHtml += '<button class="btn o" onclick="var v=document.getElementById(\'manual-flux-input\').value; if(v){ addToMultivision(v, \''+escJs(m.homeTeam)+' vs '+escJs(m.awayTeam)+'\', \''+escJs(m.id)+'\'); closeMod(); }">Ajouter ⊞</button>';
      contentHtml += '</div></div>';

      // Look for scraped links that didn't merge
      var unmerged = (S.matches || []).filter(function(x) {
          return x.id.startsWith('scraped_') || x.id.startsWith('bs_') || x.id.startsWith('se_') || x.id.startsWith('ts_') || x.id.startsWith('vip_');
      });
      var possibleMatches = [];
      var mH = normName(m.homeTeam);
      var mA = normName(m.awayTeam);

      unmerged.forEach(function(u) {
          if (u.id === m.id || u.league !== 'Autres Flux') return; // ignore self or already merged ones
          var uH = normName(u.homeTeam);
          var uA = normName(u.awayTeam);
          // Very loose fuzzy match for suggestions
          if (isMatch(mH, uH) || isMatch(mH, uA) || isMatch(mA, uH) || isMatch(mA, uA)) {
              possibleMatches.push(u);
          }
      });

      if (possibleMatches.length > 0) {
          contentHtml += '<div style="margin-top: 15px;">';
          contentHtml += '<div style="font-size: 12px; margin-bottom: 8px; color: var(--accent);">Flux isolés pouvant correspondre :</div>';
          contentHtml += '<div style="display: flex; flex-direction: column; gap: 8px;">';
          possibleMatches.forEach(function(pm) {
              contentHtml += '<div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">';
              contentHtml += '<div style="font-size: 12px;">' + esc(pm.homeTeam) + ' vs ' + esc(pm.awayTeam) + ' <span style="opacity:0.5;">('+esc(pm.source)+')</span></div>';
              if (pm.matchUrl) {
                  contentHtml += '<button class="btn o" style="padding: 4px 8px; font-size: 11px;" onclick="addToMultivision(\''+escJs(pm.matchUrl)+'\', \''+escJs(pm.homeTeam)+' vs '+escJs(pm.awayTeam)+'\', \''+escJs(pm.id)+'\'); closeMod();">Lancer ⊞</button>';
              }
              contentHtml += '</div>';
          });
          contentHtml += '</div></div>';
      }

      contentHtml += '</details></div>';

      body.innerHTML = contentHtml;
      document.getElementById('mbg').classList.add('open');
  }
}
function closeMod(){
  document.getElementById('mbg').classList.remove('open');
  window.multiviewPendingAction = null;
  if (window.modalStatsInterval) { clearInterval(window.modalStatsInterval); window.modalStatsInterval = null; }
}

/* ══ MULTIVISION (SPLIT SCREEN) ═════════ */

/* ══ MULTIVIEW GAME MODE ═══════════════ */
var mvGameModeActive = false;
var mvGameModeInterval = null;
var gmCurrentTab = 'stats'; // 'stats' | 'scores'
var gmPinnedMatches = JSON.parse(localStorage.getItem('gmPinnedMatches') || '[]');
var globalStatsInterval = null;
var currentGlobalStatsMatchId = null;
var activeMvStatsCards = [];

function toggleMvGameMode() {
    mvGameModeActive = !mvGameModeActive;
    var mvContainer = document.getElementById('mv-container');
    var gmBtn = document.getElementById('mv-gm-btn');

    if (mvGameModeActive) {
        if (gmBtn) {
            gmBtn.style.background = 'rgba(255,69,58,0.2)';
            gmBtn.style.borderColor = 'rgba(255,69,58,0.4)';
            gmBtn.style.color = '#fff';
        }

        // Add stats sidebar to multiview if not present
        if (!document.getElementById('mv-stats-sidebar')) {
            var statsSidebar = document.createElement('div');
            statsSidebar.id = 'mv-stats-sidebar';
            statsSidebar.style.cssText = 'width: 350px; background: rgba(20, 20, 20, 0.95); border-left: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; transition: width 0.3s;';

            var headerHtml = '<div style="display:flex; border-bottom:1px solid rgba(255,255,255,0.1); padding:0;">' +
                             '<button id="gm-tab-stats" class="gm-tab active" onclick="switchGmTab(\'stats\')" style="flex:1; background:none; border:none; color:#fff; padding:15px 0; cursor:pointer; font-weight:bold; border-bottom: 2px solid var(--accent);">Stats du Match</button>' +
                             '<button id="gm-tab-scores" class="gm-tab" onclick="switchGmTab(\'scores\')" style="flex:1; background:none; border:none; color:var(--muted); padding:15px 0; cursor:pointer; font-weight:bold; border-bottom: 2px solid transparent;">Scores Live</button>' +
                             '</div>';

            var contentHtml = '<div id="gm-content-wrapper" style="flex:1; overflow-y:auto; padding:15px;">' +
                              '<div id="mv-stats-content" style="color:var(--muted); font-size:13px; text-align:center; padding-top:20px;">Chargement...</div>' +
                              '<div id="mv-scores-content" style="display:none; color:var(--muted); font-size:13px; text-align:center; padding-top:20px;">Chargement...</div>' +
                              '</div>';

            statsSidebar.innerHTML = headerHtml + contentHtml;

            var gridWrapper = document.getElementById('mv-grid-wrapper');
            if (gridWrapper) {
                gridWrapper.appendChild(statsSidebar);
            }
        } else {
            document.getElementById('mv-stats-sidebar').style.display = 'flex';
            document.getElementById('mv-stats-sidebar').style.width = '350px';
        }

        updateGmCurrentTab();
        if (typeof mvGameModeInterval !== 'undefined' && mvGameModeInterval) clearInterval(mvGameModeInterval);
        mvGameModeInterval = setInterval(updateGmCurrentTab, 30000); // Update every 30s
    } else {
        if (gmBtn) {
            gmBtn.style.background = '';
            gmBtn.style.borderColor = '';
            gmBtn.style.color = '';
        }

        var statsSidebar = document.getElementById('mv-stats-sidebar');
        if (statsSidebar) {
            statsSidebar.style.display = 'none';
            statsSidebar.style.width = '0px';
        }

        if (mvGameModeInterval) {
            clearInterval(mvGameModeInterval);
            mvGameModeInterval = null;
        }
    }
}

function switchGmTab(tab) {
    gmCurrentTab = tab;

    var tabStats = document.getElementById('gm-tab-stats');
    var tabScores = document.getElementById('gm-tab-scores');
    var contentStats = document.getElementById('mv-stats-content');
    var contentScores = document.getElementById('mv-scores-content');

    if (tab === 'stats') {
        if(tabStats) { tabStats.style.color = '#fff'; tabStats.style.borderBottomColor = 'var(--accent)'; }
        if(tabScores) { tabScores.style.color = 'var(--muted)'; tabScores.style.borderBottomColor = 'transparent'; }
        if(contentStats) contentStats.style.display = 'block';
        if(contentScores) contentScores.style.display = 'none';
        updateMvGameModeStats();
    } else {
        if(tabScores) { tabScores.style.color = '#fff'; tabScores.style.borderBottomColor = 'var(--accent)'; }
        if(tabStats) { tabStats.style.color = 'var(--muted)'; tabStats.style.borderBottomColor = 'transparent'; }
        if(contentScores) contentScores.style.display = 'block';
        if(contentStats) contentStats.style.display = 'none';
        updateGmScoresTab();
    }
}

function toggleGmPinMatch(matchId, e) {
    if (e) e.stopPropagation();
    matchId = String(matchId);
    var idx = gmPinnedMatches.indexOf(matchId);
    if (idx > -1) {
        gmPinnedMatches.splice(idx, 1);
    } else {
        gmPinnedMatches.push(matchId);
    }
    localStorage.setItem('gmPinnedMatches', JSON.stringify(gmPinnedMatches));
    updateGmScoresTab();
}

function updateGmScoresTab() {
    if (!mvGameModeActive) return;

    var content = document.getElementById('mv-scores-content');
    if (!content) return;

    var liveMatches = S.matches.filter(function(m) {
        return (m.status === 'live' || gmPinnedMatches.indexOf(String(m.id)) > -1) && m.league !== 'Autres Flux';
    });

    if (liveMatches.length === 0) {
        content.innerHTML = '<div style="padding:20px; text-align:center;">Aucun match en direct pour le moment.</div>';
        return;
    }

    // Sort: Pinned first, then by time/league
    liveMatches.sort(function(a, b) {
        var aPin = gmPinnedMatches.indexOf(String(a.id)) > -1 ? 1 : 0;
        var bPin = gmPinnedMatches.indexOf(String(b.id)) > -1 ? 1 : 0;
        if (aPin !== bPin) return bPin - aPin;
        if (a.league !== b.league) return a.league.localeCompare(b.league);
        return a.startTime.localeCompare(b.startTime);
    });

    var html = '<div style="display:flex; flex-direction:column; gap:10px;">';

    liveMatches.forEach(function(m) {
        var isPinned = gmPinnedMatches.indexOf(String(m.id)) > -1;
        var pinIcon = isPinned ? '📌' : '📍';
        var pinColor = isPinned ? 'var(--accent)' : 'var(--muted)';

        var scoreStr = m.score ? (m.score[0] + ' - ' + m.score[1]) : 'À venir';
        var timeStr = (m.status === 'live' && m.minute) ? m.minute + "'" : m.startTime;
        var statusColor = m.status === 'live' ? 'var(--accent)' : 'var(--muted)';

        html += '<div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:10px; display:flex; align-items:center; gap:10px;">';

        html += '<div style="flex:1;">';
        html += '<div style="font-size:11px; color:var(--muted); margin-bottom:4px;">' + m.flag + ' ' + esc(m.league) + '</div>';

        html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">';
        html += '<div style="font-size:13px; font-weight:bold; color:#fff; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(m.homeTeam) + '</div>';
        html += '<div style="font-size:14px; font-weight:bold; color:' + statusColor + '; min-width:30px; text-align:right;">' + (m.score ? m.score[0] : '-') + '</div>';
        html += '</div>';

        html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
        html += '<div style="font-size:13px; font-weight:bold; color:#fff; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(m.awayTeam) + '</div>';
        html += '<div style="font-size:14px; font-weight:bold; color:' + statusColor + '; min-width:30px; text-align:right;">' + (m.score ? m.score[1] : '-') + '</div>';
        html += '</div>';

        html += '<div style="font-size:11px; color:' + statusColor + '; margin-top:4px; text-align:right;">' + timeStr + '</div>';
        html += '</div>'; // End flex:1

        html += '<button onclick="toggleGmPinMatch(\'' + m.id + '\', event)" style="background:none; border:none; cursor:pointer; font-size:16px; color:' + pinColor + '; padding:5px; transition:transform 0.2s;" onmouseover="this.style.transform=\'scale(1.2)\'" onmouseout="this.style.transform=\'none\'" title="Épingler le match">' + pinIcon + '</button>';

        html += '</div>'; // End card
    });

    html += '</div>';
    content.innerHTML = html;
}

function updateGmCurrentTab() {
    if (gmCurrentTab === 'stats') {
        updateMvGameModeStats();
    } else {
        updateGmScoresTab();
    }
}

function closePinnedStats(matchId) {
    var idx = activeMvStatsCards.indexOf(String(matchId));
    if (idx > -1) {
        activeMvStatsCards.splice(idx, 1);
        updateMvGameModeStats();
    }
}

function openPinnedStats(matchId) {
    if (!mvGameModeActive) return;
    var idx = activeMvStatsCards.indexOf(String(matchId));
    if (idx === -1) {
        activeMvStatsCards.push(String(matchId));
    }
    updateMvGameModeStats();
    setTimeout(function() {
        var container = document.getElementById('mv-stats-carousel');
        if (container) {
            container.scrollLeft = container.scrollWidth;
        }
    }, 100);
}

function updateMvGameModeStats() {
    if (!mvGameModeActive) return;

    var content = document.getElementById('mv-stats-content');
    if (!content) return;

    var pinnedHtml = '';
    if (gmPinnedMatches.length > 0) {
        var pinnedList = S.matches.filter(function(m) { return gmPinnedMatches.indexOf(String(m.id)) > -1; });
        if (pinnedList.length > 0) {
            pinnedHtml += '<div style="margin-bottom: 15px;">';
            pinnedHtml += '<h4 style="color:#fff; margin-bottom:10px; font-size:14px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">Matchs Épinglés</h4>';
            pinnedHtml += '<div style="display:flex; flex-direction:column; gap:8px;">';
            pinnedList.forEach(function(pm) {
                var scoreStr = pm.score ? (pm.score[0] + ' - ' + pm.score[1]) : 'À venir';
                var timeStr = (pm.status === 'live' && pm.minute) ? pm.minute + "'" : pm.startTime;
                var statusColor = pm.status === 'live' ? 'var(--accent)' : 'var(--muted)';
                pinnedHtml += '<div onclick="openPinnedStats(\'' + pm.id + '\')" style="background:rgba(255,255,255,0.05); border-radius:8px; padding:10px; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\'">';
                pinnedHtml += '<div style="font-size:11px; color:var(--muted); margin-bottom:4px;">' + pm.flag + ' ' + esc(pm.league) + '</div>';
                pinnedHtml += '<div style="display:flex; justify-content:space-between; align-items:center;">';
                pinnedHtml += '<div style="font-size:13px; font-weight:bold; color:#fff;">' + esc(pm.homeTeam) + ' - ' + esc(pm.awayTeam) + '</div>';
                pinnedHtml += '<div style="font-size:14px; font-weight:bold; color:' + statusColor + ';">' + scoreStr + '</div>';
                pinnedHtml += '</div>';
                pinnedHtml += '<div style="font-size:11px; color:' + statusColor + '; margin-top:4px; text-align:right;">' + timeStr + '</div>';
                pinnedHtml += '</div>';
            });
            pinnedHtml += '</div></div>';
        }
    }

    var matchCardsToFetch = [];
    var mainMatchId = null;

    if (activeMvIdx !== null && activeMvIdx < mvFlux.length) {
        var activeFlux = mvFlux[activeMvIdx];
        var mainM = S.matches.find(function(x) { return String(x.id) === String(activeFlux.mid); });
        if (mainM) {
            mainMatchId = mainM.id;
            matchCardsToFetch.push(mainM);
        }
    }

    activeMvStatsCards.forEach(function(cid) {
        if (String(cid) !== String(mainMatchId)) {
            var cardM = S.matches.find(function(x) { return String(x.id) === String(cid); });
            if (cardM) {
                matchCardsToFetch.push(cardM);
            }
        }
    });

    if (matchCardsToFetch.length === 0) {
        content.innerHTML = pinnedHtml + '<div style="padding:20px; text-align:center;">Sélectionnez un match (cliquez sur un écran) pour voir les statistiques.</div>';
        return;
    }

    var carouselHtml = '<div id="mv-stats-carousel" style="display:flex; overflow-x:auto; scroll-snap-type: x mandatory; gap:15px; padding-bottom:10px; scrollbar-width: none;">';

    matchCardsToFetch.forEach(function(m) {
        var isMain = String(m.id) === String(mainMatchId);
        carouselHtml += '<div id="mv-stat-card-' + m.id + '" style="min-width: 100%; scroll-snap-align: start; flex: 0 0 100%; position:relative;">';

        if (!isMain) {
            carouselHtml += '<button onclick="closePinnedStats(\'' + m.id + '\')" style="position:absolute; top:0; right:0; background:rgba(255,255,255,0.1); border:none; border-radius:50%; width:24px; height:24px; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:10;" title="Fermer">✕</button>';
        }

        carouselHtml += '<div id="mv-gm-header-' + m.id + '" style="font-size:16px; font-weight:bold; color:#fff; text-align:center; padding: 0 25px;">' + esc(m.homeTeam) + ' vs ' + esc(m.awayTeam) + '</div>';
        carouselHtml += (m.score ? '<div style="font-size:24px; font-weight:bold; color:var(--accent); text-align:center;">' + m.score[0] + ' - ' + m.score[1] + '</div>' : '<div style="text-align:center; color:var(--muted);">À venir</div>');
        carouselHtml += '<div style="font-size:12px; color:var(--muted); text-align:center;">' + m.flag + ' ' + esc(m.league) + ' | ' + esc(m.startTime) + (m.status === 'live' && m.minute ? ' • ' + esc(m.minute) + "\'" : '') + '</div>';

        carouselHtml += '<div id="mv-stat-body-' + m.id + '"><div style="text-align:center; margin-top:20px; color:var(--muted);">Chargement des stats...</div></div>';
        carouselHtml += '</div>';
    });

    carouselHtml += '</div>';
    content.innerHTML = pinnedHtml + carouselHtml;

    // Fetch stats for all cards
    matchCardsToFetch.forEach(function(m) {
        fetchGameStats(m.id).then(function(res) {
            if (!mvGameModeActive || !res.data) return;

            var bodyEl = document.getElementById('mv-stat-body-' + m.id);
            if (!bodyEl) return;

            var html = '';
            var mHomeId = null, mAwayId = null;
            if (res.data && res.data.header && res.data.header.competitions && res.data.header.competitions[0] && res.data.header.competitions[0].competitors) {
                var c = res.data.header.competitions[0].competitors;
                var hC = c.find(function(x) { return x.homeAway === 'home'; });
                var aC = c.find(function(x) { return x.homeAway === 'away'; });
                if(hC) mHomeId = hC.id;
                if(aC) mAwayId = aC.id;
            }

            var hRankFormStr = (res.hRank ? '#' + res.hRank + ' ' : '') + (res.hForm ? '[' + res.hForm + ']' : '');
            var aRankFormStr = (res.aRank ? '#' + res.aRank + ' ' : '') + (res.aForm ? '[' + res.aForm + ']' : '');

            var hdr = document.getElementById('mv-gm-header-' + m.id);
            if (hdr && (hRankFormStr || aRankFormStr)) {
                 hdr.innerHTML = '<div style="display:flex; justify-content:space-between; font-size:11px; color:rgba(255,255,255,0.5); font-weight:normal;">' +
                                 '<span>' + hRankFormStr + '</span><span>' + aRankFormStr + '</span></div>' +
                                 '<div>' + esc(m.homeTeam) + ' vs ' + esc(m.awayTeam) + '</div>';
            }

            if (res.scorers && res.scorers.length > 0) {
                html += renderScorersHtml(res.scorers, m, mHomeId, mAwayId);
                html += '<div style="height:15px;"></div>';
            }

            var stats = [];
            if (res.source === 'espn' && res.data.boxscore && res.data.boxscore.teams) {
                var ts = res.data.boxscore.teams;
                if(ts.length === 2 && ts[0].statistics && ts[1].statistics) {
                    var statNames = {};
                    ts[0].statistics.forEach(s => statNames[s.name] = {h: s.displayValue});
                    ts[1].statistics.forEach(s => {
                        if(statNames[s.name]) statNames[s.name].a = s.displayValue;
                    });
                    for(var k in statNames) {
                        if(statNames[k].h && statNames[k].a) {
                            stats.push({label: k, h: statNames[k].h, a: statNames[k].a});
                        }
                    }
                }
            } else if (res.source === 'api-sports' && res.data.statistics) {
                var sData = res.data.statistics;
                if(sData.length === 2) {
                    var sHome = sData[0].statistics;
                    var sAway = sData[1].statistics;
                    sHome.forEach(sh => {
                        var sa = sAway.find(x => x.type === sh.type);
                        if(sa && sh.value !== null && sa.value !== null) {
                            stats.push({label: sh.type, h: sh.value, a: sa.value});
                        }
                    });
                }
            }

            if(stats.length > 0) {
                html += '<h4 style="color:#fff;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">Statistiques</h4>';
                html += '<div style="display:flex;flex-direction:column;gap:8px;background:rgba(255,255,255,0.02);padding:10px;border-radius:12px;">';
                stats.forEach(function(st) {
                    var label = formatStatLabel(st.label);
                    html += '<div style="display:flex;justify-content:space-between;font-size:12px;align-items:center;">';
                    html += '<span style="font-weight:bold;width:30px;text-align:right;">'+st.h+'</span>';
                    html += '<span style="color:var(--muted);flex:1;text-align:center;">'+label+'</span>';
                    html += '<span style="font-weight:bold;width:30px;text-align:left;">'+st.a+'</span>';
                    html += '</div>';
                });
                html += '</div>';
            }

            bodyEl.innerHTML = html ? '<div style="margin-top:15px;">' + html + '</div>' : '<div style="margin-top:15px; color:var(--muted); text-align:center;">Aucune statistique détaillée disponible.</div>';
        }).catch(function() {
            var bodyEl = document.getElementById('mv-stat-body-' + m.id);
            if (bodyEl) bodyEl.innerHTML = '<div style="margin-top:15px; color:var(--muted); text-align:center;">Erreur lors du chargement des statistiques.</div>';
        });
    });
}

var mvFlux = [];


/* ══ MULTIVISION STREAM SELECTOR ════════ */
function showFluxSelector(idx, mid, event) {
    mid = getOriginalMatchId(mid);
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    var m = S.matches.find(function(x) { return String(x.id) === String(mid); });

    var existing = document.getElementById('mv-flux-selector');
    if (existing) existing.remove();

    var selector = document.createElement('div');
    selector.id = 'mv-flux-selector';
    selector.style.cssText = 'position:fixed;z-index:9999;background:rgba(20,20,20,0.95);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:16px;backdrop-filter:blur(15px);display:flex;flex-direction:column;gap:16px;max-height:80vh;overflow-y:auto;box-shadow:0 15px 40px rgba(0,0,0,0.8);width:90%;max-width:360px;top:50%;left:50%;transform:translate(-50%, -50%);';

    // Add close button for mobile
    var closeBtn = document.createElement('div');
    closeBtn.innerHTML = '<span class="ic ic-close"></span>';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border-radius:50%;cursor:pointer;color:#fff;font-size:14px;';
    closeBtn.onclick = function() { selector.remove(); };
    selector.appendChild(closeBtn);

    // Section 1: Alternative Flux for current match
    if (m && m.streamLinks && m.streamLinks.length > 0) {
        var titleFlux = document.createElement('div');
        titleFlux.style.cssText = 'font-size:11px;font-weight:bold;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;';
        titleFlux.textContent = 'Sources pour ce match';
        selector.appendChild(titleFlux);

        var streamsContainer = document.createElement('div');
        streamsContainer.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

        var sortedLinks = sortFluxLinks(m.streamLinks);
        sortedLinks.forEach(function(s) {
            var dom = getDomain(s.url);
            var isActive = mvFlux[idx].url === s.url;

            var btn = document.createElement('div');
            btn.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px;min-height:44px;border-radius:8px;cursor:pointer;transition:all 0.2s;background:' + (isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)') + ';border:1px solid ' + (isActive ? 'rgba(255,255,255,0.3)' : 'transparent') + ';';

            btn.onmouseenter = function() { if(!isActive) this.style.background = 'rgba(255,255,255,0.1)'; };
            btn.onmouseleave = function() { if(!isActive) this.style.background = 'rgba(255,255,255,0.05)'; };

            btn.onclick = function(e) {
                e.stopPropagation();
                if(!isActive) {
                    mvFlux[idx].url = s.url;
                    // name and mid stays the same
                    saveMultivisionState(); updateMultivisionLayout();
                }
                selector.remove();
            };

            btn.innerHTML = '<div style="font-size:16px;">' + (s.icon||QI[s.quality]||'📺') + '</div>' +
                            '<div style="flex:1;overflow:hidden;">' +
                            '<div style="font-size:13px;font-weight:bold;color:#fff;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">' + esc(s.name) + '</div>' +
                            '<div style="font-size:11px;color:var(--muted);">' + esc(dom) + '</div>' +
                            '</div>' +
                            (isActive ? '<div style="font-size:9px;background:var(--accent);color:#fff;padding:2px 4px;border-radius:4px;font-weight:bold;margin-right:4px;">ACTIF</div>' : '') +
                            '<span class="sbadge ' + (QC[s.quality]||'bSD') + '" style="font-size:9px;padding:2px 4px;">' + (s.quality||'SD') + '</span>';

            streamsContainer.appendChild(btn);
        });
        selector.appendChild(streamsContainer);
    }

    // Section 2: Other Live Matches
    var titleMatches = document.createElement('div');
    titleMatches.style.cssText = 'font-size:11px;font-weight:bold;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;margin-top:8px;';
    titleMatches.textContent = 'Remplacer par un autre match';
    selector.appendChild(titleMatches);

    var matchesContainer = document.createElement('div');
    matchesContainer.style.cssText = 'display:flex;flex-direction:column;gap:6px;';


    var availableMatches = S.matches.filter(function(x) {
        return x.streamsLoaded && x.streamLinks && x.streamLinks.length > 0 && String(x.id) !== String(mid);
    });

    availableMatches.sort(function(a, b) {
        var f1 = (favTeams[a.homeTeam] || favTeams[a.awayTeam]) ? -1 : 0;
        var f2 = (favTeams[b.homeTeam] || favTeams[b.awayTeam]) ? -1 : 0;
        if (f1 !== f2) return f1 - f2;

        if (a.status === 'live' && b.status !== 'live') return -1;
        if (a.status !== 'live' && b.status === 'live') return 1;
        return a.startTime.localeCompare(b.startTime);
    });


    if (availableMatches.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 'padding:10px;text-align:center;color:var(--muted);font-size:12px;background:rgba(255,255,255,0.02);border-radius:8px;';
        empty.innerHTML = 'Aucun autre match avec flux disponible.';
        matchesContainer.appendChild(empty);
    } else {
        availableMatches.forEach(function(sm) {
            // Already in multiview?
            var alreadyIn = mvFlux.some(function(ms) { return String(ms.mid) === String(sm.id); });

            var btn = document.createElement('div');
            btn.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px;min-height:44px;border-radius:8px;cursor:pointer;transition:all 0.2s;background:rgba(255,255,255,0.05);' + (alreadyIn ? 'opacity:0.5;pointer-events:none;' : '');

            btn.onmouseenter = function() { if(!alreadyIn) this.style.background = 'rgba(255,255,255,0.1)'; };
            btn.onmouseleave = function() { if(!alreadyIn) this.style.background = 'rgba(255,255,255,0.05)'; };

            var thumb = '<div style="width:36px; height:36px; border-radius:4px; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; font-size:16px;">' + (sm.flag || '⚽') + '</div>';
            if(sm.homeLogo) {
                thumb = '<div style="width:36px; height:36px; border-radius:4px; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; overflow:hidden; padding:2px;flex-shrink:0;">'
                  +'<img src="'+esc(sm.homeLogo)+'" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.style.display=\\\'none\\\'">'
                +'</div>';
            }

            var score = sm.score ? '<div style="font-size:13px; font-weight:bold; color:var(--accent); display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px;flex-shrink:0;"><span>'+sm.score[0]+'</span><span>'+sm.score[1]+'</span></div>' : '';

            btn.innerHTML = thumb +
                '<div style="flex:1; overflow:hidden;">' +
                    '<div style="font-size:10px; color:var(--red); font-weight:bold; margin-bottom:2px;">🔴 '+(sm.minute?esc(sm.minute)+"'":'EN DIRECT')+' <span style="color:var(--muted); font-weight:normal; margin-left:4px;">'+sm.flag+' '+esc(sm.league)+'</span></div>' +
                    '<div style="font-size:12px; font-weight:bold; color:#fff; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">'+esc(sm.homeTeam)+'</div>' +
                    '<div style="font-size:12px; font-weight:bold; color:#fff; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">'+esc(sm.awayTeam)+'</div>' +
                '</div>' + score + (alreadyIn ? '<div style="font-size:10px;background:rgba(255,255,255,0.2);color:#fff;padding:2px 4px;border-radius:4px;margin-left:4px;">AJOUTÉ</div>' : '');

            btn.onclick = function(e) {
                e.stopPropagation();
                if(sm.streamsLoaded && sm.streamLinks && sm.streamLinks.length > 0) {
                    var sortedSmLinks = sortFluxLinks(sm.streamLinks);
                    mvFlux[idx].url = sortedSmLinks[0].url;
                    mvFlux[idx].name = sm.homeTeam + ' vs ' + sm.awayTeam;
                    mvFlux[idx].mid = sm.id;
                    saveMultivisionState(); updateMultivisionLayout();
                    selector.remove();
                } else {
                    // Si pas chargé
                    showToast('Chargement des streams...');
                    scrapeMatchFlux(sm).then(function() {
                        sm.streamsLoaded = true;
                        if(sm.streamLinks && sm.streamLinks.length > 0) {
                            var sortedSmLinks = sortFluxLinks(sm.streamLinks);
                            mvFlux[idx].url = sortedSmLinks[0].url;
                            mvFlux[idx].name = sm.homeTeam + ' vs ' + sm.awayTeam;
                            mvFlux[idx].mid = sm.id;
                            saveMultivisionState(); updateMultivisionLayout();
                        } else {
                            showToast('Aucun flux trouvé pour ce match.');
                        }
                        selector.remove();
                    }).catch(function() {
                        showToast('Erreur lors du chargement des streams.');
                        selector.remove();
                    });
                }
            };

            matchesContainer.appendChild(btn);
        });
    }
    selector.appendChild(matchesContainer);

    document.body.appendChild(selector);

    // Close on outside click
    setTimeout(function() {
        var closeListener = function(e) {
            if (!selector.contains(e.target)) {
                selector.remove();
                document.removeEventListener('click', closeListener);
            }
        };
        document.addEventListener('click', closeListener);
    }, 10);
}







/* ══ MULTIVISION MATCH SELECTOR ════════ */
function showMatchSelector(event, replaceIdx) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    var existing = document.getElementById('mv-match-selector');
    if (existing) {
        existing.remove();
        return;
    }

    if (replaceIdx === undefined && mvFlux.length >= 9) {
        showToast('Maximum 9 streams en Multivision.');
        return;
    }

    var isReplace = replaceIdx !== undefined;

    var selector = document.createElement('div');
    selector.id = 'mv-match-selector';
    selector.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:var(--bg);display:flex;flex-direction:column;';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;padding:16px;background:rgba(20,20,20,0.95);border-bottom:1px solid rgba(255,255,255,0.1);position:sticky;top:0;z-index:10;';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'btn o';
    closeBtn.innerHTML = '<span class="ic ic-close"></span>';
    closeBtn.onclick = function() { selector.remove(); };
    header.appendChild(closeBtn);

    var title = document.createElement('div');
    title.style.cssText = 'flex:1;text-align:center;font-weight:bold;font-size:18px;color:var(--text);';
    title.textContent = isReplace ? 'Remplacer le stream' : 'Ajouter un match';
    header.appendChild(title);

    var spacer = document.createElement('div');
    spacer.style.width = '40px';
    header.appendChild(spacer);

    selector.appendChild(header);

    var scrollArea = document.createElement('div');
    scrollArea.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px;';

    var now = new Date();
    var currentEst = getEstTimeStrFromDate(now);
    var currentParts = currentEst.split(':');
    var currentMins = parseInt(currentParts[0], 10) * 60 + parseInt(currentParts[1], 10);

    var availableMatches = S.matches.filter(function(m) {
        if (!m.streamsLoaded || !m.streamLinks || m.streamLinks.length === 0) return false;

        var isLiveOrSoon = m.status === 'live';
        if(m.status === 'upcoming' && m.startTime) {
            var mParts = m.startTime.split(':');
            var mMins = parseInt(mParts[0], 10) * 60 + parseInt(mParts[1], 10);
            var diff = mMins - currentMins;
            if (currentMins >= 1380 && mMins <= 60) diff += 1440; // wrap around
            if (diff <= 60 && diff > -1440) {
                isLiveOrSoon = true;
            }
        }
        return isLiveOrSoon;
    });

    availableMatches.sort(function(a, b) {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (a.status !== 'live' && b.status === 'live') return 1;
        return a.startTime.localeCompare(b.startTime);
    });

    if (availableMatches.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 'padding:20px;text-align:center;color:var(--muted);font-size:14px;';
        empty.innerHTML = 'Aucun flux disponible pour le moment.<br><br>Astuce: Ouvrez un match dans le guide TV pour charger ses streams.';
        scrollArea.appendChild(empty);
    } else {
        var grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:12px;';

        availableMatches.forEach(function(m) {
            var alreadyIn = mvFlux.some(function(s) { return String(s.mid) === String(m.id); });
            if (alreadyIn && !isReplace) return;
            if (alreadyIn && isReplace && String(mvFlux[replaceIdx].mid) === String(m.id)) return;

            var b = document.createElement('div');
            b.className = 'match-card' + (m.status==='live' ? ' live' : '') + (m.status==='finished' ? ' finished' : '');
                  b.id = 'mb-'+m.id;

            var homeTeamName = normName(m.homeTeam) || 'A';
            var awayTeamName = normName(m.awayTeam) || 'B';
            var homeColor = lgColor(homeTeamName);
            var awayColor = lgColor(awayTeamName);
            var lgCol = lgColor(m.league);

            var tColorsH = getTeamColors(m.homeTeam);
            var tColorsA = getTeamColors(m.awayTeam);
            if (tColorsH) homeColor = tColorsH[0];
            if (tColorsA) awayColor = tColorsA[0];

            var cardBg = '';
            if (userPrefs.cardColor === 'home') {
                cardBg = homeColor;
            } else if (userPrefs.cardColor === 'league') {
                cardBg = lgCol;
            } else if (userPrefs.cardColor === 'dark') {
                cardBg = 'rgba(255,255,255,0.05)';
            } else {
                cardBg = 'linear-gradient(105deg, ' + homeColor + ' 53%, ' + awayColor + ' 53%)';
            }

            var statusHtml = '';
            if(m.status === 'live') {
                statusHtml = '<div class="live-indicator"><span class="mb-ld"></span>'+(m.minute?esc(m.minute):'LIVE')+'</div>';
            } else if(m.status === 'finished') {
                statusHtml = '<div>Fin</div>';
            } else {
                statusHtml = '<div>'+m.startTime+'</div>';
            }

            var homeScore = m.score && typeof m.score[0] !== 'undefined' ? m.score[0] : '';
            var awayScore = m.score && typeof m.score[1] !== 'undefined' ? m.score[1] : '';

            var homeLogoUrl = m.homeLogo || getLogo(m.homeTeam);
            var awayLogoUrl = m.awayLogo || getLogo(m.awayTeam);

            var homeLogoHtmlPrime = homeLogoUrl ? '<img src="'+esc(homeLogoUrl)+'" class="prime-logo" onerror="this.style.display=\'none\'" alt="'+esc(m.homeTeam)+'">' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>';
            var awayLogoHtmlPrime = awayLogoUrl ? '<img src="'+esc(awayLogoUrl)+'" class="prime-logo" onerror="this.style.display=\'none\'" alt="'+esc(m.awayTeam)+'">' : '<div class="prime-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🛡️</div>';

            var streamsBadgePrime = m.streamLinks && m.streamLinks.length>0 ? '<div class="prime-stream-count">'+m.streamLinks.length+' flux</div>' : '';
            var lgBadge = '<div class="prime-league-badge">'+lgFlag(m.league)+'</div>';

            var logosHtml = m.awayTeam ?
                            '<div class="prime-logo-wrapper home">' + homeLogoHtmlPrime + '</div><div class="prime-logo-wrapper away">' + awayLogoHtmlPrime + '</div>' :
                            '<div class="prime-logo-wrapper home" style="width: 100%; display: flex; justify-content: center;">' + homeLogoHtmlPrime + '</div>';

            var teamsHtml = m.awayTeam ?
                            '<div class="prime-team-name" title="'+esc(m.homeTeam)+'">'+esc(m.homeTeam)+'</div><div class="prime-team-name" title="'+esc(m.awayTeam)+'">'+esc(m.awayTeam)+'</div>' :
                            '<div class="prime-team-name" style="text-align: center; justify-content: center;" title="'+esc(m.homeTeam)+'">'+esc(m.homeTeam)+'</div>';

            var scoresHtml = m.awayTeam ?
                            '<div class="prime-score">'+homeScore+'</div><div class="prime-score">'+awayScore+'</div>' :
                            '<div class="prime-score"></div>';

            b.innerHTML = '<div class="prime-thumbnail" style="background:'+cardBg+';">'
                        +   lgBadge
                        +   streamsBadgePrime
                        +   '<div class="prime-logos">'
                        +     logosHtml
                        +   '</div>'
                        + '</div>'
                        + '<div class="prime-info">'
                        +   '<div class="prime-col-teams">'
                        +     teamsHtml
                        +   '</div>'
                        +   '<div class="prime-col-scores">'
                        +     scoresHtml
                        +   '</div>'
                        +   '<div class="prime-col-status">'
                        +     statusHtml
                        +   '</div>'
                        + '</div>';

            b.addEventListener('click', function(e) {
                e.stopPropagation();
                selector.remove();
                window.multiviewPendingAction = {
                    type: isReplace ? 'replace' : 'add',
                    replaceIdx: replaceIdx
                };
                openMod(m, lgCol);
            });
            grid.appendChild(b);
        });
        scrollArea.appendChild(grid);
    }

    selector.appendChild(scrollArea);
    document.body.appendChild(selector);
}



function toggleMultiviewPip() {
    var mvc = document.getElementById('mv-container');
    var epg = document.getElementById('epg');
    if(!mvc || !epg) return;

    if(mvc.classList.contains('mv-pip')) {
        // Restore to full screen multiview
        mvc.classList.remove('mv-pip');
        mvc.style.cssText = 'position:fixed;top:' + (window.innerWidth <= 768 ? '0' : 'var(--hdr-height, 70px)') + ';left:0;right:0;bottom:' + (window.innerWidth <= 768 ? '60px' : '0') + ';background:transparent;z-index:90;display:flex;flex-direction:column;';
        epg.style.display = 'none';
        epg.style.paddingRight = '0';
        var sf = document.getElementById('sport-filters-container');
        if(sf) sf.style.display = 'none';

        var optionsPage = document.getElementById('options-page');
        if (optionsPage) optionsPage.style.display = 'none';
        var logsPage = document.getElementById('logs-page');
        if (logsPage) logsPage.style.display = 'none';
        var scriptPage = document.getElementById('script-page');
        if (scriptPage) scriptPage.style.display = 'none';

        updateMultivisionLayout();
    } else {
        // Switch to PIP mode
        mvc.classList.add('mv-pip');

        var isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // On mobile, completely hide it in the background
            mvc.style.cssText = 'display:none;';
            epg.style.display = 'flex';
            epg.style.paddingRight = '0';
            var sf = document.getElementById('sport-filters-container');
            if(sf) sf.style.display = 'flex';
        } else {
            // On tablet/desktop, show column
            mvc.style.cssText = 'position:fixed;top:70px;right:0;bottom:0;width:350px;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);z-index:90;display:flex;flex-direction:column;border-left:1px solid var(--border);box-shadow:-5px 0 20px rgba(0,0,0,0.5);';
            epg.style.display = 'flex';
            epg.style.paddingRight = '350px';
            var sf = document.getElementById('sport-filters-container');
            if(sf) sf.style.display = 'flex';

            // Note: The vertical stack layout logic is now handled entirely within updateMultivisionLayout
            updateMultivisionLayout();
        }
    }
}

// Ensure resize events also apply the correct PIP mode styling if resizing while in PIP
window.addEventListener('resize', function() {
    var mvc = document.getElementById('mv-container');
    if (mvc && !mvc.classList.contains('mv-pip') && mvc.style.display !== 'none') {
        mvc.style.bottom = (window.innerWidth <= 768 ? '60px' : '0');
    }

    var epg = document.getElementById('epg');
    if(mvc && mvc.classList.contains('mv-pip')) {
        if(window.innerWidth <= 768) {
            mvc.style.display = 'none';
            if(epg) epg.style.paddingRight = '0';
        } else {
            mvc.style.display = 'flex';
            if(epg) epg.style.paddingRight = '350px';
        }
    }

    if (mvc && mvc.style.display !== 'none' && !mvc.classList.contains('mv-pip')) {
        if (window.innerHeight > window.innerWidth && mvLayout !== 'vertical' && mvFlux.length > 0) {
            mvLayout = 'vertical';
            var ls = document.getElementById('mv-layout-select');
            if (ls) ls.value = 'vertical';
            saveMultivisionState();
            updateMultivisionLayout();
        }
    }
});



function setupMultivisionUI() {
    if(document.getElementById('mv-container')) return;

    // Create Multivision Container
    var mvContainer = document.createElement('div');
    mvContainer.id = 'mv-container';
    mvContainer.style.cssText = 'position:fixed;top:' + (window.innerWidth <= 768 ? '0' : 'var(--hdr-height, 70px)') + ';left:0;right:0;bottom:' + (window.innerWidth <= 768 ? '60px' : '0') + ';background:transparent;z-index:90;display:none;flex-direction:column;';

    var mvToolbar = document.createElement('div');
    mvToolbar.id = 'mv-toolbar';
    mvToolbar.style.cssText = 'position:relative;min-height:40px;background:var(--bg2);display:flex;align-items:center;padding:8px 16px;gap:12px;border-bottom:1px solid var(--border);flex-shrink:0; transition:all 0.3s; flex-wrap:wrap;';
    var mvToolbarHtml = '<span style="font-weight:bold;color:var(--text);"><span class="hide-pip hide-mobile">Mode </span>Multivision</span>'
      + '<div class="sp" style="flex:1;"></div>'
      + '<button class="nav-btn" onclick="document.getElementById(\'mv-actions-menu\').classList.toggle(\'open\'); event.stopPropagation();" style="padding: 8px; display:none; font-size: 18px; border-radius: 8px;" id="mv-menu-btn">☰</button>'
      + '<div id="mv-actions-menu" class="mv-actions" style="display:flex; gap:8px; align-items:center;">'
      + '<button class="nav-btn" onclick="showMatchSelector(event)" aria-label="Ajouter un match" title="Ajouter un match" style="padding: 8px; min-width: auto; font-size: 16px;">➕</button>'
      + '<select class="nav-btn hide-pip" onchange="mvLayout=this.value; saveMultivisionState(); updateMultivisionLayout();" style="padding: 8px 32px 8px 12px; min-width: auto; height: 38px; -webkit-appearance: none; appearance: none; background: url(\'data:image/svg+xml;utf8,<svg fill=%22white%22 height=%2224%22 viewBox=%220 0 24 24%22 width=%2224%22 xmlns=%22http://www.w3.org/2000/svg%22><path d=%22M7 10l5 5 5-5z%22/><path d=%22M0 0h24v24H0z%22 fill=%22none%22/></svg>\') no-repeat right 4px center; background-size: 16px;" id="mv-layout-select">'
      +   '<option value="auto">⊞ Auto</option>'
      +   '<option value="focus">⭐ Focus</option>'
      +   '<option value="vertical">⊟ Vertical</option>'
      +   '<option value="horizontal">⊟ Horizontal</option>'
      + '</select>'
      + '<button class="nav-btn hide-pip" onclick="toggleTheaterMode(document.getElementById(\'mv-grid-wrapper\'))" aria-label="Mode Cinéma" title="Mode Cinéma" style="padding: 8px; min-width: auto; font-size: 16px;">🎬</button>'
      + '<button class="nav-btn hide-pip" onclick="toggleFullscreen(document.getElementById(\'mv-grid-wrapper\'))" aria-label="Plein écran" title="Plein écran" style="padding: 8px; min-width: auto; font-size: 16px;">⛶</button>'
      + '<button class="nav-btn hide-pip" id="mv-gm-btn" onclick="toggleMvGameMode()" aria-label="Game Mode" title="Game Mode" style="padding: 8px; min-width: auto; font-size: 16px;">📊</button>'
      + '<button class="nav-btn" onclick="hideMultivision()" aria-label="Fermer le Multivision" title="Fermer le Multivision" style="padding: 8px; min-width: auto; font-size: 16px;">❌</button>'
      + '<button class="nav-btn" onclick="clearMultivision()" aria-label="Tout vider" title="Tout vider" style="padding: 8px; min-width: auto; font-size: 16px;">🗑️</button>'
      + '</div>';

    mvToolbar.innerHTML = mvToolbarHtml;

    var mvGridWrapper = document.createElement('div');
    mvGridWrapper.id = 'mv-grid-wrapper';
    mvGridWrapper.style.cssText = 'display:flex; flex:1; width:100%; overflow:hidden; background:transparent;';

    var mvGrid = document.createElement('div');
    mvGrid.id = 'mv-grid';
    mvGrid.style.cssText = 'flex:1;display:grid;gap:2px;background:transparent;';

    mvGridWrapper.appendChild(mvGrid);

    var exitTheaterBtn = document.createElement('button');
    exitTheaterBtn.id = 'mv-exit-theater';
    exitTheaterBtn.innerHTML = 'Quitter le Plein Onglet';
    exitTheaterBtn.style.cssText = 'position:absolute;top:20px;left:50%;transform:translateX(-50%);z-index:999;background:rgba(0,0,0,0.8);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:8px 16px;cursor:pointer;display:none;backdrop-filter:blur(5px);font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.5);opacity:0;transition:opacity 0.3s;';

    setInterval(applyMvAudioState, 2000);

    window.addEventListener('message', function(e) {
        if (e.data === 'mv_frame_clicked') {
            mvFlux.forEach(function(s, idx) {
                var iframe = document.getElementById('mv-iframe-' + idx);
                if (iframe && iframe.contentWindow === e.source) {
                    focusStream(idx);
                }
            });
        }
    });

    window.addEventListener('blur', function() {
        setTimeout(function() {
            var activeElement = document.activeElement;
            if (activeElement && activeElement.tagName === 'IFRAME' && activeElement.classList.contains('mv-iframe')) {
                var idx = parseInt(activeElement.id.replace('mv-iframe-', ''));
                if (!isNaN(idx)) {
                    focusStream(idx);
                }
            }
        }, 100);
    });

    // Auto-hide the exit theater button after 3 seconds
    var theaterTimeout;
    mvContainer.addEventListener('mousemove', function() {
        if (mvContainer.classList.contains('theater-mode')) {
            exitTheaterBtn.style.opacity = '1';
            clearTimeout(theaterTimeout);
            theaterTimeout = setTimeout(function() {
                exitTheaterBtn.style.opacity = '0';
            }, 3000);
        }
    });

    exitTheaterBtn.onclick = function() { toggleTheaterMode(document.getElementById('mv-grid-wrapper')); };

    mvContainer.appendChild(mvToolbar);
    mvContainer.appendChild(mvGridWrapper);
    mvContainer.appendChild(exitTheaterBtn);
    document.body.appendChild(mvContainer); restoreMultivisionState();

    // Removed Multivision Idle Timer for Auto-Hide (keep toolbar and headers visible)
    mvContainer.addEventListener('mousemove', function() {
        var tb = document.getElementById('mv-toolbar');
        if (tb) { tb.style.opacity = '1'; tb.style.pointerEvents = 'auto'; }
        mvContainer.style.cursor = 'default';

        // Show all cell headers
        var hdrs = mvContainer.querySelectorAll('.mv-hdr');
        hdrs.forEach(function(h) { h.style.opacity = '1'; h.style.pointerEvents = 'auto'; });
    });

}



function moveMultiviewStream(idx, direction) {
    if (idx < 0 || idx >= mvFlux.length) return;

    var targetIdx;
    if (direction === 'left' || direction === 'up') {
        targetIdx = idx - 1;
    } else if (direction === 'right' || direction === 'down') {
        targetIdx = idx + 1;
    }

    if (targetIdx < 0 || targetIdx >= mvFlux.length) return;

    // Swap the elements in the array
    var temp = mvFlux[idx];
    mvFlux[idx] = mvFlux[targetIdx];
    mvFlux[targetIdx] = temp;

    saveMultivisionState();
    updateMultivisionLayout();
}

/* ══ PERSISTENCE MULTIVISION ═══════════ */
function saveMultivisionState() {
    try {
        localStorage.setItem('mv_state', JSON.stringify({
            flux: mvFlux,
            layout: mvLayout
        }));
    } catch(e) {}
}

function restoreMultivisionState() {
    try {
        var saved = localStorage.getItem('mv_state');
        if(saved) {
            var parsed = JSON.parse(saved);

            // Backward compatibility with just array
            if(Array.isArray(parsed) && parsed.length > 0) {
                mvFlux = parsed;
                setTimeout(function() {
                    updateMultivisionLayout();
                }, 500);
            } else if (parsed && parsed.flux && Array.isArray(parsed.flux)) {
                mvFlux = parsed.flux;
                if (parsed.layout) mvLayout = parsed.layout;
                setTimeout(function() {
                    updateMultivisionLayout();
                }, 500);
            }
        }
    } catch(e) {}
}

// Layout state
var mvLayout = 'auto'; // auto, focus, vertical, horizontal, custom
var activeMvIdx = null;

function focusStream(idx) {
    if (idx < 0 || idx >= mvFlux.length) return;

    // Auto swap if in focus mode and clicking on a non-focus item
    if (mvLayout === 'focus' && idx !== 0) {
        var temp = mvFlux[0];
        mvFlux[0] = mvFlux[idx];
        mvFlux[idx] = temp;
        activeMvIdx = 0; // Focus always moves to main slot
        saveMultivisionState();
        updateMultivisionLayout();
    } else {
        activeMvIdx = idx;
        applyMvFocusStyling();
        applyMvAudioState();
    }

    if (typeof updateMvGameModeStats === 'function') {
        updateMvGameModeStats();
    }
}

function applyMvFocusStyling() {
    var cells = document.querySelectorAll('.mv-cell');
    cells.forEach(function(cell) {
        var idx = parseInt(cell.dataset.index);
        if (idx === activeMvIdx) {
            cell.style.boxShadow = 'inset 0 0 0 2px rgba(150, 150, 150, 0.6)';
        } else {
            cell.style.boxShadow = 'none';
        }
    });
}

function applyMvAudioState() {
    // Determine which stream should be unmuted.
    // If activeMvIdx is null or out of bounds, unmute the first one (0) or default logic.
    var targetIdx = activeMvIdx !== null && activeMvIdx < mvFlux.length ? activeMvIdx : (mvFlux.length > 0 ? 0 : null);

    mvFlux.forEach(function(s, idx) {
        var iframe = document.getElementById('mv-iframe-' + idx);
        if (iframe && iframe.contentWindow) {
            if (idx === targetIdx) {
                iframe.contentWindow.postMessage('mv_unmute', '*');
            } else {
                iframe.contentWindow.postMessage('mv_mute', '*');
            }
        }
    });
}


function updateMultivisionLayout() {
    var ls = document.getElementById('mv-layout-select');
    if(ls) ls.value = mvLayout;
    var grid = document.getElementById('mv-grid');
    if(!grid) return;

    var count = mvFlux.length;

    // Assign internal IDs to streams for tracking DOM elements
    mvFlux.forEach(function(s, idx) {
        if (!s._internalId) s._internalId = 'mv-flux-' + Date.now() + '-' + idx;
    });

    // Remove old empty message if any
    var emptyMsg = document.getElementById('mv-empty-msg');
    if(count === 0) {
        if (!emptyMsg) {
            grid.innerHTML = '<div id="mv-empty-msg" style="display:flex;align-items:center;justify-content:center;color:var(--muted);height:100%;">Ajoutez des matchs depuis la modale pour utiliser le Multivision.</div>';
        } else {
            // keep it
            var children = Array.from(grid.children);
            children.forEach(function(child) {
                if (child.id !== 'mv-empty-msg') {
                    grid.removeChild(child);
                }
            });
        }
        return;
    } else if (emptyMsg) {
        emptyMsg.remove();
    }

    var mvc = document.getElementById('mv-container');

    // Ensure we track custom column widths
    if (!grid._customCols) grid._customCols = {};

    // Reset grid styles before applying layout
    grid.style.display = 'grid';
    grid.style.flexWrap = '';
    grid.style.flexDirection = '';
    grid.style.overflowAuto = '';
    grid.style.alignContent = '';

    if (mvc) {
        if (mvc.classList.contains('mv-pip')) {
            // Always force vertical layout in PiP mode
            grid.style.gridTemplateColumns = '1fr';
            grid.style.gridTemplateRows = 'repeat(' + Math.max(1, count) + ', 1fr)';
        } else {
            if (mvLayout === 'focus' && count >= 2) {
                var col1 = grid._customCols[0] ? grid._customCols[0] + 'fr' : '3fr';
                var col2 = grid._customCols[0] ? (1 - grid._customCols[0]).toFixed(3) + 'fr' : '1fr';
                grid.style.gridTemplateColumns = col1 + ' ' + col2;
                grid.style.gridTemplateRows = 'repeat(' + (count - 1) + ', 1fr)';
            } else if (mvLayout === 'vertical') {
                grid.style.gridTemplateColumns = '1fr';
                grid.style.gridTemplateRows = 'repeat(' + count + ', 1fr)';
            } else if (mvLayout === 'horizontal') {
                var template = '';
                var usedFr = 0;
                var remainingCols = count - Object.keys(grid._customCols).length;
                for (var c in grid._customCols) usedFr += parseFloat(grid._customCols[c]);
                var remainingFr = 1 - usedFr;

                for (var i = 0; i < count; i++) {
                    template += (grid._customCols[i] ? grid._customCols[i] + 'fr ' : (remainingCols > 0 ? (remainingFr / remainingCols).toFixed(3) : 0) + 'fr ');
                }
                grid.style.gridTemplateColumns = template.trim();
                grid.style.gridTemplateRows = '1fr';
            } else {
                // auto / Grid Mode Layout
                if(count === 1) {
                    grid.style.gridTemplateColumns = '1fr';
                    grid.style.gridTemplateRows = '1fr';
                } else if(count === 2) {
                    var col1 = grid._customCols[0] ? grid._customCols[0] + 'fr' : '1fr';
                    var col2 = grid._customCols[0] ? (1 - grid._customCols[0]).toFixed(3) + 'fr' : '1fr';
                    grid.style.gridTemplateColumns = col1 + ' ' + col2;
                    grid.style.gridTemplateRows = '1fr';
                } else if(count === 3) {
                    var col1 = grid._customCols[0] ? grid._customCols[0] + 'fr' : '1fr';
                    var col2 = grid._customCols[0] ? (1 - grid._customCols[0]).toFixed(3) + 'fr' : '1fr';
                    grid.style.gridTemplateColumns = col1 + ' ' + col2;
                    grid.style.gridTemplateRows = '1fr 1fr';
                } else if(count >= 4) {
                    var col1 = grid._customCols[0] ? grid._customCols[0] + 'fr' : '1fr';
                    var col2 = grid._customCols[0] ? (1 - grid._customCols[0]).toFixed(3) + 'fr' : '1fr';
                    grid.style.gridTemplateColumns = col1 + ' ' + col2;
                    grid.style.gridTemplateRows = '1fr 1fr';
                }
            }
        }
    }    // Existing cells
    var existingCells = Array.from(grid.children).filter(function(child) {
        return child.hasAttribute('data-internal-id');
    });

    // Create or update cells
    mvFlux.forEach(function(s, idx) {
        var cellId = s._internalId;
        var cellClass = 'mv-cell';
        var cell = existingCells.find(function(c) { return c.getAttribute('data-internal-id') === cellId; });

        if (!cell) {
            cell = document.createElement('div');
            cell.setAttribute('data-internal-id', cellId);
            cell.classList.add('mv-cell');
            cell.dataset.index = idx;
            cell.style.cssText = 'position:relative;background:#111;display:flex;flex-direction:column;cursor:grab;overflow:hidden;resize:both;';
            cell.draggable = true;

            var hdr = document.createElement('div');
            hdr.className = 'mv-hdr';
            hdr.style.cssText = 'position:absolute;top:0;left:0;right:0;background:linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%);color:#fff;padding:8px 12px;font-size:12px;display:flex;justify-content:space-between;align-items:center;z-index:10;pointer-events:none;';

            var videoContainer = document.createElement('div');
            videoContainer.className = 'mv-video-container';
            videoContainer.style.cssText = 'flex:1;position:relative;width:100%;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:transparent;';

            cell.appendChild(hdr);
            cell.appendChild(videoContainer);
            grid.appendChild(cell);

            fallbackToIframe(s.url, videoContainer, cell, s);
        }

        // Helper function for fallback
        function fallbackToIframe(url, container, cell, s) {
            container.innerHTML = '';
            var iframe = document.createElement('iframe');
            iframe.className = 'mv-media mv-iframe';
            iframe.style.cssText = 'width:100%;height:100%;border:none;pointer-events:auto;transition:transform 0.2s;';
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('allow', 'fullscreen; autoplay; presentation');
            iframe.src = url;
            container.appendChild(iframe);
            cell.addEventListener('mousedown', function() { iframe.style.pointerEvents = 'none'; });
            cell.addEventListener('mouseup', function() { iframe.style.pointerEvents = 'auto'; });
            cell.addEventListener('mouseleave', function() { iframe.style.pointerEvents = 'auto'; });
            s._currentUrl = url;

            if (s.cropped) {
                iframe.style.transform = 'scale(1.15)';
            } else {
                iframe.style.transform = 'scale(1)';
            }
        }

        // Use CSS flex/grid order to reorder elements without removing them from the DOM
        cell.style.order = idx;

        cell.dataset.index = idx;


        // Update styling/gridRow
        if (!document.getElementById('mv-container').classList.contains('mv-pip')) {
            cell.style.width = '100%';
            cell.style.height = '100%';
            // Enable horizontal resize only on elements that represent a column boundary
            cell.style.resize = 'horizontal';
            cell.style.overflow = 'hidden';

            var colIndex = 0;


            if (mvLayout === 'focus' && count >= 2) {
                if (idx === 0) {
                    cell.style.gridRow = 'span ' + (count - 1);
                    cell.style.gridColumn = '1';
                    colIndex = 0;
                } else {
                    cell.style.gridRow = 'auto';
                    cell.style.gridColumn = '2';
                    colIndex = 1;
                    cell.style.resize = 'none'; // Only resize main focus col
                }
            } else if (mvLayout === 'auto' && count === 3 && idx === 0) {
                cell.style.gridRow = 'span 2';
                cell.style.gridColumn = '1'; // Force column 1
                colIndex = 0;
            } else {
                cell.style.gridRow = 'auto';

                if (mvLayout === 'horizontal') {
                    cell.style.gridColumn = 'auto';
                    colIndex = idx;
                    if (idx === count - 1) cell.style.resize = 'none'; // No need to resize last col
                } else if (mvLayout === 'vertical') {
                    cell.style.gridColumn = '1';
                    colIndex = 0;
                    cell.style.resize = 'none'; // Only one column, no horizontal resizing
                } else {
                    // Standard auto mode (usually 2 cols)
                    if (count === 3) {
                        cell.style.gridColumn = '2';
                        colIndex = 1;
                    } else {
                        colIndex = (idx % 2 === 0) ? 0 : 1;
                        cell.style.gridColumn = 'auto';
                    }
                    if (colIndex === 1 || count === 1) cell.style.resize = 'none';
                }
            }
            // Assign col index for tracking
            cell.dataset.col = colIndex.toString();

            // Reset inline width from previous resizes so CSS Grid takes over
            cell.style.width = '';

            // Attach observer to detect resizing and update the grid template
            if (!cell._hasResizeObserver && cell.style.resize !== 'none') {
                cell._hasResizeObserver = new ResizeObserver(function(entries) {
                    var isPip = document.getElementById('mv-container').classList.contains('mv-pip');
                    if (isPip) return;

                    for (var i = 0; i < entries.length; i++) {
                        var target = entries[i].target;
                        // Only react if width was injected via user resizing
                        if (target.style.width && target.style.width !== '' && target.style.width !== '100%') {
                            var w = target.offsetWidth;
                            var gridWidth = grid.offsetWidth;

                            // Convert pixel width to fractional unit (fr)
                            var fraction = w / gridWidth;
                            // Ensure fraction stays within bounds (5% to 95%)
                            fraction = Math.max(0.05, Math.min(0.95, fraction));

                            var colIdx = parseInt(target.dataset.col);
                            if (!isNaN(colIdx)) {
                                grid._customCols[colIdx] = fraction.toFixed(3); // Store as fr
                                // clear the inline width so the grid template enforces it
                                target.style.width = '';

                                // Calculate total custom fr applied to other columns (for horizontal)
                                var usedFr = 0;
                                for (var c in grid._customCols) {
                                    if (parseInt(c) !== colIdx) usedFr += parseFloat(grid._customCols[c] || 0);
                                }


                                // Re-apply grid template proportionally
                                if (mvLayout === 'focus' && count >= 2) {
                                    grid.style.gridTemplateColumns = grid._customCols[0] + 'fr ' + (1 - fraction).toFixed(3) + 'fr';
                                } else if (mvLayout === 'horizontal') {
                                    var template = '';
                                    var remainingFr = 1 - usedFr - fraction;
                                    if (remainingFr < 0.05 * count) remainingFr = 0.05 * count; // Clamp remaining to minimum
                                    var remainingCols = count - Object.keys(grid._customCols).length;

                                    for (var j = 0; j < count; j++) {
                                        if (grid._customCols[j]) {
                                            template += grid._customCols[j] + 'fr ';
                                        } else {
                                            template += (remainingCols > 0 ? (remainingFr / remainingCols).toFixed(3) : 0) + 'fr ';
                                        }
                                    }
                                    grid.style.gridTemplateColumns = template.trim();
                                } else {
                                    // Default 2 cols (auto, count >= 2)
                                    grid.style.gridTemplateColumns = grid._customCols[0] + 'fr ' + (1 - fraction).toFixed(3) + 'fr';
                                }                            }
                        }
                    }
                });
                cell._hasResizeObserver.observe(cell);
            } else if (cell.style.resize === 'none' && cell._hasResizeObserver) {
                cell._hasResizeObserver.disconnect();
                cell._hasResizeObserver = null;
            }

        } else {
            // Force pure vertical in PiP mode
            cell.style.width = '100%';
            cell.style.height = '100%';
            cell.style.resize = 'none';
            cell.style.gridRow = 'auto';
            cell.style.gridColumn = '1';
        }
        // Make cell clickable for focus logic
        cell.onmousedown = function(e) {
            if (!e.target.closest('.mv-hdr')) {
                focusStream(idx);
            }
        };

        // Update drag/drop indices as they can change
        cell.ondragstart = function(e) {
            e.dataTransfer.setData('text/plain', idx.toString());
            cell.style.opacity = '0.5';
        };
        cell.ondragend = function(e) {
            cell.style.opacity = '1';
        };
        cell.ondragover = function(e) {
            e.preventDefault();
            cell.style.boxShadow = 'inset 0 0 0 2px var(--accent)';
        };
        cell.ondragleave = function(e) {
            cell.style.boxShadow = 'none';
        };
        cell.ondrop = function(e) {
            e.preventDefault();
            cell.style.boxShadow = 'none';
            var fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            var toIdx = idx;
            if (fromIdx !== toIdx && !isNaN(fromIdx)) {
                var temp = mvFlux[fromIdx];
                mvFlux[fromIdx] = mvFlux[toIdx];
                mvFlux[toIdx] = temp;
                saveMultivisionState();
                updateMultivisionLayout();
            }
        };

        // Update header HTML
        var hdr = cell.querySelector('.mv-hdr');
        // Make the header semi-transparent by default so it doesn't block the video too much
        hdr.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)';
        hdr.style.transition = 'background 0.2s';
        hdr.onmouseenter = function() { this.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)'; };
        hdr.onmouseleave = function() { this.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)'; };

        var domain = s.url ? getDomain(s.url) : 'Flux';
        var hdrHtml = '<div style="display:flex;align-items:center;gap:8px;pointer-events:auto;">' +
            '<span style="background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);padding:4px 8px;border-radius:4px;font-size:10px;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);">' + esc(domain) + '</span>' +
            '<span style="font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;text-shadow:0 1px 2px #000;color:rgba(255,255,255,0.8);" title="' + esc(s.name) + '">' + esc(s.name) + '</span>' +
            '</div>';

        var controlsHtml = '<div style="display:flex;gap:6px;pointer-events:auto;background:rgba(0,0,0,0.3);padding:4px;border-radius:8px;backdrop-filter:blur(5px);position:relative;">';

        // SVG Constants
        var svgMenu = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>';
        var svgLeft = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
        var svgRight = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
        var svgFlux = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>';
        var svgMatch = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path d="M9 12l2 2 4-4"/></svg>';
        var svgReload = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c0-5.52 4.48-10 10-10 2.21 0 4.25.71 5.91 1.91L21 6V2h-4"/><path d="M22 12c0 5.52-4.48 10-10 10-2.21 0-4.25-.71-5.91-1.91L3 18v4h4"/></svg>';
        var svgClose = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
        var svgStats = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>';

        // Dropdown Toggle
        var ddId = 'mv-dd-' + idx;
        controlsHtml += '<div style="position:relative;">';
        controlsHtml += '<button title="Menu" aria-label="Menu" style="background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:4px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.2)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.1)\'" onclick="var d = document.getElementById(\'' + ddId + '\'); d.style.display = d.style.display === \'block\' ? \'none\' : \'block\'; event.stopPropagation();">' + svgMenu + '</button>';

        // Dropdown Menu
        controlsHtml += '<div id="' + ddId + '" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;background:rgba(20,20,20,0.95);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:4px;min-width:160px;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,0.5);">';

        var btnStyle = 'background:transparent;color:#fff;border:none;border-radius:4px;width:100%;text-align:left;padding:8px 12px;font-size:13px;display:flex;align-items:center;gap:8px;cursor:pointer;transition:background 0.2s;';
        var hoverAttr = ' onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'transparent\'" ';

        if (idx > 0) {
             controlsHtml += '<button title="Déplacer à gauche" aria-label="Déplacer à gauche" style="' + btnStyle + '" ' + hoverAttr + ' onclick="moveMultiviewStream(' + idx + ', \'left\');event.stopPropagation();">' + svgLeft + ' Déplacer à gauche</button>';
        }
        if (idx < mvFlux.length - 1) {
             controlsHtml += '<button title="Déplacer à droite" aria-label="Déplacer à droite" style="' + btnStyle + '" ' + hoverAttr + ' onclick="moveMultiviewStream(' + idx + ', \'right\');event.stopPropagation();">' + svgRight + ' Déplacer à droite</button>';
        }

        if (s.mid) {
             controlsHtml += '<button title="Infos & Stats" aria-label="Infos & Stats" style="' + btnStyle + '" ' + hoverAttr + ' onclick="document.getElementById(\'' + ddId + '\').style.display=\'none\'; openGlobalStatsFromMatch(\'' + escJs(s.mid) + '\');event.stopPropagation();">' + svgStats + ' Infos & Stats</button>';
             controlsHtml += '<button title="Changer de flux" aria-label="Changer de flux" style="' + btnStyle + '" ' + hoverAttr + ' onclick="showFluxSelector(' + idx + ', \'' + escJs(s.mid) + '\', event);event.stopPropagation();">' + svgFlux + ' Changer de flux</button>';
        }
        controlsHtml += '<button title="Changer de match" aria-label="Changer de match" style="' + btnStyle + '" ' + hoverAttr + ' onclick="showMatchSelector(event, ' + idx + ');event.stopPropagation();">' + svgMatch + ' Changer de match</button>';
        controlsHtml += '<button title="Recharger" aria-label="Recharger" style="' + btnStyle + '" ' + hoverAttr + ' onclick="var fr = document.getElementById(\'mv-iframe-' + idx + '\'); if(fr) { var sr = fr.src; fr.src = \'\'; setTimeout(function(){fr.src=sr;}, 100); }; document.getElementById(\'' + ddId + '\').style.display=\'none\'; event.stopPropagation();">' + svgReload + ' Recharger</button>';

        controlsHtml += '</div></div>'; // Close dropdown container

        // Close Button
        controlsHtml += '<button title="Fermer" aria-label="Fermer" style="background:rgba(220,53,69,0.5);color:#fff;border:none;border-radius:4px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(220,53,69,0.8)\'" onmouseout="this.style.background=\'rgba(220,53,69,0.5)\'" onclick="removeFromMultivision(' + idx + ')">' + svgClose + '</button>';

        controlsHtml += '</div>';

        hdr.innerHTML = hdrHtml + controlsHtml;

        // Update URL/Src if changed (for existing cells)
        if (s._currentUrl !== s.url) {
            var videoContainer = cell.querySelector('.mv-video-container');
            if (videoContainer) {
                if (typeof fallbackToIframe === 'function') fallbackToIframe(s.url, videoContainer, cell, s);
                s._currentUrl = s.url;
            }
        } else {
            // Update crop transform
            var media = cell.querySelector('.mv-media');
            if (media) {
                media.id = 'mv-iframe-' + idx;
                if (s.cropped) {
                    media.style.transform = 'scale(1.15)';
                } else {
                    media.style.transform = 'scale(1)';
                }
            }
        }
    });

    // Remove cells that are no longer in mvFlux
    existingCells.forEach(function(cell) {
        var cellId = cell.getAttribute('data-internal-id');
        if (!mvFlux.find(function(s) { return s._internalId === cellId; })) {
            cell.remove();
        }
    });

    if (activeMvIdx === null || activeMvIdx >= mvFlux.length) {
        activeMvIdx = mvFlux.length > 0 ? mvFlux.length - 1 : null;
    }

    applyMvFocusStyling();
    applyMvAudioState();
}

function addToMultivision(url, name, mid) {
    mid = getOriginalMatchId(mid);
    if(mvFlux.length >= 4) {
        showToast('Maximum 4 streams en Multivision.');
        return;
    }
    mvFlux.push({url: url, name: name, mid: mid, cropped: false}); saveMultivisionState(); updateMultivisionLayout();

    // Auto-open multiview if it's the first flux added
    var mvc = document.getElementById('mv-container');
    if(mvc && mvc.style.display === 'none') {
        toggleMultiview();
    }
    showToast('Ajouté au Multivision: ' + name);
}

function removeFromMultivision(idx) {
    mvFlux.splice(idx, 1); saveMultivisionState(); updateMultivisionLayout();
    // Do not auto-close multiview when empty, keep the empty state visible
}

function clearMultivision() {
    mvFlux = []; saveMultivisionState(); updateMultivisionLayout();
    // Do not auto-close multiview when clearing all
}

function hideMultivision() {
    var mvc = document.getElementById('mv-container');
    var epg = document.getElementById('epg');
    if(!mvc || !epg) return;

    mvc.style.display = 'none';
    epg.style.display = 'flex';
    epg.style.paddingRight = '0';
    var sf = document.getElementById('sport-filters-container');
    if(sf) sf.style.display = 'flex';
    mvc.classList.remove('mv-pip');

    var mvBtn = document.getElementById('mv-toggle-btn');
    if(mvBtn) {
        mvBtn.classList.remove('active-toggle');
        mvBtn.style = '';
    }
    applyFilter(S.filter); // Re-apply current tab style
}

function toggleMultiview() {
    var mvc = document.getElementById('mv-container');
    var epg = document.getElementById('epg');
    if(!mvc || !epg) return;

    if(mvc.style.display === 'none') {
        // Open Multivision full screen
        mvc.classList.remove('mv-pip');
        mvc.style.cssText = 'position:fixed;top:' + (window.innerWidth <= 768 ? '0' : 'var(--hdr-height, 70px)') + ';left:0;right:0;bottom:' + (window.innerWidth <= 768 ? '60px' : '0') + ';background:transparent;z-index:90;display:flex;flex-direction:column;';
        epg.style.paddingRight = '0';
        mvc.style.display = 'flex';
        epg.style.display = 'none';
        var sf = document.getElementById('sport-filters-container');
        if(sf) sf.style.display = 'none';

        var optionsPage = document.getElementById('options-page');
        if (optionsPage) optionsPage.style.display = 'none';
        var logsPage = document.getElementById('logs-page');
        if (logsPage) logsPage.style.display = 'none';
        var scriptPage = document.getElementById('script-page');
        if (scriptPage) scriptPage.style.display = 'none';

        updateMultivisionLayout();
    } else if (!mvc.classList.contains('mv-pip')) {
        // Full screen -> Switch to PiP
        toggleMultiviewPip();
    } else {
        // PiP -> Return to Full Screen
        toggleMultiviewPip(); // This will remove pip class and restore full view
    }
}

function toggleTheaterMode(elem) {
  elem = elem || document.getElementById('mv-grid-wrapper');
  if (!elem) return;

  if (elem.classList.contains('mv-theater')) {
      elem.classList.remove('mv-theater');
      var closeBtn = document.getElementById('mv-close-theater');
      if(closeBtn) closeBtn.remove();
      // Restore overflow
      document.body.style.overflow = '';
  } else {
      elem.classList.add('mv-theater');
      // Hide body overflow to avoid double scrollbars
      document.body.style.overflow = 'hidden';

      var closeBtn = document.getElementById('mv-close-theater');
      if(!closeBtn) {
          closeBtn = document.createElement('button');
          closeBtn.id = 'mv-close-theater';
          closeBtn.className = 'theater-close-btn';
          closeBtn.innerHTML = '<span class="ic ic-close"></span>';
          closeBtn.title = 'Quitter le mode Cinéma';
          closeBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999999;background:rgba(0,0,0,0.8);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:8px 16px;cursor:pointer;backdrop-filter:blur(5px);font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.5);opacity:1;';
          closeBtn.onclick = function() { toggleTheaterMode(elem); };
          elem.appendChild(closeBtn);
      }
  }
}

function toggleFullscreen(elem) {
  elem = elem || document.documentElement;
  if (!document.fullscreenElement && !document.mozFullScreenElement &&
    !document.webkitFullscreenElement && !document.msFullscreenElement) {

    // Si c'est la grille Multiview qui passe en plein écran, on cache la barre d'outils
    if (elem.id === 'mv-grid' || elem.id === 'mv-grid-wrapper') {
        elem.classList.add('mv-fullscreen');
        var closeFsBtn = document.getElementById('mv-close-fs');
        if(!closeFsBtn) {
            closeFsBtn = document.createElement('button');
            closeFsBtn.id = 'mv-close-fs';
            closeFsBtn.innerHTML = '<span class="ic ic-close" style="margin-right:4px;"></span> Quitter plein écran';
            closeFsBtn.style.cssText = 'position:fixed; top:10px; right:10px; z-index:99999; background:rgba(0,0,0,0.8); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:20px; padding:8px 16px; cursor:pointer; font-weight:bold; backdrop-filter:blur(5px); box-shadow:0 4px 12px rgba(0,0,0,0.5); opacity:0; transition:opacity 0.3s;';
            closeFsBtn.onclick = function() { toggleFullscreen(); };
            elem.appendChild(closeFsBtn);

            // Auto hide
            var fsTimer;
            elem.addEventListener('mousemove', function() {
                if (document.fullscreenElement) {
                    closeFsBtn.style.opacity = '1';
                    clearTimeout(fsTimer);
                    fsTimer = setTimeout(function(){ closeFsBtn.style.opacity = '0'; }, 3000);
                }
            });
        }
    }

    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    // Restaurer le state si on quitte le plein écran de la grille
    var grid = document.getElementById('mv-grid-wrapper');
    if (!grid) grid = document.getElementById('mv-grid'); // Fallback

    if (grid && grid.classList.contains('mv-fullscreen')) {
        grid.classList.remove('mv-fullscreen');
        var closeFsBtn = document.getElementById('mv-close-fs');
        if(closeFsBtn) closeFsBtn.remove();
    }

    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

// Ensure the button disappears if we exit fullscreen via ESC key
document.addEventListener("fullscreenchange", function() {
    if (!document.fullscreenElement) {
        var grid = document.getElementById('mv-grid');
        if (grid && grid.classList.contains('mv-fullscreen')) {
            grid.classList.remove('mv-fullscreen');
            var closeFsBtn = document.getElementById('mv-close-fs');
            if(closeFsBtn) closeFsBtn.remove();
        }
    }
});

/* ══ SETTINGS & PERSONALIZATION ═════════ */
var userPrefs = {
  theme: 'custom',
  bgStyle: 'gradient',
  iconPack: 'standard',
  c1: '#000000',
  c2: '#111111',
  c3: '#222222',
  accent: '#0a84ff',
  cardColor: 'gradient-45',
  btnShape: 'rounded',
  cardOpacity: '15'
};

try {
  var storedPrefs = localStorage.getItem('user_prefs');
  if(storedPrefs) userPrefs = Object.assign(userPrefs, JSON.parse(storedPrefs));
} catch(e) {}


/* ══ OPEN FLUX (MULTIVISION) ═══════════ */
function openFlux(e, eu, en, mid){
  mid = getOriginalMatchId(mid);
  if(e) e.preventDefault();
  var url=decodeURIComponent(eu), name=decodeURIComponent(en);

  var m = S.matches.find(function(x) { return String(x.id) === String(mid); });
  var matchName = m ? (m.homeTeam + ' vs ' + m.awayTeam) : name;

  if (window.multiviewPendingAction) {
      var action = window.multiviewPendingAction;
      window.multiviewPendingAction = null;

      if(action.type === 'replace' && action.replaceIdx !== undefined) {
          mvFlux[action.replaceIdx].url = url;
          mvFlux[action.replaceIdx].name = matchName;
          mvFlux[action.replaceIdx].mid = mid;
          saveMultivisionState(); updateMultivisionLayout();
      } else {
          addToMultivision(url, matchName, mid);
      }
      closeMod();
      return;
  }

  // Close modal if open
  var mbg = document.getElementById('mbg');
  if(mbg) mbg.classList.remove('open');

  addToMultivision(url, matchName, mid);
}

function applyBgStyle() {
  var s = userPrefs.bgStyle || 'gradient';

  // Theme styling
  if(userPrefs.theme === 'metallic') {
      document.body.classList.add('theme-metallic');
  } else {
      document.body.classList.remove('theme-metallic');
  }

  // Icon Pack
  document.body.setAttribute('data-icon-pack', userPrefs.iconPack || 'standard');

  var c1 = userPrefs.c1 || '#000000';
  var c2 = userPrefs.c2 || '#111111';
  var c3 = userPrefs.c3 || '#222222';
  var blurVal = userPrefs.bgBlur || 0;
  var darkenVal = userPrefs.bgDarken || 0;

  document.documentElement.style.setProperty('--bg', c1);

  // Use a dedicated background container
  var appBg = document.getElementById('app-bg-container');
  if(!appBg) {
      appBg = document.createElement('div');
      appBg.id = 'app-bg-container';
      appBg.style.position = 'fixed';
      appBg.style.top = '0';
      appBg.style.left = '0';
      appBg.style.width = '100vw';
      appBg.style.height = '100vh';
      appBg.style.zIndex = '-3';
      appBg.style.pointerEvents = 'none';
      document.body.appendChild(appBg);
  }

  // Clear body background styles to avoid interference
  document.body.style.background = 'transparent';
  document.body.style.backgroundColor = 'transparent';

  appBg.style.backgroundColor = '';
  appBg.style.backgroundBlendMode = '';

  // Handle Blur and Darken via a dynamic pseudo-element or overlay
  var bgModifier = document.getElementById('bg-modifier-overlay');
  if(!bgModifier) {
      bgModifier = document.createElement('div');
      bgModifier.id = 'bg-modifier-overlay';
      bgModifier.style.position = 'fixed';
      bgModifier.style.top = '0';
      bgModifier.style.left = '0';
      bgModifier.style.width = '100vw';
      bgModifier.style.height = '100vh';
      bgModifier.style.pointerEvents = 'none';
      bgModifier.style.zIndex = '-1'; // just above the app-bg-container and behind content
      document.body.appendChild(bgModifier);
  }

  bgModifier.style.backdropFilter = blurVal > 0 ? 'blur(' + (blurVal / 5) + 'px)' : 'none';
  bgModifier.style.webkitBackdropFilter = blurVal > 0 ? 'blur(' + (blurVal / 5) + 'px)' : 'none';
  bgModifier.style.backgroundColor = darkenVal > 0 ? 'rgba(0, 0, 0, ' + (darkenVal / 100) + ')' : 'transparent';

  if (s === 'solid') {
    appBg.style.background = c1;
  } else if (s === 'gradient') {
    appBg.style.background = 'radial-gradient(circle at top right, ' + c2 + ' 0%, ' + c1 + ' 60%, ' + c3 + ' 100%)';
  } else if (s === 'grid') {
    appBg.style.backgroundColor = c1;
    appBg.style.backgroundImage = 'radial-gradient(' + c2 + ' 1px, transparent 1px)';
    appBg.style.backgroundSize = '24px 24px';
    appBg.style.backgroundPosition = '0 0';
  } else if (s === 'mesh_flou_1') {
    appBg.style.background = 'radial-gradient(at 20% 20%, '+c1+' 0, transparent 40%), radial-gradient(at 80% 10%, '+c2+' 0, transparent 40%), radial-gradient(at 90% 80%, '+c3+' 0, transparent 50%), radial-gradient(at 10% 90%, '+c1+' 0, transparent 40%)';
    appBg.style.backgroundColor = '#000';
  } else if (s === 'mesh_random') {
    var p1x = Math.floor(Math.random() * 100); var p1y = Math.floor(Math.random() * 100);
    var p2x = Math.floor(Math.random() * 100); var p2y = Math.floor(Math.random() * 100);
    var p3x = Math.floor(Math.random() * 100); var p3y = Math.floor(Math.random() * 100);
    var p4x = Math.floor(Math.random() * 100); var p4y = Math.floor(Math.random() * 100);
    appBg.style.background = 'radial-gradient(at '+p1x+'% '+p1y+'%, '+c1+' 0, transparent 50%), radial-gradient(at '+p2x+'% '+p2y+'%, '+c2+' 0, transparent 50%), radial-gradient(at '+p3x+'% '+p3y+'%, '+c3+' 0, transparent 50%), radial-gradient(at '+p4x+'% '+p4y+'%, '+c1+' 0, transparent 50%)';
    appBg.style.backgroundColor = '#000';
  } else if (s === 'mesh_diagonal') {
    appBg.style.background = 'radial-gradient(at 0% 0%, '+c1+' 0, transparent 60%), radial-gradient(at 50% 50%, '+c2+' 0, transparent 60%), radial-gradient(at 100% 100%, '+c3+' 0, transparent 60%), radial-gradient(at 100% 0%, '+c2+' 0, transparent 50%)';
    appBg.style.backgroundColor = '#000';
  } else if (s === 'mesh_center') {
    appBg.style.background = 'radial-gradient(at 50% 50%, '+c1+' 0, transparent 40%), radial-gradient(at 30% 70%, '+c2+' 0, transparent 50%), radial-gradient(at 70% 30%, '+c3+' 0, transparent 50%), radial-gradient(at 10% 10%, '+c1+' 0, transparent 20%)';
    appBg.style.backgroundColor = '#000';
  } else if (s === 'mesh_corner') {
    appBg.style.background = 'radial-gradient(at 0% 0%, '+c1+' 0, transparent 30%), radial-gradient(at 100% 0%, '+c2+' 0, transparent 30%), radial-gradient(at 100% 100%, '+c3+' 0, transparent 30%), radial-gradient(at 0% 100%, '+c1+' 0, transparent 30%)';
    appBg.style.backgroundColor = '#000';
  } else if (s === 'glow') {
    appBg.style.background = 'radial-gradient(circle at top left, '+c2+' 0%, transparent 40%), radial-gradient(circle at bottom right, '+c3+' 0%, transparent 40%), '+c1;
  } else if (s === 'aurora') {
    appBg.style.background = 'linear-gradient(to bottom, '+c1+', '+c1+'), radial-gradient(ellipse at top left, '+c2+' 0%, transparent 50%), radial-gradient(ellipse at top right, '+c3+' 0%, transparent 50%), radial-gradient(ellipse at bottom center, '+c2+' 0%, transparent 50%)';
    appBg.style.backgroundBlendMode = 'screen, screen, screen, normal';
    appBg.style.backgroundColor = c1;
  } else {
    appBg.style.background = c1 + ' radial-gradient(circle at 50% -20%, rgba(255,255,255,0.05) 0%, transparent 70%)';
  }
}

function initPrefs() {
  var saved = localStorage.getItem('user_prefs');
  if(saved) {
    try { Object.assign(userPrefs, JSON.parse(saved)); } catch(e){}
  }

  if(document.getElementById('pref-bg-blur')) document.getElementById('pref-bg-blur').value = userPrefs.bgBlur || 0;
  if(document.getElementById('pref-bg-darken')) document.getElementById('pref-bg-darken').value = userPrefs.bgDarken || 0;

  applyBgStyle();

  // Accent Color
  var accent = userPrefs.accent || '#0a84ff';
  document.documentElement.style.setProperty('--accent', accent);


  // Special UI Effects overlay
  var effectOverlay = document.getElementById('ui-effect-overlay');
  if(!effectOverlay) {
      effectOverlay = document.createElement('div');
      effectOverlay.id = 'ui-effect-overlay';
      effectOverlay.style.position = 'fixed';
      effectOverlay.style.top = '0';
      effectOverlay.style.left = '0';
      effectOverlay.style.width = '100vw';
      effectOverlay.style.height = '100vh';
      effectOverlay.style.pointerEvents = 'none';
      effectOverlay.style.zIndex = '9999';
      document.body.appendChild(effectOverlay);
  }

  effectOverlay.style.background = 'none';
  effectOverlay.style.backdropFilter = 'none';
  effectOverlay.style.boxShadow = 'none';
  effectOverlay.style.animation = 'none';
  effectOverlay.innerHTML = '';
  document.body.classList.remove('neon-glow-effect', 'glassmorphism-effect');

  var effects = userPrefs.uiEffects || [];
  // Migrate old setting if needed
  if (userPrefs.uiEffect && userPrefs.uiEffect !== 'none') {
      if (!effects.includes(userPrefs.uiEffect)) {
          effects.push(userPrefs.uiEffect);
      }
      delete userPrefs.uiEffect;
  }

  var overlayBgs = [];

  if (effects.includes('glassmorphism')) {
      document.body.classList.add('glassmorphism-effect');
      overlayBgs.push('url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.05\'/%3E%3C/svg%3E")');
  }
  if (effects.includes('neon_glow')) {
      document.body.classList.add('neon-glow-effect');
  }

  if (overlayBgs.length > 0) {
      effectOverlay.style.background = overlayBgs.join(', ');
  }


  // Btn Shape and Custom Button Styles
  var br = '12px';
  var btnBg = 'rgba(255,255,255,0.05)';
  var btnBorder = '1px solid rgba(255,255,255,0.15)';
  var btnShadow = '0 4px 10px rgba(0,0,0,0.3)';
  var btnBlur = 'blur(12px)';
  var cr = '16px';

  if(userPrefs.btnShape === 'square') { br = '4px'; cr = '8px'; }
  else if(userPrefs.btnShape === 'pill') br = '24px';
  else if(userPrefs.btnShape === 'soft') {
      br = '16px';
      cr = '16px';
      btnBg = 'rgba(255,255,255,0.08)';
      btnBorder = '1px solid rgba(255,255,255,0.05)';
      btnShadow = '0 2px 8px rgba(0,0,0,0.1)';
  }
  else if(userPrefs.btnShape === 'ghost') {
      br = '8px';
      cr = '12px';
      btnBg = 'transparent';
      btnBorder = '1px solid rgba(255,255,255,0.3)';
      btnShadow = 'none';
      btnBlur = 'none';
  }
  else if(userPrefs.btnShape === 'apple') {
      br = '18px';
      cr = '20px';
      btnBg = 'rgba(255,255,255,0.1)';
      btnBorder = '1px solid rgba(255,255,255,0.2)';
      btnBlur = 'blur(20px)';
      btnShadow = '0 8px 24px rgba(0,0,0,0.15)';
  } else if(userPrefs.btnShape === 'windows') {
      br = '4px';
      cr = '8px';
      btnBg = 'rgba(255,255,255,0.05)';
      btnBorder = '1px solid rgba(255,255,255,0.1)';
      btnBlur = 'blur(30px)';
  } else if(userPrefs.btnShape === 'steam') {
      br = '2px';
      cr = '4px';
      btnBg = 'linear-gradient(to bottom, #3a3f44, #272b30)';
      btnBorder = '1px solid #1a1c1f';
      btnShadow = 'inset 0 1px 0 rgba(255,255,255,0.1)';
  }

  document.documentElement.style.setProperty('--radius-btn', br);
  document.documentElement.style.setProperty('--btn-bg', btnBg);
  document.documentElement.style.setProperty('--btn-border', btnBorder);
  document.documentElement.style.setProperty('--btn-shadow', btnShadow);
  document.documentElement.style.setProperty('--btn-blur', btnBlur);
  document.documentElement.style.setProperty('--radius-card', cr);

  document.documentElement.style.setProperty('--card-opacity', (userPrefs.cardOpacity || 15) / 100);

  // Match Card Styles
  var cStyle = userPrefs.cardStyle || 'glass';
  var cardBorder = 'none';
  var cardBgOpac = (userPrefs.cardOpacity || 15) / 100;
  var cardShadow = '0 8px 20px rgba(0,0,0,0.5)';

  if (cStyle === 'solid') {
      cardBgOpac = Math.max(cardBgOpac, 0.8); // Ensure it's mostly solid
      document.documentElement.style.setProperty('--card-opacity', cardBgOpac);
      cardShadow = '0 4px 12px rgba(0,0,0,0.3)';
  } else if (cStyle === 'bordered') {
      cardBorder = '1px solid rgba(255,255,255,0.1)';
      cardShadow = 'none';
      document.documentElement.style.setProperty('--card-opacity', Math.min(cardBgOpac, 0.1)); // Very light bg
  } else if (cStyle === 'elevated') {
      cardBorder = '1px solid rgba(255,255,255,0.05)';
      cardShadow = '0 10px 30px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.1)';
  }

  document.documentElement.style.setProperty('--card-border', cardBorder);
  document.documentElement.style.setProperty('--card-shadow', cardShadow);


  // Nav Layout Styles
  // Removed dynamic JS nav layout injection to rely on CSS media queries for responsiveness.

  // Toggle Button Styles
  var tStyle = userPrefs.toggleStyle || 'default';
  var tGlow = 'none';
  var tBg = 'rgba(255,255,255,0.2)';
  var tBorder = '1px solid var(--accent)';

  if (tStyle === 'solid') {
      tBg = 'var(--accent)';
      tBorder = '1px solid var(--accent)';
      tGlow = '0 4px 12px rgba(0,0,0,0.5)';
  } else if (tStyle === 'underlined') {
      tBg = 'rgba(255,255,255,0.05)';
      tBorder = 'none';
      tGlow = 'inset 0 -3px 0 var(--accent)';
  } else if (tStyle === 'dot') {
      tBg = 'transparent';
      tBorder = 'none';
      tGlow = 'inset 0 -4px 0 -2px var(--accent)'; // Simulate a dot using inset shadow trick or just a subtle bottom border
  }

  document.documentElement.style.setProperty('--toggle-glow', tGlow);
  document.documentElement.style.setProperty('--toggle-bg-active', tBg);
  document.documentElement.style.setProperty('--toggle-border-active', tBorder);

  // Hover Effects
  var hoverStyle = userPrefs.hoverStyle || 'default';
  var hTransform = 'translateY(-1px)';
  var hShadow = 'none';
  var hBrightness = 'brightness(1.1)';

  if (hoverStyle === 'float') {
      hTransform = 'translateY(-3px)';
      hShadow = '0 10px 20px rgba(0,0,0,0.6)';
  } else if (hoverStyle === 'glow') {
      hShadow = '0 0 15px var(--accent)';
      hBrightness = 'brightness(1.3)';
  } else if (hoverStyle === 'scale') {
      hTransform = 'scale(1.05)';
      hShadow = '0 5px 15px rgba(0,0,0,0.4)';
  } else if (hoverStyle === 'none') {
      hTransform = 'none';
      hBrightness = 'none';
  }

  document.documentElement.style.setProperty('--btn-hover-transform', hTransform);
  document.documentElement.style.setProperty('--btn-hover-shadow', hShadow);
  document.documentElement.style.setProperty('--btn-hover-brightness', hBrightness);

  // Header Style
  var hStyle = userPrefs.hdrStyle || 'transparent';
  var hBg = 'transparent';
  var hBlur = 'blur(0px)';
  var hShadow = 'none';
  var hBorder = 'none';

  if (hStyle === 'glass') {
      hBg = 'rgba(10, 10, 12, 0.65)';
      hBlur = 'blur(20px)';
      hBorder = '1px solid rgba(255,255,255,0.05)';
  } else if (hStyle === 'solid') {
      hBg = 'var(--bg)';
      hBorder = '1px solid var(--border)';
  } else if (hStyle === 'floating') {
      hBg = 'rgba(20,20,22,0.85)';
      hBlur = 'blur(15px)';
      hShadow = '0 10px 30px rgba(0,0,0,0.8)';
      hBorder = '1px solid rgba(255,255,255,0.1)';
  }

  document.documentElement.style.setProperty('--hdr-bg', hBg);
  document.documentElement.style.setProperty('--hdr-blur', hBlur);
  document.documentElement.style.setProperty('--hdr-shadow', hShadow);
  document.documentElement.style.setProperty('--hdr-border', hBorder);


  // Update DOM selectors
  var selTheme = document.getElementById('pref-theme');
  var selBgStyle = document.getElementById('pref-bg-style');
  var selC1 = document.getElementById('pref-c1');
  var selC2 = document.getElementById('pref-c2');
  var selC3 = document.getElementById('pref-c3');
  var selCard = document.getElementById('pref-card-color');
  var selCardStyle = document.getElementById('pref-card-style');
  var selBtn = document.getElementById('pref-btn-shape');
  var selAccentColor = document.getElementById('pref-accent-color');
  var selOpacity = document.getElementById('pref-card-opacity');

  if(selTheme) selTheme.value = userPrefs.theme || 'custom';
  if(selBgStyle) selBgStyle.value = userPrefs.bgStyle || 'gradient';
  if(selC1) {
      selC1.value = userPrefs.c1 || '#000000';
      var hexC1 = document.getElementById('hex-c1');
      if(hexC1) hexC1.textContent = selC1.value;
  }
  if(selC2) {
      selC2.value = userPrefs.c2 || '#111111';
      var hexC2 = document.getElementById('hex-c2');
      if(hexC2) hexC2.textContent = selC2.value;
  }
  if(selC3) {
      selC3.value = userPrefs.c3 || '#222222';
      var hexC3 = document.getElementById('hex-c3');
      if(hexC3) hexC3.textContent = selC3.value;
  }
  if(selCard) selCard.value = userPrefs.cardColor || 'gradient-45';
  if(selCardStyle) selCardStyle.value = userPrefs.cardStyle || 'glass';
  if(selBtn) selBtn.value = userPrefs.btnShape || 'rounded';
  if(selAccentColor) {
      selAccentColor.value = userPrefs.accent || '#0a84ff';
      var hexAccent = document.getElementById('hex-accent-color');
      if(hexAccent) hexAccent.textContent = selAccentColor.value;
  }
  if(selOpacity) selOpacity.value = userPrefs.cardOpacity || 15;
  var selHover = document.getElementById('pref-hover-style');
  if(selHover) selHover.value = userPrefs.hoverStyle || 'default';
  var selToggle = document.getElementById('pref-toggle-style');
  if(selToggle) selToggle.value = userPrefs.toggleStyle || 'default';
  var selHdr = document.getElementById('pref-hdr-style');
  if(selHdr) selHdr.value = userPrefs.hdrStyle || 'transparent';

  var effectsContainer = document.getElementById('pref-ui-effects-container');
  if(effectsContainer) {
      var checkboxes = effectsContainer.querySelectorAll('input[type="checkbox"]');
      var effects = userPrefs.uiEffects || [];
      // migrate if needed
      if (userPrefs.uiEffect && userPrefs.uiEffect !== 'none') {
          if (!effects.includes(userPrefs.uiEffect)) {
              effects.push(userPrefs.uiEffect);
          }
      }
      checkboxes.forEach(cb => {
          cb.checked = effects.includes(cb.value);
      });

      var glassCb = document.getElementById('pref-glassmorphism');
      if (glassCb) {
          glassCb.checked = effects.includes('glassmorphism');
      }
  }
}

function applyUserPrefs() {
  var themeSel = document.getElementById('pref-theme');
  var bgStyleSel = document.getElementById('pref-bg-style');
  var c1Sel = document.getElementById('pref-c1');
  var c2Sel = document.getElementById('pref-c2');
  var c3Sel = document.getElementById('pref-c3');
  var cardSel = document.getElementById('pref-card-color');
  var cardStyleSel = document.getElementById('pref-card-style');
  var btnSel = document.getElementById('pref-btn-shape');
  var accentColorSel = document.getElementById('pref-accent-color');
  var opacSel = document.getElementById('pref-card-opacity');
  var effectsContainer = document.getElementById('pref-ui-effects-container');

  if(themeSel) userPrefs.theme = themeSel.value;
  if(bgStyleSel) userPrefs.bgStyle = bgStyleSel.value;
  if(c1Sel) userPrefs.c1 = c1Sel.value;
  if(c2Sel) userPrefs.c2 = c2Sel.value;
  if(c3Sel) userPrefs.c3 = c3Sel.value;
  userPrefs.cardColor = 'gradient-45';
  userPrefs.cardStyle = 'glass';
  if(btnSel) userPrefs.btnShape = btnSel.value;
  if(accentColorSel) userPrefs.accent = accentColorSel.value;
  var hoverSel = document.getElementById('pref-hover-style');
  if(hoverSel) userPrefs.hoverStyle = hoverSel.value;
  var toggleSel = document.getElementById('pref-toggle-style');
  if(toggleSel) userPrefs.toggleStyle = toggleSel.value;
  var hdrSel = document.getElementById('pref-hdr-style');
  if(hdrSel) userPrefs.hdrStyle = hdrSel.value;
  userPrefs.cardOpacity = '15';

  var blurSel = document.getElementById('pref-bg-blur');
  if(blurSel) userPrefs.bgBlur = blurSel.value;
  var darkenSel = document.getElementById('pref-bg-darken');
  if(darkenSel) userPrefs.bgDarken = darkenSel.value;

  if(effectsContainer) {
      var checkboxes = effectsContainer.querySelectorAll('input[type="checkbox"]');
      var activeEffects = [];
      checkboxes.forEach(cb => {
          if(cb.checked) activeEffects.push(cb.value);
      });

      var glassCb = document.getElementById('pref-glassmorphism');
      if (glassCb && glassCb.checked) {
          activeEffects.push('glassmorphism');
      }

      userPrefs.uiEffects = activeEffects;
  }

  localStorage.setItem('user_prefs', JSON.stringify(userPrefs));
  initPrefs();
  setTimeout(function() { buildEPG(S.matches); }, 0); // Rebuild to apply card colors
  showToast('Préférences sauvegardées');
}

function markCustomTheme() {
  var themeSel = document.getElementById('pref-theme');
  if(themeSel) themeSel.value = 'custom';
  // when a user changes a color manually, we set theme to custom, and then save
  applyUserPrefs();
}

function applyUserBgStyleOnly() {
  var themeSel = document.getElementById('pref-theme');
  if(themeSel) themeSel.value = 'custom'; // mark custom so it doesn't revert to preset
  applyUserPrefs();
}

function applyPredefinedTheme() {
  var themeSel = document.getElementById('pref-theme');
  if(!themeSel) return;
  var theme = themeSel.value;
  if(theme === 'custom') return;

  var presets = {
    // Épuré & Minimaliste
        'midnight': { bgStyle: 'solid', c1: '#0a0a0c', c2: '#121214', c3: '#18181a', accent: '#38bdf8', btnShape: 'soft' },
    'slate': { bgStyle: 'gradient', c1: '#1e293b', c2: '#334155', c3: '#475569', accent: '#cbd5e1', btnShape: 'rounded' },
    'minimal_light': { bgStyle: 'solid', c1: '#f8fafc', c2: '#f1f5f9', c3: '#e2e8f0', accent: '#0f172a', btnShape: 'rounded' }
  };

  if(presets[theme]) {
    userPrefs.bgStyle = presets[theme].bgStyle;
    userPrefs.c1 = presets[theme].c1;
    userPrefs.c2 = presets[theme].c2;
    userPrefs.c3 = presets[theme].c3;
    userPrefs.accent = presets[theme].accent;
    if(presets[theme].btnShape) userPrefs.btnShape = presets[theme].btnShape;
    if(presets[theme].iconPack) userPrefs.iconPack = presets[theme].iconPack;
    if(presets[theme].toggleStyle) userPrefs.toggleStyle = presets[theme].toggleStyle;
    if(presets[theme].hdrStyle) userPrefs.hdrStyle = presets[theme].hdrStyle;

    if(presets[theme].uiEffects !== undefined) {
        userPrefs.uiEffects = presets[theme].uiEffects;
    } else {
        userPrefs.uiEffects = [];
    }
    userPrefs.theme = theme;

    // Reset blur and darken when applying predefined theme
    userPrefs.bgBlur = 0;
    userPrefs.bgDarken = 0;

    // Update inputs
    if(document.getElementById('pref-bg-blur')) document.getElementById('pref-bg-blur').value = userPrefs.bgBlur || 0;
    if(document.getElementById('pref-bg-darken')) document.getElementById('pref-bg-darken').value = userPrefs.bgDarken || 0;
    document.getElementById('pref-bg-style').value = userPrefs.bgStyle;
    document.getElementById('pref-c1').value = userPrefs.c1;
    document.getElementById('pref-c2').value = userPrefs.c2;
    document.getElementById('pref-c3').value = userPrefs.c3;
    document.getElementById('pref-accent-color').value = userPrefs.accent;

    var hexC1 = document.getElementById('hex-c1');
    if(hexC1) hexC1.textContent = userPrefs.c1;
    var hexC2 = document.getElementById('hex-c2');
    if(hexC2) hexC2.textContent = userPrefs.c2;
    var hexC3 = document.getElementById('hex-c3');
    if(hexC3) hexC3.textContent = userPrefs.c3;
    var hexAccent = document.getElementById('hex-accent-color');
    if(hexAccent) hexAccent.textContent = userPrefs.accent;
    if(document.getElementById('pref-icon-pack') && presets[theme].iconPack) {
      document.getElementById('pref-icon-pack').value = presets[theme].iconPack;
    }
    if(document.getElementById('pref-btn-shape') && presets[theme].btnShape) {
      document.getElementById('pref-btn-shape').value = presets[theme].btnShape;
    }
    if(document.getElementById('pref-toggle-style') && presets[theme].toggleStyle) {
      document.getElementById('pref-toggle-style').value = presets[theme].toggleStyle;
    }
    if(document.getElementById('pref-hdr-style') && presets[theme].hdrStyle) {
      document.getElementById('pref-hdr-style').value = presets[theme].hdrStyle;
    }

    var effectsContainer = document.getElementById('pref-ui-effects-container');
    if(effectsContainer) {
        var checkboxes = effectsContainer.querySelectorAll('input[type="checkbox"]');
        var effects = userPrefs.uiEffects || [];
        checkboxes.forEach(cb => {
            cb.checked = effects.includes(cb.value);
        });

        var glassCb = document.getElementById('pref-glassmorphism');
        if (glassCb) {
            glassCb.checked = effects.includes('glassmorphism');
        }
    }

    applyUserPrefs();
  }
}


const PALETTES = [
    // Épuré & Dashboards (Tailwind/Vercel/GitHub inspired)
    { id: 'midnight', name: 'Minuit', c1: '#0f172a', c2: '#1e293b', c3: '#334155', accent: '#38bdf8' },
    { id: 'vercel', name: 'Vercel', c1: '#000000', c2: '#111111', c3: '#333333', accent: '#ffffff' },
    { id: 'github_dark', name: 'Code Sombre', c1: '#0d1117', c2: '#161b22', c3: '#21262d', accent: '#58a6ff' },
    { id: 'minimal_light', name: 'Minimal Clair', c1: '#f8fafc', c2: '#f1f5f9', c3: '#e2e8f0', accent: '#0f172a' },
    { id: 'slate', name: 'Ardoise', c1: '#1e293b', c2: '#334155', c3: '#475569', accent: '#cbd5e1' },
    { id: 'zinc', name: 'Zinc', c1: '#18181b', c2: '#27272a', c3: '#3f3f46', accent: '#f4f4f5' },

    // Steam & Tech (Material / Interfaces)
    { id: 'steam', name: 'Steam', c1: '#171a21', c2: '#1b2838', c3: '#2a475e', accent: '#66c0f4' },
    { id: 'macos_dark', name: 'macOS Sombre', c1: '#1c1c1e', c2: '#2c2c2e', c3: '#3a3a3c', accent: '#0a84ff' },
    { id: 'win_fluent', name: 'Windows 11', c1: '#202020', c2: '#282828', c3: '#333333', accent: '#60cdff' },

    // Nature & Éléments (Couleurs douces, Material HIG)
    { id: 'ocean', name: 'Océan', c1: '#0c4a6e', c2: '#075985', c3: '#0369a1', accent: '#38bdf8' },
    { id: 'forest', name: 'Forêt', c1: '#064e3b', c2: '#065f46', c3: '#047857', accent: '#34d399' },
    { id: 'nordic', name: 'Nordique', c1: '#2e3440', c2: '#3b4252', c3: '#434c5e', accent: '#88c0d0' },
    { id: 'sand', name: 'Sable', c1: '#451a03', c2: '#78350f', c3: '#92400e', accent: '#fbbf24' },

    // Vibrants maîtrisés (Accents forts sur fond très sombre)
    { id: 'cyberpunk', name: 'Cyberpunk', c1: '#09090b', c2: '#18181b', c3: '#27272a', accent: '#e11d48' },
    { id: 'aurora', name: 'Aurore', c1: '#022c22', c2: '#064e3b', c3: '#065f46', accent: '#10b981' },
    { id: 'sunset', name: 'Crépuscule', c1: '#2e1065', c2: '#4c1d95', c3: '#5b21b6', accent: '#f43f5e' },

    // Multi-teintes Vibrantes (Idéal pour les maillages)
    { id: 'synthwave', name: 'Synthwave', c1: '#2e0249', c2: '#570a57', c3: '#a91079', accent: '#f806cc' },
    { id: 'northern_lights', name: 'Aurore Boréale', c1: '#013a20', c2: '#0b8a53', c3: '#18c985', accent: '#a1ffce' },
    { id: 'neon_city', name: 'Ville Néon', c1: '#0a043c', c2: '#03506f', c3: '#bb1010', accent: '#ffe400' },
    { id: 'deep_ocean', name: 'Océan Profond', c1: '#03001c', c2: '#301e67', c3: '#5b8fb9', accent: '#b6eada' },
    { id: 'sunset_vibes', name: 'Coucher de Soleil', c1: '#3f0071', c2: '#fb2576', c3: '#ff6c00', accent: '#f7c04a' },
    { id: 'toxic_glow', name: 'Lueur Toxique', c1: '#111d13', c2: '#2a4d14', c3: '#72b01d', accent: '#e2f7ce' },
    { id: 'galactic', name: 'Galactique', c1: '#1b1a17', c2: '#1f1e2c', c3: '#6a0dad', accent: '#ffd700' },
    { id: 'miami_vice', name: 'Miami Vice', c1: '#120052', c2: '#7f00ff', c3: '#e100ff', accent: '#00f2fe' },
    { id: 'lava_lamp', name: 'Lampe à Lave', c1: '#2b0000', c2: '#800000', c3: '#ff4500', accent: '#ff8c00' },
    { id: 'frozen_berry', name: 'Baie Givrée', c1: '#18122B', c2: '#393053', c3: '#635985', accent: '#d2d0eb' },
    { id: 'neon_nights', name: 'Nuits Néon', c1: '#0b0033', c2: '#3700b3', c3: '#b300ff', accent: '#00e5ff' },
    { id: 'tropical_breeze', name: 'Brise Tropicale', c1: '#004d40', c2: '#00796b', c3: '#009688', accent: '#ffc107' },
    { id: 'desert_dune', name: 'Dune du Désert', c1: '#4a3b32', c2: '#8b5a2b', c3: '#cd853f', accent: '#ffdead' },
    { id: 'candy_pop', name: 'Pop Bonbon', c1: '#4a0e4e', c2: '#81176b', c3: '#b62a83', accent: '#f55c9b' },
    { id: 'emerald_dream', name: 'Rêve Émeraude', c1: '#01200f', c2: '#044a26', c3: '#0b8244', accent: '#50c878' },
    { id: 'royal_amethyst', name: 'Améthyste Royale', c1: '#2a004f', c2: '#4c007d', c3: '#7a00ba', accent: '#c68cff' },
    { id: 'fiery_comet', name: 'Comète Enflammée', c1: '#3d0c02', c2: '#8c1c04', c3: '#d93608', accent: '#ffcc00' },
    { id: 'aqua_marine', name: 'Aqua Marine', c1: '#00293b', c2: '#005470', c3: '#0083a3', accent: '#00e6e6' },
    { id: 'golden_hour', name: 'Heure Dorée', c1: '#4d2b00', c2: '#995a00', c3: '#e68a00', accent: '#ffe066' },
    { id: 'mystic_forest', name: 'Forêt Mystique', c1: '#0c2e1f', c2: '#1b5e3f', c3: '#2d9362', accent: '#9cedb4' }

];

function buildSwatches() {
    var container = document.querySelector('.swatches-container');
    if (!container) return;

    container.innerHTML = '';
    PALETTES.forEach(function(p) {
        var swatch = document.createElement('div');
        swatch.className = 'swatch-item';
        swatch.title = p.name;
        swatch.style.width = '32px';
        swatch.style.height = '32px';
        swatch.style.borderRadius = '50%';
        swatch.style.cursor = 'pointer';
        swatch.style.border = '2px solid ' + p.accent;
        swatch.style.background = 'linear-gradient(135deg, ' + p.c1 + ' 0%, ' + p.c2 + ' 50%, ' + p.c3 + ' 100%)';
        swatch.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
        swatch.style.transition = 'transform 0.2s, box-shadow 0.2s';

        swatch.onmouseenter = function() {
            swatch.style.transform = 'scale(1.15)';
            swatch.style.boxShadow = '0 0 8px ' + p.accent;
        };
        swatch.onmouseleave = function() {
            swatch.style.transform = 'scale(1)';
            swatch.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
        };

        swatch.onclick = function() {
            document.getElementById('pref-c1').value = p.c1;
            document.getElementById('pref-c2').value = p.c2;
            document.getElementById('pref-c3').value = p.c3;
            document.getElementById('pref-accent-color').value = p.accent;

            var hexC1 = document.getElementById('hex-c1');
            if(hexC1) hexC1.textContent = p.c1;
            var hexC2 = document.getElementById('hex-c2');
            if(hexC2) hexC2.textContent = p.c2;
            var hexC3 = document.getElementById('hex-c3');
            if(hexC3) hexC3.textContent = p.c3;
            var hexAccent = document.getElementById('hex-accent-color');
            if(hexAccent) hexAccent.textContent = p.accent;

            markCustomTheme();
        };

        container.appendChild(swatch);
    });
}


function renderSourcesStatus() {
    var container = document.getElementById('sources-status-container');
    if (!container) return;
    if (sourcesStatus.length === 0) {
        container.innerHTML = '<div style="color: var(--muted2); text-align: center;">Aucune donnée (Scraping en attente...)</div>';
        return;
    }

    var html = '';
    sourcesStatus.forEach(function(s) {
        var icon = s.status === 'success' ? '✅' : (s.status === 'warning' ? '⚠️' : '❌');
        var color = s.status === 'success' ? '#34c759' : (s.status === 'warning' ? '#ffcc00' : 'var(--red)');

        html += '<div style="display:flex; justify-content:space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 4px 0;">' +
                  '<div style="display:flex; align-items:center; gap: 8px;">' +
                      '<span style="font-size: 14px;">' + icon + '</span>' +
                      '<span style="font-weight: bold; color: var(--text);">' + s.name + '</span>' +
                  '</div>' +
                  '<div style="display:flex; align-items:center; gap: 10px; font-size: 12px;">' +
                      '<span style="color: ' + color + ';">' + s.message + '</span>' +
                      '<span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: var(--muted);">' + s.matchCount + ' matchs</span>' +
                      '<span style="color: var(--muted2); font-size: 10px; width: 50px; text-align:right;">' + s.time + '</span>' +
                  '</div>' +
                '</div>';
    });
    container.innerHTML = html;
}

function renderScrapeLogs() {
    renderSourcesStatus();
    var container = document.getElementById('scrape-logs-container');
    if(!container) return;
    if(scrapeLogs.length === 0) {
        container.innerHTML = '<div style="color: var(--muted2); text-align: center; padding: 10px;">Aucun log récent.</div>';
        return;
    }
    var html = '';
    scrapeLogs.forEach(function(log) {
        var color = log.status === 'error' ? 'var(--red)' : (log.status === 'success' ? '#34c759' : 'var(--text)');
        var icon = log.status === 'error' ? '❌' : (log.status === 'success' ? '✅' : 'ℹ️');
        html += '<div style="display:flex; flex-direction:column; gap:2px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">' +
                  '<div style="display:flex; justify-content:space-between;">' +
                      '<span style="color:var(--muted);">' + log.time + '</span>' +
                      '<span style="color:' + color + ';">' + icon + ' ' + log.status.toUpperCase() + '</span>' +
                  '</div>' +
                  '<div style="word-break: break-all; color: #a1a1aa;">' + log.url + '</div>' +
                  (log.error ? '<div style="color:var(--red); font-size: 11px;">' + log.error + '</div>' : '') +
                '</div>';
    });
    container.innerHTML = html;
}

function openOptionsPage() {
    var epgContainer = document.getElementById('epg');
    if (epgContainer) epgContainer.style.display = 'none';
    var mareaContainer = document.getElementById('marea');
    if (mareaContainer) mareaContainer.style.display = 'none';
    var sportFiltersContainer = document.getElementById('sport-filters-container');
    if (sportFiltersContainer) sportFiltersContainer.style.display = 'none';

    var logsPage = document.getElementById('logs-page');
    if (logsPage) logsPage.style.display = 'none';
    var scriptPage = document.getElementById('script-page');
    if (scriptPage) scriptPage.style.display = 'none';

    var optionsPage = document.getElementById('options-page');
    if (optionsPage) {
        optionsPage.style.display = 'flex';
        buildSwatches();
        var apiKeyInput = document.getElementById('apiKeyInput');
        if (apiKeyInput) {
            apiKeyInput.value = localStorage.getItem('apiSportsKey') || '';
        }
        initPrefs();
    }
}

function openLogsPage() {
    var epgContainer = document.getElementById('epg');
    if (epgContainer) epgContainer.style.display = 'none';
    var mareaContainer = document.getElementById('marea');
    if (mareaContainer) mareaContainer.style.display = 'none';
    var sportFiltersContainer = document.getElementById('sport-filters-container');
    if (sportFiltersContainer) sportFiltersContainer.style.display = 'none';

    var optionsPage = document.getElementById('options-page');
    if (optionsPage) optionsPage.style.display = 'none';
    var scriptPage = document.getElementById('script-page');
    if (scriptPage) scriptPage.style.display = 'none';

    var logsPage = document.getElementById('logs-page');
    if (logsPage) {
        logsPage.style.display = 'flex';
        renderScrapeLogs();
    }
}

function openScriptPage() {
    var epgContainer = document.getElementById('epg');
    if (epgContainer) epgContainer.style.display = 'none';
    var mareaContainer = document.getElementById('marea');
    if (mareaContainer) mareaContainer.style.display = 'none';
    var sportFiltersContainer = document.getElementById('sport-filters-container');
    if (sportFiltersContainer) sportFiltersContainer.style.display = 'none';

    var optionsPage = document.getElementById('options-page');
    if (optionsPage) optionsPage.style.display = 'none';
    var logsPage = document.getElementById('logs-page');
    if (logsPage) logsPage.style.display = 'none';

    var scriptPage = document.getElementById('script-page');
    if (scriptPage) {
        scriptPage.style.display = 'flex';
    }
}

// Kept for backward compatibility if called elsewhere, though shouldn't be needed
function openOptions() { openOptionsPage(); }
function closeOptions() { /* no-op now */ }
function openLogs() { openLogsPage(); }
function closeLogs() { /* no-op now */ }

function saveApiKey() {
  var key = document.getElementById('apiKeyInput').value.trim();
  if (key) {
    localStorage.setItem('apiSportsKey', key);
    showToast('Clé API sauvegardée');
  } else {
    localStorage.removeItem('apiSportsKey');
    showToast('Clé API supprimée');
  }
  loadAll(false); // Reload to fetch api-sports
}

initPrefs(); // Run once on load


function installTampermonkey() {
    var existing = document.getElementById('tm-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'tm-modal';
    modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);z-index:9999;background:rgba(20,20,20,0.95);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:20px;backdrop-filter:blur(15px);display:flex;flex-direction:column;gap:16px;max-height:80vh;overflow-y:auto;box-shadow:0 15px 40px rgba(0,0,0,0.8);width:90%;max-width:500px;-webkit-overflow-scrolling:touch;color:#fff;';

    var closeBtn = document.createElement('div');
    closeBtn.innerHTML = '<span class="ic ic-close"></span>';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border-radius:50%;cursor:pointer;color:#fff;font-size:14px;';
    closeBtn.onclick = function() { modal.remove(); };
    modal.appendChild(closeBtn);

    var title = document.createElement('h2');
    title.style.cssText = 'margin:0;font-size:18px;font-weight:bold;display:flex;align-items:center;gap:8px;';
    title.innerHTML = '🧩 Installation des Scripts';
    modal.appendChild(title);

    var contentDiv = document.createElement('div');
    contentDiv.style.cssText = 'font-size:14px;line-height:1.5;color:#ddd;display:flex;flex-direction:column;gap:12px;';

    contentDiv.innerHTML = `
        <p>Pour profiter pleinement du Multivision sans publicités et avec le lecteur vidéo isolé, vous devez installer notre script utilisateur.</p>

        <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1); margin-bottom: 8px;">
            <strong style="color:var(--accent);">🦊 Recommandation : Firefox + uBlock Origin</strong>
            <p style="margin-top:4px;font-size:13px;">Nous recommandons fortement d'utiliser Firefox. Bien que le script fonctionne sur Chrome, le bloqueur de publicités uBlock Origin y est beaucoup moins efficace en raison des récentes restrictions de Manifest V3 par Google.</p>
        </div>

        <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
            <strong style="color:#4285F4;">🌍 Navigateurs Chrome / Chromium (Edge, Brave, Opera)</strong>
            <p style="margin-top:4px;font-size:13px;">Vous pouvez également utiliser le script sur les navigateurs basés sur Chromium. Assurez-vous d'installer les extensions appropriées depuis le Chrome Web Store.</p>
        </div>

        <ol style="padding-left:20px;margin:0;display:flex;flex-direction:column;gap:8px; margin-top: 8px;">
            <li>Installez l'extension <strong>Tampermonkey</strong> sur votre navigateur :
                <a href="https://addons.mozilla.org/fr/firefox/addon/tampermonkey/" target="_blank" style="color:var(--accent);">Firefox</a> |
                <a href="https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo" target="_blank" style="color:#4285F4;">Chrome</a>
            </li>
            <li>Installez l'extension <strong>uBlock Origin</strong> :
                <a href="https://addons.mozilla.org/fr/firefox/addon/ublock-origin/" target="_blank" style="color:var(--accent);">Firefox</a> |
                <a href="https://chrome.google.com/webstore/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm" target="_blank" style="color:#4285F4;">Chrome</a>
            </li>
            <li>Cliquez sur le bouton ci-dessous pour installer le script de nettoyage Multivision.</li>
        </ol>
    `;
    modal.appendChild(contentDiv);

    var btn = document.createElement('button');
    btn.className = 'btn g';
    btn.style.cssText = 'padding:12px;font-size:16px;font-weight:bold;justify-content:center;margin-top:8px;';
    btn.innerHTML = 'Installer le Script Multivision';
    btn.onclick = function() {
        window.location.href = './multiview-cleaner.user.js';
    };
    modal.appendChild(btn);

    document.body.appendChild(modal);

    setTimeout(function() {
        var closeListener = function(e) {
            if (!modal.contains(e.target)) {
                modal.remove();
                document.removeEventListener('click', closeListener);
            }
        };
        document.addEventListener('click', closeListener);
    }, 10);
}


/* ══ TOAST ══════════════════════════════ */
function showToast(msg){var t=document.getElementById('toast');document.getElementById('toasttxt').textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2500);}


/* ══ API FIRST LOGIC ══════════════════ */
var TARGET_DATE = new Date();

function getApiFirstMatches(targetDate) {
  var todayStr = getEspnDateStr(targetDate);
  var cacheRaw = localStorage.getItem('api_calendar_cache');
  var cache = cacheRaw ? JSON.parse(cacheRaw) : null;

  var needsFullFetch = !cache || cache.fetchDate !== todayStr;

  var baseMatches = [];
  var promises = [];

  if (!needsFullFetch) {
      baseMatches = cache.matches || [];
  }

  var yesterday = new Date(targetDate); yesterday.setDate(yesterday.getDate() - 1);
  var tomorrow = new Date(targetDate); tomorrow.setDate(tomorrow.getDate() + 1);

  var espnDatesToFetch = [];
  var apiDatesToFetch = [];

  if (needsFullFetch) {
      var nextMonth = new Date(targetDate); nextMonth.setDate(nextMonth.getDate() + 30);
      var espnDateRange = getEspnDateStr(yesterday) + '-' + getEspnDateStr(nextMonth);
      espnDatesToFetch.push(espnDateRange);

      for(var i=-1; i<=7; i++) {
          var d = new Date(targetDate);
          d.setDate(d.getDate() + i);
          apiDatesToFetch.push(d.toISOString().split('T')[0]);
      }
  } else {
      espnDatesToFetch.push(getEspnDateStr(targetDate));
      apiDatesToFetch.push(targetDate.toISOString().split('T')[0]);
  }

  var espnPaths = [];
  for(var key in ESPN_LEAGUES) { if(espnPaths.indexOf(ESPN_LEAGUES[key])===-1) espnPaths.push(ESPN_LEAGUES[key]); }

  espnPaths.forEach(function(path) {
    espnDatesToFetch.forEach(function(dateStr) {
      promises.push(
        fetchEspnSchedule(path, dateStr).then(function(data) {
        if(!data || !data.events) return;
        data.events.forEach(function(ev) {
          var comp = ev.competitions[0];
          if(!comp || !comp.competitors) return;
          var home = comp.competitors.find(function(c){return c.homeAway==='home';});
          var away = comp.competitors.find(function(c){return c.homeAway==='away';});
          if(!home || !away) return;

          var leagueName = data.leagues && data.leagues[0] ? data.leagues[0].name : path;

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
            id: 'espn_'+ev.id,
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

          if(home.team.logo) cacheLogo(home.team.name, home.team.logo);
          if(away.team.logo) cacheLogo(away.team.name, away.team.logo);
        });
      })
    );
    });
  });

  // 2. Fetch API-Sports if key exists
  var key = localStorage.getItem('apiSportsKey');
  if (key) {
    var sportsToFetch = [];
    var sportIds = {};
    for(var k in SPORT_MAP) {
      var s = SPORT_MAP[k];
      var sid = s.sport + '_' + s.leagueId;
      if(!sportIds[sid]) {
        sportIds[sid] = true;
        sportsToFetch.push(s);
      }
    }

    sportsToFetch.forEach(function(s) {
      apiDatesToFetch.forEach(function(apiDateStr) {
        promises.push(
          fetchApiSportsFixtures(s, apiDateStr).then(function(apiData) {
          if (!apiData) return;
          apiData.forEach(function(f) {
             var fHome = getOfficialTeamName(f.teams.home.name);
             var fAway = getOfficialTeamName(f.teams.away.name);

             var espnMatchIdx = baseMatches.findIndex(function(m) {
                 return isMatch(m.homeTeam, fHome) && isMatch(m.awayTeam, fAway) && m.source==='api';
             });

             if(espnMatchIdx !== -1) {
                var espnMatch = baseMatches[espnMatchIdx];
                espnMatch.apiSportsId = f.fixture.id;
                espnMatch.apiSportsSport = s.sport;
                updateMatchDataFromApi(espnMatch, f, s.sport);
             } else {
                var newMatch = {
                  id: 'apisports_'+f.fixture.id,
                  apiSportsId: f.fixture.id,
                  apiSportsSport: s.sport,
                  league: formatLeagueName(f.league.name),
                  flag: lgFlag(f.league.name),
                  color: lgColor(f.league.name),
                  homeTeam: getOfficialTeamName(f.teams.home.name),
                  awayTeam: getOfficialTeamName(f.teams.away.name),
                  homeLogo: f.teams.home.logo,
                  awayLogo: f.teams.away.logo,
                  startTime: '00:00',
                  durationMinutes: getLeagueDuration(f.league.name),
                  status: 'upcoming',
                  score: null,
                  streamLinks: [],
                  streamsLoaded: false,
                  source: 'api'
                };
                newMatch.matchDate = getEstDateStrFromDate(new Date(f.fixture.date));
                updateMatchDataFromApi(newMatch, f, s.sport);

                var existingIdx = baseMatches.findIndex(function(m) { return m.id === newMatch.id; });
                if (existingIdx >= 0) {
                      baseMatches[existingIdx].status = newMatch.status;
                      baseMatches[existingIdx].score = newMatch.score;
                      baseMatches[existingIdx].minute = newMatch.minute;
                      baseMatches[existingIdx].startTime = newMatch.startTime;
                      baseMatches[existingIdx].matchDate = newMatch.matchDate;
                } else {
                      baseMatches.push(newMatch);
                }

                if(f.teams.home.logo) cacheLogo(f.teams.home.name, f.teams.home.logo);
                if(f.teams.away.logo) cacheLogo(f.teams.away.name, f.teams.away.logo);
             }
          });
        })
      );
      });
    });
  }

  // Fetch PWHL schedule specifically
  if (needsFullFetch) {
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

function mergeFluxToApi(apiMatches, scrapedMatches, skipScraping) {
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

function formatStatLabel(key) {
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

function renderScorersHtml(scorers, m, hId, aId) {
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

function fetchGameStats(matchId) {
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

function fetchLeagueStandings(leagueName) {
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

/* ══ MAIN ═══════════════════════════════ */

function stepOk(n) {
  var el = document.getElementById('s' + n);
  if (!el) return;
  el.style.opacity = '1';
  el.style.color = '#fff';
  var ic = el.querySelector('.sic');
  if (ic) {
    ic.classList.add('ok');
    ic.innerHTML = '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/></svg>';
  }
  var next = document.getElementById('s' + (n + 1));
  if (next) {
    next.style.opacity = '1';
  }
}

function updateLiveScores(matches) {
    matches.forEach(function(m) {
        // Update main card, live copy, and fav copy
        var cardIds = ['mb-' + m.id, 'mb-' + m.id + '_live_copy', 'mb-' + m.id + '_fav_copy'];

        cardIds.forEach(function(cid) {
            var cached = matchCardCache.get(cid);
            if (!cached) {
                var card = document.getElementById(cid);
                if (card) {
                    cached = {
                        el: card,
                        minEl: card.querySelector('.status-minute'),
                        scoreEls: card.querySelectorAll('.prime-score')
                    };
                    matchCardCache.set(cid, cached);
                }
            }

            if (cached) {
                var card = cached.el;
                var minEl = cached.minEl;
                // Update time/status
                if (minEl) {
                    if (m.status === 'live') {
                        minEl.textContent = m.minute || 'LIVE';
                        var ind = card.querySelector('.live-indicator');
                        if (!ind) {
                            minEl.parentElement.className = 'live-indicator status-text';
                            minEl.parentElement.innerHTML = '<span class="mb-ld"></span><span class="status-minute">'+esc(m.minute||'LIVE')+'</span>';
                            // Re-cache minEl because innerHTML replacement
                            cached.minEl = card.querySelector('.status-minute');
                        }
                        card.classList.add('live');
                        card.classList.remove('finished');
                    } else if (m.status === 'finished') {
                        minEl.textContent = 'Fin';
                        minEl.parentElement.className = 'status-text';
                        var ld = minEl.parentElement.querySelector('.mb-ld');
                        if (ld) ld.remove();
                        card.classList.remove('live');
                        card.classList.add('finished');
                    } else {
                        minEl.textContent = m.startTime || '';
                    }
                }

                // Update scores
                var scoreEls = cached.scoreEls;
                if (scoreEls && scoreEls.length === 2) {
                    if (m.score && m.score.length === 2) {
                        scoreEls[0].textContent = m.score[0];
                        scoreEls[1].textContent = m.score[1];
                    } else {
                        scoreEls[0].textContent = '';
                        scoreEls[1].textContent = '';
                    }
                }
            }
        });
    });
}

function loadAll(isBackground, forceScrape){
  if (!isBackground) window.initialScrollDone = false;
  if (typeof window.hasLoadedOnce === 'undefined') window.hasLoadedOnce = false;
  if (typeof window.lastScrapeTime === 'undefined') window.lastScrapeTime = 0;
  if (!isBackground) { S.log=[];S.raw='';S.matches=[];S.proxy=''; }
  setupMultivisionUI();

  var btn=document.getElementById('relBtn');if(btn) btn.disabled=true;
  document.getElementById('errbox').classList.remove('show');
  if (!isBackground && !window.hasLoadedOnce) {
      document.getElementById('ov').style.display='flex';
      [1,2,3].forEach(function(n){
        var el=document.getElementById('s'+n);if(!el)return;
        el.style.opacity=n===1?'1':'.4';el.style.color='';
        var ic=el.querySelector('.sic');ic.classList.remove('ok');
        ic.innerHTML='<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
      });
      document.getElementById('ovmsg').textContent='Connexion au Guide télé (API)...';
      document.getElementById('s1').querySelector('span').textContent = 'Téléchargement Guide télé Officiel';
      document.getElementById('s2').querySelector('span').textContent = 'Recherche de streams...';
      document.getElementById('s3').querySelector('span').textContent = 'Fusion et Affichage';
  } else {
      showToast('Actualisation des matchs en arrière-plan...');
      // Ensure it is definitely hidden if we've already loaded once
      document.getElementById('ov').style.display='none';
  }

  getApiFirstMatches(TARGET_DATE).then(function(apiMatches) {
      if (!isBackground) { stepOk(1);  }


      // Async scrape sites
      var nowTime = Date.now();
      var skipScraping = !forceScrape && (nowTime - window.lastScrapeTime < 15 * 60 * 1000) && window.hasLoadedOnce;

      if (skipScraping) {
          window.hasLoadedOnce = true;
          // Just merge with existing scrapedMatches and update API
          var finalMatches = mergeFluxToApi(apiMatches, window.lastScrapedMatches || [], true);

          // Persist the updated scores/statuses back to cache even when skipping scraping
          try {
              var todayStr = getEspnDateStr(TARGET_DATE);
              var cacheRaw = localStorage.getItem('api_calendar_cache');
              var cache = cacheRaw ? JSON.parse(cacheRaw) : null;
              var fetchDateToSave = todayStr;
              if (cache && cache.fetchDate) fetchDateToSave = cache.fetchDate;

              localStorage.setItem('api_calendar_cache', JSON.stringify({
                  fetchDate: fetchDateToSave,
                  matches: finalMatches
              }));
          } catch(e) {}

          var targetDateStr = getEstDateStrFromDate(TARGET_DATE);
          S.matches = finalMatches.filter(function(m) {
              return m.matchDate === targetDateStr;
          });
          updateLiveScores(S.matches); // New function to update scores smoothly
          if (!isBackground) { document.getElementById('ov').style.display='none'; }
          return Promise.reject('SKIP_SCRAPING_SUCCESS'); // Reject to skip the rest of the promise chain cleanly
      }

      window.lastScrapeTime = nowTime;
      return Promise.allSettled([
          fetchPage(SITE),
          fetchPage(MLBITE_URL),
          fetchPage(SPORTSURGE_URL),
          fetchPage(BUFFSTREAMS_URL),
          fetchPage(STREAMEAST_URL),
          fetchPage(ONHOCKEY_URL),
          fetchPage(MLBBITE_PLUS_URL),
          fetchPage(VIPLEAGUE_URL),
          fetchPage(METHSTREAMS_URL),
          fetchPage(TOTALSPORTEK_URL)
      ]).then(function(results) {
          if (!results) return;
          if (!isBackground) { stepOk(2);  }


          // Check for failures and notify user
          var sources = [SITE, MLBITE_URL, SPORTSURGE_URL, BUFFSTREAMS_URL, STREAMEAST_URL, ONHOCKEY_URL, MLBBITE_PLUS_URL, VIPLEAGUE_URL, METHSTREAMS_URL, TOTALSPORTEK_URL];
          results.forEach(function(r, idx) {
              if (r.status === 'rejected') {
                  var domain = new URL(sources[idx]).hostname;
                  console.error('Failed to fetch:', sources[idx], r.reason);
                  var errMsg = (r.reason && r.reason.message ? r.reason.message : 'Échec de la connexion');
                  addScrapeLog(sources[idx], 'error', errMsg);
                  updateSourceStatus(domain, 'error', 0, errMsg);
                  setTimeout(function() { showToast('Échec de la connexion à ' + domain); }, idx * 1000);
              } else {
                  addScrapeLog(sources[idx], 'success', '');
              }
          });

          var scrapedMatches = [];

          if(results[0].status === 'fulfilled' && results[0].value) {
              S.raw = results[0].value;
              var fbMatches = parseFootybite(results[0].value);
              updateSourceStatus(new URL(SITE).hostname, 'success', fbMatches.length, 'OK');
              scrapedMatches = mergeMatches(scrapedMatches, fbMatches);
          }
          if(results[1].status === 'fulfilled' && results[1].value) {
              var nflMatches = parseNflbite(results[1].value);
              updateSourceStatus(new URL(MLBITE_URL).hostname, 'success', nflMatches.length, 'OK');
              scrapedMatches = mergeMatches(scrapedMatches, nflMatches);
          }
          if(results[2].status === 'fulfilled' && results[2].value) {
              var surgeMatches = parseSportsurge(results[2].value);
              updateSourceStatus(new URL(SPORTSURGE_URL).hostname, 'success', surgeMatches.length, 'OK');
              scrapedMatches = mergeMatches(scrapedMatches, surgeMatches);
          }
          if(results[3].status === 'fulfilled' && results[3].value) {
              var bsMatches = parseBuffstreams(results[3].value);
              updateSourceStatus(new URL(BUFFSTREAMS_URL).hostname, 'success', bsMatches.length, 'OK');
              scrapedMatches = mergeMatches(scrapedMatches, bsMatches);
          }
          if(results[4].status === 'fulfilled' && results[4].value) {
              var seMatches = parseStreameast(results[4].value);
              updateSourceStatus(new URL(STREAMEAST_URL).hostname, 'success', seMatches.length, 'OK');
              scrapedMatches = mergeMatches(scrapedMatches, seMatches);
          }
          if(results[5].status === 'fulfilled' && results[5].value) {
              var ohMatches = parseOnHockey(results[5].value);
              updateSourceStatus(new URL(ONHOCKEY_URL).hostname, 'success', ohMatches.length, 'OK');
              scrapedMatches = mergeMatches(scrapedMatches, ohMatches);
          }
          if(results[6].status === 'fulfilled' && results[6].value) {
              var mlbbMatches = parseMlbbite(results[6].value);
              updateSourceStatus(new URL(MLBBITE_PLUS_URL).hostname, 'success', mlbbMatches.length, 'OK');
              scrapedMatches = mergeMatches(scrapedMatches, mlbbMatches);
          }
          if(results[7] && results[7].status === 'fulfilled' && results[7].value) {
              var vipMatches = parseVipleague(results[7].value);
              updateSourceStatus(new URL(VIPLEAGUE_URL).hostname, 'success', vipMatches.length, 'OK');
              scrapedMatches = mergeMatches(scrapedMatches, vipMatches);
          }
          if(results[8] && results[8].status === 'fulfilled' && results[8].value) {
              var methMatches = parseMethstreams(results[8].value);
              updateSourceStatus(new URL(METHSTREAMS_URL).hostname, 'success', methMatches.length, 'OK');
              scrapedMatches = mergeMatches(scrapedMatches, methMatches);
          }
          if(results[9] && results[9].status === 'fulfilled' && results[9].value) {
              var totMatches = parseTotalsportek(results[9].value);
              updateSourceStatus(new URL(TOTALSPORTEK_URL).hostname, 'success', totMatches.length, 'OK');
              scrapedMatches = mergeMatches(scrapedMatches, totMatches);
          }

          var finalMatches = mergeFluxToApi(apiMatches, scrapedMatches, false);

          // Persist the merged data (which now includes streams) back to localStorage
          try {
              var todayStr = getEspnDateStr(TARGET_DATE);
              var cacheRaw = localStorage.getItem('api_calendar_cache');
              var cache = cacheRaw ? JSON.parse(cacheRaw) : null;
              var fetchDateToSave = todayStr;
              if (cache && cache.fetchDate) fetchDateToSave = cache.fetchDate;

              localStorage.setItem('api_calendar_cache', JSON.stringify({
                  fetchDate: fetchDateToSave,
                  matches: finalMatches
              }));
          } catch(e) {
              console.error('Failed to cache merged calendar:', e);
          }

          window.lastScrapedMatches = scrapedMatches;
          var targetDateStr = getEstDateStrFromDate(TARGET_DATE);
          S.matches = finalMatches.filter(function(m) {
              return m.matchDate === targetDateStr;
          });
          if (!isBackground) { document.getElementById('ov').style.display='none'; }

          // Populate sports filter
          var sports = {};
          S.matches.forEach(function(m){ sports[m.league]=true; });
          var sportNames = Object.keys(sports).sort();
          var sf = document.getElementById('sport-filters');
          if(sf){
              var anyHidden = false;
              Object.keys(S.hiddenLg).forEach(function(k) {
                  if (k !== 'Autres Flux' && S.hiddenLg[k]) anyHidden = true;
              });
              var isAllSel = !anyHidden;

              var optionsHtml = '<button class="btn sport-btn '+(isAllSel?'active-toggle':'')+'" onclick="applySportFilter(\'all\');">Tous les sports</button>';
              sportNames.forEach(function(sp){
                  if (sp !== 'EN DIRECT' && sp !== 'Autres Flux') {
                      var isSel = !S.hiddenLg[sp];
                      optionsHtml += '<button class="btn sport-btn '+(isSel?'active-toggle':'')+'" onclick="applySportFilter(\''+escJs(sp)+'\');"><span style="margin-right:4px;">'+lgFlag(sp)+'</span> '+esc(sp)+'</button>';
                  }
              });
              // Add a toggle for 'Autres Flux' at the end if it exists in matches
              if (sports['Autres Flux']) {
                  var isAutresFluxVisible = !S.hiddenLg['Autres Flux'];
                  optionsHtml += '<div style="width:1px; background:rgba(255,255,255,0.1); margin:4px 8px;"></div>'; // separator
                  optionsHtml += '<button id="btn-autres-flux" class="btn sport-btn '+(isAutresFluxVisible?'active-toggle':'')+'" onclick="toggleAutresFlux();" style="border:1px dashed var(--border2) !important;"><span style="margin-right:4px;">📡</span> Autres Flux</button>';
              }
              sf.innerHTML = optionsHtml;
          }

          setTimeout(function() {
              if (isBackground && window.hasLoadedOnce) {
                  updateLiveScores(S.matches);
                  S.matches.forEach(function(m) {
                      updateMatchUiAfterScrape(m);
                  });
              } else {
                  buildEPG(S.matches);
              }
              fetchSubPages(S.matches);
              window.hasLoadedOnce = true;
          }, 0);
          var live=S.matches.filter(function(m){return m.status==='live';}).length;
          showToast(S.matches.length+' matchs'+(live?' · '+live+' live':''));
      });
  }).catch(function(err){
      if (err === 'SKIP_SCRAPING_SUCCESS') return; // Smooth update finished, no errors to show
      if (!isBackground) { document.getElementById('ov').style.display='none'; }
      var lines=(err.message||'Erreur').split('\n');
      document.getElementById('errmsg').textContent=lines[0];
      var ec=document.getElementById('errcode');
      if(lines.length>1){ec.textContent=lines.slice(1).join('\n');ec.style.display='block';}
      document.getElementById('errbox').classList.add('show');
  }).finally(function(){
      if(btn) btn.disabled=false;
      window.hasLoadedOnce=true;
      if (!isBackground) { document.getElementById('ov').style.display='none'; }
      if (!localStorage.getItem('hasSeenScriptModal')) {
          localStorage.setItem('hasSeenScriptModal', 'true');
          setTimeout(function() { installTampermonkey(); }, 500);
      }
  });
}


/* ══ INIT ═══════════════════════════════ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('SW registered: ', reg.scope);
    }).catch(err => {
      console.log('SW registration failed: ', err);
    });
  });
}


(function(){
  var n = new Date();
  var todayStr = getEspnDateStr(TARGET_DATE);
  var cacheRaw = localStorage.getItem('api_calendar_cache');
  var cache = cacheRaw ? JSON.parse(cacheRaw) : null;

  if (cache && cache.fetchDate === todayStr && cache.matches && cache.matches.length > 0) {
      window.hasLoadedOnce = true;
      S.matches = cache.matches.filter(function(m) {
          return m.matchDate === getEstDateStrFromDate(TARGET_DATE);
      });
      if (S.matches.length > 0) {
          setTimeout(function() { buildEPG(S.matches); }, 0);
      }
      if (!localStorage.getItem('hasSeenScriptModal')) {
          localStorage.setItem('hasSeenScriptModal', 'true');
          setTimeout(function() { installTampermonkey(); }, 500);
      }
      loadAll(true, true); // background update for fresh streams/stats
  } else {
      loadAll(window.hasLoadedOnce, true);
  }

  // Background auto-update every 60 seconds
  setInterval(function() {
      if (window.hasLoadedOnce) {
          loadAll(true, false);
      }
  }, 60000);
})();









function toggleSportFilters(e) {
    if (e) e.stopPropagation();
    var sf = document.getElementById('sport-filters');
    if(sf) {
        sf.classList.toggle('open');
    }
}


// Close menus when clicking elsewhere
document.addEventListener('click', function(e) {
    var mvActions = document.getElementById('mv-actions-menu');
    var mvBtn = document.getElementById('mv-menu-btn');
    if(mvActions && mvActions.classList.contains('open') && !mvActions.contains(e.target) && (!mvBtn || !mvBtn.contains(e.target))) {
        mvActions.classList.remove('open');
    }
});

var appTheaterTimer;

// Menu toggle logic
function toggleMenu(e) {
  if (e) e.stopPropagation();
  var menu = document.getElementById('main-menu');
  var btn = document.getElementById('menu-btn');
  if (menu) {
      menu.classList.toggle('open');
      // Remove inline display style to let CSS handle it via !important
      menu.style.display = '';
      if (menu.classList.contains('open')) {
          if (btn) btn.innerHTML = '✕';
      } else {
          if (btn) btn.innerHTML = '☰';
      }
  }
}

// Close menu when clicking outside
document.addEventListener('click', function(e) {
  var menu = document.getElementById('main-menu');
  var btn = document.getElementById('menu-btn');
  if (menu && menu.classList.contains('open') && e.target !== btn && !btn.contains(e.target) && !menu.contains(e.target)) {
      menu.style.display = '';
      menu.classList.remove('open');
      if (btn) btn.innerHTML = '☰';
  }
});



// --- ZOOM SYSTEM ---
var currentZoomLevel = 1.0;

function updateZoomDisplay() {
    var display = document.getElementById('zoom-level-display');
    if (display) {
        display.textContent = Math.round(currentZoomLevel * 100) + '%';
    }
}

function zoomIn() {
    if (currentZoomLevel < 3.0) {
        currentZoomLevel += 0.2;
        document.documentElement.style.setProperty('--zoom-level', currentZoomLevel);
        updateZoomDisplay();
        scrollToNow(); // Re-center
    }
}

function zoomOut() {
    if (currentZoomLevel > 0.4) {
        currentZoomLevel -= 0.2;
        document.documentElement.style.setProperty('--zoom-level', currentZoomLevel);
        updateZoomDisplay();
        scrollToNow(); // Re-center
    }
}

// Ensure the initial zoom displays correctly
document.addEventListener('DOMContentLoaded', updateZoomDisplay);

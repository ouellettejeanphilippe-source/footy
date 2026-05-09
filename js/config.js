import { S } from './state.js';
import { cacheLogo, logoCache, ensureLogoCache, escJs, esc, lg, pad } from './utils.js';
import { isMatch, stringSimilarity } from './match.js';
import { globalStatsInterval } from './multiview.js';
import { fetchGameStats, renderScorersHtml, formatStatLabel, fetchLeagueStandings } from './api.js';
import { openMod, getOriginalMatchId } from './ui.js';

/* ══ CONFIG ═════════════════════════════ */
export var SITE = 'https://www.footybite.do/';
export var MLBITE_URL = 'https://nflbite.is/'; // nflbite.is is dead, using nflbite.is as a working fallback on the same network
export var MLBBITE_PLUS_URL = 'https://mlbbite.plus';
export var SPORTSURGE_URL = 'https://v2.sportsurge.net/home5/';
export var BUFFSTREAMS_URL = 'https://buffstreams.com.co/index2';
export var STREAMEAST_URL = 'https://naturallyyou.fit/';
export var ONHOCKEY_URL = 'https://onhockey.tv/schedule_table.php';
export var VIPLEAGUE_URL = 'https://vipleague.im/top-streaming';
export var METHSTREAMS_URL = 'https://methstreams.com/';
export var TOTALSPORTEK_URL = 'https://totalsportek-real.com/';
export var PROXIES = [
  function(u){ return 'https://api.allorigins.win/get?url='+encodeURIComponent(u); },
  function(u){ return 'https://api.codetabs.com/v1/proxy/?quest='+encodeURIComponent(u); },
  function(u){ return 'https://corsproxy.io/?'+encodeURIComponent(u); }
];

/* ══ COULEURS ═══════════════════════════ */
export var LGC = {
  'champions league':'#f59e0b','europa league':'#ea580c','conference league':'#84cc16',
  'premier league':'#7c3aed','ligue 1':'#2563eb','la liga':'#dc2626',
  'bundesliga':'#b91c1c','serie a':'#059669','eredivisie':'#f97316',
  'primeira liga':'#15803d','mls':'#1e40af','fa cup':'#9333ea',
  'copa del rey':'#b45309','nations league':'#6d28d9','world cup':'#0891b2',
  'nba':'#17408b','nhl':'#000000','nfl':'#013369','mlb':'#002d72'
};
export var FLAGS = {
  'england':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','france':'🇫🇷','spain':'🇪🇸','germany':'🇩🇪','italy':'🇮🇹',
  'netherlands':'🇳🇱','portugal':'🇵🇹','turkey':'🇹🇷','usa':'🇺🇸','brazil':'🇧🇷',
  'argentina':'🇦🇷','europe':'🌍','world':'🌐','scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','belgium':'🇧🇪',
};

export function lgColor(n){
  var l=(n||'').toLowerCase();
  for(var k in LGC){ if(l.indexOf(k)>=0) return LGC[k]; }
  var h=[].reduce.call(n||'X',function(a,c){return a+c.charCodeAt(0);},0);
  return 'hsl('+[200,240,280,320,150,180,210][h%7]+',55%,30%)';
}
export function lgFlag(n){
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

/* ══ TEAM COLORS ════════════ */
export var TEAM_COLORS = {
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

export var STATIC_TEAMS = [
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
  { name: 'Senegal', league: 'world cup' },,
  { name: 'BC Lions', league: 'cfl' },
  { name: 'Calgary Stampeders', league: 'cfl' },
  { name: 'Edmonton Elks', league: 'cfl' },
  { name: 'Saskatchewan Roughriders', league: 'cfl' },
  { name: 'Winnipeg Blue Bombers', league: 'cfl' },
  { name: 'Hamilton Tiger-Cats', league: 'cfl' },
  { name: 'Toronto Argonauts', league: 'cfl' },
  { name: 'Ottawa Redblacks', league: 'cfl' },
  { name: 'Montreal Alouettes', league: 'cfl' },

];
Object.assign(TEAM_COLORS, {
  'paris saint-germain': ['#004170', '#DA291C'],
  'marseille': ['#FFFFFF', '#00BFFF'],
  'lyon': ['#FFFFFF', '#D20000'],
  'monaco': ['#E3001B', '#FFFFFF'],
  'lille': ['#E2001A', '#000000'],
  'lens': ['#ED1C24', '#FFD100'],
  'rennes': ['#E2001A', '#000000'],
  'nice': ['#ED1C24', '#000000'],
  'strasbourg': ['#004170', '#FFFFFF'],
  'montpellier': ['#004170', '#FF5B00'],
  'toulouse': ['#5B2384', '#FFFFFF'],
  'reims': ['#ED1C24', '#FFFFFF'],
  'nantes': ['#FFF200', '#00A158'],
  'auxerre': ['#FFFFFF', '#004170'],
  'le havre': ['#00BFFF', '#000000'],
  'angers': ['#000000', '#FFFFFF'],
  'brest': ['#ED1C24', '#FFFFFF'],
  'saint-étienne': ['#008C3A', '#FFFFFF'],
  'bc lions': ['#F15A24', '#000000'],
  'calgary stampeders': ['#ED1B24', '#000000'],
  'edmonton elks': ['#235F33', '#FFB81C'],
  'saskatchewan roughriders': ['#006341', '#FFFFFF'],
  'winnipeg blue bombers': ['#002B5C', '#B5985A'],
  'hamilton tiger-cats': ['#FFB81C', '#000000'],
  'toronto argonauts': ['#00205B', '#60A6DA'],
  'ottawa redblacks': ['#D11241', '#000000'],
  'montreal alouettes': ['#002A5C', '#E21A22'],
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

export function getTeamColors(teamName) {
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

export var TEAM_ALIASES = {
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
  'bc': 'bc lions',
  'lions': 'bc lions',
  'cgy': 'calgary stampeders',
  'stampeders': 'calgary stampeders',
  'edm': 'edmonton elks',
  'elks': 'edmonton elks',
  'ssk': 'saskatchewan roughriders',
  'roughriders': 'saskatchewan roughriders',
  'wpg': 'winnipeg blue bombers',
  'blue bombers': 'winnipeg blue bombers',
  'ham': 'hamilton tiger-cats',
  'tiger-cats': 'hamilton tiger-cats',
  'tor': 'toronto argonauts',
  'argonauts': 'toronto argonauts',
  'argos': 'toronto argonauts',
  'ott': 'ottawa redblacks',
  'redblacks': 'ottawa redblacks',
  'mtl': 'montreal alouettes',
  'alouettes': 'montreal alouettes',
  'psg': 'paris saint-germain',
  'paris sg': 'paris saint-germain',
  'paris': 'paris saint-germain',
  'om': 'marseille',
  'olympique marseille': 'marseille',
  'olympique de marseille': 'marseille',
  'ol': 'lyon',
  'olympique lyonnais': 'lyon',
  'as monaco': 'monaco',
  'asm': 'monaco',
  'losc': 'lille',
  'lille osc': 'lille',
  'rc lens': 'lens',
  'stade rennais': 'rennes',
  'ogc nice': 'nice',
  'rc strasbourg': 'strasbourg',
  'mhsc': 'montpellier',
  'tfc': 'toulouse',
  'stade de reims': 'reims',
  'fc nantes': 'nantes',
  'aja': 'auxerre',
  'hac': 'le havre',
  'sco angers': 'angers',
  'stade brestois': 'brest',
  'sb29': 'brest',
  'asse': 'saint-étienne',
  'st etienne': 'saint-étienne',
  'saint etienne': 'saint-étienne',
  'ars': 'arsenal',
  'gunners': 'arsenal',
  'avl': 'aston villa',
  'villa': 'aston villa',
  'bou': 'bournemouth',
  'afc bournemouth': 'bournemouth',
  'bre': 'brentford',
  'bha': 'brighton',
  'brighton & hove albion': 'brighton',
  'che': 'chelsea',
  'cry': 'crystal palace',
  'eve': 'everton',
  'ful': 'fulham',
  'ips': 'ipswich town',
  'ipswich': 'ipswich town',
  'lei': 'leicester city',
  'leicester': 'leicester city',
  'liv': 'liverpool',
  'mci': 'manchester city',
  'man city': 'manchester city',
  'mun': 'manchester united',
  'man utd': 'manchester united',
  'man united': 'manchester united',
  'new': 'newcastle united',
  'newcastle': 'newcastle united',
  'nfo': 'nottingham forest',
  'nottm forest': 'nottingham forest',
  'sou': 'southampton',
  'tot': 'tottenham hotspur',
  'spurs': 'san antonio spurs',
  'tottenham': 'tottenham hotspur',
  'whu': 'west ham united',
  'west ham': 'west ham united',
  'wol': 'wolverhampton wanderers',
  'wolves': 'wolverhampton wanderers',
  'wolverhampton': 'wolverhampton wanderers',
  'rma': 'real madrid',
  'real': 'real madrid',
  'bar': 'barcelona',
  'barca': 'barcelona',
  'fc barcelona': 'barcelona',
  'atm': 'atlético madrid',
  'atletico': 'atlético madrid',
  'atl madrid': 'atlético madrid',
  'gir': 'girona',
  'ath': 'athletic club',
  'athletic bilbao': 'athletic club',
  'rso': 'real sociedad',
  'bet': 'real betis',
  'betis': 'real betis',
  'vil': 'villarreal',
  'val': 'valencia',
  'sev': 'sevilla',
  'osa': 'osasuna',
  'ala': 'alavés',
  'deportivo alaves': 'alavés',
  'cel': 'celta vigo',
  'get': 'getafe',
  'mal': 'mallorca',
  'rcd mallorca': 'mallorca',
  'lpa': 'las palmas',
  'ray': 'rayo vallecano',
  'rayo': 'rayo vallecano',
  'leg': 'leganés',
  'cd leganes': 'leganés',
  'vll': 'valladolid',
  'real valladolid': 'valladolid',
  'esp': 'espanyol',
  'int': 'internazionale',
  'inter': 'internazionale',
  'inter milan': 'internazionale',
  'mil': 'milwaukee bucks',
  'milan': 'ac milan',
  'juv': 'juventus',
  'juve': 'juventus',
  'ata': 'atalanta',
  'bol': 'bologna',
  'rom': 'as roma',
  'laz': 'lazio',
  'nap': 'napoli',
  'fio': 'fiorentina',
  'tor': 'toronto raptors',
  'gen': 'genoa',
  'mon': 'monza',
  'ver': 'hellas verona',
  'lec': 'lecce',
  'udi': 'udinese',
  'cag': 'cagliari',
  'emp': 'empoli',
  'par': 'parma',
  'com': 'como',
  'ven': 'venezia',
  'b04': 'bayer leverkusen',
  'leverkusen': 'bayer leverkusen',
  'bayer': 'bayer leverkusen',
  'fcb': 'bayern munich',
  'bayern': 'bayern munich',
  'bayern munchen': 'bayern munich',
  'bvb': 'borussia dortmund',
  'dortmund': 'borussia dortmund',
  'rbl': 'rb leipzig',
  'leipzig': 'rb leipzig',
  'vfb': 'vfb stuttgart',
  'stuttgart': 'vfb stuttgart',
  'sge': 'eintracht frankfurt',
  'frankfurt': 'eintracht frankfurt',
  'tsg': 'tsg hoffenheim',
  'hoffenheim': 'tsg hoffenheim',
  'scf': 'sc freiburg',
  'freiburg': 'sc freiburg',
  'fch': '1. fc heidenheim 1846',
  'heidenheim': '1. fc heidenheim 1846',
  'svw': 'werder bremen',
  'bremen': 'werder bremen',
  'fca': 'fc augsburg',
  'augsburg': 'fc augsburg',
  'wob': 'vfl wolfsburg',
  'wolfsburg': 'vfl wolfsburg',
  'm05': 'mainz',
  'bmg': 'borussia mönchengladbach',
  'gladbach': 'borussia mönchengladbach',
  'fcu': '1. fc union berlin',
  'union berlin': '1. fc union berlin',
  'boc': 'vfl bochum',
  'bochum': 'vfl bochum',
  'stp': 'st. pauli',
  'ksv': 'holstein kiel',
  'kiel': 'holstein kiel',
  'ana': 'anaheim ducks',
  'ducks': 'anaheim ducks',
  'bos': 'boston celtics',
  'bruins': 'boston bruins',
  'bos bruins': 'boston bruins',
  'buf': 'buffalo bills',
  'sabres': 'buffalo sabres',
  'buf sabres': 'buffalo sabres',
  'cgy': 'calgary flames',
  'flames': 'calgary flames',
  'car': 'carolina panthers',
  'hurricanes': 'carolina hurricanes',
  'canes': 'carolina hurricanes',
  'car hurricanes': 'carolina hurricanes',
  'chi': 'chicago bears',
  'blackhawks': 'chicago blackhawks',
  'col': 'colorado avalanche',
  'avalanche': 'colorado avalanche',
  'avs': 'colorado avalanche',
  'col avalanche': 'colorado avalanche',
  'cbj': 'columbus blue jackets',
  'blue jackets': 'columbus blue jackets',
  'jackets': 'columbus blue jackets',
  'dal': 'dallas cowboys',
  'stars': 'dallas stars',
  'dal stars': 'dallas stars',
  'det': 'detroit lions',
  'red wings': 'detroit red wings',
  'wings': 'detroit red wings',
  'det red wings': 'detroit red wings',
  'edm': 'edmonton oilers',
  'oilers': 'edmonton oilers',
  'edm oilers': 'edmonton oilers',
  'fla': 'florida panthers',
  'panthers': 'carolina panthers',
  'fla panthers': 'florida panthers',
  'lak': 'los angeles kings',
  'kings': 'sacramento kings',
  'la kings': 'los angeles kings',
  'min': 'minnesota vikings',
  'wild': 'minnesota wild',
  'min wild': 'minnesota wild',
  'mtl': 'montreal canadiens',
  'canadiens': 'montreal canadiens',
  'habs': 'montreal canadiens',
  'canadiens de montreal': 'montreal canadiens',
  'nsh': 'nashville predators',
  'predators': 'nashville predators',
  'preds': 'nashville predators',
  'nsh predators': 'nashville predators',
  'njd': 'new jersey devils',
  'devils': 'new jersey devils',
  'nj devils': 'new jersey devils',
  'nyi': 'new york islanders',
  'islanders': 'charlottetown islanders',
  'ny islanders': 'new york islanders',
  'nyr': 'new york rangers',
  'rangers': 'texas rangers',
  'ny rangers': 'new york rangers',
  'ott': 'ottawa senators',
  'senators': 'ottawa senators',
  'phi': 'philadelphia eagles',
  'flyers': 'philadelphia flyers',
  'phi flyers': 'philadelphia flyers',
  'pit': 'pittsburgh steelers',
  'penguins': 'pittsburgh penguins',
  'pens': 'pittsburgh penguins',
  'pit penguins': 'pittsburgh penguins',
  'sjs': 'san jose sharks',
  'sharks': 'san jose sharks',
  'sj sharks': 'san jose sharks',
  'sea': 'seattle seahawks',
  'kraken': 'seattle kraken',
  'stl': 'st. louis blues',
  'blues': 'st. louis blues',
  'tbl': 'tampa bay lightning',
  'lightning': 'tampa bay lightning',
  'tb lightning': 'tampa bay lightning',
  'tampa bay': 'tampa bay lightning',
  'tb': 'tampa bay buccaneers',
  'maple leafs': 'toronto maple leafs',
  'leafs': 'toronto maple leafs',
  'tor maple leafs': 'toronto maple leafs',
  'utah': 'utah mammoth',
  'mammoth': 'utah mammoth',
  'van': 'vancouver canucks',
  'canucks': 'vancouver canucks',
  'van canucks': 'vancouver canucks',
  'vgk': 'vegas golden knights',
  'golden knights': 'vegas golden knights',
  'wsh': 'washington capitals',
  'capitals': 'washington capitals',
  'caps': 'washington capitals',
  'wsh capitals': 'washington capitals',
  'wpg': 'winnipeg jets',
  'jets': 'new york jets',
  'atl': 'atlanta falcons',
  'hawks': 'atlanta hawks',
  'celtics': 'boston celtics',
  'bkn': 'brooklyn nets',
  'nets': 'brooklyn nets',
  'cha': 'charlotte hornets',
  'hornets': 'charlotte hornets',
  'bulls': 'chicago bulls',
  'cle': 'cleveland browns',
  'cavs': 'cleveland cavaliers',
  'mavs': 'dallas mavericks',
  'den': 'denver broncos',
  'nuggets': 'denver nuggets',
  'pistons': 'detroit pistons',
  'gsw': 'golden state warriors',
  'warriors': 'golden state warriors',
  'hou': 'houston texans',
  'rockets': 'houston rockets',
  'ind': 'indianapolis colts',
  'pacers': 'indiana pacers',
  'lac': 'los angeles chargers',
  'clippers': 'la clippers',
  'lal': 'los angeles lakers',
  'lakers': 'los angeles lakers',
  'mem': 'memphis grizzlies',
  'grizzlies': 'memphis grizzlies',
  'mia': 'miami dolphins',
  'heat': 'miami heat',
  'bucks': 'milwaukee bucks',
  'timberwolves': 'minnesota timberwolves',
  't-wolves': 'minnesota timberwolves',
  'nop': 'new orleans pelicans',
  'pelicans': 'new orleans pelicans',
  'nyk': 'new york knicks',
  'knicks': 'new york knicks',
  'okc': 'oklahoma city thunder',
  'thunder': 'oklahoma city thunder',
  'orl': 'orlando magic',
  'magic': 'orlando magic',
  '76ers': 'philadelphia 76ers',
  'sixers': 'philadelphia 76ers',
  'phx': 'phoenix suns',
  'suns': 'phoenix suns',
  'por': 'portland trail blazers',
  'blazers': 'portland trail blazers',
  'sac': 'sacramento kings',
  'sas': 'san antonio spurs',
  'raptors': 'toronto raptors',
  'uta': 'utah jazz',
  'jazz': 'utah jazz',
  'was': 'washington commanders',
  'wizards': 'washington wizards',
  'ari': 'arizona cardinals',
  'cardinals': 'st. louis cardinals',
  'falcons': 'atlanta falcons',
  'bal': 'baltimore ravens',
  'ravens': 'baltimore ravens',
  'bills': 'buffalo bills',
  'bears': 'chicago bears',
  'cin': 'cincinnati bengals',
  'bengals': 'cincinnati bengals',
  'browns': 'cleveland browns',
  'cowboys': 'dallas cowboys',
  'broncos': 'denver broncos',
  'lions': 'detroit lions',
  'gb': 'green bay packers',
  'packers': 'green bay packers',
  'texans': 'houston texans',
  'colts': 'indianapolis colts',
  'jax': 'jacksonville jaguars',
  'jaguars': 'jacksonville jaguars',
  'kc': 'kansas city chiefs',
  'chiefs': 'kansas city chiefs',
  'lv': 'las vegas raiders',
  'raiders': 'las vegas raiders',
  'chargers': 'los angeles chargers',
  'lar': 'los angeles rams',
  'rams': 'los angeles rams',
  'dolphins': 'miami dolphins',
  'vikings': 'minnesota vikings',
  'ne': 'new england patriots',
  'patriots': 'new england patriots',
  'pats': 'new england patriots',
  'no': 'new orleans saints',
  'saints': 'new orleans saints',
  'nyg': 'new york giants',
  'giants': 'san francisco giants',
  'nyj': 'new york jets',
  'eagles': 'cape breton eagles',
  'steelers': 'pittsburgh steelers',
  'sf': 'san francisco 49ers',
  '49ers': 'san francisco 49ers',
  'niners': 'san francisco 49ers',
  'seahawks': 'seattle seahawks',
  'buccaneers': 'tampa bay buccaneers',
  'bucs': 'tampa bay buccaneers',
  'ten': 'tennessee titans',
  'titans': 'tennessee titans',
  'commanders': 'washington commanders',
  'ari diamondbacks': 'arizona diamondbacks',
  'd-backs': 'arizona diamondbacks',
  'dbacks': 'arizona diamondbacks',
  'diamondbacks': 'arizona diamondbacks',
  'atl braves': 'atlanta braves',
  'braves': 'atlanta braves',
  'bal orioles': 'baltimore orioles',
  'orioles': 'baltimore orioles',
  'bos red sox': 'boston red sox',
  'sox': 'boston red sox',
  'chi cubs': 'chicago cubs',
  'cubs': 'chicago cubs',
  'chi white sox': 'chicago white sox',
  'white sox': 'chicago white sox',
  'cin reds': 'cincinnati reds',
  'reds': 'cincinnati reds',
  'cle guardians': 'cleveland guardians',
  'guardians': 'cleveland guardians',
  'col rockies': 'colorado rockies',
  'rockies': 'colorado rockies',
  'det tigers': 'detroit tigers',
  'tigers': 'detroit tigers',
  'hou astros': 'houston astros',
  'astros': 'houston astros',
  'kc royals': 'kansas city royals',
  'royals': 'kansas city royals',
  'la angels': 'los angeles angels',
  'angels': 'los angeles angels',
  'la dodgers': 'los angeles dodgers',
  'dodgers': 'los angeles dodgers',
  'mia marlins': 'miami marlins',
  'marlins': 'miami marlins',
  'mil brewers': 'milwaukee brewers',
  'brewers': 'milwaukee brewers',
  'min twins': 'minnesota twins',
  'twins': 'minnesota twins',
  'ny mets': 'new york mets',
  'mets': 'new york mets',
  'ny yankees': 'new york yankees',
  'yankees': 'new york yankees',
  'yanks': 'new york yankees',
  'oak athletics': 'athletics',
  'a\'s': 'athletics',
  'phi phillies': 'philadelphia phillies',
  'phillies': 'philadelphia phillies',
  'pit pirates': 'pittsburgh pirates',
  'pirates': 'pittsburgh pirates',
  'sd padres': 'san diego padres',
  'padres': 'san diego padres',
  'sf giants': 'san francisco giants',
  'sea mariners': 'seattle mariners',
  'mariners': 'seattle mariners',
  'stl cardinals': 'st. louis cardinals',
  'tb rays': 'tampa bay rays',
  'rays': 'tampa bay rays',
  'tex rangers': 'texas rangers',
  'tor blue jays': 'toronto blue jays',
  'blue jays': 'toronto blue jays',
  'wsh nationals': 'washington nationals',
  'nationals': 'washington nationals',
  'red bull racing': 'red bull',
  'rbr': 'red bull',
  'mercedes amg': 'mercedes',
  'scuderia ferrari': 'ferrari',
  'mcl': 'mclaren',
  'amr': 'aston martin',
  'alp': 'alpine',
  'wil': 'williams',
  'visa cash app rb': 'racing bulls',
  'vcarb': 'racing bulls',
  'rb': 'racing bulls',
  'stake f1': 'sauber',
  'kick sauber': 'sauber',
  'haas f1': 'haas',
  'atlanta united': 'atlanta united fc',
  'austin': 'austin fc',
  'charlotte': 'charlotte fc',
  'chicago fire': 'chicago fire fc',
  'cincinnati': 'fc cincinnati',
  'colorado': 'colorado rapids',
  'columbus': 'columbus crew',
  'dallas': 'fc dallas',
  'dc united': 'd.c. united',
  'houston dynamo': 'houston dynamo fc',
  'galaxy': 'la galaxy',
  'lag': 'la galaxy',
  'lafc': 'lafc',
  'inter miami': 'inter miami cf',
  'miami': 'inter miami cf',
  'minnesota united': 'minnesota united fc',
  'montreal': 'cf montréal',
  'cf montreal': 'cf montréal',
  'nashville': 'nashville sc',
  'new england': 'new england revolution',
  'nycfc': 'new york city fc',
  'red bulls': 'red bull new york',
  'nyrb': 'red bull new york',
  'orlando city': 'orlando city sc',
  'philadelphia': 'philadelphia union',
  'portland': 'portland timbers',
  'rsl': 'real salt lake',
  'salt lake': 'real salt lake',
  'san jose': 'san jose earthquakes',
  'seattle sounders': 'seattle sounders fc',
  'sporting kc': 'sporting kansas city',
  'st louis': 'st. louis city sc',
  'toronto': 'toronto fc',
  'vancouver whitecaps': 'vancouver whitecaps',
  'whitecaps': 'vancouver whitecaps',
  'boston pwhl': 'boston fleet',
  'minnesota pwhl': 'minnesota frost',
  'montreal pwhl': 'montréal victoire',
  'montreal victoire': 'montréal victoire',
  'new york pwhl': 'new york sirens',
  'ottawa pwhl': 'ottawa charge',
  'toronto pwhl': 'toronto sceptres',
  'acadie bathurst': 'acadie-bathurst titan',
  'titan': 'acadie-bathurst titan',
  'drakkar': 'baie-comeau drakkar',
  'armada': 'blainville-boisbriand armada',
  'cape breton': 'cape breton eagles',
  'sagueneens': 'chicoutimi saguenéens',
  'saguenéens': 'chicoutimi saguenéens',
  'chicoutimi sagueneens': 'chicoutimi saguenéens',
  'voltigeurs': 'drummondville voltigeurs',
  'olympiques': 'gatineau olympiques',
  'mooseheads': 'halifax mooseheads',
  'wildcats': 'moncton wildcats',
  'remparts': 'québec remparts',
  'quebec remparts': 'québec remparts',
  'oceanic': 'rimouski océanic',
  'océanic': 'rimouski océanic',
  'rimouski oceanic': 'rimouski océanic',
  'huskies': 'rouyn-noranda huskies',
  'sea dogs': 'saint john sea dogs',
  'cataractes': 'shawinigan cataractes',
  'phoenix': 'sherbrooke phoenix',
  'foreurs': 'val-d\'or foreurs',
  'tigres': 'victoriaville tigres',

};

export var LEAGUE_ALIASES = {
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
  'cfl': 'cfl',
  'canadian football league': 'cfl',
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

export var LEAGUE_FORMAT_NAMES = {
    'nba': 'NBA',
    'nhl': 'NHL',
    'nfl': 'NFL',
    'mlb': 'MLB',
    'cfl': 'CFL',
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

export function formatLeagueName(league) {
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

export var _normCache = {};


export function getLogo(teamName) {
    ensureLogoCache();
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

export function fetchAndCacheLogoDynamically(teamName) {
    ensureLogoCache();
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


export var STATIC_TEAM_MAP = {};
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

export function getOfficialTeamName(n) {
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

export function toggleGlobalStats() {
    var sidebar = document.getElementById('global-stats-sidebar');
    if (sidebar.style.transform === 'translateX(0px)') {
        sidebar.style.transform = 'translateX(100%)';
    }
}

export function openGlobalStatsFromMatch(mid) {
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

export function openGlobalStats(teamName) {
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

export function fetchTeamStats(teamName) {
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

    // Calendrier à venir
    html += '<div>';
    html += '<h4 style="color:#fff;margin-bottom:12px;display:flex;align-items:center;gap:8px;">📅 Matchs à venir</h4>';
    html += '<div id="gstats-upcoming" style="color:var(--muted);font-size:13px;padding:16px;background:rgba(255,255,255,0.02);border-radius:12px;text-align:center;">Recherche des matchs à venir...</div>';
    html += '</div>';

    // Placeholder pour Standings / Last 5
    var lg = teamMatches.length > 0 ? teamMatches[0].league : '';
    // Try to find league from team name if teamMatches is empty
    if (!lg) {
        for (var k in STATIC_TEAMS) {
            var teams = STATIC_TEAMS[k];
            for (var t in teams) {
                if (normName(teams[t]) === normName(teamName)) {
                    lg = k;
                    break;
                }
            }
            if (lg) break;
        }
    }

    if (lg) {
        html += '<div>';
        html += '<h4 style="color:#fff;margin-bottom:12px;display:flex;align-items:center;gap:8px;">🏆 Classement '+esc(lg)+'</h4>';
        html += '<div id="gstats-standings" style="background:rgba(255,255,255,0.02);padding:16px;border-radius:12px;font-size:13px;color:var(--muted);text-align:center;">Recherche des classements...</div>';
        html += '</div>';

        // Async fetch standings and upcoming matches
        fetchLeagueStandings(lg).then(function(res) {
            var stDiv = document.getElementById('gstats-standings');
            var foundTeamId = null;

            if(stDiv) {
                if(res.source === 'espn' && res.data && res.data.children && res.data.children[0].standings) {
                    var sData = res.data.children[0].standings.entries;
                    var tableHtml = '<table style="width:100%;border-collapse:collapse;text-align:left;font-size:12px;">';
                    tableHtml += '<tr style="color:var(--muted2);border-bottom:1px solid rgba(255,255,255,0.1);"><th style="padding:4px;">#</th><th style="padding:4px;">Équipe</th><th style="padding:4px;">MJ</th><th style="padding:4px;">Pts</th></tr>';

                    var teamFound = false;
                    sData.forEach(function(row, idx) {
                        var isTeam = normName(row.team.name) === normName(teamName) || isMatch(normName(row.team.name), normName(teamName)) || normName(teamName).indexOf(normName(row.team.name)) > -1 || normName(row.team.name).indexOf(normName(teamName)) > -1;
                        if(isTeam) {
                            teamFound = true;
                            foundTeamId = row.team.id;
                        }

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

            // Fetch upcoming schedule if team ID is found
            var upcDiv = document.getElementById('gstats-upcoming');
            if(foundTeamId && upcDiv) {
                fetchTeamSchedule(lg, foundTeamId).then(function(schedRes) {
                    if(schedRes.source === 'espn' && schedRes.data && schedRes.data.events) {
                        var events = schedRes.data.events;
                        // Filter events from today onwards
                        var now = new Date();
                        now.setHours(0,0,0,0);
                        var futureEvents = events.filter(function(e) {
                            var eDate = new Date(e.date);
                            return eDate >= now;
                        }).slice(0, 5); // take next 5

                        if(futureEvents.length > 0) {
                            var uHtml = '';
                            futureEvents.forEach(function(ev) {
                                var comp = ev.competitions[0];
                                var hComp = comp.competitors.find(function(c){return c.homeAway==='home';});
                                var aComp = comp.competitors.find(function(c){return c.homeAway==='away';});

                                var dateObj = new Date(ev.date);
                                var timeStr = getEstTimeStrFromDate(dateObj);
                                var dateStr = getEstDateStrFromDate(dateObj); // YYYY-MM-DD

                                var isHome = hComp.team.id === foundTeamId || (hComp.team.id === undefined && normName(hComp.team.name) === normName(teamName));
                                var oppComp = isHome ? aComp : hComp;
                                var opponentName = oppComp.team ? (oppComp.team.displayName || oppComp.team.name || 'TBD') : 'TBD';
                                var oppLogo = oppComp.team && oppComp.team.logos && oppComp.team.logos.length > 0 ? oppComp.team.logos[0].href : getLogo(opponentName);

                                uHtml += '<div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:12px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.05);">';
                                uHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
                                uHtml += '<span style="font-size:11px;color:var(--muted);font-weight:bold;background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;">'+esc(dateStr)+' ' + esc(timeStr)+'</span>';
                                if (ev.status.type.state === 'in') {
                                    uHtml += '<span style="color:var(--red);font-size:11px;font-weight:bold;background:rgba(255,69,58,0.1);padding:2px 6px;border-radius:4px;">🔴 En Direct</span>';
                                }
                                uHtml += '</div>';

                                uHtml += '<div style="display:flex;align-items:center;gap:8px;">';
                                uHtml += '<div style="flex:1;">';
                                uHtml += '<div style="font-size:12px;color:var(--muted);">'+(isHome ? 'vs (Domicile)' : '@ (Extérieur)')+'</div>';
                                uHtml += '<div style="font-size:15px;font-weight:bold;color:#fff;display:flex;align-items:center;gap:8px;">';
                                if(oppLogo) uHtml += '<img src="'+esc(oppLogo)+'" style="width:20px;height:20px;object-fit:contain;background:#fff;border-radius:50%;padding:2px;">';
                                uHtml += esc(opponentName)+'</div>';
                                uHtml += '</div>';

                                if(ev.status.type.state !== 'pre') {
                                    var hScore = hComp.score ? hComp.score.displayValue : '0';
                                    var aScore = aComp.score ? aComp.score.displayValue : '0';
                                    var tScore = isHome ? parseInt(hScore) : parseInt(aScore);
                                    var oScore = isHome ? parseInt(aScore) : parseInt(hScore);
                                    var resColor = tScore > oScore ? 'var(--accent-green)' : (tScore < oScore ? 'var(--red)' : 'var(--muted)');
                                    uHtml += '<div style="font-size:20px;font-weight:800;color:'+resColor+';background:rgba(0,0,0,0.4);padding:4px 12px;border-radius:8px;">'+hScore+' - '+aScore+'</div>';
                                }

                                uHtml += '</div></div>';
                            });
                            upcDiv.innerHTML = uHtml;
                            upcDiv.style.background = 'transparent';
                            upcDiv.style.padding = '0';
                        } else {
                            upcDiv.innerHTML = 'Aucun match prévu trouvé dans le calendrier.';
                        }
                    } else {
                        upcDiv.innerHTML = 'Calendrier non disponible.';
                    }
                }).catch(function() {
                    upcDiv.innerHTML = 'Erreur de récupération du calendrier.';
                });
            } else if (upcDiv) {
                 upcDiv.innerHTML = 'Impossible de lier l\'équipe pour le calendrier.';
            }

        }).catch(function(e){
            var stDiv = document.getElementById('gstats-standings');
            if(stDiv) stDiv.innerHTML = 'Erreur de récupération du classement.';
            var upcDiv = document.getElementById('gstats-upcoming');
            if(upcDiv) upcDiv.innerHTML = 'Erreur lors de l\'initialisation.';
        });
    } else {
        // Hide upcoming if no league
        var upcDiv = document.getElementById('gstats-upcoming');
        if(upcDiv) upcDiv.innerHTML = 'Ligue introuvable pour afficher le calendrier.';
    }

    html += '</div>';
    content.innerHTML = html;
}

export function normName(n) {
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
export var estFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hourCycle: 'h23',
    hour: 'numeric',
    minute: 'numeric'
});

export function getEstDateStrFromDate(d) {
    var formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(d);
}

export function getEstTimeStrFromDate(d) {
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

/* ══ DOMAIN PREFS ════════════════════════ */
export function getDomain(url) {
  try {
    var u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch(e) {
    return url;
  }
}

export var domainPrefs = {};
try {
  var storedPrefs = localStorage.getItem('domain_prefs');
  if (storedPrefs) domainPrefs = JSON.parse(storedPrefs);
} catch(e) {}

export function saveDomainPrefs() {
  try {
    localStorage.setItem('domain_prefs', JSON.stringify(domainPrefs));
  } catch(e) {}
}

export function toggleDomainPref(domain, type, mid) {
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

export function sortFluxLinks(links) {
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



// Global bindings for HTML compatibility
window.SITE = SITE;
window.MLBITE_URL = MLBITE_URL;
window.MLBBITE_PLUS_URL = MLBBITE_PLUS_URL;
window.SPORTSURGE_URL = SPORTSURGE_URL;
window.BUFFSTREAMS_URL = BUFFSTREAMS_URL;
window.STREAMEAST_URL = STREAMEAST_URL;
window.ONHOCKEY_URL = ONHOCKEY_URL;
window.VIPLEAGUE_URL = VIPLEAGUE_URL;
window.METHSTREAMS_URL = METHSTREAMS_URL;
window.TOTALSPORTEK_URL = TOTALSPORTEK_URL;
window.PROXIES = PROXIES;
window.LGC = LGC;
window.FLAGS = FLAGS;
window.lgColor = lgColor;
window.lgFlag = lgFlag;
window.TEAM_COLORS = TEAM_COLORS;
window.STATIC_TEAMS = STATIC_TEAMS;
window.getTeamColors = getTeamColors;
window.TEAM_ALIASES = TEAM_ALIASES;
window.LEAGUE_ALIASES = LEAGUE_ALIASES;
window.LEAGUE_FORMAT_NAMES = LEAGUE_FORMAT_NAMES;
window.formatLeagueName = formatLeagueName;
window._normCache = _normCache;
window.getLogo = getLogo;
window.fetchAndCacheLogoDynamically = fetchAndCacheLogoDynamically;
window.STATIC_TEAM_MAP = STATIC_TEAM_MAP;
window.getOfficialTeamName = getOfficialTeamName;
window.toggleGlobalStats = toggleGlobalStats;
window.openGlobalStatsFromMatch = openGlobalStatsFromMatch;
window.openGlobalStats = openGlobalStats;
window.fetchTeamStats = fetchTeamStats;
window.normName = normName;
window.estFormatter = estFormatter;
window.getEstDateStrFromDate = getEstDateStrFromDate;
window.getEstTimeStrFromDate = getEstTimeStrFromDate;
window.getDomain = getDomain;
window.domainPrefs = domainPrefs;
window.saveDomainPrefs = saveDomainPrefs;
window.toggleDomainPref = toggleDomainPref;
window.sortFluxLinks = sortFluxLinks;

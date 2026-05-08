// ══ URLs DES SITES ET PROXIES ═══════════════════════════
const SITE = 'https://footybite.to';
const MLBITE_URL = 'https://nflbite.is/';
const MLBBITE_PLUS_URL = 'https://mlbbite.plus';
const SPORTSURGE_URL = 'https://v2.sportsurge.net/home5/';
const BUFFSTREAMS_URL = 'https://buffstreams.com.co/index2';
const STREAMEAST_URL = 'https://naturallyyou.fit/';
const ONHOCKEY_URL = 'https://onhockey.tv/schedule_table.php';
const VIPLEAGUE_URL = 'https://vipleague.im/top-streaming';
const METHSTREAMS_URL = 'https://methstreams.com/';
const TOTALSPORTEK_URL = 'https://totalsportek-real.com/';

const PROXIES = [
  function(u){ return 'https://api.allorigins.win/get?url='+encodeURIComponent(u); },
  function(u){ return 'https://api.codetabs.com/v1/proxy/?quest='+encodeURIComponent(u); },
  function(u){ return 'https://corsproxy.io/?'+encodeURIComponent(u); }
];

// ══ LIGUES PAR DÉFAUT (UI & ORDONNANCEMENT) ═══════════════════════════
const DEFAULT_LEAGUES = {
    'NHL': { icon: '🏒' },
    'NFL': { icon: '🏈' },
    'MLB': { icon: '⚾' },
    'NBA': { icon: '🏀' },
    'PREMIER LEAGUE': { icon: '⚽' },
    'CHAMPIONS LEAGUE': { icon: '⚽' },
    'F1': { icon: '🏎️' },
    'LIGUE 1': { icon: '⚽' },
    'LA LIGA': { icon: '⚽' },
    'SERIE A': { icon: '⚽' },
    'BUNDESLIGA': { icon: '⚽' },
    'MLS': { icon: '⚽' },
    'PWHL': { icon: '🏒' },
    'LHJMQ': { icon: '🏒' },
    'AHL': { icon: '🏒' }
};

// ══ CHEMINS D'API ESPN ═══════════════════════════
const ESPN_LEAGUES = {
    'NHL': 'hockey/nhl',
    'NFL': 'football/nfl',
    'NBA': 'basketball/nba',
    'MLB': 'baseball/mlb',
    'PREMIER LEAGUE': 'soccer/eng.1',
    'LA LIGA': 'soccer/esp.1',
    'LIGUE 1': 'soccer/fra.1',
    'SERIE A': 'soccer/ita.1',
    'BUNDESLIGA': 'soccer/ger.1',
    'MLS': 'soccer/usa.1',
    'CHAMPIONS LEAGUE': 'soccer/uefa.champions',
    'F1': 'racing/f1'
};

// ══ COULEURS DE LIGUES ═══════════════════════════
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
  'argentina':'🇦🇷','world':'🌍','europe':'🇪🇺'
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SITE, MLBITE_URL, MLBBITE_PLUS_URL, SPORTSURGE_URL, BUFFSTREAMS_URL, STREAMEAST_URL, ONHOCKEY_URL, VIPLEAGUE_URL, METHSTREAMS_URL, TOTALSPORTEK_URL, PROXIES, DEFAULT_LEAGUES, ESPN_LEAGUES, LGC, FLAGS };
}

import { esc } from './utils.js';
import { TEAM_DATA } from './teams.js';

export var STATIC_TEAMS = [];
export var TEAM_COLORS = {};
export var TEAM_ALIASES = {};
export var NORM_TEAM_KEYS = {};

for (var key in TEAM_DATA) {
    var data = TEAM_DATA[key];
    if (data.name && data.league) {
        if (Array.isArray(data.league)) {
            data.league.forEach(function(lg) {
                STATIC_TEAMS.push({ name: data.name, league: lg });
            });
        } else {
            STATIC_TEAMS.push({ name: data.name, league: data.league });
        }
    }
    if (data.colors) {
        TEAM_COLORS[data.name.toLowerCase()] = data.colors;
        TEAM_COLORS[key] = data.colors;
    }
    if (data.aliases) {
        data.aliases.forEach(function(alias) {
            TEAM_ALIASES[alias] = key;
        });
    }
}
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
  if(l.indexOf('nfl') >= 0 || l.indexOf('american football') >= 0 || l.indexOf('cfl') >= 0) return '🏈';
  if(l.indexOf('nba') >= 0 || l.indexOf('basketball') >= 0) return '🏀';
  if(l.indexOf('nhl') >= 0 || l.indexOf('hockey') >= 0 || l.indexOf('pwhl') >= 0 || l.indexOf('qmjhl') >= 0 || l.indexOf('lhjmq') >= 0 || l.indexOf('ahl') >= 0 || l.indexOf('echl') >= 0 || l.indexOf('ncaa') >= 0) return '🏒';
  if(l.indexOf('f1') >= 0 || l.indexOf('formula 1') >= 0 || l.indexOf('indycar') >= 0 || l.indexOf('indy') >= 0 || l.indexOf('racing') >= 0) return '🏎️';
  if(l.indexOf('motogp') >= 0 || l.indexOf('moto gp') >= 0) return '🏍️';
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



export function getTeamColors(teamName) {
    if (!teamName) return ['#333333', '#ffffff'];
    var lowerName = teamName.toLowerCase().trim();
    if (TEAM_DATA[lowerName] && TEAM_DATA[lowerName].colors) {
        return TEAM_DATA[lowerName].colors;
    }

    var norm = normName(teamName);
    if (NORM_TEAM_KEYS[norm]) {
        var realKey = NORM_TEAM_KEYS[norm];
        if (TEAM_DATA[realKey] && TEAM_DATA[realKey].colors) {
            return TEAM_DATA[realKey].colors;
        }
    }

    var aliasKey = TEAM_ALIASES[lowerName] || TEAM_ALIASES[norm];
    if (aliasKey && TEAM_DATA[aliasKey] && TEAM_DATA[aliasKey].colors) {
        return TEAM_DATA[aliasKey].colors;
    }

    for (var key in TEAM_DATA) {
        var normKey = normName(key);
        if (normKey.length > 0 && norm.length > 0 && (norm === normKey || norm.includes(normKey) || normKey.includes(norm))) {
            if (TEAM_DATA[key] && TEAM_DATA[key].colors) {
                return TEAM_DATA[key].colors;
            }
        }
    }

    var hash = 0;
    for (var i = 0; i < norm.length; i++) hash = norm.charCodeAt(i) + ((hash << 5) - hash);
    var hue = Math.abs(hash % 360);
    return ['hsl('+hue+', 60%, 30%)', '#ffffff'];
}

export var LEAGUE_ALIASES = {
  'fifa world cup': 'world cup',
  'coupe du monde': 'world cup',
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
  'europa league': 'uefa europa league',
  'ligue europa': 'uefa europa league',
  'conference league': 'uefa europa conference league',
  'europa conference league': 'uefa europa conference league',
  'ligue europa conference': 'uefa europa conference league',
  'efl cup': 'league cup',
  'carabao cup': 'league cup',
  'nations league': 'uefa nations league',
  'ligue des nations': 'uefa nations league',
  'german bundesliga': 'bundesliga',
  'english premier league': 'premier league',
  'french ligue 1': 'ligue 1',
  'spanish laliga': 'la liga',
  'italian serie a': 'serie a',
  'pwhl': 'pwhl',
  'professional womens hockey league': 'pwhl',
  'lhjmq': 'lhjmq',
  'qmjhl': 'lhjmq',
  'quebec maritimes junior hockey league': 'lhjmq',
  'ligue de hockey junior maritimes quebec': 'lhjmq',
  'indycar': 'indycar',
  'indy car': 'indycar',
  'motogp': 'motogp',
  'moto gp': 'motogp',
  'wwe': 'wwe',
  'ahl': 'ahl',
  'american hockey league': 'ahl',
  'echl': 'echl',
  'ncaa': 'ncaa',
  'ncaa football': 'ncaa football',
  'ncaa basketball': 'ncaa men\'s basketball',
  'wnba': 'wnba',
  'womens national basketball association': 'wnba',
  'iihf world championship': 'world hockey championships',
  'iihf world championships': 'world hockey championships',
  'world hockey championship': 'world hockey championships',
  'world championship': 'world hockey championships',
  'euroleague': 'euroleague',
  'champions cup': 'champions cup',
  'challenge cup': 'challenge cup',
  'top 14': 'top 14',
  'pro d2': 'pro d2',
  'united rugby championship': 'urc',
  'urc': 'urc',
  'premiership rugby': 'premiership rugby',
  'super rugby': 'super rugby',
    'six nations': 'six nations',
    'world cup': 'world cup'
};
export var DEFAULT_LEAGUES = {
    'WORLD CUP': { icon: '⚽' },
    'CHAMPIONS LEAGUE': { icon: '⚽' },
    'NHL': { icon: '🏒' },
    'PWHL': { icon: '🏒' },
    'F1': { icon: '🏎️' },
    'NBA': { icon: '🏀' },
    'MLB': { icon: '⚾' },
    'PREMIER LEAGUE': { icon: '⚽' },
    'LIGUE 1': { icon: '⚽' },
    'NFL': { icon: '🏈' },
    'LA LIGA': { icon: '⚽' },
    'SERIE A': { icon: '⚽' },
    'BUNDESLIGA': { icon: '⚽' },
    'EUROPA LEAGUE': { icon: '⚽' },
    'CONFERENCE LEAGUE': { icon: '⚽' },
    'EREDIVISIE': { icon: '⚽' },
    'PRIMEIRA LIGA': { icon: '⚽' },
    'NATIONS LEAGUE': { icon: '⚽' },
    'FA CUP': { icon: '⚽' },
    'LEAGUE CUP': { icon: '⚽' },
    'COPA DEL REY': { icon: '⚽' },
    'DFB POKAL': { icon: '⚽' },
    'MLS': { icon: '⚽' },
    'LHJMQ': { icon: '🏒' },
    'AHL': { icon: '🏒' },
    'CFL': { icon: '🏈' },
    'INDYCAR': { icon: '🏎️' },
    'MOTOGP': { icon: '🏍️' },
    'WORLD HOCKEY CHAMPIONSHIPS': { icon: '🏒' },
    'LCS': { icon: '🎮' },
    'LEC': { icon: '🎮' },
    'LPL': { icon: '🎮' },
    'LCK': { icon: '🎮' },
    'MSI': { icon: '🎮' },
    'WORLDS': { icon: '🎮' }
};

export var OTHER_LEAGUES = {
    'SAUDI PRO LEAGUE': { icon: '⚽' },
    'WORLD BASEBALL CLASSIC': { icon: '⚾' },
    'FIBA WORLD CUP': { icon: '🏀' },
    'NCAA MEN\'S BASKETBALL': { icon: '🏀' },
    'OLYMPICS MEN\'S BASKETBALL': { icon: '🏀' },
    'NCAA WOMEN\'S BASKETBALL': { icon: '🏀' },
    'NCAA FOOTBALL': { icon: '🏈' },
    'WORLD CUP OF HOCKEY': { icon: '🏒' },
    'NCAA MEN\'S ICE HOCKEY': { icon: '🏒' },
    'OLYMPICS MEN\'S ICE HOCKEY': { icon: '🏒' },
    'OLYMPICS WOMEN\'S ICE HOCKEY': { icon: '🏒' },
    'NCAA WOMEN\'S HOCKEY': { icon: '🏒' },
    'FIFA WORLD CUP': { icon: '⚽' },
    'FIFA WOMEN\'S WORLD CUP': { icon: '⚽' },
    'NWSL': { icon: '⚽' },
    'WWE': { icon: '🥊' },
    'ECHL': { icon: '🏒' },
    'NCAA': { icon: '🎓' },
    'WNBA': { icon: '🏀' },
    'EUROLEAGUE': { icon: '🏀' },
    'CHAMPIONS CUP': { icon: '🏉' },
    'CHALLENGE CUP': { icon: '🏉' },
    'TOP 14': { icon: '🏉' },
    'PRO D2': { icon: '🏉' },
    'URC': { icon: '🏉' },
    'PREMIERSHIP RUGBY': { icon: '🏉' },
    'SUPER RUGBY': { icon: '🏉' },
    'SIX NATIONS': { icon: '🏉' },
    'NASCAR': { icon: '🏎️' },
    'GOLF': { icon: '⛳' },
    'PGA': { icon: '⛳' },
    'TENNIS': { icon: '🎾' },
    'ATP': { icon: '🎾' },
    'WTA': { icon: '🎾' },
    'UFC': { icon: '🥊' },
    'BOXING': { icon: '🥊' },
    'DARTS': { icon: '🎯' },
    'SNOOKER': { icon: '🎱' },
    'CYCLING': { icon: '🚴' }
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
    'uefa europa conference league': 'Conference League',
    'eredivisie': 'Eredivisie',
    'primeira liga': 'Primeira Liga',
    'uefa nations league': 'Nations League',
    'fa cup': 'FA Cup',
    'league cup': 'League Cup',
    'copa del rey': 'Copa del Rey',
    'dfb pokal': 'DFB Pokal',
    'saudi pro league': 'Saudi Pro League',
    'f1': 'F1',
    'pwhl': 'PWHL',
    'lhjmq': 'LHJMQ',
    'ahl': 'AHL',
    'echl': 'ECHL',
    'ncaa': 'NCAA',
    'wnba': 'WNBA',
    'euroleague': 'Euroleague',
    'champions cup': 'Champions Cup',
    'challenge cup': 'Challenge Cup',
    'top 14': 'Top 14',
    'pro d2': 'Pro D2',
    'urc': 'URC',
    'premiership rugby': 'Premiership Rugby',
    'super rugby': 'Super Rugby',
    'six nations': 'Six Nations',
    'world cup': 'World Cup',
    'world hockey championships': 'World Hockey Championships',
    'world baseball classic': 'World Baseball Classic',
    'fiba world cup': 'FIBA World Cup',
    'ncaa men\'s basketball': 'NCAA Men\'s Basketball',
    'olympics men\'s basketball': 'Olympics Men\'s Basketball',
    'ncaa women\'s basketball': 'NCAA Women\'s Basketball',
    'ncaa football': 'NCAA Football',
    'world cup of hockey': 'World Cup of Hockey',
    'ncaa men\'s ice hockey': 'NCAA Men\'s Ice Hockey',
    'olympics men\'s ice hockey': 'Olympics Men\'s Ice Hockey',
    'olympics women\'s ice hockey': 'Olympics Women\'s Ice Hockey',
    'ncaa women\'s hockey': 'NCAA Women\'s Hockey',
    'fifa world cup': 'FIFA World Cup',
    'fifa women\'s world cup': 'FIFA Women\'s World Cup',
    'nwsl': 'NWSL'
};
export function formatLeagueName(league) {
    if (!league) return 'Autres Flux';
    var lower = league.toLowerCase().trim();
    if (LEAGUE_ALIASES[lower]) {
        lower = LEAGUE_ALIASES[lower];
    }

    var formatted = '';
    if (LEAGUE_FORMAT_NAMES[lower]) {
        formatted = LEAGUE_FORMAT_NAMES[lower];
    } else {
        formatted = lower.replace(/\b\w/g, function(l){ return l.toUpperCase(); });
    }

    // Si la ligue n'est pas dans DEFAULT_LEAGUES ou OTHER_LEAGUES, on la laisse telle quelle
    // Exception pour 'Autres' (qui peut être utilisé ailleurs) et 'Autres Flux'
    if (DEFAULT_LEAGUES && formatted !== 'Autres' && formatted !== 'Autres Flux') {
        if (!DEFAULT_LEAGUES[formatted.toUpperCase()] && (!OTHER_LEAGUES || !OTHER_LEAGUES[formatted.toUpperCase()])) {
            return formatted;
        }
    }
    return formatted;
}
export var _normCache = {};

export function getLogo(teamName) {
    if(!teamName) return null;
    var lowerName = teamName.toLowerCase().trim();
    if (TEAM_DATA[lowerName] && TEAM_DATA[lowerName].logo) {
        return TEAM_DATA[lowerName].logo;
    }

    var key = normName(teamName);
    if (NORM_TEAM_KEYS[key]) {
        var realKey = NORM_TEAM_KEYS[key];
        if (TEAM_DATA[realKey] && TEAM_DATA[realKey].logo) {
            return TEAM_DATA[realKey].logo;
        }
    }

    var aliasKey = TEAM_ALIASES[lowerName] || TEAM_ALIASES[key];
    if (aliasKey && TEAM_DATA[aliasKey] && TEAM_DATA[aliasKey].logo) {
        return TEAM_DATA[aliasKey].logo;
    }

    var colors = getTeamColors(teamName);
    var bg = colors[0].replace('#', '');
    if (bg.startsWith('hsl')) bg = '333333';
    var fg = colors[1].replace('#', '');
    if (fg.startsWith('hsl')) fg = 'ffffff';

    return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(teamName) + '&background=' + bg + '&color=' + fg + '&size=200&font-size=0.4';
}

export var STATIC_TEAM_MAP = {};
STATIC_TEAM_MAP["abudhabigrandprix"] = "Abu Dhabi Grand Prix";
STATIC_TEAM_MAP["bahraingrandprix"] = "Bahrain Grand Prix";
STATIC_TEAM_MAP["saudiarabiangrandprix"] = "Saudi Arabian Grand Prix";
if (typeof STATIC_TEAMS !== 'undefined') {
    STATIC_TEAMS.forEach(function(t) {
        var lower = t.name.toLowerCase().trim();
        var stripped = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(fc|afc|sc|cf|de|sporting|cd|racing)\b/g, '').trim().replace(/[^a-z0-9]/g, '');
        if (stripped) {
            STATIC_TEAM_MAP[stripped] = t.name;
        }
    });
}
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
    // Avoid false positives for racing events by skipping fuzzy match if the name contains "grand prix" or "indy"
    var isRacingEvent = n.toLowerCase().includes('grand prix') || n.toLowerCase().includes('indy') || n.toLowerCase().includes('indianapolis') || n.toLowerCase() === 'race' || n.toLowerCase() === 'fp1' || n.toLowerCase() === 'fp2' || n.toLowerCase() === 'fp3' || n.toLowerCase() === 'qual' || n.toLowerCase() === 'qualifying' || n.toLowerCase() === 'sprint' || n.toLowerCase() === 'sr' || n.toLowerCase() === 'ss';
    if (!isRacingEvent && typeof STATIC_TEAM_MAP !== 'undefined' && typeof isMatch === 'function' && typeof stringSimilarity === 'function') {
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

  // Basic fallback replacements (e.g. fc, afc, sc, cf)
  var stripped = lower.replace(/\b(fc|afc|sc|cf|de|cd|club)\b/gi, '').trim();
  if (stripped.length > 0) {
      lower = stripped;
  }

  var norm = lower.replace(/[^a-z0-9]/g, '');
  _normCache[n] = norm;
  return norm;
}
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
window.DEFAULT_LEAGUES = DEFAULT_LEAGUES;
window.OTHER_LEAGUES = OTHER_LEAGUES;
window.formatLeagueName = formatLeagueName;
window._normCache = _normCache;
window.getLogo = getLogo;
window.STATIC_TEAM_MAP = STATIC_TEAM_MAP;
window.getOfficialTeamName = getOfficialTeamName;
window.normName = normName;

for (var key in TEAM_DATA) {
    NORM_TEAM_KEYS[normName(key)] = key;
}
window.NORM_TEAM_KEYS = NORM_TEAM_KEYS;

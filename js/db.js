import { TEAM_DATA } from './teams.js';

export var STATIC_TEAMS = [];
export var TEAM_COLORS = {};
export var TEAM_ALIASES = {};
export var NORM_TEAM_KEYS = {};
/* Alias vus sur au moins deux équipes distinctes : voir la construction de
   TEAM_ALIASES ci-dessous. Une fois marqué ici, un alias ne rejoint plus
   jamais TEAM_ALIASES, même si une équipe ultérieure le déclare seule. */
var AMBIGUOUS_ALIASES = {};

for (var key in TEAM_DATA) {
    var data = TEAM_DATA[key];
    if (data.name && data.league) {
        if (Array.isArray(data.league)) {
            for (var i = 0; i < data.league.length; i++) {
                STATIC_TEAMS.push({ name: data.name, league: data.league[i] });
            }
        } else {
            STATIC_TEAMS.push({ name: data.name, league: data.league });
        }
    }
    if (data.colors) {
        TEAM_COLORS[data.name.toLowerCase()] = data.colors;
        TEAM_COLORS[key] = data.colors;
    }
    if (data.aliases) {
        for (var i = 0; i < data.aliases.length; i++) {
            var a = data.aliases[i];
            if (Object.prototype.hasOwnProperty.call(TEAM_ALIASES, a) && TEAM_ALIASES[a] !== key) {
                // Alias déjà pris par une AUTRE équipe : c'est un court identifiant partagé
                // ("rangers", "man", "bos"...) entre plusieurs clubs/franchises distincts,
                // pas un vrai doublon. `TEAM_ALIASES[a] = key` écrasait silencieusement
                // l'entrée précédente au profit de la dernière équipe déclarée dans
                // teams.js — "Rangers" résolvait toujours vers Texas Rangers (MLB), qui
                // apparaît après Queens Park Rangers et les New York Rangers dans le
                // fichier, y compris pour un match de football écossais. On retire
                // l'alias plutôt que de deviner : `getOfficialTeamName` renvoie alors le
                // nom d'origine, non résolu mais jamais faux.
                AMBIGUOUS_ALIASES[a] = true;
                delete TEAM_ALIASES[a];
                continue;
            }
            if (AMBIGUOUS_ALIASES[a]) continue;
            TEAM_ALIASES[a] = key;
        }
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
  'argentina':'🇦🇷','europe':'🌍','world':'🌐','scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','belgium':'🇧🇪'
};
export function lgColor(n){
  var l=(n||'').toLowerCase();
  for(var k in LGC){ if(l.indexOf(k)>=0) return LGC[k]; }
  var h=0; var str=n||'X'; for(var i=0; i<str.length; i++) h+=str.charCodeAt(i);
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
  if(l.indexOf('wwe') >= 0 || l.indexOf('aew') >= 0 || l.indexOf('wrestling') >= 0 || l.indexOf('ufc') >= 0 || l.indexOf('mma') >= 0 || l.indexOf('boxing') >= 0) return '🥊';
  if(l.indexOf('tennis') >= 0) return '🎾';
  if(l.indexOf('rugby') >= 0) return '🏉';
  if(l.indexOf('golf') >= 0) return '⛳';
  if(l.indexOf('cricket') >= 0) return '🏏';
  if(l.indexOf('volleyball') >= 0) return '🏐';
  if(l.indexOf('darts') >= 0) return '🎯';
  if(l.indexOf('snooker') >= 0) return '🎱';
  if(l.indexOf('cycling') >= 0 || l.indexOf('tour de france') >= 0) return '🚴';

  var targetLeagues = ['lcs', 'lec', 'lpl', 'lck', 'msi', 'worlds', 'cblol', 'ljl', 'pcs', 'vcs', 'lla', 'tcl', 'lcp', 'nlc', 'prime league', 'lvp superliga', 'lit', 'esports balkan league', 'greek legends league', 'arabian league', 'nacl', 'cblol academy', 'lck challengers', 'lpl academy'];
  if (targetLeagues.includes(l) || l.includes('esports') || l.includes('e-sports')) return '🎮';

  return '⚽';
}



/* Clés de TEAM_DATA normalisées une seule fois, pour la correspondance partielle de
   getTeamColors. Construction paresseuse : normName s'appuie sur TEAM_ALIASES et
   LEAGUE_ALIASES, définis plus bas dans ce module. Les entrées sans couleurs sont
   écartées — la boucle d'origine les traversait sans jamais rien en tirer. */
var _normKeyIndex = null;
function normKeyIndex() {
    if (_normKeyIndex) return _normKeyIndex;
    _normKeyIndex = [];
    for (var key in TEAM_DATA) {
        if (!TEAM_DATA[key] || !TEAM_DATA[key].colors) continue;
        var nk = normName(key);
        if (nk.length > 0) _normKeyIndex.push([nk, key]);
    }
    return _normKeyIndex;
}

/* Résultats mémorisés. TEAM_DATA, TEAM_ALIASES et NORM_TEAM_KEYS sont figés après le
   chargement du module : pour un même nom, la réponse ne change jamais. La grille est
   reconstruite à chaque passe de rafraîchissement (toutes les 60 s) sur les mêmes noms
   d'équipes, et chaque carte interroge deux fois cette fonction — plus une fois par
   appel de getLogo qui retombe sur elle. */
var _teamColorsCache = Object.create(null);

export function getTeamColors(teamName) {
    if (!teamName) return ['#333333', '#ffffff'];
    var memo = _teamColorsCache[teamName];
    if (memo) return memo;
    var result = computeTeamColors(teamName);
    _teamColorsCache[teamName] = result;
    return result;
}

function computeTeamColors(teamName) {
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

    /* Repli par correspondance partielle. Il parcourait les 821 entrées de TEAM_DATA en
       appelant normName sur chaque clé, à chaque appel non résolu — soit deux fois par
       carte de match, plus une fois par appel de getLogo qui retombe ici. Les clés
       normalisées sont désormais calculées une seule fois. L'ordre du tableau est celui
       de `for...in` sur TEAM_DATA (ordre d'insertion des clés de type chaîne), donc la
       première correspondance trouvée reste exactement la même qu'avant. */
    var index = normKeyIndex();
    for (var ni = 0; ni < index.length; ni++) {
        var normKey = index[ni][0];
        if (norm.length > 0 && (norm === normKey || norm.includes(normKey) || normKey.includes(norm))) {
            var entry = TEAM_DATA[index[ni][1]];
            if (entry && entry.colors) {
                return entry.colors;
            }
        }
    }

    var hash = 0;
    for (var i = 0; i < norm.length; i++) hash = norm.charCodeAt(i) + ((hash << 5) - hash);
    var hue = Math.abs(hash % 360);
    return ['hsl('+hue+', 60%, 30%)', '#ffffff'];
}

/* 25 des 821 entrées de TEAM_DATA ne déclarent qu'une seule couleur (les sélections
   nationales surtout). getTeamColors renvoyait alors un tableau d'un élément et tout
   appelant qui lit colors[1] plantait. La paire est désormais toujours complète. */
export function teamColorPair(teamName) {
    var c = getTeamColors(teamName);
    if (!Array.isArray(c)) return ['#333333', '#ffffff'];
    return [c[0] || '#333333', c[1] || '#ffffff'];
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
  'english carabao cup': 'league cup',
  'english league cup': 'league cup',
  'english fa cup': 'fa cup',
  'spanish copa del rey': 'copa del rey',
  'german dfb-pokal': 'dfb pokal',
  'german dfb pokal': 'dfb pokal',
  'german cup': 'dfb pokal',
  'dutch eredivisie': 'eredivisie',
  'portuguese primeira liga': 'primeira liga',
  'nations league': 'uefa nations league',
  'ligue des nations': 'uefa nations league',
  'german bundesliga': 'bundesliga',
  'english premier league': 'premier league',
  'french ligue 1': 'ligue 1',
  'spanish laliga': 'la liga',
  'spanish la liga': 'la liga',
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
    'world cup': 'world cup',
    // Noms renvoyés par ESPN / TheSportsDB ramenés aux clés connues de
    // DEFAULT_LEAGUES / OTHER_LEAGUES (sinon la ligue tombe dans « Autres »).
    'women\'s national basketball association': 'wnba',
    'pga tour': 'pga',
    'french top 14': 'top 14',
    'gallagher prem': 'premiership rugby',
    'ultimate fighting championship': 'ufc',
    'indycar series': 'indycar',
    'nascar cup series': 'nascar',
    'ncaa - football': 'ncaa football',
    'ncaa - men\'s basketball': 'ncaa men\'s basketball',
    'ncaa - women\'s basketball': 'ncaa women\'s basketball'
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
    // 'FIFA WORLD CUP' n'est pas listée ici : LEAGUE_ALIASES la ramène à 'world cup',
    // qui est une ligue principale. L'y remettre créerait un doublon inatteignable.
    'FIFA WOMEN\'S WORLD CUP': { icon: '⚽' },
    'NWSL': { icon: '⚽' },
    'WWE': { icon: '🥊' },
    'AEW': { icon: '🥊' },
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

/* Niveau d'une ligue, unique source de vérité pour la séparation de l'interface :
     'main'      -> ligue principale, affichée en premier ;
     'secondary' -> ligue secondaire, regroupée dans sa propre section ;
     'ignored'   -> masquée partout (choix de l'utilisateur uniquement) ;
     'other'     -> flux agrégé non identifié ("Autres streams").
   Le choix de l'utilisateur (Favoris -> Ligues, stocké dans league_tiers) prime sur les
   listes par défaut DEFAULT_LEAGUES / OTHER_LEAGUES. FAVORIS et EN DIRECT sont des
   sections synthétiques : jamais masquées, toujours principales. */
export function leagueTier(league, overrides) {
    var key = String(league || '').toUpperCase().trim();
    if (!key) return 'other';
    if (key === 'FAVORIS' || key === 'EN DIRECT') return 'main';
    var ov = overrides || (typeof window !== 'undefined' ? window.leagueTierOverrides : null) || {};
    var chosen = ov[key];
    if (chosen === 'main' || chosen === 'secondary' || chosen === 'ignored' || chosen === 'other') return chosen;
    if (key === 'AUTRES' || key === 'AUTRES FLUX') return 'other';
    if (DEFAULT_LEAGUES[key]) return 'main';
    if (OTHER_LEAGUES && OTHER_LEAGUES[key]) return 'secondary';
    return 'other';
}

/* Niveau par défaut d'une ligue, en ignorant le choix de l'utilisateur (pour l'interface
   de réglage : savoir si une valeur est personnalisée). */
export function defaultLeagueTier(league) {
    return leagueTier(league, {});
}

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
    'motogp': 'MotoGP',
    'aew': 'AEW',
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
    'nwsl': 'NWSL',
    'pga': 'PGA',
    'ufc': 'UFC',
    'atp': 'ATP',
    'wta': 'WTA',
    'indycar': 'IndyCar',
    'nascar': 'NASCAR',
    'boxing': 'Boxing',
    'tennis': 'Tennis',
    'golf': 'Golf',
    'mma': 'MMA',
    'wwe': 'WWE',
    'one': 'ONE',
    'nxt': 'NXT'
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
        /* `\b\w` sans le drapeau `u` ne voit pas les lettres accentuées comme des
           lettres : « pohár primátora » posait donc une frontière de mot juste avant le
           « r » de « pohár », et rendait « PoháR PrimáTora ». On capitalise plutôt la
           lettre qui suit un début de chaîne ou un séparateur, `\p{L}` couvrant tout
           l'alphabet latin accentué. */
        formatted = lower.replace(/(^|[\s'’\-–—/(),.])(\p{L})/gu, function(_, sep, ch){ return sep + ch.toUpperCase(); });
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

/* Un blason authentique, par opposition à une vignette fabriquée à partir du nom.
   Sert à départager deux entrées de la base qui désignent le même club. */
export function isRealCrest(url) {
    return !!url && String(url).indexOf('ui-avatars.com') < 0;
}

export function getLogo(teamName) {
    if(!teamName) return null;
    var lowerName = teamName.toLowerCase().trim();

    if (lowerName === 'wwe' || lowerName === 'raw' || lowerName === 'smackdown' || lowerName === 'nxt' || lowerName.includes('wrestlemania')) {
        return 'https://a.espncdn.com/i/teamlogos/leagues/500/wwe.png';
    }
    if (lowerName === 'f1' || lowerName.includes('grand prix') || lowerName.includes('formula 1') || lowerName.includes('gp ')) {
        return 'https://a.espncdn.com/i/teamlogos/leagues/500/f1.png';
    }
    if (lowerName === 'indycar' || lowerName.includes('indy 500') || lowerName.includes('indianapolis 500') || lowerName.includes('indycar series')) {
        // Since we don't have a reliable direct link for IndyCar, use a UI avatar with IndyCar colors (Red and Black)
        return 'https://ui-avatars.com/api/?name=IndyCar&background=e3002b&color=ffffff&size=200&font-size=0.4';
    }

    // For eSports teams fallback to gamepad emoji if we don't find a proper logo
    var targetLeagues = ['lcs', 'lec', 'lpl', 'lck', 'msi', 'worlds', 'cblol', 'ljl', 'pcs', 'vcs', 'lla', 'tcl', 'lcp', 'nlc', 'prime league', 'lvp superliga', 'lit', 'esports balkan league', 'greek legends league', 'arabian league', 'nacl', 'cblol academy', 'lck challengers', 'lpl academy'];
    var isEsports = targetLeagues.includes(lowerName) || lowerName.includes('esports') || lowerName.includes('e-sports');
    // the emoji fallback is handled by ui.js now using m.flag, but we could return 'emoji:🎮' here if we knew it's an esports team.

    /* La base contient des entrées EN DOUBLE, nées de noms mal analysés puis enregistrés
       comme de nouvelles équipes : « parissaintgermain » à côté de « paris saint-germain »,
       « rennes » à côté de « stade rennais », « blue jays » à côté de « toronto blue jays »,
       « auxerre » à côté de « aj auxerre ». Le doublon ne porte qu'un blason généré, et
       comme la recherche testait d'abord la clé exacte, il MASQUAIT le vrai blason du club.
       On préfère donc, parmi les entrées qui se ramènent au même nom, celle qui a un vrai
       blason. Relevé du 4 septembre : 4 clubs concernés. */
    var key = normName(teamName);
    var direct = TEAM_DATA[lowerName] && TEAM_DATA[lowerName].logo;
    var viaNorm = NORM_TEAM_KEYS[key] && TEAM_DATA[NORM_TEAM_KEYS[key]] && TEAM_DATA[NORM_TEAM_KEYS[key]].logo;

    if (direct && (isRealCrest(direct) || !viaNorm)) return direct;
    if (viaNorm) return viaNorm;

    var aliasKey = TEAM_ALIASES[lowerName] || TEAM_ALIASES[key];
    if (aliasKey && TEAM_DATA[aliasKey] && TEAM_DATA[aliasKey].logo) {
        return TEAM_DATA[aliasKey].logo;
    }

    var colors = teamColorPair(teamName);
    var bg = colors[0].replace('#', '');
    if (bg.startsWith('hsl')) bg = '333333';
    var fg = colors[1].replace('#', '');
    if (fg.startsWith('hsl')) fg = 'ffffff';

    if (isEsports) {
        return 'emoji:🎮';
    }

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
/* Sport d'un nom d'équipe d'après la base, ou '' si inconnu. Sert à refuser une
   résolution qui changerait de sport (voir getOfficialTeamName). */
export function sportOfTeamName(name) {
    var lig = leagueOfTeamName(name);
    if (!lig) return '';
    var l = String(lig).toLowerCase();
    if (/nhl|hockey|khl|shl|liiga|ahl|pwhl/.test(l)) return 'hockey';
    if (/nba|wnba|basket/.test(l)) return 'basket';
    if (/mlb|baseball/.test(l)) return 'baseball';
    if (/nfl|cfl|football americain|american football/.test(l)) return 'football-us';
    return 'autre';
}

/* `sport` (3ᵉ argument) : sport du match, quand l'appelant le connaît.

   Sans lui, la résolution est aveugle au contexte et traverse les sports. Cas relevé sur
   le cache du 4 septembre : OnHockey annonce « Pelicans » pour un match de Liiga, et
   l'alias « pelicans » — que seuls les New Orleans Pelicans revendiquent dans la base —
   le résolvait en équipe NBA. La carte affichait donc « New Orleans Pelicans vs Vaasan
   Sport » dans un championnat de hockey finlandais. Il ne s'agit pas d'une ambiguïté
   entre deux entrées : le club de Lahti n'est simplement pas dans la base, et l'alias
   d'un autre sport a comblé le vide.

   Quand le sport est fourni et que la résolution aboutit à une équipe d'un AUTRE sport,
   on rend le nom d'origine : non résolu, mais jamais faux — le même parti pris que pour
   les alias ambigus plus haut dans ce module. */
export function getOfficialTeamName(n, bypassFuzzyMatch, sport) {
    if (!n) return n;
    if (sport) {
        var resolu = getOfficialTeamName(n, bypassFuzzyMatch);
        if (resolu && resolu !== n) {
            var sr = sportOfTeamName(resolu);
            if (sr && sr !== sport) return n;
        }
        return resolu;
    }

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

    var isEsports = false;
    if (n && (n.toLowerCase().includes('esports') || n.toLowerCase().includes('e-sports'))) isEsports = true;
    if (bypassFuzzyMatch || isEsports) return n;

    // Skip all fuzzy match processing and static map mapping if we explicitly bypass it (e.g., for esports)
    if (bypassFuzzyMatch) {
        return n;
    }

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
/* Ligue déclarée pour un nom d'équipe dans TEAM_DATA, ou '' si inconnue.

   Sert à départager des catégories que les sources mêlent : streamed.pk range tout le
   football américain sous « american-football », universitaire et professionnel
   confondus. Or ce sont les 32 clubs de la NFL qui sont recensés ici, pas les centaines
   d'équipes universitaires : un nom qui y répond « nfl » est professionnel, un nom
   inconnu de la base est, en football américain, universitaire. La base existante fait
   donc le tri sans qu'on recopie une liste d'équipes à la main. */
export function leagueOfTeamName(name) {
    if (!name) return '';
    var key = normName(name);
    if (!key) return '';
    var data = TEAM_DATA[key] || TEAM_DATA[String(name).toLowerCase().trim()];
    if (!data) {
        var alias = TEAM_ALIASES[String(name).toLowerCase().trim()];
        if (alias) data = TEAM_DATA[alias];
    }
    if (!data || !data.league) return '';
    return Array.isArray(data.league) ? data.league[0] : data.league;
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
window.teamColorPair = teamColorPair;
window.TEAM_ALIASES = TEAM_ALIASES;
window.LEAGUE_ALIASES = LEAGUE_ALIASES;
window.LEAGUE_FORMAT_NAMES = LEAGUE_FORMAT_NAMES;
window.DEFAULT_LEAGUES = DEFAULT_LEAGUES;
window.OTHER_LEAGUES = OTHER_LEAGUES;
window.leagueTier = leagueTier;
window.defaultLeagueTier = defaultLeagueTier;
window.formatLeagueName = formatLeagueName;
window._normCache = _normCache;
window.getLogo = getLogo;
window.STATIC_TEAM_MAP = STATIC_TEAM_MAP;
window.getOfficialTeamName = getOfficialTeamName;
window.normName = normName;

/* Index des clés de TEAM_DATA par nom normalisé.

   Plusieurs clés se ramènent au même nom, parce que des noms mal analysés ont été
   enregistrés comme de nouvelles équipes : « parissaintgermain » à côté de
   « paris saint-germain », « rennes » à côté de « stade rennais », « blue jays » à côté
   de « toronto blue jays », « auxerre » à côté de « aj auxerre ». L'affectation simple
   gardait la DERNIÈRE clé rencontrée — c'est-à-dire le doublon, qui ne porte qu'un blason
   fabriqué à partir du nom. Le vrai blason du club était donc masqué.

   On préfère l'entrée qui porte un vrai blason. À égalité, la première rencontrée gagne,
   ce qui préserve l'ordre d'insertion de teams.js. */
for (var key in TEAM_DATA) {
    var nk = normName(key);
    var dejaLa = NORM_TEAM_KEYS[nk];
    if (!dejaLa) { NORM_TEAM_KEYS[nk] = key; continue; }
    var ancienVrai = isRealCrest((TEAM_DATA[dejaLa] || {}).logo);
    var nouveauVrai = isRealCrest((TEAM_DATA[key] || {}).logo);
    if (nouveauVrai && !ancienVrai) NORM_TEAM_KEYS[nk] = key;
}
window.NORM_TEAM_KEYS = NORM_TEAM_KEYS;

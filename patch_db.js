const fs = require('fs');
let code = fs.readFileSync('js/db.js', 'utf8');

const defaultLeaguesMatch = code.match(/export var DEFAULT_LEAGUES = \{([\s\S]*?)\};/);
if (defaultLeaguesMatch) {
    const oldDefault = defaultLeaguesMatch[0];
    const newDefault = `export var DEFAULT_LEAGUES = {
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
    'SAUDI PRO LEAGUE': { icon: '⚽' },
    'MLS': { icon: '⚽' },
    'LHJMQ': { icon: '🏒' },
    'AHL': { icon: '🏒' },
    'CFL': { icon: '🏈' },
    'INDYCAR': { icon: '🏎️' },
    'MOTOGP': { icon: '🏍️' }
};

export var OTHER_LEAGUES = {
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
};`;
    code = code.replace(oldDefault, newDefault);
    code = code.replace('window.DEFAULT_LEAGUES = DEFAULT_LEAGUES;', 'window.DEFAULT_LEAGUES = DEFAULT_LEAGUES;\nwindow.OTHER_LEAGUES = OTHER_LEAGUES;');
    fs.writeFileSync('js/db.js', code);
    console.log("Patched db.js");
} else {
    console.log("Could not find DEFAULT_LEAGUES");
}

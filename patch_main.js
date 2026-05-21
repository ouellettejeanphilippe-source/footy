const fs = require('fs');
let code = fs.readFileSync('js/main.js', 'utf8');

code = code.replace(/import \{ lgFlag, STATIC_TEAMS, getLogo, normName, TEAM_ALIASES, DEFAULT_LEAGUES \} from '\.\/db\.js';/g,
"import { lgFlag, STATIC_TEAMS, getLogo, normName, TEAM_ALIASES, DEFAULT_LEAGUES, OTHER_LEAGUES } from './db.js';");

code = code.replace(/if\(DEFAULT_LEAGUES\[norm\]\) return DEFAULT_LEAGUES\[norm\]\.icon;/g,
"if(DEFAULT_LEAGUES[norm]) return DEFAULT_LEAGUES[norm].icon;\n    if(OTHER_LEAGUES[norm]) return OTHER_LEAGUES[norm].icon;");

// Update startup scrape to only look at DEFAULT_LEAGUES (no change needed here really, it stays as is!)

fs.writeFileSync('js/main.js', code);
console.log("Patched main.js");

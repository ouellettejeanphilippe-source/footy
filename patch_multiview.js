const fs = require('fs');
let code = fs.readFileSync('js/multiview.js', 'utf8');

code = code.replace(/import \{ DEFAULT_LEAGUES \} from '\.\/db\.js';/g,
"import { DEFAULT_LEAGUES, OTHER_LEAGUES } from './db.js';");

code = code.replace(/return \(m\.status === 'live' \|\| gmPinnedMatches\.indexOf\(String\(m\.id\)\) > -1\) && DEFAULT_LEAGUES\[\(m\.league\|\|''\)\.toUpperCase\(\)\];/g,
"return (m.status === 'live' || gmPinnedMatches.indexOf(String(m.id)) > -1) && (DEFAULT_LEAGUES[(m.league||'').toUpperCase()] || OTHER_LEAGUES[(m.league||'').toUpperCase()]);");

fs.writeFileSync('js/multiview.js', code);
console.log("Patched multiview.js");

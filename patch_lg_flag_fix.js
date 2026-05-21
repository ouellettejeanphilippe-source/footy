const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

// Ah, lgMap[m.league] is populated with `Object.assign({},m,{matches:[]})`. So `lg.flag` is just `m.flag`.
// In db.js, lgFlag function returns an icon based on the string.
// Let's import lgFlag from utils or db.js.

code = code.replace(/import \{ lg, esc, toggleAccordion, escJs, pad, toggleLeague, safeStorageGetJSON, safeStorageSetJSON, formatTeamNameBreak \} from '\.\/utils\.js';/g,
"import { lg, esc, toggleAccordion, escJs, pad, toggleLeague, safeStorageGetJSON, safeStorageSetJSON, formatTeamNameBreak } from './utils.js';");
code = code.replace(/import \{ DEFAULT_LEAGUES, OTHER_LEAGUES \} from '\.\/db\.js';/g,
"import { DEFAULT_LEAGUES, OTHER_LEAGUES, lgFlag } from './db.js';");


// Replace `lg.flag` with `(lg.flag || lgFlag(lg.league))`
code = code.replace(/<span class="ch-flag">'\+lg\.flag\+'<\/span>/g, `<span class="ch-flag">'+(lg.flag || lgFlag(lg.league) || '')+'</span>`);
code = code.replace(/<div class="prime-league-badge">'\+lg\.flag\+'<\/div>/g, `<div class="prime-league-badge">'+(lg.flag || lgFlag(lg.league) || '')+'</div>`);

fs.writeFileSync('js/ui.js', code);

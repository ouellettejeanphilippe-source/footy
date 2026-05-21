const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

code = code.replace(/import \{ DEFAULT_LEAGUES \} from '\.\/db\.js';/g,
"import { DEFAULT_LEAGUES, OTHER_LEAGUES } from './db.js';");

code = code.replace(/if \(!DEFAULT_LEAGUES\[\(a\|\|''\)\.toUpperCase\(\)\]\) return 1;\n      if \(!DEFAULT_LEAGUES\[\(b\|\|''\)\.toUpperCase\(\)\]\) return -1;/g,
`if (!DEFAULT_LEAGUES[(a||'').toUpperCase()] && (!OTHER_LEAGUES || !OTHER_LEAGUES[(a||'').toUpperCase()])) return 1;
      if (!DEFAULT_LEAGUES[(b||'').toUpperCase()] && (!OTHER_LEAGUES || !OTHER_LEAGUES[(b||'').toUpperCase()])) return -1;`);

code = code.replace(/if \(!DEFAULT_LEAGUES\[\(a\|\|''\)\.toUpperCase\(\)\]\) return 1;\n              if \(!DEFAULT_LEAGUES\[\(b\|\|''\)\.toUpperCase\(\)\]\) return -1;/g,
`if (!DEFAULT_LEAGUES[(a||'').toUpperCase()] && (!OTHER_LEAGUES || !OTHER_LEAGUES[(a||'').toUpperCase()])) return 1;
              if (!DEFAULT_LEAGUES[(b||'').toUpperCase()] && (!OTHER_LEAGUES || !OTHER_LEAGUES[(b||'').toUpperCase()])) return -1;`);

// Since `!DEFAULT_LEAGUES` already excludes the new secondary leagues correctly and moves them into Autres Streams
// we actually don't want to change `autresFluxMatches.push(m)` logic because we WANT those ones to fall into
// `autresFluxMatches` (where !DEFAULT_LEAGUES is true, and they aren't 'FAVORIS' or 'EN DIRECT').

// We might want to fix the sorting of `displayOrder` so that it combines `DEFAULT_LEAGUES` and `OTHER_LEAGUES`
// where `displayOrder` is used, so we don't accidentally ignore OTHER_LEAGUES if we want them sortable,
// but since `OTHER_LEAGUES` are always in "Autres streams", they don't even use the global EPG `lgOrder` logic. They are grouped alphabetically by `lg` string in "Autres Streams".

fs.writeFileSync('js/ui.js', code);
console.log("Patched ui.js");

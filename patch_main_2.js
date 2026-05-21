const fs = require('fs');
let code = fs.readFileSync('js/main.js', 'utf8');

code = code.replace(/if \(!DEFAULT_LEAGUES\[\(a\|\|''\)\.toUpperCase\(\)\] \|\| a === 'Autres'\) return 1;\n            if \(!DEFAULT_LEAGUES\[\(b\|\|''\)\.toUpperCase\(\)\] \|\| b === 'Autres'\) return -1;/g,
`if ((!DEFAULT_LEAGUES[(a||'').toUpperCase()] && !OTHER_LEAGUES[(a||'').toUpperCase()]) || a === 'Autres') return 1;
            if ((!DEFAULT_LEAGUES[(b||'').toUpperCase()] && !OTHER_LEAGUES[(b||'').toUpperCase()]) || b === 'Autres') return -1;`);

fs.writeFileSync('js/main.js', code);
console.log("Patched main.js 2");

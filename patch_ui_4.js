const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

let renderSearch = `          if (liveNow.length === 0 && upNext.length === 0 && laterToday.length === 0) {`;

let renderReplace = `          if (favorisAujourdhui.length === 0 && liveNow.length === 0 && upNext.length === 0 && laterToday.length === 0) {`;

code = code.replace(renderSearch, renderReplace);

fs.writeFileSync('js/ui.js', code);

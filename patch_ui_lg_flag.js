const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

code = code.replace(/<span class="ch-flag">'\+lg\.flag\+'<\/span>/g, `<span class="ch-flag">'+(lg.flag || window.getLeagueIcon(lg.league))+'</span>`);

// Let's add window.getLeagueIcon import to ui.js? Wait, ui.js imports db.js but not getLeagueIcon.
// `lg.flag` is being set somewhere where lgMap is created? Let's check `lgMap` creation.

const fs = require('fs');
let code = fs.readFileSync('js/state.js', 'utf8');

code = code.replace(
    /var defaultFavs = \{ "Toronto Blue Jays": 1, "Montreal Canadiens": 1, "CF Montréal": 1, "Toronto Raptors": 1, "Montréal Victoire": 1 \};/,
    'var defaultFavs = { "Toronto Blue Jays": 1, "Montreal Canadiens": 1, "CF Montréal": 1, "Toronto Raptors": 1, "Montréal Victoire": 1, "WWE": 1, "F1": 1 };'
);

code = code.replace(
    /if \(favTeams\[h\] \|\| favTeams\[a\]\) \{/,
    'if (favTeams[h] || favTeams[a] || favTeams[c.getAttribute(\'data-lg\')]) {'
);

fs.writeFileSync('js/state.js', code);

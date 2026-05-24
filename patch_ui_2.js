const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

// I need to use the replace strings carefully due to tabs and quotes
code = code.replace(
    /var f1 = \(favTeams\[m1.homeTeam\] \|\| favTeams\[m1.awayTeam\]\) \? -1 : 0;/,
    "var f1 = (favTeams[m1.homeTeam] || favTeams[m1.awayTeam] || favTeams[m1.league]) ? -1 : 0;"
);

code = code.replace(
    /var f2 = \(favTeams\[m2.homeTeam\] \|\| favTeams\[m2.awayTeam\]\) \? -1 : 0;/,
    "var f2 = (favTeams[m2.homeTeam] || favTeams[m2.awayTeam] || favTeams[m2.league]) ? -1 : 0;"
);

code = code.replace(
    /if \(favTeams\[m.homeTeam\] \|\| favTeams\[m.awayTeam\]\) b.classList.add\('is-fav'\);/,
    "if (favTeams[m.homeTeam] || favTeams[m.awayTeam] || favTeams[m.league]) b.classList.add('is-fav');"
);

fs.writeFileSync('js/ui.js', code);

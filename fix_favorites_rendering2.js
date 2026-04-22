const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// There is another part of the code checking if a league is 'Coupe de France' inside the rendering logic.
// We just need to make sure the regex replacer correctly handled the update. Let's do a sanity check.

console.log(html.includes("var allTeams = {};"));
console.log(html.includes("var mainLeagues = ['Premier League'"));

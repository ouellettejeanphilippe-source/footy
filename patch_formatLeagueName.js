const fs = require('fs');
let code = fs.readFileSync('js/db.js', 'utf8');

// Also update getLeagueIcon in main.js to make it globally available if we do that, but wait, it's already window.getLeagueIcon = getLeagueIcon.
// Let's make sure it's not printing "undefined" anywhere.

const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

// The issue was BEFORE my patch! Let's check `var textSpan` in ui.js
// Ah, `getLeagueIcon` was NOT imported into ui.js, so `window.getLeagueIcon` might be undefined.
// If `window.getLeagueIcon` is undefined, then my code says:
// `if (window.getLeagueIcon && ...)` -> it skips it!
// So where is the `undefined` coming from?!

console.log(code.match(/undefined.*?AHL/g));

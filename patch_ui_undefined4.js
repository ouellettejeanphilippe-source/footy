const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

// The undefined is coming from the `textSpan.textContent = prefix + titleStr;` where prefix is 'undefined '.
// Wait! `prefix` was added by my patch! Let's review the patch.
// `var icon = window.getLeagueIcon(titleStr);` -> what if `window.getLeagueIcon` returns undefined? It returns '🏆' by default, but let's make sure.

// Wait, the screenshot SHOWS `undefined AHL`. Let's look at `js/main.js` getLeagueIcon.

const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

// The issue is in formatLeagueName returning undefined, OR in `lg` being undefined and printed as "undefined Some Unknown League".
// In `js/ui.js` around line 567: renderMatches(sortedMatches, defaultGrid, lg, true, subSectionId);
// `titleStr` is passed as `lg` which is a string like "AHL".
// Let's check where titleStr is rendered.

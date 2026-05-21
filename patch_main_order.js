const fs = require('fs');
let code = fs.readFileSync('js/main.js', 'utf8');

code = code.replace(/var displayOrder = customLgOrder.length > 0 \? customLgOrder : Object.keys\(DEFAULT_LEAGUES\);/g,
"var displayOrder = customLgOrder.length > 0 ? customLgOrder : Object.keys(DEFAULT_LEAGUES);");

// Wait, the "undefined" in "undefined AHL" comes from formatLeagueName not being mapped perhaps?
// Let's look at buildEPG in js/ui.js

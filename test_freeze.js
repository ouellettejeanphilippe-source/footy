const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');

// Quick analysis of DOM manipulations in loop
const buildEPGMatches = js.match(/buildEPG[\s\S]*?(?=\nfunction)/g);
if (buildEPGMatches) {
    console.log("Found buildEPG length:", buildEPGMatches[0].length);
}

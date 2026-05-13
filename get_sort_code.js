const fs = require('fs');
const content = fs.readFileSync('js/config.js', 'utf8');
const match = content.match(/export function sortFluxLinks[\s\S]*?^}/m);
if (match) console.log(match[0]);

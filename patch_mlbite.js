const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace("var MLBITE_URL = 'https://mlbite.to/';", "var MLBITE_URL = 'https://nflbite.to/'; // mlbite.to is dead, using nflbite.to as a working fallback on the same network");

fs.writeFileSync('index.html', html);

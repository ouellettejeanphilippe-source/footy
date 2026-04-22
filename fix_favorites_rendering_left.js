const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The reason PSG is False is because STATIC_TEAMS might not include 'PSG' exactly (maybe Paris Saint-Germain),
// let's do a quick check on left menu output to see if it renders correctly

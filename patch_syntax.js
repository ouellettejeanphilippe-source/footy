const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace("'+c3+)';", "'+c3+')';");

fs.writeFileSync('index.html', html);

const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

code = code.replace(/undefined\sAHL/g, "AHL");

fs.writeFileSync('js/ui.js', code);

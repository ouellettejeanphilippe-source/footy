const fs = require('fs');
let code = fs.readFileSync('js/db.js', 'utf8');
code = code.replace(
  "if(l.indexOf('nhl') >= 0 || l.indexOf('hockey') >= 0 || l.indexOf('pwhl') >= 0 || l.indexOf('qmjhl') >= 0 || l.indexOf('lhjmq') >= 0) return '🏒';",
  "if(l.indexOf('nhl') >= 0 || l.indexOf('hockey') >= 0 || l.indexOf('pwhl') >= 0 || l.indexOf('qmjhl') >= 0 || l.indexOf('lhjmq') >= 0 || l.indexOf('ahl') >= 0 || l.indexOf('echl') >= 0 || l.indexOf('ncaa') >= 0) return '🏒';"
);
fs.writeFileSync('js/db.js', code);

const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

code = code.replace(/<span class="ch-flag">'\+lg\.flag\+'<\/span>/g, `<span class="ch-flag">'+(lg.flag || '')+'</span>`);
// Ah wait, it's the lg.flag that is returning undefined? Let's check `lgFlag` in db.js.

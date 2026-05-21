const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

code = code.replace(
    /undefined\s+\</g,
    ""
);

fs.writeFileSync('js/ui.js', code);

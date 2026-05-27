const { readFileSync, writeFileSync } = require('fs');
let code = readFileSync('js/api.js', 'utf8');

// I accidentally added it twice due to my patch command before vs the file contents. I'll just restore the original and patch properly.
code = code.replace(/export function fetchLolEsportsEventDetails\(id\) \{[\s\S]*?\n\}\n\nexport function fetchLolEsportsEventDetails/g, 'export function fetchLolEsportsEventDetails');
writeFileSync('js/api.js', code);

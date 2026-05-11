import fs from 'fs';

let content = fs.readFileSync('js/api.js', 'utf8');

let searchBlock = `
              }
          }).catch(function(e) { lg('Error fetching PWHL API schedule', e); })
      );
`;

let replaceBlock = `
              }
          }).catch(function(e) { console.error('Error fetching PWHL API schedule', e); lg('Error fetching PWHL API schedule', e); })
      );
`;

content = content.replace(searchBlock, replaceBlock);
fs.writeFileSync('js/api.js', content);

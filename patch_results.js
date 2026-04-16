const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const targetStr = `          var scrapedMatches = [];`;
const replaceStr = `          // Check for failures and notify user
          var sources = [SITE, MLBITE_URL, SPORTSURGE_URL, BUFFSTREAMS_URL, STREAMEAST_URL, ONHOCKEY_URL];
          results.forEach(function(r, idx) {
              if (r.status === 'rejected') {
                  var domain = new URL(sources[idx]).hostname;
                  console.error('Failed to fetch:', sources[idx], r.reason);
                  setTimeout(function() { showToast('Échec de la connexion à ' + domain); }, idx * 1000);
              }
          });

          var scrapedMatches = [];`;

html = html.replace(targetStr, replaceStr);

fs.writeFileSync('index.html', html);

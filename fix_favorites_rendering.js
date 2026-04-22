const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Rewrite the Teams Manager mapping logic inside window.renderFavTeams
let oldTeamsManagerRegex = /\/\/ --- Teams Manager ---.*?var allTeams = \{\};\s*\/\/ 1\. Fill with static API teams.*?var inAutresAccordion = false;/gs;

let newTeamsManagerLogic = `// --- Teams Manager ---
          var searchVal = (document.getElementById('fav-search-input').value || '').toLowerCase();

          // Get unique teams
          var allTeams = {};

          // 1. Fill with static API teams ONLY (pure static db approach)
          if (typeof STATIC_TEAMS !== 'undefined') {
              STATIC_TEAMS.forEach(function(t) {
                  // Keep the first league encountered (primary domestic leagues are first in STATIC_TEAMS)
                  if (!allTeams[t.name]) {
                      allTeams[t.name] = formatLeagueName(t.league);
                  }
              });
          }

          // 2. No dynamic extraction from S.matches anymore to keep database clean.

          // Sort teams
          var teamNames = Object.keys(allTeams).sort(function(a,b) {
              // Favorites first
              if (favTeams[a] && !favTeams[b]) return -1;
              if (!favTeams[a] && favTeams[b]) return 1;

              // Sort by league
              var lA = formatLeagueName(allTeams[a]);
              var lB = formatLeagueName(allTeams[b]);

              if (lA !== lB) {
                  var idxA = customLgOrder.indexOf(lA);
                  var idxB = customLgOrder.indexOf(lB);

                  var mainLgMatchA = mainLeagues.findIndex(l => l.toLowerCase() === lA.toLowerCase()) !== -1;
                  var mainLgMatchB = mainLeagues.findIndex(l => l.toLowerCase() === lB.toLowerCase()) !== -1;

                  if (mainLgMatchA && mainLgMatchB) return idxA - idxB;
                  if (mainLgMatchA && !mainLgMatchB) return -1;
                  if (!mainLgMatchA && mainLgMatchB) return 1;

                  // Ensure 'Autres Flux' is at the bottom
                  if (lA === 'Autres Flux') return 1;
                  if (lB === 'Autres Flux') return -1;
                  return lA.localeCompare(lB);
              }

              // Sort alphabetically
              return a.localeCompare(b);
          });

          var html = '';
          var htmlAutres = '';
          var currentGroup = null;
          var inAutresAccordion = false;`;

html = html.replace(oldTeamsManagerRegex, newTeamsManagerLogic);


// 2. Rewrite the Leagues Sorting Manager logic inside window.renderFavTeams
let oldLeaguesSortRegex = /\/\/ --- Leagues Sorting Manager ---.*?var mainLeagues = \['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'NHL', 'NBA', 'NFL', 'MLB', 'PWHL', 'Champions League', 'World Cup', 'LHJMQ'\];.*?(?=\/\/ If it's a completely fresh load)/gs;

let newLeaguesSortLogic = `// --- Leagues Sorting Manager ---
          var mainLeagues = ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'NHL', 'NBA', 'NFL', 'MLB', 'PWHL', 'Champions League', 'World Cup', 'LHJMQ'];

          // Use purely the static mainLeagues definition for the right menu
          var newOrder = [];

          // Retain user order if it exists, but strictly filter out non-main leagues
          customLgOrder.forEach(function(lg) {
              var fmtLg = formatLeagueName(lg);
              if (mainLeagues.findIndex(l => l.toLowerCase() === fmtLg.toLowerCase()) !== -1) {
                  newOrder.push(fmtLg);
              }
          });

          // Add any missing mainLeagues to the end
          mainLeagues.forEach(function(lg) {
              if (newOrder.findIndex(l => l.toLowerCase() === lg.toLowerCase()) === -1) {
                  newOrder.push(lg);
              }
          });

          `;

html = html.replace(oldLeaguesSortRegex, newLeaguesSortLogic);


fs.writeFileSync('index.html', html, 'utf8');
console.log('Fixed window.renderFavTeams logic');

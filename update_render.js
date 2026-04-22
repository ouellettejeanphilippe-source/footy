const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const search = `          // We only want to track these specific leagues in the right menu
          var allowedLeagues = ['PWHL', 'Champions League', 'World Cup', 'LHJMQ'];

          // Re-sync customLgOrder with allowed sports
          var newOrder = [];
          customLgOrder.forEach(function(lg) {
              if (allowedLeagues.indexOf(formatLeagueName(lg)) !== -1 || allowedLeagues.indexOf(lg) !== -1) {
                  newOrder.push(lg);
                  delete sports[lg];
              }
          });
          // Add any remaining allowed sports to the end
          Object.keys(sports).forEach(function(lg) {
              if (allowedLeagues.indexOf(formatLeagueName(lg)) !== -1 || allowedLeagues.indexOf(lg) !== -1) {
                  newOrder.push(lg);
              }
          });

          // If customLgOrder is empty (e.g. first load and none are in matches), we still want to show them:
          if (newOrder.length === 0) {
              newOrder = allowedLeagues.slice();
          }

          customLgOrder = newOrder;`;

const replace = `          // Define the main leagues to track in the sorting menu
          var mainLeagues = ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'NHL', 'NBA', 'NFL', 'MLB', 'PWHL', 'Champions League', 'World Cup', 'LHJMQ'];

          // Ensure main leagues are present in our sports map
          mainLeagues.forEach(function(lg) { sports[lg] = true; });

          // Remove Coupe de France if it somehow gets dynamically added
          delete sports['Coupe de France'];
          delete sports['coupe de france'];

          // Re-sync customLgOrder with all discovered sports
          var newOrder = [];
          customLgOrder.forEach(function(lg) {
              var fmtLg = formatLeagueName(lg);
              if (fmtLg === 'Coupe de France') return;
              if (sports[lg] || sports[fmtLg]) {
                  newOrder.push(lg);
                  delete sports[lg];
                  delete sports[fmtLg];
              }
          });
          // Add any remaining sports to the end
          Object.keys(sports).forEach(function(lg) {
              newOrder.push(lg);
          });

          // If it's a completely fresh load, start with mainLeagues as default order
          if (newOrder.length === 0) {
              newOrder = mainLeagues.slice();
          }

          customLgOrder = newOrder;`;

code = code.replace(search, replace);

const search2 = `                  // Use allowedLeagues logic: if it's in the order list, prioritize it
                  var isAllowedA = idxA !== -1;
                  var isAllowedB = idxB !== -1;

                  if (isAllowedA && isAllowedB) return idxA - idxB;
                  if (isAllowedA && !isAllowedB) return -1;
                  if (!isAllowedA && isAllowedB) return 1;`;

const replace2 = `                  var mainLgMatchA = mainLeagues.findIndex(l => l.toLowerCase() === lA.toLowerCase()) !== -1;
                  var mainLgMatchB = mainLeagues.findIndex(l => l.toLowerCase() === lB.toLowerCase()) !== -1;

                  if (mainLgMatchA && mainLgMatchB) return idxA - idxB;
                  if (mainLgMatchA && !mainLgMatchB) return -1;
                  if (!mainLgMatchA && mainLgMatchB) return 1;`;

code = code.replace(search2, replace2);

const search3 = `              var isAllowed = isFav || customLgOrder.indexOf(formatLeagueName(lgGroup)) !== -1 || customLgOrder.indexOf(lgGroup) !== -1;`;

const replace3 = `              var isMainLeague = false;
              if (lgGroup !== 'FAVORIS') {
                  isMainLeague = mainLeagues.findIndex(function(l) { return l.toLowerCase() === formatLeagueName(lgGroup).toLowerCase(); }) !== -1;
              }
              var isAllowed = isFav || isMainLeague;`;

code = code.replace(search3, replace3);

fs.writeFileSync('index.html', code);
console.log("Updated index.html");

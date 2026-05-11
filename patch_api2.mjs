import fs from 'fs';

let content = fs.readFileSync('js/api.js', 'utf8');

let searchBlock = `
                           m.score = null;
                      }

                      var existingIdx = baseMatches.findIndex(function(existing) {
                          return existing.id === m.id || (isMatch(existing.homeTeam, m.homeTeam) && isMatch(existing.awayTeam, m.awayTeam) && existing.matchDate === m.matchDate);
                      });

                      if (existingIdx >= 0) {
                          baseMatches[existingIdx].status = m.status;
                          baseMatches[existingIdx].score = m.score;
                      } else {
                          baseMatches.push(m);
                          baseMatchesById[m.id] = m;
                      }
                  });
              }
          }).catch(function(e) { lg('Error fetching PWHL API schedule', e); })
      );

      promises.push(
`;

let replaceBlock = `
                           m.score = null;
                      }

                      var existingIdx = baseMatches.findIndex(function(existing) {
                          return existing.id === m.id || (isMatch(existing.homeTeam, m.homeTeam) && isMatch(existing.awayTeam, m.awayTeam) && existing.matchDate === m.matchDate);
                      });

                      if (existingIdx >= 0) {
                          baseMatches[existingIdx].status = m.status;
                          baseMatches[existingIdx].score = m.score;
                      } else {
                          baseMatches.push(m);
                          baseMatchesById[m.id] = m;
                      }
                  });
              }
          }).catch(function(e) { lg('Error fetching PWHL API schedule', e); })
      );

      promises.push(
`;

if (!content.includes("Error fetching PWHL API schedule")) {
    console.log("Could not find catch block");
} else {
    console.log("Looks good");
}

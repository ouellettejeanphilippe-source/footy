import fs from 'fs';

let content = fs.readFileSync('js/api.js', 'utf8');

let searchBlock = `
      promises.push(
          fetchPage('https://www.thepwhl.com/en/schedule').then(function(html) {
              if (html) {
                  var pwhlMatches = parsePWHLSchedule(html);
                  pwhlMatches.forEach(function(m) {
                      m.flag = lgFlag('PWHL');
`;

let replaceBlock = `
      promises.push(
          Promise.all([
              fetchPage('https://www.thepwhl.com/en/schedule').catch(function() { return ''; }),
              fetchPage('https://www.thepwhl.com/en/schedule-25-26').catch(function() { return ''; })
          ]).then(function(htmls) {
              var allMatches = [];
              var seenIds = new Set();

              htmls.forEach(function(html) {
                  if (html) {
                      var matches = parsePWHLSchedule(html);
                      matches.forEach(function(m) {
                          if (!seenIds.has(m.id)) {
                              seenIds.add(m.id);
                              allMatches.push(m);
                          }
                      });
                  }
              });

              if (allMatches.length > 0) {
                  var pwhlMatches = allMatches;
                  pwhlMatches.forEach(function(m) {
                      m.flag = lgFlag('PWHL');
`;

content = content.replace(searchBlock, replaceBlock);

fs.writeFileSync('js/api.js', content);

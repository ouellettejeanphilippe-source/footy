const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Replace single date strings with arrays of dates in getApiFirstMatches
let search = `function getApiFirstMatches(targetDate) {
  var matches = [];
  var promises = [];
  var dateStr = getEspnDateStr(targetDate);
  var apiDateStr = targetDate.toISOString().split('T')[0];

  // 1. Fetch ESPN
  var espnPaths = [];
  for(var key in ESPN_LEAGUES) { if(espnPaths.indexOf(ESPN_LEAGUES[key])===-1) espnPaths.push(ESPN_LEAGUES[key]); }

  espnPaths.forEach(function(path) {
    promises.push(
      fetchEspnSchedule(path, dateStr).then(function(data) {`;

let replace = `function getApiFirstMatches(targetDate) {
  var matches = [];
  var promises = [];

  var yesterday = new Date(targetDate); yesterday.setDate(yesterday.getDate() - 1);
  var tomorrow = new Date(targetDate); tomorrow.setDate(tomorrow.getDate() + 1);

  var espnDates = [
    getEspnDateStr(yesterday),
    getEspnDateStr(targetDate),
    getEspnDateStr(tomorrow)
  ];

  var apiDates = [
    yesterday.toISOString().split('T')[0],
    targetDate.toISOString().split('T')[0],
    tomorrow.toISOString().split('T')[0]
  ];

  // 1. Fetch ESPN
  var espnPaths = [];
  for(var key in ESPN_LEAGUES) { if(espnPaths.indexOf(ESPN_LEAGUES[key])===-1) espnPaths.push(ESPN_LEAGUES[key]); }

  espnPaths.forEach(function(path) {
    espnDates.forEach(function(dateStr) {
      promises.push(
        fetchEspnSchedule(path, dateStr).then(function(data) {`;

if (html.includes(search)) {
    html = html.replace(search, replace);
} else {
    console.log("Failed to match block 1");
}

let search2 = `    sportsToFetch.forEach(function(s) {
      promises.push(
        fetchApiSportsFixtures(s, apiDateStr).then(function(apiData) {`;

let replace2 = `    sportsToFetch.forEach(function(s) {
      apiDates.forEach(function(apiDateStr) {
        promises.push(
          fetchApiSportsFixtures(s, apiDateStr).then(function(apiData) {`;

if (html.includes(search2)) {
    html = html.replace(search2, replace2);
} else {
    console.log("Failed to match block 2");
}

let search3 = `                if(f.teams.away.logo) cacheLogo(f.teams.away.name, f.teams.away.logo);
             }
          });
        })
      );
    });`;

let replace3 = `                if(f.teams.away.logo) cacheLogo(f.teams.away.name, f.teams.away.logo);
             }
          });
        })
      );
      });
    });`;

if (html.includes(search3)) {
    html = html.replace(search3, replace3);
} else {
    console.log("Failed to match block 3");
}

let search4 = `          if(home.team.logo) cacheLogo(home.team.name, home.team.logo);
          if(away.team.logo) cacheLogo(away.team.name, away.team.logo);
        });
      })
    );
  });`;

let replace4 = `          if(home.team.logo) cacheLogo(home.team.name, home.team.logo);
          if(away.team.logo) cacheLogo(away.team.name, away.team.logo);
        });
      })
    );
    });
  });`;

if (html.includes(search4)) {
    html = html.replace(search4, replace4);
} else {
    console.log("Failed to match block 4");
}


fs.writeFileSync('index.html', html);
console.log('done');

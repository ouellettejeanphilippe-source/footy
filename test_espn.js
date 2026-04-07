const https = require('https');
https.get('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=20231010', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(JSON.parse(data).events[0].competitions[0].competitors.map(c => c.team.name));
  });
});

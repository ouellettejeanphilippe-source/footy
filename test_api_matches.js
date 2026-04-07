const http = require('http');
const https = require('https');

function getEspnDateStr(d) {
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate());
}

function fetchEspnSchedule(path, dateStr) {
  var url = 'https://site.api.espn.com/apis/site/v2/sports/' + path + '/scoreboard?dates=' + dateStr;
  return new Promise((resolve) => {
      https.get(url, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
              try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
          });
      }).on('error', () => resolve(null));
  });
}

async function test() {
    let d = new Date();
    console.log("Date:", getEspnDateStr(d));
    let data = await fetchEspnSchedule('hockey/nhl', getEspnDateStr(d));
    if (data && data.events) {
        data.events.forEach(ev => {
            var comp = ev.competitions[0];
            var home = comp.competitors.find(c => c.homeAway === 'home');
            var away = comp.competitors.find(c => c.homeAway === 'away');
            console.log(home.team.name, "vs", away.team.name, ev.status.type.state);
        });
    } else {
        console.log("No NHL events");
    }
}
test();

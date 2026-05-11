import fs from 'fs';
import { JSDOM } from 'jsdom';
global.DOMParser = new JSDOM().window.DOMParser;

fetch('https://www.thepwhl.com/en/schedule-25-26')
  .then(r => r.text())
  .then(html => {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var scripts = doc.querySelectorAll('script');
      let gamesList = [];
      for (var i = 0; i < scripts.length; i++) {
          var txt = scripts[i].textContent || '';
          if (txt.indexOf('games') !== -1) {
              var start = txt.indexOf('{');
              var end = txt.lastIndexOf('}');
              if (start !== -1 && end !== -1) {
                  var jsonStr = txt.substring(start, end + 1);
                  var data = JSON.parse(jsonStr);

                  function findGames(obj) {
                      if (!obj || typeof obj !== 'object') return;
                      if (obj.games && Array.isArray(obj.games) && obj.games.length > 0 && obj.games[0].home_team) {
                          obj.games.forEach(g => gamesList.push(g));
                      }
                      for (let k in obj) {
                          findGames(obj[k]);
                      }
                  }
                  findGames(data);
              }
          }
      }
      gamesList.forEach(g => {
          console.log(g.date_played, g.home_team.home_team_name, 'vs', g.visiting_team.visiting_team_name);
      });
  }).catch(console.error);

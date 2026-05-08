function parseSportsurge(html) {
  var matches = [];
  try {
      var doc = new DOMParser().parseFromString(html, 'text/html');

      // Sportsurge v2 uses .MatchListItem or similar, but often it's rendered.
      // Sometimes it has direct <a> links.
      var matchLinks = doc.querySelectorAll('a[href*="/live/"], .MatchListItem a, a.match-link');

      [].forEach.call(matchLinks, function(a) {
          var titleEl = a.querySelector('.MatchTitle') || a;
          var titleText = titleEl.textContent.trim();
          var url = a.getAttribute('href');

          if(titleText && url) {
              var home = titleText;
              var away = 'TBD';
              if(titleText.includes(' vs ')) {
                 var pts = titleText.split(' vs ');
                 home = pts[0].trim();
                 away = pts[1].trim();
              } else if (titleText.includes('-')) {
                 var pts = titleText.split('-');
                 home = pts[0].trim();
                 away = pts[1].trim();
              }

              var m = {
                  id: 'surge_' + Math.random().toString(36).substr(2, 9),
                  homeTeam: getOfficialTeamName(home),
                  awayTeam: getOfficialTeamName(away),
                  league: 'Sports',
                  flag: lgFlag('Sports'),
                  color: lgColor('Sports'),
                  startTime: '00:00',
                  status: 'upcoming',
                  matchUrl: url.indexOf('http') === 0 ? url : (SPORTSURGE_URL.slice(0, -1) + (url.startsWith('/') ? url : '/' + url)),
                  streamLinks: [],
                  streamsLoaded: false,
                  source: 'sportsurge'
              };
              if (!matches.find(ex => ex.matchUrl === m.matchUrl)) {
                  matches.push(m);
              }
          }
      });
  } catch(e) {}
  lg('Sportsurge extraits', matches.length);
  return matches;
}

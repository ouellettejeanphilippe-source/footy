function parseOnHockey(html) {
  var doc = new DOMParser().parseFromString(html, 'text/html');
  var matches = [];

  // onhockey.tv groups matches by league inside <tbody> elements in schedule_table.php
  var tbodies = doc.querySelectorAll('tbody');
  var matchIndex = 0;

  if (tbodies.length > 0) {
      for (var i = 0; i < tbodies.length; i++) {
          var tbody = tbodies[i];

          // onhockey structure: first tr in tbody usually contains the league name
          var firstTr = tbody.querySelector('tr');
          var leagueName = 'Hockey';
          if (firstTr && firstTr.textContent.trim() !== '') {
              leagueName = firstTr.textContent.replace(/standings|draw/gi, '').trim();
          }

          var textContent = tbody.textContent || '';
          var upText = textContent.toUpperCase();

          if (upText.indexOf('PWHL') >= 0) leagueName = 'PWHL';
          else if (upText.indexOf('LHJMQ') >= 0 || upText.indexOf('QMJHL') >= 0) leagueName = 'LHJMQ';

          var rows = tbody.querySelectorAll('tr.game');
          for (var r = 0; r < rows.length; r++) {
              var row = rows[r];
                  var tds = row.querySelectorAll('td');
                  if (tds.length >= 2) {
                      // The team names are usually in the second td.
                      // We clone it and remove .gamelinks to just get the text.
                      var tdClone = tds[1].cloneNode(true);
                      var gamelinksNode = tdClone.querySelector('.gamelinks');
                      if (gamelinksNode) gamelinksNode.remove();

                      // Remove extraneous geo-blocked messages or 'live stream will be available' messages
                      var matchText = tdClone.textContent.replace(/geo-blocked for[A-Z\/]+:[a-z\s]+|live stream will be available closer to the game time/gi, '').trim();

                      var teams = matchText.split(/ vs | v | - /i);
                      var home = 'Team 1';
                      var away = 'Team 2';

                      if (teams.length >= 2) {
                          home = teams[0].trim();
                          away = teams.slice(1).join(' - ').trim();
                      } else {
                          home = matchText.trim() || 'TBA';
                          away = 'TBA';
                      }

                      // Find all the stream links for this match
                      var streamLinksArr = [];
                      var linksContainer = row.querySelector('.gamelinks') || row; // fallback to entire row if .gamelinks is missing
                      if (linksContainer) {
                          var links = linksContainer.querySelectorAll('a');
                          for (var l = 0; l < links.length; l++) {
                              var linkEl = links[l];
                              var href = linkEl.getAttribute('href');
                              if (!href) continue;

                              var streamUrl = href;
                              if (streamUrl.indexOf('//') === 0) {
                                  streamUrl = 'https:' + streamUrl;
                              } else if (streamUrl.indexOf('http') !== 0) {
                                  streamUrl = 'https://onhockey.tv' + (streamUrl.charAt(0) === '/' ? '' : '/') + streamUrl;
                              }

                              streamLinksArr.push({
                                  name: 'OnHockey ' + (linkEl.title || linkEl.textContent || 'Flux').trim(),
                                  url: streamUrl,
                                  quality: 'HD',
                                  lang: 'MULTI',
                                  icon: '🏒'
                              });
                          }
                      }

                      // Try to extract start time if available
                      var startTimeStr = '00:00';
                      var hourEl = row.querySelector('.game_hour') || tds[0];
                      if (hourEl) {
                           var timeText = hourEl.textContent.trim();
                           var timeParts = timeText.match(/(\d+):(\d+)/);
                           if (timeParts) {
                               startTimeStr = timeParts[1].padStart(2, '0') + ':' + timeParts[2];
                           }
                      }

                      matches.push({
                          id: 'onhockey_' + Date.now() + '_' + matchIndex++,
                          league: formatLeagueName(leagueName),
                          homeTeam: getOfficialTeamName(home),
                          awayTeam: getOfficialTeamName(away),
                          startTime: startTimeStr,
                          durationMinutes: getLeagueDuration('hockey'),
                          status: 'upcoming',
                          streamLinks: streamLinksArr,
                          streamsLoaded: streamLinksArr.length > 0,
                          matchUrl: streamLinksArr.length > 0 ? streamLinksArr[0].url : ONHOCKEY_URL,
                          source: 'onhockey',
                          matchDate: getEstDateStrFromDate(TARGET_DATE)
                      });
                  }
              }
      }
  } else {
      // Fallback: If tbodies are not found, look for general list items or div blocks containing links
      var lists = doc.querySelectorAll('li, .match-row, .event');
      for (var i = 0; i < lists.length; i++) {
          var item = lists[i];
          var links = item.querySelectorAll('a');
          if (links.length > 0) {
              var text = item.textContent.replace(/\s+/g, ' ').trim();

              var teams = text.split(/ vs | v | - /i);
              var home = 'Team 1';
              var away = 'Team 2';
              if (teams.length >= 2) {
                  home = teams[0].trim();
                  away = teams.slice(1).join(' - ').trim();
              } else {
                  home = text.trim();
              }

              var streamLinksArr = [];
              for (var l = 0; l < links.length; l++) {
                  var linkEl = links[l];
                  var href = linkEl.getAttribute('href');
                  if (!href) continue;

                  var streamUrl = href;
                  if (streamUrl.indexOf('//') === 0) {
                      streamUrl = 'https:' + streamUrl;
                  } else if (streamUrl.indexOf('http') !== 0) {
                      streamUrl = 'https://onhockey.tv' + (streamUrl.charAt(0) === '/' ? '' : '/') + streamUrl;
                  }

                  streamLinksArr.push({
                      name: 'OnHockey ' + (linkEl.title || linkEl.textContent || 'Flux').trim(),
                      url: streamUrl,
                      quality: 'HD',
                      lang: 'MULTI',
                      icon: '🏒'
                  });
              }

              var startTimeStr = '00:00';
              var timeParts = text.match(/(\d+):(\d+)/);
              if (timeParts) {
                   startTimeStr = timeParts[1].padStart(2, '0') + ':' + timeParts[2];
              }

              var leagueName = 'Hockey';
              if (text.toUpperCase().indexOf('PWHL') >= 0) leagueName = 'PWHL';
              else if (text.toUpperCase().indexOf('LHJMQ') >= 0 || text.toUpperCase().indexOf('QMJHL') >= 0) leagueName = 'LHJMQ';

              matches.push({
                  id: 'onhockey_' + Date.now() + '_' + matchIndex++,
                  league: formatLeagueName(leagueName),
                  homeTeam: getOfficialTeamName(home),
                  awayTeam: getOfficialTeamName(away),
                  startTime: startTimeStr,
                  durationMinutes: getLeagueDuration('hockey'),
                  status: 'upcoming',
                  streamLinks: streamLinksArr,
                  streamsLoaded: streamLinksArr.length > 0,
                  matchUrl: streamLinksArr.length > 0 ? streamLinksArr[0].url : ONHOCKEY_URL,
                          source: 'onhockey',
                  matchDate: getEstDateStrFromDate(TARGET_DATE)
              });
          }
      }
  }

  lg('OnHockey extraits', matches.length);
  return matches;
}

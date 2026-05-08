function parseStreameast(html){
  var matches=[];
  var doc = new DOMParser().parseFromString(html, 'text/html');
  var cards = doc.querySelectorAll('.match-card');

  if (cards.length > 0) {
      [].forEach.call(cards, function(card, index) {
          var home = card.getAttribute('data-team1');
          var away = card.getAttribute('data-team2');
          var category = card.getAttribute('data-league') || 'Sports';
          var timeStr = card.getAttribute('data-time2'); // format "ET 08:50 PM"
          var playerLink = card.getAttribute('data-player');
          var logo1 = card.getAttribute('data-logo1');
          var logo2 = card.getAttribute('data-logo2');

          if(!home || !away || !playerLink) return;

          var startTime = '00:00';
          if(timeStr) {
              // Convert "ET 08:50 PM" to "HH:MM"
              var matchTime = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
              if(matchTime) {
                  var h = parseInt(matchTime[1], 10);
                  var m = matchTime[2];
                  var ampm = matchTime[3] ? matchTime[3].toUpperCase() : '';

                  if(ampm === 'PM' && h < 12) h += 12;
                  if(ampm === 'AM' && h === 12) h = 0;

                  // It's ET time, we keep it as is (or convert based on logic if needed, but our standard seems to accept local/ET depending on source)
                  startTime = pad(h) + ':' + pad(m);
              }
          }

          var streamLinks = [{
              name: 'Streameast - Flux',
              quality: 'HD',
              lang: 'MULTI',
              url: playerLink,
              icon: '📺'
          }];

          var l = category.toLowerCase().replace(/-/g, ' ');

          matches.push({
              id: 'se_' + index,
              league: formatLeagueName(l),
              flag: lgFlag(l),
              color: lgColor(l),
              homeTeam: getOfficialTeamName(home),
              awayTeam: getOfficialTeamName(away),
              homeLogo: logo1,
              awayLogo: logo2,
              startTime: startTime,
              durationMinutes: getLeagueDuration(l),
              status: 'upcoming', // Streameast doesn't give clear live status in the data attrs directly, rely on API fallback or default to upcoming
              streamLinks: streamLinks,
              streamsLoaded: false,
              matchUrl: playerLink || STREAMEAST_URL,
              source: 'streameast'
          });
      });
  } else {
      // Fallback
      var possibleMatches = doc.querySelectorAll('li, .match-row, a[href*="/player/"], a[href*="/live/"]');
      var added = {};
      [].forEach.call(possibleMatches, function(el, index) {
          var text = el.textContent.replace(/\s+/g, ' ').trim();
          var link = el.tagName.toLowerCase() === 'a' ? el : el.querySelector('a');
          if (link && text) {
              var href = link.getAttribute('href');
              if (!href || added[href]) return;

              var textToParse = (link.textContent || text).trim();
              var teams = textToParse.split(/ vs | v | - /i);
              if (teams.length >= 2 && textToParse.length < 80) {
                  var home = teams[0].trim();
                  var away = teams.slice(1).join(' - ').trim();

                  var startTimeStr = '00:00';
                  var matchTime = text.match(/(\d{1,2}):(\d{2})/);
                  if (matchTime) {
                      startTimeStr = pad(parseInt(matchTime[1], 10)) + ':' + matchTime[2];
                  }

                  var streamUrl = href;
                  if (!streamUrl.startsWith('http')) {
                      streamUrl = STREAMEAST_URL.slice(0, -1) + (streamUrl.startsWith('/') ? streamUrl : '/' + streamUrl);
                  }

                  matches.push({
                      id: 'se_fb_' + index,
                      league: formatLeagueName('Sports'),
                      flag: lgFlag('Sports'),
                      color: lgColor('Sports'),
                      homeTeam: getOfficialTeamName(home),
                      awayTeam: getOfficialTeamName(away),
                      startTime: startTimeStr,
                      durationMinutes: getLeagueDuration('Sports'),
                      status: 'upcoming',
                      streamLinks: [{
                          name: 'Streameast - Flux',
                          quality: 'HD',
                          lang: 'MULTI',
                          url: streamUrl,
                          icon: '📺'
                      }],
                      streamsLoaded: false,
                      matchUrl: streamUrl,
                      source: 'streameast'
                  });
                  added[href] = true;
              } else if (textToParse.length > 3 && textToParse.length < 40) {
                  var streamUrl2 = href;
                  if (!streamUrl2.startsWith('http')) streamUrl2 = STREAMEAST_URL.slice(0, -1) + (streamUrl2.startsWith('/') ? streamUrl2 : '/' + streamUrl2);
                  matches.push({
                      id: 'se_fb_' + index,
                      league: formatLeagueName('Sports'),
                      flag: lgFlag('Sports'),
                      color: lgColor('Sports'),
                      homeTeam: getOfficialTeamName(textToParse),
                      awayTeam: 'TBD',
                      startTime: '00:00',
                      durationMinutes: getLeagueDuration('Sports'),
                      status: 'upcoming',
                      streamLinks: [{ name: 'Streameast - Flux', quality: 'HD', lang: 'MULTI', url: streamUrl2, icon: '📺' }],
                      streamsLoaded: false,
                      matchUrl: streamUrl2,
                      source: 'streameast'
                  });
                  added[href] = true;
              }
          }
      });
  }

  lg('Streameast extraits', matches.length);
  return matches;
}


/* ══ PARSE ONHOCKEY ═══════════════════ */

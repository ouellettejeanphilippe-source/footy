function parseBuffstreams(html){
  var matches=[];
  var index = 0;
  var doc = new DOMParser().parseFromString(html, 'text/html');

  // New Buffstreams doesn't load all data in home page JSON always, but it often does list categories
  // Let's try to extract what we can from React chunks
  var scriptRegex = /self\.__next_f\.push\(\[1,"(.*)"\]\)/g;
  var match;
  var concatenatedData = "";

  while ((match = scriptRegex.exec(html)) !== null) {
      var chunk = match[1];
      chunk = chunk.replace(/\\"/g, '"')
                   .replace(/\\\\/g, '\\')
                   .replace(/\\n/g, '\n');
      concatenatedData += chunk;
  }

  // 1. First attempt: Full event objects
  var eventRegex = /"event":({(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*})/g;
  var evMatch;

  while ((evMatch = eventRegex.exec(concatenatedData)) !== null) {
      try {
          var evObj = JSON.parse(evMatch[1]);
          var home = evObj.details ? evObj.details.text2 : '';
          var away = evObj.details ? evObj.details.text3 : '';
          var category = evObj.category || 'Sports';

          if(!home || !away) continue;
          if(home === 'null' || away === 'null') continue;

          var status = 'upcoming';
          if (evObj.status === 'live' || evObj.status === 'Live') status = 'live';

          var startTime = '00:00';
          if (evObj.matchStartTime) {
              var d = new Date(evObj.matchStartTime);
              startTime = getEstTimeStrFromDate(d);
          }

          var streamLinks = [];
          if (evObj.iframeStreams) {
              evObj.iframeStreams.forEach(function(s) {
                  streamLinks.push({
                      name: 'Buffstreams - ' + (s.name || 'Flux'),
                      quality: 'HD',
                      lang: 'MULTI',
                      url: s.src,
                      icon: '📺'
                  });
              });
          }

          // Generate a unique ID using the event ID if available
          var mId = evObj._id ? 'buff_' + evObj._id : 'buff_' + index;

          var l = category.toLowerCase().replace(/-/g, ' ');
          matches.push({
              id: mId,
              league: formatLeagueName(l),
              flag: lgFlag(l),
              color: lgColor(l),
              homeTeam: getOfficialTeamName(home),
              awayTeam: getOfficialTeamName(away),
              homeLogo: evObj.teamA_logo ? (evObj.teamA_logo.indexOf('http') === 0 ? evObj.teamA_logo : 'https://buffstreams.com.co' + evObj.teamA_logo) : null,
              awayLogo: evObj.teamB_logo ? (evObj.teamB_logo.indexOf('http') === 0 ? evObj.teamB_logo : 'https://buffstreams.com.co' + evObj.teamB_logo) : null,
              startTime: startTime,
              durationMinutes: getLeagueDuration(l),
              status: status,
              score: null,
              streamLinks: streamLinks,
              streamsLoaded: false,
              matchUrl: (evObj.link ? (evObj.link.indexOf('http')===0 ? evObj.link : 'https://buffstreams.com.co' + evObj.link) : (streamLinks.length > 0 ? streamLinks[0].url : BUFFSTREAMS_URL)),
              source: 'buffstreams'
          });
          index++;
      } catch(e) {}
  }

  lg('Buffstreams extraits', matches.length);
  return matches;
}

/* ══ FOOTYBITE LOGOS SCRAPING ═════════ */
// Add footybite logo parsing
function extractFootybiteLogos(doc) {
    var teams = doc.querySelectorAll('.txt-team');
    teams.forEach(function(teamEl) {
        var teamName = teamEl.textContent.trim();
        var box = teamEl.closest('.row');
        if(!box) return;
        var img = box.querySelector('img.img-icone');
        if(img && img.getAttribute('src') && img.getAttribute('src').indexOf('http') === 0 && img.getAttribute('src').indexOf('default') < 0) {
            cacheLogo(teamName, img.getAttribute('src'));
        }
    });
}

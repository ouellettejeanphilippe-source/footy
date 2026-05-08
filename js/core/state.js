// Application State functions

var scrapeLogs = [];
function addScrapeLog(url, status, errorMsg) {
    var entry = {
        time: new Date().toLocaleTimeString('fr-CA', {hour12: false}),
        url: url,
        status: status,
        error: errorMsg || ''
    };
    scrapeLogs.unshift(entry);
    if(scrapeLogs.length > 50) scrapeLogs.pop();
}

function saveCustomLgOrder() {
    localStorage.setItem('custom_lg_order', JSON.stringify(customLgOrder));
}
function toggleFavTeam(teamName) {
  if (favTeams[teamName]) {
    delete favTeams[teamName];
  } else {
    favTeams[teamName] = 1;
  }
  localStorage.setItem('fav_teams', JSON.stringify(favTeams));

  // Update DOM directly instead of rebuilding EPG
  var allCards = document.querySelectorAll('.mb');
  allCards.forEach(function(c) {
      var h = c.getAttribute('data-home');
      var a = c.getAttribute('data-away');
      if (h && a) {
          if (favTeams[h] || favTeams[a]) {
              c.classList.add('is-fav');
              var starH = c.querySelector('.chan-team:first-child button');
              var starA = c.querySelector('.chan-team:last-child button');
              if (starH) starH.style.color = favTeams[h] ? 'var(--accent)' : 'var(--muted)';
              if (starA) starA.style.color = favTeams[a] ? 'var(--accent)' : 'var(--muted)';
          } else {
              c.classList.remove('is-fav');
              var starH = c.querySelector('.chan-team:first-child button');
              var starA = c.querySelector('.chan-team:last-child button');
              if (starH) starH.style.color = 'var(--muted)';
              if (starA) starA.style.color = 'var(--muted)';
          }
      }
  });
}

function cacheLogo(teamName, url) {
  var k = normName(teamName);
  if(!logoCache[k] && url && url.indexOf("default") === -1) {
    logoCache[k] = url;
  }
}

function getLogo(teamName) {
  if (!teamName) return null;
  return logoCache[normName(teamName)] || null;
}

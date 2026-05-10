

/* ══ STATE ══════════════════════════════ */

export var sourcesStatus = [];
export var scrapeLogs = [];
export function updateSourceStatus(name, status, matchCount, message) {
    var existing = sourcesStatus.find(function(s) { return s.name === name; });
    if (existing) {
        existing.status = status;
        existing.matchCount = matchCount;
        existing.message = message || '';
        existing.time = new Date().toLocaleTimeString('fr-CA', {hour12: false});
    } else {
        sourcesStatus.push({
            name: name,
            status: status,
            matchCount: matchCount,
            message: message || '',
            time: new Date().toLocaleTimeString('fr-CA', {hour12: false})
        });
    }
}

export function addScrapeLog(url, status, errorMsg) {
    var entry = {
        time: new Date().toLocaleTimeString('fr-CA', {hour12: false}),
        url: url,
        status: status,
        error: errorMsg || ''
    };
    scrapeLogs.unshift(entry);
    if(scrapeLogs.length > 50) scrapeLogs.pop();
}

export var favTeams = {};
export var customLgOrder = [];
try {
  var storedFavs = localStorage.getItem('fav_teams');
  if (storedFavs) {
      favTeams = JSON.parse(storedFavs);
  } else {
      favTeams = {
          "Toronto Blue Jays": 1,
          "Montreal Canadiens": 1,
          "CF Montréal": 1,
          "Toronto Raptors": 1,
          "Montréal Victoire": 1
      };
      localStorage.setItem('fav_teams', JSON.stringify(favTeams));
  }
  var storedLgOrder = localStorage.getItem('custom_lg_order');
  if (storedLgOrder) customLgOrder = JSON.parse(storedLgOrder);
} catch(e) {}

export function saveCustomLgOrder() {
    localStorage.setItem('custom_lg_order', JSON.stringify(customLgOrder));
}

export function setCustomLgOrder(newOrder) {
    customLgOrder = newOrder;
    window.customLgOrder = customLgOrder;
    saveCustomLgOrder();
}

export function toggleFavTeam(teamName) {
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

export var matchCardCache = new Map();
export var S = { searchQuery:'',  log:[], raw:'', matches:[], proxy:'', filter:'live', sportFilter:'all', hiddenLg:{'Autres Flux':true}, collapsedLg:{}, collapsedSections:{} };



// Global bindings for HTML compatibility
window.sourcesStatus = sourcesStatus;
window.scrapeLogs = scrapeLogs;
window.updateSourceStatus = updateSourceStatus;
window.addScrapeLog = addScrapeLog;
window.favTeams = favTeams;
window.customLgOrder = customLgOrder;
window.setCustomLgOrder = setCustomLgOrder;
window.saveCustomLgOrder = saveCustomLgOrder;
window.toggleFavTeam = toggleFavTeam;
window.matchCardCache = matchCardCache;
window.S = S;

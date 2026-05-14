

/* ══ STATE ══════════════════════════════ */

import { safeStorageGet, safeStorageSet, safeStorageGetJSON, safeStorageSetJSON, safeStorageRemove } from './utils.js';

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

var defaultFavs = { "Toronto Blue Jays": 1, "Montreal Canadiens": 1, "CF Montréal": 1, "Toronto Raptors": 1, "Montréal Victoire": 1 };
favTeams = safeStorageGetJSON('fav_teams');
if (!favTeams) {
    favTeams = defaultFavs;
    safeStorageSetJSON('fav_teams', favTeams);
}

customLgOrder = safeStorageGetJSON('custom_lg_order', []);
var v2Migrated = safeStorageGet('lg_order_migrated_v2');
if (customLgOrder.length > 0 && !v2Migrated) {
    customLgOrder = [];
    safeStorageRemove('custom_lg_order'); // direct remove is fine here since it's one-off
    safeStorageSet('lg_order_migrated_v2', '1');
} else if (!v2Migrated) {
    safeStorageSet('lg_order_migrated_v2', '1');
}


export function saveCustomLgOrder() {
    safeStorageSetJSON('custom_lg_order', customLgOrder);
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
  safeStorageSetJSON('fav_teams', favTeams);

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
export function setMatches(newMatches) {
    S.matches = newMatches;
    S.matchMap.clear();
    for (var i = 0; i < newMatches.length; i++) {
        S.matchMap.set(String(newMatches[i].id), newMatches[i]);
    }
}
export var S = { searchQuery:'',  log:[], raw:'', matches:[], matchMap: new Map(), proxy:'', filter:'live', sportFilter:'all', hiddenLg:{}, collapsedLg:{'Autres Flux':true}, collapsedSections:{} };



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
window.setMatches = setMatches;

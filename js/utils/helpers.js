// ══ HELPER FUNCTIONS ═══════════════════════════

function normName(n) {
  if (!n) return '';
  return n.toLowerCase()
          .replace(/[éèêë]/g, 'e')
          .replace(/[àâä]/g, 'a')
          .replace(/[îï]/g, 'i')
          .replace(/[ôö]/g, 'o')
          .replace(/[ûü]/g, 'u')
          .replace(/ç/g, 'c')
          .replace(/[^a-z0-9]/g, '');
}

function getOfficialTeamName(n) {
  if (!n) return '';
  var lower = n.toLowerCase().trim();

  lower = lower.replace(/\bny\b/g, 'new york');
  lower = lower.replace(/\bla\b/g, 'los angeles');

  if (typeof TEAM_ALIASES !== 'undefined' && TEAM_ALIASES[lower]) {
      lower = TEAM_ALIASES[lower];
  }

  var nName = normName(lower);

  if (typeof STATIC_TEAM_MAP !== 'undefined' && STATIC_TEAM_MAP[nName]) {
      return STATIC_TEAM_MAP[nName];
  }

  var bestMatch = '';
  var bestScore = 0;
  if (typeof STATIC_TEAMS !== 'undefined') {
      for (var i = 0; i < STATIC_TEAMS.length; i++) {
          var sName = normName(STATIC_TEAMS[i]);
          if (nName.indexOf(sName) !== -1 || sName.indexOf(nName) !== -1) {
              return STATIC_TEAMS[i];
          }
          var score = stringSimilarity(nName, sName);
          if (score > bestScore) {
              bestScore = score;
              bestMatch = STATIC_TEAMS[i];
          }
      }
  }

  if (bestScore > 0.85) return bestMatch;

  return lower.replace(/\b\w/g, function(l){ return l.toUpperCase(); });
}

function formatLeagueName(league) {
    if (!league) return 'Autres Flux';
    var lower = league.toLowerCase().trim();
    if (typeof LEAGUE_ALIASES !== 'undefined' && LEAGUE_ALIASES[lower]) {
        lower = LEAGUE_ALIASES[lower];
    }
    if (typeof LEAGUE_FORMAT_NAMES !== 'undefined' && LEAGUE_FORMAT_NAMES[lower]) {
        return LEAGUE_FORMAT_NAMES[lower];
    }
    return lower.replace(/\b\w/g, function(l){ return l.toUpperCase(); });
}

function stringSimilarity(s1, s2) {
  var longer = s1;
  var shorter = s2;
  if (s1.length < s2.length) { longer = s2; shorter = s1; }
  var longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
  s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
  var costs = [];
  for (var i = 0; i <= s1.length; i++) {
      var lastValue = i;
      for (var j = 0; j <= s2.length; j++) {
          if (i === 0) costs[j] = j;
          else {
              if (j > 0) {
                  var newValue = costs[j - 1];
                  if (s1.charAt(i - 1) !== s2.charAt(j - 1))
                      newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                  costs[j - 1] = lastValue;
                  lastValue = newValue;
              }
          }
      }
      if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

function isMatch(name1, name2) {
  if(!name1 || !name2) return false;
  if(name1.toLowerCase() === 'tbd' || name2.toLowerCase() === 'tbd') return false;
  var n1 = normName(name1);
  var n2 = normName(name2);
  if (n1 === n2) return true;
  if (n1.indexOf(n2) !== -1 || n2.indexOf(n1) !== -1) return true;
  if (stringSimilarity(n1, n2) > 0.8) return true;
  return false;
}

function isMatchPair(m1, m2) {
    if(!m1 || !m2) return false;

    var isTBD1 = (m1.homeTeam.toLowerCase() === 'tbd' || m1.awayTeam.toLowerCase() === 'tbd');
    var isTBD2 = (m2.homeTeam.toLowerCase() === 'tbd' || m2.awayTeam.toLowerCase() === 'tbd');

    var isHMatch = isMatch(m1.homeTeam, m2.homeTeam);
    var isAMatch = isMatch(m1.awayTeam, m2.awayTeam);
    var isCross1 = isMatch(m1.homeTeam, m2.awayTeam);
    var isCross2 = isMatch(m1.awayTeam, m2.homeTeam);

    var teamsMatch = (isHMatch && isAMatch) || (isCross1 && isCross2);

    if (isTBD1 || isTBD2) {
        if (m1.homeTeam.toLowerCase() !== 'tbd' && m2.homeTeam.toLowerCase() !== 'tbd' && isHMatch) teamsMatch = true;
        if (m1.homeTeam.toLowerCase() !== 'tbd' && m2.awayTeam.toLowerCase() !== 'tbd' && isCross1) teamsMatch = true;
        if (m1.awayTeam.toLowerCase() !== 'tbd' && m2.awayTeam.toLowerCase() !== 'tbd' && isAMatch) teamsMatch = true;
        if (m1.awayTeam.toLowerCase() !== 'tbd' && m2.homeTeam.toLowerCase() !== 'tbd' && isCross2) teamsMatch = true;
    }

    if (!teamsMatch) return false;

    // Verify league if present
    if (m1.league && m2.league && m1.league !== 'Autres Flux' && m2.league !== 'Autres Flux') {
        var l1 = formatLeagueName(m1.league);
        var l2 = formatLeagueName(m2.league);
        if (l1 !== l2 && l1.indexOf(l2) === -1 && l2.indexOf(l1) === -1) {
            return false;
        }
    }

    // Verify date (Day) if available
    if(m1.matchDate && m2.matchDate) {
        var d1 = new Date(m1.matchDate);
        var d2 = new Date(m2.matchDate);
        if(!isNaN(d1) && !isNaN(d2)) {
            var msDiff = Math.abs(d1.getTime() - d2.getTime());
            if(msDiff > 24 * 60 * 60 * 1000) {
               return false;
            }
        }
    }

    return true;
}

function fetchPage(url) {
  var pr = typeof PROXIES !== 'undefined' ? PROXIES : [function(u){ return 'https://api.allorigins.win/get?url='+encodeURIComponent(u); }];
  var idx = 0;
  function tryNext() {
      if (idx >= pr.length) return Promise.reject(new Error('All proxies failed for ' + url));
      var pUrl = pr[idx](url);
      idx++;
      return fetch(pUrl, { signal: AbortSignal.timeout(10000) })
          .then(function(r) {
              if(!r.ok) throw new Error('Proxy error');
              return r.text();
          })
          .then(function(t) {
              try {
                  var j = JSON.parse(t);
                  return j.contents || j.data || t;
              } catch(e) { return t; }
          })
          .catch(function(e) {
              console.warn("Proxy failed", pUrl, e);
              return tryNext();
          });
  }
  return tryNext();
}

function fetchJSON(url) {
    return fetch(url, { signal: AbortSignal.timeout(8000) })
        .then(function(r){
            if(!r.ok) throw new Error('HTTP error ' + r.status);
            return r.json();
        });
}

function parseMatchDate(str) {
    if (!str) return null;
    var cleanStr = str.replace(/(st|nd|rd|th)/, '');
    var d = new Date(cleanStr);
    if (!isNaN(d.getTime())) return d.toISOString();
    return null;
}

function getSortTime(m) {
    if (m.isLive) return 0;
    if (m.matchDate) {
        var t = new Date(m.matchDate).getTime();
        return isNaN(t) ? Infinity : t;
    }
    return Infinity;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { normName, getOfficialTeamName, formatLeagueName, stringSimilarity, editDistance, isMatch, isMatchPair, fetchPage, fetchJSON, parseMatchDate, getSortTime };
}

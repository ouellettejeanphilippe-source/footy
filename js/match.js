import { cacheLogo } from './utils.js';
import { normName } from './config.js';

/* ══ MATCH MERGING LOGIC ══════════════ */
export function mergeMatches(mainList, newList) {
  newList.forEach(function(nm) {
    var merged = false;

    for (var i = 0; i < mainList.length; i++) {
      var mm = mainList[i];

      if (isMatchPair(mm, nm)) {
        // It's the same match. Merge streams.
        mm.streamLinks = mm.streamLinks || [];
        nm.streamLinks = nm.streamLinks || [];

        nm.streamLinks.forEach(function(sl) {
          // Avoid exact duplicates
          if(!mm.streamLinks.find(function(existing) { return existing.url === sl.url; })) {
            mm.streamLinks.push(sl);
          }
        });

        // Update logos if the new source has them and we don't
        if(!mm.homeLogo && nm.homeLogo && nm.homeLogo.indexOf('default') === -1) {
            mm.homeLogo = nm.homeLogo;
            cacheLogo(mm.homeTeam, nm.homeLogo);
        }
        if(!mm.awayLogo && nm.awayLogo && nm.awayLogo.indexOf('default') === -1) {
            mm.awayLogo = nm.awayLogo;
            cacheLogo(mm.awayTeam, nm.awayLogo);
        }

        // Status resolution: if one says live and other says upcoming, prioritize live
        if(nm.status === 'live' && mm.status !== 'live') mm.status = 'live';
        if(nm.status === 'finished' && mm.status !== 'finished') mm.status = 'finished';

        // If API doesn't have time but source does
        if(mm.startTime === '00:00' && nm.startTime && nm.startTime !== '00:00') mm.startTime = nm.startTime;

        merged = true;
        break;
      }
    }

    if (!merged) {
      // If no match found, we add it as a new match to the list
      // Generate a new ID based on the array length to avoid conflicts
      nm.id = mainList.length;
      mainList.push(nm);
    }
  });

  return mainList;
}

/* ══ SIMILARITY ALGORITHM ════════════ */
export function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  var matrix = [];
  for (var i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (var j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  for (var i = 1; i <= b.length; i++) {
    for (var j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

export function stringSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  var maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  var dist = levenshtein(s1, s2);
  return (maxLen - dist) / maxLen;
}

export function isMatchPair(m1, m2) {
  if (!m1 || !m2) return false;

  // League strict check if both have leagues defined and aren't generic
  var l1 = (m1.league || '').toLowerCase();
  var l2 = (m2.league || '').toLowerCase();

  // Some basic sport/league exclusions (only exclude if we are absolutely sure they mismatch)
  if (l1 && l2 && l1 !== l2) {
      var is1Hockey = l1.includes('nhl') || l1.includes('hockey') || l1.includes('pwhl') || l1.includes('lhjmq');
      var is2Hockey = l2.includes('nhl') || l2.includes('hockey') || l2.includes('pwhl') || l2.includes('lhjmq');
      var is1Bball = l1.includes('nba') || l1.includes('basketball');
      var is2Bball = l2.includes('nba') || l2.includes('basketball');
      var is1Base = l1.includes('mlb') || l1.includes('baseball');
      var is2Base = l2.includes('mlb') || l2.includes('baseball');
      var is1Football = l1.includes('nfl') || l1.includes('american');
      var is2Football = l2.includes('nfl') || l2.includes('american');

      if ((is1Hockey && (is2Bball || is2Base || is2Football)) ||
          (is1Bball && (is2Hockey || is2Base || is2Football)) ||
          (is1Base && (is2Hockey || is2Bball || is2Football)) ||
          (is1Football && (is2Hockey || is2Bball || is2Base))) {
          return false;
      }
  }

  var m1H = normName(m1.homeTeam);
  var m1A = normName(m1.awayTeam);
  var m2H = normName(m2.homeTeam);
  var m2A = normName(m2.awayTeam);

  // Check explicitly for different dates before ANY matching
  if (m1.matchDate && m2.matchDate && m1.matchDate !== m2.matchDate) {
      return false;
  }

  // Check for TBD or missing teams (some scrapers only provide one team from URL)
  var is1HomeTbd = m1.homeTeam === 'TBD' || m1.homeTeam === 'tbd' || m1H === '';
  var is1AwayTbd = m1.awayTeam === 'TBD' || m1.awayTeam === 'tbd' || m1A === '';
  var is2HomeTbd = m2.homeTeam === 'TBD' || m2.homeTeam === 'tbd' || m2H === '';
  var is2AwayTbd = m2.awayTeam === 'TBD' || m2.awayTeam === 'tbd' || m2A === '';

  if (is1AwayTbd || is2AwayTbd || is1HomeTbd || is2HomeTbd) {
      if ((is1AwayTbd || is2AwayTbd) && isMatch(m1H, m2H)) return true;
      if ((is1AwayTbd || is2AwayTbd) && isMatch(m1H, m2A)) return true; // Could be reversed
      if ((is1HomeTbd || is2HomeTbd) && isMatch(m1A, m2A)) return true;
      if ((is1HomeTbd || is2HomeTbd) && isMatch(m1A, m2H)) return true;
      return false;
  }

  // Standard direct match
  if (isMatch(m1H, m2H) && isMatch(m1A, m2A)) {
      return true;
  }

  // Reversed match (away vs home)
  if (isMatch(m1H, m2A) && isMatch(m1A, m2H)) {
      return true;
  }

  // Advanced Cross-Validation Match
  // Create combined strings for both matches
  var combined1 = m1H + " " + m1A;
  var combined2 = m2H + " " + m2A;

  // We check if the smaller combo is essentially contained in the larger combo
  // by comparing words or high substring overlap.
  var shorterCombo = combined1.length < combined2.length ? combined1 : combined2;
  var longerCombo = combined1.length < combined2.length ? combined2 : combined1;

  // Let's break the original shorter names (from the object, not normalized) into words
  var rawShortH = m1H.length + m1A.length < m2H.length + m2A.length ? m1.homeTeam : m2.homeTeam;
  var rawShortA = m1H.length + m1A.length < m2H.length + m2A.length ? m1.awayTeam : m2.awayTeam;

  // Use normName on parts to match how the longer string is built
  var shortWordsRaw = (rawShortH + " " + rawShortA).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  var shortWords = [];
  shortWordsRaw.forEach(function(w) {
      var nw = normName(w);
      if (nw.length >= 3) shortWords.push(nw);
      else if (w.length >= 3) shortWords.push(w);
  });

  // Remove duplicates
  shortWords = shortWords.filter(function(item, pos) { return shortWords.indexOf(item) == pos; });

  if (shortWords.length === 0) return false;

  var matchedWords = 0;
  for (var i = 0; i < shortWords.length; i++) {
      var word = shortWords[i];
      if (longerCombo.includes(word)) {
          matchedWords++;
      } else {
          // Last resort sliding window for this word on the entire longer combo
          var maxW = Math.min(longerCombo.length, word.length + 2);
          var minW = Math.max(1, word.length - 2);
          var bestSubSim = 0;
          for (var w = minW; w <= maxW; w++) {
              for (var k = 0; k <= longerCombo.length - w; k++) {
                  var sub = longerCombo.substring(k, k + w);
                  var subSim = stringSimilarity(sub, word);
                  if (subSim > bestSubSim) bestSubSim = subSim;
              }
          }
          if (bestSubSim > 0.80) {
              matchedWords++;
          }
      }
  }

  // If a significant portion of words match, consider it the same matchup
  // (e.g. if we have "tigers" and "rangers", that's 2 words. If both match, it's 100%)
  if (matchedWords >= shortWords.length * 0.75 && matchedWords >= 2) {
      return true;
  }

  // Final permissive fallback: pure substring overlap for extreme abbreviations (e.g. 'Rangers' vs 'Texas Rangers')
  if (m1H && m1A && m2H && m2A) {
      var hMatch = m1H.includes(m2H) || m2H.includes(m1H);
      var aMatch = m1A.includes(m2A) || m2A.includes(m1A);
      if (hMatch && aMatch) return true;

      // Check reversed teams with subset matching
      var crossHMatch = m1H.includes(m2A) || m2A.includes(m1H);
      var crossAMatch = m1A.includes(m2H) || m2H.includes(m1A);
      if (crossHMatch && crossAMatch) return true;
  }

  // Cross-check dates and exact matches (already handled by early return, so we can just return true here)
  if (m1H === m2H && m1A === m2A) return true;

  return false;
}

export function isMatch(name1, name2) {
  if (!name1 || !name2) return false;
  if (name1 === name2) return true;

  // Clean empty strings might happen after normName replacements
  if (name1.length < 3 || name2.length < 3) return name1 === name2;

  // Check if one contains the other (e.g. 'manchester' in 'manchesterunited')
  if (name1.includes(name2) || name2.includes(name1)) return true;

  var sim = stringSimilarity(name1, name2);

  // Specific fallback for short names
  if (name1.length <= 4 || name2.length <= 4) {
      if (sim > 0.8) return true;
  } else {
      if (sim > 0.65) return true;
  }

  // If one name is significantly longer but contains a typo-version of the shorter one
  // Handled by sliding window below...

  // Sliding window substring similarity
  // This allows catching scraped names like "tampa" within "tampabaylightning" even with typos (e.g., "tanpa")
  var shorter = name1.length < name2.length ? name1 : name2;
  var longer = name1.length < name2.length ? name2 : name1;

  if (longer.length > shorter.length) {
      // Window size accounts for possible missing or extra characters
      var maxWindow = Math.min(longer.length, shorter.length + 2);
      var minWindow = Math.max(1, shorter.length - 2);

      var bestSubSim = 0;
      for (var w = minWindow; w <= maxWindow; w++) {
          for (var i = 0; i <= longer.length - w; i++) {
              var sub = longer.substring(i, i + w);
              var subSim = stringSimilarity(sub, shorter);
              if (subSim > bestSubSim) bestSubSim = subSim;
          }
      }

      // Since isMatch is usually called for BOTH home and away teams concurrently,
      // a loose match (70% on a substring) is very safe here.
      if (bestSubSim > 0.70) {
          return true;
      }
  }

  return false;
}



// Global bindings for HTML compatibility
window.mergeMatches = mergeMatches;
window.levenshtein = levenshtein;
window.stringSimilarity = stringSimilarity;
window.isMatchPair = isMatchPair;
window.isMatch = isMatch;

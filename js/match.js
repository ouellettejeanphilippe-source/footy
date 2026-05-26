import { normName, NORM_TEAM_KEYS } from './db.js';
import { TEAM_DATA } from './teams.js';

/* ══ MATCH MERGING LOGIC ══════════════ */
export function mergeMatches(mainList, newList) {
  for(var k=0; k<newList.length; k++) {
    var nm = newList[k];
    var merged = false;

    for (var i = 0; i < mainList.length; i++) {
      var mm = mainList[i];

      if (isMatchPair(mm, nm)) {
        // It's the same match. Merge streams.
        mm.streamLinks = mm.streamLinks || [];
        nm.streamLinks = nm.streamLinks || [];

        for(var l=0; l<nm.streamLinks.length; l++) {
          var sl = nm.streamLinks[l];
          if (!sl.source && nm.source) sl.source = nm.source;
          // Avoid exact duplicates
          var found = false;
          for(var j=0; j<mm.streamLinks.length; j++) { if(mm.streamLinks[j].url === sl.url) { found = true; break; } }
          if(!found) {
            mm.streamLinks.push(sl);
          }
        }

        // Update logos if the new source has them and we don't
        if(!mm.homeLogo && nm.homeLogo && nm.homeLogo.indexOf('default') === -1) {
            mm.homeLogo = nm.homeLogo;
        }
        if(!mm.awayLogo && nm.awayLogo && nm.awayLogo.indexOf('default') === -1) {
            mm.awayLogo = nm.awayLogo;
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
  }

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


export function getTeamInfo(name) {
    if (!name) return { city: '', teamName: '' };
    var n = normName(name);
    var key = NORM_TEAM_KEYS[n];
    if (key && TEAM_DATA[key]) {
        return { city: TEAM_DATA[key].city || '', teamName: TEAM_DATA[key].teamName || '' };
    }
    var lowerName = name.toLowerCase().trim();
    if (TEAM_DATA[lowerName]) {
        return { city: TEAM_DATA[lowerName].city || '', teamName: TEAM_DATA[lowerName].teamName || '' };
    }
    return { city: name, teamName: name };
}

export function isMatchContext(name1, name2, contextText) {
    if (isMatch(name1, name2)) return true;
    return false;
}

export function isMatchPair(m1, m2) {
  return debugMatchPair(m1, m2).isMatch;
}

export function debugMatchPair(m1, m2) {
  if (!m1 || !m2 || typeof m1.homeTeam !== 'string' || typeof m1.awayTeam !== 'string' || typeof m2.homeTeam !== 'string' || typeof m2.awayTeam !== 'string') return { isMatch: false, reason: "m1 ou m2 ou données d'équipes manquantes" };

  // Special Racing/Event bypass (F1, IndyCar, WWE)
  // These are handled like events where the "homeTeam" is usually the event name or League, and "awayTeam" is the session
  var esportsLeagues = ['LCS', 'LEC', 'LPL', 'LCK', 'MSI', 'WORLDS', 'CBLOL', 'LJL', 'PCS', 'VCS', 'LLA', 'TCL', 'LCP', 'NLC', 'PRIME LEAGUE', 'LVP SUPERLIGA', 'LIT', 'ESPORTS BALKAN LEAGUE', 'GREEK LEGENDS LEAGUE', 'ARABIAN LEAGUE', 'NACL', 'CBLOL ACADEMY', 'LCK CHALLENGERS', 'LPL ACADEMY'];
  var isEsports1 = esportsLeagues.includes((m1.league || '').toUpperCase()) || m1.homeTeam.toLowerCase().includes('esports') || m1.awayTeam.toLowerCase().includes('esports');
  var isEsports2 = esportsLeagues.includes((m2.league || '').toUpperCase()) || m2.homeTeam.toLowerCase().includes('esports') || m2.awayTeam.toLowerCase().includes('esports');

  var isRacingEvent1 = m1.homeTeam.toLowerCase().includes('grand prix') || m1.homeTeam.toLowerCase().includes('formula 1') || m1.homeTeam.toLowerCase() === 'f1' || m1.homeTeam.toLowerCase().includes('indy') || m1.homeTeam.toLowerCase() === 'wwe' || m1.league === 'F1' || m1.league === 'INDYCAR' || m1.league === 'WWE' || isEsports1;
  var isRacingEvent2 = m2.homeTeam.toLowerCase().includes('grand prix') || m2.homeTeam.toLowerCase().includes('formula 1') || m2.homeTeam.toLowerCase() === 'f1' || m2.homeTeam.toLowerCase().includes('indy') || m2.homeTeam.toLowerCase() === 'wwe' || m2.league === 'F1' || m2.league === 'INDYCAR' || m2.league === 'WWE' || isEsports2;

  if (isRacingEvent1 || isRacingEvent2) {
      var combo1 = normName(m1.homeTeam + " " + m1.awayTeam);
      var combo2 = normName(m2.homeTeam + " " + m2.awayTeam);
      if (isMatch(combo1, combo2) || combo1.includes(combo2) || combo2.includes(combo1)) {
          return { isMatch: true, reason: "Racing/Event direct combo match" };
      }

      // Fallback for racing/events: strip generic terms and check if the base event name matches
      var clean1 = combo1.replace(/(f1|formula1|grandprix|race|qualifying|practice|sprint|indycar|indy|wwe|mondaynightraw|smackdown|nxt)/g, '').trim();
      var clean2 = combo2.replace(/(f1|formula1|grandprix|race|qualifying|practice|sprint|indycar|indy|wwe|mondaynightraw|smackdown|nxt)/g, '').trim();

      if (clean1 && clean2 && (clean1.includes(clean2) || clean2.includes(clean1) || isMatch(clean1, clean2))) {
          return { isMatch: true, reason: "Racing/Event base name match (" + clean1 + " vs " + clean2 + ")" };
      }
  }

  // League strict check if both have leagues defined and aren't generic
  var l1 = (m1.league || '').toLowerCase();
  var l2 = (m2.league || '').toLowerCase();

  // Some basic sport/league exclusions (only exclude if we are absolutely sure they mismatch)
  if (l1 && l2 && l1 !== l2 && l1 !== 'sports' && l2 !== 'sports') {
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
          return { isMatch: false, reason: "Incompatibilité de sport/ligue (ex: hockey vs basketball)" };
      }
  }

  var m1H = normName(m1.homeTeam);
  var m1A = normName(m1.awayTeam);
  var m2H = normName(m2.homeTeam);
  var m2A = normName(m2.awayTeam);

  // Check explicitly for different dates before ANY matching
  if (m1.matchDate && m2.matchDate && m1.matchDate !== m2.matchDate) {
      return { isMatch: false, reason: "Dates différentes (" + m1.matchDate + " vs " + m2.matchDate + ")" };
  }

  // Check for TBD or missing teams (some scrapers only provide one team from URL)
  var is1HomeTbd = m1.homeTeam === 'TBD' || m1.homeTeam === 'tbd' || m1H === '';
  var is1AwayTbd = m1.awayTeam === 'TBD' || m1.awayTeam === 'tbd' || m1A === '';
  var is2HomeTbd = m2.homeTeam === 'TBD' || m2.homeTeam === 'tbd' || m2H === '';
  var is2AwayTbd = m2.awayTeam === 'TBD' || m2.awayTeam === 'tbd' || m2A === '';

  if (is1AwayTbd || is2AwayTbd || is1HomeTbd || is2HomeTbd) {
      if ((is1AwayTbd || is2AwayTbd) && isMatch(m1H, m2H)) return { isMatch: true, reason: "Match (TBD)" };
      if ((is1AwayTbd || is2AwayTbd) && isMatch(m1H, m2A)) return { isMatch: true, reason: "Match inversé (TBD)" };
      if ((is1HomeTbd || is2HomeTbd) && isMatch(m1A, m2A)) return { isMatch: true, reason: "Match (TBD)" };
      if ((is1HomeTbd || is2HomeTbd) && isMatch(m1A, m2H)) return { isMatch: true, reason: "Match inversé (TBD)" };
      return { isMatch: false, reason: "Équipe manquante ou TBD sans correspondance" };
  }

  var m2RawH = (m2.homeTeam || '').toLowerCase().trim();
  var m2RawA = (m2.awayTeam || '').toLowerCase().trim();
  var k1H = NORM_TEAM_KEYS[m1H];
  var k1A = NORM_TEAM_KEYS[m1A];

  var hMatches = isMatch(m1H, m2H);
  if (!hMatches && k1H && TEAM_DATA[k1H] && TEAM_DATA[k1H].aliases && TEAM_DATA[k1H].aliases.includes(m2RawH)) hMatches = true;

  var aMatches = isMatch(m1A, m2A);
  if (!aMatches && k1A && TEAM_DATA[k1A] && TEAM_DATA[k1A].aliases && TEAM_DATA[k1A].aliases.includes(m2RawA)) aMatches = true;

  // Standard direct match
  if (hMatches && aMatches) {
      return { isMatch: true, reason: "Correspondance directe" };
  }

  // Reversed match (away vs home)
  if (isMatch(m1H, m2A) && isMatch(m1A, m2H)) {
      return { isMatch: true, reason: "Correspondance inversée" };
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
  var rawShortH = combined1.length < combined2.length ? m1.homeTeam : m2.homeTeam;
  var rawShortA = combined1.length < combined2.length ? m1.awayTeam : m2.awayTeam;

  // Use normName on parts to match how the longer string is built
  var shortWordsRaw = (rawShortH + " " + rawShortA).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  var uniqueRawWords = Array.from(new Set(shortWordsRaw.filter(w => w.length >= 3)));

  if (uniqueRawWords.length === 0) return { isMatch: false, reason: "Aucun mot clé significatif pour la validation croisée" };

  var matchedWords = 0;
  for (var i = 0; i < uniqueRawWords.length; i++) {
      var rawWord = uniqueRawWords[i];
      var normWord = normName(rawWord);

      var wordsToTest = [rawWord];
      if (normWord.length >= 3 && normWord !== rawWord) {
          wordsToTest.push(normWord);
      }

      var wordMatched = false;

      for (var t = 0; t < wordsToTest.length; t++) {
          var word = wordsToTest[t];
          if (longerCombo.includes(word)) {
              wordMatched = true;
              break;
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
                  wordMatched = true;
                  break;
              }
          }
      }

      if (wordMatched) {
          matchedWords++;
      }
  }

  // If a significant portion of words match, consider it the same matchup
  // (e.g. if we have "tigers" and "rangers", that's 2 words. If both match, it's 100%)
  if (matchedWords >= uniqueRawWords.length * 0.75 && matchedWords >= 2) {
      // Prevent cross-validation from grouping known distinct pairs
      // We block the direct match interpretation if any of its aligned pairs are explicitly distinct.
      var blockedDirect = isKnownDistinct(m1H, m2H) || isKnownDistinct(m1A, m2A);
      // We block the reversed match interpretation if any of its aligned pairs are explicitly distinct.
      var blockedReversed = isKnownDistinct(m1H, m2A) || isKnownDistinct(m1A, m2H);

      // If the direct interpretation is blocked, and it doesn't match reversed, reject.
      if (blockedDirect && !isMatch(m1H, m2A) && !isMatch(m1A, m2H)) {
          return { isMatch: false, reason: "Bloqué par distinction explicite (Direct)" };
      }
      // If the reversed interpretation is blocked, and it doesn't match direct, reject.
      if (blockedReversed && !isMatch(m1H, m2H) && !isMatch(m1A, m2A)) {
          return { isMatch: false, reason: "Bloqué par distinction explicite (Inversé)" };
      }
      return { isMatch: true, reason: "Validation croisée (" + matchedWords + "/" + uniqueRawWords.length + " mots)" };
  }

  // Final permissive fallback: pure substring overlap for extreme abbreviations (e.g. 'Rangers' vs 'Texas Rangers')
  if (m1H && m1A && m2H && m2A) {
      var hMatch = m1H.includes(m2H) || m2H.includes(m1H);
      var aMatch = m1A.includes(m2A) || m2A.includes(m1A);
      if (hMatch && aMatch) return { isMatch: true, reason: "Sous-chaîne extrême (Direct)" };

      // Check reversed teams with subset matching
      var crossHMatch = m1H.includes(m2A) || m2A.includes(m1H);
      var crossAMatch = m1A.includes(m2H) || m2H.includes(m1A);
      if (crossHMatch && crossAMatch) return { isMatch: true, reason: "Sous-chaîne extrême (Inversé)" };
  }

  // Prevent specific city-only mismatches in the fallback
  if (m1H && m1A && m2H && m2A) {
      if ((m1H.includes('manchester') && m2H.includes('manchester') && !isMatch(m1H, m2H)) ||
          (m1A.includes('manchester') && m2A.includes('manchester') && !isMatch(m1A, m2A))) {
          return { isMatch: false, reason: "Rejeté: équipes distinctes de même ville (ex: Manchester)" };
      }
  }

  // Cross-check dates and exact matches (already handled by early return, so we can just return true here)
  if (m1H === m2H && m1A === m2A) return { isMatch: true, reason: "Match exact (fallback final)" };

  return { isMatch: false, reason: "Score de similarité insuffisant (Mots trouvés: " + matchedWords + "/" + uniqueRawWords.length + ")" };
}

export function isKnownDistinct(name1, name2) {
    if (!name1 || !name2) return false;
    var name1NoSpace = name1.replace(/\s+/g, '').toLowerCase();
    var name2NoSpace = name2.replace(/\s+/g, '').toLowerCase();
    var knownDistinctPairs = [
        ['manchestercity', 'manchesterunited'],
        ['milan', 'intermilan'],
        ['acmilan', 'intermilan'],
        ['realmadrid', 'atleticomadrid'],
        ['montrealcanadiens', 'cfmontreal'],
        ['montrealcanadiens', 'montrealalouettes'],
        ['montrealcanadiens', 'montrealvictoire'],
        ['cfmontreal', 'montrealalouettes'],
        ['cfmontreal', 'montrealvictoire'],
        ['montrealalouettes', 'montrealvictoire']
    ];
    for (var i = 0; i < knownDistinctPairs.length; i++) {
        var pair = knownDistinctPairs[i];
        if ((name1NoSpace.includes(pair[0]) && name2NoSpace.includes(pair[1])) ||
            (name1NoSpace.includes(pair[1]) && name2NoSpace.includes(pair[0]))) {
            return true;
        }
    }
    return false;
}

export function isMatch(name1, name2) {
  if (name1 === '' && name2 === '') return true;
  if (!name1 || !name2) return false;
  if (name1 === name2) return true;

  // Clean empty strings might happen after normName replacements
  if (name1.length < 3 || name2.length < 3) return name1 === name2;

  // If they share a common city prefix/suffix but are distinct teams, do not match.
  // For example: 'manchestercity' and 'manchesterunited'
  if (isKnownDistinct(name1, name2)) return false;

  // Check if one contains the other (e.g. 'manchester' in 'manchesterunited')
  if (name1.includes(name2) || name2.includes(name1)) return true;

  // Check if they match by city or team name using TEAM_DATA
  var info1 = getTeamInfo(name1);
  var info2 = getTeamInfo(name2);

  var norm1C = normName(info1.city);
  var norm2C = normName(info2.city);
  var norm1N = normName(info1.teamName);
  var norm2N = normName(info2.teamName);

  // If one name is just the city of the other
  if (norm1C && norm2C && norm1C === norm2C) {
      // If one team doesn't have a distinct name (i.e. name == city) or they both have the same name
      if (norm1N === norm1C || norm2N === norm2C || norm1N === norm2N || norm1N.includes(norm2N) || norm2N.includes(norm1N)) {
          return true;
      }
  }

  // If one name is just the team name of the other
  if (norm1N && norm2N && norm1N === norm2N && norm1N.length > 3) {
      if (norm1C === norm1N || norm2C === norm2N || norm1C === norm2C || norm1C.includes(norm2C) || norm2C.includes(norm1C)) {
          return true;
      }
  }

  // Cross check if one name provided is the city of the other, or teamName of the other
  var n1 = normName(name1);
  var n2 = normName(name2);
  if (n1 && n2) {
      if (n1 === norm2C && n1.length >= 3 && norm2N === norm2C) return true; // name2 has no distinct teamName
      if (n2 === norm1C && n2.length >= 3 && norm1N === norm1C) return true;

      // If n1 is the teamName of n2
      if (n1 === norm2N && n1.length >= 3) return true;
      if (n2 === norm1N && n2.length >= 3) return true;

      if (n1 === norm2C && n1.length >= 3) return true;
      if (n2 === norm1C && n2.length >= 3) return true;
  }
  var sim = stringSimilarity(name1, name2);

  // Specific fallback for short names
  if (name1.length <= 4 || name2.length <= 4) {
      if (sim > 0.8) return true;
  } else {
      if (sim > 0.75) return true; // increased threshold from 0.65
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
window.debugMatchPair = debugMatchPair;
window.isMatch = isMatch;
window.isKnownDistinct = isKnownDistinct;

window.getTeamInfo = getTeamInfo;

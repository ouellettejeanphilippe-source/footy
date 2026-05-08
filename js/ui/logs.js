
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

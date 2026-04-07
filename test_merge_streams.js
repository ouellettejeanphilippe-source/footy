function levenshtein(a, b) {
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

function stringSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  var maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  var dist = levenshtein(s1, s2);
  return (maxLen - dist) / maxLen;
}

function isMatch(name1, name2) {
  if (!name1 || !name2) return false;
  if (name1.includes(name2) || name2.includes(name1)) return true;
  return stringSimilarity(name1, name2) > 0.75;
}

var smHome = "Sabres".toLowerCase().replace(/[^a-z0-9]/g, '');
var smAway = "Lightning".toLowerCase().replace(/[^a-z0-9]/g, '');

var amHome = "Buffalo Sabres".toLowerCase().replace(/[^a-z0-9]/g, '');
var amAway = "Tampa Bay Lightning".toLowerCase().replace(/[^a-z0-9]/g, '');

console.log(smHome, smAway);
console.log(amHome, amAway);
console.log(isMatch(amHome, smHome), isMatch(amAway, smAway));

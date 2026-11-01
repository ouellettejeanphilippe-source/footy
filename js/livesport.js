/* Les sections du Live par sport (1er novembre 2026) : « dans live, trouver façon de regrouper par
   sports et non ligue. Mettre favoris en haut. »

   Du 27 octobre au 1er novembre 2026, le Live avait une section par ligue (NHL, AHL, NBA, NCAAB…).
   Une section par sport maintenant (Hockey, Basketball, Football, Soccer…), chaque carte gardant sa
   ligue en surtitre. Les favoris montent : une section qui contient un favori passe avant les
   autres, et dans une section les favoris passent devant, puis le direct, puis l'heure.

   SANS IMPORT : le sport, le favori, le direct et la comparaison des heures sont injectés. */

/* `matches` dans l'ordre des ligues (préférences de l'utilisateur) ; `o` = { sportDe(m),
   estFavori(m), estEnDirect(m), comparer(a, b) }. Rend [{ sport, matches, favori }]. */
export function sectionsParSport(matches, o) {
  var parSport = {}, ordre = [];
  (matches || []).forEach(function(m) {
    var k = o.sportDe(m) || 'Sport';
    if (!parSport[k]) { parSport[k] = []; ordre.push(k); }
    parSport[k].push(m);
  });
  var sections = ordre.map(function(k, i) {
    var liste = parSport[k].slice().sort(function(a, b) {
      var fa = o.estFavori(a) ? 0 : 1, fb = o.estFavori(b) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      var la = o.estEnDirect(a) ? 0 : 1, lb = o.estEnDirect(b) ? 0 : 1;
      if (la !== lb) return la - lb;
      return o.comparer(a, b);
    });
    return { sport: k, matches: liste, favori: liste.some(o.estFavori), rang: i };
  });
  sections.sort(function(a, b) {
    if (a.favori !== b.favori) return a.favori ? -1 : 1;
    return a.rang - b.rang;
  });
  return sections.map(function(s) { return { sport: s.sport, matches: s.matches, favori: s.favori }; });
}

/* L'identifiant de section (état replié, rail) d'un sport : `liveSp_Hockey`. */
export function idSectionSport(sport) {
  return 'liveSp_' + String(sport || '').normalize('NFD').replace(/[^a-zA-Z0-9]/g, '');
}

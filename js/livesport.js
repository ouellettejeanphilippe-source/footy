/* Les sections du Live par sport (1er novembre 2026) : « dans live, trouver façon de regrouper par
   sports et non ligue. Mettre favoris en haut. »

   Du 27 octobre au 1er novembre 2026, le Live avait une section par ligue (NHL, AHL, NBA, NCAAB…).
   Une section par sport maintenant (Hockey, Basketball, Football, Soccer…), chaque carte gardant sa
   ligue en surtitre. Les favoris montent : une section qui contient un favori passe avant les
   autres, et dans une section les favoris passent devant, puis le direct, puis l'heure.
   « Juste mettre les ligues secondaires en dessous des autres » (même jour) : plus de section
   « Ligues secondaires » ; une ligue secondaire est dans la section de son sport, après les
   principales, et un sport qui n'a que des ligues secondaires passe après les autres.

   « Par sports, mais par section aussi, quitte à répéter le sport pour les ligues secondaires »
   (même jour) : js/ui.js appelle sectionsParSport deux fois, ligues principales puis ligues
   secondaires ; un sport peut donc avoir deux sections (« Hockey », puis « Hockey · secondaires »).
   « Dans favoris, pouvoir trier les sports » : `o.ordreSports` (Favoris → Ligues) range les sections
   après les favoris ; un sport absent de la liste garde sa place d'apparition, après les autres.

   SANS IMPORT : le sport, le favori, le direct et la comparaison des heures sont injectés. */

/* `matches` dans l'ordre des ligues (préférences de l'utilisateur) ; `o` = { sportDe(m),
   estFavori(m), estEnDirect(m), comparer(a, b), estSecondaire(m)?, ordreSports? }. Rend [{ sport, matches, favori }]. */
export function sectionsParSport(matches, o) {
  var parSport = {}, ordre = [];
  (matches || []).forEach(function(m) {
    var k = o.sportDe(m) || 'Sport';
    if (!parSport[k]) { parSport[k] = []; ordre.push(k); }
    parSport[k].push(m);
  });
  var secondaire = function(m) { return typeof o.estSecondaire === 'function' && !!o.estSecondaire(m); };
  var sections = ordre.map(function(k, i) {
    var liste = parSport[k].slice().sort(function(a, b) {
      var sa = secondaire(a) ? 1 : 0, sb = secondaire(b) ? 1 : 0;
      if (sa !== sb) return sa - sb;
      var fa = o.estFavori(a) ? 0 : 1, fb = o.estFavori(b) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      var la = o.estEnDirect(a) ? 0 : 1, lb = o.estEnDirect(b) ? 0 : 1;
      if (la !== lb) return la - lb;
      return o.comparer(a, b);
    });
    return { sport: k, matches: liste, favori: liste.some(o.estFavori), principal: !liste.every(secondaire), rang: i };
  });
  var rangChoisi = function(s) { var i = (o.ordreSports || []).indexOf(s.sport); return i < 0 ? Infinity : i; };
  sections.sort(function(a, b) {
    if (a.principal !== b.principal) return a.principal ? -1 : 1;
    if (a.favori !== b.favori) return a.favori ? -1 : 1;
    var ca = rangChoisi(a), cb = rangChoisi(b);
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.rang - b.rang;
  });
  return sections.map(function(s) { return { sport: s.sport, matches: s.matches, favori: s.favori }; });
}

/* Les sports dans l'ordre de la page Favoris (`ordre`), puis ceux qu'il ne nomme pas, dans l'ordre
   d'apparition de `sports`, sans doublon. */
export function trierSports(sports, ordre) {
  var vus = {}, uniques = [];
  (sports || []).forEach(function(s) { if (!vus[s]) { vus[s] = 1; uniques.push(s); } });
  var rang = function(s) { var i = (ordre || []).indexOf(s); return i < 0 ? Infinity : i; };
  return uniques.map(function(s, i) { return { s: s, i: i }; })
    .sort(function(a, b) { var ra = rang(a.s), rb = rang(b.s); return ra !== rb ? (ra < rb ? -1 : 1) : a.i - b.i; })
    .map(function(x) { return x.s; });
}

/* Déplace un sport d'un cran (`sens` -1 / +1) dans la liste affichée `sports` ; rend le nouvel ordre
   complet à enregistrer (ordreSports). */
export function deplacerSport(sports, sport, sens) {
  var l = (sports || []).slice(), i = l.indexOf(sport), j = i + sens;
  if (i < 0 || j < 0 || j >= l.length) return l;
  l[i] = l[j]; l[j] = sport;
  return l;
}

/* L'identifiant de section (état replié, rail) d'un sport : `liveSp_Hockey`. */
export function idSectionSport(sport) {
  return 'liveSp_' + String(sport || '').normalize('NFD').replace(/[^a-zA-Z0-9]/g, '');
}

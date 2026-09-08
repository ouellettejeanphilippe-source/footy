import { normName, NORM_TEAM_KEYS, sportOfLeague } from './db.js';
import { TEAM_DATA } from './teams.js';
import { memeMatchATraversLaNuit } from './nuit.js';

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

        // Autres pages de match (autres sources) : conservées pour extraire leurs flux plus tard
        mergeAltUrls(mm, nm);

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

/* Ajoute à `target.altUrls` la page de match et les altUrls de `other`, sans doublon. */
export function mergeAltUrls(target, other) {
  if (!target || !other) return;
  var urls = [];
  if (other.matchUrl) urls.push(other.matchUrl);
  if (Array.isArray(other.altUrls)) urls = urls.concat(other.altUrls);
  if (!urls.length) return;
  if (!target.matchUrl) { target.matchUrl = urls.shift(); }
  target.altUrls = target.altUrls || [];
  urls.forEach(function(u) {
    if (u && u !== target.matchUrl && target.altUrls.indexOf(u) < 0) target.altUrls.push(u);
  });
}

/* ══ SIMILARITY ALGORITHM ════════════ */
export function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Swap to save memory: use the shorter string for the inner loop
  if (a.length > b.length) {
    var tmp = a;
    a = b;
    b = tmp;
  }

  var row = [];
  for (var i = 0; i <= a.length; i++) {
    row[i] = i;
  }

  for (var i = 1; i <= b.length; i++) {
    var prev = i;
    for (var j = 1; j <= a.length; j++) {
      var val;
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, Math.min(prev + 1, row[j] + 1));
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[a.length] = prev;
  }

  return row[a.length];
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

/* Marqueur de catégorie d'une équipe : féminin, âge, réserve.

   Mesuré le 6 septembre 2026 sur le cache réel (748 noms d'équipes distincts) : la
   comparaison par similarité ne PEUT pas séparer une coquille d'une équipe distincte,
   parce que les deux vivent dans les mêmes chiffres. « arsenal » contre « arsenl » est
   une vraie coquille à 0,857 de similarité ; « newyorkjets » contre « newyorkmets » sont
   deux équipes différentes à 0,909, et « nflnetwork » contre « nhlnetwork » à 0,900. Tout
   seuil qui accepte la première accepte les secondes.

   Ce qui les sépare est le CONTEXTE, pas les lettres : l'adversaire, la ligue et l'heure.
   Vérifié : « Arkansas State vs Iowa State » et « Kansas State vs Army » ne s'apparient
   pas, l'adversaire tranche ; idem pour l'Internacional brésilien et l'Inter de Milan.
   Les coquilles, elles, passent déjà, d'un côté comme des deux (« Tanpa Bay Lightning vs
   Florida Panthrs »).

   Restait un cas que le contexte ne tranche PAS, parce que tout y concorde sauf une
   lettre : l'équipe féminine et l'équipe masculine du même club, au même moment. Sur le
   cache du jour : Atlanta Dream W / Atlanta Dream, Bayern Munich W / Bayern Munich,
   Connecticut Sun W, Dallas Wings W, Los Angeles Sparks W, Portland Fire W, Seattle
   Storm W. Une seule lettre d'écart, donc 0,923 de similarité, donc appariement — et
   `mergeMatches` ne garde qu'une entrée : l'un des deux matchs DISPARAÎT de la grille
   avec ses liens.

   Un marqueur n'est pas une coquille : c'est une catégorie. On la lit, et deux catégories
   différentes ne s'apparient jamais, quels que soient les noms. Les libellés d'une même
   catégorie se rejoignent (« Arsenal W » et « Arsenal Women » sont le même club). */
var MARQUEURS_FEMININ = ['w', 'women', 'womens', 'ladies', 'fem', 'femenino', 'feminino', 'feminine', 'feminin', 'femminile', 'frauen', 'dames'];
var MARQUEURS_RESERVE = ['ii', 'b', 'reserve', 'reserves', 'academy'];
export function marqueurCategorie(nom) {
  if (!nom || typeof nom !== 'string') return '';
  var mots = nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ');
  if (mots.length < 2) return ''; // un nom d'un seul mot n'est pas « <club> <marqueur> »
  var dernier = mots[mots.length - 1];
  if (MARQUEURS_FEMININ.indexOf(dernier) >= 0) return 'F';
  var age = /^u(1[5-9]|2[0-3])$/.exec(dernier);
  if (age) return 'U' + age[1];
  if (MARQUEURS_RESERVE.indexOf(dernier) >= 0) return 'R';
  return '';
}

/* Catégorie d'un match : celle qu'annonce l'une ou l'autre équipe. Les sources ne
   marquent pas toujours les deux (« Bayern Munich W vs Wolfsburg »). */
export function categorieDuMatch(m) {
  if (!m) return '';
  return marqueurCategorie(m.homeTeam) || marqueurCategorie(m.awayTeam) || '';
}

/* Ligue dont TOUTES les équipes sont féminines. ESPN n'écrit jamais le marqueur
   (« Atlanta Dream », « France ») : c'est la ligue qui le porte. Relevé le 7 septembre
   2026 sur le cache publié : les sources écrivent « Atlanta Dream W vs Minnesota Lynx W »
   (Buffstreams, sous une étiquette « NCAA Men's Basketball » fausse) et « Italy W vs
   China W » (VIPLeague, « Basketball ») — et depuis la règle des catégories, aucune de
   ces entrées n'atteignait plus le match ESPN correspondant (WNBA, FIBA World Cup) :
   « senior vs F », jamais le même match. Les cartes de ces ligues restaient sans lien.

   « FIBA World Cup » est daté : l'étiquette ESPN (`basketball/fiba`) sert aux deux
   tournois, et l'édition de 2026 est la féminine (Berlin, 4-13 septembre). */
var LIGUES_FEMININES_RE = /\b(wnba|pwhl|nwsl)\b|women|womens|f[ée]minin|frauen|ladies/;
export function ligueFeminine(league) {
  var l = String(league || '').toLowerCase();
  if (!l) return false;
  if (LIGUES_FEMININES_RE.test(l)) return true;
  return /\bfiba\b.*world cup|fiba world cup/.test(l);
}

/* Deux catégories lues différemment peuvent être la même : un côté marqué « F » par ses
   noms, l'autre sans marqueur mais dans une ligue féminine. Un côté sans marqueur dans
   une ligue générique (« Basketball », « Soccer ») reste ambigu : on ne l'apparie pas à
   un côté marqué — c'est le cas des doublons masculin/féminin d'une même grille. */
export function categoriesCompatibles(cat1, m1, cat2, m2) {
  if (cat1 === cat2) return true;
  if (cat1 === 'F' && cat2 === '') return ligueFeminine(m2 && m2.league);
  if (cat2 === 'F' && cat1 === '') return ligueFeminine(m1 && m1.league);
  return false;
}

/* Spectacle de catch désigné par un libellé, ou '' si ce n'en est pas un.

   « Raw, c'est WWE, ça se peut que ça soit pas identifié Raw mais WWE, comme F1. »
   (8 septembre 2026) Exact, et mesuré le jour même : UN seul spectacle portait TROIS noms
   dans les données, dont deux venaient d'ESPN lui-même.

       « RAW #1737 »            ESPN et footybite   0 lien
       « WWE » / « Raw »        ESPN                0 lien
       « WWE Monday Night RAW » sportsurge          9 liens

   Aucun des trois ne s'appariait : la grille montrait deux cartes pour la même émission,
   et les neuf liens n'atteignaient ni l'une ni l'autre. Le nom de la FÉDÉRATION (WWE, AEW)
   et le numéro d'épisode ne disent rien de ce qu'on regarde ; ce qui identifie la soirée
   est le nom du SPECTACLE. On le dégage donc, exactement comme un Grand Prix est dégagé de
   « F1 » et de « Race » plus bas.

   Deux spectacles différents ne s'apparient JAMAIS : « WWE NXT » (4 liens ce jour-là) ne
   doit pas déverser ses flux sur Raw. Les plus longs d'abord, pour qu'un nom composé ne
   soit pas capturé par un nom plus court qu'il contient. */
var SPECTACLES_CATCH = ['smackdown', 'dynamite', 'rampage', 'collision', 'nxt', 'raw'];
export function spectacleDeCatch(nom) {
  var n = normName(nom || '');
  if (!n) return '';
  /* `normName` retire les espaces : « raw » se retrouverait DANS « Crawley Town », un
     vrai club anglais. On n'accepte donc le nom d'un spectacle que dans deux cas nets :
     le libellé est ce spectacle et rien d'autre (« RAW #1737 » une fois le numéro
     d'épisode retiré), ou il est précédé du nom de sa fédération (« WWE … RAW »). */
  var federation = /^(wwe|aew|tna|impact|roh)/.test(n);
  var reste = n
      .replace(/^(wwe|aew|tna|impact|roh)/, '')
      .replace(/^(monday|friday|saturday|tuesday|sunday|wednesday|thursday)?night/, '')
      .replace(/\d+$/, '');
  for (var i = 0; i < SPECTACLES_CATCH.length; i++) {
    var t = SPECTACLES_CATCH[i];
    if (reste === t) return t;
    if (federation && reste.indexOf(t) >= 0) return t;
  }
  return '';
}

export function isMatchPair(m1, m2) {
  return debugMatchPair(m1, m2).isMatch;
}

export function debugMatchPair(m1, m2) {
  if (!m1 || !m2 || typeof m1.homeTeam !== 'string' || typeof m1.awayTeam !== 'string' || typeof m2.homeTeam !== 'string' || typeof m2.awayTeam !== 'string') return { isMatch: false, reason: "m1 ou m2 ou données d'équipes manquantes" };

  /* Deux ligues connues de sports différents ne s'apparient jamais, quels que soient les
     noms. L'exclusion historique, plus bas, ne connaît que hockey, basket, baseball et
     football américain ; tout le reste passait. Relevé sur les pages réelles du
     6 septembre 2026 : « Miami FC vs Pittsburgh Riverhounds » (USL) recevait les liens de
     « Miami vs Pitt » (football universitaire) — « pitt » est contenu dans
     « pittsburghriverhounds ». Des familles plutôt que des sports exacts : une source
     étiquette « Motorsport » ce qu'une autre appelle « F1 », « American Football » ce que
     l'API range en NCAAF. « other » (Top 14, « Sports », libellés inconnus) n'exclut rien. */
  /* Catégories différentes (féminin / masculin / âge / réserve) : jamais le même match,
     même si les noms ne diffèrent que d'une lettre. Voir marqueurCategorie. */
  var cat1 = categorieDuMatch(m1), cat2 = categorieDuMatch(m2);
  if (!categoriesCompatibles(cat1, m1, cat2, m2)) {
      return { isMatch: false, reason: "Catégories différentes (" + (cat1 || 'senior') + " vs " + (cat2 || 'senior') + ")" };
  }

  var famille1 = sportFamily(sportOfLeague(m1.league));
  var famille2 = sportFamily(sportOfLeague(m2.league));
  if (famille1 !== 'other' && famille2 !== 'other' && famille1 !== famille2) {
      return { isMatch: false, reason: "Sports différents (" + famille1 + " vs " + famille2 + ")" };
  }

  // Special Racing/Event bypass (F1, IndyCar, WWE)
  // These are handled like events where the "homeTeam" is usually the event name or League, and "awayTeam" is the session
  var esportsLeagues = ['LCS', 'LEC', 'LPL', 'LCK', 'MSI', 'WORLDS', 'CBLOL', 'LJL', 'PCS', 'VCS', 'LLA', 'TCL', 'LCP', 'NLC', 'PRIME LEAGUE', 'LVP SUPERLIGA', 'LIT', 'ESPORTS BALKAN LEAGUE', 'GREEK LEGENDS LEAGUE', 'ARABIAN LEAGUE', 'NACL', 'CBLOL ACADEMY', 'LCK CHALLENGERS', 'LPL ACADEMY'];
  var isEsports1 = esportsLeagues.includes((m1.league || '').toUpperCase()) || m1.homeTeam.toLowerCase().includes('esports') || m1.awayTeam.toLowerCase().includes('esports');
  var isEsports2 = esportsLeagues.includes((m2.league || '').toUpperCase()) || m2.homeTeam.toLowerCase().includes('esports') || m2.awayTeam.toLowerCase().includes('esports');

  var isRacingEvent1 = m1.homeTeam.toLowerCase().includes('grand prix') || m1.homeTeam.toLowerCase().includes('formula 1') || m1.homeTeam.toLowerCase() === 'f1' || m1.homeTeam.toLowerCase().includes('indy') || m1.homeTeam.toLowerCase() === 'wwe' || m1.league === 'F1' || m1.league === 'INDYCAR' || m1.league === 'WWE' || isEsports1;
  var isRacingEvent2 = m2.homeTeam.toLowerCase().includes('grand prix') || m2.homeTeam.toLowerCase().includes('formula 1') || m2.homeTeam.toLowerCase() === 'f1' || m2.homeTeam.toLowerCase().includes('indy') || m2.homeTeam.toLowerCase() === 'wwe' || m2.league === 'F1' || m2.league === 'INDYCAR' || m2.league === 'WWE' || isEsports2;

  if (isRacingEvent1 || isRacingEvent2) {
      /* Le spectacle de catch prime sur la comparaison de lettres : « RAW #1737 » et
         « WWE Monday Night RAW » n'ont presque rien en commun à lire, et sont pourtant la
         même soirée ; « Raw » et « NXT » se ressemblent davantage et n'en sont pas. */
      var sp1 = spectacleDeCatch(m1.homeTeam + ' ' + m1.awayTeam);
      var sp2 = spectacleDeCatch(m2.homeTeam + ' ' + m2.awayTeam);
      if (sp1 && sp2) {
          return sp1 === sp2
              ? { isMatch: true, reason: 'Même spectacle de catch (' + sp1 + ')' }
              : { isMatch: false, reason: 'Spectacles de catch différents (' + sp1 + ' vs ' + sp2 + ')' };
      }

      var combo1 = normName(m1.homeTeam + " " + m1.awayTeam);
      var combo2 = normName(m2.homeTeam + " " + m2.awayTeam);
      if (isMatch(combo1, combo2, true) || combo1.includes(combo2) || combo2.includes(combo1)) {
          return { isMatch: true, reason: "Racing/Event direct combo match" };
      }

      // Fallback for racing/events: strip generic terms and check if the base event name matches
      var clean1 = combo1.replace(/(f1|formula1|grandprix|race|qualifying|practice|sprint|indycar|indy|wwe|mondaynightraw|smackdown|nxt)/g, '').trim();
      var clean2 = combo2.replace(/(f1|formula1|grandprix|race|qualifying|practice|sprint|indycar|indy|wwe|mondaynightraw|smackdown|nxt)/g, '').trim();

      /* Un résidu trop court n'identifie rien. « F1 Main Race » ne laisse que « main »,
         que « Sunday Nights Main Event » contient : relevé sur le cache du 6 septembre
         2026, ce gala de la WWE portait les liens de la F1 et, par ricochet, ceux du
         MotoGP. Cinq caractères est la plus courte forme d'un vrai nom d'épreuve
         (« monza », « miami », « texas ») ; en dessous, on exige une vraie similarité. */
      var residuSignificatif = function(r) { return r.length >= 5; };
      var inclusionPermise = residuSignificatif(clean1) && residuSignificatif(clean2);
      if (clean1 && clean2 && ((inclusionPermise && (clean1.includes(clean2) || clean2.includes(clean1))) || isMatch(clean1, clean2, true))) {
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

  // Check explicitly for different dates before ANY matching — sauf le match d'hier
  // soir relu après minuit, daté du jour par le serveur (js/nuit.js).
  if (m1.matchDate && m2.matchDate && m1.matchDate !== m2.matchDate && !memeMatchATraversLaNuit(m1, m2)) {
      return { isMatch: false, reason: "Dates différentes (" + m1.matchDate + " vs " + m2.matchDate + ")" };
  }

  // Check for TBD or missing teams (some scrapers only provide one team from URL)
  var is1HomeTbd = m1.homeTeam === 'TBD' || m1.homeTeam === 'tbd' || m1H === '';
  var is1AwayTbd = m1.awayTeam === 'TBD' || m1.awayTeam === 'tbd' || m1A === '';
  var is2HomeTbd = m2.homeTeam === 'TBD' || m2.homeTeam === 'tbd' || m2H === '';
  var is2AwayTbd = m2.awayTeam === 'TBD' || m2.awayTeam === 'tbd' || m2A === '';

  if (is1AwayTbd || is2AwayTbd || is1HomeTbd || is2HomeTbd) {
      if ((is1AwayTbd || is2AwayTbd) && isMatch(m1H, m2H, true)) return { isMatch: true, reason: "Match (TBD)" };
      if ((is1AwayTbd || is2AwayTbd) && isMatch(m1H, m2A, true)) return { isMatch: true, reason: "Match inversé (TBD)" };
      if ((is1HomeTbd || is2HomeTbd) && isMatch(m1A, m2A, true)) return { isMatch: true, reason: "Match (TBD)" };
      if ((is1HomeTbd || is2HomeTbd) && isMatch(m1A, m2H, true)) return { isMatch: true, reason: "Match inversé (TBD)" };
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

  /* ── Validation croisée, équipe par équipe ─────────────────────────────────────
     L'ancienne version comptait les mots du match le plus court retrouvés N'IMPORTE OÙ
     dans l'autre (« 3 mots sur 4 »), sans savoir quel mot venait de quelle équipe. Deux
     matchs qui partagent un sac de mots passaient donc : « Kent State vs South Carolina »
     face à « Florida A&M vs South Carolina State » (south, carolina, state), « McNeese
     State vs Texas Wesleyan » face à « Texas State vs Texas » (texas, state). Relevé sur
     les pages réelles du 6 septembre 2026, chaque cas attachait les liens d'un match à un
     autre.

     On aligne désormais : chaque équipe du match court doit avoir au moins un mot qui
     DÉSIGNE (ni générique, ni trop court) dans l'équipe correspondante du match long —
     dans le même sens, ou en sens inverse. « Texas vs Texas State » s'apparie ainsi à
     « Texas Longhorns vs Texas State Bobcats » (texas → longhorns, texas → bobcats), là
     où « Texas State vs Texas » ne s'apparie plus à « McNeese State vs Texas Wesleyan »
     (« state » seul ne désigne pas McNeese), ni « New York Mets vs San Francisco Giants »
     à « San Diego Padres vs New York Yankees » (« york » et « san » ne suffisent pas :
     tous les mots désignants d'une équipe doivent s'y retrouver). */
  var combined1 = m1H + " " + m1A;
  var combined2 = m2H + " " + m2A;
  var courtEstM1 = combined1.length < combined2.length;
  var rawShortH = courtEstM1 ? m1.homeTeam : m2.homeTeam;
  var rawShortA = courtEstM1 ? m1.awayTeam : m2.awayTeam;
  var longH = courtEstM1 ? m2H : m1H;
  var longA = courtEstM1 ? m2A : m1A;

  function motsDesignants(nom) {
      var mots = String(nom || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
      return Array.from(new Set(mots.filter(function(w) { return w.length >= 3 && GENERIC_TEAM_WORDS.indexOf(w) < 0; })));
  }
  function motDansEquipe(mot, equipe) {
      var formes = [mot];
      var nm = normName(mot);
      if (nm.length >= 3 && nm !== mot) formes.push(nm);
      for (var t = 0; t < formes.length; t++) {
          var word = formes[t];
          if (equipe.includes(word)) return true;
          // Coquille ou troncature : fenêtre glissante sur l'équipe alignée seulement.
          var maxW = Math.min(equipe.length, word.length + 2);
          var minW = Math.max(1, word.length - 2);
          for (var w = minW; w <= maxW; w++) {
              for (var k = 0; k <= equipe.length - w; k++) {
                  if (stringSimilarity(equipe.substring(k, k + w), word) > 0.80) return true;
              }
          }
      }
      return false;
  }
  /* TOUS les mots désignants du nom court doivent se retrouver dans l'équipe alignée :
     un seul suffirait à « New York Mets » pour s'aligner sur « New York Yankees »
     (« york »), ou à « San Francisco Giants » sur « San Diego Padres » (« san »). */
  function equipeAlignee(nomCourt, equipeLongue) {
      var mots = motsDesignants(nomCourt);
      if (!mots.length) return false;
      for (var i = 0; i < mots.length; i++) { if (!motDansEquipe(mots[i], equipeLongue)) return false; }
      return true;
  }

  var motsH = motsDesignants(rawShortH), motsA = motsDesignants(rawShortA);
  if (motsH.length === 0 || motsA.length === 0) return { isMatch: false, reason: "Aucun mot clé significatif pour la validation croisée" };

  var alignementDirect = equipeAlignee(rawShortH, longH) && equipeAlignee(rawShortA, longA);
  var alignementInverse = equipeAlignee(rawShortH, longA) && equipeAlignee(rawShortA, longH);
  if (alignementDirect || alignementInverse) {
      // Une distinction explicite (Manchester City / United…) bloque l'interprétation concernée.
      var blockedDirect = isKnownDistinct(m1H, m2H) || isKnownDistinct(m1A, m2A);
      var blockedReversed = isKnownDistinct(m1H, m2A) || isKnownDistinct(m1A, m2H);
      if (alignementDirect && !blockedDirect) return { isMatch: true, reason: "Validation croisée (alignement direct)" };
      if (alignementInverse && !blockedReversed) return { isMatch: true, reason: "Validation croisée (alignement inversé)" };
      return { isMatch: false, reason: "Bloqué par distinction explicite" };
  }
  var matchedWords = 0, uniqueRawWords = motsH.concat(motsA);

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

/* Mots trop répandus pour identifier une équipe à eux seuls (validation croisée). */
var GENERIC_TEAM_WORDS = ['state', 'north', 'south', 'east', 'west', 'central', 'northern', 'southern', 'eastern', 'western', 'university', 'college', 'saint', 'the', 'and'];

/* Décor et publicité déguisés en lecteurs : une adresse qui sert à plusieurs SPORTS.

   « Fais une règle qui les pogne tous sans pogner de faux streams » (6 septembre 2026).
   Mesuré sur le cache de 17 h 44 (410 matchs, 1 876 liens) : la médiane des matchs pourvus
   était de UN seul lien, et pour 50 d'entre eux ce lien unique était le même pour tout le
   monde. Quatre adresses à elles seules portaient 132 liens :

       74 matchs  dcbbwymp1bhlf.cloudfront.net/?wbbcd=1244494   (bandeau de footybite)
       35 matchs  hai8g.com/4/8553101                           (régie, format /4/NNNN)
       16 matchs  omg10.com/4/9020608//
        7 matchs  hai8g.com/4/11695852

   Ouvrir une de ces fiches montrait « 1 flux » et menait à une page de publicité.

   Le discriminant n'est pas le partage lui-même : de vraies chaînes sont légitimement
   partagées entre matchs — « NHL Network » sert cinq rencontres de hockey, le flux Sky
   Sports F1 sert les séances d'un même week-end. Ce qui trahit le décor, c'est de traverser
   les SPORTS : le bandeau de footybite apparaît en soccer, en cricket, en tennis, en MLB et
   au catch, tandis qu'une vraie chaîne reste dans sa famille. Vérifié sur ces données : la
   règle écarte les quatre adresses et garde les neuf chaînes légitimes, sans exception.

   Fonction pure, sans état : la liste des matchs suffit à la décider. */
export function adressesNonSpecifiques(matches) {
  var familles = {};
  (matches || []).forEach(function(m) {
    if (!m) return;
    var fam = sportFamily(sportOfLeague(m.league || ''));
    (m.streamLinks || []).forEach(function(l) {
      if (!l || !l.url || l.topLevel) return; // un lien « Page du match » est déjà marqué comme tel
      if (!familles[l.url]) familles[l.url] = {};
      familles[l.url][fam] = true;
    });
  });
  var out = {};
  Object.keys(familles).forEach(function(u) {
    /* « other » ne prouve rien : c'est le fourre-tout des ligues qu'on ne reconnaît pas.
       Une adresse ne doit pas être écartée sur ce seul indice. */
    var fams = Object.keys(familles[u]).filter(function(f) { return f !== 'other'; });
    if (fams.length >= 2) out[u] = true;
  });
  return out;
}

/* Retire ces adresses de tous les matchs. Rend le nombre de liens écartés. */
export function retirerLiensDeDecor(matches, ecartees) {
  var n = 0;
  (matches || []).forEach(function(m) {
    if (!m || !Array.isArray(m.streamLinks)) return;
    var avant = m.streamLinks.length;
    m.streamLinks = m.streamLinks.filter(function(l) { return !(l && l.url && ecartees[l.url]); });
    n += avant - m.streamLinks.length;
  });
  return n;
}

/* Famille de sport pour l'appariement : deux étiquettes de sources différentes pour une
   même compétition ne doivent pas se repousser. */
export function sportFamily(sport) {
    switch (sport) {
        case 'nfl': case 'cfb': case 'cfl': return 'football-us';
        case 'nba': case 'wnba': case 'ncaab': return 'basket';
        case 'f1': case 'motor': return 'motor';
        case 'mma': case 'boxing': return 'fight';
        default: return sport || 'other';
    }
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

export function isMatch(name1, name2, strict) {
  if (name1 === '' && name2 === '') return true;
  if (!name1 || !name2) return false;
  if (name1 === name2) return true;

  // Clean empty strings might happen after normName replacements
  if (name1.length < 3 || name2.length < 3) return name1 === name2;

  // If they share a common city prefix/suffix but are distinct teams, do not match.
  // For example: 'manchestercity' and 'manchesterunited'
  if (isKnownDistinct(name1, name2)) return false;

  // Check if one contains the other (e.g. 'manchester' in 'manchesterunited').
  // Skipped in `strict` mode: same risk as the sliding window below (see its comment) —
  // 'rangers' is a genuine substring of 'queensparkrangers', 'austin' of 'austinfc',
  // 'montana' of 'montanastate', etc., yet these are unrelated teams. Relevé le 5 septembre
  // 2026 : après avoir corrigé la fenêtre glissante, 9 matchs (Rangers, Wigan Athletic,
  // Queen's Park, Stephen F. Austin, Montana State, Arizona State, San Diego FC, New
  // Mexico, Louisiana Tech — tous à l'équipe visiteuse vide) continuaient de disparaître
  // par CETTE vérification-ci plutôt que par la fenêtre glissante.
  if (!strict && (name1.includes(name2) || name2.includes(name1))) return true;

  // Check if they match by city or team name using TEAM_DATA
  var info1 = getTeamInfo(name1);
  var info2 = getTeamInfo(name2);

  var norm1C = normName(info1.city);
  var norm2C = normName(info2.city);
  var norm1N = normName(info1.teamName);
  var norm2N = normName(info2.teamName);

  // If one name is just the city of the other
  if (norm1C && norm2C && norm1C === norm2C) {
      // If one team doesn't have a distinct name (i.e. name == city) or they both have the same name.
      // The two `.includes(...)` legs are skipped in `strict` mode for the same reason as the plain
      // containment check above: 'diego' (San Diego FC's poorly-split teamName) is a genuine substring
      // of 'diego padres' (San Diego Padres), yet they are unrelated teams sharing only a city field.
      if (norm1N === norm1C || norm2N === norm2C || norm1N === norm2N || (!strict && (norm1N.includes(norm2N) || norm2N.includes(norm1N)))) {
          return true;
      }
  }

  // If one name is just the team name of the other
  if (norm1N && norm2N && norm1N === norm2N && norm1N.length > 3) {
      if (norm1C === norm1N || norm2C === norm2N || norm1C === norm2C || (!strict && (norm1C.includes(norm2C) || norm2C.includes(norm1C)))) {
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

  /* Fenêtre glissante : deux mentions du MÊME nom, avec coquille ou tronqué (« tanpa »
     pour « tampabaylightning »). En mode `strict`, sautée entièrement.

     `strict` sert exactement au cas où l'un des deux matchs n'a qu'une équipe connue
     (l'autre est vide/TBD) : on n'y compare alors plus deux mentions du même nom, mais
     un nom face à TOUT le reste de la base — une correspondance par fragment y devient
     un risque, pas un filet de sécurité. Relevé le 5 septembre 2026 sur les données
     réelles de footybite : la fenêtre « rest » (tirée de « nottinghamforest ») obtient
     80 % de similarité avec « brest », suffisant pour franchir le seuil de 70 %. Un match
     Nottingham Forest à l'équipe visiteuse vide absorbait ainsi « Le Havre vs Brest » —
     et Le Havre disparaissait du fichier, sans qu'aucune erreur ne le signale. 24 matchs
     sur 180 se perdaient ainsi le même jour, dans la seule page d'accueil de footybite. */
  if (strict) return false;

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

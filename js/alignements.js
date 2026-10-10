/* Alignements et feuille de match, lus dans le `summary` ESPN que la fiche reçoit déjà
   (`fetchGameStats`, js/api.js). Aucune requête de plus.

   ESPN range ces données à deux endroits selon le sport :
   - `rosters[]` : la composition. Au football, titulaires avec poste, `formationPlace`
     et `formation` (« 4-2-3-1 »), remplaçants, et pour chaque joueur ses `plays` (but,
     passe, carton, changement, avec la minute). Au baseball, l'ordre des frappeurs
     (`batOrder`), sans statistique.
   - `boxscore.players[]` : une feuille par équipe, en groupes (attaquants, défenseurs et
     gardiens au hockey ; passes, courses, réceptions… au football américain ; frappeurs et
     lanceurs au baseball), chaque groupe avec ses colonnes (`labels`) et ses joueurs.
   Le football n'a pas de feuille (`boxscore.players` absent) ; le hockey et la NFL n'ont
   pas de composition. On prend la composition quand elle porte une formation ou des
   actions de match (le football), sinon la feuille, sinon la composition seule.

   Avant le match, la composition n'existe qu'environ une heure avant le coup d'envoi :
   `rosters[].roster` est absent d'ici là, et `extraireAlignements` rend null.

   Module sans import : le rendu reçoit la fonction d'échappement de l'appelant. */

var GROUPES = {
  forwards: 'Attaquants', defenses: 'Défenseurs', goalies: 'Gardiens', skaters: 'Patineurs',
  passing: 'Passes', rushing: 'Courses', receiving: 'Réceptions', fumbles: 'Échappés',
  defensive: 'Défense', interceptions: 'Interceptions', kickReturns: 'Retours de botté',
  puntReturns: 'Retours de dégagement', kicking: 'Bottés', punting: 'Dégagements',
  batting: 'Frappeurs', pitching: 'Lanceurs'
};

/* Colonnes retenues, par ordre d'intérêt : une feuille de hockey en a 21, l'écran d'un
   téléphone en tient six. Elles s'affichent ensuite dans l'ordre d'ESPN. Un groupe dont
   les colonnes ont le même nom qu'ailleurs mais pas le même sens (H et R d'un lanceur,
   REC d'un échappé) a sa propre liste. */
var COLONNES_GROUPE = {
  pitching: ['IP', 'H', 'ER', 'BB', 'K', 'ERA'],
  batting: ['H-AB', 'R', 'RBI', 'HR', 'BB', 'K'],
  goalies: ['SA', 'GA', 'SV', 'SV%', 'TOI'],
  defensive: ['TOT', 'SOLO', 'SACKS', 'TFL', 'PD', 'TD'],
  fumbles: ['FUM', 'LOST', 'REC']
};
var COLONNES_PREFEREES = [
  'G', 'A', 'PTS', 'SOG', '+/-', 'TOI', 'PIM',            // hockey, basket
  'SA', 'GA', 'SV', 'SV%',                                // gardiens
  'C/ATT', 'CAR', 'REC', 'YDS', 'TD', 'INT', 'SACKS', 'TOT', 'FG', 'XP', 'NO', 'AVG', // NFL
  'H-AB', 'R', 'RBI', 'HR', 'BB', 'K', 'IP', 'H', 'ER', 'ERA', // MLB
  'MIN', 'REB', 'AST', '3PT', 'STL', 'BLK'                // basket
];
export var COLONNES_MAX = 6;

function nomJoueur(a) {
  if (!a) return '';
  return a.displayName || a.fullName || a.shortName || '';
}

function poste(p) {
  var pos = (p && p.position) || (p && p.athlete && p.athlete.position) || null;
  return pos ? (pos.abbreviation || pos.name || '') : '';
}

/* Ce qu'un joueur de football a fait, d'après ses `plays` : buts, passes, cartons et
   la minute de son entrée ou de sa sortie. */
function actionsFoot(p) {
  var out = [];
  (p.plays || []).forEach(function(pl) {
    var min = pl.clock && pl.clock.displayValue ? pl.clock.displayValue : '';
    if (pl.didScore) out.push({ type: pl.ownGoal ? 'csc' : 'but', min: min });
    else if (pl.didAssist) out.push({ type: 'passe', min: min });
    if (pl.yellowCard) out.push({ type: 'jaune', min: min });
    if (pl.redCard) out.push({ type: 'rouge', min: min });
    if (pl.substitution) out.push({ type: p.starter ? 'sortie' : 'entree', min: min });
  });
  return out;
}

function depuisRosters(rosters) {
  return rosters.map(function(r) {
    var joueurs = (r.roster || []).map(function(p) {
      return {
        num: p.jersey || (p.athlete && p.athlete.jersey) || '',
        nom: nomJoueur(p.athlete),
        court: (p.athlete && (p.athlete.lastName || p.athlete.shortName)) || nomJoueur(p.athlete),
        poste: poste(p),
        titulaire: !!p.starter,
        ordre: parseInt(p.formationPlace || p.batOrder, 10) || 99,
        entre: !!p.subbedIn,
        sorti: !!p.subbedOut,
        actions: actionsFoot(p)
      };
    }).filter(function(j) { return j.nom; });
    var parOrdre = function(a, b) { return a.ordre - b.ordre; };
    var titulaires = joueurs.filter(function(j) { return j.titulaire; }).sort(parOrdre);
    // Remplaçants : ceux qui sont entrés d'abord, les autres ensuite, chacun dans l'ordre d'ESPN.
    var banc = joueurs.filter(function(j) { return !j.titulaire; });
    var remplacants = banc.filter(function(j) { return j.entre; }).concat(banc.filter(function(j) { return !j.entre; }));
    return {
      cote: r.homeAway === 'away' ? 'away' : 'home',
      equipe: (r.team && (r.team.displayName || r.team.shortDisplayName || r.team.name)) || '',
      logo: (r.team && r.team.logo) || (r.team && r.team.logos && r.team.logos[0] && r.team.logos[0].href) || '',
      formation: r.formation || '',
      titulaires: titulaires,
      remplacants: remplacants
    };
  }).filter(function(e) { return e.titulaires.length || e.remplacants.length; });
}

function choisirColonnes(labels, groupe) {
  var garde = [];
  (COLONNES_GROUPE[groupe] || COLONNES_PREFEREES).forEach(function(l) {
    if (garde.length < COLONNES_MAX && labels.indexOf(l) >= 0 && garde.indexOf(l) < 0) garde.push(l);
  });
  if (!garde.length) garde = labels.slice(0, COLONNES_MAX);
  // Ordre d'ESPN, pas celui de la préférence.
  return labels.map(function(l, i) { return { l: l, i: i }; })
    .filter(function(c) { return garde.indexOf(c.l) >= 0; });
}

function depuisBoxscore(players, rosters, competiteurs) {
  var cotes = {};
  (competiteurs || []).concat(rosters || []).forEach(function(r) {
    var id = r.team && r.team.id ? r.team.id : r.id;
    if (id && r.homeAway) cotes[id] = r.homeAway;
  });
  return players.map(function(t, idx) {
    var groupes = (t.statistics || []).map(function(g) {
      var cle = g.name || g.type || '';
      var labels = g.labels || g.names || [];
      var cols = choisirColonnes(labels, cle);
      var joueurs = (g.athletes || []).filter(function(a) {
        return a && a.athlete && !a.didNotPlay && a.stats && a.stats.length;
      }).map(function(a) {
        return {
          num: a.athlete.jersey || '',
          nom: nomJoueur(a.athlete),
          poste: poste(a),
          titulaire: !!a.starter,
          stats: cols.map(function(c) { return a.stats[c.i] != null ? String(a.stats[c.i]) : ''; })
        };
      });
      return {
        titre: GROUPES[cle] || g.text || cle,
        colonnes: cols.map(function(c) { return c.l; }),
        joueurs: joueurs
      };
    }).filter(function(g) { return g.joueurs.length; });
    var team = t.team || {};
    var cote = t.homeAway || cotes[team.id] || null;
    return {
      // ESPN donne l'équipe visiteuse en premier quand il ne dit rien.
      cote: cote === 'home' || cote === 'away' ? cote : (idx === 0 ? 'away' : 'home'),
      equipe: team.displayName || team.shortDisplayName || team.name || '',
      logo: team.logo || '',
      groupes: groupes
    };
  }).filter(function(e) { return e.groupes.length; });
}

/* { type: 'compo' | 'feuille', equipes: [domicile, visiteur] } ou null. */
export function extraireAlignements(data) {
  if (!data) return null;
  var rosters = Array.isArray(data.rosters) ? data.rosters : [];
  var avecJoueurs = rosters.filter(function(r) { return r.roster && r.roster.length; });
  var players = data.boxscore && Array.isArray(data.boxscore.players) ? data.boxscore.players : [];

  var comp = data.header && data.header.competitions && data.header.competitions[0];
  var competiteurs = comp && Array.isArray(comp.competitors) ? comp.competitors : [];

  var compoRiche = avecJoueurs.some(function(r) {
    return r.formation || r.roster.some(function(p) { return p.formationPlace || (p.plays && p.plays.length); });
  });

  var res = null;
  if (avecJoueurs.length && compoRiche) res = { type: 'compo', equipes: depuisRosters(avecJoueurs) };
  else if (players.length) res = { type: 'feuille', equipes: depuisBoxscore(players, rosters, competiteurs) };
  else if (avecJoueurs.length) res = { type: 'compo', equipes: depuisRosters(avecJoueurs) };
  if (!res || !res.equipes.length) return null;
  res.equipes.sort(function(a, b) { return (a.cote === 'home' ? 0 : 1) - (b.cote === 'home' ? 0 : 1); });
  return res;
}

/* L'effectif de chaque équipe (`/teams/{id}/roster`, déjà lu par la fiche pour les
   statistiques de saison), quand le match n'a encore ni composition ni feuille : avant
   le coup d'envoi, c'est tout ce qu'ESPN publie. ESPN ne donne nulle part les trios et
   les paires du hockey (`/depthcharts` est vide pour la LNH, relevé du 10 octobre 2026) :
   l'effectif est rangé par position, pas par ligne.
   Deux formes : groupé (`athletes: [{ position: 'Centers', items: [...] }]`, hockey, NFL)
   ou à plat (`athletes: [joueur]`, football, basket), qu'on range par position. */
var GROUPES_EFFECTIF = {
  'Centers': 'Centres', 'Left Wings': 'Ailiers gauches', 'Right Wings': 'Ailiers droits',
  'Defense': 'Défenseurs', 'Goalies': 'Gardiens',
  offense: 'Attaque', defense: 'Défense', specialTeam: 'Unités spéciales',
  injuredReserveOrOut: 'Blessés et absents', suspended: 'Suspendus', practiceSquad: 'Équipe d\'entraînement',
  'Goalkeeper': 'Gardiens', 'Defender': 'Défenseurs', 'Midfielder': 'Milieux', 'Forward': 'Attaquants',
  'Guard': 'Arrières', 'Center': 'Pivots', 'Guard-Forward': 'Arrières-ailiers', 'Forward-Center': 'Ailiers-pivots',
  'Pitcher': 'Lanceurs', 'Starting Pitcher': 'Lanceurs partants', 'Relief Pitcher': 'Releveurs', 'Catcher': 'Receveurs',
  'Infielder': 'Joueurs d\'avant-champ', 'Outfielder': 'Voltigeurs', 'Designated Hitter': 'Frappeurs désignés'
};
var ORDRE_POSTES = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];

function joueurEffectif(a) {
  return {
    num: a.jersey || '',
    nom: nomJoueur(a),
    poste: a.position ? (a.position.abbreviation || '') : '',
    blesse: !!(a.injuries && a.injuries.length)
  };
}

function groupesEffectif(roster) {
  var ath = roster && Array.isArray(roster.athletes) ? roster.athletes : [];
  if (ath.length && Array.isArray(ath[0].items)) {
    return ath.map(function(g) {
      return { titre: GROUPES_EFFECTIF[g.position] || g.position || '', joueurs: g.items.map(joueurEffectif).filter(function(j) { return j.nom; }) };
    }).filter(function(g) { return g.joueurs.length; });
  }
  var parPoste = {}, ordre = [];
  ath.forEach(function(a) {
    var cle = (a.position && (a.position.displayName || a.position.name || a.position.abbreviation)) || '';
    if (!parPoste[cle]) { parPoste[cle] = []; ordre.push(cle); }
    var j = joueurEffectif(a);
    if (j.nom) parPoste[cle].push(j);
  });
  ordre.sort(function(a, b) {
    var ia = ORDRE_POSTES.indexOf(a), ib = ORDRE_POSTES.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return ordre.map(function(cle) {
    var joueurs = parPoste[cle].sort(function(a, b) { return (parseInt(a.num, 10) || 999) - (parseInt(b.num, 10) || 999); });
    return { titre: GROUPES_EFFECTIF[cle] || cle, joueurs: joueurs };
  }).filter(function(g) { return g.joueurs.length; });
}

/* { type: 'effectif', equipes } ou null. `noms` : [domicile, visiteur], repli quand la
   réponse ne nomme pas l'équipe. */
export function extraireEffectifs(rosterDomicile, rosterVisiteur, noms) {
  noms = noms || [];
  var equipes = [[rosterDomicile, 'home', noms[0]], [rosterVisiteur, 'away', noms[1]]].map(function(x) {
    var r = x[0];
    var team = (r && r.team) || {};
    return { cote: x[1], equipe: team.displayName || x[2] || '', groupes: groupesEffectif(r) };
  }).filter(function(e) { return e.groupes.length; });
  return equipes.length ? { type: 'effectif', equipes: equipes } : null;
}

function equipeEffectifHtml(e, esc) {
  return e.groupes.map(function(g) {
    return (g.titre ? '<div class="al-sous">' + esc(g.titre) + '</div>' : '') + '<ol class="al-liste">'
      + g.joueurs.map(function(j) {
        return '<li class="al-j"><span class="al-num">' + esc(j.num) + '</span><span class="al-nom">' + esc(j.nom) + '</span>'
          + (j.poste ? '<span class="al-pos">' + esc(j.poste) + '</span>' : '')
          + (j.blesse ? '<span class="al-act" title="Blessé">🚑</span>' : '') + '</li>';
      }).join('') + '</ol>';
  }).join('');
}

var ICONES = { but: '⚽', csc: '⚽ csc', passe: '🅰️', jaune: '🟨', rouge: '🟥', entree: '🔺', sortie: '🔻' };

function actionsHtml(actions, esc) {
  return actions.map(function(a) {
    return '<span class="al-act al-' + a.type + '">' + ICONES[a.type] + (a.min ? ' ' + esc(a.min) : '') + '</span>';
  }).join('');
}

/* Le terrain. ESPN ne donne pas de coordonnées, mais assez pour les retrouver : la
   formation (« 3-4-2-1 ») dit combien de joueurs par rangée, et le poste de chacun dit
   sa profondeur (défenseur, milieu, meneur, attaquant) et son côté. Relevé sur Leeds le
   10 octobre 2026 : CD, CD-L, CD-R ; CM-L, CM-R, LM, RM ; CF-L, CF-R ; F. Les joueurs
   triés par profondeur sont découpés selon la formation, puis rangés de gauche à droite.
   `formationPlace` ne sert qu'à départager : sa numérotation change d'une formation à
   l'autre. */
function profondeur(pos) {
  var p = String(pos || '').toUpperCase();
  if (p === 'G' || p === 'GK') return 0;
  if (/^(CD|CB|SW|D|LB|RB)(-[LR])?$/.test(p)) return 1;
  if (/WB/.test(p)) return 1.5;
  if (/^(DM|CDM)(-[LR])?$/.test(p)) return 2;
  if (/^AM|^LW$|^RW$/.test(p)) return 3.5;
  if (/^(CF-[LR]|[LR]CF)$/.test(p)) return 4;
  if (/^(F|CF|ST|S|LF|RF)(-[LR])?$/.test(p)) return 4.5;
  return 2.5; // M, CM, LM, RM et ce qu'on ne connaît pas : au milieu
}

function cote(pos) {
  var p = String(pos || '').toUpperCase();
  if (/-L$/.test(p)) return -1;
  if (/-R$/.test(p)) return 1;
  if (/^L/.test(p)) return -2;
  if (/^R/.test(p)) return 2;
  return 0;
}

/* Rangées du gardien à l'attaque, chacune de gauche à droite ; null si la formation ne
   correspond pas aux titulaires (alors la liste reste). */
export function rangeesTerrain(titulaires, formation) {
  if (!titulaires || !titulaires.length) return null;
  var tailles = String(formation || '').split('-').map(function(n) { return parseInt(n, 10); });
  if (!tailles.length || tailles.some(function(n) { return !(n > 0); })) return null;
  tailles.unshift(1);
  var total = tailles.reduce(function(a, b) { return a + b; }, 0);
  if (total !== titulaires.length) return null;
  var tries = titulaires.slice().sort(function(a, b) {
    return (profondeur(a.poste) - profondeur(b.poste)) || (a.ordre - b.ordre);
  });
  var rangees = [], i = 0;
  tailles.forEach(function(n) {
    rangees.push(tries.slice(i, i + n).sort(function(a, b) {
      return (cote(a.poste) - cote(b.poste)) || (a.ordre - b.ordre);
    }));
    i += n;
  });
  return rangees;
}

function pastille(j, esc) {
  var buts = j.actions.filter(function(a) { return a.type === 'but' || a.type === 'csc'; }).length;
  var marques = '';
  if (buts) marques += '<span class="al-m">⚽' + (buts > 1 ? '×' + buts : '') + '</span>';
  if (j.actions.some(function(a) { return a.type === 'passe'; })) marques += '<span class="al-m">🅰️</span>';
  if (j.actions.some(function(a) { return a.type === 'rouge'; })) marques += '<span class="al-m">🟥</span>';
  else if (j.actions.some(function(a) { return a.type === 'jaune'; })) marques += '<span class="al-m">🟨</span>';
  var sortie = j.actions.filter(function(a) { return a.type === 'sortie'; })[0];
  if (sortie) marques += '<span class="al-m">🔻' + esc(sortie.min) + '</span>';
  var titre = j.nom + (j.poste ? ' · ' + j.poste : '') + j.actions.map(function(a) { return ' · ' + ICONES[a.type] + (a.min ? ' ' + a.min : ''); }).join('');
  return '<div class="al-p' + (j.sorti ? ' al-sorti' : '') + '" title="' + esc(titre) + '">'
    + '<span class="al-rond">' + esc(j.num) + '</span>'
    + '<span class="al-pnom">' + esc(j.court || j.nom) + '</span>'
    + (marques ? '<span class="al-marques">' + marques + '</span>' : '')
    + '</div>';
}

function terrainHtml(rangees, esc) {
  // L'attaque en haut, le gardien en bas.
  return '<div class="al-terrain" role="img" aria-label="Composition sur le terrain">'
    + rangees.slice().reverse().map(function(r) {
      return '<div class="al-rangee">' + r.map(function(j) { return pastille(j, esc); }).join('') + '</div>';
    }).join('') + '</div>';
}

function ligneCompo(j, esc) {
  return '<li class="al-j' + (j.sorti ? ' al-sorti' : '') + '">'
    + '<span class="al-num">' + esc(j.num) + '</span>'
    + '<span class="al-nom">' + esc(j.nom) + '</span>'
    + (j.poste && j.poste !== 'SUB' ? '<span class="al-pos">' + esc(j.poste) + '</span>' : '')
    + (j.actions && j.actions.length ? '<span class="al-acts">' + actionsHtml(j.actions, esc) + '</span>' : '')
    + '</li>';
}

function equipeCompoHtml(e, esc) {
  var h = '';
  if (e.formation) h += '<div class="al-formation">' + esc(e.formation) + '</div>';
  var rangees = rangeesTerrain(e.titulaires, e.formation);
  if (rangees) h += terrainHtml(rangees, esc);
  else h += '<div class="al-sous">Titulaires</div><ol class="al-liste">' + e.titulaires.map(function(j) { return ligneCompo(j, esc); }).join('') + '</ol>';
  if (e.remplacants.length) {
    h += '<div class="al-sous">Remplaçants</div><ol class="al-liste al-banc">' + e.remplacants.map(function(j) { return ligneCompo(j, esc); }).join('') + '</ol>';
  }
  return h;
}

function equipeFeuilleHtml(e, esc) {
  return e.groupes.map(function(g) {
    var h = (g.titre ? '<div class="al-sous">' + esc(g.titre) + '</div>' : '') + '<div class="al-table-wrap"><table class="al-table"><thead><tr><th class="al-th-nom">Joueur</th>';
    g.colonnes.forEach(function(c) { h += '<th>' + esc(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    g.joueurs.forEach(function(j) {
      h += '<tr' + (j.titulaire ? ' class="al-tit"' : '') + '><td class="al-td-nom">'
        + (j.num ? '<span class="al-num">' + esc(j.num) + '</span>' : '')
        + esc(j.nom) + (j.poste ? ' <span class="al-pos">' + esc(j.poste) + '</span>' : '') + '</td>';
      j.stats.forEach(function(s) { h += '<td>' + esc(s) + '</td>'; });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }).join('');
}

/* Deux onglets (domicile, visiteur) : sur un téléphone, deux colonnes de noms côte à côte
   ne tiennent pas. `actif` est le côté affiché, gardé par l'appelant d'un rafraîchissement
   à l'autre. Le clic sur un onglet est câblé par l'appelant (`data-al-cote`). */
export function alignementsHtml(al, esc, actif) {
  if (!al || !al.equipes || !al.equipes.length) return '';
  var cote = actif && al.equipes.some(function(e) { return e.cote === actif; }) ? actif : al.equipes[0].cote;
  var titre = al.type === 'compo' ? '👥 Alignements' : al.type === 'effectif' ? '👥 Effectif' : '👥 Feuille de match';
  var h = '<div class="al-titre">' + titre + '</div><div class="al-onglets" role="tablist">';
  al.equipes.forEach(function(e) {
    h += '<button type="button" role="tab" class="al-onglet' + (e.cote === cote ? ' actif' : '') + '" data-al-cote="' + e.cote + '" aria-selected="' + (e.cote === cote) + '">'
      + esc(e.equipe || (e.cote === 'home' ? 'Domicile' : 'Visiteur')) + '</button>';
  });
  h += '</div>';
  al.equipes.forEach(function(e) {
    h += '<div class="al-equipe" data-al-cote="' + e.cote + '"' + (e.cote === cote ? '' : ' hidden') + '>'
      + (al.type === 'compo' ? equipeCompoHtml(e, esc) : al.type === 'effectif' ? equipeEffectifHtml(e, esc) : equipeFeuilleHtml(e, esc)) + '</div>';
  });
  return h;
}

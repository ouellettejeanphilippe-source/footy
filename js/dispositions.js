/* Dispositions du Live et du Guide (13 octobre 2026).

   « Ya moyen d'avoir le choix des différents layouts ? » — « Les 4, avec l'actuelle
   toujours comme default ». Quatre façons d'afficher les mêmes matchs, choisies dans
   Options → Disposition, maquettées avec l'utilisateur sur le programme réel du jour :

     tableau     liste de scores groupée par ligue ; Guide : programme en liste, filtrable
     maintenant  une affiche, puis ce qui joue, puis le compte à rebours ; Guide : agenda
     affiches    mur de tuiles aux couleurs des équipes ; Guide : une colonne par heure
     chaines     guide de câblodistributeur, chaînes numérotées ; Guide : grille horaire

   Ce que l'utilisateur a demandé en cours de route, et que ce module tient partout :
   - la hiérarchie : 1. l'état (direct, chrono), 2. le score, 3. les équipes,
     4. une seule action (« Regarder » + nombre de flux), 5. la ligue ;
   - pas de titre ni de sous-titre (« juste le ui ») ;
   - un match en cours n'est JAMAIS placé avant l'heure actuelle dans le Guide (« on
     dirait que c'est passé ») : le Guide commence par ce qui joue, puis ce qui vient,
     heure par heure ; les matchs terminés sont à part, repliés ;
   - pas de dégradé imposé : la couleur suit le réglage « Couleur des cartes ».

   Module SANS IMPORT : il reçoit des fiches déjà préparées (voir `ficheMatch` dans
   js/ui.js) et rend du HTML. Tout ce qui touche l'application (fiche, favoris, minuterie)
   reste dans js/ui.js ; ce module se teste donc sous Node sans DOM.

   Fiche d'un match (champs lus ici) :
     id, ligue, dom, ext, seul (épreuve sans adversaire), logoDom, logoExt
       (logo : { url } | { emoji } | null), cDom, cExt (couleurs), heure 'HH:MM',
     debut (minutes depuis le minuit du jour affiché ; négatif = hier, ≥ 1440 = demain),
     duree, etat ('live' | 'bientot' | 'plus-tard' | 'fin' | 'fin?'), chrono,
     sDom, sExt (score ou null), flux (nombre de liens), fav, jour ('hier' | 'demain' | ''). */

export const DISPOSITIONS = [
  ['actuelle', 'Actuelle'],
  ['tableau', 'Tableau'],
  ['maintenant', 'Maintenant'],
  ['affiches', 'Affiches'],
  ['chaines', 'Chaînes'],
];

export function dispositionValide(v) {
  for (var i = 0; i < DISPOSITIONS.length; i++) if (DISPOSITIONS[i][0] === v) return v;
  return 'actuelle';
}

/* État d'interaction propre aux dispositions : filtres du Tableau, terminés dépliés,
   chaîne choisie. Gardé ici (et non dans S) parce qu'il ne sert qu'au rendu. */
export const etatDisposition = { filtre: 'tout', ligue: 'toutes', termines: false, choix: null };

/* Couleur d'une fiche selon « Couleur des cartes » (userPrefs.cardColor). « home » est le
   « Uni » des maquettes, « dark » le « Neutre ». Le dégradé garde une zone de mélange
   courte au centre (« moins de couleur mitoyenne »). */
export function fondEquipes(f, mode, angle) {
  var a = angle || 135;
  if (mode === 'home') return f.cDom;
  if (mode === 'dark') return 'var(--dsp-neutre)';
  if (mode === 'league') return f.cLigue || f.cDom;
  if (mode === 'split') return 'linear-gradient(' + a + 'deg, ' + f.cDom + ' 50%, ' + f.cExt + ' 50%)';
  return 'linear-gradient(' + a + 'deg, ' + f.cDom + ' 0%, ' + f.cDom + ' 36%, ' + f.cExt + ' 64%, ' + f.cExt + ' 100%)';
}

/* Le Guide d'une disposition : en cours, puis à venir par heure, puis terminés. Jamais un
   match en cours rangé dans le passé. */
export function classerPourGuide(fiches) {
  var enCours = [], aVenir = [], termines = [];
  fiches.forEach(function (f) {
    if (f.etat === 'live') enCours.push(f);
    else if (f.etat === 'fin' || f.etat === 'fin?') termines.push(f);
    else aVenir.push(f);
  });
  var parDebut = function (a, b) { return a.debut - b.debut; };
  enCours.sort(parDebut); aVenir.sort(parDebut); termines.sort(parDebut);
  var heures = [], index = {};
  aVenir.forEach(function (f) {
    var cle = Math.floor(f.debut / 60);
    if (!index[cle]) { index[cle] = { cle: cle, libelle: libelleHeure(cle), fiches: [] }; heures.push(index[cle]); }
    index[cle].fiches.push(f);
  });
  return { enCours: enCours, heures: heures, termines: termines };
}

export function libelleHeure(cle) {
  var h = ((cle % 24) + 24) % 24;
  return (cle >= 24 ? 'Demain ' : cle < 0 ? 'Hier ' : '') + h + ' h';
}

/* Ce qui s'affiche à la place du score : chrono, « dans 5 min », heure, Fin. */
export function etiquetteEtat(f, maintenant) {
  if (f.etat === 'live') return f.chrono || 'Direct';
  if (f.etat === 'fin?') return 'Fin ?';
  if (f.etat === 'fin') return 'Fin';
  if (f.etat === 'bientot' && typeof maintenant === 'number') {
    var d = Math.max(0, Math.round(f.debut - maintenant));
    return d <= 0 ? 'Maintenant' : 'dans ' + d + ' min';
  }
  return (f.jour ? f.jour + ' ' : '') + f.heure;
}

export function progression(f, maintenant) {
  if (f.etat !== 'live' || !f.duree) return 0;
  return Math.max(0, Math.min(1, (maintenant - f.debut) / f.duree));
}

/* Abréviation lisible d'une équipe : le nom du fichier de logo ESPN (mtl.png → MTL)
   quand il existe, sinon les trois premières lettres du premier mot significatif. */
export function abreviation(nom, logo) {
  var u = logo && logo.url ? String(logo.url) : '';
  var m = u.match(/\/(?:scoreboard\/)?([a-z]{2,4})\.png(?:$|\?)/i);
  if (m) return m[1].toUpperCase();
  var mots = String(nom || '').split(/[\s.]+/).filter(function (w) { return w && !/^(FC|CF|AS|RB|SC|AC|CD|SK|FK|SV|1)$/i.test(w); });
  var base = mots[0] || String(nom || '?');
  var lettres = base.normalize ? base.normalize('NFD').replace(/[^A-Za-z]/g, '') : base.replace(/[^A-Za-z]/g, '');
  return (lettres || '?').slice(0, 3).toUpperCase();
}

/* ── Rendu ─────────────────────────────────────────────────────────────────── */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

var I_PLAY = '<svg class="dsp-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
var I_FIND = '<svg class="dsp-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

function logo(l, nom, cls) {
  var c = 'dsp-logo' + (cls ? ' ' + cls : '');
  if (l && l.url) return '<img class="' + c + '" src="' + esc(l.url) + '" alt="" loading="lazy" decoding="async" onerror="this.style.visibility=\'hidden\'">';
  if (l && l.emoji) return '<span class="' + c + ' dsp-emoji" aria-hidden="true">' + esc(l.emoji) + '</span>';
  return '<span class="' + c + ' dsp-ph" aria-hidden="true">' + esc(abreviation(nom, null)) + '</span>';
}
function titre(f) { return esc(f.dom) + (f.seul ? '' : ' – ' + esc(f.ext)); }
function score(f, cote) { return f.sDom == null ? '' : esc(cote === 'd' ? f.sDom : f.sExt); }
function regarder(f, avecMot) {
  return '<button type="button" class="dsp-go' + (f.flux ? '' : ' dsp-go-vide') + '" data-mid="' + esc(f.id) + '" aria-label="'
    + (f.flux ? 'Regarder, ' + f.flux + ' flux' : 'Chercher des liens') + '">'
    + (f.flux ? I_PLAY + (avecMot ? ' <span class="dsp-mot">Regarder</span>' : '') + ' ' + f.flux : I_FIND + (avecMot ? ' <span class="dsp-mot">Chercher</span>' : '')) + '</button>';
}
function etoile(f) { return f.fav ? '<span class="dsp-fav" aria-label="favori">★</span>' : ''; }
function perdant(f, cote) {
  if (f.sDom == null || f.sExt == null || f.sDom === f.sExt) return '';
  var d = Number(f.sDom), e = Number(f.sExt);
  if (isNaN(d) || isNaN(e)) return '';
  return (cote === 'd' ? d < e : e < d) ? ' dsp-perd' : '';
}
function attrs(f) { return 'data-mid="' + esc(f.id) + '" tabindex="0" role="button"'; }
function couleurs(f) { return '--hc:' + esc(f.cDom) + ';--ac:' + esc(f.cExt); }
function boutonTermines(n) {
  return '<button type="button" class="dsp-termines" data-dsp="termines" aria-expanded="' + !!etatDisposition.termines + '">'
    + (etatDisposition.termines ? '▾' : '▸') + ' Terminés · ' + n + '</button>';
}

/* Sections du Live, dans l'ordre de l'application : Favoris, En direct, Dans l'heure. */
function sectionsLive(fiches) {
  var fav = fiches.filter(function (f) { return f.fav; });
  return {
    fav: fav,
    live: fiches.filter(function (f) { return !f.fav && f.etat === 'live'; }),
    bientot: fiches.filter(function (f) { return !f.fav && f.etat !== 'live'; }),
  };
}

/* ── A · Tableau ── */
function liveTableau(fiches, o) {
  var filtre = etatDisposition.filtre;
  var nLive = fiches.filter(function (f) { return f.etat === 'live'; }).length;
  var pool = fiches.filter(function (f) { return filtre === 'live' ? f.etat === 'live' : filtre === 'bientot' ? f.etat !== 'live' : true; });
  var groupes = [];
  var fav = pool.filter(function (f) { return f.fav; });
  if (fav.length) groupes.push(['★ Favoris', fav, true]);
  var parLigue = {}, ordre = [];
  pool.forEach(function (f) { if (!parLigue[f.ligue]) { parLigue[f.ligue] = []; ordre.push(f.ligue); } parLigue[f.ligue].push(f); });
  ordre.forEach(function (l) { groupes.push([l, parLigue[l], false]); });
  var ligne = function (f) {
    return '<div class="dsp-row" ' + attrs(f) + '>'
      + '<div class="dsp-st' + (f.etat === 'live' ? ' dsp-live' : '') + '">' + esc(etiquetteEtat(f, o.maintenant)) + '</div>'
      + '<div class="dsp-tm">' + logo(f.logoDom, f.dom) + '<span class="dsp-n' + perdant(f, 'd') + '">' + esc(f.dom) + etoile(f) + '</span><span class="dsp-s' + perdant(f, 'd') + '">' + score(f, 'd') + '</span>'
      + (f.seul ? '' : logo(f.logoExt, f.ext) + '<span class="dsp-n' + perdant(f, 'e') + '">' + esc(f.ext) + '</span><span class="dsp-s' + perdant(f, 'e') + '">' + score(f, 'e') + '</span>')
      + '</div>' + regarder(f, true) + '</div>';
  };
  var pastille = function (v, lib) { return '<button type="button" data-dsp="filtre" data-v="' + v + '" aria-pressed="' + (filtre === v) + '">' + lib + '</button>'; };
  return '<div class="dsp-filtres">' + pastille('tout', 'Tout · ' + fiches.length) + pastille('live', '<span class="dsp-point"></span>En direct · ' + nLive)
    + pastille('bientot', 'Dans l\'heure · ' + (fiches.length - nLive)) + '</div>'
    + '<div class="dsp-cols">' + groupes.map(function (g) {
      return '<section class="dsp-grp"><div class="dsp-gh' + (g[2] ? ' dsp-gh-fav' : '') + '">' + esc(g[0]) + '<span>' + g[1].length + '</span></div>' + g[1].map(ligne).join('') + '</section>';
    }).join('') + '</div>';
}

function guideTableau(fiches, o) {
  var ligues = [], vu = {};
  fiches.forEach(function (f) { if (!vu[f.ligue]) { vu[f.ligue] = 0; ligues.push(f.ligue); } vu[f.ligue]++; });
  var choix = etatDisposition.ligue;
  if (choix !== 'toutes' && !vu[choix]) choix = 'toutes';
  var c = classerPourGuide(fiches.filter(function (f) { return choix === 'toutes' || f.ligue === choix; }));
  var ligne = function (f) {
    return '<div class="dsp-gr' + (f.etat === 'fin' || f.etat === 'fin?' ? ' dsp-fini' : '') + '" ' + attrs(f) + '>'
      + '<span class="dsp-t">' + (f.etat === 'live' ? '<span class="dsp-point"></span>' : esc((f.jour === 'hier' ? 'hier ' : '') + f.heure)) + '</span>'
      + '<span class="dsp-mm">' + logo(f.logoDom, f.dom) + (f.seul ? '' : logo(f.logoExt, f.ext)) + '<span>' + titre(f) + etoile(f) + '</span></span>'
      + '<span class="dsp-lg">' + esc(f.ligue) + '</span>'
      + '<span class="dsp-stt' + (f.etat === 'live' ? ' dsp-live' : '') + '">' + (f.sDom != null ? '<b>' + score(f, 'd') + '–' + score(f, 'e') + '</b> ' : '') + esc(f.etat === 'plus-tard' ? '' : etiquetteEtat(f, o.maintenant)) + '</span>'
      + (f.etat === 'fin' || f.etat === 'fin?' ? '<span></span>' : regarder(f, false)) + '</div>';
  };
  var out = '';
  if (c.enCours.length) out += '<div class="dsp-hr dsp-live">En cours · ' + c.enCours.length + '</div>' + c.enCours.map(ligne).join('');
  c.heures.forEach(function (h) { out += '<div class="dsp-hr">' + esc(h.libelle) + '</div>' + h.fiches.map(ligne).join(''); });
  if (c.termines.length) out += '<div class="dsp-hr">' + boutonTermines(c.termines.length) + '</div>' + (etatDisposition.termines ? c.termines.map(ligne).join('') : '');
  if (!out) out = '<div class="dsp-vide">Aucun match dans cette ligue.</div>';
  return '<div class="dsp-filtres"><button type="button" data-dsp="ligue" data-v="toutes" aria-pressed="' + (choix === 'toutes') + '">Toutes · ' + fiches.length + '</button>'
    + ligues.map(function (l) { return '<button type="button" data-dsp="ligue" data-v="' + esc(l) + '" aria-pressed="' + (choix === l) + '">' + esc(l) + ' · ' + vu[l] + '</button>'; }).join('')
    + '</div><div class="dsp-prog">' + out + '</div>';
}

/* ── B · Maintenant ── */
function liveMaintenant(fiches, o) {
  var lives = fiches.filter(function (f) { return f.etat === 'live'; });
  var une = lives.filter(function (f) { return f.fav; })[0] || lives.slice().sort(function (a, b) { return b.flux - a.flux; })[0];
  var autres = fiches.filter(function (f) { return f !== une && f.etat === 'live'; });
  var aCote = autres.filter(function (f) { return f.fav; }).concat(autres.filter(function (f) { return !f.fav; }).sort(function (a, b) { return b.flux - a.flux; })).slice(0, 3);
  var reste = autres.filter(function (f) { return aCote.indexOf(f) < 0; }).sort(function (a, b) { return b.flux - a.flux; });
  var bientot = fiches.filter(function (f) { return f.etat !== 'live'; }).sort(function (a, b) { return a.debut - b.debut; });
  var mini = function (f) {
    return '<div class="dsp-mini" style="' + couleurs(f) + ';--fond:' + fondEquipes(f, o.couleurs, 180) + '" ' + attrs(f) + '><span class="dsp-barre"></span><div>'
      + '<div class="dsp-meta">' + (f.etat === 'live' ? '<span class="dsp-live">● ' + esc(etiquetteEtat(f)) + '</span>' : '<span>' + esc(etiquetteEtat(f, o.maintenant)) + '</span>') + '<span>' + esc(f.ligue) + '</span>' + (f.fav ? '<span>★</span>' : '') + '</div>'
      + '<div class="dsp-ln">' + logo(f.logoDom, f.dom) + '<span>' + esc(f.dom) + '</span><b>' + score(f, 'd') + '</b></div>'
      + (f.seul ? '' : '<div class="dsp-ln">' + logo(f.logoExt, f.ext) + '<span>' + esc(f.ext) + '</span><b>' + score(f, 'e') + '</b></div>')
      + '</div><div class="dsp-nflux">' + (f.flux ? I_PLAY + ' ' + f.flux : I_FIND) + '</div></div>';
  };
  var html = '';
  if (une) {
    html += '<h2 class="dsp-h2">En ce moment</h2><div class="dsp-top"><div class="dsp-hero" style="--fond:' + fondEquipes(une, o.couleurs, 110) + '" ' + attrs(une) + '>'
      + '<div class="dsp-side">' + logo(une.logoDom, une.dom) + '</div>' + (une.seul ? '' : '<div class="dsp-side">' + logo(une.logoExt, une.ext) + '</div>')
      + '<div class="dsp-ov"><div class="dsp-who"><span class="dsp-chip"><i></i>' + esc(etiquetteEtat(une)) + '</span><b>' + esc(une.dom) + (une.seul ? '' : '<br>' + esc(une.ext)) + '</b></div>'
      + (une.sDom != null ? '<div class="dsp-sc">' + score(une, 'd') + '–' + score(une, 'e') + '</div>' : '') + regarder(une, true) + '</div></div>'
      + '<div class="dsp-cote">' + aCote.map(mini).join('') + '</div></div>';
  }
  if (reste.length) html += '<h2 class="dsp-h2">En direct</h2><div class="dsp-strip">' + reste.map(mini).join('') + '</div>';
  if (bientot.length) html += '<h2 class="dsp-h2">Commence bientôt</h2><div class="dsp-soon">' + bientot.map(function (f) {
    var dans = Math.max(0, Math.round(f.debut - o.maintenant));
    return '<div class="dsp-cd" ' + attrs(f) + '><div class="dsp-in">' + dans + '<small>min</small></div>'
      + '<div class="dsp-tt">' + logo(f.logoDom, f.dom) + esc(f.dom) + '</div>' + (f.seul ? '' : '<div class="dsp-tt">' + logo(f.logoExt, f.ext) + esc(f.ext) + '</div>')
      + '<div class="dsp-tt dsp-mute">' + esc(f.heure) + ' · ' + esc(f.ligue) + ' · ' + (f.flux ? f.flux + ' flux' : 'pas encore de lien') + '</div></div>';
  }).join('') + '</div>';
  return html;
}

function guideMaintenant(fiches, o) {
  var c = classerPourGuide(fiches);
  var ev = function (f) {
    var p = progression(f, o.maintenant);
    return '<div class="dsp-ev' + (f.etat === 'fin' || f.etat === 'fin?' ? ' dsp-fini' : '') + '" style="--fond:' + fondEquipes(f, o.couleurs) + '" ' + attrs(f) + '>'
      + '<span class="dsp-sw">' + logo(f.logoDom, f.dom) + (f.seul ? '' : logo(f.logoExt, f.ext)) + '</span>'
      + '<div class="dsp-tx"><b>' + titre(f) + etoile(f) + '</b><span>' + (f.etat === 'live' ? '<span class="dsp-live">' + esc(etiquetteEtat(f)) + '</span> · ' : esc(etiquetteEtat(f, o.maintenant)) + ' · ') + esc(f.ligue) + '</span>'
      + (f.etat === 'live' ? '<div class="dsp-pbar"><i style="width:' + Math.round(p * 100) + '%"></i></div>' : '') + '</div>'
      + '<div class="dsp-r">' + (f.sDom != null ? score(f, 'd') + '–' + score(f, 'e') : '') + (f.flux && f.etat !== 'fin' && f.etat !== 'fin?' ? '<small>' + I_PLAY + ' ' + f.flux + '</small>' : '') + '</div></div>';
  };
  var g = '';
  if (c.enCours.length) g += '<div class="dsp-hour dsp-nowh"><b>En cours</b><div>' + c.enCours.map(ev).join('') + '</div></div>';
  c.heures.forEach(function (h) { g += '<div class="dsp-hour"><b>' + esc(h.libelle) + '</b><div>' + h.fiches.map(ev).join('') + '</div></div>'; });
  if (c.termines.length) g += '<div class="dsp-hour dsp-past"><b></b><div>' + boutonTermines(c.termines.length) + (etatDisposition.termines ? c.termines.map(ev).join('') : '') + '</div></div>';
  return '<div class="dsp-ag">' + g + '</div>';
}

/* ── C · Affiches ── */
function liveAffiches(fiches, o) {
  var lives = fiches.filter(function (f) { return f.etat === 'live'; }).sort(function (a, b) { return (b.fav - a.fav) || (b.flux - a.flux); });
  var bientot = fiches.filter(function (f) { return f.etat !== 'live'; }).sort(function (a, b) { return a.debut - b.debut; });
  var tuile = function (f, grande) {
    return '<div class="dsp-t' + (grande ? ' dsp-big' : '') + '" style="--fond:' + fondEquipes(f, o.couleurs) + '" ' + attrs(f) + '>'
      + '<div class="dsp-tl"><span class="dsp-pill dsp-pill-live">● ' + esc(etiquetteEtat(f)) + '</span><span class="dsp-pill">' + esc(f.ligue) + '</span></div>'
      + '<div class="dsp-logos">' + logo(f.logoDom, f.dom) + (f.seul ? '' : logo(f.logoExt, f.ext)) + '</div>'
      + '<div class="dsp-bot">' + (f.sDom != null ? '<span class="dsp-sc">' + score(f, 'd') + '–' + score(f, 'e') + '</span>' : '')
      + '<span class="dsp-nm">' + (grande ? titre(f) : esc(f.abDom) + (f.seul ? '' : ' – ' + esc(f.abExt))) + '</span>'
      + '<span class="dsp-fx">' + (f.flux ? I_PLAY + ' ' + f.flux : I_FIND) + '</span></div></div>';
  };
  var petite = function (f) {
    return '<div class="dsp-t dsp-petite" ' + attrs(f) + '>' + logo(f.logoDom, f.dom) + '<div class="dsp-tx"><b>' + esc(etiquetteEtat(f, o.maintenant)) + '</b>'
      + esc(f.abDom) + (f.seul ? '' : ' – ' + esc(f.abExt)) + ' · ' + esc(f.ligue) + '</div></div>';
  };
  var html = '';
  if (lives.length) html += '<h2 class="dsp-h2">En direct <small>' + lives.length + '</small></h2><div class="dsp-wall">' + lives.map(function (f, i) { return tuile(f, f.fav || i < 3); }).join('') + '</div>';
  if (bientot.length) html += '<h2 class="dsp-h2">Dans l\'heure <small>' + bientot.length + '</small></h2><div class="dsp-wall">' + bientot.map(petite).join('') + '</div>';
  return html;
}

function guideAffiches(fiches, o) {
  var c = classerPourGuide(fiches);
  var tuile = function (f) {
    return '<div class="dsp-gt' + (f.etat === 'fin' || f.etat === 'fin?' ? ' dsp-fini' : '') + '" style="--fond:' + fondEquipes(f, o.couleurs, 180) + '" ' + attrs(f) + '><span class="dsp-stp"></span>'
      + '<div class="dsp-in"><div class="dsp-top2">' + (f.etat === 'live' ? '<span class="dsp-live">● ' + esc(etiquetteEtat(f)) + '</span>' : '<span>' + esc(etiquetteEtat(f, o.maintenant)) + '</span>') + '<span>' + esc(f.ligue) + '</span></div>'
      + '<div class="dsp-ln">' + logo(f.logoDom, f.dom) + '<span>' + esc(f.dom) + '</span><b>' + score(f, 'd') + '</b></div>'
      + (f.seul ? '' : '<div class="dsp-ln">' + logo(f.logoExt, f.ext) + '<span>' + esc(f.ext) + '</span><b>' + score(f, 'e') + '</b></div>') + '</div>'
      + '<span class="dsp-fx">' + (f.flux && f.etat !== 'fin' && f.etat !== 'fin?' ? I_PLAY + ' ' + f.flux : '') + '</span></div>';
  };
  var cols = '';
  if (c.enCours.length) cols += '<div class="dsp-hc dsp-nowh"><b>En cours</b>' + c.enCours.map(tuile).join('') + '</div>';
  c.heures.forEach(function (h) { cols += '<div class="dsp-hc"><b>' + esc(h.libelle) + '</b>' + h.fiches.map(tuile).join('') + '</div>'; });
  if (c.termines.length) cols += '<div class="dsp-hc dsp-past"><b>Terminés</b>' + c.termines.map(tuile).join('') + '</div>';
  return '<div class="dsp-hcols">' + cols + '</div>';
}

/* ── D · Chaînes ── */
function ordreChaines(fiches) {
  var lives = fiches.filter(function (f) { return f.etat === 'live'; });
  return lives.filter(function (f) { return f.fav; }).concat(lives.filter(function (f) { return !f.fav; }).sort(function (a, b) { return b.flux - a.flux; }))
    .concat(fiches.filter(function (f) { return f.etat !== 'live'; }).sort(function (a, b) { return a.debut - b.debut; }));
}
function apercu(f, o) {
  if (!f) return '';
  return '<aside class="dsp-pv"><div class="dsp-art" style="--fond:' + fondEquipes(f, o.couleurs) + '">' + logo(f.logoDom, f.dom) + (f.seul ? '' : logo(f.logoExt, f.ext)) + '</div>'
    + '<div class="dsp-bd"><div class="dsp-mute">' + esc(f.ligue) + ' · ' + esc(f.etat === 'live' ? etiquetteEtat(f) + ' · depuis ' + f.heure : etiquetteEtat(f, o.maintenant)) + '</div>'
    + '<h3>' + esc(f.dom) + (f.seul ? '' : '<br>' + esc(f.ext)) + '</h3>' + (f.sDom != null ? '<div class="dsp-big">' + score(f, 'd') + ' – ' + score(f, 'e') + '</div>' : '')
    + regarder(f, true) + '</div></aside>';
}
function choisi(liste) {
  var id = etatDisposition.choix;
  for (var i = 0; i < liste.length; i++) if (String(liste[i].id) === String(id)) return liste[i];
  return liste[0] || null;
}
function liveChaines(fiches, o) {
  var liste = ordreChaines(fiches);
  var sel = choisi(liste);
  var nLive = liste.filter(function (f) { return f.etat === 'live'; }).length;
  var ch = function (f, i) {
    var p = progression(f, o.maintenant);
    return (i === nLive ? '<div class="dsp-sep">Dans l\'heure</div>' : '')
      + '<div class="dsp-ch' + (f === sel ? ' dsp-sel' : '') + '" data-dsp="choix" data-v="' + esc(f.id) + '" tabindex="0" role="button">'
      + '<span class="dsp-num">' + (i < 9 ? '0' : '') + (i + 1) + '</span><span class="dsp-lg2">' + logo(f.logoDom, f.dom) + (f.seul ? '' : logo(f.logoExt, f.ext)) + '</span>'
      + '<span class="dsp-mid"><span class="dsp-tt">' + titre(f) + '</span><span class="dsp-sub">' + (f.etat === 'live' ? '<span class="dsp-live">● ' + esc(etiquetteEtat(f)) + '</span>' : '<span>' + esc(etiquetteEtat(f, o.maintenant)) + '</span>') + '<span>' + esc(f.ligue) + '</span>' + (f.fav ? '<span>★</span>' : '') + '</span>'
      + (f.etat === 'live' ? '<span class="dsp-pbar"><i style="width:' + Math.round(p * 100) + '%"></i></span>' : '') + '</span>'
      + '<span class="dsp-rt"><span class="dsp-sc">' + (f.sDom != null ? score(f, 'd') + '–' + score(f, 'e') : '') + '</span><span class="dsp-n">' + (f.flux ? f.flux + ' flux' : '—') + '</span></span></div>';
  };
  return '<div class="dsp-lay"><div class="dsp-lst">' + (nLive ? '<div class="dsp-sep">En direct · ' + nLive + '</div>' : '') + liste.map(ch).join('') + '</div>' + apercu(sel, o) + '</div>';
}

/* La grille commence À l'heure actuelle : un match en cours y entre par le bord gauche,
   au lieu d'être dessiné dans le passé. Positions en minutes, converties par le CSS
   (--dsp-px : pixels par minute). */
function guideChaines(fiches, o) {
  var actifs = fiches.filter(function (f) { return f.etat !== 'fin' && f.etat !== 'fin?'; });
  var termines = fiches.filter(function (f) { return f.etat === 'fin' || f.etat === 'fin?'; });
  var debut = Math.floor(o.maintenant / 10) * 10;
  var fin = debut + 60;
  actifs.forEach(function (f) { fin = Math.max(fin, f.debut + f.duree); });
  fin = Math.min(fin, debut + 30 * 60);
  var largeur = fin - debut;
  var ligues = [], par = {};
  actifs.forEach(function (f) { if (!par[f.ligue]) { par[f.ligue] = []; ligues.push(f.ligue); } par[f.ligue].push(f); });
  ligues.sort(function (a, b) {
    var la = par[a].some(function (f) { return f.etat === 'live'; }) ? 0 : 1, lb = par[b].some(function (f) { return f.etat === 'live'; }) ? 0 : 1;
    return la - lb;
  });
  var ordre = [];
  ligues.forEach(function (l) { ordre = ordre.concat(par[l].sort(function (a, b) { return (a.etat !== 'live') - (b.etat !== 'live') || a.debut - b.debut; })); });
  var sel = choisi(ordre);
  var regle = '';
  for (var t = debut; t < fin;) {
    var nx = Math.min(fin, (Math.floor(t / 30) + 1) * 30);
    regle += '<div class="dsp-hh" style="--w:' + (nx - t) + '">' + (t % 60 ? '' : esc(libelleHeure(Math.floor(t / 60)).replace(' h', ':00').replace(/^(Demain|Hier) /, ''))) + '</div>';
    t = nx;
  }
  var lignes = '', ligue = null;
  ordre.forEach(function (f) {
    if (f.ligue !== ligue) { ligue = f.ligue; lignes += '<div class="dsp-lgh">' + esc(ligue) + '</div>'; }
    var x0 = Math.max(f.debut, debut), suite = f.debut < debut;
    var w = Math.min(fin, Math.max(f.debut + f.duree, suite ? x0 + 50 : 0)) - x0;
    lignes += '<div class="dsp-er"><div class="dsp-en">' + logo(f.logoDom, f.dom) + '<span>' + esc(f.abDom) + (f.seul ? '' : ' – ' + esc(f.abExt)) + '</span></div>'
      + '<div class="dsp-lane"><div class="dsp-pg dsp-' + f.etat.replace('?', '') + (suite ? ' dsp-suite' : '') + (f === sel ? ' dsp-sel' : '') + '" data-dsp="choix" data-v="' + esc(f.id) + '" tabindex="0" role="button" style="--a:' + (x0 - debut) + ';--w:' + Math.max(10, w) + '">'
      + '<span class="dsp-lbl">' + (f.sDom != null ? '<b>' + score(f, 'd') + '–' + score(f, 'e') + '</b> · ' : '') + esc(f.etat === 'live' ? etiquetteEtat(f) : f.heure) + ' · ' + titre(f) + '</span></div></div></div>';
  });
  return apercu(sel, o)
    + '<div class="dsp-epg" style="--larg:' + largeur + '"><div class="dsp-epg-in"><div class="dsp-ruler"><div class="dsp-corner"></div>' + regle + '</div>' + lignes
    + '<div class="dsp-nowv" style="--a:' + (o.maintenant - debut) + '"></div></div></div>'
    + (termines.length ? '<div class="dsp-dlist">' + boutonTermines(termines.length) + (etatDisposition.termines ? '<div class="dsp-dl">' + termines.map(function (f) {
      return '<span ' + attrs(f) + '>' + esc(f.heure) + ' · ' + titre(f) + (f.sDom != null ? ' · <b>' + score(f, 'd') + '–' + score(f, 'e') + '</b>' : '') + '</span>';
    }).join('') + '</div>' : '') + '</div>' : '');
}

const RENDUS = {
  tableau: [liveTableau, guideTableau],
  maintenant: [liveMaintenant, guideMaintenant],
  affiches: [liveAffiches, guideAffiches],
  chaines: [liveChaines, guideChaines],
};

/* Point d'entrée : `vue` vaut 'live' ou 'guide'. Rend '' pour « actuelle » (l'appelant
   garde alors son rendu historique). Les abréviations sont calculées ici une fois. */
export function rendreDisposition(nom, vue, fiches, options) {
  var r = RENDUS[nom];
  if (!r) return '';
  var o = Object.assign({ maintenant: 0, couleurs: 'gradient-45' }, options || {});
  fiches.forEach(function (f) { f.abDom = abreviation(f.dom, f.logoDom); f.abExt = abreviation(f.ext, f.logoExt); });
  var corps;
  if (!fiches.length) {
    corps = '<div class="dsp-vide">' + (vue === 'live' ? 'Aucun match en direct pour le moment.' : 'Aucun match au programme.') + '</div>';
  } else {
    corps = (vue === 'live' ? r[0] : r[1])(fiches, o);
  }
  return '<div class="dsp dsp-' + nom + ' dsp-vue-' + vue + ' dsp-c-' + esc(o.couleurs) + '">' + corps + '</div>';
}

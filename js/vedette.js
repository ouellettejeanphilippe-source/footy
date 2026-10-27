/* Le bandeau vedette du Live (27 octobre 2026).

   « Refondre avec des pages plus proches des services de streaming… dans le sens de
   navigation, UX » : comme sur Netflix ou Prime Video, le Live s'ouvre sur UN match mis en
   avant, en grand, avec un seul bouton « Regarder », puis des rangées par ligue. Ce module
   choisit ce match et dessine le bandeau ; il est SANS IMPORT et reçoit des fiches déjà
   préparées (`ficheMatch`, js/ui.js : mêmes champs que js/dispositions.js), donc il se
   teste sous Node sans DOM. Le clic est branché par js/ui.js (data-mid). */

/* Le match à mettre en avant : un favori en direct (le plus de flux), sinon le direct le
   plus fourni en flux, sinon le prochain favori, sinon le prochain match. Null si rien. */
export function choisirVedette(fiches) {
  if (!fiches || !fiches.length) return null;
  var lives = fiches.filter(function (f) { return f.etat === 'live'; });
  var parFlux = function (a, b) { return (b.flux || 0) - (a.flux || 0); };
  var favLive = lives.filter(function (f) { return f.fav; }).sort(parFlux)[0];
  if (favLive) return favLive;
  var live = lives.slice().sort(parFlux)[0];
  if (live) return live;
  var aVenir = fiches.filter(function (f) { return f.etat === 'bientot' || f.etat === 'plus-tard'; })
    .sort(function (a, b) { return a.debut - b.debut; });
  return aVenir.filter(function (f) { return f.fav; })[0] || aVenir[0] || null;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function logo(l, nom) {
  if (l && l.url) return '<img class="vedette-logo" src="' + esc(l.url) + '" alt="" decoding="async" onerror="this.style.visibility=\'hidden\'">';
  return '<span class="vedette-logo vedette-emoji" aria-hidden="true">' + esc(l && l.emoji ? l.emoji : '🛡️') + '</span>';
}

/* L'état en une ligne : « ● Direct 75′ », « dans 12 min », « 20:30 », « Fin ». */
export function etatVedette(f, maintenant) {
  if (f.etat === 'live') return '● ' + (f.chrono && f.chrono !== 'Direct' ? 'Direct · ' + f.chrono : 'Direct');
  if (f.etat === 'fin' || f.etat === 'fin?') return 'Fin';
  if (f.etat === 'bientot' && typeof maintenant === 'number') {
    var d = Math.max(0, Math.round(f.debut - maintenant));
    return d <= 0 ? 'Maintenant' : 'dans ' + d + ' min';
  }
  return (f.jour ? f.jour + ' ' : '') + f.heure;
}

/* Le bandeau : fond aux couleurs des équipes (--v1, --v2), ligue, les deux équipes avec
   leurs logos et le score, l'état, et « Regarder » (data-mid, `data-focus-depart` : c'est
   le premier arrêt de la télécommande, comme sur Netflix). */
export function bandeauVedette(f, maintenant) {
  if (!f) return '';
  var live = f.etat === 'live';
  var score = f.sDom != null && f.sExt != null ? '<span class="vedette-score">' + esc(f.sDom) + ' – ' + esc(f.sExt) + '</span>' : '<span class="vedette-score vedette-vs">–</span>';
  var equipes = f.seul
    ? '<span class="vedette-eq">' + logo(f.logoDom, f.dom) + '<span class="vedette-nom">' + esc(f.dom) + '</span></span>'
    : '<span class="vedette-eq">' + logo(f.logoDom, f.dom) + '<span class="vedette-nom">' + esc(f.dom) + '</span></span>' + score
      + '<span class="vedette-eq">' + logo(f.logoExt, f.ext) + '<span class="vedette-nom">' + esc(f.ext) + '</span></span>';
  return '<section class="vedette' + (live ? ' vedette-live' : '') + '" style="--v1:' + esc(f.cDom) + ';--v2:' + esc(f.cExt) + '" aria-label="À la une">'
    + '<div class="vedette-corps">'
    + '<div class="vedette-ligue">' + (f.drapeau ? '<span>' + esc(f.drapeau) + '</span> ' : '') + esc(f.ligue) + (f.fav ? ' <span class="vedette-fav">★</span>' : '') + '</div>'
    + '<div class="vedette-titre">' + equipes + '</div>'
    + '<div class="vedette-etat' + (live ? ' vedette-direct' : '') + '">' + esc(etatVedette(f, maintenant))
    + (f.flux ? ' <span class="vedette-flux">· ' + f.flux + ' flux</span>' : '') + '</div>'
    + '<div class="vedette-actions"><button type="button" class="vedette-go" data-mid="' + esc(f.id) + '" data-focus-depart>▶ Regarder</button></div>'
    + '</div></section>';
}

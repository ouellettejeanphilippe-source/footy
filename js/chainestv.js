/* La section « Télé » du Live (10 novembre 2026, « Créer section TV ? »).

   Des chaînes de télé qui tournent 24 h sur 24, à côté des matchs : les chaînes canadiennes en
   clair de la liste Free-TV (https://github.com/Free-TV/IPTV, groupe « Canada » : CBC, ICI Télé,
   TVA, Noovo, Télé-Québec…). scripts/chaines_tv.mjs relit la liste une fois par jour et écrit
   data/chaines.json ; ce module l'analyse (côté script), le charge, sonde chaque chaîne depuis
   l'appareil et rend la section avec celles qui répondent (côté page).

   Une chaîne n'est PAS un match : elle n'entre ni dans S.matches, ni dans le Guide, ni dans les
   chaînes du mode câble. Un clic la pose dans le lecteur comme n'importe quel flux direct
   (`openFlux`, js/multiview.js), sous un identifiant `tv_…` qu'aucun match ne porte.

   Sans import. */

/* Ⓖ (bloqué hors du pays), Ⓢ (pas 24 h sur 24), Ⓨ (YouTube) : les marques de Free-TV, retirées du nom. */
var MARQUES = /[Ⓐ-ⓩ]/g;

function attribut(ligne, nom) {
  var m = new RegExp(nom + '="([^"]*)"').exec(ligne);
  return m ? m[1] : '';
}

/* Un manifeste que la page sait jouer elle-même : https (une page https ne lit pas du http), et
   HLS ou DASH d'après l'adresse. Une page YouTube ou un flux sans extension n'en est pas un. */
export function estFluxDeChaine(url) {
  return /^https:\/\/[^\s]+\.(m3u8|mpd)(\?[^\s]*)?$/i.test(String(url || ''));
}

/* Les chaînes d'un groupe d'une liste M3U (`group-title`), dans l'ordre de la liste, sans doublon
   de nom ni d'adresse : [{ id, nom, url, logo }]. */
export function chainesDeListe(texte, groupe) {
  var lignes = String(texte || '').split(/\r?\n/);
  var vues = {}, sortie = [];
  for (var i = 0; i < lignes.length; i++) {
    var l = lignes[i];
    if (l.indexOf('#EXTINF') !== 0 || attribut(l, 'group-title') !== groupe) continue;
    var url = '';
    for (var j = i + 1; j < lignes.length; j++) {
      var s = lignes[j].trim();
      if (!s) continue;
      if (s.charAt(0) !== '#') url = s;
      if (s.indexOf('#EXTINF') === 0 || url) break;
    }
    var virgule = l.lastIndexOf(',');
    var nom = (virgule >= 0 ? l.slice(virgule + 1) : attribut(l, 'tvg-name')).replace(MARQUES, '').replace(/\s+/g, ' ').trim();
    var id = idDeChaine(nom);
    if (!nom || !estFluxDeChaine(url) || vues[id] || vues[url]) continue;
    vues[id] = vues[url] = true;
    var logo = attribut(l, 'tvg-logo');
    sortie.push({ id: id, nom: nom, url: url, logo: /^https:\/\//.test(logo) ? logo : '' });
  }
  return sortie;
}

/* L'identifiant de tuile d'une chaîne : `tv_` + le nom réduit à ses lettres et chiffres. */
export function idDeChaine(nom) {
  return 'tv_' + String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/* Les chaînes lisibles d'un data/chaines.json déjà analysé : la forme est revérifiée, le fichier
   pouvant être vieux ou abîmé. */
export function chainesValides(json) {
  var l = (json && Array.isArray(json.chaines)) ? json.chaines : [];
  return l.filter(function(c) { return c && typeof c.nom === 'string' && c.nom && estFluxDeChaine(c.url); })
    .map(function(c) { return { id: idDeChaine(c.nom), nom: c.nom, url: c.url, logo: /^https:\/\//.test(c.logo || '') ? c.logo : '' }; });
}

/* Le HTML de la section : un titre et une grille de boutons, un par chaîne. `esc` et `escJs` sont
   ceux de js/utils.js, passés par l'appelant (ce module n'importe rien). '' sans chaîne. */
export function sectionTele(chaines, esc, escJs) {
  if (!chaines || !chaines.length) return '';
  var boutons = chaines.map(function(c) {
    var clic = "openFlux(event,'" + escJs(encodeURIComponent(c.url)) + "','" + escJs(encodeURIComponent(c.nom)) + "','" + escJs(c.id) + "',false)";
    return '<button type="button" class="chaine-tv" data-chaine="' + esc(c.id) + '" onclick="' + esc(clic) + '">'
      + (c.logo ? '<img class="chaine-tv-logo" src="' + esc(c.logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '')
      + '<span class="chaine-tv-nom">' + esc(c.nom) + '</span></button>';
  }).join('');
  /* `titre-tele`, pas `section-title` (même allure, styles.css) : ce titre ne se replie pas et
     ne compte pas parmi les sections de matchs que le reste de la page parcourt. */
  return '<div class="titre-tele" id="sectionTele"><span>Télé</span></div>'
    + '<div class="chaines-tv">' + boutons + '</div>';
}

/* Vrai si le manifeste d'une chaîne répond D'ICI, par le chemin que prendra la lecture (un `fetch`
   de la page, donc soumis au CORS comme hls.js et dash.js). « Les streams marchent pas »
   (11 novembre 2026) : mesuré ce jour-là, 4 chaînes sur 14 jouaient ; les autres étaient mortes
   (404), bloquées hors du pays (403), sans en-tête CORS pour le site (Global News renvoie vers
   Pluto, Noovo), ou chiffrées. Seul l'appareil de l'utilisateur sait lesquelles jouent chez lui.
   Un DASH protégé (`ContentProtection`) ne joue pas dans dash.js sans licence : refusé. */
export var DELAI_SONDE_MS = 8000;
export function sonderChaine(c, fetchFn) {
  var opts = { cache: 'no-store' };
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(DELAI_SONDE_MS);
  return Promise.resolve().then(function() { return fetchFn(c.url, opts); })
    .then(function(r) { return r && r.ok ? r.text() : ''; })
    .then(function(t) {
      t = String(t || '').slice(0, 20000);
      return /^\s*#EXTM3U/.test(t) || (/<MPD[\s>]/.test(t) && !/ContentProtection/.test(t));
    })
    .catch(function() { return false; });
}

/* Les chaînes qui répondent, dans l'ordre de la liste ; toutes sondées en même temps. */
export function chainesQuiRepondent(chaines, fetchFn) {
  return Promise.all(chaines.map(function(c) { return sonderChaine(c, fetchFn); }))
    .then(function(ok) { return chaines.filter(function(c, i) { return ok[i]; }); });
}

/* data/chaines.json, lu une fois par session (et relu après un échec), réduit aux chaînes qui
   répondent d'ici. */
var chargement = null;
export function chargerChaines(fetchFn) {
  var f = fetchFn || (typeof fetch === 'function' ? function(u, o) { return fetch(u, o); } : null);
  if (!f) return Promise.resolve([]);
  if (!chargement) {
    chargement = Promise.resolve().then(function() { return f('data/chaines.json'); })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(j) { return chainesQuiRepondent(chainesValides(j), f); })
      .catch(function() { chargement = null; return []; });
  }
  return chargement;
}

/* Oublie le fichier lu (tests). */
export function oublierChaines() { chargement = null; }

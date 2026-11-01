/* La barre radio (1er novembre 2026) : « Ya moyen de partir les streams tunein et cie directement ? »

   « Écouter » dans la fiche lit le flux audio de la station dans un élément <audio>, tout de suite :
   pas de cadre TuneIn, pas de second bouton de lecture (le clic sur « Écouter » est le geste que le
   navigateur exige pour le son). Le flux vient de data/radio.json (scripts/radio_flux.mjs, TuneIn et
   iHeartRadio) ; à défaut, d'iHeartRadio demandé à la volée (son API répond au navigateur). Sans flux,
   ou si le flux échoue, `repli` prend la main : le lecteur d'intégration de TuneIn en tuile, ou le lien.

   Une barre en bas de l'écran (#radio-direct) : le nom, lecture / pause, fermer. Une seule radio à
   la fois. Media Session : les commandes de l'écran verrouillé du téléphone. Cachée dans le lecteur
   quand une tuile exige d'être seule à l'écran (Twitch, `mv-strict`) : le son continue.

   SANS IMPORT : la clé et la lecture des réponses viennent de js/radio.js par les paramètres
   (`adresses`, `lireReponse`), le reste du DOM et de fetch. */

var chargement = null;
var audio = null;
var courant = null;

/* data/radio.json, lu une fois par session (et relu après un échec). */
export function chargerFluxRadio(fetchFn) {
  var f = fetchFn || (typeof fetch === 'function' ? fetch : null);
  if (!f) return Promise.resolve({});
  if (!chargement) {
    chargement = f('data/radio.json').then(function(r) { return r.ok ? r.json() : {}; })
      .then(function(j) { return (j && j.flux) || {}; })
      .catch(function() { chargement = null; return {}; });
  }
  return chargement;
}

/* Oublie data/radio.json lu (tests ; un fichier relu au prochain « Écouter »). */
export function oublierFluxRadio() { chargement = null; }

/* Le flux d'une clé : data/radio.json, sinon l'annuaire interrogé à la volée (iHeartRadio seulement :
   TuneIn refuse l'appel depuis le navigateur). null si rien. */
export function trouverFlux(cle, opts) {
  opts = opts || {};
  return chargerFluxRadio(opts.fetch).then(function(flux) {
    if (flux[cle] && flux[cle].url) return flux[cle];
    if (String(cle).indexOf('iheart:') !== 0 || !opts.adresses || !opts.lireReponse) return null;
    var f = opts.fetch || fetch;
    var urls = opts.adresses(cle);
    var essai = function(k) {
      if (k >= urls.length) return null;
      return f(urls[k]).then(function(r) { return r.ok ? r.json() : null; })
        .then(function(j) { return (j && opts.lireReponse(cle, j)) || essai(k + 1); })
        .catch(function() { return essai(k + 1); });
    };
    return essai(0);
  });
}

/* Un flux HLS ne se lit dans <audio> que là où le navigateur le sait (Safari, Chrome d'Android). */
export function fluxLisible(flux, el) {
  if (!flux || !flux.url) return false;
  if (flux.type !== 'hls') return true;
  return !!(el && el.canPlayType && el.canPlayType('application/vnd.apple.mpegurl'));
}

function barre() {
  var b = document.getElementById('radio-direct');
  if (b) return b;
  b = document.createElement('div');
  b.id = 'radio-direct';
  b.setAttribute('role', 'region');
  b.setAttribute('aria-label', 'Radio');
  b.hidden = true;
  b.innerHTML = '<span class="rd-ico" aria-hidden="true"></span>'
    + '<span class="rd-texte"><span class="rd-nom"></span><span class="rd-etat"></span></span>'
    + '<button type="button" class="rd-lecture" aria-label="Pause"></button>'
    + '<button type="button" class="rd-fermer" aria-label="Arrêter la radio">✕</button>';
  b.querySelector('.rd-lecture').addEventListener('click', function() { basculerRadio(); });
  b.querySelector('.rd-fermer').addEventListener('click', function() { arreterRadio(); });
  document.body.appendChild(b);
  return b;
}

function majBarre(etat) {
  var b = barre();
  if (!courant) { b.hidden = true; document.body.classList.remove('radio-en-cours'); return; }
  b.hidden = false;
  document.body.classList.add('radio-en-cours');
  b.querySelector('.rd-nom').textContent = courant.nom;
  var enPause = !audio || audio.paused;
  b.querySelector('.rd-etat').textContent = etat || (enPause ? 'En pause' : 'En direct');
  var bt = b.querySelector('.rd-lecture');
  bt.textContent = enPause ? '▶' : '❚❚';
  bt.setAttribute('aria-label', enPause ? 'Reprendre' : 'Pause');
  if (courant.icone) b.querySelector('.rd-ico').innerHTML = courant.icone;
}

/* Écouter une station : `s` = { cle, nom, icone? } ; `opts` = { adresses, lireReponse, repli(s),
   fetch? }. Rend une promesse : true si la radio joue dans la barre, false si le repli a servi. */
export function ecouterRadio(s, opts) {
  opts = opts || {};
  var repli = function() { if (typeof opts.repli === 'function') opts.repli(s); return false; };
  if (!audio) {
    audio = new Audio();
    audio.preload = 'none';
    ['playing', 'pause'].forEach(function(ev) { audio.addEventListener(ev, function() { majBarre(); }); });
    audio.addEventListener('waiting', function() { majBarre('Chargement…'); });
  }
  /* Le son doit partir dans le geste : on amorce l'élément tout de suite (Safari et Chrome
     acceptent ensuite un play() qui suit une courte attente réseau). */
  courant = { cle: s.cle, nom: s.nom || 'Radio', icone: s.icone || '' };
  majBarre('Chargement…');
  return trouverFlux(s.cle, opts).then(function(flux) {
    if (!courant || courant.cle !== s.cle) return false;
    if (!fluxLisible(flux, audio)) { courant = null; majBarre(); return repli(); }
    var echec = function() {
      audio.removeEventListener('error', echec);
      if (!courant || courant.cle !== s.cle) return;
      courant = null; audio.removeAttribute('src'); majBarre();
      repli();
    };
    audio.addEventListener('error', echec);
    audio.src = flux.url;
    courant.url = flux.url;
    medias(s.nom);
    var p = audio.play();
    return (p && p.then ? p : Promise.resolve()).then(function() { majBarre(); return true; }, function(e) {
      /* NotAllowedError : le geste a expiré ; la barre reste, ▶ relance. Autre erreur : repli. */
      if (e && e.name === 'NotAllowedError') { majBarre('Touchez ▶ pour écouter'); return true; }
      echec();
      return false;
    });
  });
}

export function basculerRadio() {
  if (!audio || !courant) return;
  if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function() {}); }
  else audio.pause();
  majBarre();
}

export function arreterRadio() {
  if (audio) { audio.pause(); audio.removeAttribute('src'); try { audio.load(); } catch (e) { /* jsdom */ } }
  courant = null;
  majBarre();
}

/* Ce qui joue (tests, journal) : { cle, nom, url, enPause } ou null. */
export function radioEnCours() {
  return courant ? { cle: courant.cle, nom: courant.nom, url: courant.url || '', enPause: !audio || audio.paused } : null;
}

function medias(nom) {
  var ms = typeof navigator !== 'undefined' && navigator.mediaSession;
  if (!ms || typeof MediaMetadata === 'undefined') return;
  try {
    ms.metadata = new MediaMetadata({ title: nom || 'Radio', artist: 'Radio en direct' });
    ms.setActionHandler('play', function() { basculerRadio(); });
    ms.setActionHandler('pause', function() { basculerRadio(); });
    ms.setActionHandler('stop', function() { arreterRadio(); });
  } catch (e) { /* action non prise en charge */ }
}

if (typeof window !== 'undefined') {
  window.radioEnCours = radioEnCours;
  window.arreterRadio = arreterRadio;
}

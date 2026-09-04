/* « Tour de passe-passe » : afficher dans le Multivision une page qui refuse l'iframe.

   Le problème, tel que le navigateur le pose. Un serveur qui répond
   `X-Frame-Options: DENY` (ou `Content-Security-Policy: frame-ancestors 'none'`) fait
   refuser l'affichage par le navigateur lui-même, AVANT que la moindre ligne de
   JavaScript ne s'exécute. Aucun attribut d'iframe, aucun `sandbox`, aucun script de
   page ne peut lever ce refus — c'est vrai dans Firefox comme dans Chrome, et c'est
   pourquoi ces liens (`topLevel`) n'avaient jusqu'ici qu'une issue : un nouvel onglet.

   Le contournement possible, et le seul : ne pas laisser le navigateur charger l'adresse
   dans l'iframe. On récupère le HTML de la page par un autre canal — qui n'est pas
   soumis à `X-Frame-Options`, en-tête qui ne régit QUE l'affichage encadré — puis on
   pose ce HTML dans l'iframe via `srcdoc`. Le document n'a alors plus d'adresse
   distante : il n'y a plus d'en-tête à faire respecter.

   Deux canaux, essayés dans cet ordre :

   1. Le script utilisateur (`multiview-cleaner.user.js` ≥ 1.2, Tampermonkey ou
      Violentmonkey). Il tourne aussi dans la fenêtre principale de l'application et y
      expose un pont : l'application lui demande une page par `postMessage`, il la
      télécharge avec `GM_xmlhttpRequest` (hors politique d'origine croisée, avec les
      cookies de l'utilisateur, donc y compris derrière Cloudflare) et la renvoie.
      C'est le canal fiable, et il fonctionne à l'identique sous Firefox.
   2. À défaut d'extension, les proxys CORS déjà utilisés par `fetchPage`
      (`js/utils.js`). Plus fragile (les proxys tombent, Cloudflare les bloque) mais
      sans rien à installer.

   Deux issues une fois la page en main, dans cet ordre :

   A. **Extraire le lecteur** (`extractPlayers`, js/extractors.js). C'est le cas courant
      et de loin le meilleur : les liens classés « page » sont presque tous des pages de
      match d'agrégateurs, dont tout l'intérêt est le lecteur en `<iframe>` à
      l'intérieur — et ces hôtes de lecteurs, eux, acceptent l'encadrement (relevé
      `hostPolicy` de data/streams.json : embedsports.me, streame.center, tnt-usa.biz,
      dudestream1.com… tous `embeddable: true`). On charge donc cette adresse dans une
      iframe ordinaire : vraie origine, cookies, référent — le lecteur fonctionne comme
      s'il avait été trouvé directement, sans page reconstruite ni bac à sable.
   B. **Reconstruire la page** en `srcdoc`, seulement si aucun lecteur n'en ressort.

   Ce que le tour ne peut pas faire : si la page fabrique son lecteur à partir d'une
   adresse chiffrée (VIPLeague et son `stream.bun.min.js` obfusqué, seule source du
   relevé dans ce cas) ou d'un appel authentifié à son propre domaine, ni l'extraction
   ni la reconstruction n'aboutissent. Le repli reste l'ouverture en onglet.

   Sécurité du document reconstruit. Il est posé dans une iframe `sandbox` SANS
   `allow-same-origin` : son origine est opaque, il ne peut donc lire ni le
   `localStorage` de l'application (préférences, favoris, cache) ni son DOM. C'est
   volontairement plus strict que l'iframe normale du Multivision. En contrepartie
   `localStorage` y lève une exception à la moindre lecture, ce que beaucoup de lecteurs
   ne supportent pas : la cale injectée en tête de document leur en fournit un factice.

   Ce module n'importe que `js/extractors.js`, lui-même hors de tout cycle : le
   téléchargeur de repli (`fetchPage`) et le registre d'intégrabilité lui sont passés en
   argument par js/multiview.js pour qu'il le reste. */

import { extractPlayers, hostOf } from './extractors.js';

var BRIDGE_HELLO = 'mv_bridge_hello';
var BRIDGE_READY = 'mv_bridge_ready';
var BRIDGE_FETCH = 'mv_bridge_fetch';
var BRIDGE_PAGE = 'mv_bridge_page';

var bridge = { available: false, version: null, checked: false };
var pending = {};
var seq = 0;

export function getBridgeStatus() {
  return { available: bridge.available, version: bridge.version, checked: bridge.checked };
}

/* Écoute les réponses du script utilisateur et annonce la présence de l'application.
   Appelée une fois au démarrage ; le script peut répondre plus tard (il s'exécute à
   `document-idle`), d'où la réannonce périodique pendant les premières secondes. */
export function initEmbedBridge() {
  if (typeof window === 'undefined') return;
  if (window.__mvBridgeInit) return;
  window.__mvBridgeInit = true;

  window.addEventListener('message', function (e) {
    var d = e && e.data;
    if (!d || typeof d !== 'object') return;

    if (d.__mvBridge === BRIDGE_READY) {
      bridge.available = true;
      bridge.checked = true;
      bridge.version = d.version || '?';
      window.dispatchEvent(new CustomEvent('mvBridgeReady', { detail: { version: bridge.version } }));
      return;
    }

    if (d.__mvBridge === BRIDGE_PAGE && d.id && pending[d.id]) {
      var p = pending[d.id];
      delete pending[d.id];
      clearTimeout(p.timer);
      if (d.ok && d.html) p.resolve({ html: d.html, finalUrl: d.finalUrl || p.url, via: 'script' });
      else p.reject(new Error(d.error || 'réponse vide du script'));
    }
  });

  var tries = 0;
  var ping = function () {
    if (bridge.available) return;
    window.postMessage({ __mvBridge: BRIDGE_HELLO }, '*');
    if (++tries < 10) setTimeout(ping, 700);
    else bridge.checked = true;
  };
  ping();
}

/* Demande une page au script utilisateur. Rejette si le pont est absent ou muet. */
export function fetchViaBridge(url, timeoutMs) {
  return new Promise(function (resolve, reject) {
    if (!bridge.available) { reject(new Error('script utilisateur absent')); return; }
    var id = 'b' + (++seq) + '_' + Date.now();
    pending[id] = {
      resolve: resolve,
      reject: reject,
      url: url,
      timer: setTimeout(function () {
        delete pending[id];
        reject(new Error('le script utilisateur n\'a pas répondu'));
      }, timeoutMs || 15000)
    };
    window.postMessage({ __mvBridge: BRIDGE_FETCH, id: id, url: url }, '*');
  });
}

/* Cale injectée en tête du document reconstruit, avant tout script du site.
   Elle ne « débloque » rien : elle rend seulement le document viable dans une origine
   opaque (stockage factice) et fait taire les gardes anti-encadrement, qui vident la
   page quand elles constatent `window.top !== window.self`. */
var SHIM = '<script>(function(){' +
  'try{Object.defineProperty(window,"top",{get:function(){return window;},configurable:true});}catch(e){}' +
  'try{Object.defineProperty(window,"parent",{get:function(){return window;},configurable:true});}catch(e){}' +
  'try{Object.defineProperty(window,"frameElement",{get:function(){return null;},configurable:true});}catch(e){}' +
  'var mem=function(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null;},' +
  'setItem:function(k,v){d[k]=String(v);},removeItem:function(k){delete d[k];},clear:function(){d={};},' +
  'key:function(i){return Object.keys(d)[i]||null;},get length(){return Object.keys(d).length;}};};' +
  'try{window.localStorage.getItem("x");}catch(e){try{Object.defineProperty(window,"localStorage",{value:mem(),configurable:true});}catch(e2){}}' +
  'try{window.sessionStorage.getItem("x");}catch(e){try{Object.defineProperty(window,"sessionStorage",{value:mem(),configurable:true});}catch(e2){}}' +
  'window.open=function(){return null;};' +
  '})();<\/script>';

/* Reconstruit un document affichable à partir du HTML téléchargé.
   - `<base href>` : sans lui, toutes les adresses relatives (scripts, lecteur, images)
     pointeraient vers l'application elle-même, et rien ne se chargerait.
   - les balises `<meta http-equiv="Content-Security-Policy">` sont retirées : elles
     s'appliquent au document reconstruit et y interdiraient souvent tout script.
   - la cale ci-dessus est placée en tête, donc avant les scripts du site. */
export function buildEmbedDocument(html, finalUrl) {
  var doc = String(html || '');

  doc = doc.replace(/<meta[^>]+http-equiv\s*=\s*["']?(content-security-policy|x-frame-options)["']?[^>]*>/gi, '');
  doc = doc.replace(/<base\b[^>]*>/gi, '');

  var head = '<base href="' + String(finalUrl || '').replace(/"/g, '&quot;') + '">' + SHIM;

  if (/<head[^>]*>/i.test(doc)) return doc.replace(/<head([^>]*)>/i, '<head$1>' + head);
  if (/<html[^>]*>/i.test(doc)) return doc.replace(/<html([^>]*)>/i, '<html$1><head>' + head + '</head>');
  return '<!doctype html><html><head>' + head + '</head><body>' + doc + '</body></html>';
}

/* En deçà de cette taille, une réponse sans lecteur n'est pas une page de match mais un
   fragment d'erreur de proxy : la reconstruire donnerait une iframe vide. */
export var MIN_REBUILDABLE_LENGTH = 200;

/* Meilleur lecteur intégrable trouvé dans une page téléchargée, ou null.

   Un candidat n'est retenu que s'il est classé `embed` par le moteur (donc jugé
   affichable en iframe) ET hébergé ailleurs que la page elle-même : un lien vers le
   même hôte retomberait sur l'en-tête qui nous a bloqués au départ. */
export function pickEmbeddablePlayer(html, pageUrl, registry) {
  var players;
  try {
    players = extractPlayers(html, pageUrl, { registry: registry, limit: 12 });
  } catch (e) {
    return null;
  }
  var pageHost = hostOf(pageUrl);
  for (var i = 0; i < players.length; i++) {
    if (players[i].kind !== 'embed') continue;
    if (hostOf(players[i].url) === pageHost) continue;
    return players[i];
  }
  return null;
}

/* Point d'entrée du Multivision. Rend :
   - `{ playerUrl }` quand un lecteur intégrable a pu être extrait de la page (cas
     courant, et le seul qui donne une lecture normale : iframe ordinaire, vraie
     origine, cookies, référent) ;
   - `{ srcdoc }` quand la page ne livre pas de lecteur et doit être reconstruite ;
   - `null` si aucun canal n'a abouti.

   `proxyFetch` est `fetchPage` (js/utils.js) et `registry` le registre d'intégrabilité
   (js/scrapers.js), passés en argument pour garder ce module hors du graphe de
   dépendances de l'application. */
export function resolveBlockedEmbed(url, proxyFetch, registry) {
  var attempt = bridge.available
    ? fetchViaBridge(url)
    : Promise.reject(new Error('script utilisateur absent'));

  return attempt.catch(function (bridgeErr) {
    if (typeof proxyFetch !== 'function') throw bridgeErr;
    return proxyFetch(url).then(function (html) {
      if (!html) throw new Error('réponse vide via proxy');
      return { html: html, finalUrl: url, via: 'proxy' };
    });
  }).then(function (res) {
    /* L'extraction passe en premier et sans condition de taille : une page de match
       tient parfois en quelques centaines d'octets et n'en contient pas moins le
       lecteur, qui est tout ce qu'on lui demande. Le plancher ne sert qu'à décider
       si ce qu'on a ramené vaut la peine d'être reconstruit : un fragment d'erreur
       de proxy afficherait sinon une iframe vide sans que l'utilisateur sache que
       le tour a échoué. */
    var player = pickEmbeddablePlayer(res.html, res.finalUrl, registry);
    if (player) return { playerUrl: player.url, label: player.label || '', via: res.via };
    if (String(res.html).length < MIN_REBUILDABLE_LENGTH) throw new Error('page trop courte pour être reconstruite');
    return { srcdoc: buildEmbedDocument(res.html, res.finalUrl), via: res.via };
  }).catch(function () {
    return null;
  });
}

/* Bac à sable du document reconstruit : tout sauf `allow-same-origin`, qui rendrait au
   document l'origine de l'application (donc l'accès à son stockage et à son DOM). */
export var EMBED_SANDBOX = 'allow-scripts allow-forms allow-presentation allow-pointer-lock allow-orientation-lock';

/* Bac à sable des lecteurs ORDINAIRES du Multivision (ceux chargés par `src`, pas les
   documents reconstruits).

   Ce que le script utilisateur faisait à la main dans la page tierce — écraser
   `window.open`, intercepter les clics vers `target="_blank"` — le navigateur le fait ici
   de façon déclarative, pour TOUT LE MONDE : sans extension, sous Firefox comme sous
   Chrome, et à travers l'origine croisée que du JavaScript de l'application ne peut de
   toute façon pas franchir. Le refus vient du navigateur, donc un lecteur ne peut pas le
   contourner en redéfinissant ce qu'on aurait écrasé.

   Ce qui est ACCORDÉ, et pourquoi chaque jeton est nécessaire :
   - `allow-scripts` : les lecteurs sont du JavaScript.
   - `allow-same-origin` : sans lui le document tombe en origine opaque et perd ses
     cookies, son stockage et ses requêtes vers son propre domaine — la plupart des
     lecteurs cessent de fonctionner. Sur une iframe *d'origine croisée* c'est sans
     danger : le couple `allow-scripts` + `allow-same-origin` ne redonne accès qu'à sa
     propre origine, jamais à celle de l'application. (C'est justement pourquoi le
     document RECONSTRUIT, lui, ne l'obtient pas : il vit à notre origine.)
   - `allow-forms`, `allow-pointer-lock`, `allow-orientation-lock`, `allow-presentation` :
     choix de qualité, plein écran et diffusion Chromecast.

   Ce qui est REFUSÉ, et c'est tout l'intérêt :
   - `allow-popups` et `allow-popups-to-escape-sandbox` : plus de popunder publicitaire.
   - `allow-top-navigation*` : un lecteur ne peut plus détourner l'onglet entier vers une
     page de pub — le travers le plus pénible de ces sites.
   - `allow-modals` : plus d'`alert()` bloquante venue d'une régie. */
export var PLAYER_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-orientation-lock';

/* ─── Levée du bac à sable, par domaine ──────────────────────────────────────────────
   Certains hôtes REFUSENT de jouer dans une iframe en bac à sable et affichent à la
   place « SANDBOX IFRAME NOT ALLOWED » (relevé le 4 septembre 2026 sur la chaîne
   tnt-sports.shop, sous Firefox). Le refus vient d'un script de la page imbriquée : rien
   de lisible depuis l'application, qui n'a aucun accès au contenu d'une origine croisée.
   La détection automatique est donc impossible — mais la levée, elle, est triviale.

   D'où ce choix : le bac à sable reste posé par défaut, et l'utilisateur le lève d'un
   geste sur la tuile concernée. Le domaine est retenu, la levée vaut donc une fois pour
   toutes. C'est un compromis assumé : sur ce domaine, les fenêtres surgissantes et le
   détournement d'onglet redeviennent possibles. */
var SANDBOX_EXEMPT_KEY = 'playerSandboxExceptions';

/* Adresse ABSOLUE exigée : sans base, une chaîne quelconque ne devient pas une adresse.
   Résoudre contre `location` ferait porter la levée sur le domaine de l'application
   elle-même, où elle n'a aucun sens — et une adresse relative désigne de toute façon la
   même origine, donc une iframe que le bac à sable ne gêne pas. */
export function sandboxHost(url) {
    try { return new URL(String(url)).hostname.replace(/^www\./, '').toLowerCase(); }
    catch (e) { return ''; }
}

function lireExceptions() {
    try {
        var brut = localStorage.getItem(SANDBOX_EXEMPT_KEY);
        var lu = brut ? JSON.parse(brut) : null;
        return (lu && typeof lu === 'object') ? lu : {};
    } catch (e) { return {}; }
}

export function isSandboxExempt(url) {
    var h = sandboxHost(url);
    return !!(h && lireExceptions()[h]);
}

/* Bascule la levée pour le domaine de `url`. Rend le nouvel état (true = sans bac à
   sable). Sans domaine lisible, rien à retenir : on ne fait rien. */
export function toggleSandboxException(url) {
    var h = sandboxHost(url);
    if (!h) return false;
    var ex = lireExceptions();
    var neuf = !ex[h];
    if (neuf) ex[h] = true; else delete ex[h];
    try { localStorage.setItem(SANDBOX_EXEMPT_KEY, JSON.stringify(ex)); } catch (e) {}
    return neuf;
}

/* Bac à sable à poser pour cette adresse, ou `null` s'il faut n'en poser aucun. */
export function playerSandboxFor(url, prefActive) {
    if (prefActive === false) return null;
    return isSandboxExempt(url) ? null : PLAYER_SANDBOX;
}

if (typeof window !== 'undefined') {
  window.getBridgeStatus = getBridgeStatus;
  window.resolveBlockedEmbed = resolveBlockedEmbed;
  window.pickEmbeddablePlayer = pickEmbeddablePlayer;
  window.toggleSandboxException = toggleSandboxException;
  window.isSandboxExempt = isSandboxExempt;
}

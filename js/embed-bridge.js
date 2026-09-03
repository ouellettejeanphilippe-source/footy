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

   Ce que le tour ne peut pas faire, et qu'il ne faut pas promettre : si la page ne
   contient pas le lecteur mais le fabrique à partir d'une adresse chiffrée ou d'un
   appel authentifié à son propre domaine, le document reconstruit affichera une page
   vide. Le repli reste l'ouverture en onglet, proposée dans l'interface.

   Sécurité du document reconstruit. Il est posé dans une iframe `sandbox` SANS
   `allow-same-origin` : son origine est opaque, il ne peut donc lire ni le
   `localStorage` de l'application (préférences, favoris, cache) ni son DOM. C'est
   volontairement plus strict que l'iframe normale du Multivision. En contrepartie
   `localStorage` y lève une exception à la moindre lecture, ce que beaucoup de lecteurs
   ne supportent pas : la cale injectée en tête de document leur en fournit un factice.

   Module sans dépendance (comme js/fetcher.js et js/extractors.js) : le téléchargeur de
   repli lui est passé en argument par js/multiview.js. */

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

/* Point d'entrée du Multivision : rend le document à poser dans `srcdoc`, ou null si
   aucun canal n'a abouti. `proxyFetch` est `fetchPage` (js/utils.js), passé en argument
   pour garder ce module hors du graphe de dépendances de l'application. */
export function resolveBlockedEmbed(url, proxyFetch) {
  var attempt = bridge.available
    ? fetchViaBridge(url)
    : Promise.reject(new Error('script utilisateur absent'));

  return attempt.catch(function (bridgeErr) {
    if (typeof proxyFetch !== 'function') throw bridgeErr;
    return proxyFetch(url).then(function (html) {
      if (!html || String(html).length < 200) throw new Error('page vide via proxy');
      return { html: html, finalUrl: url, via: 'proxy' };
    });
  }).then(function (res) {
    return { srcdoc: buildEmbedDocument(res.html, res.finalUrl), via: res.via };
  }).catch(function () {
    return null;
  });
}

/* Bac à sable du document reconstruit : tout sauf `allow-same-origin`, qui rendrait au
   document l'origine de l'application (donc l'accès à son stockage et à son DOM). */
export var EMBED_SANDBOX = 'allow-scripts allow-forms allow-presentation allow-pointer-lock allow-orientation-lock';

if (typeof window !== 'undefined') {
  window.getBridgeStatus = getBridgeStatus;
  window.resolveBlockedEmbed = resolveBlockedEmbed;
}

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

   Sécurité du document reconstruit. Il n'a plus de bac à sable depuis le 5 septembre
   2026 : les sites le détectaient et refusaient de jouer (« Sandbox detected, please
   remove sandbox attributes »). Il vit donc à l'origine de l'application et peut lire
   son `localStorage` (réglages et cache de matchs — aucun identifiant, aucun jeton) et
   son DOM. C'est le prix assumé pour que la vidéo s'affiche ; popups et détournement
   d'onglet restent bloqués par `multiview-cleaner.user.js` pour qui l'installe.

   Ce module n'importe que `js/extractors.js`, lui-même hors de tout cycle : le
   téléchargeur de repli (`fetchPage`) et le registre d'intégrabilité lui sont passés en
   argument par js/multiview.js pour qu'il le reste. */

import { extractPlayers, hostOf, JUNK_HOST_RE, BETTING_RE, ASSET_RE } from './extractors.js';

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

/* Cale injectée en tête du document reconstruit, avant tout script du site. Elle fait
   deux choses : taire les gardes anti-encadrement (qui vident la page dès qu'elles
   constatent `window.top !== window.self`), et reconstruire à leur tour les iframes
   imbriquées — sans quoi X-Frame-Options reprend la main un cran plus bas. */
/* Profondeur maximale de reconstruction imbriquée. Trois niveaux couvrent les chaînes
   observées (page de match → lecteur → lecteur du lecteur) sans risquer de partir en
   cascade sur une page qui s'auto-référence. */
export var MAX_PROFONDEUR_RECONSTRUCTION = 3;

/* Nombre d'iframes reconstruites par document. Une page de streaming en compte souvent
   une dizaine, dont une seule porte la vidéo : les autres sont des régies. Sans ce
   plafond, une seule tuile déclencherait dix téléchargements par le pont. */
var MAX_IFRAMES_PAR_DOC = 4;

var SHIM = '<script>(function(){' +
  /* Le vrai parent est capturé AVANT d'être masqué : les lignes suivantes font croire à
     la page qu'elle est au premier plan (c'est ce qui fait taire ses gardes
     anti-encadrement), mais la reconstruction imbriquée, elle, a besoin du vrai. */
  'var P=null; try{P=window.parent;}catch(e){}' +
  'try{Object.defineProperty(window,"top",{get:function(){return window;},configurable:true});}catch(e){}' +
  'try{Object.defineProperty(window,"parent",{get:function(){return window;},configurable:true});}catch(e){}' +
  'try{Object.defineProperty(window,"frameElement",{get:function(){return null;},configurable:true});}catch(e){}' +
  'var mem=function(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null;},' +
  'setItem:function(k,v){d[k]=String(v);},removeItem:function(k){delete d[k];},clear:function(){d={};},' +
  'key:function(i){return Object.keys(d)[i]||null;},get length(){return Object.keys(d).length;}};};' +
  'try{window.localStorage.getItem("x");}catch(e){try{Object.defineProperty(window,"localStorage",{value:mem(),configurable:true});}catch(e2){}}' +
  'try{window.sessionStorage.getItem("x");}catch(e){try{Object.defineProperty(window,"sessionStorage",{value:mem(),configurable:true});}catch(e2){}}' +
  'window.open=function(){return null;};' +

  /* ── Reconstruction des iframes IMBRIQUÉES ──────────────────────────────────
     Recopier la page à notre origine supprime le cadre étranger du premier niveau,
     donc X-Frame-Options ne s'y applique plus. Mais si cette page contient elle-même
     une iframe vers son lecteur, CETTE iframe-là redevient d'origine croisée, et
     l'en-tête reprend le dessus : c'est l'écran « Firefox Can't Open This Page » qui
     revient un cran plus bas.

     On applique donc le même remède à chaque niveau : on demande au parent (même
     origine que ce document) d'aller chercher la page imbriquée — par le pont du
     script utilisateur quand il est là, sinon par les proxys — et on l'inline à son
     tour. Aucune origine étrangère n'est alors encadrée nulle part dans la chaîne,
     et l'en-tête n'a plus de prise.

     Ce que cela ne règle pas : les segments vidéo partiront avec NOTRE origine en
     référent. Les CDN qui vérifient le référent refuseront encore — aucun script ne
     peut réécrire cet en-tête depuis un navigateur. */
  'var prof=(window.__mvProfondeur||0), faites=0;' +
  'function absolu(u){try{return new URL(u,document.baseURI).href;}catch(e){return null;}}' +
  'function reconstruire(f){' +
    'if(!P||faites>=' + MAX_IFRAMES_PAR_DOC + '||prof>=' + MAX_PROFONDEUR_RECONSTRUCTION + ')return;' +
    'if(f.__mvVue)return; var s=f.getAttribute("src"); if(!s)return;' +
    'var u=absolu(s); if(!u||!/^https?:/i.test(u))return;' +
    'try{if(!P.__mvIframeReconstructible(u))return;}catch(e){return;}' +
    'f.__mvVue=1; faites++;' +
    'try{P.__mvReconstruireIframe(u,prof+1).then(function(doc){' +
      'if(!doc)return; try{f.removeAttribute("src"); f.srcdoc=doc;}catch(e){}' +
    '}).catch(function(){});}catch(e){}' +
  '}' +
  'function balayer(){var l=document.getElementsByTagName("iframe");for(var i=0;i<l.length;i++)reconstruire(l[i]);}' +
  'if(P&&P.__mvReconstruireIframe){balayer();' +
    'try{new MutationObserver(balayer).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["src"]});}catch(e){}' +
    'document.addEventListener("DOMContentLoaded",balayer);' +
    'setTimeout(balayer,1500);}' +
  '})();<\/script>';

/* Reconstruit un document affichable à partir du HTML téléchargé.
   - `<base href>` : sans lui, toutes les adresses relatives (scripts, lecteur, images)
     pointeraient vers l'application elle-même, et rien ne se chargerait.
   - les balises `<meta http-equiv="Content-Security-Policy">` sont retirées : elles
     s'appliquent au document reconstruit et y interdiraient souvent tout script.
   - la cale ci-dessus est placée en tête, donc avant les scripts du site. */
export function buildEmbedDocument(html, finalUrl, profondeur) {
  var doc = String(html || '');

  doc = doc.replace(/<meta[^>]+http-equiv\s*=\s*["']?(content-security-policy|x-frame-options)["']?[^>]*>/gi, '');
  doc = doc.replace(/<base\b[^>]*>/gi, '');

  /* La profondeur voyage AVEC le document : c'est elle qui arrête la cascade, puisque
     chaque niveau reconstruit le suivant sans rien savoir de ceux d'au-dessus. */
  var niveau = '<script>window.__mvProfondeur=' + (parseInt(profondeur, 10) || 0) + ';<\/script>';
  var head = '<base href="' + String(finalUrl || '').replace(/"/g, '&quot;') + '">' + niveau + SHIM;

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
/* Le pont d'abord, les proxys ensuite : les deux seuls canaux qui ne subissent pas
   X-Frame-Options, puisqu'ils ne font que TÉLÉCHARGER la page. Extrait ici parce que la
   reconstruction imbriquée en a besoin exactement comme le tour de premier niveau. */
export function recupererPage(url, proxyFetch) {
  var attempt = bridge.available
    ? fetchViaBridge(url)
    : Promise.reject(new Error('script utilisateur absent'));

  return attempt.catch(function (bridgeErr) {
    if (typeof proxyFetch !== 'function') throw bridgeErr;
    return proxyFetch(url).then(function (html) {
      if (!html) throw new Error('réponse vide via proxy');
      return { html: html, finalUrl: url, via: 'proxy' };
    });
  });
}

/* Faut-il reconstruire cette iframe imbriquée ? Une page de streaming en aligne souvent
   une dizaine, dont une seule porte la vidéo : sans ce filtre on téléchargerait aussi
   les régies publicitaires et les fenêtres de discussion, par le pont, à chaque tuile.
   On réutilise les listes du moteur d'extraction plutôt que d'en tenir une seconde. */
export function iframeReconstructible(url) {
  var u = String(url || '');
  if (!/^https?:/i.test(u)) return false;
  if (BETTING_RE.test(u) || ASSET_RE.test(u)) return false;
  var h = hostOf(u);
  if (!h || JUNK_HOST_RE.test(h)) return false;
  return true;
}

/* Passerelle offerte aux documents reconstruits : ils vivent à NOTRE origine, ils
   peuvent donc nous appeler directement, sans postMessage.

   C'est ce qui referme la dernière porte laissée à X-Frame-Options. Recopier une page
   bloquée la sort de son origine, mais l'iframe qu'elle contient, elle, reste distante :
   l'en-tête s'y applique de nouveau et l'écran « Firefox Can't Open This Page » revient
   un cran plus bas. En reconstruisant aussi les niveaux imbriqués, plus aucune origine
   étrangère n'est encadrée dans la chaîne — donc plus aucun en-tête à faire respecter.

   Rien à installer pour en profiter : le pont du script utilisateur rend le
   téléchargement plus fiable (IP de l'utilisateur, cookies, Cloudflare franchi), mais à
   défaut les proxys CORS font le même travail. */
export function installerReconstructionRecursive(proxyFetch) {
  if (typeof window === 'undefined') return;
  window.__mvIframeReconstructible = iframeReconstructible;
  window.__mvReconstruireIframe = function (url, profondeur) {
    var prof = parseInt(profondeur, 10) || 0;
    if (prof >= MAX_PROFONDEUR_RECONSTRUCTION) return Promise.resolve(null);
    if (!iframeReconstructible(url)) return Promise.resolve(null);
    return recupererPage(url, proxyFetch).then(function (res) {
      if (!res || !res.html || String(res.html).length < MIN_REBUILDABLE_LENGTH) return null;
      return buildEmbedDocument(res.html, res.finalUrl, prof);
    }).catch(function () { return null; });
  };
}

export function resolveBlockedEmbed(url, proxyFetch, registry) {
  return recupererPage(url, proxyFetch).then(function (res) {
    /* L'extraction passe en premier et sans condition de taille : une page de match
       tient parfois en quelques centaines d'octets et n'en contient pas moins le
       lecteur, qui est tout ce qu'on lui demande. Le plancher ne sert qu'à décider
       si ce qu'on a ramené vaut la peine d'être reconstruit : un fragment d'erreur
       de proxy afficherait sinon une iframe vide sans que l'utilisateur sache que
       le tour a échoué. */
    var player = pickEmbeddablePlayer(res.html, res.finalUrl, registry);
    if (player) return { playerUrl: player.url, label: player.label || '', via: res.via };
    if (String(res.html).length < MIN_REBUILDABLE_LENGTH) throw new Error('page trop courte pour être reconstruite');
    return { srcdoc: buildEmbedDocument(res.html, res.finalUrl, 0), via: res.via };
  }).catch(function () {
    return null;
  });
}

/* PLUS AUCUN attribut `sandbox` n'est posé sur une iframe de lecteur, nulle part.

   Retiré en deux temps le 5 septembre 2026, sur demande répétée de l'utilisateur
   (« quand y'a le tag sandbox, ça chie »). D'abord sur les lecteurs ORDINAIRES (ceux
   chargés par `src`) : beaucoup de ces sites détectent une iframe en bac à sable —
   quels que soient les jetons accordés — et refusent de s'afficher ou de jouer.

   Puis sur le document RECONSTRUIT en `srcdoc`, qu'on avait cru à l'abri : « rien, côté
   site distant, ne peut détecter ce bac à sable puisqu'il ne s'agit pas de SA page mais
   d'une copie ». C'était faux, et une capture d'écran l'a démenti — « Sandbox detected,
   please remove sandbox attributes », en rouge, à la place du lecteur. La copie contient
   SON code : il s'exécute ici et voit l'origine opaque, le localStorage qui lève, et
   l'attribut lui-même sur `frameElement`. Seule son ABSENCE passe.

   Le prix, assumé : un document reconstruit vit à l'origine de l'application et peut
   donc lire son localStorage (réglages et cache de matchs — aucun identifiant, aucun
   jeton) et son DOM.

   La protection contre les popups et le détournement d'onglet reste assurée par
   `multiview-cleaner.user.js` pour qui l'installe (il tourne DANS la page tierce, ce que
   l'application ne peut pas faire depuis une origine croisée). Sans ce script, ces
   lecteurs retrouvent le comportement d'avant : capables d'ouvrir une fenêtre ou de
   détourner l'onglet, comme n'importe quel lien externe ouvert dans un onglet normal. */

/* La levée du bac à sable par domaine (bouton 🛡️/🔓 sur chaque tuile) a été retirée le
   5 septembre 2026, à la demande de l'utilisateur : « sandbox chié toujours » — le geste
   ne réglait rien, puisque le refus vient d'un script de la page imbriquée qu'on ne peut
   pas lire depuis l'application, donc pas davantage contourner en levant le bac à sable
   que sans. La vraie réponse aux pages qui refusent l'iframe est ailleurs : extraire
   l'adresse du flux vidéo brut (.m3u8, .mp4…) et la jouer dans un `<video>` natif, qui
   n'encadre rien et n'a donc aucun bac à sable à poser (voir js/multiview.js). */

if (typeof window !== 'undefined') {
  window.getBridgeStatus = getBridgeStatus;
  window.resolveBlockedEmbed = resolveBlockedEmbed;
  window.pickEmbeddablePlayer = pickEmbeddablePlayer;
}

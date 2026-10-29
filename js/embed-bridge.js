/* Le pont avec le script utilisateur (multiview-cleaner.user.js) et l'extension.

   Le script tourne aussi dans la fenêtre principale de l'application et y expose un pont :
   l'application lui demande une page par `postMessage` (`fetchViaBridge`), il la
   télécharge avec `GM_xmlhttpRequest` (hors politique d'origine croisée, avec les cookies
   de l'utilisateur, donc y compris derrière Cloudflare) et la renvoie ; ou des octets avec
   un `Referer` choisi (`lireOctetsViaPont`, le mode direct).

   La reconstruction en `srcdoc` d'une page qui refuse l'iframe (« tour de passe-passe »,
   `resolveBlockedEmbed`, `buildEmbedDocument`, `pickEmbeddablePlayer`) n'avait plus
   d'appelant depuis la refonte du lecteur ; seuls ses tests la gardaient. Retirée le
   29 octobre 2026, à la demande de l'utilisateur (« supprimer fonctions mortes »).

   Ce module est sans import. */


var BRIDGE_HELLO = 'mv_bridge_hello';
var BRIDGE_READY = 'mv_bridge_ready';
var BRIDGE_FETCH = 'mv_bridge_fetch';
var BRIDGE_PAGE = 'mv_bridge_page';

var bridge = { available: false, version: null, checked: false, binaire: false };
var pending = {};
var seq = 0;

export function getBridgeStatus() {
  return { available: bridge.available, version: bridge.version, checked: bridge.checked, binaire: bridge.binaire };
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
      bridge.binaire = d.binaire === true;
      window.dispatchEvent(new CustomEvent('mvBridgeReady', { detail: { version: bridge.version } }));
      return;
    }

    if (d.__mvBridge === BRIDGE_PAGE && d.id && pending[d.id]) {
      var p = pending[d.id];
      delete pending[d.id];
      clearTimeout(p.timer);
      if (p.binaire) {
        if (d.ok && d.octets && typeof d.octets.byteLength === 'number') {
          p.resolve({ octets: d.octets, status: d.status, finalUrl: d.finalUrl || p.url });
        } else {
          var err = new Error(d.error || 'réponse vide du script');
          err.status = d.status | 0;
          err.delai = !!d.delai;
          p.reject(err);
        }
        return;
      }
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

/* Attend que le script utilisateur se soit annoncé, au plus `maxMs` millisecondes.
   Rend true si le pont est là. Au démarrage, la décision « le navigateur va-t-il chercher
   les liens lui-même ? » se prend avant que le script (exécuté à document-idle) ait pu
   répondre : sans cette attente, le premier chargement se croyait toujours sans pont. */
export function waitForBridge(maxMs) {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (bridge.available) return Promise.resolve(true);
  return new Promise(function (resolve) {
    var fini = false;
    var finir = function (ok) { if (fini) return; fini = true; window.removeEventListener('mvBridgeReady', surPret); resolve(ok); };
    var surPret = function () { finir(true); };
    window.addEventListener('mvBridgeReady', surPret);
    setTimeout(function () { finir(bridge.available); }, maxMs || 1500);
  });
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

/* Lit une ressource en binaire par le script utilisateur (≥ 1.14, sous un vrai
   gestionnaire de scripts), avec le `Referer` et l'`Origin` voulus et sans CORS. C'est
   ce que demande le mode direct (js/directmedia.js, `chargeurParPont`) : les CDN des
   flux refusent l'origine de l'application. Rend { octets, status, finalUrl } ; l'erreur
   porte `status` et `delai`. */
export function lireOctetsViaPont(url, options) {
  var o = options || {};
  return new Promise(function (resolve, reject) {
    if (!bridge.available || !bridge.binaire) { reject(new Error('lecture binaire du script absente')); return; }
    var id = 'o' + (++seq) + '_' + Date.now();
    var delaiMs = o.timeoutMs || 20000;
    pending[id] = {
      binaire: true,
      resolve: resolve,
      reject: reject,
      url: url,
      /* Le script a son propre délai : on lui laisse le temps de le dire. */
      timer: setTimeout(function () {
        delete pending[id];
        var err = new Error('le script utilisateur n\'a pas répondu');
        err.delai = true;
        reject(err);
      }, delaiMs + 2000)
    };
    window.postMessage({
      __mvBridge: BRIDGE_FETCH, id: id, url: url, binaire: true,
      referer: o.referer || '', origine: o.origine || '', plage: o.plage || '', timeout: delaiMs
    }, '*');
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
}

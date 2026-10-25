/* Le relais, dans la fenêtre principale de l'application seulement (manifest.json ne
   le pose que sur ses adresses, jamais dans un cadre).

   nettoyeur.js tourne dans le monde de la page : il n'a pas accès à `chrome.runtime`.
   Ce script-ci, dans le monde isolé de l'extension, y a accès. Il fait passer :
     - l'annonce « l'application est ouverte dans cet onglet », qui lève le refus
       d'encadrement pour les tuiles de cet onglet (fond.js) ;
     - les demandes du pont (`GM_xmlhttpRequest` du script utilisateur), en texte ou en
       binaire. Les octets arrivent de fond.js en base64 (la messagerie des extensions
       ne passe que du JSON) et repartent vers la page en ArrayBuffer, transféré. */
(function () {
  'use strict';

  try { chrome.runtime.sendMessage({ type: 'application' }); } catch (e) {}

  function versOctets(b64) {
    if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(b64).buffer;
    var bin = atob(b64), octets = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
    return octets.buffer;
  }

  window.addEventListener('message', function (e) {
    if (e.source !== window) return;
    var d = e.data;
    if (!d || typeof d !== 'object' || d.__footyExt !== 'requete' || !d.id) return;
    var repondre = function (rep) {
      var r = rep || { erreur: (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'sans réponse' };
      var transfert = [];
      if (typeof r.octets64 === 'string') {
        try { r.octets = versOctets(r.octets64); transfert.push(r.octets); }
        catch (err) { r = { erreur: 'octets illisibles' }; }
        delete r.octets64;
      }
      r.__footyExt = 'reponse';
      r.id = d.id;
      window.postMessage(r, '*', transfert);
    };
    try {
      chrome.runtime.sendMessage({ type: 'page', url: d.url, method: d.method, timeout: d.timeout, binaire: d.binaire === true, entetes: d.entetes }, repondre);
    } catch (err) {
      repondre({ erreur: String(err && err.message || err) });
    }
  });
})();

/* Le service worker de l'extension. Deux rôles, demandés par relais.js depuis
   l'onglet de l'application, et par lui seul :

   1. Lever le refus d'encadrement DANS CET ONGLET. Un lecteur qui répond
      `X-Frame-Options: DENY` ou `Content-Security-Policy: frame-ancestors …` est
      refusé par le navigateur avant tout JavaScript. On retire ces deux en-têtes des
      réponses de cadre (`sub_frame`), et seulement dans les onglets où l'application
      s'est annoncée : ailleurs, la protection contre l'encadrement reste intacte.
      C'est ce que faisait l'extension « Ignore X-Frame-Options Header », bornée ici à
      l'application.

   2. Le pont : lire une page d'une source avec les cookies du visiteur, là où les
      proxys CORS sont refusés. C'est `GM_xmlhttpRequest` du script utilisateur ;
      nettoyeur.js le demande par relais.js, qui ne tourne que sur les adresses de
      l'application. */

'use strict';

var REGLE_CADRES = 1;
var MAX_OCTETS = 4 * 1024 * 1024;
var HOTES_APPLICATION = ['127.0.0.1', 'localhost', 'ouellettejeanphilippe-source.github.io'];

/* Les mises à jour de la règle se suivent : deux onglets qui s'annoncent ensemble
   liraient la même liste et le second effacerait le premier. */
var file = Promise.resolve();

function majCadres(ajout, retrait) {
  file = file.then(function () {
    return chrome.declarativeNetRequest.getSessionRules().then(function (regles) {
      var onglets = new Set();
      regles.forEach(function (r) {
        if (r.id === REGLE_CADRES) (r.condition.tabIds || []).forEach(function (t) { onglets.add(t); });
      });
      if (ajout != null) {
        if (onglets.has(ajout)) return;
        onglets.add(ajout);
      }
      if (retrait != null) {
        if (!onglets.has(retrait)) return;
        onglets.delete(retrait);
      }
      var nouvelles = onglets.size ? [{
        id: REGLE_CADRES,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            { header: 'x-frame-options', operation: 'remove' },
            { header: 'content-security-policy', operation: 'remove' }
          ]
        },
        condition: { tabIds: Array.from(onglets), resourceTypes: ['sub_frame'] }
      }] : [];
      return chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [REGLE_CADRES], addRules: nouvelles });
    });
  }).catch(function (e) { console.warn('[Guide des Sports] règle des cadres :', e && e.message); });
  return file;
}

chrome.tabs.onRemoved.addListener(function (tabId) { majCadres(null, tabId); });

function lirePage(m) {
  var url = String(m.url || '');
  if (!/^https?:\/\//i.test(url)) return Promise.resolve({ erreur: 'adresse invalide' });
  var delai = Math.min(Math.max(Number(m.timeout) || 15000, 1000), 60000);
  return fetch(url, {
    method: m.method === 'HEAD' ? 'HEAD' : 'GET',
    credentials: 'include',
    redirect: 'follow',
    signal: AbortSignal.timeout(delai)
  }).then(function (r) {
    return r.text().then(function (texte) {
      if (texte.length > MAX_OCTETS) texte = texte.slice(0, MAX_OCTETS);
      return { status: r.status, statusText: r.statusText, responseText: texte, finalUrl: r.url };
    });
  }).catch(function (e) {
    var nom = e && e.name;
    return { erreur: (nom === 'TimeoutError' || nom === 'AbortError') ? 'timeout' : String(e && e.message || e) };
  });
}

function vientDeLApplication(sender) {
  if (!sender || !sender.tab || sender.frameId !== 0) return false;
  try { return HOTES_APPLICATION.indexOf(new URL(sender.url).hostname) >= 0; } catch (e) { return false; }
}

chrome.runtime.onMessage.addListener(function (m, sender, repondre) {
  if (!m || !vientDeLApplication(sender)) return false;
  if (m.type === 'application') {
    majCadres(sender.tab.id, null);
    return false;
  }
  if (m.type === 'page') {
    lirePage(m).then(repondre);
    return true; // réponse asynchrone
  }
  return false;
});

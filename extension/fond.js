/* Le service worker de l'extension. Deux rôles, demandés par relais.js depuis
   l'onglet de l'application, et par lui seul :

   1. Lever le refus d'encadrement DANS CET ONGLET. Un lecteur qui répond
      `X-Frame-Options: DENY` ou `Content-Security-Policy: frame-ancestors …` est
      refusé par le navigateur avant tout JavaScript. On retire ces deux en-têtes des
      réponses de cadre (`sub_frame`), et seulement dans les onglets où l'application
      s'est annoncée, et dans les fenêtres surgissantes qu'elle ouvre (le second écran) :
      ailleurs, la protection contre l'encadrement reste intacte. C'est ce que faisait
      l'extension « Ignore X-Frame-Options Header », bornée ici à l'application.

   2. Le pont : lire une ressource d'une source avec les cookies du visiteur, là où les
      proxys CORS sont refusés. C'est `GM_xmlhttpRequest` du script utilisateur ;
      nettoyeur.js le demande par relais.js, qui ne tourne que sur les adresses de
      l'application. Au complet depuis 1.5 (25 octobre 2026, « les mêmes fonctions sur
      Firefox et Chrome ») : en texte ou en binaire (le mode direct : manifestes, clés,
      segments), avec le `Referer`, l'`Origin` et la plage (`Range`) demandés, comme
      sous Tampermonkey. */

'use strict';

var REGLE_CADRES = 1;
var MAX_OCTETS = 4 * 1024 * 1024;
var MAX_OCTETS_BINAIRES = 32 * 1024 * 1024;
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

/* Le second écran (`window.open('', 'footy-ecran2', …)`, js/multiview.js) est une
   fenêtre surgissante à part, donc un autre onglet : ses tuiles y étaient refusées
   comme sans l'extension. Une fenêtre surgissante ouverte par un onglet de
   l'application en hérite. Un simple onglet ouvert depuis l'application (« ouvrir le
   site ») n'est pas une fenêtre surgissante et garde sa protection. */
function estOngletApplication(tabId) {
  return chrome.declarativeNetRequest.getSessionRules().then(function (regles) {
    return regles.some(function (r) { return r.id === REGLE_CADRES && (r.condition.tabIds || []).indexOf(tabId) >= 0; });
  });
}

chrome.tabs.onCreated.addListener(function (tab) {
  if (!tab || tab.openerTabId == null || tab.id == null) return;
  estOngletApplication(tab.openerTabId).then(function (oui) {
    if (!oui) return;
    return chrome.windows.get(tab.windowId).then(function (fen) {
      if (fen && fen.type === 'popup') return majCadres(tab.id, null);
    });
  }).catch(function () {});
});

/* `fetch` ne pose ni `Referer` ni `Origin` : le navigateur les tient pour siens. Or les
   CDN des flux refusent un autre référent que celui de leur lecteur (403), et plusieurs
   ne répondent qu'à son origine. Tampermonkey les pose ; ici, une règle de session
   `modifyHeaders` le fait le temps d'une requête, bornée à son adresse exacte et aux
   requêtes de l'extension elle-même (hors de tout onglet, initiateur : l'extension) :
   la même adresse chargée par une page n'est pas touchée. Les identifiants tournent à
   partir de PREMIERE_REGLE_ENTETES ; `removeRuleIds` du même appel remplace une règle
   qu'un service worker arrêté en pleine requête aurait laissée derrière lui. Après une
   redirection, l'adresse change et la règle ne s'applique plus. */
var PREMIERE_REGLE_ENTETES = 1000;
var NB_REGLES_ENTETES = 3000;
var suiteEntetes = 0;

/* L'adresse exacte en `urlFilter`, sans fragment (la requête n'en porte pas). Les trois
   caractères spéciaux de la syntaxe deviennent le joker : plus large d'un caractère,
   jamais faux. */
function filtreAdresse(url) {
  return '|' + url.split('#')[0].replace(/[*^|]/g, '*') + '|';
}

function avecEntetes(url, referer, origine, lire) {
  var poser = [];
  if (referer) poser.push({ header: 'referer', operation: 'set', value: referer });
  if (origine) poser.push({ header: 'origin', operation: 'set', value: origine });
  if (!poser.length) return lire();
  var dnr = chrome.declarativeNetRequest;
  var id = PREMIERE_REGLE_ENTETES + (suiteEntetes++ % NB_REGLES_ENTETES);
  var retirer = function () { dnr.updateSessionRules({ removeRuleIds: [id] }).catch(function () {}); };
  return dnr.updateSessionRules({
    removeRuleIds: [id],
    addRules: [{
      id: id,
      priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: poser },
      condition: { urlFilter: filtreAdresse(url), tabIds: [chrome.tabs.TAB_ID_NONE], initiatorDomains: [chrome.runtime.id] }
    }]
  }).then(lire, function (e) {
    console.warn('[Guide des Sports] en-têtes du pont :', e && e.message);
    return lire();
  }).then(function (r) { retirer(); return r; }, function (e) { retirer(); throw e; });
}

/* Les octets voyagent jusqu'à relais.js en JSON (la messagerie des extensions ne passe
   pas d'ArrayBuffer) : en base64, par tranches pour ne pas déborder la pile. */
function enBase64(tampon) {
  var octets = new Uint8Array(tampon);
  if (typeof octets.toBase64 === 'function') return octets.toBase64();
  var morceaux = [];
  for (var i = 0; i < octets.length; i += 0x8000) morceaux.push(String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000)));
  return btoa(morceaux.join(''));
}

var ADRESSE = /^https?:\/\/\S+$/i;
var ORIGINE = /^https?:\/\/[^\/\s]+$/i;
var PLAGE = /^bytes=\d*-\d*$/;

function lirePage(m) {
  var url = String(m.url || '');
  if (!/^https?:\/\//i.test(url)) return Promise.resolve({ erreur: 'adresse invalide' });
  try { url = new URL(url).href; } catch (e) { return Promise.resolve({ erreur: 'adresse invalide' }); }
  var e = (m.entetes && typeof m.entetes === 'object') ? m.entetes : {};
  var referer = (typeof e.referer === 'string' && ADRESSE.test(e.referer)) ? e.referer : '';
  var origine = (typeof e.origine === 'string' && ORIGINE.test(e.origine)) ? e.origine : '';
  var entetes = {};
  if (typeof e.plage === 'string' && PLAGE.test(e.plage)) entetes.Range = e.plage;
  var binaire = m.binaire === true;
  var delai = Math.min(Math.max(Number(m.timeout) || 15000, 1000), 60000);
  return avecEntetes(url, referer, origine, function () {
    return fetch(url, {
      method: m.method === 'HEAD' ? 'HEAD' : 'GET',
      credentials: 'include',
      redirect: 'follow',
      headers: entetes,
      signal: AbortSignal.timeout(delai)
    }).then(function (r) {
      if (binaire) {
        return r.arrayBuffer().then(function (tampon) {
          if (tampon.byteLength > MAX_OCTETS_BINAIRES) return { erreur: 'réponse trop grosse (' + tampon.byteLength + ' octets)' };
          return { status: r.status, statusText: r.statusText, finalUrl: r.url, octets64: enBase64(tampon) };
        });
      }
      return r.text().then(function (texte) {
        if (texte.length > MAX_OCTETS) texte = texte.slice(0, MAX_OCTETS);
        return { status: r.status, statusText: r.statusText, responseText: texte, finalUrl: r.url };
      });
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

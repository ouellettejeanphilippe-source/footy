// Le Multiview Stream Cleaner, injecté sans Tampermonkey.
//
// Pourquoi ce fichier existe
// --------------------------
// Sur téléphone comme sur ordinateur, les pages des lecteurs sont chargées
// telles quelles dans les tuiles du lecteur. Sans le script, elles gardent
// leurs fenêtres surgissantes et leurs calques, ne démarrent pas seules, et
// jouent toutes leur son en même temps. Le dépôt livrait le script pour
// Tampermonkey ; ici il n'y a pas de Tampermonkey, donc l'application
// l'injecte elle-même.
//
// Ce que le script exige, et que ce fichier lui donne
// ---------------------------------------------------
// `@run-at document-start` : il pose son blocage de fenêtres surgissantes
//   AVANT le premier script de la page — une régie publicitaire qui garde sa
//   propre référence à `window.open` avant nous n'est plus rattrapable. Un
//   script de préchargement Electron est exactement ça : il s'exécute avant
//   tout script de la page.
//
// `@allFrames true` : le fichier contient DEUX blocs qui se choisissent
//   eux-mêmes. Le nettoyeur ne travaille que dans une iframe (il sort tout de
//   suite si `window.self === window.top`) ; le pont d'affichage ne travaille
//   que dans la fenêtre principale (il sort si ce n'est pas le cas). Il faut
//   donc l'injecter PARTOUT et laisser chaque moitié décider — d'où
//   `nodeIntegrationInSubFrames` dans main.js, qui porte le préchargement
//   jusque dans les iframes.
//
// Le monde de la page : le script remplace `window.open`, lit `window.parent`
//   et parle à l'application par `postMessage`. Rien de tout ça n'est
//   atteignable depuis un monde isolé, d'où `contextIsolation: false` — le
//   même arrangement que celui dans lequel Tampermonkey le faisait tourner.
//
// `GM_xmlhttpRequest` : le pont s'en sert pour télécharger le HTML d'une page
//   que `X-Frame-Options` interdit d'encadrer, puis l'application le pose dans
//   l'iframe par `srcdoc`. Dans un navigateur ordinaire seul Tampermonkey
//   pouvait faire cette requête d'origine croisée ; ici `fetch` y arrive déjà,
//   parce que main.js complète les en-têtes CORS des réponses. Le pont reçoit
//   donc un `GM_xmlhttpRequest` bâti sur `fetch`, avec la forme qu'il attend.

const fs = require('node:fs');

(function injecter() {
  'use strict';

  const chemin = process.env.FOOTY_USERSCRIPT;
  if (!chemin) return;

  let source;
  try {
    source = fs.readFileSync(chemin, 'utf8');
  } catch (e) {
    console.error('[Guide des Sports] script de nettoyage illisible :', e.message);
    return;
  }

  // ---- GM_xmlhttpRequest, dans la forme que le pont utilise --------------
  // Le pont appelle { method, url, timeout, headers, onload, onerror,
  // ontimeout } et ne lit de la réponse que `status` et `responseText`.
  function gmXhr(options) {
    const o = options || {};
    const controleur = new AbortController();
    let termine = false;

    const minuteur = o.timeout
      ? setTimeout(() => {
          if (termine) return;
          termine = true;
          controleur.abort();
          try {
            if (typeof o.ontimeout === 'function') o.ontimeout({ error: 'timeout' });
          } catch (e) {}
        }, o.timeout)
      : null;

    // `credentials: 'include'` reproduit ce que faisait GM_xmlhttpRequest :
    // il envoyait les cookies du navigateur, et c'est ce qui le faisait passer
    // là où un proxy CORS anonyme se fait refouler.
    fetch(o.url, {
      method: o.method || 'GET',
      // Referer est un en-tête que `fetch` refuse de laisser écrire depuis une
      // page ; il est donc ignoré ici. Le reste passe.
      headers: o.headers || {},
      signal: controleur.signal,
      credentials: 'include',
      redirect: 'follow',
    })
      .then(async (reponse) => {
        const texte = await reponse.text();
        if (termine) return;
        termine = true;
        if (minuteur) clearTimeout(minuteur);
        try {
          if (typeof o.onload === 'function') {
            o.onload({
              status: reponse.status,
              statusText: reponse.statusText,
              responseText: texte,
              finalUrl: reponse.url,
              responseHeaders: '',
            });
          }
        } catch (e) {}
      })
      .catch((err) => {
        if (termine) return;
        termine = true;
        if (minuteur) clearTimeout(minuteur);
        try {
          if (typeof o.onerror === 'function') o.onerror({ error: String(err && err.message ? err.message : err) });
        } catch (e) {}
      });

    return { abort: () => controleur.abort() };
  }

  try {
    // Le script cherche `GM_xmlhttpRequest` puis `GM.xmlHttpRequest` : les deux
    // noms répondent.
    window.GM_xmlhttpRequest = gmXhr;
    window.GM = window.GM || {};
    if (!window.GM.xmlHttpRequest) window.GM.xmlHttpRequest = gmXhr;
  } catch (e) {
    // Une iframe d'origine croisée peut refuser l'écriture ; sans le pont, le
    // nettoyeur fonctionne quand même.
  }

  // ---- Le script lui-même -----------------------------------------------
  // `new Function` l'exécute dans le monde de la page, avec sa propre portée :
  // ses `var` de premier niveau ne se répandent pas sur `window`.
  try {
    new Function(source)();
  } catch (e) {
    console.error('[Guide des Sports] le script de nettoyage a échoué :', e.message);
  }
})();

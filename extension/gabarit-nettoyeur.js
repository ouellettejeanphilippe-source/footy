/* Le Multiview Stream Cleaner, porté par l'extension sans Tampermonkey.
 *
 * `node extension/construire.mjs` remplace la ligne marquée par multiview-cleaner.user.js
 * et écrit nettoyeur.js, que manifest.json pose dans TOUS les cadres, avant leur premier
 * script, dans le monde de la page : ce que demandent `@allFrames true` et
 * `@run-at document-start`. Même arrangement que mobile/injection-userscript.js.
 *
 * Deux différences avec Tampermonkey :
 *   - le script ne travaille que sous l'application. Un cadre dont la fenêtre du haut
 *     n'est pas l'application (une vidéo YouTube sur un blogue, un formulaire de
 *     connexion) n'est pas touché ; Tampermonkey nettoyait toutes les iframes du web ;
 *   - `GM_xmlhttpRequest` passe par relais.js et fond.js, présents dans la seule
 *     fenêtre de l'application. Ailleurs, il échoue tout de suite, proprement. */
(function () {
    'use strict';
    if (window.__footyNettoyeur) return;

    var VERSION_EXTENSION = '1.3';
    var HOTES_APPLICATION = ['127.0.0.1', 'localhost', 'ouellettejeanphilippe-source.github.io'];

    /* La fenêtre du haut, vue d'ici. `ancestorOrigins` la donne même depuis un cadre
       d'une autre origine ; le dernier élément est la fenêtre du haut. Une origine
       masquée (« null », politique de référent d'un cadre intermédiaire) ne permet
       pas de trancher : on travaille, comme Tampermonkey l'aurait fait. */
    var ancetres = location.ancestorOrigins;
    var racine = (ancetres && ancetres.length) ? ancetres[ancetres.length - 1] : location.origin;
    if (racine !== 'null') {
        var hoteRacine = '';
        try { hoteRacine = new URL(racine).hostname; } catch (e) {}
        if (HOTES_APPLICATION.indexOf(hoteRacine) < 0) return;
    }
    window.__footyNettoyeur = true;
    if (window.self === window.top) window.__footyExtension = VERSION_EXTENSION;

    var attente = {};
    var suite = 0;
    window.addEventListener('message', function (e) {
        if (e.source !== window) return;
        var d = e.data;
        if (!d || typeof d !== 'object' || d.__footyExt !== 'reponse' || !attente[d.id]) return;
        var o = attente[d.id];
        delete attente[d.id];
        try {
            if (d.erreur === 'timeout') { if (typeof o.ontimeout === 'function') o.ontimeout({ error: 'timeout' }); }
            else if (d.erreur) { if (typeof o.onerror === 'function') o.onerror({ error: d.erreur }); }
            else if (typeof o.onload === 'function') o.onload({ status: d.status, statusText: d.statusText, responseText: d.responseText, finalUrl: d.finalUrl, responseHeaders: '' });
        } catch (err) {}
    });

    function gmXhr(options) {
        var o = options || {};
        /* Pas de relais dans un cadre : la demande ne recevrait jamais de réponse. */
        if (window.self !== window.top) {
            setTimeout(function () { try { if (typeof o.onerror === 'function') o.onerror({ error: 'pont absent dans un cadre' }); } catch (e) {} }, 0);
            return { abort: function () {} };
        }
        var id = 'fx' + (++suite) + '_' + Date.now();
        attente[id] = o;
        window.postMessage({ __footyExt: 'requete', id: id, url: o.url, method: o.method || 'GET', timeout: o.timeout || 15000 }, '*');
        return { abort: function () { delete attente[id]; } };
    }

    var GM_xmlhttpRequest = gmXhr;
    var GM = { xmlHttpRequest: gmXhr };

    try {
/*__SCRIPT__*/
    } catch (e) {
        try { console.error('[Guide des Sports] le script de nettoyage a échoué : ' + (e && e.message)); } catch (e2) {}
    }
})();

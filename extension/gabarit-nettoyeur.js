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
 *     fenêtre de l'application. Ailleurs, il échoue tout de suite, proprement.
 *
 * Pour le reste, depuis 1.5 (25 octobre 2026, « les mêmes fonctions sur Firefox et
 * Chrome »), ce `GM_xmlhttpRequest` fait ce que fait celui de Tampermonkey pour le
 * script : texte ou binaire (`responseType: 'arraybuffer'`), avec les en-têtes
 * `Referer`, `Origin` et `Range` (fond.js). Le script n'annonce la lecture binaire,
 * donc le mode direct, que sous un vrai gestionnaire de scripts, qu'il reconnaît à
 * `GM_info` : on le lui donne. */
(function () {
    'use strict';
    if (window.__footyNettoyeur) return;

    var VERSION_EXTENSION = '1.5';
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
            else if (typeof o.onload === 'function') o.onload({ status: d.status, statusText: d.statusText, responseText: d.responseText || '', response: d.octets || d.responseText, finalUrl: d.finalUrl, responseHeaders: '' });
        } catch (err) {}
    });

    /* Les seuls en-têtes que le script demande, et que fond.js sait poser. */
    function entetesDuPont(h) {
        var e = {};
        Object.keys(h || {}).forEach(function (k) {
            var v = h[k], n = k.toLowerCase();
            if (typeof v !== 'string') return;
            if (n === 'referer') e.referer = v;
            else if (n === 'origin') e.origine = v;
            else if (n === 'range') e.plage = v;
        });
        return e;
    }

    function gmXhr(options) {
        var o = options || {};
        /* Pas de relais dans un cadre : la demande ne recevrait jamais de réponse. */
        if (window.self !== window.top) {
            setTimeout(function () { try { if (typeof o.onerror === 'function') o.onerror({ error: 'pont absent dans un cadre' }); } catch (e) {} }, 0);
            return { abort: function () {} };
        }
        var id = 'fx' + (++suite) + '_' + Date.now();
        attente[id] = o;
        window.postMessage({ __footyExt: 'requete', id: id, url: o.url, method: o.method || 'GET', timeout: o.timeout || 15000, binaire: o.responseType === 'arraybuffer', entetes: entetesDuPont(o.headers) }, '*');
        return { abort: function () { delete attente[id]; } };
    }

    var GM_info = { scriptHandler: 'Guide des Sports (extension)', version: VERSION_EXTENSION };
    var GM_xmlhttpRequest = gmXhr;
    var GM = { xmlHttpRequest: gmXhr, info: GM_info };

    try {
/*__SCRIPT__*/
    } catch (e) {
        try { console.error('[Guide des Sports] le script de nettoyage a échoué : ' + (e && e.message)); } catch (e2) {}
    }
})();

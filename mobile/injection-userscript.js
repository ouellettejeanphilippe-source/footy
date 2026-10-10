/* Le Multiview Stream Cleaner, injecté par l'APK Android sans Tampermonkey.
 *
 * NettoyeurLecteurs.java lit ce gabarit, remplace la ligne marquée par le script
 * (multiview-cleaner.user.js, embarqué dans l'APK) et le pose dans TOUS les cadres,
 * iframes d'autres sites comprises, avant leur premier script
 * (WebViewCompat.addDocumentStartJavaScript) : ce que demandent `@allFrames true` et
 * `@run-at document-start`. Chaque moitié du script choisit seule où elle travaille :
 * le nettoyeur dans une iframe, le pont dans la fenêtre principale.
 *
 * Ce que le gabarit ajoute : `GM_xmlhttpRequest`, dans la forme qu'attend le pont
 * ({ method, url, timeout, headers, onload, onerror, ontimeout }, réponse : `status`
 * et `responseText`). Bâti sur `fetch` : dans la fenêtre principale, Capacitor
 * (CapacitorHttp) le fait passer par le réseau natif, sans politique d'origine
 * croisée. C'est le même arrangement que desktop/preload-userscript.js.
 *
 * Une seule exécution par document : la fenêtre principale peut aussi le recevoir à
 * la fin du chargement (onPageFinished), si son premier chargement a précédé la pose. */
(function () {
    'use strict';
    if (window.__footyNettoyeur) return;
    window.__footyNettoyeur = true;

    function gmXhr(options) {
        var o = options || {};
        var controleur = typeof AbortController === 'function' ? new AbortController() : null;
        var termine = false;
        var minuteur = o.timeout ? setTimeout(function () {
            if (termine) return;
            termine = true;
            if (controleur) controleur.abort();
            try { if (typeof o.ontimeout === 'function') o.ontimeout({ error: 'timeout' }); } catch (e) {}
        }, o.timeout) : null;
        fetch(o.url, {
            method: o.method || 'GET',
            headers: o.headers || {},
            signal: controleur ? controleur.signal : undefined,
            credentials: 'include',
            redirect: 'follow'
        }).then(function (reponse) {
            return reponse.text().then(function (texte) {
                if (termine) return;
                termine = true;
                if (minuteur) clearTimeout(minuteur);
                try {
                    if (typeof o.onload === 'function') o.onload({ status: reponse.status, statusText: reponse.statusText, responseText: texte, finalUrl: reponse.url, responseHeaders: '' });
                } catch (e) {}
            });
        }).catch(function (err) {
            if (termine) return;
            termine = true;
            if (minuteur) clearTimeout(minuteur);
            try { if (typeof o.onerror === 'function') o.onerror({ error: String(err && err.message ? err.message : err) }); } catch (e) {}
        });
        return { abort: function () { if (controleur) controleur.abort(); } };
    }

    var GM_xmlhttpRequest = gmXhr;
    var GM = { xmlHttpRequest: gmXhr };

    try {
/*__SCRIPT__*/
    } catch (e) {
        try { console.error('[Guide des Sports] le script de nettoyage a échoué : ' + (e && e.message)); } catch (e2) {}
    }
})();

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

    var VERSION_EXTENSION = '1.4';
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
// ==UserScript==
// @name         Multiview Stream Cleaner
// @namespace    http://tampermonkey.net/
// @version      1.17
// @description  Nettoie les lecteurs encadres dans le Multiview, lance la video sans clic, bloque leurs fenetres surgissantes des le premier script de la page, et sert de pont pour lire les pages des sources depuis le navigateur, Firefox inclus.
// @author       Jules
// @match        *://*/*
// @allFrames    true
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      *
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Sécurité: Ne s'exécute que si la page est dans une iframe (ex: dans le Multiview)
    if (window.self === window.top) {
        return;
    }

    /* Les lecteurs officiels (Twitch, YouTube) n'ont rien à nettoyer, et les pièges posés
       plus bas (`window.parent`, `window.top`) empêchaient le lecteur Twitch de démarrer :
       « Chargement de player.twitch.tv… » sans fin (16 octobre 2026). Même liste que
       estLecteurOfficiel (js/esports.js). */
    if (location.hostname === 'player.twitch.tv'
        || (/(^|\.)(youtube\.com|youtube-nocookie\.com)$/.test(location.hostname) && location.pathname.indexOf('/embed/') === 0)) {
        return;
    }

    /* La fenêtre qui nous encadre, capturée MAINTENANT — avant le piège
       anti-détournement posé juste en dessous, qui remplace `window.parent` par un Proxy
       reconstruit à CHAQUE lecture.

       Relevé le 12 septembre 2026 en instrumentant le cadre : `e.source !== window.parent`
       était donc toujours vrai, et la tuile n'obéissait à AUCUN ordre de l'application —
       ni couper le son, ni le rendre (donc la lecture ne se lançait pas quand la tuile
       devenait celle qu'on regarde), ni relancer la recherche du lecteur. Le filtre
       « seule la fenêtre qui nous encadre commande » se refusait à lui-même. Deux tests
       passaient pourtant : ils vérifiaient un effet que la recherche automatique produit
       aussi, donc ils ne prouvaient rien. */
    var FENETRE_PARENTE = null;
    try { FENETRE_PARENTE = window.parent; } catch (e) { FENETRE_PARENTE = null; }

    /* Le blocage des popups se pose ICI, avant le premier script de la page
       (@run-at document-start). Posé à document-idle comme avant, il arrivait après que la
       régie (Adcash `aclib.runPop` sur embed.st, par exemple) eut gardé sa propre référence
       à window.open et posé ses écouteurs de clic : « ya moyen de bloquer les popups à même
       le multiview ? » — depuis l'application, non (une iframe d'origine croisée sans
       bac à sable n'obéit à rien), mais d'ici, oui, à condition d'arriver le premier. */
    try { injectPopupBlocker(); } catch (e) {}

    /* Pour la garde « Quitter le site ? » de l'application (18 octobre 2026). Elle reste
       armée contre un lecteur qui emmène l'onglet, et se lève quand c'est l'utilisateur
       qui s'en va : pointeur sorti par le haut vers les onglets ou la croix, touche de
       raccourci (Ctrl, Cmd, Alt, F5). Quand le pointeur ou le focus est dans une tuile,
       c'est ce cadre qui les voit, pas l'application : on les lui dit. Le pointeur qui
       revient directement dans une tuile, aussi. Une marge de 20 px sous le haut (1.16) :
       un pointeur rapide n'est vu qu'à sa dernière position, quelques pixels plus bas. */
    try {
        var signalerDepart = function (m) { try { window.top.postMessage(m, '*'); } catch (e) {} };
        var MODIFICATRICES = { Control: 1, Meta: 1, Alt: 1, OS: 1 };
        document.addEventListener('mouseout', function (e) {
            if (!e.relatedTarget && e.clientY <= 20) signalerDepart({ __mv: 'pointeur', dehors: true });
        }, true);
        document.addEventListener('mouseover', function (e) {
            if (!e.relatedTarget) signalerDepart({ __mv: 'pointeur', dehors: false });
        }, true);
        window.addEventListener('keydown', function (e) {
            var quitte = e.key === 'F5' || ((e.ctrlKey || e.metaKey) && /^[rwq]$/i.test(e.key || ''));
            if (MODIFICATRICES[e.key] || quitte) signalerDepart({ __mv: 'touche', modificateur: !!(MODIFICATRICES[e.key] || e.ctrlKey || e.metaKey || e.altKey), depart: quitte });
        }, true);
        window.addEventListener('keyup', function (e) {
            if (MODIFICATRICES[e.key]) signalerDepart({ __mv: 'touche', modificateur: !!(e.ctrlKey || e.metaKey || e.altKey), depart: false });
        }, true);
        /* Les boutons Précédent et Suivant de la souris (1.17) : c'est l'utilisateur qui
           recule, pas la page. */
        window.addEventListener('mousedown', function (e) {
            if (e.button === 3 || e.button === 4) signalerDepart({ __mv: 'touche', modificateur: false, depart: true, bouton: true });
        }, true);
    } catch (e) {}

    /* Ne pas nettoyer notre propre application. Elle est reconnue à sa structure, comme
       par le pont plus bas : `#marea` ET `.epg`. Le titre « Guide TV », ou une classe
       `.epg` seule, désignaient aussi des sites de chaînes (une grille de programmes
       s'appelle une EPG) : le script y renonçait, et la page restait entière, publicités
       comprises (18 octobre 2026). */
    function estLApplication() {
        return !!(document.querySelector('#marea') && document.querySelector('.epg'));
    }

    /* Les <video> de la page, y compris celles des racines fantômes ouvertes (lecteurs en
       éléments personnalisés) : `querySelectorAll` n'y descend pas, et une page dont le
       lecteur vit là n'était jamais nettoyée. On ne descend que si la page n'en a aucune
       ailleurs : c'est le cas rare, et la descente parcourt tout le document. */
    /* Les hôtes de racines fantômes sont relevés au plus toutes les 5 s : le signal de
       lecture interroge les vidéos toutes les 2 s, et une page de lecteur faite
       d'iframes seulement n'a aucune vidéo à elle. */
    var hotesFantomes = [];
    var hotesReleves = 0;
    function toutesLesVideos() {
        var trouvees = Array.from(document.querySelectorAll('video'));
        if (trouvees.length) return trouvees;
        var maintenant = Date.now();
        if (maintenant - hotesReleves > 5000) {
            hotesReleves = maintenant;
            hotesFantomes = [];
            var visiter = function(racine, profondeur) {
                racine.querySelectorAll('*').forEach(function(el) {
                    if (!el.shadowRoot) return;
                    hotesFantomes.push(el);
                    if (profondeur < 3) visiter(el.shadowRoot, profondeur + 1);
                });
            };
            try { visiter(document, 0); } catch (e) {}
        }
        hotesFantomes.forEach(function(h) {
            try { h.shadowRoot.querySelectorAll('video').forEach(function(v) { trouvees.push(v); }); } catch (e) {}
        });
        return trouvees;
    }

    /* L'élément à garder pour une vidéo : elle-même, ou l'hôte de sa racine fantôme
       (on ne remonte pas d'une racine fantôme par `parentElement`). */
    function horsDeLOmbre(el) {
        var racine = el && el.getRootNode ? el.getRootNode() : null;
        while (racine && racine !== document && racine.host) {
            el = racine.host;
            racine = el.getRootNode();
        }
        return el;
    }

    let cleaned = false;
    let mainPlayerBase = null;

    /* Ce que le bac à sable de l'iframe faisait, rendu ici à la main.

       Certains hôtes REFUSENT de jouer dans une iframe en bac à sable et affichent
       « SANDBOX IFRAME NOT ALLOWED » à la place du lecteur. Le Multivision offre donc de
       lever le bac à sable pour ces domaines (bouton 🛡️ sur la tuile) — mais lever le bac
       à sable, c'est rendre à la page ses fenêtres surgissantes et le droit de détourner
       l'onglet entier.

       Sauf si ce script tourne dans la page : il y est, lui, et il peut reprendre les deux
       protections. C'est le seul endroit d'où c'est possible — l'application, séparée par
       une origine croisée, ne peut rien imposer au contenu de l'iframe.

       Ce n'est pas équivalent à un vrai bac à sable : une page peut redéfinir ce qu'on
       écrase, et une CSP stricte peut refuser le script injecté. C'est un filet, pas un
       mur. Mais entre lever le bac à sable avec ce script et le lever sans, la différence
       est réelle. */
    var popupsBloques = false; // `var` : appelé avant cette ligne (levage), un `let` serait encore inaccessible
    function injectPopupBlocker() {
        /* Une seule fois : cette fonction était rappelée à chaque passe de nettoyage (toutes
           les 500 ms pendant 15 s), et chaque passe ajoutait ses écouteurs de clic. */
        if (popupsBloques) return;
        popupsBloques = true;
        // Injecter un script pour bloquer window.open dans le contexte de la page principale (hors bac à sable Tampermonkey)
        const script = document.createElement('script');
        script.textContent = `
            /* Non réassignable : une régie qui fait « window.open = original » après nous
               ne récupère rien. */
            try {
                Object.defineProperty(window, 'open', {
                    configurable: false, writable: false, enumerable: true,
                    value: function() {
                        console.log('[Multiview Cleaner] Popup bloqué (window.open)');
                        return null;
                    }
                });
            } catch (e) {
                window.open = function() {
                    console.log('[Multiview Cleaner] Popup bloqué (window.open)');
                    return null;
                };
            }

            /* Détournement de l'onglet entier : le travers le plus pénible de ces sites, et
               ce que 'allow-top-navigation' refusait quand le bac à sable était posé. On
               rend 'window.parent' inerte en écriture pour ce cadre.

               'window.top', lui, ne peut pas l'être : la propriété n'est pas
               redéfinissable (« Cannot redefine property: top », vérifié dans Chromium le
               18 octobre 2026 ; c'est la règle des navigateurs). Le piège posé dessus
               échouait sans bruit depuis toujours. C'est la garde « Quitter le site ? »
               de l'application qui retient un « top.location = … ». */
            try {
                const bloque = (quoi) => {
                    console.log('[Multiview Cleaner] Navigation de plus haut niveau bloquée (' + quoi + ')');
                };
                for (const cible of ['parent']) {
                    try {
                        const ref = window[cible];
                        if (!ref || ref === window) continue;
                        Object.defineProperty(window, cible, {
                            configurable: true,
                            get() {
                                return new Proxy(ref, {
                                    get(o, p) {
                                        if (p === 'location') {
                                            return new Proxy({}, {
                                                get: (_, q) => (q === 'href' ? '' : () => bloque(cible + '.location.' + String(q))),
                                                set: () => { bloque(cible + '.location'); return true; }
                                            });
                                        }
                                        const v = Reflect.get(o, p);
                                        return typeof v === 'function' ? v.bind(o) : v;
                                    },
                                    set(o, p) { if (p === 'location') { bloque(cible + '.location'); return true; } return Reflect.set(o, p, arguments[2]); }
                                });
                            }
                        });
                    } catch (e) {}
                }
            } catch (e) {}

            /* L'historique de l'onglet entier (1.17, 18 octobre 2026 : des « Quitter le
               site ? » juste après la pose des vidéos, puis la page quittée et un « retour
               sur l'appli » trois secondes plus tard). Mesuré dans Firefox 158 : un cadre
               d'une autre origine qui appelle history.back() fait reculer TOUT l'onglet,
               sans aucun clic, parce que l'historique est celui de l'onglet ;
               history.forward() le mène de même sur une page vue après l'application, la
               pub d'un détournement précédent. Ni Firefox ni l'application ne peuvent
               l'annuler (l'événement « navigate » arrive après « beforeunload », et n'est
               pas annulable). Un lecteur n'a aucune raison de toucher à l'historique de
               l'onglet : back, forward et go deviennent inertes ici, et dans les cadres de
               même origine que la page crée, le moyen classique de retrouver une fonction
               d'origine. go(0), qui recharge le cadre lui-même, reste permis. */
            try {
                if (window.top !== window) {
                    const inerte = (quoi) => function () {
                        console.log('[Multiview Cleaner] Historique de l\\'onglet bloqué (history.' + quoi + ')');
                    };
                    const neutraliser = (w) => {
                        try {
                            const H = w.History && w.History.prototype;
                            if (!H || Object.getOwnPropertyDescriptor(H, '__mvInerte')) return;
                            const go = H.go;
                            Object.defineProperty(H, 'back', { configurable: false, writable: false, value: inerte('back') });
                            Object.defineProperty(H, 'forward', { configurable: false, writable: false, value: inerte('forward') });
                            Object.defineProperty(H, 'go', { configurable: false, writable: false, value: function (n) {
                                if (!Number(n)) return go.call(this, 0);
                                inerte('go(' + n + ')')();
                            } });
                            Object.defineProperty(H, '__mvInerte', { value: true });
                        } catch (e) {}
                    };
                    neutraliser(window);
                    const I = HTMLIFrameElement.prototype;
                    for (const p of ['contentWindow', 'contentDocument']) {
                        const d = Object.getOwnPropertyDescriptor(I, p);
                        if (!d || !d.get) continue;
                        Object.defineProperty(I, p, {
                            configurable: true, enumerable: d.enumerable,
                            get() {
                                const v = d.get.call(this);
                                try { const w = p === 'contentWindow' ? v : (v && v.defaultView); if (w) neutraliser(w); } catch (e) {}
                                return v;
                            }
                        });
                    }
                }
            } catch (e) {}
        `;
        /* À document-start, <head> n'existe pas encore ; <html> presque toujours. Sinon, on
           réessaie au prochain tour, avant que le premier script de la page ne s'exécute. */
        var poser = function() {
            var racine = document.head || document.documentElement;
            if (!racine) { setTimeout(poser, 0); return; }
            racine.appendChild(script);
            // Clean up the script tag to keep DOM tidy
            script.remove();
        };
        poser();

        /* Un lien 'target="_top"' ou '_parent' détourne l'onglet sans passer par
           window.open : on le ramène au cadre courant. Le gestionnaire de clic ci-dessous
           couvrait déjà '_blank', pas ceux-là. */
        /* Sur `window`, en phase de capture : c'est le tout premier gestionnaire appelé,
           avant ceux que la page pose sur document ou body. */
        window.addEventListener('click', function(e) {
            let t = e.target;
            while (t && t.tagName !== 'A') t = t.parentElement;
            if (t && (t.target === '_top' || t.target === '_parent')) {
                t.target = '_self';
                console.log('[Multiview Cleaner] Lien de détournement d\'onglet ramené au cadre', t.href);
            }
        }, true);

        // Intercepter et bloquer les clics sur les liens ouvrant de nouveaux onglets
        window.addEventListener('click', function(e) {
            let target = e.target;
            while (target && target.tagName !== 'A') {
                target = target.parentElement;
            }
            if (target && target.tagName === 'A') {
                if (target.target === '_blank' || target.href.includes('javascript:')) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[Multiview Cleaner] Clic sur un lien suspect bloqué', target.href);
                }
            }
        }, true); // Use capture phase to intercept early
    }

    function injectStyles() {
        const styleId = 'multiview-cleaner-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            html, body {
                width: 100vw !important;
                height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                background-color: #000 !important;
            }
            .mv-cleaner-parent {
                width: 100% !important;
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                max-width: 100% !important;
                max-height: 100% !important;
                overflow: hidden !important;
                position: static !important;
            }
            .mv-cleaner-maximized {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                z-index: 2147483647 !important;
                background-color: #000 !important;
                margin: 0 !important;
                padding: 0 !important;
                max-width: 100vw !important;
                max-height: 100vh !important;
                box-sizing: border-box !important;
                object-fit: contain !important;
            }
            .mv-cleaner-hidden {
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                z-index: -1 !important;
                width: 0 !important;
                height: 0 !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function getPlayerBase(element) {
        // Si c'est une iframe, l'iframe elle-même est une bonne base
        if (element.tagName === 'IFRAME') return element;

        const knownClasses = [
            'player', 'vjs', 'jw', 'plyr', 'shaka', 'dplayer', 'artplayer',
            'flowplayer', 'fp-engine', 'html5-video', 'video-js', 'clappr',
            'theoplayer', 'bitdash', 'jwplayer', 'vpaid', 'video-container',
            'media-control', 'vp-video', 'fluid_video_wrapper', 'rmp', 'dash-video'
        ];

        let current = element.parentElement;
        let levels = 0;

        while (current && current !== document.body && levels < 5) {
            // Safe class check (handles SVG elements where className is an object)
            let className = '';
            if (typeof current.className === 'string') {
                className = current.className.toLowerCase();
            } else if (current.className && typeof current.className.baseVal === 'string') {
                className = current.className.baseVal.toLowerCase();
            }

            const id = (current.id || '').toString().toLowerCase();

            if (knownClasses.some(c => className.includes(c) || id.includes(c))) {
                return current;
            }
            current = current.parentElement;
            levels++;
        }

        /* Repli : remonter d'un ou deux niveaux pour garder les contrôles natifs et les
           emballages simples — mais JAMAIS jusqu'à <body> ou <html>.

           C'était le défaut principal du nettoyage. Sur une page où le lecteur n'a aucun
           emballage reconnaissable — le cas courant : une <video> ou une <iframe> posée
           près de la racine — ce repli rendait <body>. Or `cleanEverythingOutside` remonte
           depuis cette base « tant qu'on n'est pas <body> » : partant DE <body>, la boucle
           ne s'exécutait pas une seule fois et rien n'était masqué. Le script annonçait
           pourtant « Page nettoyée avec succès » et se déclarait terminé, ce qui empêchait
           toute nouvelle tentative. La tuile gardait donc tout le décor du site — bandeau,
           boutons, avis — autour de la vidéo. */
        var parent = element.parentElement;
        if (!parent || parent === document.body || parent === document.documentElement) return element;
        var grandParent = parent.parentElement;
        if (grandParent && grandParent !== document.body && grandParent !== document.documentElement) return grandParent;
        return parent;
    }

    function isSafeControlElement(node) {
        // Safe check for controls, play, pause, volume, ui elements
        let className = '';
        if (typeof node.className === 'string') {
            className = node.className.toLowerCase();
        } else if (node.className && typeof node.className.baseVal === 'string') {
            className = node.className.baseVal.toLowerCase();
        }

        const id = (node.id || '').toString().toLowerCase();
        const safeKeywords = ['control', 'play', 'pause', 'volume', 'ui', 'layer', 'bar', 'button', 'btn', 'progress', 'slider', 'time', 'mute', 'fullscreen', 'icon', 'menu', 'settings'];

        return safeKeywords.some(keyword => className.includes(keyword) || id.includes(keyword));
    }

    function removeInvisibleOverlays(playerBase) {
        // Souvent, des div transparentes sont mises par-dessus pour capter les clics
        const elements = playerBase.querySelectorAll('*');
        elements.forEach(el => {
            // Ne pas supprimer les contrôles du lecteur
            if (isSafeControlElement(el)) {
                return;
            }

            const style = window.getComputedStyle(el);
            // Si l'élément couvre presque tout le lecteur mais est invisible ou a un z-index énorme sans contenu utile
            if (
                ['absolute', 'fixed'].includes(style.position) &&
                parseFloat(style.width) > (playerBase.offsetWidth * 0.8) &&
                parseFloat(style.height) > (playerBase.offsetHeight * 0.8) &&
                el.tagName !== 'VIDEO' && el.tagName !== 'IFRAME' &&
                (style.opacity === '0' || style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent') &&
                !el.querySelector('video, iframe') // S'assurer de ne pas supprimer le conteneur du lecteur
            ) {
                el.remove();
            }
        });
    }

    /* Ce qui reste PAR-DESSUS la vidéo une fois la page réduite au lecteur (18 octobre
       2026, « j'ai à nouveau des pubs dans les frames du multiview » : une pub par-dessus
       la vidéo). Dans l'emballage du lecteur, le nettoyage ne retirait que les calques
       transparents, et ceux ajoutés après coup avec un z-index de plus de 1000. Une
       bannière visible, un lien vers un site de paris posé sur l'image ou l'iframe d'une
       régie restaient.

       On masque maintenant tout calque positionné qui couvre au moins un vingtième de la
       vidéo et qui mène AILLEURS : un lien vers un autre site, ou une iframe quand la
       cible est une <video> (aucune iframe n'est alors à elle). Un vingtième, parce que
       la vidéo est agrandie à toute la tuile et qu'une bannière garde sa taille en pixels :
       un 300 × 250 couvre 14 % d'une tuile de 960 × 540. Les commandes du lecteur (boutons,
       barres, affiche) ne sont pas des liens vers un autre site, et restent ; son logo
       l'est parfois, mais il couvre à peine 1 % de l'image. Un calque « mène ailleurs »
       s'il est un lien, s'il est dans un lien, si un lien en fait au moins la moitié, ou
       s'il porte un lien et aucune commande (bouton, curseur) : une barre de commandes
       qui porte un petit lien « propulsé par » reste une barre. */
    var PART_CALQUE_DE_PUB = 0.05;
    function lienAilleurs(el) {
        var a = el.closest('a[href]');
        if (!a && el.querySelectorAll) {
            var re = el.getBoundingClientRect();
            var aireCalque = re.width * re.height;
            var liens = el.querySelectorAll('a[href]');
            for (var i = 0; i < liens.length && !a; i++) {
                var rl = liens[i].getBoundingClientRect();
                if (aireCalque > 0 && rl.width * rl.height >= aireCalque / 2) a = liens[i];
            }
            if (!a && liens.length && !el.querySelector('button, input, select, [role="button"], [role="slider"]')) a = liens[0];
        }
        if (!a) return false;
        try {
            var u = new URL(a.getAttribute('href'), location.href);
            return /^https?:$/.test(u.protocol) && u.hostname !== location.hostname;
        } catch (e) { return false; }
    }
    function retirerCalquesDePub(base, cible) {
        if (!base || !cible || !base.isConnected || !cible.isConnected) return 0;
        var rc = cible.getBoundingClientRect();
        var aire = rc.width * rc.height;
        if (aire < 1) return 0;
        var retires = 0;
        base.querySelectorAll('*').forEach(function(el) {
            if (el === cible || el.contains(cible) || el.classList.contains('mv-cleaner-hidden')) return;
            var estCadre = el.tagName === 'IFRAME';
            if (estCadre && cible.tagName !== 'VIDEO') return;
            if (!estCadre) {
                var pos = window.getComputedStyle(el).position;
                if (pos !== 'absolute' && pos !== 'fixed') return;
            }
            var r = el.getBoundingClientRect();
            var ix = Math.max(0, Math.min(r.right, rc.right) - Math.max(r.left, rc.left));
            var iy = Math.max(0, Math.min(r.bottom, rc.bottom) - Math.max(r.top, rc.top));
            if ((ix * iy) / aire < PART_CALQUE_DE_PUB) return;
            if (!estCadre && !lienAilleurs(el)) return;
            el.classList.add('mv-cleaner-hidden');
            retires++;
        });
        if (retires) console.log('[Multiview Cleaner] Calque de pub retiré de la vidéo (' + retires + ')');
        return retires;
    }

    function cleanEverythingOutside(target) {
        if (cleaned) return;

        injectStyles();
        mainPlayerBase = getPlayerBase(target);
        /* Ceinture et bretelles : si la base remonte quand même à la racine, on retombe
           sur la cible elle-même. Une base égale à <body> ne masque rien du tout. */
        if (!mainPlayerBase || mainPlayerBase === document.body || mainPlayerBase === document.documentElement) {
            mainPlayerBase = target;
        }

        let current = mainPlayerBase;
        while (current && current !== document.body) {
            const parent = current.parentElement;
            if (!parent) break;

            // Masquer tous les frères
            const children = Array.from(parent.children);
            for (const child of children) {
                if (child !== current && !['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD'].includes(child.tagName)) {
                    child.classList.add('mv-cleaner-hidden');
                    // Retirer l'élément du flux si possible
                    try { child.remove(); } catch(e) {}
                }
            }

            parent.classList.add('mv-cleaner-parent');
            current = parent;
        }


        // Maximiser le conteneur du lecteur
        mainPlayerBase.classList.add('mv-cleaner-maximized');

        // Ajouter le bouton Cast si c'est une video

        // Ajouter le bouton Cast si c'est une video
        if (target.tagName === 'VIDEO') {
            addMobileCastSupport(target);
        }



        // Si la cible est une vidéo ou iframe, s'assurer qu'elle prend tout l'espace
        if (target.tagName === 'VIDEO' || target.tagName === 'IFRAME') {
            target.classList.add('mv-cleaner-maximized');
        }

        // Fallback: forcer les contrôles natifs si la cible est une vidéo
        if (target.tagName === 'VIDEO') {
            target.setAttribute('controls', 'true');
            // S'assurer que la vidéo elle-même peut recevoir des clics
            target.style.setProperty('pointer-events', 'auto', 'important');
        }

        removeInvisibleOverlays(mainPlayerBase);

        /* Les enfants de <html> hors de <body> : une régie qui s'y accroche échappe à la
           remontée ci-dessus, qui s'arrête à <body>. */
        var horsCorps = function(n) {
            return n && n.nodeType === 1 && n !== document.body && n !== document.head
                && !['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'BODY'].includes(n.tagName);
        };
        Array.from(document.documentElement.children).forEach(function(n) {
            if (horsCorps(n)) n.classList.add('mv-cleaner-hidden');
        });
        new MutationObserver(function(mutations) {
            mutations.forEach(function(m) { m.addedNodes.forEach(function(n) { if (horsCorps(n)) n.classList.add('mv-cleaner-hidden'); }); });
        }).observe(document.documentElement, { childList: true });

        /* Calques de pub : tout de suite, puis un moment encore, parce qu'une régie pose
           souvent sa bannière quelques secondes après le départ de la vidéo. */
        retirerCalquesDePub(mainPlayerBase, target);
        /* Et à chaque ajout dans le lecteur, regroupé : un lecteur ajoute des nœuds sans
           arrêt (sous-titres, commandes), la passe ne court qu'une fois par demi-seconde. */
        var calquesPrevus = null;
        var planifierCalques = function() {
            if (calquesPrevus) return;
            calquesPrevus = setTimeout(function() { calquesPrevus = null; retirerCalquesDePub(mainPlayerBase, target); }, 500);
        };
        var passesCalques = 0;
        var boucleCalques = setInterval(function() {
            if (++passesCalques > 60) { clearInterval(boucleCalques); return; }
            retirerCalquesDePub(mainPlayerBase, target);
        }, 2000);

        cleaned = true;
        console.log('[Multiview Cleaner] Page nettoyée avec succès !');
        lancerLectureImmediate(mainPlayerBase);

        // MutationObserver agressif pour supprimer les pubs
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && !['SCRIPT', 'STYLE', 'LINK', 'META'].includes(node.tagName)) {
                            // Si le nouveau noeud n'est pas notre lecteur et n'est pas contenu dedans
                            if (node !== mainPlayerBase && !mainPlayerBase.contains(node)) {
                                node.classList.add('mv-cleaner-hidden');
                                try { node.remove(); } catch(e) {}
                            } else if (mainPlayerBase.contains(node)) {
                                // Ne pas supprimer les éléments de contrôle qui pourraient être ajoutés dynamiquement
                                if (isSafeControlElement(node)) return;

                                // Vérifier si c'est un overlay ajouté à l'intérieur
                                const style = window.getComputedStyle(node);
                                if (['absolute', 'fixed'].includes(style.position) && parseInt(style.zIndex, 10) > 1000 && node.tagName !== 'VIDEO') {
                                    // Risque élevé de pub en surimpression
                                    node.classList.add('mv-cleaner-hidden');
                                    try { node.remove(); } catch(e) {}
                                } else {
                                    planifierCalques();
                                }
                            }
                        }
                    });
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        function attachMediaListeners(mediaEl) {
            if (mediaEl.dataset.mvListenersAttached) return;
            mediaEl.dataset.mvListenersAttached = 'true';

            mediaEl.addEventListener('volumechange', function() {
                // If user manually unmutes or increases volume, notify parent to focus this stream
                // This ensures other streams get muted
                if (!mediaEl.muted && mediaEl.volume > 0 && !window.mvUnmutedState) {
                    window.top.postMessage('mv_frame_clicked', '*');
                }
            });

            mediaEl.addEventListener('play', function() {
                 if (!mediaEl.muted && mediaEl.volume > 0 && !window.mvUnmutedState) {
                    window.top.postMessage('mv_frame_clicked', '*');
                }
            });
        }

        // Attach listeners to existing media
        document.querySelectorAll('video, audio').forEach(attachMediaListeners);

        const mediaObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeName === 'VIDEO' || node.nodeName === 'AUDIO') {
                            attachMediaListeners(node);
                            if (window.mvUnmutedState && node.muted) {
                                node.muted = false;
                                node.volume = 1;
                            }
                        } else if (node.querySelectorAll) {
                            const newMedia = node.querySelectorAll('video, audio');
                            newMedia.forEach(el => {
                                attachMediaListeners(el);
                                if (window.mvUnmutedState && el.muted) {
                                    el.muted = false;
                                    el.volume = 1;
                                }
                            });
                        }
                    });
                }
            }
        });
        mediaObserver.observe(document.body, { childList: true, subtree: true });

        // Detect clicks anywhere in the window to broadcast click to parent
        window.addEventListener('mousedown', function(e) {
            window.top.postMessage('mv_frame_clicked', '*');
        }, true);
    }


    // --- CHROMECAST INJECTION ---

    function extractM3u8Url() {
        // Method 1: Check for standard global player objects
        if (window.player && window.player.options && window.player.options.sources) {
            const source = window.player.options.sources.find(s => s.file && s.file.includes('.m3u8'));
            if (source) return source.file;
        }

        // Method 2: Check standard Clappr instances
        if (window.clappr && window.clappr.options && window.clappr.options.source) {
            return window.clappr.options.source;
        }

        // Method 3: Check generic configuration objects often injected by scrapers
        if (window.config && window.config.file) {
             return window.config.file;
        }

        // Method 4: Scan all script tags for .m3u8 strings
        const scripts = document.querySelectorAll('script');
        for (let i = 0; i < scripts.length; i++) {
            const text = scripts[i].innerText;
            if (text && text.includes('.m3u8')) {
                const match = text.match(/(https?:\/\/[^\s"'<>]+?\.m3u8[^\s"'<>]*)/i);
                if (match && match[1]) {
                    return match[1];
                }
            }
        }

        return null;
    }

    function addMobileCastSupport(videoElement) {
        if (!videoElement || videoElement.dataset.mobileCastHandled) return;
        videoElement.dataset.mobileCastHandled = 'true';

        // Sur mobile, le fait d'injecter directement l'URL m3u8 dans le tag <video>
        // ou d'offrir un lien d'ouverture externe permet au lecteur natif de gérer le Cast.

        // On attend que la page soit bien chargée pour tenter l'extraction
        setTimeout(() => {
            let videoUrl = videoElement.src;
            if (!videoUrl && videoElement.querySelector('source')) {
                videoUrl = videoElement.querySelector('source').src;
            }

            if (!videoUrl || videoUrl.startsWith('blob:')) {
                const m3u8 = extractM3u8Url();
                if (m3u8) {
                    console.log('[Multiview Cleaner] M3U8 trouvé pour support mobile :', m3u8);

                    // Créer un bouton d'action rapide pour Mobile
                    const btnContainer = document.createElement('div');
                    btnContainer.style.cssText = 'position:absolute; top:50px; right:10px; z-index:9999999; display:flex; flex-direction:column; gap:8px;';

                    // Bouton 1: Tenter de forcer le lecteur natif (permet le Cast iOS/Android)
                    const forceNativeBtn = document.createElement('button');
                    forceNativeBtn.innerText = '📱 Force Native Player (Cast)';
                    forceNativeBtn.style.cssText = 'background:rgba(0,122,255,0.8); color:white; border:none; padding:8px 12px; border-radius:8px; font-weight:bold; font-size:12px; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.5);';
                    forceNativeBtn.onclick = () => {
                        videoElement.src = m3u8;
                        videoElement.load();
                        videoElement.play().catch(e => console.log(e));
                        forceNativeBtn.style.display = 'none';
                    };

                    // Bouton 2: Ouvrir dans une app de Cast tierce (ex: Web Video Caster, VLC)
                    const openExternalBtn = document.createElement('button');
                    openExternalBtn.innerText = '📺 Open in Cast App';
                    openExternalBtn.style.cssText = 'background:rgba(255,149,0,0.8); color:white; border:none; padding:8px 12px; border-radius:8px; font-weight:bold; font-size:12px; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.5);';
                    openExternalBtn.onclick = () => {
                        window.location.href = m3u8;
                    };

                    btnContainer.appendChild(forceNativeBtn);
                    btnContainer.appendChild(openExternalBtn);

                    const parent = videoElement.parentElement;
                    if (parent) {
                        parent.appendChild(btnContainer);
                    }
                }
            }
        }, 2000);
    }
// ----------------------------

    /* Écouteur des ordres de l'application, posé À LA RACINE.

       Il vivait auparavant DANS `cleanEverythingOutside`, donc il n'existait qu'une fois
       le nettoyage réussi. Sur une page où le lecteur n'a jamais été trouvé — le cas même
       où l'utilisateur a besoin d'agir — la tuile n'obéissait donc à rien : ni couper le
       son, ni nettoyer. */
    window.mvUnmutedState = false;

    /* Le son a-t-il TENU ? La question n'est pas comment il échoue — la vidéo peut se
       mettre en pause, ou la relance muette de `tenterLecture` peut reprendre la main —
       mais s'il est là 400 ms plus tard. On regarde donc l'état réel : une vidéo qui
       joue mais qui est muette, alors qu'on a demandé le son, est un refus.

       Et si rendre le son l'a ARRÊTÉE, on remet le muet et on la relance : une vidéo qui
       joue sans son vaut mieux qu'une vidéo arrêtée. */
    function verifierLeSon() {
        setTimeout(() => {
            const videos = toutesLesVideos();
            const v = videos.find((x) => x.offsetWidth > 50 || x.offsetHeight > 50) || videos[0];
            if (!v) return;
            if (v.paused) {
                v.muted = true;
                v.volume = 0;
                try { const p = v.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
            }
            const bloque = !!v.muted;
            if (bloque) window.mvUnmutedState = false;
            try {
                window.top.postMessage({ __mv: 'sound_state', unmuted: !bloque, blocked: bloque }, '*');
            } catch (e) {}
        }, 400);
    }

    window.addEventListener('message', function(e) {
        /* Seule la fenêtre qui nous encadre commande. Sans ce filtre, n'importe quel
           cadre de la page (une régie publicitaire, par exemple) pourrait nous piloter.
           La comparaison porte sur la référence CAPTURÉE au démarrage : `window.parent`
           rend un Proxy neuf à chaque lecture depuis le piège anti-détournement. */
        if (e.source !== FENETRE_PARENTE) return;

        if (e.data === 'mv_mute' || e.data === 'mv_unmute' || e.data === 'mv_play') {
            try {
                document.querySelectorAll('iframe').forEach(function (ifr) {
                    if (ifr.contentWindow) ifr.contentWindow.postMessage(e.data, '*');
                });
            } catch (err) {}
        }

        if (e.data === 'mv_mute' || e.data === 'mv_unmute') {
            const couper = (e.data === 'mv_mute');
            window.mvUnmutedState = !couper;
            toutesLesVideos().concat(Array.from(document.querySelectorAll('audio'))).forEach(el => {
                el.muted = couper;
                el.volume = couper ? 0 : 1;
            });
            /* La tuile qui prend le son est celle qu'on regarde : si sa vidéo attend
               encore un clic, on le donne. */
            if (!couper && cleaned) tenterLecture(mainPlayerBase);
            /* « Son automatique on » (13 septembre 2026). Rendre le son peut faire
               ARRÊTER la vidéo : sans activation de l'utilisateur, le navigateur
               n'autorise que le muet. On vérifie donc le résultat plutôt que de le
               supposer — et si la lecture est tombée, on remet le muet (une vidéo qui
               joue sans son vaut mieux qu'une vidéo arrêtée) et on le DIT à
               l'application, qui n'insistera plus jusqu'au prochain geste. */
            if (!couper) verifierLeSon();
        } else if (e.data === 'mv_clean') {
            /* Nettoyage à la demande. L'application l'envoie quand la tuile vient de se
               charger et quand l'utilisateur lève le bac à sable : à ce moment-là le
               lecteur apparaît souvent pour la première fois, longtemps après que la
               recherche automatique a renoncé. */
            relancerRecherche();
        } else if (e.data === 'mv_play') {
            /* « Lecture automatique des lecteurs » (12 septembre 2026). Le mode câble
               l'envoie après chaque changement de chaîne ou de source, trois fois à 1,2 s
               d'intervalle : le lecteur d'un site apparaît souvent après le chargement.
               Contrairement à `mv_unmute`, cet ordre n'attend PAS que le nettoyage ait
               réussi — c'est justement sur une page où le lecteur n'a pas été trouvé que
               la vidéo reste en pause, et `tenterLecture` sait travailler sur tout le
               document. */
            lancerLectureImmediate(mainPlayerBase || document);
        } else if (e.data === 'mv_play') {
            /* « Lecture automatique des lecteurs » (12 septembre 2026). Le mode câble
               l'envoie après chaque changement de chaîne ou de source, trois fois à 1,2 s
               d'intervalle : le lecteur d'un site apparaît souvent après le chargement.
               Contrairement à `mv_unmute`, cet ordre n'attend PAS que le nettoyage ait
               réussi — c'est justement sur une page où le lecteur n'a pas été trouvé que
               la vidéo reste en pause, et `tenterLecture` sait travailler sur tout le
               document. */
            lancerLectureImmediate(mainPlayerBase || document);
        }
    });

    /* Le clic est la seule activation que Firefox accepte pour le son. On le rend
       dans le même tour que le geste : après un aller-retour avec l'application,
       l'activation est périmée et le navigateur remet le muet. Le lecteur est souvent
       un cadre plus bas ; ce script y tourne aussi, donc le clic tombe là où est la vidéo. */
    window.addEventListener('mousedown', function () {
        window.mvUnmutedState = true;
        toutesLesVideos().concat(Array.from(document.querySelectorAll('audio'))).forEach(function (el) {
            el.muted = false;
            el.volume = 1;
        });
        try { window.top.postMessage('mv_frame_clicked', '*'); } catch (e) {}
    }, true);

    /* « Vidéo en lecture » : le seul signal fiable que la tuile puisse recevoir.

       Depuis l'application, une iframe d'origine croisée est opaque : elle ne peut pas
       savoir si un lecteur joue, si une page anti-adblock a pris sa place, ou si rien
       n'est jamais venu. Ce script, lui, est DANS le cadre. Il regarde les <video> et dit
       à la fenêtre principale quand l'une joue vraiment (données prêtes, non en pause,
       temps qui avance) ; la tuile s'en sert pour marquer la source, pour apprendre quels
       hôtes jouent, et pour passer à la source suivante quand rien ne vient en 30 s. */
    /* Débit et définition réels, pour la liste des sources (voir js/debit.js).

       « Moyen d'avoir le débit dans la liste des feeds ? » La liste n'affichait que la
       qualité ANNONCÉE par la source, du déclaratif souvent faux. Ici on mesure :
         - la définition vient de l'élément <video> lui-même, toujours exacte ;
         - le débit vient des octets réellement transférés (chronologie des ressources).
           Il n'est PAS toujours mesurable : `transferSize` d'une ressource d'origine
           croisée vaut 0 tant que le serveur n'envoie pas `Timing-Allow-Origin`, ce que
           beaucoup de CDN omettent. Dans ce cas on rapporte 0, et l'application n'affiche
           rien plutôt qu'un chiffre inventé. */
    const SEGMENT_MEDIA = /\.(ts|m4s|mp4|m4v|aac|mp3|cmfv|cmfa)(\?|$)/i;
    const FENETRE_DEBIT_MS = 10000;
    function mesurerDebit() {
        let octets = 0;
        try {
            const maintenant = performance.now();
            performance.getEntriesByType('resource').forEach((e) => {
                if (!e || !SEGMENT_MEDIA.test(e.name || '')) return;
                if (maintenant - e.startTime > FENETRE_DEBIT_MS) return;
                const n = (e.transferSize | 0) || (e.encodedBodySize | 0);
                if (n > 0) octets += n;
            });
        } catch (e) { return 0; }
        if (!octets) return 0;
        return Math.round((octets * 8) / (FENETRE_DEBIT_MS / 1000) / 1000);
    }
    function signalerMesure() {
        let v = null;
        toutesLesVideos().forEach((el) => {
            if (!v && el.videoHeight > 0) v = el;
        });
        const kbps = mesurerDebit();
        const w = v ? (v.videoWidth | 0) : 0;
        const h = v ? (v.videoHeight | 0) : 0;
        if (!kbps && !h) return; // rien de mesurable : on se tait
        try { window.top.postMessage({ __mv: 'video_stats', kbps: kbps, w: w, h: h, host: location.hostname }, '*'); } catch (e) {}
    }

    let derniereLecture = null;
    function signalerLecture() {
        let joue = false;
        let enPause = false;
        toutesLesVideos().forEach((v) => {
            if (v.readyState >= 3 && !v.paused && (v.currentTime > 0 || !v.ended)) joue = true;
            else if (v.readyState >= 3 && v.paused && !v.ended) enPause = true;
        });
        if (joue === derniereLecture) return;
        derniereLecture = joue;
        /* `cause` dit à l'application POURQUOI ça ne joue plus, et c'est elle qui décide :
           une vidéo prête mais arrêtée (`pause`) est un geste de l'utilisateur, recharger
           la tuile par-dessus serait une nuisance ; un ré-tampon ou un segment perdu
           (`attente`) et un lecteur disparu de la page (`absente`) méritent au contraire
           un rechargement de la MÊME source, plutôt qu'un changement de source
           (js/playability.js, arretMeriteRechargement). Un script plus ancien n'envoie
           pas ce champ : l'application retombe alors sur le dernier clic vu dans le
           cadre, qui distingue déjà une pause d'une panne. */
        const cause = joue ? 'joue' : (enPause ? 'pause' : (toutesLesVideos().length ? 'attente' : 'absente'));
        try { window.top.postMessage({ __mv: 'video_state', playing: joue, cause: cause, host: location.hostname }, '*'); } catch (e) {}
    }
    /* Mode direct (voir js/directmedia.js) : pendant que la page joue, on voit passer le
       MANIFESTE vidéo que son lecteur demande (.m3u8 / .mpd, dans la chronologie des
       ressources du cadre) et on le remonte à l'application, qui peut alors le jouer
       dans son propre lecteur, sans la page. Chaque manifeste n'est signalé qu'une fois ;
       le premier vu est le maître. */
    const manifestesSignales = new Set();
    function estManifeste(u) {
        u = String(u || '');
        if (!/^https?:\/\//i.test(u)) return false;
        const chemin = u.split('#')[0].split('?')[0];
        if (/(^|\/)(ads?|preroll|vast|vmap)(\/|\.|$)/i.test(chemin)) return false;
        return /\.(m3u8|mpd)$/i.test(chemin);
    }
    function signalerManifeste(u) {
        if (!estManifeste(u) || manifestesSignales.has(u)) return;
        manifestesSignales.add(u);
        try { window.top.postMessage({ __mv: 'media_url', url: u, pageUrl: location.href, host: location.hostname }, '*'); } catch (e) {}
    }
    function surveillerManifestes() {
        try { performance.getEntriesByType('resource').forEach((e) => signalerManifeste(e.name)); } catch (e) {}
        try {
            const obs = new PerformanceObserver((liste) => { liste.getEntries().forEach((e) => signalerManifeste(e.name)); });
            obs.observe({ type: 'resource', buffered: true });
        } catch (e) {}
    }

    /* ═══ LECTURE IMMÉDIATE ═══════════════════════════════════════════════════════
       Demande du 6 septembre 2026 : « faire que les vidéos dans le multiview se lancent
       directement ». Une fois la page réduite à son lecteur, la vidéo attendait encore
       un clic : un gros bouton de lecture au milieu, ou un lecteur créé en pause. Depuis
       l'application, rien ne peut le donner — une iframe d'origine croisée n'obéit pas.
       Ce script, lui, est dans le cadre.

       Deux gestes, répétés une douzaine de fois à une seconde d'intervalle, puis à
       chaque fois que l'application rend le son à la tuile :
         - `play()` sur chaque <video>. Refusé avec le son (politique de lecture
           automatique), on coupe le son et on réessaie : une vidéo muette qui joue vaut
           mieux qu'une vidéo arrêtée, et l'application rend le son à la tuile active.
         - un clic sur le gros bouton de lecture des lecteurs connus (JW Player,
           Video.js, Plyr, DPlayer, Clappr, Fluid…), cherché dans le lecteur seulement —
           jamais dans le décor, qui n'existe d'ailleurs plus. Chaque bouton n'est cliqué
           qu'une fois : un second clic mettrait en pause.
       On s'arrête dès qu'une vidéo joue. */
    const BOUTONS_LECTURE = [
        '.jw-display-icon-display', '.jw-icon-playback', '.vjs-big-play-button',
        '.plyr__control--overlaid', '.dplayer-mask', '.dplayer-play-icon', '.clappr-poster',
        '.fluid_initial_play', '.ytp-large-play-button', '.mejs__overlay-play',
        '[class*="big-play"]', '[class*="bigplay"]', '[class*="play-button"]', '[class*="playbtn"]',
        '[class*="play-btn"]', '[class*="btn-play"]', '[id*="play-button"]',
        'button[aria-label="Play"]', 'button[aria-label="Lecture"]', 'button[title="Play"]'
    ];
    function videoJoue(v) { return !!v && !v.paused && !v.ended && v.readyState >= 2; }
    function tenterLecture(base) {
        try {
            const videos = toutesLesVideos();
            if (videos.some(videoJoue)) return true;
            videos.forEach((v) => {
                try {
                    v.setAttribute('playsinline', '');
                    v.autoplay = true;
                    const p = v.play();
                    if (p && typeof p.catch === 'function') {
                        p.catch(() => {
                            if (v.muted || window.mvUnmutedState) return;
                            v.muted = true;
                            try { const q = v.play(); if (q && q.catch) q.catch(() => {}); } catch (e) {}
                        });
                    }
                } catch (e) {}
            });
            const zone = (base && base.querySelector) ? base : document;
            for (const sel of BOUTONS_LECTURE) {
                let el = null;
                try { el = zone.querySelector(sel); } catch (e) { el = null; }
                if (!el || el.dataset.mvClique || !(el.offsetWidth > 0 || el.offsetHeight > 0)) continue;
                el.dataset.mvClique = '1';
                try { el.click(); } catch (e) {}
                break;
            }
        } catch (e) {}
        return false;
    }
    let boucleLecture = null;
    function lancerLectureImmediate(base) {
        if (boucleLecture) { clearInterval(boucleLecture); boucleLecture = null; }
        if (tenterLecture(base)) return;
        let n = 0;
        boucleLecture = setInterval(() => {
            if (++n > 12 || tenterLecture(base)) { clearInterval(boucleLecture); boucleLecture = null; }
        }, 1000);
    }

    /* Cadre intérieur refusé par Firefox.

       La page hôte, elle, s'est affichée. Le lecteur est souvent une iframe de plus,
       et X-Frame-Options la remplace par « Firefox ne peut pas ouvrir cette page ».
       Un cadre qui a VRAIMENT chargé une autre origine lève une exception quand on
       lit son document : on n'y touche pas. Un cadre refusé, lui, laisse lire la page
       d'erreur du navigateur. On ne reprend que celle-là, une seule fois : on
       télécharge le HTML par GM_xmlhttpRequest (les cookies du visiteur, pas un proxy)
       et on le pose en srcdoc. L'origine reste celle de la page hôte, pas celle de
       l'application. about:blank et une page encore vide ne comptent pas. */
    var REFUS_CADRE = /can.?t open this page|refused to (display|connect)|will not allow firefox to display|ne peut pas ouvrir cette page|n'autorise pas firefox|x-frame-options/i;
    var cadresRepris = 0;
    function reprendreCadreRefuse(iframe) {
        if (!iframe || cadresRepris >= 1 || iframe.__mvRepris) return;
        var src = iframe.getAttribute('src') || '';
        if (!/^https?:\/\//i.test(src)) return;
        var texte = '';
        try {
            var doc = iframe.contentDocument;
            if (!doc || !doc.body) return;
            texte = doc.body.innerText || '';
        } catch (e) { return; }
        if (texte.length < 40 || !REFUS_CADRE.test(texte)) return;
        var GM_FETCH = (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest
            : (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') ? GM.xmlHttpRequest
            : null;
        if (!GM_FETCH) return;
        iframe.__mvRepris = 1;
        cadresRepris++;
        try {
            GM_FETCH({
                method: 'GET',
                url: src,
                timeout: 15000,
                headers: { 'Referer': src },
                onload: function (res) {
                    var body = res && typeof res.responseText === 'string' ? res.responseText : '';
                    if (!body || body.length < 200 || !res || res.status < 200 || res.status >= 400) return;
                    if (body.length > 1500000) body = body.slice(0, 1500000);
                    var base = String((res && res.finalUrl) || src).replace(/"/g, '&quot;');
                    try {
                        iframe.removeAttribute('src');
                        iframe.srcdoc = '<base href="' + base + '">' + body;
                    } catch (e) {}
                }
            });
        } catch (e) { iframe.__mvRepris = 0; cadresRepris--; }
    }

    /* « Ça pogne pas toujours le bon iframe (genre chat) » (13 octobre 2026). Le choix
       gardait la PLUS GRANDE iframe de la page, et une boîte de discussion en colonne
       (350 × 700, soit 245 000 px²) bat un lecteur 640 × 360 (230 400 px²) : la tuile
       était réduite au chat, et comme `cleaned` ne se relève plus, le lecteur n'avait
       plus aucune chance. Deux garde-fous :
         - un cadre qui se DIT discussion — par son adresse, ou par l'id, la classe, le
           nom ou le titre de lui-même ou de ses emballages proches — est écarté, et la
           recherche continue d'attendre le vrai lecteur ;
         - parmi les autres, un cadre en portrait ne vaut qu'un tiers de sa surface : un
           lecteur est en paysage, une colonne latérale presque jamais. */
    var DISCUSSION_RE = /chat|shout|cbox|minnit|tlk\.io|rumbletalk|disqus|comment|discussion|messenger|tawk\.to/i;

    function estCadreDeDiscussion(ifr) {
        var src = ifr.getAttribute('src') || ifr.getAttribute('data-src') || '';
        try { var u = new URL(src, location.href); src = u.hostname + u.pathname + u.search; } catch (e) {}
        if (DISCUSSION_RE.test(src)) return true;
        var el = ifr;
        for (var n = 0; el && el !== document.body && n < 4; n++, el = el.parentElement) {
            /* Un emballage ne parle que de ce qu'il contient SEUL. S'il porte aussi le
               lecteur (« stream-chat-container », « player-with-chat »), son nom ne dit rien
               de CE cadre : sans cette règle, le lecteur d'une telle page était écarté et la
               page n'était jamais nettoyée (18 octobre 2026). */
            if (n > 0 && el.querySelectorAll('iframe, video').length > 1) break;
            var cls = typeof el.className === 'string' ? el.className : '';
            var noms = [el.id, cls, el.getAttribute('name'), el.getAttribute('title'), el.getAttribute('aria-label')].join(' ');
            if (DISCUSSION_RE.test(noms)) return true;
        }
        return false;
    }

    function noteCadre(ifr) {
        var w = ifr.offsetWidth, h = ifr.offsetHeight;
        return w * h * (h > w ? 1 / 3 : 1);
    }

    function findAndClean() {
        if (cleaned) return;

        try { const m = extractM3u8Url(); if (m) signalerManifeste(m); } catch (e) {}

        // Chercher une vidéo
        const videos = toutesLesVideos().filter(v => v.offsetWidth > 50 || v.offsetHeight > 50);
        if (videos.length > 0) {
            const bestVideo = videos.sort((a, b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight))[0];
            cleanEverythingOutside(horsDeLOmbre(bestVideo));
            return;
        }

        // Chercher une iframe (si la vidéo est dans une sous-iframe sur le site)
        const iframes = Array.from(document.querySelectorAll('iframe'))
            .filter(ifr => ifr.offsetWidth > 200 && ifr.offsetHeight > 150 && !estCadreDeDiscussion(ifr));
        if (iframes.length > 0) {
            const bestIframe = iframes.sort((a, b) => noteCadre(b) - noteCadre(a))[0];
            if (!bestIframe.__mvEcouteRefus) {
                bestIframe.__mvEcouteRefus = 1;
                bestIframe.addEventListener('load', function () { reprendreCadreRefuse(bestIframe); });
                setTimeout(function () { reprendreCadreRefuse(bestIframe); }, 2000);
            }
            reprendreCadreRefuse(bestIframe);
            cleanEverythingOutside(bestIframe);
            return;
        }
    }

    /* Recherche du lecteur.

       L'ancienne version sondait toutes les 500 ms puis ABANDONNAIT au bout de 15
       secondes, définitivement. C'est trop court pour ces sites : le lecteur arrive au
       bout d'une chaîne d'iframes imbriquées, et certains annoncent eux-mêmes « stream
       will go live 30 minutes before the match starts ». Passé le délai, plus rien ne
       relançait la recherche — la page restait entière autour de la vidéo, ce qui est
       exactement ce que ce script est censé éviter.

       Trois déclencheurs désormais, du moins cher au plus sûr :
         - le sondage périodique : toutes les 500 ms pendant 15 secondes, puis toutes
           les 3 secondes jusqu'au nettoyage ;
         - un observateur du DOM, qui ne coûte rien tant que rien n'arrive et réagit à
           l'apparition tardive d'une <video> ou d'une <iframe> ;
         - l'ordre `mv_clean` de l'application, qui relance tout.
       L'observateur s'arrête de lui-même dès que le nettoyage a réussi. */
    let interval = null;
    let observateur = null;
    let versSondageLent = null;

    /* Après les 15 premières secondes, le sondage ralentit au lieu de s'arrêter
       (18 octobre 2026). L'observateur ne voit que des nœuds AJOUTÉS : un lecteur déjà
       dans la page mais caché (compte à rebours, avis à fermer) ou dimensionné plus tard
       par le site n'ajoute rien quand il apparaît, et la page restait entière. Une
       recherche toutes les 3 s ne coûte presque rien et s'arrête au nettoyage. */
    var SONDAGE_LENT_MS = 3000;

    function arreterRecherche() {
        if (interval) { clearInterval(interval); interval = null; }
        if (versSondageLent) { clearTimeout(versSondageLent); versSondageLent = null; }
        if (observateur) { observateur.disconnect(); observateur = null; }
    }

    /* Une exception dans la recherche ne doit JAMAIS emporter le script.

       Ces pages sont hostiles et changent sans prévenir ; une seule erreur non rattrapée
       tuait l'intervalle, l'observateur et toute possibilité de rattrapage — la tuile
       restait entière autour de la vidéo, sans que rien ne le signale. On isole donc
       chaque passe, et on continue. */
    function chercherSansCasser() {
        try { findAndClean(); }
        catch (e) { console.log('[Multiview Cleaner] passe de nettoyage en échec :', e && e.message); }
    }

    function relancerRecherche() {
        if (cleaned) return;
        arreterRecherche();
        chercherSansCasser();
        if (cleaned) return;

        const sonder = () => {
            if (cleaned) { arreterRecherche(); return; }
            chercherSansCasser();
        };
        interval = setInterval(sonder, 500);
        versSondageLent = setTimeout(() => {
            versSondageLent = null;
            if (interval) clearInterval(interval);
            interval = cleaned ? null : setInterval(sonder, SONDAGE_LENT_MS);
        }, 15000);

        /* Le sondage ralentit, l'observateur reste : c'est lui qui rattrape le plus vite
           un lecteur qui n'arrive qu'au bout de plusieurs minutes.

           `document.body` peut ne pas exister encore selon le moment où le gestionnaire
           d'extensions injecte le script. Sans cette attente, l'observateur n'était jamais
           posé et le rattrapage tardif ne marchait pas — le défaut même qu'on corrige. */
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', () => { if (!cleaned) relancerRecherche(); }, { once: true });
        } else {
            observateur = new MutationObserver((mutations) => {
                if (cleaned) { arreterRecherche(); return; }
                for (const mut of mutations) {
                    for (const n of mut.addedNodes) {
                        if (n.nodeType !== 1) continue;
                        if (n.tagName === 'VIDEO' || n.tagName === 'IFRAME'
                            || (n.querySelector && n.querySelector('video, iframe'))) {
                            chercherSansCasser();
                            if (cleaned) { arreterRecherche(); return; }
                        }
                    }
                }
            });
            observateur.observe(document.body, { childList: true, subtree: true });
        }
    }

    /* Le nettoyage et le signal de lecture attendent le DOM ; le blocage des popups, lui,
       est déjà posé (voir plus haut). */
    function demarrer() {
        if (estLApplication()) return;
        setInterval(signalerLecture, 2000);
        /* Plus lent que le signal de lecture : une mesure de débit a besoin d'une fenêtre
           de dix secondes pour valoir quelque chose. */
        setInterval(signalerMesure, 5000);
        surveillerManifestes();
        relancerRecherche();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer, { once: true });
    else demarrer();

})();

/* ═══ PONT D'AFFICHAGE (fenetre principale de l'application) ═══════════════════

   Un serveur qui repond `X-Frame-Options: DENY` fait refuser l'affichage encadre par
   le navigateur lui-meme, avant tout JavaScript : ni l'application ni ce script ne
   peuvent lever ce refus depuis l'iframe. Le seul contournement est de ne pas laisser
   le navigateur charger l'adresse dans l'iframe — on telecharge le HTML par un canal
   que `X-Frame-Options` ne regit pas (cet en-tete ne concerne QUE l'encadrement), et
   l'application le pose dans l'iframe via `srcdoc` (voir js/embed-bridge.js).

   GM_xmlhttpRequest est ce canal : il ignore la politique d'origine croisee et envoie
   les cookies du navigateur, donc il passe la ou un proxy CORS se fait refouler. Ce
   bloc s'execute uniquement dans la fenetre principale de l'application (jamais dans
   une iframe, jamais sur un autre site) et seulement apres que l'application se soit
   annoncee : aucun autre site ne peut s'en servir pour lire des pages a la place de
   l'utilisateur. */
(function () {
    'use strict';

    if (window.self !== window.top) return;

    var GM_FETCH = (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest
        : (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') ? GM.xmlHttpRequest
        : null;
    if (!GM_FETCH) return;

    /* Doit suivre @version de l'en-tête : c'est CE nombre que l'application reçoit et
       affiche. Désynchronisé, le script s'annonce sous une version qu'il n'a plus. */
    var VERSION = '1.17';
    var MAX_BYTES = 4 * 1024 * 1024;

    /* Lecture BINAIRE, pour le mode direct (18 octobre 2026, « le bouton direct, ça marche
       avec AUCUN SITE »). Les CDN de ces flux ne répondent `Access-Control-Allow-Origin`
       qu'à l'origine de leur propre lecteur, et plusieurs refusent un `Referer` qui n'est
       pas le sien : le manifeste demandé par l'application était refusé avant la première
       image. GM_xmlhttpRequest n'est pas soumis à CORS et pose le `Referer` du lecteur ;
       l'application y fait passer manifestes, clés et segments (js/directmedia.js,
       chargeurParPont). Annoncé seulement sous un vrai gestionnaire de scripts
       (Tampermonkey, Violentmonkey, Greasemonkey : `GM_info`) : les copies de
       l'extension, de la version de bureau et de l'APK bâtissent GM_xmlhttpRequest sur
       `fetch`, qui ne sait ni lire en binaire ni poser un `Referer`. */
    var BINAIRE = (typeof GM_info !== 'undefined') || (typeof GM !== 'undefined' && !!GM && !!GM.info);
    var MAX_OCTETS_BINAIRES = 64 * 1024 * 1024;

    function lireBinaire(d) {
        var repondre = function(r) {
            r.__mvBridge = 'mv_bridge_page';
            r.id = d.id;
            window.postMessage(r, '*');
        };
        var entetes = {};
        if (typeof d.referer === 'string' && /^https?:\/\//i.test(d.referer)) entetes['Referer'] = d.referer;
        if (typeof d.origine === 'string' && /^https?:\/\//i.test(d.origine)) entetes['Origin'] = d.origine;
        if (typeof d.plage === 'string' && /^bytes=\d*-\d*$/.test(d.plage)) entetes['Range'] = d.plage;
        try {
            GM_FETCH({
                method: 'GET',
                url: d.url,
                timeout: Math.min(Math.max(Number(d.timeout) || 20000, 1000), 60000),
                headers: entetes,
                responseType: 'arraybuffer',
                onload: function (res) {
                    var octets = res && res.response;
                    var taille = octets && typeof octets.byteLength === 'number' ? octets.byteLength : -1;
                    var ok = !!res && res.status >= 200 && res.status < 400 && taille >= 0 && taille <= MAX_OCTETS_BINAIRES;
                    repondre({ ok: ok, binaire: true, octets: ok ? octets : null, status: res && res.status, finalUrl: (res && res.finalUrl) || d.url, error: ok ? '' : ('HTTP ' + (res && res.status)) });
                },
                onerror: function () { repondre({ ok: false, binaire: true, error: 'echec reseau' }); },
                ontimeout: function () { repondre({ ok: false, binaire: true, delai: true, error: 'delai depasse' }); }
            });
        } catch (err) {
            repondre({ ok: false, binaire: true, error: String(err && err.message || err) });
        }
    }

    function isGuideApp() {
        // L'application est reconnue a sa structure, pas a son adresse : elle tourne
        // aussi bien depuis GitHub Pages qu'en local ou dans l'application Android.
        return !!(document.querySelector('#marea') && document.querySelector('.epg'));
    }

    function announce() {
        window.postMessage({ __mvBridge: 'mv_bridge_ready', version: VERSION, binaire: BINAIRE }, '*');
    }

    window.addEventListener('message', function (e) {
        // Meme fenetre uniquement : postMessage d'une autre origine porte une source
        // differente, et l'application ne s'adresse qu'a elle-meme.
        if (e.source !== window) return;
        var d = e.data;
        if (!d || typeof d !== 'object' || !d.__mvBridge) return;
        if (!isGuideApp()) return;

        if (d.__mvBridge === 'mv_bridge_hello') { announce(); return; }

        if (d.__mvBridge === 'mv_bridge_fetch' && d.id && typeof d.url === 'string') {
            if (!/^https?:\/\//i.test(d.url)) {
                window.postMessage({ __mvBridge: 'mv_bridge_page', id: d.id, ok: false, error: 'adresse invalide' }, '*');
                return;
            }
            if (d.binaire) {
                if (BINAIRE) lireBinaire(d);
                else window.postMessage({ __mvBridge: 'mv_bridge_page', id: d.id, ok: false, binaire: true, error: 'lecture binaire indisponible' }, '*');
                return;
            }
            try {
                GM_FETCH({
                    method: 'GET',
                    url: d.url,
                    timeout: 15000,
                    headers: { 'Referer': d.url },
                    onload: function (res) {
                        var body = res && typeof res.responseText === 'string' ? res.responseText : '';
                        if (body.length > MAX_BYTES) body = body.slice(0, MAX_BYTES);
                        window.postMessage({
                            __mvBridge: 'mv_bridge_page',
                            id: d.id,
                            ok: !!body && res.status >= 200 && res.status < 400,
                            html: body,
                            finalUrl: (res && res.finalUrl) || d.url,
                            error: body ? '' : ('HTTP ' + (res && res.status))
                        }, '*');
                    },
                    onerror: function () {
                        window.postMessage({ __mvBridge: 'mv_bridge_page', id: d.id, ok: false, error: 'echec reseau' }, '*');
                    },
                    ontimeout: function () {
                        window.postMessage({ __mvBridge: 'mv_bridge_page', id: d.id, ok: false, error: 'delai depasse' }, '*');
                    }
                });
            } catch (err) {
                window.postMessage({ __mvBridge: 'mv_bridge_page', id: d.id, ok: false, error: String(err && err.message || err) }, '*');
            }
        }
    });

    // Le script tourne a document-start, avant le DOM de l'application : on s'annonce
    // spontanement une fois le document lu, puis une seconde fois par prudence, sans
    // attendre son bonjour (auquel on repond aussi, ci-dessus).
    function annoncerSiApplication() { if (isGuideApp()) announce(); }
    function annoncer() { annoncerSiApplication(); setTimeout(annoncerSiApplication, 1500); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', annoncer, { once: true });
    else annoncer();
})();

    } catch (e) {
        try { console.error('[Guide des Sports] le script de nettoyage a échoué : ' + (e && e.message)); } catch (e2) {}
    }
})();

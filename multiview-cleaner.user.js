// ==UserScript==
// @name         Multiview Stream Cleaner
// @namespace    http://tampermonkey.net/
// @version      1.8
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

    // Ne pas nettoyer notre propre application (Guide TV), par sécurité
    function estLApplication() {
        return document.title.includes('Guide TV') || !!document.querySelector('#marea') || !!document.querySelector('.epg');
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
               rend 'window.top' et 'window.parent' inertes en écriture pour ce cadre.
               Chaque piège est indépendant : si l'un est refusé par la page, les autres
               tiennent quand même. */
            try {
                const bloque = (quoi) => {
                    console.log('[Multiview Cleaner] Navigation de plus haut niveau bloquée (' + quoi + ')');
                };
                for (const cible of ['top', 'parent']) {
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
                    window.parent.postMessage('mv_frame_clicked', '*');
                }
            });

            mediaEl.addEventListener('play', function() {
                 if (!mediaEl.muted && mediaEl.volume > 0 && !window.mvUnmutedState) {
                    window.parent.postMessage('mv_frame_clicked', '*');
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
            window.parent.postMessage('mv_frame_clicked', '*');
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
    window.addEventListener('message', function(e) {
        /* Seule la fenêtre qui nous encadre commande. Sans ce filtre, n'importe quel
           cadre de la page (une régie publicitaire, par exemple) pourrait nous piloter.
           La comparaison porte sur la référence CAPTURÉE au démarrage : `window.parent`
           rend un Proxy neuf à chaque lecture depuis le piège anti-détournement. */
        if (e.source !== FENETRE_PARENTE) return;

        if (e.data === 'mv_mute' || e.data === 'mv_unmute') {
            const couper = (e.data === 'mv_mute');
            window.mvUnmutedState = !couper;
            document.querySelectorAll('video, audio').forEach(el => {
                el.muted = couper;
                el.volume = couper ? 0 : 1;
            });
            /* La tuile qui prend le son est celle qu'on regarde : si sa vidéo attend
               encore un clic, on le donne. */
            if (!couper && cleaned) tenterLecture(mainPlayerBase);
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
        document.querySelectorAll('video').forEach((el) => {
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
        document.querySelectorAll('video').forEach((v) => {
            if (v.readyState >= 3 && !v.paused && (v.currentTime > 0 || !v.ended)) joue = true;
        });
        if (joue === derniereLecture) return;
        derniereLecture = joue;
        try { window.top.postMessage({ __mv: 'video_state', playing: joue, host: location.hostname }, '*'); } catch (e) {}
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
            const videos = Array.from(document.querySelectorAll('video'));
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

    function findAndClean() {
        if (cleaned) return;

        try { const m = extractM3u8Url(); if (m) signalerManifeste(m); } catch (e) {}

        // Chercher une vidéo
        const videos = Array.from(document.querySelectorAll('video')).filter(v => v.offsetWidth > 50 || v.offsetHeight > 50);
        if (videos.length > 0) {
            const bestVideo = videos.sort((a, b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight))[0];
            cleanEverythingOutside(bestVideo);
            return;
        }

        // Chercher une iframe (si la vidéo est dans une sous-iframe sur le site)
        const iframes = Array.from(document.querySelectorAll('iframe')).filter(ifr => ifr.offsetWidth > 200 && ifr.offsetHeight > 150);
        if (iframes.length > 0) {
            const bestIframe = iframes.sort((a, b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight))[0];
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
         - le sondage périodique, gardé pour les 15 premières secondes ;
         - un observateur du DOM, qui ne coûte rien tant que rien n'arrive et réagit à
           l'apparition tardive d'une <video> ou d'une <iframe> ;
         - l'ordre `mv_clean` de l'application, qui relance tout.
       L'observateur s'arrête de lui-même dès que le nettoyage a réussi. */
    let interval = null;
    let observateur = null;

    function arreterRecherche() {
        if (interval) { clearInterval(interval); interval = null; }
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

        interval = setInterval(() => {
            if (cleaned) { arreterRecherche(); return; }
            chercherSansCasser();
        }, 500);
        setTimeout(() => { if (interval) { clearInterval(interval); interval = null; } }, 15000);

        /* Le sondage s'arrête, l'observateur reste : c'est lui qui rattrape un lecteur
           qui n'arrive qu'au bout de plusieurs minutes.

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
    var VERSION = '1.8';
    var MAX_BYTES = 4 * 1024 * 1024;

    function isGuideApp() {
        // L'application est reconnue a sa structure, pas a son adresse : elle tourne
        // aussi bien depuis GitHub Pages qu'en local ou dans l'application Android.
        return !!(document.querySelector('#marea') && document.querySelector('.epg'));
    }

    function announce() {
        window.postMessage({ __mvBridge: 'mv_bridge_ready', version: VERSION }, '*');
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

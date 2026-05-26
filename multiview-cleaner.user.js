// ==UserScript==
// @name         Multiview Stream Cleaner
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Supprime tous les éléments inutiles (pubs, chats, headers) pour ne garder que la vidéo sur les sites de streaming, idéal pour le Multiview.
// @author       Jules
// @match        *://*/*
// @allFrames    true
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Sécurité: Ne s'exécute que si la page est dans une iframe (ex: dans le Multiview)
    if (window.self === window.top) {
        return;
    }

    // Ne pas s'exécuter si on est sur notre propre application (Guide TV) par sécurité
    if (document.title.includes('Guide TV') || document.querySelector('#marea') || document.querySelector('.epg')) {
        return;
    }

    let cleaned = false;
    let mainPlayerBase = null;

    function injectPopupBlocker() {
        // Injecter un script pour bloquer window.open dans le contexte de la page principale (hors bac à sable Tampermonkey)
        const script = document.createElement('script');
        script.textContent = `
            window.open = function() {
                console.log('[Multiview Cleaner] Popup bloqué (window.open)');
                return null;
            };
        `;
        (document.head || document.documentElement).appendChild(script);
        // Clean up the script tag to keep DOM tidy
        script.remove();

        // Intercepter et bloquer les clics sur les liens ouvrant de nouveaux onglets
        document.addEventListener('click', function(e) {
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
        document.head.appendChild(style);
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

        // Par défaut, remonter de 2 niveaux pour garder les contrôles natifs ou wrappers simples
        return element.parentElement ? (element.parentElement.parentElement || element.parentElement) : element;
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

        // We handle this by checking if there's a stored 'mv_unmuted_state'
        window.mvUnmutedState = false;
        window.addEventListener('message', function(e) {
            if (e.data === 'mv_mute') {
                window.mvUnmutedState = false;
                const mediaElements = document.querySelectorAll('video, audio');
                mediaElements.forEach(el => {
                    if (!el.muted || el.volume > 0) {
                        el.muted = true;
                        el.volume = 0;
                    }
                });
            } else if (e.data === 'mv_unmute') {
                window.mvUnmutedState = true;
                const mediaElements = document.querySelectorAll('video, audio');
                mediaElements.forEach(el => {
                    if (el.muted || el.volume === 0) {
                        el.muted = false;
                        el.volume = 1;
                    }
                });
            }
        });

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

    function findAndClean() {
        if (cleaned) return;


        injectPopupBlocker();



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

    // Exécuter périodiquement pour gérer le chargement dynamique
    const interval = setInterval(() => {
        if (cleaned) {
            clearInterval(interval);
            return;
        }
        findAndClean();
    }, 500);

    // Arrêter de chercher après 15 secondes pour économiser les ressources
    setTimeout(() => clearInterval(interval), 15000);

})();

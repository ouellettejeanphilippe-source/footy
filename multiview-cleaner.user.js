// ==UserScript==
// @name         Multiview Stream Cleaner
// @namespace    http://tampermonkey.net/
// @version      1.0
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

    function getPlayerBase(element) {
        // Si c'est une iframe, l'iframe elle-même est une bonne base
        if (element.tagName === 'IFRAME') return element;

        const knownClasses = ['player', 'vjs', 'jw', 'plyr', 'shaka', 'dplayer', 'artplayer', 'flowplayer', 'fp-engine', 'html5-video', 'video-js'];
        let current = element.parentElement;
        let levels = 0;

        while (current && current !== document.body && levels < 5) {
            const className = (current.className || '').toString().toLowerCase();
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

    function cleanEverythingOutside(target) {
        if (cleaned) return;

        mainPlayerBase = getPlayerBase(target);

        let current = mainPlayerBase;
        while (current && current !== document.body) {
            const parent = current.parentElement;
            if (!parent) break;

            // Supprimer tous les frères
            const children = Array.from(parent.children);
            for (const child of children) {
                if (child !== current && !['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD'].includes(child.tagName)) {
                    child.remove();
                }
            }

            // Forcer la taille maximale sur les parents
            parent.style.setProperty('width', '100%', 'important');
            parent.style.setProperty('height', '100%', 'important');
            parent.style.setProperty('margin', '0', 'important');
            parent.style.setProperty('padding', '0', 'important');
            parent.style.setProperty('max-width', '100%', 'important');
            parent.style.setProperty('max-height', '100%', 'important');
            parent.style.setProperty('overflow', 'hidden', 'important');

            current = parent;
        }

        // Maximiser le conteneur du lecteur
        mainPlayerBase.style.setProperty('position', 'fixed', 'important');
        mainPlayerBase.style.setProperty('top', '0', 'important');
        mainPlayerBase.style.setProperty('left', '0', 'important');
        mainPlayerBase.style.setProperty('width', '100vw', 'important');
        mainPlayerBase.style.setProperty('height', '100vh', 'important');
        mainPlayerBase.style.setProperty('z-index', '2147483647', 'important');
        mainPlayerBase.style.setProperty('background-color', '#000', 'important');
        mainPlayerBase.style.setProperty('margin', '0', 'important');
        mainPlayerBase.style.setProperty('padding', '0', 'important');
        mainPlayerBase.style.setProperty('max-width', '100vw', 'important');
        mainPlayerBase.style.setProperty('max-height', '100vh', 'important');

        // Cacher les barres de défilement du body
        document.body.style.setProperty('overflow', 'hidden', 'important');
        document.body.style.setProperty('background-color', '#000', 'important');
        document.body.style.setProperty('margin', '0', 'important');
        document.body.style.setProperty('padding', '0', 'important');

        // Si la cible est une vidéo ou iframe, s'assurer qu'elle prend tout l'espace
        if (target.tagName === 'VIDEO' || target.tagName === 'IFRAME') {
            target.style.setProperty('width', '100%', 'important');
            target.style.setProperty('height', '100%', 'important');
            target.style.setProperty('object-fit', 'contain', 'important');
        }

        cleaned = true;
        console.log('[Multiview Cleaner] Page nettoyée avec succès !');

        // MutationObserver pour supprimer les pubs ou popups qui s'ajoutent après coup
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && !['SCRIPT', 'STYLE', 'LINK', 'META'].includes(node.tagName)) {
                            // Si le nouveau noeud n'est pas notre lecteur et n'est pas contenu dedans
                            if (node !== mainPlayerBase && !mainPlayerBase.contains(node)) {
                                node.remove();
                            }
                        }
                    });
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: false });
    }

    function findAndClean() {
        if (cleaned) return;

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
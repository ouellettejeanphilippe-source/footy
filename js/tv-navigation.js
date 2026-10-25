/**
 * tv-navigation.js
 * Navigation spatiale : télécommande Android TV, et manette (js/manette.js), qui envoie
 * les mêmes flèches.
 *
 * « La manette suit pas dans les modals » (25 octobre 2026, essai sur le Chromecast).
 * Trois défauts, corrigés ici :
 *   - les flèches cherchaient dans TOUTE la page : la fiche d'un match ouverte, le focus
 *     restait sur la carte d'en dessous et partait derrière. Une fenêtre ouverte (ZONES)
 *     garde désormais le focus : il y entre à son ouverture, n'en sort pas, et revient
 *     où il était à sa fermeture ;
 *   - un focus resté sur un élément devenu invisible (un bouton du lecteur, une fois le
 *     lecteur quitté) ne menait plus nulle part : « plus de manette ». Il repart du
 *     premier élément visible ;
 *   - les interrupteurs (leur case est invisible), les listes déroulantes, les sections
 *     repliables, les cartes du Guide (.mb) et des dispositions ([data-mid]) n'étaient pas
 *     atteignables. ◀ ▶ change le choix d'une liste.
 * Et, comme sur Netflix (« améliorer la navigation style Netflix, sans tout refaire ») :
 * le focus de départ est le premier match, pas un onglet ; la carte qui a le focus
 * grossit (tv.css) ; Retour mène à la barre de navigation (actionRetour, js/tele.js).
 *
 * « Dans multiview, un coup de la manette bouge de deux boutons » (même jour) : une
 * touche qu'un composant a déjà traitée (preventDefault) n'est pas traitée une seconde
 * fois ici. Le menu du lecteur (js/mv-menu.js) passait à l'entrée suivante, puis ce
 * script repartait de celle-là ; OK sur un titre de section le repliait, puis le
 * cliquait, ce qui le rouvrait. Et une seconde copie de ce script (mode TV, puis la
 * télé Android) remplace la première au lieu de s'y ajouter.
 */

(function() {
    if (typeof window.__tvNavigationCleanup === 'function') window.__tvNavigationCleanup();
    console.log("TV Navigation Mode initialisé");

    const SELECTEURS = [
        '.match-card',
        '.mb',
        '[data-mid]',
        '.tab-btn',
        '.icon-btn',
        'button',
        '.stream-link',
        '.close-modal',
        '.option-item input',
        'label.switch',
        'summary',
        'select'
    ];

    // Rendre les éléments cliquables focusables
    function makeElementsFocusable() {
        SELECTEURS.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                if (!el.hasAttribute('tabindex')) {
                    el.setAttribute('tabindex', '0');
                    el.classList.add('tv-focusable'); // pour pouvoir les nettoyer
                }
            });
        });
    }

    /* Les fenêtres qui gardent le focus, de la plus haute à la plus basse : le menu du
       lecteur (js/mv-menu.js), le guide des scripts, l'enquêteur, la fiche d'un match,
       le menu Look, le menu ⋯ Plus. */
    const ZONES = ['.mv-menu', '#tm-modal', '#investigator-modal', '#mbg', '#menu-look', '#main-menu.open'];

    function estVisible(el) {
        if (!el || !el.isConnected) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
    }

    function zoneActive() {
        for (const selecteur of ZONES) {
            const els = document.querySelectorAll(selecteur);
            for (let i = els.length - 1; i >= 0; i--) if (estVisible(els[i])) return els[i];
        }
        return null;
    }

    /* « La manette devrait ignorer certains éléments ; juste la carte doit être
       cliquable, pas le chiffre » (25 octobre 2026). À la télécommande, une carte de
       match est un seul arrêt : ni son compteur de liens (« ▶ 105 », qui porte lui aussi
       data-mid), ni les ★ de ses équipes. Dans la fiche, un flux est un seul arrêt (OK le
       lance) : ses petits boutons ⭐ 👎 ⊞ et les ★ du bandeau sont pour la souris. */
    const CARTE = '.match-card, .mb, [data-mid]';
    const IGNORES = '.si-btn, .fb-fav';
    const CARTES = '#marea .match-card, #marea .mb, #marea [data-mid]';
    function ignore(el) {
        if (el.matches(IGNORES)) return true;
        const parent = el.parentElement;
        return !!(parent && parent.closest(CARTE));
    }

    /* tabindex="-1" : pour la souris et le doigt seulement (les boutons d'une tuile du
       lecteur, dont la barre porte les mêmes gestes). */
    function focusables(racine) {
        return Array.from((racine || document).querySelectorAll('[tabindex="0"], button, a[href], input, select, summary'))
            .filter(el => !el.disabled && el.getAttribute('tabindex') !== '-1' && !ignore(el) && estVisible(el));
    }

    /* Le point de départ : l'élément qui le demande (data-focus-depart : « ▶ Regarder »
       de la fiche, comme le bouton Lecture de Netflix) ; sinon, dans une fenêtre, son
       premier élément ; dans la page, le bouton de la vue affichée. */
    function premier(racine) {
        const voulu = (racine || document).querySelector('[data-focus-depart]');
        if (estVisible(voulu) && !voulu.disabled) return voulu;
        if (racine === document) {
            const actif = document.querySelector('.nav-btn.active-toggle, .tab-btn.active');
            if (estVisible(actif)) return actif;
        }
        return focusables(racine)[0] || null;
    }

    // Fonction pour trouver l'élément le plus proche dans une direction
    function findNextFocusable(current, direction, racine) {
        const candidats = focusables(racine);

        if (candidats.length === 0) return null;
        if (!current) return candidats[0];

        const currentRect = current.getBoundingClientRect();
        let bestDistance = Infinity;
        let bestCandidate = null;

        candidats.forEach(candidate => {
            if (candidate === current) return;

            const rect = candidate.getBoundingClientRect();

            let isCandidate = false;
            let distance = 0;

            switch (direction) {
                case 'UP':
                    if (rect.bottom <= currentRect.top + 10) {
                        isCandidate = true;
                        distance = Math.pow(currentRect.top - rect.bottom, 2) + Math.pow(currentRect.left - rect.left, 2);
                    }
                    break;
                case 'DOWN':
                    if (rect.top >= currentRect.bottom - 10) {
                        isCandidate = true;
                        distance = Math.pow(rect.top - currentRect.bottom, 2) + Math.pow(currentRect.left - rect.left, 2);
                    }
                    break;
                case 'LEFT':
                    if (rect.right <= currentRect.left + 10) {
                        if (rect.bottom > currentRect.top && rect.top < currentRect.bottom) {
                            isCandidate = true;
                            distance = Math.pow(currentRect.left - rect.right, 2) + Math.pow(currentRect.top - rect.top, 2) * 5;
                        }
                    }
                    break;
                case 'RIGHT':
                    if (rect.left >= currentRect.right - 10) {
                        if (rect.bottom > currentRect.top && rect.top < currentRect.bottom) {
                            isCandidate = true;
                            distance = Math.pow(rect.left - currentRect.right, 2) + Math.pow(currentRect.top - rect.top, 2) * 5;
                        }
                    }
                    break;
            }

            if (isCandidate && distance < bestDistance) {
                bestDistance = distance;
                bestCandidate = candidate;
            }
        });

        return bestCandidate;
    }

    function focaliser(el) {
        if (!el) return;
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /* ◀ ▶ sur une liste déroulante : le choix précédent ou suivant (un clic de programme
       n'ouvre pas une liste, et la manette ne donne pas de vraie touche Entrée). */
    function changerChoix(liste, sens) {
        const n = liste.options.length;
        for (let i = liste.selectedIndex + sens; i >= 0 && i < n; i += sens) {
            if (!liste.options[i].disabled) {
                liste.selectedIndex = i;
                liste.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
        }
    }

    /* Une fenêtre s'ouvre : le focus y entre, et l'on retient d'où il venait ; elle se
       ferme : il y revient, s'il n'a pas trouvé mieux entre-temps. */
    let focusAvantZone = null;
    function verifierZone() {
        const zone = zoneActive();
        const actif = document.activeElement;
        if (zone) {
            if (!zone.contains(actif)) {
                if (!focusAvantZone && actif && actif !== document.body) focusAvantZone = actif;
                const p = premier(zone);
                if (p) p.focus();
            }
            return;
        }
        if (focusAvantZone) {
            const avant = retrouver(focusAvantZone);
            focusAvantZone = null;
            if ((!actif || actif === document.body || !estVisible(actif)) && estVisible(avant)) avant.focus();
        }
    }

    /* « Quand modal, back ramène à l'entrée » (25 octobre 2026) : la grille se redessine
       pendant que la fiche est ouverte (scores, liens), et la carte d'où l'on venait n'est
       plus dans la page à la fermeture. Le focus restait sur le bouton caché de la fiche,
       et la flèche suivante repartait de la barre du haut. On retrouve la carte qui l'a
       remplacée, par son identifiant ou son match. */
    function retrouver(el) {
        if (!el || el.isConnected) return el;
        if (el.id) {
            const meme = document.getElementById(el.id);
            if (meme) return meme;
        }
        const mid = el.getAttribute && el.getAttribute('data-mid');
        if (mid) {
            const meme = Array.from(document.querySelectorAll('[data-mid]')).find(x => x.getAttribute('data-mid') === mid && estVisible(x));
            if (meme) return meme;
        }
        return depart();
    }

    /* Hors d'une fenêtre, sans focus utilisable : le premier match affiché (comme au
       démarrage), sinon le bouton de la vue. */
    function depart() {
        const carte = Array.from(document.querySelectorAll(CARTES)).find(estVisible);
        return carte || premier(document);
    }

    let verificationPrevue = false;
    function prevoirVerification() {
        if (verificationPrevue) return;
        verificationPrevue = true;
        requestAnimationFrame(() => { verificationPrevue = false; verifierZone(); });
    }

    // Exécuter périodiquement pour gérer les éléments générés dynamiquement (DOM dynamique)
    const observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        mutations.forEach(m => {
            if (m.addedNodes.length > 0) shouldUpdate = true;
        });
        if (shouldUpdate) makeElementsFocusable();
        prevoirVerification();
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    makeElementsFocusable(); // Premier passage

    // Fonction écouteur clavier
    function handleKeyDown(e) {
        if (e.defaultPrevented) return;
        const actif = document.activeElement;
        // Ignorer si on tape dans un champ de texte
        if (actif && actif.tagName === 'INPUT' && (actif.type === 'text' || actif.type === 'search')) {
            return;
        }

        let direction = null;
        switch(e.key) {
            case 'ArrowUp': direction = 'UP'; break;
            case 'ArrowDown': direction = 'DOWN'; break;
            case 'ArrowLeft': direction = 'LEFT'; break;
            case 'ArrowRight': direction = 'RIGHT'; break;
            case 'Enter':
                // Une liste s'ouvre d'elle-même à la vraie touche OK : on la laisse faire.
                if (actif && actif !== document.body && actif.tagName !== 'SELECT' && estVisible(actif)) {
                    e.preventDefault();
                    actif.click();
                }
                return;
        }

        if (!direction) return;
        e.preventDefault();
        const zone = zoneActive();
        const racine = zone || document;

        if (!actif || actif === document.body || !estVisible(actif) || (zone && !zone.contains(actif))) {
            focaliser(zone ? premier(zone) : depart());
            return;
        }
        if (actif.tagName === 'SELECT' && (direction === 'LEFT' || direction === 'RIGHT')) {
            changerChoix(actif, direction === 'RIGHT' ? 1 : -1);
            return;
        }
        focaliser(findNextFocusable(actif, direction, racine));
    }

    window.addEventListener('keydown', handleKeyDown);

    /* Le focus de départ : le premier match affiché, dès que la grille est là (elle arrive
       après les données) ; à défaut, le bouton de la vue. Seulement si rien n'a le focus. */
    let essaisDepart = 0;
    function focusDeDepart() {
        const actif = document.activeElement;
        if (actif && actif !== document.body && estVisible(actif)) return;
        if (zoneActive()) return;
        const carte = Array.from(document.querySelectorAll(CARTES)).find(estVisible);
        if (carte) { focaliser(carte); return; }
        if (++essaisDepart < 30) { setTimeout(focusDeDepart, 500); return; }
        focaliser(premier(document));
    }
    setTimeout(focusDeDepart, 500);

    // Cleanup function
    window.__tvNavigationCleanup = function() {
        window.removeEventListener('keydown', handleKeyDown);
        observer.disconnect();
        document.querySelectorAll('.tv-focusable').forEach(el => {
            el.removeAttribute('tabindex');
            el.classList.remove('tv-focusable');
        });
        console.log("TV Navigation Mode désactivé et nettoyé");
    };

})();

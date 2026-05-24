/**
 * tv-navigation.js
 * Gère la navigation spatiale (télécommande Android TV)
 */

(function() {
    console.log("TV Navigation Mode initialisé");

    // Rendre les éléments cliquables focusables
    function makeElementsFocusable() {
        const selectors = [
            '.match-card',
            '.tab-btn',
            '.icon-btn',
            'button',
            '.stream-link',
            '.close-modal',
            '.option-item input'
        ];

        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                if (!el.hasAttribute('tabindex')) {
                    el.setAttribute('tabindex', '0');
                    el.classList.add('tv-focusable'); // pour pouvoir les nettoyer
                }
            });
        });
    }

    // Exécuter périodiquement pour gérer les éléments générés dynamiquement (DOM dynamique)
    const observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        mutations.forEach(m => {
            if (m.addedNodes.length > 0) shouldUpdate = true;
        });
        if (shouldUpdate) makeElementsFocusable();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    makeElementsFocusable(); // Premier passage

    // Fonction pour trouver l'élément le plus proche dans une direction
    function findNextFocusable(current, direction) {
        const focusables = Array.from(document.querySelectorAll('[tabindex="0"], button, a[href], input')).filter(el => {
            const rect = el.getBoundingClientRect();
            // Ignorer les éléments cachés ou de taille nulle
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
        });

        if (focusables.length === 0) return null;
        if (!current) return focusables[0];

        const currentRect = current.getBoundingClientRect();
        let bestDistance = Infinity;
        let bestCandidate = null;

        focusables.forEach(candidate => {
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

    // Fonction écouteur clavier
    function handleKeyDown(e) {
        // Ignorer si on tape dans un input texte
        if (document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text') {
            return;
        }

        let direction = null;
        switch(e.key) {
            case 'ArrowUp': direction = 'UP'; break;
            case 'ArrowDown': direction = 'DOWN'; break;
            case 'ArrowLeft': direction = 'LEFT'; break;
            case 'ArrowRight': direction = 'RIGHT'; break;
            case 'Enter':
                if (document.activeElement) {
                    e.preventDefault();
                    document.activeElement.click();
                }
                return;
        }

        if (direction) {
            e.preventDefault();
            const currentFocus = document.activeElement;

            if (!currentFocus || currentFocus === document.body) {
                const first = document.querySelector('[tabindex="0"]');
                if (first) first.focus();
                return;
            }

            const next = findNextFocusable(currentFocus, direction);
            if (next) {
                next.focus();
                next.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    window.addEventListener('keydown', handleKeyDown);

    // Mettre le focus initial
    setTimeout(() => {
        const firstBtn = document.querySelector('.tab-btn.active') || document.querySelector('.tab-btn');
        if (firstBtn) firstBtn.focus();
    }, 1000);

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

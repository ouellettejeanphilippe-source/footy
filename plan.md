1. **Refonte de l'entête principal (`#main-hdr`) et du sous-menu (`.nav-links`) dans `index.html`**
   - Remplacer l'organisation actuelle par une structure de navigation plus moderne.
   - Intégrer les filtres de ligues (actuellement dans `#sport-filters-container`) directement en tant que liste défilante horizontale ancrée sous l'en-tête, style "app" moderne.
   - Adapter les boutons "Guide", "En direct", "Favoris" dans une barre de navigation persistante en bas sur mobile (Bottom Navigation Bar) et dans l'en-tête sur desktop.

2. **Modification des styles CSS pour la nouvelle disposition**
   - Modifier `.hdr`, `.nav-links`, `.secondary-actions` dans `styles.css`.
   - Créer un `.bottom-nav` pour la version mobile.
   - Supprimer l'aspect "bouton flottant" basique du menu hamburger et le remplacer par des icônes de profil/paramètres directes.

3. **Modernisation du Multiview (`openMultiviewTab`, `setupMultivisionUI`)**
   - Retravailler la barre d'outils du Multiview (`#mv-toolbar`) pour qu'elle s'intègre plus proprement à la nouvelle UI (style minimaliste, regroupement des contrôles dans un menu déroulant clair au lieu d'une ligne saturée).

4. **Vérification et Tests (Playwright / Live Preview)**
   - Vérifier le rendu sur bureau et mobile (responsive).
   - S'assurer que les filtres de sport restent fonctionnels.
   - S'assurer que le Multiview s'ouvre et s'affiche correctement sans chevaucher les nouveaux menus.

5. **Pre-commit et Soumission**
   - Exécuter le script pre-commit pour s'assurer que les vérifications passent.

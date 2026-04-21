# FEUILLE DE ROUTE (ROADMAP)

## Terminé
- [x] Restauration des vignettes sous forme de grille style Prime Video pour les onglets "EN DIRECT" et "À VENIR".
- [x] Suppression du logo et du titre en haut à gauche pour libérer de l'espace dans l'en-tête.
- [x] Amélioration des filtres de sports : passage d'un menu déroulant à d'élégants boutons en forme de pilule défilant horizontalement.
- [x] Traduction complète de l'application en québécois standard.
- [x] Ajout d'un menu de personnalisation complet (couleurs des cartes de matchs, formes des boutons, arrière-plan).
- [x] Séparation du dictionnaire des fonctions dans `SUIVI_FONCTIONS.md`.

## À faire dans les prochaines semaines (Améliorations futures)
- [ ] **Refactorisation de l'architecture** : Scinder l'immense fichier `index.html` (actuellement plus de 9000 lignes) en fichiers distincts (`styles.css`, `app.js`, `api.js`, `scrapers.js`) pour améliorer la maintenabilité.
- [ ] **Optimisation des performances** : Extraire les immenses dictionnaires en ligne (comme `TEAM_COLORS`, `STATIC_TEAM_MAP`) vers des fichiers JSON ou de configuration dédiés afin d'alléger le chargement de la page.
- [ ] **Améliorations UI/UX** : Renforcer la gestion des erreurs (error boundaries) lorsque le chargement des flux échoue. Améliorer la navigation sur mobile.
- [ ] **Nouvelles fonctionnalités** : Intégrer de vraies API de statistiques d'équipes pour la barre latérale (Sidebar) et ajouter de nouvelles sources de moissonnage (scrapers) pour couvrir plus de matchs.

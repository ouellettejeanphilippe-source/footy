# WORKLOG

Journal append-only. Format strict : entrées datées, du plus récent au plus ancien.

## En cours
- Audit et création des fichiers de suivi et de règles (en phase de finalisation).

## Blocages
*(Aucun pour l'instant)*

## À faire (backlog)
- **Nettoyage Code** : Résoudre le doublon détecté pour la fonction `cacheLogo` (définie deux fois) dans `index.html`.
- **Refactoring (Long terme)** : Découper le fichier `index.html` monolithique (>9000 lignes) en fichiers externes (`styles.css`, `app.js`, `scrapers.js`, `constants.json`).
- **PWA** : Améliorer `sw.js` (actuellement très basique avec uniquement un cache de base) pour implémenter une vraie stratégie de cache dynamique.

## Fait

### [Date Courante] — Amélioration du Game Mode : Scores Live et Carrousel de stats
- **Fichiers touchés** : `index.html`
- **Résumé** : Exclusion définitive de la catégorie "Autres Flux" de l'onglet Scores Live. Ajout d'une section "Matchs Épinglés" persistante en haut de l'onglet Stats du Match. Transformation du conteneur de statistiques en un carrousel à défilement horizontal (swipe) permettant d'afficher et de comparer simultanément les cartes de statistiques complètes de plusieurs matchs épinglés.
- **Problèmes résolus** : Le spam visuel de "Autres Flux" est enlevé. L'accès aux stats des autres matchs sans perdre de vue le match principal est maintenant possible grâce au système de carrousel.


### 29 April 2026 — Nettoyage de la dette technique et mise à jour du workflow
- **Fichiers touchés** : `AGENTS.md`, `docs/WORKLOG.md` (et suppression de nombreux scripts de test)
- **Résumé** : Suppression de tous les scripts de patchs jetables, des fichiers `.txt`, `.log`, et `.png` à la racine. Ajout d'une règle stricte dans `AGENTS.md` imposant le nettoyage de tout fichier de test avant chaque fin de tâche (étape 5 du Workflow).
- **Problèmes restants** : Aucun (nettoyage complet de la racine).

### 25 Avril 2024 — Bootstrap initial du système de mémoire
- **Fichiers créés** : `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/WORKLOG.md`
- **Résumé** : Audit initial du repo. `ARCHITECTURE.md` généré depuis l'état actuel du code. Identification d'un code massivement monolithique (`index.html`), de la gestion offline/PWA de base, de [1] doublon flagrant (`cacheLogo`) et d'environ [10+] fichiers de patch à éliminer.
- **Problèmes connus** :
  - Le code JS/HTML/CSS est fortement entremêlé dans `index.html`, rendant le suivi des fonctions difficile.
  - La racine du projet est extrêmement polluée par des scripts de développement/test non nettoyés.

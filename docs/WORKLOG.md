# WORKLOG

Journal append-only. Format strict : entrées datées, du plus récent au plus ancien.

## Fait

### 1 May 2026 — Refonte complète de l'interface et extraction des fichiers
- **Fichiers touchés** : `index.html`, `styles.css` (nouveau), `app.js` (nouveau), `sw.js`
- **Résumé** : Extraction du CSS et du JavaScript depuis `index.html` vers des fichiers séparés (`styles.css` et `app.js`) pour un code plus propre et performant. Refonte esthétique complète (Look "2026 Pro") incluant un flat design moderne, des ombres douces et une navigation responsive repensée (bottom-bar sur mobile, sidebar sur desktop). Simplification du modal de personnalisation.
- **Problèmes résolus** : Le fichier `index.html` n'est plus monolithique. Le design est épuré, plus professionnel et l'adaptation aux écrans mobiles est plus proche d'une vraie application native.

### 29 April 2026 — Fix du chargement asynchrone des flux pour MLB et NFL
- **Fichiers touchés** : `index.html`
- **Résumé** : Correction de `parseMlbbite` et `parseNflbite` pour permettre au scraping asynchrone des sous-pages de s'exécuter correctement. Ces parseurs initialisaient `streamsLoaded: true` dès la page d'accueil avec un lien statique, bloquant ainsi l'extraction des véritables liens de flux dans la sous-page du match.
- **Problèmes résolus** : Le clic sur un match MLB (ou NFL) recherche et charge désormais correctement les vrais liens (ex. StreamEast, Buffstreams, etc.) plutôt que d'afficher un seul lien statique pointant vers la sous-page originelle.
- Audit et création des fichiers de suivi et de règles (en phase de finalisation).

## Blocages
*(Aucun pour l'instant)*

## À faire (backlog)
- **Nettoyage Code** : Résoudre le doublon détecté pour la fonction `cacheLogo` (définie deux fois) dans `index.html`.
- **Refactoring (Long terme)** : Découper le fichier `index.html` monolithique (>9000 lignes) en fichiers externes (`styles.css`, `app.js`, `scrapers.js`, `constants.json`).
- **PWA** : Améliorer `sw.js` (actuellement très basique avec uniquement un cache de base) pour implémenter une vraie stratégie de cache dynamique.

## Fait

### 29 April 2026 — Fix du chargement asynchrone des flux pour MLB et NFL
- **Fichiers touchés** : `index.html`
- **Résumé** : Correction de `parseMlbbite` et `parseNflbite` pour permettre au scraping asynchrone des sous-pages de s'exécuter correctement. Ces parseurs initialisaient `streamsLoaded: true` dès la page d'accueil avec un lien statique, bloquant ainsi l'extraction des véritables liens de flux dans la sous-page du match.
- **Problèmes résolus** : Le clic sur un match MLB (ou NFL) recherche et charge désormais correctement les vrais liens (ex. StreamEast, Buffstreams, etc.) plutôt que d'afficher un seul lien statique pointant vers la sous-page originelle.

### 30 April 2026 — Fix parsing logic for mlbbite, nflbite, streameast, onhockey, and buffstreams
- **Fichiers touchés** : `index.html`
- **Résumé** : Created dedicated parsers `parseMlbbite` and `parseNflbite`. Updated existing parsers `parseStreameast`, `parseOnHockey`, and `parseBuffstreams`. Replaced the direct `parseFootybite` calls in `loadAll` with the new specific parsers for those sites.
- **Problèmes restants** : None for these parsers.
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

### 29 April 2026 - Mise à jour des icônes de sport et UI du bouton Multivision
- **Fichiers touchés** : `index.html`
- **Résumé** : Modification de `lgFlag()` pour utiliser des icônes spécifiques aux sports (⚾, 🏀, 🏈, etc.) à la place du ⚽ générique. Remplacement de l'icône ⚽ en dur par l'icône de sport adéquate dans la liste Multivision. Suppression du compteur du nombre de flux actifs sur le bouton Multivision pour l'alléger.

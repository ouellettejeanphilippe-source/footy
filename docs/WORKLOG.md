# WORKLOG

Journal append-only. Format strict : entrées datées, du plus récent au plus ancien.
### 04 May 2026 - Remove Top Header and Logo
- **Fichiers touchés** : `index.html`, `app.js`, `styles.css`
- **Résumé** : Removed the top header completely including the logo and "Sports Guide" text to free up screen real estate. The bottom/main navigation bar (`.nav-links`) remains as the primary navigation. Removed related CSS and JavaScript DOM logic (e.g., `ResizeObserver`, `--hdr-height`).


## Fait

- Amélioration de la fonction `isMatch` dans `app.js` :
  - Ajout d'alias explicites (ex: canadeins, wild) dans `TEAM_ALIASES`.
  - Implémentation d'un algorithme de "sliding window fuzzy match" pour les correspondances d'équipes partielles et mal orthographiées.
  - La logique s'appuie sur la vérification double (Domicile ET Extérieur) pour garantir la sécurité de l'assignation des flux tout en étant très "lousse" sur les noms individuels.
- Identifié la cause du blocage sur la page de chargement (TypeError `Cannot set properties of null` lors de `btn.disabled=true`)
### 04 May 2026 - Centrage du menu principal sur desktop
- **Fichiers touchés** : `styles.css`
- **Résumé** : Ajout d'une media query `@media(min-width: 769px)` pour centrer le menu principal `.nav-links` (`justify-content: center`) et y ajouter un padding léger (`padding: 16px 0`) sur PC, tel que demandé. Le comportement sur mobile n'est pas affecté.
- **Problèmes résolus** : Menu principal mieux aligné sur les écrans larges sans se superposer trop en haut.

n- Identifié la cause du blocage sur la page de chargement (TypeError `Cannot set properties of null` lors de `btn.disabled=true`)
- Ajouté des vérifications d'existence pour le bouton `relBtn` dans `app.js`
### 03 May 2026 - Fix application hanging during API fetches
- **Fichiers touchés** : `app.js`
- **Résumé** : Added timeouts (`AbortSignal.timeout(8000)`) to multiple raw `fetch` calls across `app.js` (ESPN, API-Sports, TheSportsDB, etc.).
- **Problèmes résolus** : Prevents the application from getting permanently stuck on the "Connexion au Guide télé (API)..." spinner if an external server or proxy hangs indefinitely without rejecting the connection.

- Refonte du menu principal et des menus secondaires (multiview, filtres) pour un fonctionnement plus moderne, style app (bottom nav sur mobile, header épuré sur desktop).
### 04 May 2026 — Correction des flux OnHockey et MLB/NFL
- **Fichiers touchés** : `app.js`
- **Résumé** :
  - **OnHockey** : Extraction directe des flux depuis la page d'accueil (`parseOnHockey`) pour éviter les redirections problématiques et les faux appels proxy sur la sous-page, les flux sont maintenant injectés et fonctionnels immédiatement (`streamsLoaded: true`). Support des liens commençant par `//`.
  - **MLBbite / NFLbite** : Mise à jour des URLs racines (migration de `nflbite.to` à `nflbite.is`). Adaptation de `parseMlbbite` pour cibler les liens mis à jour via une recherche d'URL. Ajout de sélecteurs supplémentaires dans `scrapeMatchFlux` (`table tbody tr a`, boutons avec `stream`) pour extraire efficacement tous les flux finaux à l'intérieur des sous-pages des rencontres.
- **Problèmes résolus** : Les streams OnHockey (Hockey, PWHL, LHJMQ) se chargent et se lisent correctement dans le Multivision. Les streams MLB (Baseball) et NFL sont de nouveau opérationnels et extraits via la modale.

- Fix menu hiding under Multivision on mobile (`app.js`)
- Fix MLB streams scraper for mlbbite (`app.js`)

### 02 May 2026 — Correction navbar mobile et menu hamburger
- **Fichiers touchés** : `index.html`, `styles.css`
- **Résumé** : La `nav-links` (barre de navigation mobile inférieure) a été sortie du conteneur `main-hdr` dans `index.html`. Le `backdrop-filter` du conteneur parent forçait un nouveau contexte de formattage qui bloquait le `position: fixed; bottom: 0;` en haut de l'écran. Ajout de `justify-content: space-between` au `main-hdr` pour placer correctement le bouton de menu hamburger à droite, et restauration du logo manquant dans le header.
- **Problèmes résolus** : La barre de navigation mobile s'affiche correctement en bas de l'écran, et le bouton hamburger est à nouveau visible et utilisable.

### 01 May 2026 — Correction modale et menu mobile
- **Fichiers touchés** : `index.html`, `styles.css`
- **Résumé** : Ajustements CSS pour corriger le débordement de la modale sur les écrans mobiles (padding revus, max-height et overflow configurés). Le menu de navigation principal a été restauré sous forme de "bottom-bar" fixe en bas de l'écran pour les résolutions mobiles.
- **Problèmes résolus** : La modale n'est plus déformée et le menu principal est correctement affiché et utilisable sur mobile.


### 1 May 2026 — Refonte complète de l'interface et extraction des fichiers
- **Fichiers touchés** : `index.html`, `styles.css` (nouveau), `app.js` (nouveau), `sw.js`
- **Résumé** : Extraction du CSS et du JavaScript depuis `index.html` vers des fichiers séparés (`styles.css` et `app.js`) pour un code plus propre et performant. Refonte esthétique complète (Look "2026 Pro") incluant un flat design moderne, des ombres douces et une navigation responsive repensée (bottom-bar sur mobile, sidebar sur desktop). Simplification du modal de personnalisation.
- **Problèmes résolus** : Le fichier `index.html` n'est plus monolithique. Le design est épuré, plus professionnel et l'adaptation aux écrans mobiles est plus proche d'une vraie application native.

### 29 April 2026 — Fix du chargement asynchrone des flux pour MLB et NFL
- **Fichiers touchés** : `index.html`
- **Résumé** : Correction de `parseMlbbite` et `parseNflbite` pour permettre au scraping asynchrone des sous-pages de s'exécuter correctement. Ces parseurs initialisaient `streamsLoaded: true` dès la page d'accueil avec un lien statique, bloquant ainsi l'extraction des véritables liens de flux dans la sous-page du match.
- **Problèmes résolus** : Le clic sur un match MLB (ou NFL) recherche et charge désormais correctement les vrais liens (ex. StreamEast, Buffstreams, etc.) plutôt que d'afficher un seul lien statique pointant vers la sous-page originelle.
- Audit et création des fichiers de suivi et de règles (en phase de finalisation).

- Rien pour l'instant
- Rien pour l'instant

## Fait
- Identifié la cause du blocage sur la page de chargement (TypeError `Cannot set properties of null` lors de `btn.disabled=true`)
- Ajouté des vérifications d'existence pour le bouton `relBtn` dans `app.js`
- Refonte du menu principal et des menus secondaires (multiview, filtres) pour un fonctionnement plus moderne, style app (bottom nav sur mobile, header épuré sur desktop).
- Fix menu hiding under Multivision on mobile (`app.js`)
- Fix MLB streams scraper for mlbbite (`app.js`)

### 03 May 2026 — Correction des extracteurs de flux OnHockey et MLBBite et Fix du manager de favoris
- **Fichiers touchés** : `app.js`
- **Résumé** :
  - **OnHockey** : Amélioration de la résilience du parseur face au texte polluant (`geo-blocked`, etc.) et assouplissement de l'expression régulière extrayant les heures des matchs.
  - **MLBBite** : Modification de la regex récupérant l'heure du match dans `parseMlbbite` pour ignorer les espaces invisibles et caractères environnants.
  - **Favoris** : Correction d'un bug où des ligues se dupliquaient dans l'affichage du menu des favoris car le formatage des noms de ligue était incohérent (les noms formatés et bruts étaient mélangés pendant l'affichage et le tri).
- **Problèmes résolus** : Le calendrier affiche à nouveau les heures et récupère les streams OnHockey et MLBBite. La liste des ligues dans les Favoris est désormais propre et sans doublon.

## Blocages
*(Aucun pour l'instant)*

## À faire (backlog)
- **Nettoyage Code** : Résoudre le doublon détecté pour la fonction `cacheLogo` (définie deux fois) dans `index.html`.
- **Refactoring (Long terme)** : Découper le fichier `index.html` monolithique (>9000 lignes) en fichiers externes (`styles.css`, `app.js`, `scrapers.js`, `constants.json`).
- **PWA** : Améliorer `sw.js` (actuellement très basique avec uniquement un cache de base) pour implémenter une vraie stratégie de cache dynamique.

## Fait
- Identifié la cause du blocage sur la page de chargement (TypeError `Cannot set properties of null` lors de `btn.disabled=true`)
- Ajouté des vérifications d'existence pour le bouton `relBtn` dans `app.js`
- Refonte du menu principal et des menus secondaires (multiview, filtres) pour un fonctionnement plus moderne, style app (bottom nav sur mobile, header épuré sur desktop).
- Fix menu hiding under Multivision on mobile (`app.js`)
- Fix MLB streams scraper for mlbbite (`app.js`)

### 02 May 2026 — Correction navbar mobile et menu hamburger
- **Fichiers touchés** : `index.html`, `styles.css`
- **Résumé** : La `nav-links` (barre de navigation mobile inférieure) a été sortie du conteneur `main-hdr` dans `index.html`. Le `backdrop-filter` du conteneur parent forçait un nouveau contexte de formattage qui bloquait le `position: fixed; bottom: 0;` en haut de l'écran. Ajout de `justify-content: space-between` au `main-hdr` pour placer correctement le bouton de menu hamburger à droite, et restauration du logo manquant dans le header.
- **Problèmes résolus** : La barre de navigation mobile s'affiche correctement en bas de l'écran, et le bouton hamburger est à nouveau visible et utilisable.

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

### 04 May 2026 - Prévention du blocage au chargement & Création de l'onglet Logs
- **Fichiers touchés** : `app.js`, `index.html`
- **Résumé** : Remplacement de `Promise.all` par `Promise.allSettled` dans `getApiFirstMatches` pour éviter que l'échec ou le timeout d'une seule requête de données (ESPN, API-Sports, etc.) ne bloque le démarrage complet de l'application sur l'écran de chargement initial. Déplacement des logs de scraping depuis la vue "Options" vers un nouvel onglet dédié "Logs" dans le modal des Paramètres afin de désencombrer l'interface utilisateur.
- **Problèmes résolus** : L'application ne reste plus figée sur "Connexion au Guide télé..." si un proxy tombe ou qu'une API met trop de temps à répondre. L'interface des paramètres est plus propre.

### 04 May 2026 - Fix du parseur Footybite pour MLB et NHL
### 03 May 2026 - Amélioration du matching des noms d'équipe (MLB, NHL)
- **Fichiers touchés** : `app.js`
- **Résumé** : Ajout de remplacements personnalisés sécurisés (ex. `NY` -> `New York`, `L.A.` -> `Los Angeles`) et élargissement considérable du dictionnaire d'alias (`TEAM_ALIASES`) pour y inclure les noms abrégés (ex. `LA Kings`, `LA Dodgers`, `D-Backs`) de l'ensemble des équipes de la NHL et de la MLB sans utiliser de remplacements globaux risqués (comme `la`).
- **Problèmes résolus** : Certains matchs de la MLB et de la NHL (ex: `NY Rangers` vs `New York Rangers`, ou `L.A. Dodgers` vs `Los Angeles Dodgers`) ne se connectaient pas avec leurs matchs officiels provenant de l'API car leurs abréviations ne s'alignaient pas. Désormais, le rapprochement de ces flux est extrêmement robuste et exhaustif sans corrompre d'autres ligues comme le soccer (ex. `La Liga`).
- **Résumé** : Refonte de la logique `findLeagueHeader` dans le parseur Footybite afin de remonter correctement l'arbre DOM pour détecter les ligues utilisant des conteneurs `.my-1` avec `.img-icone` (comme la MLB et la NHL). Modification de la logique de filtrage des "away teams" manquantes pour autoriser spécifiquement les matchs MLB et NHL, en complément des F1 et NASCAR.
- **Problèmes résolus** : Les liens de matchs de hockey (NHL) et de baseball (MLB) sur Footybite sont désormais correctement extraits, affichés et classés. La reconnaissance des équipes à domicile et à l'extérieur est assurée, et les matchs ne sont plus ignorés silencieusement.

### 04 May 2026 - Modal d'installation du script au premier lancement
- **Fichiers touchés** : `app.js`
- **Résumé** : Ajout d'une logique basée sur `localStorage` (`hasSeenScriptModal`) pour afficher automatiquement la modale d'installation du script utilisateur Tampermonkey (`installTampermonkey()`) lors du premier chargement réussi de l'application dans un navigateur. Cette logique a été intégrée pour se déclencher soit après le masquage de l'overlay de chargement complet, soit immédiatement après le rendu depuis le cache.
- **Problèmes résolus** : L'utilisateur est désormais averti activement de l'utilité du script de nettoyage Multivision dès sa première visite.

### 03 May 2026 - Fix de l'extraction de streams pour Footybite
- **Fichiers touchés** : `app.js`
- **Résumé** : Changement de la condition dans `scrapeMatchFlux` vérifiant le nombre de colonnes d'une table HTML pour extraire un lien de `if(tds.length < 5) return;` à `if(tds.length < 2) return;`.
- **Problèmes résolus** : Certains matchs Footybite n'affichaient plus de streams car la nouvelle structure HTML des tables de flux ne comporte plus que 2 ou 3 colonnes. Cette vérification bloquait silencieusement l'extraction.

### 04 May 2026 - Correction du parseur MLBBite
- **Fichiers touchés** : `app.js`
- **Résumé** : Mise à jour de la regex dans `parseMlbbite` pour ignorer les suffixes du type `-5-free-live-stream` (et autres variantes) lors de l'extraction des noms d'équipes depuis l'URL en cas de fallback.
- **Problèmes résolus** : L'équipe "away" incluait parfois des éléments indésirables de l'URL, causant un échec du rapprochement (`isMatch`) avec l'équipe officielle correspondante, ce qui empêchait les liens de streams de s'afficher pour certains matchs MLB.

### $(date +'%d %B %Y') - Amélioration du matching cross-validation (isMatchPair)
- **Fichiers touchés** : `app.js`
- **Résumé** : Remplacement de la simple comparaison `Home==Home && Away==Away` par une fonction avancée `isMatchPair` dans la logique de fusion des streams. Cette fonction utilise une validation croisée en combinant les noms des équipes à domicile et à l'extérieur. Si une équipe est incomplète (ex. "Tigers" au lieu de "Detroit Tigers"), la fonction valide le match si les deux noms du scrape se retrouvent avec une grande similitude dans le match officiel.
- **Problèmes résolus** : Résout les problèmes où "zéro liens" étaient trouvés pour des matchs ayant des noms partiels ou très imparfaits (comme "Tigers" vs "Rangers" sur MLBBite) qui ne fusionnaient pas avec les noms de l'API (Detroit Tigers vs Texas Rangers).

### $(date +'%d %B %Y') - Refonte de la navigation, Menu Hamburger et Modales Options/Logs
- **Fichiers touchés** : `index.html`, `app.js`
- **Résumé** :
  - Renommage des boutons de navigation : "En direct" devient "Live" et "Multiview" devient "Lecteur".
  - Remplacement du bouton "☰ Paramètres" par un véritable bouton hamburger "☰" ouvrant un menu déroulant (`.secondary-actions`) avec les options (Favoris, Options, Logs, Script).
  - Division de l'ancienne modale monolithique des paramètres en deux modales distinctes : `#setbg` pour les "Options" et `#logsbg` pour les "Logs".
  - Émancipation de la section "Favoris" (Gestion des équipes) : ce n'est plus un onglet dans les paramètres mais un écran principal à part entière (similaire à "Live" ou "Guide"), accessible via le menu hamburger. Les fonctions associées au modal (`renderFavTeamsInModal`) ont été supprimées.
- **Problèmes résolus** : L'interface est plus propre et logique, réduisant la surcharge cognitive dans les paramètres. La gestion des favoris prend désormais tout l'écran, ce qui est plus confortable à utiliser, et le menu supérieur est épuré grâce au système déroulant.

# ARCHITECTURE.md
**Dernière mise à jour :** 25 Avril 2024 par Jules (Bootstrap initial)

## Vue d'ensemble
Application web/PWA monolithique servant de Guide TV sportif et agrégeant des scores en direct ainsi que des flux vidéos (streams via un système de "Multiview"). Elle fonctionne avec du cache local pour réduire les appels réseau (calendrier sur 30 jours).

## Stack détecté
- **Frontend** : HTML/CSS/JS (Vanilla JS, sans framework externe majeur) principalement concentré dans `index.html`.
- **Backend / API** : Appels directs aux APIs (ex: ESPN) et scrapers de sites de streaming intégrés dans le client JS.
- **PWA** : Service Worker (`sw.js`) basique et Manifest (`manifest.json`).
- **Outils & Tests** : Node.js (avec Express, node-fetch, jsdom) et Playwright pour les tests UI (`package.json`).
- **Utilitaires** : Python (`run_checks.py`, scripts divers de validation).

## Arborescence
.
├── .jules/               # Configuration et cache de l'agent
├── __pycache__/          # Fichiers compilés Python
├── docs/                 # Documentation (ARCHITECTURE.md, WORKLOG.md)
├── index.html            # Cœur de l'application (Monolithe de +9000 lignes, UI + Logique)
├── manifest.json         # Manifest de la PWA
├── multiview-cleaner.user.js # Script utilisateur pour nettoyer/encadrer les streams vidéo
├── package.json          # Dépendances de développement (Playwright, jsdom, express)
├── run_checks.py         # Script Python pour automatiser les tests locaux
├── sw.js                 # Service worker (gestion du cache PWA)
└── [Multitude de scripts de patchs] # ex: fix_*.py, check_*.py, *.js -> À NETTOYER

## Modules et responsabilités

### `index.html` (Sous-modules virtuels)
*Ce fichier contient l'intégralité du code front-end (HTML, CSS, JS). En voici les grands blocs logiques :*
- **Rôle** : Interface utilisateur complète, gestion du routage (onglets), logique de scrapping, et player vidéo (Multiview).
- **Core / Stockage** : Gestion globale de l'état (objet `S`), `loadAll()`, lecture/écriture dans le localStorage (`userPrefs`, cache API).
- **UI / Layout** : Fonctions d'affichage des menus (`toggleMenu`, `setupMultivisionUI`), gestion des onglets (Guide, Direct, Favoris).
- **Multiview / Player** : Création dynamique d'iframes (`openFlux`, `addToMultivision`), gestion de la communication cross-origin via `postMessage`, gestion du focus (Stream audio actif).
- **Data APIs** : `fetchGameStats()`, `fetchLeagueStandings()`. Polling sur ESPN.
- **Scrapers** : Fonctions de parsing (`parseOnHockey`, `parseFootybite`, `parseSportsurge`, `parseBuffstreams`, etc.) pour injecter les flux externes dans la liste des matchs de l'API.
- **Normalisation** : `getOfficialTeamName()`, `formatLeagueName()`, `normName()`. Base de données de couleurs/logos hardcodée.
- **Notes** : Dette technique majeure. Le fichier est extrêmement volumineux (>9000 lignes) et doit être découpé en différents fichiers (styles.css, app.js, config.js, scrapers.js).

### `sw.js`
- **Rôle** : Service Worker fournissant les capacités PWA.
- **Exporte** : Rien (s'attache à `self`).
- **Dépend de** : Fichiers racines statiques (`index.html`, `manifest.json`).
- **Utilisé par** : `index.html` (enregistrement du SW).
- **Notes** : Très basique, met en cache uniquement `index.html` et `manifest.json`.

### `multiview-cleaner.user.js`
- **Rôle** : Script Tampermonkey injecté dans les iframes de stream (cross-origin si possible/configuré) pour bloquer les popups, masquer les pubs via CSS, et gérer le volume audio/click to focus via `postMessage`.
- **Exporte** : Rien, s'exécute automatiquement dans le DOM ciblé.

### `run_checks.py`
- **Rôle** : Exécuteur de tests et de validation syntaxique pour garantir la non-régression (invoqué souvent avant des commits).

## Flux de données principaux
1. **Initialisation (Load)** : Chargement de `index.html` → Restauration de `userPrefs` → `loadAll()` → Vérification du cache du calendrier (ESPN) → Fetch du calendrier si >24h.
2. **Affichage Liste** : Fusion du calendrier API avec les flux scrapés (via `mergeFluxToApi`) → Génération HTML des Match Cards (`renderMatches` ou Guide).
3. **Lancement Stream (Multiview)** : Clic sur un flux → `addToMultivision()` → Création d'une `iframe` → Communication bidirectionnelle (Mute/Unmute) avec `multiview-cleaner.user.js` via `postMessage`.

## Stockage
- **Type** : `localStorage`
- **Clés principales** :
  - `api_calendar_cache` : Cache des matchs des 30 prochains jours.
  - `api_calendar_timestamp` : Date du dernier appel réseau global.
  - `userPrefs` : Objet JSON contenant les préférences UI (thème, icon pack, layout multiview).
  - `userFavTeams` : Liste des équipes favorites.
  - `customLgOrder` : Ordre personnalisé des ligues.

## Service Worker
- **Chemin** : `./sw.js`
- **Version actuelle** : `sports-guide-v2` (Variable `CACHE_NAME`)
- **Liste des assets précachés** : `./index.html`, `./manifest.json`
- **Stratégies par route** : Stratégie globale de mise en cache à l'installation (Cache-Only lors du fetch pour le moment, ce qui est basique).

## Points d'attention
- **Doublons potentiels** : Fonctions `cacheLogo` présentes deux fois dans `index.html`. Présence de fonctions internes s'appelant de manière quasi-identique.
- **Dette de Patchs (Fichiers poubelles)** : Nombre énorme de scripts de "fix/test" à la racine (e.g., `fix_favorites_rendering.js`, `update_render.js`, `test_sort.js`, `fix_psg.py`, `check_custom_lg.py`). À classer, supprimer ou déplacer dans un sous-dossier de tests.
- **Fichier monstrueux** : `index.html` nécessite un découpage modulaire d'urgence.
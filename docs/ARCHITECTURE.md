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
- **Core / Stockage** : Gestion globale de l'état (objet `S`, incluant `S.collapsedSections` pour l'état de l'UI accordéon), `loadAll()`, lecture/écriture dans le localStorage (`userPrefs`, cache API).
- **UI / Layout** : Fonctions d'affichage des menus (`toggleMenu`, `setupMultivisionUI`), gestion des onglets (Guide, Direct, Favoris).
- **Multiview / Player** : Création dynamique d'iframes (`openFlux`, `addToMultivision`), gestion de la communication cross-origin via `postMessage`, gestion du focus (Stream audio actif).
- **Data APIs** : `fetchGameStats()`, `fetchLeagueStandings()`. Polling sur ESPN. `updateLiveScores()` optimized with `matchCardCache`.
- **Scrapers** : Fonctions de parsing (`parseOnHockey`, `parseFootybite`, `parseSportsurge`, `parseBuffstreams`, `parseMlbbite`, `parseNflbite`, `parseStreameast`, `parseTotalsportek`, `parseVipleague`, `parseMethstreams`, etc.) pour injecter les flux externes dans la liste des matchs de l'API.
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
### Source Status Tracking
- `sourcesStatus`: Global array storing the latest status of each scraped source domain (`name`, `status`, `matchCount`, `message`, `time`).
- `updateSourceStatus()`: Updates or inserts a source tracking entry.
- `renderSourcesStatus()`: Populates the UI container `#sources-status-container` with source statistics before the generic request logs.

### Backend Schedule Generation

### Changements $(date +'%d %B %Y') - Gestion de la dépendance du cache des logos
- `ensureLogoCache()` ajoutée à `js/utils.js` pour éviter une dépendance cyclique au moment de l'initialisation de `STATIC_LOGOS_RAW` qui bloquait l'appel à `normName()` exporté depuis `js/config.js`. `getLogo` effectue désormais un appel "lazy" vers ce cache pour sécuriser le retour des URLs.

## Recherche de liens de streams (mise à jour 2026-09-02)

Pipeline en quatre étapes, avec une base « hors proxy » :

1. **Pré-calcul serveur** : `.github/workflows/scrape_streams.yml` exécute chaque heure `scripts/scrape_streams.mjs`, qui importe les parseurs du client (`js/scrapers.js`) dans un DOM simulé (jsdom), télécharge les pages des sources (accueil + sous-pages par sport), extrait les flux des pages de match (`extractStreamLinks`) et écrit `data/streams.json`.
2. **Chargement client** : `loadPrefetchedStreams()` (`js/main.js`) lit `data/streams.json` depuis la même origine (aucun proxy) et fusionne ces matchs dans la grille ESPN (`mergeFluxToApi`). Les liens existent donc même si tous les proxys CORS sont morts.
3. **Rafraîchissement en direct** : `fetchSourcePages()` télécharge, pour chaque source, l'accueil (avec miroirs) et les sous-pages des sports du jour (`getSourcePages`, `sportOfLeague` dans `js/config.js`) via `fetchPage`.
4. **Flux par match** : `scrapeMatchFlux(m, force, deep)` lit la page du match (et, depuis la fiche, les pages du même match sur les autres sources : `m.altUrls`, remplies par `mergeAltUrls` dans `js/match.js`).

### `js/fetcher.js`
- **Rôle** : helpers purs de `fetchPage` : `buildProxyList` (direct, proxy personnalisé, cors.sh, corsproxy.io avec clé, allorigins, codetabs), `inspectPageContent` (pages d'erreur de proxy en HTTP 200), `orderProxies`/`recordProxyResult` (santé, relégation 3 min).
- **Dépend de** : rien. **Utilisé par** : `js/utils.js`, `js/config.js`, `tests/unit_fetcher.test.js`.

### `fetchPage(url, {force})` (`js/utils.js`)
Cache mémoire 45 s, dédoublonnage des requêtes en cours, essai direct puis proxys en « hedging » (nouveau transport lancé après 3 s sans réponse), validation du contenu, santé persistée dans `localStorage.proxy_health`. Réglages utilisateur : `custom_proxy_url`, `cors_sh_api_key`, `corsproxy_io_api_key` (Options → Réseau & Proxys).

### Sources (`SCRAPERS_CONFIG`, `js/config.js`)
Footybite, MLBBite, Sportsurge (pages `/watch-<sport>-streams/`), Buffstreams (pages par ligue), Streameast (liste de miroirs), OnHockey, VIPLeague (`/live-now-streaming`), Methstreams (`/league/<x>streams`). `domains.json` (branche main) surcharge les URLs et les miroirs (`MIRRORS`) sans redéploiement.

## Extraction des lecteurs (exploration du 2026-09-02)

| Source | Liste des matchs | Page de match | Lecteur obtenu |
|---|---|---|---|
| Footybite | accueil (payload Next.js) OK | `/game/…` : Cloudflare 403 depuis un serveur | aucun côté serveur ; flux fusionnés depuis les autres sources (`altUrls`) |
| MLBBite | accueil OK (statut, heure relative) | HTML sans tableau de flux (rempli côté serveur pour les navigateurs seulement) | repli `Page du match` (`topLevel`) |
| Sportsurge | pages `/watch-<sport>-streams/` (OK depuis GitHub, Cloudflare ailleurs) | `.stream-item[data-href]` + `.stream-row-spec` | ~15 lecteurs tiers par match |
| Buffstreams | pages par ligue | une iframe `embedsports.me/<sport>/<slug>-stream-1` | lecteur embarquable (exige un referrer, pas de `sandbox`) |
| Streameast | `v2.gostreameast.is` = liste de miroirs | miroirs : 429 « 1015 » côté serveur | lien de miroir, ouvert dans un onglet (`topLevel`) |
| OnHockey | `schedule_table.php` (Referer obligatoire) | — (liens dans la grille) | `np_stream400.php?channel=…` déballé en lecteur direct, `np_youtube.php` → `youtube.com/embed/` |
| VIPLeague | `/live-now-streaming` | lecteur chargé par `stream.bun.min.js` (obfusqué, blob chiffré) | repli `Page du match` (`topLevel`) |
| Methstreams | `/league/<x>streams` | `const allStreams = [...]` | embedindia.st, streame.center |

- `unwrapOnHockeyPlayer(href)`, `isJunkStreamHost(host, path)` (`js/scrapers.js`) : exportés, testés dans `tests/unit_scrapers.test.js`.
- Un lien `topLevel: true` (pages de miroirs, repli « Page du match ») est ouvert par `renderFluxItem` (`js/ui.js`) dans un nouvel onglet au lieu du Multiview.
- `data/streams.json` contient en plus `fetch` (compteurs de requêtes), `playerHosts` (lecteurs par hôte), `sources[].matchPagesOk/matchPagesFail` et `matches[].scrapeError` pour diagnostiquer un run GitHub Actions sans relire les logs.

### Relance manuelle du cache serveur (Options → Réseau & Proxys)
- `openStreamsWorkflow()` (`js/multiview.js`) ouvre `STREAMS_WORKFLOW_URL` (`js/config.js`) : la page GitHub Actions du workflow horaire, dont le bouton « Run workflow » régénère `data/streams.json` en ≈ 2 min.
- `reloadPrefetchedStreams()` (`js/multiview.js`) appelle `loadPrefetchedStreams(true)` (`js/main.js`, lecture sans cache) puis `loadAll(true, false)` pour refusionner les liens dans la grille ; `renderProxyStatus()` affiche matchs, liens, sources OK et âge du cache.

## Classement des ligues (2026-09-02)

`leagueTier(league, overrides)` (`js/db.js`) est la seule source de vérité :

| Niveau | Origine | Effet |
|---|---|---|
| `main` | `DEFAULT_LEAGUES` | en tête d'En direct et du Guide |
| `secondary` | `OTHER_LEAGUES` | section « Ligues secondaires », grille temporelle distincte dans le Guide |
| `ignored` | choix de l'utilisateur seulement | masquée partout, jamais scrapée |
| `other` | ligue inconnue | section « Autres streams » (repliée) |

- Le choix de l'utilisateur (Favoris → Ligues) est stocké dans `localStorage.league_tiers` et prime sur les listes par défaut : `setLeagueTier` / `resetLeagueTiers` (`js/state.js`), `setLeagueTierPref` (`js/main.js`). `defaultLeagueTier` sert à savoir si une valeur est personnalisée.
- `FAVORIS` et `EN DIRECT` sont des sections synthétiques : toujours `main`, jamais masquables.
- `renderGroupedSection` (`js/ui.js`) rend toute section repliable regroupée par ligue ; utilisée par « Ligues secondaires » et « Autres streams ».

### Sources de calendrier
- **ESPN** : `ESPN_LEAGUES` est dupliqué dans `js/api.js` et `scripts/scrape_schedule.mjs` ; `tests/unit_leagues.test.js` échoue si les deux listes (ou les alias) divergent. ESPN renvoie 403 à l'User-Agent par défaut de Node et aux UA imitant un navigateur : le script serveur s'annonce comme robot avec une URL de contact.
- **TheSportsDB** (`parseSportsDbEvents`, `js/scrapers.js`) : WWE, AEW, boxe, UFC, ONE — sports absents d'ESPN. Les événements sans heure (`strTime` à `00:00:00`) gardent leur date et reçoivent 20:00, sinon la conversion UTC → Est les ferait basculer à la veille.
- **PWHL** : thepwhl.com (`parsePWHLSchedule`), aucune API publique.
- **Esports** : API lolesports.

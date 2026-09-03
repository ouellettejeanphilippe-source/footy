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
- **Dépend de** : la coquille de l'application (`index.html`, `manifest.json`, `styles.css`, `tv.css`, les 14 modules de `js/`, `data/streams.json`, `data/schedule.json`).
- **Utilisé par** : `index.html` (enregistrement du SW).
- **Notes** : réseau d'abord, cache en repli. Voir « Service Worker » plus bas.

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
- **Version actuelle** : `sports-guide-v3` (variable `CACHE_NAME` — à incrémenter à chaque modification du fichier)
- **Liste des assets précachés** (`APP_SHELL`) : `index.html`, `manifest.json`, `styles.css`, `tv.css`, les 14 modules de `js/`, `data/streams.json`, `data/schedule.json` — ajoutés un par un, une ressource absente ne fait pas échouer l'installation.
- **Stratégie** : réseau d'abord, cache en repli, sur les seules requêtes GET de même origine. La clé de cache ignore la chaîne de requête (sinon `data/*.json?t=…` créait une entrée par chargement) et seules les réponses `ok` et `basic` sont stockées.

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
- Un lien `topLevel: true` (pages de miroirs, repli « Page du match », hôte connu pour refuser l'affichage intégré) est ouvert par `openFlux` (`js/multiview.js`) dans un nouvel onglet au lieu du lecteur — jamais dans l'iframe, quel que soit le chemin par lequel l'utilisateur clique dessus (`renderFluxItem`, `js/ui.js`).
- `data/streams.json` contient en plus `fetch` (compteurs de requêtes), `playerHosts` (lecteurs par hôte), `hostPolicy` (voir ci-dessous), `sources[].matchPagesOk/matchPagesFail` et `matches[].scrapeError` pour diagnostiquer un run GitHub Actions sans relire les logs.

### `js/extractors.js` : moteur générique (2026-09-03)
Chaque agrégateur publie son lecteur différemment — une `<iframe>` posée, un bouton qui la remplace au clic (adresse dans un `data-*` ou dans le `onclick`), un blob JSON (Next.js, `allStreams`…), ou un simple lien vers un autre domaine. Les branches par site dans `extractStreamLinks` (`js/scrapers.js`) restent en place pour leurs bons libellés, mais ne voient rien d'un site qu'elles ne connaissent pas — c'est ce qui laissait des sources entières à zéro flux malgré des pages téléchargées avec succès (VIPLeague, Methstreams, MLBBite, Streameast dans le relevé du 2 sept. 2026).

`js/extractors.js` (sans dépendance, comme `js/fetcher.js`) récolte tous les candidats par des stratégies indépendantes du site — `harvestIframes`, `harvestSwitchers` (gestionnaires `onclick`), `harvestRawDataAttrs` (tout attribut `data-*`, quel que soit son nom, en un balayage linéaire du HTML brut — c'est la forme la plus générale du « bouton qui change l'iframe »), `harvestJsonBlobs` (Next.js recollé + littéraux JSON isolés à parenthèses équilibrées, sans expression régulière paresseuse), `harvestAnchors`, `harvestEncoded` (base64, pourcent-encodage) — puis les note (`scoreCandidate`) : provenance structurelle, indices de chemin (`.m3u8`, `/embed/`…), domaine externe ou non, réputation de l'hôte. `extractPlayers(html, pageUrl, {registry})` renvoie la liste triée avec `kind: 'embed' | 'page'`.

**Registre d'intégrabilité** (`getEmbedRegistry`/`recordEmbedResult`, `js/scrapers.js`, persistant sous `localStorage.embed_registry`) : impossible de savoir depuis une adresse si son hôte acceptera d'être affiché dans une iframe — c'est l'en-tête `X-Frame-Options`/`frame-ancestors` du serveur distant qui en décide, illisible depuis une iframe cross-origin en JavaScript. Deux sources l'alimentent : le script serveur (`readFramePolicy`, `scripts/scrape_streams.mjs`) lit ces en-têtes directement et les publie dans `data/streams.json.hostPolicy` — c'est la source fiable, injectée dans le registre client dès `loadPrefetchedStreams` (`js/main.js`) ; et le lecteur Multivision enregistre un refus quand l'utilisateur clique « Ouvrir dans un onglet » depuis l'avertissement affiché sur un lien classé « page » (`fallbackToIframe`, `js/multiview.js`) — un signal plus rare mais qui couvre les hôtes que le serveur n'a pas sondés (footybite.bid par exemple, dont `MATCH_PAGE_BLOCKED_HOSTS` empêche le serveur de visiter les pages).

Dans `extractStreamLinks`, le moteur repasse en complément des branches par site (étape « 5 bis ») : un lien déjà trouvé garde son libellé mais reçoit le classement du moteur (`topLevel` fait autorité) ; un lien nouveau est ajouté. Testé sur des domaines fictifs (`tests/unit_extractors.test.js`) pour garantir qu'aucun test ne dépend du nom d'un site réel.

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

## Mise à jour des liens : une seule voie (2026-09-02)

Auparavant six chemins concurrents alimentaient `m.streamLinks`. Il n'en reste que deux :

1. **Cache serveur, automatique.** `data/streams.json`, régénéré chaque heure par GitHub Actions, agrège les huit sources sans proxy. `loadPrefetchedStreams(force)` le lit au démarrage puis dès qu'il dépasse 10 minutes.
2. **Scraping d'un match, à la demande.** `scrapeMatchFlux` s'exécute à l'ouverture d'une fiche de match.

Le scraping en direct des pages de liste (`fetchSourcePages`) et le pré-scraping au démarrage (`fetchSubPages`) ne servent plus que de secours : `prefetchUsable` dans `loadAll` les déclenche uniquement si le cache manque, est vide ou dépasse trois heures.

`loadAll` est protégé contre le chevauchement : une passe d'arrière-plan lancée pendant qu'une autre tourne réutilise la promesse en cours.

### Hôtes jamais interrogés
`isMatchPageBlocked` (`js/config.js`) écarte Footybite et les miroirs Streameast du téléchargement : mesurés à 58 échecs sur 58 et 14 sur 15. Leur lien reste proposé à l'utilisateur, dont le navigateur y accède sans problème.

### Entonnoir des liens
`finalizeStreamLinks` (`js/scrapers.js`) est le passage obligé de tout lien, quelle que soit sa provenance : écarte les pages d'index et les libellés parasites, dédoublonne sur l'adresse normalisée, puis renseigne site, chaîne de télévision, qualité et langue via `describeStreamLink`.

## Robustesse du rendu et du démarrage (2026-09-03)

### Le rendu du guide ne peut plus effacer l'application
`buildEPG` (`js/ui.js`) vide `#marea` avant de le reconstruire, or `#ov` (l'indicateur de
chargement) et `#errbox` (le message d'erreur et son bouton « Réessayer ») vivent à
l'intérieur de `#marea` : une exception en cours de rendu les faisait disparaître
définitivement, et tout `document.getElementById('ov').style` ultérieur plantait — y
compris celui du `.finally` de `loadAll`, ce qui empêchait `window.hasLoadedOnce` et
l'événement `loadSequenceComplete`, donc l'actualisation automatique des scores.

Trois barrières, dans cet ordre :
1. `getLogo` / `teamColorPair` (`js/db.js`) : la paire de couleurs d'une équipe est
   toujours complète, même pour les 25 entrées de `TEAM_DATA` qui n'en déclarent qu'une.
2. `renderMatches` (`js/ui.js`) construit chaque carte dans un `try/catch` : sur des
   données agrégées, un match malformé est ignoré et journalisé, jamais fatal.
3. `buildEPG` enveloppe `buildEPGInner` et réinstalle `#ov`/`#errbox` si le rendu échoue ;
   `hideLoadingOverlay()` / `showLoadError()` (`js/main.js`) sont les seuls points
   d'accès à ces éléments et tolèrent leur absence.

`tests/test_app_boot.spec.js` verrouille l'ensemble : réseau externe entièrement coupé,
il vérifie que l'application démarre, rend des cartes, conserve `#ov`/`#errbox`, traverse
les huit onglets sans exception et ne déborde pas horizontalement à 390 px. C'est le
premier test qui exécute réellement l'application ; il est déterministe (aucun site tiers).

### Aucune requête ne peut suspendre le démarrage
Toute requête réseau attendue sur le chemin du premier rendu porte un délai maximal :
`fetchRemoteConfig` (`js/config.js`, `REMOTE_CONFIG_TIMEOUT_MS` = 5 s via `AbortController`)
et chaque entrée du `Promise.all` du calendrier (`js/api.js`, `AbortSignal.timeout(8000)`,
TheSportsDB incluse). Un réseau qui avale les requêtes au lieu de les refuser ne bloque
donc plus l'application.

### Flux non appariés : `mergeFluxToApi` (`js/api.js`)
Un flux qui ne correspond à aucun match de la grille officielle reste rangé dans
« Autres Flux » — c'est le principe API-First (un échec de fusion ne doit pas produire de
doublon visible). **Exception** : si l'API ne renvoie aucun match pour cette ligue (ESPN
injoignable, ou ligue absente d'`ESPN_LEAGUES`), aucun doublon n'est possible et le match
garde le nom de ligue lu dans `data/streams.json`, donc sa place dans le Guide. Couvert
par `tests/unit_merge.test.js`.

### Service worker (`sw.js`, `sports-guide-v3`)
Réseau d'abord, cache en repli. La clé de cache d'une requête de même origine ignore sa
chaîne de requête : `data/streams.json?t=…` et `data/schedule.json?t=…` changent d'adresse
à chaque chargement et créaient sinon une entrée de plus par passage, sans jamais servir
de repli. Seules les requêtes GET dont la réponse est `ok` et `basic` sont stockées. La
coquille pré-chargée couvre désormais l'application entière (CSS + 14 modules JS +
`data/*.json`), fichier par fichier pour qu'une ressource absente ne fasse pas échouer
l'installation : l'application démarre et affiche ses matchs sans réseau.

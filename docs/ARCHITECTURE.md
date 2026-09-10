# Architecture de Guide des Sports

Référence technique, organisée par sujet. Elle décrit le code tel qu'il est ; l'histoire des décisions, datée et argumentée, est dans [WORKLOG.md](WORKLOG.md). Ce que l'interface montre est décrit dans [FEATURES.md](../FEATURES.md), la prise en main dans le [README](../README.md).

## 1. Vue d'ensemble

Guide des Sports est une application web statique (PWA) qui affiche le programme sportif du jour, les scores en direct, et pour chaque match les liens de diffusion trouvés sur des sites agrégateurs, avec un lecteur qui joue jusqu'à quatre vidéos côte à côte. Pas de framework, pas de serveur applicatif : du HTML, du CSS, des modules JavaScript, et des fichiers JSON régénérés par GitHub Actions.

Trois principes structurent tout le reste :

1. **Le calendrier fait foi.** La grille est construite à partir de l'API ESPN (et de quelques calendriers annexes). Les sites de flux ne créent jamais de match : leurs liens sont *rattachés* aux matchs du calendrier par appariement de noms d'équipes. Un flux qui ne correspond à rien reste dans une liste de diagnostic.
2. **Le serveur précalcule, le navigateur affine.** Deux workflows GitHub produisent `data/schedule.json` (calendrier) et `data/streams.json` (liens). Le navigateur les lit d'abord, sans proxy, puis complète en direct (scores ESPN, relecture des sources) quand il le peut.
3. **Rien ne doit bloquer l'affichage.** Chaque requête réseau a un délai, un repli et un journal. La grille est dessinée avec ce qu'on a, puis redessinée quand il arrive mieux.

Toutes les heures manipulées sont celles de New York (`America/New_York`), fuseau des sources ; un match porte `matchDate` (jour civil) et `startTime` (`HH:MM`) dans ce fuseau.

## 2. Arborescence

```
index.html              Coquille de l'interface actuelle (onglets Live / Guide / Lecteur / Plus)
legacy.html             Interface classique (même moteur, ancienne présentation)
styles.css, styles-legacy.css, tv.css
sw.js                   Service worker (précache de la coquille, réseau d'abord)
manifest.json           Manifeste PWA
multiview-cleaner.user.js   Script utilisateur Tampermonkey (nettoyage des lecteurs, pont)
domains.json            Adresses courantes des sources et leurs miroirs (réécrit par le serveur)
js/                     Modules de l'application (voir §3)
js/sources/             Un adaptateur par domaine de source
scripts/                Scripts serveur (Node) lancés par les workflows
data/                   schedule.json, streams.json (régénérés automatiquement)
icons/                  Icônes de l'application (SVG source + PNG)
tests/                  Tests unitaires Node et suites Playwright
docs/                   ARCHITECTURE.md (ce fichier), WORKLOG.md (journal)
.github/workflows/      tests, scrape_schedule, scrape_streams, domains-watch
```

## 3. Modules

### 3.1 Noyau

| Fichier | Rôle | Exports à connaître |
|---|---|---|
| `js/main.js` | Amorçage, orchestration des passes de chargement (`loadAll`), minuteries, pages Favoris et ligues, choix de date, bascules interface classique et mode TV. | `loadAll`, `loadPrefetchedStreams`, `actualiserMaintenant`, `applyScoreUpdates`, `reevaluerFinsPresumees`, `updateLiveScores`, `applyTargetDate`, `PREFETCH_STALE_MS` |
| `js/api.js` | Calendrier : ESPN et sources annexes, cache local du jour, rafraîchissement des scores, fusion des flux dans la grille, statistiques et classements. | `ESPN_LEAGUES`, `getApiFirstMatches`, `backgroundUpdateGuide`, `mergeFluxToApi`, `refreshLiveScores`, `calendrierPerime`, `TARGET_DATE`, `fetchGameStats` |
| `js/config.js` | Adresses des sources et miroirs, `SCRAPERS_CONFIG`, configuration distante, proxys, fenêtre Live, préférences de domaine, tri des liens. | `SCRAPERS_CONFIG`, `SOURCE_MIRRORS`, `fetchRemoteConfig`, `applySourceUrl`, `shouldPromoteSource`, `isLiveNow`, `startsWithin`, `minutesUntilStart`, `sortFluxLinks`, `PROXIES` |
| `js/utils.js` | `fetchPage` (pont, proxys, relance parallèle), stockage local sécurisé, onglets et pages, échappement, durée par ligue. | `fetchPage`, `safeStorage*`, `applyFilter`, `showPage`, `getLeagueDuration`, `esc`, `escJs`, `showToast` |
| `js/scrapers.js` | Parseurs par source, extraction des liens d'une page de match, caches (`stream_cache`, `embed_registry`), file de sous-pages. | `parse*`, `scrapeMatchFlux`, `extractStreamLinks`, `finalizeStreamLinks`, `compterFluxUtiles`, `getEmbedRegistry` |
| `js/ui.js` | Rendu du Live et du Guide (`buildEPG`), fiche de match (`openMod`), badges, préférences d'apparence des cartes. | `buildEPG`, `openMod`, `closeMod`, `renderFluxItem`, `timelineBadgeHtml`, `belongsToLive`, `scrollToNow`, `userPrefs` |
| `js/multiview.js` | Lecteur (tuiles, dispositions, modes réduits, plein écran), pages Options, Logs et Script, diagnostic « Cet appareil », mise à jour de l'application. | `setupMultivisionUI`, `addToMultivision`, `updateMultivisionLayout`, `openFlux`, `mettreAJourApplication`, `VERSION_APP` |
| `js/db.js` | Base d'équipes dérivée de `teams.js` : alias, couleurs, logos, ligues, sport et niveau d'une ligue. | `leagueTier`, `DEFAULT_LEAGUES`, `OTHER_LEAGUES`, `getOfficialTeamName`, `normName`, `getLogo`, `sportOfLeague`, `formatLeagueName` |
| `js/match.js` | Appariement de deux matchs, fusion de listes, catégories (féminin, jeunes, réserve), spectacles de catch, similarité de noms. | `isMatchPair`, `debugMatchPair`, `isMatch`, `mergeMatches`, `categorieDuMatch`, `spectacleDeCatch` |
| `js/state.js` | État global `S`, favoris, ordre et niveaux de ligue, journal des sources. | `S`, `setMatches`, `favTeams`, `toggleFavTeam`, `setLeagueTier`, `customLgOrder`, `addScrapeLog` |
| `js/teams.js` | Données statiques `TEAM_DATA` (nom, ligue, couleurs, logo, alias). | `TEAM_DATA` |

### 3.2 Modules spécialisés (sans import, ou presque)

| Fichier | Rôle |
|---|---|
| `js/nuit.js` | La nuit appartient à la veille : un match d'hier soir qui joue encore après minuit reste dans la journée (§5.4). Lu aussi par le script serveur. |
| `js/finpresumee.js` | Fin présumée d'un match quand ESPN se tait (§5.6). |
| `js/playability.js` | Jouabilité observée d'un lien ou d'un hôte, partagée entre le navigateur et `scripts/verify_players.mjs` (§7.3). |
| `js/fetcher.js` | Aides pures de `fetchPage` : liste et ordre des proxys, relégation, statut acceptable, détection des pages d'erreur servies en 200. Importable en Node. |
| `js/extractors.js` | Moteur générique de découverte de lecteurs dans une page, sans branche par site (§6.5). |
| `js/embed-bridge.js` | Pont avec le script utilisateur, et reconstruction d'une page qui refuse l'iframe (§7.4). |
| `js/links.js` | Inventaire des liens par domaine, matchs sans lien, relances de recherche (badge 🔎, « Liens manquants »). |
| `js/debit.js` | Débit et définition réellement mesurés pendant la lecture. |
| `js/directmedia.js` | Lecture directe d'un manifeste `.m3u8` / `.mpd` remonté par le script utilisateur. |
| `js/esports.js` | Transforme les liens LoL Esports en adresses de lecteur encadrables. |
| `js/mv-menu.js` | Le menu flottant unique du lecteur (position fixe, un seul ouvert, clavier). |
| `js/tv-navigation.js` | Navigation aux flèches pour le mode TV. Ce n'est pas un module : il est injecté par `<script src>` quand le mode s'active. |
| `js/sources/index.js` et `js/sources/*.js` | Registre des adaptateurs par domaine. Contrat d'un adaptateur : `hotes`, `extraireLiens(ctx)` et/ou `filtrerLiens(liens)`. Aucun n'importe le module central. |

### 3.3 Graphe d'imports

Huit modules forment un cycle : `api ↔ config ↔ ui ↔ multiview ↔ main ↔ utils ↔ scrapers ↔ state`. Tous les autres sont hors cycle. Conséquence à connaître : l'ordre d'évaluation dépend du module par lequel on entre. En production, l'entrée est `js/main.js` et tout est dans l'ordre. Un script serveur ou un test qui importe le noyau doit importer **`js/scrapers.js` en premier**, ce qui fixe un ordre d'évaluation qui n'exécute pas les initialisations d'interface (voir `scripts/scrape_streams.mjs`), et poser `window.__NO_AUTOSTART__ = true` pour que `main.js` ne démarre pas l'application.

### 3.4 Points d'entrée

`index.html` charge un seul module, `js/main.js`, en fin de page. Son unique script en ligne, en tête, redirige vers `legacy.html` si le stockage local porte `ui_legacy = '1'`. `legacy.html` charge le même module. Les gestionnaires `onclick` du HTML appellent des fonctions exposées sur `window` par leurs modules (par exemple `applyFilter` par `utils.js`, `applyUserPrefs` par `multiview.js`, `toggleTvMode` par `main.js`).

## 4. Démarrage et passes de chargement

Le démarrage (`js/main.js`, fin de fichier) :

1. purge des caches de calendrier autres qu'aujourd'hui et hier (`purgeStaleCalendarCache`) ;
2. lecture de la dernière passe de scraping (`last_scrape_time`, `last_scraped_matches`) ;
3. lecture du calendrier local du jour (`api_calendar_cache_<AAAAMMJJ>`). S'il existe, la grille est dessinée tout de suite avec lui, puis une passe **d'arrière-plan** part ; sinon une passe **de premier plan** part, avec l'écran d'attente ;
4. dans les deux cas, `waitForBridge(1500)` laisse au script utilisateur jusqu'à 1,5 s pour s'annoncer : c'est lui qui décide si le navigateur lira les sources lui-même.

Une passe (`loadAll(isBackground, forceScrape)`, dédoublonnée par `loadInFlight`) enchaîne : configuration distante (première fois), lecture du cache serveur des liens si absent ou vieux de plus de `PREFETCH_STALE_MS` (10 min), calendrier du jour (`getApiFirstMatches`), puis la décision de lire ou non les sources (`skipScraping`) : on saute la lecture si le cache serveur est utilisable (moins de 3 h) et qu'aucune passe récente n'a eu lieu (5 min avec le pont, 15 min sans). Sans lecture, on fusionne et on sort. Avec lecture, la grille est **d'abord dessinée avec les liens déjà connus**, puis les sources sont lues (`fetchSourcePages` pour chaque entrée de `SCRAPERS_CONFIG`), puis la fusion finale redessine. `window.hasLoadedOnce` passe à vrai et l'événement `loadSequenceComplete` est émis.

Minuteries et réveils :

| Quoi | Période | Où |
|---|---|---|
| Passe complète d'arrière-plan | 5 min | `js/main.js` |
| Rafraîchissement des scores ESPN (passe complète) | 5 min, et au retour au premier plan (au plus une fois par minute) | `js/api.js` (`startLiveScoreRefresh`, armé seulement quand le jour visé est aujourd'hui) |
| Scores des matchs en cours (passe ciblée) | 1 min, à l'ouverture, et au retour au premier plan | `js/api.js` (`rafraichirScoresEnDirect`, §5.7) |
| Réévaluation des fins présumées | 1 min | `js/main.js` (`reevaluerFinsPresumees`) |
| Relecture des liens au retour au premier plan | si le cache serveur a plus de 10 min ou a échoué, au plus une fois par minute | `js/main.js` |
| Ligne du direct dans le Guide | 1 min | `js/ui.js` (`updateNowLine`) |
| Relecture de la page du match, fiche ouverte | 60 s | `js/scrapers.js` (`INTERVALLE_FICHE_MS`) |
| Relecture des sources des matchs du lecteur | 3 min | `js/scrapers.js` (`INTERVALLE_TUILE_MS`) |

## 5. Le calendrier

### 5.1 Sources

- **ESPN** : `ESPN_LEAGUES` (`js/api.js`) associe 74 noms de ligue à 47 chemins distincts ; chaque chemin est interrogé sur `https://site.api.espn.com/apis/site/v2/sports/<chemin>/scoreboard?dates=<AAAAMMJJ>`, en direct, sans proxy, délai 8 s. Le compte des tentatives et des échecs (`espnInfo`) est affiché dans Logs → Cet appareil. La liste doit rester identique à celle de `scripts/scrape_schedule.mjs` (`unit_leagues` le vérifie).
- **Six chemins à la fois** (`ESPN_CONCURRENCE`, `enPiscine`). Un navigateur n'ouvre que six connexions par hôte, et `AbortSignal.timeout` compte depuis la **création** du signal, pas depuis l'envoi : lancés tous ensemble, les derniers chemins expiraient dans la file d'attente sans avoir été envoyés. La nuit, où la veille est relue aussi, cela faisait 94 requêtes simultanées. Une seule file couvre les deux journées, et une tâche qui échoue n'arrête pas sa voie.
- **Annexes** : LoL Esports (API), PWHL (page de calendrier), F1 et IndyCar (fichiers ICS), TheSportsDB (sports de combat), wwe.com (JSON des événements). Les mêmes six sources existent dans le script serveur.

### 5.2 D'où vient le calendrier affiché

`getApiFirstMatches(date)` (`js/api.js`) :

1. cache local `api_calendar_cache_<jour>` s'il est **frais** : `calendrierPerime` le juge périmé au-delà de `CALENDAR_STALE_MS` (10 min), s'il est d'un autre jour, vide, ou sans horodatage `savedAt` ;
2. sinon, pour aujourd'hui, `data/schedule.json` si son `fetchDate` est le jour ;
3. sinon ESPN et les annexes en direct (`fetchAndProcessApiMatches`), avec un repli sur le cache local même périmé si tout échoue, et un avertissement.

Trois garde-fous dans la lecture en direct :

- un résultat **vide** n'est jamais écrit comme calendrier du jour ;
- une passe où **aucune requête ESPN n'a répondu** est un échec même si une source annexe a fourni un match (sinon un gala de catch devenait le calendrier entier) ;
- une passe **partielle** (certains chemins muets) ne décrit pas la journée entière : `fusionnerPassePartielle` garde du calendrier connu ce que la passe n'a pas revu, et seule une passe **complète** fait autorité et élague. Sans cela, une ligue dont le chemin échouait disparaissait du calendrier, puis de la grille à la passe suivante, avec ses scores — c'est ce qui faisait apparaître et disparaître les scores d'un tour à l'autre. Le rafraîchissement des scores emprunte ce chemin toutes les cinq minutes et à chaque retour au premier plan. `window.calendrierInfo.source` indique `espn (partiel)` dans ce cas.

### 5.3 L'objet match

Construit par `processEspnData` (`js/api.js`) :

```
id               'espn_<événement>' (ou 'espn_<événement>_<compétition>' pour une épreuve)
league, flag, color, homeTeam, awayTeam, homeLogo, awayLogo
matchDate        'AAAA-MM-JJ'        startTime  'HH:MM'        durationMinutes  getLeagueDuration(league)
status           'upcoming' | 'live' | 'finished'
score            [domicile, extérieur] ou null       minute   chrono ou 'P<n>'
period, detail   période et libellé ESPN (« Top 10th », « OT »)
streamLinks      []      streamsLoaded  false      source 'api'      isPlayoff
```

Enrichi ensuite : `streamLinks`, `matchUrl`, `altUrls` par la fusion (§6.6) ; `prefetched` et `streamsLoaded` par le cache serveur ; `_scoreAt` (horodatage de la dernière nouvelle ESPN) par `applyScoreUpdates` ; `_finPresumee` par `reevaluerFinsPresumees`.

Un lien de flux porte `name`, `url`, `quality`, `lang`, `icon`, `source` (identifiant de la source), `site`, `channel` (chaîne TV reconnue), `topLevel` (l'hôte refuse l'iframe), `verified` (`plays` / `blocked` / `none`, posé par le serveur) et, côté navigateur, `playerUrl` (lecteur résolu).

### 5.4 La nuit appartient à la veille (`js/nuit.js`)

Un match porte la date de son coup d'envoi. À minuit, « aujourd'hui » change, mais le match de 22:05 joue encore. Règle : un match daté d'hier dont coup d'envoi + durée dépasse minuit (`debordeSurLaNuit`) fait partie de la journée d'aujourd'hui (`appartientAuJour`). Conséquences :

- les cinq filtres du jour de `js/main.js` et le filtre des liens du cache serveur (`appliquerCacheServeur`, avec la durée large `DUREE_LARGE_MIN` puisque les flux n'ont pas de durée) passent par `appartientAuJour` ;
- pendant la nuit (`nuitEnCours`, avant 06:00), `fetchAndProcessApiMatches` relit aussi la veille chez ESPN et ne garde que ce qui déborde ; le rafraîchissement des scores en profite ; le script serveur fait de même ;
- dans le Guide, `minutesDansLaJournee` rend un départ négatif pour un match d'hier soir : sa case commence à 00:00 sur ce qui lui reste, et `comparerHeures` le trie avant 00:00 ;
- `memeMatchATraversLaNuit` laisse l'appariement accepter un flux relu après minuit et daté du jour par le serveur, à la même heure de coup d'envoi.

### 5.5 Fenêtre Live (`js/config.js`)

`minutesUntilStart(m, now)` rend l'écart signé jusqu'au coup d'envoi, corrigé par `matchDate`. `isLiveNow` : faux si terminé, faux si commencé depuis plus de `LIVE_MAX_DURATION_MIN` (240) quoi qu'en dise la source, faux si présumé fini ; vrai si la source dit `live` ou si le coup d'envoi est dans moins de `LIVE_GRACE_BEFORE_MIN` (15). `startsWithin(m, LIVE_WINDOW_MIN = 60)` couvre « à venir dans l'heure ». L'onglet Live montre `isLiveNow || startsWithin`.

### 5.6 Fin présumée (`js/finpresumee.js`)

Un match ne passe à « Fin » que sur l'ordre d'ESPN. Quand ESPN ne répond plus, la carte resterait « Direct » des heures. Règle de bon sens en second rideau : si aucune nouvelle d'ESPN pour ce match depuis `FRAICHEUR_SCORES_MS` (12 min) et que le temps écoulé dépasse la durée du sport plus `MARGE_FIN_MIN` (45 min), le match est présumé fini (« Fin ? ») et quitte le Live. Si la dernière nouvelle disait déjà « prolongation » (`enProlongation` : libellé OT / extra / shootout, ou période au-delà du règlement : 9 manches, 3 tiers, 4 quarts, 2 mi-temps), la marge passe à `MARGE_PROLONGATION_MIN` (120). Réévalué chaque minute.

### 5.7 Scores

Deux passes, de portée et de cadence différentes.

**La passe complète**, toutes les 5 minutes : `refreshLiveScores` → `backgroundUpdateGuide` → `fetchAndProcessApiMatches` → `applyScoreUpdates` (`js/main.js`), qui met à jour `S.matches` par identifiant (statut, score, minute, période, libellé, `_scoreAt`) puis le DOM (`updateLiveScores`), et reconstruit le Live si l'ensemble des cartes attendues a changé (`liveViewIsStale`). Elle reconstruit toute la journée : 47 chemins ESPN plus les calendriers annexes.

**La passe ciblée**, toutes les minutes et dès l'ouverture : `rafraichirScoresEnDirect` (`js/api.js`). Un score ne demande que les ligues qui ont un match **en cours** — une à cinq adresses, pas quarante-sept :

- `tachesEnDirect(matches, now)` rend les couples (chemin, jour) distincts des matchs que `isLiveNow` retient. Le chemin vient de `m.espnPath`, mémorisé sur le match par `processEspnData` ; à défaut (calendrier rangé par une version antérieure) le nom de la ligue le retrouve dans `ESPN_LEAGUES`. Le jour est celui du match, pas celui du jour courant : un match d'hier soir encore en cours est rangé chez ESPN sous la date d'hier (§5.4).
- `etatsDepuisEspn(data, path)` réduit la réponse à ce que les cartes affichent — identifiant, statut, score, minute, période, libellé, heure — sans reconstruire équipes, logos ni ligue. Pour une épreuve, c'est l'état de la séance qui compte, pas celui du week-end.
- `majScoresDansCache(todayStr, etats)` reporte ces états dans `api_calendar_cache_<jour>`. **Indispensable** : `mergeFluxToApi` ne reporte pas les scores d'un état à l'autre, donc la passe complète suivante, qui relit ce calendrier, ramènerait les scores d'avant.
- Une passe à la fois (`enVolScoresDirects`), et jamais deux à moins de `SCORE_LIVE_MIN_GAP_MS` (15 s), pour que l'intervalle et le retour au premier plan ne se doublent pas.

À l'ouverture, la grille vient souvent du calendrier local, dont les scores peuvent avoir dix minutes ; la passe ciblée part 1,5 s après le démarrage, le temps que `S.matches` soit posé.

## 6. Les liens de diffusion

### 6.1 Cache serveur (`data/streams.json`)

Produit toutes les 30 min par `scripts/scrape_streams.mjs` (§12, relais). Clés : `generatedAt`, `date`, `fetch`, `sources[]` (état de chaque source), `hostPolicy` (intégrabilité par hôte, lue des en-têtes X-Frame-Options et CSP côté serveur), `hostPlay` (jouabilité observée par hôte), `verifiedAt`, `matches[]`. Le navigateur le lit par `loadPrefetchedStreams` → `lireCacheServeur` (deux essais à 1,5 s d'écart, puis le cache HTTP du navigateur en troisième essai) → `appliquerCacheServeur` (filtre du jour, marquage `prefetched`, politique d'intégration versée dans le registre appris, registre de jouabilité). Le dernier cache lu avec succès est conservé en mémoire et réappliqué si une lecture échoue ; `window.prefetchedStreamsError` retient l'échec, que les cartes affichent (badge ⚠).

### 6.2 Sources (`SCRAPERS_CONFIG`, `js/config.js`)

Onze sources : footybite, mlbbite, sportsurge, buffstreams, streameast, onhockey, vipleague, streamed (API JSON), methstreams, flexfitness, liveleagues. Chaque entrée dit si l'accueil porte des matchs, quelles sous-pages lire par sport (`getSourcePages`, restreint aux sports du jour par `sportOfLeague`), et quel parseur de `js/scrapers.js` s'applique. `MATCH_PAGE_BLOCKED_HOSTS` liste les hôtes dont les pages de match sont refusées côté serveur.

### 6.3 Adresses, miroirs et promotion

Les sites changent de domaine sans prévenir : c'est la panne la plus fréquente. `domains.json` porte l'adresse courante de chaque source et ses miroirs (`MIRRORS`). Le navigateur le lit au démarrage (`fetchRemoteConfig`, depuis `raw.githubusercontent.com`, délai 5 s) et applique chaque adresse par `applySourceUrl`. Le script serveur essaie l'adresse puis les miroirs (`getSourceCandidates`) et ne **promeut** un miroir (`shouldPromoteSource`) que s'il a répondu **et livré au moins un match** : un domaine racheté rend un 200 de parking. `canonicalOrigin` détecte un domaine qui ne fait plus que rediriger. Le résultat est réécrit dans `domains.json` et commité.

### 6.4 `fetchPage` (`js/utils.js`)

Ordre : cache mémoire et déduplication des requêtes en vol → **pont du script utilisateur** (§7.4 ; réponse rejetée sous 200 caractères) → proxys CORS. La liste des transports (`buildProxyList`, `js/fetcher.js`) : proxy personnalisé, accès direct (5 s), cors.sh, corsproxy.io (avec clé seulement), allorigins (deux formes), codetabs. Ils sont ordonnés par santé (`proxy_health`, relégation 3 min après échec), et le suivant est **lancé en parallèle** après un court délai plutôt qu'attendu en série. Un 404 n'est accepté que pour la découverte des pages de liste (`soft404`), jamais pour une page de match ; une page d'erreur servie en 200 est reconnue (`inspectPageContent`).

### 6.5 Extraction des liens d'une page de match

`scrapeMatchFlux(m)` lit la page (`matchUrl`, puis `altUrls`), applique le parseur de la source, puis le moteur générique `extractPlayers` (`js/extractors.js`) : six récolteurs indépendants du site (iframes, boutons de bascule `data-*`, attributs `data-*` bruts, blobs JSON Next.js/Nuxt, ancres, adresses encodées), dédoublonnage par adresse canonique, note par provenance, indices de chemin, domaine et réputation apprise (`embed_registry`), puis classement `embed` (encadrable) ou `page`. Les adaptateurs de `js/sources/` filtrent ou complètent par domaine. `finalizeStreamLinks` normalise chaque lien (nom, qualité, langue, chaîne, `topLevel`) et `retirerLiensDeDecor` écarte les liens de menu déguisés en lecteurs. Résultat mis en cache 30 min (`stream_cache`).

### 6.6 Fusion dans le calendrier (`mergeFluxToApi`, `js/api.js`)

Un index des matchs de la grille par nom d'équipe normalisé (nom entier, puis mots d'au moins quatre lettres) est bâti une fois ; les candidats d'un flux sont l'intersection des deux noms, et `isMatchPair` n'est payé que sur eux (le balayage complet est réservé aux épreuves : courses, galas, e-sport). En programme double, le candidat à l'heure la plus proche gagne. Le match apparié reçoit les liens dédoublonnés par adresse, `matchUrl` et `altUrls`. Un flux non apparié va dans `S.unmatchedStreams` (diagnostic) et **ne crée pas de carte**. Un lien disparu d'une passe est conservé jusqu'à trois absences (`streamMissingCounts`). Les doublons d'un même spectacle de catch sont réunis. Durée mesurée dans `window.fusionMs`.

### 6.7 Liens manquants

Badge 🔎 sur une carte sans lien (`cardSearchLinks`, `js/links.js`) : recherche immédiate pour ce match. Badge ⚠ si le cache serveur est en échec (`cardRetryLinks` : relecture). « 🔎 Liens manquants » de l'interface classique (`findMissingLinks`) balaie tous les matchs à venir sans lien.

## 7. Le lecteur

### 7.1 La tuile charge la page entière

Une tuile est une iframe qui charge la page du site telle quelle, **sans attribut `sandbox`** (certains lecteurs le détectent et refusent de jouer ; retiré le 5 septembre 2026, verrouillé par un test). YouTube et Twitch sont convertis en lecteur intégré ; les règles de l'Investigator (`custom_scraper_rules`) s'appliquent (`resolveStreamUrl`). Un manifeste direct (`.m3u8`, `.mpd`) est joué par un élément `<video>` avec hls.js (`js/directmedia.js`).

### 7.2 Choix du flux et bascule

`sortFluxLinks` (`js/config.js`) classe les liens : observation de lecture (`js/playability.js`) d'abord, puis domaines préférés ou évités (`domain_prefs`), puis qualité annoncée. La tuile prend le premier. Si le script utilisateur est présent et qu'aucune vidéo n'est signalée dans les `patienceMs` (30 s, 90 s pour un hôte connu comme lent), la tuile passe seule au suivant, une fois par lien. Sans script, seule la commande ⏭ change de source.

### 7.3 Jouabilité observée (`js/playability.js`)

`verdictFromObservation` : `plays` si du trafic vidéo ou un `<video>` prêt a été vu, `blocked` si le cadre a été refusé, `none` sinon. `recordObservation` cumule par hôte (`{tested, plays}`, atténué au-delà de 40 essais). `playabilityScore` : 3 pour un lien vérifié `plays`, −1 pour `blocked`, sinon d'après le taux de l'hôte. Le serveur (`scripts/verify_players.mjs`) alimente `hostPlay` et `verified` ; le navigateur cumule ses propres observations dans `play_ledger` ; `mergeLedgers` réunit les deux.

### 7.4 Pont et reconstruction (`js/embed-bridge.js`)

Le script utilisateur, quand il est installé, répond dans la fenêtre principale à un protocole `postMessage` de quatre messages (`mv_bridge_hello`, `mv_bridge_ready`, `mv_bridge_fetch`, `mv_bridge_page`) : il télécharge une page par `GM_xmlhttpRequest`, depuis l'adresse de l'utilisateur et avec ses cookies, là où les proxys sont refusés. `getBridgeStatus()` dit s'il est là et sa version ; `fetchViaBridge` est le premier transport de `fetchPage`. Pour une page qui refuse l'iframe, `resolveBlockedEmbed` récupère son HTML (pont puis proxy), en extrait un lecteur encadrable (`pickEmbeddablePlayer`) ou, à défaut, reconstruit le document en `srcdoc` (`buildEmbedDocument`), récursivement jusqu'à trois niveaux. La reconstruction sert à la lecture des pages, pas à peupler les tuiles.

### 7.5 Le repos des commandes

Trois secondes sans un geste, et la barre du lecteur comme les en-têtes de tuiles s'effacent pour ne pas rester posés sur la vidéo (`window.resetMvIdleTimer`, `appliquerRepos`). Deux exceptions : en mode réduit dans la page (colonne, fenêtre flottante, barre), tout reste, parce que le lecteur est déjà petit.

Le point délicat est la **fenêtre détachée** : `toggleDocumentPiP` déplace `#mv-grid-wrapper`, donc toutes les tuiles, dans le document d'une autre fenêtre. Tout ce qui raisonnait sur `#mv-container` cessait alors d'opérer : aucun geste fait là-bas n'y parvenait, et `mvContainer.querySelectorAll('.mv-hdr')` n'y trouvait plus rien. On agit donc sur la grille là où elle se trouve (`grilleDuLecteur`, `grilleDetachee`), et `toggleDocumentPiP` fait écouter la fenêtre qui la porte.

### 7.6 Sortie forcée

Si la fenêtre est quittée dans les 15 s qui suivent la pose d'une tuile, les adresses posées sont notées (`mv_sortie_forcee`, dix minutes). Au retour, la tuile le dit et propose d'ouvrir le site ou de charger quand même.

### 7.7 Signaux du script utilisateur

Dans une page de lecteur, le script remonte à la fenêtre principale `video_state` (une vidéo joue : allume la pastille et permet la bascule automatique), `video_stats` (débit et définition, `js/debit.js`) et `media_url` (manifeste vu passer, `js/directmedia.js`). Il obéit à `mv_mute` et `mv_unmute` (une seule tuile a le son) et à `mv_clean`.

## 8. Appariement (`js/match.js`)

`isMatchPair(a, b)` → `debugMatchPair`, qui rend `{isMatch, reason}` pour le diagnostic. Gardes dans l'ordre :

1. **Dates** : deux dates différentes ferment l'appariement, sauf `memeMatchATraversLaNuit`.
2. **Catégories** : le dernier mot du nom donne `F` (féminin), `U<âge>` ou `R` (réserve, B, académie) ; `categoriesCompatibles` n'accepte `F` face à rien que si la ligue d'en face est féminine. Deux façons d'écrire la même catégorie s'apparient.
3. **Familles de sport** : deux familles connues et différentes ne s'apparient jamais.
4. **Épreuves** (F1, IndyCar, catch, e-sport) : `spectacleDeCatch` dégage le spectacle (Raw, SmackDown, NXT, Dynamite…) de la fédération et du numéro d'épisode ; deux spectacles différents ne s'apparient jamais ; sinon comparaison du nom combiné.
5. **Équipes** : `isMatch(nom1, nom2)` sur les deux équipes, avec les alias de `TEAM_DATA` (`getOfficialTeamName`) et une similarité de Levenshtein pour les coquilles, sans jamais confondre deux équipes distinctes d'une même ville.

## 9. Interface

- **État** : `S` (`js/state.js`) porte `matches`, `matchMap`, `filter` (`live` / `all`), `searchQuery`, les sections repliées, les rails, les flux non appariés.
- **Rendu** : `buildEPG(matches)` (`js/ui.js`) protège `buildEPGInner` : une exception de rendu ne peut plus effacer l'application (la boîte d'erreur est recréée si besoin). Chaque rendu incrémente `window.rendusGrille`, que les tests utilisent pour attendre une grille stable. En mode Live, les cartes `.prime-*` par section ; en mode Guide, la grille horaire positionnée par variables CSS (`--start-h`, `--start-m`, `--duration-m`).
- **« hier » / « demain »** : `libelleJour(m, jour)` (`js/nuit.js`) dit si un match n'est pas daté du jour affiché. La carte et la fiche portent alors un `<span class="prime-day">` à côté du bandeau d'état, hors de `.status-text` pour que la mise à jour des scores en place ne l'efface pas ; la case du Guide préfixe son texte (« hier · LIVE | 2 - 1 », « hier · 22:05 »).
- **Identifiant d'une carte** : `mb-<id du match>`, seul lien entre le DOM et `S.matchMap`. Un favori figure dans la section Favoris **et** dans sa section : sa copie Favoris porte `mb-<id>_fav_copy`, sinon deux éléments partageraient un `id` et `getElementById` ne verrait que le premier. Tout code qui remonte d'une carte au match passe par `getOriginalMatchId` (`js/ui.js`), qui retire ce suffixe ; la mise à jour des scores en place (`js/main.js`) cherche les deux identifiants.
- **Niveaux de ligue** : `leagueTier` (`js/db.js`) rend `main`, `secondary`, `other` ou `ignored` ; le choix de l'utilisateur (`league_tiers`) prime sur `DEFAULT_LEAGUES` et `OTHER_LEAGUES`.
- **Fiche** : `openMod(m)` dessine la bannière, charge les compléments ESPN (`fetchGameStats`, `fetchTeamInfo`) et la colonne des flux ; la page du match est relue à l'ouverture (`doitRelireLaPage`) puis chaque minute.
- **Préférences d'apparence** : `userPrefs` (`user_prefs`), appliquées par `applyUserPrefs` → `initPrefs` → reconstruction.
- **Interface classique** : `legacy.html` + `styles-legacy.css`, même moteur ; bascule `toggleLegacyUi`, retenue sous `ui_legacy`, appliquée par le script en tête d'`index.html`.
- **Mode TV** : `toggleTvMode` injecte `tv.css` et `js/tv-navigation.js` (navigation spatiale aux flèches, Entrée pour cliquer) et les retire proprement ; retenu sous `pref-tv-mode`.

## 10. Stockage local

Tout passe par `safeStorage*` (`js/utils.js`), qui compte les écritures refusées (`stockageInfo`, affiché dans Logs). Aucun `sessionStorage` ni IndexedDB.

| Clé | Contenu |
|---|---|
| `api_calendar_cache_<AAAAMMJJ>` | Calendrier du jour `{fetchDate, savedAt, matches}` ; seuls aujourd'hui et hier sont conservés. |
| `last_scrape_time`, `last_scraped_matches`, `scraper_stats` | Dernière lecture directe des sources. |
| `stream_cache` | Liens par match, 30 min. |
| `embed_registry` | Réputation d'intégrabilité par hôte. |
| `domain_prefs` | Domaines préférés ou évités. |
| `play_ledger` | Jouabilité observée dans ce navigateur. |
| `proxy_health` | Santé des transports. |
| `direct_media`, `debits` | Manifestes directs et mesures de débit, 3 h. |
| `fav_teams`, `league_tiers`, `custom_lg_order`, `lg_order_migrated_v2` | Favoris, niveaux et ordre des ligues. |
| `user_prefs` | Apparence et options. |
| `mv_state`, `mv_sortie_forcee`, `multiviewPipMode`, `multiviewPipPrevMode`, `multiviewFloatingRect`, `multiviewMinimizedRect`, `gmPinnedMatches` | État du lecteur. |
| `custom_scraper_rules` | Règles de l'Investigator. |
| `custom_proxy_url`, `cors_sh_api_key`, `corsproxy_io_api_key` | Réglages réseau. |
| `ui_legacy`, `pref-tv-mode`, `hasSeenScriptModal` | Interface classique, mode TV, fenêtre du script déjà montrée. |

## 11. Service worker et version

`sw.js` : `CACHE_NAME = 'sports-guide-v18'`. Stratégie réseau d'abord, cache en repli, sur les seules requêtes GET de même origine ; la clé de cache ignore la chaîne de requête (sinon `data/*.json?t=…` créait une entrée par chargement) ; seules les réponses `ok` et `basic` sont rangées. `APP_SHELL` précache la coquille complète (HTML, CSS, manifeste, tous les modules `js/`, les icônes), fichier par fichier pour qu'une ressource absente ne fasse pas échouer l'installation. Les deux fichiers de données n'en font plus partie depuis le 9 septembre 2026 : périmés en trente minutes, ils coûtaient 1,2 Mo par nouvelle version ; le gestionnaire `fetch` les range dès leur première lecture, ce qui suffit au repli hors ligne. `index.html` et `legacy.html` annoncent les huit modules les plus lourds en `modulepreload`, pour qu'ils soient téléchargés en parallèle plutôt que découverts en cascade depuis `js/main.js`.

**Règle** : toute modification de `sw.js` ou d'un fichier précaché s'accompagne d'une nouvelle valeur de `CACHE_NAME`, recopiée dans `VERSION_APP` (`js/multiview.js`), qui est ce que Logs → Cet appareil affiche. Trois tests (`unit_diagnosticappareil`, `unit_favicon`, `unit_majapp`) vérifient que les deux chaînes sont identiques. Un nouveau module `js/` doit être ajouté à `APP_SHELL`.

`mettreAJourApplication()` désinscrit les service workers, vide tous les caches et recharge sur une adresse neuve (`?maj=<horodatage>`), sans toucher au stockage local.

## 12. Scripts serveur et workflows

| Workflow | Déclencheur | Ce qu'il fait | Ce qu'il commite |
|---|---|---|---|
| `tests.yml` | push et PR sur `main` | `npm ci`, Chromium Playwright (mis en cache d'une exécution à l'autre), `npm test` ; lecture seule, 20 min max | rien |
| `scrape_schedule.yml` | tous les jours à 09:00 UTC (souvent en retard, parfois sauté : `scrape_streams.yml` rattrape), à la demande, et sur un push sur `main` qui touche le script du calendrier ou les bases d'équipes (un passage à la fois, 20 min max) | `node scripts/scrape_schedule.mjs` | `data/schedule.json` |
| `scrape_streams.yml` | toutes les 30 min par **relais** (le job `relais` attend le créneau suivant puis relance le workflow par `workflow_dispatch`, ce que le `GITHUB_TOKEN` a le droit de faire) ; le cron à :17 et :47 sert d'amorce et de filet, GitHub ne l'honorant que cinq à six fois par jour ; à la demande ; un passage à la fois, sans annulation ; arrêt du relais par la variable de dépôt `SCRAPE_RELAIS = off`. Régénère d'abord `data/schedule.json` s'il n'est pas daté du jour (heure de New York), parce que le cron quotidien subit les mêmes retards | `node --max-old-space-size=8192 scripts/scrape_streams.mjs`, puis `scripts/verify_players.mjs` (sans faire échouer le passage) | `data/streams.json`, `domains.json` |
| `domains-watch.yml` | tous les jours à 05:00 UTC, à la demande | `npm run test:domains` ; lecture seule, 20 min max | rien (surveillance ; sortie de `npm test` parce que Cloudflare répond selon l'adresse du runner) |

- `scripts/scrape_schedule.mjs` reconstruit le calendrier du jour (ESPN et annexes) avec ses propres copies des aides de date et en important `js/nuit.js` ; avant 06:00 (heure de New York) il relit aussi la veille. Mêmes règles que le client : six chemins à la fois, et une passe partielle **fusionne** avec le `data/schedule.json` déjà publié du même jour au lieu de le remplacer — sinon un passage où quelques chemins échouent publiait un calendrier amputé pour tous les appareils jusqu'au suivant. Aucune réponse du tout : le fichier n'est pas touché.
- `scripts/scrape_streams.mjs` réutilise **les parseurs du client** dans un DOM jsdom (`__NO_AUTOSTART__`), avec un `fetch` direct (User-Agent de navigateur, Referer), lit chaque source et ses sous-pages, puis les pages de match (`--limit`, 900 par défaut), relève la politique d'intégration de chaque hôte, promeut les miroirs et réécrit `domains.json`. Mêmes garde-fous que le calendrier depuis le 9 septembre 2026 : **aucune source vivante, le fichier n'est pas touché** ; une passe partielle **conserve** les matchs déjà publiés des sources muettes, à partir de la veille (`conserverSourcesMuettes`, `js/config.js`), et une date antérieure à la veille est écartée. Le gagnant d'une source est fixé après sa lecture par `gagnantApresLecture` (`js/config.js`) : l'adresse qui a répondu, à condition d'avoir livré des matchs.
- `scripts/verify_players.mjs` charge dans un vrai Chromium, encadrés comme une tuile, les lecteurs des matchs en direct ou imminents (budget 5 min, 150 au plus) et pose `verified` par lien et `hostPlay` par hôte.

Les commits automatiques ne déclenchent pas `tests.yml`.

## 13. Tests

`npm test` lance `npm run test:unit`, c'est-à-dire `node --test tests/*.test.js` (tous les fichiers unitaires Node, découverts par le motif : un nouveau test n'a rien à déclarer, et un échec n'arrête pas les autres), puis deux suites Playwright : `test_app_boot.spec.js` (démarrage et interface) et `test_cleaner.spec.js` (le script utilisateur). `npm run test:domains` lance à part `test_domains.spec.js`.

Chaque test unitaire ouvre par un commentaire qui dit quel problème l'a motivé. Les modules du noyau sont chargés sous jsdom (`window` et `localStorage` factices) ; les modules sans import sont importés directement.

Les tests de démarrage servent le dépôt par un serveur HTTP local, **coupent tout réseau extérieur** (ni ESPN, ni proxy, ni source : l'application tourne sur `data/schedule.json` et `data/streams.json` du dépôt), **figent l'horloge** à l'instant du calendrier où le plus de matchs sont en cours (`instantDesDonnees`, à partir du `fetchDate` de `data/schedule.json`), attendent `window.hasLoadedOnce`, l'apparition des cartes, puis une grille stable (`attendreGrilleStable`, sur `window.rendusGrille`). Un test simule ESPN quand il le faut (`page.route` sur `site.api.espn.com`). Les erreurs de page sont collectées et doivent être vides.

Pour lancer les suites Playwright avec un Chromium déjà installé ailleurs, une configuration locale peut fixer `use.launchOptions.executablePath`.

## 14. Conventions

- **Ajouter une source de flux** : une entrée dans `SCRAPERS_CONFIG` et `SOURCE_VAR_NAMES` (`js/config.js`), l'adresse et ses miroirs dans `domains.json` et `SOURCE_MIRRORS`, un parseur dans `js/scrapers.js`, au besoin un adaptateur dans `js/sources/` (déclaré dans `js/sources/index.js`), un test unitaire, et l'ajout dans `test_domains.spec.js`.
- **Ajouter une ligue ESPN** : dans `ESPN_LEAGUES` (`js/api.js`) **et** dans `scripts/scrape_schedule.mjs` ; `DEFAULT_LEAGUES` ou `OTHER_LEAGUES` (`js/db.js`) pour son niveau ; `getLeagueDuration` (`js/utils.js`) pour sa durée.
- **Nouveau module** : sans import si possible ; sinon entrer dans le cycle en connaissance de cause ; l'ajouter à `APP_SHELL` et bumper la version.
- **Toute modification** : un test qui l'aurait vue tomber, une entrée dans `docs/WORKLOG.md`, et cette page si un module, une fonction publique ou une règle change.

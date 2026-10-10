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
styles.css, tv.css
sw.js                   Service worker (précache de la coquille, réseau d'abord)
manifest.json           Manifeste PWA
multiview-cleaner.user.js   Script utilisateur Tampermonkey (nettoyage des lecteurs, pont)
domains.json            Surcharge vivante : adresses des sources et miroirs (réécrits par le serveur),
                        structure des sources (SOURCES) et listes d'hôtes (HOSTS) — voir §6.3
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
| `js/main.js` | Amorçage, orchestration des passes de chargement (`loadAll`), minuteries, pages Favoris et ligues, choix de date, bascule du mode TV. | `loadAll`, `loadPrefetchedStreams`, `actualiserMaintenant`, `applyScoreUpdates`, `reevaluerFinsPresumees`, `updateLiveScores`, `applyTargetDate`, `PREFETCH_STALE_MS` |
| `js/api.js` | Calendrier : ESPN et sources annexes, cache local du jour, rafraîchissement des scores, fusion des flux dans la grille, statistiques et classements. | `ESPN_LEAGUES`, `getApiFirstMatches`, `backgroundUpdateGuide`, `mergeFluxToApi`, `refreshLiveScores`, `calendrierPerime`, `TARGET_DATE`, `fetchGameStats` |
| `js/config.js` | Adresses des sources et miroirs, `SCRAPERS_CONFIG`, configuration distante, proxys, fenêtre Live, préférences de domaine, tri des liens. | `SCRAPERS_CONFIG`, `SOURCE_MIRRORS`, `fetchRemoteConfig`, `applySourceUrl`, `shouldPromoteSource`, `isLiveNow`, `startsWithin`, `minutesUntilStart`, `sortFluxLinks`, `PROXIES` |
| `js/utils.js` | `fetchPage` (pont, proxys, relance parallèle), stockage local sécurisé, onglets et pages, échappement, durée par ligue. | `fetchPage`, `safeStorage*`, `applyFilter`, `showPage`, `getLeagueDuration`, `esc`, `escJs`, `showToast` |
| `js/scrapers.js` | Parseurs par source, extraction des liens d'une page de match, caches (`stream_cache`, `embed_registry`), file de sous-pages. | `parse*`, `scrapeMatchFlux`, `extractStreamLinks`, `finalizeStreamLinks`, `compterFluxUtiles`, `getEmbedRegistry` |
| `js/ui.js` | Rendu du Live et du Guide (`buildEPG`), fiche de match (`openMod`), badges, préférences d'apparence des cartes. | `buildEPG`, `openMod`, `closeMod`, `renderFluxItem`, `timelineBadgeHtml`, `belongsToLive`, `scrollToNow`, `userPrefs` |
| `js/multiview.js` | Lecteur (tuiles, dispositions, modes réduits, plein écran), pages Options, Logs et Script, diagnostic « Cet appareil », mise à jour de l'application. | `setupMultivisionUI`, `addToMultivision`, `updateMultivisionLayout`, `openFlux`, `mettreAJourApplication`, `VERSION_APP` |
| `js/db.js` | Base d'équipes dérivée de `teams.js` : alias, couleurs, logos, ligues, sport et niveau d'une ligue. | `leagueTier`, `DEFAULT_LEAGUES`, `OTHER_LEAGUES`, `getOfficialTeamName`, `nomOfficielDansLigue`, `normName`, `getLogo`, `sportOfLeague`, `formatLeagueName` |
| `js/match.js` | Appariement de deux matchs, fusion de listes, catégories (féminin, jeunes, réserve), spectacles de catch, séances de course, similarité de noms. | `isMatchPair`, `debugMatchPair`, `isMatch`, `mergeMatches`, `categorieDuMatch`, `spectacleDeCatch`, `seanceDeCourse`, `memeSeanceDeCourse` |
| `js/state.js` | État global `S`, favoris, ordre et niveaux de ligue, journal des sources. | `S`, `setMatches`, `favTeams`, `toggleFavTeam`, `setLeagueTier`, `customLgOrder`, `addScrapeLog` |
| `js/teams.js` | Données statiques `TEAM_DATA` (nom, ligue, couleurs, logo, alias). | `TEAM_DATA` |

### 3.2 Modules spécialisés (sans import, ou presque)

| Fichier | Rôle |
|---|---|
| `js/cable.js` | Mode câble : lecture d'un geste (seuils, axe dominant), liste des « chaînes » et voisinage, liens qui peuvent jouer (`lienJouable`, `liensCable`), lien voisin dans les deux sens, contenu de l'incrustation (§7.8). Sans import. |
| `js/rattrapage.js` | Quand le serveur se tait : l'état du cache des liens (`etatCacheServeur`, `ageEnClair`) et le choix des pages de match que l'application lira elle-même (`ciblesDeRattrapage`), bornes comprises (§6.8). Sans import. |
| `js/nuit.js` | La nuit appartient à la veille, et la fenêtre affichée fait 48 h — aujourd'hui plus le lendemain (§5.4). Lu aussi par le script serveur. |
| `js/finpresumee.js` | Fin présumée d'un match quand ESPN se tait (§5.6). |
| `js/playability.js` | Jouabilité observée d'un lien ou d'un hôte, partagée entre le navigateur et `scripts/verify_players.mjs` (§7.3). |
| `js/tele.js` | L'application sur une télé Android, dans l'APK de `mobile/` (§12.2) : `reglagesDeDepart` (modes TV et câble à la première ouverture, jamais par-dessus un choix), `actionRetour` (ce que ferme la touche Retour), `referersPour` (ordre des `Referer` du lecteur natif), `pluginNatif`, `surTeleAndroid`. Sans import. |
| `js/tvliste.js` | La liste de l'appli Android TV (`tv/`) : `listeTv(data)` ne garde de `data/streams.json` que les matchs non terminés qui ont un manifeste HLS jouable (`media`, encore frais d'après `dureeDeVie`), avec le `Referer` observé (`mediaReferer`). Écrite dans `data/tv.json` par `scripts/verify_players.mjs` (§12.1). N'importe que `js/directmedia.js`. Pré-caché mais lu seulement par le script. |
| `js/sondage.js` | Décisions de l'outil de sondage d'un domaine (`scripts/sonder_domaine.mjs`) : source devinée d'après le nom (`devinerSources`), matchs hébergés sur le domaine sondé (`matchsDuDomaine`), meilleure lecture, inscription d'un miroir (`ajouterMiroir`). Pré-caché mais lu seulement par le script. |
| `js/fetcher.js` | Aides pures de `fetchPage` : liste et ordre des proxys, relégation, statut acceptable, détection des pages d'erreur servies en 200. Importable en Node. |
| `js/extractors.js` | Moteur générique de découverte de lecteurs dans une page, sans branche par site (§6.5). Porte aussi les listes d'hôtes surchargeables à distance (§6.3). |
| `js/genericlist.js` | Repli d'analyse d'une liste de matchs, par la forme et sans connaître le site : ce qui reste quand le parseur dédié d'une source ne rend plus rien (§6.5 bis). |
| `js/embed-bridge.js` | Pont avec le script utilisateur, et reconstruction d'une page qui refuse l'iframe (§7.4). |
| `js/links.js` | Inventaire des liens par domaine, matchs sans lien, relances de recherche (badge 🔎, « Liens manquants »). |
| `js/debit.js` | Débit et définition réellement mesurés pendant la lecture. |
| `js/directmedia.js` | Lecture directe d'un manifeste `.m3u8` / `.mpd` remonté par le script utilisateur. |
| `js/esports.js` | Transforme les liens LoL Esports en adresses de lecteur encadrables. |
| `js/deuxecrans.js` | Mode deux écrans : quel écran pour quelle tuile (`ecranDeTuile`), grille du second écran (`placementSecondEcran`), choix de l'autre moniteur (`ecranSecondaire`) et `features` de la fenêtre (`optionsFenetre`) (§7.5 ter). Sans import. |
| `js/mv-menu.js` | Le menu flottant unique du lecteur (position fixe, un seul ouvert, clavier). Il s'ouvre dans le **document de son bouton** : en fenêtre détachée, c'est celui de l'autre fenêtre (§7.5 bis). `menuEstOuvert()` dit au repos du lecteur qu'un menu est ouvert (§7.5). Sur téléphone (`enFeuille` : 768 px ou moins, ou écran tactile sans survol), le menu est une **feuille** qui monte du bas : voile (fermé à son `click`, pas au `pointerdown`, sinon l'appui retombe sur ce qu'il y a dessous), tête avec titre et croix, corps qui défile. Ni le défilement de la feuille ni un `resize` (barre d'adresse) ne la ferment. Une entrée peut porter un `detail`, une ligne d'explication. |
| `js/tv-navigation.js` | Navigation aux flèches pour le mode TV. Ce n'est pas un module : il est injecté par `<script src>` quand le mode s'active. |
| `js/sources/index.js` et `js/sources/*.js` | Registre des adaptateurs par domaine. Contrat d'un adaptateur : `hotes`, `extraireLiens(ctx)` et/ou `filtrerLiens(liens)`. Aucun n'importe le module central. |

### 3.3 Graphe d'imports

Huit modules forment un cycle : `api ↔ config ↔ ui ↔ multiview ↔ main ↔ utils ↔ scrapers ↔ state`. Tous les autres sont hors cycle. Conséquence à connaître : l'ordre d'évaluation dépend du module par lequel on entre. En production, l'entrée est `js/main.js` et tout est dans l'ordre. Un script serveur ou un test qui importe le noyau doit importer **`js/scrapers.js` en premier**, ce qui fixe un ordre d'évaluation qui n'exécute pas les initialisations d'interface (voir `scripts/scrape_streams.mjs`), et poser `window.__NO_AUTOSTART__ = true` pour que `main.js` ne démarre pas l'application.

### 3.4 Points d'entrée

`index.html` charge un seul module, `js/main.js`, en fin de page. Son unique script en ligne, en tête, efface la clé `ui_legacy` qu'avait laissée l'interface classique (retirée le 30 septembre 2026). Les gestionnaires `onclick` du HTML appellent des fonctions exposées sur `window` par leurs modules (par exemple `applyFilter` par `utils.js`, `applyUserPrefs` par `multiview.js`, `toggleTvMode` par `main.js`).

## 4. Démarrage et passes de chargement

Le démarrage (`js/main.js`, fin de fichier) :

1. purge des caches de calendrier autres qu'aujourd'hui et hier (`purgeStaleCalendarCache`) ;
2. lecture de la dernière passe de scraping (`last_scrape_time`, `last_scraped_matches`) ;
3. lecture du calendrier local du jour (`api_calendar_cache_<AAAAMMJJ>`). S'il existe, la grille est dessinée tout de suite avec lui, puis une passe **d'arrière-plan** part ; sinon une passe **de premier plan** part, avec l'écran d'attente ;
4. dans les deux cas, `waitForBridge(1500)` laisse au script utilisateur jusqu'à 1,5 s pour s'annoncer : c'est lui qui décide si le navigateur lira les sources lui-même.

Une passe (`loadAll(isBackground, forceScrape)`, dédoublonnée par `loadInFlight`) enchaîne : configuration distante (première fois), lecture du cache serveur des liens si absent ou vieux de plus de `PREFETCH_STALE_MS` (10 min), calendrier du jour (`getApiFirstMatches`), puis la décision de lire ou non les sources (`skipScraping`) : on saute la lecture si le cache serveur est utilisable (moins de 3 h) et qu'aucune passe récente n'a eu lieu (5 min avec le pont, 15 min sans). Sans lecture, on fusionne et on sort. Avec lecture, la grille est **d'abord dessinée avec les liens déjà connus**, puis les sources sont lues (`fetchSourcePages` pour chaque source retenue), puis la fusion finale redessine. Les sources retenues sont celles de `sourcesActives()` (§6.3) **dont ce navigateur a un parseur** : `streamed` n'est lu que par le script serveur, et ses douze points d'API étaient jusqu'ici téléchargés par proxy à chaque passe pour rien. Chaque page est analysée par `analyserPageDeListe` : parseur dédié, puis repli générique s'il ne rend rien (§6.5 bis). `window.hasLoadedOnce` passe à vrai et l'événement `loadSequenceComplete` est émis.

Minuteries et réveils :

| Quoi | Période | Où |
|---|---|---|
| Passe complète d'arrière-plan | 5 min | `js/main.js` |
| Rafraîchissement des scores ESPN (passe complète) | 5 min, et au retour au premier plan (au plus une fois par minute) | `js/api.js` (`startLiveScoreRefresh`, armé seulement quand le jour visé est aujourd'hui) |
| Scores des matchs en cours (passe ciblée) | 1 min, à l'ouverture, et au retour au premier plan | `js/api.js` (`rafraichirScoresEnDirect`, §5.7) |
| Réévaluation des fins présumées | 1 min | `js/main.js` (`reevaluerFinsPresumees`) |
| Relecture des liens au retour au premier plan | si le cache serveur a plus de 10 min ou a échoué, au plus une fois par minute | `js/main.js` |
| Ligne du direct dans le Guide | 1 min | `js/ui.js` (`updateNowLine`) |
| Bandeau de l'état du cache des liens | 1 min | `js/ui.js` (`majBandeauCache`, §6.8) |
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
3. sinon ESPN et les annexes en direct (`fetchAndProcessApiMatches`). Les noms d'équipes d'ESPN passent par `nomOfficielDansLigue` (`js/db.js`) : table et alias exacts seulement, jamais l'appariement approximatif, qui renommait 148 noms ESPN sur 370 à tort (« Indiana Fever » → « Indiana Pacers », « Michigan Wolverines » → « Iran ») ; une passe qui revoit un match déjà connu lui rend les noms d'ESPN, avec un repli sur le cache local même périmé si tout échoue, et un avertissement.

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

### 5.4 La nuit appartient à la veille, et la fenêtre fait 48 h (`js/nuit.js`)

Un match porte la date de son coup d'envoi. À minuit, « aujourd'hui » change, mais le match de 22:05 joue encore. Règle : un match daté d'hier dont coup d'envoi + durée dépasse minuit (`debordeSurLaNuit`) fait partie de la journée d'aujourd'hui (`appartientAuJour`). Conséquences :

- les cinq filtres du jour de `js/main.js` et le filtre des liens du cache serveur (`appliquerCacheServeur`, avec la durée large `DUREE_LARGE_MIN` puisque les flux n'ont pas de durée) passent par `appartientAuJour` ;
- pendant la nuit (`nuitEnCours`, avant 06:00), `fetchAndProcessApiMatches` relit aussi la veille chez ESPN et ne garde que ce qui déborde ; le rafraîchissement des scores en profite ; le script serveur fait de même ;
- dans le Guide, `minutesDansLaJournee` rend un départ négatif pour un match d'hier soir : sa case commence à 00:00 sur ce qui lui reste, et `comparerHeures` le trie avant 00:00 ;
- `memeMatchATraversLaNuit` laisse l'appariement accepter un flux relu après minuit et daté du jour par le serveur, à la même heure de coup d'envoi.

**Minuit passe pendant qu'on regarde** (15 septembre 2026, « c'est pour pas que ça brise quand le match dépasse minuit »). Le jour affiché (`TARGET_DATE`) était fixé au CHARGEMENT et ne basculait jamais : une application ouverte le soir traversait minuit en croyant être encore la veille, et tout ce qui se compare à « aujourd'hui » se mettait à mentir — la ligne du direct disparaissait (`updateNowLine` la masque dès que le jour affiché n'est plus le jour courant), la case d'un match en cours cessait de s'allonger (`grilleDuJour`), et les matchs de la nouvelle journée passaient pour ceux de demain. Le match, lui, continuait de jouer : c'est l'interface autour de lui qui se périmait.

`jourDepasse(jourAffiche, jourCourant)` (`js/nuit.js`, pur) pose la question ; `verifierBasculeDeJour` (`js/main.js`) y répond **toutes les 30 s et au retour au premier plan** — un téléphone gèle ses minuteries en arrière-plan et peut traverser la nuit d'un coup. La bascule réancre `TARGET_DATE`, met à jour l'étiquette de date (`majLibelleDate`, sortie de `applyTargetDate` pour être réutilisable), redessine la grille et relance une passe **d'arrière-plan** : pas d'écran d'attente par-dessus un match en cours. Elle ne s'exécute pas si l'utilisateur a navigué vers un autre jour (`data-today` à `false`) — on ne lui reprend pas sa navigation. Le match commencé la veille reste, `appartientALaFenetre` le gardant. `updateNowLine` et `scrollToNow` comparent désormais en jours de **New York** et non en `toDateString()` local, qui masquait la ligne du direct un jour sur deux hors de ce fuseau.

**La fenêtre de 48 h** (13 septembre 2026, « tu montres 48 h au lieu de 24 h »). `appartientALaFenetre(m, jour, duree)` = `appartientAuJour` **plus le lendemain en entier** ; `FENETRE_HEURES` vaut 48. C'est ce prédicat que le client applique désormais partout (les cinq filtres de `js/main.js` et le filtre des liens du cache serveur), `appartientAuJour` restant la règle de la nuit pour le serveur et pour la passe de la veille. Conséquences :

- **la grille dessine une seule règle continue de 49 bornes** (00:00 aujourd'hui → 00:00 après-demain), la 25e portant « demain » plutôt qu'un second « 00:00 ». La case d'un match est posée d'après `minutesDansLaJournee`, qui rend déjà plus de 1440 pour le lendemain : un match à 02:00 demain se place tout seul à la 26e heure. `.marea` fait 49 heures de large et porte un liseré sur la frontière de minuit ;
- **les deux journées sont dans les données** : `scripts/scrape_schedule.mjs` fait une passe complète sur le lendemain (et lit les calendriers ICS des deux jours), puis trie sur (date, heure) — trier sur la seule heure entrelaçait les deux jours. Ses échecs ne comptent pas dans `echecsEspn`, qui ne juge que la journée d'aujourd'hui ;
- **le repli tient la promesse** : `fetchAndProcessApiMatches` demande aussi le lendemain à ESPN, sans quoi la fenêtre rétrécirait à 24 h dès que `data/schedule.json` manque — précisément le moment où l'application est seule. Vérifié de bout en bout par `tests/test_app_boot.spec.js` (« la grille couvre 48 h »), qui passe par ce repli.

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

Produit toutes les 30 min par `scripts/scrape_streams.mjs` (§12, relais). Clés : `generatedAt`, `date`, `fetch`, `sources[]` (état de chaque source), `hostPolicy` (intégrabilité par hôte, lue des en-têtes X-Frame-Options et CSP côté serveur), `hostPlay` (jouabilité observée par hôte), `verifiedAt`, `matches[]`. Le navigateur le lit par `loadPrefetchedStreams` → `lireCacheServeur` (deux essais à 1,5 s d'écart, puis le cache HTTP du navigateur en troisième essai) → `appliquerCacheServeur` (filtre du jour, marquage `prefetched`, politique d'intégration versée dans le registre appris, registre de jouabilité). Le dernier cache lu avec succès est conservé en mémoire et réappliqué si une lecture échoue ; `window.prefetchedStreamsError` retient l'échec, que les cartes affichent (badge ⚠). Ce que l'âge de ce cache déclenche — le bandeau et le rattrapage — est en §6.8.

### 6.2 Sources (`SCRAPERS_CONFIG`, `js/config.js`)

Vingt-six sources : footybite, mlbbite, sportsurge, buffstreams, streameast, onhockey, vipleague, streamed (API JSON), methstreams, flexfitness, liveleagues, et depuis le 9 octobre 2026 ppv, daddylive, watchsports, isportsurge, crichd, cdnlivetv, bintv, olympicweb, fbstream, totalsportek, watchfooty, mybuffstreams, freestreams, roxiestreams.

**Une seule table des parseurs** : `PARSEURS` (`js/scrapers.js`) dit quel parseur lit quelle source, pour le navigateur (`js/main.js`, moins `SOURCES_SERVEUR_SEULEMENT`), le script serveur et l'outil de sondage. Elle était recopiée à trois endroits. `fetchRemoteConfig` lit les clés de `domains.json` par l'inverse de `SOURCE_VAR_NAMES`. Ajouter une source demande donc : l'adresse et `applySourceUrl`, `SOURCE_VAR_NAMES`, `SOURCE_MIRRORS`, l'entrée de `SCRAPERS_CONFIG`, le parseur dans `PARSEURS`, et les clés dans `domains.json`. `tests/unit_nouvellessources.test.js` vérifie qu'aucune ne manque.

**Sources ajoutées le 9 octobre 2026** (relevées avec `npm run sonder`, §6.3) :
- `methstreams` change de gabarit : methstreams.gs répond 403 au serveur, methstreams.st/home porte trois jours de tous les sports dans un bloc JSON (`<script id="searchIndex">`, `parseMethstreamsIndex`), à l'instant près. L'ancien parseur reste en repli.
- `ppv` : l'API JSON `api.ppv.st/api/streams` (aussi lue par cosectv.com et sportsbite.org). Chaque événement porte son lecteur et ses flux de secours.
- `daddylive` (dlive.sx ; dlhd.pk et daddylive.* y mènent) : un programme par jour en UTC, chaque événement avec ses chaînes (`watch.php?id=N`). « Upcoming Events » (d'autres jours) et « TV Shows » sont écartés ; une heure plus petite que la précédente dans une catégorie passe au lendemain.
- `watchsports` (watchsports.su) : une ancre `a.game-row` par match, heure ISO avec décalage ; la page de match liste ses flux en `a.stream-link`.
- `isportsurge` (isportsurge.ws, où mène sportsurge.ir) : un autre gabarit que Sportsurge, l'affiche est dans le texte de l'image de la ligne.
- `crichd` (crichd.at, cricket) : pas de parseur dédié, le repli générique (`parseCrichd`).

ppv et daddylive donnent les lecteurs **dès la grille** : leurs matchs portent leurs `streamLinks`, et leur `matchUrl` est l'adresse de la source, que le script serveur ne relit pas (comme OnHockey). Ces liens portent `programme: true` : une chaîne de télé sert plusieurs sports, et la règle du décor (`adressesNonSpecifiques`, `js/match.js`) les épargne. Ce sont deux des trois `SOURCES_SERVEUR_SEULEMENT` (API sans CORS, page de 800 Ko). Passage réduit du 9 octobre (20 pages de match) : ppv 189 liens, daddylive 664, watchsports 137, methstreams 26, crichd 3, isportsurge 2.

Ajoutées ensuite le même jour, après une enquête site par site (où vit la grille, comment s'obtiennent les lecteurs) :
- API JSON avec lecteurs fournis, comme ppv : `cdnlivetv` (l'API derrière streamsports99.su, heure UTC, fenêtre de 48 h, événements sans chaîne écartés), `bintv` (l'API de bintv.cc, **sans heure** : rattachement par les noms seulement, et son « live » posé trop tôt n'est pas repris), `watchfooty` (`api.watchfooty.st`, l'API que lit sportsbite.org, une page par sport, lecteurs à l'approche du match). Les trois portent `programme: true`.
- `olympicweb` et `fbstream` : moteur de VIPLeague, une page par sport, heure de Londres (`parseOlympicweb`) ; la page de match annonce ses diffusions en boutons `data-uri` (`js/sources/olympicweb.js`), et le moteur générique n'y trouve que la navigation et une régie — d'où `seulementSesLiens`.
- `totalsportek` (total-sportekk.st/daily ; `ww1.sportsurge.st/all` en est un miroir, même gabarit) : grille lue par le repli générique ; les lecteurs, enveloppés dans `hitcast.st/totview.php?src=`, sont déballés dans `finalizeStreamLinks`.
- `mybuffstreams` (où mène buffstreams.ir ; pas le moteur d'app.buffstreams.is) : `a.competition`, heure UTC, ligue du titre de section, combats en « A vs B - 11:00 AM ET ». Avec isportsurge, il partage le moteur `new-stream-embed` : les lecteurs sont reconstruits depuis les boutons `changeStream(<id>)` (`js/sources/aapmains.js`), l'iframe vide est écartée.
- `freestreams` (football seulement) : une ligne par match, instant en millisecondes, chaînes du site en liens de programme ; le HTML mal imbriqué sort les boutons de leur conteneur, toutes les ancres de la ligne sont lues.
- `roxiestreams` : une page par sport, heure du Pacifique ; les pages sont des emplacements qui jouent une chaîne, et le flux est un manifeste HLS nu reconstruit depuis `getRandomStream('x.m3u8')` (`js/sources/roxiestreams.js`, domaine écrit dans l'adaptateur) — joué par l'application elle-même, sans page ni régie.
- Miroirs : ppv a sept domaines servant la même API (liste : `api.mirrors.st/api/ping`), `api.ppv.cx` est mort ; reedstreams et le serveur « kobra » de ntv.cx servent l'API de Streamed (`api.reedstreams.link` en miroir de `streamed`).
- Régies : `ZONE_DE_REGIE` reconnaît aussi l'identifiant hexadécimal (`/4/192e…`).

Écartés, et pourquoi : sportontv.click et cosectv.com relisent l'API de ppv ; ntv.cx ne fait que redistribuer ppv, daddylive, cdnlivetv et Streamed ; streamcorner chiffre ses réponses (il faudrait exécuter leur code) ; strumyk/strims24 demandent le flux Flashscore et une requête par match ; livetv.sx sert une chaîne de certificats incomplète que `fetch` refuse ; v5.gostreameast.link liste des miroirs Streameast tous bloqués depuis un centre de données ; streami.su est à vendre ; footybite.ir, hesgoal, rojadirecta, quellefrap, primefoot, streamonsport ne répondent pas ; elitegol.lat redirige vers une régie.

### 6.3 Adresses, miroirs et promotion — et la surcharge vivante

Les sites changent de domaine sans prévenir : c'est la panne la plus fréquente. `domains.json` porte l'adresse courante de chaque source et ses miroirs (`MIRRORS`). Le navigateur le lit au démarrage (`fetchRemoteConfig`, depuis `raw.githubusercontent.com`, délai 5 s) et applique chaque adresse par `applySourceUrl`. Le script serveur essaie l'adresse puis les miroirs (`getSourceCandidates`) et ne **promeut** un miroir (`shouldPromoteSource`) que s'il a répondu **et livré au moins un match** : un domaine racheté rend un 200 de parking. `canonicalOrigin` détecte un domaine qui ne fait plus que rediriger. Le résultat est réécrit dans `domains.json` et commité.

`domains.json` ne porte plus seulement des adresses : c'est la **surcharge vivante** de la configuration, relue par le navigateur à chaque démarrage et appliquée par le script serveur au même endroit (`applyDomainsFile`). Réparer une source n'exige donc plus une publication d'application ni une nouvelle version du service worker sur tous les appareils — une modification du fichier est effective au chargement suivant. Deux blocs facultatifs s'ajoutent aux adresses et aux miroirs :

```json
"SOURCES": {
  "buffstreams": { "pages": [{ "path": "mlb-streams-live-11", "sports": ["mlb"] }] },
  "sportsurge":  { "homepageHasMatches": false, "discoverPages": "href=[\"']([^\"']*?watch-[a-z0-9-]+-streams/?)[\"']" },
  "methstreams": { "enabled": false }
},
"HOSTS": { "junk": ["nouvelle-regie.tv"], "players": ["newembed.st"] }
```

- `SOURCES` (`appliquerSurchargeSources`, `js/config.js`) corrige, par identifiant de source, `pages`, `homepageHasMatches` et `discoverPages` ; `enabled: false` est le **coupe-circuit** — la source reste déclarée mais `sourcesActives()` ne la lit plus, ce que le navigateur comme le script serveur respectent. Tout est facultatif et **validé clé par clé** : un chemin en `javascript:`, une expression régulière illégale ou sans groupe de capture, un type faux sont ignorés **sans toucher au reste**, parce que ce fichier s'écrit à la main, en urgence. Une source inconnue ne s'invente pas.
- `HOSTS` (`appliquerHotesDistants`, `js/extractors.js`) ajoute aux listes en dur : `junk` écarte définitivement un hôte (la famille des régies déguisées en lecteurs, cf. `cbox.ws`), `players` amorce sa réputation de lecteur sans attendre que le registre apprenne. Les entrées sont comparées comme des **hôtes** — égalité ou sous-domaine — jamais compilées en expression régulière.

`window.surchargeDistante` retient ce qui a été appliqué.

**Éprouver un nouveau domaine : `npm run sonder -- <domaine>…`** (`scripts/sonder_domaine.mjs`, 9 octobre 2026). Pour chaque domaine : statut, redirection, adresse canonique, page suspecte ; la source à laquelle il ressemble (son nom, `devinerSources`, ou `--source <id>`), lue comme le fait le script serveur — accueil, sous-pages, parseur dédié puis repli générique ; quelques pages de match (`--matchs N`, 3 par défaut), leurs lecteurs, et ce que le registre de jouabilité de `data/streams.json` sait de chaque hôte. Seuls comptent les matchs hébergés sur le domaine sondé (`matchsDuDomaine`) : un parseur étranger fabrique sinon des adresses chez lui. Un domaine qui ne porte le nom d'aucune source est lu à l'aveugle par chaque parseur, sur l'accueil seul, et signalé comme **nouvelle source à déclarer**, jamais comme miroir. `--ajouter` inscrit le domaine **en dernier** dans `MIRRORS` (`ajouterMiroir`, en reprenant les miroirs en dur si la source n'en a pas dans le fichier) ; c'est le passage suivant du script serveur qui le promeut s'il livre. Dépend du réseau : jamais lancé par `npm test`.

### 6.4 `fetchPage` (`js/utils.js`)

Ordre : cache mémoire et déduplication des requêtes en vol → **pont du script utilisateur** (§7.4 ; réponse rejetée sous 200 caractères) → proxys CORS. La liste des transports (`buildProxyList`, `js/fetcher.js`) : proxy personnalisé, accès direct (5 s), **r.jina.ai** (15 s, en-tête `X-Return-Format: html` pour recevoir la page brute et non du Markdown ; `parseJinaBody` déballe un point d'API enveloppé en `<pre>` et rejette les erreurs JSON de Jina), cors.sh, corsproxy.io (avec clé seulement), allorigins (deux formes), codetabs. Relevé du 29 septembre 2026 depuis un navigateur : seul Jina répond encore — cors.sh et thingproxy n'ont plus de DNS, allorigins et codetabs expirent, les autres exigent une clé ou rendent 429. Jina se limite à 20 requêtes par minute sans clé ; un 429 le relègue 3 min comme tout transport. Ils sont ordonnés par santé (`proxy_health`, relégation 3 min après échec), et le suivant est **lancé en parallèle** après un court délai plutôt qu'attendu en série. Un 404 n'est accepté que pour la découverte des pages de liste (`soft404`), jamais pour une page de match ; une page d'erreur servie en 200 est reconnue (`inspectPageContent`).

### 6.5 Extraction des liens d'une page de match

`scrapeMatchFlux(m)` lit la page (`matchUrl`, puis `altUrls`), applique le parseur de la source, puis le moteur générique `extractPlayers` (`js/extractors.js`) : six récolteurs indépendants du site (iframes, boutons de bascule `data-*`, attributs `data-*` bruts, blobs JSON Next.js/Nuxt, ancres, adresses encodées), dédoublonnage par adresse canonique, note par provenance, indices de chemin, domaine et réputation apprise (`embed_registry`), puis classement `embed` (encadrable) ou `page`. Les adaptateurs de `js/sources/` filtrent ou complètent par domaine. `finalizeStreamLinks` normalise chaque lien (nom, qualité, langue, chaîne, `topLevel`) et `retirerLiensDeDecor` écarte les liens de menu déguisés en lecteurs. Résultat mis en cache 30 min (`stream_cache`).

### 6.5 bis Repli générique d'analyse des listes (`js/genericlist.js`)

La découverte des **lecteurs** est déjà sans branche par site (§6.5) : une source qui change de gabarit de lecteur continue de livrer. La découverte des **matchs** était l'inverse — quinze parseurs `parse*` écrits sur le gabarit exact d'un site. Le jour où une source refait son HTML, son parseur rend zéro, la source est morte, et il faut lire la page, écrire un parseur et publier.

`analyserPageDeListe(parseur, html, url, id)` (`js/scrapers.js`) est le second rideau, appelé par la passe du navigateur (`js/main.js`) et par le script serveur : le parseur dédié d'abord ; **s'il rend zéro ou s'il lève**, `parseGenerique` cherche la forme commune à toutes ces listes, sans connaître le site — une ancre par rencontre, un titre « A vs B », souvent une heure à côté.

- Séparateurs, du plus explicite au plus ambigu : `vs`, `v`, `@` (forme américaine « visiteur @ local », les camps s'inversent), puis `-` — qui ne compte **que** confirmé par une heure, faute de quoi « Premier League - Live Streams » deviendrait une rencontre. À défaut de titre, le slug de l'adresse est lu de la même façon (`-vs-`, `-at-`), sans l'identifiant que les sites y collent.
- L'heure : un **instant** seulement quand le site a écrit son fuseau (horodatage Unix, ISO avec `Z` ou décalage). Un « 19:30 » lu dans la page est d'un fuseau inconnu : il est gardé comme texte, sans date, et `isMatchPair` ne ferme alors pas l'appariement sur la date.
- Rejets : ressources, protocoles non http, hôtes de réseaux sociaux, autres domaines, et tout côté d'affrontement qui n'est que du vocabulaire de site (`watch`, `free`, `streams`, `schedule`…).

Deux propriétés le rendent sûr. Il ne s'exécute **jamais** tant qu'un parseur dédié fonctionne : une source en bonne santé ne le paie pas et ne peut pas être salie par lui. Et son pire échec est bénin — `mergeFluxToApi` n'attache les liens qu'aux matchs que le **calendrier** connaît, un match inventé ne crée donc pas de carte (§6.6).

Portée : la forme reconnue est « une ancre par match », celle de la plupart des sources. OnHockey (un tableau dont les liens *sont* les flux) et Streamed (une API JSON) ont une autre forme ; leur repli reste leur parseur. Le recours au repli est compté : `scraper_stats[id].generique` et le message « OK (repli générique sur N pages) » dans Logs côté navigateur, `sources[].generiques` dans `data/streams.json` côté serveur. Une source qui vit sur son repli a un parseur à réécrire — sans urgence, puisqu'elle livre encore.

### 6.6 Fusion dans le calendrier (`mergeFluxToApi`, `js/api.js`)

Un index des matchs de la grille par nom d'équipe normalisé (nom entier, puis mots d'au moins quatre lettres) est bâti une fois ; les candidats d'un flux sont l'intersection des deux noms, et `isMatchPair` n'est payé que sur eux (le balayage complet est réservé aux épreuves : courses, galas, e-sport). En programme double, le candidat à l'heure la plus proche gagne. Le match apparié reçoit les liens dédoublonnés par adresse, `matchUrl` et `altUrls`. Un flux non apparié va dans `S.unmatchedStreams` (diagnostic) et **ne crée pas de carte**. Un lien disparu d'une passe est conservé jusqu'à trois absences (`streamMissingCounts`). Les doublons d'un même spectacle de catch sont réunis. Durée mesurée dans `window.fusionMs`.

### 6.7 Liens manquants

Badge 🔎 sur une carte sans lien (`cardSearchLinks`, `js/links.js`) : recherche immédiate pour ce match. Badge ⚠ si le cache serveur est en échec (`cardRetryLinks` : relecture). « 🔎 Liens manquants » de l'interface classique (`findMissingLinks`) balaie tous les matchs à venir sans lien.

### 6.8 Quand le serveur se tait (`js/rattrapage.js`)

Du 10 au 12 septembre 2026, le workflow des liens est resté mort **45 heures**. L'application a servi les liens de l'avant-veille tout ce temps sans un mot, alors qu'elle connaissait l'âge du cache (`ageMin`) et s'en servait déjà pour décider de relire les sources. Deux manques, deux réponses.

**Dire.** `etatCacheServeur(info, { erreur })` rend un mot : `ok`, `vieux` (45 min, un passage manqué), `perime` (90 min, deux passages : le workflow ne publie plus), `absent` (lecture en échec, ou cache lu mais vide — il ne porte aucun lien, quelle que soit sa fraîcheur). Les seuils viennent du rythme de publication (30 min) ; sous 45 min, c'est de la gigue de cron et on n'en parle pas. `majBandeauCache` (`js/ui.js`) le rend dans `#bandeau-cache`, au-dessus de la grille : rien quand tout va bien, une ligne grise à `vieux`, une ligne ambre avec un bouton « 🔎 Chercher les liens ici » à `perime` et `absent`, l'avancement pendant une passe. Relu chaque minute, parce que l'âge grandit tout seul. L'écran Journaux passe du vert à l'orange sur le même verdict, et dit l'âge en clair (`ageEnClair` : « 2 h 15 », pas « 135 min »).

**Chercher.** `lancerRattrapage(force)` (`js/main.js`) lit les **pages de match** — celles qui portent les lecteurs, et que le repli sur les pages de liste (§4, `prefetchUsable`, au-delà de 3 h) ne touche pas. C'est l'écart mesuré pendant la panne : 4985 liens côté serveur contre 2 par match en repli. Elle part en fin de passe de chargement (jamais avant l'affichage) et au bouton du bandeau, et **seulement** quand le cache est `perime` ou `absent` : un cache d'une heure reste meilleur que ce qu'un téléphone lit par proxy. Trois bornes : cinq minutes entre deux passes (`INTERVALLE_RATTRAPAGE_MS`), **une page à la fois** (trente requêtes lancées ensemble par un proxy public expirent en file d'attente), et au plus 12 pages avec le pont du script utilisateur (`CIBLES_AVEC_PONT` — il lit depuis l'adresse de l'utilisateur, celle qui passe) ou 4 sans lui (`CIBLES_SANS_PONT`, chaque page partant alors par un proxy CORS public).

`ciblesDeRattrapage(matches, opts)` choisit : ce qu'on peut **regarder maintenant** (en direct, ou coup d'envoi dans l'heure) et qui n'a **aucun lien utile**, avec une page lisible (`matchUrl` présente, hôte pas dans `MATCH_PAGE_BLOCKED_HOSTS`). Écartés : les matchs finis ou présumés finis, ceux déjà pourvus (le rattrapage comble des trous), ceux de ce soir (ils attendront le prochain passage du serveur). L'ordre est l'urgence — en direct d'abord, le plus avancé en tête, puis le plus imminent, puis l'identifiant pour que deux passes voient la même liste. Le module est pur et sans import : les prédicats (`estEnDirect`, `bientot`, `minutesAvant`, `aDesLiens`, `pageBloquee`) sont injectés par `js/main.js`.

## 7. Le lecteur

### 7.1 La tuile charge la page entière

Une tuile est une iframe qui charge la page du site telle quelle, **sans attribut `sandbox`** (certains lecteurs le détectent et refusent de jouer ; retiré le 5 septembre 2026, verrouillé par un test). YouTube et Twitch sont convertis en lecteur intégré ; les règles de l'Investigator (`custom_scraper_rules`) s'appliquent (`resolveStreamUrl`). Un manifeste direct (`.m3u8`, `.mpd`) est joué par un élément `<video>` avec hls.js (`js/directmedia.js`).

### 7.2 Choix du flux, rechargement et bascule

`sortFluxLinks` (`js/config.js`) classe les liens : préférence de domaine (`domain_prefs`), puis observation de lecture (`js/playability.js`), puis qualité annoncée. La tuile prend le premier. Une source qui a déjà joué est rechargée ; si elle ne revient pas et qu'une autre existe, `actionSansVideo` passe à la suivante. Une tuile marquée sortie forcée charge aussi la suivante, une fois, au lieu de rester sur l'avertissement.

**Une source n'est abandonnée qu'après avoir été rechargée** (19 septembre 2026, « trop vite à switch de sources quand ça bugge, au lieu de tenter de recharger »). Si le script utilisateur est présent et qu'aucune vidéo n'est signalée dans les `patienceMs` (30 s, 90 s pour un hôte connu comme lent), `armerBasculeAuto` applique `actionSansVideo` (`js/playability.js`) : `recharger` tant qu'il reste un essai sur cette adresse, `suivante` ensuite — une seule fois par lien —, `rien` quand il n'y a nulle part où aller. Le compteur (`_essais`) appartient à l'ADRESSE, pas à la tuile : changer de source rend ses essais entiers à la suivante, et une source qui a joué les retrouve. Une tuile seule sur son match arme son minuteur elle aussi : elle n'a pas de suivante, mais elle a droit à son rechargement.

**Mais le rechargement est un secours, pas un péage** (20 septembre 2026, « les vidéos se chargent pas bien dans le multiview aujourd'hui »). Payé sur chaque source, il doublait le temps d'un parcours : 60 s par source morte au lieu de 30, 180 au lieu de 90 pour un hôte réputé lent, et quatorze sources mortes coûtaient quatorze minutes au lieu de sept. `essaisPourSource(lien, registre, enParcours)` (`js/playability.js`) décide : `ESSAIS_PAR_SOURCE` (2) pour la source sur laquelle la tuile a ATTERRI, **1** dès qu'une bascule automatique a eu lieu (on ne rattrape plus, on cherche) et **1** pour un hôte de score ≤ 0 (cadre refusé, hôte éprouvé qui ne joue jamais). Et le second essai repart sur `DELAI_SANS_VIDEO_MS`, pas sur la longue patience : le premier l'a déjà donnée.

**Un flux qui s'arrête après avoir joué est rechargé, jamais remplacé** (`armerRepriseTuile`). Le script signale un simple ré-tampon comme un arrêt : on laisse 25 s à la vidéo pour revenir seule (12 s jusqu'au 30 septembre 2026 : le rechargement coupait des ré-tampons qui se seraient résorbés) (le `video_state` à `true` coupe le minuteur), puis on recharge la MÊME source. **Borné** (`budgetReprise`, 20 septembre 2026) : au plus `REPRISES_PAR_SOURCE` (2) rechargements par adresse, parce que la lecture remet `_essais` à zéro et qu'un flux qui joue deux secondes, meurt et rejoue deux secondes bouclerait sans fin. Le compte est oublié quand la vidéo a tenu `REPRISE_OUBLI_MS` (2 min) : un match qu'on regardait depuis dix minutes n'est pas une source cassée. `arretMeriteRechargement` (`js/playability.js`) écarte l'arrêt volontaire : le script à jour donne la `cause` (`pause` = vidéo prête et arrêtée, `attente` = ré-tampon, `absente` = lecteur disparu) ; un script plus ancien ne la donne pas, et c'est le dernier clic vu dans le cadre (`_dernierGeste`, 20 s) qui départage.

**Une source qui a joué dans la tuile n'est jamais quittée automatiquement** (30 septembre 2026, « le switch se fait vite quand un stream lag ou buff »). La tuile retient l'adresse qui a joué (`_aJoueUrl`, non restaurée d'une session à l'autre). Quand elle est rechargée après un arrêt, la minuterie de démarrage (`armerBasculeAuto`) lui laisse au moins `DELAI_REDEMARRAGE_MS` (45 s) et `actionSansVideo(…, aDejaJoue)` ne rend jamais `suivante` : au plus deux rechargements, puis la tuile attend, avec un message qui rappelle ⏭. Avant, une tuile qui avait déjà basculé une fois n'accordait qu'un essai par source, et un flux qu'on regardait était remplacé dès que son rechargement tardait.

Sans le script utilisateur, aucun signal de lecture ne peut venir : ni rechargement ni bascule, seule la commande ⏭ change de source. Les minuteurs d'une tuile vivent dans `minuteursTuile`, une `Map` rangée **par tuile** et non par index (`saveMultivisionState` sérialise `mvFlux` en JSON, et fermer une tuile décale toutes celles de droite).

### 7.3 Jouabilité observée (`js/playability.js`)

`verdictFromObservation` : `plays` si du trafic vidéo ou un `<video>` prêt a été vu, `blocked` si le cadre a été refusé, `none` sinon. `recordObservation` cumule par hôte (`{tested, plays}`, atténué au-delà de 40 essais). `playabilityScore` : 3 pour un lien vérifié `plays`, −1 pour `blocked`, sinon d'après le taux de l'hôte. Le serveur (`scripts/verify_players.mjs`) alimente `hostPlay` et `verified` ; le navigateur cumule ses propres observations dans `play_ledger` ; `mergeLedgers` réunit les deux.

**Le registre doit s'ACCUMULER, et il ne le faisait pas** (20 septembre 2026). `scripts/scrape_streams.mjs` réécrivait `data/streams.json` toutes les 30 minutes sans `hostPlay` — le mot n'apparaissait pas une seule fois dans le fichier — donc `verify_players.mjs` repartait d'un registre vide à chaque passage et n'y laissait que les ~81 observations de son budget. Or `playabilityScore` n'ose rétrograder un hôte qu'à partir de `tested >= 3` : avec un ou deux essais par hôte, un CDN mort restait « jamais éprouvé » (score 1) et passait DEVANT un hôte réellement mesuré. Relevé ce jour-là : `embed.st` à 1/1 au registre alors que son manifeste répondait `HTTP 500` (en accès isolé comme en rafale — pas une limite par IP), et il gardait la tête du classement passage après passage.

Le scrape republie donc `out.hostPlay` depuis le fichier qu'il remplace, et `reporterVerifications(matches, precedent, maintenant, validiteMs)` reporte aussi les verdicts PAR LIEN, appariés par adresse. Ceux-ci **périment** (`VERIF_VALIDITE_MS`, 6 h) : un hôte se répare, et rien ne doit le condamner à vie. Une observation fraîche du passage en cours n'est jamais écrasée par une reprise. Le cache précédent est lu **une seule fois** et partagé avec `conserverSourcesMuettes`.

**La réputation départage les liens d'un même palier** (9 octobre 2026, « utiliser la réputation des sites pour classer l'ordre d'apparition des streams »). `playabilityScore` range en paliers ; dans le palier 1 se côtoyaient l'hôte jamais éprouvé, celui qui joue une fois sur quatre et celui à 9 sur 32, départagés par la seule qualité ANNONCÉE. `sortFluxLinks` compare maintenant, après le palier et avant la qualité, `reputationLien(lien, registre, sources)` : le taux de lecture estimé de l'hôte, lissé — (lectures + 4·⅓) / (essais + 4), un 1 sur 1 chanceux ne passe pas devant un 17 sur 34 —, à défaut celui de la SOURCE qui a fourni le lien (l'agrégateur), à défaut l'a priori d'un tiers. Le registre par source, `sourcePlay` dans `data/streams.json`, est tenu par `verify_players.mjs` à côté de `hostPlay` (amorcé, la première fois, par `reputationParSource` : la somme des hôtes distincts de chaque source), reporté par le scrape, et complété dans le navigateur (`play_ledger_sources`, `notePlayability`). Relevé le jour même : daddylive 20/20, bintv 19/20, cdnlivetv 9/10, footybite 541/995 en tête ; methstreams 0/40, mlbbite 0/29, vipleague 0/24 en queue.

**Les liens morts ne sont pas publiés** (9 octobre 2026, « si on a plus de domaines qui feedent, si on peut juste ne pas ramasser les mauvais liens, pas nécessairement les gérer à même l'app »). `ecarterLiensMorts(matches, ledger, { politique, estSource })` retire de `data/streams.json`, au moment de l'écrire, le lien dont l'hôte a été chargé au moins `SEUIL_HOTE_MORT` (8) fois sans une lecture. Restent : un lien vu lui-même jouer, un hôte de source (une page de match, porte de secours), et un lien `topLevel` dont la page répond — la vérification le charge dans un cadre qu'il refuse, elle ne dit rien de l'onglet ; il n'est retiré que si `hostPolicy` le dit en erreur (≥ 400) ou injoignable. Appliqué seulement sous le critère de verdict en vigueur. Mesuré sur le cache du jour : 1902 liens → 1311, dont 483 « Follow the guide » vers une page de VPN (imgcdnngx.com, 403, 0/31), seul lien de 448 matchs — qui passent honnêtement « sans lien » et relèvent du rattrapage (§6.8). **Un hôte écarté peut revenir** : `data.hotesEcartes[hôte]` garde un lien témoin (`echantillon`), et `verify_players.mjs` en éprouve six par passage, le moins récemment essayé d'abord (`ciblesDeRehabilitation`, date `essaiAt` reportée d'un passage à l'autre). Une lecture observée, et l'hôte cesse d'être mort.

### 7.3 bis Une page de match n'est pas un flux (`js/match.js`)

« Le lien amène à la liste des liens sur la page de match sur MLBite, pas aux liens eux-mêmes des streams » (20 septembre 2026). Une page de match LISTE les lecteurs ; elle n'en est pas un. Mais elle liste aussi les autres matchs du site, et l'extracteur ramassait cette navigation comme autant de sources. Relevé sur un Rangers–Blue Jays : neuf liens `mlbbite.plus/watch/live/…`, dont six nommaient un autre match. Scanné sur le cache entier : `mlbbite.plus`, `soccersurge.io` et `app.buffstreams.is` n'apportaient QUE ça (les 73 liens de buffstreams étaient littéralement les `matchUrl` d'autres matchs), `liveleagues.me` pour 41 %.

La règle qui devait les écarter existait (`isFallback`, `scripts/scrape_streams.mjs`) mais reconnaissait une page de match **à son nom** (`/^Page du match/`) : seules celles que l'application fabrique elle-même s'appellent ainsi. On les reconnaît maintenant par PREUVE — `pagesDeMatch(matches)` rend l'ensemble des `matchUrl` de la grille, plus les **formes** (`formeDAdresse` : segments, identifiants masqués par `*`) attestées au moins `MIN_FORME_PAGE` (3) fois, seuil qui évite d'écarter un lecteur isolé partageant par hasard la forme d'une page. `retirerPagesDeMatch` applique ensuite la politique déjà en vigueur : ces liens disparaissent dès qu'un vrai lecteur existe, sinon il n'en reste **qu'un par site** — une porte de secours, pas une liste. La page du match lui-même n'est jamais retirée.

**Aucun nom d'équipe n'entre dans la décision.** Trois détections par noms ont précédé celle-ci et ont toutes donné des faux positifs : accents (`Querétaro` contre `queretaro`), un seul camp qui concorde (`boston-red-sox-at-texas-rangers` accepté sur un Rangers–Blue Jays), noms collés en un mot (`Parissaintgermain` contre `paris-saint-germain`). Mesuré sur le cache du 21 septembre : 134 liens écartés (10 %), et **aucun match ne perd son dernier lien**.

La règle tourne dans `scrape_streams.mjs` après `retirerLiensDeDecor`, dans la même passe globale : la preuve qu'une adresse est une page de match, c'est qu'elle est le `matchUrl` d'un AUTRE match, ce qui demande la grille entière.

### 7.4 Pont et reconstruction (`js/embed-bridge.js`)

Le script utilisateur, quand il est installé, répond dans la fenêtre principale à un protocole `postMessage` de quatre messages (`mv_bridge_hello`, `mv_bridge_ready`, `mv_bridge_fetch`, `mv_bridge_page`) : il télécharge une page par `GM_xmlhttpRequest`, depuis l'adresse de l'utilisateur et avec ses cookies, là où les proxys sont refusés. `getBridgeStatus()` dit s'il est là et sa version ; `fetchViaBridge` est le premier transport de `fetchPage`. Pour une page qui refuse l'iframe, `resolveBlockedEmbed` récupère son HTML (pont puis proxy), en extrait un lecteur encadrable (`pickEmbeddablePlayer`) ou, à défaut, reconstruit le document en `srcdoc` (`buildEmbedDocument`), récursivement jusqu'à trois niveaux. La reconstruction sert à la lecture des pages, pas à peupler les tuiles.

### 7.5 Le repos des commandes

Trois secondes sans un geste, et les en-têtes de tuiles s'effacent pour ne pas rester posés sur la vidéo (`window.resetMvIdleTimer`, `appliquerRepos`). La barre du lecteur n'est plus effacée depuis le 10 octobre 2026 : elle a sa propre bande au-dessus de la grille. L'effacer ne rendait aucune place et, sur téléphone, le premier appui ne faisait que la réveiller. `appliquerRepos` sait toujours effacer une barre : celle du second écran, posée sur les vidéos. Le repos est repoussé tant qu'un menu du lecteur est ouvert (`menuEstOuvert`, `js/mv-menu.js`) ou que le pointeur est sur la barre ; l'entrée du pointeur dans une iframe (`mouseover` sur l'élément, seul signal visible d'ici) rappelle les commandes ; `reveillerCommandes` les rend quand le lecteur revient au premier plan.

Le point délicat est la **fenêtre détachée** : `toggleDocumentPiP` déplace `#mv-grid-wrapper`, donc toutes les tuiles, dans le document d'une autre fenêtre. Tout ce qui raisonnait sur `#mv-container` cessait alors d'opérer : aucun geste fait là-bas n'y parvenait, et `mvContainer.querySelectorAll('.mv-hdr')` n'y trouvait plus rien. On agit donc sur la grille là où elle se trouve (`grilleDuLecteur`, `grilleDetachee`), et `toggleDocumentPiP` fait écouter la fenêtre qui la porte.

### 7.5 bis Ce que le lecteur pose sur le reste de la page

Le lecteur pose des états **globaux** : le défilement de la page, une marge sur le guide, une classe de plein écran, un menu. Chacun d'eux a été, à un moment, rendu par un seul chemin de sortie — et resté en place quand on sortait par un autre. C'est la famille de défauts qui se voit le plus **loin** du lecteur.

| État posé | Qui le rend, désormais |
|---|---|
| `body { overflow: hidden }` du mode Cinéma | `quitterModeCinema()` — appelé par le bouton, par la mise en arrière-plan du lecteur, par la fenêtre détachée, et par `applyFilter` à chaque changement de vue. Il rend le défilement **même** si la classe a disparu par un autre chemin : si la page ne défile plus, c'est nous. |
| Marge droite du guide (`#epg { padding-right }`) | Remise à zéro quand le lecteur passe en arrière-plan ; plus aucun mode ne la pose. |
| Classe `.mv-fullscreen` et bouton de sortie | `quitterPleinEcranLecteur()`, sur `fullscreenchange` **et** `webkitfullscreenchange`, appliqué à `#mv-grid-wrapper` comme à `#mv-grid` — c'est le *wrapper* que la barre passe en plein écran, et l'ancien nettoyage ne visait que la grille. |
| Menu flottant du lecteur | Fermé aux deux transitions de la fenêtre détachée : un menu appartient au document qu'on s'apprête à vider. |

**Arrière-plan, pas de mode réduit** (9 octobre 2026, « le multiview dans l'écran des matchs live et guide, je veux plus ça »). Quitter le lecteur (`toggleMultiviewPip`, appelé par `applyFilter` et `showMatchSelector`) le **masque** : `display: none`, classe `mv-pip` (qui veut dire désormais « pas au premier plan »), tuiles intactes. `openMultiviewTab` le rend tel quel. La colonne, la fenêtre flottante et la barre sont retirées, avec leurs clés (`multiviewPipMode`, `multiviewPipPrevMode`, `multiviewFloatingRect`, `multiviewMinimizedRect`, désormais ignorées) : sur téléphone, la fenêtre flottante couvrait la barre d'onglets et débordait de l'écran. Un `resize` ne fait jamais réapparaître le lecteur.

**Chargement** (même jour, « les lags de chargement »). `updateMultivisionLayout` ne pose aucune tuile tant que le lecteur n'a jamais été montré (`lecteurJamaisMontre`) : la séance restaurée au démarrage ne charge plus quatre pages de diffusion derrière le guide. Les tuiles créées dans un même passage partent à `ECART_CHARGEMENT_MS` (450 ms) d'intervalle, la première tout de suite. Chacune porte une pastille `.mv-chargement` (`poserChargement`), retirée au `load` du cadre, au premier `video_state` qui joue (`retirerChargement`) ou après `DUREE_CHARGEMENT_MS` (15 s).

### 7.5 ter Deux écrans (`js/deuxecrans.js`, `toggleDeuxEcrans`)

« Créer mode deux écrans où un flux joue sur un écran, avec les trois autres qui se détachent pour mon deuxième écran » (3 octobre 2026). La tuile 1 reste dans `#mv-grid` ; les suivantes vont dans `#mv-grid-2`, la grille d'une fenêtre ouverte par `window.open` (`footy-ecran2`). Pas le PiP de document : sa fenêtre reste au premier plan et ne passe pas en plein écran.

- **La principale est la première tuile, pas la tuile active.** Changer une tuile de document recharge son iframe : suivre le focus rechargerait deux vidéos à chaque clic. On change de principale exprès : `mettreSurEcranPrincipal` (bouton `⇄` des tuiles du second écran, menu ⋮) **échange** la tuile avec la première (`echangerTuiles`, la même permutation que le glisser-déposer), si bien que seules ces deux cellules changent de fenêtre. Le glisser-déposer d'un écran à l'autre échange au **dépôt**, pas au survol (`ondragenter` l'aurait fait à chaque passage, rechargeant chaque tuile survolée), et remet lui-même l'état du glisser : la tuile glissée change de document, son `dragend` peut ne pas venir. Les touches 1 à 4 gardent leur comportement (mise en tête).
- **Disposition.** `updateMultivisionLayout` fait sa mise en page ordinaire, puis `poserSurDeuxEcrans` l'écrase : une cellule ne change de grille que si elle n'y est pas déjà ; une tuile en mode `direct` y est reposée (son lecteur hls ne survit pas au déplacement).
- **Trouver une tuile.** Elle n'est plus forcément dans `document` : `cadreDeTuile`, `celluleDeTuile`, `toutesLesCellules` cherchent dans la page, la fenêtre détachée et le second écran. `indexDeTuilePour` passe par là.
- **Parler à une tuile.** Le script utilisateur n'obéit qu'à `FENETRE_PARENTE`, et le parent d'une tuile du second écran est cette fenêtre-là. `posterATuile` appelle donc `__mvRelais`, défini par un `<script>` DE cette fenêtre : `e.source` y est la bonne. Dans l'autre sens, le script écrit à `window.top`, qui est la seconde fenêtre : `brancherFenetreDeTuiles` y renvoie chaque message à la page, `source` conservée. Elle y copie aussi les fonctions de `window` : les `onclick` des en-têtes se résolvent dans la fenêtre qui porte le bouton. La fenêtre détachée (PiP) passe par la même préparation ; auparavant, aucun signal de lecture n'en revenait et aucun ordre n'y était obéi.
- **Le moniteur.** La permission `window-management` n'est attendue avant `window.open` que si elle est déjà accordée : attendre l'invite userait l'activation du clic, et la fenêtre serait bloquée. Sinon `getScreenDetails` est demandé après l'ouverture et la fenêtre est déplacée (`moveTo`/`resizeTo`).
- **Fermeture.** `pagehide` de la seconde fenêtre (ou `⤺ Ramener les vidéos`) appelle `fermerDeuxEcrans`, qui ramène les cellules dans `#mv-grid`. Quitter la page ferme la seconde fenêtre. Refusé en mode câble et pendant la fenêtre détachée.

**La fenêtre détachée devient le second écran** (4 octobre 2026) : dès deux vidéos, `toggleDocumentPiP` ouvre la fenêtre PiP et la prépare par `preparerSecondEcran`, comme la fenêtre ordinaire (sans bouton plein écran, que le PiP refuse). Une seule vidéo part entière, comme avant. **Le retour** (`fermerDeuxEcrans`, et le `pagehide` de l'ancienne fenêtre détachée) traite chaque vidéo rapportée comme l'aller : `reveillerApresDeplacement`, vidéo directe reposée, son et grille redessinés. Avant, elles revenaient muettes, marquées ● sans jouer, et la grille de l'ancienne fenêtre détachée n'était pas redessinée.

**La fenêtre étirée** (`mvLayout === 'ecrans'`, `toggleEcransEtire`), demandée le 4 octobre 2026 (« faire comme si c'était la même fenêtre, pour pas avoir à recharger ») : une seule page couvre les deux moniteurs, donc un échange ne déplace aucune iframe. C'est la disposition `focus` dont la première colonne vaut `partPremierEcran` (`js/deuxecrans.js`) : la frontière se calcule à partir de `window.screenX` et de `window.screen` (l'écran qui porte la plus grande part de la fenêtre) ; introuvable, elle vaut la moitié. Déplacer une fenêtre n'émet pas `resize` : `surveillerFenetreEtiree` relit la position toutes les 1,5 s tant que la disposition est active. Le plein écran du navigateur ne couvre qu'un écran : c'est la limite de ce mode.

### 7.6 Sortie forcée

Si la fenêtre est quittée dans les 15 s qui suivent la pose d'une tuile, les adresses posées sont notées (`mv_sortie_forcee`, dix minutes). Au retour, la tuile le dit et propose d'ouvrir le site ou de charger quand même.

**Garde contre les redirections** (9 octobre 2026, « l'app se fait maintenant plus facilement redirect vers l'un des sites », Olympic Streams sur Firefox). La sortie forcée ne joue qu'après coup. Avant, sans `sandbox`, rien n'empêchait une page encadrée de faire `top.location = …`. Mesuré dans Chromium avec un vrai clic dans un lecteur hostile d'une autre origine : l'API Navigation (`navigate`) ne voit pas cette navigation, alors que `beforeunload` la retient. Le navigateur demande « Quitter le site ? », et refuser garde l'application. `gardeSortieArmee()` : réglage `garde_sortie` (allumé par défaut, `⋯ Plus → 🛡 Bloquer les redirections des sites`), au moins une tuile, et pas de navigation voulue par l'application dans les 5 dernières secondes (`autoriserSortie`, appelé par `mettreAJourApplication` et l'installation du script). Le prix : quitter ou recharger l'onglet soi-même, vidéos chargées, demande une confirmation. Firefox ne montre ce dialogue qu'à une page qui a déjà reçu un geste ; ouvrir le lecteur en est un, puisque ses tuiles ne se chargent qu'à ce moment-là (§7.5 bis).

### 7.7 Signaux du script utilisateur

Dans une page de lecteur, le script remonte à la fenêtre principale `video_state` (une vidéo joue : allume la pastille, et son arrêt déclenche le rechargement de la source — §7.2), `video_stats` (débit et définition, `js/debit.js`) et `media_url` (manifeste vu passer, `js/directmedia.js`). Il obéit à `mv_mute` et `mv_unmute` (une seule tuile a le son) et à `mv_clean`.

`video_state` porte aussi `cause` depuis la version 1.9 du script : `joue`, `pause` (vidéo prête mais arrêtée — un geste de l'utilisateur), `attente` (plus de données prêtes) ou `absente` (aucun `<video>` dans la page). L'application s'en sert pour ne pas recharger une tuile que l'utilisateur vient de mettre en pause ; un script plus ancien n'envoie pas le champ, et le repli est le dernier clic vu dans le cadre.

### 7.7 bis Son automatique (`js/multiview.js`)

« Son automatique on » (13 septembre 2026). Un navigateur refuse une lecture automatique **avec le son** : la vidéo démarre muette et le son ne peut lui être rendu qu'ensuite, une fois qu'elle joue et que la page a reçu une activation. L'application n'en faisait que la première moitié — `applyMvAudioState` envoyait `mv_unmute` au moment de POSER la tuile, avant que la vidéo n'existe ; le script utilisateur coupait alors le son pour obtenir la lecture, et personne ne revenait le rendre.

`donnerLeSon(idx, raison)` est le point de décision unique, appelé à trois moments : la tuile annonce qu'elle **joue** (`video_state`), un **clic** est fait dans son cadre (`mv_frame_clicked`, remonté jusqu'à la tuile même s'il vient d'un lecteur imbriqué), ou elle devient celle qu'on regarde (`focusStream`). Le son ne va qu'à la tuile active. Le script rend le son **dans le tour du clic** : un aller-retour perd l'activation de Firefox, qui remet alors le muet. `mv_unmute` est aussi transmis aux cadres intérieurs. `verifierLeSon` mesure l'état réel 400 ms après et le rapporte à la fenêtre principale (`sound_state`). Réglage `son_auto`, allumé par défaut, dans le menu ⋯.

### 7.8 Mode câble (zapping)

« Le swipe vertical change le match qui joue, le swipe horizontal change le stream », puis « ça devrait être un mode spécifique, un seul vidéo, avec aucun blocage, lecture automatique des lecteurs » (12 septembre 2026). Mode à part entière du lecteur (`⋯ Plus → 📺 Mode câble`, retenu sous `mode_cable`) : **une seule vidéo**, deux axes de zapping — **vertical = la chaîne** (un autre match), **horizontal = la source** (le même match, un autre flux) —, et rien qui bloque la lecture.

- `js/cable.js` (sans import) porte tout ce qui se raisonne sans DOM : `detecterGeste(dx, dy, dt)` (seuil 48 px, axe dominant d'une fois et demie — une diagonale est **refusée**, pas devinée —, une seconde au plus), `actionDuGeste`, `chainesDisponibles` / `chaineVoisine` / `indexDeChaine`, `lienVoisin` (le pendant à deux sens de `nextLinkAfter`), `etiquetteChaine`.
- Une **chaîne** est un match regardable maintenant : `isLiveNow` ou `startsWithin(60)`, et **au moins un lien** — sinon le zapping tomberait sur un écran noir. L'ordre (en cours d'abord, puis heure, ligue, identifiant) est totalement déterminé : « la chaîne d'à côté » doit désigner la même d'un geste à l'autre. Les prédicats de direct sont **injectés** par `js/multiview.js` (`chainesDuCable`) pour que le module reste sans import.
- **Une seule vidéo.** `setModeCable(true)` réduit la grille à la tuile active : les autres sont mises de côté dans `fluxHorsCable` (rendu par `videosMisesDeCote()`), enregistrées avec l'état du lecteur (`mv_state.horsCable`, donc elles survivent à un rechargement) et **rendues** en éteignant le mode. `addToMultivision` ne pousse pas de tuile tant que le mode est allumé : il **change de chaîne** sur la tuile existante.
- **Aucun blocage** (`lienJouable` / `liensCable`, `js/cable.js` ; prédicats bâtis par `optionsCable`, `js/multiview.js`). Sont écartés des chaînes ET des sources : un hôte du registre appris marqué `blocked` (mesure serveur des en-têtes X-Frame-Options / CSP), un lien `verified: 'blocked'`, une adresse de l'enregistrement de **sortie forcée**, et tout lien de score de jouabilité négatif. Un seul point de filtrage : `liensDuMatch`, par où passent le bouton ⏭, le geste horizontal, la bascule automatique et la pastille « source k/n » ; si le filtre ne laisse rien, la liste complète est rendue (le mode dégrade, il ne vide pas). Une tuile qui affiche malgré tout l'avertissement de sortie forcée passe à la source suivante au lieu du panneau.
- **Lecture automatique.** `poserLienSurTuile` met la tuile en mode `direct` quand l'application sait jouer le flux elle-même (`.m3u8`/`.mp4`, ou un manifeste connu de `direct_media`) : son `<video>` porte `autoplay muted playsinline`, donc il démarre sans clic ni script utilisateur — et `liensCable` remonte ces flux devant. Pour une page, `relancerLectureTuile(idx)` demande : `mv_clean` puis `mv_play`, trois fois à 1,2 s d'intervalle (le lecteur d'un site arrive souvent après le chargement), et `applyMvAudioState` envoie `mv_unmute` à la tuile qu'on regarde. Les minuteurs vivent **hors** des tuiles (`rappelsLecture`, `minuteursClics`) : `saveMultivisionState` sérialise les tuiles, et un handle de minuteur n'est un nombre que dans un navigateur.
- `js/multiview.js` porte le reste : `zapperChaine(idx, sens)` (remplace le match de la tuile et prend sa meilleure source jouable), `changerSourceTuile(idx, sens)` (l'avant emprunte `nextFluxForTile`, le chemin du bouton ⏭), `gesteCable`, `annoncerCable` (l'incrustation, 2,5 s), et les flèches du clavier dans l'écouteur existant du lecteur.
- **Ce qu'une tuile oublie en changeant d'adresse** est décidé au même endroit pour tous les chemins (`poserLienSurTuile`) : lecture observée, manifeste vu passer, mode direct, et marque de sortie forcée — qui visait l'adresse précédente.
- **La surface qui écoute.** Une tuile est une iframe d'une autre origine : un `touchstart` fait dedans ne parvient jamais ici. Le mode pose donc un calque (`.mv-cable-surface`, posé une fois par tuile, montré par `majSurfacesCable`) qui prend aussi les clics destinés à la page. Un appui qui n'est pas un geste appelle donc `rendreLesClics(idx)` : le calque s'efface `PASSAGE_CLICS_MS` (4 s), puis revient tout seul — aucun geste à connaître, aucun état à défaire. `basculerGestesTuile` (bouton 📺/🖐 de l'en-tête) reste la suspension **longue** : le calque s'efface et `gesteCable` refuse d'agir, le clavier compris, « suspendu » devant vouloir dire la même chose par tous les chemins.
- **Les ordres de l'application arrivaient-ils ?** Non, et aucun test ne le voyait (12 septembre 2026). Le script utilisateur rend `window.parent` inerte contre le détournement d'onglet, par un **Proxy reconstruit à chaque lecture** ; son filtre `e.source !== window.parent` était donc toujours vrai et la tuile n'obéissait à RIEN — ni `mv_mute`/`mv_unmute` (le son ne suivait pas la tuile active), ni `mv_clean`. La fenêtre parente est maintenant **capturée au démarrage** du script, avant la pose du piège, et c'est cette référence qui fait foi. Les deux tests qui « passaient » vérifiaient un effet que la recherche automatique produit aussi : ils vérifient désormais un témoin que seul un ordre reçu change (`window.mvUnmutedState`).


## 8. Appariement (`js/match.js`)

`isMatchPair(a, b)` → `debugMatchPair`, qui rend `{isMatch, reason}` pour le diagnostic. Gardes dans l'ordre :

1. **Dates** : deux dates différentes ferment l'appariement, sauf `memeMatchATraversLaNuit`.
2. **Catégories** : le dernier mot du nom donne `F` (féminin), `U<âge>` ou `R` (réserve, B, académie) ; `categoriesCompatibles` n'accepte `F` face à rien que si la ligue d'en face est féminine. Deux façons d'écrire la même catégorie s'apparient.
3. **Familles de sport** : deux familles connues et différentes ne s'apparient jamais.
4. **Épreuves** (F1, IndyCar, catch, e-sport) : `spectacleDeCatch` dégage le spectacle (Raw, SmackDown, NXT, Dynamite…) de la fédération et du numéro d'épisode ; deux spectacles différents ne s'apparient jamais ; sinon comparaison du nom combiné.
5. **Séances de course** (`seanceDeCourse`, `memeSeanceDeCourse`) : une épreuve automobile n'a pas deux équipes mais des SÉANCES (FP1…FP3, qualifs, sprint, course), chacune à son heure et souvent sur trois jours. Chaque libellé est lu en trois parties — la **série** (`f1`, `f3`, `motogp`, `nascar`… du nom ou de la ligue), l'**épreuve** (le mot qui précède « Grand Prix » / « GP » / « Gran Premio », donc APRÈS les parrains : « Tag Heuer Spanish Grand Prix » → `spain` ; gentilés ramenés au lieu par `LIEUX_EPREUVE`), la **séance** (`FP3` = `Practice 3`, `Qual` = `Qualifying`, « Pre/Post/Main/Feature Race » = `race`). Les trois doivent concorder, plus la date : une série connue et différente (F3 sur le même circuit), une autre épreuve ou une autre séance ferment l'appariement — les essais ne prennent pas les liens des qualifs. Un libellé qui ne nomme aucune séance, ou aucune épreuve (« F1 Main Race », « Main Race / Qualifying »), rend `null` : le doute laisse le chemin historique. Ce raccourci décide aussi de l'ENTRÉE dans la branche Épreuves, sans quoi « FIA 2026: Spain GP Qualifying » (ligue `Fia F1`) restait dehors.
6. **Équipes** : `isMatch(nom1, nom2)` sur les deux équipes, avec les alias de `TEAM_DATA` (`getOfficialTeamName`) et une similarité de Levenshtein pour les coquilles, sans jamais confondre deux équipes distinctes d'une même ville.

## 9. Interface

- **État** : `S` (`js/state.js`) porte `matches`, `matchMap`, `filter` (`live` / `all`), `searchQuery`, les sections repliées, les rails, les flux non appariés.
- **Rendu** : `buildEPG(matches)` (`js/ui.js`) protège `buildEPGInner` : une exception de rendu ne peut plus effacer l'application (la boîte d'erreur est recréée si besoin). Chaque rendu incrémente `window.rendusGrille`, que les tests utilisent pour attendre une grille stable. En mode Live, les cartes `.prime-*` par section ; en mode Guide, la grille horaire positionnée par variables CSS (`--start-h`, `--start-m`, `--duration-m`).
- **« hier » / « demain »** : `libelleJour(m, jour)` (`js/nuit.js`) dit si un match n'est pas daté du jour affiché. La carte et la fiche portent alors un `<span class="prime-day">` à côté du bandeau d'état, hors de `.status-text` pour que la mise à jour des scores en place ne l'efface pas ; la case du Guide préfixe son texte (« hier · LIVE | 2 - 1 », « hier · 22:05 »).
- **Identifiant d'une carte** : `mb-<id du match>`, seul lien entre le DOM et `S.matchMap`. Un favori figure dans la section Favoris **et** dans sa section : sa copie Favoris porte `mb-<id>_fav_copy`, sinon deux éléments partageraient un `id` et `getElementById` ne verrait que le premier. Tout code qui remonte d'une carte au match passe par `getOriginalMatchId` (`js/ui.js`), qui retire ce suffixe ; la mise à jour des scores en place (`js/main.js`) cherche les deux identifiants.
- **Niveaux de ligue** : `leagueTier` (`js/db.js`) rend `main`, `secondary`, `other` ou `ignored` ; le choix de l'utilisateur (`league_tiers`) prime sur `DEFAULT_LEAGUES` et `OTHER_LEAGUES`. Un libellé inconnu tel quel est essayé sous sa forme normalisée (`formatLeagueName`) : « NATIONAL HOCKEY LEAGUE » est la LNH.
- **Fiche** : `openMod(m)` dessine la bannière, charge les compléments ESPN (`fetchGameStats`, `fetchTeamInfo`) et la colonne des flux ; la page du match est relue à l'ouverture (`doitRelireLaPage`) puis chaque minute.
- **Préférences d'apparence** : `userPrefs` (`user_prefs`), appliquées par `applyUserPrefs` → `initPrefs` → reconstruction.
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
| `play_ledger_sources` | Ce que le navigateur a vu jouer, par source de lien (l'agrégateur) : départage les hôtes jamais éprouvés (`reputationLien`). |
| `play_ledger` | Jouabilité observée dans ce navigateur. |
| `proxy_health` | Santé des transports. |
| `direct_media`, `debits` | Manifestes directs et mesures de débit, 3 h. |
| `fav_teams`, `league_tiers`, `custom_lg_order`, `lg_order_migrated_v2` | Favoris, niveaux et ordre des ligues. |
| `user_prefs` | Apparence et options. |
| `garde_sortie` | Garde contre les redirections des lecteurs (`'0'` = coupée ; §7.6). |
| `mode_cable` | Mode câble du lecteur allumé ou éteint (§7.8). |
| `mv_state`, `mv_sortie_forcee`, `gmPinnedMatches` | État du lecteur. (`multiviewPipMode`, `multiviewPipPrevMode`, `multiviewFloatingRect`, `multiviewMinimizedRect` : modes réduits retirés le 9 octobre 2026, ignorées.) |
| `custom_scraper_rules` | Règles de l'Investigator. |
| `custom_proxy_url`, `cors_sh_api_key`, `corsproxy_io_api_key` | Réglages réseau. |
| `pref-tv-mode`, `hasSeenScriptModal` | Mode TV, fenêtre du script déjà montrée. |

## 11. Service worker et version

`sw.js` : `CACHE_NAME = 'sports-guide-v44'`. Stratégie réseau d'abord, cache en repli, sur les seules requêtes GET de même origine ; la clé de cache ignore la chaîne de requête (sinon `data/*.json?t=…` créait une entrée par chargement) ; seules les réponses `ok` et `basic` sont rangées. `APP_SHELL` précache la coquille complète (HTML, CSS, manifeste, tous les modules `js/`, les icônes), fichier par fichier pour qu'une ressource absente ne fasse pas échouer l'installation. Les deux fichiers de données n'en font plus partie depuis le 9 septembre 2026 : périmés en trente minutes, ils coûtaient 1,2 Mo par nouvelle version ; le gestionnaire `fetch` les range dès leur première lecture, ce qui suffit au repli hors ligne. `index.html` et `legacy.html` annoncent les huit modules les plus lourds en `modulepreload`, pour qu'ils soient téléchargés en parallèle plutôt que découverts en cascade depuis `js/main.js`.

**Règle** : toute modification de `sw.js` ou d'un fichier précaché s'accompagne d'une nouvelle valeur de `CACHE_NAME`, recopiée dans `VERSION_APP` (`js/multiview.js`), qui est ce que Logs → Cet appareil affiche. Trois tests (`unit_diagnosticappareil`, `unit_favicon`, `unit_majapp`) vérifient que les deux chaînes sont identiques. Un nouveau module `js/` doit être ajouté à `APP_SHELL`.

`mettreAJourApplication()` désinscrit les service workers, vide tous les caches et recharge sur une adresse neuve (`?maj=<horodatage>`), sans toucher au stockage local.

## 12. Scripts serveur et workflows

| Workflow | Déclencheur | Ce qu'il fait | Ce qu'il commite |
|---|---|---|---|
| `tests.yml` | push et PR sur `main` | `npm ci`, Chromium Playwright (mis en cache d'une exécution à l'autre), `npm test` ; lecture seule, 20 min max | rien |
| `scrape_schedule.yml` | tous les jours à 09:00 UTC (souvent en retard, parfois sauté : `scrape_streams.yml` rattrape), à la demande, et sur un push sur `main` qui touche le script du calendrier ou les bases d'équipes (un passage à la fois, 20 min max) | `node scripts/scrape_schedule.mjs` | `data/schedule.json` |
| `scrape_streams.yml` | toutes les 30 min par **relais** (le job `relais` attend le créneau suivant puis relance le workflow par `workflow_dispatch`, ce que le `GITHUB_TOKEN` a le droit de faire ; la relance est réessayée six fois, chaque essai vérifiant d'abord qu'aucun passage n'est déjà en route) ; le cron à :17 et :47 sert d'amorce et de filet, GitHub ne l'honorant que cinq à six fois par jour ; à la demande ; un passage à la fois, sans annulation ; arrêt du relais par la variable de dépôt `SCRAPE_RELAIS = off`. Régénère d'abord `data/schedule.json` s'il n'est pas daté du jour (heure de New York), parce que le cron quotidien subit les mêmes retards. **Publie en deux temps** (§12 bis) | `node --max-old-space-size=8192 scripts/scrape_streams.mjs` → commit, puis `scripts/verify_players.mjs` → second commit (sans faire échouer le passage) | `data/streams.json`, `domains.json` |
| `domains-watch.yml` | tous les jours à 05:00 UTC, à la demande | `npm run test:domains` ; lecture seule, 20 min max | rien (surveillance ; sortie de `npm test` parce que Cloudflare répond selon l'adresse du runner) |

- `scripts/scrape_schedule.mjs` reconstruit le calendrier **des deux jours de la fenêtre** (§5.4 : aujourd'hui et le lendemain, ESPN et annexes) avec ses propres copies des aides de date et en important `js/nuit.js` ; avant 06:00 (heure de New York) il relit aussi la veille. Mêmes règles que le client : six chemins à la fois, et une passe partielle **fusionne** avec le `data/schedule.json` déjà publié du même jour au lieu de le remplacer — sinon un passage où quelques chemins échouent publiait un calendrier amputé pour tous les appareils jusqu'au suivant. Aucune réponse du tout : le fichier n'est pas touché.
- **Ce que les scripts serveur prennent sur les modules du client est vérifié** (`tests/unit_scriptsserveur.test.js`). Un `const { … } = config` qui nomme un symbole absent rend `undefined` sans une ligne d'avertissement, et le script meurt au premier appel : c'est ce qui a coûté 45 h de liens du 10 au 12 septembre 2026 (`appliquerHotesDistants` vit dans `js/extractors.js`, que `js/config.js` importe sans le ré-exporter). Le test lit les fichiers de `scripts/` comme du texte et vérifie chaque nom destructuré contre les exports réels du module.
- **Deux temps : publier, puis annoter** (§12 bis). Le cache est commité dès que la lecture des sources est finie ; la vérification des lecteurs (`scripts/verify_players.mjs`, un vrai Chromium) suit et donne un SECOND commit. Mesuré sur le passage du 12 septembre 2026 à 19:35 : sources lues en 4 min 28 s, vérification 5 min 13 s, cache commité à 19:44:56 — les liens existaient depuis 19:39:28 et attendaient derrière une étape qui ne fait que les annoter, qu'un runner perdu ou un `timeout-minutes` atteint emportait avec elle. Chaque commit est précédé de son propre rebase sur `main` (la panne « non-fast-forward » du 6 septembre), et les deux étapes de vérification gardent `continue-on-error` : le cache est déjà publié, un échec là ne doit pas peindre le passage en rouge. L'ordre est verrouillé par `tests/unit_workflowliens.test.js`, qui lit le workflow comme du texte — il se défait d'un simple déplacement de bloc, et rien dans le fichier ne le rendrait visible.
- `scripts/scrape_streams.mjs` réutilise **les parseurs du client** dans un DOM jsdom (`__NO_AUTOSTART__`), avec un `fetch` direct (User-Agent de navigateur, Referer), lit chaque source et ses sous-pages, puis les pages de match (`--limit`, 900 par défaut), relève la politique d'intégration de chaque hôte, promeut les miroirs et réécrit `domains.json`. Mêmes garde-fous que le calendrier depuis le 9 septembre 2026 : **aucune source vivante, le fichier n'est pas touché** ; une passe partielle **conserve** les matchs déjà publiés des sources muettes, à partir de la veille (`conserverSourcesMuettes`, `js/config.js`), et une date antérieure à la veille est écartée. Le gagnant d'une source est fixé après sa lecture par `gagnantApresLecture` (`js/config.js`) : l'adresse qui a répondu, à condition d'avoir livré des matchs.
- `scripts/verify_players.mjs` charge dans un vrai Chromium, encadrés comme une tuile, les lecteurs des matchs en direct ou imminents (budget 5 min, 150 au plus) et pose `verified` par lien et `hostPlay` par hôte ; il éprouve aussi les témoins des hôtes écartés (§7.3).
- **La vitesse du passage** (9 octobre 2026, « c'est vraiment long ») : les sources sont lues en parallèle (`lireUneSource`) ; 24 pages de match en vol, la politesse restant la régulation PAR HÔTE ; et le `fetch` du script ne demande qu'UNE fois une adresse — `fetchPage`, écrit pour le navigateur, retente chaque échec par chaque « proxy », que le script déballe vers la même requête directe (une page en 403 partait six fois), et son délai de 5 s courait pendant l'attente dans la file de l'hôte (1 623 « erreurs réseau » mesurées à 24 en vol avant la correction). Tout échec — refus 4xx, panne 5xx, délai, erreur réseau (le 429 a ses propres reprises) — est retenu pour le passage : le « transport suivant » serait la même requête, et une page expirée était rejouée six fois à 20 s. Le délai de la requête partagée est de 20 s. La phase des pages de match a un **budget** (`--budget-pages`, 360 s) : au-delà, les pages non lues gardent leurs liens précédents. La **fusion** des matchs (`mergeMatches`, `js/match.js`) n'appelle plus `isMatchPair` que sur les candidats qui partagent un nom normalisé ou un mot significatif — hors mots qui ne désignent aucune équipe (« live » figurait dans 404 noms) ; balayage complet pour les seules épreuves sans mot commun. Même résultat sur le cache du 9 octobre (799 matchs, 1 902 liens), 0,2 s au lieu de 13. Chaque phase est chronométrée (`⏱` dans le journal), et la progression des pages donne le tas utilisé. **jsdom est fixé en 26.1.0** : les versions 27 à 29 retiennent chaque document analysé (~6 Mo pour une page de 700 Ko, même après ramasse-miettes — 377 Mo pour 60 pages en 29.1.1, 3 Mo en 26.1.0), et le passage, qui en analyse ~900, saturait son tas de 8 Go et se figeait ; un test l'empêche de remonter sans nouvelle mesure. L'adresse canonique d'une source n'est adoptée qu'après avoir répondu (`adopterOrigineCanonique` : freestreams se déclarait sur un domaine au certificat invalide). Mesuré le 9 octobre 2026 : 310 s pour onze sources avant ces changements (sources 114 s, pages 187 s), **139 s pour vingt-six** après (sources 24 s, pages 107 s, tas plafonné à 600 Mo), 3 026 flux contre 1 680.
- **Passage rapide** : `--horizon N` ne relit que les pages des matchs en cours ou qui commencent dans les N minutes ; les autres gardent les liens du fichier précédent (`reporterLiensNonRelus`, `js/config.js`, apparié par `matchUrl` ; une adresse partagée par plusieurs matchs — grille, API — n'est jamais reportée).
- **Sans GitHub** : `npm run liens` (`scripts/maj_liens.mjs`) enchaîne calendrier (s'il n'est pas du jour), liens (`--rapide` = `--horizon 180`), vérification si Playwright est là, et `--publier` (commit et push des données). Multiplateforme ; `local/pipeline.ps1` reste pour Windows.
- `scripts/sonder_domaine.mjs` (`npm run sonder -- <domaine>…`) n'est lancé par aucun workflow : c'est l'outil pour éprouver un domaine signalé (§6.3).

Les commits automatiques ne déclenchent pas `tests.yml`.

### 12.1 L'appli Android TV (`tv/`)

Un projet Gradle séparé de `mobile/` : Java pur, une activité, ExoPlayer (media3, HLS), **sans WebView**. Elle s'ouvre en mode câble (une vidéo joue d'emblée, `Liste.matchDeDepart`), l'onglet Live se pose par-dessus, et la même APK se pilote au doigt sur un téléphone. Elle lit `data/tv.json` sur `main` (raw.githubusercontent.com), joue le manifeste avec l'agent de la vérification et, pour chaque lien, essaie dans l'ordre le `Referer` observé (le cadre imbriqué du lecteur, que `verify_players.mjs` relève sur la requête du manifeste), aucun, puis la page du lien. Mesuré le 10 octobre 2026 sur instreams.pro : 200, 200, 403. Le `Referer` voyage comme `media` : `reporterVerifications` le reporte, `scrape_streams.mjs` le garde. Le format est versionné (`VERSION_LISTE_TV` / `Liste.VERSION`, verrouillés ensemble par `unit_tvliste`). Détails, touches et installation : `tv/README.md`.

### 12.2 L'APK sur une télé (`mobile/`, `js/tele.js`)

« Garder le concept actuel de l'app, juste adapter à CCGTV » (10 octobre 2026). C'est la même application. L'APK se déclare au lanceur Google TV (`LEANBACK_LAUNCHER`, bannière `banniere_tele`, écran tactile facultatif) et ajoute trois choses :

- **La télé est signalée à l'application.** `BloqueurWebViewClient.onPageFinished` pose `window.__ANDROID_TV__` quand `UiModeManager` dit « télévision », puis appelle `window.activerTeleAndroid` (`js/main.js`). Celle-ci allume le mode TV (`toggleTvMode`) et le mode câble (`setModeCable`) si l'utilisateur n'y a jamais touché (`reglagesDeDepart`).
- **La touche Retour.** `MainActivity` demande d'abord `window.retourTele()`, qui ferme selon `actionRetour` un menu du lecteur, la fiche, le menu Plus, ou revient au Live. L'application ne se quitte que quand la réponse est `false`.
- **Le script utilisateur, sans Tampermonkey.** `NettoyeurLecteurs` assemble `mobile/injection-userscript.js` (le gabarit, qui fournit `GM_xmlhttpRequest` sur `fetch`, que CapacitorHttp fait passer par le réseau natif dans la fenêtre principale) et `multiview-cleaner.user.js`, à la marque `/*__SCRIPT__*/`. Il pose le tout par `WebViewCompat.addDocumentStartJavaScript(…, "*")` : dans la fenêtre principale ET dans chaque iframe, toutes origines, avant le premier script de la page. C'est `@allFrames` et `@run-at document-start`. Le premier document de la fenêtre principale, parti avant la pose, le reçoit à `onPageFinished`, et le gabarit ne s'exécute qu'une fois par document (`__footyNettoyeur`). Sans `DOCUMENT_START_SCRIPT` (WebView trop ancienne), rien n'est posé et l'application marche comme avant.
- **Le verrou de navigation** (`GardeNavigation`, appelé par `BloqueurWebViewClient.shouldOverrideUrlLoading`). Capacitor confiait toute adresse étrangère au système (`Bridge.launchIntent`), qui ouvrait la régie d'un `top.location = …` dans le navigateur. Désormais, la fenêtre principale ne quitte plus l'application (seuls son hôte, `data:` et `blob:` passent), et un cadre navigue en web mais jamais vers un autre schéma (`intent://`, `market://`…). Il s'ajoute à la liste d'hôtes bloqués (≈ 99 000, `construire-blocage.mjs`).
- **Le lecteur natif.** Dans l'APK, `poserDirect` (`js/multiview.js`) ne crée pas de `<video>` hls.js : il appelle `LecteurNatif.jouer` (`LecteurNatifPlugin`, enregistré avant `super.onCreate`). Il lui passe le manifeste et les `Referer` de `referersPour` : le cadre observé par la vérification (`mediaReferer`, désormais gardé dans `direct_media`), la page vue par la WebView, aucun, puis la page du lien. `LecteurActivity` (ExoPlayer, tampons courts, détruit en arrière-plan) essaie chaque `Referer` 12 s et renvoie l'événement `evenement` : `joue`, `echec` (la tuile revient à la page, comme hls.js), `chaine` / `source` (▲▼ / ◀▶, traités par `zapperChaine` / `changerSourceTuile`, mêmes sens que `actionDuGeste`), `ferme`. Une tuile qui repart sur une page referme le lecteur natif (`fermerNatif`). En mode câble, la première vidéo passe maintenant elle aussi par `poserLienSurTuile` : elle ignorait le flux direct connu.

## 13. Tests

`npm test` lance `npm run test:unit`, c'est-à-dire `node --test tests/*.test.js` (tous les fichiers unitaires Node, découverts par le motif : un nouveau test n'a rien à déclarer, et un échec n'arrête pas les autres), puis trois suites Playwright : `test_app_boot.spec.js` (démarrage et interface), `test_cleaner.spec.js` (le script utilisateur) et `test_rattrapage.spec.js` (le bandeau et le rattrapage, §6.8, sur ses propres gabarits de calendrier, de liens et de pages de match). `npm run test:domains` lance à part `test_domains.spec.js`.

Chaque test unitaire ouvre par un commentaire qui dit quel problème l'a motivé. Les modules du noyau sont chargés sous jsdom (`window` et `localStorage` factices) ; les modules sans import sont importés directement.

Les tests de démarrage servent le dépôt par un serveur HTTP local, **coupent tout réseau extérieur** (ni ESPN, ni proxy, ni source : l'application tourne sur `data/schedule.json` et `data/streams.json` du dépôt), **figent l'horloge** à l'instant du calendrier où le plus de matchs sont en cours (`instantDesDonnees`, à partir du `fetchDate` de `data/schedule.json`), attendent `window.hasLoadedOnce`, l'apparition des cartes, puis une grille stable (`attendreGrilleStable`, sur `window.rendusGrille`). Un test simule ESPN quand il le faut (`page.route` sur `site.api.espn.com`). Les erreurs de page sont collectées et doivent être vides.

Deux pièges déjà payés, à ne pas repayer : **`page.route` n'intercepte pas les requêtes du service worker**, qui lit le réseau lui-même (`test_rattrapage` servait un faux cache de deux heures et l'application lisait le vrai `data/streams.json` du dépôt, sans une ligne pour le signaler) — un gabarit se sert donc depuis le serveur HTTP local, pas depuis `page.route` ; et **un test ne doit pas dépendre de l'âge des données du dépôt** : `bootOffline` déclare une passe de rattrapage déjà faite (`window.dernierRattrapage`), sans quoi le démarrage lirait des pages de match ou non selon l'heure à laquelle le dernier cache a été publié.

Pour lancer les suites Playwright avec un Chromium déjà installé ailleurs, une configuration locale peut fixer `use.launchOptions.executablePath`.

## 14. Conventions

- **Ajouter une source de flux** : d'abord `npm run sonder -- <domaine>` (§6.3) pour savoir si c'est un miroir d'une source connue ou un site nouveau ; puis une entrée dans `SCRAPERS_CONFIG` et `SOURCE_VAR_NAMES` (`js/config.js`), l'adresse et ses miroirs dans `domains.json` et `SOURCE_MIRRORS`, un parseur dans `js/scrapers.js`, au besoin un adaptateur dans `js/sources/` (déclaré dans `js/sources/index.js`), un test unitaire, et l'ajout dans `test_domains.spec.js`.
- **Réparer une source en panne** : commencer par `domains.json`, pas par le code. Adresse changée → la clé de la source et ses `MIRRORS` (le script serveur le fait déjà seul). Sous-pages renumérotées ou déplacées, accueil qui ne porte plus de matchs → `SOURCES` (§6.3). Domaine racheté qui sert de la publicité → `SOURCES.<id>.enabled = false`. Nouvelle régie servie comme lecteur → `HOSTS.junk`. Un changement de code n'est nécessaire que si la **forme** de la page est nouvelle — et même là, le repli générique (§6.5 bis) tient la source en vie en attendant.
- **Ajouter une ligue ESPN** : dans `ESPN_LEAGUES` (`js/api.js`) **et** dans `scripts/scrape_schedule.mjs` ; `DEFAULT_LEAGUES` ou `OTHER_LEAGUES` (`js/db.js`) pour son niveau ; `getLeagueDuration` (`js/utils.js`) pour sa durée.
- **Nouveau module** : sans import si possible ; sinon entrer dans le cycle en connaissance de cause ; l'ajouter à `APP_SHELL` et bumper la version.
- **Toute modification** : un test qui l'aurait vue tomber, une entrée dans `docs/WORKLOG.md`, et cette page si un module, une fonction publique ou une règle change.

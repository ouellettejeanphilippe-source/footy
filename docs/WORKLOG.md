
## En cours

## Fait
- 2026-09-02 - Audit du système de liens (association, doublons, métadonnées).
  - Constat sur les données réelles : 4 doublons dans un même match, 5 adresses attachées à plusieurs matchs, 8 liens pointant sur `ms.buffstream.io/index-version-27` (l'accueil du site, pas un flux), 3 libellés parasites. 138 liens sur 151 en langue « MULTI », 90 avec un nom générique, qualité « HD » sur presque tout car c'est le défaut des parseurs.
  - Cause : le nettoyage et l'enrichissement n'existaient que dans `extractStreamLinks`. Les liens construits directement par `parseOnHockey` et `parseStreameast` n'y passaient pas.
  - `finalizeStreamLinks` (`js/scrapers.js`) devient l'entonnoir unique : écarte les pages d'index (`isIndexPageUrl`) et les libellés parasites (phrases parasites n'importe où, mots de navigation en tête seulement), dédoublonne sur l'adresse normalisée (`normalizeStreamUrl` : protocole, `www.`, barre finale, casse), puis renseigne site / chaîne / qualité / langue via `describeStreamLink` (35 chaînes reconnues, les plus spécifiques d'abord). Appelé aussi par le script serveur.
  - Qualité : les parseurs mettaient « HD » ou « SD » par défaut ; la valeur n'est gardée que si l'adresse ou le libellé l'annonce. Le badge est masqué sinon.
  - Interface : chaque ligne de flux affiche la chaîne, le site et la langue sous son nom.
  - Clic sur une ligne : n'ouvre plus jamais un onglet externe (c'était imposé aux liens `topLevel`). Un bouton ↗ dédié, disponible pour tous les flux, est ajouté à côté du bouton Multivision.
  - Tests : `tests/unit_scrapers.test.js` passe de 8 à 13 groupes.
- 2026-09-02 - Audit des sept appels de chargement. Deux défauts corrigés :
  - **Cache serveur jamais relu pendant une session** : la condition `!window.prefetchedStreamMatches || !isBackground` ne relisait jamais `data/streams.json` lors d'une passe d'arrière-plan, la variable restant définie (même vide) après le premier chargement. Une session ouverte plusieurs heures restait sur les liens du démarrage alors que le fichier est régénéré chaque heure. Relecture forcée dès qu'il a plus de 10 minutes (`prefetchedStreamsLoadedAt`).
  - **Bouton « Réessayer »** : `loadAll(window.hasLoadedOnce, true)` valait `loadAll(true, true)` après le premier chargement, donc une passe d'arrière-plan sans réinitialisation d'état ni relecture du cache. Devient `loadAll(false, true)`.
  - Le premier chargement sans cache passait `window.hasLoadedOnce` (valeur `undefined`) : remplacé par `false` explicite.
  - Les cinq autres appels sont corrects. Vérifié dans Chromium : l'horodatage du cache se rafraîchit sur une passe périmée et reste inchangé sur une passe fraîche. Note pour les tests futurs : le service worker intercepte `data/streams.json`, donc compter les requêtes via `page.route` ne voit pas ces lectures.
- 2026-09-02 - Nombre de flux instable d'un rechargement à l'autre : six déclencheurs appellent un chargement complet (démarrage, minuterie de 5 min, changement de date, « Réessayer », réglages réseau, rechargement du cache serveur) et rien n'empêchait deux passes de se chevaucher. Chacune fusionne ses liens dans la même grille, d'où un compte qui bougeait selon l'ordre d'arrivée des proxys. `loadAll` (`js/main.js`) est scindé en une garde et `loadAllRun` : une passe d'arrière-plan lancée pendant qu'une autre tourne renvoie la promesse en cours au lieu de refaire le travail ; une passe premier plan ou forcée reste toujours autorisée. Vérifié dans Chromium : cinq passes simultanées se replient sur une seule (146 flux avant et après), premier plan non bloqué.
  - Reste inhérent au fonctionnement : le nombre de liens grandit pendant une session à mesure que le scraping d'arrière-plan répond, et varie d'un rechargement à l'autre selon les proxys CORS qui répondent dans le délai. Le cache serveur, lui, est déterministe.
- 2026-09-02 - Fenêtre de match : l'en-tête était vide (rien n'indiquait la rencontre ni la compétition ouverte) → icône, ligue et affiche du match. « 0:00 » sous le score remplacé par « DIRECT » via `formatLiveMinute` (`js/ui.js`), partagé avec les cartes.
- 2026-09-02 - Interface : densité des cartes et informations de décision.
  - Cartes de match : la vignette 16/9 mangeait ~210 px pour deux logos → ratio 2.4/1 (`--card-aspect`), hauteur de carte 257 → 202 px.
  - Informations ajoutées sur la carte : **nom de la ligue** (l'icône seule ne disait pas de quelle compétition il s'agissait) et **nombre de flux disponibles** (`▶ N`), qui décide du clic.
  - Statut en direct : « 0:00 » renvoyé par certaines API est remplacé par « DIRECT ».
  - Contrôles de zoom (« Maintenant », ±) : ils flottaient au-dessus des cartes dans En direct et À venir sans aucun effet, et masquaient l'heure des matchs sur mobile. Ils sont désormais réservés à la grille temporelle du Guide (`body.view-timeline`), la visibilité étant portée par le CSS et non plus par un style en ligne.
  - Vérifié dans Chromium : 1 colonne à 360/390 px, 2 à 768, 3 à 1024/1440/1920, aucun débordement horizontal, aucune erreur JS, contrôles de zoom visibles uniquement dans le Guide.
- 2026-09-02 - Ligues : classement principal/secondaire/ignoré réglable, séparation dans l'interface, couverture des sources.
  - `js/db.js` : `leagueTier(league, overrides)` et `defaultLeagueTier` — source de vérité unique du niveau d'une ligue. Retrait de `FIFA WORLD CUP` d'`OTHER_LEAGUES` (inatteignable : l'alias la ramène à `WORLD CUP`, déjà principale).
  - `js/state.js` : `leagueTiers` (localStorage `league_tiers`), `setLeagueTier`, `resetLeagueTiers`. Le choix de l'utilisateur prime sur les listes par défaut.
  - `js/ui.js` : trois niveaux dans En direct, À venir et le Guide. Les ligues secondaires ont leur propre section (et leur propre grille temporelle dans le Guide), les ignorées disparaissent partout. Nouvel assistant `renderGroupedSection` : les trois blocs « Autres streams » dupliqués deviennent un seul (-77 lignes). Tri des ligues par niveau.
  - `js/main.js` + `index.html` : contrôle 3 états par ligue dans Favoris → Ligues (75 ligues, bouton ↺ par ligue, réinitialisation globale). Le pré-scraping de démarrage suit le classement.
  - **Couverture des sources** : listes `ESPN_LEAGUES` du client et du serveur fusionnées en une seule liste vérifiée (59 entrées, chaque endpoint testé HTTP 200) ; ajout de NWSL, Coupe du monde féminine, WNBA, Euroleague, WTA, Top 14, Premiership Rugby, F1, IndyCar, NASCAR, UFC, ATP, PGA côté client ; retrait des endpoints morts (`wwe/wwe`, `boxing/boxing`, `hockey/…professional-hockey-league` renvoient tous 400).
  - **WWE, AEW et boxe** : ESPN ne les expose pas du tout (absents de son répertoire de sports). Source trouvée : TheSportsDB `eventsday.php?d=…&s=Fighting` (CORS ouvert). `parseSportsDbEvents` (`js/scrapers.js`) + branchement client et serveur. Les faux événements WWE hebdomadaires ne sont plus fabriqués systématiquement : ils servent de repli quand la vraie source ne répond pas.
  - **PWHL** : aucune API publique trouvée (absente d'ESPN et de TheSportsDB) ; le scraper thepwhl.com existant reste la source.
  - **Alias** : les noms renvoyés par les API (« PGA TOUR », « Gallagher Prem », « Women's National Basketball Association », « IndyCar Series »…) tombaient dans « Autres ». Alias et noms d'affichage ajoutés des deux côtés.
  - **ESPN 403** : `scripts/scrape_schedule.mjs` n'obtenait plus rien (l'User-Agent par défaut de Node et les UA imitant un navigateur sont rejetés). User-Agent de robot avec URL de contact → 0 puis 16 matchs ESPN récupérés.
  - Tests : `tests/unit_leagues.test.js` (8 groupes) ajouté à `npm test` — niveaux, choix utilisateur, absence de doublon, **parité des listes ESPN et des alias entre client et serveur**, noms d'API reconnus, `parseSportsDbEvents`.
  - Vérifié dans Chromium : bascule d'une ligue en « ignorée » persistée et appliquée, 75 lignes réglables, aucune erreur JS, aucun débordement horizontal à 390 / 768 / 1440 px.
- 2026-09-02 - Sportsurge : les pages de match répondaient 404 depuis GitHub Actions (0 lecteur Sportsurge dans `data/streams.json`) parce que `parseSportsurge` résolvait les liens relatifs (`watch-63082-…-8/`) contre la page de ligue `/watch-<sport>-streams/` au lieu de la balise `<base href="https://v2.sportsurge.net/">` du site. Corrigé (`js/scrapers.js`) + test dans `tests/unit_scrapers.test.js`. Attendu au prochain run horaire : ~15 lecteurs par match Sportsurge.
- 2026-09-02 - Options → Réseau & Proxys : bouton « ▶️ Lancer le calcul sur GitHub » (ouvre la page GitHub Actions du workflow `scrape_streams.yml`, où « Run workflow » relance le pré-calcul) et bouton « 🔄 Recharger les liens serveur » (relit `data/streams.json` sans attendre la tranche de 5 min, puis refusionne la grille). État du cache serveur enrichi (liens, sources OK). Fichiers : `index.html`, `js/multiview.js` (`openStreamsWorkflow`, `reloadPrefetchedStreams`, `renderProxyStatus`), `js/main.js` (`loadPrefetchedStreams(force)`), `js/config.js` (`REPO_URL`, `STREAMS_WORKFLOW_URL`). L'app étant statique, le déclenchement direct via l'API GitHub (jeton requis) n'a pas été retenu.
- 2026-09-02 - Exploration des sites sources (accès Web) et corrections de l'extraction des liens/vidéos.
  - Constats (depuis un serveur / GitHub Actions) : Footybite bloque ses pages `/game/` (Cloudflare 403, l'accueil passe) ; Sportsurge passe depuis les runners GitHub mais pas depuis tous les centres de données ; Streameast (tous miroirs) répond 429 « error code 1015 » aux serveurs ; MLBBite et VIPLeague ne mettent aucun lecteur dans le HTML (VIPLeague : script obfusqué `stream.bun.min.js` + blob chiffré ; MLBBite : tableau `.streams-table-new` jamais rempli côté serveur) ; OnHockey : l'accueil est un frameset, la grille est dans `schedule_table.php` (403 sans Referer) ; Buffstreams et OnHockey pointent vers le lecteur `embedsports.me/<sport>/<slug>-stream-N` (exige un referrer et refuse l'attribut `sandbox`) ; Methstreams expose `allStreams` (embedindia.st, streame.center).
  - `js/scrapers.js` : `unwrapOnHockeyPlayer` (np_stream400.php / np_youtube.php → lecteur direct), heure OnHockey (GMT → Est), `isJunkStreamHost` + nettoyage (réseaux sociaux, clones partenaires « Watch on … », lecteurs `/?stream_id=` conservés), iframes nommées par leur hôte, MLBBite statut live/terminé + heure relative (« 15 minutes from now »), liens Streameast marqués `topLevel`.
  - `js/config.js` : OnHockey → `homepageHasMatches:false`, page `schedule_table.php`.
  - `js/ui.js` `renderFluxItem` : les liens `topLevel` s'ouvrent dans un nouvel onglet (↗).
  - `scripts/scrape_streams.mjs` : en-tête Referer par site, statistiques de requêtes (`fetch`), hôtes des lecteurs (`playerHosts`), pages de match OK/KO par source, `scrapeError` et `topLevel` conservés dans `data/streams.json`, un seul lien de repli « Page du match » par site.
  - `tests/unit_scrapers.test.js` (jsdom, sans réseau) ajouté à `npm test`.
  - Workflow `scrape_streams.yml` déclenché manuellement sur main (premier run OK : 113 matchs).
  - Restant : Footybite/Streameast/VIPLeague/MLBBite n'exposent pas de lecteur exploitable depuis un serveur ; leurs liens restent des pages à ouvrir dans un onglet. Sportsurge dépend de l'IP du runner.
- 2026-09-02 - Refonte de la recherche de liens (plus aucun flux trouvé depuis fin août : proxys CORS morts ou payants, domaines saisis/migrés).
  - `js/fetcher.js` (nouveau, pur, testé) : liste des transports (direct + proxys + proxy perso/clés API), détection des pages d'erreur renvoyées en HTTP 200, santé/ordre des proxys.
  - `js/utils.js` `fetchPage` réécrit : cache 45 s + dédoublonnage des requêtes, essai direct puis proxys en « hedging » (3 s), tous les transports essayés, proxys défaillants relégués 3 min.
  - `js/config.js` : domaines vérifiés (Sportsurge → v2.sportsurge.net, Streameast → v2.gostreameast.is, VIPLeague → vipleague.vg/live-now-streaming), miroirs (`SOURCE_MIRRORS`, surchargeables par `MIRRORS` dans domains.json), `applySourceUrl`, sous-pages par sport (`pages`), `sportOfLeague`, `getSourcePages`. Sources mortes supprimées (NFLBite doublon, Totalsportek saisi, Streamonsport devenu un blog).
  - `js/scrapers.js` : `extractStreamLinks(html, m)` extrait de `scrapeMatchFlux` (réutilisable côté serveur) ; parseurs Footybite, Sportsurge, Buffstreams, Methstreams, VIPLeague réécrits pour les formats 2026 (pages par ligue) ; nettoyage des faux liens ; `scrapeMatchFlux(m, force, deep)` lit aussi les pages du match sur les autres sources (`altUrls`).
  - `scripts/scrape_streams.mjs` + `.github/workflows/scrape_streams.yml` : pré-calcul horaire des liens côté serveur (réutilise les parseurs du client via jsdom) → `data/streams.json`, chargé par `loadPrefetchedStreams` (`js/main.js`) sans proxy. `js/package.json` (`type: module`) pour permettre l'import Node.
  - Options : section « Réseau & Proxys » (proxy personnalisé, clés API cors.sh / corsproxy.io, état des proxys et du cache serveur).
  - Tests : `tests/unit_fetcher.test.js` (21 cas) ajouté à `npm test` ; domaines des tests Playwright mis à jour.
  - Restant : Streameast (mirroirs 429/Cloudflare) ne fournit que la liste ; OnHockey inaccessible en direct (défi Cloudflare) mais passe via proxy ; l'affichage Firefox n'a pas pu être testé ici (téléchargement de Firefox bloqué).
- 2026-08-25 - Audit complet des domaines de streaming (mises à jour de `domains.json`, `js/config.js` et tests pour Sportsurge, Streameast, VIPLeague). Amélioration du filtrage des URLs de navigation dans `isMatchOrLeaguePage` (`js/scrapers.js`) et de la résolution d'iframe dans `resolveStreamUrl`. Ajout d'une superposition d'aide au Multiview dans `js/multiview.js` en cas de blocage d'intégration par le navigateur (Firefox / X-Frame-Options).
- 2026-08-24 - Updated `LEAGUE_ALIASES` in `js/db.js` and `scripts/scrape_schedule.mjs` to map full ESPN league names (e.g. English Premier League, Spanish LaLiga, Italian Serie A, German Cup, Portuguese Primeira Liga, MLB) to standard league keys recognized by `DEFAULT_LEAGUES` and `OTHER_LEAGUES`. Regenerated `data/schedule.json` to fix guide categorizations.
- 2026-06-08 - Audit complet du calendrier des ligues et mise à jour des domaines de streaming. Restauration des endpoints fonctionnels pour Streameast (naturallyyou.fit), OnHockey (onhockey.tv) et StreamOnSport (streamonsport.pro) dans domains.json, js/config.js et tests. Ajout du support de mise en forme et icônes pour AEW et MotoGP dans js/db.js.
- Fix Footybite stream extraction fallback in `scrapeMatchFlux` to parse DOM structure when Next.js payload is missing.
- Note for future scrapers: Added explicit site-specific fallback pattern inside `scrapeMatchFlux` to allow bypassing generic class-based extraction if Cloudflare blocks Next.js payloads.
- Update `scrape_schedule.yml` Github Action to trigger on `push` to `main`, ensuring `schedule.json` updates automatically and first load is fast.
- 2026-06-07 - Implemented advanced Next.js JSON payload parsing in `js/scrapers.js` for Footybite, Streameast, and MLBite to correctly extract match schedules from their new React-based architecture.
- 2026-06-07 - Enhanced `scrapeMatchFlux` to parse embedded stream links and iframes directly from script tags and Next.js payloads on individual match pages, bypassing Cloudflare 403 blocks on direct DOM loads.


* **2026-06-07**: Correction du bogue critique provoquant des erreurs 404 (GitHub Pages) dans le Multiview. Import et utilisation globale de `resolveUrl` au sein de `resolveStreamUrl` dans `js/utils.js` pour imposer des URLs de flux absolues strictes (`https://`).

- 2026-06-05 - Fixed scraper extraction issues by updating hardcoded base URLs for Footybite (`home.footybite.vc`), Totalsportek (`totalsportekz.com`), Buffstreams (`app.buffstreams.is/indexcracked29`), and VIPLeague (`www.vipleague.ws`).
- 2026-06-05 - Implemented dynamic domain resolution in `js/config.js` and `js/main.js` which fetches a remote `domains.json` file from the repository at startup to seamlessly update domains without requiring full app updates.
- 2026-06-03 - Fixed CI playwright extraction test failing due to Sportsurge/Methstreams scraping proxies returning wrapped HTML in `<pre>` instead of standard DOM output. Also handled `520` Cloudflare status codes. Updated base URLs for Buffstreams and VIPLeague to resolve endpoint fetch errors.
- 2026-06-03 - Updated GitHub Action workflows (`android-build.yml` and `tests.yml`) to use Node.js version 22 instead of 20, fixing the `@capacitor/cli` compatibility failure during the CI process.
- 2026-06-03 - Fixed tests.yml failure when downloading browsers or testing by updating Playwright GitHub Action to not be deprecated and fixed capacitor webDir setting.

# Worklog

## En cours

## Fait
- Update `scrape_schedule.yml` Github Action to change schedule to 09:00 UTC (4 AM EST).
- Fix Footybite stream extraction fallback in `scrapeMatchFlux` to parse DOM structure when Next.js payload is missing.
- Note for future scrapers: Added explicit site-specific fallback pattern inside `scrapeMatchFlux` to allow bypassing generic class-based extraction if Cloudflare blocks Next.js payloads.
- Update `scrape_schedule.yml` Github Action to trigger on `push` to `main`, ensuring `schedule.json` updates automatically and first load is fast.
- 2026-05-28 - Ajout d'attributs `aria-label` aux boutons avec des icônes uniquement dans `index.html`, `js/ui.js`, et `js/multiview.js` pour améliorer l'accessibilité.
- Optimizing array iterations (forEach, map, filter, find) to traditional for loops to improve performance and reduce resource usage.
- 2026-05-18 - Fix robust URL parsing using getDomain with a custom fallback and a new resolveUrl helper in js/config.js to resolve scrapers missing protocol bugs without error. Replaced naive new URL try/catch blocks in js/scrapers.js.
- 2026-05-16 - Déplacer bouton de mise à jour de la liste des streams et mettre en haut de la liste des streams, sans rond autour, juste l'icone, à côté, ajouter une icone de multiview qui ajoute un stream random du match (sauf si 4k stream dispo, mettre 4k stream). Aussi, 4k streams et Buffstream Flux toujours favoris en haut.
- 2026-05-16 - Fixed stream cache persistence issue where cached streamLinks were discarded upon page refresh. Updated `getApiFirstMatches` in `js/api.js` to eagerly inject saved `stream_cache` into newly fetched API matches before saving them into the local calendar cache.
- 2024-05-18 - Mettre "Manches" au lieu de "Temps" pour le baseball dans la section des scores.
- 2026-05-16 - Fixed URL matching/parsing in `js/scrapers.js` where `new URL` failed silently for base URLs lacking a protocol, preventing relative streams from resolving properly.
- 2026-05-16 - Enhanced `getDomain` in `js/config.js` with regex fallback to gracefully parse naked domains if `new URL` throws an exception, avoiding full URL returns when protocols are missing.
- 2024-05-16 - Correction du bug undefined BP/BC et mise à jour des statistiques par défaut (statsToCompare) dans js/ui.js pour correspondre aux Team Stats affichées par ESPN pour chaque sport (Soccer, Hockey, MLB, etc.), regroupées dans la section Voir les statistiques de la saison.

## Fait
- Fix Footybite stream extraction fallback in `scrapeMatchFlux` to parse DOM structure when Next.js payload is missing.
- Note for future scrapers: Added explicit site-specific fallback pattern inside `scrapeMatchFlux` to allow bypassing generic class-based extraction if Cloudflare blocks Next.js payloads.
- Update `scrape_schedule.yml` Github Action to trigger on `push` to `main`, ensuring `schedule.json` updates automatically and first load is fast.
- 2024-05-18 - Mettre "Manches" au lieu de "Temps" pour le baseball dans la section des scores.
- 2024-05-15 - Fixed premature stream scraping blocks by introducing a `hasEnoughStreams` check in `fetchSubPages` (background scraper) and `openMod` (foreground modal). This ensures matches that were checked too early and had 0 streams are eligible for re-scraping later, solving the missing streams issue.
- 2026-05-15 - Ajout de logs de debug détaillés (diagnosticScrape), persistance des streams manuels (via saveStreamCache), fonction globale copyToClipboard et affichage des logs multilignes dans le Multiview.
- 2024-05-15 - Fixed URL matching/parsing in `js/scrapers.js` for `MLBITE_URL` trailing slash replacement bug by checking `endsWith('/')` rather than blindly using string `.replace(/\/$/, '')`.
- 2024-05-15 - Refined match modal for game streaming in `js/ui.js` by hiding legacy header/footer, injecting a new close button into `wrapperHtml`, and fixing the async stream render target in `js/scrapers.js` to update the new split layout instead of overwriting the entire modal.
- 2024-05-15 - Redesigned stream modal layout (desktop and mobile) to use a 2-column view with stickied game info on the left (reusing live cards design) and stream links on the right.
- 2026-05-15 - Ajout de l'outil de diagnostic et extraction manuelle de flux dans la fenêtre de match. Refactorisation de `isMatchPair` vers `debugMatchPair` pour exposer la raison de l'échec de l'association.
- 2026-05-14 - Fixed URL matching/parsing in `js/scrapers.js` for `MLBITE_URL` trailing slash replacement bug by checking `endsWith('/')` rather than blindly using string `.replace(/\/$/, '')`.
- 2026-05-14 - Refined match modal for game streaming in `js/ui.js` by hiding legacy header/footer, injecting a new close button into `wrapperHtml`, and fixing the async stream render target in `js/scrapers.js` to update the new split layout instead of overwriting the entire modal.
- 2026-05-14 - Redesigned stream modal layout (desktop and mobile) to use a 2-column view with stickied game info on the left (reusing live cards design) and stream links on the right.
- Added auto-refresh mechanism for match streams when their status transitions to "live", bypassing stream caches and resetting the `streamsLoaded` state flag.
- Ajouter lien vers match sur ESPN dans modal des streams.
- À droite, mettre carte du match avec le 45 dégradé et logo.
- Ou mettre une photo ou un texte de preview du match si ESPN ou autre peut en fournir?

## Fait
- Fix Footybite stream extraction fallback in `scrapeMatchFlux` to parse DOM structure when Next.js payload is missing.
- Note for future scrapers: Added explicit site-specific fallback pattern inside `scrapeMatchFlux` to allow bypassing generic class-based extraction if Cloudflare blocks Next.js payloads.
- Update `scrape_schedule.yml` Github Action to trigger on `push` to `main`, ensuring `schedule.json` updates automatically and first load is fast.
- 2024-05-18 - Mettre "Manches" au lieu de "Temps" pour le baseball dans la section des scores.
- 2024-05-15 - Fixed "Autres Flux" display toggling in grid views and separated it into a dedicated collapsible section at the bottom of the "En direct" tab.
- 2024-05-15 - Removed arbitrary stream bounds limiting in `scrapeMatchFlux` and updated stream quantity threshold to 1000 so that every game will have every stream displayed.
- Added parsing logic in `js/api.js` for ESPN article text, photo, and web link.
- Modernized the `openMod` layout in `js/ui.js` to feature a stylish 45-degree gradient VS matchup card.
- Implemented logic in `fetchAndRenderModalStats` to overlay the ESPN article photo and text on the matchup card when available.
- Appended a new `Lire sur ESPN` button underneath the poster card.
- 2024-05-15 - Flattened stream link layout in js/ui.js to a single line and removed "Recommandé/Alternatif" text to simplify UI.
- Increase stream limits in scrapeMatchFlux (js/scrapers.js) to display all streams for sources with large volumes.
- 2024-05-13 - Update Footybite URL to army.footybite.to in js/config.js and js/ui.js.
- 2024-05-13 - Fixed missing leagues in the EPG guide by moving DEFAULT_LEAGUES to db.js and handling case-insensitive logic in UI display sorting.
- Refonte visuelle de la carte de match dans `js/ui.js` (mode Scoreboard).
- Simplification du bouton Multivision dans la liste de flux en icône carrée simple.
- Correction du scroll mobile pour `#modal-left-col` (retrait de la couleur de fond fixe et du sticky) dans `styles.css`.
- 2024-05-18 - Implemented frontend UI for the Scraper Investigator inside the options modal, integrating interactive DOM selection to dynamically build custom scraper rules bypassing X-Frame-Options.

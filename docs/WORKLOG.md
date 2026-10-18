# Journal

Les entrées jusqu'au 30 septembre 2026 sont dans [WORKLOG-archive.md](WORKLOG-archive.md).

## En cours

## Blocages
- 2026-10-18 - **« ça le fait encore » : l'onglet de l'appli part sur une pub, « je quittais pas, le stream redirige », appli v61 + script 1.15, Firefox.** Troisième retour sur la garde « Quitter le site ? » le même jour (#614, #615) : arrêt avant un quatrième correctif à l'aveugle, comme le veut AGENTS.md.

  - **Essayé dans un vrai Firefox** (158.0, Linux, sans écran, piloté par puppeteer-core en WebDriver BiDi, avec `userActivation: false` sur les évaluations ; sinon Puppeteer donne lui-même un geste à la page et fausse tout) :
    - un cadre d'une autre origine qui n'a pas reçu de clic ne peut PAS emmener l'onglet : `top.location.href`, `location.replace`, `window.open(…, '_top')`, lien `target=_top` cliqué par script, formulaire `target=_top`, vers un site tiers comme vers le sien, tous bloqués ;
    - même un cadre cliqué une fois ne le peut plus 8 s après : il faut un clic dans le cadre quelques secondes avant (activation passagère) ;
    - l'application réelle (v61, script 1.15 dans la tuile), clic dans la tuile puis redirection 3 s après : la garde est armée et Firefox demande « Quitter le site ? », l'onglet reste. Pareil sans aucun clic dans l'application elle-même (un clic dans la tuile compte pour la page), en plein écran (⛶), et quand la page croyait le pointeur parti par le haut (elle le voit revenir sur la tuile) ;
    - `navigator.userActivation` existe dans Firefox 158, et la page est active juste après un clic dans une tuile.
  - **Pas reproduit.** Le détournement suit forcément un clic dans le cadre, et dans tous les cas joués ici la garde le retient.
  - **Hypothèses restantes** : réglage `🛡 Bloquer les redirections des sites` coupé ; pointeur réellement sur la barre des onglets, ou touche Ctrl/Alt tenue, au moment du détournement (garde levée par `utilisateurPart`) ; une version de Firefox ou un réglage qui se comporte autrement que 158 ; un chemin de navigation non essayé ici.
  - **Réponses de l'utilisateur** : réglage « devrait être toujours activé » (pas vérifié), « rien, je regardais », Firefox 158, et oui au relevé.
  - **Ce qu'il faut** : la page Logs (« Sorties de l'appli ») au prochain détournement. Elle tranche entre : garde armée mais page quittée (le navigateur n'a pas demandé), garde levée (et par quel signe), ou aucune sortie notée avant un retour par « Précédent » (départ sans `beforeunload`).
  - **Premier relevé reçu (appli v62, le soir même)** : deux « page restée · garde armée » à 15:14:06 et 15:14:29, sans clic ni focus dans une vidéo, et une capture du dialogue « Quitter la page ? » de Firefox sur une tuile ; F5 à 15:14:25 et la mise à jour de l'appli à 15:14:18 ont bien levé la garde. L'utilisateur ne sait pas ce qui a déclenché les deux dialogues. Lectures possibles : sa propre sortie à la souris, le pointeur vu à quelques pixels du haut (d'où la marge de 20 px) ; ou une tentative d'une tuile, retenue (la garde a fait son travail). Le stockage local était plein au même moment (entrée suivante, Fait). Le relevé dit désormais où était le pointeur, où il est sorti, la dernière touche, le focus de la fenêtre et l'âge de chaque vidéo : il faudra le prochain relevé pour trancher.
## Fait
- 2026-10-18 - **Stockage local plein (« ❌ 1 écriture(s) refusée(s) · QuotaExceededError · 4569 Ko », Firefox) ; garde « Quitter le site ? » armée seulement quand une tuile affiche la page d'un site ; relevé plus précis.** L'utilisateur : « Oui, règle-le » (trouver ce qui prend la place et le limiter, sans perdre favoris ni réglages).

  - **Mesuré.** Le calendrier du jour avec ses liens fusionnés : 620 Ko au compte de Firefox (68 matchs, 2 931 liens) ; celui d'hier autant ; les matchs du dernier scraping jusqu'à 1 100 Ko (700 matchs, 4 750 liens, toutes sources) ; plus le cache des liens. Limite de Firefox : 5 120 Ko.
  - **Fait.** `safeStorageSet` (`js/utils.js`), sur `QuotaExceededError`, retire une à une les clés de `CACHES_JETABLES` (`stream_cache`, `last_scraped_matches`, puis les calendriers du plus ancien au plus récent, jamais la clé écrite ni un cache plus utile qu'elle) et réessaie ; favoris, réglages, état du lecteur, registres appris, débits et relevé ne partent jamais. Il rend vrai ou faux. Au démarrage, le calendrier d'hier perd ses liens et garde ses matchs (`allegerCalendrier`, `js/main.js`). La ligne « Stockage local » de Logs nomme les caches vidés et les plus grosses clés (`plusGrossesCles`).
  - **Garde.** Armée seulement si au moins une tuile affiche la page d'un site (`pagesDeSites()`, `js/multiview.js`) : une vidéo en mode direct, une tuile qui charge encore, le panneau de sortie forcée ou un lecteur officiel ne peuvent pas emmener l'onglet. Le pointeur sorti de la fenêtre à 20 px du haut ou moins (`MARGE_HAUT_PX`) compte comme un départ vers les onglets, dans la page comme dans le script (1.16). Le relevé note aussi `pages`, `focusPage`, la dernière position du pointeur et sa dernière sortie de la fenêtre (px, âge), la dernière touche de raccourci (jamais une autre) et l'âge de chaque vidéo.
  - **Tests** : `unit_stockageplein` (nouveau : ordre de délestage, clé écrite jamais sacrifiée, un cache qui n'en chasse pas un plus utile, favoris intacts, refus compté sans cache à vider, erreur autre que le quota, calendrier d'hier allégé, ligne de Logs) ; `test_app_boot` « stockage plein… » (le vrai quota de Chromium rempli de caches avant le démarrage ; tombe sans la correction) ; `unit_lecteurfluide` groupe 6 (pas de page de site, pas de garde ; marge de 20 px) ; `unit_sorties` (nouveaux détails du relevé). Nouveaux tests et tests de la garde répétés trois fois. `npm test` : 121 unitaires, 66 Playwright (1 ignoré, comme avant), avec le Chromium préinstallé.
  - **Fichiers** : `js/utils.js`, `js/main.js`, `js/multiview.js`, `js/sorties.js`, `multiview-cleaner.user.js` (1.16), `extension/nettoyeur.js` (régénéré), `extension/manifest.json`, `extension/gabarit-nettoyeur.js` et `js/installation.js` (extension 1.3), `tests/unit_stockageplein.test.js` (nouveau), `tests/unit_sorties.test.js`, `tests/unit_lecteurfluide.test.js`, `tests/test_app_boot.spec.js`, `docs/ARCHITECTURE.md`, `FEATURES.md`, `sw.js` + `VERSION_APP` → `sports-guide-v63`.
  - **Ce qui reste.** Mettre à jour le script (1.16) pour la marge de 20 px quand le pointeur sort d'une tuile collée au haut de la fenêtre. Lire le prochain relevé (Blocages). Les matchs du dernier scraping restent la plus grosse clé ; s'ils suffisent encore à remplir le stockage, ils seront vidés d'abord, au prix d'une relecture des sources au rechargement suivant.
- 2026-10-18 - **Relevé des sorties** (voir Blocages ci-dessus ; accepté par l'utilisateur).

  - **Fait.** `js/sorties.js` (nouveau, sans import) et `etatGarde()` (`js/multiview.js`) : à chaque `beforeunload` avec des vidéos, l'état complet de la garde est noté dans `journal_sorties` ; `pagehide` marque « quittée » ; un retour par « Précédent » est noté (`navigation.activation`, à défaut la chronologie de navigation ; `pageshow` persisté). Plus → Logs montre « Sorties de l'appli » en clair, et « Cet appareil » dit si la garde est active.
  - **Vérifié dans Firefox 158** (le vrai, sans écran) : détournement au clic retenu → « page restée · garde armée » ; garde coupée → « page quittée · réglage coupé » ; retour depuis le cache de navigation noté. L'API Navigation y existe.
  - **Tests** : `unit_sorties` (nouveau) ; `test_app_boot` « un lecteur qui tente de détourner l'onglet… » vérifie le relevé, puis, après « Précédent », la page Logs et la ligne de la garde coupée. `npm test` : 120 unitaires, 65 Playwright (1 ignoré, comme avant).
  - **Au passage** : sous l'horloge factice de Playwright, `performance.getEntriesByType('navigation')` est vide ; d'où l'API Navigation en premier.
  - **Fichiers** : `js/sorties.js`, `js/multiview.js`, `sw.js` (`APP_SHELL`, `sports-guide-v62`), `tests/unit_sorties.test.js`, `tests/test_app_boot.spec.js`, `docs/ARCHITECTURE.md`, `FEATURES.md`, `docs/WORKLOG.md` (le titre « ## Fait », retiré par erreur avec l'ajout de « ## Blocages », est remis).
  - **Ce qui reste** : lire le relevé au prochain détournement (Blocages).
- 2026-10-18 - **Capture : uBlock Origin a empêché « srowox.com/click?key=… » de se charger.** Précisé : dans l'onglet de l'appli (l'appli a disparu), « tout seul, sans clic », script 1.14.

  - **Cause.** L'entrée suivante (même jour) n'armait la garde « Quitter le site ? » que dans les 5 s après un geste dans une tuile, sur l'idée qu'un cadre ne détourne l'onglet qu'au clic. Vrai dans Chrome, faux dans Firefox : un cadre d'une autre origine y emmène l'onglet sans geste. Le piège du script sur `window.top` ne pouvant pas tenir, plus rien ne retenait l'onglet. uBlock a arrêté la régie, l'appli était perdue quand même.
  - **Fait.** La garde reste armée, et se lève sur les signes d'un départ voulu (`utilisateurPart`, `js/multiview.js`) : pointeur sorti par le haut (vers les onglets, la croix, le rechargement), Ctrl/Cmd/Alt tenu ou F5, onglet caché. Vérifié dans Chromium : la page voit le pointeur sortir quand il traverse la barre du lecteur ; quand il revient directement dans une tuile, seul le cadre le voit. Le script (1.15) relaie donc, depuis les cadres, le pointeur qui en sort par le haut ou y revient (`pointeur`) et les touches Ctrl, Cmd, Alt, F5 (`touche`).
  - **Tests** : `unit_lecteurfluide` groupe 6 (armée sans geste ; levée par la sortie par le haut, pas par le bas ; Ctrl, relâchement perdu, F5 ; réglage, navigations de l'appli) ; `test_app_boot` : « un lecteur qui tente de détourner l'onglet » exige de nouveau la garde armée sans geste ; « fermer la page à la souris » et « au clavier, le focus dans une tuile » (le second avec le vrai script dans la tuile ; les deux tombent si la détection est retirée, le second avec le script 1.14) ; `test_cleaner` « le script signale le pointeur qui sort par le haut… » (tombe avec 1.14). `npm test` : 119 unitaires, 65 Playwright (1 ignoré, comme avant).
  - **Fichiers** : `js/multiview.js`, `multiview-cleaner.user.js` (1.15), `extension/nettoyeur.js` (régénéré), `extension/manifest.json`, `extension/gabarit-nettoyeur.js`, `js/installation.js` (extension 1.2), `tests/unit_lecteurfluide.test.js`, `tests/test_app_boot.spec.js`, `tests/test_cleaner.spec.js`, `docs/ARCHITECTURE.md`, `FEATURES.md`, `sw.js` + `VERSION_APP` → `sports-guide-v61`.
  - **Ce qui reste.** Mettre à jour le script dans Tampermonkey (1.15) : sans lui, Ctrl+W avec le focus dans une vidéo redemande confirmation. Chromium sans écran ne simule pas la sortie du pointeur d'un cadre d'une autre origine : le relais `pointeur` est vérifié sur un cadre de même origine, pas dans un vrai Firefox. Un détournement pendant que le pointeur est sur la barre des onglets, ou dans un onglet caché, n'est pas retenu.
- 2026-10-18 - **« J'ai à nouveau des pubs dans les frames du multiview, et ça me demande souvent si je veux quitter quand je ferme la page, ce qui devrait jamais arriver » ; « le bouton direct, ça marche avec AUCUN SITE ».** Montage : Firefox + Tampermonkey. Pubs : « pub par-dessus la vidéo » et « site pas nettoyé ».

  - **« Quitter le site ? » à la fermeture.** La garde `beforeunload` (9 octobre) était armée dès qu'une vidéo était chargée : fermer l'onglet passait par le même dialogue qu'un lecteur qui l'emmène. Elle n'est plus armée que dans les 5 s qui suivent un geste dans une tuile (`GESTE_TUILE_MS`, `gesteRecentDansTuile`, `js/multiview.js`) : message `mv_frame_clicked`, focus qui passe dans une tuile, ou activation passagère de la fenêtre avec le focus dans une tuile. Vérifié dans Chromium : au moment où un cadre détourne l'onglet, `navigator.userActivation.isActive` est vrai et le focus est sur l'iframe. Vu en chemin : le piège du script sur `window.top` n'a jamais tenu (« Cannot redefine property: top ») ; retiré, `window.parent` reste piégé.
  - **Direct.** Mesuré sur les manifestes du cache et sur des manifestes frais : les CDN ne répondent `Access-Control-Allow-Origin` qu'à l'origine de leur lecteur, ou pas du tout, et plusieurs refusent un autre `Referer`. Avec le vrai hls.js 1.5.17 sur un flux de streame.center : `manifestLoadError` code 0 (refus CORS) depuis l'application ; par un pont qui pose le `Referer` du lecteur, manifeste, niveaux et segments chargés (le Chromium du conteneur ne décode pas le H.264, Firefox oui). Le script (1.14) lit donc en binaire pour l'application (`mv_bridge_fetch` + `binaire`, `referer`, `origine`, `plage`), annoncé seulement sous un vrai gestionnaire de scripts (`GM_info`). `lireOctetsViaPont` (`js/embed-bridge.js`), `chargeurParPont` et `refererPourDirect` (`js/directmedia.js`) ; `creerLecteurVideo` les prend quand le pont sait lire en binaire.
  - **Pubs.** Pas de régression trouvée dans le code d'octobre ; 29 pages réelles du cache chargées dans une tuile (Chromium, script injecté, liste de blocage de l'extension) se nettoient, sauf celles dont le lecteur ne démarre pas ici. Corrigé dans le script ce qui laisse une page entière ou une pub sur l'image : `.epg` seul faisait croire à l'application (un site de chaînes a sa grille de programmes) ; un lecteur caché puis montré par un style n'était jamais trouvé (sondage arrêté à 15 s : il continue toutes les 3 s) ; vidéo dans une racine fantôme ; emballage « …chat… » autour du lecteur ET de la discussion, qui faisait écarter le lecteur (1.12) ; calques positionnés qui couvrent au moins un vingtième de la vidéo et mènent vers un autre site, ou iframe dans l'emballage d'une `<video>` (`retirerCalquesDePub`) ; enfants de `<html>` hors de `<body>`.
  - **Test instable de `main`, corrigé en chemin.** « chaque section repliable de l'onglet Live répond au clic » tombait 2 fois sur 8, sur `main` comme ici (`getComputedStyle` sur un titre détaché). Cause : `bootOffline` attendait `hasLoadedOnce`, posé dès l'affichage provisoire ; quand le cache des liens du dépôt a plus de 3 h à l'instant gelé, la lecture des sources redessine toute la grille 3 s plus tard, après les 600 ms d'immobilité d'`attendreGrilleStable`. `bootOffline` attend maintenant la fin de la première passe (`loadSequenceComplete`) : 16 sur 16.
  - **Tests** : `unit_directpont` (nouveau) ; `unit_lecteurfluide` groupe 6 ; `test_app_boot` « fermer la page… ne demande jamais » et « le mode direct lit le flux par le pont » (les deux tombent sans le correctif ; le second simule un navigateur qui lit le HLS lui-même, comme le Chromium de la CI, où le premier envoi avait échoué), « un lecteur qui tente de détourner l'onglet » ajusté ; `test_cleaner` : sept tests (calques de pub, lecteur montré tard, racine fantôme, `.epg`, emballage de discussion, pont binaire avec et sans `GM_info`), tous en échec avec le script 1.13. Nouveaux tests répétés trois fois. `npm test` : 119 unitaires, 63 Playwright (1 ignoré, comme avant), avec le Chromium préinstallé.
  - **Fichiers** : `multiview-cleaner.user.js` (1.14), `extension/nettoyeur.js` (régénéré), `extension/manifest.json`, `extension/gabarit-nettoyeur.js` et `js/installation.js` (extension 1.1), `js/multiview.js`, `js/embed-bridge.js`, `js/directmedia.js`, `tests/unit_directpont.test.js`, `tests/unit_lecteurfluide.test.js`, `tests/test_app_boot.spec.js` (dont `bootOffline`), `tests/test_cleaner.spec.js`, `docs/ARCHITECTURE.md`, `FEATURES.md`, `sw.js` + `VERSION_APP` → `sports-guide-v60`.
  - **Ce qui reste.** Mettre à jour le script dans Tampermonkey (1.14) : le direct par le pont et les corrections du nettoyage en dépendent. Pas essayé dans un vrai Firefox. Si une pub reste sur l'image, il faut le nom du site : rien ne s'est reproduit ici. Une page qui détourne l'onglet sans geste, au chargement, n'est plus retenue (Chrome l'en empêche ; la sortie forcée la reconnaît au retour). L'extension, l'APK et le bureau n'ont pas la lecture binaire (fetch ne pose pas de `Referer`) : sur Chrome avec l'extension, le direct reste soumis aux CDN ; l'APK a son lecteur natif.
- 2026-10-16 - **« It's stuck »** : une tuile figée sur « Chargement de player.twitch.tv… » (flux officiel de Karmine Corp – MVK, ajouté plus tôt le même jour).

  - **Cause.** Pas reproductible ici (Twitch injoignable depuis le bac à sable), mais deux défauts lus dans le code. (1) La bascule automatique attend que le script utilisateur signale « joue ». Le lecteur Twitch ne le signale jamais : au bout de 30 s, la tuile passait au flux suivant, encore un lecteur Twitch parmi la vingtaine de flux du match, et recommençait. D'où un chargement sans fin. (2) Dans le cadre du lecteur Twitch, le script utilisateur remplaçait `window.parent` et `window.top` par des pièges, que le lecteur consulte pour vérifier son `parent`.
  - **Fait.** `estLecteurOfficiel` (`js/esports.js`) : `player.twitch.tv`, et `/embed/` de youtube.com et youtube-nocookie.com. La tuile ne demande pas de nettoyage à ces cadres et n'arme pas la bascule automatique (`js/multiview.js`). Le script utilisateur rend la main sur ces mêmes adresses, avant tout piège (1.13) ; `extension/nettoyeur.js` régénéré.
  - **Tests** : `unit_esports` groupe 8 ; `unit_lecteurofficiel` (nouveau ; il tombe sans le correctif du script). `npm test` : 118 unitaires, 54 Playwright (1 ignoré).
  - **Fichiers** : `js/esports.js`, `js/multiview.js`, `multiview-cleaner.user.js`, `extension/nettoyeur.js`, `tests/unit_esports.test.js`, `tests/unit_lecteurofficiel.test.js`, `docs/ARCHITECTURE.md`, `FEATURES.md`, `sw.js` + `VERSION_APP` → `sports-guide-v59`.
  - **Ce qui reste.** À confirmer chez l'utilisateur : mettre à jour le script dans Tampermonkey (1.13), ou recharger l'extension. Si le lecteur reste noir sans changer de source, la cause est ailleurs (réseau, Twitch lui-même).
- 2026-10-16 - **Karmine Corp – MVK (Mondiaux, en direct) : « Aucun flux trouvé pour l'instant ».** (capture d'écran)

  - **Constaté.** `getLive` annonçait ce match en direct avec une vingtaine de flux (Twitch riotgames, YouTube, Kick…). Mais `data/schedule.json` porte les matchs LoL sans flux et à l'état « à venir », l'appli le lit en premier, et les passes suivantes (`applyScoreUpdates`) ne reportaient que statut et score. Les liens de `getLive` n'étaient donc vus que si le calendrier venait de l'API elle-même, ce qui n'arrive que quand `schedule.json` manque.
  - **Fait.** `liensLolDuDirect` (`js/esports.js`) : les flux d'un match, lus dans `getLive` par son identifiant. La fiche d'un match LoL pas encore fini les demande à l'ouverture et se redessine (`js/ui.js`). `applyScoreUpdates` (`js/main.js`) ajoute aussi les liens apportés par la passe complète (jamais n'en retire).
  - **Tests** : `unit_esports`, groupe 7. `npm test` : 117 unitaires, 54 Playwright (1 ignoré).
  - **Fichiers** : `js/esports.js`, `js/ui.js`, `js/main.js`, `tests/unit_esports.test.js`, `docs/ARCHITECTURE.md`, `sw.js` + `VERSION_APP` → `sports-guide-v58`.
  - **Ce qui reste.** Le script serveur (`scripts/scrape_schedule.mjs`) définit `fetchLolEsportsLiveStreams` sans l'appeler ; inutile tant que la fiche interroge `getLive` elle-même.
- 2026-10-15 - **« clean repo, reorganize ».**

  - **Fait.**
    - Journal coupé en deux : les entrées jusqu'au 30 septembre partent dans `docs/WORKLOG-archive.md` (≈ 820 lignes) ; celui-ci garde octobre.
    - `sectionsLive` (`js/dispositions.js`) retirée : définie, jamais appelée (grep sur tout le dépôt).
    - `tests/getLogo.test.js` → `tests/unit_getlogo.test.js`, comme les autres tests unitaires.
    - Tests d'exemple de Capacitor retirés (`com/getcapacitor/myapp/Example*Test.java`) : `2 + 2 == 4`, et un test d'appareil qui attendait le paquet `com.getcapacitor.app` au lieu de `ca.local.footy`.
    - `package.json` : nom `guide-des-sports` au lieu de `app`, `private`, champs vides retirés (`keywords`, `author`, `license`, `directories`) ; même nom dans `package-lock.json`. Scripts inchangés.
    - Arborescence de `docs/ARCHITECTURE.md` §2 et tableau « Où est quoi » du README : `desktop/`, `mobile/`, `tv/`, `local/`, `extension/` y manquaient.
  - **Pas déplacé, exprès.** `multiview-cleaner.user.js` reste à la racine : Tampermonkey le met à jour depuis cette adresse. `styles.css` / `tv.css` aussi : leurs chemins sont dans `sw.js`, `index.html`, `js/main.js`, `desktop/package.json`, `mobile/assembler-www.mjs` et les tests, pour aucun gain. Les tests restent à plat dans `tests/` (`npm test` les ramasse par motif).
  - **Tests** : `npm test` : 117 unitaires, 54 Playwright (1 ignoré, comme avant ; lancé avec le Chromium préinstallé).
  - **Fichiers** : `docs/WORKLOG.md`, `docs/WORKLOG-archive.md` (nouveau), `docs/ARCHITECTURE.md`, `README.md`, `AGENTS.md`, `js/dispositions.js`, `sw.js`, `js/multiview.js`, `package.json`, `package-lock.json`, `tests/unit_getlogo.test.js`, `mobile/android/app/src/{test,androidTest}/…/Example*Test.java` (retirés).
  - **Version** : `sports-guide-v57`.
- 2026-10-13 - **« garder vieux guide plutôt que nouveau »** (précisé : le guide d'installation, pas l'onglet Guide).

  - **Fait.** La page Plus → `🧩 Script` reprend mot pour mot l'ancien guide (Firefox + uBlock Origin recommandé, réglages Firefox, étapes uBlock / Tampermonkey / script), écrit dans `index.html` (`#guide-installation`) ; la fenêtre du début (« 🧩 Installation des Scripts ») en recopie le contenu. Le guide par navigateur vers l'extension Chrome est retiré (`guideInstallationHtml`, `quelNavigateur`, `telechargerExtension`, `copierTexte`, leur CSS). La fenêtre s'ouvre une seule fois (`hasSeenScriptModal` vide, posé à « true ») et pas si un nettoyeur tourne déjà ; plus de nouvel affichage pour Chrome ni de proposition de mise à jour de l'extension.
  - **Gardé.** L'extension `extension/` (elle se charge depuis son dossier) et `zipExtension` (testé, plus appelé par l'interface).
  - **Tests** : `unit_extension` (quand la fenêtre s'ouvre ; contenu de l'ancien guide ; le test « plus aucun lien vers uBlock pour Chrome » retiré, puisque l'ancien guide en a) ; `test_app_boot` « la fenêtre du début montre l'ancien guide des scripts, une seule fois ». `npm test` : 117 unitaires, 54 Playwright (1 ignoré, comme avant).
  - **Fichiers** : `index.html`, `js/installation.js`, `js/multiview.js`, `styles.css`, `sw.js`, `tests/unit_extension.test.js`, `tests/test_app_boot.spec.js`, `FEATURES.md`, `README.md`, `docs/ARCHITECTURE.md`.
  - **Version** : `sports-guide-v56`.
  - **Ce qui reste.** Les liens uBlock Origin pour Chrome et Edge de l'ancien guide mènent à une extension qui ne s'installe plus sur Chrome (Manifest V2 retiré) : gardés tels quels, comme demandé.
- 2026-10-13 - **« Ça pogne pas toujours le bon iframe (genre chat) ».**

  - **Cause.** Sans `<video>` dans la page, `findAndClean` (`multiview-cleaner.user.js`) gardait la plus grande iframe : une colonne de discussion 350 × 700 bat un lecteur 640 × 360. La tuile était réduite au chat, et `cleaned` ne se relevant plus, le lecteur n'avait plus sa chance.
  - **Fait.** `estCadreDeDiscussion` écarte les cadres de discussion (adresse, ou id/classe/nom/titre du cadre et de ses emballages proches) ; `noteCadre` pénalise les cadres en portrait. Script en 1.12, `extension/nettoyeur.js` reconstruit (`node extension/construire.mjs --script`). `unit_soncadre` exige désormais « au moins 1.11 » au lieu de « exactement 1.11 ».
  - **Fichiers.** `multiview-cleaner.user.js`, `extension/nettoyeur.js`, `tests/test_cleaner.spec.js`, `tests/unit_soncadre.test.js`, `docs/ARCHITECTURE.md`.
  - **Reste.** Tampermonkey met à jour le script tout seul ; l'extension Chrome (chargée depuis le dépôt) doit être rechargée. L'APK reprend le script à sa prochaine construction.
- 2026-10-13 - **« Enlever choix de look en haut car maintenant en bas. Aussi, pour toute carte, garder le look des cartes par défaut, mais adaptées aux autres layouts, même style » ; « le look des cartes dans Actuelle, avec les dégradés, arrondis, etc, ça devrait être la base de tous les éléments ui ».**

  - **Fait.**
    - Rangée `.dsp-switch` retirée (code, CSS, tests) : le menu Look la remplace.
    - `carte()` dans `js/dispositions.js` : le balisage de la carte par défaut, utilisé par Maintenant (la une, En direct, Commence bientôt), Affiches (mur du Live, colonnes du Guide) et l'aperçu des Chaînes. `fondEquipes` reprend exactement la règle de « Couleur des cartes ».
    - Rangées en liste à la palette de la carte ; CSS mort des anciennes tuiles retiré.
    - `styles.css` §13 : les jetons de la carte habillent boutons flottants, menus (Look, Plus), bandeau, filtres, messages, zoom, panneaux des pages, fiche.
  - **Tests** : `unit_dispositions` (règle des couleurs, balisage des cartes) ; `test_app_boot` « rien ne sort de son cadre, et les cartes des dispositions sont les cartes par défaut » ; « le haut de page… » mesure désormais le bord bas du bandeau (devenu carte, avec une marge). `npm test` : 119 unitaires, 51 Playwright (1 ignoré, comme avant).
  - **Version** : `sports-guide-v55`.
- 2026-10-13 - **« Ajouter bouton pour changer look, proche de actualiser, ainsi qu'ajouter à cet endroit le mettre à jour l'app » ; « c'est weird » (capture : une seule colonne à gauche sur grand écran) ; « manque logos » ; « séparer guide et live pour pouvoir mix and match et mieux uniformiser les looks des 8 options ».**

  - **Fait.**
    - Groupe flottant `#fab-groupe` : Look (menu `#menu-look` : disposition du Live, du Guide, couleurs ; Échap / clic ailleurs), Mettre à jour l'app, Actualiser.
    - Live et Guide ont chacun leur disposition (`dispositionLive`, `dispositionGuide` ; `disposition` lu en repli puis migré) ; deux menus dans Options ; le sélecteur en page change la vue affichée.
    - Tableau : autant de colonnes que de groupes (trois au plus), bloc centré ; sélecteur et filtres centrés comme les onglets.
    - Affiches : les petites tuiles « Dans l'heure » portent les deux logos ; ligue sur une ligne.
    - Couche commune aux huit vues : rayons, une couleur d'action (l'accent), un indicateur de flux, une taille d'en-tête d'heure et de section, un rouge pour le direct.
  - **Tests** : `test_app_boot` « Live et Guide ont chacun leur disposition, et le bouton Look les change à côté d'Actualiser » ; tests existants passés aux deux menus. `npm test` : 118 unitaires, 51 Playwright (1 ignoré, comme avant).
  - **Fichiers** : `index.html`, `js/ui.js`, `js/main.js`, `js/multiview.js`, `js/dispositions.js`, `styles.css`, `sw.js`, `tests/test_app_boot.spec.js`, `tests/unit_dispositions.test.js`, `FEATURES.md`, `docs/ARCHITECTURE.md`.
  - **Version** : `sports-guide-v54`.
- 2026-10-13 - **« Ya moyen d'améliorer le ad block sur Chrome pour éviter que ça soit juste Firefox qui peut ? » — « Fait tout nécessaire, et clair dans le popup du début de comment setter ça ».**

  - **Constat.** Le guide envoyait Chrome vers uBlock Origin, qui ne s'y installe plus depuis le retrait de Manifest V2 : sur Chrome, aucune publicité n'était bloquée dans les tuiles. Tampermonkey n'y tourne d'ailleurs qu'avec « Autoriser les scripts utilisateur ». Le dépôt avait déjà la matière : les listes d'uBlock en hôtes (APK) et le script de nettoyage.
  - **Fait.**
    - `extension/` (Manifest V3, chargée « non empaquetée ») : blocage réseau de 99 113 hôtes en `declarativeNetRequest` ; le script de nettoyage dans tous les cadres, à `document_start`, seulement sous l'application ; `X-Frame-Options` et CSP retirés des cadres dans les seuls onglets de l'application ; le pont par le service worker (§7.4 bis).
    - `extension/construire.mjs` produit `nettoyeur.js` et `regles/blocage.json`, versionnés pour que le dossier se charge tel quel. La lecture des listes est sortie de `mobile/construire-blocage.mjs` vers `scripts/listes-blocage.mjs`, partagé (même résultat : 99 113 hôtes).
    - `js/installation.js` : le guide selon le navigateur et ce qui tourne déjà, et le zip de l'extension fabriqué dans le navigateur. La fenêtre du début ne s'ouvre plus si un nettoyeur tourne (extension, script, bureau, APK) ; elle revient une fois sur Chrome pour qui avait vu l'ancien guide (`hasSeenScriptModal` : « 2 »). Menu `🧩 Script` → `🛡️ Bloqueur de pub`.
    - Corrigé en chemin : le clic de programme du lien de téléchargement fermait la fenêtre (`isTrusted`).
  - **Tests** : `unit_extension` (14 : copie du script, versions, adresses, fichiers du zip, règles, zip relu octet par octet, navigateur, ouverture et contenu de la fenêtre, aucun lien vers uBlock pour Chrome) ; `test_extension.spec.js` (l'extension chargée dans Chromium : sans elle la tuile `DENY` reste vide et la régie passe ; avec elle la tuile s'affiche, la régie est bloquée, `window.open` aussi, le pont lit, un site hors de l'application n'est pas touché), passé trois fois de suite ; une suite dans `test_app_boot` (fenêtre du début sur Chrome, zip téléchargé, une seule fois, page Bloqueur de pub). Les suites posent désormais `hasSeenScriptModal = '2'`. Vérifié aussi à la main : la vraie application avec l'extension chargée détecte l'extension, n'ouvre pas la fenêtre, aucune exception.
  - **Fichiers** : `extension/*` (nouveau), `js/installation.js` (nouveau), `scripts/listes-blocage.mjs` (nouveau), `mobile/construire-blocage.mjs`, `js/multiview.js`, `js/main.js`, `index.html`, `styles.css`, `sw.js`, `desktop/package.json` (sert `extension/`), `package.json` (suite Playwright ajoutée à `npm test`), `tests/unit_extension.test.js`, `tests/test_extension.spec.js`, `tests/test_app_boot.spec.js`, `tests/test_rattrapage.spec.js`, `README.md`, `FEATURES.md`, `docs/ARCHITECTURE.md`.
  - **Version** : `sports-guide-v53` ; extension 1.0.
  - **Ce qui reste.** Pas essayé dans un vrai Chrome Windows (Chromium 141 ici). Les liens marqués `topLevel` restent classés comme non intégrables même avec l'extension, qui les rend pourtant affichables. Les règles de blocage ne se mettent pas à jour seules : `node extension/construire.mjs`, puis ↻ dans `chrome://extensions`. Le pont accepte toute page servie sous `localhost` / `127.0.0.1`, comme l'ancien script acceptait toute page qui imitait l'application.
- 2026-10-13 - **« Faut vraiment optimiser, t'as des tuiles que le contenu dépasse, le reste de l'interface suit pas style uniforme […] Possible de changer à même la page live ? »**

  - **Mesuré** (script jetable, vraies données, 4K / 1080p / tablette 820 / téléphone 390, quatre dispositions × Live et Guide) : tuiles des Affiches en couches absolues qui se chevauchaient sur tablette (« Dir… » sur « NCAA FOOTB… ») ; colonnes du Tableau à 2 sur tablette où « Regarder 57 » mangeait les noms ; libellés coupés dans les blocs courts de la grille des Chaînes ; étoile de favori hors cadre au téléphone.
  - **Fait.**
    - Sélecteur `.dsp-switch` en tête du Live et du Guide, « Actuelle » comprise (`barreDispositions`, `choisirDisposition`, `js/ui.js`) : enregistré, Options aligné, sans message « Préférences sauvegardées ».
    - Composants qui s'ajustent à leur propre largeur (container queries) : tuile des Affiches en colonne, tailles en `cqi` ; colonne étroite du Tableau sans le mot « Regarder » ; bloc court des Chaînes en abréviations (`.dsp-court` / `.dsp-long`, seuil en `em`) ; étoile hors de la zone tronquée.
    - Coquille au style des dispositions sous `body.dsp-on` (onglets en pilules, bandeau, Actualiser, message) ; `--u` posée sur `:root`.
  - **Tests** : `unit_dispositions` (abréviations, étoile) ; `test_app_boot` « le sélecteur de la page change la disposition, et rien ne sort de son cadre » (tablette 820 px, les huit vues, enregistrement, retour à « Actuelle »). `npm test` : 104 unitaires, 49 Playwright (1 ignoré, comme avant).
  - **Fichiers** : `js/dispositions.js`, `js/ui.js`, `styles.css`, `sw.js`, `js/multiview.js`, `tests/unit_dispositions.test.js`, `tests/test_app_boot.spec.js`, `FEATURES.md`, `docs/ARCHITECTURE.md`.
  - **Version** : `sports-guide-v53`.
  - **Ce qui reste** : la fiche de match et les pages Options / Logs gardent leur style ; « Actuelle » aussi, volontairement.
- 2026-10-13 - **« Ya moyen d'avoir le choix des différents layouts ? » — « Les 4, avec l'actuelle toujours comme default ».**

  - **Origine.** Quatre refontes du Live et du Guide maquettées avec l'utilisateur sur le programme réel du 13 octobre (artefacts) : Tableau, Maintenant, Affiches, Chaînes. Ses demandes en chemin, tenues partout : hiérarchie état → score → équipes → une action → ligue ; aucun titre ni sous-titre (« juste le ui ») ; pas de dégradé imposé ; texte qui s'adapte à l'écran (« 4k, 1080p, tablette, téléphone ») ; et dans le Guide, **jamais un match en cours avant l'heure actuelle** (« on dirait que c'est passé »).
  - **Fait.**
    - `js/dispositions.js`, sans import : rendu HTML des quatre dispositions à partir de fiches préparées ; `classerPourGuide` (en cours, à venir par heure, terminés repliés) ; la couleur suit « Couleur des cartes » (`fondEquipes`).
    - `js/ui.js` : `dispositionChoisie`, `ficheMatch` (un match qui n'est pas en cours et dont la fin prévue est passée compte comme terminé : hors ligne, les matchs de 12:45 restaient « à venir » à 20:40), `rendreAvecDisposition` (branché dans `buildEPGInner` après le filtrage), une écoute de clics sur `#marea`, `redessinerDisposition`.
    - `js/main.js` : avec une disposition, la mise à jour des scores redessine au lieu de chercher les cartes `mb-<id>`.
    - Options → **Disposition** (`index.html`, `js/multiview.js`), « Actuelle » par défaut. CSS en multiples de `--u` (§11 bis de `styles.css`).
  - **Tests** : `unit_dispositions` (défaut, ordre du Guide, rendu des huit vues sans titre, chaque match cliquable, grille des Chaînes qui commence maintenant, échappement, Options et précache) ; deux suites dans `test_app_boot` (les quatre dispositions sur les vraies données, une fiche qui s'ouvre, retour à « Actuelle » ; aucun débordement à 390 px), passées trois fois de suite (`--repeat-each 3`). `npm test` : 103/103 unitaires, 48 Playwright (1 ignoré, comme avant).
  - **Au passage** : `unit_lhjmq` tombait depuis le 13 octobre sur la branche principale aussi — `parseOnHockey` date ses lignes du jour réel et les matchs du test sont du 12. La date est fixée dans le test.
  - **Fichiers** : `js/dispositions.js` (nouveau), `js/ui.js`, `js/main.js`, `js/multiview.js`, `index.html`, `styles.css`, `sw.js`, `tests/unit_dispositions.test.js` (nouveau), `tests/test_app_boot.spec.js`, `tests/unit_lhjmq.test.js`, `FEATURES.md`, `docs/ARCHITECTURE.md`.
  - **Version** : `sports-guide-v52`.
  - **Ce qui reste** : la police Geist des maquettes n'est pas reprise (l'application n'a aucune police distante, hors ligne compris) ; le thème clair des maquettes non plus (l'application est sombre). Les dispositions ne montrent pas « Autres streams ».
- 2026-10-12 - **« Faire que les sites genre pandastream marchent à nouveau (liens) » / « le vidéo charge pas » « sur ces domaines ».**

  - **Constaté.**
    - Les liens Pandastream sont toujours ramassés : 3 ce soir, 49 samedi le 10 ; leur nombre suit le programme. La vérification les dit jouables (21 sur 26).
    - La chaîne : page pandastreamz.xyz → `pandastreams.shop/player/stream-NN.php` → `daddyliveplayer.st` (canal DaddyLive) → manifeste `edge.cowedd4855ws.sbs/premiumNN/index.m3u8`. Le manifeste répond 200, avec ou sans Referer.
    - Ses segments sont des PNG du CDN de TikTok. La vidéo est dans les pixels : `TIKTIKPX` + longueur + gzip d'un MPEG-TS (H.264 854 × 480 + AAC, vérifié avec ffprobe).
    - Sur les flux directs du cache : 15 des 31 manifestes joignables (tous chez `edge.cowedd4855ws.sbs`) servent ces images, les autres du TS ordinaire.
    - Le lecteur natif (ExoPlayer, APK et appli TV) reçoit une image et ne démarre jamais.
    - Dans un navigateur, le manifeste refuse toute origine sauf `daddyliveplayer.st` (403) : là, la tuile joue la page. Le correctif côté hls.js a été écrit puis retiré : il ne servait à rien pour ces domaines.
    - Aucun hôte de la chaîne n'est dans la liste de blocage de l'APK (99 113 hôtes, reconstruite pour vérifier).
  - **Fait.**
    - `SegmentImage` (Java pur : PNG, zlib, filtres de ligne, `TIKTIKPX`, gzip).
    - `DataSourceDeballante` : reconnaît un PNG à ses huit premiers octets, le reste passe tel quel. Branché dans `LecteurActivity` (APK) et `MainActivity` (`tv/`).
  - **Vérifié.** Sur un vrai segment, le déballage Java donne exactement le flux du décodage de référence (2 000 320 octets, 53 ms).
  - **Tests** : `SegmentImageTest` (JVM, 4 tests, dans les deux projets) ; `unit_segmentimage` (copies identiques, branchement).
  - **Fichiers** : `mobile/android/app/src/main/java/ca/local/footy/{SegmentImage,DataSourceDeballante,LecteurActivity}.java`, `tv/app/src/main/java/ca/local/footytv/{SegmentImage,DataSourceDeballante,MainActivity}.java`, les deux `SegmentImageTest.java`, `tests/unit_segmentimage.test.js`, `docs/ARCHITECTURE.md`.
  - **Ce qui reste.** Pas essayé sur un vrai appareil : il faut refabriquer et réinstaller l'APK (et l'appli TV). Aucun fichier du web n'a changé : la version de l'appli reste `sports-guide-v51`.
- 2026-10-12 - **« D'autres sites à corriger ? »** Relevé sur le passage de 21 h 16 : quatre sources en échec — onhockey (corrigé ci-dessous), flexfitness, fbstream, watchfooty.

  - **flexfitness** : « HTTP 451 », en échec sur tous les passages relus depuis le 9 octobre. Le site répond « Unavailable For Legal Reasons » à tout le monde, Jina compris (Cloudflare « error code: 1026 » en direct). Coupé : `domains.json` → `SOURCES.flexfitness.enabled = false`.
  - **watchfooty** : « fetch failed » depuis le 11 octobre. Aucun domaine du réseau ne se résout plus (api.watchfooty.st, watchfooty.st, watchfty.st, wfty.link — vérifié aussi par Jina). sportsbite.org, qui lisait son API, lit désormais `api.ppv.st`, déjà la source `ppv`. Coupé : `SOURCES.watchfooty.enabled = false`.
  - **fbstream** : un passage sur deux, « fetch failed » en moins d'une seconde dès l'accueil, et la source tombe (ses matchs sont seulement conservés du passage précédent). 13 pages par sport + 44 pages de match sur un bon passage. Jina le lit en HTML : mêmes 64 matchs (/stream/football), 43 (/stream/hockey), mêmes 3 lecteurs sur une page de match. Ajouté au relais (`js/relais.js`, HTML) ; `parRelais` (`scripts/scrape_streams.mjs`) relaie aussi les erreurs réseau ; `r.jina.ai` espacé de 3,1 s (20 requêtes/min sans clé) ; la cause d'une erreur réseau figure dans le message.
  - **Tests** : `unit_relais` groupe 3 bis ; scraper complet avec fbstream coupé (ECONNRESET) et OnHockey en 403 : 41 pages relayées, aucun échec, fbstream 176 matchs, OnHockey 17, en 175 s. `npm run test:unit` : 91/91.
  - **Version** : `sports-guide-v51`.
  - **Ce qui reste** : la cause exacte des coupures de fbstream (le prochain journal la dira). mlbbite (2 matchs) et crichd (2) livrent peu mais livrent : hors saison plutôt que panne.
- 2026-10-12 - **« Réparer onhockey.tv et mettre LHJMQ dans le guide »**

  - **Constaté, OnHockey.**
    - Chaque passage du cache porte « https://onhockey.tv/ -> direct: HTTP 403 » et zéro match, du plus ancien relu (9 septembre) au dernier.
    - Ce n'est ni l'agent ni le Referer : la même requête Node, mêmes en-têtes, rend 200 depuis ce conteneur. C'est Cloudflare qui refuse les machines de GitHub Actions.
    - Dans le navigateur, l'accès direct est fermé par CORS. Jina sans Referer ne reçoit de `schedule_table.php` que « You are not allowed to access this page directly ».
    - Jina accepte `X-Referer` (permis au pré-vol CORS). En HTML il ne rend que le premier `<script>` du fragment (948 octets sur 15 Ko), mais en Markdown la grille est entière.
  - **Fait, OnHockey.**
    - `js/relais.js` : `relaisPour` (Markdown, `X-Referer` du site) et `grilleOnHockeyDepuisMarkdown`, qui remet la grille dans la forme que lit `parseOnHockey`.
    - Branché dans `fetchPage` : le transport Jina s'adapte à la page (`adapterJina`, js/fetcher.js).
    - Branché dans le `fetch` de `scripts/scrape_streams.mjs`, seulement après un 403 direct (`parRelais`, compté dans `fetch.relais`).
  - **Constaté, LHJMQ.**
    - ESPN ne l'a pas. HockeyTech publie le tableau des matchs (`view=scorebar`, clé publique de chl.ca) avec pointage et période en direct ; CORS limité à chl.ca.
    - Deux équipes manquaient à la base (Val-d'Or, Newfoundland Regiment) et « Saint John » n'était pas un alias des Sea Dogs.
    - `sportOfTeamName` ne rangeait pas la ligue `lhjmq` au hockey : le garde-fou de sport refusait donc toute équipe de la LHJMQ lue par OnHockey (« Drummondville » restait « Drummondville »).
  - **Fait, LHJMQ.**
    - `js/lhjmq.js` (sans import) : `urlScorebarLhjmq`, `lireScorebarLhjmq`. Lu par `js/api.js` (via `fetchPage`, donc le pont ou Jina) et par `scripts/scrape_schedule.mjs` (direct).
    - Ajoutés à la base : Val-d'Or, Newfoundland et l'alias « Saint John » (`js/teams.js`). `lhjmq|qmjhl` est rangé au hockey dans `sportOfTeamName` (`js/db.js`).
  - **Vérifié.**
    - Scraper complet avec onhockey.tv forcé en 403 : la source passe par Jina, 24 matchs, `ok: true`.
    - Grille par Jina et grille directe : mêmes 24 matchs, mêmes lecteurs.
    - `scrape_schedule.mjs` : 6 matchs LHJMQ, dont 5 en direct avec leur pointage. Les 5 lignes LHJMQ d'OnHockey s'apparient chacune au bon match. Les fichiers de données régénérés pour ces essais ont été remis.
  - **Tests** : `unit_relais` (4 groupes, extrait réel du Markdown de Jina et de la page) ; `unit_lhjmq` (4 groupes, extrait réel du flux). `npm run test:unit` : 91 fichiers ; Playwright 46 réussis, 1 ignoré (avec le Chromium du conteneur).
  - **Fichiers** : `js/relais.js`, `js/lhjmq.js`, `js/fetcher.js`, `js/utils.js`, `js/api.js`, `js/db.js`, `js/teams.js`, `scripts/scrape_streams.mjs`, `scripts/scrape_schedule.mjs`, `tests/unit_relais.test.js`, `tests/unit_lhjmq.test.js`, `docs/ARCHITECTURE.md`, `sw.js` (+ `APP_SHELL`) et `VERSION_APP` → `sports-guide-v50`.
  - **Ce qui reste.**
    - Le relais n'a pas tourné depuis un runner GitHub : le prochain passage du workflow le dira (« relais Jina » dans le journal, `fetch.relais` dans `data/streams.json`). Jina se limite à 20 requêtes par minute sans clé ; le passage en fait deux ou trois.
    - Les scores LHJMQ se rafraîchissent à chaque passe complète du guide, pas chaque minute comme ESPN (`rafraichirScoresEnDirect` ne relit que les chemins ESPN).
    - Pas de fiche ESPN (alignements, stats) pour ces matchs.
- 2026-10-10 - **« Garder l'image avec positions de ESPN ? »** puis **« go pour le terrain, du moins qqchose de similaire, remplace titulaires oui »**. ESPN n'envoie pas d'image : son terrain est dessiné à partir de la formation, de `formationPlace` et du poste. `formationPlace` change de sens d'une formation à l'autre (4-2-3-1 d'Arsenal : 4 et 8 au milieu défensif ; 3-4-2-1 de Leeds : 2 et 3 sur les côtés) ; on place donc par le poste (profondeur et côté), découpé selon la formation. Vérifié sur les 28 compositions des matchs du jour (EPL, Liga, Serie A, Bundesliga, Ligue 1, MLS : 4-2-3-1, 3-4-2-1, 4-3-3, 3-5-2, 3-5-1-1) : toutes placées comme sur ESPN après avoir rangé `RCF` avec les attaquants. Fichiers : `js/alignements.js` (`rangeesTerrain`, terrain dans `alignementsHtml`), `styles.css`, `tests/unit_alignements.test.js` (groupe 7), `FEATURES.md`, `docs/ARCHITECTURE.md`. Même PR (#600), `sports-guide-v49` pas encore publié. Ce qui reste : un poste qu'ESPN n'a pas encore employé tombe au milieu par défaut.
- 2026-10-10 - **« Je veux plus des données de ESPN, genre les alignements »**, puis **« à tout le moins, des lignes avec les noms, depth chart pour hockey, etc. »**

  - **Constaté.** La fiche recevait déjà le `summary` ESPN complet et n'en tirait que les buteurs et le classement. Il porte, selon le sport : `rosters[]` (football : formation, titulaires, remplaçants, buts/cartons/changements par joueur ; MLB : ordre des frappeurs) et `boxscore.players[]` (LNH, NFL, MLB, basket : feuille par groupe). Avant le match, ni l'un ni l'autre. **ESPN n'a pas les trios ni les paires du hockey** : `/teams/{id}/depthcharts` est vide pour la LNH (rempli pour la NFL), l'API core n'a que le roster du match sans ligne, et la feuille range les attaquants par ordre alphabétique.
  - **Fait.** `js/alignements.js` (sans import) : `extraireAlignements` (composition, sinon feuille), `extraireEffectifs` (les `/roster` que la fiche lisait déjà pour les stats de saison, rangés par position, blessés marqués), `alignementsHtml` (un onglet par équipe). `afficherAlignements` (`js/ui.js`) les pose dans la fiche, garde l'onglet au rafraîchissement, et l'effectif ne remplace jamais un alignement. Aucune requête ESPN de plus.
  - **Tests** : `unit_alignements` (7 groupes, formes reprises de vrais résumés EPL, LNH, MLB du 4 au 10 octobre). Rendu vérifié dans l'appli (bureau et 390 px). `npm test` : unitaires et Playwright verts (Playwright lancé avec le Chromium du conteneur, la version attendue par le dépôt n'y étant pas installée).
  - **Fichiers** : `js/alignements.js`, `js/ui.js`, `styles.css`, `tests/unit_alignements.test.js`, `FEATURES.md`, `docs/ARCHITECTURE.md`, `sw.js` (+ `APP_SHELL`) et `VERSION_APP` → `sports-guide-v49`.
  - **Ce qui reste.** Les vrais trios et paires du hockey demanderaient une autre source que ESPN (DailyFaceoff, par exemple) : à décider. Le tableau de profondeur NFL (`/depthcharts`) existe et pourrait s'ajouter. La fiche n'est relue qu'en direct : ouverte avant la publication des compositions, elle garde l'effectif jusqu'à sa réouverture.
- 2026-10-10 - **« J'ai testé et aucune vidéo ne semble partir, mais au moins pas de pub ni de redirections. »**

  - **Cherché.**
    - Simulation de l'APK dans Chromium sur 12 lecteurs vérifiés « joue » : même liste de blocage, script posé dans tous les cadres, origine `https://localhost`, agent mobile.
    - Résultat : 3 sur 12, **exactement les mêmes** que sans bloqueur ni script, et avec l'agent de bureau. Le bloqueur et le script ne cassent donc rien ; le conteneur passe mal la vidéo et ne reproduit pas l'appareil.
    - La liste ne contient aucun des 25 hôtes de lecteur ni des 17 CDN qui jouent.
  - **Corrigé** : ce que la WebView refuse et que Chrome permet. Cookies tiers acceptés (chaque lecteur est un site tiers pour l'application) et contenu mixte permis.
  - **Ajouté** : un journal de l'appareil, en tête de Plus → Logs (`Journal`, `diagnostic`, `diagnosticAndroidHtml`). Il donne la WebView, le script, le bloqueur, les hôtes bloqués, les navigations refusées, les pages et flux en erreur, et les essais du lecteur natif.
  - **Tests** : `unit_tele` groupes 7 et 8 ; `test_app_boot` « télé Android » lit le bloc Android de la page Logs (répété 3 fois) ; JVM `JournalTest` (2).
  - **Fichiers** : `mobile/capacitor.config.json`, `mobile/android/app/build.gradle`, `mobile/android/app/src/main/java/ca/local/footy/{Journal,MainActivity,BloqueurWebViewClient,NettoyeurLecteurs,LecteurActivity,LecteurNatifPlugin}.java`, `mobile/android/app/src/test/java/ca/local/footy/JournalTest.java`, `js/tele.js`, `js/multiview.js`, tests, `docs/ARCHITECTURE.md`, `sw.js` + `VERSION_APP` → `sports-guide-v48` (v47 était pris par la PR LoL, fusionnée entre-temps).
  - **Ce qui reste** : la cause sur l'appareil n'est pas établie. Le journal de Plus → Logs doit la montrer.
- 2026-10-10 - **« Juste lcs, lec, lpl, lck, msi et worlds genre. »** Suite de l'entrée LoL ci-dessous : `LIGUES_LOL` (`js/esports.js`) réduite à ces six slugs ; CBLOL, LCP, LTA, First Stand, VCS, PCS, LJL, LLA et EWC retirés. Le test `unit_esports` (groupe 6) fige la liste exacte. Fichiers : `js/esports.js`, `tests/unit_esports.test.js`, `docs/ARCHITECTURE.md`, `sw.js` + `VERSION_APP` → `sports-guide-v47`. Ce qui reste : rien ; la finale du CBLOL de ce soir ne sera donc plus affichée, les Mondiaux le seront dès le 15 octobre.
- 2026-10-10 - **« C'est moi ou League of Legends est présentement brisé dans footy ? »** Oui.

  - **Constaté.** L'API (`getSchedule`, `getLive`) répondait normalement : 200, et ce jour-là la finale du CBLOL (FURIA – LOS), l'EMEA Masters, la promotion LCS, la Demacia Cup, puis les Mondiaux à partir du 15 octobre. Mais aucun match `lol_` dans `data/schedule.json` ni dans l'appli. Cause : la liste de ligues suivies, recopiée dans `js/api.js` et `scripts/scrape_schedule.mjs`, portait des slugs qui n'existent pas dans `getLeagues` : `world_championship` (vrai : `worlds`), `cblol` (`cblol-brazil`), `ljl` (`ljl-japan`). Et la LCP, First Stand et les LTA n'y étaient pas. En pleine intersaison des ligues régulières, il ne restait donc rien, et les Mondiaux auraient été écartés aussi.

  - **Fait.** Une seule liste, `LIGUES_LOL` + `estLigueLolSuivie` dans `js/esports.js` (module sans import), utilisée par l'appli et le script serveur. Sur les données du jour : 25 matchs à venir retenus (CBLOL, VCS, Mondiaux).

  - **Tests** : `unit_esports`, groupe 6 (slugs réels acceptés, anciens refusés). `npm test` : 86 fichiers unitaires, Playwright 45 réussis, 1 ignoré.

  - **Fichiers** : `js/esports.js`, `js/api.js`, `scripts/scrape_schedule.mjs`, `tests/unit_esports.test.js`, `docs/ARCHITECTURE.md`, `sw.js` + `VERSION_APP` → `sports-guide-v46`.

  - **Ce qui reste.** `data/schedule.json` ne contiendra les matchs LoL qu'au prochain passage du workflow quotidien (l'appli, elle, interroge l'API directement). L'EMEA Masters, les promotions LCS/CBLOL et la Demacia Cup restent hors liste : à ajouter si voulu (leur nom n'a pas non plus de drapeau 🎮 dans `lgFlag`).
- 2026-10-10 - **« Mode chromecast, intégrer le script tampermonkey (ses fonctionnalités) dans l'APK ainsi que façon de bloquer les pubs. »**

  - **Constaté.**
    - Sur Android, rien ne tournait dans les lecteurs, faute de Tampermonkey : ni blocage des fenêtres surgissantes, ni lecture sans clic, ni son par tuile, ni pont.
    - Pire, Capacitor ouvrait dans le navigateur du système toute adresse étrangère vers laquelle un lecteur emmenait la fenêtre (`Bridge.launchIntent`). Sur un Chromecast, l'application disparaissait derrière la pub.
  - **Fait.**
    - `NettoyeurLecteurs` assemble `mobile/injection-userscript.js` (gabarit + `GM_xmlhttpRequest`) et `multiview-cleaner.user.js`. Le tout est posé par `addDocumentStartJavaScript` dans tous les cadres, avant leurs scripts, et dans la fenêtre principale à `onPageFinished` pour le premier document ; une seule exécution par document.
    - `GardeNavigation` : la fenêtre principale ne quitte plus l'application, un cadre ne lance plus d'autre application. La liste de ≈ 99 000 hôtes reste.
  - **Tests** : `unit_injectionapk` (4 groupes : assemblage valide, pont qui s'annonce et lit une page par le gabarit, une seule exécution — il tombe sans la garde —, fichiers emportés) ; JVM `GardeNavigationTest` (3). APK refabriqué : il contient le gabarit, le script et la liste.
  - **Fichiers** : `mobile/injection-userscript.js`, `mobile/assembler-www.mjs`, `mobile/android/app/build.gradle` (`androidx.webkit`), `mobile/android/app/src/main/java/ca/local/footy/{NettoyeurLecteurs,GardeNavigation,BloqueurWebViewClient,MainActivity}.java`, `mobile/android/app/src/test/java/ca/local/footy/GardeNavigationTest.java`, `tests/unit_injectionapk.test.js`, `README.md`, `docs/ARCHITECTURE.md`.
  - **Ce qui reste.**
    - Pas essayé sur un vrai appareil.
    - « Ouvrir sur le site » ne peut plus quitter l'application dans l'APK : le verrou ne distingue pas un geste de l'utilisateur d'une régie.
    - Dans les iframes, `GM_xmlhttpRequest` n'est qu'un `fetch` soumis à l'origine croisée : seul le pont de la fenêtre principale lit sans restriction.
- 2026-10-10 - **« Garder le concept actuel de l'app, juste adapter à CCGTV »** (l'app = Guide des Sports), après « même un navigateur comme Vivaldi est hyper lent sur Chromecast ».

  - **Fait** (APK de `mobile/`, donc la même application) :
    - lanceur Google TV : `LEANBACK_LAUNCHER`, bannière, écran tactile facultatif ;
    - télé signalée à l'application (`onPageFinished`). Les modes TV et câble s'allument à la première ouverture, jamais par-dessus un choix (`js/tele.js`, `activerTeleAndroid`) ;
    - touche Retour : menu, fiche, menu Plus, Live, puis quitter (`retourTele`, `MainActivity`) ;
    - **lecteur natif** pour les flux directs (`LecteurNatifPlugin`, `LecteurActivity`, ExoPlayer) à la place de hls.js dans la WebView, avec les `Referer` dans l'ordre mesuré. L'application garde la main : ▲▼ zappe, ◀▶ change de source, un échec ramène la tuile à la page.
  - **Corrigé au passage** : en mode câble, la première vidéo ignorait le flux direct connu (elle ne passait pas par `poserLienSurTuile`).
  - **Tests** : `unit_tele` (6 groupes) ; `test_app_boot` « sur la télé Android… », avec un faux plugin Capacitor, répété 3 fois. `npm run test:unit` : 87 fichiers ; Playwright : 46 réussis, 1 ignoré. APK fabriqué (8,5 Mo), signé, et vu par `aapt2` comme lançable sur Google TV.
  - **Fichiers** : `js/tele.js`, `js/main.js`, `js/multiview.js`, `js/directmedia.js`, `styles.css`, `mobile/android/app/{build.gradle,src/main/AndroidManifest.xml}`, `mobile/android/app/src/main/java/ca/local/footy/{MainActivity,BloqueurWebViewClient,LecteurNatifPlugin,LecteurActivity}.java`, `res/drawable/banniere_tele.xml`, `res/values/styles.xml`, `tests/unit_tele.test.js`, `tests/test_app_boot.spec.js`, `FEATURES.md`, `README.md`, `docs/ARCHITECTURE.md`, `sw.js` + `VERSION_APP` → `sports-guide-v45`.
  - **Ce qui reste.**
    - Pas essayé sur un vrai Chromecast ni sur un vrai téléphone (pas d'émulateur ici).
    - Les tuiles en mode page restent des pages web : lourdes sur le Chromecast. Le mode câble n'en garde qu'une.
    - L'APK envoyé est signé avec une clé de débogage : désinstaller la version signée par `fabriquer-apk.ps1` avant de l'installer (favoris et réglages perdus), ou le refabriquer avec ce script.
    - `tv/` (Footy TV) reste dans le dépôt, sans usage décidé.
- 2026-10-10 - **« Mon rêve, c'est une version qui peut marcher sur Chromecast, sans les pubs, en prenant le moins de ressources possible. »** Appareil : Chromecast avec Google TV. Pas de relais Cloudflare (« j'ai pas de compte et j'en veux pas »).

  - **Constaté.** Le serveur connaissait déjà le manifeste nu de 110 liens (41 matchs en cours). Sans le bon `Referer`, la plupart des CDN répondent 403 (dlive.sx : 403 sans, 200 avec). Le bon `Referer` est le cadre IMBRIQUÉ du lecteur : sur instreams.pro, 200 avec xstream.st, 200 sans rien, 403 avec la page du lien. Un Chromecast « casté » ne peut pas poser cet en-tête ; une appli native, si.

  - **Fait.**
    - `verify_players.mjs` relève le `Referer` de la requête du manifeste (`mediaReferer`), reporté d'un passage à l'autre (`reporterVerifications`, `scrape_streams.mjs`). Il écrit `data/tv.json` (`js/tvliste.js`) : 54 matchs, 36 Ko, au lieu des 2,6 Mo de `streams.json`. Ce fichier est publié par le workflow et par `npm run liens`.
    - **`tv/`, l'appli Android TV** : Java, une activité, ExoPlayer, sans WebView ni AppCompat. APK de 511 Ko. Passage automatique au flux suivant après 15 s ou une erreur, lecteur détruit en arrière-plan, tampons courts.
    - **Mode câble** (« même Vivaldi est hyper lent sur Chromecast — ça pourrait être un mode câble avec onglet live en supplément ? », version 1.1). À l'ouverture, une vidéo joue déjà : le dernier match regardé (`Liste.matchDeDepart`), sinon le premier en direct. L'onglet Live se pose sur la moitié gauche et la vidéo continue. Un match muet fait zapper au suivant. Le match regardé garde sa place quand la liste est relue (`Liste.cle`).
    - **Téléphone** (« faire version téléphone Android que je teste sans le Chromecast ») : la même APK, avec des gestes (glisser ↔ flux, ↕ match, toucher : bandeau et bouton « ☰ Live »), en paysage selon le capteur.

  - **Tests** : `unit_tvliste` (5 groupes), tests JVM `tv/app/src/test` (6). `npm run test:unit` : 86 fichiers. Playwright : 45 réussis, 1 ignoré.

  - **Fichiers** : `js/tvliste.js`, `js/playability.js`, `scripts/verify_players.mjs`, `scripts/scrape_streams.mjs`, `scripts/maj_liens.mjs`, `.github/workflows/scrape_streams.yml`, `data/tv.json` (produit par `listeTv`), `tv/`, `tests/unit_tvliste.test.js`, `.gitignore`, `docs/ARCHITECTURE.md`, `README.md`, `sw.js` + `VERSION_APP` → `sports-guide-v44`.

  - **Ce qui reste.**
    - Pas essayé sur un vrai Chromecast ni sur un vrai téléphone : pas d'émulateur dans ce conteneur (pas de KVM).
    - Le `Referer` n'apparaîtra dans `tv.json` qu'après le premier passage de vérification sur `main`. D'ici là, l'appli essaie sans Referer, puis avec la page.
    - Un jeton lié à l'IP du serveur ne passera pas à la maison.
    - L'APK est signé avec une clé de débogage : une version fabriquée ailleurs demande de désinstaller la précédente.
- 2026-10-10 - **« J'aime, mais les menus, surtout sur mobile, c'est pas super affordant et efficace. »**

  - **Constaté** (captures à 390 px, tactile).
    - Le menu ⋯ était un menu déroulant de bureau posé sur les vidéos : 11 entrées, des libellés sur deux lignes (« Mode câble (une seule vidéo, zapping au doigt) »), aucun regroupement.
    - Il se refermait dès qu'on faisait défiler sa liste : l'écouteur `scroll`, en capture, ne distinguait pas le menu lui-même. Il se refermait aussi quand la barre d'adresse se repliait (`resize`).
    - La barre du lecteur n'avait que des icônes (⊞ ⛶ ⋯).
    - La barre s'effaçait au repos. Le premier appui sur « Plus » ne faisait que la réveiller (vu dans Playwright : le conteneur interceptait l'appui), alors qu'elle a sa propre bande et que l'effacer ne rendait aucune place.
    - L'en-tête des tuiles passait sur deux rangées et couvrait davantage la vidéo.

  - **Correctifs.**
    - **Feuille sur téléphone** (`enFeuille`, `js/mv-menu.js`) : pleine largeur, collée au bas, avec voile, poignée, titre et croix, et des cibles de 54 px. Le voile se ferme à son `click` (au `pointerdown`, l'appui retombait sur la vidéo d'en dessous). Le défilement interne et le `resize` ne ferment plus rien. Sur ordinateur, un défilement DANS le menu ne le ferme plus non plus.
    - **Contenu des menus** (`ouvrirMenuBarre`, `ouvrirMenuTuile`, `ouvrirMenuDisposition`) : sections, libellés courts et ligne `detail` qui dit ce que fait l'entrée. En portrait, « Monter / Descendre » au lieu de « gauche / droite ». Le menu Disposition dit que les vidéos s'empilent en portrait.
    - **Barre** : un libellé court sous chaque icône sur téléphone, et elle n'est plus effacée au repos.
    - **En-tête de tuile** : une seule rangée sous 520 px. Le bouton de cadrage passe dans le menu ⋮ (« Cadrage de l'image »).

  - **Tests** : `test_app_boot` « sur téléphone, les menus du lecteur sont une feuille… », répété 3 fois. Il vérifie la géométrie, les sections et les explications, que défiler ne ferme pas, que le voile ferme sans rien toucher derrière, qu'une entrée agit, la croix, et la barre visible au repos. `unit_lecteurfluide`, groupe 4 : le repos efface les en-têtes, jamais la barre.

  - **Fichiers** : `js/mv-menu.js`, `js/multiview.js`, `styles.css`, `tests/test_app_boot.spec.js`, `tests/unit_lecteurfluide.test.js`, `FEATURES.md`, `docs/ARCHITECTURE.md`, `sw.js` + `VERSION_APP` → `sports-guide-v43`.

  - **Ce qui reste.** Pas essayé sur un vrai téléphone : les captures viennent de Chromium en mode mobile.
- 2026-10-09 - **« Je vois que l'app se fait maintenant plus facilement redirect vers l'un des sites, ce que je veux vraiment pas » — « olympics streamsme la fait entre autres, sur firefox ».**

  - **Cause.** Les tuiles n'ont pas de `sandbox` (exigence de l'utilisateur). Toute page encadrée peut donc faire `top.location = …`, et Firefox n'a pas l'intervention de Chrome qui exige un geste dans le cadre. Les sources ajoutées ce jour (olympicweb, fbstream, totalsportek…) chargent des pages complètes de sites, pleines de régies. Seul le script utilisateur retenait l'onglet, et la sortie forcée n'agit qu'après coup.

  - **Essayé dans Chromium**, avec un vrai clic dans le faux lecteur hostile d'une autre origine. Sans rien, l'onglet part. Avec l'API Navigation (`navigate`), l'événement ne vient même pas. Avec `beforeunload`, le dialogue « Quitter le site ? » s'affiche, et le refuser garde l'app, même si le seul geste était le clic dans le cadre.

  - **Correctif.** Une garde `beforeunload` (`gardeSortieArmee`, `js/multiview.js`). Elle est armée dès qu'une vidéo est chargée et levée 5 s pour les navigations voulues par l'app (`autoriserSortie` : mise à jour, installation du script). Réglage `garde_sortie`, allumé par défaut : `⋯ Plus → 🛡 Bloquer les redirections des sites`.

  - **Tests** : `test_app_boot` « un lecteur qui tente de détourner l'onglet… », en différentiel : garde armée, dialogue et l'app reste ; garde coupée, l'onglet est emporté. Répété 3 fois. `unit_lecteurfluide`, groupe 6.

  - **Fichiers** : `js/multiview.js`, `tests/test_app_boot.spec.js`, `tests/unit_lecteurfluide.test.js`, `FEATURES.md`, `docs/ARCHITECTURE.md`, `sw.js` + `VERSION_APP` → `sports-guide-v42`.

  - **Ce qui reste.** Pas de Firefox dans ce conteneur : la garde n'y a pas été essayée. Firefox exige un geste préalable dans la page avant de montrer le dialogue ; ouvrir le lecteur en est un. Quitter ou recharger l'onglet soi-même, vidéos chargées, demande désormais une confirmation.
- 2026-10-09 - **« Le multiview est vraiment cool, mais les emplacements des boutons, le fait que ça cache les menus et les lags de chargement font que c'est pas toujours évident. Corriger et améliorer sans perdre les fonctionnalités »**, puis **« le multiview dans l'écran des matchs live et guide, je veux plus ça »**.

  - **Constaté dans Chromium** (captures à 1440 et 390 px, avant/après). La fenêtre flottante, sur téléphone, faisait 400 px de large pour un écran de 390 et couvrait la barre d'onglets du bas (Live / Guide / Lecteur / Plus). Sa barre restait vide : le repos l'avait effacée juste avant, et rien ne la rendait au changement de mode. Aucune tuile ne disait quel match elle montrait (seulement « localhost » ou « source 1/3 »). Le bouton « Actualiser » se posait sur la vidéo en bas à droite. Au démarrage, la séance restaurée chargeait jusqu'à quatre pages de diffusion 500 ms après l'ouverture, lecteur fermé, derrière le guide.

  - **Plus de lecteur réduit.** Quitter l'onglet Lecteur le masque (`toggleMultiviewPip`). Les tuiles restent chargées et le son continue ; l'onglet Lecteur, souligné, les rend sans rechargement. Retirés : colonne, fenêtre flottante, barre dans un coin, leurs boutons (➖, ⤢ Agrandir), leurs entrées du menu ⋯, leur glisser, leurs observateurs, et leurs clés `multiviewPipMode`, `multiviewPipPrevMode`, `multiviewFloatingRect`, `multiviewMinimizedRect` (laissées en place, désormais ignorées). La fenêtre détachée reste pour regarder ailleurs.

  - **Commandes.** Le repos ne les efface plus sous un menu ouvert (`menuEstOuvert`, `js/mv-menu.js`) ni sous le pointeur posé sur la barre. Elles reviennent quand le lecteur repasse au premier plan (`reveillerCommandes`) et quand le pointeur entre dans une tuile. En-tête de tuile : nom du match, avec la source dessous ; ajustement réduit à son icône ; croix écartée du menu ⋮. « Actualiser » masqué dans le lecteur.

  - **Chargement.** Aucune tuile n'est posée tant que le lecteur n'a jamais été montré (`lecteurJamaisMontre`). Les tuiles créées ensemble partent à 450 ms d'écart (`ECART_CHARGEMENT_MS`). Chacune affiche « Chargement de … » au centre, sans prendre les clics, jusqu'au `load` du cadre, au premier signal « joue » ou au bout de 15 s.

  - **Vérifié dans Chromium** : avec une séance de trois tuiles enregistrée, aucune iframe ni requête vers les lecteurs avant l'ouverture. Après l'ouverture : 1 cadre à 300 ms, 3 à 1,8 s, et plus aucun indicateur une fois les pages chargées.

  - **Tests** : `unit_lecteurfluide` (nouveau, 5 groupes ; il tombe sur l'ancien code au premier groupe). `unit_lecteurinteractions`, groupe 2 réécrit : quitter masque, un redimensionnement ne fait rien revenir, le menu ⋯ ne propose plus de réduire. `unit_deuxecrans` attend la dernière tuile échelonnée. `npm run test:unit` : 82 fichiers. Playwright : 43 réussis, 1 ignoré, lancés avec le Chromium préinstallé (`executablePath`).

  - **Fichiers** : `js/multiview.js`, `js/mv-menu.js`, `styles.css`, `tests/unit_lecteurfluide.test.js`, `tests/unit_lecteurinteractions.test.js`, `tests/unit_deuxecrans.test.js`, `FEATURES.md`, `README.md`, `docs/ARCHITECTURE.md`, `sw.js` + `VERSION_APP` → `sports-guide-v41`.

  - **Ce qui reste.** Une page encadrée garde ses mouvements de souris pour elle : en survolant longtemps une vidéo sans en sortir, les commandes s'effacent au bout de 3 s. Un geste au-dessus de la barre ou une nouvelle entrée dans la tuile les rappelle. Le son des vidéos continue lecteur masqué : à revoir si l'utilisateur préfère le couper.
- 2026-10-09 - **« Tu peux utiliser la réputation des sites pour classer l'ordre d'apparition des streams ? »**

  - **Avant.** Les liens étaient rangés en cinq paliers d'observation, puis par qualité annoncée. Dans le palier « inconnu », un hôte jamais testé, un hôte à une lecture sur quatre et un lien d'un agrégateur qui ne joue jamais étaient à égalité.

  - **Maintenant.** `reputationLien` (`js/playability.js`) départage, à l'intérieur d'un palier et avant la qualité annoncée :
    - d'abord le taux de lecture lissé de l'hôte ;
    - à défaut, celui de la source qui a fourni le lien ;
    - à défaut, un tiers.

  - **Registre par source.** `sourcePlay` est tenu par la vérification, reporté par le scrape, et amorcé depuis le registre des hôtes (`reputationParSource`). Le navigateur ajoute ses propres observations dans `play_ledger_sources`.

  - **Sur les données du jour.** En tête : daddylive 20/20, bintv 19/20, cdnlivetv 9/10, freestreams 16/23, footybite 541/995. En queue : methstreams 0/40, mlbbite 0/29, vipleague 0/24, streameast 0/23.

  - **Tests** : `unit_playability`, groupes 8 et 9.

  - **Fichiers** : `js/playability.js`, `js/config.js`, `js/main.js`, `scripts/verify_players.mjs`, `scripts/scrape_streams.mjs`, `tests/unit_playability.test.js`, `docs/ARCHITECTURE.md`, `sw.js` + `VERSION_APP` → `sports-guide-v41`.

- 2026-10-09 - **« Le but de cette discussion, c'est intégrer toutes les sources de façon fonctionnelle. » — « Si c'est possible de faire que la mise à jour des liens se fasse plus rapidement… et de pouvoir le faire manuellement si GitHub chie. »**

  - **Enquête par site.** Cinq agents ont relevé, pour chaque domaine restant de la liste, où vit la grille et comment s'obtiennent les lecteurs. Le détail est dans `docs/ARCHITECTURE.md` §6.2.

  - **Onze sources de plus**, vingt-six en tout. Chacune a été vérifiée avec `npm run sonder` puis par un passage complet du script serveur.
    - cdnlivetv (l'API derrière streamsports99) ;
    - bintv (son API, sans heure) ;
    - watchfooty (l'API de sportsbite) ;
    - olympicweb et fbstream (moteur VIPLeague, boutons `data-uri`) ;
    - totalsportek (relais `totview` déballé ; `ww1.sportsurge.st` en est un miroir) ;
    - mybuffstreams (où mène buffstreams.ir) ;
    - freestreams (football) ;
    - roxiestreams (flux HLS nus).
    - Le moteur `new-stream-embed` est partagé par mybuffstreams et isportsurge.

  - **Nouveaux miroirs.** ppv passe à six domaines d'API, `api.ppv.cx` étant mort. reedstreams devient un miroir de streamed.

  - **Régies et adaptateurs.** Les régies à identifiant hexadécimal (`/4/192e…`) sont écartées. Un adaptateur peut maintenant déclarer `seulementSesLiens`.

  - **Écartés, avec la raison** : sportontv et cosectv (ils relisent ppv), ntv (il redistribue ppv, daddylive, cdnlivetv et Streamed), streamcorner (réponses chiffrées), strumyk/strims24 (flux Flashscore et une requête par match), livetv.sx (chaîne de certificats incomplète), v5.gostreameast (miroirs bloqués). Les autres sont morts.

  - **Vitesse du passage : de 310 s pour onze sources à 139 s pour vingt-six**, avec 3 026 flux au lieu de 1 680.
    - Les sources sont lues en parallèle, et 24 pages de match sont en vol à la fois.
    - Le `fetch` du script ne demande qu'une fois chaque adresse et retient les échecs. `fetchPage` rejouait chaque échec par chaque « proxy », qui revient à la même requête directe ; et son délai de 5 s courait pendant l'attente dans la file de l'hôte (1 623 « erreurs réseau » à 24 en vol avant ce correctif).
    - `mergeMatches` est indexé : 0,2 s au lieu de 13, pour un résultat identique. Le mot « live » figurait dans 404 noms d'équipe.
    - **jsdom est fixé en 26.1.0.** Les versions 27 à 29 retiennent chaque document analysé : le tas atteignait 6,8 Go et le passage se figeait vers la 875ᵉ page.
    - La phase des pages a un budget de 360 s.

  - **Sans GitHub.**
    - `npm run liens` (`scripts/maj_liens.mjs`, multiplateforme) enchaîne le calendrier, les liens, la vérification, et sur demande la publication (`--publier`).
    - `--rapide` (`--horizon 180`) ne relit que les pages des matchs en cours ou imminents. Les autres gardent leurs liens (`reporterLiensNonRelus`, jamais par une adresse partagée).

  - **Corrigé au passage.** Une adresse canonique n'est adoptée que si elle répond. freestreams se déclarait sur `fsl-streams.click`, au certificat invalide, qui serait devenu l'adresse de la source.

  - **Tests** :
    - `unit_nouvellessources` (18 groupes, dont la cohérence des tables de déclaration) ;
    - `unit_majrapide` (5, dont un verrou sur la version de jsdom) ;
    - `npm run test:unit` : 84 fichiers ; Playwright : 43 passés, 1 sauté.

  - **Fichiers** : `js/scrapers.js`, `js/config.js`, `js/match.js`, `js/extractors.js`, `js/sources/{index,olympicweb,totalsportek,aapmains,roxiestreams}.js`, `scripts/scrape_streams.mjs`, `scripts/maj_liens.mjs`, `scripts/sonder_domaine.mjs`, `domains.json`, `package.json`, `package-lock.json`, `desktop/deps/package{,-lock}.json`, `sw.js`, tests, `docs/ARCHITECTURE.md`, `README.md`.

  - **Ce qui reste.**
    - Le domaine des flux de roxiestreams est écrit dans son adaptateur : s'il change, il faut le mettre à jour.
    - mybuffstreams et isportsurge n'exposent leurs lecteurs qu'à l'approche du match.
    - livetv.sx serait lisible en fournissant le certificat intermédiaire manquant (`NODE_EXTRA_CA_CERTS`).

- 2026-10-09 - **« T'as ajouté les nouvelles sources et trouvé comment extraire de ceux qui répondent sans matchs ? Methstreams a beaucoup de liens. » — « Fais tout ce que tu peux. »**

  - **Methstreams revit.** En production, methstreams.gs répondait 403 au serveur : la source ne livrait plus rien. methstreams.st/home n'affiche que six matchs en clair, mais sa grille complète (trois jours, tous les sports) est dans le bloc JSON de sa recherche (`searchIndex`). Le nouveau parseur `parseMethstreamsIndex` la lit, avec les heures exactes. L'adresse passe à `https://methstreams.st/home` et les anciennes pages `/league/…` sont retirées. Résultat : 184 matchs ; la page de match donne son flux (fxtrend.st).

  - **Cinq sources nouvelles**, toutes vérifiées par un passage réel du script serveur :
    - `ppv` : API `api.ppv.st`, 158 matchs avec leurs lecteurs ;
    - `daddylive` (dlive.sx) : programme UTC par chaînes, 266 matchs ;
    - `watchsports` (watchsports.su) : 49 matchs, une dizaine de flux par page ;
    - `isportsurge` (isportsurge.ws) : 13 matchs ;
    - `crichd` (crichd.at, cricket) : lu par le repli générique.

  - **Une seule table des parseurs** (`PARSEURS`, `js/scrapers.js`). Elle était recopiée dans `js/main.js`, `scrape_streams.mjs` et `sonder_domaine.mjs`. `fetchRemoteConfig` dérive ses clés de `SOURCE_VAR_NAMES`.

  - **Décor.** Au premier passage réduit, la règle du décor retirait 147 liens, dont les chaînes daddylive : Sky Sports Main Event sert au cricket comme au golf. Les liens attachés par un programme (ppv, daddylive) portent maintenant `programme: true`, et la règle les épargne. Il ne reste que trois vraies adresses de publicité écartées.

  - **Outil de sondage.** Pour une source dont les matchs pointent vers la grille, il affiche les lecteurs portés par le match au lieu de rouvrir la grille.

  - **Vérifié** : passage réduit de `scrape_streams.mjs` (`--limit 20`), puis données restaurées. Liens par source : daddylive 664, ppv 189, watchsports 137, methstreams 26, crichd 3, isportsurge 2.

  - **Tests** : `unit_nouvellessources` (10 groupes, dont la cohérence des tables de déclaration). `npm run test:unit` : 83 fichiers ; Playwright : 43 passés, 1 sauté.

  - **Fichiers** : `js/scrapers.js`, `js/config.js`, `js/main.js`, `js/match.js`, `scripts/scrape_streams.mjs`, `scripts/sonder_domaine.mjs`, `domains.json`, `tests/unit_nouvellessources.test.js`, `docs/ARCHITECTURE.md`, `README.md`.

  - **Ce qui reste.**
    - Relever les sites rendus en JavaScript : olympicweb et fbstream (gabarit VIPLeague), bintv et streamsports99 (des API existent), totalsportek, ntv, reedstreams, streamcorner, strims24, sportontv, roxiestreams.
    - Voir ce que la vérification des lecteurs dit des lecteurs ppv (taifood-blog.asia) et des pages daddylive.

- 2026-10-09 - **Liste de domaines fournie ; « un outil qui permet de trouver facilement les liens quand on a un nouveau domaine » ; « ne pas ramasser les mauvais liens », en amont et pas dans l'app.**

  - **Outil : `npm run sonder -- <domaine>…`** (`scripts/sonder_domaine.mjs`, décisions dans `js/sondage.js`). Pour chaque domaine : statut, redirection, adresse canonique ; la source à laquelle il ressemble, d'après son nom ou `--source <id>`, lue comme le fait le serveur ; quelques pages de match et leurs lecteurs, avec ce que le registre de jouabilité en sait. `--ajouter` l'inscrit en dernier dans les miroirs de sa source. Ne comptent que les matchs hébergés sur le domaine sondé : le parseur d'OnHockey fabriquait sur ntv.cx des « matchs » pointant vers onhockey.tv. Un site sans nom de source est lu à l'aveugle et signalé comme nouvelle source, jamais comme miroir.

  - **La liste passée à l'outil** (66 domaines, depuis le conteneur). Seul **streamed.st** est un miroir neuf qui livre (255 matchs) : il est ajouté à `streamed`. Déjà connus : streamed.pk, v2.sportsurge.net, vipleague.me. Ils répondent sans livrer : methstreams.st (pages de ligue vides), ww1.sportsurge.st, v5.gostreameast.link (page de liste de miroirs), buffstreams.ir (→ mybuffstreams.plus). Les streameast.* sont injoignables. footybite.ir et livetv.sx répondent 503. Les autres sont des sites que les parseurs actuels ne lisent pas : daddylive, ppv, ntv, totalsportek, streamcorner, reedstreams, etc. **crichd.at** se lit par le repli générique (cricket, 6 lecteurs par match) : c'est un candidat de nouvelle source.

  - **Liens morts écartés en amont** (`ecarterLiensMorts`, `js/playability.js`, appelé par `scrape_streams.mjs`). Un lien n'est plus publié si son hôte a été chargé au moins 8 fois sans une lecture. Il reste publié s'il a été vu jouer, si son hôte est une source (une page de match), ou si c'est un onglet dont la page répond. Sur le cache du jour : 1902 → 1311 liens, dont 483 « Follow the guide » vers une page de VPN (imgcdnngx.com). C'était le seul lien de 448 matchs, qui passent « sans lien ». Chaque hôte écarté garde un témoin, et `verify_players.mjs` en éprouve six par passage (`ciblesDeRehabilitation`) : une lecture suffit à le faire revenir. Rien ne change dans l'application.

  - **Tests** : `unit_sondage` (7 groupes), `unit_liensmorts` (6). `npm run test:unit` : 82 fichiers ; Playwright : 43 passés, 1 sauté (lancé avec le Chromium du conteneur, la version attendue n'y étant pas).

  - **Fichiers** : `js/sondage.js` (nouveau), `scripts/sonder_domaine.mjs` (nouveau), `js/playability.js`, `scripts/scrape_streams.mjs`, `scripts/verify_players.mjs`, `js/config.js` et `domains.json` (streamed.st), `package.json` (`npm run sonder`), `sw.js` + `VERSION_APP` → `sports-guide-v40` (`js/sondage.js` dans `APP_SHELL`), `docs/ARCHITECTURE.md`, `README.md`, tests.

  - **Ce qui reste.** Écrire les nouvelles sources : crichd.at en premier. daddylive et ppv sont des sites par chaînes ou par API, à relever. methstreams.st et ww1.sportsurge.st sont à relire à la main pour voir où sont passées leurs grilles.

- 2026-10-09 - **« La mise à jour des liens semble se faire difficilement. »**

  - **Constat.** `data/streams.json` datait du 6 octobre à 19:21 UTC : plus aucun passage depuis. Le passage 887 a réussi son scrape, mais son job `relais` a reçu un HTTP 500 de l'API GitHub sur la relance (19:49:06). Un seul essai : la chaîne s'est arrêtée. Le cron, censé la rétablir, ne tournait plus : aucune exécution `schedule` d'aucun workflow du dépôt depuis le 20-21 septembre (ni ce workflow, ni le calendrier quotidien, ni la surveillance des domaines). Les workflows sont pourtant marqués « active ».

  - **Correctif.** La relance du relais est réessayée six fois (30 s, 60 s, … 180 s d'écart). Avant chaque essai, on vérifie qu'aucun passage n'est en route, parce qu'une erreur de l'API n'empêche pas forcément sa création. Après six échecs, le job sort en erreur avec un message explicite. Passage relancé à la main le 9 octobre pour repartir.

  - **Vérifié** : boucle simulée avec un faux `gh` qui échoue deux fois, puis réussit au troisième essai.

  - **Test** : `unit_workflowliens`, groupe 6 (nouveau ; il tombe sur l'ancien workflow).

  - **Fichiers** : `.github/workflows/scrape_streams.yml`, `tests/unit_workflowliens.test.js`, `docs/ARCHITECTURE.md`.

  - **Ce qui reste.** Le cron ne tourne plus du tout. Cause côté GitHub, inconnue. Ce changement de `scrape_streams.yml` réenregistre peut-être son cron à la fusion. Sinon, pour chaque workflow planifié : Actions → workflow → « ⋯ » → Disable, puis Enable. Tant que le cron est mort, si le runner du relais est perdu, il faut relancer à la main.

- 2026-10-04 - **« Ça unmute avec plusieurs players mais pas un. »**

  - **Cause.** L'iframe d'une tuile ne recevait son identifiant (`mv-iframe-N`) qu'au redessin SUIVANT de la grille. Elle est posée après `resolveStreamUrl`, donc après le redessin en cours. Avec plusieurs vidéos, chaque ajout redessine et les cadres finissent par l'avoir. Avec une seule ajoutée depuis le guide, rien ne venait après : `cadreDeTuile(0)` ne trouvait rien. Le signal « joue » du script n'était rattaché à aucune tuile, les clics non plus, et `mv_unmute` n'était jamais envoyé.

  - **Correctif.** L'identifiant est posé à la création du cadre.

  - **Vérifié dans Chromium.** Une vidéo ajoutée par `addToMultivision`, avec une page sonde qui annonce « joue » : sans le correctif, `id: ""` et aucun `mv_unmute` ; avec, la sonde reçoit `mv_unmute`.

  - **Test** : `unit_sonseul` (nouveau ; il tombe sans le correctif). `npm run test:unit` : 80 fichiers.

  - **Fichiers** : `js/multiview.js`, `tests/unit_sonseul.test.js`, `sw.js` + `VERSION_APP` → `sports-guide-v39`.

- 2026-10-04 - **« Au moins, fait que la fenêtre détachée soit trois streams un par-dessus l'autre et que ça bugge pas lors du merge back. »**

  - **Fenêtre détachée = second écran.** Dès deux vidéos, `🖼 Fenêtre détachée` garde la vidéo 1 dans la page et empile les autres dans la fenêtre PiP, haute de 270 px par vidéo et large de 480. La préparation est commune avec la fenêtre ordinaire (`preparerSecondEcran`, extraite de `toggleDeuxEcrans`). Avec une seule vidéo, elle part entière comme avant.

  - **Retour.** Au retour, chaque vidéo rapportée rechargeait en gardant `_playing` à vrai : muette, marquée ● sans jouer, et sans reprise. Elle repart maintenant comme un chargement neuf (`reveillerApresDeplacement`), et le son et la grille sont réappliqués. L'ancienne fenêtre détachée (vidéo seule) ne redessinait pas la grille au retour ; pendant le détachement, `updateMultivisionLayout` ne trouvait même pas la grille. Les deux sont corrigés.

  - **Vérifié dans Chromium** avec une page sonde. Après « ⤺ Ramener les vidéos », les trois vidéos rapportées reçoivent `mv_clean`/`mv_play` une fois rechargées, la vidéo restée dans la page n'est pas touchée, et la grille revient en 2 × 2.

  - **Tests** : `unit_deuxecrans` (20 cas). `npm run test:unit` : 79 fichiers ; Playwright 44 sur 44.

  - **Fichiers** : `js/multiview.js`, `tests/unit_deuxecrans.test.js`, `FEATURES.md`, `docs/ARCHITECTURE.md`, `sw.js` + `VERSION_APP` → `sports-guide-v38`.

- 2026-10-04 - **« C'est possible de faire comme si c'était la même fenêtre, pour pas avoir à recharger ? »** Oui : une seule fenêtre étirée sur les deux moniteurs. Nouvelle disposition `ecrans` (`⋯ Plus → 🖥 Deux écrans : une fenêtre étirée`, et `⊞ Disposition`) : la vidéo 1 à gauche, calée sur le premier écran par `partPremierEcran` (`js/deuxecrans.js`), les autres empilées à droite. Un échange ne fait que réordonner les cellules : **aucune iframe ne change de document, rien ne recharge**. Vérifié dans Chromium avec une marque posée dans chaque page de lecteur : elles survivent toutes à l'échange par ⇄. Les deux fenêtres restent proposées (`🗗`), pour qui veut le plein écran sur chaque moniteur. Limite : le plein écran du navigateur ne couvre qu'un écran. Tests : `unit_deuxecrans` (18 cas). Fichiers : `js/deuxecrans.js`, `js/multiview.js`, `tests/unit_deuxecrans.test.js`, `FEATURES.md`, `docs/ARCHITECTURE.md`.

- 2026-10-04 - **« Le switch est lent et clunky. »** Une tuile qui change de fenêtre recharge sa page (imposé par le navigateur), mais elle gardait `_playing` à vrai. Le signal « joue » de la page rechargée ne déclenchait donc rien : pas de son pour la vidéo arrivée devant, une pastille ● fausse, et aucune reprise si elle ne repartait pas. `reveillerApresDeplacement` (`js/multiview.js`) la traite comme un chargement neuf de la même source et relance la lecture (`mv_clean` + `mv_play`) dès le `load` de la page. Test : `unit_deuxecrans` (16 cas). Ce qui reste : les deux vidéos rechargent toujours.

- 2026-10-04 - **« Les trois doivent être verticales. »** Le second écran empile ses tuiles en une seule colonne, une par ligne. Avant : une grande à gauche et deux empilées à droite, ou deux côte à côte. `placementSecondEcran` (`js/deuxecrans.js`) ; l'échange par ⇄ ou par glisser garde la place exacte, dans la colonne. Fichiers : `js/deuxecrans.js`, `tests/unit_deuxecrans.test.js`, `FEATURES.md`, `sw.js` + `VERSION_APP` → `sports-guide-v37`.

- 2026-10-04 - **« Mais genre, ça doit swap comme quand dans même fenêtre. »** Suite du mode deux écrans.

  - **Échange au lieu de décalage.** `mettreSurEcranPrincipal` mettait la tuile en tête (`unshift`) : la principale partait en position 2 et les autres glissaient d'une place. Elle **échange** maintenant les deux tuiles (`echangerTuiles`, la permutation du glisser-déposer) : la principale prend la place exacte de l'autre, rien d'autre ne bouge, et seules ces deux vidéos se rechargent. Bouton `⇄ Principal` dans l'en-tête des tuiles du second écran.

  - **Glisser d'un écran à l'autre.** L'échange se fait au dépôt (`ondrop`). Au survol (`ondragenter`, comme dans une seule fenêtre), il rechargerait chaque tuile traversée. Le dépôt remet lui-même l'état du glisser. Les iframes des deux fenêtres lâchent le pointeur pendant le glisser (`pointeursDesCadres`).

  - **Bouton masqué.** Constaté dans Chromium : la barre de la seconde fenêtre (en haut à droite) couvrait les boutons de la tuile du haut à droite, et le clic sur ⇄ tombait sur « Ramener les vidéos ». La barre est passée en bas au centre. Après la correction, le clic sur ⇄ dans la seconde fenêtre fait bien l'échange.

  - **Tests** : `unit_deuxecrans` passe à 15 cas (échange sans déranger les autres, bouton présent seulement sur le second écran, glisser entre fenêtres : rien au survol, échange au dépôt). `npm run test:unit` : 79 fichiers ; Playwright 44 sur 44.

  - **Fichiers** : `js/multiview.js`, `tests/unit_deuxecrans.test.js`, `docs/ARCHITECTURE.md`, `FEATURES.md`.

  - **Ce qui reste.** Les deux vidéos échangées rechargent leur page. Aucun moyen de l'éviter : une iframe qui change de document est rechargée par le navigateur.

- 2026-10-03 - **« Créer mode deux écrans où un flux joue sur un écran, avec les trois autres qui se détachent pour mon deuxième écran. »**

  - **Ce qui est ajouté.** `⋯ Plus → 🖥 Deux écrans`. La vidéo 1 reste dans la page ; les vidéos 2 à 4 partent dans une vraie fenêtre (`window.open`). Pas le PiP, qui reste toujours au premier plan et ne passe pas en plein écran. La fenêtre a `⛶ Plein écran` et `⤺ Ramener les vidéos`. Sur Chromium, une fois la permission « gestion des fenêtres » accordée, elle s'ouvre sur l'autre moniteur et le remplit. Pour changer de vidéo principale : touches 1 à 4 (relayées depuis la seconde fenêtre) ou `🖥 Mettre sur l'écran principal` dans le menu ⋮. Règles pures dans `js/deuxecrans.js` ; câblage dans `js/multiview.js` (§7.5 ter).

  - **Ce qu'il fallait pour qu'une tuile vive ailleurs.** Une iframe déplacée a la seconde fenêtre pour parent. Ses messages (`video_state`, clics, son) allaient à cette fenêtre, et le script utilisateur n'obéissait qu'à elle. `brancherFenetreDeTuiles` renvoie maintenant ces messages à la page, et `posterATuile` envoie les ordres depuis la seconde fenêtre (`__mvRelais`). Les recherches de tuile par `document` passent par `cadreDeTuile` / `celluleDeTuile`. La fenêtre détachée (PiP) avait le même défaut sans que personne le voie ; elle passe par la même préparation.

  - **Piège évité.** Attendre `getScreenDetails()` avant `window.open` laisse l'invite de permission user l'activation du clic, et la fenêtre est alors bloquée. Constaté dans Chromium, où l'appel ne rendait jamais la main. On l'attend seulement si la permission est déjà accordée ; sinon on la demande après l'ouverture et on déplace la fenêtre.

  - **Vérifié dans Chromium** (script jetable, supprimé) : 1 tuile dans la page et 3 dans la fenêtre. Un ordre arrive à la tuile avec `e.source` égal à son parent. Un message du lecteur revient à la page avec la bonne tuile. Fermer la fenêtre ramène les 4 tuiles.

  - **Test cassé sur la branche de base.** `unit_cadreinterieur` exigeait la version 1.10 du script, qui est passée à 1.11 le 30 septembre. Le test vérifie maintenant que la version annoncée égale celle de l'en-tête et vaut au moins 1.10.

  - **Tests** : `unit_deuxecrans` (nouveau, 13 cas : répartition, placement, choix de l'écran, relais, renvoi des messages, fonctions des `onclick`, échange de principale, fermeture, refus en mode câble). `npm run test:unit` : 79 fichiers ; Playwright 44 sur 44 (lancé avec le Chromium préinstallé : le navigateur que demande la version épinglée de Playwright manque dans ce conteneur).

  - **Fichiers** : `js/deuxecrans.js` (nouveau), `js/multiview.js`, `sw.js` (+ `APP_SHELL`) + `VERSION_APP` → `sports-guide-v36`, `tests/unit_deuxecrans.test.js`, `tests/unit_cadreinterieur.test.js`, `docs/ARCHITECTURE.md`, `FEATURES.md`.

  - **Ce qui reste.** Les fenêtres modales (choix d'un match, d'une source) s'ouvrent toujours sur l'écran 1. Le glisser-déposer ne passe pas d'une fenêtre à l'autre. Le mode ne survit pas à un rechargement de la page : le navigateur exige un clic pour ouvrir une fenêtre. Rien de tout ça n'a été essayé sur un vrai deuxième moniteur.

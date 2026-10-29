# Pistes

Ce que la recherche sur GitHub du 28 octobre 2026 (« Cherche github pour des trucs déjà existants qui pourraient améliorer ce repo ») a trouvé et qui n'est **pas fait**, pour y revenir plus tard. Ce qui est fait est dans [WORKLOG.md](WORKLOG.md) ; la référence technique dans [ARCHITECTURE.md](ARCHITECTURE.md).

Trois règles posées par l'utilisateur ce jour-là, qui tranchent d'avance :

- **Rien d'externe à GitHub** (« Je veux pas faire rien d'externe ») : pas de compte Cloudflare, pas de Healthchecks, pas de service tiers, même gratuit.
- **Rien de manuel** (« je veux pas le faire manuellement ») : une alerte qui demande un clic ne vaut rien ; une réparation automatique, oui.
- **Rien sans aval** (« Intègre rien sans mon aval ») : chaque piste ci-dessous attend un « go » explicite.

## Retenu, dans l'ordre où ça vaut la peine

### 1. Sources officielles en repli d'ESPN (NHL, NBA)

Quand ESPN tombe ou répond en partie (voir `espnpartiel`, `calendrierperime` dans les tests), la grille se vide. Deux ligues ont une API ouverte, sans clé, documentée par la communauté :

- **NHL** : `https://api-web.nhle.com/v1/schedule/{AAAA-MM-JJ}` (calendrier du jour), `/v1/score/now` et `/v1/score/{date}` (scores), `/v1/gamecenter/{id}/boxscore`. Référence : [Zmalski/NHL-API-Reference](https://github.com/Zmalski/NHL-API-Reference) (MIT). CORS côté navigateur non vérifié ; côté serveur (`scripts/scrape_schedule.mjs`) ça passe.
- **NBA** : calendrier complet en JSON ouvert sur `cdn.nba.com` (le détail des adresses est dans [JuampiHernandez/sportsdata-mcp](https://github.com/JuampiHernandez/sportsdata-mcp), MIT).

Forme attendue : un adaptateur par ligue sur le modèle de `js/lhjmq.js`, appelé seulement quand ESPN n'a rien rendu pour cette ligue. Rien d'externe : ce sont les sites des ligues, lus comme ESPN l'est déjà.

### 2. Points ESPN non utilisés

[pseudo-r/Public-ESPN-API](https://github.com/pseudo-r/Public-ESPN-API) (MIT) documente, au-delà de `scoreboard` et `summary` que nous utilisons :

- `teams/{id}/schedule` (calendrier d'une équipe : utile pour les favoris) ;
- `events/{id}/competitions/{id}/broadcasts` sur Core v2 (les diffuseurs officiels, à afficher sur la fiche) ;
- les classements par `/apis/v2/` (la route `/apis/site/v2/` rend un stub).

À savoir : depuis le 30 septembre 2026, une plage de dates (`dates=AAAAMMJJ-AAAAMMJJ`) répond 400 pour MLB et NFL. Nos scripts demandent un jour à la fois ; ne pas réintroduire la plage.

### 3. Vérification des lecteurs : un critère de plus

`scripts/verify_players.mjs` observe le trafic vidéo et un `<video>` avec des données. [bhackerb/stream-keepalive](https://github.com/bhackerb/stream-keepalive) ajoute un critère que nous n'avons pas : **`currentTime` qui avance** sur quelques secondes, pour attraper un lecteur qui a chargé un manifeste mais ne joue pas (figé). Deux pièges relevés dans les issues de Playwright :

- le SDK publicitaire Google IMA injecte des iframes `sandbox` vides qui ne rendent pas le `<video>` en Chromium sans tête ([playwright #33343](https://github.com/microsoft/playwright/issues/33343)) : faux négatif possible sur les embeds à pub ;
- `getVideoPlaybackQuality` doit être **appelée**, pas lue ([playwright #3789](https://github.com/microsoft/playwright/issues/3789)).

### 4. Capter le manifeste pendant la vérification

*Existait déjà quand cette piste a été écrite* (`link.media`, `mediaReferer` ; voir la piste A.1 plus bas, relue le 29 octobre 2026). Ce qui suit reste comme trace de la recherche.

[Divinity360/streamtrik](https://github.com/Divinity360/streamtrik) fait côté serveur ce que notre mode direct fait côté client : un résolveur Playwright ouvre l'embed, capte le `.m3u8`, et un hls.js statique le joue. La vérification sur GitHub ouvre déjà les lecteurs : écrire le manifeste capté dans `data/streams.json` donnerait au mode direct des adresses prêtes, sans le script utilisateur. Réserves : pas de licence déclarée (s'inspirer, ne pas copier) ; les manifestes expirent vite, à mesurer ; les CDN exigent souvent le `Referer` du lecteur (§ `directmedia.js`).

### 5. Interface : deux idées

- **Décalage des scores aligné sur la vidéo** (vu dans [rebeliptv/iptv](https://github.com/rebeliptv/iptv), propriétaire : l'idée seulement). Les flux ont 30 à 90 s de retard sur les scores ESPN : la carte Live annonce le but avant qu'on le voie dans la tuile. Un réglage « retarder les scores de N s » dans le lecteur, ou une estimation par tuile. C'est le seul vrai manque d'usage relevé par rapport aux projets voisins.
- **La grille multivision dans une fenêtre Document Picture-in-Picture** (vu dans [profullstack/tipoffwatch.com](https://github.com/profullstack/tipoffwatch.com)) : toujours au-dessus, pendant qu'on fait autre chose ; repli sur un popup. Bibliothèque vanilla : [Shakya47/pip-it-up](https://github.com/Shakya47/pip-it-up) (bêta ; Chrome et Edge seulement). Prolonge « les vidéos gardées en arrière-plan ».

### 6. Outillage de qualité (sans réseau, dans `tests.yml`)

- **ESLint** en configuration plate, règles de base (variables non définies, imports cassés) : rien de tel dans le dépôt aujourd'hui.
- **knip** (fichiers et exports orphelins). Réserve : beaucoup de fonctions sont posées sur `window` et appelées depuis du HTML en chaîne ; sans une liste d'ignorés, c'est du bruit.
- **Accessibilité** : `@axe-core/playwright` dans les suites existantes (pa11y est en LGPL, moins commode). Lighthouse a retiré sa catégorie PWA : manifeste et service worker restent à nos tests.

### 7. Régularité du passage des 30 minutes, sans service externe

Le relais et la veille (`veille_liens.yml`) couvrent le cas courant. Si un jour GitHub cesse d'honorer **tous** les crons du dépôt (le cas du 20 septembre au 9 octobre 2026 ?), il ne reste que des solutions écartées (horloge externe : [curlewlabs-com/github-cron-trigger](https://github.com/curlewlabs-com/github-cron-trigger), MIT, demande une machine à soi avec cron) ou la machine de l'utilisateur (`npm run liens -- --publier`, l'application de bureau). Rien à faire tant que ça ne se reproduit pas.

## Vitesse, qualité, taux de lecture et CCGTV (recherche du 28 octobre 2026, deuxième)

Demande : « Chercher sur github comment rendre plusieurs rapide et meilleur qualité taux de fonctionnement des streams, ainsi que bien meilleure performance sur ccgtv ». Recherche web restreinte à github.com, une quinzaine de dépôts, issues et PR lus. Constat de départ : le lecteur natif (`LecteurActivity`, `tv/`) est déjà réglé comme le recommandent les projets lus (préparation sans segment, tampons courts, `BEHIND_LIVE_WINDOW` rattrapé) ; ce qui reste à gagner est dans le mode direct (hls.js), dans la vérification serveur et dans la WebView de la télé. Les mêmes trois règles s'appliquent (rien d'externe, rien de manuel, rien sans aval), plus « site = APK » : ce qui suit vaut pour le site et l'APK, réglé par la mesure de l'appareil et non par la plateforme.

### A. CCGTV : moins de travail par image (le plus gros levier)

1. **Jouer le manifeste plutôt que la page.** *Existait déjà, à tort noté comme à faire* (relu le 29 octobre 2026) : `verify_players.mjs` capte le manifeste et son `Referer` (`link.media`, `mediaReferer`, reportés par `reporterVerifications`), le bouton ▶ Direct n'est montré qu'après une sonde par le chemin que prendra le direct (§7.4 de `ARCHITECTURE.md`), et l'APK essaie le lecteur natif. La limite est mesurée : relus depuis un autre réseau, 7 manifestes sur 39 répondaient, 22 refusaient (jeton lié à l'adresse qui l'a obtenu). Reste une décision, pas une piste technique : passer seul en direct quand la sonde répond (aujourd'hui, c'est un bouton).
2. **Ne travailler qu'au changement.** *Fait le 29 octobre 2026.* Mesuré dans [thathman/rhema-studio#301](https://github.com/thathman/rhema-studio/pull/301), une WebView plein écran sur un **Chromecast avec Google TV HD** : images saccadées de 53 % à 0,3 % en ne redessinant qu'au changement. Profilé chez nous (Chromium, processeur ralenti six fois, lecteur ouvert), le gel de la passe de chargement (624 à 726 ms) venait à moitié de la réécriture du calendrier local (683 Ko dans `localStorage.setItem`, aussi à chaque relève des scores, chaque minute) et pour un tiers d'`isMatchPair` sur les mêmes couples qu'à la passe précédente. Le calendrier et `last_scraped_matches` sont maintenant écrits au plus tous les quarts d'heure (`ecrireCacheLocal`) et le verdict d'appariement est mémorisé : 272 à 300 ms. Pas besoin de `scheduler.yield` ni de Worker pour ce gain ; le reste (la fusion, ~150 ms) pourrait encore être découpé si `js/fluidite.js` le désigne sur la télé.
3. **Le nombre de vidéos que la puce décode à la fois.** *Fait le 29 octobre 2026* : Logs → Cet appareil → Images perdues dit à partir de combien de vidéos l'appareil décroche (compteurs du script 1.19 pour les pages, du `<video>` pour le direct), et une vidéo qui perd plus d'un quart de ses images le dit. Pas de plafond imposé. Aucune limite publiée pour le CCGTV (Amlogic S805X2 pour le HD) ; Chromium a déjà limité Cast à un décodeur vidéo ([codereview 2173593002](https://codereview.chromium.org/2173593002)) et Bitmovin documente les appareils à décodeur unique. À mesurer, pas à supposer : `getVideoPlaybackQuality()` (à **appeler**, piste 3) par tuile en mode direct ; si les images perdues montent dès la N-ième vidéo, le dire dans la tuile et proposer de couper le son ou l'image des autres. Pas de plafond fixé « pour la télé » (site = APK).
4. **Réglages de la WebView** (`MainActivity`) : `setRendererPriorityPolicy`, `setOffscreenPreRaster`, calque matériel. Avis contradictoires et jamais mesurés sur de la vidéo ([graineos/os#8](https://github.com/graineos/os/pull/8), un APK Android TV à lecteurs avec pubs, sans mesure). La priorité par défaut est déjà haute quand la vue est visible. Rang bas : à essayer un par un sur l'appareil, journal de fluidité à l'appui, et garder seulement ce qui se mesure.
5. **Un bloqueur plus fin que la liste d'hôtes.** [Edsuns/AdblockAndroid](https://github.com/Edsuns/AdblockAndroid) (LGPL-2.1, moteur de Brave) applique EasyList complet dans `shouldInterceptRequest`, avec masquage d'éléments et scriptlets ; notre `ListeDeBlocage` ne compare que des hôtes (~99 000). Moins de régie chargée = moins de CPU sur la télé. Réserves : LGPL (bibliothèque liée, acceptable mais à noter), maintenance non datée, code natif à embarquer ; l'extension et le script utilisateur devraient suivre (site = APK). À peser contre la piste A.1, qui rend la régie inutile.

### B. Mode direct (hls.js) : démarrer vite et à la bonne qualité

`configHls` (`js/lecteurdirect.js`) ne pose que `backBufferLength`, `maxMaxBufferLength` et `enableWorker` ; hls.js 1.5.17.

6. **Plafonner la qualité à la taille de la tuile** : `capLevelToPlayerSize: true`. *Fait le 29 octobre 2026* (`configHls`). Vu dans [c4fiber/potato-multiview#7](https://github.com/c4fiber/potato-multiview/pull/7). Mesuré avec le vrai hls.js 1.5.17 sur une échelle locale : une tuile de 480×270 reste en 360p au lieu de monter au 1080p (0,9 Mb/s à décoder au lieu de 6). Pièges relevés : à mettre au constructeur, pas à chaud ([hls.js#4522](https://github.com/video-dev/hls.js/issues/4522), [video.js#9645](https://github.com/videojs/video.js/pull/9645) pour 1.7) ; non appliqué sur un Chrome Android 12 ([hls.js#5594](https://github.com/video-dev/hls.js/issues/5594)).
7. **Ne pas sonder le débit au démarrage** : `testBandwidth: false`, `abrEwmaDefaultEstimate` = `abrEwmaDefaultEstimateMax` = 5 Mb/s, `startFragPrefetch: true`, et 30 Mo de `maxBufferSize` sur la télé (point 9). *Fait le 29 octobre 2026.* Mesuré : première image d'une petite tuile en 626–643 ms au lieu de 1 076–1 262 ; une tuile de 720 px démarre pareil. Sources : [Lad-Company/superbloom#139](https://github.com/Lad-Company/superbloom/pull/139), [hls.js#2361](https://github.com/video-dev/hls.js/issues/2361), [l'API de hls.js](https://github.com/video-dev/hls.js/blob/774f537fa62cf94ad61305d8592882e8a9eb86bd/docs/API.md).
8. **Stabilité du direct plutôt que faible latence.** *hls.js monté en 1.6.16 le 29 octobre 2026* (la dernière 1.6 sur cdnjs) ; les réglages de latence restent ceux par défaut. Ne pas descendre sous trois segments de la tête (`liveSyncDurationCount` par défaut : en dessous, l'API annonce des arrêts) ; un `maxLiveSyncPlaybackRate` de 1,1 pour rattraper doucement. En 1.5.x, chaque arrêt recule la cible d'une seconde ; 1.6 ajoute `liveSyncOnStallIncrease` ([S-V-E-R#86](https://github.com/S-V-E-R/S.V.E.R/pull/86)). Monter hls.js en 1.6.x est donc une piste en soi, à tester (le 1.7 change le comportement de `capLevelToPlayerSize`).
9. **Mémoire de la télé** : borner aussi `maxBufferSize` (60 Mo par défaut) ; un rapport LG/webOS tenait à 32 Mo, 32 s devant, 12 s derrière, et pointait les récupérations répétées comme cause de manque de mémoire ([hls.js#5567](https://github.com/video-dev/hls.js/issues/5567)) — notre `decisionErreurHls` les borne déjà.

### C. Taux de lecture : savoir plus, plus vite

10. **Vérifier en parallèle sur GitHub.** *Fait le 29 octobre 2026* (vu dans [dearbulut/iptv](https://github.com/dearbulut/iptv), six tâches parallèles d'Actions). `scrape_streams.yml` : trois machines (`verify_players.mjs --part i/3`) sur la même liste au même instant, 300 cibles au plus et 8 par hôte au lieu de 150 et 4, puis un job qui applique leurs relevés (`--appliquer`). À voir sur les premiers passages : combien de cibles chaque part conclut dans ses 5 minutes. Réserve qui demeure : les sites qui bloquent les centres de données ne répondent pas mieux à trois machines.
11. **Un contrôle de flux sans navigateur** : [freearhey/iptv-checker](https://github.com/freearhey/iptv-checker) (MIT, Node, `ffprobe` exigé) rend codec, définition et débit d'un m3u8 avec `Referer` et agent. *Pas fait, et pourquoi* (29 octobre 2026) : l'application sonde déjà chaque manifeste avant de proposer le direct, par le chemin que prendra la lecture et depuis l'adresse de l'utilisateur (`sondesDirect`, §7.4) ; un contrôle depuis GitHub ne dirait pas si le manifeste répond chez lui (22 sur 39 refusés d'un autre réseau, jeton lié à l'adresse). Il ne servirait qu'à écarter les manifestes à usage unique ou déjà expirés, ce que `expirationDe` fait en partie.
12. **Écran d'erreur filmé** : [peterpt/IPTV-CHECK](https://github.com/peterpt/IPTV-CHECK) relit les flux « vivants » par OCR pour repérer les écrans « stream offline » ; [ODVM/IPTV-scanner-and-analyser](https://github.com/ODVM/IPTV-scanner-and-analyser) analyse le MPEG-TS (débit minimal). Utile contre les flux qui « jouent » une image fixe ; la piste 3 (`currentTime` qui avance) couvre déjà l'essentiel pour beaucoup moins cher. Rang bas.
13. **Démarrer la suivante pendant que la première charge** (mode direct). [connorbrinton/steeple-stream#42](https://github.com/connorbrinton/steeple-stream/pull/42) lance deux chemins à la fois et garde le premier qui rend une image décodée. Sur la télé, décoder deux vidéos coûte trop ; mais sonder en parallèle les manifestes des deux ou trois liens suivants (`sonderDirect`, HTTP seulement) pendant que le premier charge rendrait la bascule immédiate quand il échoue. La bascule séquentielle d'aujourd'hui (§7.2) reste la règle.

### D. Lecteur natif : rien d'urgent, deux mesures

14. **Le nom du décodeur au journal** *Fait le 29 octobre 2026* (`Decodeur.java`, écouteur dans `LecteurActivity`) ; côté site, Logs → Décodage vidéo (`mediaCapabilities`). : sur Amlogic, l'échec du décodeur matériel fait passer Media3 au décodeur **logiciel** sans rien dire, et les images perdues montent ([NuvioTV#3968](https://github.com/NuvioMedia/NuvioTV/issues/3968), correctif [#3969](https://github.com/NuvioMedia/NuvioTV/pull/3969) qui écarte les décodeurs logiciels quand un matériel existe). Un `AnalyticsListener.onVideoDecoderInitialized` qui écrit le nom dans `Journal` dirait si c'est notre cas. Le compteur d'images perdues ment sur ces puces ([androidx/media#3457](https://github.com/androidx/media/issues/3457), Amlogic, gels de 420 ms non comptés).
15. **Ce qu'il ne faut pas faire** : le mode tunnel (arrêts connus sur du HLS en direct), forcer la file asynchrone de MediaCodec (retirée par un projet TV pour des gels), grossir les tampons au-delà de ce qui est posé (le relevé de [helal-c/xtremex#6](https://github.com/helal-c/xtremex/pull/6), 10–30 s, n'est pas vérifié sur appareil, et la télé a 1,5 à 2 Go).

### Par où je commencerais

Fait le 29 octobre 2026 (« Go pour celles prioritaires ») : A.2, B.6, B.7, C.10. A.1 existait déjà ; C.11 n'apporte presque rien de plus (voir son point). Restent, dans l'ordre : D.14 (le nom du décodeur au journal de l'APK, pour savoir si la télé décode en logiciel), A.3 (mesurer le nombre de vidéos tenables), B.8 (hls.js 1.6), puis le reste.

Puis le même jour (« Fais tout ça ») : A.3, B.8, D.14, le direct automatique (la décision de A.1), le calendrier local sans les liens du serveur (683 → 52 Ko), 5 liens par match et 12 par hôte à la vérification (200 cibles au lieu de 139), et les actions des workflows sous Node 24. Restent A.4 (réglages de la WebView, à mesurer un par un sur la télé) et A.5 (bloqueur EasyList).

## Écarté, et pourquoi

| Piste | Pourquoi |
|---|---|
| Proxy CORS à soi sur Cloudflare Workers ([7a6163/cors-proxy](https://github.com/7a6163/cors-proxy), [sekedus/cors-proxy](https://github.com/sekedus/cors-proxy)) | Compte Cloudflare refusé. L'appli lit pourtant déjà `custom_proxy_url` : si un jour un proxy à soi existe ailleurs, rien à coder. |
| Cron externe (Cloudflare, Deno Deploy, [austenstone/actions-external-cron](https://github.com/austenstone/actions-external-cron)) | Service externe refusé. |
| Ping Healthchecks.io (fait dans la PR #634, retiré dans la PR #636) | Service externe refusé ; remplacé par `veille_liens.yml`, qui répare au lieu d'alerter. |
| Issue GitHub « Liens figés » à relancer à la main | « Je veux pas le faire manuellement » ; remplacée par la relance automatique. |
| [renearias/gtvzone](https://github.com/renearias/gtvzone) (navigation télécommande) | AGPL. `js/tv-navigation.js` fait le travail ; [DibbayajyotiRoy/tv-dpad](https://github.com/DibbayajyotiRoy/tv-dpad) (MIT, 70 lignes) reste une référence si un cas de focus cloche. |
| [fearandesire/resolve-team](https://github.com/fearandesire/resolve-team) (noms d'équipes) | NBA et NFL seulement. Si `levenshtein` de `js/match.js` ne suffit plus un jour : [nol13/fuzzball.js](https://github.com/nol13/fuzzball.js/) (`token_sort_ratio`). |
| [Write/AutoPlayFootybite](https://github.com/Write/AutoPlayFootybite) (nettoyage des lecteurs) | Dépôt disparu (404). `multiview-cleaner.user.js` est plus avancé. |
| [rajhodedara/live-sport-plugin](https://github.com/rajhodedara/live-sport-plugin) (sources) | Déjà exploité le 28 octobre 2026 (DamiTV) ; les autres sources jugées. |
| [tencent-br/live-sport](https://github.com/tencent-br/live-sport) (multivision à six) | Aucun blocage de pubs, rien à prendre. |
| Gabarits PWA (vite-plugin-pwa, Workbox) | Imposent un bundler ; `sw.js` maison, cohérent avec « sans framework ». |
| Lecteurs natifs Capacitor ([Cap-go/capacitor-video-player](https://github.com/Cap-go/capacitor-video-player), [capacitor-pm-video-exoplayer](https://github.com/petemacko/capacitor-pm-video-exoplayer)) | `LecteurNatifPlugin.java` est maison et fait déjà ExoPlayer ; références pour le cycle de vie et Chromecast (émetteur), pas des remplacements. |
| Veille des domaines d'AdGuard (« Rotating Domains Checker ») | Même approche que `domains-watch.yml` ; rien à importer. |

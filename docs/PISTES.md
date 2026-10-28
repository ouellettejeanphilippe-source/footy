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

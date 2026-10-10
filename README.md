# Guide des Sports

Un guide télé des sports du jour, dans le navigateur : le programme sur une grille horaire, les scores en direct, et pour chaque match les liens de diffusion trouvés sur les sites agrégateurs, avec un lecteur qui joue jusqu'à quatre vidéos côte à côte. C'est une application web installable (PWA), sans serveur : des fichiers statiques, et deux automatisations GitHub qui régénèrent le calendrier et les liens.

Toutes les heures sont celles de New York (heure de l'Est).

## Ce qu'elle fait

- **Live** : les matchs en cours et ceux qui commencent dans l'heure, en cartes avec le score, la minute et le nombre de flux.
- **Guide** : le programme complet du jour sur une grille de 24 h, par ligue, avec la ligne de l'heure courante. Un match commencé la veille qui joue encore après minuit reste affiché.
- **Fiche de match** : buteurs, classement, statistiques de saison (matchs ESPN), et la liste des flux avec leurs actions.
- **Lecteur** : jusqu'à quatre vidéos, dispositions automatiques, vidéos gardées en arrière-plan pendant qu'on navigue, bascule automatique de source quand une vidéo ne démarre pas (avec le script utilisateur).
- **Mode câble** (facultatif, `⋯ Plus → 📺`) : le lecteur se zappe au doigt — glisser ↑↓ change le match qui joue, ←→ change la source du match en cours, avec l'incrustation du décodeur.
- **Favoris, ligues, apparence** : équipes et ligues favorites, niveaux de ligue (principale, secondaire, ignorée), palettes et formes de cartes.

Le détail, onglet par onglet, est dans [FEATURES.md](FEATURES.md).

## Utiliser l'application

L'application est un site statique : elle se sert telle quelle depuis le dépôt (GitHub Pages ou tout serveur HTTP). Ouvrez `index.html` par HTTP, jamais en `file://` (les modules et le service worker l'exigent).

### Installer sur téléphone ou ordinateur

Dans le navigateur, « Installer l'application » (ou « Ajouter à l'écran d'accueil »). Vous obtenez une icône, le plein écran et une copie hors ligne de l'interface. En ligne, c'est toujours la version publiée qui s'affiche. Si un appareil semble rester sur une ancienne version, `Plus → ↻ Mettre à jour l'app` force la relecture sans toucher à vos réglages.

### Le script utilisateur (recommandé)

Les pages des lecteurs vidéo sont chargées telles quelles dans le lecteur. Sans aide, elles gardent leurs fenêtres surgissantes et leurs calques, et certaines refusent de s'afficher dans un cadre. Le script **Multiview Stream Cleaner** (`multiview-cleaner.user.js`) règle cela :

1. installez **uBlock Origin** (bloqueur de publicités) ;
2. installez **Tampermonkey** (gestionnaire de scripts) ;
3. dans l'application, `Plus → 🧩 Script → Installer le script` (ou ouvrez [multiview-cleaner.user.js](./multiview-cleaner.user.js) et acceptez l'installation).

Ce que le script apporte : blocage des fenêtres surgissantes dès le premier octet de la page, nettoyage autour du lecteur, lecture automatique, une seule vidéo avec le son, bascule automatique de source, mesure du débit, et le **pont** qui lit les pages des sources depuis votre adresse quand les proxys sont refusés. Options → Réseau & proxys indique s'il est actif. Firefox demande quelques réglages en plus, expliqués sur la page 🧩 Script.

Sur téléphone, les navigateurs ne prennent pas d'extensions : l'application fonctionne, mais sans nettoyage des lecteurs. **L'APK Android** (`mobile/`, téléphone et Chromecast avec Google TV) l'embarque : le script est posé dans chaque lecteur sans Tampermonkey, et rien à installer.

### D'où viennent les données

- **Calendrier et scores** : l'API publique d'ESPN (48 compétitions), complétée par quelques calendriers (PWHL, F1, IndyCar, sports de combat, WWE, LoL Esports). Un calendrier du jour est régénéré chaque matin sur le serveur (`data/schedule.json`) ; le navigateur relit les scores toutes les cinq minutes.
- **Liens de diffusion** : vingt-six sites agrégateurs, relus sur le serveur toutes les 30 minutes (`data/streams.json`), puis relus par le navigateur quand il le peut. Les adresses courantes des sites, qui changent souvent, sont dans `domains.json`, mis à jour automatiquement.

Ces sites changent sans prévenir, et l'application est faite pour l'encaisser sans qu'on écrive du code à chaque fois. Un site qui déménage est suivi tout seul (miroirs et adresse canonique). Un site qui refait son HTML garde ses matchs : quand son analyseur dédié ne rend plus rien, un repli générique les retrouve à leur *forme* — un lien par rencontre, « A vs B », une heure à côté. Et quand une correction est nécessaire, elle se fait dans `domains.json` : sous-pages, coupure d'une source en panne, hôtes à écarter. Le fichier est relu à chaque démarrage, donc la réparation est effective au chargement suivant, sans publier de version. Le détail est dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (§6.3 et §6.5 bis).

L'application n'héberge ni ne diffuse aucune vidéo ; elle rassemble des liens publics.

## Faire tourner l'application en local

GitHub Pages ne sert plus le site et les Actions ne tournent plus. Trois dossiers prennent leur place.

### `desktop/` — l'application de bureau

```bash
cd desktop && npm install && npm run build      # dist/Guide-des-Sports-portable.exe
cd desktop && npm start                         # sans compiler
```

Elle sert le site sur `http://127.0.0.1:47821` plutôt que par `file://`, parce que les modules ES, le service worker et `localStorage` l'exigent. **Le port est fixe** : c'est lui qui porte l'origine sous laquelle vos favoris et vos réglages sont rangés — un port au hasard les perdrait à chaque lancement.

Elle fait deux choses que la version hébergée ne pouvait pas faire :

- **Le script utilisateur est injecté par l'application.** Pas de Tampermonkey à installer : `desktop/preload-userscript.js` pose `multiview-cleaner.user.js` à `document-start` et dans le monde de la page, dans toutes les iframes. `node desktop/verifier-injection.mjs` le prouve en interrogeant le pont.
- **Les sources se lisent en direct, sans proxy.** Les en-têtes CORS des réponses tierces sont complétés localement, donc les proxys CORS publics — lents, souvent en panne, et qui voient tout ce qu'on demande — ne servent plus. Le blocage de publicité passe par les listes d'uBlock (l'extension elle-même ne bloque rien dans Electron, dont les API d'extension n'implémentent pas le filtrage réseau).

**Sur la machine qui porte le dépôt, pointez-la sur le dépôt** : menu → « Travailler dans un dépôt… ». Sans cela elle travaille sur une copie dans `%APPDATA%`, qui ne reçoit pas ce que le pipeline produit — et c'est justement le pipeline qui fait la vérification des lecteurs.

### `mobile/` — l'application Android (téléphone et Chromecast avec Google TV)

Le même APK s'installe sur un téléphone et sur un Chromecast avec Google TV, où il apparaît dans le lanceur. Sur la télé, le mode TV et le mode câble s'allument d'eux-mêmes ; partout, un flux direct est joué par le lecteur natif d'Android (`docs/ARCHITECTURE.md` §12.2).

```bash
cd mobile && npm install
powershell -ExecutionPolicy Bypass -File mobile\fabriquer-apk.ps1   # mobile\Guide-des-Sports.apk
```

Demande un JDK 21 et le SDK Android (voir l'en-tête du script pour les chemins). L'APK n'embarque qu'un **instantané** des données : quand `data/schedule.json` n'est pas du jour, le client interroge ESPN lui-même (`js/api.js`, `apiOuCacheLocal`), donc il n'a besoin d'aucun serveur. Lancez le pipeline avant de fabriquer, sinon l'APK part avec des liens non vérifiés.

### `tv/` — l'application Android TV (Chromecast avec Google TV)

Une appli native de 500 Ko, sans WebView ni pub, qui joue les flux directs avec le lecteur d'Android. Installation, télécommande et fabrication : [tv/README.md](tv/README.md).

### Les données : l'application s'en charge

Il n'y a **pas de tâche planifiée**. Tant que l'application de bureau est ouverte, elle refait les trois étapes elle-même toutes les 30 minutes — le calendrier, les liens, puis la vérification des lecteurs (`desktop/main.js`, `passeComplete`). Fermez la fenêtre et plus rien ne tourne : ces données ne valent que pour aujourd'hui et ne servent qu'à qui regarde. `⋯ Tout mettre à jour maintenant` (Ctrl+Maj+U) force une passe.

Cela demande que l'application travaille **dans le dépôt** (menu → « Travailler dans un dépôt… ») : la vérification charge les lecteurs dans le Chromium de Playwright, qui n'est pas embarqué dans l'exécutable. Sans dépôt, seul le calendrier est rafraîchi.

### `npm run liens` — la mise à jour à la main, partout

Si GitHub Actions ne tourne pas (ou pour ne pas attendre), une seule commande fait tout, sous Windows, macOS ou Linux :

```bash
npm run liens                         # calendrier si besoin, liens, vérification des lecteurs
npm run liens -- --rapide             # seulement les pages des matchs en cours ou dans les 3 h
npm run liens -- --rapide --publier   # … puis commit et push des données
```

`--rapide` relit les pages des matchs imminents et garde, pour les autres, les liens du passage précédent : c'est la mise à jour à faire juste avant de regarder. `--sans-verification` saute la vérification (Chromium de Playwright requis). Sans `--publier`, rien ne quitte la machine : l'application de bureau et un serveur local lisent `data/` directement.

### `local/pipeline.ps1` — le rattrapage à la main

```bash
powershell -ExecutionPolicy Bypass -File local\pipeline.ps1
powershell -File local\pipeline.ps1 -VerifTotal 600 -VerifBudgetMs 1500000   # rattrapage complet
```

Pour le cas où l'application n'a pas tourné depuis longtemps : les mêmes trois étapes, avec un budget de vérification qu'une passe de 8 minutes ne peut pas donner. Cette troisième étape est celle dont l'absence se voit le plus : c'est elle qui éprouve chaque lecteur dans un vrai Chromium et note lesquels jouent, et c'est sur ses observations que `sortFluxLinks` classe les liens et que la liste marque ceux qui ne jouent jamais.

Ses bornes par défaut (`--total 150`, `--budget-ms 5 min`) sont taillées pour un runner GitHub. Au premier usage, ou après une longue pause, donnez-lui un vrai budget :

```bash
powershell -File local\pipeline.ps1 -VerifTotal 600 -VerifBudgetMs 1500000
```

Le pipeline finit sur un bilan qui dit combien de liens ont un verdict et lesquels sont jugés morts. C'est le chiffre à regarder : tant qu'une grande part des liens n'a pas de verdict, le classement travaille dans le vide.

## Développer

Prérequis : Node.js 22 (`.nvmrc`), npm. Chromium pour les tests Playwright.

```bash
npm ci
npx playwright install chromium     # une fois
npm test                            # tests unitaires (node --test) puis suites Playwright
npm run test:unit                   # les tests unitaires seuls, en parallèle
npm run test:domains                # surveillance des domaines des sources (dépend du réseau)
```

Pour ouvrir l'application en local, servez le dossier par HTTP, par exemple :

```bash
python3 -m http.server 8080
# puis http://localhost:8080/index.html
```

Les scripts serveur se lancent aussi à la main : `node scripts/scrape_schedule.mjs` (calendrier), `npm run scrape:streams` (liens ; le script a besoin de beaucoup de mémoire, l'alias passe l'option qu'il faut), `node scripts/verify_players.mjs` (jouabilité, Chromium requis).

Un nouveau domaine à essayer ? `npm run sonder -- streamed.st autre-site.xyz` dit à quelle source il ressemble, combien de matchs il liste et quels lecteurs portent ses pages de match ; `--ajouter` l'inscrit dans les miroirs de sa source (`domains.json`).

### Où est quoi

| | |
|---|---|
| `index.html`, `styles.css` | La coquille et son style. |
| `js/` | Les modules de l'application. Point d'entrée : `js/main.js`. |
| `js/sources/` | Un adaptateur par site de flux. |
| `scripts/` | Les scripts serveur lancés par les workflows. |
| `data/` | Le calendrier et les liens régénérés automatiquement. |
| `tests/` | Tests unitaires Node (`unit_*.test.js`) et suites Playwright (`*.spec.js`). |
| `docs/ARCHITECTURE.md` | La référence technique : modules, flux de données, algorithmes, stockage, conventions. |
| `docs/WORKLOG.md` | Le journal des changements, daté et argumenté. |
| `AGENTS.md` | Les règles de travail dans ce dépôt (pour les humains et les agents). |

### Automatisations (historiques)

Ces workflows GitHub **ne tournent plus** : le dépôt vit hors de GitHub, et `local/pipeline.ps1` les remplace (voir « Faire tourner l'application en local »). Le tableau reste pour mémoire — les commentaires des fichiers de `.github/workflows/` expliquent des décisions qui valent toujours, notamment ce que le planificateur de GitHub livrait réellement.

| Workflow | Quand | Résultat |
|---|---|---|
| Tests | chaque push et chaque PR sur `main` | `npm test` |
| Calendrier ESPN | chaque jour à 09:00 UTC (et, s'il est en retard, au premier passage des liens du jour), et sur un push sur `main` qui touche le script du calendrier | `data/schedule.json` commité |
| Liens de diffusion | toutes les 30 min, par relais (le workflow se relance lui-même ; le cron à :17 et :47 amorce et rattrape) | `data/streams.json` et `domains.json` commités |
| Surveillance des domaines | chaque jour à 05:00 UTC | rapport seulement |

### Règles à retenir

- Une modification de `sw.js` ou d'un fichier précaché change `CACHE_NAME` dans `sw.js` **et** `VERSION_APP` dans `js/multiview.js` (des tests vérifient qu'ils sont identiques).
- Une nouvelle ligue ESPN s'ajoute à la fois dans `js/api.js` et dans `scripts/scrape_schedule.mjs`.
- Chaque changement s'accompagne d'un test et d'une entrée dans `docs/WORKLOG.md`.

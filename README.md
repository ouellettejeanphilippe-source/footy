# Guide des Sports

Un guide télé des sports du jour, dans le navigateur : le programme sur une grille horaire, les scores en direct, et pour chaque match les liens de diffusion trouvés sur les sites agrégateurs, avec un lecteur qui joue jusqu'à quatre vidéos côte à côte. C'est une application web installable (PWA), sans serveur : des fichiers statiques, et deux automatisations GitHub qui régénèrent le calendrier et les liens.

Toutes les heures sont celles de New York (heure de l'Est).

## Ce qu'elle fait

- **Live** : les matchs en cours et ceux qui commencent dans l'heure, en cartes avec le score, la minute et le nombre de flux.
- **Guide** : le programme complet du jour sur une grille de 24 h, par ligue, avec la ligne de l'heure courante. Un match commencé la veille qui joue encore après minuit reste affiché.
- **Fiche de match** : buteurs, classement, statistiques de saison (matchs ESPN), et la liste des flux avec leurs actions.
- **Lecteur** : jusqu'à quatre vidéos, dispositions automatiques, mode réduit pour continuer à naviguer, bascule automatique de source quand une vidéo ne démarre pas (avec le script utilisateur).
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

Sur téléphone, les navigateurs ne prennent pas d'extensions : l'application fonctionne, mais sans nettoyage des lecteurs.

### D'où viennent les données

- **Calendrier et scores** : l'API publique d'ESPN (48 compétitions), complétée par quelques calendriers (PWHL, F1, IndyCar, sports de combat, WWE, LoL Esports). Un calendrier du jour est régénéré chaque matin sur le serveur (`data/schedule.json`) ; le navigateur relit les scores toutes les cinq minutes.
- **Liens de diffusion** : onze sites agrégateurs, relus sur le serveur plusieurs fois par jour (`data/streams.json` ; le passage est planifié deux fois par heure, mais GitHub ne l'exécute que cinq à six fois par jour), puis relus par le navigateur quand il le peut. Les adresses courantes des sites, qui changent souvent, sont dans `domains.json`, mis à jour automatiquement.

L'application n'héberge ni ne diffuse aucune vidéo ; elle rassemble des liens publics.

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

### Où est quoi

| | |
|---|---|
| `index.html`, `styles.css` | La coquille et son style. `legacy.html` est l'interface classique. |
| `js/` | Les modules de l'application. Point d'entrée : `js/main.js`. |
| `js/sources/` | Un adaptateur par site de flux. |
| `scripts/` | Les scripts serveur lancés par les workflows. |
| `data/` | Le calendrier et les liens régénérés automatiquement. |
| `tests/` | Tests unitaires Node (`unit_*.test.js`) et suites Playwright (`*.spec.js`). |
| `docs/ARCHITECTURE.md` | La référence technique : modules, flux de données, algorithmes, stockage, conventions. |
| `docs/WORKLOG.md` | Le journal des changements, daté et argumenté. |
| `AGENTS.md` | Les règles de travail dans ce dépôt (pour les humains et les agents). |

### Automatisations

| Workflow | Quand | Résultat |
|---|---|---|
| Tests | chaque push et chaque PR sur `main` | `npm test` |
| Calendrier ESPN | chaque jour à 09:00 UTC, et sur un push sur `main` qui touche le script du calendrier | `data/schedule.json` commité |
| Liens de diffusion | planifié à :17 et :47 ; exécuté en pratique cinq à six fois par jour | `data/streams.json` et `domains.json` commités |
| Surveillance des domaines | chaque jour à 05:00 UTC | rapport seulement |

### Règles à retenir

- Une modification de `sw.js` ou d'un fichier précaché change `CACHE_NAME` dans `sw.js` **et** `VERSION_APP` dans `js/multiview.js` (des tests vérifient qu'ils sont identiques).
- Une nouvelle ligue ESPN s'ajoute à la fois dans `js/api.js` et dans `scripts/scrape_schedule.mjs`.
- Chaque changement s'accompagne d'un test et d'une entrée dans `docs/WORKLOG.md`.

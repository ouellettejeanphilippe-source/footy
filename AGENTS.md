# AGENTS.md

Règles de travail dans ce dépôt, pour les agents comme pour les humains.

## Règle d'or

Avant toute modification : lire `docs/ARCHITECTURE.md` (référence technique), parcourir `docs/WORKLOG.md` (les décisions récentes et leurs raisons), et **faire un grep du symbole** avant de le créer, de le renommer ou de le supprimer. De nombreuses fonctions sont exposées sur `window` et appelées depuis du HTML construit en chaîne : un `grep` sur le nom, y compris dans `index.html` et `legacy.html`, est le seul moyen de savoir qui l'utilise.

## Workflow par tâche

1. Lire `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/WORKLOG.md`.
2. Écrire l'intention dans `docs/WORKLOG.md` sous « ## En cours ».
3. Faire le travail : un nouveau comportement va dans un module de `js/`, pas dans `index.html`.
4. Écrire ou compléter un test qui aurait vu le problème (`tests/unit_*.test.js`, ou une suite Playwright), et lancer `npm test`.
5. Mettre à jour `docs/ARCHITECTURE.md` si un module, une fonction publique ou une règle change ; `FEATURES.md` si l'interface change ; le `README` si la prise en main change.
6. **Nettoyer** : supprimer tout fichier temporaire, script jetable, capture ou journal créé pendant la session. C'est un prérequis de chaque commit.
7. Déplacer l'entrée du `WORKLOG` vers « ## Fait » avec la date, les fichiers touchés, le résumé et ce qui reste.

## Ce qui est interdit

- **Scripts jetables laissés dans le dépôt** (`fix_*.py`, `test_*.js` à la racine, captures, logs). Tolérés le temps de réfléchir, supprimés avant le commit.
- **Suppression à l'aveugle.** Rien ne part sans grep complet (code, HTML, tests, scripts, workflows, docs).
- **Recréer une fonction qui existe.** Vérifier `js/utils.js` (`esc`, `escJs`, `pad`, `safeStorage*`, `fetchPage`), `js/db.js` (`normName`, `getOfficialTeamName`, `getLogo`, `leagueTier`), `js/match.js` (`isMatch`, `isMatchPair`) avant d'écrire la sienne.
- **Modifier `sw.js` ou un fichier précaché sans bumper `CACHE_NAME`**, et sans recopier la même valeur dans `VERSION_APP` (`js/multiview.js`). Un nouveau module `js/` s'ajoute à `APP_SHELL`.
- **Modifier `manifest.json`** sans le noter dans le `WORKLOG`.
- **Poser un attribut `sandbox`** sur une iframe de lecteur : retiré à la demande de l'utilisateur, certains lecteurs le détectent. Un test le verrouille.
- **Faire dépendre un test du réseau ou de l'heure.** Les tests de démarrage coupent le réseau et figent l'horloge ; suivre le même modèle.
- **Traiter un test qui tombe comme une instabilité.** Reproduire (`--repeat-each`), trouver la cause, corriger la cause.

## Le dépôt en bref

- Application statique (PWA) : `index.html` + modules `js/`, sans framework. `legacy.html` est l'interface classique sur le même moteur.
- Huit modules forment un cycle d'imports (`api`, `config`, `ui`, `multiview`, `main`, `utils`, `scrapers`, `state`). Un script ou un test qui importe le noyau importe `js/scrapers.js` en premier et pose `window.__NO_AUTOSTART__ = true`. Les autres modules sont sans import : garder cette propriété quand c'est possible.
- Données : `data/schedule.json` (calendrier, quotidien) et `data/streams.json` (liens, toutes les 30 min par relais) sont produits par `scripts/*.mjs` via les workflows ; `domains.json` porte les adresses courantes des sources. Ne pas les éditer à la main ; les régénérer avec les scripts si un test en a besoin.
- Outils : `package.json` ne porte que des dépendances de développement (`@playwright/test`, `playwright`, `jsdom`). Les scripts serveur utilisent le `fetch` natif de Node 22. Pas de Python.
- Tests : `npm test` (`node --test tests/*.test.js`, puis deux suites Playwright ; un fichier `tests/*.test.js` est pris en compte sans rien déclarer) ; `npm run test:domains` à part, parce qu'il dépend du réseau.
- Fuseau : toutes les heures sont celles de New York ; un match porte `matchDate` et `startTime` dans ce fuseau.

## Quand t'arrêter

Si tu écris le troisième patch consécutif sur le même fichier, ou si tu supprimes du code que tu viens d'écrire, ou si un test échoue encore après deux essais : **stop**. Écris dans `docs/WORKLOG.md` sous « ## Blocages » ce que tu as vu et ce que tu as essayé, et demande de l'aide à l'utilisateur. Ne détruis pas la base de code.

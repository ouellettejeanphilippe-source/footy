# AGENTS.md

## Règle d'or
Avant toute modification : lire `docs/ARCHITECTURE.md`, lire `docs/WORKLOG.md`, et **faire un grep de la fonction/symbole** avant de la créer ou de la supprimer. Prenez soin de la base de code, elle est votre environnement de travail.

## Workflow par tâche
1. Lire `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/WORKLOG.md`.
2. Écrire l'intention dans `docs/WORKLOG.md` sous la section "## En cours".
3. Faire le travail en manipulant avec parcimonie `index.html`.
4. Mettre à jour `docs/ARCHITECTURE.md` si un fichier ou une fonction publique a changé (par exemple, si vous extrayez une fonction de `index.html` vers un nouveau fichier JS).
5. Déplacer l'entrée du `docs/WORKLOG.md` vers "## Fait" avec date, fichiers touchés, résumé et problèmes restants.

## Anti-patterns interdits
- **Patches et scripts jetables en cascade** : La racine du projet est remplie de scripts comme `fix_favorites_rendering.js`, `check_custom_lg.py`, `fix_psg.py`, `test_sort.js`, `update_render.js`, etc. Il est **interdit** de créer de nouveaux fichiers de patch isolés sans plan clair d'intégration ou de suppression. Les utilitaires doivent être placés dans un sous-dossier ou intégrés à la suite de tests.
- **Suppression à l'aveugle** : Ne supprimez rien sans faire un grep complet. De nombreuses fonctions dépendent les unes des autres de manière implicite.
- **Recréation d'une fonction existante** : `index.html` contient plus de 130 fonctions. Par exemple, il existe deux déclarations de `cacheLogo`. Vérifiez toujours si une fonction utilitaire (`getOfficialTeamName`, `normName`, `esc`, `pad`) n'existe pas déjà.
- **Ajout de logique lourde dans `index.html`** : Le fichier fait plus de 9000 lignes. Toute nouvelle fonctionnalité DOIT être créée dans un fichier externe s'il n'y a pas d'obligation stricte.
- **Modification du service worker sans bump** : Toute modification de `sw.js` doit s'accompagner d'une mise à jour de `CACHE_NAME`.
- **Modification du manifest** : Toute modification de `manifest.json` doit être loggée dans le WORKLOG.

## Règles spécifiques au stack détecté
- Application Front-End (PWA) reposant quasi exclusivement sur un unique fichier `index.html` (qui embarque HTML, CSS, et JS applicatif).
- Multiview Cleaner : Script GreaseMonkey/Tampermonkey embarqué (`multiview-cleaner.user.js`).
- Scripts Python et JS à la racine : Présence de code Python gérant vraisemblablement des routines d'audit (`check_db.py`, `check_js.py`, `run_checks.py`), et un `package.json` contenant `playwright`, `jsdom`, `node-fetch`, `express`. L'environnement est principalement testé localement via protocole `file://` avec Playwright.

## Règles PWA spécifiques à ce repo
- **Service worker** : `./sw.js`
- **Stratégie de cache actuelle** : Cache prioritaire ("Cache-First") pour l'accès hors ligne minimal (`./index.html` et `./manifest.json` sont mis en cache lors de l'installation).
- **Stockage local** : Utilisation intensive du `localStorage` (ex: `api_calendar_cache` pour la sauvegarde du calendrier, préférences utilisateur).
- **Schéma de migration** : Pas de schéma formel. Le localStorage est purgé ou écrasé manuellement si besoin.

## Quand t'arrêter
Si tu écris le 3e patch consécutif sur le même fichier, OU tu supprimes du code que tu viens d'écrire, OU un test Playwright/Python échoue après 2 essais : **STOP**. Écris dans `docs/WORKLOG.md` sous "## Blocages" et demande de l'aide à l'utilisateur. Ne détruis pas la base de code !
# WORKLOG

Journal append-only. Format strict : entrées datées, du plus récent au plus ancien.

## En cours
- Rien.

## Blocages
*(Aucun pour l'instant)*

## À faire (backlog)
- **Nettoyage Code** : Résoudre le doublon détecté pour la fonction `cacheLogo` (définie deux fois) dans `index.html`.
- **Refactoring (Long terme)** : Découper le fichier `index.html` monolithique (>9000 lignes) en fichiers externes (`styles.css`, `app.js`, `scrapers.js`, `constants.json`).
- **PWA** : Améliorer `sw.js` (actuellement très basique avec uniquement un cache de base) pour implémenter une vraie stratégie de cache dynamique.

## Fait

### 30 April 2026 — Fix parsing logic for mlbbite, nflbite, streameast, onhockey, and buffstreams
- **Fichiers touchés** : `index.html`
- **Résumé** : Created dedicated parsers `parseMlbbite` and `parseNflbite`. Updated existing parsers `parseStreameast`, `parseOnHockey`, and `parseBuffstreams`. Replaced the direct `parseFootybite` calls in `loadAll` with the new specific parsers for those sites.
- **Problèmes restants** : None for these parsers.


### 29 April 2026 — Nettoyage de la dette technique et mise à jour du workflow
- **Fichiers touchés** : `AGENTS.md`, `docs/WORKLOG.md` (et suppression de nombreux scripts de test)
- **Résumé** : Suppression de tous les scripts de patchs jetables, des fichiers `.txt`, `.log`, et `.png` à la racine. Ajout d'une règle stricte dans `AGENTS.md` imposant le nettoyage de tout fichier de test avant chaque fin de tâche (étape 5 du Workflow).
- **Problèmes restants** : Aucun (nettoyage complet de la racine).

### 25 Avril 2024 — Bootstrap initial du système de mémoire
- **Fichiers créés** : `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/WORKLOG.md`
- **Résumé** : Audit initial du repo. `ARCHITECTURE.md` généré depuis l'état actuel du code. Identification d'un code massivement monolithique (`index.html`), de la gestion offline/PWA de base, de [1] doublon flagrant (`cacheLogo`) et d'environ [10+] fichiers de patch à éliminer.
- **Problèmes connus** :
  - Le code JS/HTML/CSS est fortement entremêlé dans `index.html`, rendant le suivi des fonctions difficile.
  - La racine du projet est extrêmement polluée par des scripts de développement/test non nettoyés.

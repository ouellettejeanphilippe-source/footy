# Sports Guide - Documentation & Architecture

Ce document décrit l'architecture complète, la philosophie et toutes les fonctions clés de l'application **Sports Guide**. Il sert de référence exhaustive pour comprendre comment l'application est construite et éviter de supprimer accidentellement des fonctionnalités.

## 🟡 Fonctionnalités en cours / À faire (À FAIRE)

1.  **Amélioration de la Grille Temporelle EPG (Mobile)**
    *   Optimisation des performances de scroll horizontal sur mobile.
    *   *Touch targets* améliorées pour l'ajout au Multiview depuis la grille.

2.  **Précision du Tracking des Matchs (Partiellement FAIT)**
    *   Synchronisation plus fine de la durée des événements selon le sport (ex: un match de boxe dure différemment d'un match de NFL). Actuellement, fallback à ~105/120 min par défaut.
    *   Mise à jour en temps réel des scores sans rafraîchir complètement la grille (via WebSocket ou Polling discret).

3.  **Fiabilité du Scraping**
    *   Rotation dynamique des proxies CORS si l'un d'eux échoue ou devient lent.
    *   Ajout de nouvelles sources de scraping de backup.

4.  **Filtres et Navigation**
    *   Recherche globale plus rapide (auto-complétion).
    *   Bouton "Retour au direct" plus visible lors de la navigation dans le calendrier.

---

## 🧠 Philosophie du Projet

1.  **Architecture "API-First"** : Le guide TV utilise des sources de données officielles (API ESPN gratuite et API-Sports via clé) comme **stricte source de vérité** pour construire la grille des matchs. Cela empêche les doublons et assure des horaires exacts.
2.  **Scraping Chirurgical en Fallback** : L'application scrape des sites de streaming (Footybite, Buffstreams, Streameast) en utilisant des proxies CORS (`fetchPage`). Les matchs trouvés sont "fusionnés" (merge) dans la grille API-First grâce à un algorithme de similarité de chaînes (Fuzzy Matching).
3.  **Expérience Utilisateur Premium (Apple TV / Prime Video)** : L'interface est pensée pour être fluide, sombre, avec des dégradés subtils. Les interactions doivent être rapides et on-demand (lazy-loading des streams au clic).
4.  **Tout-en-un (Single File)** : Tout le code (HTML, CSS, JS) réside dans `index.html` pour une portabilité et une simplicité maximales.

---

## 🏗️ Fonctionnalités Principales (UI/UX)

-   **Grille EPG (Electronic Program Guide)** : L'interface principale est une ligne du temps stricte de 24h (00:00 à 23:59). Les matchs sont positionnés en positionnement absolu (`left`, `width`) selon leur heure de début en EST (Eastern Standard Time) et leur durée.
-   **Indicateur "Now"** : Une ligne rouge indique l'heure actuelle sur la grille. (L'autoscroll vers cette ligne au chargement a été retiré pour permettre de voir le début de la journée).
-   **Lecteur Multiview** : Possibilité de regarder jusqu'à 4 flux simultanément en *split-screen*. Utilisation du Drag & Drop HTML5 pour réorganiser les lecteurs. Possibilité de recadrer (crop) ou changer la source d'un flux à la volée.
-   **Picture-in-Picture (PiP) Interne** : Le lecteur peut être minimisé en bas à droite (ou transformé en colonne latérale en mode Multiview) pour continuer de naviguer dans l'EPG.
-   **Isolation des Lecteurs** : Les iframes de stream utilisent l'attribut `sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-popups-to-escape-sandbox"` pour bloquer les alertes, redirections parentes, tout en autorisant les popups nécessaires à l'initialisation de certains lecteurs tiers.

---

## 📜 Dictionnaire des Fonctions JavaScript (`index.html`)

Voici la liste exhaustive des fonctions présentes dans l'application et leur rôle.

### 1. Helpers & Utilitaires
*   `pad(n)` : Ajoute un zéro initial aux nombres < 10 (ex: "09" au lieu de "9").
*   `esc(s)` : Échappe le HTML pour prévenir les failles XSS.
*   `escJs(s)` : Échappe les guillemets et apostrophes pour insérer des strings en toute sécurité dans les gestionnaires d'événements inline (ex: `onclick="..."`).
*   `lg(label, val)` : Fonction de log interne poussant dans `S.log` (visible via le modal de Debug).

### 2. Gestion du Temps (EST)
*   `getEstDateStrFromDate(d)` : Retourne la date au format YYYY-MM-DD en fuseau EST.
*   `getEstTimeStrFromDate(d)` : Retourne l'heure (HH:MM) en fuseau EST, en gérant le bug minuit (24:00 -> 00:00).
*   `getEstTime(ukTimeStr)` : Convertit une heure UK (généralement fournie par les scrapers) en EST (approx. -5h).

### 3. Logique de Similarité (Fuzzy Matching)
Ces fonctions servent à faire correspondre le nom des équipes venant d'ESPN (ex: "Paris Saint Germain") avec celles scrapées (ex: "PSG" ou "Paris SG").
*   `levenshtein(a, b)` : Calcule la distance de Levenshtein entre deux chaînes.
*   `stringSimilarity(s1, s2)` : Retourne un score de 0.0 à 1.0 basé sur Levenshtein.
*   `isMatch(name1, name2)` : Fonction principale qui décide si deux noms d'équipe correspondent (score > 0.75 ou sous-chaîne incluse).

### 4. Fetching & Data (API First)
*   `fetchEspnSchedule(leaguePath, dateStr)` : Appel à l'API gratuite d'ESPN.
*   `fetchApiSportsFixtures(sportInfo, dateStr)` : Appel à API-Sports (nécessite la clé API locale). Met en cache pour 4 heures.
*   `getApiFirstMatches(targetDate)` : Fonction orchestratrice. Récupère le calendrier depuis ESPN et API-Sports pour la date cible (en incluant veille/lendemain pour les fuseaux horaires) et construit le tableau de base `matches`.
*   `updateMatchDataFromApi(match, apiFixture, sport)` : Met à jour le statut, le score, la minute et les logos d'un match existant à partir de nouvelles données API.

### 5. Scraping & Parsing (Alternative Streams)
*   `fetchPage(url)` : Utilise l'un des 3 proxies CORS configurés (`PROXIES`) pour récupérer le code HTML d'une URL externe.
*   `parseFootybite(html)` : Extrait chirurgicalement la liste des matchs de Footybite en analysant `.div-child-box`, `.txt-team`, `.time-txt`.
*   `parseStreameast(html)` : Extrait les matchs de Streameast en lisant les attributs `data-team1`, `data-time2`, etc.
*   `parseBuffstreams(html)` : Extrait les matchs de Buffstreams via une regex lisant les données JSON injectées dans la page.
*   `extractFootybiteLogos(doc)` : Extrait et met en cache les URL des logos depuis Footybite.
*   `fetchSubPages(matches)` : Système de queue asynchrone (concurrency=3) pour aller scraper individuellement la page de stream de chaque match.
*   `scrapeMatchStreams(m)` : Analyse la page de détail d'un match (ex: sur Footybite) pour trouver les iFrames, tableaux de liens (`<tr><td>`), ou boutons (`.btn-danger`) contenant les URLs des streams finaux. Filtre agressivement les domaines de pub/paris (1xbet, bet365).

### 6. Fusion des Données (Merge Logic)
*   `mergeMatches(mainList, newList)` : Fusionne deux listes de matchs (souvent de sources de scrapings différentes) en évitant les doublons d'équipes ou de streams.
*   `mergeStreamsToApi(apiMatches, scrapedMatches)` : Fusionne les matchs scrapés dans le squelette "API-First". Si un match scrapé ne correspond à aucun match API, il est relégué dans la catégorie visuelle "Autres Streams" ou "📡" avec une couleur grise, pour le séparer du calendrier officiel.

### 7. Interface EPG & Filtres
*   `buildEPG(matches)` : Construit la grille TV 24h. Trie les ligues, gère le filtrage (Live, À venir, Recherche, Sport), calcule les positions `left` et `width` en pixels via `hourPx` et `minPx`, et génère le HTML des lignes de compétition et des blocs de matchs (`.mb`).
*   `updateNowLine()` : Positionne la ligne rouge verticale de l'heure actuelle.
*   `applySearch(q)`, `applyFilter(f)`, `applySportFilter()`, `changeDate(dStr)` : Gestionnaires d'état pour le filtrage et changement de date.
*   `toggleLeague(lgName)` / `toggleAccordion(lgName)` : Affiche/Masque des compétitions entières dans la vue.

### 8. Modal & Lecteur (Player)
*   `renderStreamItem(s, i, m)` : Génère le HTML standardisé d'un bouton de stream (utilisé dans la modal et la sidebar du player).
*   `openMod(m, col)` : Ouvre la modale listant les streams disponibles pour un match. Lance le scraping (lazy-load) si non fait.
*   `closeMod()` : Ferme la modale.
*   `openStream(e, eu, en, mid)` : Instancie le lecteur "Faux Full-screen" (`player-bg`) avec l'iFrame sandboxée. Construit la barre latérale pour zapper et voir les suggestions.
*   `populatePlayerSidebar(currentMatch, currentUrl)` : Remplit la sidebar du lecteur avec les flux alternatifs et les autres matchs "Live".
*   `minimizePlayer()` / `restorePlayer()` : Gère la transition entre le lecteur plein écran et le mode Picture-in-Picture (PiP) via des CSS injectés dynamiquement.
*   `closePlayer()` : Détruit proprement le lecteur et réaffiche la grille EPG.

### 9. Multiview (Split-screen)
*   `setupMultiviewUI()` : Construit les éléments DOM nécessaires au Multiview (Boutons Header, Grille, Toolbar).
*   `toggleMultiview()` / `clearMultiview()` : Ouvre/Ferme le conteneur Multiview et vide les streams.
*   `addToMultiview(url, name, mid)` / `removeFromMultiview(idx)` : Ajoute ou retire un flux de la grille. Limite hardcodée à 4 flux.
*   `updateMultiviewLayout()` : Refait le layout CSS Grid (1x1, 1x2, 2x2) selon le nombre de flux et génère les iframes draggable avec leur overlay d'outils (changement source, crop, fermeture).
*   `toggleMultiviewPip()` : Alterne entre le Multiview plein écran et une vue colonne latérale à droite, permettant de voir l'EPG.
*   `showMatchSelector(event)` / `showStreamSelector(idx, mid, event)` : Menus contextuels custom permettant de rajouter un match ou de changer de stream directement depuis l'interface Multiview.
*   `toggleCrop(idx, event)` : Zoom (`scale(1.15)`) un iframe Multiview pour cacher les bords de certains players ou rogner les publicités encastrées.

### 10. Préférences Utilisateur
*   `toggleFavTeam(teamName)` : Ajoute/Enlève l'étoile ★ et met à jour le localStorage.
*   `toggleDomainPref(domain, type, mid)` : Gère les boutons ⭐ et 👎 des domaines de streaming.
*   `sortStreamLinks(links)` : Trie la liste des streams d'un match pour mettre les domaines favoris en haut et dépriorisés en bas.
*   `cacheLogo(teamName, url)` / `getLogo(teamName)` : Sauvegarde dans le localStorage les URLs de logos trouvées en cours de route.
*   `openSettings()` / `saveSettings()` : Gestion de la clé API-Sports.

### 11. Initialisation
*   `loadAll()` : Fonction Master. Réinitialise le `State` (S), affiche l'écran de chargement (`#ov`), lance `getApiFirstMatches`, puis lance le scraping en parallèle (`fetchPage`), merge tout avec `mergeStreamsToApi`, popule les options de filtrage et appelle `buildEPG()`.
*   *(Au chargement initial, l'heure EST est générée et `loadAll()` est appelé pour lancer le processus).*

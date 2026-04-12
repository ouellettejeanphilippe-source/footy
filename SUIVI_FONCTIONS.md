# 📜 Dictionnaire des fonctions JavaScript (`index.html`)

Voici la liste exhaustive des fonctions présentes dans l'application et leur rôle.

### 1. Fonctions utilitaires (Helpers)
*   `pad(n)` : Ajoute un zéro initial aux nombres < 10 (ex: "09" au lieu de "9").
*   `esc(s)` : Échappe le HTML pour prévenir les failles XSS.
*   `escJs(s)` : Échappe les guillemets et apostrophes pour insérer des chaînes de caractères en toute sécurité dans les gestionnaires d'événements en ligne (ex: `onclick="..."`).
*   `lg(label, val)` : Fonction de journalisation interne poussant dans `S.log` (visible via la modale de débogage).

### 2. Gestion du temps (EST)
*   `getEstDateStrFromDate(d)` : Retourne la date au format YYYY-MM-DD dans le fuseau horaire EST.
*   `getEstTimeStrFromDate(d)` : Retourne l'heure (HH:MM) dans le fuseau horaire EST, en gérant le bogue de minuit (24:00 -> 00:00).
*   `getEstTime(ukTimeStr)` : Convertit une heure du Royaume-Uni (généralement fournie par les sites de moissonnage) en EST (environ -5h).

### 3. Logique de similarité (Fuzzy Matching)
Ces fonctions servent à faire correspondre le nom des équipes provenant d'ESPN (ex: "Paris Saint Germain") avec celles moissonnées (ex: "PSG" ou "Paris SG").
*   `levenshtein(a, b)` : Calcule la distance de Levenshtein entre deux chaînes de caractères.
*   `stringSimilarity(s1, s2)` : Retourne un score de 0.0 à 1.0 basé sur la distance de Levenshtein.
*   `isMatch(name1, name2)` : Fonction principale qui décide si deux noms d'équipe correspondent (score > 0.75 ou sous-chaîne incluse).

### 4. Récupération et données (API First)
*   `fetchEspnSchedule(leaguePath, dateStr)` : Appel à l'API gratuite d'ESPN.
*   `fetchApiSportsFixtures(sportInfo, dateStr)` : Appel à API-Sports (nécessite la clé API locale). Met en cache pour 4 heures.
*   `getApiFirstMatches(targetDate)` : Fonction orchestratrice. Récupère le calendrier depuis ESPN et API-Sports pour la date cible (en incluant la veille et le lendemain pour les fuseaux horaires) et construit le tableau de base `matches`.
*   `updateMatchDataFromApi(match, apiFixture, sport)` : Met à jour le statut, le pointage, la minute et les logos d'un match existant à partir de nouvelles données de l'API.

### 5. Moissonnage et analyse (Alternative Streams)
*   `fetchPage(url)` : Utilise l'un des 3 serveurs mandataires (proxies) CORS configurés (`PROXIES`) pour récupérer le code HTML d'une URL externe.
*   `parseFootybite(html)` : Extrait chirurgicalement la liste des matchs de Footybite en analysant `.div-child-box`, `.txt-team`, `.time-txt`.
*   `parseStreameast(html)` : Extrait les matchs de Streameast en lisant les attributs `data-team1`, `data-time2`, etc.
*   `parseBuffstreams(html)` : Extrait les matchs de Buffstreams via une expression régulière lisant les données JSON injectées dans la page.
*   `extractFootybiteLogos(doc)` : Extrait et met en cache les URL des logos depuis Footybite.
*   `fetchSubPages(matches)` : Système de file d'attente asynchrone pour aller moissonner individuellement la page de flux de chaque match.
*   `scrapeMatchStreams(m)` : Analyse la page de détail d'un match pour trouver les iFrames, tableaux de liens, ou boutons contenant les URL des flux finaux. Filtre agressivement les domaines publicitaires ou de paris.

### 6. Fusion des données (Merge Logic)
*   `mergeMatches(mainList, newList)` : Fusionne deux listes de matchs (souvent de sources de moissonnage différentes) en évitant les doublons d'équipes ou de flux.
*   `mergeStreamsToApi(apiMatches, scrapedMatches)` : Fusionne les matchs moissonnés dans le squelette "API-First". Si un match moissonné ne correspond à aucun match de l'API, il est relégué dans la catégorie visuelle "Autres flux" ou "📡" avec une couleur grise, pour le séparer du calendrier officiel.

### 7. Interface du guide (EPG) et filtres
*   `buildEPG(matches)` : Construit la grille télé de 24h. Trie les ligues, gère le filtrage (En direct, À venir, Recherche, Sport), calcule les positions en pixels, et génère le code HTML des lignes de compétition et des blocs de matchs (`.mb`).
*   `updateNowLine()` : Positionne la ligne rouge verticale de l'heure actuelle.
*   `applySearch(q)`, `applyFilter(f)`, `applySportFilter()`, `changeDate(dStr)` : Gestionnaires d'état pour le filtrage et le changement de date.
*   `toggleLeague(lgName)` / `toggleAccordion(lgName)` : Affiche ou masque des compétitions entières dans la vue.

### 8. Modale et lecteur (Player)
*   `renderStreamItem(s, i, m)` : Génère le code HTML standardisé d'un bouton de flux (utilisé dans la modale et la barre latérale du lecteur).
*   `openMod(m, col)` : Ouvre la modale listant les flux disponibles pour un match. Lance le moissonnage si non fait.
*   `closeMod()` : Ferme la modale.
*   `openStream(e, eu, en, mid)` : Instancie le lecteur avec l'iFrame isolée. Construit la barre latérale pour zapper et voir les suggestions.
*   `populatePlayerSidebar(currentMatch, currentUrl)` : Remplit la barre latérale du lecteur avec les flux alternatifs et les autres matchs en direct.
*   `minimizePlayer()` / `restorePlayer()` : Gère la transition entre le lecteur plein écran et le mode Image sur image (PiP).
*   `closePlayer()` : Détruit proprement le lecteur et réaffiche la grille EPG.

### 9. Multivision (Split-screen)
*   `setupMultiviewUI()` : Construit les éléments du DOM nécessaires à la Multivision.
*   `toggleMultiview()` / `clearMultiview()` : Ouvre ou ferme le conteneur Multivision et vide les flux.
*   `addToMultiview(url, name, mid)` / `removeFromMultiview(idx)` : Ajoute ou retire un flux de la grille. Limite de 4 flux.
*   `updateMultiviewLayout()` : Refait la disposition CSS Grid selon le nombre de flux et génère les iframes déplaçables avec leur superposition d'outils.
*   `toggleMultiviewPip()` : Alterne entre la Multivision en plein écran et une vue en colonne latérale.
*   `showMatchSelector(event)` / `showStreamSelector(idx, mid, event)` : Menus contextuels pour rajouter un match ou changer de flux.
*   `toggleCrop(idx, event)` : Zoom une iframe Multivision pour cacher les bords ou rogner les publicités.

### 10. Préférences de l'utilisateur
*   `toggleFavTeam(teamName)` : Ajoute ou enlève l'étoile ★ et met à jour le stockage local.
*   `toggleDomainPref(domain, type, mid)` : Gère les boutons ⭐ et 👎 des domaines de diffusion.
*   `sortStreamLinks(links)` : Trie la liste des flux d'un match pour mettre les domaines favoris en haut.
*   `cacheLogo(teamName, url)` / `getLogo(teamName)` : Sauvegarde dans le stockage local les URL des logos.
*   `openSettings()` / `saveSettings()` : Gestion de la clé API-Sports.

### 11. Initialisation
*   `loadAll()` : Fonction maîtresse. Réinitialise l'état (`S`), affiche l'écran de chargement, lance `getApiFirstMatches`, lance le moissonnage en parallèle, fusionne le tout, remplit les options de filtrage et appelle `buildEPG()`.

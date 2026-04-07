# Sports Guide - Roadmap & Fonctionnalités

## 🟢 Fonctionnalités Implémentées (FAITES)

1.  **Architecture "API-First" & Agrégation de données**
    *   Utilisation de l'API ESPN et API-Sports (avec clé) comme source de vérité pour le calendrier.
    *   Algorithme de "Fuzzy Matching" pour fusionner les matchs scraped (Footybite, Buffstreams, Streameast) avec les données API.

2.  **Streaming & Extraction**
    *   Extraction asynchrone des liens de stream (avec fallback sur l'interface du site).
    *   Sandboxing des iFrames (`sandbox="allow-scripts allow-same-origin allow-presentation"`) pour bloquer les redirections indésirables et les pop-ups (Extraction de la vidéo pure).
    *   Système de priorisation des flux (`⭐ Favoris` / `👎 Dépriorisés`) persistant via `localStorage`.

3.  **Expérience Utilisateur (UI/UX)**
    *   **Lecteur Vidéo Intégré ("Faux Full-screen")** : Lecteur ne quittant pas l'application avec barre latérale pour zapper entre les streams ou voir les suggestions Live.
    *   **Mode Picture-in-Picture (PiP) In-App** : Possibilité de réduire le lecteur dans un coin de l'écran pour continuer à naviguer dans le guide.
    *   **Multiview (Split-screen)** : Possibilité de regarder jusqu'à 4 streams simultanément. Disposition dynamique (1x1, 1x2, 2x2, etc.) et réorganisation par glisser-déposer (Drag & Drop HTML5).
    *   **Grille Temporelle EPG avec Ligne du temps** (Récemment ajouté) : Affichage des événements sous forme de blocs proportionnels à leur durée. La ligne du temps (rouge) traverse les blocs en direct à la position exacte (ex: 20h30 pour un match de 19h à 22h).

4.  **Préférences et Stockage Local**
    *   Sauvegarde de la clé API-Sports.
    *   Sauvegarde des équipes favorites (`★`).
    *   Mise en cache intelligente des logos d'équipes.

---

## 🟡 Fonctionnalités en cours / À faire (À FAIRE)

1.  **Amélioration de la Grille Temporelle EPG (Mobile)**
    *   Optimisation des performances de scroll horizontal sur mobile.
    *   *Touch targets* améliorées pour l'ajout au Multiview depuis la grille.

2.  **Précision du Tracking des Matchs**
    *   Synchronisation plus fine de la durée des événements selon le sport (ex: un match de boxe dure différemment d'un match de NFL). Actuellement, fallback à ~105/120 min par défaut.
    *   Mise à jour en temps réel des scores sans rafraîchir complètement la grille (via WebSocket ou Polling discret).

3.  **Fiabilité du Scraping**
    *   Rotation dynamique des proxies CORS si l'un d'eux échoue ou devient lent.
    *   Ajout de nouvelles sources de scraping de backup.

4.  **Filtres et Navigation**
    *   Recherche globale plus rapide (auto-complétion).
    *   Bouton "Retour au direct" plus visible lors de la navigation dans le calendrier.

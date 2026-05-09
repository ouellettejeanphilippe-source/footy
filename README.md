# Guide des Sports - Documentation & Architecture

Ce document décrit l'architecture complète, la philosophie et les éléments clés de l'application **Guide des Sports**. Il sert de référence exhaustive pour comprendre comment l'application est construite.

## 🟡 Fonctionnalités en cours / À faire (À FAIRE)

1.  **Amélioration de la Grille Temporelle EPG (Mobile)**
    *   Optimisation des performances de défilement horizontal sur mobile.
    *   Zones tactiles (*Touch targets*) améliorées pour l'ajout à la Multivision depuis la grille.

2.  **Précision du suivi des matchs (Partiellement FAIT)**
    *   Synchronisation plus fine de la durée des événements selon le sport (ex: un match de boxe dure différemment d'un match de NFL). Actuellement, la valeur par défaut est de ~105/120 min.
    *   Mise à jour en temps réel des pointages sans rafraîchir complètement la grille (via WebSocket ou Polling discret).

3.  **Fiabilité du moissonnage (Scraping)**
    *   Rotation dynamique des serveurs mandataires (proxies) CORS si l'un d'eux échoue ou devient lent.
    *   Ajout de nouvelles sources de moissonnage de relève.

4.  **Filtres et Navigation**
    *   Recherche globale plus rapide (auto-complétion).
    *   Bouton "Retour au direct" plus visible lors de la navigation dans le calendrier.

---

## 🧠 Philosophie du Projet

1.  **Architecture "API-First"** : Le guide télé utilise des sources de données officielles (API ESPN gratuite et API-Sports via clé) comme **stricte source de vérité** pour construire la grille des matchs. Cela empêche les doublons et assure des horaires exacts.
2.  **Moissonnage chirurgical en relève** : L'application moissonne des sites de diffusion (Footybite, Buffstreams, Streameast) en utilisant des serveurs mandataires CORS (`fetchPage`). Les matchs trouvés sont "fusionnés" (merge) dans la grille API-First grâce à un algorithme de similarité de chaînes (Fuzzy Matching).
3.  **Expérience Utilisateur Premium (Apple TV / Prime Video)** : L'interface est pensée pour être fluide, sombre, avec des dégradés subtils. Les interactions doivent être rapides et sur demande (chargement paresseux des flux au clic).
4.  **Garantie de Noms Officiels (No duplicates)** : Les sites de streaming écrivent mal les noms d'équipes. Nous imposons une correspondance stricte via `STATIC_TEAM_MAP` lors du *parsing* afin de normaliser instantanément les noms moissonnés vers notre base de données. Plus de doublons !
5.  **Tout-en-un (Fichier unique)** : Tout le code (HTML, CSS, JS) réside dans `index.html` pour une portabilité et une simplicité maximales.

---

## 🏗️ Fonctionnalités Principales (UI/UX)

-   **Grille EPG (Electronic Program Guide)** : L'interface principale est une ligne du temps stricte de 24h (00:00 à 23:59). Les matchs sont positionnés en positionnement absolu (`left`, `width`) selon leur heure de début en EST (Eastern Standard Time) et leur durée.
-   **Indicateur "Maintenant"** : Une ligne rouge indique l'heure actuelle sur la grille.
-   **Lecteur Multivision** : Possibilité de regarder jusqu'à 4 flux simultanément en *écran divisé*. Utilisation du glisser-déposer HTML5 pour réorganiser les lecteurs. Possibilité de recadrer ou changer la source d'un flux à la volée.
-   **Image sur image (PiP) interne** : Le lecteur peut être minimisé en bas à droite (ou transformé en colonne latérale en mode Multivision) pour continuer de naviguer dans le guide.
-   **Isolation des lecteurs** : Les iframes de flux utilisent l'attribut `sandbox` pour bloquer les alertes et redirections, tout en autorisant les fenêtres contextuelles nécessaires à l'initialisation de certains lecteurs tiers.



## 🔧 Script d'Installation (Tampermonkey)

L'application utilise un script externe (Multiview cleaner) pour nettoyer les lecteurs vidéo au sein des iframes.
Vous pouvez l'installer depuis l'interface (dans Paramètres) ou via ce lien:
**[multiview-cleaner.user.js](./multiview-cleaner.user.js)**


---

## 📜 Dictionnaire des Fonctions JavaScript

Pour la liste complète et détaillée des fonctions JavaScript utilisées dans `index.html`, veuillez consulter le fichier **[SUIVI_FONCTIONS.md](./SUIVI_FONCTIONS.md)**.
Consultez le fichier [FEATURES.md](FEATURES.md) pour une documentation détaillée des fonctionnalités par onglet et menu.

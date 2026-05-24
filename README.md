# Guide des Sports - Documentation & Architecture

Ce document décrit l'architecture complète, la philosophie et les éléments clés de l'application **Guide des Sports**. Il sert de référence exhaustive pour comprendre comment l'application est construite.

## 🟡 Fonctionnalités en cours / À faire (À FAIRE)

1.  **Amélioration de la Grille Temporelle EPG (Mobile)**
    *   Optimisation des performances de défilement horizontal sur mobile.
    *   Zones tactiles (*Touch targets*) améliorées pour l'ajout à la Multivision depuis la grille.

2.  **Précision du suivi des événements (Partiellement FAIT)**
    *   Synchronisation plus fine de la durée des événements selon le sport (ex: un combat de boxe dure différemment d'un match de NFL). Actuellement, la valeur par défaut est de ~105/120 min.
    *   Mise à jour en temps réel des pointages sans rafraîchir complètement la grille (via WebSocket ou Polling discret).

3.  **Fiabilité de l'agrégation**
    *   Rotation dynamique des serveurs mandataires (proxies) CORS si l'un d'eux échoue ou devient lent.
    *   Ajout de nouvelles sources d'intégration multimédia de relève.

4.  **Filtres et Navigation**
    *   Recherche globale plus rapide (auto-complétion).
    *   Bouton "Retour au direct" plus visible lors de la navigation dans le calendrier.

---

## 🧠 Philosophie du Projet

1.  **Architecture "API-First"** : Le guide télé utilise des sources de données officielles (API ESPN gratuite) comme **stricte source de vérité** pour construire la grille des événements. Cela empêche les doublons et assure des horaires exacts.
2.  **Agrégation chirurgicale en relève** : L'application agrège des sources multimédias externes en utilisant des serveurs mandataires CORS (`fetchPage`). Les événements trouvés sont "fusionnés" (merge) dans la grille API-First grâce à un algorithme de similarité de chaînes (Fuzzy Matching).
3.  **Expérience Utilisateur Premium (Apple TV / Prime Video)** : L'interface est pensée pour être fluide, sombre, avec des dégradés subtils. Les interactions doivent être rapides et sur demande (chargement paresseux des lecteurs au clic).
4.  **Garantie de Noms Officiels (No duplicates)** : Les sources externes écrivent parfois mal les noms d'équipes. Nous imposons une correspondance stricte via `STATIC_TEAM_MAP` lors du *parsing* afin de normaliser instantanément les noms agrégés vers notre base de données. Plus de doublons !
5.  **Tout-en-un (Fichier unique)** : La grande majorité du code (HTML, CSS, JS) résidait historiquement dans un fichier unique pour la portabilité, l'architecture a depuis évolué en modules JS.

---

## 🏗️ Fonctionnalités Principales (UI/UX)

-   **Grille EPG (Electronic Program Guide)** : L'interface principale est une ligne du temps stricte de 24h (00:00 à 23:59). Les événements sont positionnés en positionnement absolu (`left`, `width`) selon leur heure de début en EST (Eastern Standard Time) et leur durée.
-   **Indicateur "Maintenant"** : Une ligne rouge indique l'heure actuelle sur la grille.
-   **Lecteur Multivision** : Possibilité de regarder jusqu'à 4 lecteurs multimédias simultanément en *écran divisé*. Utilisation du glisser-déposer HTML5 pour réorganiser les lecteurs. Possibilité de recadrer ou changer la source d'un lecteur à la volée.
-   **Image sur image (PiP) interne** : Le lecteur peut être minimisé en bas à droite (ou transformé en colonne latérale en mode Multivision) pour continuer de naviguer dans le guide.
-   **Isolation des lecteurs** : Les iframes des lecteurs utilisent l'attribut `sandbox` pour bloquer les alertes et redirections, tout en autorisant les fenêtres contextuelles nécessaires à l'initialisation de certains lecteurs tiers.

---

## 🧩 Extensions Recommandées

Pour garantir une expérience optimale, sans interruptions indésirables ni pop-ups lors du chargement des sources multimédias, il est fortement conseillé d'utiliser les extensions suivantes :

1.  **uBlock Origin** : Bloqueur de publicités et de traqueurs très efficace. Indispensable pour nettoyer les cadres des lecteurs vidéo et empêcher l'ouverture d'onglets indésirables.
2.  **Tampermonkey** : Gestionnaire de scripts utilisateur, requis pour exécuter le script "Multiview cleaner" détaillé ci-dessous.

---

## 🔧 Script d'Installation (Tampermonkey)

L'application utilise un script externe (*Multiview cleaner*) conçu pour interagir avec les lecteurs vidéo intégrés (iframes). Son rôle est d'automatiser certaines actions (comme la fermeture de calques superposés) et d'assurer une lecture continue.

**Comment l'installer :**
1. Installez l'extension **Tampermonkey** sur votre navigateur.
2. Ajoutez le script au navigateur via ce lien ou depuis les Paramètres de l'application : **[multiview-cleaner.user.js](./multiview-cleaner.user.js)**

---

## 📱 Création de l'application Android (APK)

Le projet utilise **Capacitor** pour encapsuler l'application web dans une application Android native. Voici les étapes pour générer l'APK :

**Prérequis :**
*   Node.js installé.
*   Android Studio installé et configuré (avec le SDK Android).

**Étapes :**
1. Installez les dépendances du projet si ce n'est pas déjà fait :
   ```bash
   npm install
   ```
2. Synchronisez les fichiers web vers le projet Android Capacitor :
   ```bash
   npx cap sync android
   ```
3. Ouvrez le projet dans Android Studio :
   ```bash
   npx cap open android
   ```
4. Dans Android Studio, attendez que la synchronisation Gradle soit terminée.
5. Allez dans le menu **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
6. Une fois la compilation terminée, Android Studio affichera une notification. Cliquez sur "locate" pour trouver le fichier `.apk` généré, prêt à être installé sur votre appareil Android.

---

## 📜 Dictionnaire des Fonctions JavaScript

Pour la liste complète et détaillée des fonctions JavaScript, veuillez consulter le fichier **[SUIVI_FONCTIONS.md](./SUIVI_FONCTIONS.md)**.
Consultez le fichier [FEATURES.md](FEATURES.md) pour une documentation détaillée des fonctionnalités par onglet et menu.

# Documentation des Fonctionnalités - Sports Guide

Ce fichier liste les fonctionnalités disponibles dans chaque onglet et menu de l'application.

## Onglet: GUIDE
- **Description** : Affiche tous les matchs disponibles sur une vue chronologique (EPG / Timeline).
- **Fonctionnalités** :
  - Ligne de temps horizontale (défilement gauche/droite pour voir les horaires).
  - Liste verticale des compétitions/ligues.
  - Défilement synchronisé entre la liste des canaux et la grille temporelle.
  - Les matchs sont affichés sous forme de blocs dans la grille temporelle.
  - Surlignage du moment actuel ("Now Line").
  - Regroupe les matchs par ligues.

## Onglet: EN DIRECT
- **Description** : Affiche les matchs actuellement en direct et ceux qui commencent imminemment (dans les 30 prochaines minutes).
- **Fonctionnalités** :
  - **Grille de matchs** : Affichage sous forme de cartes ("Match Cards").
  - **Indicateur de statut** : Badge "LIVE" ou minute de jeu (si disponible via l'API).
  - **Score en temps réel** : Affiche le score si le match a commencé.
  - **Séparation temporelle** : Les matchs qui vont commencer dans les 30 prochaines minutes sont listés en dessous sous la mention "À venir dans 30 minutes".
  - Tri par heure de début et par importance de la ligue.

## Onglet: FAVORIS
- **Description** : Liste les équipes favorites de l'utilisateur.
- **Fonctionnalités** :
  - Barre de recherche pour trouver et ajouter des équipes spécifiques.
  - Affichage dynamique des couleurs et du logo officiels de l'équipe sélectionnée.
  - Enregistrement des favoris (Persistance locale via LocalStorage).
  - Accès rapide au Match Center ("Global Stats") de l'équipe sélectionnée en cliquant sur la carte.
  - Les matchs des équipes favorites sont mis en avant globalement dans le Guide et dans l'onglet En direct.

## Bouton: MULTIVISION
- **Description** : Mode pour regarder plusieurs flux simultanément.
- **Fonctionnalités** :
  - **Compteur** : Affiche le nombre de flux actuellement actifs.
  - **Mode Layout** : Possibilité de changer la disposition (Auto, Focus, Vertical, Horizontal).
  - **Ajout de matchs** : Menu de sélection pour ajouter jusqu'à 4 matchs en même temps.
  - **Mode Cinéma (Theater)** : Permet de cacher l'UI de l'application pour se concentrer sur les flux vidéos.
  - **PIP (Picture in Picture)** : Maintien des flux en mode réduit lors de la navigation dans les autres onglets.
  - **Nettoyage Automatique** : Intègre un script de nettoyage (Multiview Cleaner) pour enlever les pubs dans les iframes.

## Menu: Filtres de Sports (Ligues)
- **Description** : Menu horizontal (ou déroulant sur mobile) pour filtrer l'affichage par ligue.
- **Fonctionnalités** :
  - Bouton "Tous" pour réinitialiser les filtres.
  - Boutons générés dynamiquement en fonction des ligues disponibles dans les données scrapées/API.
  - Permet de masquer/afficher rapidement certaines compétitions (NFL, NHL, Soccer, etc.).
  - Bouton dédié "Autres Flux" (souvent caché par défaut pour éviter le bruit).

## Menu: Paramètres (Hamburger / Secondaire)
- **Description** : Boutons d'actions globales de l'application.
- **Fonctionnalités** :
  - **🧩 Script** : Raccourci pour installer/mettre à jour le script Tampermonkey "Multiview Cleaner" qui gère la suppression des popups et des overlays invisibles sur les lecteurs vidéos tiers.
  - **↺ Actualiser** : Force un re-téléchargement des données (Fetch des APIs et des scrapers).
  - **⚙️ Paramètres** : Ouvre le menu modal de personnalisation avancée.

## Modal: Paramètres Avancés
- **Description** : Interface de personnalisation de l'application.
- **Fonctionnalités** :
  - **Disposition** : Positionnement de la navigation (Haut, Bas, Barre latérale gauche).
  - **Style des Cartes** : Solid, Verre (Glassmorphism), Bordure, etc.
  - **Style des Boutons** : Minimal, Solide, Brillant, Neon, etc.
  - **Thèmes (Palettes)** : Choix de palettes prédéfinies ou personnalisation complète des couleurs (Fonds, Accentuation).
  - **Arrière-plan** : Solide, Dégradé (Glow, Aurora), ou Grille.
  - **Textures UI** : CRT, Grain de film, Blur, etc.

## Modal: Global Stats (Match Center)
- **Description** : Centre d'informations détaillé pour une équipe ou un match.
- **Fonctionnalités** :
  - Affichage des statistiques de l'équipe.
  - Liste des matchs passés et à venir.
  - Liens vers les flux (streams) disponibles.

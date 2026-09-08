# Guide des Sports — l'interface, onglet par onglet

Ce document décrit ce que l'application montre et ce que chaque commande fait, tel que le code le fait aujourd'hui. Pour le fonctionnement interne (modules, données, algorithmes), voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Pour la prise en main et l'installation, voir le [README](README.md).

Toutes les heures affichées sont celles de New York (heure de l'Est), qui est le fuseau des sources.

## 1. La coquille

L'en-tête ne porte que quatre boutons. Sur téléphone (largeur ≤ 768 px), ils forment une barre fixe au bas de l'écran, icône au-dessus du libellé.

| Bouton | Ce qu'il ouvre |
|---|---|
| **Live** | Les matchs en cours et ceux qui commencent dans l'heure, en cartes. |
| **Guide** | Le programme complet du jour sur une grille horaire de 24 h. |
| **Lecteur** | Le Multivision : jusqu'à quatre vidéos côte à côte. Le bouton se marque quand des vidéos sont chargées et qu'on est ailleurs. |
| **Plus** | Un menu : `⭐ Favoris`, `⚙️ Options`, `📋 Logs`, `🧩 Script`, `↩ Interface classique`, `↻ Mettre à jour l'app`. Se ferme d'un clic à l'extérieur ou par Échap. |

Autres éléments toujours présents :

- **`↻ Actualiser`**, bouton flottant devant la grille : relit les liens du serveur, puis les scores ESPN, puis refait la fusion. L'icône tourne pendant l'opération, et un message dit combien de matchs ont des liens. Masqué sur les pages annexes ; réduit à l'icône sous 900 px.
- **Écran de chargement** au premier démarrage : « Connexion API… », puis trois étapes cochées (Téléchargement Guide télé, Recherche de streams, Fusion et Affichage). En cas d'échec, une boîte 📡 avec le message, le code replié et `↺ Réessayer`.
- **Messages** (toasts) en bas de l'écran, 2,5 s, remontés au-dessus de la barre d'onglets sur mobile.
- **Zoom** (`Maintenant`, `−`, pourcentage, `+`) en bas à droite, visible dans le Guide seulement.

Ce qui n'est **pas** dans cette coquille : la navigation par date, la recherche globale et les pastilles de filtre par ligue. Elles existent dans l'interface classique (section 9).

## 2. Onglet Live

Entrent dans le Live : les matchs en cours (annoncés en direct par la source, ou dont l'heure est passée depuis moins de quatre heures, ou qui commencent dans le quart d'heure) et ceux dont le coup d'envoi est dans les 60 minutes. Un match terminé selon ESPN en sort ; un match présumé fini (section 2.2) aussi.

### 2.1 Sections

Dans l'ordre, toutes repliables d'un clic, d'Entrée ou d'Espace sur leur titre (chevron et état mémorisés) :

| Section | Contenu | Par défaut |
|---|---|---|
| **Favoris** | Les matchs dont une équipe ou la ligue est favorite. | Dépliée |
| **Live** | Les matchs en cours. | Dépliée |
| **À venir dans l'heure** | Le reste. | Dépliée |
| **Ligues secondaires (n)** | Les ligues classées « secondaire » dans Favoris → Ligues, sous-groupées par ligue. | Dépliée |
| **Autres streams (n)** | Les flux que les sources annoncent sans qu'ESPN ait le match (ligue « Autres Flux »), sous-groupés par ligue annoncée. | Repliée |

Les ligues classées « ignorée » n'apparaissent nulle part. Quand rien n'est en cours, la page dit « Aucun match en direct pour le moment » avec un bouton `Ouvrir le Guide`.

### 2.2 La carte d'un match

De haut en bas :

1. **Bandeau d'état** : `Direct` avec une pastille rouge clignotante, ou l'heure du coup d'envoi, ou `Fin`, ou **`Fin ?`** en ambre. Le score d'un match en cours est redemandé **chaque minute**, et dès l'ouverture de l'application. « Fin ? » veut dire : ESPN ne donne plus de nouvelles de ce match depuis plus de 12 minutes et il a dépassé la durée normale de son sport de plus de 45 minutes (120 en prolongation connue). Le survol explique le calcul. Une nouvelle d'ESPN efface la présomption.
2. **Compteur de flux** à droite : `▶ N`. Sans aucun lien, le badge devient un bouton : **`🔎`** lance la recherche de liens pour ce match tout de suite ; **`⚠`** signale que le fichier des liens du serveur n'a pas pu être lu et le relit d'un toucher.
3. **Vignette** aux couleurs des deux équipes, avec leurs blasons.
4. **Ligue** (drapeau ou icône, nom).
5. **Équipes et score**, avec une ★ par équipe pour la mettre en favori. Une épreuve sans adversaire (course, gala, séance d'essais) n'a qu'une ligne.
6. **Sport et minute de jeu** quand la minute est parlante (période, manche, chrono).

Un clic ouvre la fiche du match (section 4).

### 2.3 Affiches et rails sur téléphone

Sous 900 px, les cartes deviennent des affiches verticales (2:3). Chaque section porte un bouton **`⇥ Rail`** / **`⊞ Grille`** : en grille (par défaut), trois affiches par ligne ; en rail, une seule ligne qui défile horizontalement. Le choix est retenu par section. Options → Forme des cartes force l'un ou l'autre format sur tous les écrans.

## 3. Onglet Guide

Une grille horaire de 00:00 à 24:00, une ligne par match, groupées par ligue.

- **Règle des heures** en haut, coin `Compétition` figé à gauche. Une heure fait 220 px sur ordinateur, 140 px sur téléphone, multiplié par le zoom (de 40 % à 300 %, par pas de 20 %).
- **Ligne du direct** : un trait rouge vertical avec l'heure en étiquette, déplacé chaque minute. Visible seulement si le jour affiché est aujourd'hui.
- **`Maintenant`** fait défiler la grille jusqu'à l'heure courante. C'est aussi ce que fait l'application à la fin d'un chargement et à chaque retour sur le Guide.
- **Lignes de ligue** : un en-tête collant (drapeau, nom, nombre de matchs) qui se replie d'un clic, puis une ligne par match avec les équipes (blasons, ★ favori) et un bloc positionné à l'heure du coup d'envoi, large comme la durée normale du sport. Un match en cours qui dépasse sa durée voit son bloc s'allonger jusqu'à l'heure courante.
- **Bloc** : `LIVE` ou la minute, le score, `Terminé | score`, `Fin ? | score`, ou l'heure ; et `N flux` à droite. Le clic ouvre la fiche.
- **Un match commencé la veille au soir** qui joue encore après minuit est dessiné à partir de 00:00, sur ce qui lui reste, et passe avant les matchs de la nuit dans les listes.
- **Ligues secondaires (n)** : leur propre grille, sous un titre repliable. **Autres streams (n)** : en cartes, repliée.

## 4. Fiche de match

S'ouvre au clic sur une carte ou un bloc. Se ferme par la croix `✕` en haut à droite, par Échap, ou par un clic sur le fond. Sur téléphone, c'est une feuille qui monte du bas, avec un bouton `✕ Fermer` permanent en pied.

### 4.1 Bannière

Fond aux couleurs des équipes ; blason, nom et ★ de chaque côté ; au centre la ligue, le score (ou `VS`), et l'état (`Direct`, la minute, `Fin`, `Fin ?`).

### 4.2 Compléments (matchs ESPN seulement)

Affichés dès qu'ils ont du contenu, rafraîchis toutes les 5 minutes pendant un direct :

- buteurs par équipe (`⚽ Joueur 45' (passeur)`),
- classement et forme récente (`#rang`, série),
- `📰 Stats complètes sur ESPN`,
- `📊 Voir les statistiques de la saison` : comparatif des deux équipes adapté au sport (buts et passes au football ; points, victoires, défaites et défaites en prolongation au hockey ; victoires, défaites, pourcentage et retard en MLB ; victoires, défaites, pourcentage et séquence ailleurs), et `Ouvrir le panneau complet` vers le panneau « Scores & Stats ».

### 4.3 Colonne des flux

- **Barre `Flux`** : **`🔄`** relit la page du match et refait la liste (grisé quand aucune page de match n'est connue) ; **`⊞`** envoie le meilleur flux au Multivision (le premier en 4K s'il y en a un, sinon un au hasard) et ferme la fiche.
- **Pastilles par domaine** quand il y a au moins deux domaines et six liens : `Tous N`, les six premiers domaines, `Autres (k)`. Elles filtrent la liste sous les yeux.
- **Une ligne par flux** : icône, nom, badge `onglet` si la page refuse l'iframe, chaîne, site, langue, et le débit ou la définition réellement mesurés quand le script utilisateur les a vus. Quatre actions par ligne :
  1. `⭐` préférer ce domaine (il remonte dans tous les classements),
  2. `👎` l'éviter (il descend),
  3. `⊞` ajouter au Multivision,
  4. `↗` ouvrir dans un nouvel onglet.
  Le clic sur la ligne elle-même envoie le flux au Multivision.
- **Aucun flux** : « Aucun flux trouvé pour l'instant. » et, si la page du match est connue, `Ouvrir la page du match ↗`.
- **Recherche manuelle et sites sources** (repli en bas) : les sites sources avec leur nombre de flux, un champ pour ajouter un flux à la main (m3u8, iframe, URL) au Multivision, un champ de diagnostic pour extraire les lecteurs d'une URL, et les flux isolés trouvés.
- Tant que la fiche est ouverte, la page du match est relue toutes les 60 secondes ; la liste n'est redessinée que si de nouveaux flux jouables apparaissent.

## 5. Lecteur (Multivision)

### 5.1 Barre d'outils

| Bouton | Effet |
|---|---|
| **➕ Ajouter** | Réduit le lecteur et invite à choisir un match dans le guide. |
| **⊞ Disposition** | `Automatique`, `Une grande, les autres à côté`, `Les unes sous les autres`, `Côte à côte`. En portrait, deux vidéos ou plus sont toujours empilées, sans perdre le choix. |
| **⛶ Plein écran** | Le lecteur seul, en plein écran. La barre et les en-têtes s'effacent après 3 s sans souris. |
| **⋯ Plus** | `⤢ Ajuster toutes les images`, `🎬 Mode cinéma`, `📊 Scores et statistiques`, `🖼 Fenêtre détachée` (navigateurs qui le permettent), `◫ Réduire dans un coin` / `⤢ Agrandir`, `◫ Panneau latéral`, `🗗 Fenêtre flottante`, `✕ Fermer toutes les vidéos`. |
| **➖ Réduire** / **⤢ Agrandir** | Visibles quand le lecteur est réduit. |

Les menus s'ouvrent par-dessus les tuiles, entiers, un seul à la fois ; ils se ferment d'un clic ailleurs, par Échap, au défilement ou au redimensionnement ; les flèches ↑/↓ s'y déplacent.

### 5.2 Dispositions automatiques

Une vidéo : plein cadre. Deux : deux colonnes. Trois : une grande à gauche, deux à droite. Quatre : 2 × 2. Les colonnes se redimensionnent à la souris. Quatre vidéos au maximum (« Maximum 4 streams en Multivision »).

### 5.3 Modes réduits

Trois façons de garder le lecteur pendant qu'on navigue dans le guide, retenues d'une fois à l'autre :

- **Panneau latéral** : colonne de 350 px à droite, redimensionnable ; le guide se décale. Indisponible sous 768 px.
- **Fenêtre flottante** : position et taille mémorisées.
- **Réduit dans un coin** : une barre de 44 px.

Quitter le plein écran vers le guide réduit automatiquement le lecteur.

### 5.4 La tuile

En-tête : poignée de glissement, numéro (`Touche N`), pastille **`source k/n`** (précédée de `●` quand une vidéo joue, avec le débit mesuré et « · direct »), `⏭` source suivante, `▶ direct` / `🖼 page` quand un flux direct a été repéré, bouton d'ajustement, puis **`↗ Site`**, le menu **`⋮`** et **`✕`**.

- **Au repos** : trois secondes sans un geste et la barre comme les en-têtes de tuiles s'effacent, pour laisser la vidéo seule. Un mouvement les rappelle. En mode réduit dans la page, ils restent : le lecteur est déjà petit. En fenêtre détachée, ils s'effacent comme en plein écran.
- **Ajustement** (bouton de tuile, ou `⤢` de la barre pour toutes) : *étiré* (le cadre prend toute la tuile), *ajusté* (16:9 entier, centré), *rempli* (16:9 couvrant la tuile). Retenu par tuile.
- **Menu ⋮** : ouvrir sur le site, source suivante, choisir une autre source, changer de match, recharger la vidéo, infos et statistiques ; l'ajustement ; lire le flux direct ou revenir à la page ; déplacer à gauche ou à droite ; préférer ou éviter ce site ; fermer cette vidéo.
- **Réordonner** : glisser-déposer entre tuiles (poignée masquée sur écran tactile), ou le menu.
- **Son** : une seule tuile a le son, celle qui a le focus, sinon la première. On donne le focus en cliquant dans la tuile ; un liseré le signale.
- **Clavier** (hors champ de saisie) : `1` à `4` amènent la tuile en tête et lui donnent le son ; `5` à `8` l'amènent en tête sans toucher au son ; Échap ferme un menu.

### 5.5 Ce qui se passe dans la tuile

La page du site est chargée telle quelle dans une iframe, sans attribut `sandbox` (certains lecteurs le détectent et refusent de jouer). Les adresses YouTube et Twitch sont converties en lecteur intégré. Un flux direct (`.m3u8`) est joué par un lecteur vidéo natif.

- **Choix du flux** : les liens sont classés (observations de lecture, domaines préférés, qualité annoncée) et la tuile essaie le mieux classé. **Avec le script utilisateur**, si aucune vidéo n'est signalée en 30 s (90 s pour un hôte connu comme lent), la tuile passe seule à la source suivante, une fois par lien. Sans le script, seul `⏭` change de source.
- Les sources des matchs affichés sont relues toutes les 3 minutes.
- **Sortie forcée** : si un site fait quitter la page dans les 15 s qui suivent la pose d'une tuile, l'adresse est notée dix minutes. Au retour, la tuile dit « Ce site a fait sortir la page du lecteur » avec `↗ Ouvrir sur le site` et `Charger quand même`.

### 5.6 Panneau « Scores et statistiques »

Colonne de 350 px accolée au lecteur, deux onglets (`Stats du Match`, `Scores Live`), matchs épinglables, rafraîchie toutes les 5 minutes.

## 6. Favoris (menu Plus → ⭐ Favoris)

Deux volets (onglets `Équipes` / `Ligues` sur téléphone) :

- **Équipes** : la liste par ligue avec une ★ par équipe, une recherche instantanée, et `⭐️ MES FAVORIS` en tête. Un favori met ses matchs dans la section Favoris du Live et en avant dans le Guide.
- **Ligues** : glisser-déposer (ou ▲/▼) pour l'ordre d'affichage, et pour chaque ligue trois niveaux, **Principale**, **Secondaire**, **Ignorée**, plus `↺` pour revenir au réglage par défaut. `Réinitialiser l'ordre` et `Réinitialiser le classement` remettent tout d'aplomb.

## 7. Options (menu Plus → ⚙️ Options)

« L'apparence d'abord ; le réseau et les outils avancés sont repliés plus bas. » Chaque changement est enregistré aussitôt (« Préférences sauvegardées »).

### 7.1 Apparence

| Option | Choix |
|---|---|
| **Palettes rapides** | 37 palettes nommées, plus une palette par équipe favorite. |
| **Style du fond** | Couleur unie, Dégradé doux, Grille subtile, Maillage aléatoire. |
| **Couleurs du fond** | Trois couleurs (base, intermédiaire, extrémité). |
| **Couleur d'accentuation** | La couleur des boutons et des mises en avant. |
| **Assombrissement du fond** | Curseur 0 à 100. |
| **Retirer le noir des maillages** | Interrupteur. |
| **Forme des boutons** | Arrondis, Doux, Rectangulaires. |
| **Forme des cartes** | Automatique (affiche sous 900 px), Affiche verticale (2:3), Carte large (2,4:1). |
| **Couleur des cartes** | Dégradé extérieur → domicile, Dégradé diagonal, Deux couleurs pleines, Couleur de l'équipe à domicile, Couleur de la ligue, Foncé. |
| **Interface classique** | Bascule vers l'ancienne présentation (section 9). Retenu d'une ouverture à l'autre. |
| **Mode TV / tablette** | Zoom 1,3×, contour de focus très visible, navigation aux flèches et Entrée (télécommande). |

### 7.2 Réseau & proxys (replié, avancé)

- **État** : le cache serveur des liens (matchs, liens, sources, âge), chaque proxy CORS avec une pastille de santé, et le **pont du script utilisateur** (« actif (v1.8) » ou « absent »).
- `Proxy personnalisé`, `Clé API cors.sh`, `Clé API corsproxy.io`, puis `💾 Enregistrer et retester`.
- `♻️ Réinitialiser l'historique` des proxys.
- `▶️ Lancer le calcul sur GitHub` ouvre le workflow qui régénère les liens ; `🔄 Recharger les liens serveur` les relit tout de suite.

### 7.3 Outils (replié, avancé)

- **Scraper Investigator** : analyse l'adresse d'une page de lecteur, enregistre la séquence de clics qui mène à la vidéo et sauvegarde des règles réutilisées ensuite.
- **Sauvegarde** : `Exporter (.json)` (préférences, favoris, ordre des ligues) et `Importer`.

## 8. Logs (menu Plus → 📋 Logs)

- **Cet appareil** : six lignes ✅ / ⚠️ / ❌ pour comparer deux appareils qui ne voient pas la même chose. Calendrier (nombre de matchs, source, âge), ESPN (réponses sur tentatives, dernière erreur), Liens (`data/streams.json`, âge), Fusion (« N matchs sur M ont des liens »), Stockage local (Ko, écritures refusées), Version (`sports-guide-v14`, service worker actif ou non). Puis `↻ Mettre à jour l'application`.
- **État des sources** du dernier scraping : pastille, nom, bouton 🕵️ vers l'Investigator, message, nombre de matchs, heure.
- **Liens par domaine primaire** (`↻ Recalculer`) : combien de liens, d'intégrables, de pages et de matchs par fournisseur, sous-domaines repliés sur le domaine principal.
- **Historique des requêtes** : journal horodaté, `📋 Copier le log` sur les entrées longues, `📥 Exporter` (fichier `jmtv-debug-logs-<date>.json`).
- **Diagnostics des flux manuels** : les rapports produits par la recherche manuelle de la fiche.

## 9. Interface classique

`Plus → ↩ Interface classique` (retour par `☰ → ✨ Nouvelle interface`). Même moteur, ancienne présentation :

- onglets en haut de page, sans barre du bas ;
- une barre d'outils avec `↻` (scores), **`🔎 Liens manquants`** (relance la recherche pour tous les matchs à venir sans lien, avec une barre de progression), le **sélecteur de date** (`❮`, `Aujourd'hui` / `Hier` / `Demain` ou la date, cliquable pour un calendrier, `❯`) et les **pastilles de ligues** (`Toutes` puis une par ligue, avec compteur) ;
- les mêmes pages Favoris, Options, Logs et Script, sous d'autres titres.

## 10. Script utilisateur (menu Plus → 🧩 Script)

La page recommande **Firefox + uBlock Origin**, explique ce qui peut bloquer les tuiles sous Firefox (en-tête X-Frame-Options, lecture automatique, protection contre le pistage) et guide en trois étapes : le bloqueur, Tampermonkey, puis `Installer le script`. Une fenêtre le propose aussi au tout premier lancement.

Ce que le script **Multiview Stream Cleaner** (version 1.8) fait, et que l'application ne peut pas faire seule :

- dans chaque page de lecteur : bloque les fenêtres surgissantes et les détournements dès le premier octet de la page, retire tout ce qui entoure le lecteur et les calques invisibles, lance la vidéo (`play()`, muet si nécessaire, puis le gros bouton de lecture des lecteurs connus), obéit aux ordres de son (`mv_mute` / `mv_unmute`), et remonte à l'application l'état de lecture, le débit et la définition, et les adresses de flux direct qu'il voit passer ; sur mobile, ajoute `📱 Force Native Player (Cast)` et `📺 Open in Cast App` ;
- dans l'application : sert de **pont** pour télécharger les pages des sources depuis l'adresse de l'utilisateur, là où les proxys CORS sont refusés. Options → Réseau montre s'il est actif.

## 11. Application installable (PWA)

`Sports Guide` (nom court `Sports`) s'installe depuis le navigateur : icône, plein écran, cache hors ligne de toute la coquille. En ligne, c'est toujours la version publiée qui s'affiche (réseau d'abord, cache en repli). `↻ Mettre à jour l'app` retire le service worker, vide ses caches et recharge la version publiée, **sans toucher** aux réglages, favoris et liens locaux.

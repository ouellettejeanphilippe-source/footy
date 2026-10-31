# Guide des Sports — l'interface, onglet par onglet

**L'identité visuelle** (29 octobre 2026, « le ui et le ux font cheap… style streaming ») : un fond noir bleuté et neutre, la couleur venant des équipes (vignettes, bandeau vedette, bannière de la fiche) ; les textes en Inter, les scores, minutes et heures en Barlow Condensed ; des icônes au trait à la place des emoji ; le rouge ne dit que « en direct ».

Ce document décrit ce que l'application montre et ce que chaque commande fait, tel que le code le fait aujourd'hui. Pour le fonctionnement interne (modules, données, algorithmes), voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Pour la prise en main et l'installation, voir le [README](README.md).

Toutes les heures affichées sont celles de New York (heure de l'Est), qui est le fuseau des sources.

## 1. La coquille

L'en-tête porte quatre onglets, comme un service de vidéo (29 octobre 2026, « Live et Guide la page principale et les autres des onglets accessibles dans la page principale »), et le bouton **▶ Lecteur** à droite. Sur téléphone (largeur ≤ 768 px), les onglets forment une barre fixe au bas de l'écran, icône au-dessus du libellé, et ▶ Lecteur flotte au-dessus d'elle, seulement quand une vidéo tourne.

| Bouton | Ce qu'il ouvre |
|---|---|
| **Live** | Les matchs en cours et ceux qui commencent dans l'heure, en cartes. |
| **Guide** | Le programme sur une grille horaire de **48 h** : aujourd'hui et demain, d'une seule traite. |
| **Favoris** | Les équipes et ligues favorites (section 6). |
| **Réglages** | Ce que portait le menu « Plus » jusqu'au 29 octobre 2026, en sous-onglets en tête de page : `Options`, `Look`, `Script`, `Logs`, et à droite `Actualiser`, `Mettre à jour l'app`, chacun avec son icône. L'onglet reste allumé sur chacune de ces pages ; le bandeau de l'état des liens n'y est pas. |
| **▶ Lecteur** | Le Multivision, en plein écran (section 5). Il dit combien de vidéos tournent quand on est ailleurs. Ce n'est plus un onglet : le lecteur couvre tout l'écran, onglets compris. |

Autres éléments toujours présents :

- **`Réglages → ↻ Actualiser`** : relit les liens du serveur, puis les scores ESPN, puis refait la fusion. L'icône tourne pendant l'opération, et un message dit combien de matchs ont des liens.
- **Écran de chargement** au premier démarrage : « Connexion API… », puis trois étapes cochées (Téléchargement Guide télé, Recherche de streams, Fusion et Affichage). En cas d'échec, une boîte 📡 avec le message, le code replié et `↺ Réessayer`.
- **Bandeau de l'état des liens**, juste au-dessus de la grille. Les liens sont republiés toutes les 30 min ; quand ça s'arrête, l'application le dit au lieu de servir des liens d'avant-hier sans un mot (ce qu'elle a fait pendant 45 h les 10-12 septembre 2026) :
  - moins de 45 min : rien du tout (la gigue du cron ne se raconte pas) ;
  - à partir de 45 min, en gris : « Liens datant de 50 min : un passage du serveur a été manqué », avec `↻ Actualiser` ;
  - passé 90 min, ou si le fichier est injoignable, en ambre : « le serveur ne publie plus », avec **`🔎 Chercher les liens ici`** — l'application va alors lire elle-même les pages des matchs qu'on peut regarder maintenant, et le bandeau montre l'avancement (« 2/4 matchs lus — 1 pourvu »). Elle le fait aussi d'elle-même, une fois le chargement fini, et prévient par un message quand un match reçoit ses liens.
- **Messages** (toasts) en bas de l'écran, 2,5 s, remontés au-dessus de la barre d'onglets sur mobile.
- **Zoom** (`Maintenant`, `−`, pourcentage, `+`) en bas à droite, visible dans le Guide seulement.

Ce qui n'est **pas** dans l'application : la navigation par date, la recherche globale et les pastilles de filtre par ligue. Elles vivaient dans l'interface classique, retirée le 30 septembre 2026.

## 2. Onglet Live

Entrent dans le Live : les matchs en cours (annoncés en direct par la source, ou dont l'heure est passée depuis moins de quatre heures, ou qui commencent dans le quart d'heure) et ceux dont le coup d'envoi est dans les 60 minutes. Un match terminé selon ESPN en sort ; un match présumé fini (section 2.2) aussi.

### 2.1 Sections

Le Live s'ouvre sur un **bandeau vedette** (27 octobre 2026, « pages plus proches des services de streaming… dans le sens de navigation ») : un match en grand, aux couleurs des équipes, avec la ligue, le score ou l'heure, et un seul bouton blanc **Regarder** qui ouvre sa fiche ; c'est le premier arrêt de la télécommande. Comme l'affiche d'un film (29 octobre 2026) : les deux blasons en grand à droite, sur les couleurs des équipes ; à gauche « À la une », la ligue, le titre, l'état. Le match mis en avant est un favori en direct, sinon le direct le plus fourni en flux, sinon le prochain à commencer.

Dessous, dans l'ordre, toutes repliables d'un clic, d'Entrée ou d'Espace sur leur titre (chevron et état mémorisés) :

| Section | Contenu | Par défaut |
|---|---|---|
| **Favoris** | Les matchs dont une équipe ou la ligue est favorite. | Dépliée |
| **Une section par ligue** | Les matchs en cours et ceux qui commencent dans l'heure, ligue par ligue dans l'ordre des ligues (« fait des sections par ligue dans LIVE », 27 octobre 2026) ; dans chaque section, le direct d'abord, puis l'heure. Les anciennes sections « Live » et « À venir dans l'heure » à plat n'existent plus. | Dépliée |
| **Ligues secondaires (n)** | Les ligues classées « secondaire » dans Favoris → Ligues, sous-groupées par ligue. | Dépliée |
| **Autres streams (n)** | Les flux que les sources annoncent sans qu'ESPN ait le match (ligue « Autres Flux »), sous-groupés par ligue annoncée. | Repliée |

Les ligues classées « ignorée » n'apparaissent nulle part. Quand rien n'est en cours, la page dit « Aucun match en direct pour le moment » avec un bouton `Ouvrir le Guide`.

### 2.2 La carte d'un match

Une vignette 16:9 (29 octobre 2026, comme une tuile de service de streaming), le texte dessous :

1. **Sur la vignette, à gauche, l'état** : `DIRECT` en pastille rouge, ou l'heure du coup d'envoi, ou `FIN`, ou **`Fin ?`** en ambre ; précédé de **`hier`** pour un match de la veille encore dans la journée (ou `demain`). Le score d'un match en cours est redemandé **chaque minute**, et dès l'ouverture de l'application. « Fin ? » veut dire : ESPN ne donne plus de nouvelles de ce match depuis plus de 12 minutes et il a dépassé la durée normale de son sport de plus de 45 minutes (120 en prolongation connue). Le survol explique le calcul. Une nouvelle d'ESPN efface la présomption.
2. **Sur la vignette, à droite, le nombre de flux** : triangle de lecture et nombre. Sans aucun lien, la pastille devient un bouton : la **loupe** lance la recherche de liens pour ce match tout de suite ; le **triangle d'alerte** signale que le fichier des liens du serveur n'a pas pu être lu et le relit d'un toucher.
3. **La vignette** aux couleurs des deux équipes (selon Réglages → Look), sous un voile, avec leurs blasons dans un disque blanc (les initiales de l'équipe quand il n'y a pas de blason). Un match terminé a une vignette grisée.
4. **La ligue** en surtitre, avec sa pastille de couleur — sauf dans la rangée d'une ligue, qui la porte déjà en titre.
5. **Équipes et score** (chiffres compacts). L'étoile de favori suit le nom : pleine et dorée pour un favori ; sinon elle n'apparaît qu'au survol (à la souris ; au doigt, le favori se choisit dans la fiche). Une épreuve sans adversaire (course, gala, séance d'essais) n'a qu'une ligne.
6. **La minute de jeu**, en rouge, quand elle est parlante (période, manche, chrono).

Un clic ouvre la fiche du match (section 4).

### 2.3 Affiches et rails sur téléphone

Sous 900 px, les cartes prennent la forme « affiche » : la vignette en 4:3, la carte en portrait, deux par ligne au téléphone. Chaque section porte un bouton **Rail** / **Grille** : au téléphone, en grille par défaut (un seul axe au pouce) ; **sur un grand écran, en rangée par défaut** (27 octobre 2026) : chaque ligue est une rangée horizontale, comme sur Netflix. Le choix est retenu par section. Options → Forme des cartes force l'un ou l'autre format de carte sur tous les écrans.

**À la manette et à la télécommande** (29 octobre 2026, « positionnements pas ambigus ») : ▼ va de « Regarder » à la première rangée, puis d'une rangée à l'autre, sans s'arrêter sur le titre de la section ni sur son bouton Rail / Grille (le titre d'une section repliée reste un arrêt, pour la rouvrir) ; il prend la carte la mieux alignée de la rangée suivante, jamais une rangée plus loin. ◀ ▶ parcourent la rangée. ▲ ramène à la carte d'où l'on venait. La carte qui a le focus : sa vignette grossit, cerclée de blanc, avec la lueur de l'équipe.

## 3. Onglet Guide

Une grille horaire de **48 heures** — de 00:00 aujourd'hui à 00:00 après-demain —, une ligne par match, groupées par ligue.

**Pourquoi 48 h.** Un match à 02:00 est daté de *demain* : à 23 h, il était donc invisible, et le seul moyen de le voir était de changer de jour, ce qui faisait disparaître la soirée en cours. Les matchs de la nuit (l'Europe le matin, l'Asie la nuit) sont précisément ceux qu'on cherche quand on regarde tard. La règle est maintenant continue : **la frontière de minuit porte « demain »** et un liseré vertical la marque dans la grille ; un match de 02:00 demain est à sa place naturelle, deux heures après cette frontière.

- **Règle des heures** en haut, coin `Compétition` figé à gauche. Une heure fait 220 px sur ordinateur, 140 px sur téléphone, multiplié par le zoom (de 40 % à 300 %, par pas de 20 %).
- **Ligne du direct** : un trait rouge vertical avec l'heure en étiquette, déplacé chaque minute. Visible seulement si le jour affiché est aujourd'hui — et **minuit ne la fait plus disparaître** : quand la journée change sous l'application ouverte, celle-ci bascule d'elle-même sur le nouveau jour (au plus 30 s, ou dès le retour au premier plan), sans écran d'attente et sans perdre le match en cours.
- **`Maintenant`** fait défiler la grille jusqu'à l'heure courante. C'est aussi ce que fait l'application à la fin d'un chargement et à chaque retour sur le Guide.
- **Lignes de ligue** : un en-tête collant (drapeau, nom, nombre de matchs) qui se replie d'un clic, puis une ligne par match avec les équipes (blasons, ★ favori) et un bloc positionné à l'heure du coup d'envoi, large comme la durée normale du sport. Un match en cours qui dépasse sa durée voit son bloc s'allonger jusqu'à l'heure courante.
- **Bloc** : `LIVE` ou la minute, le score, `Terminé | score`, `Fin ? | score`, ou l'heure, précédé de `hier · ` pour un match d'hier soir ; et `N flux` à droite. Le clic ouvre la fiche.
- **Un match commencé la veille au soir** qui joue encore après minuit est dessiné à partir de 00:00, sur ce qui lui reste, et passe avant les matchs de la nuit dans les listes.
- **Un match de demain** porte `demain · ` devant son heure, sur la case comme sur la carte. Les liens de demain sont là aussi : le cache du serveur couvre les deux journées.
- **Ligues secondaires (n)** : leur propre grille, sous un titre repliable. **Autres streams (n)** : en cartes, repliée.

## 3 bis. Look (Réglages → Look)

Un menu, sous la barre des Réglages : **la couleur des cartes** (Uni, Dégradé, Dégradé de côté, Deux couleurs, Ligue, Neutre), pour les vignettes du Live, la bannière de la fiche et le liseré des cases du Guide. Échap ou un clic ailleurs le ferme ; depuis les Réglages, un choix montre le Live.

Les dispositions (Tableau, Maintenant, Affiches, Chaînes, pour le Live et le Guide) sont parties le 29 octobre 2026 (« Tout retirer ») : une seule vue par onglet. Un ancien choix resté dans le stockage ne change plus rien.

**Le Guide façon câble** (25 octobre 2026, « plus clean et plein écran, comme le câble dans le temps ») : la grille d'un guide de câblodistributeur, fond bleu nuit, cases plates aux coins presque droits séparées par un filet, la case choisie en jaune. Une case porte « Domicile – Extérieur » sur une ligne avec les deux logos, puis l'heure (ou le direct, le score) et le nombre de liens ; les couleurs des équipes ne sont qu'un liseré à gauche. À la manette, les ★ de la colonne des équipes ne sont pas des arrêts.

## 4. Fiche de match

S'ouvre au clic sur une carte, un bloc ou le bouton **▶ Regarder** du bandeau vedette, et occupe **tout l'écran**, sur tous les écrans (27 octobre 2026 : une page, comme la fiche d'un film sur un service de streaming, plus une boîte au milieu). Se ferme par la croix `✕` en haut à droite, par Échap ou Retour. Sur téléphone, elle monte du bas, avec un bouton `✕ Fermer` permanent en pied. À la télécommande, le focus entre sur **▶ Regarder** et reste dans la fiche. **Les statistiques** (buteurs, classement, alignements) sont **au-dessus des flux**, jamais à côté (31 octobre 2026). **Le flux choisi** au clavier, à la manette ou à la télécommande se met en valeur **en entier** (fond plus clair et anneau sur toute la ligne), comme au survol de la souris.

### 4.1 Bannière

Fond aux couleurs des équipes ; blason, nom et ★ de chaque côté ; au centre la ligue, le score (ou `VS`), et l'état (`Direct`, la minute, `Fin`, `Fin ?`).

Dessous, comme une page de film : un gros bouton blanc **Regarder** (triangle de lecture) qui lance la meilleure source de la liste (filtres de site compris), avec son nom à côté. À la télécommande ou à la manette, c'est lui qui a le focus à l'ouverture. Sans source : `Chercher des liens` (loupe), ou `Aucun lien pour l'instant`. Les blasons sont grands, le score en chiffres compacts.

### 4.1 bis Radio (31 octobre 2026)

Sous le bouton **Regarder**, une section **Radio** : une ligne par équipe (domicile, puis visiteur). Pour une équipe de la **LNH**, la **station TuneIn de l'équipe** (« Station de l'équipe · TuneIn »), qui diffuse ses matchs ; pour les **Canadiens**, aussi **TSN 690** (anglais) et **98,5 FM** (français). Pour **tout match**, deux boutons par équipe, **Chercher sur TuneIn** et **Chercher sur iHeartRadio** (une recherche au nom de l'équipe, sans garantie qu'une station le diffuse : la note de la section le dit). Aucune station n'est inventée : en NBA, NFL, MLB, MLS et au soccer, seules les recherches s'affichent, faute de source qui dise quelle station diffuse quoi. Les liens s'ouvrent dans un nouvel onglet ; à la télécommande et à la manette, chacun est un arrêt.

### 4.2 Compléments (matchs ESPN seulement)

Affichés dès qu'ils ont du contenu, rafraîchis toutes les 5 minutes pendant un direct :

- buteurs par équipe (`⚽ Joueur 45' (passeur)`),
- classement et forme récente (`#rang`, série),
- les **alignements** ne sont plus ici (29 octobre 2026, « alignements seulement lorsque stats en direct dans le multiview, pas dans la carte des streams ») : voir le panneau des stats du lecteur (§5.7),
- `📰 Stats complètes sur ESPN`,
- `📊 Voir les statistiques de la saison` : comparatif des deux équipes adapté au sport (buts et passes au football ; points, victoires, défaites et défaites en prolongation au hockey ; victoires, défaites, pourcentage et retard en MLB ; victoires, défaites, pourcentage et séquence ailleurs), et `Ouvrir le panneau complet` vers le panneau « Scores & Stats ».

### 4.3 Colonne des flux

- **Barre `Flux`** : le bouton rond **actualiser** relit la page du match et refait la liste (grisé quand aucune page de match n'est connue). Son ancien `⊞` (« meilleur flux au Multivision ») doublait « ▶ Regarder » et est parti.
- **Pastilles par domaine** quand il y a au moins deux domaines et six liens : `Tous N`, les six premiers domaines, `Autres (k)`. Elles filtrent la liste sous les yeux.
- **Une ligne par flux** : icône (triangle de lecture, ou maillon pour une page qui s'ouvre souvent en onglet), nom, badge `onglet` si la page refuse souvent l'iframe, chaîne, site, langue, et le débit ou la définition réellement mesurés quand le script utilisateur les a vus. Deux actions par ligne, à la souris et au doigt :
  1. l'étoile : préférer ce domaine (il remonte dans tous les classements ; dorée quand c'est fait),
  2. le pouce vers le bas : l'éviter (il descend ; rouge quand c'est fait).
  Le clic sur la ligne elle-même envoie le flux au Multivision (le `⊞` qui faisait la même chose est parti) ; à la télécommande et à la manette, la ligne est un seul arrêt et OK la lance. **Aucun lien ne mène au site lui-même** (25 octobre 2026, « pas de liens vers le vrai site, jamais ») : ni `↗` par flux, ni « Ouvrir la page du match », ni liens vers les sites sources.
- **Les sites connus d'abord** (25 octobre 2026, « pour être fiables ») : après tes ⭐ / 👎 et ce qui a été vu jouer (un lien vu jouer passe devant un nom connu ; ce qui a été vu mort reste derrière), à jouabilité égale, les liens de Streamed et DaddyLive passent en tête, puis ceux de Methstreams, Streameast, TotalSportek, CricHD, CDNLiveTV, VIPLeague et MyBuffstreams, puis le reste (dont les agrégateurs comme Sportsurge ou Footybite, qui renvoient vers des hôtes pris au hasard). Les liens que le serveur de vérification ne peut pas atteindre (les sites qui bloquent les centres de données : Methstreams, MyBuffstreams, les miroirs Streameast) ne sont plus retirés depuis le 26 octobre 2026 : ils restent, marqués « à essayer » dans la fiche, classés derrière ce qui a été vu jouer et devant ce qui a été vu mort, et c'est ton appareil qui apprend s'ils jouent chez toi (« ici 3/4 »). Un site connu qui, essayé dix fois, n'a jamais joué perd sa place ; un hôte connu que la vérification mesure sous 20 % de lectures aussi (26 octobre 2026 : embed.st, à 1 sur 38, passait en tête devant des liens jamais essayés), et un hôte jugé mort sur cet appareil.
- **L'ordre apprend de ton appareil.** Les liens sont rangés d'après ce qui a été vu jouer : par le serveur d'abord, puis par ton appareil, qui prend le dessus dès qu'il a essayé un site trois fois. Un site qui n'a jamais joué chez toi descend tout seul, marqué `ici 0/N`, même si le serveur l'a vu jouer ; il remonte dès qu'il joue. Quand la vérification a vu un lien jouer, sa définition réelle (« 1080p ») s'affiche et sert au tri à la place de la qualité annoncée. Un `⏭` appuyé sur une source qui n'a rien montré (entre 8 s et 90 s après son chargement) compte comme un échec, avec ou sans script utilisateur.
- **Aucun flux** : « Aucun flux trouvé pour l'instant. »
- **Recherche manuelle et sites sources** (repli en bas) : les sites sources avec leur nombre de flux, un champ pour ajouter un flux à la main (m3u8, iframe, URL) au Multivision, un champ de diagnostic pour extraire les lecteurs d'une URL, et les flux isolés trouvés.
- Tant que la fiche est ouverte, la page du match est relue toutes les 60 secondes ; la liste n'est redessinée que si de nouveaux flux jouables apparaissent.

## 5. Lecteur (Multivision)

### 5.1 Barre d'outils

**Le lecteur couvre tout l'écran** (29 octobre 2026, « multiview devrait pas juste être plein écran… comme les plateformes de streaming normales ») : ni onglets, ni bandeau, ni barre du bas au-dessus de lui (du 25 au 29 octobre, c'était un onglet, sous l'en-tête). On en sort par **← Retour**, le premier bouton de la barre (une flèche seule sur téléphone), par Échap quand aucun menu du lecteur n'est ouvert (sinon Échap ferme d'abord le menu), ou par la touche Retour : vers la page d'où l'on venait (la touche Retour, vers le Live). **Des commandes de service de streaming** (29 octobre 2026, « refaire la row de boutons dans le lecteur plus proche des streaming platforms ») : des boutons ronds à icône au trait, leur nom en infobulle au survol et au focus (sauf quand un lecteur Twitch est à l'écran : rien ne doit être peint sur lui), un séparateur entre la vidéo choisie et le lecteur, et un seul bouton plein, blanc : **+ Ajouter**, tout à droite. La seule barre du lecteur (25 octobre 2026 : « moins all over the place »), en bas, par-dessus la vidéo, comme sur Netflix ; ses boutons sont blancs, sans capsule derrière, et le bouton qui a le focus grossit et se souligne. Elle s'efface avec les en-têtes après trois secondes sans un geste et revient au moindre mouvement ou toucher. **Avec une vidéo Twitch** (28 octobre 2026), la barre passe sous les vidéos et reste affichée, et l'en-tête de la tuile Twitch passe au-dessus de son image : sur Chrome et Vivaldi, le lecteur Twitch refuse de jouer, ou s'arrête, dès que quoi que ce soit est posé sur lui. Ouvrir un menu du lecteur par-dessus l'arrête encore. Au clavier, à la télécommande ou à la manette, la première touche ne fait que la ramener (focus sur `⏭`), la suivante agit ; en mode câble, les flèches zappent quand même. Trois groupes, de gauche à droite :

1. **Les vidéos**, une pastille chacune : numéro et match. La vidéo choisie est en blanc et dit sa source (`● source 2/5 · direct`) ; à partir de trois vidéos, les autres ne gardent que leur numéro. Une pastille (ou un clic dans la tuile, ou `1` à `4`) choisit la vidéo sur qui agit le groupe suivant.
2. **La vidéo choisie** : source précédente / suivante, `Direct` / `Page du site` quand un flux direct répond (§5.4), `Seule` / `Toutes` (29 octobre 2026, façon Prime Video, dès deux vidéos : la vidéo choisie prend tout le lecteur, les autres restent chargées ; une pastille change la vidéo vue seule ; Retour ramène la grille ; aussi dans le menu `⋮`), `Son` (haut-parleur / barré) couper ou remettre son son (28 octobre 2026 ; aussi dans son menu `⋮`, « Couper le son » ; une vidéo coupée reste muette même choisie ; les lecteurs Twitch et YouTube gardent leur propre bouton de son), `⋮` son menu.
3. **Le lecteur** :

| Bouton | Effet |
|---|---|
| **+ Ajouter** | Ouvre **Choisir les matchs** (29 octobre 2026, façon Prime Video) : les matchs en direct qui ont un lien, en cartes (ligue, logos, score, nombre de liens), ceux du lecteur en tête et déjà cochés. On en coche jusqu'à quatre, puis **Regarder (n)** : les vidéos décochées partent, les matchs cochés arrivent avec leur meilleur lien jouable, celles qui restent ne rechargent pas. **Annuler**, ✕, Échap ou Retour ne changent rien ; **Tous les matchs** mène au Live. |
| **Plein écran** | Le lecteur seul, en plein écran. La barre et les en-têtes s'effacent après 3 s sans souris. |
| **Réglages** (engrenage ; « ⋯ Plus » jusqu'au 25 octobre 2026) | `⊞ Disposition`, un sous-menu (le bouton de la barre est parti le 25 octobre 2026) : `Automatique`, `Une grande, les autres à côté`, `Les unes sous les autres`, `Côte à côte`, puis, sous « Autres fenêtres » et seulement là, `🖼 Fenêtre détachée` (navigateurs qui le permettent ; dès deux vidéos, la vidéo 1 reste dans la page et les autres s'y empilent, une par-dessus l'autre), `🖥 Deux écrans` (ordinateur : la fenêtre étirée, §5.3 bis) et `🗗 Deux écrans : deux fenêtres` (ordinateur) ; en portrait, deux vidéos ou plus sont toujours empilées, sans perdre le choix. Puis `⤢ Ajuster toutes les images`, `🎬 Mode cinéma`, `📊 Scores et statistiques`, `📺 Mode câble (une seule vidéo, zapping au doigt)`, `🔊 Son automatique`, `▶ Direct automatique` (allumé par défaut, 29 octobre 2026 : une vidéo dont le flux direct répond le joue sans la page du site, plus léger, une fois par lien ; remise en page à la main, elle y reste ; un toast le dit), `🛡 Bloquer les redirections des sites` (allumé par défaut : si une vidéo tente d'emmener l'onglet sur son site juste après un clic dedans, le navigateur demande « Quitter le site ? » ; répondre non. Sans clic, Firefox la bloque déjà lui-même. Le script (1.17) empêche en plus les pages des vidéos de faire reculer ou avancer l'onglet dans l'historique, sans rien demander ; sur ordinateur, l'appli l'absorbe aussi d'elle-même, script ou pas, et l'affiche brièvement (« ⛔ Une vidéo a voulu faire reculer l'onglet : bloqué »). Reculer soi-même passe toujours : ← du navigateur, Alt+←, boutons de la souris, balayage du pavé tactile. La garde ne s'arme que si une tuile affiche la page d'un site, pas en mode direct ni pendant le chargement, et se lève d'elle-même quand c'est toi qui pars : pointeur monté vers les onglets ou la croix, boutons Précédent et Suivant de la souris, Ctrl+W, Ctrl+R, F5, onglet en arrière-plan. Fermer ou recharger l'onglet ne demande donc rien), `✕ Fermer toutes les vidéos`. |

Les menus s'ouvrent par-dessus les tuiles, entiers, un seul à la fois, avec leur titre (le match, « Réglages du lecteur », « Disposition des vidéos »). Ils sont rangés en sections (⚙ : Affichage, Lecture ; Disposition : les dispositions, puis Autres fenêtres ; ⋮ : Si la vidéo ne joue pas, Cette tuile, Le site), et chaque entrée dit en petit ce qu'elle fait.

- **Sur ordinateur et sur la télé**, un menu au-dessus de son bouton. Il se ferme d'un clic ailleurs, par Échap, au défilement de la page ou au redimensionnement ; les flèches ↑/↓ s'y déplacent.
- **Sur téléphone**, une feuille qui monte du bas, pleine largeur, avec un voile, une poignée, un titre et une croix. Les cibles font 54 px. On ferme en touchant le voile ou la croix, et la liste défile sans se refermer.

Sur téléphone, la barre tient sur deux rangées : ← et les pastilles des vidéos, qui défilent de côté, puis les boutons, de même largeur, un libellé court sous chaque icône (Source, Vidéo, Ajouter, Plein écran, Réglages) ; `⏮` se fait par le menu de la vidéo (`Vidéo`).

**À la télécommande et à la manette**, le focus reste dans la barre (◀ ▶ la parcourent, OK agit, ▲ mène à la barre de navigation) : il ne saute plus en haut de chaque tuile. Le bouton qui a le focus devient blanc, icône sombre, et grossit, son nom au-dessus ; la pastille d'une vidéo prend un contour blanc. Une pression, un pas : dans un menu ou ailleurs, une touche n'est plus traitée deux fois.

### 5.2 Dispositions automatiques

Une vidéo : plein cadre. Deux : deux colonnes. Trois : une grande à gauche, deux à droite. Quatre : 2 × 2. Les colonnes se redimensionnent à la souris. Quatre vidéos au maximum (« Maximum 4 streams en Multivision »).

### 5.3 En arrière-plan

**Avec une vidéo Twitch** (29 octobre 2026, « continuer lecture twitch lors de changement d'onglet aussi ») : caché, de quelque façon que ce soit, le lecteur Twitch s'arrête sur Chrome et Vivaldi. Passer à un autre onglet le réduit donc dans un coin, la vidéo Twitch seule, sous une petite barre `▶ Lecteur` · `✕`, au-dessus de la fiche d'un match ; les toasts passent au-dessus de lui. `✕` le masque (Twitch s'arrête). Et partout, une vidéo Twitch couverte ou cachée un moment (un menu, le choix des matchs, `Seule`, `✕`) repart d'elle-même dès qu'elle redevient visible : elle recharge, en direct, trois ou quatre secondes.

Sans vidéo Twitch, le lecteur ne se pose plus sur le Live ni le Guide (9 octobre 2026). En sortir le **masque** : ses vidéos restent chargées (le son continue), et **▶ Lecteur**, qui dit combien elles sont (« continuent avec façon de retourner », 29 octobre 2026), les rend telles quelles, sans rechargement — « si tu quittes le lecteur, ça continue de jouer jusqu'à ton retour » (27 octobre 2026 : c'était déjà le cas, confirmé). Les anciens modes réduits (panneau latéral, fenêtre flottante, barre dans un coin) sont retirés ; pour garder un œil sur un match ailleurs, il reste `🖼 Fenêtre détachée`.

**Dans l'APK, Retour ferme les vidéos** (28 octobre 2026, « pour limiter les ressources ») : la touche Retour (ou B de la manette), ← Retour et Échap, quand ils quittent le lecteur, les ferment au lieu de les masquer — sur un Chromecast, une vidéo cachée garde son décodeur, sa mémoire et son flux. Sur le site, rien ne change. Start, l'autre façon de quitter, masque comme avant.

Au démarrage de l'application, les vidéos de la séance précédente ne se chargent qu'à la première ouverture du lecteur, pas derrière le guide. **Fermée plus de cinq minutes** (navigateur ou application fermés, onglet quitté ; 29 octobre 2026, « vider multiview après fermeture du browser si plus de cinq minutes »), elle repart avec un lecteur vide ; la disposition choisie reste. Un rechargement ou une fermeture plus brève gardent les vidéos.

### 5.3 bis Deux écrans

Trois façons :

- **`⚙ Réglages → ⊞ Disposition → 🖥 Deux écrans`**, la fenêtre étirée — la recommandée. On étire la fenêtre du navigateur sur les deux moniteurs ; la vidéo 1 se cale sur le premier écran (la frontière suit celle des écrans, et se recale quand la fenêtre bouge), les autres s'empilent sur le second. Tout reste dans la même page : `⇄ Principal`, le glisser-déposer et les touches échangent **instantanément, sans recharger** aucune vidéo. Limite : le plein écran du navigateur ne couvre qu'un écran, la barre de la fenêtre reste donc visible.
- **`⚙ Réglages → ⊞ Disposition → 🖼 Fenêtre détachée`** — même découpage dans une fenêtre qui reste au premier plan (pas de plein écran). « ⤺ Ramener les vidéos » ou la fermer les rend à la page.
- **`⚙ Réglages → ⊞ Disposition → 🗗 Deux écrans : deux fenêtres`** — décrit ci-dessous. Plein écran possible sur chaque moniteur, mais chaque échange recharge les deux vidéos échangées.

`Deux écrans : deux fenêtres` : la vidéo 1 reste dans la page, en grand ; les vidéos 2 à 4 partent dans une seconde fenêtre, empilées les unes sous les autres. Sur Chrome ou Edge, la fenêtre s'ouvre directement sur l'autre écran une fois la permission « gestion des fenêtres » accordée ; sinon on la glisse soi-même. Elle porte, en bas au centre, `⛶ Plein écran` et `⤺ Ramener les vidéos`, qui s'effacent au repos comme les en-têtes. **Échanger** comme dans une seule fenêtre : le bouton `⇄ Principal` d'une tuile du second écran (ou `Échanger avec la vidéo principale` dans son menu ⋮) la met devant, et la principale prend sa place exacte ; on peut aussi glisser une tuile sur une tuile de l'autre écran — l'échange se fait au dépôt. Les autres vidéos ne bougent pas. Les touches `1` à `4` marchent aussi depuis la seconde fenêtre. Seules les deux vidéos échangées rechargent leur page : un navigateur recharge toujours une page qui change de fenêtre. Fermer la fenêtre (ou rouvrir l'entrée du menu) ramène toutes les vidéos dans la page. Indisponible en mode câble (une seule vidéo) et en même temps que la fenêtre détachée. Les fenêtres surgissantes doivent être autorisées pour le site.

### 5.4 La tuile

En-tête : poignée de glissement et, dès deux vidéos, le numéro (`Touche N`), qui la relie à sa pastille ; **`✕`** sur chaque tuile dès deux vidéos (31 octobre 2026, « plus facile de fermer et déplacer » : elle avait été retirée le 25 octobre comme doublon du menu ⋮, qui garde « Fermer cette vidéo ») ; **`⇄ Principal`** seulement sur les tuiles du second écran (deux fenêtres), qui n'a pas la barre ; ailleurs, il est au menu ⋮. Le nom du match, sa source (`source k/n`, précédée de `●` quand une vidéo joue, avec le débit mesuré et « · direct ») et le menu `⋮` sont dans la barre, sur la pastille de la vidéo (25 octobre 2026, « pas de doublon de menu dans le haut du multiview ; même chose pour le titre »). Le reste aussi, pour la vidéo choisie : `⏭`, et `▶ Direct` / `🖼 Page du site` quand un flux direct a été repéré **et qu'il répond depuis ton navigateur** : l'appli lit d'abord le manifeste, par le chemin même que prendra le direct, et ne montre le bouton que si un vrai flux répond (beaucoup sont liés à l'adresse qui les a vus, expirés à l'heure qu'ils portent, ou à usage unique). Avec le script utilisateur 1.14 sous Tampermonkey, le flux passe par le script, avec le référent du lecteur du site : sans lui, presque tous les serveurs vidéo le refusent. Logs dit combien de flux directs répondent, et pourquoi les autres non.

- **Chargement** : tant que la page n'est pas chargée (ou qu'aucune vidéo n'est signalée), une pastille « Chargement de … » s'affiche au centre, sans prendre les clics. Des tuiles posées ensemble partent l'une après l'autre (450 ms d'écart) plutôt que toutes à la fois.

- **Au repos** : trois secondes sans un geste et les en-têtes de tuiles s'effacent, pour laisser la vidéo seule (la barre, elle, reste). Un mouvement les rappelle, de même que l'entrée du pointeur dans une tuile. Elles restent tant qu'un menu du lecteur est ouvert ou que le pointeur est sur la barre, et reviennent quand on rouvre le lecteur. En fenêtre détachée, elles s'effacent comme en plein écran.
- **Ajustement** (`⋮ → Cadrage de l'image`, ou `⚙ Réglages → ⤢` pour toutes) : *étiré* (le cadre prend toute la tuile), *ajusté* (16:9 entier, centré), *rempli* (16:9 couvrant la tuile). Retenu par tuile.
- **Menu ⋮** (de la barre, pour la vidéo choisie) : choisir une autre source, recharger la vidéo ; l'ajustement ; (source suivante et flux direct sont `⏭` et `▶ Direct` de la barre, pas en double ici) échanger avec la vidéo principale (en mode deux écrans) ; déplacer à gauche ou à droite ; préférer ou éviter ce site ; fermer cette vidéo. Plus de « Changer de match » (25 octobre 2026) : fermer la vidéo, puis `+ Ajouter`.
- **Réordonner** : glisser-déposer entre tuiles, en prenant **tout le bloc de gauche de l'en-tête** (poignée de 36 px, numéro, son ; la poignée est masquée sur écran tactile et dans les tuiles étroites, le numéro reste), ou le menu.
- **Son** : une seule tuile a le son, celle qui a le focus, sinon la première. On donne le focus en cliquant dans la tuile. Dès deux vidéos, la vidéo choisie est encadrée de blanc et porte 🔊 dans son en-tête quand on l'entend (29 octobre 2026, façon Prime Video ; avant, un liseré gris).
- **Clavier** (hors champ de saisie) : `1` à `4` amènent la tuile en tête et lui donnent le son ; `5` à `8` l'amènent en tête sans toucher au son ; Échap ferme un menu.

### 5.5 Ce qui se passe dans la tuile

La page du site est chargée telle quelle dans une iframe, sans attribut `sandbox` (certains lecteurs le détectent et refusent de jouer). Les adresses YouTube et Twitch sont converties en lecteur intégré. Un flux direct est joué par un lecteur vidéo natif : HLS (`.m3u8`) par hls.js, DASH (`.mpd`) par dash.js, un fichier vidéo (`.mp4`, `.webm`) tel quel. Une erreur de lecture est d'abord reprise sur place (décodeur, codec, réseau) avant que la tuile ne revienne à la page ; un flux direct qui s'arrête après avoir joué est relancé au bout de 25 s, deux fois au plus, puis la tuile revient à la page du site. Les bibliothèques de lecture ont chacune deux miroirs.

- **Choix du flux** : les liens sont classés (observations de lecture, domaines préférés, qualité annoncée) et la tuile essaie le mieux classé.
- **Rien ne joue : on recharge avant de changer de source.** **Avec le script utilisateur**, si aucune vidéo n'est signalée en 30 s (90 s pour un hôte connu comme lent), la tuile **recharge la source sur laquelle elle a atterri** et lui laisse une seconde chance : une page de lecteur rate souvent son démarrage sans que le lien soit en cause, et le même lien rechargé joue. Une tuile seule sur son match est rechargée elle aussi. Sans le script, seul `⏭` change de source. Les lecteurs officiels Twitch et YouTube ne sont jamais quittés d'eux-mêmes : ils ne signalent pas la lecture, et le script ne les touche pas.
- **Mais une fois qu'elle cherche, elle ne s'attarde plus.** Dès la première bascule automatique, chaque source suivante n'a plus qu'une seule patience — et un site déjà connu pour ne pas jouer n'en a qu'une dès le départ. Sans cette règle, parcourir quatorze sources mortes prenait quatorze minutes au lieu de sept.
- **Le flux s'arrête en cours de match : on le recharge, on ne le remplace pas.** Douze secondes pour qu'il revienne seul (un ré-tampon ne coûte donc rien), puis la tuile recharge la même source, **au plus deux fois** — un flux qui ne tient jamais deux secondes est cassé, le rallumer en boucle ne sert à rien. Un flux qui a tenu deux minutes avant de lâcher retrouve ses deux chances. Une vidéo que **vous** avez mise en pause n'est jamais rechargée.
- Les sources des matchs affichés sont relues toutes les 3 minutes.
- **Sortie forcée** : si un site fait quitter la page dans les 15 s qui suivent la pose d'une tuile, l'adresse est notée dix minutes. Au retour, la tuile dit « Ce site a fait sortir la page du lecteur » avec `Charger quand même`.

### 5.5 bis Son automatique

`⚙ Réglages → 🔊 Son automatique`, allumé par défaut et retenu. La vidéo qu'on regarde prend le son **dès qu'elle joue** — pas avant, parce qu'un navigateur refuse une lecture automatique avec le son : elle démarre muette, et le son lui est rendu ensuite. Les autres tuiles restent muettes.

Si le navigateur refuse quand même (il exige parfois un premier geste), la tuile le dit une fois — « touchez la vidéo une fois et il restera » — et le son est rendu au premier clic dans la vidéo. La vidéo, elle, continue de jouer muette plutôt que de s'arrêter.

### 5.6 Mode câble (zapping au doigt)

`⚙ Réglages → 📺 Mode câble`, retenu d'une fois à l'autre. C'est un **mode à part entière** : le lecteur se conduit comme un téléviseur — **une seule vidéo**, qu'on zappe **au doigt**, et qui **démarre toute seule**.

**Une seule vidéo.** Allumer le mode réduit la grille à la tuile qu'on regardait ; les autres sont mises de côté (pas fermées) et reviennent telles quelles en éteignant le mode, même après un rechargement. Tant que le mode est allumé, choisir un match ailleurs dans l'application **change de chaîne** au lieu d'ouvrir une seconde tuile.

**Aucun blocage.** Le zapping ne s'arrête que sur ce qui peut jouer ici : un hôte dont le serveur a mesuré qu'il refuse d'être encadré, un lien déjà observé bloqué ou une adresse qui a détourné la page sont écartés de la liste des chaînes et des sources. Si une tuile tombe malgré tout sur un écran de refus, elle passe à la source suivante au lieu d'afficher un avertissement.

**Lecture automatique.** Entre deux sources, le mode prend d'abord celle que l'application sait jouer elle-même (un flux `.m3u8` ou `.mp4` va dans son propre lecteur, avec `autoplay`) ; pour une page de site, elle demande au script utilisateur de lancer la vidéo — trois fois, à 1,2 s d'intervalle, le temps que le lecteur du site apparaisse.

Puis **deux gestes sur la vidéo**, un par axe.

| Geste | Effet |
|---|---|
| Glisser **↑** / **↓** (ou `↑` / `↓` au clavier) | **Chaîne** suivante / précédente : un autre match, celui d'à côté parmi les matchs en direct — ou qui commencent dans l'heure — qui ont au moins un lien. La tuile prend la source la mieux classée du nouveau match. |
| Glisser **←** / **→** (ou `←` / `→` au clavier) | **Source** suivante / précédente pour le match en cours, dans l'ordre où la tuile les essaie. Le match ne change pas. |

Une incrustation s'affiche deux secondes et demie après chaque geste — `CH 3/12`, le match, la ligue ou le score, la source utilisée — puis s'efface.

Un glissement de moins de 48 px, une diagonale ou un doigt qui traîne plus d'une seconde ne déclenchent rien.

**Cliquer dans la page du site** : le mode pose un calque transparent sur la vidéo pour voir le doigt (une iframe d'un autre site ne le laisse pas passer), et ce calque prend aussi les clics. **Un simple appui** rend donc les clics à la page pendant quatre secondes — le temps de toucher le bouton de lecture d'un site qui l'exige — puis le calque revient tout seul : rien à apprendre, rien à défaire. Le bouton **📺 / 🖐** de l'en-tête de tuile reste là pour une suspension longue, quand on veut vraiment travailler dans la page du site.

### 5.7 Panneau « Scores et statistiques »

`⚙ Réglages → 📊 Scores et statistiques`. Colonne de 350 px accolée au lecteur, deux onglets (`Stats du Match`, celles du match de la vidéo choisie, qui suivent quand on en choisit une autre ; `Scores Live`), matchs épinglables, rafraîchie toutes les 5 minutes. C'est le seul endroit du lecteur pour les stats : « Infos et statistiques » du menu ⋮ faisait doublon et est parti (25 octobre 2026). **Les alignements** y sont, sous les statistiques du match (29 octobre 2026 ; ils ont quitté la fiche) : football, un onglet par équipe, la formation (`4-2-3-1`) et les titulaires sur un terrain, une pastille par joueur avec ses buts, passes, cartons et sa sortie, puis les remplaçants ; ailleurs (hockey, football américain, baseball, basket), la feuille de match, un tableau par groupe avec les six colonnes les plus parlantes d'ESPN. **Avant la composition**, l'effectif de chaque équipe, par position (centres, ailiers, défenseurs, gardiens au hockey ; gardiens, défenseurs, milieux, attaquants au football…), avec `🚑` sur un blessé ; la composition le remplace dès qu'ESPN la publie.

## 6. Favoris (onglet Favoris)

Deux volets (onglets `Équipes` / `Ligues` sur téléphone) :

- **Équipes** : la liste par ligue avec une ★ par équipe, une recherche instantanée, et `⭐️ MES FAVORIS` en tête. Un favori met ses matchs dans la section Favoris du Live et en avant dans le Guide.
- **Ligues** : glisser-déposer (ou ▲/▼) pour l'ordre d'affichage, et pour chaque ligue trois niveaux, **Principale**, **Secondaire**, **Ignorée**, plus `↺` pour revenir au réglage par défaut. `Réinitialiser l'ordre` et `Réinitialiser le classement` remettent tout d'aplomb.

## 7. Options (Réglages → Options)

« L'apparence d'abord ; les liens du serveur sont repliés plus bas. » Chaque changement est enregistré aussitôt (« Préférences sauvegardées »).

### 7.1 Apparence

| Option | Choix |
|---|---|
| **Palette** | 37 palettes nommées, plus une palette par équipe favorite : le fond de l'application, en dégradé doux, et sa couleur d'accent. La palette en cours est cerclée. (« Simplifier, mais garder les palettes, pas le reste », 29 octobre 2026 : styles de fond, couleurs du fond et d'accent à la pipette, assombrissement, « retirer le noir des maillages », formes des boutons et effets sont partis.) |
| **Couleur des cartes** | Un renvoi à Réglages → Look (section 3 bis). |
| **Forme des cartes** | Automatique (affiche sous 900 px), Affiche (vignette 4:3), Carte large (vignette 16:9). |
| **Manette** | Une manette Xbox, PlayStation ou générique, sur ordinateur, Android, l'APK et la version de bureau : ✚ ou stick gauche naviguer, A ok, B retour, Start lecteur (ou retour au Live), Select Réglages, stick droit défiler ; dans le lecteur, LB/RB tuile voisine (le son la suit ; en mode câble, match voisin), LT/RT source précédente / suivante, Y plein écran (ou mode Cinéma si le navigateur refuse), X mode câble ; hors du lecteur, LB/RB onglet précédent / suivant (Live, Guide, Favoris, Réglages, sans boucler). L'aide s'affiche à la première pression ; une manette qui disparaît un instant (lecteur natif, perte de focus) est retrouvée seule. Dans le lecteur natif de l'APK : LB/RB match, LT/RT source, A/Y bandeau, X/Start pause. |
| **Mode TV / tablette** | Textes plus gros (selon la largeur de l'écran : 1,3× sur un écran de 1920 px, 0,65 sur un Chromecast ; Options → Taille de l'interface), contour de focus très visible, navigation aux flèches et Entrée (télécommande). Un choix : rien ne l'allume d'office, pas même l'APK. |
| **Télécommande et manette** | Les flèches restent dans la fenêtre ouverte (fiche, guide, menus) et y entrent seules ; à la fermeture, le focus revient sur la carte d'où l'on venait, même si la grille s'est redessinée entre-temps (25 octobre 2026 : avant, la flèche suivante repartait de la barre du haut). Une carte est un seul arrêt (ni son compteur « ▶ 105 », ni les ★), un flux de la fiche aussi (ni ⭐ 👎 ⊞, ni les ★ du bandeau). Le focus de départ est le premier match ; la carte qui a le focus grossit, comme une affiche. Retour : d'abord la barre de navigation (Live, Guide, Favoris, Réglages), puis le Live, puis quitter ; depuis le lecteur, le Live. ◀ ▶ change le choix d'une liste. Les cartes du Guide, les interrupteurs et les sections repliables s'atteignent. |
| **APK sur une télé** | Le site tel quel : ni mode TV ni mode câble imposés (ceux d'une version précédente sont éteints une fois), la page à l'échelle d'une appli de télé comme Netflix ou Prime Video (1200 px de large, 1,6 fois l'écran d'ordinateur ; Options → Taille de l'interface), la navigation à la télécommande. Fermée (Retour sur la dernière page, ou Accueil), l'application repart de zéro au lancement suivant. |
| **Télé Android : Retour et flux direct** | La touche Retour ferme un menu, la fiche, puis revient au Live ; depuis le Live, elle quitte. Sur la télé, un lien dont le flux direct est connu (relevé par la vérification du serveur) part d'emblée sur ce flux, pas sur la page du site et ses centaines de cadres de régie ; refusé, il revient à la page. Dans l'APK (télé ou téléphone), un flux direct joue dans sa tuile, comme sur le site (depuis le 25 octobre 2026 ; avant, il ouvrait le lecteur d'Android en plein écran, qui zappait comme le mode câble) ; Android pose le `Referer` que le serveur vidéo exige. S'il refuse dans la tuile, le lecteur d'Android prend le relais en plein écran (◀▶ y change de source ; ▲▼ zappe de match en mode câble, et seulement là) ; s'il refuse là aussi, la tuile revient à la page du site ; fermé à la main (Retour), le lecteur se vide et l'on revient au Live (30 octobre 2026). Un changement de source ou de match depuis ce lecteur y envoie le nouveau flux directement. |

### 7.2 Liens du serveur (replié, avancé)

- `Lancer le calcul sur GitHub` ouvre le workflow qui régénère les liens ; `Recharger les liens serveur` les relit tout de suite.

Le proxy personnalisé, les clés d'API, l'état des proxys et la section **Outils** (Scraper Investigator, export et import des réglages) sont partis le 29 octobre 2026 (« j'utilise pas les proxy »). L'application garde ses relais publics, automatiques, pour lire elle-même les pages des sources quand le serveur se tait.

## 8. Logs (Réglages → Logs)

- **Cet appareil** : six lignes ✅ / ⚠️ / ❌ pour comparer deux appareils qui ne voient pas la même chose. Calendrier (nombre de matchs, source, âge), ESPN (réponses sur tentatives, dernière erreur), Liens (`data/streams.json`, âge en clair, en orange dès 45 min et avec la raison — passage manqué ou serveur muet), Fusion (« N matchs sur M ont des liens »), Stockage local (Ko, écritures refusées ; plein, il se vide d'abord de ses caches refaisables — liens, dernier scraping, calendriers — et nomme ceux qu'il a vidés et les plus grosses clés), Version (`sports-guide-v14`, service worker actif ou non), Script de nettoyage (version, et s'il faut le mettre à jour) ou Extension de nettoyage (version, et comment la mettre à jour), Garde « Quitter le site ? » (active, ou coupée et où la rallumer), Registre de l'appareil (combien d'hôtes cet appareil a essayés, lesquels il juge morts ici et classe en bas pendant 24 h, combien n'ont plus de veto faute d'essai récent), Fluidité (les gels de l'interface et les arrêts de vidéo des dix dernières minutes ; sur Chrome et Vivaldi, depuis le 28 octobre 2026, aussi ce qui a tenu la page pendant les gels : une fonction et son fichier, une extension, un script utilisateur, ou « mise en page et rendu »), Images perdues (29 octobre 2026 : la part d'images perdues de chaque vidéo, et « décroche à partir de N vidéos à la fois » ou « tient N vidéos » ; une vidéo qui en perd plus d'un quart le dit aussi par un toast, au plus toutes les 5 minutes), Décodage vidéo (H.264 1080p et 720p : matériel ou logiciel probable). Dans l'APK, le journal d'Android dit en plus quel décodeur le lecteur natif a pris (matériel ou LOGICIEL). Puis `↻ Mettre à jour l'application`.

Ce que l'appareil a appris **expire** (26 octobre 2026) : un hôte jugé mort ici l'était pour toujours, puisque classé en bas il n'était plus jamais essayé ; sans nouvel essai depuis 24 h, il reprend la place que le serveur lui donne et a droit à une nouvelle chance — qui, si elle échoue, le remet en bas pour 24 h.
- **Sorties de l'appli (vidéos chargées)** : les douze dernières fois où la page a été quittée ou a failli l'être, avec l'heure, « page quittée » ou « page restée », si la garde « Quitter le site ? » était armée et sinon pourquoi (réglage coupé, pointeur monté vers les onglets, Ctrl tenu, F5, onglet en arrière-plan), puis le dernier geste dans la page, la vidéo qui avait le focus, la fenêtre sans focus, la dernière position du pointeur et l'endroit où il est sorti de la fenêtre, la dernière touche de raccourci, l'âge du dernier clic dans une vidéo, les sites des vidéos et depuis combien de temps chacune est chargée ; les reculs de l'onglet demandés par une vidéo et bloqués (⛔), et les retours par « Précédent ». C'est ce qu'il faut regarder quand l'onglet est parti sur une pub.
- **État des sources** du dernier scraping : pastille, nom, message, nombre de matchs, heure.
- **Liens par domaine primaire** (`↻ Recalculer`) : combien de liens, d'intégrables, de pages et de matchs par fournisseur, sous-domaines repliés sur le domaine principal.
- **Historique des requêtes** : journal horodaté, `📋 Copier le log` sur les entrées longues, `📥 Exporter` (fichier `jmtv-debug-logs-<date>.json`).
- **Diagnostics des flux manuels** : les rapports produits par la recherche manuelle de la fiche.

## 9. Mises à jour et installation des scripts (Réglages → Mises à jour)

**Le haut de la page dit où on en est** (31 octobre 2026, « remplacer la page script par qqchose qui aide plus les gens à rester à jour ») : trois cartes. **L'application** : sa version, celle qui est publiée (lue dans `sw.js`), et un bouton « Mettre à jour maintenant » quand elle est en retard. **La protection des lecteurs** : l'extension ou le script qui tourne, sa version contre celle que l'application attend, et le bouton qui convient (télécharger l'extension et ses quatre étapes ; mettre à jour le script, que Tampermonkey ouvre ; ou, sans rien d'installé, « Voir comment l'installer »). **Ce qui a changé** : les nouveautés des versions du script que l'appareil n'a pas encore. Un bandeau en haut de l'application prévient que le script ou l'extension est en retard et reste jusqu'à ce que ce soit fait (« Mettre à jour » ou « Plus tard », qui le cache sept jours pour cette version) ; sur l'APK ou l'application de bureau, qui embarquent leur script, il dit d'installer la dernière version de l'application. Le script demande aussi à Tampermonkey de vérifier lui-même les mises à jour (`@updateURL`, `@downloadURL`).

Sous les cartes, **le guide d'installation**, replié (« Première installation »). C'est l'ancien guide, gardé à la demande de l'utilisateur, avec un chemin Chrome qui marche (25 octobre 2026). La même chose s'ouvre en fenêtre au premier démarrage, une seule fois, et seulement si rien ne protège déjà les lecteurs (extension, script, bureau, APK).

- **Recommandation : Firefox + uBlock Origin.** Sur Chrome, Edge ou Brave, l'extension du Guide des Sports fait le même travail.
- **Firefox : ce qui bloque les tuiles** : Ignore X-Frame-Options Header, lecture automatique dans `about:config`, protection contre le pistage coupée pour l'application.
- **Chrome, Edge, Brave : l'extension du Guide des Sports** : `⬇ Télécharger l'extension (.zip)`, `chrome://extensions` → Mode développeur → Charger l'extension non empaquetée → le dossier décompressé, `guide-des-sports-extension-<version>` (celui qui contient `manifest.json`). Elle remplace les étapes 1 à 3 : blocage des publicités et des fenêtres surgissantes, nettoyage des tuiles, mode direct, et les pages qui refusent l'iframe (dans l'onglet de l'application et dans le second écran). Sans elle : uBlock Origin Lite, Tampermonkey avec « Autoriser les scripts utilisateur », le script.
- **Étape 1 : uBlock Origin** (Firefox ; uBlock Origin Lite pour Chrome et Edge), **Étape 2 : Tampermonkey** (liens Firefox, Chrome, Edge ; sur Chrome et Edge, « Autoriser les scripts utilisateur » dans ses détails), **Étape 3 : `Installer le script`**.

Tampermonkey et l'extension peuvent tourner ensemble : une seule copie du script travaille dans chaque page (1.18). Le script 1.19 (extension 1.6) envoie aussi les compteurs d'images de la vidéo (Images perdues). Le 1.20 (extension 1.7) ne pose plus rien à côté de la vidéo (voir plus bas).

Ce que le script **Multiview Stream Cleaner** (version 1.8) fait, et que l'application ne peut pas faire seule :

- dans chaque page de lecteur : bloque les fenêtres surgissantes et les détournements dès le premier octet de la page, cache tout ce qui entoure le lecteur sans rien supprimer (et défait tout, puis reprend son choix, si le site reconstruit son lecteur après coup : Video.js, par exemple ; si une vidéo qui jouait s'arrête, il passe à un palier plus doux qui garde la vidéo en plein cadre). Un lien que le site refuse d'afficher (page d'erreur de Firefox dans la tuile) fait passer la tuile au lien suivant au bout de quelques secondes, et l'appareil retient que cet hôte ne joue pas, les calques invisibles et les calques de pub posés sur la vidéo (bannière ou cadre qui mène vers un autre site), continue de chercher toutes les 3 secondes un lecteur qui apparaît tard, lance la vidéo (`play()`, muet si nécessaire, puis le gros bouton de lecture des lecteurs connus), obéit aux ordres de son (`mv_mute` / `mv_unmute`), et remonte à l'application l'état de lecture, le débit et la définition, et les adresses de flux direct qu'il voit passer ; dans la fenêtre de l'application, lit pour le mode direct manifestes et segments avec le référent du lecteur (1.14, sous un vrai gestionnaire de scripts, et sous l'extension Chrome depuis sa 1.5) ; ne pose rien à côté de la vidéo (`📱 Force Native Player (Cast)` et `📺 Open in Cast App`, retirés en 1.20 : le script les retirait lui-même aussitôt posés, et l'application joue déjà le flux en mode direct) ;
- dans chaque page de lecteur aussi : **masque un faux écran de vérification** (« Verify you are human », faux Cloudflare, consigne de coller une commande) qui apparaît par-dessus après un moment, **refuse l'écriture dans le presse-papiers**, et prévient l'application, qui passe au lien suivant si rien ne joue ;
- dans l'application : sert de **pont** pour télécharger les pages des sources depuis l'adresse de l'utilisateur, là où les proxys CORS sont refusés. Options → Réseau montre s'il est actif.

## 10. Application installable (PWA)

`Sports Guide` (nom court `Sports`) s'installe depuis le navigateur : icône, plein écran, cache hors ligne de toute la coquille. En ligne, c'est toujours la version publiée qui s'affiche (réseau d'abord, cache en repli). `↻ Mettre à jour l'app` retire le service worker, vide ses caches et recharge la version publiée, **sans toucher** aux réglages, favoris et liens locaux.

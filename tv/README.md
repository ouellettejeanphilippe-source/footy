# Footy TV — l'appli Android TV (Chromecast avec Google TV)

Une appli native minuscule (≈ 500 Ko) qui joue les matchs **sans aucune page web** : pas de WebView, donc pas de régie, pas de pop-up, pas de script. Elle lit le flux vidéo nu (`.m3u8`) que la vérification des lecteurs a vu passer (`scripts/verify_players.mjs`) avec le lecteur natif d'Android (ExoPlayer, décodage matériel).

## Pourquoi une appli et pas un « Caster »

La plupart des CDN refusent le manifeste sans le bon `Referer` (dlive.sx : 403 sans, 200 avec). Un Chromecast qu'on « caste », comme un navigateur, ne peut pas poser cet en-tête ; une appli native, si. Pas de relais, pas de compte, pas de serveur.

## Ressources

- Une activité, aucune bibliothèque d'interface (ni AppCompat, ni Leanback, ni media3-ui).
- Le lecteur est créé à l'ouverture et **détruit** dès que l'appli passe en arrière-plan.
- Tampons courts (8 à 24 s, 24 Mo au plus) : c'est du direct, et l'appareil a 2 Go de mémoire.
- Elle télécharge `data/tv.json` (quelques dizaines de Ko, `js/tvliste.js`) au lieu des 2,6 Mo de `data/streams.json`, et le garde en cache pour démarrer sans réseau.

## Mode câble, et l'onglet Live

À l'ouverture, une vidéo joue déjà : le dernier match regardé s'il est encore dans la liste, sinon le premier en direct. On zappe. L'onglet **Live** (la liste des matchs jouables) se pose sur la moitié gauche de l'écran, et la vidéo continue à droite.

| | Télécommande | Téléphone |
|---|---|---|
| autre flux du même match | ◀ ▶ | glisser à gauche / à droite |
| autre match | ▲ ▼ (CH + / −) | glisser vers le haut / le bas |
| ce qui joue | OK | toucher la vidéo |
| onglet Live | Retour (ou Menu / Guide) | bouton « ☰ Live », ou Retour |
| revenir à la vidéo | Retour | Retour |

Un flux qui ne démarre pas en 15 s, ou qui tombe en erreur, passe au suivant tout seul. Pour chaque flux, l'appli essaie le `Referer` observé (le cadre du lecteur), puis aucun, puis la page du lien. Quand aucun flux d'un match ne répond, elle zappe sur le match suivant, comme une chaîne muette. Après un tour complet sans rien, elle s'arrête sur l'onglet Live.

**Sur un téléphone**, la même APK s'installe telle quelle (Paramètres → autoriser l'installation d'applications inconnues pour le navigateur ou le gestionnaire de fichiers qui l'ouvre).

## Données

`data/tv.json` est écrit par la vérification, à chaque passage du workflow (toutes les 30 min), et par `npm run liens`. L'appli le lit sur `raw.githubusercontent.com/…/main/data/tv.json` : il doit être sur `main`.

## Installer

1. Sur le Chromecast : Paramètres → Système → À propos → appuyer 7 fois sur « Version du système d'exploitation Android TV » (mode développeur).
2. Installer l'appli **Downloader** depuis le Play Store, et l'autoriser dans Paramètres → Applications → Sécurité → Sources inconnues.
3. Dans Downloader, ouvrir l'adresse de l'APK, puis installer. Ou, depuis un ordinateur : `adb connect <ip-du-chromecast>` puis `adb install Footy-TV.apk`.

L'APK est signé avec une clé de débogage. Une version fabriquée sur une autre machine portera une autre clé : il faudra désinstaller l'ancienne avant d'installer la nouvelle.

## Fabriquer

JDK 17 ou plus, et le SDK Android (plateforme 35, build-tools 35) :

```
cd tv
echo sdk.dir=/chemin/du/sdk > local.properties
./gradlew testReleaseUnitTest assembleRelease   # app/build/outputs/apk/release/app-release.apk
```

## Limites

- Seuls les matchs dont la vérification a vu un flux direct apparaissent (une cinquantaine aux heures chargées) : les liens qui ne sont que des pages ne sont pas jouables ici.
- Une adresse signée expire en 1 à 3 h ; l'appli relit la liste toutes les 5 min.
- Un jeton lié à l'adresse IP du serveur de vérification ne passera pas depuis la maison. Le flux suivant prend alors le relais.

/* Le lecteur direct : ce qu'il faut décider avant et pendant la lecture d'un flux brut
   dans la tuile (js/multiview.js, `creerLecteurVideo`).

   « Revoir le chargement des streams et l'app pour assurer qualité maximale et
   compatibilité maximale pour tous les types de streams » (25 octobre 2026). Relu ce
   jour-là, le lecteur direct savait jouer un `.m3u8` par hls.js et un fichier progressif
   par le navigateur, et c'est tout :

   - un `.mpd` (DASH) passait la sonde (`verdictSonde` accepte un MPD), était proposé en
     ▶ Direct, puis échouait dans un `<video>` nu — aucun navigateur ne lit DASH seul ;
   - une erreur FATALE de hls.js renvoyait la tuile à la page sur-le-champ, alors que
     hls.js documente deux reprises qui marchent souvent (`recoverMediaError` pour un
     décodeur qui bute, `startLoad` pour un réseau qui lâche) et qu'une source qui a joué
     « n'est jamais quittée automatiquement » (§7.2) ;
   - un flux qui s'arrêtait après avoir joué (ré-tampon sans fin, `ended` sur un direct)
     restait figé : la reprise bornée du mode page (`armerRepriseTuile`) n'existait pas
     pour le `<video>` ;
   - hls.js ne venait que de cdnjs : un CDN bloqué (liste de blocage, réseau d'entreprise)
     condamnait le direct partout ;
   - un lecteur hls.js n'était détruit qu'au retour à la page : fermer la tuile, changer
     de source ou redessiner la grille laissait son moteur télécharger des segments dans
     le vide — mémoire et bande passante sur un Chromecast.

   Module sans import : des décisions pures, partagées avec les tests. */

/* ─── Bibliothèques, avec un second miroir ─────────────────────────────────────
   Chargées à la demande (jamais au démarrage), à la version épinglée, le premier miroir
   qui répond gagne. Les deux servent exactement le même fichier (même taille, vérifié
   le 25 octobre 2026). */
export var BIBLIOTHEQUES = {
    hls: {
        global: 'Hls',
        adresses: [
            'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.17/hls.min.js',
            'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'
        ]
    },
    dash: {
        global: 'dashjs',
        adresses: [
            'https://cdnjs.cloudflare.com/ajax/libs/dashjs/4.7.4/dash.all.min.js',
            'https://cdn.jsdelivr.net/npm/dashjs@4.7.4/dist/dash.all.min.js'
        ]
    }
};

/* ─── Quel lecteur pour quelle adresse ─────────────────────────────────────────
   `hls` (manifeste HLS), `dash` (manifeste MPEG-DASH), `fichier` (progressif : mp4,
   webm…), '' (pas un média). Les premiers octets, quand la sonde les a lus, priment sur
   l'extension : un manifeste servi sous `/playlist?x=…` ou `/live/stream` n'a pas
   d'extension, et c'est son contenu qui dit ce qu'il est. */
export function typeDeMedia(url, debut) {
    var d = String(debut || '').replace(/^﻿/, '').trim();
    if (/^#EXTM3U/.test(d)) return 'hls';
    if (/^<\?xml|^<MPD/i.test(d)) return 'dash';
    var chemin = String(url || '').split('#')[0].split('?')[0];
    if (/\.m3u8$/i.test(chemin)) return 'hls';
    if (/\.mpd$/i.test(chemin)) return 'dash';
    if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(chemin)) return 'fichier';
    return '';
}

/* ─── La configuration de hls.js ───────────────────────────────────────────────
   Une télé a peu de mémoire : on borne ce que hls.js garde derrière la tête de lecture
   (`backBufferLength`, infini par défaut) et ce qu'il peut mettre devant au maximum
   (`maxMaxBufferLength`, 600 s par défaut). Un direct n'a pas besoin de dix minutes
   d'avance. `loader` (le pont du script utilisateur) et `xhrSetup` (le relais de l'APK)
   viennent de l'appelant et passent tels quels. */
export function configHls(opts) {
    var o = opts || {};
    var c = {
        backBufferLength: o.tele ? 10 : 30,
        maxMaxBufferLength: o.tele ? 60 : 120,
        enableWorker: true
    };
    if (o.loader) c.loader = o.loader;
    if (o.xhrSetup) c.xhrSetup = o.xhrSetup;
    return c;
}

/* ─── Une erreur de hls.js : reprendre ou abandonner ───────────────────────────
   Contrat de hls.js (1.5) : `data.fatal`, `data.type` (`networkError`, `mediaError`,
   `otherError`…), `data.details`. Une erreur non fatale, hls.js la rattrape seul.

   Fatale :
   - `mediaError` (le décodeur bute, le tampon refuse un segment) : `recoverMedia`, puis
     `swapCodec` (changer de codec audio ET reprendre, la seconde méthode que hls.js
     documente), puis abandon ;
   - `networkError` : si le flux N'A PAS ENCORE JOUÉ, c'est le manifeste qu'on refuse
     (CORS, 403, adresse expirée) et insister ne sert à rien : abandon, la tuile revient à
     la page vite. S'il a joué, le réseau a lâché en route : `startLoad` jusqu'à
     `RELANCES_MAX` fois, parce qu'une source qui a joué n'est jamais quittée pour un
     ré-tampon (§7.2) ;
   - le reste : abandon.

   `etat` est tenu par l'appelant ({ media, reseau, aJoue }) et rendu mis à jour. */
export var RELANCES_MAX = 2;
export function decisionErreurHls(d, etat) {
    var e = etat || {};
    var s = { media: e.media | 0, reseau: e.reseau | 0, aJoue: !!e.aJoue };
    if (!d || !d.fatal) return { action: 'ignorer', etat: s };
    var type = String(d.type || '');
    if (type === 'mediaError') {
        s.media++;
        if (s.media === 1) return { action: 'recoverMedia', etat: s };
        if (s.media === 2) return { action: 'swapCodec', etat: s };
        return { action: 'abandon', etat: s };
    }
    if (type === 'networkError' && s.aJoue) {
        s.reseau++;
        return { action: s.reseau <= RELANCES_MAX ? 'startLoad' : 'abandon', etat: s };
    }
    return { action: 'abandon', etat: s };
}

/* ─── Un flux qui s'arrête après avoir joué ────────────────────────────────────
   Même règle que le mode page (`armerRepriseTuile`, §7.2) : on laisse
   `DELAI_STAGNATION_MS` à la vidéo pour revenir seule, puis on relance LA MÊME source,
   au plus `RELANCES_MAX` fois ; le compte est oublié quand la vidéo a tenu
   `OUBLI_RELANCE_MS` depuis la dernière relance — un match regardé depuis dix minutes
   n'est pas une source cassée.

   `etat` : { relances, depuis } (`depuis` : l'instant où la lecture a repris pour la
   dernière fois, ou commencé). `relanceAutorisee(etat, now)` rend { autorisee, etat }. */
export var DELAI_STAGNATION_MS = 25000;
export var OUBLI_RELANCE_MS = 2 * 60 * 1000;
export function relanceAutorisee(etat, now) {
    var e = etat || {};
    var t = (typeof now === 'number') ? now : Date.now();
    var n = e.relances | 0;
    if (typeof e.depuis === 'number' && t - e.depuis >= OUBLI_RELANCE_MS) n = 0;
    var ok = n < RELANCES_MAX;
    return { autorisee: ok, etat: { relances: ok ? n + 1 : n, depuis: t } };
}

/* Les permissions qu'une tuile accorde à la page qu'elle encadre : plein écran et
   lecture automatique (déjà là), présentation (Cast), `encrypted-media` (un lecteur qui
   déchiffre par le navigateur, ClearKey ou Widevine, se tait sans elle) et
   `picture-in-picture`. Rien qui touche au bac à sable : aucun attribut `sandbox`. */
export var PERMISSIONS_CADRE = 'fullscreen; autoplay; presentation; encrypted-media; picture-in-picture';

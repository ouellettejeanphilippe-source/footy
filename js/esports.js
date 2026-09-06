/* Flux officiels de l'esport (LoL Esports), rendus JOUABLES dans une tuile.

   « Pour league : lolesports.com » (6 septembre 2026). L'application interroge déjà l'API
   officielle depuis longtemps — `getSchedule` remplit la grille, `getLive` donne les flux —
   et les matchs apparaissaient bien : LCS, LEC, LCK, LPL, PCS étaient là. Mais AUCUN ne
   jouait, et la cause tient à la forme des adresses construites :

       https://youtube.com/watch?v=<id>   une page de visionnement, pas un lecteur
       https://twitch.tv/<chaîne>         une page de chaîne, pas un lecteur

   Mesuré aux en-têtes le même jour, sur le match LCS Shopify Rebellion – FlyQuest :
     - `twitch.tv/lcs` répond « X-Frame-Options: SAMEORIGIN » — Twitch REFUSE l'encadrement ;
     - `player.twitch.tv/?channel=lcs&parent=<notre hôte>` répond
       « frame-ancestors https://ouellettejeanphilippe-source.github.io », soit une
       autorisation explicite pour nous ;
     - `youtube.com/watch?v=…` répond 429 et n'est de toute façon pas encadrable ;
     - `youtube.com/embed/<id>` répond 200 sans aucune restriction de cadre.

   D'où ce module : la même information (fournisseur + paramètre), rendue sous la forme que
   le fournisseur accepte d'encadrer. Twitch exige que `parent` soit exactement l'hôte de la
   page qui l'encadre — c'est sa protection contre le vol de flux, et l'oublier fait échouer
   le lecteur en silence.

   Module sans aucun import : utilisable par l'application comme par les tests. */

/* Hôte de production, utilisé quand la page n'en déclare pas (fichier local, coquille
   WebView). Twitch refuse un `parent` vide. */
export var HOTE_PAR_DEFAUT = 'ouellettejeanphilippe-source.github.io';

export function hoteCourant(emplacement) {
    var l = emplacement || (typeof location !== 'undefined' ? location : null);
    var h = (l && l.hostname) ? String(l.hostname) : '';
    return h || HOTE_PAR_DEFAUT;
}

/* Adresse encadrable pour un flux annoncé par l'API de LoL Esports.
   Rend '' pour un fournisseur qu'on ne sait pas encadrer — mieux vaut aucun lien qu'un
   lien qui affichera l'écran de refus du navigateur dans la tuile. */
export function lienFluxEsports(fournisseur, parametre, hote) {
    var f = String(fournisseur || '').toLowerCase();
    var p = String(parametre || '').trim();
    if (!p) return '';
    if (f === 'youtube') return 'https://www.youtube.com/embed/' + encodeURIComponent(p) + '?autoplay=1';
    if (f === 'twitch') {
        return 'https://player.twitch.tv/?channel=' + encodeURIComponent(p)
            + '&parent=' + encodeURIComponent(hoteCourant(hote ? { hostname: hote } : null))
            + '&autoplay=true&muted=false';
    }
    return '';
}

/* Libellé lisible : « Twitch · en-US ». Le fournisseur d'abord, c'est ce qui décide si ça
   jouera chez l'utilisateur. */
export function libelleFluxEsports(fournisseur, locale) {
    var f = String(fournisseur || '').trim();
    var nom = f ? f.charAt(0).toUpperCase() + f.slice(1) : 'Flux';
    return locale ? nom + ' · ' + locale : nom;
}

/* Transforme la liste `streams` d'un événement de l'API en liens de l'application.
   Les fournisseurs inconnus sont écartés, les doublons aussi. */
export function liensDunEvenementEsports(streams, hote) {
    var out = [];
    var vus = {};
    (streams || []).forEach(function (s) {
        if (!s) return;
        var url = lienFluxEsports(s.provider, s.parameter, hote);
        if (!url || vus[url]) return;
        vus[url] = true;
        out.push({
            name: libelleFluxEsports(s.provider, s.locale),
            url: url,
            quality: '1080p',
            lang: s.locale || 'MULTI',
            source: 'lol_esports'
        });
    });
    return out;
}

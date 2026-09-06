/* Débit et définition réels d'un flux, mesurés pendant qu'il joue.

   « Moyen d'avoir le débit dans la liste des feeds ? » (6 septembre 2026). La liste
   affichait jusqu'ici la qualité ANNONCÉE par la source — « HD », « 1080p », parfois un
   « 3500 kbps » recopié d'un libellé. C'est du déclaratif : mesuré sur le cache du jour,
   des liens marqués « HD » ne jouaient pas du tout, et deux liens « SD » du même match
   n'avaient rien à voir l'un avec l'autre. Ce qui compte, c'est ce qui arrive vraiment.

   Le script utilisateur est dans le cadre : il voit l'élément <video> et la chronologie
   des ressources. Il peut donc rapporter deux choses différentes, qu'il ne faut pas
   confondre :

     - la DÉFINITION (`videoWidth` × `videoHeight`), toujours disponible, exacte ;
     - le DÉBIT, en octets réellement transférés, qui n'est PAS toujours mesurable :
       `transferSize` d'une ressource d'origine croisée vaut 0 tant que le serveur
       n'envoie pas `Timing-Allow-Origin`, ce que beaucoup de CDN omettent.

   D'où la règle d'affichage : la définition est montrée dès qu'on l'a, le débit seulement
   quand il a vraiment été mesuré. On préfère ne rien dire à inventer un chiffre — c'est
   la même exigence que pour les faux flux.

   Module sans aucun import : partagé par l'application et les tests. */

export var TTL_MESURE_MS = 3 * 3600 * 1000;

/* Débit moyen, en kilobits par seconde, à partir des entrées de chronologie de ressources
   des `fenetreMs` dernières millisecondes. Rend 0 si rien n'est mesurable. */
export function debitDepuisEntrees(entrees, fenetreMs, maintenant) {
    var fen = fenetreMs || 10000;
    var t = (maintenant === undefined) ? 0 : maintenant;
    var octets = 0;
    (entrees || []).forEach(function (e) {
        if (!e) return;
        if (t && e.startTime !== undefined && (t - e.startTime) > fen) return;
        /* `transferSize` compte l'octet réseau ; `encodedBodySize` prend le relais quand le
           premier est masqué mais que le corps est connu. Les deux valent 0 sans
           Timing-Allow-Origin : dans ce cas on ne mesure rien, et on le dit. */
        var n = (e.transferSize | 0) || (e.encodedBodySize | 0);
        if (n > 0) octets += n;
    });
    if (!octets) return 0;
    return Math.round((octets * 8) / (fen / 1000) / 1000);
}

/* « 5,2 Mb/s », « 820 kb/s », ou '' quand rien n'a été mesuré. */
export function formaterDebit(kbps) {
    var k = Number(kbps) || 0;
    if (k <= 0) return '';
    if (k >= 1000) return (Math.round(k / 100) / 10).toString().replace('.', ',') + ' Mb/s';
    return k + ' kb/s';
}

/* Définition normalisée d'après la hauteur réelle de l'image : « 1080p », « 720p »… */
export function formaterDefinition(largeur, hauteur) {
    var h = parseInt(hauteur, 10) || 0;
    if (h <= 0) return '';
    var paliers = [2160, 1440, 1080, 720, 576, 480, 360, 240];
    for (var i = 0; i < paliers.length; i++) {
        if (h >= paliers[i] - 40) return paliers[i] + 'p';
    }
    return h + 'p';
}

/* Ce qu'on affiche pour une mesure : « 1080p · 5,2 Mb/s », l'un des deux, ou ''. */
export function formaterMesure(mesure) {
    if (!mesure) return '';
    var bouts = [];
    var def = formaterDefinition(mesure.w, mesure.h);
    var deb = formaterDebit(mesure.kbps);
    if (def) bouts.push(def);
    if (deb) bouts.push(deb);
    return bouts.join(' · ');
}

/* Registre par adresse de flux. On garde la DERNIÈRE mesure : un flux change de palier en
   cours de route, et c'est l'état récent qui intéresse. Les mesures périmées tombent. */
export function noterMesure(registre, url, mesure, maintenant) {
    var r = (registre && typeof registre === 'object') ? registre : {};
    var t = (maintenant === undefined) ? Date.now() : maintenant;
    Object.keys(r).forEach(function (k) {
        var e = r[k];
        if (!e || typeof e.at !== 'number' || t - e.at > TTL_MESURE_MS) delete r[k];
    });
    if (!url || !mesure) return r;
    var kbps = Number(mesure.kbps) || 0;
    var w = parseInt(mesure.w, 10) || 0;
    var h = parseInt(mesure.h, 10) || 0;
    if (!kbps && !h) return r; // rien de mesurable : on n'inscrit pas une ligne vide
    var ancien = r[url] || {};
    r[url] = {
        /* Un débit momentanément non mesurable (fenêtre sans segment, en-tête absent) ne
           doit pas effacer celui qu'on connaissait. */
        kbps: kbps || (ancien.kbps || 0),
        w: w || (ancien.w || 0),
        h: h || (ancien.h || 0),
        at: t
    };
    return r;
}

export function mesurePour(registre, url, maintenant) {
    var e = registre && registre[url];
    if (!e) return null;
    var t = (maintenant === undefined) ? Date.now() : maintenant;
    if (typeof e.at !== 'number' || t - e.at > TTL_MESURE_MS) return null;
    return e;
}

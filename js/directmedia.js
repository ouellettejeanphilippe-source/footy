/* Mode direct : la deuxième façon d'utiliser un lien de flux.

   Décision du 6 septembre 2026 : « les embed.st, ça devrait être une deuxième façon
   d'utiliser un lien de stream, qu'on pourrait aussi avoir en mode normal, pour avoir les
   deux options ». Le mode normal charge la PAGE du site dans la tuile et le script
   utilisateur la nettoie ; c'est ce qui marche, mais certaines pages (embed.st : 640 Ko de
   script obfusqué, moteur pair-à-pair) chargent lentement, gèlent, puis plantent.

   Le mode direct court-circuite la page : pendant que la page joue, le script utilisateur
   voit passer le MANIFESTE vidéo (.m3u8 / .mpd) que son lecteur demande, et le remonte à
   l'application ; la tuile peut alors jouer ce manifeste dans son propre <video> (hls.js),
   sans la page, sa régie ni son moteur pair-à-pair. Les deux modes restent à un clic l'un
   de l'autre sur la tuile.

   Ce qui peut faire échouer le direct, et qu'on observe plutôt que de deviner : un CDN qui
   refuse notre origine (CORS) ou notre référent (403), une adresse signée qui expire. Dans
   tous ces cas la tuile revient d'elle-même au mode page et retient l'échec.

   Module sans import : partagé par l'application et les tests. */

export var MEDIA_DIRECT_TTL_MS = 3 * 3600 * 1000;

/* Une adresse SANS jeton ne peut pas expirer : on la garde plus longtemps.
   --------------------------------------------------------------------
   Trois heures conviennent à une adresse signée : elle porte sa propre péremption,
   souvent d'une à trois heures. Mesuré sur un passage de vérification le 26 septembre
   2026, sur 36 adresses observées :

       avec jeton (`e=`, `st=`, `token=`…)    7    expirent en 1 à 3 h
       SANS aucun jeton                      29    rien ne les fait expirer

   Les vingt-neuf restaient bonnes tant que l'événement durait. Les jeter au bout de
   trois heures n'obéissait à aucune contrainte du serveur : c'est nous qui les
   oubliions.

   Ça compte surtout sur TÉLÉPHONE. Là-bas, ni le nettoyage des lecteurs ni la
   réécriture des en-têtes ne sont possibles — aucun navigateur mobile n'injecte de
   script dans une iframe d'origine croisée. Le mode direct, qui ne pose aucune iframe,
   y est donc la seule voie propre : « la vraie réponse aux pages qui refusent l'iframe
   est ailleurs » (js/embed-bridge.js, 5 septembre 2026). Encore faut-il qu'il lui reste
   quelque chose à jouer.

   Douze heures, pas davantage : au-delà le match est fini de toute façon, et une
   adresse morte coûte un essai à la tuile avant qu'elle ne revienne à la page. */
export var MEDIA_DIRECT_TTL_LONG_MS = 12 * 3600 * 1000;

/* Ce qui fait qu'une adresse porte sa propre expiration. Les noms varient d'un CDN à
   l'autre ; ceux-ci couvrent ce qui a été réellement observé — `?st=…&e=…` chez
   embedme.st et streame.center, `?s=…&e=…` chez dlive.sx. */
export function adresseSignee(url) {
    var q = String(url || '').split('#')[0].split('?')[1] || '';
    if (!q) return false;
    return /(^|&)(e|exp|expires|expiry|st|s|token|hash|md5|sig|signature|key)=/i.test(q);
}

export function dureeDeVie(url) {
    return adresseSignee(url) ? MEDIA_DIRECT_TTL_MS : MEDIA_DIRECT_TTL_LONG_MS;
}

/* Un manifeste, pas un segment ni une bibliothèque : jugé sur le chemin, sans requête. */
export function estManifeste(url) {
    var u = String(url || '');
    if (!/^https?:\/\//i.test(u)) return false;
    var chemin = u.split('#')[0].split('?')[0];
    if (/(^|\/)(ads?|preroll|vast|vmap)(\/|\.|$)/i.test(chemin)) return false;
    return /\.(m3u8|mpd)$/i.test(chemin);
}

/* Registre { lienUrl: { url, pageUrl, at } } dans le stockage local : la tuile qui rouvre
   le même lien sait d'emblée qu'un direct existe. Les entrées plus vieilles que le TTL
   tombent (adresses signées, événements finis). */
export function retenirMediaDirect(registre, lienUrl, media, now) {
    var r = registre && typeof registre === 'object' ? registre : {};
    var t = now === undefined ? Date.now() : now;
    Object.keys(r).forEach(function (k) {
        var e = r[k];
        // Chaque entrée vieillit à SON rythme : une adresse signée expire vite, une
        // adresse nue tient le temps de l'événement (voir dureeDeVie).
        if (!e || typeof e.at !== 'number' || t - e.at > dureeDeVie(e.url)) delete r[k];
    });
    if (lienUrl && media && estManifeste(media.url)) {
        r[lienUrl] = { url: media.url, pageUrl: media.pageUrl || '', at: t, echecs: (r[lienUrl] && r[lienUrl].url === media.url) ? (r[lienUrl].echecs | 0) : 0 };
        /* Le cadre qui a demandé le manifeste, vu par la vérification du serveur
           (`mediaReferer`) : le lecteur natif d'Android le renvoie (js/tele.js). */
        if (media.referer) r[lienUrl].referer = String(media.referer);
    }
    return r;
}

export function mediaDirectPour(registre, lienUrl, now) {
    var e = registre && registre[lienUrl];
    if (!e || !estManifeste(e.url)) return null;
    var t = now === undefined ? Date.now() : now;
    if (typeof e.at !== 'number' || t - e.at > dureeDeVie(e.url)) return null;
    return e;
}

/* Un direct qui a échoué deux fois pour ce lien ne se propose plus d'office : on garde
   l'entrée (le bouton reste), mais `aProposer` dit à la tuile de ne pas le tenter seule. */
export function noterEchecDirect(registre, lienUrl) {
    var e = registre && registre[lienUrl];
    if (e) e.echecs = (e.echecs | 0) + 1;
    return registre;
}
export function aProposer(entree) {
    return !!entree && (entree.echecs | 0) < 2;
}

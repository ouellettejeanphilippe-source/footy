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
        if (!e || typeof e.at !== 'number' || t - e.at > MEDIA_DIRECT_TTL_MS) delete r[k];
    });
    if (lienUrl && media && estManifeste(media.url)) {
        r[lienUrl] = { url: media.url, pageUrl: media.pageUrl || '', at: t, echecs: (r[lienUrl] && r[lienUrl].url === media.url) ? (r[lienUrl].echecs | 0) : 0 };
    }
    return r;
}

export function mediaDirectPour(registre, lienUrl, now) {
    var e = registre && registre[lienUrl];
    if (!e || !estManifeste(e.url)) return null;
    var t = now === undefined ? Date.now() : now;
    if (typeof e.at !== 'number' || t - e.at > MEDIA_DIRECT_TTL_MS) return null;
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

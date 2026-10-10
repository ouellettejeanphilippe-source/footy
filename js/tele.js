/* L'application sur une télé Android (Chromecast avec Google TV), dans l'APK de `mobile/`.

   « Garder le concept actuel de l'app, juste adapter à CCGTV » (10 octobre 2026). Sur la
   télé, c'est la même application, avec trois adaptations :

   1. Le mode TV (navigation aux flèches, js/tv-navigation.js) et le mode câble (une seule
      vidéo) s'allument d'eux-mêmes la première fois. Un réglage que l'utilisateur a déjà
      fait, dans un sens ou dans l'autre, n'est jamais repris (`reglagesDeDepart`).
   2. La touche Retour de la télécommande ferme ce qui est ouvert avant de quitter
      l'application (`actionRetour`).
   3. Un flux direct (manifeste HLS) est joué par le lecteur NATIF d'Android
      (LecteurNatifPlugin, ExoPlayer) au lieu de hls.js dans la WebView. « Même un
      navigateur comme Vivaldi est hyper lent sur Chromecast » : le décodage matériel et
      l'absence de page coûtent bien moins, et le lecteur natif peut poser le `Referer`
      que la plupart des CDN exigent, ce qu'aucun navigateur ne peut faire.

   Le côté natif signale la télé en posant `window.__ANDROID_TV__` à chaque chargement de
   page (BloqueurWebViewClient.onPageFinished), puis appelle `window.activerTeleAndroid`.

   Module sans import : partagé par l'application et les tests. */

/* Le plugin Capacitor du lecteur natif, s'il existe (APK Android seulement). */
export function pluginNatif(win) {
    var w = win || (typeof window !== 'undefined' ? window : null);
    var p = w && w.Capacitor && w.Capacitor.Plugins && w.Capacitor.Plugins.LecteurNatif;
    return p && typeof p.jouer === 'function' ? p : null;
}

export function surTeleAndroid(win) {
    var w = win || (typeof window !== 'undefined' ? window : null);
    return !!(w && w.__ANDROID_TV__);
}

/* Ce que la première ouverture sur la télé allume. `lire(cle)` rend la valeur stockée,
   ou null quand l'utilisateur n'a jamais touché au réglage. */
export function reglagesDeDepart(lire) {
    var r = {};
    if (lire('pref-tv-mode') === null) r.modeTv = true;
    if (lire('mode_cable') === null) r.modeCable = true;
    return r;
}

/* La touche Retour, du plus proche au plus loin : un menu, la fiche d'un match, le menu
   « Plus », puis le retour au Live. Sur le Live, rien à fermer : on quitte. */
export function actionRetour(etat) {
    var e = etat || {};
    if (e.menuLecteur) return 'menu';
    if (e.fiche) return 'fiche';
    if (e.menuPlus) return 'plus';
    if (e.vue && e.vue !== 'live') return 'live';
    return 'quitter';
}

/* Les `Referer` que le lecteur natif essaiera, dans l'ordre, sans doublon. La chaîne
   vide veut dire « sans Referer ».
   - le cadre observé par la vérification du serveur (`referer`, js/tvliste.js) ;
   - la page d'où la WebView a vu partir le manifeste (`pageUrl`, mediaVuParAndroid) ;
   - rien : mesuré le 10 octobre 2026 sur instreams.pro, 200 sans Referer ;
   - la page du lien, en dernier : sur le même CDN, elle valait 403. */
export function referersPour(media, lienUrl) {
    var m = media || {};
    var vus = {};
    var liste = [];
    [m.referer, m.pageUrl, '', lienUrl].forEach(function (r) {
        var v = r == null ? null : String(r);
        if (v === null || vus[v]) return;
        if (v && !/^https?:\/\//i.test(v)) return;
        vus[v] = true;
        liste.push(v);
    });
    return liste;
}

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

/* Le bloc « Android » de Plus → Logs, à partir du journal de l'APK
   (LecteurNatif.diagnostic, Journal.java). « Aucune vidéo ne semble partir » (10 octobre
   2026) : sans ordinateur branché à l'appareil, c'est ce qui dit si le bloqueur a coupé
   un lecteur, si le script s'est posé, et ce que le lecteur natif a reçu. `esc` vient de
   l'appelant, pour que le module reste sans import. */
export function diagnosticAndroidHtml(d, esc) {
    var e = esc || function (s) { return String(s); };
    var j = d || {};
    var etats = j.etats || {};
    var ligne = function (nom, val) {
        return '<div style="display:flex; justify-content:space-between; gap:10px; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.05);">'
            + '<b>' + e(nom) + '</b><span style="font-size:12px; text-align:right;">' + e(val) + '</span></div>';
    };
    var html = '<div class="diag-android" style="margin:10px 0;"><div style="font-weight:700; margin-bottom:4px;">Android</div>';
    html += ligne('WebView', etats.webview || '?');
    html += ligne('Script des lecteurs', etats.script || 'pas encore posé');
    html += ligne('Bloqueur', (etats.bloqueur || '?') + ' · ' + (j.requetesBloquees | 0) + ' requêtes bloquées');
    html += ligne('Navigations refusées', String(j.navigationsRefusees | 0));
    var hotes = Array.isArray(j.hotesBloques) ? j.hotesBloques : [];
    if (hotes.length) {
        html += '<div style="font-size:12px; margin-top:6px; opacity:0.85;">Les plus bloqués : '
            + hotes.map(function (h) { return e(h.hote) + ' (' + (h.n | 0) + ')'; }).join(', ') + '</div>';
    }
    var lignes = Array.isArray(j.lignes) ? j.lignes.slice(-25).reverse() : [];
    if (lignes.length) {
        html += '<div style="font-family:monospace; font-size:11px; white-space:pre-wrap; margin-top:6px; max-height:240px; overflow:auto;">'
            + lignes.map(function (l) { return e(l); }).join('\n') + '</div>';
    }
    return html + '</div>';
}

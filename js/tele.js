/* L'application sur une télé Android (Chromecast avec Google TV), dans l'APK de `mobile/`.

   « Garder le concept actuel de l'app, juste adapter à CCGTV » (10 octobre 2026). Sur la
   télé, c'est la même application, avec trois adaptations :

   1. La télécommande navigue (js/tv-navigation.js, sans changer l'apparence), et la page
      est mise à l'échelle d'un écran d'ordinateur (`zoomInterface`). Plus de mode TV ni
      de mode câble imposés : « je veux que l'APK soit exactement le site » (25 octobre
      2026) ; ceux que les versions précédentes avaient posés d'office sont défaits une
      fois (`reglagesImposesADefaire`).
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

/* « T'as forcé le mode câble, je veux que l'APK soit exactement le site » (25 octobre
   2026). Les versions précédentes allumaient d'office le mode TV et le mode câble à la
   première ouverture sur la télé. Une seule fois (`apk_comme_site`), on éteint ceux qui
   sont allumés ; ensuite, ce sont des réglages comme les autres. `lire(cle)` rend la
   valeur stockée ou null. Rend null quand c'est déjà fait. */
export var CLE_APK_COMME_SITE = 'apk_comme_site';
export function reglagesImposesADefaire(lire) {
    if (lire(CLE_APK_COMME_SITE) !== null) return null;
    return { modeTv: lire('pref-tv-mode') === 'true', modeCable: lire('mode_cable') === '1' };
}

/* La touche Retour (et le B de la manette), du plus proche au plus loin : un menu, une
   fenêtre (le guide des scripts, l'enquêteur, le menu Look), la fiche d'un match, le
   menu « Plus » ; puis, comme sur Netflix, la barre de navigation (« donner accès facile
   aux boutons pour changer la vue », 25 octobre 2026) : le focus y va, sauf depuis le
   lecteur, qui revient au Live ; puis le retour au Live ; sur le Live, on quitte.
   `vue` : 'live', 'player' ou 'autre'. */
export function actionRetour(etat) {
    var e = etat || {};
    if (e.menuLecteur) return 'menu';
    if (e.fenetre) return 'fenetre';
    if (e.fiche) return 'fiche';
    if (e.menuPlus) return 'plus';
    if (e.navVisible && !e.dansNav && e.vue !== 'player') return 'nav';
    if (e.vue && e.vue !== 'live') return 'live';
    return 'quitter';
}

/* L'échelle de l'interface (« calme toi le zoom, c'est au moins 200% du 100% que je
   voudrais », 25 octobre 2026). Sur Android TV, la page ne fait que 960 px de large
   (1920 pixels à densité 2) : le site y paraît deux fois plus gros que sur un écran
   d'ordinateur, et le mode TV ajoutait 1,3 par-dessus. En automatique :
     - dans l'APK sur une télé, hors mode TV : la page à LARGEUR_SITE px, comme sur un
       écran d'ordinateur (0,5 sur un Chromecast) ;
     - en mode TV (textes plus gros) : la page à LARGEUR_CIBLE_TV px, entre 0,5 et 1,3
       (1,3 comme avant sur un écran de 1920 px, 0,65 sur un Chromecast) ;
     - ailleurs : 1, rien ne change.
   `reglage` : 'auto' (ou rien), ou un pourcentage choisi dans Options.
   `ctx` : { modeTv, tele }. */
export var LARGEUR_SITE = 1920;
export var LARGEUR_CIBLE_TV = 1480;
function arrondi(x) { return Math.round(x * 100) / 100; }
export function zoomInterface(largeur, reglage, ctx) {
    var c = ctx || {};
    var pct = Number(reglage);
    if (reglage != null && reglage !== '' && reglage !== 'auto' && isFinite(pct) && pct > 0) {
        return arrondi(Math.min(Math.max(pct / 100, 0.4), 2));
    }
    var l = Number(largeur) > 0 ? Number(largeur) : 0;
    if (c.modeTv) return arrondi(Math.min(Math.max((l || LARGEUR_CIBLE_TV) / LARGEUR_CIBLE_TV, 0.5), 1.3));
    if (c.tele) return arrondi(Math.min(Math.max((l || LARGEUR_SITE) / LARGEUR_SITE, 0.5), 1));
    return 1;
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
    if (etats.cadres) html += ligne('Pages qui refusent l\'iframe', etats.cadres);
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

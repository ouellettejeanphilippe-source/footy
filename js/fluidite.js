/* La fluidité, vue de l'appareil (28 octobre 2026, « ça gèle beaucoup et souvent dans l'APK
   sur CCGTV »).

   On ne peut pas mesurer un Chromecast d'ici : le processeur ralenti six fois dans Chromium
   donne ~0 gel en veille et un seul de ~0,4 s à chaque passe de chargement, loin de « beaucoup
   et souvent ». Faute de mesure, l'appareil se mesure lui-même : les tâches de plus de 50 ms
   qui ont bloqué l'interface (`longtask`, l'API que la WebView d'Android TV porte) et les
   arrêts de vidéo, sur les dix dernières minutes, rendus dans Plus → Logs → Cet appareil.
   Sans import : pur, et le navigateur n'est touché que par `brancherMoniteur`. */

export var FENETRE_FLUIDITE_MS = 10 * 60 * 1000;
export var MAX_NOTES = 300;
/* En dessous, un gel passe pour de la gigue ; au-dessus de GEL_GRAVE_MS, l'image et le son
   s'arrêtent bel et bien. */
export var GEL_GRAVE_MS = 500;

export function creerMoniteur() {
    return { gels: [], arrets: [], cadres: [] };
}

/* CE QUI a tenu la page pendant un gel (28 octobre 2026, « quand ya des modals, l'interface
   gèle… mais ça marche nickel avec Firefox », Vivaldi). `longtask` dit combien, pas quoi ;
   et un gel peut ne pas venir du tout de nos scripts (une extension, un script utilisateur,
   la mise en page). Chrome et Vivaldi ont `long-animation-frame`, qui nomme les scripts d'une
   image trop longue et la part du rendu : on en garde la cause principale. Firefox ne l'a
   pas, et n'en a pas besoin ici. */
export var CADRE_NOTE_MS = 200;

function fichier(url) {
    var u = String(url || '');
    if (!u) return '';
    if (/^(chrome|moz)-extension:/.test(u)) return 'extension';
    if (/userscript/i.test(u)) return 'script utilisateur';
    var sans = u.split('#')[0].split('?')[0];
    return sans.slice(sans.lastIndexOf('/') + 1) || sans;
}

/* Une entrée `long-animation-frame` → { d, cause }. La cause est le script le plus long
   (« fonction (fichier) »), ou « mise en page et rendu » quand les scripts n'en font pas
   la moitié. */
export function resumerCadreLong(e) {
    if (!e || !(e.duration > 0)) return null;
    var scripts = (e.scripts || []).slice().sort(function (a, b) { return (b.duration || 0) - (a.duration || 0); });
    var duScript = scripts.reduce(function (a, x) { return a + (x.duration || 0); }, 0);
    var cause;
    if (scripts.length && duScript >= e.duration / 2) {
        var x = scripts[0];
        var nom = x.sourceFunctionName || x.invoker || 'script';
        var f = fichier(x.sourceURL);
        cause = String(nom).slice(0, 60) + (f ? ' (' + f + ')' : '');
    } else {
        cause = 'mise en page et rendu';
    }
    return { d: Math.round(e.duration), cause: cause };
}

export function noterCadreLong(m, e, quand) {
    var r = resumerCadreLong(e);
    if (!m || !r || r.d < CADRE_NOTE_MS) return m;
    if (!m.cadres) m.cadres = [];
    m.cadres.push({ d: r.d, c: r.cause, t: quand });
    borner(m.cadres);
    return m;
}

function borner(liste) {
    while (liste.length > MAX_NOTES) liste.shift();
}

export function noterGel(m, duree, quand) {
    if (!m || !(duree > 0)) return m;
    m.gels.push({ d: Math.round(duree), t: quand });
    borner(m.gels);
    return m;
}

export function noterArret(m, cause, quand) {
    if (!m) return m;
    m.arrets.push({ c: cause || 'inconnue', t: quand });
    borner(m.arrets);
    return m;
}

/* Le bilan des dix dernières minutes à l'instant `maintenant` (ms). */
export function bilan(m, maintenant) {
    var depuis = maintenant - FENETRE_FLUIDITE_MS;
    var gels = ((m && m.gels) || []).filter(function (x) { return x.t >= depuis; });
    var arrets = ((m && m.arrets) || []).filter(function (x) { return x.t >= depuis; });
    var causes = {};
    arrets.forEach(function (x) { causes[x.c] = (causes[x.c] || 0) + 1; });
    return {
        gels: gels.length,
        graves: gels.filter(function (x) { return x.d >= GEL_GRAVE_MS; }).length,
        pire: gels.reduce(function (a, x) { return Math.max(a, x.d); }, 0),
        total: gels.reduce(function (a, x) { return a + x.d; }, 0),
        arrets: arrets.length,
        causes: causes,
        /* Les trois causes de gel qui ont coûté le plus, des longues images (Chrome). */
        coupables: coupables(((m && m.cadres) || []).filter(function (x) { return x.t >= depuis; }))
    };
}

function coupables(cadres) {
    var par = {};
    cadres.forEach(function (x) { var c = par[x.c] || (par[x.c] = { cause: x.c, total: 0, fois: 0 }); c.total += x.d; c.fois++; });
    return Object.keys(par).map(function (k) { return par[k]; })
        .sort(function (a, b) { return b.total - a.total; }).slice(0, 3);
}

/* La ligne de Logs → Cet appareil : { etat: 'ok' | 'warn', texte }. */
export function ligneFluidite(b, observe) {
    if (!observe) return { etat: 'ok', texte: 'non mesurée (cette WebView ne signale pas les gels)' };
    var causes = Object.keys(b.causes).map(function (c) { return b.causes[c] + ' × ' + c; }).join(', ');
    var texte = b.gels + ' gel(s) de plus de 50 ms ces 10 dernières minutes'
        + (b.gels ? ' (le pire ' + b.pire + ' ms, ' + b.graves + ' de plus de ' + GEL_GRAVE_MS + ' ms)' : '')
        + ' · ' + b.arrets + ' arrêt(s) de vidéo' + (causes ? ' (' + causes + ')' : '')
        + ((b.coupables && b.coupables.length) ? ' · causes des gels : ' + b.coupables.map(function (c) { return c.total + ' ms ' + c.cause + (c.fois > 1 ? ' (' + c.fois + ' fois)' : ''); }).join(', ') : '');
    return { etat: (b.graves >= 3 || b.arrets >= 3) ? 'warn' : 'ok', texte: texte };
}

/* Branche le moniteur sur la fenêtre : `window.__fluidite = { m, observe }`. */
export function brancherMoniteur(win) {
    if (!win || win.__fluidite) return win && win.__fluidite;
    var etat = { m: creerMoniteur(), observe: false };
    win.__fluidite = etat;
    try {
        var po = new win.PerformanceObserver(function (liste) {
            liste.getEntries().forEach(function (e) { noterGel(etat.m, e.duration, Date.now()); });
        });
        po.observe({ type: 'longtask' });
        etat.observe = true;
    } catch (e) { /* pas de longtask : la ligne le dit */ }
    try {
        var lo = new win.PerformanceObserver(function (liste) {
            liste.getEntries().forEach(function (e) { noterCadreLong(etat.m, e, Date.now()); });
        });
        lo.observe({ type: 'long-animation-frame' });
    } catch (e) { /* Firefox, Safari : seulement le compte des gels */ }
    return etat;
}

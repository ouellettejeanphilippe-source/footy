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
    return { gels: [], arrets: [] };
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
        causes: causes
    };
}

/* La ligne de Logs → Cet appareil : { etat: 'ok' | 'warn', texte }. */
export function ligneFluidite(b, observe) {
    if (!observe) return { etat: 'ok', texte: 'non mesurée (cette WebView ne signale pas les gels)' };
    var causes = Object.keys(b.causes).map(function (c) { return b.causes[c] + ' × ' + c; }).join(', ');
    var texte = b.gels + ' gel(s) de plus de 50 ms ces 10 dernières minutes'
        + (b.gels ? ' (le pire ' + b.pire + ' ms, ' + b.graves + ' de plus de ' + GEL_GRAVE_MS + ' ms)' : '')
        + ' · ' + b.arrets + ' arrêt(s) de vidéo' + (causes ? ' (' + causes + ')' : '');
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
    return etat;
}

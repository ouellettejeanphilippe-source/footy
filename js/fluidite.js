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

/* ─── Les images perdues, vidéo par vidéo (29 octobre 2026) ────────────────────
   « Mesurer combien de vidéos la télé tient en même temps ». Le compte vient de
   `getVideoPlaybackQuality()` (À APPELER : playwright#3789) : du `<video>` de la tuile en
   mode direct, et du script de nettoyage (`video_stats`, 1.19) pour une page de site. Ce
   sont des COMPTEURS depuis le début de la vidéo : on garde le dernier relevé de chaque
   vidéo (`cle`) et on note l'écart. Un compteur qui recule, c'est une vidéo rechargée : on
   repart de lui. `enCours` : combien de vidéos jouaient à ce moment, ce qui dit à partir de
   combien l'appareil décroche. */
export var SEUIL_PERTE = 0.1;          // 10 % d'images perdues : ça se voit
export var IMAGES_MIN = 60;            // en dessous (2 s à 30 i/s), pas de verdict

export function noterImages(m, cle, total, perdues, quand, enCours) {
    if (!m || cle == null || !(total >= 0) || !(perdues >= 0)) return null;
    if (!m.derniers) m.derniers = {};
    if (!m.images) m.images = [];
    var avant = m.derniers[cle];
    m.derniers[cle] = { t: total, p: perdues };
    if (!avant || total < avant.t || perdues < avant.p) return null;
    var dt = total - avant.t, dp = perdues - avant.p;
    if (!dt) return null;
    var note = { k: String(cle), dt: dt, dp: dp, n: enCours | 0, t: quand };
    m.images.push(note);
    borner(m.images);
    return note;
}

/* La part d'images perdues d'une vidéo sur les `fenetreMs` dernières : { taux, images }. */
export function pertesRecentes(m, cle, maintenant, fenetreMs) {
    var depuis = maintenant - (fenetreMs || FENETRE_FLUIDITE_MS);
    var dt = 0, dp = 0;
    ((m && m.images) || []).forEach(function (x) {
        if (x.k === String(cle) && x.t >= depuis) { dt += x.dt; dp += x.dp; }
    });
    return { taux: dt ? dp / dt : 0, images: dt };
}

/* Le bilan des images sur la fenêtre : par vidéo, et le plus petit nombre de vidéos en
   cours pour lequel une note a dépassé `SEUIL_PERTE` (null : l'appareil n'a jamais décroché). */
export function bilanImages(m, maintenant) {
    var depuis = maintenant - FENETRE_FLUIDITE_MS;
    var par = {}, decroche = null, maxEnCours = 0;
    ((m && m.images) || []).forEach(function (x) {
        if (x.t < depuis) return;
        var v = par[x.k] || (par[x.k] = { cle: x.k, images: 0, perdues: 0 });
        v.images += x.dt; v.perdues += x.dp;
        if (x.n > maxEnCours) maxEnCours = x.n;
        if (x.dt >= IMAGES_MIN && x.dp / x.dt >= SEUIL_PERTE && x.n > 0 && (decroche === null || x.n < decroche)) decroche = x.n;
    });
    var videos = Object.keys(par).map(function (k) { var v = par[k]; v.taux = v.images ? v.perdues / v.images : 0; return v; })
        .sort(function (a, b) { return b.taux - a.taux; });
    return { videos: videos, decroche: decroche, maxEnCours: maxEnCours };
}

export function ligneImages(b) {
    if (!b || !b.videos.length) return { etat: 'ok', texte: 'aucune vidéo mesurée ces 10 dernières minutes' };
    var pct = function (x) { return Math.round(x * 1000) / 10 + ' %'; };
    var texte = b.videos.slice(0, 4).map(function (v) { return v.cle + ' ' + pct(v.taux) + ' (sur ' + v.images + ')'; }).join(', ');
    if (b.decroche) texte += ' · décroche à partir de ' + b.decroche + ' vidéo' + (b.decroche > 1 ? 's' : '') + ' à la fois';
    else if (b.maxEnCours) texte += ' · tient ' + b.maxEnCours + ' vidéo' + (b.maxEnCours > 1 ? 's' : '') + ' à la fois sans décrocher';
    return { etat: b.decroche ? 'warn' : 'ok', texte: texte };
}

/* ─── Le décodage vidéo de l'appareil (29 octobre 2026) ────────────────────────
   La puce décode-t-elle elle-même le H.264 des flux (matériel, `powerEfficient`), ou le
   processeur s'en charge-t-il (logiciel probable) ? `navigator.mediaCapabilities` le dit
   pour le navigateur et la WebView ; le lecteur natif de l'APK écrit le nom de son décodeur
   au journal (Decodeur.java). */
export var PROFILS_DECODAGE = [
    { nom: '1080p', contentType: 'video/mp4; codecs="avc1.640028"', width: 1920, height: 1080, bitrate: 6000000, framerate: 30 },
    { nom: '720p', contentType: 'video/mp4; codecs="avc1.64001f"', width: 1280, height: 720, bitrate: 3000000, framerate: 30 }
];
export function sonderDecodage(nav) {
    var mc = nav && nav.mediaCapabilities;
    if (!mc || typeof mc.decodingInfo !== 'function') return Promise.resolve(null);
    return Promise.all(PROFILS_DECODAGE.map(function (p) {
        return mc.decodingInfo({ type: 'media-source', video: { contentType: p.contentType, width: p.width, height: p.height, bitrate: p.bitrate, framerate: p.framerate } })
            .then(function (r) { return { nom: p.nom, supported: !!r.supported, smooth: !!r.smooth, powerEfficient: !!r.powerEfficient }; })
            .catch(function () { return { nom: p.nom, supported: false, smooth: false, powerEfficient: false }; });
    }));
}
export function ligneDecodage(res) {
    if (!res) return { etat: 'ok', texte: 'non mesuré (ce navigateur ne le dit pas)' };
    var dire = function (r) {
        if (!r.supported) return r.nom + ' : non pris en charge';
        return r.nom + ' : ' + (r.powerEfficient ? 'matériel' : 'logiciel probable') + (r.smooth ? '' : ', pas fluide');
    };
    var mauvais = res.some(function (r) { return !r.supported || !r.powerEfficient || !r.smooth; });
    return { etat: mauvais ? 'warn' : 'ok', texte: 'H.264 ' + res.map(dire).join(' · ') };
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
    try { sonderDecodage(win.navigator).then(function (r) { etat.decodage = r; }); } catch (e) {}
    return etat;
}

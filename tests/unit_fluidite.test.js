/* La fluidité de l'appareil (js/fluidite.js) et les formateurs de date construits une fois.

   28 octobre 2026, « ça gèle beaucoup et souvent dans l'APK sur CCGTV ». Mesuré sous
   Chromium, processeur ralenti six fois : ~0 gel en veille, un seul de ~0,4 s par chargement
   — pas « beaucoup et souvent ». Ce qui s'est vu : `minutesUntilStart` construisait un
   `Intl.DateTimeFormat` (~60 µs, contre ~1 µs pour `format`) à chaque appel, 399 fois au
   démarrage, 244 par chargement, 125 par relecture des scores en direct. Et, faute de mesure
   sur la télé, l'appareil compte maintenant lui-même ses gels et ses arrêts de vidéo. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    w.__NO_AUTOSTART__ = true;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const F = await import('../js/fluidite.js');

    // ── 1. Le moniteur compte sur dix minutes, pas plus ──────────────────────
    const m = F.creerMoniteur();
    const t0 = 1_000_000_000;
    F.noterGel(m, 80, t0 - 11 * 60 * 1000);            // trop ancien
    F.noterGel(m, 120, t0 - 5 * 60 * 1000);
    F.noterGel(m, 900, t0 - 60 * 1000);
    F.noterArret(m, 'attente', t0 - 2 * 60 * 1000);
    F.noterArret(m, 'attente', t0 - 90 * 1000);
    F.noterArret(m, 'absente', t0 - 30 * 1000);
    F.noterArret(m, 'joue', t0 - 20 * 60 * 1000);       // trop ancien
    const b = F.bilan(m, t0);
    assert.strictEqual(b.gels, 2);
    assert.strictEqual(b.graves, 1, 'un gel de 900 ms est grave, pas celui de 120');
    assert.strictEqual(b.pire, 900);
    assert.strictEqual(b.total, 1020);
    assert.strictEqual(b.arrets, 3);
    assert.deepStrictEqual(b.causes, { attente: 2, absente: 1 });
    ok('le bilan ne compte que les dix dernières minutes, par cause');

    // ── 2. Bornes et entrées absurdes ────────────────────────────────────────
    const m2 = F.creerMoniteur();
    for (let i = 0; i < F.MAX_NOTES + 50; i++) F.noterGel(m2, 60, t0);
    assert.strictEqual(m2.gels.length, F.MAX_NOTES, 'mémoire bornée');
    assert.strictEqual(F.noterGel(m2, 0, t0).gels.length, F.MAX_NOTES, 'une durée nulle ne compte pas');
    assert.doesNotThrow(() => F.bilan(null, t0));
    assert.doesNotThrow(() => F.noterArret(null, 'x', t0));
    ok('mémoire bornée, entrées absentes sans effet');

    // ── 3. La ligne de Logs ──────────────────────────────────────────────────
    assert.strictEqual(F.ligneFluidite({ gels: 2, graves: 1, pire: 900, total: 1020, arrets: 2, causes: { attente: 2 } }, true).etat, 'ok', 'un gel grave, deux arrêts : encore correct');
    assert.strictEqual(F.ligneFluidite(b, true).etat, 'warn', 'trois arrêts de vidéo en dix minutes : alerte');
    const mauvais = F.ligneFluidite({ gels: 9, graves: 3, pire: 1800, total: 4000, arrets: 1, causes: { attente: 1 } }, true);
    assert.strictEqual(mauvais.etat, 'warn');
    assert.ok(/9 gel\(s\)/.test(mauvais.texte) && /1800 ms/.test(mauvais.texte) && /attente/.test(mauvais.texte), mauvais.texte);
    assert.ok(/non mesurée/.test(F.ligneFluidite(F.bilan(null, t0), false).texte), 'une WebView sans longtask le dit');
    ok('la ligne dit combien, le pire, et se met en alerte à trois gels graves ou trois arrêts');

    // ── 4. Le moniteur se branche sur longtask, une seule fois ───────────────
    const rappels = {};
    const faux = { PerformanceObserver: function (cb) { this.observe = (o) => { rappels[o.type] = cb; }; } };
    const etat = F.brancherMoniteur(faux);
    assert.strictEqual(etat.observe, true);
    assert.deepStrictEqual(Object.keys(rappels).sort(), ['long-animation-frame', 'longtask']);
    rappels.longtask({ getEntries: () => [{ duration: 230.4 }] });
    assert.strictEqual(etat.m.gels.length, 1);
    assert.strictEqual(etat.m.gels[0].d, 230);
    rappels['long-animation-frame']({ getEntries: () => [{ duration: 640, scripts: [{ duration: 500, invoker: 'TimerHandler:setTimeout', sourceURL: 'https://x.test/footy/js/main.js' }] }] });
    assert.deepStrictEqual(etat.m.cadres.map((c) => c.c), ['TimerHandler:setTimeout (main.js)']);
    assert.strictEqual(F.brancherMoniteur(faux), etat, 'un seul moniteur par fenêtre');
    const sans = F.brancherMoniteur({});
    assert.strictEqual(sans.observe, false, 'sans PerformanceObserver : non mesurée, pas d\'exception');
    ok('brancherMoniteur écoute longtask et ne s\'arme qu\'une fois');

    // ── 4 bis. Ce qui a tenu la page (long-animation-frame, Chrome et Vivaldi) ──
    /* « quand ya des modals, l'interface gèle… nickel avec Firefox » (28 octobre 2026) :
       `longtask` disait combien, pas quoi. */
    assert.deepStrictEqual(F.resumerCadreLong({ duration: 812.6, scripts: [
        { duration: 90, sourceFunctionName: 'petit', sourceURL: 'https://x.test/footy/js/ui.js' },
        { duration: 610, sourceFunctionName: 'loadAll', sourceURL: 'https://x.test/footy/js/main.js?v=3#a' }] }),
        { d: 813, cause: 'loadAll (main.js)' }, 'le script le plus long, par son fichier');
    assert.strictEqual(F.resumerCadreLong({ duration: 700, scripts: [{ duration: 600, invoker: 'x', sourceURL: 'chrome-extension://abc/content.js' }] }).cause, 'x (extension)', 'une extension est nommée comme telle');
    assert.strictEqual(F.resumerCadreLong({ duration: 700, scripts: [{ duration: 600, sourceURL: 'https://x.test/userscript.html?name=Nettoyeur' }] }).cause, 'script (script utilisateur)');
    assert.strictEqual(F.resumerCadreLong({ duration: 700, scripts: [{ duration: 100 }] }).cause, 'mise en page et rendu', 'des scripts courts : le rendu a tenu l\'image');
    assert.strictEqual(F.resumerCadreLong(null), null);
    const m3 = F.creerMoniteur();
    F.noterCadreLong(m3, { duration: 150, scripts: [] }, t0);                                         // trop court
    F.noterCadreLong(m3, { duration: 900, scripts: [{ duration: 800, sourceFunctionName: 'a' }] }, t0 - 11 * 60 * 1000); // trop ancien
    [600, 500].forEach((d) => F.noterCadreLong(m3, { duration: d, scripts: [{ duration: d, sourceFunctionName: 'loadAll', sourceURL: '/js/main.js' }] }, t0));
    F.noterCadreLong(m3, { duration: 400, scripts: [] }, t0);
    const b3 = F.bilan(m3, t0);
    assert.deepStrictEqual(b3.coupables, [
        { cause: 'loadAll (main.js)', total: 1100, fois: 2 },
        { cause: 'mise en page et rendu', total: 400, fois: 1 }]);
    assert.ok(/causes des gels : 1100 ms loadAll \(main\.js\) \(2 fois\), 400 ms mise en page et rendu/.test(F.ligneFluidite(b3, true).texte), F.ligneFluidite(b3, true).texte);
    assert.ok(!/causes des gels/.test(F.ligneFluidite(b, true).texte), 'rien à nommer : rien d\'écrit');
    ok('les gels de Chrome sont attribués : script et fichier, extension, ou rendu');

    // ── 5. Les formateurs de date ne se reconstruisent plus à chaque appel ───
    const Orig = Intl.DateTimeFormat;
    let constructions = 0;
    function Compte() { constructions++; return new Orig(...arguments); }
    Compte.prototype = Orig.prototype;
    Compte.supportedLocalesOf = Orig.supportedLocalesOf;
    Intl.DateTimeFormat = Compte;
    try {
        await import('../js/scrapers.js');
        const C = await import('../js/config.js');
        const A = await import('../js/api.js');
        const S = await import('../js/scrapers.js');
        constructions = 0;
        const d = new Date('2026-10-27T23:00:00Z');
        for (let i = 0; i < 200; i++) {
            C.getEstDateStrFromDate(d);
            A.getEspnDateStr(d);
            S.zoneOffsetMinutes(d, 'Europe/London');
            C.minutesUntilStart({ startTime: '19:00', matchDate: '2026-10-27' }, d);
        }
        assert.ok(constructions <= 3, constructions + ' constructions pour 800 appels (une par formateur : date EST, date ESPN, Europe/London)');
        assert.strictEqual(C.getEstDateStrFromDate(d), '2026-10-27');
        assert.strictEqual(A.getEspnDateStr(d), '20261027');
        assert.strictEqual(S.zoneOffsetMinutes(d, 'Europe/London'), 0, 'même résultat qu\'avant');
        ok('800 appels de date : une construction par formateur, pas une par appel');
    } finally {
        Intl.DateTimeFormat = Orig;
    }

    // ── Images perdues par vidéo, et le décodage (29 octobre 2026) ─────────────
    {
        const F = await import('../js/fluidite.js');
        const m = F.creerMoniteur();
        const T = 1000000;
        assert.strictEqual(F.noterImages(m, 'v1', 100, 0, T, 1), null, 'le premier relevé ne fait que poser le compteur');
        assert.deepStrictEqual(F.noterImages(m, 'v1', 400, 6, T + 10000, 1), { k: 'v1', dt: 300, dp: 6, n: 1, t: T + 10000 }, 'un écart de compteurs');
        assert.strictEqual(F.noterImages(m, 'v1', 50, 0, T + 15000, 1), null, 'un compteur qui recule : vidéo rechargée, on repart de lui');
        F.noterImages(m, 'v1', 350, 3, T + 25000, 1);
        F.noterImages(m, 'v2', 0, 0, T + 20000, 2);
        F.noterImages(m, 'v2', 300, 90, T + 30000, 2);    // 30 % perdues à deux vidéos
        F.noterImages(m, 'v3', 0, 0, T + 20000, 3);
        F.noterImages(m, 'v3', 30, 20, T + 30000, 3);     // trop peu d'images pour un verdict
        const r = F.pertesRecentes(m, 'v2', T + 31000, 20000);
        assert.ok(Math.abs(r.taux - 0.3) < 1e-9 && r.images === 300);
        assert.strictEqual(F.pertesRecentes(m, 'v1', T + 31000, 20000).images, 300, 'seules les notes de la fenêtre comptent');
        const b = F.bilanImages(m, T + 31000);
        assert.strictEqual(b.decroche, 2, 'décroche à partir de deux vidéos (la note de trois a trop peu d\'images)');
        assert.strictEqual(b.maxEnCours, 3);
        assert.strictEqual(b.videos[0].cle, 'v3', 'la pire d\'abord');
        const l = F.ligneImages(b);
        assert.strictEqual(l.etat, 'warn');
        assert.ok(/décroche à partir de 2 vidéos à la fois/.test(l.texte), l.texte);
        assert.strictEqual(F.ligneImages(F.bilanImages(F.creerMoniteur(), T)).etat, 'ok');
        assert.strictEqual(F.bilanImages(m, T + 31000 + F.FENETRE_FLUIDITE_MS).videos.length, 0, 'dix minutes après : oublié');

        assert.strictEqual(await F.sonderDecodage({}), null, 'sans mediaCapabilities : rien');
        const nav = { mediaCapabilities: { decodingInfo: (c) => Promise.resolve({ supported: true, smooth: true, powerEfficient: c.video.height < 1000 }) } };
        const dec = await F.sonderDecodage(nav);
        assert.deepStrictEqual(dec.map((x) => [x.nom, x.powerEfficient]), [['1080p', false], ['720p', true]]);
        const ld = F.ligneDecodage(dec);
        assert.strictEqual(ld.etat, 'warn');
        assert.strictEqual(ld.texte, 'H.264 1080p : logiciel probable · 720p : matériel');
        assert.strictEqual(F.ligneDecodage(null).etat, 'ok');
        ok('images perdues : écart de compteurs, vidéo rechargée, à partir de combien de vidéos ça décroche ; décodage matériel ou logiciel');
    }

    console.log(`unit_fluidite: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

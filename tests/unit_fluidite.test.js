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
    let rappel = null, vu = null;
    const faux = { PerformanceObserver: function (cb) { rappel = cb; this.observe = (o) => { vu = o; }; } };
    const etat = F.brancherMoniteur(faux);
    assert.strictEqual(etat.observe, true);
    assert.deepStrictEqual(vu, { type: 'longtask' });
    rappel({ getEntries: () => [{ duration: 230.4 }] });
    assert.strictEqual(etat.m.gels.length, 1);
    assert.strictEqual(etat.m.gels[0].d, 230);
    assert.strictEqual(F.brancherMoniteur(faux), etat, 'un seul moniteur par fenêtre');
    const sans = F.brancherMoniteur({});
    assert.strictEqual(sans.observe, false, 'sans PerformanceObserver : non mesurée, pas d\'exception');
    ok('brancherMoniteur écoute longtask et ne s\'arme qu\'une fois');

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

    console.log(`unit_fluidite: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

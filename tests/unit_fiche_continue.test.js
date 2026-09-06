/* Mise à jour des flux à même la page, tant que la fiche reste ouverte.

   « Ok pour le cache de liens et de matchs, mais meilleure mise à jour des streams à même
   la page » (6 septembre 2026). Jusqu'ici, ouvrir une fiche déclenchait UNE relecture puis
   plus rien : la fenêtre restait figée sur ce qu'elle avait trouvé à la seconde de son
   ouverture.

   Ce n'est pas théorique. Mesuré le même jour sur les pages réelles de Footybite :
   Everton–Manchester United, bien engagé, annonçait « Available Streams (55) » ; Arsenal–
   Chelsea, qui venait de commencer, en annonçait 5. Les liens arrivent au fil du match, et
   le match qu'on regarde est justement celui dont la liste bouge le plus. */
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
    const S = await import('../js/scrapers.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    const T = 1800000000000;
    const doit = (m, now, pont) => S.doitRafraichirFiche(m, now, pont);
    const enDirect = (extra) => Object.assign({ matchUrl: 'https://footybite.im/game/a-vs-b-1', status: 'live' }, extra || {});

    // ── 1. Avec le pont, on relit à intervalle régulier ──────────────────────
    assert.strictEqual(doit(enDirect(), T, true), true, 'jamais lue : on relit tout de suite');
    assert.strictEqual(doit(enDirect({ pageLueA: T - 10000 }), T, true), false, 'lue il y a 10 s : on attend');
    assert.strictEqual(doit(enDirect({ pageLueA: T - S.INTERVALLE_FICHE_MS }), T, true), true, 'une minute passée : on relit');
    assert.strictEqual(doit(enDirect({ pageLueA: T - 5 * 60000 }), T, true), true);
    ok('avec le pont, la fiche ouverte se relit chaque minute');

    // ── 2. Sans le pont, jamais : aucun transport ne passe ───────────────────
    /* Les proxys CORS publics sont morts ; hors du script utilisateur, une relecture ne
       peut qu'échouer, et marteler un site pour rien n'aide personne. */
    assert.strictEqual(doit(enDirect(), T, false), false);
    assert.strictEqual(doit(enDirect({ pageLueA: T - 60 * 60000 }), T, false), false, 'même après une heure');
    ok('sans le script utilisateur, aucune relecture continue');

    // ── 3. Un match terminé ne bouge plus ───────────────────────────────────
    assert.strictEqual(doit(enDirect({ status: 'finished' }), T, true), false);
    assert.strictEqual(doit(enDirect({ status: 'upcoming' }), T, true), true, 'un match à venir publie ses liens avant le coup d\'envoi');
    ok('un match terminé n\'est plus relu ; un match à venir l\'est');

    // ── 4. Rien à relire sans page de match ─────────────────────────────────
    assert.strictEqual(doit({ status: 'live' }, T, true), false, 'aucune adresse : rien à lire');
    assert.strictEqual(doit(null, T, true), false);
    ok('pas d\'adresse de match, pas de relecture');

    console.log(`unit_fiche_continue: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

/* Le domaine Footybite : .im sert les pages de match, .bid les refuse.

   « Footybite… ya genre souvent 20-40 liens » — et l'application n'en affichait aucun.
   Mesuré le 5 septembre 2026 : Footybite est la source de 178 matchs du cache et
   fournissait ZÉRO lecteur.

   La cause tenait à un seul domaine. Les deux servent l'accueil (le .bid y redirige vers
   le .im), mais seul le .im sert les pages de match : sur huit pages testées, .im rend
   200 huit fois sur huit, .bid rend 403. C'est sur ce 403 qu'on avait conclu que « les
   pages de match Footybite ne répondent jamais depuis un serveur », et qu'on avait mis
   la source entière à l'écart via MATCH_PAGE_BLOCKED_HOSTS — dont le motif
   « footybite\\.[a-z.]+ » emportait aussi le .im au passage.

   Ce que cette mise à l'écart coûtait, mesuré sur la page que l'utilisateur a signalée
   (Philadelphia Union — CF Montréal) : la page annonce « Available Streams (14) », et
   l'extracteur en tire 12, avec noms de serveurs, langue et qualité. L'application, elle,
   n'affichait qu'un lien de repli « Page du match ».

   Ces cas verrouillent la distinction : le .im doit rester joignable, le .bid écarté. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement']) {
        Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
    }
    const cfg = await import('../js/config.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── 1. Le .im n'est plus écarté, le .bid l'est toujours ─────────────────
    assert.strictEqual(cfg.isMatchPageBlocked('https://footybite.im/game/philadelphia-union-vs-cf-montral-3250605177'), false,
        'footybite.im sert ses pages de match : l\'écarter revient à jeter la source la mieux fournie');
    assert.strictEqual(cfg.isMatchPageBlocked('https://footybite.bid/game/philadelphia-union-vs-cf-montral-3250605177'), true,
        'footybite.bid rend 403 sur /game/ : il reste écarté');
    ok('footybite.im joignable, footybite.bid écarté — la distinction est par domaine');

    // ── 2. Les autres hôtes écartés le restent ──────────────────────────────
    /* Le motif a été resserré ; il ne doit pas l'avoir été au point de laisser passer les
       miroirs Streameast, qui répondent 429 de façon reproductible. */
    assert.strictEqual(cfg.isMatchPageBlocked('https://v2.gostreameast.is/mlb/a-vs-b/'), true);
    assert.strictEqual(cfg.isMatchPageBlocked('https://www.streameast.ms/mlb/a-vs-b/'), true);
    assert.strictEqual(cfg.isMatchPageBlocked('https://thestreameast.top/x'), true);
    ok('les miroirs Streameast restent écartés');

    // ── 3. Rien d'innocent n'est écarté au passage ──────────────────────────
    assert.strictEqual(cfg.isMatchPageBlocked('https://flexfitness.fit/watch-live/x/y/a-vs-b/1'), false);
    assert.strictEqual(cfg.isMatchPageBlocked('https://methstreams.gs/stream/a-vs-b'), false);
    assert.strictEqual(cfg.isMatchPageBlocked('pas-une-url'), false);
    ok('les autres sources ne sont pas écartées');

    // ── 4. L'adresse de la source pointe bien sur le domaine qui répond ─────
    assert.ok(/footybite\.im/.test(cfg.SITE),
        'SITE doit viser le domaine qui sert les pages de match (obtenu : ' + cfg.SITE + ')');
    const miroirs = cfg.SOURCE_MIRRORS.footybite || [];
    assert.ok(/footybite\.im/.test(miroirs[0]),
        'le .im doit être le premier miroir essayé');
    assert.ok(miroirs.some((u) => /footybite\.bid/.test(u)),
        'le .bid reste en secours : il sert l\'accueil, et un domaine peut retomber en marche');
    ok('la source vise le .im, avec le .bid en secours');

    console.log(`unit_footybitedomaine: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

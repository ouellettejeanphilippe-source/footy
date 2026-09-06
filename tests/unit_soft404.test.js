/* Une page servie sous « introuvable », et l'identité d'une source par ses miroirs.

   Mesuré le 6 septembre 2026. `soccersurge.io` est le bras soccer de Sportsurge et le seul
   de ses domaines joignable depuis un centre de données — `v2.sportsurge.net` y rend 403,
   avec 5 Ko de page d'erreur. Or soccersurge répond **404 sur toutes ses adresses**, page
   d'accueil comprise, tout en servant 181 Ko contenant 53 liens de match. `fetchPage`
   jetait cette réponse sur son seul code HTTP, avant de regarder le corps : la grille
   était perdue.

   Le piège, mesuré lui aussi : ce site sert la MÊME grille sur n'importe quel chemin, y
   compris inventé (`/nexiste-pas-0000` rend les mêmes 53 liens). Accepter ce corps pour
   une PAGE DE MATCH y injecterait 53 liens étrangers, attribués au mauvais match — le
   défaut même qu'on a passé la semaine à démêler. D'où la frontière : seule la découverte
   des listes demande `soft404`.

   Second point : l'identité d'une source englobe ses miroirs. Sans cela, les liens trouvés
   sur soccersurge.io étaient comptés sous « footybite », la source qui avait DÉCOUVERT le
   match. Aucun lien perdu, mais un relevé par source faux — et c'est sur ce relevé qu'on
   décide quelle source est en panne. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement']) {
        Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
    }
    const F = await import('../js/fetcher.js');
    const cfg = await import('../js/config.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── 1. Le succès reste le succès, l'échec reste l'échec ─────────────────
    assert.strictEqual(F.statutAcceptable(200, {}), true);
    assert.strictEqual(F.statutAcceptable(204, { soft404: true }), true);
    assert.strictEqual(F.statutAcceptable(404, {}), false, 'sans demande explicite, un 404 reste un échec');
    assert.strictEqual(F.statutAcceptable(404), false, 'sans options non plus');
    ok('un 404 reste un échec tant qu\'on ne l\'accepte pas explicitement');

    // ── 2. La découverte accepte « introuvable », mais pas un refus ─────────
    assert.strictEqual(F.statutAcceptable(404, { soft404: true }), true, 'la grille servie sous 404 est lue');
    assert.strictEqual(F.statutAcceptable(410, { soft404: true }), true);
    /* 403 et 429 sont des REFUS : ils ne portent pas de contenu (le 403 de sportsurge fait
       5 Ko de page d'erreur). Les accepter empêcherait la bascule vers un miroir vivant. */
    assert.strictEqual(F.statutAcceptable(403, { soft404: true }), false, 'un refus n\'est pas une page');
    assert.strictEqual(F.statutAcceptable(429, { soft404: true }), false);
    assert.strictEqual(F.statutAcceptable(500, { soft404: true }), false);
    assert.strictEqual(F.statutAcceptable(502, { soft404: true }), false);
    ok('« introuvable » est accepté à la découverte ; un refus ou une panne, jamais');

    // ── 3. soccersurge est un miroir de sportsurge ──────────────────────────
    const miroirs = cfg.SOURCE_MIRRORS.sportsurge || [];
    assert.ok(miroirs.some((u) => /soccersurge\.io/.test(u)), 'soccersurge doit figurer parmi les miroirs');
    assert.ok(!/soccersurge/.test(miroirs[0]), 'mais en dernier recours : sa grille est surtout du football');
    ok('soccersurge.io est un miroir de secours de Sportsurge');

    // ── 4. L'identité d'une source englobe ses miroirs ──────────────────────
    assert.strictEqual(cfg.sourceIdPourHote('soccersurge.io'), 'sportsurge',
        'un domaine frère appartient à sa source, pas à celle qui a découvert le match');
    assert.strictEqual(cfg.sourceIdPourHote('v2.sportsurge.net'), 'sportsurge');
    assert.strictEqual(cfg.sourceIdPourHote('www.sportsurge.net'), 'sportsurge', 'préfixes ignorés');
    assert.strictEqual(cfg.sourceIdPourHote('footybite.im'), 'footybite');
    assert.strictEqual(cfg.sourceIdPourHote('onhockey.tv'), 'onhockey');
    assert.strictEqual(cfg.sourceIdPourHote('embed.st'), '', 'un hôte de lecteur n\'est pas une source');
    assert.strictEqual(cfg.sourceIdPourHote(''), '');
    assert.strictEqual(cfg.sourceIdPourHote(null), '');
    ok('chaque hôte est rattaché à sa source, miroirs compris');

    console.log(`unit_soft404: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

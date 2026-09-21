/* Une page de match n'est pas un flux (js/match.js : pagesDeMatch, estPageDeMatch,
   retirerPagesDeMatch ; scripts/scrape_streams.mjs). Sans réseau.

   « Le lien amène à la liste des liens sur la page de match sur MLBite, pas aux liens
   eux-mêmes des streams » (20 septembre 2026).

   Une page de match LISTE les lecteurs ; elle n'en est pas un. Mais elle liste aussi les
   autres matchs du site, et l'extracteur ramassait cette navigation comme autant de
   sources. Relevé sur un Rangers–Blue Jays : neuf liens `mlbbite.plus/watch/live/…`, dont
   six nommaient un tout autre match. Scanné sur le cache entier : `mlbbite.plus`,
   `soccersurge.io` et `app.buffstreams.is` n'apportaient QUE ça — les 73 liens de
   buffstreams étaient littéralement les `matchUrl` d'autres matchs — et `liveleagues.me`
   pour 41 %. Environ 295 liens, ~15 % du catalogue.

   La règle qui devait les écarter existait (`isFallback`) mais reconnaissait une page de
   match à son NOM (« Page du match sur X ») : seules celles que l'application fabrique
   s'appellent ainsi. Les autres passaient à travers.

   Ce que ce test verrouille :
     - une adresse qui EST le matchUrl d'un match de la grille est une page de match ;
     - une adresse de même FORME l'est aussi, mais seulement si la forme est attestée
       plusieurs fois — un lecteur isolé ne doit pas tomber sur un seul exemple ;
     - la politique déjà en vigueur est respectée : elles disparaissent quand un vrai
       lecteur existe, sinon il en reste UNE par site ;
     - la page du match lui-même n'est jamais retirée (c'est le repli « Page du match ») ;
     - AUCUN nom d'équipe n'entre dans la décision. Trois détections par noms ont précédé
       celle-ci, et les trois ont donné des faux positifs (accents, un seul camp qui
       concorde, noms collés en un mot). */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }
    const match = await import('../js/match.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const MB = (s) => 'https://mlbbite.plus/watch/live/' + s + '-free-live-stream';

    // ── 1. La forme d'une adresse, identifiants masqués ─────────────────────
    assert.strictEqual(match.formeDAdresse(MB('boston-red-sox-at-texas-rangers-15')),
        'mlbbite.plus/watch/live/*', 'le segment qui porte un chiffre devient *');
    assert.strictEqual(match.formeDAdresse('https://www.liveleagues.me/mexico-liga-mx/queretaro-vs-leon-1-live-streaming'),
        'liveleagues.me/mexico-liga-mx/*', 'www. ne compte pas, et le slug non plus');
    assert.strictEqual(match.formeDAdresse('https://embed.st/embed/admin/ppv-jays/1'),
        'embed.st/embed/admin/ppv-jays/*', 'un lecteur a sa propre forme, distincte de celle d\'une page de match');
    assert.strictEqual(match.formeDAdresse('pas une adresse'), '', 'une entrée illisible ne lève rien');
    ok('la forme d\'une adresse se lit sans jamais regarder un nom d\'équipe');

    // ── 2. La preuve : être le matchUrl d'un match de la grille ─────────────
    const grille = [
        { matchUrl: 'https://footybite.im/game/rangers-vs-jays-1', streamLinks: [] },
        { matchUrl: MB('boston-red-sox-at-texas-rangers-15'), streamLinks: [] },
        { matchUrl: MB('detroit-tigers-at-toronto-blue-jays-20'), streamLinks: [] },
        { matchUrl: MB('cubs-at-reds-3'), streamLinks: [] },
    ];
    const pages = match.pagesDeMatch(grille);
    assert.strictEqual(Object.keys(pages.urls).length, 4, 'les quatre pages de match sont connues');
    assert.deepStrictEqual(Object.keys(pages.formes), ['mlbbite.plus/watch/live/*'],
        'la forme mlbbite est attestée trois fois ; celle de footybite, une seule, ne l\'est pas');
    assert.strictEqual(match.estPageDeMatch(MB('jamais-vu-99'), pages), true,
        'une adresse mlbbite jamais vue est reconnue par sa forme');
    assert.strictEqual(match.estPageDeMatch('https://footybite.im/game/autre-match-2', pages), false,
        'mais pas une forme attestée une seule fois : un lecteur isolé ne doit pas tomber pour un exemple');
    assert.strictEqual(match.estPageDeMatch('https://embed.st/embed/admin/ppv-jays/1', pages), false,
        'ni un vrai lecteur');
    ok('une page de match se prouve, elle ne se devine pas');

    // ── 3. Le cas réel : neuf liens mlbbite sur un match footybite ──────────
    const vrai = [
        { matchUrl: 'https://footybite.im/game/rangers-vs-jays-1', streamLinks: [
            { url: 'https://embed.st/embed/admin/ppv-jays-vs-rangers/1' },
            { url: 'https://isportsurge.ws/watch/mlb/texas-rangers-toronto-blue-jays/401806600' },
            { url: MB('boston-red-sox-at-texas-rangers-15') },
            { url: MB('detroit-tigers-at-toronto-blue-jays-20') },
            { url: MB('toronto-blue-jays-at-texas-rangers-11') },
        ] },
        { matchUrl: MB('boston-red-sox-at-texas-rangers-15'), streamLinks: [] },
        { matchUrl: MB('detroit-tigers-at-toronto-blue-jays-20'), streamLinks: [] },
        { matchUrl: MB('cubs-at-reds-3'), streamLinks: [] },
    ];
    const p2 = match.pagesDeMatch(vrai);
    const retires = match.retirerPagesDeMatch(vrai, p2);
    const restants = vrai[0].streamLinks.map((l) => l.url);
    assert.strictEqual(retires, 3, 'les trois pages mlbbite partent');
    assert.deepStrictEqual(restants, [
        'https://embed.st/embed/admin/ppv-jays-vs-rangers/1',
        'https://isportsurge.ws/watch/mlb/texas-rangers-toronto-blue-jays/401806600',
    ], 'le lecteur ET le recoupement sur un autre agrégateur restent : ils ne sont pas des pages de match');
    ok('les pages de match partent, les vrais lecteurs et les recoupements restent');

    // ── 4. Sans aucun lecteur, il reste UNE porte par site ──────────────────
    const nu = [
        { matchUrl: 'https://footybite.im/game/x-1', streamLinks: [
            { url: MB('a-at-b-1') }, { url: MB('c-at-d-2') }, { url: MB('e-at-f-3') },
            { url: 'https://soccersurge.io/watch-1-x' }, { url: 'https://soccersurge.io/watch-2-y' },
        ] },
        { matchUrl: MB('a-at-b-1'), streamLinks: [] },
        { matchUrl: MB('c-at-d-2'), streamLinks: [] },
        { matchUrl: MB('e-at-f-3'), streamLinks: [] },
        { matchUrl: 'https://soccersurge.io/watch-1-x', streamLinks: [] },
        { matchUrl: 'https://soccersurge.io/watch-2-y', streamLinks: [] },
        { matchUrl: 'https://soccersurge.io/watch-3-z', streamLinks: [] },
    ];
    match.retirerPagesDeMatch(nu, match.pagesDeMatch(nu));
    const hotes = nu[0].streamLinks.map((l) => new URL(l.url).hostname);
    assert.strictEqual(nu[0].streamLinks.length, 2, 'une seule par site quand il n\'y a rien d\'autre');
    assert.deepStrictEqual(hotes, ['mlbbite.plus', 'soccersurge.io'], 'une porte de secours par site, pas une liste');
    ok('sans lecteur, il reste une porte par site — pas zéro, pas cinq');

    // ── 5. La page du match lui-même n'est jamais retirée ───────────────────
    const propre = [
        { matchUrl: MB('a-at-b-1'), streamLinks: [{ url: MB('a-at-b-1') }, { url: MB('c-at-d-2') }] },
        { matchUrl: MB('c-at-d-2'), streamLinks: [] },
        { matchUrl: MB('e-at-f-3'), streamLinks: [] },
    ];
    match.retirerPagesDeMatch(propre, match.pagesDeMatch(propre));
    assert.deepStrictEqual(propre[0].streamLinks.map((l) => l.url), [MB('a-at-b-1')],
        'sa propre page reste (c\'est le repli « Page du match sur X »), celle d\'un autre match part');
    /* Et sa propre page COMPTE comme un lecteur pour la suite : sans cette distinction,
       les deux tomberaient dans « une porte par site » et la page d'un site étranger
       survivrait à côté. */
    const distinct = [
        { matchUrl: MB('a-at-b-1'), streamLinks: [{ url: MB('a-at-b-1') }, { url: 'https://soccersurge.io/watch-9-z' }] },
        { matchUrl: MB('c-at-d-2'), streamLinks: [] },
        { matchUrl: MB('e-at-f-3'), streamLinks: [] },
        { matchUrl: 'https://soccersurge.io/watch-9-z', streamLinks: [] },
        { matchUrl: 'https://soccersurge.io/watch-8-y', streamLinks: [] },
        { matchUrl: 'https://soccersurge.io/watch-7-x', streamLinks: [] },
    ];
    match.retirerPagesDeMatch(distinct, match.pagesDeMatch(distinct));
    assert.deepStrictEqual(distinct[0].streamLinks.map((l) => l.url), [MB('a-at-b-1')],
        'sa propre page suffit : la page d\'un autre site n\'a pas à rester à côté');
    ok('le repli vers sa propre page de match survit, et rend les autres inutiles');

    // ── 6. Rien, ou n'importe quoi : pas d'exception ────────────────────────
    assert.deepStrictEqual(match.pagesDeMatch(null), { urls: {}, formes: {} });
    assert.strictEqual(match.retirerPagesDeMatch(null, { urls: {}, formes: {} }), 0);
    assert.strictEqual(match.retirerPagesDeMatch([{ streamLinks: null }, {}, null], match.pagesDeMatch([])), 0);
    assert.strictEqual(match.estPageDeMatch('', null), false);
    ok('une grille vide ou biscornue ne lève pas d\'exception');

    // ── 7. Le scrape applique la règle une fois TOUT fusionné ───────────────
    /* La preuve qu'une adresse est une page de match, c'est qu'elle est le matchUrl d'un
       AUTRE match : il faut donc la grille entière. Appliquée trop tôt, la règle ne
       verrait qu'une partie des pages. */
    const fs = require('fs');
    const src = fs.readFileSync(require('path').join(__dirname, '..', 'scripts', 'scrape_streams.mjs'), 'utf8');
    assert.ok(/match\.pagesDeMatch\(all\)/.test(src), 'le scrape calcule les pages sur la grille entière');
    assert.ok(/match\.retirerPagesDeMatch\(all, pages\)/.test(src), 'et applique la règle');
    assert.ok(src.indexOf('adressesNonSpecifiques') < src.indexOf('pagesDeMatch'),
        'après le retrait du décor, dans la même passe globale');
    ok('le scrape applique la règle sur la grille fusionnée, pas avant');

    console.log(`unit_pagesdematch: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

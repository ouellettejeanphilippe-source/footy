/* Tests unitaires de la mémoire d'isMatch (js/match.js), sans réseau.

   « Encore du lag » sur le Chromecast (30 octobre 2026) : le profil CPU de la WebView,
   page Live seule, a mis isMatch à 69 % du temps de script (85 % avec la similarité), parce
   que le rapprochement des matchs et des liens compare sans cesse les mêmes paires de noms.
   isMatch retient maintenant ses réponses. Ce qu'on garde ici : elle ne change AUCUNE
   réponse (avec ou sans `strict`), la seconde passe ne recalcule rien, et les arguments qui
   ne sont pas des textes passent par le chemin d'avant. */
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

    const noms = [
        'manchestercity', 'manchesterunited', 'arsenal', 'arsenl', 'tampabaylightning', 'tanpabaylightning', 'tampa',
        'rangers', 'queensparkrangers', 'austin', 'austinfc', 'nottinghamforest', 'brest', 'lehavre', 'realmadrid',
        'atleticomadrid', 'montrealcanadiens', 'cfmontreal', 'newyorkjets', 'newyorkmets', 'nflnetwork', 'nhlnetwork', 'ab', ''
    ];
    const paires = [];
    for (const a of noms) for (const b of noms) paires.push([a, b]);

    // ── 1. Mêmes réponses qu'avant, à la première puis à la seconde demande ──
    for (const strict of [false, true]) {
        for (const [a, b] of paires) {
            const attendu = match.isMatchSansCache(a, b, strict);
            assert.strictEqual(match.isMatch(a, b, strict), attendu, `1re demande : isMatch(${a}, ${b}, ${strict})`);
            assert.strictEqual(match.isMatch(a, b, strict), attendu, `2e demande : isMatch(${a}, ${b}, ${strict})`);
        }
    }
    ok('les réponses sont celles d\'avant, avec et sans `strict`, à la première comme à la seconde demande');

    // ── 2. `strict` et non strict ne se mélangent pas dans la mémoire ───────
    assert.strictEqual(match.isMatch('rangers', 'queensparkrangers', false), true, 'sans strict : inclusion');
    assert.strictEqual(match.isMatch('rangers', 'queensparkrangers', true), false, 'strict : l\'inclusion est sautée');
    assert.strictEqual(match.isMatch('rangers', 'queensparkrangers', false), true, 'de nouveau sans strict, après le strict');
    ok('strict et non strict ont chacun leur réponse');

    // ── 3. Une seconde passe sur les mêmes paires ne recalcule rien ─────────
    const avant = match.statsMemoireIsMatch();
    for (const strict of [false, true]) for (const [a, b] of paires) match.isMatch(a, b, strict);
    const apres = match.statsMemoireIsMatch();
    assert.strictEqual(apres.calculs, avant.calculs, 'aucun calcul de plus sur des paires déjà vues');
    assert.strictEqual(apres.appels - avant.appels, paires.length * 2, 'tous les appels sont comptés');
    assert.ok(apres.taille > 0 && apres.taille <= match.MEMOIRE_ISMATCH_MAX, 'la mémoire reste sous son plafond');
    ok('une seconde passe ne recalcule aucune paire');

    // ── 4. Ce qui n'est pas un texte passe par le chemin d'avant ────────────
    assert.strictEqual(match.isMatch('', ''), true);
    assert.strictEqual(match.isMatch(null, 'arsenal'), false);
    assert.strictEqual(match.isMatch('arsenal', undefined), false);
    ok('vide, null et undefined : comme avant');

    console.log(`\n${n} tests passés`);
}

main().catch((e) => { console.error(e); process.exit(1); });

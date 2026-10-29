/* Le choix des matchs du lecteur, façon Prime Video (js/choixmulti.js).

   « Go pour le style Prime Video » (29 octobre 2026) : « + Ajouter » ouvre un écran de
   cartes, on coche jusqu'à quatre matchs, « Regarder ». Ce test verrouille ce que le
   module décide seul : quelles cartes, le plafond, et ce qu'il faut retirer ou ajouter
   sans toucher aux tuiles qui restent. */
const assert = require('assert');

async function main() {
    const C = await import('../js/choixmulti.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // 1. Les cartes : celles du lecteur d'abord, puis les matchs regardables, sans doublon.
    const chaines = [{ id: 'x', homeTeam: 'X' }, { id: 'a', homeTeam: 'A' }, { id: 'y' }];
    const cartes = C.cartesDuChoix(chaines, ['a', 'fini'], [{ id: 'fini', homeTeam: 'F', status: 'finished' }]);
    assert.deepStrictEqual(cartes.map((c) => c.id), ['a', 'fini', 'x', 'y']);
    assert.strictEqual(cartes[1].homeTeam, 'F', 'un match fini du lecteur garde sa fiche, pour qu\'on puisse le décocher');
    const inconnu = C.cartesDuChoix([], ['zz'], []);
    assert.deepStrictEqual(inconnu, [{ id: 'zz', inconnu: true }], 'une tuile dont le match a disparu reste décochable');
    ok('les cartes : le lecteur en tête, puis les matchs en direct, sans doublon');

    // 2. Le plafond de quatre.
    let sel = [];
    ['a', 'b', 'c', 'd'].forEach((id) => { sel = C.basculerChoix(sel, id); });
    assert.deepStrictEqual(sel, ['a', 'b', 'c', 'd']);
    assert.deepStrictEqual(C.basculerChoix(sel, 'e'), ['a', 'b', 'c', 'd'], 'pas de cinquième');
    assert.deepStrictEqual(C.basculerChoix(sel, 'b'), ['a', 'c', 'd'], 'décocher libère une place');
    assert.deepStrictEqual(C.basculerChoix([1], 1), [], 'les identifiants sont comparés en texte');
    assert.notStrictEqual(C.basculerChoix(sel, 'b'), sel, 'un tableau neuf');
    ok('cocher et décocher, quatre au plus');

    // 3. Ce qu'il faut faire au lecteur.
    assert.deepStrictEqual(C.differenceChoix(['a', 'b', 'c'], ['c', 'd']), { retirer: [1, 0], ajouter: ['d'] },
        'les retraits du plus grand index au plus petit, la tuile c reste sans recharger');
    assert.deepStrictEqual(C.differenceChoix(['a'], ['a']), { retirer: [], ajouter: [] });
    assert.deepStrictEqual(C.differenceChoix([], ['b', 'a']), { retirer: [], ajouter: ['b', 'a'] }, 'dans l\'ordre où on les a cochés');
    assert.deepStrictEqual(C.differenceChoix(null, null), { retirer: [], ajouter: [] });
    ok('la différence : retirer, ajouter, rien d\'autre');

    // 4. Le bouton principal.
    assert.strictEqual(C.libelleRegarder([], []), 'Choisir au moins un match');
    assert.strictEqual(C.libelleRegarder(['a'], ['a', 'b']), 'Regarder (2)');
    assert.strictEqual(C.libelleRegarder(['a'], []), 'Regarder (0)', 'tout décocher vide le lecteur : le bouton le permet');
    assert.strictEqual(C.MAX_VIDEOS, 4);
    ok('le libellé de « Regarder »');

    console.log(`unit_choixmulti: ${n} groupes de tests OK`);
}
main().catch((e) => { console.error(e); process.exit(1); });

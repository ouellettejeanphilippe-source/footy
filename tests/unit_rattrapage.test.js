/* Quand le serveur se tait (js/rattrapage.js). Sans réseau, sans DOM.

   Deux manques révélés par la panne du 10 au 12 septembre 2026 — 45 heures sans liens
   frais, et l'application n'a rien dit :

   1. Elle SAVAIT que le cache avait 2700 minutes (`ageMin`), elle s'en servait même pour
      décider de relire les sources, mais l'écran Journaux l'affichait en vert. Un cache
      republié toutes les 30 min doit crier passé 90.
   2. Elle ne peut pas remplacer le serveur : elle relit les pages de LISTE (une dizaine),
      pas les ~600 **pages de match** où vivent les lecteurs. Mesuré ce jour-là : 4985
      liens côté serveur contre 2 par match en repli.

   Ce module décide des deux : l'état du cache, et quels matchs valent une lecture
   directe. Ce test verrouille surtout ce qu'il REFUSE de lire — une passe de rattrapage
   qui viserait 600 pages depuis un téléphone par proxy public serait pire que rien. */
const assert = require('assert');

async function main() {
    const R = await import('../js/rattrapage.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── 1. L'état du cache, en un mot ─────────────────────────────────────────
    const etat = (ageMin, extra) => R.etatCacheServeur(Object.assign({ ageMin, count: 300 }, extra || {}));
    assert.strictEqual(etat(5).niveau, 'ok', 'frais');
    assert.strictEqual(etat(44).niveau, 'ok', 'sous 45 min : de la gigue de cron, pas une panne');
    assert.strictEqual(etat(45).niveau, 'vieux', 'un passage manqué');
    assert.strictEqual(etat(89).niveau, 'vieux');
    assert.strictEqual(etat(90).niveau, 'perime', 'deux passages manqués : le workflow ne publie plus');
    assert.strictEqual(etat(2700).niveau, 'perime', 'les 45 heures de la panne');
    assert.strictEqual(R.etatCacheServeur(null).niveau, 'absent', 'pas de cache du tout');
    assert.strictEqual(R.etatCacheServeur({ ageMin: 2, count: 0 }).niveau, 'absent',
        'un cache frais mais VIDE ne porte aucun lien : c\'est comme s\'il n\'était pas là');
    assert.strictEqual(R.etatCacheServeur({ ageMin: 2, count: 300 }, { erreur: true }).niveau, 'absent',
        'la lecture a échoué : l\'application est seule, quelle que soit la copie en mémoire');
    assert.strictEqual(R.etatCacheServeur({ ageMin: null, count: 300 }).niveau, 'ok',
        'âge inconnu : on ne crie pas sans savoir');
    assert.strictEqual(etat(200, {}).ageMin, 200, 'l\'âge est rendu pour l\'affichage');
    ok('l\'état du cache : ok, vieux, périmé, absent');

    // ── 2. Quand l'application doit chercher elle-même ───────────────────────
    assert.strictEqual(R.rattrapageNecessaire(etat(2700)), true);
    assert.strictEqual(R.rattrapageNecessaire(R.etatCacheServeur(null)), true);
    assert.strictEqual(R.rattrapageNecessaire(etat(60)), false,
        'un cache d\'une heure reste meilleur que ce qu\'un téléphone lit par proxy');
    assert.strictEqual(R.rattrapageNecessaire(etat(5)), false);
    assert.strictEqual(R.rattrapageNecessaire(null), false);
    ok('le rattrapage ne part que quand le serveur ne fournit plus');

    // ── 3. L'âge dit en clair ────────────────────────────────────────────────
    assert.strictEqual(R.ageEnClair(45), '45 min');
    assert.strictEqual(R.ageEnClair(135), '2 h 15');
    assert.strictEqual(R.ageEnClair(120), '2 h');
    assert.strictEqual(R.ageEnClair(2700), '45 h');
    assert.strictEqual(R.ageEnClair(65), '1 h 05', 'les minutes sur deux chiffres, comme une heure');
    assert.strictEqual(R.ageEnClair(null), '');
    ok('« 2 h 15 » plutôt que « 135 min »');

    // ── 4. Les cibles : ce qu'on peut regarder maintenant et qui n'a rien ────
    const m = (id, over) => Object.assign({
        id, matchUrl: 'https://site.test/' + id, status: 'upcoming', streamLinks: []
    }, over || {});
    const opts = {
        estEnDirect: (x) => x.status === 'live',
        bientot: (x) => x._dans !== undefined && x._dans <= 60,
        minutesAvant: (x) => (x._dans === undefined ? 9999 : x._dans),
        aDesLiens: (x) => (x.streamLinks || []).length > 0,
        pageBloquee: (u) => /bloque\.test/.test(u),
        max: 3
    };
    const matchs = [
        m('tard', { _dans: 300 }),                                   // ce soir : pas encore
        m('direct2', { status: 'live', _dans: -30 }),
        m('pourvu', { status: 'live', streamLinks: [{ url: 'x' }] }), // déjà des liens
        m('imminent10', { _dans: 10 }),
        m('direct1', { status: 'live', _dans: -80 }),
        m('fini', { status: 'finished' }),
        m('presume', { status: 'live', _finPresumee: true }),
        m('sansPage', { status: 'live', matchUrl: '' }),
        m('bloque', { status: 'live', matchUrl: 'https://bloque.test/x' }),
        m('imminent50', { _dans: 50 })
    ];
    const cibles = R.ciblesDeRattrapage(matchs, opts).map((x) => x.id);
    assert.deepStrictEqual(cibles, ['direct1', 'direct2', 'imminent10'],
        'en direct d\'abord (le plus avancé en tête), puis le plus imminent — et borné à trois');
    const tous = R.ciblesDeRattrapage(matchs, Object.assign({}, opts, { max: 20 })).map((x) => x.id);
    assert.deepStrictEqual(tous, ['direct1', 'direct2', 'imminent10', 'imminent50']);
    assert.ok(!tous.includes('pourvu'), 'un match déjà pourvu n\'est pas relu : le rattrapage comble des trous');
    assert.ok(!tous.includes('fini') && !tous.includes('presume'), 'un match fini ou présumé fini n\'a plus de liens à recevoir');
    assert.ok(!tous.includes('sansPage'), 'sans page de match, il n\'y a rien à lire');
    assert.ok(!tous.includes('bloque'), 'un hôte qui refuse systématiquement ses pages est écarté');
    assert.ok(!tous.includes('tard'), 'le match de ce soir attendra le prochain passage du serveur');
    ok('les cibles : en direct ou dans l\'heure, sans lien, page lisible');

    // ── 5. Deux passes voient la même liste ──────────────────────────────────
    /* Sans ordre total, « les quatre premiers » changeraient d'une passe à l'autre et on
       relirait sans cesse les mêmes trous en laissant les autres. */
    const exAequo = [m('b', { status: 'live', _dans: -10 }), m('a', { status: 'live', _dans: -10 })];
    assert.deepStrictEqual(R.ciblesDeRattrapage(exAequo, Object.assign({}, opts, { max: 1 })).map((x) => x.id), ['a'],
        'à égalité, l\'identifiant départage');
    assert.deepStrictEqual(R.ciblesDeRattrapage(matchs, opts).map((x) => x.id), cibles, 'deux lectures, même liste');
    ok('l\'ordre est total : deux passes ne se marchent pas dessus');

    // ── 6. Bornes et entrées vides ───────────────────────────────────────────
    assert.deepStrictEqual(R.ciblesDeRattrapage(matchs, Object.assign({}, opts, { max: 0 })), []);
    assert.deepStrictEqual(R.ciblesDeRattrapage(null, opts), []);
    assert.deepStrictEqual(R.ciblesDeRattrapage([null, undefined], opts), []);
    /* Sans prédicats, le statut sert de repli : c'est le mode dégradé, pas une erreur. */
    assert.deepStrictEqual(R.ciblesDeRattrapage([m('d', { status: 'live' })], { max: 5 }).map((x) => x.id), ['d']);
    assert.ok(R.CIBLES_AVEC_PONT > R.CIBLES_SANS_PONT,
        'avec le script utilisateur on lit en direct : on peut viser plus large que par proxy public');
    ok('bornes, entrées vides et mode dégradé');

    console.log(`unit_rattrapage: ${n} groupes de tests OK`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

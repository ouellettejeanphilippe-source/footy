/* Mode anti-divulgâcheur (js/divulgacheur.js) : Réglages → Look → « Masquer les scores ».

   14 novembre 2026. Ce test verrouille l'interrupteur, et le fait qu'aucun endroit qui
   dessine un score ne lit `m.score` sans passer par lui. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function main() {
    const D = await import('../js/divulgacheur.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const m = { homeTeam: 'Canadiens', awayTeam: 'Bruins', status: 'live', minute: '2e', score: [3, 1] };

    // 1. Éteint par défaut : le score passe tel quel.
    assert.strictEqual(D.scoresMasques(), false);
    assert.strictEqual(D.scoreAffiche(m), m.score);
    assert.strictEqual(D.matchSansDivulgacher(m), m);
    assert.strictEqual(D.scoreAffiche(null), null);
    ok('éteint : le score est celui du match');

    // 2. Allumé : plus de score, la classe est posée, et le match d'origine n'est pas touché.
    const classes = new Set();
    const doc = { documentElement: { classList: { toggle: (c, v) => { if (v) classes.add(c); else classes.delete(c); } } } };
    D.reglerScoresMasques(true, doc);
    assert.strictEqual(D.scoresMasques(), true);
    assert.ok(classes.has('sans-scores'));
    assert.strictEqual(D.scoreAffiche(m), null);
    const copie = D.matchSansDivulgacher(m);
    assert.notStrictEqual(copie, m);
    assert.strictEqual(copie.score, null);
    assert.strictEqual(copie.minute, '2e', 'l\'état du match reste');
    assert.deepStrictEqual(m.score, [3, 1], 'le match n\'est pas modifié');
    ok('allumé : aucun score, l\'état du match reste, la donnée est intacte');

    // 3. L'incrustation du mode câble (module sans import) ne dit plus le score.
    const C = await import('../js/cable.js');
    assert.ok(!/3 - 1/.test(JSON.stringify(C.etiquetteChaine(D.matchSansDivulgacher(m), 1, 3, null))));
    D.reglerScoresMasques(false, doc);
    assert.ok(!classes.has('sans-scores'));
    assert.ok(/3 - 1/.test(JSON.stringify(C.etiquetteChaine(D.matchSansDivulgacher(m), 1, 3, null))));
    ok('le mode câble suit l\'interrupteur');

    // 4. Aucun dessin de score ne lit `m.score` en direct : seules restent les lignes qui
    //    décident d'un état (« Fin », signature de changement, fusion des données).
    const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    const permis = /\? 'Fin'|status === '(finished|live)' && !?m\.score|m\.score\.join|m\.score = /;
    ['js/ui.js', 'js/config.js', 'js/multiview.js', 'js/main.js'].forEach((f) => {
        lire(f).split('\n').forEach((ligne, i) => {
            if (!/\bp?m\.score\b/.test(ligne) || /^\s*(\/\*|\*|\/\/)/.test(ligne)) return;
            assert.ok(permis.test(ligne), f + ':' + (i + 1) + ' lit m.score sans scoreAffiche : ' + ligne.trim().slice(0, 100));
        });
    });
    ok('ui, config, multiview et main passent par scoreAffiche');

    // 5. Les buteurs et les statistiques partent par la classe ; le réglage est dans Look.
    const css = lire('styles.css');
    ['.buteurs', '.cmp-zone', '#stats-match-container', '#home-scorers-modal'].forEach((s) => assert.ok(css.includes('html.sans-scores ' + s), s));
    assert.ok(lire('js/api.js').includes('class="buteurs"'));
    const ui = lire('js/ui.js');
    assert.ok(ui.includes('data-look-scores') && ui.includes("reglerScoresMasques(userPrefs.masquerScores === true)"));
    assert.ok(!/^\s*import\s/m.test(lire('js/divulgacheur.js')), 'module sans import');
    assert.ok(lire('sw.js').includes("'./js/divulgacheur.js'"), 'dans APP_SHELL');
    ok('buteurs et statistiques cachés par la classe, réglage dans Look, module précaché');

    console.log('\n' + n + ' vérifications réussies.');
}
main().catch((e) => { console.error(e); process.exit(1); });

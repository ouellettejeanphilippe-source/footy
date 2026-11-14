/* Les Réglages en rubriques (js/reglages.js) : la recherche d'un réglage et les
   préréglages d'apparence.

   14 novembre 2026, « Go pour les captures ». Ce test verrouille la recherche (sans accent,
   tous les mots, le titre d'abord), l'index lu dans la vraie page, les préréglages, et la
   mise en page : colonne des Réglages et rail de navigation au-dessus de 900 px seulement. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function main() {
    const R = await import('../js/reglages.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

    // 1. La normalisation : accents, apostrophes, casse.
    assert.strictEqual(R.normaliser('Mises à jour'), 'mises a jour');
    assert.strictEqual(R.normaliser('Taille de l’interface'), 'taille de l interface');
    assert.strictEqual(R.normaliser(null), '');
    ok('la recherche ignore accents, apostrophes et casse');

    // 2. L'index, lu dans index.html tel qu'il est publié.
    const doc = new JSDOM(lire('index.html')).window.document;
    const index = R.indexer(doc);
    const titres = index.map((e) => e.titre);
    ['Préréglages', 'Toutes les palettes', 'Forme des cartes', 'Taille de l\'interface', 'Liens du serveur', 'Historique des requêtes', 'Masquer les scores', 'Actualiser'].forEach((t) => assert.ok(titres.includes(t), 'dans l\'index : ' + t + ' (' + titres.join(' | ') + ')'));
    const forme = index.find((e) => e.titre === 'Forme des cartes');
    assert.strictEqual(forme.vue, 'options');
    assert.ok(/4:3/.test(forme.texte), 'l\'explication est indexée à part du titre');
    assert.ok(forme.el && forme.el.classList.contains('field'), 'l\'entrée mène à sa ligne');
    assert.strictEqual(index.find((e) => e.titre === 'Historique des requêtes').vue, 'logs');
    ok('l\'index porte chaque ligne et chaque panneau, avec sa page');

    // 3. La recherche : tous les mots, le titre avant l'explication, vide = rien.
    assert.deepStrictEqual(R.chercher(index, ''), []);
    assert.deepStrictEqual(R.chercher(index, '   '), []);
    assert.strictEqual(R.chercher(index, 'forme')[0].titre, 'Forme des cartes');
    assert.strictEqual(R.chercher(index, 'TAILLE interface')[0].titre, 'Taille de l\'interface');
    assert.strictEqual(R.chercher(index, 'largeur ecran')[0].titre, 'Taille de l\'interface', 'trouvé par son explication');
    assert.strictEqual(R.chercher(index, 'spoiler')[0].titre, 'Masquer les scores');
    assert.strictEqual(R.chercher(index, 'score')[0].titre, 'Masquer les scores', 'le titre passe avant l\'explication (Actualiser)');
    assert.deepStrictEqual(R.chercher(index, 'forme zzz'), []);
    assert.ok(R.chercher(index, 'e', 3).length <= 3);
    ok('la recherche demande tous les mots et range le titre d\'abord');

    // 4. Les préréglages : l'identité d'origine d'abord, puis des palettes qui existent.
    const mv = lire('js/multiview.js');
    const ids = Array.from(mv.matchAll(/\{ id: '([a-z_0-9]+)', name:/g)).map((m) => m[1]);
    R.IDS_PREREGLAGES.forEach((id) => assert.ok(ids.includes(id), 'palette connue : ' + id));
    const pre = R.prereglages(ids.map((id) => ({ id: id, name: id, c1: '#000000', c2: '#000000', c3: '#000000', accent: '#ffffff' })));
    assert.strictEqual(pre[0].id, 'defaut');
    assert.strictEqual(pre.length, 1 + R.IDS_PREREGLAGES.length);
    assert.strictEqual(R.prereglages([]).length, 1, 'sans palette, il reste Défaut');
    const ui = lire('js/ui.js');
    assert.ok(ui.includes("c1: '" + R.DEFAUT.c1 + "'") && ui.includes("accent: '" + R.DEFAUT.accent + "'"), 'Défaut = les couleurs d\'origine de userPrefs');
    assert.strictEqual(R.estClaire('#f8fafc'), true);
    assert.strictEqual(R.estClaire('#0b0d12'), false);
    ok('les préréglages : Défaut puis huit palettes existantes');

    // 5. La page : le champ, les conteneurs, les identifiants d'avant.
    ['reglages-recherche', 'reglages-resultats', 'rb-options', 'btn-look', 'rb-script', 'rb-logs', 'btn-actualiser', 'btn-maj-app', 'filter-live', 'filter-all', 'filter-fav', 'filter-options', 'mv-toggle-btn'].forEach((id) => assert.ok(doc.getElementById(id), '#' + id));
    assert.ok(doc.querySelector('.prereglages-container') && doc.querySelector('.swatches-container'));
    ok('la page garde ses identifiants et porte le champ de recherche');

    // 6. La mise en page : rail et colonne au-dessus de 900 px seulement, pas dans le lecteur.
    const css = lire('styles.css');
    const bloc = css.slice(css.indexOf('── 18. Rail de navigation'));
    const media = bloc.slice(bloc.indexOf('@media (min-width: 901px)'));
    assert.ok(media.length > 100, 'un bloc @media (min-width: 901px)');
    assert.ok(/\.app-header \{ position: fixed; left: 0; top: 0; bottom: 0;/.test(media), 'le rail est dans le bloc');
    assert.ok(/body\[data-view="player"\] \{ padding-left: 0; \}/.test(media), 'le lecteur garde tout l\'écran');
    assert.ok(/\.reglages-barre \{\s*position: fixed; left: var\(--rail-w\)/.test(media), 'la colonne des Réglages est dans le bloc');
    assert.ok(!/position: fixed/.test(bloc.slice(0, bloc.indexOf('@media (min-width: 901px)')).replace(/\/\*[\s\S]*?\*\//g, '')), 'rien de fixé hors du bloc');
    ok('rail et colonne des Réglages : au-dessus de 900 px seulement');

    // 7. Sans import, précaché, branché.
    assert.ok(!/^\s*import\s/m.test(lire('js/reglages.js')), 'module sans import');
    assert.ok(lire('sw.js').includes("'./js/reglages.js'"), 'dans APP_SHELL');
    assert.ok(/prereglages\(PALETTES\)/.test(mv) && /chercherReglages\(indexerReglages\(document\)/.test(ui));
    ok('le module est sans import, précaché, et branché');

    console.log('\n' + n + ' vérifications réussies.');
}
main().catch((e) => { console.error(e); process.exit(1); });

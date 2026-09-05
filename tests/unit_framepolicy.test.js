/* Politique d'intégration des lecteurs (scripts/scrape_streams.mjs).

   Un lien dont l'hôte refuse l'iframe est marqué `topLevel` dans data/streams.json :
   l'interface l'ouvre alors dans un onglet et ne tente JAMAIS le lecteur. Se tromper
   dans ce verdict coûte donc directement des flux jouables.

   Relevé le 5 septembre 2026 : la lecture des en-têtes examinait `X-Frame-Options`
   AVANT `Content-Security-Policy: frame-ancestors`, et rendait son verdict sans
   regarder la seconde. Or la spécification CSP demande l'inverse — quand
   `frame-ancestors` est présent, le navigateur IGNORE `X-Frame-Options` — et c'est ce
   que font Chrome, Firefox et Safari. Un hôte qui envoie les deux se voyait donc
   déclaré non intégrable alors que tout navigateur l'aurait affiché.

   Cas réel ce jour-là : embed.sportspatrika.com répond « X-Frame-Options: SAMEORIGIN »
   ET « Content-Security-Policy: frame-ancestors * ». C'est la destination de la chaîne
   de lecteurs de Flexfitness (clearstreamdv → sportspatrika) : les 260 liens de cette
   source partaient tous en « ouvrir dans un onglet », aucun dans le lecteur.

   La fonction n'est pas exportable (script autonome à `await` de haut niveau, qui
   travaille dès l'import) : comme pour unit_scrapequeue, on la relit dans la source et
   on la ré-exécute isolément. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function main() {
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'scrape_streams.mjs'), 'utf8');
    const debut = src.indexOf('function readFramePolicy');
    assert.ok(debut >= 0, 'readFramePolicy doit exister dans le script');
    // Jusqu'à la première accolade fermante en début de ligne : la fin de la fonction.
    const fin = src.indexOf('\n}', debut);
    assert.ok(fin > debut, 'fin de readFramePolicy introuvable');
    const source = src.slice(debut, fin + 2);

    // eslint-disable-next-line no-new-func
    const readFramePolicy = new Function(source + '; return readFramePolicy;')();
    const entetes = (obj) => ({ get: (k) => obj[String(k).toLowerCase()] || null });

    // ── 1. frame-ancestors permissif l'emporte sur X-Frame-Options ──────────
    const cas = readFramePolicy(entetes({
        'x-frame-options': 'SAMEORIGIN',
        'content-security-policy': 'frame-ancestors *'
    }));
    assert.strictEqual(cas.embeddable, true,
        'frame-ancestors * doit l\'emporter sur X-Frame-Options: SAMEORIGIN (cas embed.sportspatrika.com)');
    ok('frame-ancestors permissif l\'emporte sur X-Frame-Options (spec CSP)');

    // ── 2. frame-ancestors restrictif refuse, même sans X-Frame-Options ─────
    assert.strictEqual(readFramePolicy(entetes({ 'content-security-policy': "frame-ancestors 'none'" })).embeddable, false);
    assert.strictEqual(readFramePolicy(entetes({ 'content-security-policy': "frame-ancestors 'self' exemple.test" })).embeddable, false,
        'une liste blanche qui ne nous nomme pas vaut un refus');
    assert.strictEqual(readFramePolicy(entetes({
        'x-frame-options': 'ALLOWALL',
        'content-security-policy': "frame-ancestors 'self'"
    })).embeddable, false, 'frame-ancestors restrictif l\'emporte AUSSI sur un X-Frame-Options permissif');
    ok('frame-ancestors restrictif refuse, quel que soit X-Frame-Options');

    // ── 3. Sans CSP, X-Frame-Options fait foi (comportement d'origine) ──────
    assert.strictEqual(readFramePolicy(entetes({ 'x-frame-options': 'DENY' })).embeddable, false);
    assert.strictEqual(readFramePolicy(entetes({ 'x-frame-options': 'SAMEORIGIN' })).embeddable, false);
    assert.strictEqual(readFramePolicy(entetes({})).embeddable, true, 'aucun en-tête restrictif : intégrable');
    assert.strictEqual(readFramePolicy(entetes({ 'x-frame-options': 'ALLOWALL' })).embeddable, true);
    ok('sans CSP, X-Frame-Options continue de faire foi');

    // ── 4. https: dans frame-ancestors vaut permissif ───────────────────────
    assert.strictEqual(readFramePolicy(entetes({
        'x-frame-options': 'DENY',
        'content-security-policy': 'default-src *; frame-ancestors https:'
    })).embeddable, true, 'frame-ancestors https: accepte toute origine https, donc la nôtre');
    ok('frame-ancestors https: est reconnu comme permissif, même derrière d\'autres directives');

    console.log(`unit_framepolicy: ${n} groupes de tests OK`);
    process.exit(0);
}

main();

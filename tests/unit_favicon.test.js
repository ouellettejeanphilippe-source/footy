/* L'icône de l'application (8 septembre 2026 : « Créer favicon »).

   Il n'y en avait AUCUNE : ni `<link rel="icon">` dans les pages, ni fichier à la racine.
   Le navigateur demandait /favicon.ico, recevait un 404, et l'onglet comme l'écran
   d'accueil restaient vides. Le manifeste, lui, ne portait que deux SVG en data-URI — et
   iOS ignore le SVG pour l'écran d'accueil.

   Ces cas verrouillent ce qui casse en silence : un lien qui pointe vers un fichier
   absent ne se voit pas en développement, seulement sur l'appareil de l'utilisateur. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8');
let n = 0;
const ok = (name) => { n++; console.log('  ✓ ' + name); };

// ── 1. Les fichiers existent, et ne sont pas vides ────────────────────────────
const FICHIERS = ['icons/favicon.svg', 'icons/favicon-32.png', 'icons/apple-touch-icon.png',
                  'icons/icon-192.png', 'icons/icon-512.png'];
FICHIERS.forEach((f) => {
    const p = path.join(RACINE, f);
    assert.ok(fs.existsSync(p), f + ' doit exister');
    assert.ok(fs.statSync(p).size > 500, f + ' ne doit pas être vide ou tronqué');
});
/* Les PNG sont de vraies images : la signature, et les dimensions lues dans l'en-tête
   IHDR. Un fichier au bon nom mais au mauvais format ne se verrait pas autrement. */
[['icons/favicon-32.png', 32], ['icons/apple-touch-icon.png', 180],
 ['icons/icon-192.png', 192], ['icons/icon-512.png', 512]].forEach(([f, taille]) => {
    const buf = fs.readFileSync(path.join(RACINE, f));
    assert.strictEqual(buf.slice(1, 4).toString('ascii'), 'PNG', f + ' doit être un PNG');
    assert.strictEqual(buf.readUInt32BE(16), taille, f + ' doit faire ' + taille + ' px de large');
    assert.strictEqual(buf.readUInt32BE(20), taille, f + ' doit faire ' + taille + ' px de haut');
});
ok('les cinq fichiers existent, et les PNG font bien la taille annoncée');

// ── 2. Les deux pages les déclarent ───────────────────────────────────────────
['index.html', 'legacy.html'].forEach((page) => {
    const html = lire(page);
    assert.ok(/<link rel="icon" type="image\/svg\+xml" href="\.\/icons\/favicon\.svg">/.test(html),
        page + ' déclare le SVG');
    assert.ok(/<link rel="icon" type="image\/png" sizes="32x32"/.test(html), page + ' déclare le PNG de repli');
    assert.ok(/<link rel="apple-touch-icon" sizes="180x180"/.test(html),
        page + ' déclare l\'icône d\'écran d\'accueil iOS, qui ignore le SVG');
});
ok('l\'interface actuelle ET l\'interface classique déclarent l\'icône');

// ── 3. Le manifeste pointe vers de vrais fichiers, pas des data-URI ───────────
const manifeste = JSON.parse(lire('manifest.json'));
assert.ok(Array.isArray(manifeste.icons) && manifeste.icons.length >= 3);
manifeste.icons.forEach((ic) => {
    assert.ok(!/^data:/.test(ic.src), 'plus de data-URI : iOS ne les prend pas pour l\'écran d\'accueil');
    const f = ic.src.replace(/^\.\//, '');
    assert.ok(fs.existsSync(path.join(RACINE, f)), 'le manifeste pointe vers ' + f + ', qui doit exister');
});
assert.ok(manifeste.icons.some((ic) => ic.purpose === 'maskable'),
    'une icône « maskable » pour qu\'Android ne la rogne pas de travers');
ok('le manifeste pointe vers des fichiers présents, dont une icône « maskable »');

// ── 4. Le service worker les met en cache, et sa version a été incrémentée ────
/* Une icône absente du pré-cache manquerait hors ligne ; et toute modification de sw.js
   doit s'accompagner d'un changement de CACHE_NAME, sinon l'ancien cache survit. */
const sw = lire('sw.js');
FICHIERS.forEach((f) => assert.ok(sw.indexOf("'./" + f + "'") >= 0, sw ? f + ' doit être pré-caché' : ''));
const version = /const CACHE_NAME = '([^']+)'/.exec(sw)[1];
assert.ok(lire('js/multiview.js').indexOf("VERSION_APP = '" + version + "'") >= 0,
    'VERSION_APP doit suivre CACHE_NAME, sinon la page Logs annonce une version fausse');
ok('les icônes sont pré-cachées et la version du service worker suit');

console.log(`unit_favicon: ${n} groupes de tests OK`);
process.exit(0);

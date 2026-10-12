/* Les segments déguisés en image (12 octobre 2026, « le vidéo charge pas » sur les
   domaines de Pandastream / DaddyLive) sont déballés par les deux lecteurs natifs : l'APK
   de mobile/ et l'appli tv/, deux projets Gradle séparés qui portent chacun leur copie de
   `SegmentImage` et de `DataSourceDeballante`. Le déballage lui-même est éprouvé par les
   tests JVM (`SegmentImageTest`) ; ce test-ci garde les deux copies identiques et vérifie
   que chaque lecteur s'en sert vraiment. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const MOBILE = 'mobile/android/app/src/main/java/ca/local/footy/';
const TV = 'tv/app/src/main/java/ca/local/footytv/';
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansPaquet = (s) => s.replace(/^package [a-z.]+;/m, '');

let n = 0;
const ok = (nom) => { n++; console.log('  ✓ ' + nom); };

for (const classe of ['SegmentImage', 'DataSourceDeballante']) {
    assert.strictEqual(sansPaquet(lire(TV + classe + '.java')), sansPaquet(lire(MOBILE + classe + '.java')),
        classe + '.java : les copies de mobile/ et tv/ ont divergé');
}
assert.strictEqual(sansPaquet(lire('tv/app/src/test/java/ca/local/footytv/SegmentImageTest.java')),
    sansPaquet(lire('mobile/android/app/src/test/java/ca/local/footy/SegmentImageTest.java')),
    'SegmentImageTest : les copies ont divergé');
ok('SegmentImage, DataSourceDeballante et leur test : copies identiques dans mobile/ et tv/');

for (const f of [MOBILE + 'LecteurActivity.java', TV + 'MainActivity.java']) {
    assert.ok(/new HlsMediaSource\.Factory\(new DataSourceDeballante\.Factory\(http\)\)/.test(lire(f)),
        f + ' : le lecteur HLS doit passer par DataSourceDeballante');
}
ok('les deux lecteurs natifs déballent leurs segments');

console.log(`unit_segmentimage: ${n} groupes de tests OK`);

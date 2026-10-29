/* Le fond aux couleurs des équipes (js/db.js, fondEquipes).

   La vignette d'une carte du Live et la bannière de la fiche le prennent selon Réglages →
   Look → Couleur des cartes. Il vivait dans js/dispositions.js, retiré le 29 octobre 2026
   avec les dispositions ; sa règle n'a pas changé. */
const test = require('node:test');
const assert = require('node:assert');

let db;
/* js/db.js pose ses liaisons sur `window` en fin de module. */
test.before(async () => { globalThis.window = globalThis.window || globalThis; db = await import('../js/db.js'); });

test('la couleur suit « Couleur des cartes »', () => {
  const f = { cDom: '#af1e2d', cExt: '#003087', cLigue: '#2f6bff' };
  assert.strictEqual(db.fondEquipes(f, 'home'), '#af1e2d');
  assert.strictEqual(db.fondEquipes(f, 'league'), '#2f6bff');
  assert.strictEqual(db.fondEquipes({ cDom: '#af1e2d', cExt: '#003087' }, 'league'), '#af1e2d', 'sans couleur de ligue, celle de l\'équipe à domicile');
  assert.strictEqual(db.fondEquipes(f, 'dark'), 'rgba(255,255,255,0.05)');
  assert.strictEqual(db.fondEquipes(f, 'split'), 'linear-gradient(135deg, #af1e2d 50%, #003087 50%)');
  assert.strictEqual(db.fondEquipes(f, 'gradient'), 'linear-gradient(90deg, #af1e2d 0%, #003087 100%)');
  assert.strictEqual(db.fondEquipes(f, 'gradient-45'), 'linear-gradient(135deg, #af1e2d 0%, #003087 100%)');
  assert.strictEqual(db.fondEquipes(f, undefined), 'linear-gradient(135deg, #af1e2d 0%, #003087 100%)', 'le dégradé par défaut');
});

test('l\'ancien module des dispositions n\'est plus servi', () => {
  const fs = require('fs');
  const path = require('path');
  const racine = path.resolve(__dirname, '..');
  assert.ok(!fs.existsSync(path.join(racine, 'js', 'dispositions.js')));
  assert.ok(!fs.readFileSync(path.join(racine, 'sw.js'), 'utf8').includes('dispositions.js'), 'ni pré-caché');
});

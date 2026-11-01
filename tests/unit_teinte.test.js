/* « Couleur de l'interface selon le match actuellement » (1er novembre 2026, js/teinte.js). */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

let T;
test.before(async () => { T = await import(path.join(__dirname, '..', 'js', 'teinte.js')); });

test('versHsl lit #rgb, #rrggbb et hsl() ; versHex revient au même', () => {
  assert.deepStrictEqual(T.versHsl('#f00'), { h: 0, s: 1, l: 0.5 });
  assert.strictEqual(T.versHex(T.versHsl('#c41230')), '#c41230');
  assert.deepStrictEqual(T.versHsl('hsl(200, 60%, 30%)'), { h: 200, s: 0.6, l: 0.3 });
  assert.strictEqual(T.versHsl('rouge'), null);
});

test('accentLisible : ni noir, ni blanc, ni gris ; luminosité ramenée dans une plage lisible', () => {
  assert.strictEqual(T.accentLisible('#000000'), null);
  assert.strictEqual(T.accentLisible('#ffffff'), null);
  assert.strictEqual(T.accentLisible('#a5acaf'), null, 'argent');
  const a = T.versHsl(T.accentLisible('#00205b'));  // bleu marine, trop sombre tel quel
  assert.ok(a.l >= 0.47 && a.l <= 0.65, 'éclairci : ' + a.l);
  assert.ok(Math.abs(a.h - T.versHsl('#00205b').h) <= 1, 'même teinte');
});

test('teinteDuMatch : la première couleur utilisable, domicile d\'abord, puis visiteur', () => {
  const couleurs = { Raiders: ['#000000', '#a5acaf'], Canadiens: ['#af1e2d', '#192168'] };
  const paire = (n) => couleurs[n] || ['#333333', '#ffffff'];
  const c = T.teinteDuMatch({ homeTeam: 'Raiders', awayTeam: 'Canadiens' }, paire);
  assert.strictEqual(T.versHsl(c).h, T.versHsl('#af1e2d').h, 'noir et argent sautés : le rouge des Canadiens');
  assert.strictEqual(T.teinteDuMatch({ homeTeam: 'Raiders' }, paire), null);
  assert.strictEqual(T.teinteDuMatch(null, paire), null);
});

test('appliquerTeinte pose l\'accent et la lueur, et rend la palette sans match', () => {
  const props = {}, attrs = {};
  const racine = { style: { setProperty: (k, v) => { props[k] = v; }, removeProperty: (k) => { delete props[k]; } },
    setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; } };
  T.appliquerTeinte(racine, '#c41230', '#0a84ff');
  assert.strictEqual(props['--accent'], '#c41230');
  assert.strictEqual(props['--teinte-lueur'], 'rgba(196, 18, 48, 0.16)');
  assert.strictEqual(attrs['data-teinte'], '#c41230');
  T.appliquerTeinte(racine, null, '#0a84ff');
  assert.strictEqual(props['--accent'], '#0a84ff');
  assert.ok(!('--teinte-lueur' in props) && !('data-teinte' in attrs));
});

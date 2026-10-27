/* Le bandeau vedette du Live (js/vedette.js, 27 octobre 2026) : « pages plus proches des
   services de streaming… dans le sens de navigation ». Le choix du match mis en avant, et
   un bandeau qui porte le bouton « Regarder » comme premier arrêt de la télécommande. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

let V;
test.before(async () => { V = await import(path.join(path.resolve(__dirname, '..'), 'js', 'vedette.js')); });

const fiche = (id, etat, extra) => Object.assign({
  id, ligue: 'NHL', dom: 'Montreal Canadiens', ext: 'Buffalo Sabres', seul: false,
  logoDom: { url: 'https://a.espncdn.com/i/teamlogos/nhl/500/scoreboard/mtl.png' }, logoExt: null,
  cDom: '#af1e2d', cExt: '#003087', heure: '19:00', debut: 19 * 60, duree: 150, etat,
  chrono: etat === 'live' ? '2e · 12:00' : '', sDom: etat === 'live' ? 2 : null, sExt: etat === 'live' ? 1 : null,
  flux: 5, fav: false, jour: '', drapeau: '🏒'
}, extra || {});

test('la vedette : favori en direct, sinon le direct le plus fourni, sinon le prochain', () => {
  assert.strictEqual(V.choisirVedette([]), null);
  assert.strictEqual(V.choisirVedette(null), null);
  const a = fiche('a', 'live', { flux: 40 }), b = fiche('b', 'live', { flux: 3, fav: true }), c = fiche('c', 'bientot', { debut: 20 * 60 });
  assert.strictEqual(V.choisirVedette([a, b, c]).id, 'b', 'le favori en direct passe devant le plus fourni');
  assert.strictEqual(V.choisirVedette([a, c]).id, 'a');
  const d = fiche('d', 'plus-tard', { debut: 22 * 60 }), e = fiche('e', 'bientot', { debut: 21 * 60 }), f = fiche('f', 'fin');
  assert.strictEqual(V.choisirVedette([d, e, f]).id, 'e', 'sans direct, le prochain à commencer');
  assert.strictEqual(V.choisirVedette([d, fiche('g', 'plus-tard', { debut: 23 * 60, fav: true })]).id, 'g', 'un favori à venir passe devant');
  assert.strictEqual(V.choisirVedette([f]), null, 'un match fini n\'est pas mis en avant');
});

test('le bandeau : « Regarder » premier arrêt (data-focus-depart, data-mid), score, direct, échappement', () => {
  const html = V.bandeauVedette(fiche('x<y', 'live', { dom: 'A & B', fav: true }), 19 * 60 + 30);
  assert.match(html, /class="vedette vedette-live"/);
  assert.match(html, /<button type="button" class="vedette-go" data-mid="x&lt;y" data-focus-depart>▶ Regarder<\/button>/);
  assert.match(html, /A &amp; B/);
  assert.match(html, /vedette-score">2 – 1</);
  assert.match(html, /● Direct · 2e · 12:00/);
  assert.match(html, /· 5 flux/);
  assert.match(html, /--v1:#af1e2d;--v2:#003087/);
  assert.strictEqual(V.bandeauVedette(null), '');
  const bientot = V.bandeauVedette(fiche('b', 'bientot', { debut: 19 * 60 + 45, flux: 0 }), 19 * 60 + 30);
  assert.match(bientot, /dans 15 min/);
  assert.doesNotMatch(bientot, /flux/);
  assert.match(V.bandeauVedette(fiche('s', 'plus-tard', { seul: true, ext: '' })), /vedette-eq[^]*Montreal Canadiens/);
  assert.doesNotMatch(V.bandeauVedette(fiche('s', 'plus-tard', { seul: true, ext: '' })), /vedette-score/);
});

test('l\'état en une ligne', () => {
  assert.strictEqual(V.etatVedette(fiche('a', 'live', { chrono: 'Direct' })), '● Direct');
  assert.strictEqual(V.etatVedette(fiche('a', 'fin?')), 'Fin');
  assert.strictEqual(V.etatVedette(fiche('a', 'bientot'), 19 * 60), 'Maintenant');
  assert.strictEqual(V.etatVedette(fiche('a', 'plus-tard', { jour: 'demain' })), 'demain 19:00');
});

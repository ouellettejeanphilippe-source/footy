/* « Avoir un genre Twitter en direct, les commentaires des gens » (13 novembre 2026, js/reactions.js) :
   la recherche en direct de X sur les équipes du match, dans une fenêtre à côté. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');
let R;
test.before(async () => { R = await import(path.join(racine, 'js', 'reactions.js')); });

test('la requête cite les deux équipes, l\'une OU l\'autre', () => {
  const m = { homeTeam: 'Montreal Canadiens', awayTeam: 'Boston Bruins' };
  assert.strictEqual(R.requeteReactions(m), '"Montreal Canadiens" OR "Boston Bruins"');
});

test('une course ou une séance n\'a qu\'un nom ; un match sans nom n\'a pas de requête', () => {
  assert.strictEqual(R.requeteReactions({ homeTeam: 'Las Vegas Grand Prix', awayTeam: 'Race' }), '"Las Vegas Grand Prix"');
  assert.strictEqual(R.requeteReactions({ homeTeam: 'Las Vegas Grand Prix', awayTeam: 'FP2' }), '"Las Vegas Grand Prix"');
  assert.strictEqual(R.requeteReactions({ homeTeam: 'WWE Raw', awayTeam: '' }), '"WWE Raw"');
  assert.strictEqual(R.requeteReactions({ homeTeam: 'UFC 300', awayTeam: 'ufc 300' }), '"UFC 300"', 'pas deux fois le même nom');
  assert.strictEqual(R.requeteReactions({}), '');
  assert.strictEqual(R.requeteReactions(null), '');
  assert.strictEqual(R.adresseReactionsX(null), '');
});

test('l\'adresse est la recherche en direct de x.com, requête encodée ; un guillemet du nom ne casse rien', () => {
  const a = R.adresseReactionsX({ homeTeam: 'Paris Saint-Germain', awayTeam: 'Olympique "OM" & Marseille' });
  const u = new URL(a);
  assert.strictEqual(u.origin, 'https://x.com');
  assert.strictEqual(u.pathname, '/search');
  assert.strictEqual(u.searchParams.get('f'), 'live', 'les plus récents d\'abord');
  assert.strictEqual(u.searchParams.get('q'), '"Paris Saint-Germain" OR "Olympique OM & Marseille"');
  assert.strictEqual(Array.from(u.searchParams.keys()).length, 2, 'le & du nom ne crée pas de paramètre');
});

test('la fenêtre est une colonne contre le bord droit de l\'écran', () => {
  assert.strictEqual(R.optionsFenetreReactions({ availLeft: 0, availTop: 25, availWidth: 1920, availHeight: 1055 }),
    'popup=yes,left=1480,top=25,width=440,height=1055');
  assert.strictEqual(R.optionsFenetreReactions({ availLeft: 1920, availTop: 0, availWidth: 2560, availHeight: 1440 }),
    'popup=yes,left=4040,top=0,width=440,height=1440', 'second écran : ses coordonnées');
  assert.strictEqual(R.optionsFenetreReactions(null), 'popup=yes,width=440,height=800');
  assert.match(R.optionsFenetreReactions({ availWidth: 360, availHeight: 700 }), /left=0,.*width=360/);
});

test('ordinateur seulement : ni APK, ni télé, ni écran tactile sans souris', () => {
  const souris = { open() {}, matchMedia: () => ({ matches: true }) };
  assert.strictEqual(R.reactionsPossibles(souris), true);
  assert.strictEqual(R.reactionsPossibles(Object.assign({}, souris, { Capacitor: {} })), false);
  assert.strictEqual(R.reactionsPossibles(Object.assign({}, souris, { __ANDROID_TV__: true })), false);
  assert.strictEqual(R.reactionsPossibles({ open() {}, matchMedia: () => ({ matches: false }) }), false);
  assert.strictEqual(R.reactionsPossibles(null), false);
});

test('ouvrirReactionsX : une fenêtre nommée, réutilisée ; un refus du navigateur est dit', () => {
  const appels = [];
  let focus = 0;
  const w = { screen: { availLeft: 0, availTop: 0, availWidth: 1000, availHeight: 600 },
    open(...a) { appels.push(a); return { focus() { focus++; } }; } };
  const m = { homeTeam: 'Arsenal', awayTeam: 'Chelsea' };
  assert.strictEqual(R.ouvrirReactionsX(m, w), 'ouverte');
  assert.deepStrictEqual(appels[0], [R.adresseReactionsX(m), R.NOM_FENETRE_REACTIONS, 'popup=yes,left=560,top=0,width=440,height=600']);
  assert.strictEqual(focus, 1);
  assert.strictEqual(R.ouvrirReactionsX(m, { open: () => null }), 'bloquee');
  assert.strictEqual(R.ouvrirReactionsX(m, { open: () => { throw new Error('refus'); } }), 'bloquee');
  assert.strictEqual(R.ouvrirReactionsX({}, w), 'rien');
  assert.strictEqual(appels.length, 1, 'rien d\'ouvert pour un match sans nom');
});

test('branchement : module sans import, précaché, bouton dans la barre du lecteur', () => {
  const src = fs.readFileSync(path.join(racine, 'js', 'reactions.js'), 'utf8');
  assert.ok(!/^\s*import\s/m.test(src), 'sans import');
  assert.ok(fs.readFileSync(path.join(racine, 'sw.js'), 'utf8').includes("'./js/reactions.js'"), 'dans APP_SHELL');
  const mv = fs.readFileSync(path.join(racine, 'js', 'multiview.js'), 'utf8');
  assert.ok(mv.includes('id="mv-bar-reactions"') && mv.includes('window.reactionsDuLecteur = reactionsDuLecteur'));
});

/* « Dans live, regrouper par sports et non ligue. Mettre favoris en haut » (1er novembre 2026). */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

let L;
test.before(async () => { L = await import(path.join(__dirname, '..', 'js', 'livesport.js')); });

const SPORT = { NHL: 'Hockey', AHL: 'Hockey', NBA: 'Basketball', NCAAB: 'Basketball', MLS: 'Soccer' };
const o = (favs) => ({
  sportDe: (m) => SPORT[m.league],
  estFavori: (m) => favs.includes(m.homeTeam),
  estEnDirect: (m) => m.live,
  comparer: (a, b) => a.t - b.t
});

test('une section par sport, dans l\'ordre des ligues, la ligue ne fait plus de section', () => {
  const ms = [
    { id: 1, league: 'NHL', homeTeam: 'A', t: 2 }, { id: 2, league: 'NBA', homeTeam: 'B', t: 1 },
    { id: 3, league: 'AHL', homeTeam: 'C', t: 1 }, { id: 4, league: 'NCAAB', homeTeam: 'D', t: 0 }
  ];
  const s = L.sectionsParSport(ms, o([]));
  assert.deepStrictEqual(s.map((x) => x.sport), ['Hockey', 'Basketball']);
  assert.deepStrictEqual(s[0].matches.map((m) => m.id), [3, 1], 'à l\'heure');
  assert.deepStrictEqual(s[1].matches.map((m) => m.id), [4, 2]);
});

test('favoris en haut : le sport qui a un favori passe d\'abord, et le favori en tête de sa section', () => {
  const ms = [
    { id: 1, league: 'NHL', homeTeam: 'A', t: 1, live: true }, { id: 2, league: 'MLS', homeTeam: 'CF Montreal', t: 3 },
    { id: 3, league: 'MLS', homeTeam: 'X', t: 1, live: true }
  ];
  const s = L.sectionsParSport(ms, o(['CF Montreal']));
  assert.deepStrictEqual(s.map((x) => x.sport), ['Soccer', 'Hockey']);
  assert.deepStrictEqual(s[0].matches.map((m) => m.id), [2, 3], 'le favori devant le direct');
  assert.strictEqual(s[0].favori, true);
});

test('le direct avant ce qui vient, puis l\'heure ; identifiant de section stable', () => {
  const ms = [{ id: 1, league: 'NBA', homeTeam: 'A', t: 0 }, { id: 2, league: 'NBA', homeTeam: 'B', t: 5, live: true }];
  assert.deepStrictEqual(L.sectionsParSport(ms, o([]))[0].matches.map((m) => m.id), [2, 1]);
  assert.strictEqual(L.idSectionSport('Sports motorisés'), 'liveSp_Sportsmotorises');
  assert.deepStrictEqual(L.sectionsParSport([], o([])), []);
});

test('les ligues secondaires sous les autres : après les principales dans leur sport, un sport tout secondaire en dernier, même favori', () => {
  const SEC = { AHL: 1, LHJMQ: 1 };
  const SP = Object.assign({ LHJMQ: 'Hockey', NLL: 'Crosse' }, SPORT);
  const opt = Object.assign(o(['Fav']), { sportDe: (m) => SP[m.league] || 'Crosse', estSecondaire: (m) => !!SEC[m.league] || m.league === 'NLL' });
  const ms = [
    { id: 1, league: 'AHL', homeTeam: 'A', t: 0, live: true }, { id: 2, league: 'NHL', homeTeam: 'B', t: 9 },
    { id: 3, league: 'NLL', homeTeam: 'Fav', t: 0 }, { id: 4, league: 'NBA', homeTeam: 'C', t: 1 }
  ];
  const s = L.sectionsParSport(ms, opt);
  assert.deepStrictEqual(s.map((x) => x.sport), ['Hockey', 'Basketball', 'Crosse'], 'le sport tout secondaire en dernier, même avec un favori');
  assert.deepStrictEqual(s[0].matches.map((m) => m.id), [2, 1], 'la ligue principale avant la secondaire, même en direct');
});

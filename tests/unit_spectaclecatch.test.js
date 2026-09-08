/* Un spectacle de catch, plusieurs noms (js/match.js).

   « Raw, c'est WWE, ça se peut que ça soit pas identifié Raw mais WWE, comme F1. »
   (8 septembre 2026) Exact — et mesuré le jour même sur les données réelles : UNE seule
   soirée portait TROIS noms, dont deux venaient d'ESPN lui-même.

       « RAW #1737 »            ESPN et footybite   0 lien
       « WWE » / « Raw »        ESPN                0 lien
       « WWE Monday Night RAW » sportsurge          9 liens

   Aucun ne s'appariait : deux cartes pour une seule émission, et les neuf liens
   n'atteignaient ni l'une ni l'autre. Le nom de la fédération et le numéro d'épisode ne
   disent rien de ce qu'on regarde ; c'est le SPECTACLE qui identifie la soirée, comme le
   Grand Prix identifie l'épreuve derrière « F1 » et « Race ».

   Le piège à éviter : `normName` retire les espaces, donc « raw » se retrouve DANS
   « Crawley Town », un vrai club anglais. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  const M = await import('../js/match.js');
  const paire = (a, b) => M.debugMatchPair(a, b);
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ── 1. Les trois noms du jour désignent le même spectacle ─────────────────
  assert.strictEqual(M.spectacleDeCatch('RAW #1737'), 'raw', 'numéro d\'épisode retiré');
  assert.strictEqual(M.spectacleDeCatch('WWE Raw'), 'raw');
  assert.strictEqual(M.spectacleDeCatch('WWE Monday Night RAW'), 'raw', 'le jour et « Night » ne disent rien');
  assert.strictEqual(M.spectacleDeCatch('WWE Friday Night Smackdown'), 'smackdown');
  assert.strictEqual(M.spectacleDeCatch('WWE NXT'), 'nxt');
  assert.strictEqual(M.spectacleDeCatch('AEW Dynamite'), 'dynamite', 'une autre fédération aussi');
  ok('le spectacle est dégagé de la fédération et du numéro d\'épisode');

  // ── 2. Ce qui n'est pas un spectacle de catch n'en devient pas un ─────────
  /* Sans cette garde, « raw » serait trouvé dans « crawleytown » : Crawley Town est un
     club anglais bien réel, et ses matchs auraient reçu les flux de la WWE. */
  assert.strictEqual(M.spectacleDeCatch('Crawley Town'), '', 'un club dont le nom CONTIENT « raw » n\'est pas un spectacle');
  assert.strictEqual(M.spectacleDeCatch('Crawley Town vs Charlton'), '');
  assert.strictEqual(M.spectacleDeCatch('Italy Grand Prix'), '', 'une épreuve de F1 non plus');
  assert.strictEqual(M.spectacleDeCatch('F1 Main Race'), '');
  assert.strictEqual(M.spectacleDeCatch('Arsenal'), '');
  assert.strictEqual(M.spectacleDeCatch(''), '');
  assert.strictEqual(M.spectacleDeCatch(null), '');
  ok('un nom qui contient les mêmes lettres n\'est pas un spectacle pour autant');

  // ── 3. Les trois entrées réelles s'apparient enfin ────────────────────────
  const raw1 = { homeTeam: 'RAW #1737', awayTeam: '', league: 'WWE' };
  const raw2 = { homeTeam: 'WWE', awayTeam: 'Raw', league: 'WWE' };
  const raw3 = { homeTeam: 'WWE Monday Night RAW', awayTeam: '', league: 'WWE' };
  assert.strictEqual(paire(raw1, raw2).isMatch, true, 'les deux entrées d\'ESPN sont la même soirée');
  assert.strictEqual(paire(raw1, raw3).isMatch, true, 'et celle qui porte les neuf liens aussi');
  assert.strictEqual(paire(raw2, raw3).isMatch, true);
  ok('les trois noms de la même soirée s\'apparient');

  // ── 4. Deux soirées différentes ne se rejoignent JAMAIS ───────────────────
  /* « WWE NXT » portait quatre liens ce jour-là : ils ne doivent pas se déverser sur Raw. */
  const nxt = { homeTeam: 'WWE NXT', awayTeam: 'TBD', league: 'Sports' };
  const sd = { homeTeam: 'WWE Friday Night Smackdown', awayTeam: '', league: 'WWE' };
  assert.strictEqual(paire(raw1, nxt).isMatch, false, 'Raw n\'est pas NXT');
  assert.strictEqual(paire(raw1, sd).isMatch, false, 'ni SmackDown');
  assert.strictEqual(paire(raw1, { homeTeam: 'Crawley Town', awayTeam: 'Charlton', league: 'League One' }).isMatch, false,
    'ni un match de football');
  ok('deux spectacles différents ne s\'apparient jamais, quels que soient les noms');

  console.log(`unit_spectaclecatch: ${n} groupes de tests OK`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

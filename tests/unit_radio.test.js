/* La radio d'un match (js/radio.js, fiche de match de js/ui.js), 31 octobre 2026.

   « Pour chaque match, un lien vers une station TuneIn, iHeartRadio et cie qui le diffuse ? »
   Aucune source ne dit qu'une station diffuse un match : ce qui est affirmé, c'est la station
   propre à l'équipe (LNH, relevée chez TuneIn), le reste est une recherche, étiquetée comme telle. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const racine = path.resolve(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');
let R, T, I;
test.before(async () => {
  R = await import(path.join(racine, 'js', 'radio.js'));
  T = await import(path.join(racine, 'js', 'teams.js'));
  I = await import(path.join(racine, 'js', 'icones.js'));
});
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('les 32 équipes de la LNH de la base ont leur station TuneIn, et aucune autre clé n\'est orpheline', () => {
  const lnh = Object.values(T.TEAM_DATA).filter((t) => t.league === 'nhl');
  assert.strictEqual(lnh.length, 32);
  for (const t of lnh) {
    const st = R.stationsDeLEquipe(t.name);
    assert.ok(st.length >= 1, 'une station pour ' + t.name);
    assert.ok(/^https:\/\/tunein\.com\/radio\/s\d+\/$/.test(st[0].url), 'adresse TuneIn de ' + t.name + ' : ' + st[0].url);
  }
  const cles = new Set(lnh.map((t) => R.cleEquipe(t.name)));
  for (const k of Object.keys(R.STATIONS_TUNEIN)) assert.ok(cles.has(k), 'clé connue de la base : ' + k);
  assert.strictEqual(new Set(Object.values(R.STATIONS_TUNEIN)).size, 32, 'une station différente par équipe');
});

test('les noms se retrouvent malgré les accents, la ponctuation et la casse', () => {
  assert.strictEqual(R.cleEquipe('St. Louis Blues'), 'st louis blues');
  assert.strictEqual(R.cleEquipe('Montréal Canadiens'), 'montreal canadiens');
  assert.strictEqual(R.cleEquipe(null), '');
  assert.strictEqual(R.stationsDeLEquipe('ST LOUIS BLUES').length, 1);
  assert.strictEqual(R.stationsDeLEquipe('St. Louis Blues')[0].url, R.stationsDeLEquipe('st louis blues')[0].url);
});

test('les Canadiens ont leur station et les deux radios officielles, sans doublon', () => {
  const st = R.stationsDeLEquipe('Montreal Canadiens');
  assert.deepStrictEqual(st.map((s) => s.url), [
    'https://tunein.com/radio/s137385/', 'https://tunein.com/radio/s12472/', 'https://tunein.com/radio/s12468/'
  ]);
  assert.ok(st.every((s) => s.source === 'TuneIn'));
});

test('tout match a un lien : une équipe sans station a au moins les recherches TuneIn et iHeartRadio', () => {
  const r = R.radiosDuMatch({ homeTeam: 'Real Madrid', awayTeam: 'FC Barcelona', league: 'LA LIGA' });
  assert.deepStrictEqual(r.equipes.map((e) => e.equipe), ['Real Madrid', 'FC Barcelona']);
  for (const e of r.equipes) {
    assert.strictEqual(e.stations.length, 0, 'aucune station inventée');
    assert.strictEqual(e.recherches.length, 2);
  }
  assert.strictEqual(r.equipes[0].recherches[0].url, 'https://tunein.com/search/?query=Real%20Madrid');
  assert.strictEqual(r.equipes[0].recherches[1].url, 'https://www.iheart.com/search/?q=Real%20Madrid');
});

test('un match de la LNH : la station de chaque équipe, domicile puis visiteur', () => {
  const r = R.radiosDuMatch({ homeTeam: 'Detroit Red Wings', awayTeam: 'St. Louis Blues', league: 'NHL' });
  assert.deepStrictEqual(r.equipes.map((e) => e.stations.map((s) => s.url)), [
    ['https://tunein.com/radio/s137351/'], ['https://tunein.com/radio/s149872/']
  ]);
});

test('un match incomplet ne casse rien, une équipe ne s\'affiche pas deux fois', () => {
  assert.deepStrictEqual(R.radiosDuMatch(null).equipes, []);
  assert.deepStrictEqual(R.radiosDuMatch({}).equipes, []);
  assert.strictEqual(R.radiosDuMatch({ homeTeam: 'Seattle Kraken' }).equipes.length, 1);
  assert.strictEqual(R.radiosDuMatch({ homeTeam: 'Seattle Kraken', awayTeam: 'seattle kraken' }).equipes.length, 1);
  assert.strictEqual(R.radioHtml(R.radiosDuMatch({}), esc, I.icone), '');
  assert.strictEqual(R.radioHtml(null, esc, I.icone), '');
});

test('le HTML : liens sûrs, texte échappé, et la note dit si c\'est une station ou une recherche', () => {
  const h = R.radioHtml(R.radiosDuMatch({ homeTeam: 'Montreal Canadiens', awayTeam: 'A <b>"&" B' }), esc, I.icone);
  assert.ok(h.includes('class="fiche-radio-titre">Radio'));
  assert.ok(h.includes('<svg'), 'l\'icône radio est dessinée');
  assert.ok(!h.includes('<b>'), 'le nom d\'équipe est échappé');
  assert.ok(h.includes('A &lt;b&gt;&quot;&amp;&quot; B'));
  assert.ok(h.includes('query=A%20%3Cb%3E%22%26%22%20B'), 'la requête est encodée');
  const liens = h.match(/<a [^>]*>/g);
  assert.ok(liens.length >= 7);
  for (const a of liens) assert.ok(/target="_blank" rel="noopener noreferrer"/.test(a), 'ouverture sûre : ' + a);
  assert.ok(h.includes('98,5 FM (français) · TuneIn'));
  assert.ok(h.includes('sans garantie que la station diffuse ce match'));
  const sans = R.radioHtml(R.radiosDuMatch({ homeTeam: 'Real Madrid', awayTeam: 'FC Barcelona' }), esc, I.icone);
  assert.ok(!sans.includes('radio-station'), 'pas de station affichée quand on n\'en a pas');
  assert.ok(sans.includes('Aucune station d’équipe connue'));
});

test('branchement : icône, fiche, service worker, version de l\'application', () => {
  assert.ok(I.TRACES.radio && I.icone('radio').includes('<svg'), 'l\'icône radio existe');
  const ui = lire('js/ui.js');
  assert.ok(/import \{ radiosDuMatch, radioHtml \} from '\.\/radio\.js';/.test(ui));
  assert.ok(ui.includes("radio.className = 'fiche-radio'"), 'la fiche pose la section');
  const sw = lire('sw.js');
  assert.ok(sw.includes("'./js/radio.js'"), 'radio.js est dans APP_SHELL');
  const cache = sw.match(/CACHE_NAME = '([^']+)'/)[1];
  assert.ok(lire('js/multiview.js').includes("VERSION_APP = '" + cache + "'"), 'VERSION_APP = CACHE_NAME');
  assert.ok(/^[^]*\.fiche-radio a:hover/.test(lire('styles.css')), 'le style de la radio');
  assert.ok(!/^import /m.test(lire('js/radio.js')), 'radio.js reste sans import');
});

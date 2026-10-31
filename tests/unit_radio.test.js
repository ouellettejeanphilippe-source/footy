/* La radio d'un match (js/radio.js, fiche de match de js/ui.js), 31 octobre 2026.

   « Pour chaque match, un lien vers une station TuneIn, iHeartRadio et cie qui le diffuse ? »
   Aucune source ne dit qu'une station diffuse un match : ce qui est affirmé, c'est la station
   propre à l'équipe (LNH, relevée chez TuneIn) et celles des équipes dont l'indicatif et la fréquence concordent
   avec un annuaire. Plus de recherche de repli (« au lieu de chercher, trouve les stations officielles »). */
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

test('les Canadiens : la station de l\'équipe, TSN 690 (TuneIn et iHeartRadio) et le 98,5 FM, sans doublon', () => {
  const st = R.stationsDeLEquipe('Montreal Canadiens');
  assert.deepStrictEqual(st.map((s) => s.url), [
    'https://tunein.com/radio/s137385/', 'https://tunein.com/radio/s12472/', 'https://www.iheart.com/live/7450/', 'https://tunein.com/radio/s12468/'
  ]);
  assert.deepStrictEqual(st.map((s) => s.source), ['TuneIn', 'TuneIn', 'iHeartRadio', 'TuneIn']);
  assert.ok(st[3].nom.includes('(français)'), 'la langue est dite');
});

test('une équipe sans station connue n\'a aucun lien : ni station inventée, ni recherche de repli', () => {
  const r = R.radiosDuMatch({ homeTeam: 'Zzz Inconnus', awayTeam: 'Yyy Introuvables', league: 'LIGUE INCONNUE' });
  assert.deepStrictEqual(r.equipes.map((e) => e.equipe), ['Zzz Inconnus', 'Yyy Introuvables']);
  for (const e of r.equipes) {
    assert.strictEqual(e.stations.length, 0, 'aucune station inventée');
    assert.strictEqual(e.recherches, undefined, 'plus de recherche de repli');
  }
  assert.strictEqual(r.ligue, null);
  assert.strictEqual(typeof R.rechercheTuneIn, 'undefined');
  assert.strictEqual(typeof R.rechercheIHeart, 'undefined');
  const h = R.radioHtml(r, esc, I.icone);
  assert.ok(!/<a /.test(h), 'aucun lien');
  assert.ok(!/Chercher|search\?/.test(h), 'aucun bouton de recherche');
  assert.strictEqual((h.match(/Aucune station officielle connue/g) || []).length, 2, 'dit une fois par équipe');
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

test('le HTML : liens sûrs, texte échappé, aucune recherche', () => {
  const h = R.radioHtml(R.radiosDuMatch({ homeTeam: 'Montreal Canadiens', awayTeam: 'A <b>"&" B' }), esc, I.icone);
  assert.ok(h.includes('class="fiche-radio-titre">Radio'));
  assert.ok(h.includes('<svg'), 'l\'icône radio est dessinée');
  assert.ok(!h.includes('<b>'), 'le nom d\'équipe est échappé');
  assert.ok(h.includes('A &lt;b&gt;&quot;&amp;&quot; B'));
  const liens = h.match(/<a [^>]*>/g);
  assert.strictEqual(liens.length, 4, 'les quatre liens des Canadiens, rien pour l\'autre équipe');
  for (const a of liens) assert.ok(/target="_blank" rel="noopener noreferrer"/.test(a), 'ouverture sûre : ' + a);
  assert.ok(h.includes('98,5 FM (français) · TuneIn'));
  assert.ok(!/Chercher|search\?/.test(h), 'aucune recherche');
  assert.ok(h.includes('Aucune station officielle connue'), 'dit qu\'il n\'y en a pas pour l\'autre équipe');
});

test('le registre est cohérent : chaque clé existe, chaque station a un lien, chaque équipe est dans la base', () => {
  const cles = new Set(Object.values(T.TEAM_DATA).map((e) => R.cleEquipe(e.name)));
  const vusTunein = {}, vusIheart = {};
  for (const [k, s] of Object.entries(R.STATIONS)) {
    assert.ok(s.tunein || s.iheart, 'au moins un annuaire connaît ' + k);
    if (s.tunein) { assert.ok(/^s\d+$/.test(s.tunein), 'guide_id TuneIn de ' + k); assert.ok(!vusTunein[s.tunein], 'TuneIn en double : ' + k); vusTunein[s.tunein] = k; }
    if (s.iheart) { assert.ok(Number.isInteger(s.iheart), 'id iHeartRadio de ' + k); assert.ok(!vusIheart[s.iheart], 'iHeartRadio en double : ' + k); vusIheart[s.iheart] = k; }
    assert.ok(['en', 'fr', 'es'].includes(s.lang), 'langue de ' + k);
    assert.ok(s.nom && s.ind && s.freq, 'nom, indicatif et fréquence de ' + k);
  }
  for (const [eq, ks] of Object.entries(R.RADIOS_EQUIPES)) {
    assert.ok(cles.has(eq), 'équipe connue de la base : ' + eq);
    assert.ok(ks.length >= 1 && new Set(ks).size === ks.length, 'stations sans doublon pour ' + eq);
    for (const k of ks) assert.ok(R.STATIONS[k], eq + ' → ' + k + ' existe');
  }
  for (const ks of Object.values(R.RADIOS_LIGUES)) for (const k of ks) assert.ok(R.STATIONS[k], 'station de ligue ' + k);
  assert.ok(Object.keys(R.RADIOS_EQUIPES).length >= 100, 'NFL, LCF, NBA, MLB, MLS, LHJMQ : plus de cent équipes');
});

test('exemples : une station vérifiée par équipe, dans la bonne langue, par le bon annuaire', () => {
  const urls = (n) => R.stationsDeLEquipe(n).map((s) => s.url);
  assert.ok(urls('New York Yankees').includes('https://www.iheart.com/live/10930/'), 'WFAN chez iHeartRadio');
  const wado = R.stationsDeLEquipe('New York Yankees').find((s) => s.url.endsWith('/5172/'));
  assert.ok(wado && wado.nom.includes('(espagnol)'), 'WADO, radio espagnole');
  assert.ok(urls('Montreal Alouettes').includes('https://tunein.com/radio/s12472/'), 'Alouettes : TSN 690');
  assert.ok(R.stationsDeLEquipe('Montreal Alouettes').some((s) => s.nom.includes('99,5') && s.nom.includes('(français)')), 'Alouettes : 99,5 en français');
  assert.ok(urls('CF Montréal').includes('https://www.iheart.com/live/7450/'), 'CF Montréal : TSN 690');
  assert.ok(urls('Toronto Raptors').includes('https://www.iheart.com/live/7495/'), 'Raptors : TSN 1050');
  assert.ok(urls('Rimouski Océanic').length >= 1, 'LHJMQ : CFYX');
});

test('pas de lien invérifiable : une équipe dont la station n\'est dans aucun des deux annuaires n\'en a pas', () => {
  // Sportsnet 590 (Blue Jays, Raptors radio anglaise), WTMJ (Brewers, Bucks), KZNS (Jazz), Sacramento (plus de radio)…
  for (const n of ['Toronto Blue Jays', 'Milwaukee Brewers', 'Utah Jazz', 'Sacramento Kings', 'Kansas City Chiefs', 'Miami Heat']) {
    assert.strictEqual(R.stationsDeLEquipe(n).length, 0, n + ' : aucune station inventée');
  }
});

test('Premier League : talkSPORT au niveau du championnat, rien ailleurs', () => {
  const r = R.radiosDuMatch({ homeTeam: 'Arsenal', awayTeam: 'Chelsea', league: 'PREMIER LEAGUE' });
  assert.ok(r.ligue && r.ligue.stations.some((s) => s.url === 'https://tunein.com/radio/s17077/'), 'talkSPORT');
  const h = R.radioHtml(r, esc, I.icone);
  assert.ok(h.includes('talkSPORT · TuneIn') && h.includes('PREMIER LEAGUE'), 'la ligne du championnat');
  assert.ok(h.includes('Le championnat n\u2019en diffuse qu\u2019une partie'), 'la note dit que ce n\'est qu\'une partie des matchs');
  assert.strictEqual(R.radiosDuMatch({ homeTeam: 'Real Madrid', awayTeam: 'FC Barcelona', league: 'LA LIGA' }).ligue, null);
  assert.strictEqual(R.radiosDuMatch({ homeTeam: 'A', awayTeam: 'B' }).ligue, null);
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

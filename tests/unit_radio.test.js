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
  assert.strictEqual((h.match(/Aucune station officielle connue pour ce match/g) || []).length, 1, 'le dit une seule fois pour le match');
  assert.ok(!h.includes('Zzz Inconnus'), 'pas de ligne pour une équipe sans station');
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

test('le HTML : liens sûrs, texte échappé, lignes seulement pour ce qui a une station', () => {
  const h = R.radioHtml(R.radiosDuMatch({ homeTeam: 'Montreal Canadiens', awayTeam: 'Zzz Inconnus' }), esc, I.icone);
  assert.ok(h.includes('class="fiche-radio-titre">Radio'));
  assert.ok(h.includes('<svg'), 'l\'icône radio est dessinée');
  const liens = h.match(/<a [^>]*>/g);
  assert.strictEqual(liens.length, 4, 'les quatre liens des Canadiens');
  for (const a of liens) assert.ok(/target="_blank" rel="noopener noreferrer"/.test(a), 'ouverture sûre : ' + a);
  assert.ok(h.includes('98,5 FM (français) · TuneIn'));
  assert.ok(!h.includes('Zzz Inconnus'), 'l\'équipe sans station n\'a pas de ligne');
  assert.ok(h.includes('Pas de ligne pour une équipe : aucune station officielle connue'), 'la note le dit');
  assert.ok(!/Chercher|search\?/.test(h), 'aucune recherche');
  // Tout ce qui vient d'un nom ou d'une adresse est échappé.
  const piege = R.radioHtml({ equipes: [{ equipe: 'A <b>"&" B', stations: [{ nom: '<i>x</i>', url: 'https://x.test/"y"', source: 'S&T' }] }], ligue: null }, esc, I.icone);
  assert.ok(!piege.includes('<b>') && !piege.includes('<i>'), 'balises échappées');
  assert.ok(piege.includes('A &lt;b&gt;&quot;&amp;&quot; B') && piege.includes('href="https://x.test/&quot;y&quot;"') && piege.includes('S&amp;T'));
});

test('le registre est cohérent : chaque clé existe, chaque station a un lien, chaque équipe est dans la base', () => {
  const cles = new Set(Object.values(T.TEAM_DATA).map((e) => R.cleEquipe(e.name)));
  const vusTunein = {}, vusIheart = {};
  for (const [k, s] of Object.entries(R.STATIONS)) {
    assert.ok(s.tunein || s.iheart || s.site, 'au moins un annuaire ou une page officielle pour ' + k);
    if (s.tunein) { assert.ok(/^s\d+$/.test(s.tunein), 'guide_id TuneIn de ' + k); assert.ok(!vusTunein[s.tunein], 'TuneIn en double : ' + k); vusTunein[s.tunein] = k; }
    if (s.iheart) { assert.ok(Number.isInteger(s.iheart), 'id iHeartRadio de ' + k); assert.ok(!vusIheart[s.iheart], 'iHeartRadio en double : ' + k); vusIheart[s.iheart] = k; }
    assert.ok(['en', 'fr', 'es', 'de', 'nl'].includes(s.lang), 'langue de ' + k);
    assert.ok(s.nom, 'nom de ' + k);
    if (s.tunein || s.iheart) assert.ok(s.ind && s.freq, k + ' : un lien d\'annuaire s\'appuie sur un indicatif et une fréquence');
  }
  for (const [eq, ks] of Object.entries(R.RADIOS_EQUIPES)) {
    assert.ok(eq.includes('@') || cles.has(eq) || ['golden state valkyries'].includes(eq), 'équipe connue de la base : ' + eq);
    assert.ok(ks.length >= 1 && new Set(ks).size === ks.length, 'stations sans doublon pour ' + eq);
    for (const k of ks) assert.ok(R.STATIONS[k], eq + ' → ' + k + ' existe');
  }
  for (const ks of Object.values(R.RADIOS_LIGUES)) for (const k of ks) assert.ok(R.STATIONS[k], 'station de ligue ' + k);
  assert.ok(Object.keys(R.RADIOS_EQUIPES).length >= 170, 'pros, universités, rugby : plus de 170 entrées');
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

test('pas de lien invérifiable : sans station dans un annuaire ni page officielle ouverte, une équipe n\'a rien', () => {
  // WTMJ (Brewers, Bucks : site en 403), KZNS (Jazz), Sacramento (plus de radio locale), WDAE (Rays), Toronto FC.
  for (const n of ['Milwaukee Brewers', 'Milwaukee Bucks', 'Utah Jazz', 'Sacramento Kings', 'Tampa Bay Rays', 'Toronto FC']) {
    assert.strictEqual(R.stationsDeLEquipe(n).length, 0, n + ' : aucune station inventée');
  }
  // Une page d'écoute officielle ouverte avec succès remplace l'annuaire absent : Sportsnet 590 n'est ni chez TuneIn ni chez iHeartRadio.
  const jays = R.stationsDeLEquipe('Toronto Blue Jays');
  assert.ok(jays.some((s) => s.url === 'https://www.sportsnet.ca/590/' && s.source === 'Site de la station'), 'Blue Jays : Sportsnet 590');
  const raps = R.stationsDeLEquipe('Toronto Raptors').map((s) => s.url);
  assert.ok(raps.includes('https://www.sportsnet.ca/590/') && raps.includes('https://www.iheart.com/live/7495/'), 'Raptors : Sportsnet 590 (page) et TSN 1050 (iHeartRadio)');
});

test('Premier League : talkSPORT au niveau du championnat, rien ailleurs', () => {
  const r = R.radiosDuMatch({ homeTeam: 'Arsenal', awayTeam: 'Chelsea', league: 'PREMIER LEAGUE' });
  assert.ok(r.ligue && r.ligue.stations.some((s) => s.url === 'https://tunein.com/radio/s17077/'), 'talkSPORT');
  const h = R.radioHtml(r, esc, I.icone);
  assert.ok(h.includes('talkSPORT · TuneIn') && h.includes('PREMIER LEAGUE'), 'la ligne du championnat');
  assert.ok(h.includes('Le championnat n\u2019en diffuse qu\u2019une partie'), 'la note dit que ce n\'est qu\'une partie des matchs');
  assert.strictEqual(R.radiosDuMatch({ homeTeam: 'Napoli', awayTeam: 'Roma', league: 'SERIE A' }).ligue, null);
  assert.strictEqual(R.radiosDuMatch({ homeTeam: 'A', awayTeam: 'B' }).ligue, null);
});

test('un nom d\'école, deux sports : football et hockey ont chacun leur station', () => {
  const foot = R.radiosDuMatch({ homeTeam: 'Air Force Falcons', awayTeam: 'Boston College Eagles', league: 'NCAA FOOTBALL' }).equipes;
  const hock = R.radiosDuMatch({ homeTeam: 'Air Force Falcons', awayTeam: 'Boston College Eagles', league: "NCAA MEN'S ICE HOCKEY" }).equipes;
  assert.ok(foot[0].stations.some((s) => s.nom.startsWith('KVOR')), 'football : KVOR 740');
  assert.ok(!foot[0].stations.some((s) => s.nom.startsWith('XTRA')), 'pas la radio du hockey');
  assert.ok(hock[0].stations.some((s) => s.nom.startsWith('XTRA Sports 1300')), 'hockey : XTRA Sports 1300');
  assert.ok(!hock[0].stations.some((s) => s.nom.startsWith('KVOR')), 'pas la radio du football');
  // Sans sport connu (hockey féminin, basket), une école n'emprunte rien à un autre sport.
  const f = R.radiosDuMatch({ homeTeam: 'Air Force Falcons', awayTeam: 'Boston College Eagles', league: "NCAA WOMEN'S HOCKEY" }).equipes;
  assert.ok(f.every((e) => e.stations.length === 0), 'hockey féminin : rien');
  assert.strictEqual(R.sportDeLaLigue('NCAA FOOTBALL'), 'football');
  assert.strictEqual(R.sportDeLaLigue("NCAA MEN'S ICE HOCKEY"), 'hockey');
  assert.strictEqual(R.sportDeLaLigue('TOP 14'), 'rugby');
  assert.strictEqual(R.sportDeLaLigue('NHL'), '');
});

test('les championnats : Bundesliga, Eredivisie, Premier League, F1, NASCAR ont leur ligne', () => {
  for (const [ligue, n] of [['LA LIGA', 1], ['BUNDESLIGA', 1], ['EREDIVISIE', 1], ['PREMIER LEAGUE', 2], ['F1', 2], ['NASCAR', 2]]) {
    const r = R.radiosDuMatch({ homeTeam: 'X', awayTeam: 'Y', league: ligue });
    assert.ok(r.ligue && r.ligue.stations.length >= n, ligue + ' : ' + (r.ligue && r.ligue.stations.length));
  }
  const bl = R.radioHtml(R.radiosDuMatch({ homeTeam: 'Bayern Munich', awayTeam: 'Dortmund', league: 'BUNDESLIGA' }), esc, I.icone);
  assert.ok(bl.includes('(allemand)') && bl.includes('sportschau.de'), 'Sportschau, en allemand');
  assert.ok(!bl.includes('Bayern Munich'), 'pas de ligne pour une équipe sans station');
  // Une séance de F1 n'est pas une équipe : pas de ligne « Race » sans station.
  const f1 = R.radioHtml(R.radiosDuMatch({ homeTeam: 'Mexico City Grand Prix', awayTeam: 'Race', league: 'F1' }), esc, I.icone);
  assert.ok(!f1.includes('>Race<') && f1.includes('BBC Radio 5 Live'), 'F1 : seulement la ligne du championnat');
  assert.ok(!f1.includes('Pas de ligne pour une équipe') && !f1.includes('qu\u2019une partie'), 'F1 : ni « équipe sans station » ni « une partie des matchs »');
  assert.deepStrictEqual(R.radiosDuMatch({ homeTeam: 'Mexico City Grand Prix', awayTeam: 'Race', league: 'F1' }).equipes, [], 'F1 : pas d\'équipes');
  assert.ok(!bl.includes('qu\u2019une partie'), 'Bundesliga : un flux de chaque match, pas de note « une partie »');
});

test('toute station « site » est une adresse https, et seules celles hors annuaires en ont une', () => {
  for (const [k, s] of Object.entries(R.STATIONS)) {
    if (s.site) {
      assert.ok(/^https:\/\//.test(s.site), k + ' : adresse https');
      assert.ok(!s.tunein && !s.iheart, k + ' : un lien d\'annuaire passe avant la page officielle');
    }
  }
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

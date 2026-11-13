/* « Tout ce qui est stats et infos du genre, présenter de manière plus agréable et fonctionnelle »
   (13 novembre 2026, js/statsmatch.js) : une seule lecture et un seul dessin des statistiques d'un
   match pour la fiche, le panneau du lecteur et le panneau Scores et statistiques. Les formes
   viennent de site.api.espn.com, relevées le 13 novembre 2026. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let M, T;
test.before(async () => { M = await import(path.join(racine, 'js', 'statsmatch.js')); T = await import(path.join(racine, 'js', 'teinte.js')); });

const st = (name, label, displayValue) => ({ name, label, displayValue });
const foot = { boxscore: { teams: [
  { homeAway: 'away', team: { id: '22' }, statistics: [st('foulsCommitted', 'Fouls', '14'), st('possessionPct', 'Possession', '60.8'), st('totalShots', 'SHOTS', '9'), st('shotPct', 'On Target %', '0.5'), st('totalLongBalls', 'Long Balls', '40'), st('inconnue', 'Mystery Stat', '3')] },
  { homeAway: 'home', team: { id: '11' }, statistics: [st('foulsCommitted', 'Fouls', '11'), st('possessionPct', 'Possession', '39.2'), st('totalShots', 'SHOTS', '16'), st('shotPct', 'On Target %', '0.3'), st('totalLongBalls', 'Long Balls', '47'), st('inconnue', 'Mystery Stat', '5'), st('sansVisiteur', 'X', '1')] }
] } };

test('statsDuMatch : domicile à gauche même quand ESPN le range en second ; fractions en pourcentages', () => {
  const s = M.statsDuMatch(foot);
  assert.deepStrictEqual(s.map((x) => x.nom), ['foulsCommitted', 'possessionPct', 'totalShots', 'shotPct', 'totalLongBalls', 'inconnue']);
  assert.deepStrictEqual(s[1], { nom: 'possessionPct', brut: 'Possession', dom: '39.2', vis: '60.8' });
  assert.deepStrictEqual([s[3].dom, s[3].vis], ['30 %', '50 %'], '« 0.3 » se lit 30 %');
  assert.deepStrictEqual(M.statsDuMatch(null), []);
  assert.deepStrictEqual(M.statsDuMatch({ boxscore: { teams: [{ statistics: [] }] } }), []);
  // Sans homeAway, l'identifiant du domicile tranche.
  const sans = { boxscore: { teams: [{ team: { id: '22' }, statistics: [st('hits', 'Hits', '10')] }, { team: { id: '11' }, statistics: [st('hits', 'Hits', '33')] }] } };
  assert.strictEqual(M.statsDuMatch(sans, '11')[0].dom, '33');
});

test('trierStats : l\'essentiel du sport d\'abord, dans notre ordre ; le reste dans celui d\'ESPN', () => {
  const t = M.trierStats(M.statsDuMatch(foot));
  assert.deepStrictEqual(t.essentiel.slice(0, 3).map((x) => x.nom), ['possessionPct', 'totalShots', 'foulsCommitted']);
  assert.strictEqual(t.essentiel.length, 6, 'complété à six quand peu de statistiques essentielles sont connues');
  assert.strictEqual(t.reste.length, 0);
  const beaucoup = M.ESSENTIELS.slice(0, 12).map((n) => ({ nom: n, dom: '1', vis: '2' }));
  assert.strictEqual(M.trierStats(beaucoup).essentiel.length, M.ESSENTIELS_MAX);
  assert.strictEqual(M.trierStats(beaucoup).reste.length, 12 - M.ESSENTIELS_MAX);
  const hockeyAvant = ['avgGoalsAgainst', 'avgShotsAgainst', 'penaltyKillPct', 'powerPlayGoalsAgainst', 'shortHandedGoalsAgainst', 'avgGoals', 'avgShots', 'powerPlayGoals', 'powerPlayPct', 'shortHandedGoals', 'penaltyMinutes'].map((n) => ({ nom: n, dom: '1', vis: '2' }));
  assert.deepStrictEqual(M.trierStats(hockeyAvant).essentiel.slice(0, 4).map((x) => x.nom), ['avgGoals', 'avgGoalsAgainst', 'avgShots', 'avgShotsAgainst'], 'avant-match LNH : les buts d\'abord');
});

test('nombreDe et mesureDeLigne : part de chacun, et qui mène (le moins est parfois le mieux)', () => {
  assert.strictEqual(M.nombreDe('37-90'), 37);
  assert.strictEqual(M.nombreDe('24/29'), 24);
  assert.strictEqual(M.nombreDe('29:56'), 29 * 60 + 56);
  assert.strictEqual(M.nombreDe('30 %'), 30);
  assert.strictEqual(M.nombreDe('L1'), null, 'une série n\'est pas une grandeur');
  assert.strictEqual(M.nombreDe(''), null);
  assert.deepStrictEqual(M.mesureDeLigne({ nom: 'totalShots', dom: '16', vis: '9' }), { partDom: 64, mene: 'dom' });
  assert.deepStrictEqual(M.mesureDeLigne({ nom: 'foulsCommitted', dom: '11', vis: '14' }), { partDom: 44, mene: 'dom' }, 'moins de fautes : mieux');
  assert.strictEqual(M.mesureDeLigne({ nom: 'avgGoalsAgainst', dom: '2.25', vis: '3.59' }).mene, 'dom');
  assert.deepStrictEqual(M.mesureDeLigne({ nom: 'saves', dom: '4', vis: '4' }), { partDom: 50, mene: '' });
  assert.deepStrictEqual(M.mesureDeLigne({ nom: 'streak', dom: 'L1', vis: 'W3' }), { partDom: 50, mene: '' });
  assert.deepStrictEqual(M.mesureDeLigne({ nom: 'shortHandedGoals', dom: '0', vis: '0' }), { partDom: 50, mene: '' });
});

test('libelleStat : en français, sinon le repli s\'il traduit, sinon le libellé d\'ESPN', () => {
  assert.strictEqual(M.libelleStat('faceoffPercent', 'Faceoff Win Percent'), 'Mises au jeu (%)');
  assert.strictEqual(M.libelleStat('avgGoalsAgainst', 'Goals Against Average'), 'Buts accordés par match');
  assert.strictEqual(M.libelleStat('inconnue', 'Mystery Stat', (n) => n), 'Mystery Stat');
  assert.strictEqual(M.libelleStat('inconnue', 'Mystery Stat', () => 'Mystère'), 'Mystère');
  // Chaque statistique « essentielle » a son libellé.
  M.ESSENTIELS.forEach((n) => assert.ok(M.LIBELLES[n], 'libellé manquant : ' + n));
});

test('comparaisonHtml : lignes, meneur, barre partagée, reste replié, tout échappé', () => {
  const stats = M.statsDuMatch(foot).concat(M.ESSENTIELS.slice(9, 20).map((n) => ({ nom: n, brut: n, dom: '3', vis: '1' })));
  const html = M.comparaisonHtml(stats, esc, { couleurDom: '#c41230', couleurVis: 'red;x:url(1)', noms: ['A <b>', 'B'] });
  assert.match(html, /^<div class="cmp" style="--cmp-dom:#c41230;">/, 'une couleur qui n\'en est pas une est ignorée');
  assert.ok(html.includes('A &lt;b&gt;') && !html.includes('<b>'));
  assert.match(html, /<div class="cmp-ligne cmp-mene-vis" data-stat="possessionPct"><span class="cmp-v cmp-dom">39\.2<\/span><span class="cmp-l" title="Possession">Possession<\/span><span class="cmp-v cmp-vis">60\.8<\/span>/);
  assert.match(html, /data-stat="possessionPct">.*?<i class="cmp-dom" style="width:39\.2%"><\/i><i class="cmp-vis" style="width:60\.8%"><\/i>/);
  assert.match(html, /<details class="cmp-plus"><summary>Toutes les statistiques \(17\)<\/summary>/);
  assert.strictEqual((html.split('<details')[0].match(/class="cmp-ligne/g) || []).length, M.ESSENTIELS_MAX);
  assert.strictEqual(M.comparaisonHtml([], esc), '');
  assert.ok(!/<details/.test(M.comparaisonHtml(stats.slice(0, 3), esc)), 'rien à replier');
  assert.ok(/<details class="cmp-plus" open>/.test(M.comparaisonHtml(stats, esc, { ouvert: true })));
});

test('enteteMatchHtml : logos https seulement, score ou VS, état, sous-titres', () => {
  const html = M.enteteMatchHtml({ dom: 'Montréal <i>', vis: 'Boston', logoDom: 'https://a.espncdn.com/mtl.png', logoVis: 'javascript:alert(1)', score: [4, 0], etat: '2e 10:25', direct: true, ligue: 'NHL', sousDom: '<span class="fb-bilan">9-7-1</span>' }, esc);
  assert.match(html, /^<div class="em em-direct">/);
  assert.ok(html.includes('src="https://a.espncdn.com/mtl.png"') && !html.includes('javascript:'));
  assert.ok(html.includes('<span class="em-logo em-logo-texte" aria-hidden="true">B</span>'));
  assert.ok(html.includes('<span class="em-score">4<i>–</i>0</span>') && html.includes('<span class="em-etat">2e 10:25</span>'));
  assert.ok(html.includes('Montréal &lt;i&gt;') && html.includes('<span class="em-sous" data-cote="dom"><span class="fb-bilan">9-7-1</span></span>'));
  const avant = M.enteteMatchHtml({ dom: 'A', vis: 'B', etat: '19:00' }, esc);
  assert.ok(avant.includes('<span class="em-vs">VS</span>') && !avant.includes('em-direct'));
  assert.ok(!M.enteteMatchHtml({ dom: 'Grand Prix' }, esc).includes('em-vis'), 'un seul nom : une seule équipe');
  // L'échappement de l'application rend '' pour 0 : un score nul doit quand même s'écrire.
  const escApp = (v) => (v ? esc(v) : '');
  assert.ok(M.enteteMatchHtml({ dom: 'A', vis: 'B', score: [4, 0] }, escApp).includes('<span class="em-score">4<i>–</i>0</span>'));
});

test('couleursDuel : deux couleurs lisibles et distinctes, sinon null', () => {
  const d = T.couleursDuel(['#c41230', '#013a81'], ['#fcb514', '#000000']);
  assert.ok(d.dom && d.vis && d.dom !== d.vis);
  const proches = T.couleursDuel(['#c41230', '#ffffff'], ['#ce1126', '#000000']);
  assert.ok(proches.dom && proches.vis === null, 'deux rouges : le visiteur garde la couleur par défaut');
  const second = T.couleursDuel(['#c41230', '#ffffff'], ['#ce1126', '#003087']);
  assert.ok(second.vis && Math.abs(T.versHsl(second.vis).h - T.versHsl('#003087').h) <= 1, 'la seconde couleur du visiteur quand la première est trop proche');
  assert.deepStrictEqual(T.couleursDuel(['#000000'], null), { dom: null, vis: null });
});

test('branchement : un seul dessin pour les trois panneaux, module précaché et sans import', () => {
  const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');
  assert.ok(!/^\s*import\s/m.test(lire('js/statsmatch.js')), 'sans import');
  assert.ok(lire('sw.js').includes("'./js/statsmatch.js'"), 'dans APP_SHELL');
  for (const f of ['js/ui.js', 'js/multiview.js', 'js/config.js']) {
    const s = lire(f);
    assert.ok(/comparaisonHtml\(statsDuMatch\(res\.data, mHomeId\), esc,/.test(s), f + ' passe par js/statsmatch.js');
    assert.ok(!/boxscore\.teams/.test(s) || f === 'js/ui.js', f + ' ne relit plus le boxscore lui-même');
  }
});

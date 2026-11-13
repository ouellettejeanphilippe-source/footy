/* « Tout ce qui est stats et infos du genre, présenter de manière plus agréable et fonctionnelle »,
   « les graphiques stats, plus beau, mais aussi en ordre qui a du sens contextuellement », « séparer
   stats en direct et stats de la saison » (13 novembre 2026, js/statsmatch.js) : une seule lecture et
   un seul dessin des statistiques d'un match, rangées par thème, le match et la saison en onglets.
   Les formes viennent de site.api.espn.com, relevées le 13 novembre 2026. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const racine = path.join(__dirname, '..');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let M, T;
test.before(async () => { M = await import(path.join(racine, 'js', 'statsmatch.js')); T = await import(path.join(racine, 'js', 'teinte.js')); });

const st = (name, label, displayValue) => ({ name, label, displayValue });
/* Premier League, dans l'ORDRE D'ESPN : fautes, cartons, hors-jeu, corners, arrêts, possession, tirs… */
const footNoms = [['foulsCommitted', 'Fouls', '11', '14'], ['yellowCards', 'Yellow Cards', '2', '1'], ['redCards', 'Red Cards', '0', '0'], ['offsides', 'Offsides', '2', '3'],
  ['wonCorners', 'Corner Kicks', '6', '4'], ['saves', 'Saves', '4', '2'], ['possessionPct', 'Possession', '39.2', '60.8'], ['totalShots', 'SHOTS', '16', '9'],
  ['shotsOnTarget', 'ON GOAL', '4', '5'], ['shotPct', 'On Target %', '0.3', '0.6'], ['accuratePasses', 'Accurate Passes', '246', '410'], ['totalPasses', 'Passes', '310', '480'],
  ['passPct', 'Pass Completion %', '0.8', '0.9'], ['totalTackles', 'Tackles', '22', '18'], ['effectiveTackles', 'Effective Tackles', '12', '11'], ['inconnue', 'Mystery Stat', '3', '5']];
const foot = { header: { competitions: [{ status: { type: { state: 'in' } }, competitors: [] }] }, boxscore: { teams: [
  { homeAway: 'away', team: { id: '22' }, statistics: footNoms.map((x) => st(x[0], x[1], x[3])) },
  { homeAway: 'home', team: { id: '11' }, statistics: footNoms.map((x) => st(x[0], x[1], x[2])).concat([st('sansVisiteur', 'X', '1')]) }
] } };

test('statsDuMatch : domicile à gauche même quand ESPN le range en second ; fractions en pourcentages', () => {
  const s = M.statsDuMatch(foot);
  assert.strictEqual(s.length, footNoms.length, 'une statistique sans vis-à-vis saute');
  assert.deepStrictEqual(s.find((x) => x.nom === 'possessionPct'), { nom: 'possessionPct', brut: 'Possession', dom: '39.2', vis: '60.8' });
  assert.deepStrictEqual([s.find((x) => x.nom === 'shotPct').dom, s.find((x) => x.nom === 'shotPct').vis], ['30 %', '60 %'], '« 0.3 » se lit 30 %');
  assert.deepStrictEqual(M.statsDuMatch(null), []);
  assert.deepStrictEqual(M.statsDuMatch({ boxscore: { teams: [{ statistics: [] }] } }), []);
  const sans = { boxscore: { teams: [{ team: { id: '22' }, statistics: [st('hits', 'Hits', '10')] }, { team: { id: '11' }, statistics: [st('hits', 'Hits', '33')] }] } };
  assert.strictEqual(M.statsDuMatch(sans, '11')[0].dom, '33', 'sans homeAway, l\'identifiant du domicile tranche');
});

test('grouperStats : un ordre qui raconte le match, pas celui d\'ESPN', () => {
  const g = M.grouperStats(M.statsDuMatch(foot));
  assert.deepStrictEqual(g.map((x) => x.titre), ['Attaque', 'Jeu', 'Défense', 'Discipline et erreurs', 'Autres']);
  assert.deepStrictEqual(g[0].lignes.map((l) => l.nom), ['possessionPct', 'tirsCadres', 'wonCorners', 'offsides'], 'la possession et les tirs d\'abord, pas les fautes');
  assert.deepStrictEqual(g[3].lignes.map((l) => l.nom), ['foulsCommitted', 'yellowCards'], 'cartons rouges 0-0 : rien à comparer');
  assert.deepStrictEqual(g[4].lignes.map((l) => l.nom), ['inconnue'], 'ce qu\'on ne connaît pas reste visible, à la fin');
  // Hockey : le match, puis l'avant-match (moyennes) dans les mêmes thèmes.
  const hockey = ['blockedShots', 'hits', 'takeaways', 'shotsTotal', 'powerPlayGoals', 'powerPlayOpportunities', 'powerPlayPct', 'faceoffsWon', 'faceoffPercent', 'giveaways', 'penalties', 'penaltyMinutes'].map((n, i) => ({ nom: n, dom: String(i + 1), vis: String(i + 2) }));
  assert.deepStrictEqual(M.grouperStats(hockey).map((x) => [x.cle, x.lignes.map((l) => l.nom)]), [
    ['attaque', ['shotsTotal', 'avantageNumerique']], ['jeu', ['misesAuJeu', 'takeaways']], ['defense', ['blockedShots', 'hits']], ['discipline', ['penalties', 'penaltyMinutes', 'giveaways']]]);
  const avant = ['avgGoalsAgainst', 'avgShotsAgainst', 'penaltyKillPct', 'avgGoals', 'avgShots', 'powerPlayGoals', 'powerPlayPct', 'penaltyMinutes', 'streak'].map((n) => ({ nom: n, dom: n === 'streak' ? 'W2' : '1', vis: n === 'streak' ? 'L1' : '2' }));
  assert.deepStrictEqual(M.grouperStats(avant).map((x) => x.cle), ['forme', 'attaque', 'defense', 'discipline'], 'avant le match : la forme d\'abord');
  assert.deepStrictEqual(M.grouperStats(avant)[1].lignes.map((l) => l.nom), ['avgGoals', 'avgShots', 'powerPlayGoals', 'powerPlayPct'], 'une fusion à moitié ne se fait pas');
  assert.deepStrictEqual(M.grouperStats([]), []);
  assert.strictEqual(M.grouperStats([{ nom: 'mystere', dom: '1', vis: '2' }])[0].titre, 'Statistiques', 'un sport inconnu : un seul bloc, sans « Autres »');
});

test('les lignes qui disent la même chose sont fondues en une', () => {
  const g = M.grouperStats(M.statsDuMatch(foot));
  const passes = g[1].lignes.find((l) => l.nom === 'passes');
  assert.deepStrictEqual([passes.libelle, passes.dom, passes.vis, passes.sousDom, passes.sousVis], ['Passes réussies', '80 %', '90 %', '246/310', '410/480']);
  assert.deepStrictEqual(M.mesureDeLigne(passes), { partDom: 47.1, mene: 'vis' }, 'la barre compare les pourcentages');
  const tacles = g[2].lignes.find((l) => l.nom === 'tacles');
  assert.deepStrictEqual([tacles.dom, tacles.sousDom], ['12/22', ''], 'sans pourcentage : la fraction seule');
  const toutes = [].concat.apply([], g.map((x) => x.lignes.map((l) => l.nom)));
  ['accuratePasses', 'totalPasses', 'passPct', 'shotsOnTarget', 'totalShots', 'shotPct'].forEach((n) => assert.ok(!toutes.includes(n), n + ' n\'est pas répété'));
  // Chaque fusion et chaque nom rangé dans un thème a son libellé.
  M.THEMES.forEach((t) => t.noms.forEach((n) => { const c = /^\[(.+)\]$/.exec(n); assert.ok(c ? M.FUSIONS[c[1]] : M.LIBELLES[n], 'sans libellé : ' + n); }));
  M.NOMS_SAISON.forEach((n) => assert.ok(M.THEMES.some((t) => t.noms.includes(n)), 'saison non rangée : ' + n));
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
});

test('libelleStat : en français, sinon le repli s\'il traduit, sinon le libellé d\'ESPN', () => {
  assert.strictEqual(M.libelleStat('faceoffPercent', 'Faceoff Win Percent'), 'Mises au jeu');
  assert.strictEqual(M.libelleStat('avgGoalsAgainst', 'Goals Against Average'), 'Buts accordés par match');
  assert.strictEqual(M.libelleStat('inconnue', 'Mystery Stat', (n) => n), 'Mystery Stat');
  assert.strictEqual(M.libelleStat('inconnue', 'Mystery Stat', () => 'Mystère'), 'Mystère');
});

test('comparaisonHtml : une carte par thème, la valeur qui mène marquée, tout échappé', () => {
  const html = M.comparaisonHtml(M.statsDuMatch(foot), esc, { couleurDom: '#c41230', couleurVis: 'red;x:url(1)', noms: ['A <b>', 'B'] });
  assert.match(html, /^<div class="cmp" style="--cmp-dom:#c41230;">/, 'une couleur qui n\'en est pas une est ignorée');
  assert.ok(html.includes('A &lt;b&gt;') && !html.includes('<b>A'));
  assert.deepStrictEqual((html.match(/data-theme="[a-z]+"/g) || []), ['data-theme="attaque"', 'data-theme="jeu"', 'data-theme="defense"', 'data-theme="discipline"', 'data-theme="autres"']);
  assert.match(html, /<div class="cmp-ligne cmp-mene-vis" data-stat="possessionPct"><span class="cmp-v cmp-dom"><b>39,2 %<\/b><\/span><span class="cmp-l" title="Possession">Possession<\/span><span class="cmp-v cmp-vis"><b>60,8 %<\/b><\/span>/);
  assert.match(html, /data-stat="possessionPct">.*?<i class="cmp-dom" style="width:39\.2%"><\/i><i class="cmp-vis" style="width:60\.8%"><\/i>/);
  assert.match(html, /data-stat="passes"><span class="cmp-v cmp-dom"><b>80 %<\/b><small>246\/310<\/small><\/span>/);
  assert.ok(html.includes('title="Mystery Stat"'), 'le libellé d\'ESPN en dernier recours');
  assert.ok(!/<details/.test(html), 'plus rien de replié');
  assert.strictEqual(M.comparaisonHtml([], esc), '');
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

/* ── « Séparer stats en direct et stats de la saison ». Formes de /teams/<id>/statistics (LNH, NBA). ── */
const cat = (name, o) => ({ name, stats: Object.keys(o).map((k) => ({ name: k, displayValue: o[k] })) });
const saisonLnh = (buts, tirs, contre) => ({ results: { stats: { categories: [
  cat('general', { games: '19', timeOnIce: '6770:13', wins: '12', losses: '3' }),
  cat('offensive', { goals: String(buts), shotsTotal: String(tirs), powerPlayGoals: '8', shootingPct: '12.3', faceoffPercent: '52.4' }),
  cat('defensive', { avgGoalsAgainst: '3.00', savePct: '.899', shotsAgainst: String(contre) }), cat('penalties', { penaltyMinutes: '210' })] } } });

test('saisonDEquipe : seulement ce qui compare deux équipes ; moyennes par match calculées au hockey', () => {
  const s = M.saisonDEquipe(saisonLnh(65, 529, 537));
  assert.deepStrictEqual(s, { avgGoals: '3.42', avgShots: '27.8', shootingPct: '12.3', powerPlayGoals: '8', faceoffPercent: '52.4', avgGoalsAgainst: '3.00', avgShotsAgainst: '28.3', savePct: '89.9', avgPenaltyMinutes: '11.1' });
  assert.ok(!('timeOnIce' in s) && !('wins' in s), 'ni temps de glace ni bilan (il est dans l\'en-tête)');
  const nba = M.saisonDEquipe({ results: { stats: { categories: [cat('offensive', { avgPoints: '110.3', threePointPct: '36.2', fieldGoalPct: '43.6', points: '1213' })] } } });
  assert.deepStrictEqual(nba, { avgPoints: '110.3', fieldGoalPct: '43.6', threePointFieldGoalPct: '36.2' });
  assert.deepStrictEqual(M.saisonDEquipe(null), {});
  assert.deepStrictEqual(M.saisonDEquipe({ results: { stats: { categories: [] } } }), {}, 'le football : ESPN ne donne rien');
  const duel = M.statsDeSaison(saisonLnh(65, 529, 537), saisonLnh(40, 480, 600));
  assert.deepStrictEqual(duel.find((x) => x.nom === 'avgGoals'), { nom: 'avgGoals', brut: 'avgGoals', dom: '3.42', vis: '2.11' });
  assert.deepStrictEqual(M.statsDeSaison(saisonLnh(65, 529, 537), null), []);
});

test('etatDuSummary : avant, pendant, après', () => {
  const s = (e) => ({ header: { competitions: [{ status: { type: { state: e } } }] } });
  assert.deepStrictEqual(['pre', 'in', 'post', 'autre'].map((e) => M.etatDuSummary(s(e))), ['pre', 'in', 'post', '']);
  assert.strictEqual(M.etatDuSummary(null), '');
});

test('monterStats : avant le match la saison seule ; ensuite « En direct » et « Saison » en onglets', async () => {
  const dom = new JSDOM('<!doctype html><div id="z"></div>');
  const zone = dom.window.document.getElementById('z');
  M.oublierSaisons();
  const avantMatch = { header: { competitions: [{ status: { type: { state: 'pre' } } }] }, boxscore: { teams: [
    { homeAway: 'home', statistics: [st('avgGoals', 'Goals', '4.10')] }, { homeAway: 'away', statistics: [st('avgGoals', 'Goals', '3.29')] }] } };
  let appels = 0;
  const charger = () => { appels++; return Promise.resolve([saisonLnh(65, 529, 537), saisonLnh(40, 480, 600)]); };
  assert.strictEqual(M.monterStats(zone, { data: avantMatch, esc, cle: 'a', chargerSaison: charger }), true);
  assert.ok(zone.querySelector('.cmp-titre').textContent.startsWith('Saison'), 'des moyennes de saison ne s\'appellent pas « statistiques du match »');
  assert.strictEqual(zone.querySelectorAll('.cmp-onglet').length, 0);
  assert.strictEqual(appels, 0);

  // Match en cours : deux onglets, le match d'abord, la saison lue seulement au clic, une seule fois.
  const o = { data: foot, esc, cle: 'm1', idDom: '11', chargerSaison: charger };
  M.monterStats(zone, o);
  assert.deepStrictEqual([...zone.querySelectorAll('.cmp-onglet')].map((b) => [b.textContent, b.getAttribute('aria-selected')]), [['En direct', 'true'], ['Saison', 'false']]);
  assert.ok(zone.querySelector('[data-stat="possessionPct"]') && appels === 0);
  zone.querySelector('.cmp-onglet[data-onglet="saison"]').onclick();
  assert.strictEqual(M.ongletDesStats(), 'saison');
  assert.match(zone.querySelector('.cmp-vide').textContent, /Chargement/);
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(zone.querySelector('[data-stat="avgGoals"]') && !zone.querySelector('[data-stat="possessionPct"]'), 'la saison a remplacé le match');
  // Une relecture (chaque minute) garde l'onglet choisi et ne redemande rien.
  M.monterStats(zone, o);
  assert.ok(zone.querySelector('[data-stat="avgGoals"]'));
  assert.strictEqual(appels, 1);
  zone.querySelector('.cmp-onglet[data-onglet="match"]').onclick();
  assert.ok(zone.querySelector('[data-stat="possessionPct"]'));

  // Match fini : « Ce match ». Saison vide (football) : c'est dit. Panne : c'est dit, et on réessaiera.
  const fini = JSON.parse(JSON.stringify(foot)); fini.header.competitions[0].status.type.state = 'post';
  M.oublierSaisons();
  M.monterStats(zone, { data: fini, esc, cle: 'm2', chargerSaison: () => Promise.resolve([{}, {}]) });
  assert.strictEqual(zone.querySelector('.cmp-onglet').textContent, 'Ce match');
  zone.querySelector('.cmp-onglet[data-onglet="saison"]').onclick();
  await new Promise((r) => setTimeout(r, 10));
  assert.match(zone.querySelector('.cmp-vide').textContent, /Pas de statistiques de saison/);
  M.oublierSaisons();
  let pannes = 0;
  const enPanne = { data: fini, esc, cle: 'm3', chargerSaison: () => { pannes++; return Promise.reject(new Error('réseau')); } };
  M.monterStats(zone, enPanne);
  zone.querySelector('.cmp-onglet[data-onglet="saison"]').onclick();
  await new Promise((r) => setTimeout(r, 10));
  assert.match(zone.querySelector('.cmp-vide').textContent, /ne répond pas/);
  M.monterStats(zone, enPanne);
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(pannes, 2, 'un échec n\'est pas retenu');
  M.oublierSaisons();
  assert.strictEqual(M.monterStats(zone, { data: null, esc }), false);
  assert.strictEqual(zone.innerHTML, '');
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
    assert.ok(/monterStats\(/.test(s) && /fetchTeamSeasonStats\(m\.league, mHomeId\)/.test(s), f + ' passe par js/statsmatch.js, saison comprise');
    assert.ok(!/boxscore\.teams/.test(s) || f === 'js/ui.js', f + ' ne relit plus le boxscore lui-même');
  }
});

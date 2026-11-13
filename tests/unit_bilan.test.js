/* « Dans la carte de sélection de match, mettre les stats genre la fiche où sont les noms et logos »
   (13 novembre 2026, les cartes du Live) : le bilan de chaque équipe, lu dans le scoreboard d'ESPN. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');
let B;
test.before(async () => { B = await import(path.join(racine, 'js', 'bilan.js')); });

test('bilanDe : la ligne d\'ensemble du scoreboard (ytd au hockey, total au football)', () => {
  // Formes relevées sur site.api.espn.com le 13 novembre 2026.
  const lnh = { records: [{ name: 'Home', type: 'home', summary: '5-4-0' }, { name: 'YTD', type: 'ytd', summary: '9-7-1' }, { name: 'Road', type: 'road', summary: '4-3-1' }] };
  const foot = { records: [{ name: 'All Splits', type: 'total', summary: '3-5-2' }], form: 'WLDDL' };
  assert.strictEqual(B.bilanDe(lnh), '9-7-1', 'pas le bilan à domicile');
  assert.strictEqual(B.bilanDe(foot), '3-5-2');
  assert.strictEqual(B.bilanDe({ records: [{ type: 'autre', summary: ' 12-3 ' }] }), '12-3', 'à défaut, la première ligne');
});

test('bilanDe : rien quand il manque ou n\'a pas la forme d\'un bilan', () => {
  assert.strictEqual(B.bilanDe(null), '');
  assert.strictEqual(B.bilanDe({}), '');
  assert.strictEqual(B.bilanDe({ records: [] }), '');
  assert.strictEqual(B.bilanDe({ records: [{ type: 'total', summary: '<b>1-0</b>' }] }), '');
  assert.strictEqual(B.bilanDe({ records: [{ type: 'total', summary: '1st in Group A' }] }), '');
  assert.strictEqual(B.bilanDe({ records: [{ type: 'total' }] }), '');
});

test('bilanHtml : une pastille discrète, rien pour un bilan absent ou douteux', () => {
  const esc = (s) => String(s).replace(/</g, '&lt;');
  assert.strictEqual(B.bilanHtml('9-7-1', esc), '<span class="prime-bilan" title="Bilan de la saison : 9-7-1">9-7-1</span>');
  assert.strictEqual(B.bilanHtml('', esc), '');
  assert.strictEqual(B.bilanHtml(undefined, esc), '');
  assert.strictEqual(B.bilanHtml('"><script>', esc), '');
});

test('branchement : les deux lecteurs d\'ESPN posent homeRecord / awayRecord, module précaché et sans import', () => {
  const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');
  for (const f of ['js/api.js', 'scripts/scrape_schedule.mjs']) {
    const s = lire(f);
    assert.ok(/homeRecord: isRacing \? '' : bilanDe\(/.test(s) && /awayRecord: isRacing \? '' : bilanDe\(/.test(s), f);
  }
  assert.ok(!/^\s*import\s/m.test(lire('js/bilan.js')), 'sans import');
  assert.ok(lire('sw.js').includes("'./js/bilan.js'"), 'dans APP_SHELL');
  assert.ok(lire('js/ui.js').includes('bilanHtml(m.homeRecord, esc)') && lire('js/ui.js').includes('bilanHtml(m.awayRecord, esc)'));
});

test('statsEquipeHtml (bannière de la fiche) : rang et bilan sous le nom, rien sans l\'un ni l\'autre', () => {
  const esc = (s) => String(s).replace(/</g, '&lt;');
  assert.strictEqual(B.statsEquipeHtml('3', '9-7-1', esc),
    '<span class="fb-rang" title="Rang au classement">#3</span><span class="fb-bilan" title="Bilan de la saison">9-7-1</span>');
  assert.strictEqual(B.statsEquipeHtml('', '9-7-1', esc), '<span class="fb-bilan" title="Bilan de la saison">9-7-1</span>');
  assert.strictEqual(B.statsEquipeHtml(12, '', esc), '<span class="fb-rang" title="Rang au classement">#12</span>');
  assert.strictEqual(B.statsEquipeHtml('', '', esc), '');
  assert.strictEqual(B.statsEquipeHtml(undefined, undefined, esc), '');
  assert.strictEqual(B.statsEquipeHtml('<b>', 'un texte bien trop long pour être un bilan', esc), '');
  assert.ok(!B.statsEquipeHtml('', '<i>x</i>', esc).includes('<i>'), 'échappé');
});

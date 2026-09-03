const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

/* Régression : un alias partagé par plusieurs équipes distinctes (« rangers » entre
   Queens Park Rangers, les New York Rangers et les Texas Rangers ; « man » entre
   Manchester City, Manchester United et Mansfield Town...) écrasait silencieusement
   l'entrée précédente de TEAM_ALIASES au profit de la dernière équipe déclarée dans
   teams.js. Un match de Scottish Premiership « Falkirk vs Rangers » ressortait avec
   « Texas Rangers » comme adversaire — un flux MLB attaché à un match de football.
   getOfficialTeamName doit désormais laisser un alias ambigu tel quel plutôt que de
   deviner une équipe au hasard ; un alias qui n'appartient qu'à une seule équipe doit
   continuer à se résoudre normalement. */

const dbJsPath = path.join(__dirname, '../js/db.js');
let dbJsContent = fs.readFileSync(dbJsPath, 'utf8');

function stripESM(content) {
    return content
        .replace(/import\s+[^;]+from\s+'[^']+'\s*;/g, '')
        .replace(/export\s+(var|const|function|let)\s+/g, '$1 ')
        .replace(/export\s+\{[^}]+\}\s*;/g, '');
}
const strippedDbJs = stripESM(dbJsContent);

const MOCK_TEAM_DATA = {
    'falkirk': { name: 'Falkirk', league: 'scottish premiership', colors: ['#001489'], aliases: ['fal'] },
    'rangers': { name: 'Rangers', league: 'scottish premiership', colors: ['#0046ff'], aliases: ['rangers', 'ran'] },
    'queens park rangers': { name: 'Queens Park Rangers', league: 'league cup', colors: ['#0000d4'], aliases: ['qpr', 'rangers'] },
    'new york rangers': { name: 'New York Rangers', league: 'nhl', colors: ['#0056ae'], aliases: ['nyr', 'rangers'] },
    'texas rangers': { name: 'Texas Rangers', league: 'mlb', colors: ['#003278'], aliases: ['tex', 'rangers'] },
    'arsenal': { name: 'Arsenal', league: 'premier league', colors: ['#e20520'], aliases: ['ars', 'gunners', 'ac'] },
    'atletico madrid': { name: 'Atlético Madrid', league: 'la liga', colors: ['#c8102e'], aliases: ['ac'] }
};

const sandbox = {
    TEAM_DATA: MOCK_TEAM_DATA,
    esc: (s) => s,
    window: {},
    console: console,
    encodeURIComponent: encodeURIComponent,
    Math: Math, String: String, Object: Object, Array: Array,
    STATIC_TEAMS: undefined, TEAM_COLORS: undefined, TEAM_ALIASES: undefined,
    LGC: undefined, FLAGS: undefined, LEAGUE_ALIASES: undefined,
    LEAGUE_FORMAT_NAMES: undefined, _normCache: undefined
};

vm.createContext(sandbox);
vm.runInContext(strippedDbJs, sandbox);

const getOfficialTeamName = sandbox.getOfficialTeamName;
const TEAM_ALIASES = sandbox.TEAM_ALIASES;

let n = 0;
const ok = (name) => { n++; console.log('  ✓ ' + name); };

// ── L'alias ambigu n'est jamais résolu vers une équipe au hasard ───────────
assert.strictEqual(TEAM_ALIASES['rangers'], undefined, '« rangers » ne doit appartenir à aucune équipe dans TEAM_ALIASES');
ok('alias partagé par 4 équipes → absent de TEAM_ALIASES');

// "Rangers" est aussi le nom propre du club de Glasgow (clé 'rangers' dans
// TEAM_DATA) : il se résout donc vers lui-même via STATIC_TEAM_MAP (correspondance
// de nom, pas d'alias) — c'était impossible avant le correctif, parce que l'alias
// ambigu réécrivait `lower` en "texas rangers" avant même que cette recherche par
// nom propre ait lieu. Le test qui compte est qu'il ne devienne JAMAIS une autre
// équipe (Texas Rangers, New York Rangers, Queens Park Rangers).
var resolved = getOfficialTeamName('Rangers');
assert.strictEqual(resolved, 'Rangers', 'doit rester "Rangers" (Glasgow), jamais une autre équipe');
assert.notStrictEqual(resolved, 'Texas Rangers');
assert.notStrictEqual(resolved, 'New York Rangers');
assert.notStrictEqual(resolved, 'Queens Park Rangers');
ok('getOfficialTeamName("Rangers") reste "Rangers" (Glasgow) — jamais "Texas Rangers" ni un autre club');

// ── Les alias non ambigus continuent de fonctionner normalement ────────────
assert.strictEqual(getOfficialTeamName('ars'), 'Arsenal');
assert.strictEqual(getOfficialTeamName('gunners'), 'Arsenal');
ok('alias propre à une seule équipe (ars, gunners → Arsenal) toujours résolu');

assert.strictEqual(getOfficialTeamName('qpr'), 'Queens Park Rangers');
assert.strictEqual(getOfficialTeamName('nyr'), 'New York Rangers');
assert.strictEqual(getOfficialTeamName('tex'), 'Texas Rangers');
ok('alias propre à chacune des équipes « Rangers » (qpr, nyr, tex) toujours résolu individuellement');

// ── Un alias ambigu qui n'est le nom propre d'AUCUNE équipe reste inchangé ─
// ("ac" est réclamé par Arsenal ET l'Atlético Madrid, et n'est le nom complet
// d'aucune des deux : sans résolution possible, le nom d'origine est renvoyé
// tel quel — jamais une équipe choisie au hasard parmi celles qui se le
// disputent.)
assert.strictEqual(TEAM_ALIASES['ac'], undefined, '« ac » (Arsenal ET Atlético) ne doit appartenir à aucune équipe');
assert.strictEqual(getOfficialTeamName('ac'), 'ac');
ok('alias ambigu sans nom propre correspondant → renvoyé inchangé, jamais deviné');

// ── Les noms complets, jamais ambigus, continuent de se résoudre ───────────
assert.strictEqual(getOfficialTeamName('Texas Rangers'), 'Texas Rangers');
assert.strictEqual(getOfficialTeamName('New York Rangers'), 'New York Rangers');
assert.strictEqual(getOfficialTeamName('Queens Park Rangers'), 'Queens Park Rangers');
ok('noms complets toujours résolus vers eux-mêmes');

console.log(`\nTous les ${n} tests de désambiguïsation des alias passent.`);

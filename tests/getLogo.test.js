const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

/**
 * Unit tests for getLogo function in js/db.js
 *
 * This test uses the 'vm' module to execute js/db.js in an isolated environment
 * with mocked dependencies.
 */

// Load js/db.js content
const dbJsPath = path.join(__dirname, '../js/db.js');
if (!fs.existsSync(dbJsPath)) {
    console.error("Could not find js/db.js");
    process.exit(1);
}
let dbJsContent = fs.readFileSync(dbJsPath, 'utf8');

/**
 * Strips ESM syntax for Node.js execution.
 */
function stripESM(content) {
    return content
        .replace(/import\s+[^;]+from\s+'[^']+'\s*;/g, '') // Strip imports
        .replace(/export\s+(var|const|function|let)\s+/g, '$1 ') // Strip 'export' from declarations
        .replace(/export\s+\{[^}]+\}\s*;/g, ''); // Strip named export blocks at the end
}

const strippedDbJs = stripESM(dbJsContent);

// Mock data for isolation
const MOCK_TEAM_DATA = {
    'arsenal': {
        name: 'Arsenal',
        logo: 'https://mock.logo/arsenal.png',
        aliases: ['ars', 'gunners'],
        colors: ['#ff0000', '#ffffff']
    },
    'chelsea': {
        name: 'Chelsea',
        // No logo provided, should trigger fallback with these colors
        colors: ['#0000ff', '#ffffff']
    },
    // 25 des 821 équipes réelles (sélections nationales surtout) ne déclarent qu'une
    // seule couleur. getTeamColors renvoyait alors un tableau d'un seul élément et
    // getLogo plantait sur colors[1].replace(...) — ce qui interrompait le rendu de
    // toute la grille (buildEPG), pas seulement de la carte fautive.
    'algeria': {
        name: 'Algeria',
        colors: ['#5bbd19']
    }
};

// Dependencies and globals for the sandbox
const sandbox = {
    TEAM_DATA: MOCK_TEAM_DATA,
    esc: (s) => s, // Mock esc from utils.js
    window: {},
    console: console,
    encodeURIComponent: encodeURIComponent,
    Math: Math,
    String: String,
    Object: Object,
    Array: Array,
    // These will be populated by the script itself
    STATIC_TEAMS: undefined,
    TEAM_COLORS: undefined,
    TEAM_ALIASES: undefined,
    LGC: undefined,
    FLAGS: undefined,
    LEAGUE_ALIASES: undefined,
    LEAGUE_FORMAT_NAMES: undefined,
    _normCache: undefined
};

try {
    vm.createContext(sandbox);
    vm.runInContext(strippedDbJs, sandbox);
} catch (e) {
    console.error("Failed to load js/db.js in VM context:", e);
    process.exit(1);
}

const getLogo = sandbox.getLogo;
const teamColorPair = sandbox.teamColorPair;

if (typeof getLogo !== 'function') {
    console.error("getLogo is not a function in the loaded context");
    process.exit(1);
}

if (typeof teamColorPair !== 'function') {
    console.error("teamColorPair is not a function in the loaded context");
    process.exit(1);
}

// teamColorPair complète toujours la paire, quelle que soit la donnée d'origine.
[['Algeria', '#5bbd19'], ['Arsenal', '#ff0000'], ['Inconnu XYZ', null]].forEach(function (c) {
    const pair = teamColorPair(c[0]);
    assert.ok(Array.isArray(pair) && pair.length >= 2, 'teamColorPair(' + c[0] + ') doit renvoyer deux couleurs');
    assert.ok(typeof pair[0] === 'string' && pair[0], 'couleur de fond manquante pour ' + c[0]);
    assert.ok(typeof pair[1] === 'string' && pair[1], 'couleur de texte manquante pour ' + c[0]);
    if (c[1]) assert.strictEqual(pair[0], c[1]);
});
console.log('✅ [PASS] teamColorPair renvoie toujours une paire complète');

const tests = [
    {
        name: "Null input",
        input: null,
        expected: null
    },
    {
        name: "Empty string input",
        input: "",
        expected: null
    },
    {
        name: "Exact match (Arsenal)",
        input: "Arsenal",
        expected: "https://mock.logo/arsenal.png"
    },
    {
        name: "Match via alias (ars)",
        input: "ars",
        expected: "https://mock.logo/arsenal.png"
    },
    {
        name: "Match via alias (gunners)",
        input: "gunners",
        expected: "https://mock.logo/arsenal.png"
    },
    {
        name: "Normalization and case-insensitivity (ArSeNaL)",
        input: "ArSeNaL",
        expected: "https://mock.logo/arsenal.png"
    },
    {
        name: "Known team without logo (Chelsea) - should use team colors in fallback",
        input: "Chelsea",
        expected: "https://ui-avatars.com/api/?name=Chelsea&background=0000ff&color=ffffff&size=200&font-size=0.4"
    },
    {
        name: "Unknown team fallback to ui-avatars with default colors",
        input: "Jules FC",
        expected: "https://ui-avatars.com/api/?name=Jules%20FC&background=333333&color=ffffff&size=200&font-size=0.4"
    },
    {
        name: "Équipe sans logo et à une seule couleur (Algeria) - ne doit pas planter",
        input: "Algeria",
        expected: "https://ui-avatars.com/api/?name=Algeria&background=5bbd19&color=ffffff&size=200&font-size=0.4"
    },
    {
        name: "Nom inconnu contenant une équipe à une seule couleur (correspondance floue)",
        input: "Algeria U21",
        expected: "https://ui-avatars.com/api/?name=Algeria%20U21&background=5bbd19&color=ffffff&size=200&font-size=0.4"
    }
];

let failed = 0;
console.log("Running robust unit tests for getLogo...");

tests.forEach(t => {
    try {
        const result = getLogo(t.input);
        assert.strictEqual(result, t.expected);
        console.log(`✅ [PASS] ${t.name}`);
    } catch (e) {
        console.log(`❌ [FAIL] ${t.name}`);
        console.log(`   Input:    ${t.input}`);
        console.log(`   Expected: ${t.expected}`);
        console.log(`   Actual:   ${getLogo(t.input)}`);
        if (e.message) console.log(`   Error:    ${e.message}`);
        failed++;
    }
});

if (failed > 0) {
    console.log(`\nTests failed: ${failed}`);
    process.exit(1);
} else {
    console.log(`\nAll ${tests.length} tests passed!`);
    process.exit(0);
}

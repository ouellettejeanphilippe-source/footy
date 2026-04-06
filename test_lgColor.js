const assert = require('assert');
const fs = require('fs');

// Dynamically extract LGC and lgColor from index.html
const indexContent = fs.readFileSync('index.html', 'utf8');

// Find the section between /* ══ COULEURS ═══════════════════════════ */ and the end of lgColor
const startMarker = '/* ══ COULEURS ═══════════════════════════ */';
const endMarker = 'function lgFlag(n){';

const startIndex = indexContent.indexOf(startMarker);
const endIndex = indexContent.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find LGC or lgColor in index.html');
    process.exit(1);
}

const codeToTest = indexContent.substring(startIndex, endIndex);

// We need a dummy pad function because it's used if we were to test more,
// though lgColor doesn't seem to use it directly, let's just eval what we found.
// Actually, lgColor doesn't use any other functions from index.html based on my reading.
// It uses [].reduce.call which is standard JS.

// Evaluate the code in the current context
eval(codeToTest);

// Now LGC and lgColor should be available

// Tests
try {
    console.log('Running tests for lgColor extracted from index.html...');

    // 1. Happy path: exact matches from LGC
    assert.strictEqual(lgColor('Premier League'), '#7c3aed', 'Should return purple for Premier League');
    assert.strictEqual(lgColor('La Liga'), '#dc2626', 'Should return red for La Liga');
    assert.strictEqual(lgColor('NBA'), '#17408b', 'Should return blue for NBA');
    assert.strictEqual(lgColor('NHL'), '#000000', 'Should return black for NHL');
    assert.strictEqual(lgColor('NFL'), '#013369', 'Should return navy for NFL');
    assert.strictEqual(lgColor('MLB'), '#002d72', 'Should return blue for MLB');

    // 2. Case insensitivity
    assert.strictEqual(lgColor('premier league'), '#7c3aed', 'Should be case-insensitive');
    assert.strictEqual(lgColor('PREMIER LEAGUE'), '#7c3aed', 'Should be case-insensitive');

    // 3. Substring matching
    assert.strictEqual(lgColor('English Premier League'), '#7c3aed', 'Should match substring');
    assert.strictEqual(lgColor('Champions League 2024'), '#f59e0b', 'Should match substring');

    // 4. Default color for unknown leagues (HSL fallback)
    const unknownColor = lgColor('Some Unknown Sport');
    assert.ok(unknownColor.startsWith('hsl('), 'Fallback should be an HSL color');
    assert.strictEqual(lgColor('Some Unknown Sport'), unknownColor, 'Fallback should be deterministic');

    // 5. Edge cases: null, undefined, empty string
    // n || 'X' and n || '' are used in the code
    assert.ok(lgColor(null).startsWith('hsl('), 'Should handle null');
    assert.ok(lgColor(undefined).startsWith('hsl('), 'Should handle undefined');
    assert.ok(lgColor('').startsWith('hsl('), 'Should handle empty string');

    console.log('All tests passed!');
} catch (error) {
    console.error('Test failed:');
    console.error(error);
    process.exit(1);
}

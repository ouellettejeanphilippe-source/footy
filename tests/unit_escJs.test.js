
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Load app.js and extract escJs function
const appJsPath = path.join(__dirname, '../js/utils.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Use a regex to extract the function body.
// function escJs(s){var e=String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"');return e.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
const escJsMatch = appJsContent.match(/function\s+escJs\s*\(s\)\s*\{[\s\S]*?\}/);
if (!escJsMatch) {
    console.error("Could not find escJs function in js/utils.js");
    process.exit(1);
}

const escJsSource = escJsMatch[0];
// Create the function in the current context
const escJs = new Function('s', `
    ${escJsSource.substring(escJsSource.indexOf('{') + 1, escJsSource.lastIndexOf('}'))}
`);

const tests = [
    {
        name: "Basic string",
        input: "Hello World",
        expected: "Hello World"
    },
    {
        name: "Empty string",
        input: "",
        expected: ""
    },
    {
        name: "Null input",
        input: null,
        expected: ""
    },
    {
        name: "Undefined input",
        input: undefined,
        expected: ""
    },
    {
        name: "Single quotes",
        input: "It's a test",
        expected: "It\\'s a test"
    },
    {
        name: "Double quotes",
        input: 'He said "Hello"',
        expected: 'He said \\&quot;Hello\\&quot;' // Note: it replaces " with \" then " with &quot;
    },
    {
        name: "Backslashes",
        input: "C:\\path\\to\\file",
        expected: "C:\\\\path\\\\to\\\\file"
    },
    {
        name: "HTML Special characters",
        input: "<b>Hello & Welcome</b>",
        expected: "&lt;b&gt;Hello &amp; Welcome&lt;/b&gt;"
    },
    {
        name: "Mixed characters",
        input: "<b>'It\\'s \"Special\"'</b>",
        expected: "&lt;b&gt;\\'It\\\\\\'s \\&quot;Special\\&quot;\\'&lt;/b&gt;"
    }
];

let failed = 0;
console.log("Running unit tests for escJs...");

tests.forEach(t => {
    try {
        const result = escJs(t.input);
        assert.strictEqual(result, t.expected);
        console.log(`✅ [PASS] ${t.name}`);
    } catch (e) {
        console.log(`❌ [FAIL] ${t.name}`);
        console.log(`   Input:    ${t.input}`);
        console.log(`   Expected: ${t.expected}`);
        console.log(`   Actual:   ${escJs(t.input)}`);
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

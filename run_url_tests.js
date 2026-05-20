const fs = require('fs');
const vm = require('vm');

const sandbox = { console: console, window: {}, URL: URL };
vm.createContext(sandbox);

let code = '';
code += 'function safeStorageGetJSON() { return {}; };\n';
code += 'function safeStorageSetJSON() { return {}; };\n';
code += 'function getOriginalMatchId() { return {}; };\n';
code += 'function openMod() { return {}; };\n';
code += 'const S = { matchMap: new Map() };\n';
code += fs.readFileSync('js/utils.js', 'utf8').replace(/export /g, '').replace(/import .*;/g, '') + '\n';
code += fs.readFileSync('js/config.js', 'utf8').replace(/export /g, '').replace(/import .*;/g, '') + '\n';

try {
    vm.runInContext(code, sandbox);

    const { resolveUrl, getDomain } = sandbox;

    console.log("resolveUrl");
    console.log(resolveUrl('/test', 'https://example.com/'));
    console.log(resolveUrl('/test', 'example.com/'));
    console.log(resolveUrl('/test', 'example.com'));
    console.log(resolveUrl('/test', 'https://example.com'));
    console.log(resolveUrl('//cdn.example.com/stream.m3u8', 'example.com'));
    console.log(resolveUrl('test.m3u8', 'https://example.com/path/to/stream/'));

    console.log("\ngetDomain");
    console.log(getDomain('https://example.com/path'));
    console.log(getDomain('example.com/path'));
    console.log(getDomain('//example.com/path'));
    console.log(getDomain('http://www.example.com/path'));
    console.log(getDomain('www.example.com/path'));
} catch (e) {
    console.error(e);
}

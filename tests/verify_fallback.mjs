import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// We can just check the generated HTML manually
import { openMod } from '../js/ui.js';
import { S } from '../js/state.js';

S.matches = [{
    id: 'test-match',
    homeTeam: 'Test Home',
    awayTeam: 'Test Away',
    league: 'TEST',
    status: 'upcoming'
}];

// Mock document for openMod to work
const html = '<div id="mdot"></div><div id="mhead"></div><div id="mbody"></div><div id="mod"></div>';
const dom = new JSDOM(html, { url: "http://localhost:8080/" });
global.document = dom.window.document;
global.window = dom.window;

openMod(S.matches[0], '#ff0000');

console.log(document.getElementById('mbody').innerHTML.substring(0, 1000));
console.log('---');
if (document.getElementById('mbody').innerHTML.includes('Footybite') && document.getElementById('mbody').innerHTML.includes('Streamonsport')) {
    console.log('Fallback links generated successfully!');
} else {
    console.log('Fallback links not found!');
}

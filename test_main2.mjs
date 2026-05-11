import fs from 'fs';
import { JSDOM } from 'jsdom';
import * as db from './js/db.js';

global.DOMParser = new JSDOM().window.DOMParser;
global.getOfficialTeamName = db.getOfficialTeamName;

async function run() {
    const scrapers = await import('./js/scrapers.js');
    let html = await (await fetch('https://www.thepwhl.com/en/schedule-25-26')).text();
    let res = scrapers.parsePWHLSchedule(html);
    console.log("Found:", res.length);
}
run();

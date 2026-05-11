import fs from 'fs';
import { JSDOM } from 'jsdom';
import * as db from './js/db.js';
import * as api from './js/api.js';

global.DOMParser = new JSDOM().window.DOMParser;
global.getOfficialTeamName = db.getOfficialTeamName;

async function run() {
    let html = await (await fetch('https://www.thepwhl.com/en/schedule-25-26')).text();
    import { parsePWHLSchedule } from './js/scrapers.js';
    let res = parsePWHLSchedule(html);
    console.log(res.length);
}
run();

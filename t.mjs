import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
for (const k of ['window','document','DOMParser','navigator','localStorage','HTMLElement'])
  Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
const db = await import('./js/db.js');
const cf = await import('./js/config.js');
console.log('— résolution de noms d\'équipes —');
for (const n of ['Pelicans','Lahti Pelicans','Ässät','Ilves','KooKoo','Frölunda HC','Davos'])
  console.log(`   ${n.padEnd(16)} -> ${db.getOfficialTeamName(n)}`);
console.log('\n— sport déduit du nom de ligue —');
for (const l of ['Champions League','Liiga','Cfb','Ncaaf','Baseball','Malmö Arena Cup'])
  console.log(`   ${l.padEnd(20)} -> ${cf.sportOfLeague(l)}`);
console.log('\n— capitalisation —');
for (const l of ['pohár primátora','ligue 1','ncaaf'])
  console.log(`   ${l.padEnd(20)} -> ${db.formatLeagueName(l)}`);

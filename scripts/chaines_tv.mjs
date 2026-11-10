#!/usr/bin/env node
/* Les chaînes de la section « Télé » (10 novembre 2026) → data/chaines.json.

   Relit la liste publique Free-TV (https://github.com/Free-TV/IPTV, chaînes gratuites en clair)
   et garde le groupe « Canada » : les flux https en HLS ou DASH, dans l'ordre de la liste
   (js/chainestv.js : `chainesDeListe`). Free-TV retire elle-même de sa liste les chaînes mortes.

   Aucune sonde ici, exprès : CBC et TVA refusent (403) une machine hors du Canada, donc une sonde
   faite depuis GitHub les écarterait à tort.

     { "genere": "<ISO>", "source": "<adresse>", "chaines": [ { "id", "nom", "url", "logo" }, … ] }

   Si la liste ne répond pas ou ne rend aucune chaîne, le fichier précédent est gardé (code 1).

   Usage : node scripts/chaines_tv.mjs [--sortie data/chaines.json] */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chainesDeListe } = await import(path.join(racine, 'js', 'chainestv.js'));

const SOURCE = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';
const GROUPE = 'Canada';
const args = process.argv.slice(2);
const i = args.indexOf('--sortie');
const SORTIE = path.resolve(racine, i >= 0 ? args[i + 1] : 'data/chaines.json');

let chaines = [];
try {
    const r = await fetch(SOURCE, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    chaines = chainesDeListe(await r.text(), GROUPE);
} catch (e) {
    console.error('  liste Free-TV illisible : ' + (e && e.message || e));
}
console.log('  télé : ' + chaines.length + ' chaînes (' + GROUPE + ')');
if (!chaines.length) {
    console.error('  aucune chaîne : data/chaines.json est gardé tel quel');
    process.exit(1);
}
fs.writeFileSync(SORTIE, JSON.stringify({ genere: new Date().toISOString(), source: SOURCE, chaines }, null, 1) + '\n');

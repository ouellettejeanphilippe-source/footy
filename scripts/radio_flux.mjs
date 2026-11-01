#!/usr/bin/env node
/* Les flux audio des stations de la fiche (1er novembre 2026) → data/radio.json.

   « Ya moyen de partir les streams tunein et cie directement ? » TuneIn donne l'adresse du flux
   d'une station (`opml.radiotime.com/Tune.ashx`), mais sans en-tête CORS : le navigateur ne peut
   pas la demander. Ce script le fait une fois par jour (workflow du calendrier) pour chaque
   station connue de js/radio.js, TuneIn et iHeartRadio, et écrit :

     { "genere": "<ISO>", "flux": { "tunein:s137385": { "url": "https://…", "type": "continu" }, … } }

   Une station sans flux https lisible n'y est pas : la fiche retombe sur le lecteur de TuneIn ou
   sur le lien. Un échec réseau d'une station ne fait pas échouer les autres ; si AUCUNE ne
   répond, le fichier précédent est gardé (code de sortie 1).

   Usage : node scripts/radio_flux.mjs [--sortie data/radio.json] */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = await import(path.join(racine, 'js', 'radio.js'));

const args = process.argv.slice(2);
const i = args.indexOf('--sortie');
const SORTIE = path.resolve(racine, i >= 0 ? args[i + 1] : 'data/radio.json');
const EN_PARALLELE = 6;

async function lire(url) {
    const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (sports-guide radio)' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
}

async function fluxDe(cle) {
    for (const url of R.adressesDuFlux(cle)) {
        try {
            const f = R.fluxDeReponse(cle, await lire(url));
            if (f) return f;
        } catch (e) { /* annuaire suivant */ }
    }
    return null;
}

const cles = R.toutesLesClesDeFlux();
const flux = {};
let repondu = 0;
for (let k = 0; k < cles.length; k += EN_PARALLELE) {
    const lot = cles.slice(k, k + EN_PARALLELE);
    const res = await Promise.all(lot.map(fluxDe));
    lot.forEach((cle, j) => { if (res[j]) { flux[cle] = res[j]; repondu++; } });
}
console.log('  radio : ' + repondu + ' flux sur ' + cles.length + ' stations');
if (!repondu) {
    console.error('  aucun flux : data/radio.json est gardé tel quel');
    process.exit(1);
}
const trie = {};
Object.keys(flux).sort().forEach((c) => { trie[c] = flux[c]; });
fs.writeFileSync(SORTIE, JSON.stringify({ genere: new Date().toISOString(), flux: trie }, null, 1) + '\n');

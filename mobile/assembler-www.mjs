/* Rassemble dans `www/` exactement ce que l'application emporte sur Android.
 *
 * Capacitor recopie TOUT le contenu de `webDir` dans les ressources de l'APK.
 * Pointer `webDir` sur la racine du depot y ferait entrer `.git`, les suites de
 * tests, la documentation, `node_modules` et le dossier `desktop/` avec son
 * Electron de 368 Mo. D'ou cette liste explicite.
 *
 * Ce qui reste volontairement dehors, et pourquoi
 * ----------------------------------------------
 * `scripts/` : les deux scrapers sont des programmes Node. Un telephone ne les
 *   lance pas, et l'application n'en a pas besoin pour fonctionner : quand
 *   `data/schedule.json` n'est pas du jour, le client interroge ESPN lui-meme
 *   (js/api.js, `apiOuCacheLocal`). Les donnees embarquees sont un instantane
 *   qui evite une page vide au premier demarrage, pas une dependance.
 *
 * `multiview-cleaner.user.js` reste, lui : l'application le propose encore
 *   depuis sa page Script, pour qui voudrait l'installer dans un navigateur.
 *   Sur Android il n'est pas injecte dans les lecteurs -- aucun navigateur
 *   mobile ne prend d'extension, et la version de bureau est celle qui le fait
 *   tourner (voir desktop/preload-userscript.js).
 *
 *   node mobile/assembler-www.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const WWW = path.join(ICI, 'www');

const FICHIERS = [
  'index.html',
  'styles.css',
  'tv.css',
  'sw.js',
  'manifest.json',
  'domains.json',
  'multiview-cleaner.user.js',
];
const DOSSIERS = ['js', 'data', 'icons'];

/* La liste d'hôtes à bloquer vit dans `mobile/`, pas à la racine du dépôt : elle ne
   sert qu'à Android. Elle passe par `www/` parce que c'est le seul chemin qui la
   dépose dans les ressources de l'APK, où le code Java la lit
   (`assets/public/blocage-hotes.txt`, voir BloqueurWebViewClient).
   Fabriquée par `node mobile/construire-blocage.mjs`. */
/* `injection-userscript.js` : le gabarit qui enveloppe multiview-cleaner.user.js pour
   l'injecter dans les lecteurs sans Tampermonkey (NettoyeurLecteurs.java). */
const FICHIERS_MOBILE = ['blocage-hotes.txt', 'injection-userscript.js'];

await fs.rm(WWW, { recursive: true, force: true });
await fs.mkdir(WWW, { recursive: true });

for (const f of FICHIERS) {
  await fs.copyFile(path.join(RACINE, f), path.join(WWW, f));
}
for (const d of DOSSIERS) {
  await fs.cp(path.join(RACINE, d), path.join(WWW, d), { recursive: true });
}
for (const f of FICHIERS_MOBILE) {
  try {
    await fs.copyFile(path.join(ICI, f), path.join(WWW, f));
  } catch {
    /* Absente : l'application marche, elle ne bloquera simplement rien. On le DIT,
       parce qu'un APK muet sur ce point ressemble à un bloqueur en panne. */
    console.warn(`ATTENTION : ${f} manque — lancez « node mobile/construire-blocage.mjs ».`);
    console.warn('           Cet APK ne bloquera aucune publicité.');
  }
}

async function peser(dossier) {
  let n = 0;
  let octets = 0;
  for (const e of await fs.readdir(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) {
      const s = await peser(p);
      n += s.n;
      octets += s.octets;
    } else {
      n += 1;
      octets += (await fs.stat(p)).size;
    }
  }
  return { n, octets };
}

const { n, octets } = await peser(WWW);
console.log(`www/ : ${n} fichiers, ${(octets / 1024 / 1024).toFixed(1)} Mo`);

for (const attendu of ['index.html', 'js/main.js', 'data/schedule.json', 'domains.json', 'multiview-cleaner.user.js', 'injection-userscript.js']) {
  try {
    await fs.access(path.join(WWW, attendu));
  } catch {
    console.error(`MANQUANT : ${attendu}`);
    process.exit(1);
  }
}

// L'instantane embarque : le dire, parce qu'un APK fabrique avec un calendrier
// d'avant-hier demarre sur une passe ESPN complete au lieu d'afficher tout de
// suite -- ce n'est pas casse, mais ce n'est pas ce qu'on voulait livrer.
const cal = JSON.parse(await fs.readFile(path.join(WWW, 'data', 'schedule.json'), 'utf8'));
const jour = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
  .format(new Date())
  .replace(/-/g, '');
console.log(
  `instantane du calendrier : ${cal.fetchDate}` +
    (cal.fetchDate === jour ? ' (aujourd hui)' : ` -- PAS du jour (${jour}) : lancez node scripts/scrape_schedule.mjs`)
);

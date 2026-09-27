/* Fabrique la liste d'hôtes à bloquer que l'APK emporte.
 *
 *   node mobile/construire-blocage.mjs
 *
 * Pourquoi une liste d'HÔTES, et pas le moteur complet
 * ---------------------------------------------------
 * La version de bureau fait tourner `@ghostery/adblocker`, qui comprend toute la
 * syntaxe d'uBlock : types de ressource, contextes, filtres cosmétiques. Sur Android
 * rien de tout cela n'est possible — aucun navigateur mobile n'injecte de script dans
 * une iframe d'origine croisée, et il n'existe pas d'API d'extension. Le seul point
 * d'accroche est `shouldInterceptRequest` de la WebView : une URL entre, on dit oui ou
 * non. Pas de contexte, pas de cosmétique.
 *
 * Ce qu'on peut donc emporter, c'est la part de ces listes qui s'exprime en un seul
 * nom d'hôte. C'est moins qu'uBlock, et il faut le dire : les emplacements vides ne
 * seront pas masqués, et une publicité servie depuis le domaine du site lui-même
 * passera. Mais la grande majorité des publicités et des traceurs vient de domaines
 * dédiés, et ceux-là tombent.
 *
 * Les LISTES sont exactement celles de la version de bureau — `fullLists` du même
 * paquet, importé ici pour que ce ne soit pas une promesse mais un fait.
 *
 * Ce qui est retenu, et ce qui est écarté
 * --------------------------------------
 *   ||exemple.com^                gardé   blocage de domaine, sans condition
 *   ||exemple.com^$third-party    gardé   un domaine tiers dédié à la publicité
 *   ||exemple.com^$script         ÉCARTÉ  ne vise qu'un type ; bloquer TOUT l'hôte
 *                                         sur cette base sur-bloquerait un CDN
 *   ||exemple.com^$domain=a.com   ÉCARTÉ  dépend de la page, qu'on ne sait pas juger
 *   @@||exemple.com^              exception : l'hôte est retiré de la liste
 *   exemple.com##.pub             ÉCARTÉ  cosmétique, impossible ici
 *
 * La prudence est volontaire. Une publicité qui passe est un désagrément ; un flux
 * vidéo bloqué par erreur est une application cassée.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fullLists } from '@ghostery/adblocker';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.join(ICI, 'blocage-hotes.txt');

/* Les options qui laissent la règle valoir pour tout l'hôte. Le reste — un type de
   ressource, un `domain=`, une négation — nous échappe, donc on n'y touche pas. */
const OPTIONS_SUES = new Set(['third-party', '3p', 'all', 'popup', 'doc', 'document']);

const REGLE = /^\|\|([a-z0-9][a-z0-9._-]*\.[a-z]{2,})\^(\$(.*))?$/i;

function hoteDeLaRegle(ligne) {
  const m = REGLE.exec(ligne);
  if (!m) return null;
  const options = (m[3] || '').trim();
  if (options) {
    const parts = options.split(',').map((o) => o.trim().toLowerCase());
    if (!parts.every((o) => OPTIONS_SUES.has(o))) return null;
  }
  return m[1].toLowerCase();
}

let lus = 0;
const bloques = new Set();
const exceptions = new Set();

for (const url of fullLists) {
  let texte;
  try {
    const r = await fetch(url);
    if (!r.ok) { console.error(`  ${r.status}  ${url}`); continue; }
    texte = await r.text();
  } catch (e) {
    console.error(`  injoignable  ${url} (${e.message})`);
    continue;
  }
  let n = 0;
  for (const brute of texte.split('\n')) {
    const ligne = brute.trim();
    lus++;
    if (!ligne || ligne[0] === '!' || ligne[0] === '[') continue;
    if (ligne.includes('##') || ligne.includes('#@#') || ligne.includes('#?#') || ligne.includes('#$#')) continue;

    if (ligne.startsWith('@@')) {
      const h = hoteDeLaRegle(ligne.slice(2));
      if (h) exceptions.add(h);
      continue;
    }
    const h = hoteDeLaRegle(ligne);
    if (h) { bloques.add(h); n++; }
  }
  console.log(`  ${String(n).padStart(6)} hôtes  ${url.split('/').slice(-2).join('/')}`);
}

/* Une exception l'emporte toujours : ces listes en posent pour les domaines qu'un
   blocage trop large casserait, et c'est exactement ce qu'on veut éviter. */
for (const h of exceptions) bloques.delete(h);

/* Les domaines dont l'application NE PEUT PAS se passer, quoi qu'en disent les listes.
   Aucun n'y figure aujourd'hui — cette barrière existe pour le jour où l'une d'elles
   ajoutera un CDN vidéo ou l'API des scores, et où l'application deviendrait muette
   sans qu'on comprenne pourquoi. */
const JAMAIS = ['espn.com', 'site.api.espn.com', 'cdn.espn.com', 'jsdelivr.net', 'cdnjs.cloudflare.com'];
const sauves = JAMAIS.filter((h) => bloques.delete(h));

const liste = [...bloques].sort();
await fs.writeFile(SORTIE, liste.join('\n') + '\n', 'utf8');

const octets = (await fs.stat(SORTIE)).size;
console.log('');
console.log(`lignes lues        : ${lus.toLocaleString('fr-CA')}`);
console.log(`exceptions (@@)    : ${exceptions.size.toLocaleString('fr-CA')}`);
if (sauves.length) console.log(`retirés d'office   : ${sauves.join(', ')}`);
console.log(`hôtes bloqués      : ${liste.length.toLocaleString('fr-CA')}`);
console.log(`fichier            : ${path.relative(ICI, SORTIE)}, ${(octets / 1024).toFixed(0)} Ko`);

if (liste.length < 5000) {
  console.error('\nTrop peu d\'hôtes : une liste a probablement échoué. On ne remplace rien.');
  process.exit(1);
}

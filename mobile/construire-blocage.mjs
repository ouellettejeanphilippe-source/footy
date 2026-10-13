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
 * Ce qui est retenu et ce qui est écarté est décrit dans scripts/listes-blocage.mjs,
 * partagé avec l'extension Chrome (extension/construire.mjs).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fullLists } from '@ghostery/adblocker';
import { construireListe } from '../scripts/listes-blocage.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.join(ICI, 'blocage-hotes.txt');

const { bloques: liste, exceptions, sauves, lus } = await construireListe(fullLists);
await fs.writeFile(SORTIE, liste.join('\n') + '\n', 'utf8');

const octets = (await fs.stat(SORTIE)).size;
console.log('');
console.log(`lignes lues        : ${lus.toLocaleString('fr-CA')}`);
console.log(`exceptions (@@)    : ${exceptions.length.toLocaleString('fr-CA')}`);
if (sauves.length) console.log(`retirés d'office   : ${sauves.join(', ')}`);
console.log(`hôtes bloqués      : ${liste.length.toLocaleString('fr-CA')}`);
console.log(`fichier            : ${path.relative(ICI, SORTIE)}, ${(octets / 1024).toFixed(0)} Ko`);

if (liste.length < 5000) {
  console.error('\nTrop peu d\'hôtes : une liste a probablement échoué. On ne remplace rien.');
  process.exit(1);
}

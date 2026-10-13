/* Fabrique ce que l'extension charge et que le dépôt ne porte pas à la main :
 *
 *   node extension/construire.mjs              nettoyeur.js et regles/blocage.json
 *   node extension/construire.mjs --script     nettoyeur.js seulement (sans réseau)
 *
 * nettoyeur.js = gabarit-nettoyeur.js + multiview-cleaner.user.js, à la marque
 * `/*__SCRIPT__*\/`. À refaire après chaque modification du script utilisateur :
 * tests/unit_extension.test.js échoue tant que les deux divergent.
 *
 * regles/blocage.json = les hôtes des listes d'uBlock (scripts/listes-blocage.mjs, les
 * mêmes que l'APK et la version de bureau), en règles `declarativeNetRequest`. Chrome
 * les applique lui-même : c'est la partie du blocage que Manifest V3 laisse entière.
 * Les listes viennent de `fullLists` de @ghostery/adblocker, installé par
 * `cd mobile && npm install`.
 *
 * Les deux fichiers sont versionnés : l'extension se charge depuis le dépôt (ou le
 * fichier .zip que l'application fabrique) sans rien construire. */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { construireListe, JAMAIS } from '../scripts/listes-blocage.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MARQUE = '/*__SCRIPT__*/';

/* Une règle porte une liste d'hôtes (`requestDomains`, sous-domaines compris). On les
   coupe en paquets : Chrome n'impose pas de plafond par règle, mais une règle de
   100 000 hôtes est plus lente à indexer que vingt-cinq de 4 000. */
const PAR_REGLE = 4000;
const TOUS_LES_TYPES = ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
  'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other'];

export function assemblerNettoyeur(gabarit, script) {
  const morceaux = gabarit.split(MARQUE);
  if (morceaux.length !== 2) throw new Error('gabarit-nettoyeur.js doit porter la marque une seule fois');
  return morceaux[0] + script + morceaux[1];
}

export function reglesDeBlocage(bloques, exceptions) {
  const regles = [];
  let id = 1;
  for (let i = 0; i < bloques.length; i += PAR_REGLE) {
    regles.push({
      id: id++,
      priority: 1,
      action: { type: 'block' },
      condition: { requestDomains: bloques.slice(i, i + PAR_REGLE), resourceTypes: TOUS_LES_TYPES }
    });
  }
  /* Un hôte bloqué couvre ses sous-domaines ; une exception des listes (ou un domaine
     dont l'application ne peut se passer) doit donc l'emporter explicitement. */
  const permis = [...new Set([...exceptions, ...JAMAIS])].sort();
  if (permis.length) {
    regles.push({
      id: id++,
      priority: 2,
      action: { type: 'allow' },
      condition: { requestDomains: permis, resourceTypes: TOUS_LES_TYPES }
    });
  }
  return regles;
}

async function principal() {
  const racine = path.join(ICI, '..');
  const gabarit = await fs.readFile(path.join(ICI, 'gabarit-nettoyeur.js'), 'utf8');
  const script = await fs.readFile(path.join(racine, 'multiview-cleaner.user.js'), 'utf8');
  await fs.writeFile(path.join(ICI, 'nettoyeur.js'), assemblerNettoyeur(gabarit, script), 'utf8');
  console.log('nettoyeur.js écrit');

  if (process.argv.includes('--script')) return;

  let fullLists;
  try {
    const exiger = createRequire(path.join(racine, 'mobile', 'package.json'));
    ({ fullLists } = await import(pathToFileURL(exiger.resolve('@ghostery/adblocker')).href));
  } catch (e) {
    console.error('@ghostery/adblocker introuvable : lancer d\'abord `cd mobile && npm install`.');
    process.exit(1);
  }
  const { bloques, exceptions, sauves } = await construireListe(fullLists);
  if (bloques.length < 5000) {
    console.error('\nTrop peu d\'hôtes : une liste a probablement échoué. On ne remplace rien.');
    process.exit(1);
  }
  const regles = reglesDeBlocage(bloques, exceptions);
  const sortie = path.join(ICI, 'regles', 'blocage.json');
  await fs.mkdir(path.dirname(sortie), { recursive: true });
  /* Une règle par ligne : un diff lisible d'une reconstruction à l'autre. */
  await fs.writeFile(sortie, '[\n' + regles.map((r) => JSON.stringify(r)).join(',\n') + '\n]\n', 'utf8');
  const octets = (await fs.stat(sortie)).size;
  console.log('');
  if (sauves.length) console.log(`retirés d'office : ${sauves.join(', ')}`);
  console.log(`hôtes bloqués    : ${bloques.length.toLocaleString('fr-CA')} en ${regles.length - 1} règles`);
  console.log(`fichier          : regles/blocage.json, ${(octets / 1024).toFixed(0)} Ko`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await principal();

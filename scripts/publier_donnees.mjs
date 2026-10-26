#!/usr/bin/env node
/* Publie les données produites sur cette machine : commit et push de data/ et de
   domains.json, pour que les appareils qui lisent le site publié (l'APK sur la télé et
   le téléphone, le navigateur) voient ce que CETTE machine a vérifié.

   « Je veux la solution la plus efficace et pérenne » (26 octobre 2026). La vérification
   des lecteurs vaut d'où elle est faite : depuis les machines de GitHub, les sites connus
   bloquent (Cloudflare, centres de données) et le verdict ne dit rien ; depuis chez
   l'utilisateur, c'est la même adresse que celle qui regarde. L'application de bureau fait
   déjà la passe complète toutes les 30 minutes ; ce script en est la quatrième étape, et
   `npm run liens -- --publier` l'appelle aussi.

   Usage : node scripts/publier_donnees.mjs [--message "…"] [--simuler]
   Code de sortie : 0 publié ou rien à publier, 1 commit impossible, 2 push impossible
   (les fichiers restent commités, à pousser plus tard). `--simuler` dit ce qu'il ferait. */
import { spawnSync } from 'child_process';
import fs from 'fs';

const args = process.argv.slice(2);
const val = (nom, dflt) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : dflt; };
const MESSAGE = val('--message', 'chore: update stream links (home)');
const SIMULER = args.includes('--simuler');

/* `git add` d'un fichier absent n'ajoute RIEN : data/tv.json n'existe qu'après une vérification. */
export const FICHIERS = ['data/streams.json', 'data/schedule.json', 'data/tv.json', 'domains.json'];
export function fichiersAPublier(existe) {
    return FICHIERS.filter((f) => existe(f));
}

const git = (...g) => spawnSync('git', g, { stdio: SIMULER ? 'pipe' : 'inherit' }).status;
const fichiers = fichiersAPublier((f) => fs.existsSync(f));
if (SIMULER) {
    console.log('simulation : git add ' + fichiers.join(' ') + ' ; git commit -m "' + MESSAGE + '" ; git pull --rebase --autostash ; git push');
    process.exit(0);
}
git('add', ...fichiers);
if (spawnSync('git', ['diff', '--cached', '--quiet']).status === 0) {
    console.log('  rien de nouveau à publier');
    process.exit(0);
}
if (git('commit', '-m', MESSAGE) !== 0) { console.log('  commit impossible'); process.exit(1); }
/* Le serveur (GitHub Actions) publie aussi : on se pose par-dessus son dernier passage.
   Un conflit sur un fichier de données se règle en gardant le nôtre, plus frais. */
if (git('pull', '--rebase', '--autostash', '-X', 'theirs') !== 0 || git('push') !== 0) {
    console.log('  push impossible : les fichiers sont commités localement, à pousser plus tard (git push)');
    process.exit(2);
}
console.log('  publié');

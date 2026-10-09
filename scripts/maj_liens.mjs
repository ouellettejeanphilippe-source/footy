/*
  Mise à jour des données À LA MAIN, sans GitHub Actions (9 octobre 2026).

  « C'est important de pouvoir le faire manuellement si GitHub chie. » Les Actions ont
  déjà cessé de tourner sans prévenir (cron mort du 20 septembre au 9 octobre 2026), et
  local/pipeline.ps1 ne marche que sous Windows. Ce script fait les mêmes étapes partout
  où Node 22 tourne :

    1. le calendrier, s'il n'est pas du jour (heure de New York) ;
    2. les liens (scripts/scrape_streams.mjs) — en entier, ou --rapide : seulement les
       pages des matchs en cours ou imminents, les autres gardant leurs liens ;
    3. la vérification des lecteurs (scripts/verify_players.mjs), si Playwright et son
       Chromium sont là — sautée avec --sans-verification ;
    4. --publier : commit et push des fichiers de données, pour que les appareils qui
       lisent le dépôt les reçoivent. Sans l'option, rien ne quitte la machine : l'app
       de bureau et un serveur local lisent directement data/.

  Usage :
    npm run liens                      # complet
    npm run liens -- --rapide          # pages des matchs dans les 3 h seulement (--horizon 180)
    npm run liens -- --rapide --horizon 90
    npm run liens -- --sans-verification --publier

  Aucune étape ne fait échouer les suivantes : un scraper muet laisse le fichier précédent
  intact (c'est écrit dans les scripts). Le code de sortie est celui de l'étape des liens.
*/
import { spawnSync } from 'child_process';
import fs from 'fs';

const args = process.argv.slice(2);
const a = (nom) => args.includes(nom);
const val = (nom, dflt) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : dflt; };
const RAPIDE = a('--rapide');
const HORIZON = val('--horizon', RAPIDE ? '180' : null);
const VERIFIER = !a('--sans-verification');
const PUBLIER = a('--publier');
const VERIF_BUDGET = val('--verif-budget-ms', RAPIDE ? '180000' : '480000');
const VERIF_TOTAL = val('--verif-total', '300');

const t0 = Date.now();
const duree = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`;
const etape = (n, titre) => console.log(`\n===== ${n}  ${titre}  (${duree()}) =====`);
const lancer = (script, extra, opts) => spawnSync(process.execPath, (opts && opts.node || []).concat(['scripts/' + script], extra || []), { stdio: 'inherit' }).status;

function jourNewYork() {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return p.replace(/-/g, '');
}

// ── 1. Calendrier ─────────────────────────────────────────────────────────────
let duJour = false;
try { duJour = JSON.parse(fs.readFileSync('data/schedule.json', 'utf8')).fetchDate === jourNewYork(); } catch (e) {}
if (duJour) etape('1/4', 'calendrier déjà du jour');
else {
    etape('1/4', 'calendrier');
    if (lancer('scrape_schedule.mjs') !== 0) console.log('  (calendrier non refait : on garde le précédent)');
}

// ── 2. Liens ──────────────────────────────────────────────────────────────────
etape('2/4', 'liens' + (HORIZON ? ` (rapide : matchs dans les ${HORIZON} min)` : ''));
const codeLiens = lancer('scrape_streams.mjs', HORIZON ? ['--horizon', String(HORIZON)] : [], { node: ['--max-old-space-size=8192'] });
if (codeLiens !== 0) console.log('  (lecture des sources en échec : les liens précédents sont conservés)');

// ── 3. Vérification ───────────────────────────────────────────────────────────
let playwright = false;
try { await import('playwright'); playwright = true; } catch (e) {}
if (!VERIFIER) etape('3/4', 'vérification sautée (--sans-verification)');
else if (!playwright) etape('3/4', 'vérification sautée : Playwright absent (npm ci, puis npx playwright install chromium)');
else {
    etape('3/4', `vérification des lecteurs (budget ${Math.round(VERIF_BUDGET / 1000)} s)`);
    lancer('verify_players.mjs', ['--budget-ms', String(VERIF_BUDGET), '--total', String(VERIF_TOTAL)]);
}

// ── 4. Publication ────────────────────────────────────────────────────────────
if (!PUBLIER) etape('4/4', 'publication : non demandée (--publier pour commiter et pousser)');
else {
    etape('4/4', 'publication (git)');
    const git = (...g) => spawnSync('git', g, { stdio: 'inherit' }).status;
    const fichiers = ['data/streams.json', 'data/schedule.json', 'domains.json'];
    git('add', ...fichiers);
    if (spawnSync('git', ['diff', '--cached', '--quiet']).status === 0) console.log('  rien de nouveau à publier');
    else if (git('commit', '-m', 'chore: update stream links (manual)') !== 0) console.log('  commit impossible');
    else if (git('pull', '--rebase', '--autostash') !== 0 || git('push') !== 0) {
        console.log('  push impossible : les fichiers sont commités localement, à pousser plus tard (git push)');
    }
}

// ── Bilan ─────────────────────────────────────────────────────────────────────
try {
    const t = JSON.parse(fs.readFileSync('data/streams.json', 'utf8'));
    const liens = (t.matches || []).reduce((n, m) => n + (m.streamLinks || []).length, 0);
    const ok = (t.sources || []).filter((s) => s.ok).map((s) => s.id);
    const ko = (t.sources || []).filter((s) => !s.ok).map((s) => s.id);
    console.log(`\n===== bilan (${duree()}) =====`);
    console.log(`${(t.matches || []).length} matchs, ${liens} liens, généré ${t.generatedAt}, vérifié ${t.verifiedAt || 'jamais'}`);
    console.log(`sources OK : ${ok.join(', ') || 'aucune'}${ko.length ? `  |  muettes : ${ko.join(', ')}` : ''}`);
} catch (e) { console.log('\n(bilan impossible : data/streams.json illisible)'); }
process.exit(codeLiens || 0);

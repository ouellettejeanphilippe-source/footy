/* Plafond de l'extraction des lecteurs (scripts/scrape_streams.mjs).

   « Le problème, c'est pas les matchs à zéro, c'est les flux non captés ou jouables dans
   le multiview. » Mesuré le 5 septembre 2026 sur le cache de production, avec la bonne
   définition (un lien joue s'il s'encadre OU si un lecteur a été résolu pour lui) :

     2152 adresses distinctes dans le cache
      700 sondées — le plafond d'alors
      577 flux non jouables, dont :
          470 JAMAIS sondés (hors plafond)
          107 réellement en échec après tentative

   Autrement dit : quatre flux muets sur cinq n'avaient jamais eu la moindre chance. On
   croyait buter sur X-Frame-Options ; on butait d'abord sur ce nombre.

   Le budget le permettait largement — même run : 700 liens en 56,8 s (415 résolus, 59 %),
   scrape complet en 3 min 58 s face à un plafond de workflow de 20 minutes.

   Ces cas verrouillent les deux propriétés qui comptent : le plafond ne doit plus être le
   facteur limitant, et l'arrêt doit être TEMPOREL — c'est le temps qui menace le
   workflow, pas le nombre de liens. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function main() {
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'scrape_streams.mjs'), 'utf8');

    // ── 1. Le plafond couvre le volume réellement observé ───────────────────
    const m = /const EXTRACT_MAX_LIENS = (\d+);/.exec(src);
    assert.ok(m, 'EXTRACT_MAX_LIENS doit exister');
    const plafond = parseInt(m[1], 10);
    assert.ok(plafond >= 2152,
        'le plafond doit couvrir les 2152 adresses distinctes relevées en production, '
        + 'sinon des flux restent muets faute d\'avoir été essayés (obtenu : ' + plafond + ')');
    ok('le plafond couvre le volume réellement observé');

    // ── 2. L'arrêt est temporel, et tient dans le workflow ──────────────────
    const b = /const EXTRACT_BUDGET_MS = ([^;]+);/.exec(src);
    assert.ok(b, 'un budget temporel doit borner l\'extraction');
    // eslint-disable-next-line no-new-func
    const budgetMs = new Function('return ' + b[1])();
    const wf = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'scrape_streams.yml'), 'utf8');
    const t = /timeout-minutes:\s*(\d+)/.exec(wf);
    assert.ok(t, 'le workflow doit déclarer un timeout');
    const timeoutMs = parseInt(t[1], 10) * 60 * 1000;
    assert.ok(budgetMs < timeoutMs,
        'le budget d\'extraction doit rester SOUS le timeout du workflow, sinon l\'exécution '
        + 'entière échoue et le cache n\'est pas publié du tout (budget ' + (budgetMs / 60000)
        + ' min, timeout ' + (timeoutMs / 60000) + ' min)');
    /* Il faut aussi de la place pour le reste : sources, pages de match, écriture, commit.
       Ce run-là prenait 3 min hors extraction. */
    assert.ok(budgetMs <= timeoutMs / 2,
        'le budget doit laisser au moins la moitié du temps au reste du scrape');
    ok('l\'arrêt est temporel et tient largement dans le timeout du workflow');

    // ── 3. La boucle respecte vraiment ce budget ────────────────────────────
    assert.ok(/if \(Date\.now\(\) - t0 > EXTRACT_BUDGET_MS\)/.test(src),
        'la boucle d\'extraction doit vérifier le budget à chaque lien');
    assert.ok(/abandonnesFauteDeTemps/.test(src),
        'les liens laissés de côté doivent être comptés, sinon un budget trop court passe inaperçu');
    ok('la boucle vérifie le budget et compte ce qu\'elle abandonne');

    // ── 4. Le compte rendu dit la vérité sur ce qui n'a pas été tenté ───────
    /* Sans cette ligne, un plafond redevenu limitant ne se verrait nulle part : c'est
       exactement ainsi que 1452 adresses sont restées invisibles pendant des semaines. */
    assert.ok(/adresses distinctes au total/.test(src),
        'le journal doit rappeler le nombre total d\'adresses, pour qu\'un plafond limitant se voie');
    ok('le journal expose le total, pour qu\'un plafond limitant redevienne visible');

    console.log(`unit_extractbudget: ${n} groupes de tests OK`);
    process.exit(0);
}

main();

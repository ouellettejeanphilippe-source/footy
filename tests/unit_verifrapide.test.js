/* La vérification des lecteurs s'arrête dès que son verdict est acquis (js/playability.js,
   `verdictAcquis`, scripts/verify_players.mjs).

   27 octobre 2026, « revoir les github actions pour les rendre plus efficaces et rapides ».
   Passage de 22 h 49 : chaque lecteur était regardé 12 s sans exception, 86 cibles sur 103
   en 312 s, 17 laissées de côté. Ici : (1) la décision, pure, ne conclut tôt que là où
   `verdictFromObservation` ne peut plus changer ; (2) le script l'applique, au pas d'une
   seconde, et ne revient jamais à une attente fixe. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function main() {
    const P = await import('../js/playability.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── 1. Une vidéo prête, hauteur stable : acquis ──────────────────────────
    assert.strictEqual(P.verdictAcquis({ videoReady: true, hauteur: 720 }, 5000, 2500), true);
    assert.strictEqual(P.verdictAcquis({ videoReady: true, hauteur: 720 }, 5000, 500), false,
        'la hauteur vient de bouger : un flux adaptatif monte encore');
    assert.strictEqual(P.verdictAcquis({ videoReady: true, hauteur: 0 }, 5000, 5000), false,
        'prête sans hauteur connue : on attend de la connaître');
    assert.strictEqual(P.verdictAcquis({ videoReady: true, hauteur: 720 }, 1500, 1500), false,
        'jamais avant l\'attente minimale');
    ok('une vidéo prête dont la hauteur ne bouge plus conclut, pas avant');

    // ── 2. Le cadre du lecteur en erreur, rien demandé : acquis ──────────────
    assert.strictEqual(P.verdictAcquis({ cadreEnErreur: true, mediaRequests: 0 }, 3000, 3000), true);
    assert.strictEqual(P.verdictAcquis({ cadreEnErreur: true, mediaRequests: 2 }, 6000, 6000), false,
        'de la vidéo a été demandée : on laisse le temps d\'arriver');
    ok('un document de lecteur qui n\'a pas chargé conclut');

    // ── 3. Tout le reste attend la durée entière ─────────────────────────────
    assert.strictEqual(P.verdictAcquis({}, 11000, 11000), false, 'rien vu : « none » exige d\'attendre');
    assert.strictEqual(P.verdictAcquis({ mediaOk: 5 }, 8000, 8000), false, 'des segments sans vidéo prête : pas encore');
    assert.strictEqual(P.verdictAcquis(null, 5000, 5000), false);
    ok('l\'absence de preuve n\'est jamais une conclusion anticipée');

    // ── 4. Les cas qui concluent donnent le verdict qu'ils auraient eu à 12 s ─
    for (const o of [{ videoReady: true, hauteur: 1080, mediaOk: 0 }, { videoReady: true, hauteur: 360, mediaOk: 9 }]) {
        assert.ok(P.verdictAcquis(o, 4000, 3000));
        assert.strictEqual(P.verdictFromObservation(o), 'plays');
    }
    const erreur = { cadreEnErreur: true, frameError: true, mediaRequests: 0, mediaOk: 0 };
    assert.ok(P.verdictAcquis(erreur, 4000, 4000));
    assert.strictEqual(P.verdictFromObservation(erreur), 'blocked');
    ok('conclure tôt ne change aucun verdict');

    // ── 5. Le script s'en sert, au pas d'une seconde ─────────────────────────
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'verify_players.mjs'), 'utf8');
    assert.ok(/play\.verdictAcquis\(/.test(src), 'le script applique la décision');
    assert.ok(!/waitForTimeout\(WATCH_MS\)/.test(src), 'plus d\'attente fixe de toute la durée');
    assert.ok(/Math\.min\(1000,/.test(src), 'au pas d\'une seconde');
    assert.ok(/f\.parentFrame\(\) === page\.mainFrame\(\)/.test(src), 'le cadre en erreur est celui du lecteur, pas une publicité à l\'intérieur');
    ok('verify_players.mjs regarde par pas d\'une seconde et s\'arrête quand le verdict est acquis');

    console.log(`unit_verifrapide: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

/* La vérification des lecteurs éprouve la page SOUS LE SCRIPT de nettoyage
   (scripts/verify_players.mjs, js/playability.js CRITERE_VERDICT 3).

   28 octobre 2026, « ya moyen d'extraire des pages de liens pour vérifier si on garde le
   vidéo avec le script et cie ». Dans une tuile, la page du site tourne sous
   multiview-cleaner.user.js, qui lance la vidéo sans clic ; la sonde chargeait la page
   brute. Mesuré contre un serveur local (Chromium, ancien et nouveau mode) : une page dont
   la vidéo attend un clic (preload=none, calque « PLAY ») valait « none » brute et « plays »
   sous le script. Ici, sans navigateur : on lit le script de vérification comme du texte, et
   on vérifie que le script de nettoyage porte bien le signal que la sonde relève. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function main() {
    const P = await import('../js/playability.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    const verif = lire('scripts/verify_players.mjs');
    const script = lire('multiview-cleaner.user.js');

    // ── 1. Le critère a changé : le registre de la page brute ne vaut plus ───
    assert.ok(P.CRITERE_VERDICT >= 3, 'v3 : la page est éprouvée sous le script');
    ok('le critère du verdict est passé à la v3 (le registre repart de zéro)');

    // ── 2. La sonde injecte le script dans chaque cadre ──────────────────────
    assert.ok(/addInitScript\(SCRIPT_NETTOYEUR\)/.test(verif), 'le script est injecté au début de chaque document');
    assert.ok(/multiview-cleaner\.user\.js/.test(verif), 'c\'est le script de l\'application, pas une copie');
    assert.ok(/--sans-script/.test(verif), 'l\'ancienne sonde reste disponible pour comparer');
    ok('verify_players.mjs injecte multiview-cleaner.user.js (et garde --sans-script)');

    // ── 3. Le signal relevé est celui que l'application lit ──────────────────
    assert.ok(/__mv==="video_state"&&d\.playing/.test(verif), 'la page de sonde relève video_state / playing');
    assert.ok(/window\.top\.postMessage\(\{ __mv: 'video_state', playing: joue/.test(script),
        'le script envoie bien ce message à la fenêtre du dessus');
    assert.ok(/obs\.scriptJoue/.test(verif) && /parScript/.test(verif), 'et le journal le compte');
    ok('la sonde relève le video_state du script, comme la pastille de l\'application');

    // ── 4. Le script ne fait rien dans la page de sonde elle-même ────────────
    assert.ok(/window\.self === window\.top/.test(script), 'garde « seulement dans un cadre » du script');
    ok('le script reste muet dans la page de sonde (window.self === window.top)');

    console.log(`unit_verifscript: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

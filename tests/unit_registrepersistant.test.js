/* Ce que la vérification apprend doit SURVIVRE au scrape (js/playability.js :
   reporterVerifications ; scripts/scrape_streams.mjs). Sans réseau.

   « Tous les matchs, aucune source ne marche » (20 septembre 2026).

   Le registre de jouabilité était effacé toutes les 30 minutes. `scrape_streams.mjs`
   réécrivait `data/streams.json` sans `hostPlay` — le mot n'apparaissait pas une seule
   fois dans le fichier — donc `verify_players.mjs` repartait d'un registre VIDE à chaque
   passage et n'y laissait que les ~81 observations de son propre budget.

   Ce n'était pas un détail de comptabilité. `playabilityScore` n'ose rétrograder un hôte
   qu'à partir de `tested >= 3` : avec un ou deux essais par hôte, un CDN mort restait
   « jamais éprouvé » (score 1) et passait DEVANT un hôte réellement mesuré. Relevé le
   jour même sur le cache publié : `embed.st` à 1/1 alors que son manifeste répondait
   HTTP 500 — en accès isolé comme en rafale, donc pas une limite par IP. L'application
   le remettait en tête à chaque passage.

   Ce que ce test verrouille :
     - le registre par hôte traverse les passages, et un hôte mort finit par être vu
       comme tel (c'est LE test qui aurait vu le problème) ;
     - les verdicts par lien se reportent aussi, mais périment : un hôte se répare ;
     - une observation fraîche prime toujours sur une observation reportée ;
     - le script de scrape republie bien `hostPlay` au lieu de le laisser tomber. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function main() {
    const P = await import('../js/playability.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const T0 = Date.parse('2026-09-20T18:00:00.000Z');
    const iso = (ms) => new Date(ms).toISOString();

    // ── 1. Le défaut, reproduit sur le registre ──────────────────────────────
    /* Un hôte éprouvé trois fois sans jamais jouer doit passer DERRIÈRE un inconnu.
       Tant que le registre est remis à zéro, il n'atteint jamais ce seuil. */
    const mort = { url: 'https://mort.test/p' };
    const inconnu = { url: 'https://inconnu.test/p' };
    assert.strictEqual(P.playabilityScore(mort, { 'mort.test': { tested: 1, plays: 0 } }), 1,
        'à un seul essai, un hôte mort est encore « jamais éprouvé » — exactement embed.st à 1/1');
    assert.strictEqual(P.playabilityScore(inconnu, {}), 1, 'et l\'inconnu vaut pareil : rien ne les départage');
    assert.strictEqual(P.playabilityScore(mort, { 'mort.test': { tested: 3, plays: 0 } }), 0,
        'à trois essais seulement, il tombe SOUS l\'inconnu — c\'est le seuil que le registre effacé n\'atteignait jamais');
    ok('un hôte mort n\'est reconnu qu\'à partir de trois essais : le registre doit donc s\'accumuler');

    // ── 2. Le registre traverse les passages ────────────────────────────────
    /* Trois passages successifs, un essai chacun, comme le budget réel le permet. */
    let registre = {};
    for (let passage = 0; passage < 3; passage++) {
        registre = P.mergeLedgers(registre, {});           // ce que fait verify_players au départ
        P.recordObservation(registre, 'mort.test', 'none'); // son observation du passage
    }
    assert.strictEqual(registre['mort.test'].tested, 3, 'trois passages, trois essais cumulés');
    assert.strictEqual(P.playabilityScore(mort, registre), 0, 'et l\'hôte est enfin reconnu comme ne jouant pas');
    ok('trois passages suffisent à démasquer un CDN mort — à condition de ne pas effacer entre-temps');

    // ── 3. Les verdicts par lien se reportent ───────────────────────────────
    const precedent = {
        matches: [{ streamLinks: [
            { url: 'https://a.test/1', verified: 'plays', verifiedAt: iso(T0 - 60 * 60 * 1000) },
            { url: 'https://b.test/1', verified: 'blocked', verifiedAt: iso(T0 - 30 * 60 * 1000) },
            { url: 'https://vieux.test/1', verified: 'blocked', verifiedAt: iso(T0 - 20 * 60 * 60 * 1000) },
            { url: 'https://sansdate.test/1', verified: 'none' },
        ] }]
    };
    const frais = [{ streamLinks: [
        { url: 'https://a.test/1' },
        { url: 'https://b.test/1' },
        { url: 'https://vieux.test/1' },
        { url: 'https://sansdate.test/1' },
        { url: 'https://nouveau.test/1' },
        { url: 'https://a.test/1', verified: 'none', verifiedAt: iso(T0) },
    ] }];
    const repris = P.reporterVerifications(frais, precedent, T0);
    const L = frais[0].streamLinks;
    assert.strictEqual(repris, 2, 'deux liens seulement gardent leur verdict');
    assert.strictEqual(L[0].verified, 'plays', 'un verdict d\'il y a une heure est repris');
    assert.strictEqual(L[1].verified, 'blocked', 'un refus de cadre aussi');
    assert.strictEqual(L[2].verified, undefined,
        'mais pas un verdict de vingt heures : un hôte se répare, on ne condamne personne à vie');
    assert.strictEqual(L[3].verified, undefined, 'ni un verdict sans date, qu\'on ne peut pas dater');
    assert.strictEqual(L[4].verified, undefined, 'un lien jamais vu reste à éprouver');
    assert.strictEqual(L[5].verified, 'none', 'et une observation FRAÎCHE n\'est jamais écrasée par une reprise');
    ok('les verdicts par lien se reportent, périment, et cèdent devant une mesure fraîche');

    // ── 4. Aucune donnée : pas d'exception ──────────────────────────────────
    assert.strictEqual(P.reporterVerifications([], null, T0), 0, 'premier passage : rien à reporter');
    assert.strictEqual(P.reporterVerifications(null, null), 0);
    assert.strictEqual(P.reporterVerifications([{ streamLinks: null }], { matches: [{}] }, T0), 0);
    assert.strictEqual(P.reporterVerifications(frais, { matches: null }, T0), 0);
    ok('un cache absent ou biscornu ne lève pas d\'exception');

    // ── 5. Le script republie bien ce qu'il relit ───────────────────────────
    /* Le défaut était une ABSENCE : `hostPlay` n'apparaissait nulle part dans le script.
       Un test qui lit le fichier comme du texte est le seul à voir une absence — le même
       procédé que `unit_scriptsserveur` et `unit_workflowliens`. */
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'scrape_streams.mjs'), 'utf8');
    assert.ok(/out\.hostPlay\s*=\s*\(precedent && precedent\.hostPlay\) \|\| \{\}/.test(src),
        'le scrape republie le registre par hôte au lieu de le laisser tomber');
    assert.ok(/play\.reporterVerifications\(out\.matches, precedent\)/.test(src),
        'et reporte les verdicts par lien');
    assert.ok(/import\('\.\.\/js\/playability\.js'\)/.test(src), 'le module est bien importé');
    /* Le fichier n'est lu qu'UNE fois : deux lectures, et celle du repli partiel
       retomberait sur un objet différent de celui qui porte le registre. */
    assert.strictEqual(src.split("readFileSync('data/streams.json'").length - 1, 1,
        'le cache précédent est lu une seule fois, et partagé');
    ok('le script de scrape porte bien le report, et ne relit pas le cache deux fois');

    // ── 6. verify_players repart de ce qui a été republié ───────────────────
    const vsrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'verify_players.mjs'), 'utf8');
    assert.ok(/mergeLedgers\(data\.hostPlay \|\| \{\}, \{\}\)/.test(vsrc),
        'la vérification part du registre publié — qui n\'est plus vide');
    assert.ok(/data\.hostPlay = ledger/.test(vsrc), 'et le réécrit enrichi');
    ok('la boucle est fermée : le scrape reporte, la vérification enrichit');

    console.log(`unit_registrepersistant: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

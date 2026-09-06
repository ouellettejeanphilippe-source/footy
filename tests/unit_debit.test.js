/* Débit et définition réels d'un flux (js/debit.js).

   « Moyen d'avoir le débit dans la liste des feeds ? » (6 septembre 2026). La liste
   affichait la qualité ANNONCÉE par la source — « HD », « 1080p », parfois un « 3500 kbps »
   recopié d'un libellé. C'est du déclaratif, et souvent faux : des liens marqués « HD » ne
   jouaient pas du tout, et deux « SD » du même match n'avaient rien à voir l'un avec
   l'autre.

   Le script utilisateur, lui, est dans le cadre. Il rapporte deux choses qu'il ne faut pas
   confondre : la DÉFINITION, lue sur l'élément <video>, toujours exacte ; et le DÉBIT en
   octets réellement transférés, qui n'est PAS toujours mesurable — `transferSize` d'une
   ressource d'origine croisée vaut 0 tant que le serveur n'envoie pas
   `Timing-Allow-Origin`, ce que beaucoup de CDN omettent.

   D'où la règle que ces tests verrouillent : on affiche ce qui a été mesuré, et rien
   d'autre. Pas de chiffre inventé, même approximatif. */
const assert = require('assert');

async function main() {
    const D = await import('../js/debit.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── 1. Le débit se calcule sur les octets réellement transférés ─────────
    const seg = (o, t) => ({ transferSize: o, startTime: t });
    // 6,25 Mo en 10 s = 5 000 kb/s
    assert.strictEqual(D.debitDepuisEntrees([seg(6250000, 0)], 10000, 5000), 5000);
    assert.strictEqual(D.debitDepuisEntrees([seg(3125000, 0), seg(3125000, 1000)], 10000, 5000), 5000, 'les segments s\'additionnent');
    // hors fenêtre : ignoré
    assert.strictEqual(D.debitDepuisEntrees([seg(6250000, 0)], 10000, 50000), 0, 'un segment trop vieux ne compte plus');
    assert.strictEqual(D.debitDepuisEntrees([{ encodedBodySize: 6250000, startTime: 0 }], 10000, 5000), 5000, 'encodedBodySize prend le relais');
    ok('le débit vient des octets transférés, dans la fenêtre voulue');

    // ── 2. Rien de mesurable : zéro, pas une estimation ─────────────────────
    /* C'est le cas d'un CDN sans Timing-Allow-Origin : les tailles valent 0. Inventer un
       chiffre serait exactement le défaut qu'on vient de corriger sur les faux flux. */
    assert.strictEqual(D.debitDepuisEntrees([seg(0, 0), seg(0, 1000)], 10000, 5000), 0);
    assert.strictEqual(D.debitDepuisEntrees([], 10000, 5000), 0);
    assert.strictEqual(D.debitDepuisEntrees(null, 10000, 5000), 0);
    assert.strictEqual(D.formaterDebit(0), '', 'zéro ne s\'affiche pas');
    assert.strictEqual(D.formaterDebit(null), '');
    ok('quand rien n\'est mesurable, on ne dit rien');

    // ── 3. Mise en forme lisible ────────────────────────────────────────────
    assert.strictEqual(D.formaterDebit(5200), '5,2 Mb/s');
    assert.strictEqual(D.formaterDebit(820), '820 kb/s');
    assert.strictEqual(D.formaterDefinition(1920, 1080), '1080p');
    assert.strictEqual(D.formaterDefinition(1280, 720), '720p');
    assert.strictEqual(D.formaterDefinition(640, 360), '360p');
    assert.strictEqual(D.formaterDefinition(0, 0), '', 'pas d\'image, pas de définition');
    assert.strictEqual(D.formaterMesure({ w: 1920, h: 1080, kbps: 5200 }), '1080p · 5,2 Mb/s');
    assert.strictEqual(D.formaterMesure({ w: 1920, h: 1080, kbps: 0 }), '1080p', 'la définition seule quand le débit n\'est pas mesurable');
    assert.strictEqual(D.formaterMesure({ w: 0, h: 0, kbps: 5200 }), '5,2 Mb/s');
    assert.strictEqual(D.formaterMesure(null), '');
    ok('mise en forme : définition, débit, ou les deux');

    // ── 4. Le registre garde la dernière mesure, par flux ───────────────────
    const T = 1800000000000;
    const U = 'https://embed.st/embed/admin/ppv-arsenal-vs-chelsea/1';
    let reg = D.noterMesure({}, U, { kbps: 5200, w: 1920, h: 1080 }, T);
    assert.strictEqual(D.mesurePour(reg, U, T + 1000).kbps, 5200);
    reg = D.noterMesure(reg, U, { kbps: 2600, w: 1280, h: 720 }, T + 60000);
    assert.strictEqual(D.mesurePour(reg, U, T + 60000).kbps, 2600, 'un flux change de palier : la dernière mesure gagne');
    assert.strictEqual(D.mesurePour(reg, U, T + D.TTL_MESURE_MS + 60001), null, 'périmée après le TTL');
    assert.strictEqual(D.mesurePour(reg, 'https://autre.test/x', T), null, 'flux inconnu : rien');
    ok('registre par flux : dernière mesure, et péremption');

    // ── 5. Une fenêtre sans octets n'efface pas ce qu'on savait ─────────────
    /* Entre deux segments, ou quand le CDN masque les tailles par intermittence, le débit
       tombe à 0. Effacer la mesure connue ferait clignoter la liste pour rien. */
    let reg2 = D.noterMesure({}, U, { kbps: 5200, w: 1920, h: 1080 }, T);
    reg2 = D.noterMesure(reg2, U, { kbps: 0, w: 1920, h: 1080 }, T + 5000);
    assert.strictEqual(D.mesurePour(reg2, U, T + 5000).kbps, 5200, 'le débit connu survit à une fenêtre vide');
    assert.strictEqual(D.mesurePour(reg2, U, T + 5000).h, 1080);
    let reg3 = D.noterMesure({}, U, { kbps: 0, w: 0, h: 0 }, T);
    assert.strictEqual(D.mesurePour(reg3, U, T), null, 'une mesure entièrement vide n\'est pas inscrite');
    ok('une fenêtre sans mesure n\'efface pas la précédente');

    console.log(`unit_debit: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

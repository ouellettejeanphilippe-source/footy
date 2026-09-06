/* Jouabilité observée (js/playability.js) et classement des liens (sortFluxLinks).

   Pendant des semaines, la tuile ouvrait d'abord le lien dont l'adresse « faisait bien »
   (qualité annoncée, nom du site) — et presque rien ne jouait. Ces cas verrouillent le
   nouvel ordre : le choix de l'utilisateur, puis ce qui a été OBSERVÉ en train de jouer,
   puis seulement la forme du lien. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement']) {
        Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
    }
    const P = await import('../js/playability.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── 1. Verdict d'une observation ────────────────────────────────────────
    assert.strictEqual(P.verdictFromObservation({ mediaRequests: 3 }), 'plays', 'du trafic vidéo : ça joue');
    assert.strictEqual(P.verdictFromObservation({ videoReady: true }), 'plays', 'un <video> avec des données : ça joue');
    assert.strictEqual(P.verdictFromObservation({ frameError: true }), 'blocked', 'cadre refusé');
    assert.strictEqual(P.verdictFromObservation({ status: 403 }), 'blocked', 'hôte mort');
    assert.strictEqual(P.verdictFromObservation({ status: 200 }), 'none', 'chargé, rien ne joue');
    assert.strictEqual(P.verdictFromObservation(null), 'none');
    assert.strictEqual(P.verdictFromObservation({ mediaRequests: 1, frameError: true }), 'plays', 'la vidéo vue prime sur un cadre secondaire en erreur');
    ok('verdict : plays / blocked / none');

    // ── 2. Ce que la tuile charge vraiment ──────────────────────────────────
    assert.strictEqual(P.tileTarget({ url: 'https://a.test/page', topLevel: true, playerUrl: 'https://p.test/embed' }), 'https://p.test/embed', 'page refusée : le lecteur extrait');
    assert.strictEqual(P.tileTarget({ url: 'https://a.test/page', playerUrl: 'https://p.test/embed' }), 'https://a.test/page', 'page qui s\'encadre : la page');
    assert.strictEqual(P.tileTarget(null), '');
    assert.strictEqual(P.hostOfUrl('https://www.p.test/x'), 'p.test');
    assert.strictEqual(P.hostOfUrl('pas une adresse'), '');
    ok('tileTarget suit la décision de fallbackToIframe');

    // ── 3. Registre par hôte ────────────────────────────────────────────────
    let ledger = {};
    P.recordObservation(ledger, 'p.test', 'plays');
    P.recordObservation(ledger, 'p.test', 'none');
    P.recordObservation(ledger, 'mort.test', 'blocked');
    assert.deepStrictEqual(ledger['p.test'], { tested: 2, plays: 1 });
    assert.deepStrictEqual(ledger['mort.test'], { tested: 1, plays: 0 });
    for (let i = 0; i < 60; i++) P.recordObservation(ledger, 'p.test', 'plays', 40);
    assert.ok(ledger['p.test'].tested <= 40, 'au-delà du plafond, les compteurs sont divisés (obtenu : ' + ledger['p.test'].tested + ')');
    const fusion = P.mergeLedgers({ a: { tested: 2, plays: 1 } }, { a: { tested: 1, plays: 1 }, b: { tested: 1, plays: 0 } });
    assert.deepStrictEqual(fusion, { a: { tested: 3, plays: 2 }, b: { tested: 1, plays: 0 } });
    ok('registre : cumul, plafond, fusion serveur + navigateur');

    // ── 4. Score de jouabilité ──────────────────────────────────────────────
    const L = {
        joue: { url: 'https://a.test/1', verified: 'plays' },
        bloque: { url: 'https://b.test/1', verified: 'blocked' },
        rien: { url: 'https://c.test/1', verified: 'none' },
        inconnu: { url: 'https://d.test/1' },
        hoteBon: { url: 'https://e.test/1' },
        hoteMort: { url: 'https://f.test/1' }
    };
    const reg = { 'e.test': { tested: 6, plays: 5 }, 'f.test': { tested: 4, plays: 0 } };
    assert.strictEqual(P.playabilityScore(L.joue, reg), 3);
    assert.strictEqual(P.playabilityScore(L.hoteBon, reg), 2, 'hôte qui joue le plus souvent');
    assert.strictEqual(P.playabilityScore(L.inconnu, reg), 1, 'jamais éprouvé : entre les deux');
    assert.strictEqual(P.playabilityScore(L.rien, reg), 0);
    assert.strictEqual(P.playabilityScore(L.hoteMort, reg), 0, 'hôte éprouvé qui ne joue jamais');
    assert.strictEqual(P.playabilityScore(L.bloque, reg), -1);
    assert.strictEqual(P.playabilityScore({ url: 'https://e.test/2' }, { 'e.test': { tested: 2, plays: 2 } }), 1, 'moins de trois essais : on ne conclut pas');
    ok('score : observé > hôte fiable > inconnu > rien > bloqué');

    // ── 5. Choix des cibles d'un passage ────────────────────────────────────
    const lk = (h, i) => ({ url: 'https://' + h + '/' + i });
    const matches = [
        { rank: 2, streamLinks: [lk('x.test', 1)] },
        { rank: 0, streamLinks: [lk('a.test', 1), lk('a.test', 2), lk('b.test', 1), lk('c.test', 1), lk('d.test', 1)] },
        { rank: 1, streamLinks: [lk('a.test', 3), lk('b.test', 2)] },
        { rank: 0, streamLinks: [] },
        { rank: 0, streamLinks: [{ url: 'https://p.test/page', topLevel: true, playerUrl: 'https://lecteur.test/e' }] }
    ];
    const cibles = P.pickTargets(matches, { perMatch: 3, perHost: 2, total: 10 });
    assert.strictEqual(cibles[0].matchIndex, 1, 'les matchs en direct d\'abord');
    const duLive = cibles.filter((c) => c.matchIndex === 1);
    assert.strictEqual(duLive.length, 3, 'au plus trois liens par match');
    assert.deepStrictEqual(duLive.map((c) => c.host), ['a.test', 'b.test', 'c.test'], 'des hôtes distincts par match');
    assert.ok(cibles.some((c) => c.target === 'https://lecteur.test/e'), 'la cible est ce que la tuile charge (le lecteur extrait)');
    assert.strictEqual(cibles.filter((c) => c.host === 'a.test').length, 2, 'au plus deux essais par hôte sur le passage');
    assert.strictEqual(cibles[cibles.length - 1].matchIndex, 0, 'le reste en dernier');
    assert.deepStrictEqual(P.pickTargets([], {}), []);
    ok('pickTargets : en direct d\'abord, hôtes distincts, plafond par hôte');

    // ── 6. Source suivante ──────────────────────────────────────────────────
    const liens = [lk('a.test', 1), lk('b.test', 1), lk('c.test', 1)];
    assert.strictEqual(P.nextLinkAfter(liens, 'https://a.test/1').url, 'https://b.test/1');
    assert.strictEqual(P.nextLinkAfter(liens, 'https://c.test/1').url, 'https://a.test/1', 'revient au début');
    assert.strictEqual(P.nextLinkAfter(liens, 'https://inconnu.test/').url, 'https://a.test/1', 'adresse inconnue : le premier');
    assert.strictEqual(P.nextLinkAfter([liens[0]], 'https://a.test/1'), null, 'un seul lien : rien d\'autre');
    ok('nextLinkAfter : cycle sur les liens du match');

    // ── 7. sortFluxLinks : l'observé passe avant la forme ───────────────────
    const C = await import('../js/config.js');
    globalThis.window.hostPlayLedger = { 'fiable.test': { tested: 5, plays: 5 }, 'mort.test': { tested: 5, plays: 0 } };
    const tri = C.sortFluxLinks([
        { name: 'HD 1080p', url: 'https://mort.test/1', quality: '1080p' },
        { name: 'SD', url: 'https://fiable.test/1' },
        { name: 'Vu jouer', url: 'https://autre.test/1', verified: 'plays' },
        { name: 'Bloqué', url: 'https://bloque.test/1', verified: 'blocked' },
        { name: 'Inconnu', url: 'https://inconnu.test/1' }
    ]);
    assert.deepStrictEqual(tri.map((l) => l.name), ['Vu jouer', 'SD', 'Inconnu', 'HD 1080p', 'Bloqué'],
        'observé > hôte fiable > inconnu > hôte mort (même « 1080p ») > bloqué (obtenu : ' + tri.map((l) => l.name).join(' > ') + ')');
    C.notePlayability({ url: 'https://inconnu.test/1' }, 'plays');
    C.notePlayability({ url: 'https://inconnu.test/1' }, 'plays');
    C.notePlayability({ url: 'https://inconnu.test/1' }, 'plays');
    assert.strictEqual(C.playLedger()['inconnu.test'].plays, 3, 'le registre local du navigateur compte');
    assert.strictEqual(P.playabilityScore({ url: 'https://inconnu.test/1' }, C.playLedger()), 2, 'trois lectures vues par le navigateur : l\'hôte devient fiable');
    const tri2 = C.sortFluxLinks([{ name: 'HD', url: 'https://mort.test/1', quality: '1080p' }, { name: 'Inconnu', url: 'https://inconnu.test/1' }]);
    assert.strictEqual(tri2[0].name, 'Inconnu', 'un hôte vu jouer passe devant un hôte mort, quelle que soit la qualité annoncée');
    ok('sortFluxLinks : l\'observation prime sur la qualité annoncée');

    console.log(`unit_playability: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

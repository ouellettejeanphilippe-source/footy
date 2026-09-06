/* Décor et publicité déguisés en lecteurs (js/match.js).

   « Fais une règle qui les pogne tous sans pogner de faux streams. »

   Mesuré sur le cache du 6 septembre 2026 à 17 h 44 — 410 matchs, 1 876 liens : la médiane
   des matchs pourvus était de UN seul lien, et pour beaucoup ce lien unique était le même
   pour tout le monde. Quatre adresses portaient à elles seules 132 liens :

       74 matchs  dcbbwymp1bhlf.cloudfront.net/?wbbcd=1244494   bandeau de footybite
       35 matchs  hai8g.com/4/8553101                           régie, format /4/NNNN
       16 matchs  omg10.com/4/9020608//
        7 matchs  hai8g.com/4/11695852

   Ouvrir une de ces fiches affichait « 1 flux » et menait à une page de publicité.

   Le partage seul ne prouve rien : de vraies chaînes sont légitimement partagées — « NHL
   Network » sert cinq rencontres de hockey, le flux Sky Sports F1 sert les séances d'un
   même week-end. Ce qui trahit le décor, c'est de traverser les SPORTS. Vérifié sur ces
   données : la règle écarte 7 adresses (138 liens) et garde les neuf chaînes légitimes. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    w.__NO_AUTOSTART__ = true;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }
    const M = await import('../js/match.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    const lien = (url) => ({ url: url, name: 'Lecteur' });
    const BANDEAU = 'https://dcbbwymp1bhlf.cloudfront.net/?wbbcd=1244494';
    const REGIE = 'https://hai8g.com/4/8553101';
    const CHAINE_NHL = 'https://cdnlivetv.is/api/v1/channels/player/?name=nhl+network';
    const F1 = 'https://embedsports.me/fia-f1/sky-sports-f1-sky-f1-stream-1';

    /* Cas réels du cache, reproduits : le bandeau de footybite traverse huit familles de
       sport ; la régie neuf ; les chaînes légitimes restent dans la leur. */
    const matchs = [
        { league: 'La Liga', streamLinks: [lien(BANDEAU), lien('https://vrai.test/valence-barcelone')] },
        { league: 'Cricket', streamLinks: [lien(BANDEAU), lien(REGIE)] },
        { league: 'MLB', streamLinks: [lien(REGIE)] },
        { league: 'Tennis', streamLinks: [lien(REGIE)] },
        { league: 'NHL', streamLinks: [lien(CHAINE_NHL)] },
        { league: 'LHJMQ', streamLinks: [lien(CHAINE_NHL)] },
        { league: 'F1', streamLinks: [lien(F1)] },
        { league: 'Motorsport', streamLinks: [lien(F1)] }
    ];

    // ── 1. Le décor est reconnu, les vraies chaînes sont épargnées ───────────
    const ecartees = M.adressesNonSpecifiques(matchs);
    assert.ok(ecartees[BANDEAU], 'le bandeau de footybite traverse les sports : écarté');
    assert.ok(ecartees[REGIE], 'la régie aussi');
    assert.ok(!ecartees[CHAINE_NHL], 'NHL Network reste dans le hockey : gardé');
    assert.ok(!ecartees[F1], 'F1 et Motorsport sont la même famille : gardé');
    assert.ok(!ecartees['https://vrai.test/valence-barcelone'], 'un lecteur propre à un match est gardé');
    ok('une adresse qui traverse les sports est du décor, une chaîne d\'un seul sport non');

    // ── 2. Le retrait laisse les matchs dans leur vrai état ─────────────────
    const retires = M.retirerLiensDeDecor(matchs, ecartees);
    assert.strictEqual(retires, 5, 'cinq liens de décor retirés : ' + retires);
    assert.deepStrictEqual(matchs[0].streamLinks.map((l) => l.url), ['https://vrai.test/valence-barcelone']);
    assert.deepStrictEqual(matchs[1].streamLinks, [], 'une fiche qui n\'avait que du décor montre son vrai état : vide');
    assert.strictEqual(matchs[4].streamLinks.length, 1, 'le hockey garde sa chaîne');
    assert.strictEqual(matchs[6].streamLinks.length, 1, 'la F1 garde la sienne');
    ok('les liens de décor sont retirés, les vrais restent');

    // ── 3. « other » ne suffit pas à condamner ──────────────────────────────
    /* `other` est le fourre-tout des ligues qu'on ne reconnaît pas : deux libellés inconnus
       ne prouvent pas qu'une adresse traverse les sports. */
    const flou = [
        { league: 'Ligue Inconnue A', streamLinks: [lien('https://x.test/a')] },
        { league: 'Premier League', streamLinks: [lien('https://x.test/a')] }
    ];
    assert.ok(!M.adressesNonSpecifiques(flou)['https://x.test/a'], 'un sport inconnu face à un sport connu ne condamne pas');
    ok('une ligue non reconnue ne suffit pas à écarter une adresse');

    // ── 4. Un lien « Page du match » n'est pas concerné ──────────────────────
    /* Ces liens sont déjà marqués `topLevel` et s'ouvrent dans un onglet : ils sont
       normalement partagés par tous les matchs d'un même site. */
    const replis = [
        { league: 'MLB', streamLinks: [{ url: 'https://site.test/', name: 'Page du match', topLevel: true }] },
        { league: 'Premier League', streamLinks: [{ url: 'https://site.test/', name: 'Page du match', topLevel: true }] }
    ];
    assert.ok(!M.adressesNonSpecifiques(replis)['https://site.test/'], 'un repli déjà marqué n\'est pas du décor à retirer');
    ok('les liens « Page du match » ne sont pas concernés');

    // ── 5. Rien à faire sans données ────────────────────────────────────────
    assert.deepStrictEqual(M.adressesNonSpecifiques([]), {});
    assert.deepStrictEqual(M.adressesNonSpecifiques(null), {});
    assert.strictEqual(M.retirerLiensDeDecor(null, {}), 0);
    assert.strictEqual(M.retirerLiensDeDecor([{ league: 'MLB' }], {}), 0, 'un match sans liens ne casse rien');
    ok('aucune donnée, aucun effet');

    // ── 6. Les zones de régie, reconnues à leur forme ───────────────────────
    /* Le retrait du décor juge sur les données : il faut voir l'adresse se répandre. Après
       sa mise en service, douze liens de régie restaient — vus une ou deux fois seulement
       dans l'heure, donc sans preuve. Ceux-là se reconnaissent sans données : répertoire
       numérique court, identifiant numérique long, pas un seul mot dans le chemin. C'est le
       format de zone des régies ; aucun lecteur ne s'adresse ainsi.

       Vérifié sur les 2 479 adresses distinctes de trois relevés du cache : la forme
       reconnaît exactement les cinq zones observées, et aucun vrai lecteur. */
    const S = await import('../js/scrapers.js');
    assert.strictEqual(S.isJunkStreamPath('https://hai8g.com/4/8553101'), true);
    assert.strictEqual(S.isJunkStreamPath('https://hai8g.com/4/11690714'), true);
    assert.strictEqual(S.isJunkStreamPath('https://omg10.com/4/9020608/'), true);
    assert.strictEqual(S.isJunkStreamPath('https://omg10.com/4/9020608//'), true, 'barres finales en trop');

    /* Un vrai lecteur porte toujours un mot dans son chemin. */
    assert.strictEqual(S.isJunkStreamPath('https://embed.st/embed/admin/ppv-arsenal-vs-chelsea/1'), false);
    assert.strictEqual(S.isJunkStreamPath('https://embedsports.me/nfl/nfl-network-stream-1'), false);
    assert.strictEqual(S.isJunkStreamPath('https://ytstreams.club/YT155/embed/10.html'), false);
    assert.strictEqual(S.isJunkStreamPath('https://emb.apl503.me/player/live.php?id=266037'), false);
    assert.strictEqual(S.isJunkStreamPath('https://live.totalsporteki.st/Everton-vs-Manchester-United/72601'), false,
        'un identifiant numérique précédé du nom du match reste un lecteur');
    assert.strictEqual(S.isJunkStreamPath('https://cdn.test/live/12345'), false, 'un mot suffit à disculper');
    assert.strictEqual(S.isJunkStreamPath('pas-une-url'), false);
    ok('les zones de régie sont reconnues à leur forme, sans toucher aux vrais lecteurs');

    console.log(`unit_decor: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

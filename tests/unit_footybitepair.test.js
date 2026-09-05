/* Appariement des matchs Footybite : les DEUX équipes, toujours (jsdom, sans réseau).

   Signalé le 5 septembre 2026 : « les liens s'ajoutent vraiment pas aux matchs », puis
   « un match en direct devrait avoir 5 à 50 liens, surtout au foot ». Mesuré le même
   jour sur la vraie page d'accueil de footybite : 118 des 180 matchs (66 %) sortaient
   du parseur SANS équipe visiteuse — « Nottingham Forest vs  », « Lens vs  ».

   Cause : la ligne du tableau livre ses libellés dans l'ordre [domicile, état, visiteur]
   (« Nottingham Forest », « Match Started », « Tottenham Hotspur »), alors que le
   parseur prenait pour titre tout ce qui PRÉCÈDE l'état — donc le domicile seul. Le
   JSON-LD qui rattrapait le nom complet ne couvre que 60 des 180 matchs.

   Conséquence directe sur l'appariement : un match sans équipe visiteuse ne peut être
   rapproché ni de la grille officielle ni des autres sources, donc il ne reçoit jamais
   leurs liens — et il s'affiche à moitié vide.

   Deux filets, testés ici : le libellé qui SUIT l'état, et surtout l'adresse du match
   (/game/<domicile>-vs-<visiteur>-<id>), seule partie de la page qui ne bouge pas quand
   le site refait sa mise en page. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement']) {
        Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
    }
    const scrapers = await import('../js/scrapers.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── 1. L'adresse du match porte les deux équipes ────────────────────────
    const t = scrapers.teamsFromFootybiteSlug;
    assert.deepStrictEqual(t('/game/nottingham-forest-vs-tottenham-hotspur-9629186469'),
        { home: 'nottingham forest', away: 'tottenham hotspur' });
    assert.deepStrictEqual(t('https://footybite.bid/game/le-havre-vs-brest-4138757356'),
        { home: 'le havre', away: 'brest' });
    assert.deepStrictEqual(t('/game/brighton-and-hove-albion-vs-leeds-united-8490575656'),
        { home: 'brighton and hove albion', away: 'leeds united' });
    ok('teamsFromFootybiteSlug lit les deux équipes dans l\'adresse');

    // ── 2. Événement à un seul nom : pas d'équipe visiteuse inventée ────────
    assert.deepStrictEqual(t('/game/ufc-fight-night-287-2854686793'),
        { home: 'ufc fight night 287', away: '' }, 'un événement sans « -vs- » n\'a pas d\'adversaire');
    assert.deepStrictEqual(t('/game/italian-grand-prix-qualifying-5340541908'),
        { home: 'italian grand prix qualifying', away: '' });
    assert.deepStrictEqual(t(''), { home: '', away: '' }, 'entrée vide tolérée');
    assert.deepStrictEqual(t(null), { home: '', away: '' }, 'entrée nulle tolérée');
    ok('événements à un seul nom et entrées vides : rien n\'est inventé');

    // ── 3. Le parseur complet : ordre [domicile, état, visiteur] ────────────
    /* Reproduction du vrai format Next.js de footybite : la ligne est décrite dans le
       payload « flight », et son état s'intercale ENTRE les deux équipes. */
    const ligne = (href, dom_, etat, vis) =>
        '{"href":"' + href + '","className":"match-row grid","children":['
        + '{"children":"' + dom_ + '"},{"children":"' + etat + '"},{"children":"' + vis + '"},{"children":"Live Streams"}]}';
    const payload = '["$","section","Premier League",{}]' + ligne(
        '/game/nottingham-forest-vs-tottenham-hotspur-9629186469', 'Nottingham Forest', 'Match Started', 'Tottenham Hotspur');
    const html = '<html><body><script>self.__next_f.push([1,"' + payload.replace(/"/g, '\\"') + '"])</script></body></html>';

    const list = scrapers.parseFootybite(html);
    assert.strictEqual(list.length, 1, 'la ligne de match est bien lue');
    assert.ok(/nottingham forest/i.test(list[0].homeTeam), 'équipe à domicile lue : ' + list[0].homeTeam);
    assert.ok(list[0].awayTeam && /tottenham/i.test(list[0].awayTeam),
        'l\'équipe visiteuse suit l\'état dans la ligne : elle ne doit plus être perdue (obtenu : "' + list[0].awayTeam + '")');
    assert.strictEqual(list[0].status, 'live', '« Match Started » vaut un match en cours');
    ok('parseFootybite garde l\'équipe visiteuse placée après l\'état');

    // ── 3 bis. Le libellé de la ligne prime sur l'adresse, pour le NOM ──────
    /* Les deux filets ne font pas le même travail : l'adresse dit QUELLES équipes
       jouent, la ligne dit COMMENT elles s'écrivent. Sur une équipe absente de la base,
       le slug ne rend que « radnicki 1923 » là où la ligne rend « Radnički 1923 ».
       Sans cette assertion, retirer la lecture d'après-état passerait inaperçu : le
       repli sur l'adresse rattraperait le match, mais en dégradant son nom. */
    const ligneSerbe = '["$","section","Serbian Super Liga",{}]' + ligne(
        '/game/macva-sabac-vs-radnicki-1923-1234567890', 'Mačva Šabac', 'Match Started', 'Radnički 1923');
    const serbe = scrapers.parseFootybite(
        '<html><body><script>self.__next_f.push([1,"' + ligneSerbe.replace(/"/g, '\\"') + '"])</script></body></html>');
    assert.strictEqual(serbe.length, 1);
    assert.strictEqual(serbe[0].awayTeam, 'Radnički 1923',
        'le libellé de la ligne doit primer sur le slug, qui n\'a ni accents ni majuscules (obtenu : "' + serbe[0].awayTeam + '")');
    ok('le nom vient de la ligne quand elle l\'a ; l\'adresse ne sert qu\'en dernier recours');

    // ── 4. Repli sur l'adresse quand la ligne ne donne QUE le domicile ──────
    /* Le cas qui cassait : aucun libellé après l'état (mise en page changée, chargement
       paresseux non résolu, JSON-LD absent). L'adresse doit suffire. */
    const payload2 = '["$","section","Ligue 1",{}]'
        + '{"href":"/game/le-havre-vs-brest-4138757356","className":"match-row grid","children":['
        + '{"children":"Le Havre"},{"children":"Match Started"}]}';
    const html2 = '<html><body><script>self.__next_f.push([1,"' + payload2.replace(/"/g, '\\"') + '"])</script></body></html>';
    const list2 = scrapers.parseFootybite(html2);
    assert.strictEqual(list2.length, 1);
    assert.ok(list2[0].awayTeam && /brest/i.test(list2[0].awayTeam),
        'sans libellé exploitable, l\'adresse /game/le-havre-vs-brest-… doit fournir Brest (obtenu : "' + list2[0].awayTeam + '")');
    ok('repli sur l\'adresse du match quand la ligne ne livre que le domicile');

    // ── 5. Le libellé du bouton n'est jamais pris pour une équipe ───────────
    const payload3 = '["$","section","WWE",{}]'
        + '{"href":"/game/money-in-the-bank-9146777596","className":"match-row grid","children":['
        + '{"children":"Money In The Bank"},{"children":"Match Started"},{"children":"Live Streams"}]}';
    const html3 = '<html><body><script>self.__next_f.push([1,"' + payload3.replace(/"/g, '\\"') + '"])</script></body></html>';
    const list3 = scrapers.parseFootybite(html3);
    assert.strictEqual(list3.length, 1);
    assert.strictEqual(list3[0].awayTeam, '',
        '« Live Streams » est le bouton, pas un adversaire (obtenu : "' + list3[0].awayTeam + '")');
    ok('le libellé du bouton n\'est jamais pris pour une équipe');

    console.log(`unit_footybitepair: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

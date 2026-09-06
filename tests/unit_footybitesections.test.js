/* Sections Footybite : la ligue d'une ligne se lit par sa PARENTÉ, pas par sa position.

   Relevé sur la page réelle du 6 septembre 2026 : 120 matchs sur 178 sortaient du parseur
   étiquetés « MLB » — la MLS, La Liga, l'USL, le football universitaire… Le payload
   « flight » de Next.js est une suite de lignes « <id>:<contenu> » qui se référencent par
   "$L<id>" ; une section n'écrit en clair que ses premières lignes, les autres sont des
   références résolues APRÈS toutes les sections. « La dernière section rencontrée avant la
   ligne » était donc, pour toutes ces lignes, la dernière section du fichier : « mlb ».

   Conséquence en chaîne : le sport étant faux, `getOfficialTeamName` résolvait les villes
   universitaires en clubs professionnels (« Texas » → « Texas Rangers », « Memphis » →
   « Memphis Grizzlies »), et le match ne retrouvait plus jamais son homologue dans la
   grille ESPN. */
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

    const ligne = (href, dom_, etat, vis) =>
        '{"href":"' + href + '","className":"match-row grid","children":['
        + '{"children":"' + dom_ + '"},{"children":"' + etat + '"},{"children":"' + vis + '"},{"children":"Live Streams"}]}';
    const html = (payload) =>
        '<html><body><script>self.__next_f.push([1,"' + payload.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"])</script></body></html>';

    // ── 1. La structure réelle : sections référencées, lignes différées ─────
    /* Racine → sections (par référence) → lignes de match (en clair pour la première,
       par référence pour les suivantes). Les lignes différées viennent toutes APRÈS la
       dernière section, « mlb ». */
    const payload = [
        '3:["$","div",null,{"children":[["$","$L2c"],["$","$L30"],["$","$L3f"]]}]',
        '2c:["$","section","mls",{"children":[' + ligne('/game/austin-fc-vs-san-jose-earthquakes-1', 'Austin FC', 'Match Started', 'San Jose Earthquakes') + ',["$","$L47"]]}]',
        '30:["$","section","ncaa-division-1-football",{"children":[["$","$L59"],["$","$L5a"]]}]',
        '3f:["$","section","mlb",{"children":[' + ligne('/game/colorado-rockies-vs-st-louis-cardinals-4', 'Colorado Rockies', 'Match Started', 'St. Louis Cardinals') + ']}]',
        '47:' + ligne('/game/toronto-fc-vs-chicago-fire-5', 'Toronto FC', 'Starts in 2hr:10min', 'Chicago Fire'),
        '59:' + ligne('/game/texas-vs-texas-state-2', 'Texas', 'Match Started', 'Texas State'),
        '5a:' + ligne('/game/memphis-vs-arkansas-state-3', 'Memphis', 'Match Started', 'Arkansas State'),
    ].join('\n');
    const list = scrapers.parseFootybite(html(payload));
    const par = (slug) => list.find((m) => m.matchUrl.indexOf(slug) >= 0);
    assert.strictEqual(list.length, 5, 'les cinq lignes sont lues (obtenu : ' + list.length + ')');

    const austin = par('austin-fc'), toronto = par('toronto-fc'), texas = par('texas-vs'), memphis = par('memphis'), rockies = par('colorado-rockies');
    assert.strictEqual(austin.league, 'MLS', 'ligne en clair dans sa section : résolue sur place');
    assert.strictEqual(rockies.league, 'MLB', 'la vraie section MLB reste MLB');
    ok('les lignes écrites en clair dans leur section gardent leur ligue');

    assert.strictEqual(toronto.league, 'MLS',
        'ligne différée référencée par la section « mls » : doit être MLS, pas la dernière section du fichier (obtenu : ' + toronto.league + ')');
    assert.ok(/ncaa/i.test(texas.league),
        'ligne différée référencée par la section universitaire (obtenu : ' + texas.league + ')');
    assert.ok(/ncaa/i.test(memphis.league), 'seconde ligne différée de la même section (obtenu : ' + memphis.league + ')');
    ok('les lignes différées remontent à la section qui les référence');

    // ── 2. Le sport de la section gouverne la résolution des noms ───────────
    assert.strictEqual(texas.homeTeam, 'Texas', '« Texas » en football universitaire n\'est pas les Texas Rangers (obtenu : ' + texas.homeTeam + ')');
    assert.strictEqual(memphis.homeTeam, 'Memphis', '« Memphis » en football universitaire n\'est pas les Grizzlies (obtenu : ' + memphis.homeTeam + ')');
    assert.strictEqual(texas.awayTeam, 'Texas State');
    ok('en compétition universitaire, aucune ville n\'est promue en club professionnel');

    // ── 3. officialTeamNameForLeague, directement ───────────────────────────
    const r = scrapers.officialTeamNameForLeague;
    assert.strictEqual(r('Texas', 'ncaa division 1 football'), 'Texas');
    assert.strictEqual(r('Florida', 'ncaa division 1 football'), 'Florida');
    assert.strictEqual(r('San Antonio', 'american usl championship'), 'San Antonio',
        'en football (soccer), « San Antonio » ne devient pas les Spurs (NBA)');
    assert.ok(/rangers/i.test(r('Texas', 'mlb')), 'en MLB, « Texas » reste résolu en Texas Rangers (obtenu : ' + r('Texas', 'mlb') + ')');
    assert.ok(/athletics/i.test(r('Athletics', 'mlb')), 'la résolution ordinaire survit dans le bon sport');
    assert.strictEqual(r('', 'mlb'), '', 'entrée vide tolérée');
    assert.strictEqual(r(null, 'mlb'), null, 'entrée nulle tolérée');
    ok('officialTeamNameForLeague : refus hors sport, résolution dans le sport');

    // ── 4. Sans aucune section : comportement d'avant (repli « Football ») ──
    const seul = scrapers.parseFootybite(html(ligne('/game/le-havre-vs-brest-1', 'Le Havre', 'Match Started', 'Brest')));
    assert.strictEqual(seul.length, 1);
    assert.strictEqual(seul[0].league, 'Football');
    ok('sans section, le repli reste « Football »');

    // ── 5. Une référence orpheline ne fait pas boucler la résolution ────────
    const orphelin = scrapers.parseFootybite(html('99:' + ligne('/game/a-vs-b-1', 'A', 'Match Started', 'B')));
    assert.strictEqual(orphelin.length, 1, 'une ligne différée que personne ne référence est quand même lue');
    ok('une ligne différée sans parent est lue, sans boucle ni exception');

    console.log(`unit_footybitesections: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

/* Les séances d'un Grand Prix reçoivent leurs liens (js/match.js : seanceDeCourse,
   memeSeanceDeCourse, debugMatchPair, mergeMatches). Sans réseau.

   « Moins de liens ce matin, dont zéro f1 » (12 septembre 2026).

   Relevé le jour même, dans `data/schedule.json` et `data/streams.json`, sur le Grand Prix
   d'Espagne — cinq séances côté calendrier, autant de libellés côté sources :

       ESPN         « Tag Heuer Spanish Grand Prix » / « FP3 »   0 lien
       liveleagues  « FIA 2026: Spain GP Practice 3 »            1 lien
       ESPN         « Tag Heuer Spanish Grand Prix » / « Qual »  0 lien
       liveleagues  « FIA 2026: Spain GP Qualifying »            1 lien
       streamed     « Spanish Grand Prix Practice 1 »           46 liens

   Rien ne s'appariait : le raccourci « Racing/Event » comparait « tagheuerspanishfp3 » à
   « fia2026spaingppractice3 ». Les trois obstacles étaient dans les données — le PARRAIN
   de l'épreuve (Tag Heuer, qui change à chaque Grand Prix), le gentilé contre le pays
   (« Spanish » / « Spain »), l'abréviation de la séance (« FP3 », « Qual »).

   Ce que ce test verrouille, autant que l'appariement : ce qu'il REFUSE. Les essais libres
   ne doivent pas recevoir les liens des qualifications (l'ancien raccourci réduisait les
   cinq séances au nom du pays, et la première carte de la liste ramassait tout), la F3 du
   même week-end sur le même circuit ne doit rien déverser sur la F1, et un match de
   football nommé « Racing Santander » n'est pas une course. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }

    const match = await import('../js/match.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    /* Les libellés RÉELS du 12 septembre 2026, tels qu'ils sont dans les deux caches. */
    const espn = (away, date) => ({ league: 'F1', homeTeam: 'Tag Heuer Spanish Grand Prix', awayTeam: away, matchDate: date, status: 'upcoming', streamLinks: [] });
    const source = (league, home, date, liens) => ({
        league, homeTeam: home, awayTeam: '', matchDate: date, status: 'upcoming',
        streamLinks: (liens || []).map((u) => ({ url: u, name: u }))
    });

    // ── 1. Lecture d'un libellé : série, épreuve, séance ─────────────────────
    assert.deepStrictEqual(match.seanceDeCourse('Tag Heuer Spanish Grand Prix FP3', 'F1'),
        { serie: 'f1', epreuve: 'spain', seance: 'practice3' },
        'le parrain passe, le gentilé devient le pays, « FP3 » est la séance');
    assert.deepStrictEqual(match.seanceDeCourse('FIA 2026: Spain GP Qualifying', 'Fia F1'),
        { serie: 'f1', epreuve: 'spain', seance: 'qualifying' });
    assert.deepStrictEqual(match.seanceDeCourse('Spanish Grand Prix Practice 1', 'Motor'),
        { serie: '', epreuve: 'spain', seance: 'practice1' },
        'une ligne « Motor » n\'annonce aucune série : inconnue, pas fausse');
    assert.deepStrictEqual(match.seanceDeCourse('FIA Formula 3 2026: Spain F3GP Feature Race', 'Fia F3'),
        { serie: 'f3', epreuve: 'spain', seance: 'race' },
        '« F3GP » est bien lu comme la F3 sur le GP');
    ok('lecture : série, épreuve et séance des libellés réels');

    // ── 2. Ce qui n'est PAS une séance d'épreuve rend null ───────────────────
    assert.strictEqual(match.seanceDeCourse('Racing Santander Alavés', 'Soccer'), null,
        'un club nommé « Racing » ne court pas');
    assert.strictEqual(match.seanceDeCourse('Sunday Nights Main Event', 'WWE'), null,
        'un gala de catch n\'est pas une séance');
    assert.strictEqual(match.seanceDeCourse('F1 Main Race', 'F1'), null,
        'aucun mot ne désigne l\'épreuve : on ne sait pas laquelle, donc on ne décide pas');
    assert.strictEqual(match.seanceDeCourse('Main Race Qualifying', 'Motorsport'), null,
        'deux séances et aucune épreuve : le libellé fourre-tout de buffstreams');
    ok('null quand le libellé n\'identifie pas une séance (le doute laisse l\'ancien chemin)');

    // ── 3. Le cas de la panne : les liens arrivent sur la bonne séance ───────
    let r = match.debugMatchPair(espn('FP3', '2026-09-12'), source('Fia F1', 'FIA 2026: Spain GP Practice 3', '2026-09-12'));
    assert.strictEqual(r.isMatch, true, 'FP3 et « Practice 3 » sont la même séance : ' + r.reason);
    r = match.debugMatchPair(espn('Qual', '2026-09-12'), source('Fia F1', 'FIA 2026: Spain GP Qualifying', '2026-09-12'));
    assert.strictEqual(r.isMatch, true, '« Qual » et « Qualifying » aussi : ' + r.reason);
    r = match.debugMatchPair(espn('FP1', '2026-09-11'), source('Motor', 'Spanish Grand Prix Practice 1', '2026-09-11'));
    assert.strictEqual(r.isMatch, true, 'les 46 liens des essais 1 trouvent leur carte : ' + r.reason);
    ok('appariement des séances réelles du Grand Prix d\'Espagne');

    // ── 4. Une séance ne prend pas les liens d'une autre ─────────────────────
    assert.strictEqual(match.isMatchPair(espn('FP3', '2026-09-12'), source('Fia F1', 'FIA 2026: Spain GP Qualifying', '2026-09-12')), false,
        'les essais libres 3 ne reçoivent pas les qualifications du même jour');
    assert.strictEqual(match.isMatchPair(espn('Qual', '2026-09-12'), source('Fia F1', 'FIA 2026: Spain GP Practice 3', '2026-09-12')), false,
        'et l\'inverse non plus');
    assert.strictEqual(match.isMatchPair(espn('Race', '2026-09-13'), source('Motor', 'Spanish Grand Prix Practice 1', '2026-09-11')), false,
        'la course du dimanche ne prend pas les essais du vendredi (le raccourci répondait avant le contrôle des dates)');
    ok('séances distinctes : chacune garde ses liens');

    // ── 5. Deux séries sur le même circuit le même week-end ─────────────────
    assert.strictEqual(match.isMatchPair(espn('Race', '2026-09-13'), source('Fia F3', 'FIA Formula 3 2026: Spain F3GP Feature Race', '2026-09-13')), false,
        'la F3 de Barcelone ne déverse pas ses liens sur la F1');
    assert.strictEqual(match.isMatchPair(espn('Race', '2026-09-13'), source('Motor', 'Moto2 2026 Gran Premio di San Marino Race', '2026-09-13')), false,
        'ni le Moto2 de Saint-Marin');
    assert.strictEqual(match.isMatchPair(
        source('Fia F1', 'FIA 2026: Spain GP Race', '2026-09-13'),
        source('Motor', 'Spanish Grand Prix Race', '2026-09-13')), true,
        'une série inconnue (« Motor ») ne contredit pas la F1 : elle s\'apparie');
    ok('séries : la F3 et le Moto2 restent dehors, l\'étiquette muette entre');

    // ── 6. Deux épreuves différentes ─────────────────────────────────────────
    assert.strictEqual(match.isMatchPair(
        { league: 'F1', homeTeam: 'Qatar Airways Spanish Grand Prix', awayTeam: 'Race', matchDate: '2026-09-13' },
        { league: 'F1', homeTeam: 'Qatar Grand Prix', awayTeam: 'Race', matchDate: '2026-09-13' }), false,
        'un parrain qui porte un nom de pays (Qatar Airways) n\'invente pas une épreuve au Qatar');
    assert.strictEqual(match.isMatchPair(
        { league: 'F1', homeTeam: 'Italian Grand Prix', awayTeam: '', matchDate: '2026-09-13' },
        { league: 'Motorsport', homeTeam: 'Spanish Grand Prix Race', awayTeam: '', matchDate: '2026-09-13' }), false,
        'Monza et Barcelone sont deux épreuves');
    ok('épreuves : le pays lu devant « Grand Prix », pas celui du parrain');

    // ── 7. Les essais non numérotés d'une source ─────────────────────────────
    assert.strictEqual(match.isMatchPair(espn('FP1', '2026-09-11'), source('Fia F1', 'FIA 2026: Spain GP Practice Session', '2026-09-11')), true,
        'une source qui ne numérote pas ses essais parle de ceux qui se courent');
    assert.strictEqual(match.isMatchPair(espn('Qual', '2026-09-12'), source('Fia F1', 'FIA 2026: Spain GP Practice Session', '2026-09-12')), false,
        'mais des essais ne sont pas des qualifications');
    ok('essais non numérotés : acceptés face à un numéro, refusés face à une autre séance');

    // ── 8. Rien d'autre ne bouge ─────────────────────────────────────────────
    const foot = (h, a) => ({ league: 'La Liga', homeTeam: h, awayTeam: a, matchDate: '2026-09-12', status: 'live', streamLinks: [] });
    assert.strictEqual(match.isMatchPair(espn('Race', '2026-09-12'), foot('Racing Santander', 'Alavés')), false,
        'un Grand Prix n\'avale pas un match de football');
    assert.strictEqual(match.isMatchPair(
        { league: 'WWE', homeTeam: 'Sunday Nights Main Event', awayTeam: '', matchDate: '2026-09-12' },
        { league: 'F1', homeTeam: 'F1 Main Race', awayTeam: '', matchDate: '2026-09-12' }), false,
        '« main » ne suffit toujours pas à apparier un gala et une course');
    assert.strictEqual(match.isMatchPair(
        { league: 'F1', homeTeam: 'Italian Grand Prix', awayTeam: '', matchDate: '2026-09-12' },
        { league: 'F1', homeTeam: 'F1 Italian Grand Prix Race', awayTeam: '', matchDate: '2026-09-12' }), true,
        'le cas de septembre : un Grand Prix nu s\'apparie à sa course');
    ok('football, catch et Grand Prix nu : comportement inchangé');

    // ── 9. De bout en bout : la grille du jour reçoit ses liens ──────────────
    /* La grille telle qu'ESPN la livre (cinq séances), puis les entrées des sources
       telles qu'elles étaient dans le cache du 12 septembre. Chaque séance doit finir
       avec SES liens, et la grille ne doit pas gagner de carte fantôme. */
    let grille = [espn('FP1', '2026-09-11'), espn('FP2', '2026-09-11'), espn('FP3', '2026-09-12'), espn('Qual', '2026-09-12'), espn('Race', '2026-09-13')];
    grille = match.mergeMatches(grille, [
        source('Motor', 'Spanish Grand Prix Practice 1', '2026-09-11', ['https://e.test/fp1']),
        source('Fia F1', 'FIA 2026: Spain GP Practice 3', '2026-09-12', ['https://e.test/fp3']),
        source('Fia F1', 'FIA 2026: Spain GP Qualifying', '2026-09-12', ['https://e.test/qual']),
        source('Fia F1', 'FIA 2026: Spain GP Pre Race', '2026-09-13', ['https://e.test/race'])
    ]);
    assert.strictEqual(grille.length, 5, 'aucune carte fantôme : les quatre entrées ont trouvé leur séance');
    const liens = (away) => grille.find((m) => m.awayTeam === away).streamLinks.map((l) => l.url);
    assert.deepStrictEqual(liens('FP1'), ['https://e.test/fp1']);
    assert.deepStrictEqual(liens('FP2'), [], 'les essais 2 n\'ont pas volé ceux des essais 1');
    assert.deepStrictEqual(liens('FP3'), ['https://e.test/fp3']);
    assert.deepStrictEqual(liens('Qual'), ['https://e.test/qual']);
    assert.deepStrictEqual(liens('Race'), ['https://e.test/race'], 'l\'avant-course est le flux de la course');
    ok('de bout en bout : cinq séances, quatre liens, chacun sur sa carte');

    console.log(`unit_seancecourse: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

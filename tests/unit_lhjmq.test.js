/* La LHJMQ dans le guide (js/lhjmq.js).

   « Mettre LHJMQ dans le guide » (12 octobre 2026). ESPN n'a pas la LHJMQ : ses matchs
   n'apparaissaient qu'à travers OnHockey, comme flux sans fiche, et plus du tout depuis
   qu'OnHockey refuse le serveur. La ligue publie son tableau des matchs sur HockeyTech
   (`view=scorebar`) : c'est ce que lisent chl.ca/lhjmq et l'application de la ligue.

   Les matchs ci-dessous sont des extraits VERBATIM de la réponse du 12 octobre 2026
   (champs utiles seulement) : un match fini la veille, quatre en cours dont un dans les
   Maritimes (-03:00), et un à venir. Ils couvrent les deux équipes qui manquaient à la
   base (Val-d'Or, Newfoundland) et la ligature de « Phœnix ».

   Pas de réseau, pas d'horloge : les dates gardées sont passées en argument. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

const SCOREBAR = { SiteKit: { Scorebar: [
    {"ID":"32848","GameDateISO8601":"2026-10-11T15:00:00-04:00","GameStatus":"4","GameStatusString":"Final","GameStatusStringLong":"Final","Period":"3","HomeCity":"Gatineau","HomeNickname":"Olympiques","HomeGoals":"3","HomeLogo":"https://assets.leaguestat.com/lhjmq/logos/50x50/12.png","VisitorCity":"Val-d'Or","VisitorNickname":"Foreurs","VisitorGoals":"6","VisitorLogo":"https://assets.leaguestat.com/lhjmq/logos/15.png","venue_name":"Centre Slush Puppie"},
    {"ID":"32689","GameDateISO8601":"2026-10-12T14:00:00-04:00","GameStatus":"2","GameStatusString":"16:51 3rd","GameStatusStringLong":"16:51 3rd","Period":"3","HomeCity":"Blainville-Boisbriand","HomeNickname":"Armada","HomeGoals":"5","HomeLogo":"https://assets.leaguestat.com/lhjmq/logos/19.png","VisitorCity":"Victoriaville","VisitorNickname":"Tigres","VisitorGoals":"2","VisitorLogo":"https://assets.leaguestat.com/lhjmq/logos/17.png","venue_name":"Centre Excellence Sports Rousseau"},
    {"ID":"33075","GameDateISO8601":"2026-10-12T15:00:00-03:00","GameStatus":"2","GameStatusString":"02:52 3rd","GameStatusStringLong":"02:52 3rd","Period":"3","HomeCity":"Saint John","HomeNickname":"Sea Dogs","HomeGoals":"3","HomeLogo":"https://assets.leaguestat.com/lhjmq/logos/50x50/8_214.png","VisitorCity":"Drummondville","VisitorNickname":"Voltigeurs","VisitorGoals":"3","VisitorLogo":"https://assets.leaguestat.com/lhjmq/logos/50x50/14.png","venue_name":"TD Station"},
    {"ID":"33139","GameDateISO8601":"2026-10-12T14:00:00-04:00","GameStatus":"2","GameStatusString":"11:11 3rd","GameStatusStringLong":"11:11 3rd","Period":"3","HomeCity":"Sherbrooke","HomeNickname":"Phœnix","HomeGoals":"2","HomeLogo":"https://assets.leaguestat.com/lhjmq/logos/50x50/60.png","VisitorCity":"Cape Breton","VisitorNickname":"Eagles","VisitorGoals":"2","VisitorLogo":"https://assets.leaguestat.com/lhjmq/logos/3.png","venue_name":"Palais des Sports Léopold-Drolet"},
    {"ID":"33102","GameDateISO8601":"2026-10-12T16:00:00-04:00","GameStatus":"2","GameStatusString":"17:07 1st","GameStatusStringLong":"17:07 1st","Period":"1","HomeCity":"Shawinigan","HomeNickname":"Cataractes","HomeGoals":"0","HomeLogo":"https://assets.leaguestat.com/lhjmq/logos/13.png","VisitorCity":"Newfoundland","VisitorNickname":"Regiment","VisitorGoals":"0","VisitorLogo":"https://assets.leaguestat.com/lhjmq/logos/2_214.png","venue_name":"Centre Gervais Auto"},
    {"ID":"32751","GameDateISO8601":"2026-10-14T19:00:00-03:00","GameStatus":"1","GameStatusString":"7:00PM","GameStatusStringLong":"7:00 PM ADT","Period":"1","HomeCity":"Charlottetown","HomeNickname":"Islanders","HomeGoals":"0","HomeLogo":"https://assets.leaguestat.com/lhjmq/logos/7.png","VisitorCity":"Val-d'Or","VisitorNickname":"Foreurs","VisitorGoals":"0","VisitorLogo":"https://assets.leaguestat.com/lhjmq/logos/15.png","venue_name":"Eastlink Centre"}
] } };

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
    for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
        Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
    }
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    dom.window.__NO_AUTOSTART__ = true;

    const scrapers = await import('../js/scrapers.js');
    const db = await import('../js/db.js');
    const match = await import('../js/match.js');
    const L = await import('../js/lhjmq.js');

    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── 1. Lecture : heure de New York, statut, pointage ────────────────────
    const tous = L.lireScorebarLhjmq(JSON.stringify(SCOREBAR));
    assert.strictEqual(tous.length, 6);
    const jour = L.lireScorebarLhjmq(SCOREBAR, ['2026-10-12']);
    assert.deepStrictEqual(jour.map((m) => m.id), ['lhjmq_32689', 'lhjmq_33075', 'lhjmq_33139', 'lhjmq_33102'],
        'seuls les matchs du jour demandé');
    const sj = jour.find((m) => m.id === 'lhjmq_33075');
    assert.strictEqual(sj.startTime, '14:00', '15 h à Saint John (-03:00) = 14 h à New York');
    assert.strictEqual(sj.matchDate, '2026-10-12');
    assert.strictEqual(sj.status, 'live');
    assert.deepStrictEqual(sj.score, [3, 3], 'pointage [domicile, visiteur]');
    assert.strictEqual(sj.minute, '02:52 3rd');
    assert.strictEqual(sj.period, 3);
    assert.strictEqual(sj.league, 'LHJMQ');
    const fini = tous.find((m) => m.id === 'lhjmq_32848');
    assert.strictEqual(fini.status, 'finished');
    assert.deepStrictEqual(fini.score, [3, 6]);
    const avenir = tous.find((m) => m.id === 'lhjmq_32751');
    assert.strictEqual(avenir.status, 'upcoming');
    assert.strictEqual(avenir.score, null, 'pas de 0-0 affiché avant le match');
    assert.strictEqual(avenir.startTime, '18:00');
    assert.deepStrictEqual(L.lireScorebarLhjmq('pas du json'), []);
    assert.deepStrictEqual(L.lireScorebarLhjmq({}), []);
    ok('scorebar : heure de New York, statut, pointage, période');

    // ── 2. Noms : ceux de la base, toutes les équipes ───────────────────────
    const noms = new Set();
    tous.forEach((m) => { noms.add(m.homeTeam); noms.add(m.awayTeam); });
    assert.ok(noms.has('Sherbrooke Phoenix'), 'la ligature « Phœnix » est défaite');
    noms.forEach((nom) => {
        const resolu = db.nomOfficielDansLigue(nom, 'LHJMQ');
        assert.strictEqual(resolu, nom, 'nom stable : ' + nom + ' -> ' + resolu);
        assert.strictEqual(db.leagueOfTeamName(nom), 'lhjmq', 'équipe connue de la base : ' + nom);
    });
    assert.ok(/foreurs/i.test(db.getOfficialTeamName("Val-d'Or", false, 'hockey')), 'Val-d\'Or est dans la base');
    ok('chaque équipe est connue de la base, sous le nom que donne la ligue');

    // ── 3. Les flux d'OnHockey se posent sur ces matchs ─────────────────────
    {
        const grille = "<table><tbody><tr><td></td><td><b>QMJHL</b></td><td></td></tr>"
            + "<tr class='game'><td><text class='game_hour'>18</text>:00</td><td>Drummondville - Saint John<div class='gamelinks'>"
            + "<a href='np_stream400.php?channel=//matchora.to/embed/channel/1961234'>mtchor</a></div></td><td></td></tr>"
            + "<tr class='game'><td><text class='game_hour'>20</text>:00</td><td>NL Regiment - Shawinigan<div class='gamelinks'>"
            + "<a href='np_stream400.php?channel=//matchora.to/embed/channel/1961221'>mtchor</a></div></td><td></td></tr>"
            + '</tbody></table>';
        const guide = jour.map((m) => Object.assign({}, m, {
            homeTeam: db.nomOfficielDansLigue(m.homeTeam, 'LHJMQ'),
            awayTeam: db.nomOfficielDansLigue(m.awayTeam, 'LHJMQ'),
            league: db.formatLeagueName('LHJMQ')
        }));
        const oh = scrapers.parseOnHockey(grille);
        assert.strictEqual(oh.length, 2);
        /* La grille d'OnHockey date ses lignes du jour affiché (TARGET_DATE, l'horloge
           réelle) ; les matchs ci-dessus sont ceux du 12 octobre 2026. Sans cette date
           fixée, le test tombait dès le lendemain (« un test ne dépend pas de l'heure »,
           AGENTS.md) : la page est donc lue le jour de ses matchs. */
        oh.forEach((o) => { o.matchDate = '2026-10-12'; });
        /* `sportOfTeamName` ne rangeait pas la ligue « lhjmq » au hockey : le garde-fou de
           sport de `getOfficialTeamName` refusait alors toute équipe de la LHJMQ, et
           OnHockey gardait « Drummondville » au lieu du nom de la base. */
        assert.deepStrictEqual([oh[0].homeTeam, oh[0].awayTeam], ['Drummondville Voltigeurs', 'Saint John Sea Dogs']);
        assert.deepStrictEqual([oh[1].homeTeam, oh[1].awayTeam], ['Newfoundland Regiment', 'Shawinigan Cataractes']);
        const paires = oh.map((o) => (guide.find((m) => match.isMatchPair(m, o)) || {}).id);
        assert.deepStrictEqual(paires, ['lhjmq_33075', 'lhjmq_33102'], 'chaque ligne d\'OnHockey trouve son match');
        ok('les lignes LHJMQ d\'OnHockey s\'apparient aux matchs du guide');
    }

    // ── 4. L'adresse ────────────────────────────────────────────────────────
    {
        const u = L.urlScorebarLhjmq(1, 2);
        assert.ok(u.indexOf('https://lscluster.hockeytech.com/feed/index.php?') === 0);
        assert.ok(/client_code=lhjmq/.test(u) && /view=scorebar/.test(u) && /fmt=json/.test(u));
        assert.ok(/numberofdaysback=1/.test(u) && /numberofdaysahead=2/.test(u));
        ok('adresse du flux HockeyTech');
    }

    console.log(`unit_lhjmq: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

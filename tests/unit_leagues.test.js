/* Tests unitaires du classement des ligues (jsdom, sans réseau).
   Vérifie leagueTier / defaultLeagueTier : listes par défaut, choix de l'utilisateur
   (principale / secondaire / ignorée), sections synthétiques et flux non identifiés.
   Vérifie aussi que les listes ESPN du client et du script serveur ne divergent pas. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    w.__NO_AUTOSTART__ = true;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

    await import('../js/scrapers.js');
    const db = await import('../js/db.js');
    const api = await import('../js/api.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── Valeurs par défaut ─────────────────────────────────────────────────
    assert.strictEqual(db.leagueTier('NHL'), 'main');
    assert.strictEqual(db.leagueTier('nhl'), 'main', 'insensible à la casse');
    assert.strictEqual(db.leagueTier('WNBA'), 'secondary');
    assert.strictEqual(db.leagueTier('Coupe Machin Inconnue'), 'other');
    assert.strictEqual(db.leagueTier('Autres Flux'), 'other');
    assert.strictEqual(db.leagueTier(''), 'other');
    assert.strictEqual(db.leagueTier(null), 'other');
    assert.strictEqual(db.leagueTier('FAVORIS'), 'main');
    assert.strictEqual(db.leagueTier('EN DIRECT'), 'main');
    ok('leagueTier : listes par défaut');

    // ── Choix de l'utilisateur ─────────────────────────────────────────────
    assert.strictEqual(db.leagueTier('NHL', { NHL: 'ignored' }), 'ignored');
    assert.strictEqual(db.leagueTier('WNBA', { WNBA: 'main' }), 'main');
    assert.strictEqual(db.leagueTier('Coupe Machin Inconnue', { 'COUPE MACHIN INCONNUE': 'main' }), 'main');
    assert.strictEqual(db.leagueTier('NHL', { NHL: 'bidon' }), 'main', 'valeur invalide ignorée');
    assert.strictEqual(db.leagueTier('FAVORIS', { FAVORIS: 'ignored' }), 'main', 'sections synthétiques jamais masquées');
    assert.strictEqual(db.defaultLeagueTier('NHL'), 'main', 'defaultLeagueTier ignore les choix');
    ok('leagueTier : choix de l\'utilisateur');

    // window.leagueTierOverrides est la source implicite
    w.leagueTierOverrides = { MLB: 'ignored' };
    assert.strictEqual(db.leagueTier('MLB'), 'ignored');
    assert.strictEqual(db.defaultLeagueTier('MLB'), 'main');
    w.leagueTierOverrides = {};
    assert.strictEqual(db.leagueTier('MLB'), 'main');
    ok('leagueTier lit window.leagueTierOverrides');

    // ── Pas de doublon entre les deux listes ───────────────────────────────
    const main = Object.keys(db.DEFAULT_LEAGUES);
    const other = Object.keys(db.OTHER_LEAGUES);
    const dup = main.filter((k) => other.indexOf(k) >= 0);
    assert.deepStrictEqual(dup, [], 'ligues présentes dans les deux listes : ' + dup.join(', '));
    // 'FIFA World Cup' se ramène à 'World Cup' via LEAGUE_ALIASES : pas d'entrée séparée
    assert.strictEqual(db.formatLeagueName('fifa world cup'), db.formatLeagueName('world cup'));
    assert.strictEqual(db.leagueTier(db.formatLeagueName('fifa world cup')), 'main');
    ok('aucun doublon principale/secondaire');

    // ── Les listes ESPN client et serveur ne doivent pas diverger ──────────
    const srv = fs.readFileSync(path.join(__dirname, '../scripts/scrape_schedule.mjs'), 'utf8');
    const block = /const ESPN_LEAGUES = \{([\s\S]*?)\n\};/.exec(srv);
    assert.ok(block, 'ESPN_LEAGUES introuvable dans scripts/scrape_schedule.mjs');
    const srvLeagues = {};
    for (const m of block[1].matchAll(/'((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)'/g)) {
        srvLeagues[m[1].replace(/\\'/g, "'")] = m[2].replace(/\\'/g, "'");
    }
    const clientKeys = Object.keys(api.ESPN_LEAGUES).sort();
    const serverKeys = Object.keys(srvLeagues).sort();
    const missingServer = clientKeys.filter((k) => !srvLeagues[k]);
    const missingClient = serverKeys.filter((k) => !api.ESPN_LEAGUES[k]);
    assert.deepStrictEqual(missingServer, [], 'endpoints connus du client mais pas du serveur : ' + missingServer.join(', '));
    assert.deepStrictEqual(missingClient, [], 'endpoints connus du serveur mais pas du client : ' + missingClient.join(', '));
    const differing = clientKeys.filter((k) => api.ESPN_LEAGUES[k] !== srvLeagues[k]);
    assert.deepStrictEqual(differing, [], 'chemins ESPN divergents : ' + differing.join(', '));
    ok('listes ESPN client et serveur identiques (' + clientKeys.length + ' entrées)');

    // Les alias doivent aussi rester alignés : c'est eux qui ramènent les noms renvoyés
    // par ESPN ("PGA TOUR", "Gallagher Prem") vers les clés connues.
    const aliasBlock = /const LEAGUE_ALIASES = \{([\s\S]*?)\n\};/.exec(srv);
    assert.ok(aliasBlock, 'LEAGUE_ALIASES introuvable côté serveur');
    const srvAliases = {};
    for (const m of aliasBlock[1].matchAll(/'((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)'/g)) {
        srvAliases[m[1].replace(/\\'/g, "'")] = m[2].replace(/\\'/g, "'");
    }
    const aliasDrift = Object.keys(srvAliases).filter((k) => db.LEAGUE_ALIASES[k] !== srvAliases[k]);
    assert.deepStrictEqual(aliasDrift, [], 'alias serveur absents ou différents côté client : ' + aliasDrift.join(', '));
    ok('alias serveur présents côté client (' + Object.keys(srvAliases).length + ')');

    // Chaque nom de ligue renvoyé par les API doit atterrir dans une liste connue.
    const apiNames = ["National Hockey League", "Women's National Basketball Association", 'PGA TOUR',
        'French Top 14', 'Gallagher Prem', 'Ultimate Fighting Championship', 'IndyCar Series',
        'NASCAR Cup Series', 'NCAA - Football', 'Boxing', 'WWE', 'AEW', 'Euroleague', 'ATP', 'WTA',
        'NWSL', 'Formula 1'];
    const unresolved = apiNames.filter((nm) => db.leagueTier(db.formatLeagueName(nm)) === 'other');
    assert.deepStrictEqual(unresolved, [], 'noms d\'API non reconnus (tomberaient dans « Autres ») : ' + unresolved.join(', '));
    assert.strictEqual(db.formatLeagueName('WWE'), 'WWE');
    assert.strictEqual(db.formatLeagueName("Women's National Basketball Association"), 'WNBA');
    ok('noms renvoyés par les API classés dans une ligue connue');

    // ── TheSportsDB : WWE, AEW et boxe (absents d'ESPN) ────────────────────
    const scr = await import('../js/scrapers.js');
    const sample = { events: [
        { idEvent: '1', strEvent: 'Katie Taylor vs Flora Pili', strLeague: 'Boxing', strSport: 'Fighting', strTimestamp: '2026-09-05T16:00:00', dateEvent: '2026-09-05', strVenue: 'Croke Park' },
        { idEvent: '2', strEvent: 'Money In The Bank', strLeague: 'WWE', strSport: 'Fighting', strTimestamp: '2026-09-05T23:00:00', dateEvent: '2026-09-05' },
        { idEvent: '3', strEvent: 'Reporté', strLeague: 'WWE', strSport: 'Fighting', strTimestamp: '2026-09-05T23:00:00', strPostponed: 'yes' },
        { idEvent: '4', strEvent: 'Autre jour', strLeague: 'WWE', strSport: 'Fighting', strTimestamp: '2026-09-09T23:00:00' }
    ] };
    const fights = scr.parseSportsDbEvents(sample, '2026-09-05');
    assert.strictEqual(fights.length, 2, 'événement reporté et hors date exclus');
    assert.strictEqual(fights[0].homeTeam, 'Katie Taylor');
    assert.strictEqual(fights[0].awayTeam, 'Flora Pili');
    assert.strictEqual(db.leagueTier(fights[0].league), 'secondary');
    assert.strictEqual(fights[1].homeTeam, 'Money In The Bank');
    assert.strictEqual(fights[1].awayTeam, '', 'un événement sans « vs » reste sur un seul camp');
    assert.strictEqual(fights[1].league, 'WWE');
    assert.ok(/^\d{2}:\d{2}$/.test(fights[0].startTime));
    assert.strictEqual(fights[0].matchDate, '2026-09-05');
    assert.deepStrictEqual(scr.parseSportsDbEvents(null, '2026-09-05'), [], 'réponse vide tolérée');
    ok('parseSportsDbEvents : WWE, AEW et boxe');

    console.log(`unit_leagues: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

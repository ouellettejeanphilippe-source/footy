/* Tests unitaires de la mémoire de getOfficialTeamName (js/db.js), sans réseau.

   « Encore du lag » sur le Chromecast (30 octobre 2026) : le profil CPU de la WebView
   (page Live seule) a mis `officialTeamNameForLeague` → `getOfficialTeamName` → `isMatch`
   à 57 % du temps de script : chaque nom hors de la table exacte est comparé aux 823 équipes
   de STATIC_TEAM_MAP, et les mêmes noms reviennent à chaque passe. getOfficialTeamName
   retient maintenant ses réponses. Ce qu'on garde ici : la réponse est celle d'avant, la
   seconde demande ne refait aucune comparaison, et une réponse donnée avant que `isMatch`
   existe (début du démarrage, sans approximation) n'est pas retenue. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }

    const match = await import('../js/match.js');
    const db = await import('../js/db.js');

    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    const noms = ['Manchester Utd', 'real madrid', 'Tanpa Bay Lightning', 'zzz club inconnu', 'Michigan Wolverines',
        'Toulon', 'F1 Monaco Grand Prix', 'Arsenl', 'Indiana Fever'];

    // ── 1. Avant que isMatch existe : la réponse d'avant, et rien n'est retenu ─────────
    assert.strictEqual(typeof globalThis.isMatch, 'undefined', 'sans isMatch global, comme au tout début du démarrage');
    const tot = db.statsMemoireNomsOfficiels();
    const sansApprox = noms.map((x) => db.nomOfficielSansMemoire(x));
    noms.forEach((x, i) => assert.strictEqual(db.getOfficialTeamName(x), sansApprox[i], 'avant isMatch : ' + x));
    assert.strictEqual(db.statsMemoireNomsOfficiels().taille, 0, 'rien n\'est retenu avant que isMatch existe');
    assert.ok(db.statsMemoireNomsOfficiels().calculs > tot.calculs);
    ok('avant que isMatch existe, la réponse est celle d\'avant et rien n\'est retenu');

    // ── 2. isMatch disponible, comme dans le navigateur ───────────────────────────────
    let appelsIsMatch = 0;
    globalThis.stringSimilarity = match.stringSimilarity;
    globalThis.isMatch = (a, b, s) => { appelsIsMatch++; return match.isMatch(a, b, s); };

    const attendu = noms.map((x) => db.nomOfficielSansMemoire(x));
    appelsIsMatch = 0;
    noms.forEach((x, i) => assert.strictEqual(db.getOfficialTeamName(x), attendu[i], '1re demande : ' + x));
    const premiere = appelsIsMatch;
    assert.ok(premiere > 0, 'la première demande fait la recherche floue (' + premiere + ' comparaisons)');
    noms.forEach((x, i) => assert.strictEqual(db.getOfficialTeamName(x), attendu[i], '2e demande : ' + x));
    assert.strictEqual(appelsIsMatch, premiere, 'la seconde demande ne refait aucune comparaison');
    ok('mêmes réponses qu\'avant, et la seconde demande ne refait aucune comparaison');

    // ── 3. Les options changent la clé : pas de mélange entre elles ───────────────────
    const nom = 'zzz club inconnu';
    const a = db.getOfficialTeamName(nom, false, undefined, false);
    const b = db.getOfficialTeamName(nom, true);
    const c = db.getOfficialTeamName(nom, false, undefined, true);
    assert.strictEqual(a, db.nomOfficielSansMemoire(nom, false, undefined, false));
    assert.strictEqual(b, db.nomOfficielSansMemoire(nom, true));
    assert.strictEqual(c, db.nomOfficielSansMemoire(nom, false, undefined, true));
    assert.strictEqual(db.getOfficialTeamName('Michigan Wolverines', false, 'basket'), db.nomOfficielSansMemoire('Michigan Wolverines', false, 'basket'));
    ok('bypass, sansApproximation et sport ont chacun leur réponse');

    // ── 4. Vide, null, et plafond ─────────────────────────────────────────────────────
    assert.strictEqual(db.getOfficialTeamName(''), '');
    assert.strictEqual(db.getOfficialTeamName(null), null);
    assert.strictEqual(db.getOfficialTeamName(undefined), undefined);
    assert.ok(db.statsMemoireNomsOfficiels().taille <= db.MEMOIRE_NOMS_MAX);
    ok('vide, null et undefined : comme avant, et la mémoire reste sous son plafond');

    console.log(`\n${n} tests passés`);
    delete globalThis.isMatch; delete globalThis.stringSimilarity;
}

main().catch((e) => { console.error(e); process.exit(1); });

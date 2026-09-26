/* Sur une grille, l'appariement de l'adaptateur fait loi (pageEstUneGrille).
 *
 * Ce que ce test protège
 * ----------------------
 * Tous les matchs d'OnHockey pointent vers `schedule_table.php`, sa grille unique.
 * Son adaptateur fait donc la seule chose juste : il analyse la grille et ne retient
 * que les liens de la ligne appariée au match courant. Mais `extractStreamLinks`
 * enchaînait ensuite sur ses branches génériques, qui récoltent tout ce qui ressemble
 * à un flux sur la page, sans aucun appariement. L'adaptateur prenait la bonne ligne,
 * le générique ajoutait toutes les autres.
 *
 * Signalé le 26 septembre 2026 : « on hockey met des matchs lhjmq dans des matchs
 * lnh ». Mesuré sur le cache du jour : 170 liens nommant une équipe de la LHJMQ,
 * répartis sur 35 matchs de la LNH — « Shawinigan - Rimouski » se retrouvait à la
 * fois sous Buffalo-Pittsburgh, Nashville-Carolina et Los Angeles-Anaheim.
 *
 * Écrit en `main()` avec `process.exit`, comme les autres tests qui importent
 * js/scrapers.js : le module laisse des minuteurs en vie et le processus ne se
 * terminerait pas tout seul.
 */

const assert = require('node:assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
    const w = dom.window;
    w.__NO_AUTOSTART__ = true;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator',
                     'HTMLElement', 'Event', 'CustomEvent', 'location', 'history',
                     'getComputedStyle']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

    const scrapers = await import('../js/scrapers.js');
    const match = await import('../js/match.js');
    const onhockey = await import('../js/sources/onhockey.js');

    let n = 0;
    const ok = (nom) => { n++; console.log('  ✓ ' + nom); };

    // ── 1. L'appariement n'était PAS le coupable ─────────────────────────────
    /* C'était la première hypothèse, et elle était fausse. Le test la garde fausse :
       si cet appariement devenait laxiste, le drapeau de grille ne protégerait plus
       rien. */
    const lnh = { league: 'NHL', homeTeam: 'Buffalo Sabres', awayTeam: 'Pittsburgh Penguins' };
    assert.strictEqual(match.isMatchPair(lnh, { league: 'LHJMQ', homeTeam: 'Shawinigan', awayTeam: 'Rimouski' }), false,
        'un match junior ne s’apparie pas à un match de la LNH');
    assert.strictEqual(match.isMatchPair(lnh, { homeTeam: 'Shawinigan Cataractes', awayTeam: 'Rimouski Oceanic' }), false,
        'ni sous ses noms complets');
    assert.strictEqual(match.isMatchPair(lnh, { league: 'NHL', homeTeam: 'Sabres', awayTeam: 'Penguins' }), true,
        'et le bon match s’apparie toujours, sous un nom plus court');
    ok('l’appariement refuse le junior sous la LNH, et accepte le bon match');

    // ── 2. Le domaine déclare que sa page est une grille ─────────────────────
    assert.strictEqual(onhockey.pageEstUneGrille, true,
        'sans ce drapeau, extractStreamLinks ne peut pas savoir que la page porte plusieurs rencontres');
    ok('onhockey déclare que sa page de match est une grille');

    // ── 3. Rien n'est attribué à un match que l'adaptateur n'a pas apparié ───
    /* La page porte des adresses en /embed/ et /player.php — exactement la cible du
       moteur générique — mais elle ne parle PAS du match demandé. */
    const grille = `<!doctype html><html><body>
      <table>
        <tr><td>Shawinigan - Rimouski</td>
            <td><a href="https://matchora.to/embed/shawinigan-rimouski">matchora</a>
                <a href="https://onhockey.tv/player.php?id=jr1">RDS2</a></td></tr>
        <tr><td>Drummondville - Val-d'Or</td>
            <td><a href="https://matchora.to/embed/drummondville-valdor">matchora</a></td></tr>
        <tr><td>Cape Breton - Saint John</td>
            <td><a href="https://www.youtube.com/embed/abcdefghijk">youtube</a></td></tr>
      </table>
    </body></html>`;

    const mLnh = {
        id: 'nhl-1', league: 'NHL', homeTeam: 'Buffalo Sabres', awayTeam: 'Pittsburgh Penguins',
        matchUrl: 'https://onhockey.tv/schedule_table.php', source: 'onhockey', streamLinks: [],
    };

    const liens = scrapers.extractStreamLinks(grille, mLnh) || [];
    const lecteurs = liens.filter((l) => !l.topLevel);
    assert.strictEqual(lecteurs.length, 0,
        'aucun lecteur ne doit sortir : la grille ne porte pas ce match. Sortis : '
        + JSON.stringify(liens.map((l) => l.name + ' -> ' + l.url)));

    /* La réponse honnête reste offerte : la page, à ouvrir soi-même. Mieux vaut un lien
       qui dit « va voir » que soixante-dix qui mentent. */
    assert.ok(liens.some((l) => l.topLevel && /onhockey/.test(l.url)),
        'le repli « Page du match sur onhockey.tv » doit rester');

    const texte = JSON.stringify(liens).toLowerCase();
    for (const junior of ['shawinigan', 'rimouski', 'drummondville', 'cape breton', 'saint john']) {
        assert.ok(!texte.includes(junior), `« ${junior} » ne doit pas se retrouver sous un match de la LNH`);
    }
    ok('sur une grille, aucune autre rencontre ne déteint sur le match demandé');

    // ── 4. Le drapeau n'est pas une coupure générale ─────────────────────────
    /* Un domaine sans adaptateur compte sur le générique, et c'est lui qui rattrape un
       site qui refait son HTML (README, « Ces sites changent sans prévenir »). */
    const pageDeMatch = `<!doctype html><html><body>
      <iframe src="https://embedme.st/embed/quelquechose"></iframe>
      <a href="https://exemple-flux.test/player.php?id=42">Flux 1</a>
    </body></html>`;
    const mAutre = {
        id: 'x-1', league: 'NHL', homeTeam: 'Buffalo Sabres', awayTeam: 'Pittsburgh Penguins',
        matchUrl: 'https://un-site-sans-adaptateur.test/match/sabres-penguins',
        source: 'autre', streamLinks: [],
    };
    const liens2 = (scrapers.extractStreamLinks(pageDeMatch, mAutre) || []).filter((l) => !l.topLevel);
    assert.ok(liens2.length > 0,
        'le générique doit encore rendre des liens là où aucun adaptateur ne couvre le domaine');
    ok('sur une vraie page de match, le moteur générique continue de travailler');

    console.log(`unit_grille: ${n} groupes de tests OK`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

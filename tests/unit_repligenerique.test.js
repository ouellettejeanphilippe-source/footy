/* Repli générique d'analyse des listes de matchs (js/genericlist.js, parseGenerique).

   « Ya moyen de futur proof encore plus l'app, pour si les sites changent […] que ça
   brise pas ou que ça se répare sans toujours faire du code » (10 septembre 2026).

   La panne visée : un site refait son HTML, son parseur dédié rend zéro, et la source
   est morte jusqu'à ce que quelqu'un lise la page, écrive un parseur et publie. Les cas
   ci-dessous sont les gabarits RÉELS des sources (relevés dans unit_scrapers), servis à
   un module qui ne connaît aucune d'elles : s'il les retrouve, une refonte de site ne
   coupe plus la source, elle la dégrade.

   Et le pendant, tout aussi important : ce qui n'est PAS un match — menus, catégories,
   réseaux sociaux — ne doit pas devenir un match, sans quoi le repli remplacerait une
   panne visible par une pollution silencieuse. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    w.__NO_AUTOSTART__ = true;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }
    const G = await import('../js/genericlist.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const noms = (liste) => liste.map((m) => m.home + ' / ' + m.away);

    // ── 1. Les trois gabarits réels des sources ──────────────────────────────
    /* Sportsurge : titre « A - B » et l'heure en horodatage Unix sur un enfant. */
    const ss = G.extraireMatchsGeneriques(`<html><head><base href="https://v2.sportsurge.net/"></head><body>
      <a href="watch-63082-baseball-san-diego-padres-cincinnati-reds-8/" class="match-row" title="San Diego Padres - Cincinnati Reds">
        <span class="match-row-team-name">San Diego Padres</span><span class="match-row-team-name">Cincinnati Reds</span>
        <span class="match-time" data-timestamp="1788367200">12:40</span></a>
    </body></html>`, 'https://v2.sportsurge.net/watch-baseball-streams/');
    assert.deepStrictEqual(noms(ss), ['San Diego Padres / Cincinnati Reds']);
    assert.ok(ss[0].instant instanceof Date, 'un horodatage Unix donne un instant, pas un texte');
    ok('gabarit Sportsurge retrouvé sans parseur dédié, heure comprise');

    /* Streameast : « A vs B » dans le texte de l'ancre, l'heure DANS la rangée voisine. */
    const se = G.extraireMatchsGeneriques(
        `<ul><li><a href="https://www.streameast.ms/mlb/atlanta-braves-vs-washington-nationals-5/">Atlanta Braves vs Washington Nationals</a> 13:05</li></ul>`,
        'https://www.streameast.ms/');
    assert.deepStrictEqual(noms(se), ['Atlanta Braves / Washington Nationals']);
    assert.strictEqual(se[0].heureTexte, '13:05', 'l\'heure est cherchée aussi dans la rangée qui porte l\'ancre');
    ok('gabarit Streameast retrouvé, heure lue à côté du lien');

    /* MLBite : rien dans le texte, tout dans le slug, à la forme américaine
       « visiteur-at-local » — l'ordre des équipes doit s'inverser. */
    const mlb = G.extraireMatchsGeneriques(`<div>
      <a href="/watch/live/san-diego-padres-at-cincinnati-reds-15-free-live-stream" class="inline-match-item live-background">
        <div class="first-team"><b>Reds</b></div><div class="result-wrap"><span class="result-status-text live">Live</span></div></a>
    </div>`, 'https://mlbbite.plus/');
    assert.deepStrictEqual(noms(mlb), ['Cincinnati Reds / San Diego Padres'],
        '« A at B » : B reçoit, il est le local');
    assert.strictEqual(mlb[0].statut, 'live', 'l\'état se lit dans les classes de la rangée');
    assert.ok(!/\d/.test(mlb[0].home), 'l\'identifiant collé au slug (« -15 ») ne fait pas partie du nom');
    ok('gabarit MLBite retrouvé depuis l\'adresse seule, visiteur et local dans le bon sens');

    // ── 2. Ce qui n'est pas un match ne le devient pas ───────────────────────
    const bruit = G.extraireMatchsGeneriques(`<html><body>
      <a href="/watch-nba-streams/">NBA Streams</a>
      <a href="/schedule">Schedule</a>
      <a href="/live">Watch Free Live</a>
      <a href="https://twitter.com/site">Follow us</a>
      <a href="/soccer/premier-league">Premier League - Live Streams</a>
      <a href="/logo.png">Home - Away</a>
      <a href="/a/b">Foot - Basket - Tennis</a>
    </body></html>`, 'https://x.test/');
    assert.deepStrictEqual(bruit, [], 'menus, catégories, réseaux sociaux et ressources : rien ne passe');
    ok('le bruit d\'un site ne devient pas des matchs');

    /* Le tiret seul est ambigu : « A - B » ne compte que s'il y a une heure à côté. */
    const sansHeure = G.extraireMatchsGeneriques('<a href="/x/psg-marseille">PSG - Marseille</a>', 'https://x.test/');
    assert.deepStrictEqual(sansHeure, [], 'un tiret sans heure ne suffit pas à affirmer une rencontre');
    const avecHeure = G.extraireMatchsGeneriques('<div><a href="/x/psg-marseille"><span>14:00</span>PSG - Marseille</a></div>', 'https://x.test/');
    assert.deepStrictEqual(noms(avecHeure), ['PSG / Marseille']);
    ok('le tiret ambigu n\'est retenu que confirmé par une heure');

    // ── 3. L'heure : un instant seulement quand le site donne son fuseau ─────
    assert.ok(G.lireInstant('2026-09-10T19:30:00Z') instanceof Date);
    assert.ok(G.lireInstant('1788367200') instanceof Date);
    assert.strictEqual(G.lireInstant('2026-09-10T19:30'), null,
        'une date ISO SANS fuseau ne dit pas quel instant : on ne devine pas');
    assert.strictEqual(G.lireHeureTexte('14:00PSG - Marseille'), '14:00',
        'l\'heure collée au nom, telle que la rend textContent, doit être lue');
    assert.strictEqual(G.lireHeureTexte('19:30 PM'), '19:30');
    assert.strictEqual(G.lireHeureTexte('7:05 pm'), '19:05');
    assert.strictEqual(G.lireHeureTexte('pas d\'heure'), null);
    ok('l\'heure n\'est un instant que lorsque le site a écrit son fuseau');

    // ── 4. Dédoublonnage et hors-site ────────────────────────────────────────
    const doublon = G.extraireMatchsGeneriques(`<div>
      <a href="/nba/a-vs-b"><span>19:00</span>Lakers vs Celtics</a>
      <a href="/nba/a-vs-b/"><span>19:00</span>Lakers vs Celtics</a>
      <a href="https://autre.test/nba/c-vs-d"><span>20:00</span>Bulls vs Heat</a>
    </div>`, 'https://x.test/');
    assert.deepStrictEqual(noms(doublon), ['Lakers / Celtics'],
        'même adresse à la barre finale près : une seule entrée ; un autre domaine : écarté');
    ok('une adresse n\'est comptée qu\'une fois, et le hors-site reste dehors');

    // ── 5. parseGenerique habille le résultat comme un parseur dédié ─────────
    const scrapers = await import('../js/scrapers.js');
    const habilles = scrapers.parseGenerique(
        `<ul><li><a href="https://www.streameast.ms/mlb/atlanta-braves-vs-washington-nationals-5/">Atlanta Braves vs Washington Nationals</a> 13:05</li></ul>`,
        'https://www.streameast.ms/mlb/', 'streameast');
    assert.strictEqual(habilles.length, 1);
    const m = habilles[0];
    ['league', 'homeTeam', 'awayTeam', 'matchUrl', 'startTime', 'durationMinutes', 'status', 'streamLinks', 'source'].forEach((k) => {
        assert.ok(k in m, 'un match du repli porte ' + k + ' comme n\'importe quel autre');
    });
    assert.strictEqual(m.source, 'streameast');
    assert.strictEqual(m.parAnalyseGenerique, true, 'le repli se déclare : la page Logs le montre');
    assert.strictEqual(m.homeTeam, 'Atlanta Braves', 'le nom officiel est résolu comme ailleurs');
    ok('parseGenerique rend des matchs de la même forme que les parseurs dédiés');

    // ── 6. analyserPageDeListe : le repli ne sert QUE si le parseur est muet ─
    const page = '<div><a href="/x/a-vs-b"><span>19:00</span>Lakers vs Celtics</a></div>';
    const vivant = scrapers.analyserPageDeListe(() => [{ id: 'vrai' }], page, 'https://x.test/', 'x');
    assert.strictEqual(vivant.generique, false);
    assert.deepStrictEqual(vivant.liste, [{ id: 'vrai' }], 'un parseur qui marche n\'est jamais doublé');

    const muet = scrapers.analyserPageDeListe(() => [], page, 'https://x.test/', 'x');
    assert.strictEqual(muet.generique, true);
    assert.strictEqual(muet.liste.length, 1, 'un parseur muet est rattrapé');

    const casse = scrapers.analyserPageDeListe(() => { throw new Error('refonte'); }, page, 'https://x.test/', 'x');
    assert.strictEqual(casse.generique, true, 'un parseur qui LÈVE est traité comme muet, pas comme fatal');

    const rien = scrapers.analyserPageDeListe(() => [], '<p>page d\'erreur</p>', 'https://x.test/', 'x');
    assert.strictEqual(rien.generique, false);
    assert.deepStrictEqual(rien.liste, [], 'sans rien à trouver, le repli n\'invente pas');
    ok('le repli ne s\'exécute que sur une page dont le parseur dédié n\'a rien tiré');

    console.log(`unit_repligenerique: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

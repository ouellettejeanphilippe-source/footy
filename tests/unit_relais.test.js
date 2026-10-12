/* OnHockey par le relais de Jina (js/relais.js).

   Depuis le 9 septembre 2026 au moins, chaque passage du cache portait « https://onhockey.tv/
   -> direct: HTTP 403 » et zéro match : Cloudflare refuse les machines de GitHub Actions
   (la même requête Node, mêmes en-têtes, rend 200 depuis une autre adresse — vérifié le
   12 octobre 2026). Dans le navigateur, l'accès direct est fermé par CORS, et Jina sans
   Referer ne reçoit de `schedule_table.php` que « You are not allowed to access this page
   directly ».

   Jina accepte `X-Referer`, mais ne rend alors la grille entière qu'en Markdown (son HTML
   s'arrête au premier `<script>` de ce fragment). On convertit donc le Markdown dans la
   forme que lit `parseOnHockey`. Le Markdown ci-dessous est un extrait VERBATIM de la
   réponse de Jina du 12 octobre 2026, et le HTML la même portion de la vraie page : les
   deux doivent donner les mêmes matchs et les mêmes lecteurs. Mesuré sur la page entière
   ce jour-là : 24 matchs de part et d'autre, identiques.

   Pas de réseau : `fetch` est simulé. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

const MARKDOWN = `Title:

URL Source: https://onhockey.tv/schedule_table.php

Markdown Content:
**Ligue Magnus**[standings](https://onhockey.tv/standings_lr.php?channel=France/Ligue-Magnus)
18:00 Dragons de Rouen - Angers

[sportpl](https://sportplus.watch/hockey/26211/8280770/ "(opens in a new tab)")
**QMJHL**[standings](https://onhockey.tv/standings_lr.php?channel=Canada/QMJHL)
18:00 Drummondville - Saint John

[mtchor](https://onhockey.tv/np_stream400.php?channel=//matchora.to/embed/channel/1961234)[mtchor](https://onhockey.tv/np_stream400.php?channel=//matchora.to/embed/channel/1961233)
20:00 NL Regiment - Shawinigan

[mtchor](https://onhockey.tv/np_stream400.php?channel=//matchora.to/embed/channel/1961221)[mtchor](https://onhockey.tv/np_stream400.php?channel=//matchora.to/embed/channel/1961220)
**WHL**[standings](https://onhockey.tv/standings_lr.php?channel=Canada/Whl)
19:00 Victoria - Calgary Hitmen

[youtube](https://onhockey.tv/np_youtube.php?channel=N15hIX_k5J0)
**NHL**[standings](https://onhockey.tv/standings_lr.php?channel=USA/NHL)
23:00 Ottawa - New Jersey Devils

 live stream will be available closer to the game time
`;

const HTML = `<table id='gametable' border='0' cellspacing='0' width='240' cols='3'>
<tbody class='CH'><tr bgcolor="#3z3z3z" align="center"><td width="30"></td><td width="140"><b>Ligue Magnus</b></td><td width ="70" align="right"><a href='standings_lr.php?channel=France/Ligue-Magnus' target='_blank'>standings</a></td></tr>
<tr class='game' onclick='javascript:Menu(this)'><td><text class='game_hour' align='left'>18</text>:00</td><td>Dragons de Rouen - Angers
<div class='gamelinks' onclick='event.stopPropagation()'>
<a href='//sportplus.watch/hockey/26211/8280770/' target='_blank' title='(opens in a new tab)'>sportpl</a>
</div>
</td><td class='liveon' align="right">
</td></tr>
</tbody>
<tbody class='NA'><tr bgcolor="#3z3z3z" align="center"><td width="30"></td><td width="140"><b>QMJHL</b></td><td width ="70" align="right"><a href='standings_lr.php?channel=Canada/QMJHL' target='_blank'>standings</a></td></tr>
<tr class='game' onclick='javascript:Menu(this)'><td><text class='game_hour' align='left'>18</text>:00</td><td>Drummondville - Saint John
<div class='gamelinks' onclick='event.stopPropagation()'>
<a href='np_stream400.php?channel=//matchora.to/embed/channel/1961234' target='player_frame' title=''>mtchor</a>
<a href='np_stream400.php?channel=//matchora.to/embed/channel/1961233' target='player_frame' title=''>mtchor</a>
</div>
</td><td class='liveon' align="right">
</td></tr>
<tr class='game' onclick='javascript:Menu(this)'><td><text class='game_hour' align='left'>20</text>:00</td><td>NL Regiment - Shawinigan
<div class='gamelinks' onclick='event.stopPropagation()'>
<a href='np_stream400.php?channel=//matchora.to/embed/channel/1961221' target='player_frame' title=''>mtchor</a>
<a href='np_stream400.php?channel=//matchora.to/embed/channel/1961220' target='player_frame' title=''>mtchor</a>
</div>
</td><td class='liveon' align="right">
</td></tr>
</tbody>
<tbody class='NA'><tr bgcolor="#3z3z3z" align="center"><td width="30"></td><td width="140"><b>WHL</b></td><td width ="70" align="right"><a href='standings_lr.php?channel=Canada/Whl' target='_blank'>standings</a></td></tr>
<tr class='game' onclick='javascript:Menu(this)'><td><text class='game_hour' align='left'>19</text>:00</td><td>Victoria - Calgary Hitmen
<div class='gamelinks' onclick='event.stopPropagation()'>
<a href='np_youtube.php?channel=N15hIX_k5J0' target='player_frame' title=''>youtube</a>
</div>
</td><td class='liveon' align="right">
</td></tr>
</tbody>
<tbody class='NA'><tr bgcolor="#3z3z3z" align="center"><td width="30"></td><td width="140"><b>NHL</b></td><td width ="70" align="right"><a href='standings_lr.php?channel=USA/NHL' target='_blank'>standings</a></td></tr>
<tr class='game' onclick='javascript:Menu(this)'><td><text class='game_hour' align='left'>23</text>:00</td><td>Ottawa - New Jersey Devils
<div class='gamelinks' onclick='event.stopPropagation()'>
live stream will be available closer to the game time
</div>
</td><td class='liveon' align="right">
</td></tr>
</tbody>
</table>`;

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
    for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
        Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
    }
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    dom.window.__NO_AUTOSTART__ = true;

    const scrapers = await import('../js/scrapers.js');
    const U = await import('../js/utils.js');
    const F = await import('../js/fetcher.js');
    const R = await import('../js/relais.js');

    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    /* Ce qui compte d'un match : sa ligue, ses équipes, et ses lecteurs (nom, adresse). L'heure
       dépend de la date du jour (heure d'été) : elle est comparée entre les deux lectures. */
    const signature = (liste) => liste.map((m) => [m.league, m.startTime, m.homeTeam, m.awayTeam,
        m.streamLinks.map((l) => l.name + ' ' + l.url).join(' , ')].join(' | '));

    // ── 1. Le Markdown de Jina, converti, se lit comme la vraie page ────────
    {
        const direct = signature(scrapers.parseOnHockey(HTML));
        const relaye = signature(scrapers.parseOnHockey(R.grilleOnHockeyDepuisMarkdown(MARKDOWN)));
        assert.strictEqual(direct.length, 5, 'cinq matchs dans l\'extrait : ' + direct.join('\n'));
        assert.deepStrictEqual(relaye, direct);
        const lhjmq = scrapers.parseOnHockey(R.grilleOnHockeyDepuisMarkdown(MARKDOWN)).filter((m) => m.league === 'LHJMQ');
        assert.strictEqual(lhjmq.length, 2, 'les deux matchs de la LHJMQ');
        assert.ok(lhjmq[0].streamLinks.some((l) => l.url === 'https://matchora.to/embed/channel/1961234'),
            'le lecteur déballé, pas l\'enveloppe onhockey.tv : ' + JSON.stringify(lhjmq[0].streamLinks));
        ok('grille convertie : mêmes matchs, mêmes lecteurs que la page d\'origine');
    }

    // ── 2. Ce qui n'est pas la grille ne fabrique pas de match ──────────────
    {
        const refus = R.grilleOnHockeyDepuisMarkdown('Title: \n\nMarkdown Content:\nYou are not allowed to access this page directly.');
        assert.ok(/<pre>/.test(refus) && /not allowed/.test(refus));
        assert.strictEqual(scrapers.parseOnHockey(refus).length, 0);
        assert.throws(() => R.grilleOnHockeyDepuisMarkdown('{"code":422,"name":"AssertionFailureError","message":"x"}'), /jina/);
        ok('un refus reste un refus, une erreur de Jina est une erreur');
    }

    // ── 3. Seul OnHockey est relayé, avec le Referer de son site ────────────
    {
        const r = R.relaisPour('https://onhockey.tv/schedule_table.php');
        assert.strictEqual(r.url, 'https://r.jina.ai/https://onhockey.tv/schedule_table.php');
        assert.strictEqual(r.headers['X-Referer'], 'https://onhockey.tv/');
        assert.strictEqual(r.headers['X-Return-Format'], 'markdown');
        assert.strictEqual(R.relaisPour('https://www.onhockey.tv/').url, 'https://r.jina.ai/https://www.onhockey.tv/');
        assert.strictEqual(R.relaisPour('https://footybite.im/'), null);
        assert.strictEqual(R.relaisPour('https://faux-onhockey.tv.exemple.com/'), null);
        assert.strictEqual(F.adapterJina('https://footybite.im/'), null, 'les autres pages gardent le HTML de Jina');
        ok('relaisPour : OnHockey en Markdown avec X-Referer, les autres hôtes intacts');
    }

    // ── 3 bis. fbstream : relayé en HTML, le navigateur n'y change rien ──────
    {
        const r = R.relaisPour('https://fbstream.is/stream/hockey');
        assert.strictEqual(r.url, 'https://r.jina.ai/https://fbstream.is/stream/hockey');
        assert.deepStrictEqual(r.headers, { 'X-Return-Format': 'html' }, 'HTML, sans Referer imposé');
        assert.strictEqual(r.markdown, false);
        const page = '<html><body>' + 'x'.repeat(300) + '</body></html>';
        assert.strictEqual(r.convertir(page), page, 'la page passe telle quelle');
        assert.throws(() => r.convertir('{"code":422,"name":"AssertionFailureError","message":"x"}'), /jina/);
        assert.strictEqual(F.adapterJina('https://fbstream.is/stream/hockey'), null,
            'dans le navigateur, la requête Jina ordinaire suffit déjà');
        ok('fbstream : relais HTML côté serveur, navigateur inchangé');
    }

    // ── 4. fetchPage dans le navigateur : direct fermé, Jina adapté ─────────
    {
        const vus = [];
        const vrai = globalThis.fetch;
        globalThis.fetch = (u, init) => {
            vus.push({ u: String(u), h: (init && init.headers) || {} });
            if (String(u).indexOf('https://r.jina.ai/https://onhockey.tv/') === 0) {
                return Promise.resolve(new Response(MARKDOWN, { status: 200 }));
            }
            return Promise.reject(new TypeError('Failed to fetch'));   // CORS, ou proxy mort
        };
        try {
            const html = await U.fetchPage('https://onhockey.tv/schedule_table.php', { force: true });
            const jina = vus.find((v) => v.u.indexOf('https://r.jina.ai/') === 0);
            assert.ok(jina, 'Jina doit être essayé : ' + JSON.stringify(vus.map((v) => v.u)));
            assert.strictEqual(jina.h['X-Referer'], 'https://onhockey.tv/');
            assert.strictEqual(jina.h['X-Return-Format'], 'markdown');
            assert.deepStrictEqual(signature(scrapers.parseOnHockey(html)), signature(scrapers.parseOnHockey(HTML)));
        } finally {
            globalThis.fetch = vrai;
        }
        ok('fetchPage rend la grille d\'OnHockey par Jina, en forme d\'origine');
    }

    console.log(`unit_relais: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

/* Tests unitaires du moteur générique d'extraction (js/extractors.js).

   L'enjeu : le moteur ne doit connaître AUCUN site. Les fixtures ci-dessous
   reproduisent donc les quatre façons dont les agrégateurs publient un lecteur —
   iframe posée, bouton qui remplace l'iframe, blob JSON, adresse encodée — sur
   des domaines inventés. Si un test ne passe qu'en nommant un site réel, c'est
   que la généricité est perdue. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
    for (const k of ['window', 'document', 'DOMParser', 'navigator', 'HTMLElement']) {
        Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
    }

    const X = await import('../js/extractors.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const urls = (list) => list.map((l) => l.url);
    const find = (list, part) => list.find((l) => l.url.indexOf(part) >= 0);

    const PAGE = 'https://aggregator.test/game/alpha-vs-beta';

    // ── 1. Iframe posée directement dans la page ───────────────────────────
    {
        const html = `<html><body>
          <iframe src="https://cdn-player.test/embed/abc123" title="Server 1"></iframe>
        </body></html>`;
        const out = X.extractPlayers(html, PAGE);
        const hit = find(out, 'cdn-player.test');
        assert.ok(hit, 'iframe trouvée');
        assert.strictEqual(hit.via, 'iframe');
        assert.strictEqual(hit.kind, 'embed');
        ok('iframe directe → lecteur intégrable');
    }

    // ── 2. Bouton qui remplace l'iframe (data-*) ───────────────────────────
    //     Aucun nom d'attribut connu : c'est data-feed, inventé pour le test.
    {
        const html = `<html><body>
          <div class="servers">
            <button class="server-btn" data-feed="https://streamhost.test/player.php?id=77">Server 2 · 1080p</button>
            <button class="server-btn" data-feed="https://other.test/embed/xyz">Server 3</button>
          </div>
          <iframe id="frame" src="about:blank"></iframe>
        </body></html>`;
        const out = X.extractPlayers(html, PAGE);
        assert.ok(find(out, 'streamhost.test'), 'bouton data-* trouvé');
        assert.ok(find(out, 'other.test'), 'second bouton trouvé');
        assert.strictEqual(find(out, 'streamhost.test').via, 'switcher');
        assert.strictEqual(find(out, 'streamhost.test').kind, 'embed');
        assert.ok(/Server 2/.test(find(out, 'streamhost.test').label), 'libellé du bouton conservé');
        ok('bouton avec attribut data-* inconnu → lecteur intégrable');
    }

    // ── 3. Bouton dont l'adresse est dans le gestionnaire onclick ──────────
    {
        const html = `<html><body>
          <a href="javascript:void(0)" onclick="loadStream('https://jshost.test/live/45');return false;">Lien 4 HD</a>
        </body></html>`;
        const out = X.extractPlayers(html, PAGE);
        const hit = find(out, 'jshost.test');
        assert.ok(hit, 'adresse extraite du onclick');
        assert.strictEqual(hit.via, 'switcher');
        ok('adresse citée dans onclick → récoltée');
    }

    // ── 4. Blob JSON générique (clés jamais nommées dans le code) ──────────
    {
        const html = `<html><body><script>
          var whateverName = [{"label":"Flux A HD","kind":"external","value":"https://jsonhost.test/embed/1"},
                              {"label":"Flux B","kind":"external","value":"https://jsonhost.test/embed/2"}];
        </script></body></html>`;
        const out = X.extractPlayers(html, PAGE);
        assert.ok(find(out, '/embed/1'), 'premier flux JSON');
        assert.ok(find(out, '/embed/2'), 'second flux JSON');
        assert.ok(/Flux A/.test(find(out, '/embed/1').label), 'libellé voisin repris');
        ok('tableau JSON à clés inconnues → flux récoltés et nommés');
    }

    // ── 5. Charge utile Next.js découpée en morceaux ───────────────────────
    {
        const html = `<html><body>
          <script>self.__next_f.push([1,"{\\"iframeStreams\\":[{\\"name\\":\\"Serveur 1\\",\\"src\\":\\"https://nextplayer.test/embed/a\\"}]}"])</script>
        </body></html>`;
        const out = X.extractPlayers(html, PAGE);
        assert.ok(find(out, 'nextplayer.test'), 'flux Next.js récolté');
        ok('charge utile Next.js recollée → flux récolté');
    }

    // ── 6. Adresse encodée en base64 ───────────────────────────────────────
    {
        const b64 = Buffer.from('https://b64host.test/embed/secret').toString('base64');
        const html = `<html><body><div data-src="${b64}">Server X</div></body></html>`;
        const out = X.extractPlayers(html, PAGE);
        assert.ok(find(out, 'b64host.test'), 'base64 décodé');
        ok('adresse base64 dans un data-* → décodée');
    }

    // ── 7. Lien vers un autre domaine, sans iframe ─────────────────────────
    {
        const html = `<html><body><a href="https://externalplayer.test/stream/99">Watch HD</a></body></html>`;
        const out = X.extractPlayers(html, PAGE);
        assert.ok(find(out, 'externalplayer.test'), 'lien externe conservé');
        ok('lien vers un domaine externe → conservé');
    }

    // ── 8. Ce qui doit être écarté ─────────────────────────────────────────
    {
        const html = `<html><body>
          <a href="https://x.com/someone">Follow us</a>
          <a href="https://bet365.com/promo">Bet now</a>
          <a href="https://cdn.test/logo.png">image</a>
          <a href="https://aggregator.test/">Accueil</a>
          <a href="https://aggregator.test/nba-streams">NBA Streams</a>
          <a href="https://partner.test/index.php">Index</a>
        </body></html>`;
        const out = X.extractPlayers(html, PAGE);
        const kept = urls(out);
        assert.ok(!kept.some((u) => u.indexOf('x.com') >= 0), 'réseau social écarté');
        assert.ok(!kept.some((u) => u.indexOf('bet365') >= 0), 'pari écarté');
        assert.ok(!kept.some((u) => u.indexOf('.png') >= 0), 'image écartée');
        assert.ok(!kept.some((u) => u === 'https://aggregator.test/'), 'racine écartée');
        assert.ok(!kept.some((u) => u.indexOf('nba-streams') >= 0), 'page de navigation écartée');
        assert.ok(!kept.some((u) => u.indexOf('index.php') >= 0), 'page d\'index écartée');
        ok('réseaux sociaux, paris, ressources, racines et pages de navigation écartés');
    }

    // ── 9. Le classement embed / page ──────────────────────────────────────
    {
        const html = `<html><body>
          <iframe src="https://good-player.test/embed/1"></iframe>
          <a href="https://someblog.test/article/preview-alpha-beta">Match preview</a>
        </body></html>`;
        const out = X.extractPlayers(html, PAGE);
        assert.strictEqual(find(out, 'good-player.test').kind, 'embed');
        const blog = find(out, 'someblog.test');
        if (blog) assert.strictEqual(blog.kind, 'page', 'lien faible classé « page », pas « embed »');
        ok('un lien faible est classé « page » (onglet) et non « embed »');
    }

    // ── 10. Le registre appris déclasse un hôte qui refuse l'intégration ───
    {
        const html = `<iframe src="https://refuses.test/embed/1"></iframe>`;
        const reg = X.createRegistry([]);
        let out = X.extractPlayers(html, PAGE, { registry: reg });
        assert.strictEqual(out[0].kind, 'embed', 'intégrable avant apprentissage');

        X.noteEmbedResult(reg, 'refuses.test', false);
        X.noteEmbedResult(reg, 'refuses.test', false);
        out = X.extractPlayers(html, PAGE, { registry: reg });
        assert.strictEqual(out[0].kind, 'page', 'déclassé après deux refus');
        ok('deux refus d\'intégration → l\'hôte bascule en ouverture d\'onglet');
    }

    // ── 11. Un hôte de lecteur connu remonte au-dessus d'un lien quelconque ─
    {
        const html = `<html><body>
          <a href="https://randomsite.test/watch/thing">Watch</a>
          <a href="https://embedsports.me/nhl/alpha-stream-1">Link 1</a>
        </body></html>`;
        const out = X.extractPlayers(html, PAGE, { registry: X.createRegistry() });
        assert.ok(out[0].url.indexOf('embedsports.me') >= 0, 'hôte connu en tête');
        ok('un hôte de lecteur connu est classé avant un lien quelconque');
    }

    // ── 12. <base href> : les liens relatifs se résolvent contre lui ────────
    {
        const html = `<html><head><base href="https://real-base.test/app/"></head><body>
          <iframe src="embed/42"></iframe></body></html>`;
        const out = X.extractPlayers(html, 'https://aggregator.test/some/deep/page');
        assert.ok(find(out, 'https://real-base.test/app/embed/42'), 'résolu contre <base href>');
        ok('les liens relatifs se résolvent contre <base href>');
    }

    // ── 13. Dédoublonnage réel entre stratégies ────────────────────────────
    {
        const html = `<html><body>
          <iframe src="https://dup.test/embed/1"></iframe>
          <a href="http://www.dup.test/embed/1/">même lecteur</a>
        </body></html>`;
        const out = X.extractPlayers(html, PAGE);
        const dups = out.filter((l) => l.url.indexOf('dup.test') >= 0);
        assert.strictEqual(dups.length, 1, 'une seule entrée');
        assert.strictEqual(dups[0].via, 'iframe', 'la provenance la plus forte est conservée');
        ok('même lecteur vu par deux stratégies → une entrée, provenance la plus forte');
    }

    /* ── Navigation du site vs page de match ─────────────────────────────────
       Le filtre de navigation n'acceptait que des slugs sans chiffre, si bien que
       « /watch-ligue-1-streams/ » et « /watch-f1-streams/ » — le MENU de Sportsurge et
       Soccersurge — étaient retenus comme des flux et attachés à n'importe quel match :
       une rencontre de football universitaire portait des liens vers la Ligue 1 et la F1.
       Relevé sur le cache du 4 septembre 2026 : 180 liens de menu ainsi ramassés. */
    {
        const PAGE = 'https://v2.sportsurge.net/watch-63166-cfb-rockford-regents-beloit-college/';
        const ctx = { pageUrl: PAGE, pageHost: 'v2.sportsurge.net', matchUrl: PAGE, registry: null };
        const verdict = (url) => X.scoreCandidate({ url, label: '', via: 'anchor' }, ctx).kind;

        // Le menu du site, avec et sans chiffre dans le slug : rejeté dans les deux cas.
        ['https://v2.sportsurge.net/watch-nfl-streams/',
         'https://v2.sportsurge.net/watch-boxing-streams/',
         'https://soccersurge.io/watch-ligue-1-streams/',
         'https://soccersurge.io/watch-peruvian-liga-1-streams/',
         'https://v2.sportsurge.net/watch-f1-streams/'].forEach((u) => {
            assert.strictEqual(verdict(u), 'reject', 'page de menu retenue : ' + u);
        });
        ok('les pages de menu sont rejetées, chiffre dans le slug ou non');
    }
    {
        /* L'élargissement ne devait pas emporter les vraies pages de match, qui finissent
           elles aussi par « -stream ». C'est l'exception posée à l'usage (`/watch/`,
           `-vs-`, `/game/`, `/embed`) qui les protège. */
        const PAGE = 'https://mlbbite.plus/';
        const ctx = { pageUrl: PAGE, pageHost: 'mlbbite.plus', matchUrl: PAGE, registry: null };
        const verdict = (url) => X.scoreCandidate({ url, label: '', via: 'anchor' }, ctx).kind;

        assert.notStrictEqual(verdict('https://mlbbite.plus/watch/live/milwaukee-brewers-at-chicago-cubs-34-free-live-stream'),
            'reject', 'une page de match ne doit pas être prise pour du menu');
        assert.notStrictEqual(verdict('https://embedsports.me/college-football/arkansas-pine-bluff-vs-25-missouri-stream-1'),
            'reject', 'ni un lecteur dont le chemin finit par « stream-1 »');
        ok('les pages de match et les lecteurs survivent au filtre de navigation');
    }

    console.log(`\nTous les ${n} tests du moteur d'extraction passent.`);
}

main().catch((e) => { console.error(e); process.exit(1); });

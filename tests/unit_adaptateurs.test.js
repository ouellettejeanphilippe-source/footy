/* Un fichier par domaine : le contrat des adaptateurs (js/sources/).

   « Chaque domaine doit donc être différent dans le système de fetch and parse »
   (6 septembre 2026). Les agrégateurs ne se ressemblent pas : l'un rend ses flux dans une
   charge Next.js, l'autre dans une iframe, un troisième dans une API JSON ; et la chaîne
   qui mène à la vidéo diffère aussi. Ces formes vivaient dans UNE fonction de 582 lignes
   à branches par hôte — le nid à régressions qu'on vient de démêler plusieurs fois.

   Ce test verrouille trois choses : le registre trouve le bon adaptateur, l'adaptateur
   lit bien son domaine, et il n'importe rien du module central (un import circulaire
   ferait retirer tout le graphe des modules derrière chaque adaptateur). */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RACINE = path.join(__dirname, '..');

/* Charge utile Next.js telle que footybite la sert, réduite à l'essentiel. */
const PAGE_FOOTYBITE = `<html><body><main>
<script>self.__next_f.push([1,"{\\"directStreams\\":[{\\"link\\":\\"https://ytstreams.club/YT155/embed/10.html\\",\\"name\\":\\"Stream 1 HD\\"}],\\"iframeStreams\\":[{\\"src\\":\\"https://goomdstea.click/stream.php?ch=12\\",\\"name\\":\\"Serveur 2\\"}]}"])</script>
</main></body></html>`;

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
    const w = dom.window;
    w.__NO_AUTOSTART__ = true;
    for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
        Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

    const registre = await import('../js/sources/index.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    // ── 1. Le registre reconnaît son domaine, et lui seul ────────────────────
    assert.ok(registre.adaptateurPour('footybite.im'), 'footybite.im doit avoir un adaptateur');
    assert.ok(registre.adaptateurPour('www.footybite.bid'), 'un autre suffixe du même site aussi');
    assert.strictEqual(registre.adaptateurPour('embed.st'), null, 'un hôte de lecteur n\'est pas une source');
    assert.ok(registre.adaptateurPour('onhockey.tv'), 'onhockey a son fichier');
    assert.ok(registre.adaptateurPour('v2.gostreameast.is') || registre.adaptateurPour('streameast.ps'), 'streameast aussi');
    assert.ok(registre.adaptateurPour('vipleague.me'), 'vipleague aussi');
    assert.ok(registre.adaptateurPour('www.liveleagues.me'), 'liveleagues (7 septembre 2026) aussi');
    assert.strictEqual(registre.adaptateurPour(''), null);
    assert.strictEqual(registre.adaptateurPour(null), null);
    ok('le registre trouve le bon adaptateur, et rend null pour le reste');

    // ── 2. L'adaptateur lit son domaine ─────────────────────────────────────
    const adaptateur = registre.adaptateurPour('footybite.im');
    const doc = new DOMParser().parseFromString(PAGE_FOOTYBITE, 'text/html');
    const liens = adaptateur.extraireLiens({
        html: PAGE_FOOTYBITE,
        doc: doc,
        match: { matchUrl: 'https://footybite.im/game/a-vs-b-1', homeTeam: 'A', awayTeam: 'B', league: 'Premier League' },
        pageText: '',
        pageLiens: [],
        aides: { estPageDeMatchOuLigue: () => false, qualite: () => 'HD' }
    });
    const urls = liens.map((l) => l.url);
    assert.ok(urls.includes('https://ytstreams.club/YT155/embed/10.html'), 'directStreams lu : ' + urls.join(' '));
    assert.ok(urls.includes('https://goomdstea.click/stream.php?ch=12'), 'iframeStreams lu : ' + urls.join(' '));
    ok('l\'adaptateur footybite lit les deux formes de sa charge Next.js');

    // ── 3. Le second point d'entrée : filtrer plutôt qu'extraire ─────────────
    /* VIPLeague ne sert AUCUN lecteur dans son HTML : il charge tout en JavaScript
       derrière un jeton CSRF. Ce domaine n'apporte donc pas un extracteur mais un filtre
       sur la récolte du moteur générique — d'où deux points d'entrée au contrat. */
    const vip = registre.adaptateurPour('vipleague.me');
    assert.ok(vip && typeof vip.filtrerLiens === 'function', 'vipleague fournit un filtre');
    assert.strictEqual(typeof vip.extraireLiens, 'undefined', 'et pas d\'extracteur');
    const garde = vip.filtrerLiens([
        { url: 'https://vipleague.me/now-playing/football/a-vs-b' },
        { url: 'https://vipleague.me/vl' },
        { url: 'https://pub.exemple.test/banniere' },
        null
    ]).map((l) => l.url);
    assert.deepStrictEqual(garde, ['https://vipleague.me/now-playing/football/a-vs-b'],
        'seuls les liens du domaine restent, sa page d\'index exclue');
    ok('un domaine peut n\'apporter qu\'un filtre (VIPLeague)');

    // ── 3 bis. Liveleagues : extraire ET filtrer ──────────────────────────────
    /* Même moteur que VIPLeague, mais ce domaine annonce ses diffusions en `data-uri`
       (invisible au moteur générique, qui lit les `href`). Le filtre écarte ensuite ce
       que le moteur aurait ramassé d'autre sur la page (publicités, site frère). */
    const ll = registre.adaptateurPour('www.liveleagues.me');
    assert.strictEqual(typeof ll.extraireLiens, 'function');
    assert.strictEqual(typeof ll.filtrerLiens, 'function');
    const pageLl = `<div>
      <a class="btn btn-link" data-uri="/fiba/nigeria-w-vs-france-w-1-live-streaming" data-open="_self">Broadcast 1  <span class="badge rounded-pill bg-danger ms-1">HD</span></a>
      <a class="btn btn-link" data-uri="/fiba/nigeria-w-vs-france-w-2-live-streaming" data-open="_self">Broadcast 2  </a>
      <a class="dropdown-item" data-uri="/fiba/nigeria-w-vs-france-w-1-live-streaming">Broadcast 1 <span class="badge">HD</span></a>
      <a data-uri="/chats-list">Chat</a>
    </div>`;
    const docLl = new DOMParser().parseFromString(pageLl, 'text/html');
    const liensLl = ll.extraireLiens({
        html: pageLl, doc: docLl,
        match: { matchUrl: 'https://www.liveleagues.me/fiba/tag-nigeria-w-vs-france-w-live', homeTeam: 'Nigeria', awayTeam: 'France', league: 'FIBA World Cup' },
        pageText: '', pageLiens: [],
        aides: { estPageDeMatchOuLigue: () => false, qualite: (t) => (/hd/i.test(t) ? 'HD' : 'SD') }
    });
    assert.deepStrictEqual(liensLl.map((l) => l.name + ' ' + l.quality + ' ' + l.url), [
        'Broadcast 1 HD https://www.liveleagues.me/fiba/nigeria-w-vs-france-w-1-live-streaming',
        'Broadcast 2 SD https://www.liveleagues.me/fiba/nigeria-w-vs-france-w-2-live-streaming'
    ], 'deux diffusions, la répétition du menu mobile et la page de chat écartées');
    const gardeLl = ll.filtrerLiens([
        { url: 'https://www.liveleagues.me/fiba/nigeria-w-vs-france-w-1-live-streaming' },
        { url: 'https://www.liveleagues.me/fiba/tag-nigeria-w-live' },
        { url: 'https://mlbbox.me' },
        { url: 'https://hai8g.com/4/8553101' },
        null
    ]).map((l) => l.url);
    assert.deepStrictEqual(gardeLl, ['https://www.liveleagues.me/fiba/nigeria-w-vs-france-w-1-live-streaming'],
        'seules les diffusions du domaine restent');
    ok('Liveleagues extrait ses diffusions (data-uri) et filtre le reste');

    // ── 4. Aucun adaptateur ne remonte vers le module central ────────────────
    /* Un adaptateur qui importerait js/scrapers.js créerait un cycle : le module central
       importe le registre, qui importe l'adaptateur. Même chose en passant par js/utils.js
       ou js/config.js, qui remontent tous deux vers le module central (vérifié le
       6 septembre 2026 : utils importe scrapers, config importe utils). Les modules
       feuilles — db, match, teams, extractors — sont sûrs.

       Tout le contexte dont un adaptateur a besoin lui est PASSÉ (ctx) pour que cette
       règle tienne : OnHockey reçoit ainsi le parseur de liste de son domaine et
       l'appariement, au lieu de les importer. */
    const REMONTENT = ['scrapers.js', 'utils.js', 'config.js'];
    const dossier = path.join(RACINE, 'js', 'sources');
    const fichiers = fs.readdirSync(dossier).filter((f) => f.endsWith('.js') && f !== 'index.js');
    assert.ok(fichiers.length >= 5, 'les cinq domaines à forme propre ont leur fichier');
    for (const f of fichiers) {
        const src = fs.readFileSync(path.join(dossier, f), 'utf8');
        const imports = [...src.matchAll(/^\s*import\s.*?from\s+['"]([^'"]+)['"]/gm)].map((x) => x[1]);
        for (const cible of imports) {
            const base = cible.split('/').pop();
            assert.ok(!REMONTENT.includes(base), f + ' importe ' + cible + ' : ce module remonte vers js/scrapers.js, donc cycle');
        }
    }
    ok('aucun adaptateur ne remonte vers le module central (' + fichiers.length + ' fichiers vérifiés)');

    console.log(`unit_adaptateurs: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

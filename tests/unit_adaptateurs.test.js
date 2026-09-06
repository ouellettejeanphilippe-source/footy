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

    // ── 3. Aucun adaptateur n'importe le module central ──────────────────────
    /* Un adaptateur qui importerait js/scrapers.js créerait un cycle : le module central
       importe le registre, qui importe l'adaptateur. Tout le contexte dont un adaptateur
       a besoin lui est PASSÉ (ctx), précisément pour que cette règle tienne. */
    const dossier = path.join(RACINE, 'js', 'sources');
    const fichiers = fs.readdirSync(dossier).filter((f) => f.endsWith('.js') && f !== 'index.js');
    assert.ok(fichiers.length > 0, 'au moins un adaptateur');
    for (const f of fichiers) {
        const src = fs.readFileSync(path.join(dossier, f), 'utf8');
        const imports = [...src.matchAll(/^\s*import\s.*?from\s+['"]([^'"]+)['"]/gm)].map((x) => x[1]);
        for (const cible of imports) {
            assert.ok(!/scrapers\.js$/.test(cible), f + ' importe le module central (' + cible + ') : import circulaire');
            assert.ok(!/\.\.\//.test(cible), f + ' remonte hors de js/sources/ (' + cible + ') : un adaptateur ne connaît que son domaine');
        }
    }
    ok('aucun adaptateur ne remonte vers le module central (' + fichiers.length + ' fichier(s) vérifié(s))');

    console.log(`unit_adaptateurs: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

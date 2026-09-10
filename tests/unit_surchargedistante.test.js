/* Surcharge vivante de la structure des sources et des listes d'hôtes
   (js/config.js : appliquerSurchargeSources, sourcesActives ;
    js/extractors.js : appliquerHotesDistants).

   « Que ça se répare sans toujours faire du code » (10 septembre 2026).

   `domains.json` ne portait que des ADRESSES. Un site qui renumérote ses sous-pages
   (« mlb-streams-live-10 » → « ...-11 »), qui déplace ses matchs de l'accueil vers des
   pages par sport, ou qu'il faut couper parce que son domaine racheté sert de la
   publicité, demandait de modifier `SCRAPERS_CONFIG`, de publier, et de faire redescendre
   une version du service worker sur tous les appareils. Le fichier, lui, est relu à
   chaque démarrage : une réparation y est effective en cinq secondes.

   Ce que ce test verrouille : la surcharge fait ce qu'elle annonce, et surtout un
   fichier MALFORMÉ ne casse rien — une valeur invalide est ignorée sans emporter la
   source qui marchait, parce que ce fichier est écrit à la main, en urgence, souvent
   depuis un téléphone. */
const assert = require('assert');
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

    await import('../js/scrapers.js');   // fixe l'ordre d'évaluation du cycle de modules
    const cfg = await import('../js/config.js');
    const ext = await import('../js/extractors.js');
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const source = (id) => cfg.SCRAPERS_CONFIG.find((s) => s.id === id);

    const pagesInitiales = JSON.parse(JSON.stringify(source('buffstreams').pages));

    // ── 1. Renuméroter une sous-page sans toucher au code ────────────────────
    let touches = cfg.appliquerSurchargeSources({
        buffstreams: { pages: [{ path: 'mlb-streams-live-11', sports: ['mlb'] }] }
    });
    assert.deepStrictEqual(touches, ['buffstreams']);
    assert.deepStrictEqual(source('buffstreams').pages, [{ path: 'mlb-streams-live-11', sports: ['mlb'] }]);
    const pages = cfg.getSourcePages(source('buffstreams'), null, '');
    assert.ok(pages.some((p) => p.url.indexOf('mlb-streams-live-11') > 0),
        'getSourcePages lit bien la nouvelle adresse, c\'est elle qui sera téléchargée');
    ok('une sous-page renumérotée se corrige depuis domains.json');

    // ── 2. Couper une source en panne ────────────────────────────────────────
    cfg.appliquerSurchargeSources({ methstreams: { enabled: false } });
    assert.deepStrictEqual(cfg.SOURCES_DESACTIVEES, ['methstreams']);
    assert.ok(!cfg.sourcesActives().some((s) => s.id === 'methstreams'), 'la source coupée n\'est plus lue');
    assert.ok(cfg.sourcesActives().length === cfg.SCRAPERS_CONFIG.length - 1, 'et elle seule');
    assert.ok(source('methstreams'), 'elle reste déclarée : couper n\'est pas supprimer');
    ok('une source peut être coupée sans publier de version');

    // ── 3. Un appel suivant remet le compteur à zéro ─────────────────────────
    cfg.appliquerSurchargeSources({});
    assert.deepStrictEqual(cfg.SOURCES_DESACTIVEES, [], 'retirer la coupure du fichier la lève');
    assert.strictEqual(cfg.sourcesActives(), cfg.SCRAPERS_CONFIG, 'sans coupure, aucune copie de liste');
    ok('lever une coupure ne demande que de retirer la ligne');

    // ── 4. Un fichier malformé n'emporte rien ────────────────────────────────
    cfg.appliquerSurchargeSources({
        buffstreams: { pages: 'pas-un-tableau' },              // type faux
        footybite: { pages: [{ sports: ['mlb'] }] },           // pas de chemin
        streameast: { pages: [{ path: 'javascript:alert(1)' }] },
        vipleague: { discoverPages: 'sans groupe de capture' },
        liveleagues: { discoverPages: '([' },                  // regex illégale
        sportsurge: { homepageHasMatches: 'oui' },             // pas un booléen
        inconnue: { enabled: false }                           // source qui n'existe pas
    });
    assert.deepStrictEqual(source('buffstreams').pages, [{ path: 'mlb-streams-live-11', sports: ['mlb'] }],
        'une liste de pages malformée laisse la précédente en place');
    assert.ok(source('footybite').pages === undefined || !source('footybite').pages.length,
        'une page sans chemin n\'est pas retenue');
    assert.ok(!(source('streameast').pages || []).some((p) => /javascript:/i.test(p.path)),
        'un chemin en javascript: est refusé');
    assert.ok(!source('vipleague').discoverPages, 'une regex sans groupe de capture est refusée');
    assert.ok(!source('liveleagues').discoverPages, 'une regex illégale est refusée, sans lever');
    assert.strictEqual(source('sportsurge').homepageHasMatches, false,
        'une valeur qui n\'est pas un booléen laisse la précédente');
    assert.deepStrictEqual(cfg.SOURCES_DESACTIVEES, [], 'une source inconnue ne s\'invente pas');
    ok('un fichier à moitié faux est ignoré ligne par ligne, sans casser ce qui marchait');

    // ── 5. Rien du tout : aucun effet ────────────────────────────────────────
    [undefined, null, 'texte', 42, []].forEach((valeur) => {
        assert.deepStrictEqual(cfg.appliquerSurchargeSources(valeur), []);
    });
    ok('un bloc absent ou du mauvais type ne fait rien');

    // ── 6. Listes d'hôtes : écarter une régie sans code ──────────────────────
    const compte = ext.appliquerHotesDistants({ junk: ['nouvelle-regie.tv', 'WWW.Autre.Test', 'pas une url', ''], players: ['newembed.st'] });
    assert.deepStrictEqual(compte, { junk: 2, players: 1 }, 'les entrées qui ne sont pas des hôtes sont ignorées');
    assert.ok(ext.hoteDansListe('nouvelle-regie.tv', ext.HOTES_EXCLUS_SUP));
    assert.ok(ext.hoteDansListe('cdn.nouvelle-regie.tv', ext.HOTES_EXCLUS_SUP), 'les sous-domaines suivent');
    assert.ok(ext.hoteDansListe('autre.test', ext.HOTES_EXCLUS_SUP), '« www. » est normalisé');
    assert.ok(!ext.hoteDansListe('faussenouvelle-regie.tv', ext.HOTES_EXCLUS_SUP),
        'un hôte qui se TERMINE par le nom sans point de séparation n\'est pas le même');

    const ctx = { pageUrl: 'https://site.test/match/a-vs-b', registry: ext.createRegistry() };
    const rejete = ext.scoreCandidate({ url: 'https://nouvelle-regie.tv/embed/1', via: 'iframe' }, ctx);
    assert.strictEqual(rejete.kind, 'reject', 'un hôte écarté par le fichier ne peut plus être servi comme lecteur');

    const declare = ext.scoreCandidate({ url: 'https://newembed.st/live/77', via: 'anchor' }, ctx);
    const inconnu = ext.scoreCandidate({ url: 'https://inconnu.st/live/77', via: 'anchor' }, ctx);
    assert.ok(declare.score > inconnu.score, 'un lecteur déclaré part avec de l\'avance, dès la première rencontre');
    ok('les listes d\'hôtes se corrigent depuis domains.json, sous-domaines compris');

    // ── 7. Remise en état pour les autres tests du même processus ────────────
    ext.appliquerHotesDistants({});
    assert.deepStrictEqual(ext.HOTES_EXCLUS_SUP, []);
    source('buffstreams').pages = pagesInitiales;
    ok('un bloc vide efface la surcharge précédente');

    console.log(`unit_surchargedistante: ${n} groupes de tests OK`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

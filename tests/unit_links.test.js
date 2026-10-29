/* Tests unitaires de l'inventaire des liens (js/links.js).

   `primaryDomain` décide de la maille de l'inventaire. Un sous-domaine compté à part
   (embed1.exemple.com ≠ embed2.exemple.com) éclate un fournisseur unique en dix lignes de
   statistiques et rend le compte inutilisable — c'est justement ce que faisait
   `getDomain`, qui rend le nom d'hôte complet et reste employé ailleurs pour les
   préférences par hôte. Puis l'agrégation par domaine et les matchs relançables.

   (Les sections 4 à 6, sur la reconstruction de page de js/embed-bridge.js, sont parties
   avec elle le 29 octobre 2026 : plus aucun appelant dans l'application.)

   Aucun nom de site réel : les fixtures utilisent des domaines inventés. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  // js/links.js pose ses liaisons sur `window` : un DOM de jsdom le lui donne.
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'HTMLElement']) {
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  }

  const L = await import('../js/links.js');

  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ── 1. Domaine enregistrable ──────────────────────────────────────────────
  {
    assert.strictEqual(L.primaryDomain('https://player.embed.exemple.test/x/y'), 'exemple.test');
    assert.strictEqual(L.primaryDomain('https://exemple.test/'), 'exemple.test');
    assert.strictEqual(L.primaryDomain('http://WWW.Exemple.TEST/a'), 'exemple.test');
    // Suffixe public à deux niveaux : le domaine acheté en comporte trois.
    assert.strictEqual(L.primaryDomain('https://a.b.diffusion.co.uk/p'), 'diffusion.co.uk');
    assert.strictEqual(L.primaryDomain('https://diffusion.co.uk/p'), 'diffusion.co.uk');
    // Adresse sans protocole, telle qu'un scraper la ramène parfois.
    assert.strictEqual(L.primaryDomain('//cdn.lecteur.test/embed/1'), 'lecteur.test');
    assert.strictEqual(L.primaryDomain('lecteur.test/embed/1'), 'lecteur.test');
    // Adresse IP : rendue telle quelle, elle identifie bien un hôte.
    assert.strictEqual(L.primaryDomain('http://203.0.113.7:8080/x'), '203.0.113.7');
    ok('primaryDomain replie les sous-domaines sur le domaine enregistrable');
  }
  {
    // Entrées inexploitables : jamais d'exception, jamais de faux fournisseur.
    ['', null, undefined, 42, 'Page du match', 'localhost'].forEach((bad) => {
      assert.strictEqual(L.primaryDomain(bad), '', 'entrée rejetée : ' + String(bad));
    });
    ok('primaryDomain ignore ce qui n\'est pas un nom de domaine');
  }

  // ── 2. Agrégation par domaine ─────────────────────────────────────────────
  const matches = [
    {
      id: 'm1', status: 'live', matchUrl: 'https://source.test/game/1',
      streamLinks: [
        { url: 'https://a.lecteur.test/embed/1' },
        { url: 'https://b.lecteur.test/embed/2' },
        { url: 'https://autre.test/watch', topLevel: true }
      ]
    },
    {
      id: 'm2', status: 'upcoming', matchUrl: 'https://source.test/game/2',
      streamLinks: [{ url: 'https://a.lecteur.test/embed/3' }]
    },
    { id: 'm3', status: 'upcoming', matchUrl: 'https://source.test/game/3', streamLinks: [] },
    { id: 'm4', status: 'finished', matchUrl: 'https://source.test/game/4', streamLinks: [] },
    { id: 'm5', status: 'upcoming', streamLinks: [] }
  ];

  {
    const stats = L.streamDomainStats(matches);
    assert.strictEqual(stats.length, 2);
    assert.strictEqual(stats[0].domain, 'lecteur.test');
    assert.strictEqual(stats[0].links, 3, 'trois liens malgré deux sous-domaines');
    assert.strictEqual(stats[0].matches, 2, 'présents dans deux matchs');
    assert.strictEqual(stats[0].embeds, 3);
    assert.strictEqual(stats[0].pages, 0);
    assert.deepStrictEqual(stats[0].hosts.sort(), ['a.lecteur.test', 'b.lecteur.test']);
    assert.strictEqual(stats[1].domain, 'autre.test');
    assert.strictEqual(stats[1].pages, 1, 'un lien « page », non intégrable');
    ok('streamDomainStats compte liens, matchs et liens non intégrables par domaine');
  }
  {
    // Le tri décroissant est ce qui met en tête le fournisseur qui porte l'inventaire.
    const stats = L.streamDomainStats(matches);
    assert.ok(stats[0].links >= stats[1].links, 'trié par nombre de liens décroissant');
    assert.deepStrictEqual(L.streamDomainStats([]), []);
    assert.deepStrictEqual(L.streamDomainStats(null), []);
    ok('streamDomainStats tolère une grille vide');
  }
  {
    const one = L.matchDomainStats(matches[0]);
    assert.strictEqual(one.length, 2);
    assert.strictEqual(one[0].links, 2, 'ce match seul porte deux liens lecteur.test');
    ok('matchDomainStats se limite au match demandé');
  }

  // ── 3. Matchs relançables ─────────────────────────────────────────────────
  {
    const missing = L.matchesWithoutLinks(matches).map((m) => m.id);
    // m3 : sans lien mais avec une page de match → relançable.
    // m4 : terminé, ses pages ont disparu des agrégateurs → inutile d'y dépenser des requêtes.
    // m5 : aucune page connue → rien à interroger.
    assert.deepStrictEqual(missing, ['m3']);
    ok('matchesWithoutLinks écarte les matchs terminés et ceux sans page connue');
  }

  console.log('unit_links: ' + n + ' groupes de tests OK');
}

main().catch((e) => { console.error(e); process.exit(1); });

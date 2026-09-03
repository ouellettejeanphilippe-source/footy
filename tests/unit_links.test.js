/* Tests unitaires de l'inventaire des liens (js/links.js) et du document reconstruit
   par le tour de passe-passe (js/embed-bridge.js).

   Deux logiques purement calculatoires, donc vérifiables sans navigateur ni réseau :

   1. `primaryDomain` décide de la maille de l'inventaire. Un sous-domaine compté à part
      (embed1.exemple.com ≠ embed2.exemple.com) éclate un fournisseur unique en dix
      lignes de statistiques et rend le compte inutilisable — c'est justement ce que
      faisait `getDomain`, qui rend le nom d'hôte complet et reste employé ailleurs pour
      les préférences par hôte.
   2. `buildEmbedDocument` doit poser `<base href>` (sans quoi toutes les adresses
      relatives de la page reconstruite viseraient l'application) et retirer la balise
      Content-Security-Policy de la page d'origine (qui, appliquée au document
      reconstruit, y interdirait souvent tout script).

   Aucun nom de site réel : les fixtures utilisent des domaines inventés. */
const assert = require('assert');

async function main() {
  const L = await import('../js/links.js');
  const B = await import('../js/embed-bridge.js');

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

  // ── 4. Document reconstruit ───────────────────────────────────────────────
  {
    const src = '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'">'
      + '<base href="https://ancien.test/"><title>T</title></head><body><iframe src="/p/1"></iframe></body></html>';
    const out = B.buildEmbedDocument(src, 'https://origine.test/match/7');

    assert.ok(out.indexOf('<base href="https://origine.test/match/7">') > -1,
      'la base pointe vers la page d\'origine, pas vers l\'application');
    assert.ok(out.indexOf('ancien.test') === -1, 'la base d\'origine est remplacée, pas doublée');
    assert.ok(!/http-equiv\s*=\s*"Content-Security-Policy"/i.test(out),
      'la CSP de la page est retirée : appliquée ici, elle bloquerait le lecteur');
    assert.ok(out.indexOf('<iframe src="/p/1">') > -1, 'le corps de la page est conservé');
    assert.ok(out.indexOf('<base') < out.indexOf('<iframe'), 'la base précède le contenu');
    ok('buildEmbedDocument réécrit la base et retire la CSP de la page');
  }
  {
    // Fragment sans <html> : le document doit rester valide malgré tout.
    const out = B.buildEmbedDocument('<div id="player"></div>', 'https://origine.test/x');
    assert.ok(/^<!doctype html>/i.test(out));
    assert.ok(out.indexOf('<base href="https://origine.test/x">') > -1);
    assert.ok(out.indexOf('<div id="player">') > -1);
    ok('buildEmbedDocument enveloppe un fragment HTML');
  }
  {
    // La cale doit précéder les scripts du site : c'est elle qui fournit un stockage
    // factice (origine opaque) et fait taire les gardes anti-encadrement.
    const out = B.buildEmbedDocument('<html><head></head><body><script>var a=1;<\/script></body></html>',
      'https://origine.test/y');
    assert.ok(out.indexOf('localStorage') > -1, 'cale de stockage présente');
    assert.ok(out.indexOf('localStorage') < out.indexOf('var a=1'), 'la cale précède les scripts du site');
    ok('buildEmbedDocument injecte sa cale avant les scripts de la page');
  }
  {
    // Le bac à sable ne doit jamais rendre son origine au document : avec
    // allow-same-origin, la page reconstruite lirait le localStorage de l'application.
    assert.ok(B.EMBED_SANDBOX.indexOf('allow-scripts') > -1);
    assert.ok(B.EMBED_SANDBOX.indexOf('allow-same-origin') === -1,
      'jamais allow-same-origin : le document reconstruit reste en origine opaque');
    ok('le bac à sable du document reconstruit exclut allow-same-origin');
  }

  console.log('unit_links: ' + n + ' groupes de tests OK');
}

main().catch((e) => { console.error(e); process.exit(1); });

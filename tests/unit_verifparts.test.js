/* La vérification des lecteurs en parts parallèles (js/playability.js : lirePart,
   partDesCibles, releveDe, appliquerReleves ; scripts/verify_players.mjs --part / --appliquer).

   « Rendre plus rapide… le taux de fonctionnement des streams » (29 octobre 2026). Une
   seule machine n'éprouvait qu'~88 cibles par passage ; trois machines prennent chacune
   une cible sur trois de la même liste, et une dernière étape applique leurs relevés au
   data/streams.json du moment. Ce qui doit tenir : les parts couvrent toute la liste sans
   se recouvrir, chacune a sa tranche des PREMIÈRES cibles, et un relevé appliqué plus tard
   donne au lien exactement ce que la vérification au fil de l'eau lui donnait — même si
   le fichier a bougé entre-temps. */
const assert = require('assert');

async function main() {
  const play = await import('../js/playability.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ── 1. lirePart ──────────────────────────────────────────────────────────
  assert.deepStrictEqual(play.lirePart('1/3'), { i: 1, n: 3 });
  assert.deepStrictEqual(play.lirePart(' 0/1 '), { i: 0, n: 1 });
  for (const faux of ['3/3', '4/3', '1/0', 'a/b', '', null, '1-3']) assert.strictEqual(play.lirePart(faux), null, String(faux));
  ok('lirePart : i/N avec 0 ≤ i < N, sinon null');

  // ── 2. partDesCibles : tout, une seule fois, en alternance ───────────────
  {
    const cibles = Array.from({ length: 10 }, (x, k) => ({ id: k }));
    const parts = [0, 1, 2].map((i) => play.partDesCibles(cibles, { i, n: 3 }));
    const ids = parts.flat().map((c) => c.id).sort((a, b) => a - b);
    assert.deepStrictEqual(ids, cibles.map((c) => c.id), 'les parts réunies redonnent toute la liste, sans doublon');
    assert.deepStrictEqual(parts.map((p) => p[0].id), [0, 1, 2], 'chaque part commence par une des toutes premières cibles');
    assert.deepStrictEqual(parts[0].map((c) => c.id), [0, 3, 6, 9], 'une sur trois, dans l\'ordre du classement');
    assert.deepStrictEqual(play.partDesCibles(cibles, null).length, 10, 'sans part : tout');
    assert.notStrictEqual(play.partDesCibles(cibles, null), cibles, 'une copie');
    ok('partDesCibles : les parts couvrent la liste sans se recouvrir, en alternance');
  }

  // ── 3. Un relevé appliqué plus tard = la vérification au fil de l'eau ────
  {
    const fichier = () => ({
      matches: [
        { streamLinks: [{ url: 'https://a.st/1', source: 'ppv' }, { url: 'https://b.st/1', source: 'fb', media: 'https://vieux.m3u8', mediaAt: 'x', hauteur: 480 }] },
        { streamLinks: [{ url: 'https://c.st/1' }] }
      ],
      hotesEcartes: { 'mort.st': { echantillon: 'https://mort.st/x', essaiAt: '2026-10-01T00:00:00Z' } }
    });
    const AT = '2026-10-29T00:00:00Z';
    const d0 = fichier();
    const releves = [
      play.releveDe({ matchIndex: 0, linkIndex: 0, host: 'a.st' }, d0.matches[0].streamLinks[0], { media: 'https://cdn.a/m.m3u8', mediaReferer: 'https://a.st/', hauteur: 1080 }, 'plays', AT),
      play.releveDe({ matchIndex: 0, linkIndex: 1, host: 'b.st' }, d0.matches[0].streamLinks[1], { media: 'https://ignore.m3u8', hauteur: 720 }, 'none', AT),
      play.releveDe({ host: 'mort.st', target: 'https://mort.st/x', ecarte: true }, null, {}, 'none', AT)
    ];
    assert.deepStrictEqual(releves[2], { host: 'mort.st', verdict: 'none', at: AT, ecarte: true }, 'un témoin ne porte que l\'hôte');
    assert.ok(!('media' in releves[1]) && !('hauteur' in releves[1]), 'un lien qui ne joue pas n\'emporte ni flux ni hauteur');

    const ledger = {}, sources = {};
    const stats = play.appliquerReleves(d0, releves, ledger, sources);
    assert.deepStrictEqual(stats, { appliques: 2, introuvables: 0, temoins: 1 });
    const [a, b] = d0.matches[0].streamLinks;
    assert.strictEqual(a.verified, 'plays'); assert.strictEqual(a.verifiedAt, AT);
    assert.strictEqual(a.media, 'https://cdn.a/m.m3u8'); assert.strictEqual(a.mediaAt, AT);
    assert.strictEqual(a.mediaReferer, 'https://a.st/'); assert.strictEqual(a.hauteur, 1080);
    assert.strictEqual(b.verified, 'none');
    assert.ok(!('media' in b) && !('mediaAt' in b) && !('hauteur' in b), 'l\'ancien flux d\'un lien qui ne joue plus est retiré');
    assert.strictEqual(d0.hotesEcartes['mort.st'].essaiAt, AT, 'le témoin date son essai');
    assert.strictEqual(d0.hotesEcartes['mort.st'].verdict, 'none');
    assert.deepStrictEqual(Object.keys(ledger).sort(), ['a.st', 'b.st', 'mort.st'], 'chaque hôte observé compte au registre');
    assert.deepStrictEqual(Object.keys(sources).sort(), ['fb', 'ppv'], 'et chaque source');
    ok('appliquerReleves pose sur le lien ce que la vérification au fil de l\'eau posait');

    // Le fichier a bougé entre la vérification et l'application : un lien ajouté devant.
    const d1 = fichier();
    d1.matches[0].streamLinks.unshift({ url: 'https://nouveau.st/1' });
    d1.matches.push({ streamLinks: [] });
    const s1 = play.appliquerReleves(d1, releves, {}, {});
    assert.strictEqual(s1.appliques, 2);
    assert.strictEqual(d1.matches[0].streamLinks[1].verified, 'plays', 'retrouvé par son adresse, pas par sa place');
    assert.ok(!('verified' in d1.matches[0].streamLinks[0]), 'le lien qui a pris sa place n\'hérite de rien');

    // Le lien a disparu : rien à marquer, mais l'hôte a bien été observé.
    const d2 = fichier();
    d2.matches[0].streamLinks = [];
    const l2 = {};
    const s2 = play.appliquerReleves(d2, releves, l2, {});
    assert.strictEqual(s2.introuvables, 2);
    assert.ok(l2['a.st'] && l2['a.st'].tested === 1, 'le registre compte quand même');
    ok('un fichier qui a bougé : le relevé retrouve son lien par l\'adresse, ou ne marque rien');
  }

  // ── 4. Réunir les parts = tout appliquer d'un coup ───────────────────────
  {
    const fichier = () => ({ matches: [{ streamLinks: [1, 2, 3, 4, 5, 6].map((k) => ({ url: 'https://h' + k + '.st/' })) }] });
    const ref = fichier();
    const releves = ref.matches[0].streamLinks.map((l, k) => play.releveDe({ matchIndex: 0, linkIndex: k, host: 'h' + (k + 1) + '.st' }, l, { hauteur: 720 }, k % 2 ? 'none' : 'plays', 'T'));
    const tout = fichier(), parParts = fichier();
    play.appliquerReleves(tout, releves, {}, {});
    for (const i of [0, 1, 2]) play.appliquerReleves(parParts, play.partDesCibles(releves, { i, n: 3 }), {}, {});
    assert.deepStrictEqual(parParts, tout);
    ok('appliquer les parts l\'une après l\'autre donne le même fichier que tout d\'un coup');
  }

  console.log(`unit_verifparts : ${n} groupes OK`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

/* Tests des décisions de l'outil de sondage d'un domaine (js/sondage.js,
   scripts/sonder_domaine.mjs). Sans réseau : seules les fonctions pures sont éprouvées. */
const assert = require('assert');

async function main() {
  const S = await import('../js/sondage.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  assert.strictEqual(S.normaliserAdresse('streamed.st'), 'https://streamed.st/');
  assert.strictEqual(S.normaliserAdresse(' https://vipleague.me/watch-now '), 'https://vipleague.me/watch-now');
  assert.strictEqual(S.normaliserAdresse('javascript:alert(1)'), '');
  assert.strictEqual(S.normaliserAdresse('localhost'), '');
  assert.strictEqual(S.normaliserAdresse(''), '');
  ok('une adresse nue devient une adresse complète, le reste est refusé');

  assert.strictEqual(S.nomDuSite('v5.gostreameast.link'), 'gostreameast');
  assert.strictEqual(S.nomDuSite('ww1.sportsurge.st'), 'sportsurge');
  assert.strictEqual(S.nomDuSite('www.liveleagues.me'), 'liveleagues');
  const ids = ['footybite', 'sportsurge', 'streameast', 'streamed', 'methstreams', 'vipleague'];
  assert.deepStrictEqual(S.devinerSources('methstreams.st', ids), ['methstreams']);
  assert.deepStrictEqual(S.devinerSources('v5.gostreameast.link', ids), ['streameast'],
    '« gostreameast » contient streameast, pas streamed');
  assert.deepStrictEqual(S.devinerSources('ww1.sportsurge.st', ids), ['sportsurge']);
  assert.deepStrictEqual(S.devinerSources('daddylive.pk', ids), []);
  ok('la source est devinée d\'après le nom du site, sans préfixe de miroir');

  assert.strictEqual(S.adressePourSource('https://vipleague.io/', 'https://vipleague.me/watch-now'), 'https://vipleague.io/watch-now');
  assert.strictEqual(S.adressePourSource('https://vipleague.io/autre', 'https://vipleague.me/watch-now'), 'https://vipleague.io/autre');
  assert.strictEqual(S.adressePourSource('https://streamed.st/', 'https://streamed.pk/'), 'https://streamed.st/');
  ok('le chemin de la source en service est gardé quand on n\'en donne pas');

  assert.strictEqual(S.meilleureLecture([]), null);
  assert.strictEqual(S.meilleureLecture([{ id: 'a', matchs: 0 }]), null);
  assert.strictEqual(S.meilleureLecture([{ id: 'a', matchs: 40, generique: true }, { id: 'b', matchs: 5 }]).id, 'b',
    'un parseur dédié bat le repli générique');
  assert.strictEqual(S.meilleureLecture([{ id: 'a', matchs: 4 }, { id: 'b', matchs: 9 }]).id, 'b');
  ok('la meilleure lecture : parseur dédié, puis le plus de matchs');

  const liste = [
    { matchUrl: 'https://onhockey.tv/schedule_table.php' },
    { matchUrl: 'https://ntv.cx/match/1' },
    { matchUrl: 'https://www.ntv.cx/match/2' },
    { matchUrl: '' }, null,
  ];
  assert.strictEqual(S.matchsDuDomaine(liste, 'ntv.cx').length, 2,
    'un parseur étranger qui fabrique des adresses chez lui ne compte pas');
  assert.strictEqual(S.matchsDuDomaine([{ matchUrl: 'https://vipleague.me/x' }], 'vipleague.vg').length, 1,
    'un miroir qui redirige garde le même nom de site');
  ok('seuls les matchs hébergés sur le domaine sondé comptent');

  const r = S.resumerLiens([
    { url: 'https://embed.st/a' }, { url: 'https://embed.st/b' }, { url: 'https://x.test/p', topLevel: true }, { url: 'pas une adresse' },
  ], { 'embed.st': { tested: 25, plays: 1 } });
  assert.deepStrictEqual(r.map((x) => [x.hote, x.liens, x.onglet, x.registre]), [['embed.st', 2, 0, '1/25'], ['x.test', 1, 1, null]]);
  ok('les liens sont résumés par hôte avec ce qu\'en dit le registre');

  const d = { STREAMED_URL: 'https://streamed.pk/', MIRRORS: { streamed: ['https://streamed.pk/'] } };
  const a = S.ajouterMiroir(d, 'streamed', 'https://streamed.st/');
  assert.strictEqual(a.ajoute, true);
  assert.deepStrictEqual(a.domains.MIRRORS.streamed, ['https://streamed.pk/', 'https://streamed.st/'], 'ajouté en dernier');
  assert.strictEqual(a.domains.STREAMED_URL, 'https://streamed.pk/', 'l\'adresse en service ne bouge pas');
  assert.deepStrictEqual(d.MIRRORS.streamed, ['https://streamed.pk/'], 'l\'objet reçu n\'est pas modifié');
  assert.strictEqual(S.ajouterMiroir(a.domains, 'streamed', 'https://streamed.st/').ajoute, false, 'pas de doublon');
  const b = S.ajouterMiroir({}, 'methstreams', 'https://methstreams.st/', ['https://methstreams.gs/']);
  assert.deepStrictEqual(b.domains.MIRRORS.methstreams, ['https://methstreams.gs/', 'https://methstreams.st/'],
    'sans entrée dans domains.json, les miroirs en dur sont repris : la clé les remplacerait sinon');
  ok('ajouterMiroir inscrit en dernier, sans doublon, sans perdre les miroirs en dur');

  console.log(`unit_sondage : ${n} groupes OK`);
}
main().catch((e) => { console.error(e); process.exit(1); });

/* Les liens des hôtes qui ne jouent jamais ne sont pas publiés (ecarterLiensMorts,
   js/playability.js), et leurs témoins restent éprouvés (ciblesDeRehabilitation).
   Hôtes inventés : rien ici ne dépend du réseau ni de l'heure. */
const assert = require('assert');

async function main() {
  const P = await import('../js/playability.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };
  const S = P.SEUIL_HOTE_MORT;

  assert.strictEqual(P.hoteMort({ tested: S, plays: 0 }), true);
  assert.strictEqual(P.hoteMort({ tested: S - 1, plays: 0 }), false, 'sous le seuil, un hôte peut être tombé pendant l\'essai');
  assert.strictEqual(P.hoteMort({ tested: 40, plays: 1 }), false, 'une seule lecture suffit à le garder');
  assert.strictEqual(P.hoteMort(undefined), false, 'un hôte inconnu n\'est pas mort');
  ok('un hôte est mort à zéro lecture sur au moins SEUIL_HOTE_MORT essais');

  const ledger = {
    'mort.test': { tested: 30, plays: 0 },
    'vivant.test': { tested: 30, plays: 12 },
    'neuf.test': { tested: 2, plays: 0 },
    'guide.test': { tested: 31, plays: 0 },
    'onglet.test': { tested: 20, plays: 0 },
    'source.test': { tested: 25, plays: 0 },
  };
  const matches = [
    { streamLinks: [
      { url: 'https://mort.test/a' },
      { url: 'https://mort.test/b', verified: 'plays' },
      { url: 'https://vivant.test/a' },
      { url: 'https://neuf.test/a' },
      { url: 'https://guide.test/vpn.html', topLevel: true },
      { url: 'https://onglet.test/page', topLevel: true },
      { url: 'https://source.test/match/1', topLevel: true },
    ] },
    { streamLinks: [{ url: 'https://www.mort.test/c' }] },
    { streamLinks: [] }, {},
  ];
  const r = P.ecarterLiensMorts(matches, ledger, {
    politique: { 'guide.test': { embeddable: false, status: 403 }, 'onglet.test': { embeddable: false, status: 200 } },
    estSource: (h) => h === 'source.test',
  });
  assert.deepStrictEqual(matches[0].streamLinks.map((l) => l.url), [
    'https://mort.test/b', 'https://vivant.test/a', 'https://neuf.test/a', 'https://onglet.test/page', 'https://source.test/match/1',
  ]);
  assert.deepStrictEqual(matches[1].streamLinks, []);
  assert.strictEqual(r.retires, 3);
  assert.deepStrictEqual(Object.keys(r.hotes).sort(), ['guide.test', 'mort.test']);
  assert.strictEqual(r.hotes['mort.test'].liens, 2);
  assert.strictEqual(r.hotes['mort.test'].echantillon, 'https://mort.test/a', 'un témoin est gardé pour la réhabilitation');
  ok('écarté : lecteur d\'un hôte mort, et onglet dont la page répond en erreur');
  ok('gardé : lien vu jouer, hôte vivant ou peu éprouvé, onglet qui répond, page de source');

  const vide = [{ streamLinks: [{ url: 'https://mort.test/a' }] }];
  assert.strictEqual(P.ecarterLiensMorts(vide, {}).retires, 0, 'sans registre, rien n\'est écarté');
  assert.strictEqual(P.ecarterLiensMorts(null, ledger).retires, 0);
  ok('sans registre ni matchs, rien ne bouge');

  const cibles = P.ciblesDeRehabilitation({
    'b.test': { echantillon: 'https://b.test/1', essaiAt: '2026-10-09T10:00:00Z' },
    'a.test': { echantillon: 'https://a.test/1', essaiAt: '2026-10-09T08:00:00Z' },
    'jamais.test': { echantillon: 'https://jamais.test/1' },
    'sans.test': {},
  }, 2);
  assert.deepStrictEqual(cibles.map((c) => c.host), ['jamais.test', 'a.test'], 'jamais essayé d\'abord, puis le plus ancien');
  assert.ok(cibles.every((c) => c.ecarte && c.target));
  assert.deepStrictEqual(P.ciblesDeRehabilitation(undefined), []);
  ok('les témoins des hôtes écartés sont éprouvés à tour de rôle');

  const fs = require('fs'), path = require('path');
  const scrape = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'scrape_streams.mjs'), 'utf8');
  const verif = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'verify_players.mjs'), 'utf8');
  assert.ok(/play\.ecarterLiensMorts\(out\.matches/.test(scrape), 'le scrape écarte les liens morts avant d\'écrire');
  assert.ok(/out\.hotesEcartes/.test(scrape), 'et publie les témoins');
  assert.ok(/play\.ciblesDeRehabilitation\(data\.hotesEcartes/.test(verif), 'la vérification éprouve les témoins');
  ok('les deux scripts serveur sont branchés');

  console.log(`unit_liensmorts : ${n} groupes OK`);
}
main().catch((e) => { console.error(e); process.exit(1); });

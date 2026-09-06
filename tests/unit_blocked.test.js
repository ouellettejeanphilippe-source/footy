/* La tuile charge la PAGE du match, entière, et le script utilisateur ne garde que la vidéo.

   Décision du 6 septembre 2026, après des semaines sans vidéo : « remet les pages
   complètes que le script nuke, plus de trucs direct vers vidéos, reconstruire marche pas ».
   Ce fichier verrouillait la décision inverse (lecteur extrait, tour de passe-passe,
   barre d'échec) ; il verrouille maintenant celle-ci, en relisant la source livrée
   plutôt qu'une copie de la règle. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  const fs = require('fs');
  const path = require('path');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'multiview.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  // ── 1. La tuile charge l'adresse du lien, et rien d'autre ──────────────────
  assert.ok(/iframe\.src = finalUrl;/.test(code), 'la tuile doit charger la page telle quelle');
  assert.strictEqual((code.match(/iframe\.src\s*=/g) || []).length, 1,
    'une seule affectation de src dans la tuile : la page — ni lecteur extrait, ni adresse de rechange');
  assert.ok(!/playerUrl/.test(code), 'plus aucun lecteur extrait (playerUrl) dans le Multivision');
  assert.ok(!/srcdoc/.test(code), 'plus aucune page reconstruite (srcdoc) dans le Multivision');
  assert.ok(!/resolveBlockedEmbed|installerReconstructionRecursive|buildTrickBadge|buildTrickFailureBar/.test(code),
    'le tour de passe-passe et ses bandeaux sont retirés');
  ok('la tuile charge la page entière, sans lecteur extrait ni reconstruction');

  // ── 2. Le script utilisateur est appelé à nettoyer, sans bac à sable ──────
  assert.ok(/demanderNettoyage\(iframe\);/.test(code), 'la tuile demande le nettoyage au script utilisateur');
  assert.ok(!/setAttribute\('sandbox'/.test(code), 'aucun attribut sandbox : les lecteurs le détectent');
  ok('le nettoyage est demandé au script, sans bac à sable');

  // ── 3. Un lien « page » est une source comme une autre ────────────────────
  const scr = await import('../js/scrapers.js');
  assert.strictEqual(scr.compterFluxUtiles({ streamLinks: [{ name: 'Page du match sur footybite.bid', url: 'https://footybite.bid/game/x', topLevel: true }] }), 1,
    'la page du match compte : c\'est exactement ce que la tuile charge');
  const P = await import('../js/playability.js');
  assert.strictEqual(P.tileTarget({ url: 'https://a.test/page', topLevel: true, playerUrl: 'https://p.test/embed' }), 'https://a.test/page',
    'la cible d\'une tuile est la page, même quand le cache porte encore un playerUrl');
  ok('les liens « page » sont des sources à part entière');

  // ── 4. Le réglage « Reconstruire les pages non intégrables » a disparu ────
  assert.ok(!/embedTrick|pref-embed-trick/.test(code), 'plus de réglage pour une reconstruction qui n\'existe plus');
  ok('plus de réglage de reconstruction dans les options');

  console.log(`${n} groupes OK — la tuile charge la page entière`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

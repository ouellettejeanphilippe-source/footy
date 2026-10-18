/* Le relevé des sorties de l'application (js/sorties.js).

   « ça le fait encore » (18 octobre 2026) : l'onglet parti sur une pub « tout seul »,
   appli v61, script 1.15, Firefox 158 — et rien de tel dans un vrai Firefox 158 joué ici.
   Chaque sortie, vidéos chargées, est donc notée avec l'état de la garde « Quitter le
   site ? », et la page Logs l'explique. Ce que ces cas verrouillent : l'ordre et la borne
   du journal, la marque « quittée » posée seulement sur la sortie qui vient d'avoir lieu,
   l'explication de chaque cas, et l'échappement du HTML. */
const assert = require('assert');

async function main() {
  const S = await import('../js/sorties.js');
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ── 1. Le journal ──────────────────────────────────────────────────────────
  let j = [];
  for (let i = 0; i < S.SORTIES_MAX + 3; i++) j = S.noterSortie(j, { armee: true, tuiles: 1, i }, 1000 + i);
  assert.strictEqual(j.length, S.SORTIES_MAX, 'borné');
  assert.strictEqual(j[0].i, S.SORTIES_MAX + 2, 'le plus récent d\'abord');
  assert.strictEqual(j[0].quittee, false, 'pas encore quittée : la question a pu retenir la page');
  assert.deepStrictEqual(S.noterSortie(null, { armee: false }, 5).length, 1, 'un journal illisible repart de zéro');
  ok('le journal garde les dernières sorties, la plus récente d\'abord');

  // ── 2. « Quittée » ─────────────────────────────────────────────────────────
  j = S.noterSortie([], { armee: true, tuiles: 2 }, 100000);
  const q = S.marquerQuittee(j, 100500, true);
  assert.strictEqual(q[0].quittee, true, 'pagehide juste après : la page est partie');
  assert.strictEqual(q[0].cache, true);
  assert.strictEqual(j[0].quittee, false, 'sans toucher au journal donné');
  assert.strictEqual(S.marquerQuittee(j, 100000 + 61000)[0].quittee, false, 'une sortie d\'il y a plus d\'une minute n\'est pas celle-ci');
  const r = S.noterRetour(q, 200000, false);
  assert.strictEqual(r[0].type, 'retour');
  assert.strictEqual(S.marquerQuittee(r, 200100)[0].type, 'retour', 'un retour n\'est jamais marqué quitté');
  ok('seule la sortie qui vient d\'avoir lieu est marquée quittée');

  // ── 3. Les explications ────────────────────────────────────────────────────
  assert.match(S.raisonDeLaGarde({ armee: true, activation: { active: false, deja: true } }), /devait demander/);
  assert.match(S.raisonDeLaGarde({ armee: true, activation: { active: false, deja: false } }), /aucun geste/);
  assert.match(S.raisonDeLaGarde({ armee: false, reglage: false, tuiles: 1 }), /réglage/);
  assert.match(S.raisonDeLaGarde({ armee: false, reglage: true, tuiles: 1, autorisee: true }), /navigation de l'application/);
  assert.match(S.raisonDeLaGarde({ armee: false, reglage: true, tuiles: 1, cachee: true }), /arrière-plan/);
  assert.match(S.raisonDeLaGarde({ armee: false, reglage: true, tuiles: 1, parLeHaut: true }), /par le haut/);
  assert.match(S.raisonDeLaGarde({ armee: false, reglage: true, tuiles: 1, modificateur: true }), /Ctrl/);
  assert.match(S.raisonDeLaGarde({ armee: false, reglage: true, tuiles: 1, toucheIlYaMs: 40 }), /F5/);
  assert.match(S.raisonDeLaGarde({ armee: false, reglage: true, tuiles: 1, pages: 0 }), /aucune tuile n'affiche la page d'un site/);
  ok('chaque cas de la garde est expliqué en clair');

  // ── 4. La page Logs ────────────────────────────────────────────────────────
  assert.match(S.sortiesHtml([], esc), /Aucune sortie notée/);
  const h = S.sortiesHtml([
    { type: 'retour', at: 300000, cache: false },
    { type: 'sortie', at: 299000, quittee: true, armee: false, reglage: false, tuiles: 1, focusTuile: 0, clicTuileIlYaMs: 42000, activation: { active: false, deja: true }, sites: ['<b>pub</b>.example'] }
  ], esc);
  assert.match(h, /retour sur l'appli/);
  assert.match(h, /page quittée/);
  assert.match(h, /réglage/);
  assert.match(h, /focus dans la vidéo 1/);
  assert.match(h, /dernier clic dans une vidéo il y a 42 s/);
  assert.ok(!h.includes('<b>pub</b>'), 'les noms de sites sont échappés');
  assert.ok(h.includes('&lt;b&gt;pub&lt;/b&gt;.example'));
  ok('la page Logs montre chaque sortie et chaque retour, échappés');

  // ── 5. Ce qui précédait (deux « Quitter le site ? » d'origine inconnue, 18 octobre) ─
  const d = S.sortiesHtml([{ type: 'sortie', at: 299000, quittee: false, armee: true, reglage: true, tuiles: 2, pages: 2,
    focusPage: false, pointeur: { y: 14, ilYaMs: 300 }, sortieFenetre: { y: 37, ilYaMs: 250 },
    derniereTouche: { touche: 'F5', ilYaMs: 4000 }, poseesIlYaMs: [4000, null], sites: ['a.example', 'b.example'] }], esc);
  assert.match(d, /fenêtre sans le focus/);
  assert.match(d, /pointeur vu à 14 px du haut il y a 300 ms/);
  assert.match(d, /sorti de la fenêtre à 37 px du haut il y a 250 ms/);
  assert.match(d, /dernière touche F5 il y a 4 s/);
  assert.match(d, /a\.example \(chargée il y a 4 s\), b\.example/);
  ok('une sortie dit où était le pointeur, la dernière touche, le focus et l\'âge de chaque vidéo');

  console.log(`unit_sorties: ${n} groupes de tests OK`);
}

main().catch((e) => { console.error(e); process.exit(1); });

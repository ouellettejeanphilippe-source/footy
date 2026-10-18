/* Le tampon d'historique (js/tampon.js).

   « Ça redirige encore contre mon gré sans intervention de ma part » (18 octobre 2026) :
   la page d'une vidéo qui appelle history.back() recule tout l'onglet, sans clic. Le
   tampon l'absorbe ; il ne doit ni piéger le Retour de l'utilisateur, ni se poser là où
   ce Retour ne laisse aucun signe (téléphone, télé). Le comportement réel est vérifié dans
   tests/test_app_boot.spec.js. */
const assert = require('assert');

async function main() {
  const T = await import('../js/tampon.js');
  const S = await import('../js/sorties.js');
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ── 1. Où le tampon se pose ───────────────────────────────────────────────
  const fenetre = (fin, extra) => Object.assign({ history: { pushState() {} }, matchMedia: (q) => ({ matches: fin && /any-pointer: fine/.test(q) }) }, extra || {});
  assert.strictEqual(T.tamponPossible(fenetre(true)), true, 'ordinateur : souris ou pavé tactile');
  assert.strictEqual(T.tamponPossible(fenetre(false)), false, 'téléphone : le Retour du système ne laisse aucun signe');
  assert.strictEqual(T.tamponPossible(fenetre(true, { __ANDROID_TV__: true })), false, 'télé');
  assert.strictEqual(T.tamponPossible(fenetre(true, { Capacitor: {} })), false, 'APK');
  assert.strictEqual(T.tamponPossible({ matchMedia: () => ({ matches: true }) }), false, 'sans API d\'historique');
  ok('le tampon ne se pose que sur ordinateur, hors APK et télé');

  // ── 2. Laisser reculer, ou bloquer ────────────────────────────────────────
  const base = { reglage: true, pages: 2, utilisateurPart: false, balayage: false };
  assert.strictEqual(T.decisionRetour(base), 'bloquer', 'une vidéo a demandé le recul');
  assert.strictEqual(T.decisionRetour(Object.assign({}, base, { utilisateurPart: true })), 'laisser', 'bouton ←, Alt+←, bouton de la souris');
  assert.strictEqual(T.decisionRetour(Object.assign({}, base, { balayage: true })), 'laisser', 'balayage du pavé tactile');
  assert.strictEqual(T.decisionRetour(Object.assign({}, base, { pages: 0 })), 'laisser', 'plus aucune page de site : rien à craindre');
  assert.strictEqual(T.decisionRetour(Object.assign({}, base, { reglage: false })), 'laisser', 'garde coupée');
  assert.ok(T.estTampon(T.ETAT_TAMPON) && !T.estTampon(null) && !T.estTampon({}), 'le tampon se reconnaît à son état');
  ok('le recul passe quand c\'est l\'utilisateur, il est bloqué quand c\'est une vidéo');

  // ── 3. Au relevé ──────────────────────────────────────────────────────────
  const j = S.noterBlocage([], { sites: ['<b>a</b>.example'], poseesIlYaMs: [800], script: '1.16', armee: true }, 1000);
  assert.strictEqual(j[0].type, 'bloque');
  assert.strictEqual(j[0].armee, undefined, 'seulement ce qui sert à lire le blocage');
  const h = S.sortiesHtml(j, esc);
  assert.match(h, /recul de l'onglet demandé par une vidéo · bloqué/);
  assert.match(h, /chargée il y a 800 ms/);
  assert.match(h, /script 1\.16/);
  assert.ok(!h.includes('<b>a</b>'), 'échappé');
  assert.strictEqual(S.marquerQuittee(j, 1100)[0].type, 'bloque', 'un blocage n\'est jamais marqué quitté');
  ok('un recul bloqué est noté au relevé, avec les vidéos et la version du script');

  console.log(`unit_tampon: ${n} groupes de tests OK`);
}

main().catch((e) => { console.error(e); process.exit(1); });

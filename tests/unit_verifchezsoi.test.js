/* La vérification depuis chez l'utilisateur (26 octobre 2026, « je veux la solution la
   plus efficace et pérenne »).

   1. La sonde sert les pages de cadre sans leur refus d'encadrement, comme l'APK
      (CadreSansRefus.java) et l'extension (extension/fond.js) : X-Frame-Options part,
      frame-ancestors part de la CSP, le reste de la CSP et des en-têtes reste.
   2. La publication des données (scripts/publier_donnees.mjs) ne tente d'ajouter que les
      fichiers qui existent (`git add` d'un fichier absent n'ajoute rien), et `--simuler`
      ne touche à rien.
   Rien ici ne dépend du réseau ni de l'heure. */
const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

async function main() {
  const P = await import('../js/playability.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  assert.deepStrictEqual(P.sansRefusDeCadre({ 'x-frame-options': 'SAMEORIGIN', 'content-type': 'text/html' }), { 'content-type': 'text/html' });
  assert.deepStrictEqual(P.sansRefusDeCadre({ 'content-security-policy': "frame-ancestors 'self'; default-src 'self'; img-src *" }),
    { 'content-security-policy': "default-src 'self'; img-src *" }, 'frame-ancestors part, le reste de la CSP reste');
  assert.deepStrictEqual(P.sansRefusDeCadre({ 'content-security-policy': "frame-ancestors 'self' a.test b.test" }), {}, 'une CSP qui ne portait que frame-ancestors disparaît');
  assert.deepStrictEqual(P.sansRefusDeCadre({ 'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'", 'X-Frame-Options': 'DENY', 'set-cookie': 'a=1' }),
    { 'Content-Security-Policy': "default-src 'self'", 'set-cookie': 'a=1' }, 'la casse des clés ne compte pas, et elle est gardée');
  assert.deepStrictEqual(P.sansRefusDeCadre({ 'content-security-policy': "frame-src 'self'; frame-ancestors-x y" }), { 'content-security-policy': "frame-src 'self'; frame-ancestors-x y" }, 'seule la directive frame-ancestors exacte part');
  assert.deepStrictEqual(P.sansRefusDeCadre(null), {});
  const avant = { 'x-frame-options': 'DENY' };
  P.sansRefusDeCadre(avant);
  assert.deepStrictEqual(avant, { 'x-frame-options': 'DENY' }, 'l\'objet reçu n\'est pas modifié');
  ok('sansRefusDeCadre : X-Frame-Options et frame-ancestors retirés, le reste gardé');

  // Le module s'exécute à l'import : on le prend comme un processus, avec --simuler.
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'publier_donnees.mjs'), '--simuler', '--message', 'essai'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(/^simulation : git add /.test(r.stdout), r.stdout);
  assert.ok(r.stdout.includes('data/streams.json') && r.stdout.includes('domains.json'), 'les fichiers de données qui existent');
  assert.ok(r.stdout.includes('git commit -m "essai"') && r.stdout.includes('git push'), 'puis commit et push');
  ok('publier_donnees --simuler : dit ce qu\'il ferait, sans toucher à git');

  console.log('\n' + n + ' cas passés.');
}

main().catch((e) => { console.error(e); process.exit(1); });

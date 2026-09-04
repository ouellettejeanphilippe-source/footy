/* Levée du bac à sable par domaine (js/embed-bridge.js).

   Signalé le 4 septembre 2026 : sous Firefox, une chaîne de tnt-sports.shop affichait
   « SANDBOX IFRAME NOT ALLOWED » à la place du lecteur. Le refus vient d'un script de la
   page imbriquée ; l'application, qui n'a aucun accès au contenu d'une origine croisée,
   ne peut ni le lire ni le détecter. Elle ne peut donc pas se rattraper toute seule : la
   levée est un geste de l'utilisateur, retenu pour le domaine.

   Ce que ces cas garantissent : la levée vise bien le DOMAINE (www. et chemin ignorés),
   elle se retient, elle se reprend, et elle ne déborde jamais sur un autre domaine. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'location'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  const eb = await import('../js/embed-bridge.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  // ── 1. Le domaine, pas l'adresse ──────────────────────────────────────────────
  assert.strictEqual(eb.sandboxHost('https://www.tnt-sports.shop/sportsurge-012/15.php'), 'tnt-sports.shop');
  assert.strictEqual(eb.sandboxHost('https://TNT-Sports.shop/a'), 'tnt-sports.shop');
  assert.strictEqual(eb.sandboxHost('pas une adresse'), '');
  ok('sandboxHost réduit à un domaine, sans www ni chemin ni casse');

  // ── 2. Par défaut, le bac à sable est posé ────────────────────────────────────
  const URL_A = 'https://tnt-sports.shop/sportsurge-012/15.php';
  const URL_B = 'https://autre-hote.example/embed/1';
  assert.strictEqual(eb.isSandboxExempt(URL_A), false);
  assert.strictEqual(eb.playerSandboxFor(URL_A, true), eb.PLAYER_SANDBOX);
  ok('aucune levée par défaut : PLAYER_SANDBOX est rendu');

  // ── 3. La levée s'applique et se retient ──────────────────────────────────────
  assert.strictEqual(eb.toggleSandboxException(URL_A), true);
  assert.strictEqual(eb.isSandboxExempt(URL_A), true);
  assert.strictEqual(eb.playerSandboxFor(URL_A, true), null);
  // même domaine, autre chemin, autre sous-forme : même levée
  assert.strictEqual(eb.isSandboxExempt('https://www.tnt-sports.shop/autre/99.php'), true);
  ok('la levée vaut pour tout le domaine et survit à un autre chemin');

  // ── 4. Elle ne déborde pas ────────────────────────────────────────────────────
  assert.strictEqual(eb.isSandboxExempt(URL_B), false);
  assert.strictEqual(eb.playerSandboxFor(URL_B, true), eb.PLAYER_SANDBOX);
  ok('un domaine levé n\'exempte pas les autres');

  // ── 5. Elle se reprend ────────────────────────────────────────────────────────
  assert.strictEqual(eb.toggleSandboxException(URL_A), false);
  assert.strictEqual(eb.isSandboxExempt(URL_A), false);
  assert.strictEqual(eb.playerSandboxFor(URL_A, true), eb.PLAYER_SANDBOX);
  ok('un second clic remet le bac à sable');

  // ── 6. La préférence globale l'emporte, et un domaine illisible ne casse rien ─
  assert.strictEqual(eb.playerSandboxFor(URL_A, false), null);
  assert.strictEqual(eb.toggleSandboxException('pas une adresse'), false);
  ok('préférence globale décochée = aucun bac à sable ; adresse illisible = sans effet');

  // ── 7. Le bac à sable des documents reconstruits reste inconditionnel ─────────
  assert.ok(eb.EMBED_SANDBOX.indexOf('allow-same-origin') < 0,
    'EMBED_SANDBOX ne doit JAMAIS accorder allow-same-origin : le document vit à l\'origine de l\'application');
  ok('EMBED_SANDBOX n\'accorde pas allow-same-origin, et n\'est pas concerné par la levée');

  console.log('\n' + n + ' groupes OK — levée du bac à sable');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

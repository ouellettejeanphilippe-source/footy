/* Le lecteur préparé par le serveur atteint enfin la tuile du Multivision.

   Une entrée du Multivision ne porte que { url, name, mid } — c'est tout ce que
   `addToMultivision` reçoit. Or la décision de chargement lisait `s.playerUrl` et
   `s.topLevel` SUR CETTE ENTRÉE, où personne ne les avait jamais copiés. Le champ
   `playerUrl` que le scraper horaire écrit dans data/streams.json, et le drapeau
   `topLevel` (hôte mesuré « refuse l'iframe »), étaient donc lettre morte dans le
   Multivision : la page de match était chargée telle quelle, et le navigateur affichait
   son refus. Relevé sur le cache du 6 septembre 2026 : 511 liens portaient les deux
   champs ; 100 matchs n'avaient QUE ce type de lien, donc rien à montrer.

   `lienDuMatchPourFlux` retrouve le lien dans le match au moment de charger la tuile.
   On le retrouve plutôt que de recopier ses champs à l'ajout : une entrée restaurée du
   stockage local, ou dont l'adresse a été changée par le sélecteur de flux, reste juste. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  const mv = await import('../js/multiview.js');
  const { S } = await import('../js/state.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  const page = { name: 'Page du match sur footybite.bid', url: 'https://footybite.bid/game/ufc-fight-night-287', topLevel: true, playerUrl: 'https://ytstreams.club/YT154/embed/34.html' };
  const direct = { name: 'Lecteur direct', url: 'https://embedsports.me/ufc/stream-1' };
  S.matches = [
    { id: 'api_1', homeTeam: 'Autre', awayTeam: 'Match', streamLinks: [direct] },
    { id: 'scraped_ufc', homeTeam: 'UFC Fight Night 287', awayTeam: '', streamLinks: [page] },
    { id: 42, homeTeam: 'Sans', awayTeam: 'Lien' },
  ];

  // ── 1. Par le match, puis par l'adresse ────────────────────────────────────────
  const trouve = mv.lienDuMatchPourFlux({ url: page.url, name: 'UFC', mid: 'scraped_ufc' });
  assert.strictEqual(trouve, page, 'le lien est retrouvé dans son match, avec playerUrl et topLevel');
  assert.strictEqual(trouve.playerUrl, page.playerUrl);
  assert.strictEqual(trouve.topLevel, true);
  ok('une entrée { url, mid } retrouve le lien complet de son match');

  // ── 2. Identifiant absent ou périmé : on cherche dans toute la grille ──────────
  assert.strictEqual(mv.lienDuMatchPourFlux({ url: page.url, name: 'UFC' }), page, 'sans mid, l\'adresse suffit');
  assert.strictEqual(mv.lienDuMatchPourFlux({ url: page.url, mid: 'inconnu' }), page, 'un mid périmé (grille rechargée) n\'empêche rien');
  assert.strictEqual(mv.lienDuMatchPourFlux({ url: direct.url, mid: 42 }), direct, 'un mid numérique est comparé comme chaîne');
  ok('l\'adresse retrouve le lien même quand l\'identifiant du match ne correspond plus');

  // ── 3. L'adresse explicite prime sur celle de l'entrée ─────────────────────────
  /* Le sélecteur de flux change `mvFlux[idx].url` puis recharge la tuile : c'est l'adresse
     passée au chargement qui compte, jamais un champ mémorisé sur l'entrée. */
  assert.strictEqual(mv.lienDuMatchPourFlux({ url: page.url, mid: 'scraped_ufc' }, direct.url), direct);
  ok('l\'adresse passée au chargement prime sur celle de l\'entrée');

  // ── 4. Rien à trouver : null, jamais d'exception ───────────────────────────────
  assert.strictEqual(mv.lienDuMatchPourFlux({ url: 'https://colle-a-la-main.test/x', mid: 'scraped_ufc' }), null, 'un lien collé à la main n\'est dans aucun match');
  assert.strictEqual(mv.lienDuMatchPourFlux({ url: '' }), null);
  assert.strictEqual(mv.lienDuMatchPourFlux(null), null);
  S.matches = [];
  assert.strictEqual(mv.lienDuMatchPourFlux({ url: page.url }), null, 'grille vide');
  ok('absence de lien : null, sans exception');

  // ── 5. La décision de chargement consomme bien ce lien ─────────────────────────
  /* Relu dans la source, comme tests/unit_blocked.test.js : un test qui recopie la règle
     ne prouve rien sur le code livré. */
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'multiview.js'), 'utf8');
  assert.ok(/var lienConnu = lienDuMatchPourFlux\(s, url\);/.test(src), 'fallbackToIframe doit retrouver le lien du match');
  assert.ok(/adresseHttp\(s && s\.playerUrl\) \|\| adresseHttp\(lienConnu && lienConnu\.playerUrl\)/.test(src),
    'le lecteur préparé doit être lu sur le lien du match quand l\'entrée ne le porte pas');
  assert.ok(/!!\(lienConnu && lienConnu\.topLevel\)/.test(src), 'le drapeau topLevel du lien du match doit compter');
  ok('fallbackToIframe lit playerUrl et topLevel sur le lien retrouvé');

  console.log(`unit_mvlien: ${n} groupes de tests OK`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

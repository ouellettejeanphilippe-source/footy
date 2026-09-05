/* Pages de match réputées bloquées : le pont du script utilisateur a le droit d'essayer.

   « Bloqué » décrit un CHEMIN, pas un site. MATCH_PAGE_BLOCKED_HOSTS a été mesuré depuis
   GitHub Actions et depuis les proxys CORS publics — deux adresses de centre de données,
   exactement ce que Cloudflare écarte : footybite.bid/game/… y rend 403 (revérifié le
   5 septembre 2026). Mais l'utilisateur, lui, voit des dizaines de liens sur cette même
   page : sa requête part de chez lui.

   Le pont du script utilisateur emprunte précisément ce chemin-là — la machine de
   l'utilisateur. Refuser d'essayer quand il est installé revient à jeter la source la
   mieux fournie en football à cause d'une mesure faite ailleurs. C'était le cas jusqu'à
   cette date : scrapeMatchFlux posait le lien de repli et s'arrêtait, quoi qu'il arrive.

   Ce test verrouille les deux moitiés de la règle : sans pont on n'essaie pas (on ne
   gaspille pas un aller-retour voué au 403), avec pont on essaie — et un échec du pont
   retombe proprement sur le repli, sans casser la fiche du match. */
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

  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'scrapers.js'), 'utf8');

  // ── 1. La décision consulte bien l'état du pont ─────────────────────────
  assert.ok(/getBridgeStatus/.test(src),
    'scrapeMatchFlux doit consulter l\'état du pont pour décider d\'essayer');
  assert.ok(/if \(pageBloquee && !pontDispo\) return Promise\.resolve\(repliPageBloquee\(\)\);/.test(src),
    'sans pont, une page bloquée doit encore court-circuiter le téléchargement');
  ok('la décision d\'essayer dépend de la présence du pont, pas du seul nom d\'hôte');

  // ── 2. L'échec du pont retombe sur le repli, pas sur une erreur ──────────
  assert.ok(/if \(pageBloquee\) \{ repliPageBloquee\(\); return null; \}/.test(src),
    'un échec sur une page bloquée doit revenir au lien de repli au lieu de rejeter');
  ok('un échec du pont retombe sur le lien « Page du match », sans casser la fiche');

  // ── 3. La règle elle-même, rejouée isolément ────────────────────────────
  /* Reproduction de la décision telle qu'écrite dans le script. Si elle change de
     comportement sans que ce test bouge, c'est qu'il faut relire scrapeMatchFlux. */
  const decide = (pageBloquee, pontDispo) => (pageBloquee && !pontDispo) ? 'repli' : 'essayer';
  assert.strictEqual(decide(true, false), 'repli', 'page bloquée sans pont : on n\'essaie pas');
  assert.strictEqual(decide(true, true), 'essayer', 'page bloquée AVEC pont : on essaie');
  assert.strictEqual(decide(false, false), 'essayer', 'page ordinaire : on essaie, comme avant');
  assert.strictEqual(decide(false, true), 'essayer', 'page ordinaire avec pont : on essaie');
  ok('table de vérité complète : seul « bloquée sans pont » renonce');

  // ── 4. La liste des hôtes bloqués reste inchangée ───────────────────────
  /* Le correctif ne relâche PAS la liste : elle reste juste pour le serveur et les
     proxys, qui continuent de l'appliquer. Seul le pont y échappe. */
  const cfg = await import('../js/config.js');
  assert.strictEqual(cfg.isMatchPageBlocked('https://footybite.bid/game/le-havre-vs-brest-4138757356'), true,
    'footybite /game/ reste marqué bloqué : c\'est vrai depuis un serveur');
  assert.strictEqual(cfg.isMatchPageBlocked('https://flexfitness.fit/watch-live/cfb/x/a-vs-b/1'), false);
  ok('la liste des hôtes bloqués n\'est pas relâchée, seul le transport change');

  console.log(`unit_bridgefetch: ${n} groupes de tests OK`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

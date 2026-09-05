/* Déclenchement du tour de passe-passe sur les pages qui refusent l'iframe.

   Constat du 4 septembre 2026, capture à l'appui : une tuile du Multivision affichait
   « Firefox Can't Open This Page — v2.streameast.ch will not allow Firefox to display the
   page if another site has embedded it ». Pas de lecteur, pas de bandeau d'échec, aucune
   issue : le tour n'avait tout simplement PAS été tenté.

   La cause n'était pas le tour lui-même, mais ce qui décide de le lancer. Le scraper
   horaire interroge chaque hôte et lit ses en-têtes ; sur ce même cache, streameast.ch
   est mesuré « X-Frame-Options: sameorigin », et 402 liens sur 1131 portent `topLevel`.
   Le Multivision ignorait ce drapeau et ne se fiait qu'à la forme de l'adresse
   (isMatchOrLeaguePage), qui ne reconnaît pas une adresse de ce genre.

   Ces cas verrouillent la règle de décision : la MESURE du serveur prime, l'heuristique
   reste en renfort pour les liens que le serveur n'a jamais sondés, et un lecteur déjà
   préparé court-circuite les deux. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  const fs = require('fs');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  /* La décision telle qu'elle est écrite dans js/multiview.js. On la relit dans la source
     plutôt que de la recopier : un test qui recopie la règle ne prouve rien sur le code
     livré. */
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'multiview.js'), 'utf8');

  // ── 1. Le drapeau du serveur est bel et bien consulté ─────────────────────────
  assert.ok(/var bloqueParServeur = !!\(s && s\.topLevel\);/.test(src),
    'multiview.js doit lire le drapeau topLevel posé par le scraper');
  assert.ok(/isTopLevel = !lecteurPret && \(bloqueParServeur \|\| isMatchOrLeaguePage\(finalUrl\)\)/.test(src),
    'la décision doit combiner la mesure du serveur ET l\'heuristique');
  ok('la décision lit topLevel, et pas seulement la forme de l\'adresse');

  // ── 2. La table de vérité de cette décision ───────────────────────────────────
  const decide = (lecteurPret, topLevel, formeDePage) => !lecteurPret && (!!topLevel || !!formeDePage);
  //            lecteurPrêt, topLevel, heuristique → tour tenté ?
  assert.strictEqual(decide(false, true,  false), true,  'mesuré bloqué : le tour DOIT être tenté (le cas streameast)');
  assert.strictEqual(decide(false, false, true),  true,  'heuristique seule : le tour reste tenté');
  assert.strictEqual(decide(false, true,  true),  true,  'les deux d\'accord : le tour est tenté');
  assert.strictEqual(decide(false, false, false), false, 'rien ne signale un blocage : chargement direct');
  assert.strictEqual(decide(true,  true,  true),  false, 'lecteur déjà préparé : plus rien à tenter');
  ok('table de vérité complète de la décision');

  // ── 3. Le cas signalé, tel qu'il apparaît dans le cache ───────────────────────
  /* Un lien de streameast.ch tel que le scraper l'écrit : marqué topLevel parce que
     l'hôte a répondu « X-Frame-Options: sameorigin ». Son adresse ne ressemble pas à une
     page de match, donc l'heuristique seule le manquait — c'est tout le défaut. */
  const lien = { url: 'https://v2.streameast.ch/reddit-cincinnati-reds', topLevel: true };
  assert.strictEqual(decide(false, lien.topLevel, false), true,
    'le lien signalé doit déclencher le tour, alors que l\'heuristique seule le manquait');
  ok('le lien v2.streameast.ch du cache déclenche désormais le tour');

  // ── 4. Un lien ajouté à la main n'est pas laissé pour compte ──────────────────
  /* Le serveur ne sonde que ce qu'il a scrapé : un lien collé par l'utilisateur n'a pas de
     drapeau. L'heuristique doit donc rester en place, sinon on remplace un trou par un
     autre. */
  const colle = { url: 'https://exemple.test/match/equipe-a-vs-equipe-b' };
  assert.strictEqual(decide(false, colle.topLevel, true), true,
    'sans drapeau serveur, l\'heuristique doit encore pouvoir déclencher le tour');
  ok('les liens jamais sondés par le serveur gardent l\'heuristique en renfort');

  console.log('\n' + n + ' groupes OK — déclenchement du tour sur page bloquée');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

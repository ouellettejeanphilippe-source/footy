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
  assert.ok(/isTopLevel = !lecteurUtile && \(bloqueParServeur \|\| isMatchOrLeaguePage\(finalUrl\)\)/.test(src),
    'la décision doit combiner la mesure du serveur ET l\'heuristique');
  ok('la décision lit topLevel, et pas seulement la forme de l\'adresse');

  // ── 2. La table de vérité de cette décision ───────────────────────────────────
  /* Un lecteur préparé ne court-circuite le tour que si la page d'origine refuse l'iframe
     (voir le groupe 6) : sinon c'est la page elle-même qu'on veut charger, et le tour
     reste la voie quand son adresse est celle d'une page de match. */
  const decide = (lecteurPret, topLevel, formeDePage) => {
    const lecteurUtile = !!lecteurPret && !!topLevel;
    return !lecteurUtile && (!!topLevel || !!formeDePage);
  };
  //            lecteurPrêt, topLevel, heuristique → tour tenté ?
  assert.strictEqual(decide(false, true,  false), true,  'mesuré bloqué : le tour DOIT être tenté (le cas streameast)');
  assert.strictEqual(decide(false, false, true),  true,  'heuristique seule : le tour reste tenté');
  assert.strictEqual(decide(false, true,  true),  true,  'les deux d\'accord : le tour est tenté');
  assert.strictEqual(decide(false, false, false), false, 'rien ne signale un blocage : chargement direct');
  assert.strictEqual(decide(true,  true,  true),  false, 'lecteur préparé ET page bloquée : on charge le lecteur, rien à tenter');
  assert.strictEqual(decide(true,  false, true),  true,  'lecteur préparé mais page intégrable et de forme « page de match » : le tour cherche la vidéo');
  assert.strictEqual(decide(true,  false, false), false, 'lecteur préparé et page intégrable ordinaire : on charge la PAGE, sans tour');
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

  // ── 5. Tour échoué : on ne pointe PAS l'iframe vers la page bloquée ───────────
  /* Capture d'écran du 5 septembre 2026 : « Firefox Can't Open This Page —
     r.clearstreamdv.com will not allow Firefox to display the page if another site has
     embedded it », en plein milieu de la tuile. C'est le repli du tour qui la produisait :
     après un échec, il affectait quand même `iframe.src = finalUrl`.

     Or `finalUrl` est ici une page dont on a MESURÉ qu'elle refuse l'iframe.
     X-Frame-Options s'applique avant tout JavaScript : cette iframe ne peut donc rien
     afficher d'autre que l'écran d'erreur du navigateur. La seule issue utile est le
     bouton « ouvrir dans un onglet » de la barre d'échec. */
  /* On compte les affectations plutôt que de chercher un motif « après » : insérer
     `iframe.src = finalUrl` JUSTE AVANT la barre d'échec laissait passer une recherche
     de motif suffixe (vérifié par sabotage). Il ne doit rester qu'une seule affectation
     de `finalUrl` à une iframe dans tout le fichier — celle du chemin ORDINAIRE, où rien
     n'indique que la page refuse l'affichage. Le chemin « page bloquée », lui, n'en a
     plus aucune. */
  const codeSansCommentaires = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const affectations = (codeSansCommentaires.match(/iframe\.src\s*=\s*finalUrl\s*;/g) || []).length;
  assert.strictEqual(affectations, 1,
    'une seule affectation de finalUrl à l\'iframe doit subsister (le chemin ordinaire) ; '
    + 'le repli du tour doit poser la barre d\'échec SEULE, sans pointer vers une page mesurée non intégrable '
    + '(obtenu : ' + affectations + ')');
  assert.ok(/container\.appendChild\(buildTrickFailureBar\(finalUrl\)\);/.test(codeSansCommentaires),
    'la barre d\'échec, qui porte le bouton « ouvrir dans un onglet », doit rester posée');
  ok('tour échoué : barre d\'échec seule, pas d\'iframe vers une page qui refuse l\'affichage');

  // ── 6. La page d'origine passe avant le lecteur extrait, quand elle s'encadre ──
  /* « Charger la page et la nuke, ça semble plus stable que juste charger le lecteur ».
     Vérifiable : une page de lecteur isolée (embed.php?ch=…) part avec NOTRE origine en
     référent, sans les cookies ni les jetons que la page parente lui aurait posés ; la
     même page chargée entière construit sa chaîne interne elle-même, chaque requête
     imbriquée portant le bon référent. Substituer le lecteur à une page qui s'encadre,
     c'est troquer ce qui marche contre plus fragile.

     Relevé le 5 septembre 2026 sur le cache de production : sur 228 liens pourvus d'un
     playerUrl, 119 avaient une page d'origine DÉJÀ intégrable — plus de la moitié des
     substitutions étaient gratuites. Le lecteur extrait garde tout son sens pour les 109
     autres, dont la page refuse l'iframe. */
  assert.ok(/var lecteurUtile = !!lecteurPret && bloqueParServeur;/.test(src),
    'le lecteur extrait ne doit servir que si la page d\'origine refuse l\'iframe');
  assert.ok(/if \(!lecteurUtile\) lecteurPret = '';/.test(src),
    'quand la page s\'encadre, le lecteur extrait doit être écarté pour la charger, elle');

  const choisirSource = (playerUrl, topLevel, formeDePage) => {
    const utile = !!playerUrl && topLevel;
    if (utile) return 'lecteur extrait';
    if (topLevel || formeDePage) return 'tour';
    return 'page d\'origine';
  };
  assert.strictEqual(choisirSource('https://l.test/e', false, false), 'page d\'origine',
    'page intégrable : on la charge ELLE, le nettoyeur s\'occupe du décor');
  assert.strictEqual(choisirSource('https://l.test/e', true, false), 'lecteur extrait',
    'page bloquée : le lecteur extrait est la seule voie');
  assert.strictEqual(choisirSource('', true, false), 'tour',
    'page bloquée sans lecteur préparé : le tour reprend la main');
  assert.strictEqual(choisirSource('', false, false), 'page d\'origine',
    'rien ne signale de blocage : chargement direct, comme avant');
  assert.strictEqual(choisirSource('https://l.test/e', false, true), 'tour',
    'une page de match intégrable n\'est pas un lecteur : le tour doit y chercher la vidéo');
  ok('la page d\'origine passe avant le lecteur extrait quand elle s\'encadre');

  console.log('\n' + n + ' groupes OK — déclenchement du tour sur page bloquée');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

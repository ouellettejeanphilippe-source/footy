/* Le repos du lecteur, en fenêtre détachée (js/multiview.js).

   « Les boutons se cachent pas en fenêtre externe ? » Non, et voici pourquoi.

   Au bout de trois secondes sans un geste, la barre du lecteur et les en-têtes de tuiles
   (↗ Site, ⋮, ✕, ⤢, numéro, source) s'effacent pour ne pas rester posés sur la vidéo.
   Ce mécanisme cherchait ses éléments sous `#mv-container` et n'écoutait que lui.

   Or « Fenêtre détachée » (`toggleDocumentPiP`) DÉPLACE `#mv-grid-wrapper` — donc toutes
   les tuiles — dans le document d'une AUTRE fenêtre. Deux conséquences : plus aucun
   geste fait dans cette fenêtre n'atteignait `#mv-container` pour réarmer le compte à
   rebours, et `mvContainer.querySelectorAll('.mv-hdr')` n'y trouvait plus rien à cacher.
   Les boutons restaient donc sur la vidéo, définitivement.

   La règle que ces cas verrouillent : on agit sur la GRILLE là où elle se trouve, pas
   sur le conteneur de la page. L'API Document Picture-in-Picture n'existe pas dans le
   navigateur des tests ; on reproduit donc ce qu'elle fait — déplacer la grille dans un
   autre document — et on vérifie que les commandes s'effacent quand même. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exemple.test/app/' });
  const w = dom.window;
  w.__NO_AUTOSTART__ = true;
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle'])
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.fetch = () => Promise.reject(new Error('réseau coupé'));

  const mv = await import('../js/multiview.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  /* Le lecteur tel que `setupMultivisionUI` le construit : un conteneur, une barre, et
     la grille des tuiles — chacune avec son en-tête et son voile de repos. */
  const monter = (nbTuiles) => {
    document.body.innerHTML = '';
    const conteneur = document.createElement('div');
    conteneur.id = 'mv-container';
    const barre = document.createElement('div');
    barre.id = 'mv-toolbar';
    const grille = document.createElement('div');
    grille.id = 'mv-grid-wrapper';
    for (let i = 0; i < nbTuiles; i++) {
      const tuile = document.createElement('div');
      tuile.className = 'mv-cell';
      const hdr = document.createElement('div');
      hdr.className = 'mv-hdr';
      const voile = document.createElement('div');
      voile.className = 'mv-idle-overlay';
      tuile.appendChild(hdr);
      tuile.appendChild(voile);
      grille.appendChild(tuile);
    }
    conteneur.appendChild(barre);
    conteneur.appendChild(grille);
    document.body.appendChild(conteneur);
    return { conteneur, barre, grille };
  };
  const opacites = (racine) => [...racine.querySelectorAll('.mv-hdr')].map((h) => h.style.opacity);

  // ── 1. Dans la page : rien ne change pour le cas courant ──────────────────
  {
    const { conteneur, barre, grille } = monter(3);
    assert.strictEqual(mv.grilleDuLecteur(), grille, 'la grille est trouvée dans la page');
    assert.strictEqual(mv.grilleDetachee(), false, 'et elle n\'est pas détachée');

    assert.strictEqual(mv.appliquerRepos(grille, barre, true), 3, 'les trois en-têtes sont touchés');
    assert.deepStrictEqual(opacites(grille), ['0', '0', '0'], 'les en-têtes s\'effacent');
    assert.strictEqual(barre.style.opacity, '0', 'la barre aussi');
    assert.strictEqual(barre.style.pointerEvents, 'none', 'et elle n\'attrape plus les clics');
    assert.strictEqual(grille.style.cursor, 'none', 'le pointeur disparaît sur la vidéo');
    assert.deepStrictEqual([...grille.querySelectorAll('.mv-idle-overlay')].map((o) => o.style.display), ['block', 'block', 'block'],
      'le voile de repos passe devant');

    mv.appliquerRepos(grille, barre, false);
    assert.deepStrictEqual(opacites(grille), ['1', '1', '1'], 'un geste les rétablit');
    assert.strictEqual(barre.style.opacity, '1');
    assert.strictEqual(grille.style.cursor, 'default');
    assert.deepStrictEqual([...grille.querySelectorAll('.mv-idle-overlay')].map((o) => o.style.display), ['none', 'none', 'none']);
    assert.ok(conteneur.contains(grille), 'la grille est bien sous le conteneur, ici');
    ok('dans la page, la barre et les en-têtes s\'effacent puis reviennent');
  }

  // ── 2. Le cas qui ne marchait pas : la grille est dans un AUTRE document ──
  {
    const { conteneur, grille } = monter(2);
    // Ce que fait « Fenêtre détachée » : la grille change de document.
    const autre = document.implementation.createHTMLDocument('fenêtre détachée');
    autre.body.appendChild(grille);

    assert.ok(!conteneur.contains(grille), 'la grille n\'est plus sous #mv-container');
    assert.strictEqual(conteneur.querySelectorAll('.mv-hdr').length, 0,
      'c\'est là qu\'était la panne : le conteneur ne contient plus aucun en-tête à cacher');
    assert.notStrictEqual(grille.ownerDocument, document, 'elle appartient à un autre document');

    // La barre, elle, reste dans la page : on ne la touche pas depuis la fenêtre détachée.
    assert.strictEqual(mv.appliquerRepos(grille, null, true), 2, 'les deux en-têtes sont touchés là où ils sont');
    assert.deepStrictEqual(opacites(grille), ['0', '0'], 'et ils s\'effacent bel et bien');
    assert.deepStrictEqual([...grille.querySelectorAll('.mv-idle-overlay')].map((o) => o.style.display), ['block', 'block']);

    mv.appliquerRepos(grille, null, false);
    assert.deepStrictEqual(opacites(grille), ['1', '1'], 'et reviennent au premier geste');
    ok('en fenêtre détachée, les en-têtes s\'effacent quand même : on suit la grille, pas le conteneur');
  }

  // ── 3. Entrées vides : on ne lève rien ───────────────────────────────────
  {
    assert.strictEqual(mv.appliquerRepos(null, null, true), 0, 'pas de grille : rien à faire');
    const { barre } = monter(0);
    assert.strictEqual(mv.appliquerRepos(null, barre, true), 0);
    assert.strictEqual(barre.style.opacity, '0', 'la barre obéit même sans grille');
    document.body.innerHTML = '';
    assert.strictEqual(mv.grilleDuLecteur(), null, 'aucun lecteur monté : aucune grille');
    assert.strictEqual(mv.grilleDetachee(), false);
    ok('sans grille ni barre, rien n\'est levé');
  }

  console.log('unit_reposlecteur: ' + n + ' groupes de tests OK');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

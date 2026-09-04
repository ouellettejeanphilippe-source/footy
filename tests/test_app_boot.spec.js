/* Test de démarrage de l'application (hors ligne, déterministe).

   Aucun test ne vérifiait jusqu'ici que l'application s'affiche. Un plantage de rendu
   pouvait donc passer les huit fichiers de tests unitaires et l'intégration continue
   tout en laissant l'utilisateur devant un écran vide — c'est exactement ce qui est
   arrivé : getLogo levait une exception sur une équipe à une seule couleur, buildEPG
   s'interrompait, #ov et #errbox (qui vivent dans #marea) disparaissaient, et le
   .finally de loadAll plantait à son tour, si bien que window.hasLoadedOnce n'était
   jamais posé et que l'actualisation automatique des scores ne démarrait pas.

   Tout le réseau sortant est coupé : le test s'appuie sur data/streams.json et
   data/schedule.json du dépôt, ne dépend d'aucun site tiers et ne peut pas être
   instable. Il couvre le pire cas réaliste — les sources externes injoignables. */
import { test, expect } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Playwright transpile ce fichier en CommonJS (package.json: "type": "commonjs"),
// d'où __dirname plutôt qu'import.meta.url.
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

let server;
let origin;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    /* Faux lecteur hostile : au clic, il tente ce que font les régies de ces sites —
       ouvrir un popunder et détourner l'onglet entier. Servi par le même serveur, mais
       joint sous « localhost » quand l'application est sous « 127.0.0.1 » : deux origines
       distinctes, donc la vraie situation d'une iframe d'origine croisée. */
    if (rel === '/__faux-lecteur') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<html><body style="margin:0">'
        + '<button id="b" style="width:100vw;height:100vh">LIRE</button><script>'
        + 'document.getElementById("b").addEventListener("click",function(){'
        + 'try{window.open("about:blank");}catch(e){}'
        + 'try{top.location.href="http://regie-pub.invalid/";}catch(e){}'
        + '});<\/script></body></html>');
    }
    if (rel === '/') rel = '/index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  origin = 'http://127.0.0.1:' + server.address().port;
});

test.afterAll(async () => { if (server) await new Promise((r) => server.close(r)); });

async function bootOffline(page) {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  // Tout ce qui n'est pas servi localement est refusé : ni ESPN, ni proxy, ni site source.
  await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.hasLoadedOnce === true, null, { timeout: 60000 });
  /* `window.hasLoadedOnce` est posé dans le `.finally` de loadAll, mais le rendu final
     atterrit dans le DOM 50 à 150 ms plus tard (mesuré sur six démarrages). Un test qui
     lisait le DOM dès ce drapeau tombait donc sur une grille encore vide, au hasard de la
     machine — les assertions sur les cartes ne passaient que par chance. On attend les
     cartes elles-mêmes ; l'absence de rendu reste une vraie erreur, signalée par le
     dépassement de délai. */
  await page.waitForFunction(() => document.querySelectorAll('.match-card, .mb').length > 0,
    null, { timeout: 30000 });
  return pageErrors;
}

test('l\'application démarre et affiche des matchs sans réseau externe', async ({ page }) => {
  const pageErrors = await bootOffline(page);

  const state = await page.evaluate(() => ({
    matches: (window.S && window.S.matches) ? window.S.matches.length : 0,
    cards: document.querySelectorAll('.match-card, .mb').length,
    hasOverlay: !!document.getElementById('ov'),
    hasErrBox: !!document.getElementById('errbox'),
    hasRetryButton: !!document.querySelector('#errbox button')
  }));

  expect(pageErrors, 'aucune exception non rattrapée au démarrage :\n' + pageErrors.join('\n---\n')).toEqual([]);
  expect(state.matches, 'des matchs sont chargés depuis data/streams.json').toBeGreaterThan(0);
  expect(state.cards, 'des cartes de match sont réellement rendues').toBeGreaterThan(0);
  // #ov et #errbox vivent dans #marea, que buildEPG vide à chaque rendu : ils doivent survivre.
  expect(state.hasOverlay, 'l\'indicateur de chargement survit au rendu du guide').toBeTruthy();
  expect(state.hasErrBox, 'la boîte d\'erreur survit au rendu du guide').toBeTruthy();
  expect(state.hasRetryButton, 'le bouton « Réessayer » reste disponible').toBeTruthy();
});

test('les onglets Live et Guide se rendent sans exception', async ({ page }) => {
  const pageErrors = await bootOffline(page);

  for (const filter of ['all', 'live', 'upcoming', 'fav', 'options', 'logs', 'script', 'live']) {
    await page.evaluate((f) => window.applyFilter(f), filter);
    await page.waitForTimeout(400);
  }

  const guide = await page.evaluate(() => {
    window.applyFilter('all');
    return { timelineClass: document.body.classList.contains('view-timeline') };
  });
  await page.waitForTimeout(600);

  expect(pageErrors, 'aucune exception en changeant d\'onglet :\n' + pageErrors.join('\n---\n')).toEqual([]);
  expect(guide.timelineClass, 'le Guide active la grille temporelle').toBeTruthy();
  expect(await page.evaluate(() => document.querySelectorAll('.match-card, .mb').length)).toBeGreaterThan(0);
});

test('les boutons de navigation atteignent chaque vue', async ({ page }) => {
  const pageErrors = await bootOffline(page);

  /* La vue « À venir » a longtemps été inatteignable : applyFilter('upcoming') et sa
     branche de rendu existaient, mais aucun bouton ne les appelait. On clique ici les
     vrais boutons de la barre de navigation, pas applyFilter directement. */
  for (const [id, filter] of [['filter-live', 'live'], ['filter-upcoming', 'upcoming'], ['filter-all', 'all']]) {
    const button = page.locator('#' + id);
    await expect(button, `le bouton ${id} doit exister dans la barre de navigation`).toHaveCount(1);
    await button.click();
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.S.filter), `#${id} doit activer le filtre ${filter}`).toBe(filter);
    await expect(button).toHaveClass(/active-toggle/);
    expect(await page.evaluate(() => document.querySelectorAll('.match-card, .mb').length),
      `la vue ${filter} doit afficher des matchs`).toBeGreaterThan(0);
  }

  expect(pageErrors, 'aucune exception en naviguant :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

test('aucun débordement horizontal sur mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors = await bootOffline(page);
  const overflow = await page.evaluate(() => ({ scrollW: document.body.scrollWidth, innerW: window.innerWidth }));
  expect(pageErrors).toEqual([]);
  expect(overflow.scrollW, 'la page ne défile pas horizontalement à 390 px').toBeLessThanOrEqual(overflow.innerW + 1);
});

/* L'affiche verticale (« à la Netflix ») est la mise en page de tout écran étroit :
   c'est elle qu'il faut verrouiller, pas seulement l'absence de débordement. Le rail
   doit défiler DANS sa section — un rail qui déborde du corps de page rendrait
   l'application inutilisable au doigt, c'est le piège exact d'un `overflow-x` mal placé. */
test('sur mobile, les sections deviennent des rails d\'affiches verticales', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors = await bootOffline(page);

  const state = await page.evaluate(() => {
    const grids = Array.from(document.querySelectorAll('.match-grid'));
    const card = document.querySelector('.match-card .prime-thumbnail');
    const rect = card ? card.getBoundingClientRect() : null;
    /* Quelle section porte assez de matchs pour déborder dépend de l'heure et des
       données du jour : on interroge donc toutes les sections plutôt que la première. */
    const crowded = grids.filter((g) => g.querySelectorAll('.match-card').length >= 3);
    return {
      poster: document.body.classList.contains('cards-poster'),
      grids: grids.length,
      crowded: crowded.length,
      railScrolls: crowded.some((g) => g.scrollWidth > g.clientWidth),
      allScrollable: grids.every((g) => getComputedStyle(g).overflowX === 'auto'),
      hasToggle: !!document.querySelector('.rail-toggle'),
      ratio: rect ? rect.width / rect.height : 0,
      bodyOverflow: document.body.scrollWidth - window.innerWidth
    };
  });

  expect(pageErrors).toEqual([]);
  expect(state.poster, 'la classe cards-poster est posée sous 900 px').toBeTruthy();
  expect(state.ratio, 'la vignette est en portrait (2:3), pas en bandeau').toBeLessThan(1);
  expect(state.grids, 'des sections de cartes sont rendues').toBeGreaterThan(0);
  expect(state.allScrollable, 'chaque section défile horizontalement en rail').toBeTruthy();
  if (state.crowded > 0) {
    expect(state.railScrolls, 'un rail bien rempli déborde de sa largeur visible').toBeTruthy();
  }
  expect(state.hasToggle, 'le bouton « Tout voir » déplie le rail en grille').toBeTruthy();
  expect(state.bodyOverflow, 'le rail défile dans sa section, pas dans la page').toBeLessThanOrEqual(1);
});

/* Le badge d'une carte sans lien est le raccourci de recherche : s'il disparaît, la
   seule façon de relancer une recherche redevient l'ouverture de chaque fiche. */
test('une carte sans lien porte le bouton de recherche, une carte pourvue son compteur', async ({ page }) => {
  const pageErrors = await bootOffline(page);

  const badges = await page.evaluate(() => {
    const withLinks = document.querySelector('div.card-streams');
    const without = document.querySelector('button.card-streams-search');
    return {
      counter: withLinks ? withLinks.textContent.trim() : null,
      searchButton: !!without,
      searchHandler: without ? without.getAttribute('onclick') : null,
      handlerExists: typeof window.cardSearchLinks === 'function',
      duplicates: document.querySelectorAll('.match-card').length > 0
        && Array.from(document.querySelectorAll('.match-card'))
             .every((c) => c.querySelectorAll('.card-streams').length <= 1)
    };
  });

  expect(pageErrors).toEqual([]);
  expect(badges.counter, 'le compteur de flux affiche « ▶ n »').toMatch(/^▶ \d+$/);
  expect(badges.handlerExists, 'cardSearchLinks est exposé aux attributs onclick').toBeTruthy();
  /* `data/streams.json` est régénéré chaque heure : rien ne garantit qu'un match sans
     lien figure dans la grille du jour. On vérifie le badge quand il y en a un. */
  if (badges.searchButton) expect(badges.searchHandler).toContain('cardSearchLinks');
  expect(badges.duplicates, 'une seule pastille de flux par carte').toBeTruthy();
});

/* Le script Tampermonkey écrasait `window.open` À L'INTÉRIEUR de la page tierce pour
   bloquer les popunders — ce que l'application, séparée par l'origine croisée, ne peut
   pas faire en JavaScript. L'attribut `sandbox` obtient le même résultat de façon
   déclarative, appliqué par le navigateur, donc pour tous les utilisateurs et sans
   extension. Ce test compare les deux situations sur un lecteur réellement hostile.

   Le clic est un vrai clic : Chrome bloque déjà la navigation du parent sans activation
   utilisateur, si bien qu'un test sans clic passerait au vert même sans bac à sable et
   ne prouverait rien. */
test('le bac à sable des lecteurs bloque popunder et détournement d\'onglet', async ({ page, context }) => {
  const { PLAYER_SANDBOX } = await import('../js/embed-bridge.js');
  const faux = 'http://localhost:' + server.address().port + '/__faux-lecteur';

  async function joue(avecSandbox) {
    const p = await context.newPage();
    const popups = [];
    context.on('page', (q) => popups.push(q.url()));
    await p.goto(origin + '/__faux-lecteur');   // page d'accueil quelconque, même origine
    await p.evaluate(([src, sb]) => {
      const f = document.createElement('iframe');
      f.style.cssText = 'width:300px;height:200px';
      if (sb) f.setAttribute('sandbox', sb);
      f.src = src;
      document.body.appendChild(f);
    }, [faux, avecSandbox ? PLAYER_SANDBOX : null]);
    await p.frameLocator('iframe').locator('#b').click();
    await p.waitForTimeout(1200);
    const detourne = !p.url().startsWith(origin);
    await p.close();
    return { detourne, popups: popups.length };
  }

  const sans = await joue(false);
  expect(sans.detourne || sans.popups > 0,
    'sans bac à sable, le lecteur hostile doit réussir son attaque — sinon le test ne prouve rien')
    .toBe(true);

  const avec = await joue(true);
  expect(avec.detourne, 'avec bac à sable, l\'onglet ne doit pas être détourné').toBe(false);
  expect(avec.popups, 'avec bac à sable, aucun popup ne doit s\'ouvrir').toBe(0);
});

/* Le bac à sable ne vaut que par ce qu'il n'accorde PAS. Un jeton ajouté par mégarde —
   allow-popups en tête — rouvrirait exactement ce que le test précédent ferme. */
test('le bac à sable des lecteurs accorde le nécessaire et rien de plus', async () => {
  const { PLAYER_SANDBOX, EMBED_SANDBOX } = await import('../js/embed-bridge.js');
  const jetons = PLAYER_SANDBOX.split(/\s+/);

  // Sans same-origin, un lecteur perd cookies, stockage et requêtes vers son domaine.
  // Sur une iframe d'origine croisée, l'accorder ne donne accès qu'à sa propre origine.
  expect(jetons).toContain('allow-scripts');
  expect(jetons).toContain('allow-same-origin');
  expect(jetons).toContain('allow-presentation');

  for (const interdit of ['allow-popups', 'allow-popups-to-escape-sandbox',
    'allow-top-navigation', 'allow-top-navigation-by-user-activation', 'allow-modals']) {
    expect(jetons, interdit + ' rouvrirait la porte aux popunders ou au détournement')
      .not.toContain(interdit);
  }

  // Le document RECONSTRUIT, lui, vit à notre origine : same-origin y serait une faille.
  expect(EMBED_SANDBOX.split(/\s+/),
    'un document reconstruit avec allow-same-origin lirait le localStorage de l\'application')
    .not.toContain('allow-same-origin');
});

/* Les titres de section de l'onglet Live ne se repliaient pas : `renderMatches` déclarait
   `var icon` pour le chevron puis une seconde fois, dans la MÊME portée de fonction, pour
   l'icône de ligue. Au clic, le gestionnaire trouvait donc une chaîne — ou `undefined` — à
   la place de l'élément, levait « Cannot set properties of undefined » avant la ligne qui
   masque la grille, et aucune section ne bougeait. L'état basculait pourtant, si bien
   qu'un test lisant `S.collapsedSections` aurait été vert : c'est l'affichage réel qu'il
   faut regarder, et l'absence d'exception.

   Un test de rendu ne voyait rien de tout cela, la page se construisant correctement. */
test('chaque section repliable de l\'onglet Live répond au clic', async ({ page }) => {
  /* Au premier démarrage, l'application propose le script utilisateur dans un modal
     centré qui recouvre la grille et avale les clics — et le referme mal : il revient
     après qu'on l'a fermé, si bien qu'on ne peut pas l'écarter depuis le test. On se
     place donc dans la situation qui nous intéresse, celle d'un utilisateur qui l'a déjà
     vu. Les clics restent de vrais clics, non forcés : le jour où un élément recouvrira
     réellement les titres, ce test le dira. */
  await page.addInitScript(() => {
    try { localStorage.setItem('hasSeenScriptModal', 'true'); } catch (e) {}
  });
  const pageErrors = await bootOffline(page);

  const titres = page.locator('#marea .section-title[role="button"]');
  const n = await titres.count();
  expect(n, 'l\'onglet Live doit présenter des sections repliables').toBeGreaterThan(0);

  let testes = 0;
  for (let i = 0; i < n; i++) {
    const t = titres.nth(i);
    /* Une section imbriquée (les ligues sous « Autres streams ») disparaît quand on
       replie sa parente : c'est le comportement voulu, pas une panne. On ne teste que
       ce qui est réellement atteignable au moment où on y arrive. */
    if (!(await t.isVisible())) continue;
    testes++;
    const nom = (await t.innerText()).replace(/\n.*/s, '').trim();

    const avant = await t.evaluate((el) => getComputedStyle(el.nextElementSibling).display);
    await t.click();
    const pendant = await t.evaluate((el) => getComputedStyle(el.nextElementSibling).display);
    expect(pendant, 'le clic sur « ' + nom + ' » doit changer l\'affichage').not.toBe(avant);
    expect(await t.getAttribute('aria-expanded'), 'aria-expanded suit l\'état de « ' + nom + ' »')
      .toBe(pendant === 'none' ? 'false' : 'true');

    await t.click();   // et l'inverse remet en place
    expect(await t.evaluate((el) => getComputedStyle(el.nextElementSibling).display),
      'un second clic sur « ' + nom + ' » doit revenir à l\'état initial').toBe(avant);
  }

  expect(testes, 'au moins les sections de premier niveau doivent avoir été éprouvées')
    .toBeGreaterThanOrEqual(3);

  // Le clavier doit faire la même chose : un titre repliable s'annonce comme un bouton.
  const premier = titres.first();
  const ouvert = await premier.evaluate((el) => getComputedStyle(el.nextElementSibling).display);
  await premier.focus();
  await page.keyboard.press('Enter');
  expect(await premier.evaluate((el) => getComputedStyle(el.nextElementSibling).display),
    'la touche Entrée doit replier la section').not.toBe(ouvert);

  expect(pageErrors, 'aucune exception ne doit être levée en manipulant les sections').toEqual([]);
});

/* L'onglet Live ne doit contenir que ce qui est en cours ou commence dans l'heure.
   Il affichait plus de 200 matchs pour 2 réellement en cours, faute d'une borne basse :
   le prédicat gardait tout ce qui avait commencé dans les 24 dernières heures. */
test('l\'onglet Live ne montre que le direct et l\'heure qui vient', async ({ page }) => {
  await bootOffline(page);

  const { hors, vus, total, titres } = await page.evaluate(async () => {
    const C = await import('./js/config.js');
    const now = new Date();

    /* Les cartes portent `id="mb-<id du match>"` : c'est le seul lien entre le DOM et
       les données. Une première version cherchait `dataset.matchId`, qui n'existe pas —
       l'ensemble des matchs rendus restait vide et le test passait sans rien vérifier. */
    const rendus = new Set();
    document.querySelectorAll('#marea .match-card[id^="mb-"]').forEach((c) => {
      rendus.add(c.id.slice(3));
    });

    const hors = [];
    let vus = 0;
    (window.S.matches || []).forEach((m) => {
      if (!rendus.has(String(m.id))) return;
      vus++;
      if (!C.isLiveNow(m, now) && !C.startsWithin(m, C.LIVE_WINDOW_MIN, now)) {
        hors.push({ heure: m.startTime, statut: m.status, minutes: C.minutesUntilStart(m, now) });
      }
    });
    return { hors: hors.slice(0, 8), vus, total: (window.S.matches || []).length,
             titres: [...document.querySelectorAll('#marea .section-title')].map((t) => t.innerText.split('\n')[0].trim()) };
  });

  /* Sans cette garde, le test resterait vert le jour où l'identifiant des cartes
     changerait : il ne vérifierait plus rien du tout. */
  expect(vus, 'aucune carte rendue n\'a pu être reliée aux données : le test ne vérifierait rien')
    .toBeGreaterThan(0);
  expect(total, 'la grille de test doit contenir des matchs hors fenêtre à écarter')
    .toBeGreaterThan(vus);

  expect(hors, 'des matchs ni en cours ni imminents sont affichés dans Live').toEqual([]);
  expect(titres.join(' | '), 'la section « plus tard » n\'a plus lieu d\'être dans Live')
    .not.toContain('Plus tard');
});

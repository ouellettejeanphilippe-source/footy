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

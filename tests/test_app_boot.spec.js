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

/* Instant sur lequel les tests figent l'horloge du navigateur.

   Sans figeage, ce que l'onglet Live contient dépend de l'heure à laquelle la suite
   tourne : depuis qu'il se limite au direct et à l'heure qui vient, une exécution à 4 h
   du matin trouverait une grille vide et ferait échouer des tests qui n'ont rien à voir.

   Une première version se calait sur le `generatedAt` du cache. Ce n'était pas assez :
   le cache est régénéré chaque heure, et rien ne garantit qu'il y ait des matchs en
   direct au moment précis où il a été produit — un cache de 5 h du matin donne une
   grille vide, et le test des rails d'affiches tombe (constaté sur un cache généré à
   23 h EST, où tout le programme était encore à venir).

   On choisit donc l'instant D'APRÈS LES DONNÉES : celui où le plus de matchs sont en
   cours ou imminents. Le calcul de l'heure locale passe par le même fuseau que
   l'application (America/New_York), donc sans arithmétique d'heure d'été à la main. */
const EST = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
});

function estParts(date) {
  const p = Object.fromEntries(EST.formatToParts(date).map((x) => [x.type, x.value]));
  return { jour: `${p.year}-${p.month}-${p.day}`, minutes: parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10) };
}

function instantDesDonnees() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'streams.json'), 'utf8'));
  const matchs = (data.matches || []).filter((m) => /^\d{1,2}:\d{2}$/.test(m.startTime || ''));
  const base = Date.parse(data.generatedAt || '');
  if (!Number.isFinite(base)) throw new Error('data/streams.json sans generatedAt exploitable');
  if (!matchs.length) return new Date(base);

  // On balaie la journée par pas de 15 minutes et on retient l'instant le plus peuplé.
  let meilleur = base, score = -1;
  for (let pas = -24 * 4; pas <= 24 * 4; pas++) {
    const t = base + pas * 15 * 60 * 1000;
    const { jour, minutes } = estParts(new Date(t));
    let n = 0;
    for (const m of matchs) {
      const [h, mn] = m.startTime.split(':').map(Number);
      let diff = h * 60 + mn - minutes;
      if (m.matchDate && m.matchDate !== jour) {
        diff += Math.round((Date.parse(m.matchDate + 'T00:00:00Z') - Date.parse(jour + 'T00:00:00Z')) / 60000);
      }
      if (diff > -180 && diff <= 60) n++;   // en cours ou dans l'heure
    }
    if (n > score) { score = n; meilleur = t; }
  }
  return new Date(meilleur);
}

async function bootOffline(page) {
  await page.clock.setFixedTime(instantDesDonnees());
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

  for (const filter of ['all', 'live', 'fav', 'options', 'logs', 'script', 'live']) {
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

  /* On clique les vrais boutons de la barre de navigation, pas applyFilter directement :
     une vue dont le bouton manque est inatteignable, quoi qu'en dise le code de rendu —
     c'était le cas de « À venir », depuis retirée. */
  for (const [id, filter] of [['filter-live', 'live'], ['filter-all', 'all']]) {
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
/* UN SEUL AXE DE DÉFILEMENT.

   Les affiches étaient d'abord posées en rails horizontaux. Ça réglait le problème
   d'origine — la carte large prenait toute la largeur d'un téléphone pour un seul match —
   mais en créait un autre, signalé à l'usage : deux axes de balayage sur le même écran,
   le pouce ne sachant plus lequel il pilote. Les affiches restent, en grille.

   Ce test remplace celui qui exigeait l'inverse : c'est un changement de comportement
   voulu, pas une régression, et le test doit dire la règle actuelle. */
test('sur mobile, les affiches tiennent en grille et un seul axe défile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors = await bootOffline(page);

  const etat = await page.evaluate(() => {
    const grids = Array.from(document.querySelectorAll('.match-grid'));
    const card = document.querySelector('.match-card .prime-thumbnail');
    const rect = card ? card.getBoundingClientRect() : null;
    /* Quelle section porte assez de matchs pour déborder dépend de l'heure et des
       données du jour : on interroge donc toutes les sections plutôt que la première. */
    const remplies = grids.filter((g) => g.querySelectorAll('.match-card').length >= 3);
    return {
      poster: document.body.classList.contains('cards-poster'),
      grids: grids.length,
      remplies: remplies.length,
      /* Aucune section ne doit déborder de sa largeur : c'est ce débordement qui créait
         le second axe. */
      debordeALHorizontale: grids.some((g) => g.scrollWidth > g.clientWidth + 1),
      toutesEnGrille: grids.every((g) => g.classList.contains('expanded')),
      /* Trois affiches par ligne : le gain de densité qui justifiait le format doit
         survivre au passage en grille. */
      parLigne: rect ? Math.round(window.innerWidth / rect.width) : 0,
      basculePresente: !!document.querySelector('.rail-toggle'),
      libelleBascule: (document.querySelector('.rail-toggle') || {}).textContent || '',
      ratio: rect ? rect.width / rect.height : 0,
      bodyOverflow: document.body.scrollWidth - window.innerWidth
    };
  });

  expect(pageErrors).toEqual([]);
  expect(etat.poster, 'la classe cards-poster est posée sous 900 px').toBeTruthy();
  expect(etat.ratio, 'la vignette est en portrait (2:3), pas en bandeau').toBeLessThan(1);
  expect(etat.grids, 'des sections de cartes sont rendues').toBeGreaterThan(0);
  expect(etat.toutesEnGrille, 'chaque section est en grille par défaut, pas en rail').toBeTruthy();
  expect(etat.debordeALHorizontale, 'aucune section ne défile horizontalement : un seul axe').toBeFalsy();
  expect(etat.parLigne, 'les affiches restent denses : au moins deux par ligne').toBeGreaterThanOrEqual(2);
  expect(etat.bodyOverflow, 'la page elle-même ne défile pas horizontalement').toBeLessThanOrEqual(1);
  expect(etat.basculePresente, 'le rail reste offert par section, il n\'est plus le défaut').toBeTruthy();
  expect(etat.libelleBascule, 'le bouton propose le rail, puisqu\'on est en grille').toContain('Rail');
});

/* Repasser une section en rail reste possible : le choix est offert, il n'est plus imposé. */
test('le bouton de section rebascule en rail, et revient', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors = await bootOffline(page);

  const bouton = page.locator('.rail-toggle').first();
  await expect(bouton).toHaveText(/Rail/);

  await bouton.click();
  const enRail = await page.evaluate(() => {
    const g = document.querySelector('.match-grid');
    return { expanded: g.classList.contains('expanded'), overflow: getComputedStyle(g).overflowX };
  });
  expect(enRail.expanded, 'après clic, la section quitte la grille').toBeFalsy();
  expect(enRail.overflow, 'et redevient un rail qui défile').toBe('auto');
  await expect(bouton).toHaveText(/Grille/);

  await bouton.click();
  await expect(bouton).toHaveText(/Rail/);
  const revenu = await page.evaluate(() =>
    document.querySelector('.match-grid').classList.contains('expanded'));
  expect(revenu, 'un second clic ramène la grille').toBeTruthy();
  expect(pageErrors).toEqual([]);
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

/* Le bac à sable des lecteurs (PLAYER_SANDBOX) a été retiré le 5 septembre 2026 : « quand
   y'a le tag sandbox, ça chie » — beaucoup de sites détectent une iframe en bac à sable
   et refusent de s'afficher, quels que soient les jetons accordés. Les deux tests qui
   vérifiaient ce mécanisme sont retirés avec lui plutôt que laissés à vérifier du code
   mort, ce qui donnerait l'impression trompeuse que la protection reste active.

   Le document RECONSTRUIT en `srcdoc`, lui, garde son bac à sable (EMBED_SANDBOX) :
   contrairement au lecteur ordinaire, ce document vit à l'origine même de l'application
   — sans bac à sable il lirait son localStorage et son DOM. Rien, côté site distant, ne
   peut détecter ni contourner ce bac à sable puisqu'il ne s'agit pas de SA page mais
   d'une copie que l'application a elle-même écrite : la plainte de l'utilisateur ne le
   concerne donc pas. */
test('le document reconstruit garde son bac à sable, sans allow-same-origin', async () => {
  const { EMBED_SANDBOX } = await import('../js/embed-bridge.js');
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

/* La vue « À venir » n'était qu'une liste à plat du programme, que le Guide couvre déjà
   sous forme de grille temporelle. Son bouton est retiré ; ce test vérifie qu'il ne
   revient pas, et surtout qu'un appel résiduel à la vue disparue ne laisse pas une page
   vide : `data-filter` porterait une valeur qu'aucune branche de rendu ne traite. */
test('la vue « À venir » est retirée sans laisser de cul-de-sac', async ({ page }) => {
  const pageErrors = await bootOffline(page);

  await expect(page.locator('#filter-upcoming'),
    'le bouton « À venir » ne doit plus figurer dans la navigation').toHaveCount(0);
  await expect(page.locator('.nav-links'), 'ni son libellé').not.toContainText('À venir');

  const apres = await page.evaluate(() => {
    window.applyFilter('upcoming');
    return { filtre: window.S.filter, attribut: document.body.getAttribute('data-filter') };
  });
  await page.waitForTimeout(600);

  expect(apres.filtre, 'un appel à la vue disparue retombe sur le direct').toBe('live');
  expect(apres.attribut, 'data-filter ne doit jamais rester sur une vue sans rendu').toBe('live');
  expect(await page.evaluate(() => document.querySelectorAll('.match-card, .mb').length),
    'et la page reste peuplée plutôt que vide').toBeGreaterThan(0);
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

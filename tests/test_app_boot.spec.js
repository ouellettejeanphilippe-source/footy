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

/* PLUS AUCUN attribut `sandbox` sur une iframe de lecteur, nulle part.

   Retiré en deux temps le 5 septembre 2026, sur demande répétée de l'utilisateur, capture
   d'écran à l'appui. D'abord sur les lecteurs ordinaires (« quand y'a le tag sandbox, ça
   chie ») ; puis sur le document RECONSTRUIT en `srcdoc`, qu'on avait cru hors d'atteinte
   au motif que « rien, côté site distant, ne peut détecter ce bac à sable puisqu'il ne
   s'agit pas de SA page mais d'une copie ». C'était faux : la copie contient SON code, qui
   s'exécute à l'origine de l'application et voit parfaitement l'origine opaque, le
   localStorage qui lève, et l'attribut lui-même sur `frameElement`. L'utilisateur a
   renvoyé la preuve — « Sandbox detected, please remove sandbox attributes », en rouge, à
   la place du lecteur.

   Ce test remplace celui qui verrouillait l'ancien mécanisme : il verrouille l'absence,
   sur la SOURCE plutôt que sur un rendu, pour attraper aussi les chemins qu'un démarrage
   hors ligne ne traverse pas (la branche `srcdoc` n'est atteinte qu'après un tour réussi
   sur une page bloquée, impossible à provoquer sans réseau). */
test('aucune iframe de lecteur ne porte d\'attribut sandbox', async () => {
  const fs = require('fs');
  const path = require('path');
  const racine = path.resolve(__dirname, '..');
  for (const fichier of ['js/multiview.js', 'js/embed-bridge.js', 'index.html']) {
    const src = fs.readFileSync(path.join(racine, fichier), 'utf8');
    // Les occurrences en commentaire racontent l'histoire du retrait : on ne vise que le code.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code, `${fichier} ne doit poser aucun attribut sandbox sur une iframe`)
      .not.toMatch(/setAttribute\(\s*['"]sandbox['"]/);
    expect(code, `${fichier} ne doit pas déclarer d'attribut sandbox en HTML`)
      .not.toMatch(/<iframe[^>]*\ssandbox\s*=/i);
  }
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

/* ═══ Haut de page nu et menus du lecteur (6 septembre 2026) ═══════════════════

   « Enlever logo et favicon en haut à gauche… enlever tous les éléments dans le haut de
   la page (recherche, toggles de ligue et cie), garder l'interface la plus claire
   possible. » La coquille ne porte plus que les onglets ; ce test verrouille l'absence,
   comme le précédent verrouillait la présence. Recherche, date et pastilles restent
   dans l'interface classique (legacy.html), qui partage le même code. */
test('le haut de page ne porte que les onglets : ni marque, ni recherche, ni date, ni ligues', async ({ page }) => {
  const pageErrors = await bootOffline(page);

  for (const sel of ['.brand', '#sport-filters-container', '#search-input', '#date-selector', '#sport-filters', '#btn-find-missing']) {
    await expect(page.locator(sel), sel + ' ne doit plus exister dans la coquille').toHaveCount(0);
  }
  const entete = await page.evaluate(() => {
    const h = document.getElementById('app-header');
    const r = h.getBoundingClientRect();
    const epg = document.getElementById('epg').getBoundingClientRect();
    return { enfants: Array.from(h.children).map((c) => c.id), hauteur: r.height, debutGrille: epg.top };
  });
  expect(entete.enfants, 'l\'en-tête ne contient que la navigation').toEqual(['nav-links']);
  expect(entete.hauteur, 'un en-tête d\'une seule rangée').toBeLessThanOrEqual(64);
  expect(entete.debutGrille, 'la grille commence juste sous les onglets').toBeLessThanOrEqual(entete.hauteur + 1);

  await page.evaluate(() => window.applyFilter('all'));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.querySelectorAll('.match-card, .mb').length), 'le Guide reste peuplé').toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
});

/* « Faire que le dropdown des options soit par-dessus le multiview. » Les menus posés
   dans la tuile étaient rognés par son `overflow: hidden` et recouverts par la tuile
   voisine (et son iframe). Ils vivent désormais au niveau du document, en position
   fixe (js/mv-menu.js) : on vérifie que ce qui est PEINT au centre du menu est bien le
   menu, et que chaque tuile porte le bouton « Site » — le repli vers la page originale. */
test('les menus du lecteur s\'ouvrent par-dessus les tuiles, entiers, et se ferment ailleurs', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', 'true'); } catch (e) {} });
  const pageErrors = await bootOffline(page);

  await page.evaluate((o) => {
    window.addToMultivision(o + '/__faux-lecteur?a', 'Match A', 'mA');
    window.addToMultivision(o + '/__faux-lecteur?b', 'Match B', 'mB');
  }, origin);
  await expect(page.locator('#mv-container')).toBeVisible();
  await expect(page.locator('.mv-cell')).toHaveCount(2);

  // Menu de la première tuile : la plus à gauche, celle que sa voisine recouvrait.
  await page.locator('.mv-cell[data-index="0"] .mv-tile-menu-btn').click();
  const menu = page.locator('.mv-menu');
  await expect(menu).toHaveCount(1);
  const etat = await page.evaluate(() => {
    const m = document.querySelector('.mv-menu');
    const r = m.getBoundingClientRect();
    const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      fixe: getComputedStyle(m).position,
      horsTuile: !m.closest('.mv-cell'),
      dansEcran: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
      entier: r.height > 100 && r.width > 150,
      auDessus: !!(dessus && m.contains(dessus)),
      items: Array.from(m.querySelectorAll('.mv-menu-item')).map((b) => b.textContent.trim()).join(' | ')
    };
  });
  expect(etat.fixe).toBe('fixed');
  expect(etat.horsTuile, 'le menu n\'est pas dans la tuile').toBeTruthy();
  expect(etat.dansEcran, 'le menu tient dans la fenêtre').toBeTruthy();
  expect(etat.entier, 'le menu est entier, pas rogné').toBeTruthy();
  expect(etat.auDessus, 'ce qui est peint au centre du menu est le menu, pas une tuile').toBeTruthy();
  expect(etat.items).toContain('Ouvrir sur le site');
  expect(etat.items).toContain('Fermer cette vidéo');

  await expect(page.locator('.mv-cell[data-index="0"] .mv-site-btn'), 'le repli vers le site est un bouton visible de la tuile').toBeVisible();

  await page.mouse.click(4, 4);
  await expect(menu, 'un clic ailleurs ferme le menu').toHaveCount(0);

  await page.locator('#mv-layout-toggle-btn').click();
  await expect(page.locator('.mv-menu')).toHaveCount(1);
  await page.locator('.mv-menu .mv-menu-item', { hasText: 'Côte à côte' }).click();
  await expect(page.locator('.mv-menu')).toHaveCount(0);
  expect(await page.evaluate(() => window.mvLayout), 'le choix de disposition est appliqué').toBe('horizontal');

  await page.locator('#mv-more-btn').click();
  await expect(page.locator('.mv-menu')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.mv-menu'), 'Échap ferme le menu').toHaveCount(0);

  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* Deux croix se superposaient dans la fiche : `document.querySelector('.mhd')` attrapait
   l'en-tête de l'Investigator (première `.mhd` du document), jamais celui de la fiche, et
   openMod injectait une seconde croix par-dessus la colonne des flux. */
test('la fiche de match a une seule croix, se ferme par Échap, et ses flux portent leurs actions', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', 'true'); } catch (e) {} });
  const pageErrors = await bootOffline(page);

  await page.locator('#marea .match-card').first().click();
  await expect(page.locator('#mbg')).toHaveClass(/open/);
  await page.waitForTimeout(500);

  const fiche = await page.evaluate(() => ({
    croix: [...document.querySelectorAll('#mbg .mx')].filter((b) => b.offsetParent !== null).length,
    titre: document.getElementById('mname').innerText.trim(),
    entete: getComputedStyle(document.querySelector('#mbg .mhd')).display,
    /* « Intégrer les logos et couleurs des équipes dans le haut » : l'en-tête porte le
       dégradé des équipes, les deux blasons et le score. */
    banniere: !!document.querySelector('#mbg .mhd .fiche-banner'),
    blasons: document.querySelectorAll('#mbg .mhd .fiche-banner .prime-logo').length,
    fondEquipes: /gradient|rgb/.test(document.querySelector('#mbg .mhd').style.background),
    corpsSansDoublon: document.querySelectorAll('#mbg .mbody .prime-thumbnail').length,
    flux: document.querySelectorAll('#modal-right-col .si').length,
    actions: document.querySelectorAll('#modal-right-col .si .si-btn').length,
    barre: !!document.querySelector('#modal-right-col .flux-head #mv-refresh-btn')
  }));
  expect(fiche.croix, 'exactement une croix de fermeture visible').toBe(1);
  expect(fiche.entete, 'l\'en-tête de la fiche est visible').not.toBe('none');
  expect(fiche.titre.length).toBeGreaterThan(3);
  expect(fiche.banniere, 'l\'en-tête est la bannière du match').toBeTruthy();
  expect(fiche.blasons, 'deux blasons dans l\'en-tête').toBe(2);
  expect(fiche.fondEquipes, 'le fond de l\'en-tête est aux couleurs des équipes').toBeTruthy();
  expect(fiche.corpsSansDoublon, 'le corps ne répète plus la vignette').toBe(0);
  expect(fiche.barre, 'la barre d\'actions des flux est présente').toBeTruthy();
  if (fiche.flux > 0) expect(fiche.actions, 'quatre actions par ligne de flux').toBe(fiche.flux * 4);

  await page.keyboard.press('Escape');
  await expect(page.locator('#mbg')).not.toHaveClass(/open/);
  expect(pageErrors).toEqual([]);
});

test('sur mobile, les onglets forment une barre au bas de l\'écran et la fiche monte du bas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', 'true'); } catch (e) {} });
  const pageErrors = await bootOffline(page);

  const nav = await page.evaluate(() => {
    const r = document.getElementById('nav-links').getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, width: r.width, h: window.innerHeight, w: window.innerWidth };
  });
  expect(nav.bottom, 'la barre touche le bas de l\'écran').toBeGreaterThanOrEqual(nav.h - 1);
  expect(nav.top, 'la barre est en bas, pas en haut').toBeGreaterThan(nav.h / 2);
  expect(nav.width, 'la barre occupe toute la largeur').toBeGreaterThanOrEqual(nav.w - 1);

  for (const id of ['filter-live', 'filter-all', 'mv-toggle-btn', 'menu-btn']) {
    const box = await page.locator('#' + id).boundingBox();
    expect(box && box.height, id + ' est une cible tactile d\'au moins 40 px').toBeGreaterThanOrEqual(40);
  }

  await page.locator('#marea .match-card').first().click();
  await expect(page.locator('#mbg')).toHaveClass(/open/);
  await page.waitForTimeout(400); // fin de l'animation d'entrée (sheetup, 200 ms)
  const sheet = await page.evaluate(() => {
    const r = document.querySelector('#mbg .modal').getBoundingClientRect();
    const mx = document.querySelector('#mbg .mx').getBoundingClientRect();
    const fermer = document.querySelector('#mbg .sheet-close').getBoundingClientRect();
    const sousFermer = document.elementFromPoint(fermer.left + fermer.width / 2, fermer.top + fermer.height / 2);
    return {
      top: r.top, bottom: r.bottom, width: r.width, h: window.innerHeight, w: window.innerWidth,
      croixVisible: mx.top >= 0 && mx.bottom <= window.innerHeight,
      fermerVisible: fermer.height >= 44 && fermer.bottom <= window.innerHeight + 1,
      fermerAuDessus: !!(sousFermer && sousFermer.closest('.sheet-close'))
    };
  });
  expect(sheet.bottom, 'la fiche est ancrée au bas').toBeGreaterThanOrEqual(sheet.h - 1);
  expect(sheet.width, 'la fiche occupe toute la largeur').toBeGreaterThanOrEqual(sheet.w - 1);
  /* « Mal placé en haut et difficile de sortir de la carte » : la feuille tient dans
     l'écran, sa croix est visible, et le bouton « Fermer » n'est pas recouvert par la
     barre du bas. */
  expect(sheet.top, 'la feuille ne déborde pas par le haut').toBeGreaterThanOrEqual(0);
  expect(sheet.croixVisible, 'la croix est dans l\'écran').toBeTruthy();
  expect(sheet.fermerVisible, 'un gros bouton Fermer est visible').toBeTruthy();
  expect(sheet.fermerAuDessus, 'le bouton Fermer n\'est pas sous la barre du bas').toBeTruthy();
  await page.locator('#mbg .sheet-close').click();
  await expect(page.locator('#mbg'), 'Fermer ferme la feuille').not.toHaveClass(/open/);
  expect(pageErrors).toEqual([]);
});

/* L'interface classique reste livrée (legacy.html + styles-legacy.css) et partage tout le
   code : elle doit démarrer aussi, et le choix doit tenir d'une ouverture à l'autre. */
test('l\'interface classique démarre et la préférence redirige index.html', async ({ page }) => {
  await page.clock.setFixedTime(instantDesDonnees());
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', 'true'); localStorage.setItem('ui_legacy', '1'); } catch (e) {} });

  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/legacy\.html/, { timeout: 10000 });
  await page.waitForFunction(() => window.hasLoadedOnce === true, null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.match-card, .mb').length > 0, null, { timeout: 30000 });

  expect(await page.locator('link[rel="stylesheet"]').first().getAttribute('href')).toBe('styles-legacy.css');
  await expect(page.locator('#btn-new-ui'), 'le retour vers la nouvelle interface est offert').toHaveCount(1);
  expect(pageErrors, 'aucune exception dans l\'interface classique :\n' + pageErrors.join('\n')).toEqual([]);
});

/* Scores en direct : le rafraîchissement ESPN doit se voir PARTOUT — dans S.matches (fiche,
   filtres), sur les cartes du Live, sur les blocs du Guide — et un match terminé selon ESPN
   doit quitter l'onglet Live sans attendre un changement d'onglet. Jusqu'ici seul le texte
   des cartes bougeait ; les objets restaient ceux d'il y a cinq minutes et les blocs du
   Guide gardaient leur texte de construction. */
test('un match terminé selon ESPN quitte le Live, et le Guide suit le score', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', 'true'); } catch (e) {} });
  const pageErrors = await bootOffline(page);

  const cible = await page.evaluate(() => {
    const card = document.querySelector('#marea .match-card.live[id^="mb-"]') || document.querySelector('#marea .match-card[id^="mb-"]');
    const id = card.id.slice(3);
    const m = window.S.matchMap.get(id);
    return { id, status: m.status, cartes: document.querySelectorAll('#marea .match-card').length };
  });

  // Rafraîchissement ESPN simulé : ce match est terminé, 4-2.
  const apres = await page.evaluate((c) => {
    const n = window.applyScoreUpdates([{ id: c.id, status: 'finished', score: [4, 2], minute: null }]);
    return new Promise((r) => setTimeout(() => r({
      changes: n,
      statut: window.S.matchMap.get(c.id).status,
      score: window.S.matchMap.get(c.id).score,
      encoreRendu: !!document.getElementById('mb-' + c.id),
      cartes: document.querySelectorAll('#marea .match-card').length
    }), 400));
  }, cible);
  expect(apres.changes, 'un match a changé').toBe(1);
  expect(apres.statut, 'S.matches porte le nouveau statut').toBe('finished');
  expect(apres.score).toEqual([4, 2]);
  expect(apres.encoreRendu, 'le match terminé a quitté l\'onglet Live').toBeFalsy();
  expect(apres.cartes).toBe(cible.cartes - 1);

  // Dans le Guide, le bloc de ce match affiche le score final ; un score qui bouge se voit.
  await page.evaluate(() => window.applyFilter('all'));
  await page.waitForTimeout(500);
  const bloc = await page.evaluate((c) => {
    const b = document.getElementById('mb-' + c.id);
    return { texte: b && b.querySelector('.mb-time').textContent, fini: b && b.classList.contains('finished') };
  }, cible);
  expect(bloc.texte).toContain('4 - 2');
  expect(bloc.fini).toBeTruthy();

  const enDirect = await page.evaluate((c) => {
    window.applyScoreUpdates([{ id: c.id, status: 'live', score: [5, 2], minute: "78'" }]);
    return new Promise((r) => setTimeout(() => {
      const b = document.getElementById('mb-' + c.id);
      r({ texte: b.querySelector('.mb-time').textContent, live: b.classList.contains('live') });
    }, 300));
  }, cible);
  expect(enDirect.texte, 'le bloc du Guide suit minute et score').toContain("78'");
  expect(enDirect.texte).toContain('5 - 2');
  expect(enDirect.live).toBeTruthy();
  expect(pageErrors).toEqual([]);
});

/* ═══ Cache serveur injoignable (6 septembre 2026) ═════════════════════════════════

   « Pas de liens pour ce match ? » — capture sur téléphone, réseau cellulaire : toutes les
   cartes portaient 🔎 alors que le cache publié avait 44 liens pour le match montré. Le
   fichier des liens (750 Ko) n'était simplement pas arrivé, et l'application traitait cet
   échec comme « aucun lien nulle part » : liste vidée, loupe sur chaque carte (qui lance
   une recherche par proxys, sans rapport avec la cause), et pas de nouvel essai avant la
   prochaine passe — que le téléphone gèle en arrière-plan.

   Le service worker est bloqué dans ces contextes : il servirait sinon sa copie du
   fichier et l'interception d'une réponse d'erreur ne prouverait rien. */
async function bootAvecCacheCassable(browser, mobile) {
  const ctx = await browser.newContext(Object.assign({ serviceWorkers: 'block' },
    mobile ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : {}));
  const page = await ctx.newPage();
  const etat = { casser: false, requetes: 0 };
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', 'true'); } catch (e) {} });
  await page.clock.install({ time: instantDesDonnees() });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (!u.startsWith(origin)) return route.abort();
    if (/data\/streams\.json/.test(u)) {
      etat.requetes++;
      if (etat.casser) return route.fulfill({ status: 503, body: 'publication en cours' });
    }
    return route.continue();
  });
  return { ctx, page, etat, pageErrors };
}
async function attendreGrille(page) {
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.hasLoadedOnce === true, null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.match-card, .mb').length > 0, null, { timeout: 30000 });
  await page.waitForTimeout(500);
}

test('cache serveur injoignable au démarrage : deux essais, badge ⚠ plutôt que 🔎, et un toucher rétablit les liens', async ({ browser }) => {
  const { ctx, page, etat, pageErrors } = await bootAvecCacheCassable(browser, true);
  etat.casser = true;
  await attendreGrille(page);

  const avant = await page.evaluate(() => ({
    erreur: window.prefetchedStreamsError,
    retry: document.querySelectorAll('button.card-streams-retry').length,
    loupes: document.querySelectorAll('button.card-streams-search').length
  }));
  expect(etat.requetes, 'le fichier est demandé deux fois avant d\'abandonner').toBeGreaterThanOrEqual(2);
  expect(avant.erreur, 'l\'échec est retenu').toBeTruthy();
  expect(avant.retry, 'les cartes proposent de réessayer').toBeGreaterThan(0);
  expect(avant.loupes, 'aucune loupe : la cause n\'est pas l\'absence de lien').toBe(0);

  etat.casser = false;
  await page.locator('button.card-streams-retry').first().click();
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('div.card-streams').length), { timeout: 30000 })
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.prefetchedStreamsError), 'l\'échec est effacé').toBeNull();
  expect(await page.evaluate(() => document.querySelectorAll('button.card-streams-retry').length), 'plus aucun ⚠').toBe(0);
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
  await ctx.close();
});

test('un cache serveur momentanément injoignable ne vide pas la liste, et le retour au premier plan la relit', async ({ browser }) => {
  const { ctx, page, etat, pageErrors } = await bootAvecCacheCassable(browser, false);
  await attendreGrille(page);
  const avant = await page.evaluate(() => ({ n: window.prefetchedStreamMatches.length, compteurs: document.querySelectorAll('div.card-streams').length }));
  expect(avant.n).toBeGreaterThan(0);
  expect(avant.compteurs).toBeGreaterThan(0);

  // Le serveur tombe ; le cache a plus de dix minutes ; une passe d'arrière-plan le relit.
  etat.casser = true;
  await page.clock.fastForward('11:00');
  await page.evaluate(() => window.loadAll(true, false));
  await expect.poll(() => page.evaluate(() => window.prefetchedStreamsError), { timeout: 15000 }).toBeTruthy();
  const pendant = await page.evaluate(() => ({
    n: window.prefetchedStreamMatches.length,
    compteurs: document.querySelectorAll('div.card-streams').length,
    grille: window.S.matches.length,
    /* Le rafraîchissement des scores, dont toutes les requêtes ESPN sont refusées ici,
       écrivait un calendrier VIDE : la passe suivante effaçait la grille. */
    calendrier: (() => { try { return JSON.parse(localStorage.getItem('api_calendar_cache_' + Object.keys(localStorage).filter((k) => k.startsWith('api_calendar_cache_'))[0].slice(19))).matches.length; } catch (e) { return -1; } })()
  }));
  expect(pendant.n, 'la liste précédente est conservée').toBe(avant.n);
  expect(pendant.grille, 'la grille n\'est pas vidée').toBeGreaterThan(0);
  expect(pendant.calendrier, 'le calendrier local du jour n\'est pas écrasé par une liste vide').toBeGreaterThan(0);
  expect(pendant.compteurs, 'les compteurs des cartes restent').toBe(avant.compteurs);

  // Le serveur revient ; la page redevient visible : relecture sans attendre la minuterie.
  etat.casser = false;
  const requetesAvant = etat.requetes;
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => etat.requetes, { timeout: 15000 }).toBeGreaterThan(requetesAvant);
  await expect.poll(() => page.evaluate(() => window.prefetchedStreamsError), { timeout: 30000 }).toBeNull();
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
  await ctx.close();
});

/* « Ça reste stuck là » (7 septembre 2026, écran d'attente sur « Recherche de streams… »).
   Sans cache serveur utilisable, le premier chargement lisait chaque source par chaque
   proxy AVANT d'afficher quoi que ce soit — une minute et plus sur téléphone. Ici les
   proxys ne répondent jamais (on les laisse expirer) : la grille doit apparaître quand
   même, en quelques secondes, avec la raison affichée. */
test('cache serveur injoignable et proxys muets : la grille s\'affiche sans attendre la recherche', async ({ browser }) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', 'true'); } catch (e) {} });
  await page.clock.setFixedTime(instantDesDonnees());
  const enAttente = [];
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(origin)) {
      if (/data\/streams\.json/.test(u)) return route.fulfill({ status: 503, body: 'publication en cours' });
      return route.continue();
    }
    // Les proxys CORS « répondent » en ne répondant jamais : c'est l'application qui expire.
    if (/cors\.sh|allorigins|codetabs|corsproxy/.test(u)) { enAttente.push(route); return; }
    return route.abort();
  });
  const debut = Date.now();
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.hasLoadedOnce === true, null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.match-card, .mb').length > 0, null, { timeout: 30000 });
  const duree = Date.now() - debut;
  const etat = await page.evaluate(() => ({
    overlay: getComputedStyle(document.getElementById('ov')).display,
    cartes: document.querySelectorAll('.match-card').length,
    retry: document.querySelectorAll('button.card-streams-retry').length,
    libelle: (document.querySelector('#s2 span') || {}).textContent || '',
    toast: (document.getElementById('toasttxt') || {}).textContent || ''
  }));
  expect(duree, 'la grille apparaît sans attendre l\'expiration des proxys').toBeLessThan(15000);
  expect(etat.overlay, 'l\'écran d\'attente est retiré').toBe('none');
  expect(etat.cartes).toBeGreaterThan(0);
  expect(etat.retry, 'les cartes disent que les liens n\'ont pas été chargés').toBeGreaterThan(0);
  expect(etat.libelle, 'l\'écran d\'attente disait pourquoi').toContain('injoignable');
  expect(etat.toast).toContain('injoignables');
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
  for (const r of enAttente) { try { await r.abort(); } catch (e) {} }
  await ctx.close();
});

/* « Des matchs qui n'arrêtent pas même si finaux sur ESPN, c'est normal ? » Sans
   nouvelle d'ESPN (réseau, onglet gelé), un match « live » restait DIRECT des heures. La
   fin présumée (js/finpresumee.js) : passé la durée du sport plus 45 min sans nouvelle,
   « Fin ? » et sortie du Live ; jamais tant qu'ESPN parle, et marge élargie si la
   dernière nouvelle disait « manches supplémentaires » ou « prolongation ». */
test('sans nouvelle d\'ESPN, un match trop long passe à « Fin ? » et quitte le Live, sauf prolongation connue', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', 'true'); } catch (e) {} });
  const pageErrors = await bootOffline(page);

  const cible = await page.evaluate(() => {
    const m = window.S.matches.find((x) => x.status === 'live' && /^\d{1,2}:\d{2}$/.test(x.startTime || '') && x.awayTeam && document.getElementById('mb-' + x.id));
    return m ? { id: m.id, duree: m.durationMinutes || 180, league: m.league, jour: m.matchDate, heure: m.startTime } : null;
  });
  test.skip(!cible, 'aucun match en direct rendu dans le Live avec ces données');

  /* Coup d'envoi en instant UTC : `startTime` est une heure de New York. On essaie les
     deux décalages possibles et on garde celui qui redonne la même heure locale. */
  const coupDEnvoi = [4, 5].map((h) => Date.parse(cible.jour + 'T' + cible.heure + ':00Z') + h * 3600000)
    .find((t) => { const p = estParts(new Date(t)); const [hh, mm] = cible.heure.split(':').map(Number); return p.jour === cible.jour && p.minutes === hh * 60 + mm; });
  expect(coupDEnvoi, 'coup d\'envoi retrouvé').toBeTruthy();

  // Durée normale + 50 min après le coup d'envoi (sous les 240 min où le Live coupe de lui-même).
  const plusTard = new Date(coupDEnvoi + (cible.duree + 50) * 60000);
  await page.clock.setFixedTime(plusTard);
  const apres = await page.evaluate((id) => {
    const change = window.reevaluerFinsPresumees();
    return { change, dansLive: !!document.getElementById('mb-' + id), filtre: window.S.filter };
  }, cible.id);
  expect(apres.filtre).toBe('live');
  expect(apres.change, 'la réévaluation a changé quelque chose').toBeTruthy();
  expect(apres.dansLive, 'le match présumé fini a quitté le Live').toBeFalsy();

  await page.evaluate(() => window.applyFilter('all'));
  await page.waitForTimeout(400);
  const guide = await page.evaluate((id) => {
    const b = document.getElementById('mb-' + id);
    const t = b && b.querySelector('.mb-time');
    return { present: !!b, badge: t ? t.textContent : '', titre: t ? t.getAttribute('title') || '' : '' };
  }, cible.id);
  expect(guide.present, 'le match reste dans le Guide').toBeTruthy();
  expect(guide.badge, 'le Guide dit « Fin ? »').toContain('Fin ?');
  expect(guide.titre, 'l\'infobulle explique la présomption').toContain('aucune nouvelle');

  // ESPN parle : une mise à jour récente désarme la présomption, quelle que soit la durée.
  const espnParle = await page.evaluate((id) => {
    const m = window.S.matchMap.get(String(id));
    m._scoreAt = Date.now();
    window.reevaluerFinsPresumees();
    window.applyFilter('all');
    return new Promise((r) => setTimeout(() => {
      const t = document.querySelector('#mb-' + id + ' .mb-time');
      r({ badge: t ? t.textContent : '' });
    }, 300));
  }, cible.id);
  expect(espnParle.badge, 'avec une nouvelle récente, le match reste en direct').not.toContain('Fin ?');

  // La dernière nouvelle, vieille, disait « prolongation » : la marge passe à 120 min.
  const prolongation = await page.evaluate((id) => {
    const m = window.S.matchMap.get(String(id));
    m._scoreAt = Date.now() - 30 * 60000;
    m.detail = 'OT';
    window.reevaluerFinsPresumees();
    window.applyFilter('all');
    return new Promise((r) => setTimeout(() => {
      const t = document.querySelector('#mb-' + id + ' .mb-time');
      r({ badge: t ? t.textContent : '' });
    }, 300));
  }, cible.id);
  expect(prolongation.badge, 'en prolongation connue, on attend encore').not.toContain('Fin ?');

  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

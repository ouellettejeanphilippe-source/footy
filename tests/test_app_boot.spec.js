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
    /* Un lecteur sage, d'une autre origine aussi : un clic dedans ne fait rien. */
    /* Un lecteur qui fait reculer l'onglet dès son chargement, sans clic (18 octobre 2026,
       Firefox 158 : `history.back()` dans un cadre d'une autre origine recule tout l'onglet). */
    /* Deux manifestes : l'un répond, l'autre est mort (jeton expiré, lié à une autre
       adresse, ou à usage unique : 404 comme celui de bintv-sources le 18 octobre 2026). */
    if (rel === '/__manifeste-ok.m3u8') {
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Access-Control-Allow-Origin': '*' });
      return res.end('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n');
    }
    if (rel === '/__manifeste-mort.m3u8') {
      res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
      return res.end('Not Found');
    }
    if (rel === '/__lecteur-recul') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<html><body style="margin:0"><button id="b" style="width:100vw;height:100vh">LIRE</button>'
        + '<script>setTimeout(function () { history.back(); }, 400);<\/script></body></html>');
    }
    if (rel === '/__lecteur-calme') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      /* `script=1` : le vrai script utilisateur, premier script du document, comme
         Tampermonkey à document-start. */
      const script = /(^|[?&])script=1/.test(req.url) ? '<script>' + fs.readFileSync(path.join(ROOT, 'multiview-cleaner.user.js'), 'utf8') + '<\/script>' : '';
      return res.end('<html>' + script + '<body style="margin:0"><button id="b" style="width:100vw;height:100vh">LIRE</button></body></html>');
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

   Une première version se calait sur le `generatedAt` du cache des liens. Ce n'était pas
   assez : le cache est régénéré chaque heure, et rien ne garantit qu'il y ait des matchs
   en direct au moment précis où il a été produit. Une deuxième balayait ±24 h autour de
   ce `generatedAt` et retenait l'instant le plus peuplé D'APRÈS LES LIENS. Ce n'était
   toujours pas assez : les liens (data/streams.json, toutes les heures) et le calendrier
   (data/schedule.json, une fois par jour à 05:00 heure de New York) ne sont pas datés du
   même jour entre minuit et cinq heures — ni quand la passe quotidienne a manqué. Le
   8 septembre 2026, les liens étaient du 8 et le calendrier du 7 : l'instant retenu
   tombait le 8, le calendrier du 7 était « périmé », ESPN refusé, et les 23 tests de
   démarrage tombaient sur une grille vide.

   On part donc DU CALENDRIER, puisque c'est lui qui fait les cartes : son `fetchDate`
   fixe le jour, et l'on balaie ce jour par pas de 15 minutes pour retenir l'instant où
   le plus de ses matchs sont en cours ou imminents. Le calcul de l'heure locale passe
   par le même fuseau que l'application (America/New_York), donc sans arithmétique
   d'heure d'été à la main. */
const EST = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
});

function estParts(date) {
  const p = Object.fromEntries(EST.formatToParts(date).map((x) => [x.type, x.value]));
  return { jour: `${p.year}-${p.month}-${p.day}`, minutes: parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10) };
}

function instantDesDonnees() {
  const cal = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'schedule.json'), 'utf8'));
  const jour = String(cal.fetchDate || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) throw new Error('data/schedule.json sans fetchDate exploitable');
  /* Un match que le calendrier dit terminé n'est pas dans le Live : le compter tirait
     l'instant vers l'après-midi. Le calendrier régénéré le soir du 12 octobre 2026 portait
     onze matchs finis entre 12 h 30 et 16 h (dont cinq de la LHJMQ) : l'instant tombait
     à 15 h, le Live n'avait plus qu'une section, et deux tests qui en exigent plusieurs
     échouaient sans que l'application ait changé. */
  const matchs = (cal.matches || []).filter((m) => m.status !== 'finished' && /^\d{1,2}:\d{2}$/.test(m.startTime || ''));

  // Minuit UTC de ce jour précède toujours son minuit à New York : on balaie 30 h de là
  // par pas de 15 minutes, en ne retenant que les instants qui tombent CE jour-là.
  const base = Date.parse(jour + 'T00:00:00Z');
  let meilleur = null, score = -1;
  for (let pas = 0; pas <= 30 * 4; pas++) {
    const t = base + pas * 15 * 60 * 1000;
    const { jour: j, minutes } = estParts(new Date(t));
    if (j !== jour) continue;
    let n = 0, auBord = false;
    for (const m of matchs) {
      const [h, mn] = m.startTime.split(':').map(Number);
      let diff = h * 60 + mn - minutes;
      if (m.matchDate && m.matchDate !== jour) {
        diff += Math.round((Date.parse(m.matchDate + 'T00:00:00Z') - Date.parse(jour + 'T00:00:00Z')) / 60000);
      }
      if (diff > -180 && diff <= 60) n++;   // en cours ou dans l'heure
      /* Un match que le calendrier dit en cours devient « Fin ? » passé sa durée plus
         45 min (js/finpresumee.js). À moins d'une demi-heure de ce seuil, une suite qui
         avance l'horloge (« momentanément injoignable » : 11 min) le voit quitter la
         page en cours de test. Relevé le 12 octobre 2026 : Portland – London Lions, en
         cours depuis 16 h, atteignait le seuil à 19 h 15, l'instant retenu. */
      const seuil = (m.durationMinutes || 150) + 45;
      if (m.status === 'live' && Math.abs(-diff - seuil) <= 30) auBord = true;
    }
    if (auBord) continue;
    if (n > score) { score = n; meilleur = t; }
  }
  if (meilleur === null) throw new Error('aucun instant du ' + jour + ' trouvé');
  return new Date(meilleur);
}

async function bootOffline(page) {
  await page.clock.setFixedTime(instantDesDonnees());
  /* Le rattrapage (`js/rattrapage.js`) lirait ici des pages de match — ou pas — selon
     l'âge du `data/streams.json` du dépôt au moment où la suite tourne : la même suite
     ne ferait donc pas la même chose d'une vérification à l'autre, ce qui est
     exactement ce qu'interdit AGENTS.md. On déclare une passe déjà faite à l'instant
     gelé ; l'intervalle de cinq minutes la retient (l'horloge ne bouge pas), et ces
     tests restent ceux du démarrage. Le rattrapage a les siens, sur ses propres
     gabarits : tests/test_rattrapage.spec.js. */
  await page.addInitScript(() => { window.dernierRattrapage = Date.now(); });
  /* Et la fenêtre « Installer le script », qui ne s'ouvre qu'au tout premier chargement,
     n'a rien à voir avec ce qu'on mesure : elle recouvre le haut de la grille et
     interceptait les clics de ces tests. La plupart posaient déjà ce drapeau chacun de
     leur côté ; il est ici pour tous. */
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });
  /* La fin de la première passe de chargement, que `hasLoadedOnce` ne marque pas : il
     est posé dès l'affichage provisoire, avec les liens déjà connus. Quand le cache des
     liens du dépôt a plus de 3 h à l'instant gelé, la passe lit ensuite les sources et
     redessine TOUTE la grille quelques secondes plus tard (js/main.js, fusion finale).
     Mesuré le 18 octobre 2026 : premier rendu à 3,2 s, second à 6,4 s, bien après les
     600 ms d'immobilité d'`attendreGrilleStable` ; « chaque section repliable… » tenait
     alors des titres détachés du document (2 échecs sur 8, sur main aussi). */
  await page.addInitScript(() => {
    window.__passesFinies = 0;
    window.addEventListener('loadSequenceComplete', () => { window.__passesFinies++; });
  });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  // Tout ce qui n'est pas servi localement est refusé : ni ESPN, ni proxy, ni site source.
  await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.hasLoadedOnce === true && window.__passesFinies > 0, null, { timeout: 60000 });
  /* `window.hasLoadedOnce` est posé dans le `.finally` de loadAll, mais le rendu final
     atterrit dans le DOM 50 à 150 ms plus tard (mesuré sur six démarrages). Un test qui
     lisait le DOM dès ce drapeau tombait donc sur une grille encore vide, au hasard de la
     machine — les assertions sur les cartes ne passaient que par chance. On attend les
     cartes elles-mêmes ; l'absence de rendu reste une vraie erreur, signalée par le
     dépassement de délai. */
  await page.waitForFunction(() => document.querySelectorAll('.match-card, .mb').length > 0,
    null, { timeout: 30000 });
  await attendreGrilleStable(page);
  return pageErrors;
}

/* « Guide par défaut : Chaînes » (25 octobre 2026). Les tests de la grille horaire
   classique (blocs `.mb`, ligne du direct, frontière de minuit) la choisissent. */
async function guideClassique(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('guide_chaines', '1');
      const p = JSON.parse(localStorage.getItem('user_prefs') || '{}');
      p.dispositionGuide = 'actuelle';
      localStorage.setItem('user_prefs', JSON.stringify(p));
    } catch (e) {}
  });
}

/* Le premier chargement dessine la grille avec les liens déjà connus, puis la REDESSINE
   quand la lecture des sources finit — quelques centaines de millisecondes plus tard,
   au hasard des refus de proxys. Un test qui commençait entre les deux tenait des titres
   de section détachés du document (`nextElementSibling` nul) : « chaque section
   repliable… » tombait une fois sur deux, ici comme en intégration continue. On attend
   donc que le compteur de rendus (`window.rendusGrille`, js/ui.js) reste immobile. */
async function attendreGrilleStable(page) {
  let precedent = -1;
  for (let essai = 0; essai < 20; essai++) {
    const courant = await page.evaluate(() => window.rendusGrille || 0);
    if (courant === precedent) return;
    precedent = courant;
    await page.waitForTimeout(600);
  }
  throw new Error('la grille se redessine sans cesse : ' + precedent + ' rendus');
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
    /* Carte en panneau (7 septembre 2026) : la vignette n'est plus l'affiche entière
       mais un bandeau au-dessus du titre, des lignes équipe/score et du pied ; c'est la
       CARTE qui est en portrait. */
    const card = document.querySelector('.match-card');
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
  expect(etat.ratio, 'la carte est en portrait (plus haute que large), pas en bandeau').toBeLessThan(1);
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
             .every((c) => c.querySelectorAll('.card-streams').length <= 1),
      // Un match rendu dans le Live porte-t-il des liens ? Sinon, aucun compteur à vérifier.
      lienRendu: Array.from(document.querySelectorAll('#marea .match-card[id^="mb-"]'))
        .some((c) => { const m = window.S.matchMap.get(window.getOriginalMatchId(c.id.slice(3))); return !!(m && (m.streamLinks || []).length); })
    };
  });

  expect(pageErrors).toEqual([]);
  /* Le 10 septembre 2026, le calendrier publié était de la veille (cron quotidien en
     retard) et aucun match rendu ne portait de lien : le compteur n'existait pas, sans
     qu'aucun code soit en cause. Le compteur n'est exigé que s'il y a de quoi le faire. */
  if (badges.lienRendu) expect(badges.counter, 'le compteur de flux affiche « ▶ n »').toMatch(/^▶ \d+$/);
  else expect(badges.counter, 'sans match pourvu, pas de compteur').toBeNull();
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
    try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {}
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
      rendus.add(window.getOriginalMatchId(c.id.slice(3)));   // la copie Favoris porte un suffixe
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
   comme le précédent verrouillait la présence. Recherche, date et pastilles vivaient
   dans l'interface classique, retirée le 30 septembre 2026. */
test('le haut de page ne porte que les onglets : ni marque, ni recherche, ni date, ni ligues', async ({ page }) => {
  const pageErrors = await bootOffline(page);

  for (const sel of ['.brand', '#sport-filters-container', '#search-input', '#date-selector', '#sport-filters', '#btn-find-missing']) {
    await expect(page.locator(sel), sel + ' ne doit plus exister dans la coquille').toHaveCount(0);
  }
  const entete = await page.evaluate(() => {
    const h = document.getElementById('app-header');
    const r = h.getBoundingClientRect();
    const epg = document.getElementById('epg').getBoundingClientRect();
    /* Le bandeau du cache serveur (§6.8) se glisse entre les deux quand le serveur ne
       publie plus. Il est haut de zéro quand tout va bien, et l'âge du cache du dépôt
       n'est pas connu d'avance : on mesure donc ce qui est AU-DESSUS de la grille, pas
       une constante. */
    /* Le bandeau est une carte (13 octobre 2026, « le look des cartes […] la base de tous
       les éléments ui ») : il a une marge au-dessus. On mesure donc son BORD BAS, pas sa
       hauteur : la grille doit commencer là, sans rien d'autre entre les deux. */
    const bc = document.getElementById('bandeau-cache');
    const visible = bc && bc.getBoundingClientRect().height > 0;
    return {
      enfants: Array.from(h.children).map((c) => c.id), hauteur: r.height,
      basDuHaut: visible ? bc.getBoundingClientRect().bottom : r.bottom,
      debutGrille: epg.top
    };
  });
  expect(entete.enfants, 'l\'en-tête ne contient que la navigation').toEqual(['nav-links']);
  expect(entete.hauteur, 'un en-tête d\'une seule rangée').toBeLessThanOrEqual(64);
  expect(entete.debutGrille, 'la grille commence juste sous les onglets, et sous le seul bandeau qui ait le droit de s\'y glisser')
    .toBeLessThanOrEqual(entete.basDuHaut + 1);

  await page.evaluate(() => window.applyFilter('all'));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.querySelectorAll('.match-card, .mb').length), 'le Guide reste peuplé').toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
});

/* « Faire que le dropdown des options soit par-dessus le multiview. » Les menus posés
   dans la tuile étaient rognés par son `overflow: hidden` et recouverts par la tuile
   voisine (et son iframe). Ils vivent désormais au niveau du document, en position
   fixe (js/mv-menu.js) : on vérifie que ce qui est PEINT au centre du menu est bien le
   menu, et que la barre porte le bouton « Site » de la vidéo choisie — le repli vers la
   page originale (sur chaque tuile jusqu'au 25 octobre 2026 ; une seule barre depuis). */
test('les menus du lecteur s\'ouvrent par-dessus les tuiles, entiers, et se ferment ailleurs', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });
  const pageErrors = await bootOffline(page);

  await page.evaluate((o) => {
    window.addToMultivision(o + '/__faux-lecteur?a', 'Match A', 'mA');
    window.addToMultivision(o + '/__faux-lecteur?b', 'Match B', 'mB');
  }, origin);
  await expect(page.locator('#mv-container')).toBeVisible();
  await expect(page.locator('.mv-cell')).toHaveCount(2);

  /* Menu de la première tuile, la plus à gauche, celle que sa voisine recouvrait : par ⋮
     de la barre, le seul (« pas de doublon de menu dans le haut du multiview »). */
  await expect(page.locator('.mv-tile-menu-btn'), 'plus de ⋮ en haut des tuiles').toHaveCount(0);
  await page.evaluate(() => window.focusStream(0));
  await page.locator('#mv-bar-video-menu').click();
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
  expect(etat.items).toContain('Fermer cette vidéo');
  // « Pas de liens vers le vrai site, jamais » ; « Changer de match » : après avoir fermé la vidéo.
  expect(etat.items).not.toContain('Ouvrir sur le site');
  expect(etat.items).not.toContain('Changer de match');
  // « Pas de doublons » : les stats sont sous ⚙ Réglages → Scores et statistiques, seulement.
  expect(etat.items).not.toContain('Infos et statistiques');
  await expect(page.locator('#mv-bar-site')).toHaveCount(0);

  await page.mouse.click(4, 4);
  await expect(menu, 'un clic ailleurs ferme le menu').toHaveCount(0);

  /* La disposition est un sous-menu de ⚙ Réglages ; fenêtre détachée et deux écrans n'y
     sont plus qu'à cet endroit. */
  await expect(page.locator('#mv-layout-toggle-btn'), 'plus de bouton Disposition dans la barre').toHaveCount(0);
  await page.locator('#mv-more-btn').click();
  await expect(page.locator('.mv-menu .mv-menu-item', { hasText: 'Deux écrans' })).toHaveCount(0);
  await expect(page.locator('.mv-menu .mv-menu-item', { hasText: 'Fenêtre détachée' })).toHaveCount(0);
  await page.locator('.mv-menu .mv-menu-item', { hasText: 'Disposition' }).click();
  await expect(page.locator('.mv-menu')).toHaveCount(1);
  await expect(page.locator('.mv-menu .mv-menu-entete')).toHaveText('Disposition des vidéos');
  await expect(page.locator('.mv-menu .mv-menu-item', { hasText: 'Deux écrans' })).toHaveCount(2);
  await page.locator('.mv-menu .mv-menu-item', { hasText: 'Côte à côte' }).click();
  await expect(page.locator('.mv-menu')).toHaveCount(0);
  expect(await page.evaluate(() => window.mvLayout), 'le choix de disposition est appliqué').toBe('horizontal');

  await page.locator('#mv-more-btn').click();
  await expect(page.locator('.mv-menu')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.mv-menu'), 'Échap ferme le menu').toHaveCount(0);

  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* « L'app se fait maintenant plus facilement redirect vers l'un des sites, ce que je veux
   vraiment pas » (9 octobre 2026). Sans `sandbox`, un clic dans une page de lecteur
   d'une autre origine suffit à son script pour faire `top.location = …`. Le seul verrou
   possible est `beforeunload` (js/multiview.js, garde contre les redirections) : le
   navigateur demande « Quitter le site ? », et refuser garde l'application.

   Différentiel, avec un VRAI clic (sans activation, Chrome bloque déjà la navigation et
   le test ne prouverait rien) : garde coupée, l'onglet part ; garde armée, il reste. */
test('un lecteur qui tente de détourner l\'onglet est retenu par « Quitter le site ? »', async ({ page }) => {
  const pageErrors = await bootOffline(page);
  const autreOrigine = origin.replace('127.0.0.1', 'localhost');
  const hostile = autreOrigine + '/__faux-lecteur?redir';
  /* bootOffline refuse toute autre origine : on laisse passer ce seul lecteur. */
  await page.route(autreOrigine + '/**', (route) => route.continue());
  const dialogues = [];
  page.on('dialog', (d) => { dialogues.push(d.type()); d.dismiss().catch(() => {}); });

  await page.evaluate((u) => window.addToMultivision(u, 'Match hostile', 'mH'), hostile);
  await expect(page.locator('.mv-cell')).toHaveCount(1);
  const cadre = page.frameLocator('.mv-cell iframe.mv-iframe');
  await expect(cadre.locator('#b')).toBeVisible();
  expect(await page.evaluate(() => window.gardeSortieArmee()), 'une vidéo chargée arme la garde, sans attendre de geste : un cadre peut emmener l\'onglet tout seul').toBe(true);

  await cadre.locator('#b').click();
  await page.waitForTimeout(800);
  expect(dialogues, 'le navigateur demande « Quitter le site ? »').toContain('beforeunload');
  expect(page.url(), 'refuser garde l\'application').toContain(origin);
  await expect(page.locator('.mv-cell'), 'et ses vidéos').toHaveCount(1);
  expect(pageErrors).toEqual([]);
  /* Le relevé des sorties (js/sorties.js) : la tentative est notée, garde armée, page restée. */
  const releve = await page.evaluate(() => JSON.parse(localStorage.getItem('journal_sorties') || '[]'));
  expect(releve[0], 'la tentative est notée').toMatchObject({ type: 'sortie', armee: true, quittee: false, tuiles: 1, reglage: true });
  expect(releve[0].clicTuileIlYaMs === null || typeof releve[0].clicTuileIlYaMs === 'number').toBe(true);

  /* Le témoin : sans la garde, le même clic emporte l'onglet. */
  await page.evaluate(() => window.toggleGardeSortie());
  expect(await page.evaluate(() => window.gardeSortieArmee())).toBe(false);
  const avant = dialogues.length;
  const depart = page.waitForEvent('framenavigated', { predicate: (f) => f === page.mainFrame(), timeout: 5000 }).catch(() => null);
  await cadre.locator('#b').click();
  const nav = await depart;
  expect(nav && !nav.url().startsWith(origin), 'garde coupée, l\'onglet est emporté : le test a un sens').toBeTruthy();
  expect(dialogues.length, 'et rien ne l\'a retenu').toBe(avant);

  /* Au retour par « Précédent », la page Logs dit ce qui s'est passé. */
  await page.goBack();
  await page.waitForFunction(() => typeof window.applyFilter === 'function' && window.hasLoadedOnce === true, null, { timeout: 60000 });
  await page.evaluate(() => window.applyFilter('logs'));
  const sorties = page.locator('.diag-sorties');
  await expect(sorties).toContainText('retour sur l\'appli');
  await expect(sorties).toContainText('page quittée · garde levée : réglage « Bloquer les redirections des sites » coupé');
  await expect(sorties).toContainText('page restée · garde armée');
  await expect(page.locator('#sources-status-container'), 'et « Cet appareil » dit la garde coupée').toContainText('coupée — Lecteur → ⚙ Réglages → 🛡');
});

/* « Ça me demande souvent si je veux quitter quand je ferme la page, ce qui devrait jamais
   arriver » (18 octobre 2026). La garde était armée dès qu'une vidéo était chargée : fermer
   l'onglet passait par le même « Quitter le site ? » qu'un lecteur qui l'emmène. Elle reste
   armée (le même jour, un lecteur a emmené l'onglet « tout seul, sans clic »), et se lève
   quand l'utilisateur s'en va : pointeur sorti par le haut vers les onglets ou la croix,
   ou touche de raccourci (Ctrl+W), y compris quand le focus est dans une tuile, où c'est
   le script utilisateur qui la voit.

   Le navigateur ne montre ce dialogue qu'à une page qui a reçu un geste : on en fait un
   dans l'application, puis un dans la tuile, comme quand on regarde. Sans la correction,
   chacune de ces fermetures demandait confirmation. */
async function fermerSansDialogue(page, partir) {
  const pageErrors = await bootOffline(page);
  const autreOrigine = origin.replace('127.0.0.1', 'localhost');
  await page.route(autreOrigine + '/**', (route) => route.continue());
  const dialogues = [];
  page.on('dialog', (d) => { dialogues.push(d.type()); d.dismiss().catch(() => {}); });

  await page.evaluate((u) => window.addToMultivision(u, 'Match calme', 'mC'), autreOrigine + '/__lecteur-calme?script=1');
  const cadre = page.frameLocator('.mv-cell iframe.mv-iframe');
  await expect(cadre.locator('#b')).toBeVisible();
  await page.locator('#mv-more-btn').click();
  await page.keyboard.press('Escape');
  await cadre.locator('#b').click();
  expect(await page.evaluate(() => window.gardeSortieArmee()), 'on regarde : armée').toBe(true);
  await partir(page);
  expect(pageErrors).toEqual([]);
  await page.close({ runBeforeUnload: true });
  await new Promise((r) => setTimeout(r, 800));
  expect(dialogues, 'aucun « Quitter le site ? » à la fermeture').toEqual([]);
  expect(page.isClosed(), 'la page s\'est fermée').toBe(true);
}

test('fermer la page à la souris, vidéos chargées, ne demande pas « Quitter le site ? »', async ({ page }) => {
  await fermerSansDialogue(page, async (p) => {
    /* Vers la croix de l'onglet : le pointeur traverse la barre du lecteur et sort par le haut. */
    const barre = await p.locator('#mv-toolbar').boundingBox();
    await p.mouse.move(barre.x + 200, barre.y + 10);
    await p.mouse.move(barre.x + 200, -5);
    await p.waitForTimeout(100);
  });
});

test('fermer la page au clavier, le focus dans une tuile, ne demande pas « Quitter le site ? »', async ({ page }) => {
  await fermerSansDialogue(page, async (p) => {
    /* Ctrl+W : la lettre n'arrive jamais à la page, la touche Ctrl si, dans le cadre qui
       a le focus ; le script utilisateur la relaie. */
    await p.keyboard.down('Control');
    await p.waitForTimeout(300);
  });
});

/* « Le bouton direct, ça marche avec AUCUN SITE » (18 octobre 2026). Les CDN refusent
   l'origine de l'application (CORS) et un Referer qui n'est pas celui de leur lecteur :
   hls.js lisant lui-même, le manifeste était refusé partout. Avec le script utilisateur
   1.14, manifeste et segments passent par le pont, avec le Referer du lecteur.

   hls.js est remplacé par un double qui, comme lui, lit le manifeste par le chargeur
   qu'on lui donne, ou par lui-même faute de chargeur, et que le « CDN » refuse alors
   (code 0, comme un refus CORS). Le pont est un faux script qui note ce qu'on lui
   demande. Différentiel : sans lecture binaire annoncée, la tuile revient à la page. */
test('le mode direct lit le flux par le pont du script, avec le Referer du lecteur', async ({ page }) => {
  const pageErrors = await bootOffline(page);
  const lien = origin + '/__lecteur-calme?direct';
  await page.evaluate(({ lien }) => {
    localStorage.setItem('direct_media', JSON.stringify({
      [lien]: { url: 'https://cdn.test/hls/index.m3u8', pageUrl: lien, referer: 'https://lecteur.test/', at: Date.now(), echecs: 0 }
    }));
    /* Comme Safari et les Chrome récents (celui de la CI), le navigateur lit le HLS
       lui-même : sans le pont, l'application lui confie le manifeste, sans hls.js. */
    HTMLVideoElement.prototype.canPlayType = function (t) { return /mpegurl/i.test(t) ? 'maybe' : ''; };
    window.__demandesPont = [];
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || d.__mvBridge !== 'mv_bridge_fetch' || !d.binaire) return;
      window.__demandesPont.push({ url: d.url, referer: d.referer, origine: d.origine });
      const octets = new TextEncoder().encode('#EXTM3U\n').buffer;
      window.postMessage({ __mvBridge: 'mv_bridge_page', id: d.id, ok: true, binaire: true, octets, status: 200, finalUrl: d.url }, '*');
    });
    window.Hls = class {
      static isSupported() { return true; }
      static get Events() { return { ERROR: 'hlsError' }; }
      constructor(config) { this.config = config || {}; this.ecouteurs = []; (window.__hls = window.__hls || []).push({ pont: !!this.config.loader }); }
      on(ev, f) { if (ev === 'hlsError') this.ecouteurs.push(f); }
      loadSource(u) { this.u = u; }
      attachMedia(video) {
        const echec = (code) => this.ecouteurs.forEach((f) => f('hlsError', { fatal: true, details: 'manifestLoadError', response: { code } }));
        if (!this.config.loader) { setTimeout(() => echec(0), 20); return; }
        new this.config.loader({}).load({ url: this.u, responseType: '' }, { timeout: 5000 }, {
          onSuccess: (r) => { if (/^#EXTM3U/.test(r.data)) video.dispatchEvent(new Event('playing')); else echec(200); },
          onError: (e) => echec(e.code),
          onTimeout: () => echec(0)
        });
      }
      destroy() {}
    };
  }, { lien });

  /* Le script annonce le pont SANS lecture binaire (copie de l'extension, par exemple). */
  await page.evaluate(() => window.postMessage({ __mvBridge: 'mv_bridge_ready', version: '1.13' }, '*'));
  await page.evaluate((u) => window.addToMultivision(u, 'Match direct', 'mD'), lien);
  await expect(page.locator('.mv-cell')).toHaveCount(1);
  /* Sans le pont, le « CDN » refuse la lecture faite d'ici : la sonde le voit, et le
     bouton ▶ direct n'est pas proposé (18 octobre 2026, « le direct marche jamais »). */
  await page.waitForTimeout(800);
  await expect(page.locator('#mv-bar-direct'), 'sans le pont, pas de ▶ Direct').toBeHidden();
  expect(await page.evaluate(() => (window.__hls || []).filter((h) => h.pont).length), 'aucun chargeur par le pont sans lecture binaire').toBe(0);

  /* Le script 1.14, sous Tampermonkey : lecture binaire annoncée. La sonde repasse par le pont. */
  await page.evaluate(() => window.postMessage({ __mvBridge: 'mv_bridge_ready', version: '1.14', binaire: true }, '*'));
  await expect(page.locator('#mv-bar-direct'), 'par le pont, le manifeste répond : ▶ Direct').toBeVisible({ timeout: 10000 });
  await page.evaluate(() => window.resetMvIdleTimer());
  await page.locator('#mv-bar-direct').click();
  await expect.poll(() => page.evaluate(() => window.mvFlux[0]._playing), { message: 'par le pont, le flux joue' }).toBe(true);
  expect(await page.evaluate(() => window.mvFlux[0].mode)).toBe('direct');
  expect(await page.evaluate(() => (window.__hls || []).filter((h) => h.pont).length),
    'hls.js et son chargeur par le pont, même quand le navigateur lit le HLS lui-même').toBe(1);
  const demandes = await page.evaluate(() => window.__demandesPont);
  expect(demandes.length, 'la sonde, puis la lecture').toBe(2);
  for (const d of demandes) expect(d, 'le manifeste demandé au script, avec le Referer et l\'Origin du lecteur')
    .toEqual({ url: 'https://cdn.test/hls/index.m3u8', referer: 'https://lecteur.test/', origine: 'https://lecteur.test' });
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* « Les menus, surtout sur mobile, c'est pas super affordant et efficace » (10 octobre
   2026). Sur téléphone, le menu est une feuille qui monte du bas (js/mv-menu.js,
   enFeuille). Ce qui la faisait échouer avant : défiler dans la liste la refermait
   (l'écouteur `scroll` ne distinguait pas), et la barre du lecteur s'effaçait au repos,
   si bien que le premier appui sur « Plus » ne faisait que la réveiller. */
test('sur téléphone, les menus du lecteur sont une feuille qu\'on peut parcourir', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors = await bootOffline(page);
  await page.evaluate((o) => {
    window.addToMultivision(o + '/__faux-lecteur?a', 'Match A', 'mA');
    window.addToMultivision(o + '/__faux-lecteur?b', 'Match B', 'mB');
  }, origin);
  await expect(page.locator('.mv-cell')).toHaveCount(2);

  /* Depuis le 25 octobre 2026 (« interface moderne », comme Netflix), la barre est posée
     par-dessus la vidéo et s'efface au repos ; le moindre geste sur le lecteur la ramène
     (ici le pointeur qui passe : un clic, lui, irait au faux lecteur hostile, qui emmène
     l'onglet), puis « Plus » s'ouvre. */
  await page.evaluate(() => window.openMultiviewTab());
  await page.waitForTimeout(3300);
  await expect(page.locator('#mv-toolbar'), 'la barre s\'efface au repos').toHaveClass(/mv-cachee/);
  await page.locator('#mv-grid-wrapper').hover();
  await expect(page.locator('#mv-toolbar'), 'un geste la ramène').not.toHaveClass(/mv-cachee/);

  await page.locator('#mv-more-btn').click();
  const feuille = page.locator('.mv-menu.feuille');
  await expect(feuille, 'le menu ⋯ s\'ouvre en feuille').toHaveCount(1);
  await expect(page.locator('.mv-menu-voile')).toHaveCount(1);
  await page.waitForTimeout(350);   // fin de l'animation d'entrée (0,2 s)
  const geo = await page.evaluate(() => {
    const r = document.querySelector('.mv-menu.feuille').getBoundingClientRect();
    return { gauche: r.left, droite: r.right, bas: r.bottom, vw: innerWidth, vh: innerHeight };
  });
  expect(geo.gauche, 'pleine largeur').toBeLessThanOrEqual(1);
  expect(geo.droite).toBeGreaterThanOrEqual(geo.vw - 1);
  expect(Math.abs(geo.bas - geo.vh), 'collée au bas de l\'écran').toBeLessThanOrEqual(1);
  await expect(page.locator('.mv-menu.feuille .mv-menu-title', { hasText: 'Lecture' })).toBeVisible();
  await expect(page.locator('.mv-menu.feuille .mv-menu-detail').first(), 'chaque entrée dit ce qu\'elle fait').toBeVisible();

  /* Défiler dans la feuille ne la ferme pas. */
  await page.locator('.mv-menu-corps').evaluate((c) => { c.scrollTop = 120; c.dispatchEvent(new Event('scroll')); });
  await page.waitForTimeout(150);
  await expect(feuille, 'défiler dans la liste ne referme pas le menu').toHaveCount(1);

  /* Le voile ferme, et rien d'autre ne reçoit l'appui. */
  await page.mouse.click(195, 30);
  await expect(feuille, 'toucher le voile ferme la feuille').toHaveCount(0);
  await expect(page.locator('.mv-menu-voile')).toHaveCount(0);
  await expect(page.locator('.mv-cell'), 'sans rien fermer derrière').toHaveCount(2);

  /* Le menu d'une tuile (⋮ de la barre, pour la vidéo choisie), et une entrée qui agit. */
  await page.evaluate(() => { window.focusStream(0); window.resetMvIdleTimer(); });
  await page.locator('#mv-bar-video-menu').click();
  await expect(feuille).toHaveCount(1);
  await expect(page.locator('.mv-menu.feuille .mv-menu-tete-lb')).toHaveText('Match A');
  await page.locator('.mv-menu.feuille .mv-menu-item', { hasText: 'Fermer cette vidéo' }).click();
  await expect(feuille).toHaveCount(0);
  await expect(page.locator('.mv-cell'), 'l\'entrée a agi').toHaveCount(1);

  /* La croix de la feuille. */
  await page.locator('#mv-more-btn').click();
  await expect(feuille).toHaveCount(1);
  await page.locator('.mv-menu-fermer').click();
  await expect(feuille).toHaveCount(0);
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* Deux croix se superposaient dans la fiche : `document.querySelector('.mhd')` attrapait
   l'en-tête de l'Investigator (première `.mhd` du document), jamais celui de la fiche, et
   openMod injectait une seconde croix par-dessus la colonne des flux. */
/* Actualisation à la demande (8 septembre 2026 : « un sur le guide pour avoir scores et
   streams à jour »). Depuis que le haut de page a été vidé, il n'existait plus aucun
   geste pour redemander les données : il fallait attendre la minuterie de cinq minutes
   ou recharger la page. Le bouton n'a de sens que devant la grille — sur Logs, Options
   et Script il n'y a rien à rafraîchir. */
/* Les liens déjà connus s'affichent AVANT la lecture des sources (8 septembre 2026).

   Capture de la page Logs d'un téléphone : « Calendrier ✅ 30 matchs », « Liens ✅ 241
   matchs », et pourtant « Fusion : pas encore faite » — donc toutes les cartes avec la
   loupe. Les liens étaient là, en mémoire ; c'est le rattachement qui n'avait pas eu lieu,
   parce que l'application était partie relire une dizaine de pages de liste par proxys
   CORS avant de fusionner quoi que ce soit. Des minutes sur un téléphone.

   Ici, le script utilisateur est déclaré présent (c'est ce qui force ce chemin) et RIEN
   ne répond hors de l'origine : la lecture des sources ne finira jamais. La grille doit
   quand même porter ses liens, tout de suite. */
test('les liens déjà connus s\'affichent avant la lecture des sources, qui peut ne jamais finir', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {}
    /* Le pont annonce sa présence par un message : on le simule, c'est le seul chemin
       qui met `bridge.available` à vrai (js/embed-bridge.js). */
    window.addEventListener('message', function relais(e) {
      if (e && e.data && e.data.__mvBridge === 'mv_bridge_hello') {
        window.postMessage({ __mvBridge: 'mv_bridge_ready', version: '1.8' }, '*');
      }
    });
    /* Aucune passe récente : sans cela le chemin rapide serait pris et le test ne
       vérifierait rien. */
    try { localStorage.removeItem('last_scrape_time'); } catch (e) {}
  });
  await page.clock.setFixedTime(instantDesDonnees());
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  /* Les requêtes sortantes ne sont pas REFUSÉES mais laissées EN SUSPENS : un refus
     immédiat ferait finir la lecture des sources en une seconde, et le test ne
     distinguerait rien. C'est bien l'attente qu'on veut reproduire — celle d'un proxy qui
     ne répond pas, sur un téléphone. */
  await page.route('**/*', (route) => { if (route.request().url().startsWith(origin)) route.continue(); });
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });

  /* Le point du test : des compteurs de flux apparaissent SANS attendre la fin de la
     lecture des sources — qui, ici, ne finira jamais. Vingt secondes est large pour une
     fusion mesurée à 25 ms. */
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('div.card-streams').length),
    { timeout: 20000 }).toBeGreaterThan(0);

  const etat = await page.evaluate(() => ({
    fusion: window.fusionInfo,
    cartes: document.querySelectorAll('.match-card').length,
    pont: window.getBridgeStatus ? window.getBridgeStatus().available : null,
    /* La PREUVE que le chemin lent a bien été pris : cette ligne n'est écrite que là.
       Sans elle, le test passerait par le chemin rapide et ne vérifierait rien. */
    affichageImmediat: (window.S.log || []).some((e) => e.l === 'Affichage immédiat')
  }));
  expect(etat.pont, 'le script utilisateur est vu comme présent : c'
    + '\'est lui qui force la lecture des sources').toBeTruthy();
  expect(etat.affichageImmediat, 'la grille a été dessinée AVANT la lecture des sources').toBeTruthy();
  expect(etat.fusion, 'la fusion a bien eu lieu, et la page Logs peut le dire').toBeTruthy();
  expect(etat.fusion.avecLiens, 'des matchs ont reçu leurs liens').toBeGreaterThan(0);
  expect(etat.cartes, 'et la grille est rendue').toBeGreaterThan(0);
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* Un seul fond pour la page (8 septembre 2026 : « un seul background pour page Live, pas
   une répétition du même »).

   Les titres de section sont collants, et ils restaient lisibles en repeignant `var(--bg)`
   en dégradé : sur le fond unique de la page (`#app-bg-container`, un dégradé ou un motif
   selon les Options), cela posait une bande de couleur PLATE, répétée à chaque section.
   Cinq sections, cinq rectangles — le fond ne se voyait plus, il se répétait. */
test('la page Live n\'a qu\'un fond : aucune section n\'en repeint une copie', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });
  const pageErrors = await bootOffline(page);

  const fonds = await page.evaluate(() => {
    const titres = [...document.querySelectorAll('.section-title')];
    return {
      nb: titres.length,
      /* Le dégradé des CARTES est voulu : on ne regarde que les titres de section. */
      avecFond: titres.filter((t) => getComputedStyle(t).backgroundImage !== 'none').length,
      collants: titres.filter((t) => getComputedStyle(t).position === 'sticky').length,
      /* Ce qui remplace la bande : le flou laisse voir le fond de la page au lieu d'en
         reposer une copie. */
      flous: titres.filter((t) => {
        const c = getComputedStyle(t);
        return /blur/.test(c.backdropFilter || '') || /blur/.test(c.webkitBackdropFilter || '');
      }).length,
      /* Le fond unique de la page, posé une seule fois et à demeure. */
      conteneurs: document.querySelectorAll('#app-bg-container').length
    };
  });

  expect(fonds.nb, 'plusieurs sections sont rendues, sinon le test ne prouve rien').toBeGreaterThan(1);
  expect(fonds.avecFond, 'aucun titre de section ne repeint le fond de la page').toBe(0);
  expect(fonds.collants, 'ils restent collants : c\'est ce qui les rendait nécessaires').toBe(fonds.nb);
  expect(fonds.flous, 'et se détachent par un flou, qui laisse voir le fond unique').toBe(fonds.nb);
  expect(fonds.conteneurs, 'un seul conteneur de fond pour toute la page').toBe(1);
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

test('le bouton Actualiser est devant la grille, pas sur les pages, et dit qu\'il travaille', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });
  const pageErrors = await bootOffline(page);

  /* `offsetParent` est TOUJOURS nul pour un élément en position fixe : c'est le style
     calculé qui dit s'il est affiché, pas lui. */
  const surGrille = await page.evaluate(() => {
    const b = document.getElementById('btn-actualiser');
    const r = b.getBoundingClientRect();
    const nav = document.getElementById('nav-links').getBoundingClientRect();
    return { affiche: getComputedStyle(b).display !== 'none', bas: r.bottom, navHaut: nav.top, droite: r.right, largeur: window.innerWidth };
  });
  expect(surGrille.affiche, 'le bouton est offert devant la grille').toBeTruthy();
  expect(surGrille.bas, 'et posé AU-DESSUS de la barre d\'onglets, pas dessous').toBeLessThanOrEqual(surGrille.navHaut);
  expect(surGrille.droite, 'sans déborder de l\'écran').toBeLessThanOrEqual(surGrille.largeur);

  await page.evaluate(() => window.applyFilter('logs'));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('btn-actualiser')).display),
    'rien à rafraîchir sur la page Logs').toBe('none');

  await page.evaluate(() => window.applyFilter('live'));
  await page.waitForTimeout(300);

  /* L'état « je travaille » est posé AVANT le premier aller-retour : on le lit dans la
     même évaluation que le clic, donc sans course. */
  const pendant = await page.evaluate(() => {
    const b = document.getElementById('btn-actualiser');
    b.click();
    return { desactive: b.disabled, tourne: b.classList.contains('tourne') };
  });
  expect(pendant.desactive, 'le bouton se désactive pendant la passe : pas de double appel').toBeTruthy();
  expect(pendant.tourne, 'et le dit visiblement').toBeTruthy();

  await expect.poll(() => page.evaluate(() => !document.getElementById('btn-actualiser').disabled),
    { timeout: 60000 }).toBeTruthy();
  expect(await page.evaluate(() => document.getElementById('btn-actualiser').classList.contains('tourne')),
    'et l\'animation s\'arrête à la fin').toBeFalsy();
  expect(await page.evaluate(() => document.querySelectorAll('.match-card').length),
    'la grille est toujours là après l\'actualisation').toBeGreaterThan(0);
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

test('la fiche de match a une seule croix, se ferme par Échap, et ses flux portent leurs actions', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });
  const pageErrors = await bootOffline(page);

  /* Une carte à DEUX équipes : la bannière testée plus bas porte deux blasons, ce qu'un
     événement à un seul nom (course, gala de catch, épreuve) n'a pas. La première carte
     de la grille en est un certain jour et pas un autre, selon le programme — le test
     tombait alors sur une règle qui ne le concerne pas. */
  const cible = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#marea .match-card[id^="mb-"]')];
    const deuxBlasons = cards.find((c) => c.querySelectorAll('.prime-logo').length === 2);
    return deuxBlasons ? deuxBlasons.id : null;
  });
  test.skip(!cible, 'aucun match à deux équipes rendu avec les données du jour');

  await page.locator('[id="' + cible + '"]').first().click();
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
    // « Pas de liens vers le vrai site, jamais » : ni ↗ par flux, ni liens vers les sources.
    versLeSite: document.querySelectorAll('#mbg .si-ext, #mbg a[target="_blank"]').length,
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
  if (fiche.flux > 0) expect(fiche.actions, 'trois actions par ligne de flux (⭐ 👎 ⊞)').toBe(fiche.flux * 3);
  expect(fiche.versLeSite, 'aucun lien vers le site').toBe(0);

  await page.keyboard.press('Escape');
  await expect(page.locator('#mbg')).not.toHaveClass(/open/);
  expect(pageErrors).toEqual([]);
});

/* Dispositions (Options → Disposition, js/dispositions.js, 13 octobre 2026) : « Les 4,
   avec l'actuelle toujours comme default ». Chacune doit rendre le Live et le Guide sur
   les vraies données sans exception ni titre, garder chaque match cliquable, ne pas
   faire déborder la page sur un téléphone ; un clic ouvre la fiche, et revenir à
   « Actuelle » rend les cartes d'avant. */
async function choisirDisposition(page, nom, vue) {
  await page.evaluate(([n, v]) => {
    applyFilter(v);
    document.getElementById('pref-disposition-live').value = n;
    document.getElementById('pref-disposition-guide').value = n;
    applyUserPrefs();
  }, [nom, vue]);
}

test('les quatre dispositions rendent le Live et le Guide, et un match ouvre sa fiche', async ({ page }) => {
  const pageErrors = await bootOffline(page);
  for (const nom of ['tableau', 'maintenant', 'affiches', 'chaines']) {
    for (const vue of ['live', 'all']) {
      await choisirDisposition(page, nom, vue);
      await page.waitForSelector('#marea .dsp-' + nom + '.dsp-vue-' + (vue === 'live' ? 'live' : 'guide'));
      const etat = await page.evaluate(() => {
        const racine = document.querySelector('#marea .dsp');
        return {
          cliquables: racine.querySelectorAll('[data-mid], [data-dsp="choix"]').length,
          vide: !!racine.querySelector('.dsp-vide'),
          titre: /Guide des Sports/.test(racine.innerText),
          cartesHistoriques: document.querySelectorAll('#marea .match-card:not(.dsp-carte), #marea .mb').length
        };
      });
      expect(etat.titre, nom + ' / ' + vue + ' : pas de titre').toBe(false);
      expect(etat.cliquables > 0 || etat.vide, nom + ' / ' + vue + ' : des matchs cliquables').toBeTruthy();
      expect(etat.cartesHistoriques, nom + ' / ' + vue + ' : le rendu historique ne se superpose pas').toBe(0);
    }
  }

  await choisirDisposition(page, 'tableau', 'all');
  await page.waitForSelector('#marea .dsp-tableau .dsp-gr[data-mid]');
  /* « On dirait que c'est passé » : après « En cours », le Guide ne liste que des heures
     à venir — un match sans nouvelles dont la fin prévue est passée va aux terminés. */
  const heures = await page.evaluate(() => {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit' }).format(new Date());
    return { maintenant: parseInt(p, 10), lues: [...document.querySelectorAll('#marea .dsp-hr')].map((e) => e.textContent.trim()).filter((t) => /^\d+ h$/.test(t)).map((t) => parseInt(t, 10)) };
  });
  for (const h of heures.lues) expect(h, 'une heure du passé dans le Guide').toBeGreaterThanOrEqual(heures.maintenant);

  await page.locator('#marea .dsp-gr[data-mid]').first().click();
  await expect(page.locator('#mbg')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mbg')).not.toHaveClass(/open/);

  await choisirDisposition(page, 'actuelle', 'live');
  await page.waitForSelector('#marea .match-card');
  expect(await page.locator('#marea .dsp').count(), 'Actuelle : plus aucune disposition').toBe(0);
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

test('sur téléphone, aucune disposition ne fait déborder la page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors = await bootOffline(page);
  for (const nom of ['tableau', 'maintenant', 'affiches', 'chaines']) {
    for (const vue of ['live', 'all']) {
      await choisirDisposition(page, nom, vue);
      await page.waitForSelector('#marea .dsp-' + nom);
      const largeur = await page.evaluate(() => ({ scrollW: document.body.scrollWidth, innerW: window.innerWidth }));
      expect(largeur.scrollW, nom + ' / ' + vue + ' à 390 px').toBeLessThanOrEqual(largeur.innerW + 1);
    }
  }
  expect(pageErrors).toEqual([]);
});

/* L'étoile d'un favori reste visible, même au nom long (24 octobre 2026). Elle était posée
   DANS le nom tronqué de la disposition « tableau » : « MSC Cruises United States Grand
   Prix », favori par défaut par « F1 », la poussait hors de la zone visible, et le test
   ci-dessous ne le voyait qu'avec les polices de la CI. Toutes les équipes du calendrier
   sont ici favorites, pour qu'un nom long soit là quelles que soient les données du jour. */
test('l\'étoile d\'un favori au nom long reste visible dans le tableau', async ({ page }) => {
  const cal = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'schedule.json'), 'utf8'));
  const favoris = {};
  for (const m of cal.matches || []) { if (m.homeTeam) favoris[m.homeTeam] = 1; if (m.awayTeam) favoris[m.awayTeam] = 1; }
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.addInitScript((f) => { localStorage.setItem('fav_teams', JSON.stringify(f)); }, favoris);
  const pageErrors = await bootOffline(page);
  await page.evaluate(() => { applyFilter('live'); choisirDisposition('tableau'); });
  await page.waitForSelector('#marea .dsp-tableau');
  const etat = await page.evaluate(() => {
    const etoiles = [...document.querySelectorAll('#marea .dsp-row .dsp-fav')];
    let longs = 0;
    const cachees = [];
    for (const e of etoiles) {
      const nom = e.parentElement.matches('.dsp-n') ? e.parentElement : e.parentElement.querySelector('.dsp-n');
      if (nom && nom.scrollWidth > nom.clientWidth) longs++;
      // Visible = dans la boîte de chacun de ses ancêtres qui coupe ce qui dépasse.
      const q = e.getBoundingClientRect();
      for (let a = e.parentElement; a && !a.matches('.dsp-row'); a = a.parentElement) {
        if (getComputedStyle(a).overflowX === 'visible') continue;
        const R = a.getBoundingClientRect();
        if (q.right > R.right + 1 || q.left < R.left - 1) { cachees.push(e.closest('.dsp-row').textContent.trim()); break; }
      }
    }
    return { etoiles: etoiles.length, longs, cachees };
  });
  expect(etat.longs, 'au moins un favori au nom tronqué : le test a un sens').toBeGreaterThan(0);
  expect(etat.cachees, 'étoiles coupées par leur cadre').toEqual([]);
  expect(pageErrors).toEqual([]);
});

/* Le contenu des cartes et des lignes ne déborde pas de son cadre, sur tablette (« t'as
   des tuiles que le contenu dépasse »), dans les huit vues ; et les cartes des dispositions
   sont les cartes par défaut (« garder le look des cartes par défaut […] même style »).
   La rangée de choix en tête de page est retirée : le bouton Look la remplace. */
test('rien ne sort de son cadre, et les cartes des dispositions sont les cartes par défaut', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  const pageErrors = await bootOffline(page);
  await expect(page.locator('.dsp-switch')).toHaveCount(0);

  for (const vue of ['live', 'all']) {
    for (const nom of ['tableau', 'maintenant', 'affiches', 'chaines']) {
      await page.evaluate(([n, v]) => { applyFilter(v); choisirDisposition(n); }, [nom, vue]);
      await page.waitForSelector('#marea .dsp-' + nom);
      const etat = await page.evaluate(() => {
        const out = [];
        for (const c of document.querySelectorAll('#marea .dsp [data-mid], #marea .dsp [data-dsp="choix"]')) {
          const R = c.getBoundingClientRect();
          if (!R.width) continue;
          for (const k of c.querySelectorAll('*')) {
            const q = k.getBoundingClientRect();
            if (!q.width || !q.height || k.closest('.dsp-pg')) continue;
            if (q.right > R.right + 2 || q.bottom > R.bottom + 2 || q.left < R.left - 2) { out.push(c.className + ' > ' + k.className); break; }
          }
        }
        const cartes = [...document.querySelectorAll('#marea .dsp .dsp-carte')];
        return { sorties: out, cartes: cartes.length, conformes: cartes.every((c) => c.matches('.match-card') && c.querySelector('.prime-head') && c.querySelector('.prime-thumbnail .prime-logo')) };
      });
      expect(etat.sorties, nom + ' / ' + vue + ' : contenu hors de son cadre').toEqual([]);
      expect(etat.conformes, nom + ' / ' + vue + ' : cartes par défaut').toBe(true);
      if (nom === 'affiches' || (nom === 'maintenant' && vue === 'live')) expect(etat.cartes, nom + ' / ' + vue + ' : des cartes').toBeGreaterThan(0);
    }
  }
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* « Séparer guide et live pour pouvoir mix and match » et « ajouter bouton pour changer
   look, proche de actualiser, ainsi que le mettre à jour l'app » (13 octobre 2026). */
test('Live et Guide ont chacun leur disposition, et le bouton Look les change à côté d\'Actualiser', async ({ page }) => {
  const pageErrors = await bootOffline(page);
  const groupe = await page.evaluate(() => ['btn-look', 'btn-maj-fab', 'btn-actualiser'].map((id) => {
    const b = document.getElementById(id);
    return b && getComputedStyle(b).display !== 'none' && b.closest('#fab-groupe') !== null;
  }));
  expect(groupe, 'Look, Mettre à jour et Actualiser côte à côte').toEqual([true, true, true]);

  await page.locator('#btn-look').click();
  await expect(page.locator('#menu-look')).toBeVisible();
  await page.locator('#menu-look [data-look-vue="live"][data-look-nom="tableau"]').click();
  await page.waitForSelector('#marea .dsp-tableau.dsp-vue-live');
  await page.locator('#menu-look [data-look-vue="guide"][data-look-nom="chaines"]').click();
  await expect(page.locator('#menu-look [data-look-vue="guide"][data-look-nom="chaines"]')).toHaveAttribute('aria-checked', 'true');
  await page.locator('#menu-look [data-look-couleur="home"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu-look')).toBeHidden();

  await page.evaluate(() => applyFilter('all'));
  await page.waitForSelector('#marea .dsp-chaines.dsp-vue-guide');
  await page.evaluate(() => applyFilter('live'));
  await page.waitForSelector('#marea .dsp-tableau.dsp-vue-live');

  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('user_prefs') || '{}'));
  expect([prefs.dispositionLive, prefs.dispositionGuide, prefs.cardColor]).toEqual(['tableau', 'chaines', 'home']);
  expect(await page.evaluate(() => document.getElementById('pref-card-color').value)).toBe('home');

  await page.evaluate(() => applyFilter('logs'));
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('fab-groupe')).display), 'pas de boutons flottants sur Logs').toBe('none');
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

test('sur mobile, les onglets forment une barre au bas de l\'écran et la fiche monte du bas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });
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

/* L'interface classique a été retirée le 30 septembre 2026 (« c'est plus pertinent,
   garder nouvel ui seulement »). Un appareil qui avait choisi l'ancienne présentation
   garde la clé `ui_legacy` dans son stockage : elle ne doit plus mener nulle part. */
test('l\'ancienne préférence d\'interface classique ne redirige plus', async ({ page }) => {
  await page.clock.setFixedTime(instantDesDonnees());
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); localStorage.setItem('ui_legacy', '1'); } catch (e) {} });

  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.hasLoadedOnce === true, null, { timeout: 60000 });
  expect(new URL(page.url()).pathname, 'on reste sur index.html').toBe('/index.html');
  expect(await page.evaluate(() => localStorage.getItem('ui_legacy')), 'la clé périmée est effacée').toBeNull();
  await expect(page.locator('#btn-legacy-ui, #pref-legacy-ui'), 'plus aucune bascule vers l\'ancienne présentation').toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

/* Scores en direct : le rafraîchissement ESPN doit se voir PARTOUT — dans S.matches (fiche,
   filtres), sur les cartes du Live, sur les blocs du Guide — et un match terminé selon ESPN
   doit quitter l'onglet Live sans attendre un changement d'onglet. Jusqu'ici seul le texte
   des cartes bougeait ; les objets restaient ceux d'il y a cinq minutes et les blocs du
   Guide gardaient leur texte de construction. */
test('un match terminé selon ESPN quitte le Live, et le Guide suit le score', async ({ page }) => {
  await guideClassique(page);
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });
  const pageErrors = await bootOffline(page);

  /* Un favori est rendu deux fois dans le Live (section Favoris, puis sa section) : sa
     copie porte le suffixe `_fav_copy`, sans quoi deux cartes partageaient un `id` et
     la seconde ne suivait plus les scores. On compte donc les cartes DU match, et on
     exige des identifiants tous distincts. */
  const cible = await page.evaluate(() => {
    const card = document.querySelector('#marea .match-card.live[id^="mb-"]') || document.querySelector('#marea .match-card[id^="mb-"]');
    const id = window.getOriginalMatchId(card.id.slice(3));
    const m = window.S.matchMap.get(id);
    const ids = [...document.querySelectorAll('#marea .match-card')].map((c) => c.id);
    return { id, status: m.status, cartes: ids.length, ids, copies: ids.filter((x) => window.getOriginalMatchId(x.slice(3)) === id).length };
  });
  expect(new Set(cible.ids).size, 'aucune carte ne partage son id avec une autre').toBe(cible.ids.length);
  expect(cible.copies, 'le match choisi a au moins une carte').toBeGreaterThan(0);

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
  expect(apres.cartes, 'toutes ses cartes sont parties, la copie Favoris comprise').toBe(cible.cartes - cible.copies);

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
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });
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
  await attendreGrilleStable(page);
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
  /* Les matchs dont la carte porte un compteur, par identifiant : onze minutes plus tard,
     d'autres matchs entrent dans la fenêtre et ont le leur, selon le calendrier du jour.
     Ce qui compte, c'est qu'aucun compteur ne disparaisse. */
  await page.evaluate(() => {
    window.__compteurs = () => [...new Set([...document.querySelectorAll('div.card-streams')].map((e) => e.dataset.mid))];
  });
  const avant = await page.evaluate(() => ({ n: window.prefetchedStreamMatches.length, compteurs: window.__compteurs() }));
  expect(avant.n).toBeGreaterThan(0);
  expect(avant.compteurs.length).toBeGreaterThan(0);

  // Le serveur tombe ; le cache a plus de dix minutes ; une passe d'arrière-plan le relit.
  etat.casser = true;
  await page.clock.fastForward('11:00');
  await page.evaluate(() => window.loadAll(true, false));
  await expect.poll(() => page.evaluate(() => window.prefetchedStreamsError), { timeout: 15000 }).toBeTruthy();
  const pendant = await page.evaluate(() => ({
    n: window.prefetchedStreamMatches.length,
    compteurs: window.__compteurs(),
    grille: window.S.matches.length,
    /* Le rafraîchissement des scores, dont toutes les requêtes ESPN sont refusées ici,
       écrivait un calendrier VIDE : la passe suivante effaçait la grille. */
    calendrier: (() => { try { return JSON.parse(localStorage.getItem('api_calendar_cache_' + Object.keys(localStorage).filter((k) => k.startsWith('api_calendar_cache_'))[0].slice(19))).matches.length; } catch (e) { return -1; } })()
  }));
  expect(pendant.n, 'la liste précédente est conservée').toBe(avant.n);
  expect(pendant.grille, 'la grille n\'est pas vidée').toBeGreaterThan(0);
  expect(pendant.calendrier, 'le calendrier local du jour n\'est pas écrasé par une liste vide').toBeGreaterThan(0);
  expect(pendant.compteurs, 'les compteurs des cartes restent').toEqual(expect.arrayContaining(avant.compteurs));

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
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });
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
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });
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

/* ═══ La nuit appartient à la veille (8 septembre 2026) ═══════════════════════════

   « Ya des matchs qui finissent dans la nuit. » À 00:30, le match de base-ball
   commencé à 22:05 est en septième manche. Mais « aujourd'hui » venait de changer, et
   tout était filtré sur `matchDate === aujourd'hui` : plus de match dans la grille ni
   dans le Live, ESPN relu pour la seule date du jour (donc plus de score), liens du
   cache serveur écartés. Ce test rejoue exactement cette nuit-là, ESPN simulé : le
   jour demandé ET la veille sont lus, seul ce qui déborde sur la nuit est gardé, la
   case du Guide commence à 00:00 sur ce qui reste, et le score continue de suivre.

   Le service worker est bloqué : il servirait sinon sa copie de data/schedule.json. */
/* « Possible d'avoir aujourd'hui et demain pour aider avec matchs dans la nuit ? »
   (13 septembre 2026), puis « tu montres 48 h au lieu de 24 h ».

   À 21:00, un match à 02:00 est daté de DEMAIN : il était donc absent, et le seul moyen
   de le voir était de changer de jour — ce qui fait disparaître la soirée en cours. La
   grille couvre maintenant 48 h d'une seule règle continue.

   Ce test passe par le REPLI (data/schedule.json absent), qui est le cas où l'application
   doit se débrouiller seule : il vérifie donc aussi qu'elle demande le lendemain à ESPN,
   et pas seulement que le cache du serveur le lui sert. */
/* « C'est pour pas que ça brise quand le match dépasse minuit » (15 septembre 2026).

   Le jour affiché (`TARGET_DATE`) est fixé au CHARGEMENT et ne bascule jamais. Une
   application laissée ouverte le soir traverse donc minuit en croyant être encore la
   veille, et tout ce qui se compare à « aujourd'hui » se met à mentir : la ligne du
   direct disparaît (`updateNowLine` la masque dès que le jour affiché n'est plus le
   jour courant), la case d'un match en cours cesse de s'allonger, et les matchs de la
   nouvelle journée sont dessinés comme ceux de « demain ».

   Ce test traverse minuit l'horloge à la main, avec un match commencé à 22:00 qui joue
   encore, et un autre à 00:30. */
test('minuit passe pendant qu\'on regarde : le jour affiché bascule, le match en cours reste, la ligne du direct suit', async ({ browser }) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await guideClassique(page);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });

  // 23:50 à New York, le 14 septembre 2026 (heure d'été : UTC−4).
  const AVANT_MINUIT = new Date(Date.UTC(2026, 8, 15, 3, 50));
  expect(estParts(AVANT_MINUIT)).toEqual({ jour: '2026-09-14', minutes: 23 * 60 + 50 });
  await page.clock.install({ time: AVANT_MINUIT });

  const evenement = (id, iso, state) => ({
    id, date: iso, season: { type: 2 },
    status: { type: { state, shortDetail: state === 'in' ? 'Top 8th' : '' }, displayClock: null, period: state === 'in' ? 8 : 0 },
    competitions: [{ id: id + 'c', date: iso, competitors: [
      { homeAway: 'home', team: { displayName: 'Los Angeles Dodgers', name: 'Dodgers', logo: '' }, score: '3' },
      { homeAway: 'away', team: { displayName: 'San Francisco Giants', name: 'Giants', logo: '' }, score: '2' }
    ] }]
  });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(origin) && /data\/schedule\.json/.test(u)) return route.fulfill({ status: 404, body: 'pas publié' });
    if (u.startsWith(origin)) return route.continue();
    const espn = /site\.api\.espn\.com\/apis\/site\/v2\/sports\/([^?]+)\/scoreboard\?dates=(\d{8})/.exec(u);
    if (!espn) return route.abort();
    const chemin = espn[1], jour = espn[2];
    let events = [];
    // Le match de 22:00 le 14, en cours : il dépasse minuit (base-ball, 3 h).
    if (chemin === 'baseball/mlb' && jour === '20260914') events = [evenement('tardif', '2026-09-15T02:00Z', 'in')];
    // Et un match à 00:30 le 15, qui devient « ce soir » une fois minuit passé.
    if (chemin === 'baseball/mlb' && jour === '20260915') events = [evenement('apresMinuit', '2026-09-15T04:30Z', 'pre')];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leagues: [{ name: 'MLB' }], events }) });
  });
  await attendreGrille(page);
  await page.evaluate(() => window.applyFilter('all'));
  await attendreGrilleStable(page);

  const avant = await page.evaluate(() => ({
    jourAffiche: window.getEstDateStrFromDate ? window.getEstDateStrFromDate(window.TARGET_DATE) : null,
    tardif: !!window.S.matchMap.get('espn_tardif'),
    ligne: (() => { const l = document.querySelector('#marea .now-line'); return l ? l.style.display !== 'none' : null; })()
  }));
  expect(avant.tardif, 'le match de 22:00 est là avant minuit').toBe(true);
  expect(avant.ligne, 'et la ligne du direct est visible').toBe(true);

  /* ── On traverse minuit : il est maintenant 00:10 le 15 ───────────────────
     Format hh:mm:ss, écrit en entier : « 00:20 » vaudrait vingt SECONDES (mm:ss), et le
     test ne traverserait rien du tout — première version de ce test, justement. */
  await page.clock.fastForward('00:20:00');
  await page.waitForTimeout(300);
  await attendreGrilleStable(page);

  const apres = await page.evaluate(() => {
    const m = (id) => window.S.matchMap.get('espn_' + id);
    const caseDe = (id) => {
      const b = document.querySelector('#marea .mb[data-mid="espn_' + id + '"]');
      return b ? Number(b.style.getPropertyValue('--start-h')) : null;
    };
    const l = document.querySelector('#marea .now-line');
    return {
      jourAffiche: window.getEstDateStrFromDate(window.TARGET_DATE),
      tardif: m('tardif') && { statut: m('tardif').status, jour: m('tardif').matchDate, heure: m('tardif').startTime },
      apresMinuit: m('apresMinuit') && { jour: m('apresMinuit').matchDate, heure: m('apresMinuit').startTime },
      ligneVisible: l ? l.style.display !== 'none' : null,
      ligneH: l ? Number(l.style.getPropertyValue('--now-h')) : null,
      caseApresMinuit: caseDe('apresMinuit')
    };
  });

  expect(pageErrors, 'aucune erreur de page').toEqual([]);
  // 1. Le jour affiché a basculé : sans cela, tout ce qui se compare à « aujourd'hui » ment.
  expect(apres.jourAffiche, 'le jour affiché suit le calendrier de New York').toBe('2026-09-15');
  // 2. Le match qui dépasse minuit est TOUJOURS là, avec son statut.
  expect(apres.tardif, 'le match commencé à 22:00 hier joue encore et reste dans la grille')
      .toEqual({ statut: 'live', jour: '2026-09-14', heure: '22:00' });
  // 3. La ligne du direct suit, à 00:10.
  expect(apres.ligneVisible, 'la ligne du direct reste visible après minuit').toBe(true);
  expect(apres.ligneH, 'et elle est posée sur la nouvelle heure').toBe(0);
  // 4. Le match de 00:30 est celui de CE matin, pas « demain » : dans les 24 premières heures.
  expect(apres.apresMinuit).toEqual({ jour: '2026-09-15', heure: '00:30' });
  if (apres.caseApresMinuit !== null) {
    expect(apres.caseApresMinuit, 'sa case est dans la première journée de la règle').toBeLessThan(24);
  }
  await ctx.close();
});

test('la grille couvre 48 h : un match de 02:00 demain est là ce soir, après la frontière de minuit', async ({ browser }) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await guideClassique(page);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });

  // 21:00 à New York, le 13 septembre 2026 (heure d'été : UTC−4).
  const SOIR = new Date(Date.UTC(2026, 8, 14, 1, 0));
  expect(estParts(SOIR)).toEqual({ jour: '2026-09-13', minutes: 21 * 60 });
  await page.clock.setFixedTime(SOIR);

  const demandes = {};
  const evenement = (id, iso, state) => ({
    id, date: iso, season: { type: 2 },
    status: { type: { state, shortDetail: '' }, displayClock: null, period: 0 },
    competitions: [{ id: id + 'c', date: iso, competitors: [
      { homeAway: 'home', team: { displayName: 'Los Angeles Dodgers', name: 'Dodgers', logo: '' }, score: '0' },
      { homeAway: 'away', team: { displayName: 'San Francisco Giants', name: 'Giants', logo: '' }, score: '0' }
    ] }]
  });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    // Pas de calendrier publié : c'est le repli, ESPN, qui doit fournir les deux journées.
    if (u.startsWith(origin) && /data\/schedule\.json/.test(u)) return route.fulfill({ status: 404, body: 'pas publié' });
    if (u.startsWith(origin)) return route.continue();
    const espn = /site\.api\.espn\.com\/apis\/site\/v2\/sports\/([^?]+)\/scoreboard\?dates=(\d{8})/.exec(u);
    if (!espn) return route.abort();
    const chemin = espn[1], jour = espn[2];
    demandes[jour] = (demandes[jour] || 0) + 1;
    let events = [];
    if (chemin === 'baseball/mlb' && jour === '20260913') events = [evenement('soir', '2026-09-13T23:00Z', 'pre')];      // 19:00 ce soir
    if (chemin === 'baseball/mlb' && jour === '20260914') events = [
      evenement('nuitProchaine', '2026-09-14T06:00Z', 'pre'),   // 02:00 cette nuit — le cas de la demande
      evenement('demainJour', '2026-09-14T19:00Z', 'pre')       // 15:00 demain : dans la fenêtre aussi
    ];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leagues: [{ name: 'MLB' }], events }) });
  });
  await attendreGrille(page);

  expect(demandes['20260913'], 'ESPN lu pour aujourd\'hui').toBeGreaterThan(0);
  expect(demandes['20260914'], 'et pour demain : sans ça, la fenêtre de 48 h rétrécit dès que le serveur est muet').toBeGreaterThan(0);

  // La grille du Guide, pour lire la règle et la position des cases.
  await page.evaluate(() => window.applyFilter('all'));
  await attendreGrilleStable(page);

  const vue = await page.evaluate(() => {
    const m = (id) => window.S.matchMap.get('espn_' + id);
    const bornes = [...document.querySelectorAll('#marea .ruler-times .tc')].map((t) => t.textContent.trim());
    const piste = document.querySelector('#marea .marea');
    const heurePx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-px')) || 0;
    const caseDe = (id) => {
      const b = document.querySelector('#marea .mb[data-mid="espn_' + id + '"]')
          || [...document.querySelectorAll('#marea .mb')].find((x) => (x.textContent || '').includes('Dodgers'));
      return b ? { debutH: b.style.getPropertyValue('--start-h'), debutM: b.style.getPropertyValue('--start-m') } : null;
    };
    return {
      bornes: bornes.length, premiere: bornes[0], frontiere: bornes[24], derniere: bornes[bornes.length - 1],
      largeurPiste: piste ? piste.getBoundingClientRect().width : 0, heurePx,
      soir: m('soir') && { jour: m('soir').matchDate, heure: m('soir').startTime },
      nuitProchaine: m('nuitProchaine') && { jour: m('nuitProchaine').matchDate, heure: m('nuitProchaine').startTime },
      demainJour: m('demainJour') && { jour: m('demainJour').matchDate, heure: m('demainJour').startTime },
      casesParDebut: [...document.querySelectorAll('#marea .mb')].map((b) => b.style.getPropertyValue('--start-h')).sort((a, b) => a - b),
      libellesJour: [...document.querySelectorAll('#marea .kd-day, #marea .prime-day')].map((e) => e.textContent.trim())
    };
  });

  expect(pageErrors, 'aucune erreur de page').toEqual([]);
  // Les trois matchs sont dans la grille, chacun avec sa date.
  expect(vue.soir).toEqual({ jour: '2026-09-13', heure: '19:00' });
  expect(vue.nuitProchaine, 'le match de 02:00 de la nuit prochaine est là, sans changer de jour').toEqual({ jour: '2026-09-14', heure: '02:00' });
  expect(vue.demainJour, 'et celui de demain après-midi aussi').toEqual({ jour: '2026-09-14', heure: '15:00' });
  // La règle : 49 bornes (00:00 aujourd'hui → 00:00 après-demain), la 25e marque « demain ».
  expect(vue.bornes, '49 bornes pour 48 h').toBe(49);
  expect(vue.premiere).toBe('00:00');
  expect(vue.frontiere, 'la frontière porte « demain » plutôt qu\'un second « 00:00 »').toBe('demain');
  expect(vue.derniere).toBe('00:00');
  // La piste fait bien 49 heures de large, et une case de demain est posée au-delà de la 24e.
  expect(vue.largeurPiste).toBeGreaterThan(vue.heurePx * 48);
  expect(vue.casesParDebut.map(Number).some((h) => h >= 24), 'une case au moins est posée dans la seconde journée').toBe(true);
  expect(vue.casesParDebut.map(Number).includes(26), 'le match de 02:00 demain est à la 26e heure de la règle').toBe(true);
  await ctx.close();
});

test('la nuit appartient à la veille : le match de 22:05 est encore là à 00:30, dans le Live, la grille et les scores', async ({ browser }) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await guideClassique(page);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });

  // 00:30 à New York, le 8 septembre 2026 (heure d'été : UTC−4).
  const NUIT = new Date(Date.UTC(2026, 8, 8, 4, 30));
  expect(estParts(NUIT)).toEqual({ jour: '2026-09-08', minutes: 30 });
  await page.clock.setFixedTime(NUIT);

  const etat = { score: [2, 1], demandes: {} };
  const evenement = (id, iso, state, score) => ({
    id, date: iso, season: { type: 2 },
    status: { type: { state, shortDetail: state === 'in' ? 'Top 7th' : '' }, displayClock: null, period: state === 'in' ? 7 : 0 },
    competitions: [{ id: id + 'c', date: iso, competitors: [
      { homeAway: 'home', team: { displayName: 'Los Angeles Dodgers', name: 'Dodgers', logo: '' }, score: String(score[0]) },
      { homeAway: 'away', team: { displayName: 'San Francisco Giants', name: 'Giants', logo: '' }, score: String(score[1]) }
    ] }]
  });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    // Pas de calendrier publié cette nuit-là : c'est ESPN, simulé ci-dessous, qui le fournit.
    if (u.startsWith(origin) && /data\/schedule\.json/.test(u)) return route.fulfill({ status: 404, body: 'pas encore publié' });
    if (u.startsWith(origin)) return route.continue();
    const espn = /site\.api\.espn\.com\/apis\/site\/v2\/sports\/([^?]+)\/scoreboard\?dates=(\d{8})/.exec(u);
    if (!espn) return route.abort();
    const chemin = espn[1], jour = espn[2];
    etat.demandes[jour] = (etat.demandes[jour] || 0) + 1;
    let events = [];
    if (chemin === 'baseball/mlb' && jour === '20260907') {
      events = [
        evenement('nuit1', '2026-09-08T02:05Z', 'in', etat.score),   // hier 22:05, en cours : déborde sur cette nuit
        evenement('nuit3', '2026-09-07T23:05Z', 'post', [5, 4])      // hier 19:05, fini à 22:05 : n'a rien à faire ici
      ];
    }
    if (chemin === 'baseball/mlb' && jour === '20260908') {
      events = [evenement('nuit2', '2026-09-08T05:05Z', 'pre', [0, 0])]; // 01:05 cette nuit, à venir
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leagues: [{ name: 'MLB' }], events }) });
  });
  await attendreGrille(page);

  expect(etat.demandes['20260908'], 'ESPN lu pour le jour').toBeGreaterThan(0);
  expect(etat.demandes['20260907'], 'et pour la veille, puisqu\'il fait nuit').toBeGreaterThan(0);

  const grille = await page.evaluate(() => {
    const m = (id) => window.S.matchMap.get(id);
    const carte = (id) => document.getElementById('mb-' + id);
    return {
      filtre: window.S.filter,
      nuit1: m('espn_nuit1') && { statut: m('espn_nuit1').status, jour: m('espn_nuit1').matchDate, heure: m('espn_nuit1').startTime, score: m('espn_nuit1').score },
      nuit2: m('espn_nuit2') && { statut: m('espn_nuit2').status, jour: m('espn_nuit2').matchDate, heure: m('espn_nuit2').startTime },
      nuit3: !!m('espn_nuit3'),
      carteNuit1: carte('espn_nuit1') && carte('espn_nuit1').classList.contains('live'),
      carteNuit2: !!carte('espn_nuit2'),
      jourNuit1: carte('espn_nuit1') && carte('espn_nuit1').querySelector('.prime-day') && carte('espn_nuit1').querySelector('.prime-day').textContent,
      jourNuit2: carte('espn_nuit2') && !!carte('espn_nuit2').querySelector('.prime-day')
    };
  });
  expect(grille.jourNuit1, 'la carte du match d\'hier soir dit « hier »').toBe('hier');
  expect(grille.jourNuit2, 'celle du match de cette nuit ne dit rien').toBe(false);
  expect(grille.filtre).toBe('live');
  expect(grille.nuit1, 'le match d\'hier soir est dans la journée').toEqual({ statut: 'live', jour: '2026-09-07', heure: '22:05', score: [2, 1] });
  expect(grille.nuit2, 'le match de cette nuit aussi').toEqual({ statut: 'upcoming', jour: '2026-09-08', heure: '01:05' });
  expect(grille.nuit3, 'celui d\'hier soir qui a fini avant minuit, non').toBeFalsy();
  expect(grille.carteNuit1, 'le Live montre le match de 22:05 en direct').toBeTruthy();
  expect(grille.carteNuit2, 'et celui de 01:05 comme imminent').toBeTruthy();

  // Guide : la case du match d'hier commence à 00:00 et ne couvre que ce qui lui reste (01:05).
  await page.evaluate(() => window.applyFilter('all'));
  await page.waitForTimeout(500);
  const cases = await page.evaluate(() => {
    const lire = (id) => { const b = document.getElementById('mb-' + id); return b && { h: b.style.getPropertyValue('--start-h'), m: b.style.getPropertyValue('--start-m'), d: b.style.getPropertyValue('--duration-m') }; };
    const texte = (id) => { const b = document.getElementById('mb-' + id); const t = b && b.querySelector('.mb-time'); return t ? t.textContent.trim() : null; };
    return { nuit1: lire('espn_nuit1'), nuit2: lire('espn_nuit2'), texteNuit1: texte('espn_nuit1'), texteNuit2: texte('espn_nuit2') };
  });
  expect(cases.nuit1, 'hier 22:05 + 3 h : de 00:00 à 01:05 sur la grille du jour').toEqual({ h: '0', m: '0', d: '65' });
  expect(cases.nuit2, 'cette nuit 01:05 : à sa place').toEqual({ h: '1', m: '5', d: '180' });
  expect(cases.texteNuit1, 'la case du match d\'hier soir commence par « hier »').toMatch(/^hier · /);
  expect(cases.texteNuit2, 'celle de cette nuit donne l\'heure seule').toBe('01:05');

  // Le score continue de suivre : le rafraîchissement relit la veille tant qu'il fait nuit.
  etat.score = [3, 1];
  const suivi = await page.evaluate(() => window.backgroundUpdateGuide(new Date()).then(() => window.S.matchMap.get('espn_nuit1').score));
  expect(suivi, 'le score du match d\'hier soir a bougé').toEqual([3, 1]);

  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
  await ctx.close();
});

/* ═══ Passe ESPN partielle (8 septembre 2026) ═══════════════════════════════════════

   « ESPN, les scores sont parfois là, parfois pas là. »

   Le calendrier du jour vient de 47 chemins ESPN. Le garde-fou ne voyait que le cas où
   AUCUN n'avait répondu : quand 46 répondaient et un échouait, le résultat — amputé de
   la ligue muette — était écrit tel quel comme LE calendrier du jour. La passe suivante
   lisait ce calendrier amputé et les matchs de cette ligue disparaissaient de la grille,
   leurs scores avec ; au tour d'après ils revenaient. Le rafraîchissement des scores
   passe par ce chemin toutes les cinq minutes et à chaque retour au premier plan.

   Ce test rejoue exactement cela : deux ligues, un score qui bouge, puis une seule des
   deux qui répond. */
test('une passe ESPN partielle ne fait pas disparaître les ligues muettes ni leurs scores', async ({ browser }) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });

  // 20:00 à New York le 8 septembre 2026 ; les deux matchs ont commencé à 19:00.
  const SOIR = new Date(Date.UTC(2026, 8, 9, 0, 0));
  expect(estParts(SOIR)).toEqual({ jour: '2026-09-08', minutes: 20 * 60 });
  await page.clock.setFixedTime(SOIR);

  const etat = { nbaMuette: false, scoreMlb: [3, 1], demandes: {} };
  const evenement = (id, score) => ({
    id, date: '2026-09-08T23:00Z', season: { type: 2 },
    status: { type: { state: 'in', shortDetail: 'En cours' }, displayClock: '12:00', period: 2 },
    competitions: [{ id: id + 'c', date: '2026-09-08T23:00Z', competitors: [
      { homeAway: 'home', team: { displayName: 'Los Angeles Dodgers', name: 'Dodgers', logo: '' }, score: String(score[0]) },
      { homeAway: 'away', team: { displayName: 'San Francisco Giants', name: 'Giants', logo: '' }, score: String(score[1]) }
    ] }]
  });
  const evenementNba = (score) => ({
    id: 'nba1', date: '2026-09-08T23:00Z', season: { type: 2 },
    status: { type: { state: 'in', shortDetail: 'En cours' }, displayClock: '5:00', period: 3 },
    competitions: [{ id: 'nba1c', date: '2026-09-08T23:00Z', competitors: [
      { homeAway: 'home', team: { displayName: 'Boston Celtics', name: 'Celtics', logo: '' }, score: String(score[0]) },
      { homeAway: 'away', team: { displayName: 'Miami Heat', name: 'Heat', logo: '' }, score: String(score[1]) }
    ] }]
  });

  await page.route('**/*', (route) => {
    const u = route.request().url();
    // Pas de calendrier publié : c'est ESPN, simulé ici, qui fournit la journée.
    if (u.startsWith(origin) && /data\/schedule\.json/.test(u)) return route.fulfill({ status: 404, body: 'absent' });
    if (u.startsWith(origin)) return route.continue();
    const espn = /site\.api\.espn\.com\/apis\/site\/v2\/sports\/([^?]+)\/scoreboard\?dates=(\d{8})/.exec(u);
    if (!espn) return route.abort();
    const chemin = espn[1], jour = espn[2];
    etat.demandes[chemin] = (etat.demandes[chemin] || 0) + 1;
    if (jour !== '20260908') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leagues: [], events: [] }) });
    if (chemin === 'basketball/nba') {
      if (etat.nbaMuette) return route.abort();   // le chemin ne répond plus : réseau, filtre, délai
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leagues: [{ name: 'NBA' }], events: [evenementNba([88, 84])] }) });
    }
    if (chemin === 'baseball/mlb') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leagues: [{ name: 'MLB' }], events: [evenement('mlb1', etat.scoreMlb)] }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leagues: [], events: [] }) });
  });
  await attendreGrille(page);

  const lire = () => page.evaluate(() => {
    const cle = Object.keys(localStorage).filter((k) => k.startsWith('api_calendar_cache_'))[0];
    let cache = [];
    try { cache = (JSON.parse(localStorage.getItem(cle)).matches || []).map((m) => m.id); } catch (e) {}
    const m = (id) => window.S.matchMap.get(id);
    return {
      cache,
      mlb: m('espn_mlb1') ? m('espn_mlb1').score : null,
      nba: m('espn_nba1') ? m('espn_nba1').score : null,
      rendus: ['espn_mlb1', 'espn_nba1'].filter((id) => !!document.getElementById('mb-' + id))
    };
  });

  // ── Départ : les deux ligues répondent ────────────────────────────────────
  const avant = await lire();
  expect(avant.cache, 'les deux matchs sont dans le calendrier du jour').toEqual(expect.arrayContaining(['espn_mlb1', 'espn_nba1']));
  expect(avant.mlb).toEqual([3, 1]);
  expect(avant.nba).toEqual([88, 84]);
  expect(avant.rendus, 'les deux sont rendus').toEqual(['espn_mlb1', 'espn_nba1']);

  // ── La NBA se tait, le score de la MLB bouge : passe PARTIELLE ────────────
  etat.nbaMuette = true;
  etat.scoreMlb = [4, 1];
  const demandesAvant = etat.demandes['basketball/nba'];
  await page.evaluate(() => window.backgroundUpdateGuide(new Date()));
  await page.waitForTimeout(500);
  expect(etat.demandes['basketball/nba'], 'la NBA a bien été redemandée').toBeGreaterThan(demandesAvant);

  const pendant = await lire();
  expect(pendant.mlb, 'la ligue qui répond porte son nouveau score').toEqual([4, 1]);
  expect(pendant.cache, 'le calendrier du jour garde la ligue muette').toEqual(expect.arrayContaining(['espn_mlb1', 'espn_nba1']));
  expect(pendant.nba, 'et son score connu').toEqual([88, 84]);

  /* Le cœur de la panne : c'est la passe SUIVANTE qui lisait le calendrier amputé et
     faisait disparaître la ligue muette de la grille. */
  await page.evaluate(() => window.loadAll(true, false));
  await page.waitForTimeout(1500);
  const apres = await lire();
  expect(apres.cache, 'après une nouvelle passe, les deux matchs sont toujours là').toEqual(expect.arrayContaining(['espn_mlb1', 'espn_nba1']));
  expect(apres.rendus, 'et tous deux sont encore rendus').toEqual(['espn_mlb1', 'espn_nba1']);
  expect(apres.nba, 'la ligue muette n\'a pas perdu son score').toEqual([88, 84]);
  expect(apres.mlb).toEqual([4, 1]);

  // ── La NBA répond de nouveau : ESPN fait foi ─────────────────────────────
  etat.nbaMuette = false;
  await page.evaluate(() => window.backgroundUpdateGuide(new Date()));
  await page.waitForTimeout(500);
  const retour = await lire();
  expect(retour.nba, 'quand le chemin répond, c\'est ESPN qui fait foi').toEqual([88, 84]);
  expect(retour.rendus).toEqual(['espn_mlb1', 'espn_nba1']);

  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
  await ctx.close();
});

/* ═══ Scores en direct (8 septembre 2026) ═══════════════════════════════════════════

   « Est-ce que les scores peuvent se rafraîchir au rafraîchissement ? Ça devrait être
   pas mal en direct, les scores. »

   La passe complète reconstruit toute la journée — 47 chemins ESPN plus les calendriers
   annexes — d'où sa cadence de cinq minutes ; et à l'ouverture, la grille vient souvent
   du calendrier rangé en local, qui peut avoir dix minutes. Un score pouvait donc traîner
   un quart d'heure. La passe rapide ne demande QUE les ligues qui ont un match en cours,
   chaque minute et dès l'ouverture. Ce test vérifie les trois choses qui comptent : le
   score bouge, on n'a pas redemandé toute la journée pour cela, et le calendrier rangé
   en local suit — sans quoi la passe complète suivante ramènerait le score d'avant. */
test('les scores des matchs en cours se rafraîchissent chaque minute, sans redemander toute la journée', async ({ browser }) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', '2'); } catch (e) {} });

  // 20:00 à New York le 8 septembre 2026 ; le match de base-ball a commencé à 19:00.
  const SOIR = new Date(Date.UTC(2026, 8, 9, 0, 0));
  expect(estParts(SOIR)).toEqual({ jour: '2026-09-08', minutes: 20 * 60 });
  await page.clock.install({ time: SOIR });

  const etat = { score: [3, 1], demandes: {} };
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(origin) && /data\/schedule\.json/.test(u)) return route.fulfill({ status: 404, body: 'absent' });
    if (u.startsWith(origin)) return route.continue();
    const espn = /site\.api\.espn\.com\/apis\/site\/v2\/sports\/([^?]+)\/scoreboard\?dates=(\d{8})/.exec(u);
    if (!espn) return route.abort();
    const chemin = espn[1];
    etat.demandes[chemin] = (etat.demandes[chemin] || 0) + 1;
    const json = (corps) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
    if (espn[2] !== '20260908') return json({ leagues: [], events: [] });
    if (chemin === 'baseball/mlb') return json({ leagues: [{ name: 'MLB' }], events: [{
      id: 'live1', date: '2026-09-08T23:00Z', season: { type: 2 },
      status: { type: { state: 'in', shortDetail: 'Top 7th' }, displayClock: '0:00', period: 7 },
      competitions: [{ id: 'c', date: '2026-09-08T23:00Z', competitors: [
        { homeAway: 'home', team: { displayName: 'Los Angeles Dodgers', name: 'Dodgers', logo: '' }, score: String(etat.score[0]) },
        { homeAway: 'away', team: { displayName: 'San Francisco Giants', name: 'Giants', logo: '' }, score: String(etat.score[1]) }] }]
    }] });
    // Une ligue sans match en cours : elle ne doit PAS être redemandée par la passe rapide.
    if (chemin === 'basketball/nba') return json({ leagues: [{ name: 'NBA' }], events: [{
      id: 'plustard', date: '2026-09-09T02:00Z', season: { type: 2 },
      status: { type: { state: 'pre' } },
      competitions: [{ id: 'c', date: '2026-09-09T02:00Z', competitors: [
        { homeAway: 'home', team: { displayName: 'Boston Celtics', name: 'Celtics', logo: '' }, score: '0' },
        { homeAway: 'away', team: { displayName: 'Miami Heat', name: 'Heat', logo: '' }, score: '0' }] }]
    }] });
    return json({ leagues: [], events: [] });
  });
  await attendreGrille(page);

  const lire = () => page.evaluate(() => {
    const cle = Object.keys(localStorage).filter((k) => k.startsWith('api_calendar_cache_'))[0];
    let cache = null;
    try { cache = (JSON.parse(localStorage.getItem(cle)).matches || []).find((m) => m.id === 'espn_live1'); } catch (e) {}
    const m = window.S.matchMap.get('espn_live1');
    const bloc = document.getElementById('mb-espn_live1');
    return {
      score: m ? m.score : null,
      chemin: m ? m.espnPath : null,
      cache: cache ? cache.score : null,
      affiche: bloc ? [...bloc.querySelectorAll('.prime-score')].map((e) => e.textContent.trim()) : null
    };
  });

  const avant = await lire();
  expect(avant.score, 'le match en cours porte son score').toEqual([3, 1]);
  expect(avant.chemin, 'et le chemin ESPN d\'où il vient').toBe('baseball/mlb');
  expect(avant.affiche, 'la carte le montre').toEqual(['3', '1']);

  // ── Le score change chez ESPN ; une minute passe ──────────────────────────
  etat.score = [4, 1];
  const nbaAvant = etat.demandes['basketball/nba'];
  const mlbAvant = etat.demandes['baseball/mlb'];
  await page.clock.fastForward('01:00');
  await expect.poll(() => page.evaluate(() => {
    const m = window.S.matchMap.get('espn_live1');
    return m && m.score ? m.score.join('-') : '';
  }), { timeout: 15000 }).toBe('4-1');

  const apres = await lire();
  expect(apres.affiche, 'la carte suit sans rechargement').toEqual(['4', '1']);
  expect(apres.cache, 'et le calendrier rangé en local aussi, sinon la passe complète ramènerait l\'ancien score').toEqual([4, 1]);
  expect(etat.demandes['baseball/mlb'], 'la ligue en cours a été redemandée').toBeGreaterThan(mlbAvant);
  expect(etat.demandes['basketball/nba'], 'mais pas celle sans match en cours : c\'est une passe ciblée, pas toute la journée')
    .toBe(nbaAvant);

  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
  await ctx.close();
});

/* « Garder le concept actuel de l'app, juste adapter à CCGTV » (10 octobre 2026). Dans
   l'APK, sur une télé, l'application allume d'elle-même le mode TV et le mode câble la
   première fois, la touche Retour ferme ce qui est ouvert, et un flux direct part au
   lecteur NATIF d'Android (js/tele.js) — ici un faux plugin Capacitor qui note ce qu'on
   lui demande. */
test('sur la télé Android : le site tel quel (modes imposés défaits), Retour qui ferme, flux direct au lecteur natif', async ({ page }) => {
  await page.addInitScript((o) => {
    const appels = [];
    const ecouteurs = [];
    window.__natif = { appels, emettre: (ev) => ecouteurs.forEach((f) => f(ev)) };
    window.Capacitor = { Plugins: { LecteurNatif: {
      jouer: (opts) => { appels.push(['jouer', opts]); return Promise.resolve(); },
      fermer: () => { appels.push(['fermer']); return Promise.resolve(); },
      diagnostic: () => Promise.resolve({ etats: { webview: 'webview 140', script: 'posé dans tous les cadres (60 Ko)', bloqueur: '99113 hôtes' }, requetesBloquees: 7, navigationsRefusees: 1, hotesBloques: [{ hote: 'regie.example', n: 7 }], lignes: ['15:00:00  lecteur natif : joue'] }),
      addListener: (nom, f) => { if (nom === 'evenement') ecouteurs.push(f); return Promise.resolve({ remove() {} }); }
    } } };
    try {
      localStorage.setItem('direct_media', JSON.stringify({
        [o + '/__faux-lecteur?a']: { url: 'https://cdn.test/a/index.m3u8', pageUrl: o + '/__faux-lecteur?a', referer: 'https://cadre.test/', at: Date.now(), echecs: 0 }
      }));
    } catch (e) {}
  }, origin);
  const pageErrors = await bootOffline(page);

  /* « T'as forcé le mode câble, je veux que l'APK soit exactement le site » (25 octobre
     2026). Une version précédente avait allumé d'office les modes TV et câble : la
     nouvelle les éteint une fois, et la télé garde la navigation à la télécommande et
     l'échelle d'un écran d'ordinateur. */
  await page.evaluate(() => { window.toggleTvMode(true); localStorage.setItem('mode_cable', '1'); });
  expect(await page.evaluate(() => { window.__ANDROID_TV__ = true; return window.activerTeleAndroid(); })).toBe(true);
  await expect(page.locator('body')).not.toHaveClass(/tv-mode/);
  await expect(page.locator('body')).toHaveClass(/android-tv/);
  await expect(page.locator('body')).toHaveClass(/manette/);
  expect(await page.evaluate(() => ({ cable: localStorage.getItem('mode_cable'), fait: localStorage.getItem('apk_comme_site') }))).toEqual({ cable: '0', fait: '1' });
  const echelle = await page.evaluate(() => ({ zoom: Number(getComputedStyle(document.body).zoom), attendu: Math.round(Math.min(Math.max(innerWidth / 1920, 0.5), 1) * 100) / 100 }));
  expect(echelle.zoom, 'la page à la largeur d\'un écran d\'ordinateur').toBeCloseTo(echelle.attendu, 2);
  // Comme sur Netflix : le focus de départ est un match, et les cartes du Guide s'atteignent.
  await expect.poll(() => page.evaluate(() => !!(document.activeElement && document.activeElement.closest('.match-card, .mb, [data-mid]'))),
    { message: 'le focus de départ est sur un match', timeout: 10000 }).toBe(true);
  await page.evaluate(() => window.applyFilter('all'));
  await expect.poll(() => page.evaluate(() => { const c = document.querySelector('#marea .mb, #marea [data-mid]'); return c && c.getAttribute('tabindex'); })).toBe('0');
  await page.evaluate(() => window.applyFilter('live'));

  // Ensuite, le mode TV est un choix comme un autre : le rallumer tient.
  await page.evaluate(() => { window.toggleTvMode(true); window.activerTeleAndroid(); });
  await expect(page.locator('body')).toHaveClass(/tv-mode/);
  await page.evaluate(() => { window.toggleTvMode(false); });

  /* Un flux direct connu part au lecteur natif, avec les Referer dans l'ordre, sans
     <video>. Sans mode câble imposé, la tuile montre d'abord la page, comme sur le site ;
     le bouton ▶ direct (toggleDirectMode) passe au lecteur natif. */
  await page.evaluate((o) => { window.addToMultivision(o + '/__faux-lecteur?a', 'Match A', 'mA'); window.openMultiviewTab(); }, origin);
  await expect(page.locator('.mv-cell[data-index="0"] iframe')).toHaveCount(1);
  await page.evaluate(() => window.toggleDirectMode(0));
  await expect.poll(() => page.evaluate(() => window.__natif.appels.filter((a) => a[0] === 'jouer').length)).toBe(1);
  const jouer = await page.evaluate(() => window.__natif.appels.find((a) => a[0] === 'jouer')[1]);
  expect(jouer.media).toBe('https://cdn.test/a/index.m3u8');
  expect(jouer.referers).toEqual(['https://cadre.test/', origin + '/__faux-lecteur?a', '']);
  await expect(page.locator('.mv-cell[data-index="0"] .mv-natif')).toBeVisible();
  await expect(page.locator('.mv-cell video, .mv-cell iframe')).toHaveCount(0);

  // Le lecteur natif a vu jouer : la pastille le dit.
  await page.evaluate(() => window.__natif.emettre({ type: 'joue' }));
  expect(await page.evaluate(() => window.mvFlux[0]._playing)).toBe(true);

  // Plus aucun Referer ne passe : la tuile revient à la page, comme avec hls.js.
  await page.evaluate(() => window.__natif.emettre({ type: 'echec', raison: 'ERROR_CODE_IO_BAD_HTTP_STATUS' }));
  await expect(page.locator('.mv-cell[data-index="0"] iframe')).toHaveCount(1);
  expect(await page.evaluate(() => window.mvFlux[0].mode)).toBe('page');

  /* Retour : le lecteur revient au Live ; sur le Live, la barre de navigation prend
     d'abord le focus (comme sur Netflix), puis Retour laisse quitter. */
  expect(await page.evaluate(() => window.retourTele()), 'depuis le lecteur, Retour ramène au Live').toBe(true);
  await expect(page.locator('body')).toHaveAttribute('data-view', 'live');
  expect(await page.evaluate(() => window.retourTele()), 'sur le Live, Retour mène à la barre de navigation').toBe(true);
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('filter-live');
  expect(await page.evaluate(() => window.retourTele()), 'depuis la barre, Retour laisse quitter').toBe(false);

  // Plus → Logs : le journal de l'APK est lisible sur l'appareil même.
  await page.evaluate(() => window.applyFilter('logs'));
  await expect(page.locator('.diag-android')).toContainText('posé dans tous les cadres');
  await expect(page.locator('.diag-android')).toContainText('regie.example (7)');

  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* La manette (js/manette.js) : « je veux l'APK avec les mêmes fonctions que le site, mais
   avec contrôle à la manette ; la manette pourrait marcher sur PC et Android aussi »
   (25 octobre 2026). Aucun navigateur ne branche une manette sans matériel : le test tient
   une manette « standard » par navigator.getGamepads, ce que lit l'application, et la
   vraie application fait le reste (navigation du mode TV, lecteur, Retour). */
test('à la manette : la croix navigue, A ouvre, Start le lecteur, RB la tuile, Y plein cadre, B revient, Select le menu', async ({ page }) => {
  await page.addInitScript(() => {
    const pad = { index: 0, id: 'Manette de test', connected: true, mapping: 'standard', timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
    window.__manette = {
      appuyer(i) { pad.buttons[i] = { pressed: true, touched: true, value: 1 }; },
      relacher(i) { pad.buttons[i] = { pressed: false, touched: false, value: 0 }; }
    };
    Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => [pad, null, null, null] });
  });
  const pageErrors = await bootOffline(page);
  const presser = async (b) => {
    await page.evaluate((i) => window.__manette.appuyer(i), b);
    await page.waitForTimeout(250);
    await page.evaluate((i) => window.__manette.relacher(i), b);
    await page.waitForTimeout(150);
  };
  const BAS = 13, A = 0, B = 1, Y = 3, SELECT = 8, START = 9, RB = 5;

  // La croix : la navigation aux flèches se charge (sans le zoom du mode TV), l'aide s'affiche.
  await presser(BAS);
  await expect(page.locator('body')).toHaveClass(/manette/);
  await expect(page.locator('body')).not.toHaveClass(/tv-mode/);
  await expect(page.locator('#toasttxt')).toContainText('Manette');
  await expect(page.locator('#tv-nav-script')).toHaveCount(1);
  await presser(BAS);
  expect(await page.evaluate(() => document.activeElement && document.activeElement !== document.body), 'un élément a le focus').toBe(true);

  // A : le bouton qui a le focus.
  await page.evaluate(() => document.getElementById('filter-all').focus());
  await presser(A);
  await expect(page.locator('body')).toHaveAttribute('data-view', 'all');

  // Start : le lecteur ; RB : la tuile suivante (le son la suit).
  await page.evaluate((o) => {
    window.addToMultivision(o + '/__faux-lecteur?a', 'Match A', 'mA');
    window.addToMultivision(o + '/__faux-lecteur?b', 'Match B', 'mB');
  }, origin);
  await page.evaluate(() => window.applyFilter('live'));
  await presser(START);
  await expect(page.locator('body')).toHaveAttribute('data-view', 'player');
  await page.evaluate(() => window.focusStream(0));
  await presser(RB);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('.mv-cell[data-index="1"]')).boxShadow)).toContain('inset');

  /* Y : plein cadre. Le vrai plein écran quand le navigateur compte l'appui comme un geste
     (ici oui : page.evaluate en donne un), sinon le mode Cinéma ; Y encore, on en sort. */
  const cadre = () => page.evaluate(() => ({ plein: !!document.fullscreenElement, cinema: document.getElementById('mv-grid-wrapper').classList.contains('mv-theater') }));
  await presser(Y);
  await expect.poll(async () => { const c = await cadre(); return c.plein || c.cinema; }).toBe(true);
  await presser(Y);
  await expect.poll(cadre).toEqual({ plein: false, cinema: false });

  // B : le Retour de la télécommande (du lecteur, on revient au Live).
  await presser(B);
  await expect(page.locator('body')).toHaveAttribute('data-view', 'live');

  // Select : le menu ⋯ Plus ; B le referme.
  await presser(SELECT);
  await expect(page.locator('#main-menu')).toHaveClass(/open/);
  await presser(B);
  await expect(page.locator('#main-menu')).not.toHaveClass(/open/);

  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* La fiche façon page de film (« Go 1-2 », 25 octobre 2026). Sous le bandeau, « ▶ Regarder »
   lance la meilleure source affichée (la première de la liste, déjà classée) ; le nom de
   cette source est à côté. Sans aucun lien ni page de match : le bouton le dit, inactif. */
test('la fiche façon page de film : « ▶ Regarder » lance la meilleure source', async ({ page }) => {
  const pageErrors = await bootOffline(page);
  const id = await page.evaluate(() => { const m = window.S.matches.find((x) => (x.streamLinks || []).length); window.openMod(m); return m.id; });
  await expect(page.locator('#mbg')).toHaveClass(/open/);
  const bouton = page.locator('#mbody .btn-regarder');
  await expect(bouton).toHaveText('▶ Regarder');
  const premiere = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('#modal-right-col .si .si-main')).find((x) => x.getClientRects().length);
    return a.querySelector('.si-n span').textContent;
  });
  await expect(page.locator('#mbody .fiche-cta-info')).toHaveText('Meilleure source : ' + premiere);
  const avant = await page.evaluate(() => window.mvFlux.length);
  await bouton.click();
  await expect.poll(() => page.evaluate(() => window.mvFlux.length), { message: 'une vidéo de plus au lecteur' }).toBe(avant + 1);
  expect(await page.evaluate((mid) => String(window.mvFlux[window.mvFlux.length - 1].mid), id), 'celle de ce match').toBe(String(id));
  await expect(page.locator('#mbg')).not.toHaveClass(/open/);

  // Sans lien ni page de match : rien à lancer, et le bouton le dit.
  await page.evaluate(() => window.openMod({ id: 'sans-lien', homeTeam: 'A', awayTeam: 'B', league: 'Test', status: 'upcoming', startTime: '20:00', streamLinks: [] }));
  await expect(bouton).toHaveText('Aucun lien pour l\'instant');
  await expect(bouton).toBeDisabled();
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* Le lecteur façon Netflix (« Go 1-2 », 25 octobre 2026 : une interface moderne, sans tout
   refaire). La barre est en bas, par-dessus la vidéo, et porte le match regardé ; au repos,
   elle s'efface avec les en-têtes ; la première touche ne fait que la ramener, focus sur
   ⏭ ; la suivante agit. Au clavier ici : c'est le chemin de la télécommande. */
test('le lecteur façon Netflix : barre en bas qui s\'efface, première touche qui la ramène, ⏭ source', async ({ page }) => {
  const pageErrors = await bootOffline(page);
  await page.evaluate((o) => {
    window.addToMultivision(o.replace('127.0.0.1', 'localhost') + '/__lecteur-calme?a', 'Match A', 'mA');
    window.addToMultivision(o.replace('127.0.0.1', 'localhost') + '/__lecteur-calme?b', 'Match B', 'mB');
    window.openMultiviewTab();
    window.focusStream(0);
  }, origin);
  await expect(page.locator('body')).toHaveAttribute('data-view', 'player');
  const position = await page.evaluate(() => {
    const b = document.getElementById('mv-toolbar').getBoundingClientRect();
    const c = document.getElementById('mv-container').getBoundingClientRect();
    return { basBarre: Math.round(b.bottom), basLecteur: Math.round(c.bottom), hautBarre: Math.round(b.top), milieu: Math.round(c.top + c.height / 2) };
  });
  expect(Math.abs(position.basBarre - position.basLecteur), 'la barre est au bas du lecteur').toBeLessThanOrEqual(2);
  expect(position.hautBarre, 'dans sa moitié basse').toBeGreaterThan(position.milieu);
  await expect(page.locator('#mv-toolbar .mv-chip.actif .mv-chip-nom'), 'la vidéo choisie, en titre').toHaveText('Match A');

  // Au repos, elle s'efface avec les en-têtes.
  await page.waitForTimeout(3400);
  await expect(page.locator('#mv-toolbar')).toHaveClass(/mv-cachee/);
  await page.evaluate(() => document.body.focus());

  // La première touche ne fait que la ramener, focus sur ⏭.
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#mv-toolbar')).not.toHaveClass(/mv-cachee/);
  expect(await page.evaluate(() => document.activeElement.id), 'focus sur la source suivante').toBe('mv-src-next');
  // La suivante agit : ⏭ passe à la source suivante de la vidéo active (ici aucune autre).
  await page.keyboard.press('Enter');
  await expect(page.locator('#toast')).toHaveClass(/show/);

  // Le match regardé suit la tuile active.
  await page.evaluate(() => window.focusStream(1));
  await expect(page.locator('#mv-toolbar .mv-chip.actif .mv-chip-nom')).toHaveText('Match B');
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* « Dans multiview, un coup de la manette bouge de deux boutons » (25 octobre 2026, à la
   télécommande du Chromecast). Le menu du lecteur passait à l'entrée suivante, puis la
   navigation aux flèches repartait de celle-là ; OK sur un titre de section le repliait,
   puis le cliquait, qui le rouvrait. Une touche déjà traitée ne l'est plus deux fois. */
test('à la télécommande, une touche fait un pas : menu du lecteur, titre de section', async ({ page }) => {
  const pageErrors = await bootOffline(page);
  await page.evaluate(() => window.activerNavigationManette());
  await page.waitForFunction(() => typeof window.__tvNavigationCleanup === 'function');

  const titre = page.locator('#marea .section-title[role="button"]').first();
  await titre.focus();
  const avant = await titre.getAttribute('aria-expanded');
  await page.keyboard.press('Enter');
  expect(await titre.getAttribute('aria-expanded'), 'OK replie la section, une fois').not.toBe(avant);

  // Chargée deux fois (mode TV, puis la télé Android), elle ne fait toujours qu'un pas.
  await page.evaluate(() => {
    const s = document.createElement('script');
    s.src = 'js/tv-navigation.js';
    document.body.appendChild(s);
    return new Promise((ok) => { s.onload = ok; });
  });

  await page.evaluate((o) => {
    window.addToMultivision(o.replace('127.0.0.1', 'localhost') + '/__lecteur-calme?a', 'Match A', 'mA');
    window.openMultiviewTab();
  }, origin);
  await expect(page.locator('body')).toHaveAttribute('data-view', 'player');
  await page.locator('#mv-more-btn').click();
  const entrees = page.locator('.mv-menu .mv-menu-item:not([disabled])');
  await expect(entrees.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(entrees.nth(1), 'une flèche, une entrée plus bas').toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(entrees.first(), 'et une plus haut').toBeFocused();
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* « Refondre les menus, surtout dans le multiview, pour qqchose de moderne et moins all
   over the place » (25 octobre 2026). Une seule barre : les vidéos (une pastille chacune),
   les gestes de la vidéo choisie, ceux du lecteur. Les en-têtes de tuile ne gardent que le
   nom, la source, le menu et la croix, et la télécommande ne va plus les chercher. */
test('le lecteur n\'a qu\'une barre : les vidéos, la vidéo choisie, le lecteur ; la télécommande y reste', async ({ page }) => {
  const pageErrors = await bootOffline(page);
  await page.evaluate(() => window.activerNavigationManette());
  await page.waitForFunction(() => typeof window.__tvNavigationCleanup === 'function');
  await page.evaluate((o) => {
    ['A', 'B', 'C'].forEach((n) => window.addToMultivision(o.replace('127.0.0.1', 'localhost') + '/__lecteur-calme?' + n, 'Match ' + n, 'm' + n));
    if (document.body.getAttribute('data-view') !== 'player') window.openMultiviewTab();
    window.focusStream(0);
  }, origin);
  await expect(page.locator('body')).toHaveAttribute('data-view', 'player');
  await expect(page.locator('.mv-cell')).toHaveCount(3);

  /* « Faudrait que le Lecteur soit un onglet comme les autres ; il surplombe le reste » :
     dans le flux, sous l'en-tête, jusqu'au bas de la fenêtre, comme une page. */
  const place = await page.evaluate(() => {
    const c = document.getElementById('mv-container');
    const r = c.getBoundingClientRect();
    return { position: getComputedStyle(c).position, haut: Math.round(r.top), bas: Math.round(r.bottom), entete: Math.round(document.getElementById('app-header').getBoundingClientRect().bottom), vh: innerHeight };
  });
  expect(place.position, 'pas une couche fixée par-dessus la page').not.toBe('fixed');
  expect(place.haut, 'sous l\'en-tête').toBe(place.entete);
  expect(place.bas, 'jusqu\'au bas de la fenêtre').toBe(place.vh);

  /* Les tuiles : leur numéro et la croix ; ni nom, ni source, ni ⋮ (dans la barre : « pas
     de doublon de menu dans le haut du multiview ; même chose pour le titre »), ni ⏭, ni
     ▶ direct, ni cadrage, ni Site. */
  expect(await page.locator('.mv-cell .mv-next-source, .mv-cell .mv-direct-btn, .mv-cell .mv-fit-btn, .mv-cell .mv-site-btn, .mv-cell .mv-tile-menu-btn, .mv-cell .mv-tile-name, .mv-cell .mv-source-pill').count()).toBe(0);
  await expect(page.locator('.mv-cell .mv-stream-number')).toHaveText(['1', '2', '3']);
  expect(await page.evaluate(() => [...document.querySelectorAll('.mv-cell .mv-hdr button, .mv-cell .mv-hdr [role="button"]')].every((b) => b.getAttribute('tabindex') === '-1')),
    'leurs boutons sont pour la souris et le doigt').toBe(true);

  // Les vidéos : une pastille chacune ; la choisie porte son nom, les autres leur numéro.
  const pastilles = page.locator('#mv-bar-videos .mv-chip');
  await expect(pastilles).toHaveCount(3);
  await expect(pastilles.nth(0)).toHaveClass(/actif/);
  await expect(pastilles.nth(0).locator('.mv-chip-nom')).toBeVisible();
  await expect(pastilles.nth(1).locator('.mv-chip-nom'), 'à partir de trois, les autres ne gardent que leur numéro').toBeHidden();

  // À la télécommande : ◀ depuis ⏭ mène aux pastilles, OK choisit la vidéo.
  await page.evaluate(() => document.getElementById('mv-src-next').focus());
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('mv-src-prev');
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => document.activeElement.getAttribute('data-idx')), 'la dernière pastille').toBe('2');
  await page.keyboard.press('Enter');
  await expect(pastilles.nth(2), 'OK choisit la vidéo 3').toHaveClass(/actif/);
  await expect(pastilles.nth(2), 'et le focus reste sur sa pastille').toBeFocused();
  // ▲ ne part jamais dans une tuile.
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(() => !!document.activeElement.closest('.mv-cell')), 'pas dans une tuile').toBe(false);

  // ⋮ de la barre : le menu de la vidéo choisie, qui dit son nom.
  await page.evaluate(() => window.resetMvIdleTimer());
  await page.locator('#mv-bar-video-menu').click();
  await expect(page.locator('.mv-menu .mv-menu-entete')).toHaveText('Match C');
  await expect(page.locator('.mv-menu .mv-menu-item', { hasText: 'Ouvrir sur le site' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  /* ⚙ Réglages : mode câble, son automatique, redirections, et Disposition en sous-menu,
     qu'on atteint à la télécommande (↓ puis OK). */
  await page.locator('#mv-more-btn').click();
  await expect(page.locator('.mv-menu .mv-menu-entete')).toHaveText('Réglages du lecteur');
  for (const l of ['Disposition', 'Mode câble', 'Son automatique', 'Bloquer les redirections']) {
    await expect(page.locator('.mv-menu .mv-menu-item', { hasText: l })).toHaveCount(1);
  }
  await page.locator('.mv-menu .mv-menu-item', { hasText: 'Disposition' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.mv-menu .mv-menu-entete')).toHaveText('Disposition des vidéos');
  await expect.poll(() => page.evaluate(() => !!document.activeElement.closest('.mv-menu')), { message: 'le focus entre dans le sous-menu' }).toBe(true);
  await page.keyboard.press('Escape');
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* « La manette suit pas dans les modals », « après toast et sortie du multiview, plus de
   manette » (25 octobre 2026, sur le Chromecast). La navigation aux flèches reste dans la
   fenêtre ouverte et y prend le focus, B la ferme et rend le focus où il était ; un focus
   resté sur un bouton du lecteur caché repart de la page ; ◀ ▶ change une liste. */
test('à la manette : les fenêtres gardent le focus, B les ferme, et la page reprend après le lecteur', async ({ page }) => {
  await page.addInitScript(() => {
    const pad = { index: 0, id: 'Manette de test', connected: true, mapping: 'standard', timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
    window.__manette = {
      appuyer(i) { pad.buttons[i] = { pressed: true, touched: true, value: 1 }; },
      relacher(i) { pad.buttons[i] = { pressed: false, touched: false, value: 0 }; }
    };
    Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => [pad, null, null, null] });
  });
  const pageErrors = await bootOffline(page);
  const presser = async (b) => {
    await page.evaluate((i) => window.__manette.appuyer(i), b);
    await page.waitForTimeout(250);
    await page.evaluate((i) => window.__manette.relacher(i), b);
    await page.waitForTimeout(150);
  };
  const HAUT = 12, BAS = 13, DROITE = 15, A = 0, B = 1, START = 9;
  const focusDans = (sel) => page.evaluate((s) => { const z = document.querySelector(s); return !!(z && z.contains(document.activeElement)); }, sel);

  await presser(BAS);
  await expect(page.locator('#tv-nav-script')).toHaveCount(1);

  /* La fiche d'un match : le focus y entre, sur « ▶ Regarder » (comme le bouton Lecture
     de Netflix), et n'en sort pas ; B la ferme et le rend. */
  await page.evaluate(() => document.getElementById('filter-live').focus());
  await page.evaluate(() => window.openMod(window.S.matches.find((m) => (m.streamLinks || []).length) || window.S.matches[0]));
  await expect(page.locator('#mbg')).toHaveClass(/open/);
  await expect.poll(() => focusDans('#mbg'), { message: 'le focus entre dans la fiche' }).toBe(true);
  await expect.poll(() => page.evaluate(() => document.activeElement.className), { message: 'sur « ▶ Regarder »' }).toContain('btn-regarder');
  for (const b of [BAS, BAS, HAUT, BAS]) {
    await presser(b);
    expect(await focusDans('#mbg'), 'et n\'en sort pas').toBe(true);
  }
  await presser(B);
  await expect(page.locator('#mbg')).not.toHaveClass(/open/);
  await expect.poll(() => page.evaluate(() => document.activeElement.id), { message: 'le focus revient où il était' }).toBe('filter-live');

  // Le guide des scripts : même chose, et B le ferme.
  await page.evaluate(() => window.installTampermonkey());
  await expect.poll(() => focusDans('#tm-modal')).toBe(true);
  await presser(BAS);
  expect(await focusDans('#tm-modal')).toBe(true);
  await presser(B);
  await expect(page.locator('#tm-modal')).toHaveCount(0);

  // Le lecteur, quitté avec le focus sur un de ses boutons : la page reprend la main.
  await presser(START);
  await expect(page.locator('body')).toHaveAttribute('data-view', 'player');
  await page.evaluate(() => document.querySelector('#mv-container button').focus());
  await presser(B);
  await expect(page.locator('body')).toHaveAttribute('data-view', 'live');
  await presser(A);
  await presser(BAS);
  const apres = await page.evaluate(() => {
    const el = document.activeElement;
    return { visible: !!(el && el !== document.body && el.getClientRects().length), dansLecteur: !!(el && el.closest('#mv-container')) };
  });
  expect(apres, 'le focus repart d\'un élément visible de la page').toEqual({ visible: true, dansLecteur: false });

  // Une liste : ◀ ▶ change le choix (la taille de l'interface).
  await page.evaluate(() => window.applyFilter('options'));
  await page.evaluate(() => document.getElementById('pref-zoom-tv').focus());
  await presser(DROITE);
  expect(await page.evaluate(() => ({ choix: document.getElementById('pref-zoom-tv').value, garde: localStorage.getItem('zoom_tv') }))).toEqual({ choix: '50', garde: '50' });

  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* « garder vieux guide plutôt que nouveau » (13 octobre 2026). Au premier lancement sans
   protection, la fenêtre du début montre l'ancien guide (Firefox recommandé, uBlock
   Origin, Tampermonkey, le script), le même que la page Plus → 🧩 Script, une seule fois.
   Depuis le 25 octobre 2026 (« les mêmes fonctions sur Firefox et Chrome »), il mène aussi
   Chrome à l'extension : le bouton du panneau Chrome télécharge le zip sans fermer la
   fenêtre. */
test('la fenêtre du début montre l\'ancien guide des scripts, une seule fois', async ({ page }) => {
  const pageErrors = await bootOffline(page);
  /* bootOffline pose « 2 » à chaque chargement ; on l'efface au seul suivant. */
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('premierLancement')) { sessionStorage.setItem('premierLancement', '1'); localStorage.removeItem('hasSeenScriptModal'); }
    } catch (e) {}
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const fenetre = page.locator('#tm-modal');
  await expect(fenetre).toBeVisible({ timeout: 15000 });
  await expect(fenetre).toContainText('Installation des Scripts');
  await expect(fenetre).toContainText('Recommandation : Firefox + uBlock Origin');
  await expect(fenetre).toContainText('Étape 2 : le gestionnaire de scripts (Tampermonkey)');
  await expect(fenetre.locator('a', { hasText: 'Installer le script' })).toHaveAttribute('href', /multiview-cleaner\.user\.js$/);
  await expect(fenetre).toContainText('Charger l\'extension non empaquetée');
  const [zip] = await Promise.all([
    page.waitForEvent('download'),
    fenetre.locator('button', { hasText: 'Télécharger l\'extension' }).click()
  ]);
  expect(zip.suggestedFilename()).toBe('guide-des-sports-extension-' + JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'manifest.json'), 'utf8')).version + '.zip');
  const octets = fs.readFileSync(await zip.path());
  expect(octets.subarray(0, 4).toString('hex'), 'un zip').toBe('504b0304');
  expect(octets.length).toBeGreaterThan(fs.statSync(path.join(ROOT, 'extension', 'regles', 'blocage.json')).size);
  await expect(fenetre, 'le téléchargement ne ferme pas la fenêtre').toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hasSeenScriptModal'))).toBe('true');

  // Une seule fois : au chargement suivant, elle ne revient pas.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.hasLoadedOnce === true, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await expect(page.locator('#tm-modal')).toHaveCount(0);

  // Et Plus → 🧩 Script dit la même chose.
  await page.evaluate(() => window.applyFilter('script'));
  await expect(page.locator('#guide-installation')).toContainText('Étape 3 : le script de nettoyage');

  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* « Stockage local ❌ 1 écriture(s) refusée(s) · QuotaExceededError · 4569 Ko » (Logs,
   Firefox, 18 octobre 2026). Le calendrier du jour avec ses liens, celui d'hier autant,
   les matchs du dernier scraping et le cache des liens remplissaient le stockage : une
   écriture refusée, c'est un réglage, un favori ou l'état du lecteur qui ne prend pas.
   Ici le VRAI quota du navigateur, rempli de caches refaisables avant le démarrage :
   l'application doit écrire son calendrier en les vidant, sans toucher aux favoris, et
   retirer les liens du calendrier d'hier. Sans la correction, le calendrier du jour est
   refusé et la ligne « Stockage local » est rouge. */
test('stockage plein : les caches refaisables partent, les favoris restent, hier perd ses liens', async ({ page }) => {
  const cal = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'schedule.json'), 'utf8'));
  const [, a, m, j] = String(cal.fetchDate).match(/^(\d{4})(\d{2})(\d{2})$/);
  const hier = new Date(Date.UTC(+a, +m - 1, +j - 1)).toISOString().slice(0, 10).replace(/-/g, '');
  await page.goto(origin + '/manifest.json');
  await page.evaluate((hier) => {
    localStorage.clear();
    localStorage.setItem('fav_teams', JSON.stringify(['Canadiens de Montréal']));
    const lien = { name: 'Sky Sports', url: 'https://exemple.test/watch.php?id=38', source: 'daddylive', site: 'exemple.test' };
    localStorage.setItem('api_calendar_cache_' + hier, JSON.stringify({ fetchDate: hier, savedAt: 1, matches: [
      { id: 'h1', homeTeam: 'Canadiens', awayTeam: 'Bruins', matchDate: 'x', startTime: '19:00', streamLinks: Array(200).fill(lien), streamsLoaded: true }] }));
    localStorage.setItem('last_scraped_matches', 'x'.repeat(200000));
    /* Le reste du quota : le plus gros bloc qui passe encore, puis de plus en plus petits. */
    let bloc = 1 << 22;
    while (bloc >= 64) {
      try { localStorage.setItem('stream_cache', (localStorage.getItem('stream_cache') || '') + 'x'.repeat(bloc)); }
      catch (e) { bloc >>= 1; }
    }
  }, hier);
  const pageErrors = await bootOffline(page);
  const etat = await page.evaluate((hier) => ({
    info: window.stockageInfo || null,
    fav: localStorage.getItem('fav_teams'),
    jour: Object.keys(localStorage).filter((k) => k.startsWith('api_calendar_cache_') && !k.endsWith(hier)),
    hier: JSON.parse(localStorage.getItem('api_calendar_cache_' + hier) || 'null')
  }), hier);
  expect(etat.info && etat.info.liberees, 'des caches ont été vidés pour faire de la place').toContain('stream_cache');
  expect(etat.info.echecs, 'aucune écriture refusée').toBe(0);
  expect(etat.fav, 'les favoris restent').toBe(JSON.stringify(['Canadiens de Montréal']));
  expect(etat.jour.length, 'le calendrier du jour est écrit').toBe(1);
  expect(etat.hier && etat.hier.matches.length, 'hier garde ses matchs').toBe(1);
  expect(etat.hier.matches[0].streamLinks, 'mais plus ses liens').toEqual([]);
  await page.evaluate(() => window.applyFilter('logs'));
  const appareil = page.locator('#sources-status-container');
  await expect(appareil).toContainText('caches vidés pour faire de la place : stream_cache');
  await expect(appareil).not.toContainText('écriture(s) refusée(s)');
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

/* « Ça redirige encore contre mon gré sans intervention de ma part » (18 octobre 2026, le
   soir) : page quittée moins d'une seconde après la pose des vidéos, retour sur l'appli
   cinq secondes plus tard. La page d'une vidéo qui appelle `history.back()` recule tout
   l'onglet, sans clic ; le script 1.17 le bloque dans le cadre, mais seulement une fois mis
   à jour. Le tampon d'historique (js/tampon.js) l'absorbe dans l'application, quel que soit
   le script. Différentiel : garde coupée, donc sans tampon, l'onglet recule. */
test('une vidéo qui fait reculer l\'onglet est absorbée par le tampon, sans dialogue', async ({ page }) => {
  const pageErrors = await bootOffline(page);
  const autreOrigine = origin.replace('127.0.0.1', 'localhost');
  await page.route(autreOrigine + '/**', (route) => route.continue());
  const dialogues = [];
  page.on('dialog', (d) => { dialogues.push(d.type()); d.dismiss().catch(() => {}); });
  const app = page.url();

  await page.evaluate((u) => window.addToMultivision(u, 'Match qui recule', 'mR'), autreOrigine + '/__lecteur-recul');
  await expect(page.frameLocator('.mv-cell iframe.mv-iframe').locator('#b')).toBeVisible();
  await page.waitForTimeout(1200);
  expect(page.url(), 'l\'onglet reste sur l\'application').toBe(app);
  await expect(page.locator('.mv-cell'), 'avec sa vidéo').toHaveCount(1);
  expect(dialogues, 'sans « Quitter le site ? »').toEqual([]);
  expect(await page.evaluate(() => history.state), 'le tampon est reposé').toEqual({ mvTampon: 1 });
  const releve = await page.evaluate(() => JSON.parse(localStorage.getItem('journal_sorties') || '[]'));
  expect(releve[0], 'le recul bloqué est noté').toMatchObject({ type: 'bloque', sites: ['localhost'] });
  await page.evaluate(() => window.applyFilter('logs'));
  await expect(page.locator('.diag-sorties')).toContainText('recul de l\'onglet demandé par une vidéo · bloqué');
  expect(pageErrors).toEqual([]);
});

test('sans tampon (garde coupée), la même vidéo fait reculer l\'onglet : le test a un sens', async ({ page }) => {
  await bootOffline(page);
  const autreOrigine = origin.replace('127.0.0.1', 'localhost');
  await page.route(autreOrigine + '/**', (route) => route.continue());
  await page.evaluate(() => window.toggleGardeSortie());
  const parti = page.waitForEvent('framenavigated', { predicate: (f) => f === page.mainFrame(), timeout: 8000 }).catch(() => null);
  await page.evaluate((u) => window.addToMultivision(u, 'Match qui recule', 'mR'), autreOrigine + '/__lecteur-recul');
  const nav = await parti;
  expect(nav && !nav.url().startsWith(origin), 'l\'onglet a reculé hors de l\'application').toBeTruthy();
});

/* Le tampon ne piège pas l'utilisateur : quand il recule lui-même (bouton ← du navigateur,
   le pointeur sorti par le haut ; ou le bouton Précédent de la souris), l'onglet recule
   d'un cran de plus, sans dialogue. */
for (const [nom, signe] of [
  ['bouton ← du navigateur', (p) => p.evaluate(() => document.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, clientX: 300, clientY: 0, relatedTarget: null })))],
  ['bouton Précédent de la souris', (p) => p.evaluate(() => document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 3, clientX: 300, clientY: 300 })))],
  ['balayage du pavé tactile', (p) => p.evaluate(() => document.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaX: -120, deltaY: 0 })))]
]) {
  test('reculer soi-même passe le tampon : ' + nom, async ({ page }) => {
    const pageErrors = await bootOffline(page);
    const autreOrigine = origin.replace('127.0.0.1', 'localhost');
    await page.route(autreOrigine + '/**', (route) => route.continue());
    const dialogues = [];
    page.on('dialog', (d) => { dialogues.push(d.type()); d.dismiss().catch(() => {}); });
    await page.evaluate((u) => window.addToMultivision(u, 'Match calme', 'mC'), autreOrigine + '/__lecteur-calme');
    await expect(page.frameLocator('.mv-cell iframe.mv-iframe').locator('#b')).toBeVisible();
    expect(await page.evaluate(() => history.state), 'tampon posé').toEqual({ mvTampon: 1 });
    expect(pageErrors).toEqual([]);
    await signe(page);
    const parti = page.waitForEvent('framenavigated', { predicate: (f) => f === page.mainFrame() && !f.url().startsWith(origin), timeout: 8000 }).catch(() => null);
    await page.evaluate(() => history.back());
    expect(await parti, 'l\'onglet recule hors de l\'application').toBeTruthy();
    expect(dialogues, 'sans dialogue').toEqual([]);
  });
}

/* « Le direct marche jamais » (18 octobre 2026). Relus le soir même depuis un autre réseau,
   7 manifestes du cache sur 39 répondaient ; celui de bintv-sources ne sert qu'une fois
   (404 une seconde après son lecteur). Le bouton ▶ direct s'affichait pour tous. Il n'est
   plus montré qu'après avoir lu le manifeste depuis ce navigateur. */
test('▶ direct ne s\'affiche que pour un flux qui répond d\'ici', async ({ page }) => {
  const pageErrors = await bootOffline(page);
  const autreOrigine = origin.replace('127.0.0.1', 'localhost');
  await page.route(autreOrigine + '/**', (route) => route.continue());
  const tuiles = { ok: autreOrigine + '/__lecteur-calme?d=ok', mort: autreOrigine + '/__lecteur-calme?d=mort' };
  await page.evaluate(([t, o]) => {
    const reg = {};
    reg[t.ok] = { url: o + '/__manifeste-ok.m3u8', pageUrl: t.ok, at: Date.now(), echecs: 0 };
    reg[t.mort] = { url: o + '/__manifeste-mort.m3u8', pageUrl: t.mort, at: Date.now(), echecs: 0 };
    localStorage.setItem('direct_media', JSON.stringify(reg));
    window.addToMultivision(t.ok, 'Match qui répond', 'mOk');
    window.addToMultivision(t.mort, 'Match mort', 'mMort');
  }, [tuiles, autreOrigine]);
  await expect(page.locator('.mv-cell')).toHaveCount(2);
  /* ▶ Direct est dans la barre, pour la vidéo choisie ; les deux sondes partent dès la
     pose des tuiles. */
  const bouton = page.locator('#mv-bar-direct');
  await page.evaluate(() => window.focusStream(0));
  await expect(bouton, 'le flux qui répond : ▶ Direct').toBeVisible({ timeout: 10000 });
  await page.evaluate(() => window.focusStream(1));
  await expect(bouton, 'le flux mort : pas de bouton').toBeHidden();
  await page.waitForTimeout(500);
  await expect(bouton, 'même après la sonde').toBeHidden();
  await page.evaluate(() => window.focusStream(0));
  await expect(bouton, 'et il revient avec la vidéo qui répond').toBeVisible();
  await page.evaluate(() => window.applyFilter('logs'));
  await expect(page.locator('#sources-status-container')).toContainText('1 sur 2 répondent · refusés : 1 × HTTP 404');
  expect(pageErrors).toEqual([]);
});

/* « La manette devrait ignorer certains éléments ; quand modal, back ramène à l'entrée ;
   juste la carte doit être cliquable, pas le chiffre » (25 octobre 2026, au Chromecast).
   À la télécommande, une carte est un seul arrêt (ni « ▶ 105 », ni ★) ; dans la fiche, un
   flux aussi (OK le lance) ; et Retour rend le focus à la carte même si la grille s'est
   redessinée pendant que la fiche était ouverte — avant, la flèche suivante repartait de
   la barre du haut. Et « Guide par défaut : Chaînes ». */
test('à la télécommande, la carte est un seul arrêt, et Retour depuis la fiche y revient', async ({ page }) => {
  const pageErrors = await bootOffline(page);
  await page.evaluate(() => window.activerNavigationManette());
  await page.waitForFunction(() => typeof window.__tvNavigationCleanup === 'function');
  const carte = await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll('#marea .match-card')).find((x) => x.querySelector('.card-streams') && x.getClientRects().length);
    c.focus();
    return c.id;
  });
  for (const touche of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) {
    await page.keyboard.press(touche);
    const dansCarte = await page.evaluate(() => {
      const el = document.activeElement;
      return !!(el && el.parentElement && el.parentElement.closest('.match-card, .mb, [data-mid]'));
    });
    expect(dansCarte, touche + ' : jamais un élément à l\'intérieur d\'une carte').toBe(false);
  }

  // OK sur la carte : la fiche, focus sur « ▶ Regarder » ; ↓ parcourt les flux, sans leurs petits boutons.
  await page.evaluate((id) => document.getElementById(id).focus(), carte);
  await page.keyboard.press('Enter');
  await expect(page.locator('#mbg')).toHaveClass(/open/);
  await expect.poll(() => page.evaluate(() => document.activeElement.className)).toContain('btn-regarder');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press(i % 2 ? 'ArrowRight' : 'ArrowDown');
    expect(await page.evaluate(() => document.activeElement.matches('.si-btn, .fb-fav')), 'ni ⭐ 👎 ⊞, ni ★').toBe(false);
  }

  // La grille se redessine pendant que la fiche est ouverte, puis Retour.
  await page.evaluate(() => window.buildEPG(window.S.matches));
  expect(await page.evaluate(() => window.retourTele())).toBe(true);
  await expect(page.locator('#mbg')).not.toHaveClass(/open/);
  await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id), { message: 'le focus revient à la carte, pas en haut' }).toBe(carte);
  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => !!document.activeElement.closest('#nav-links')), 'la flèche suivante reste dans la grille').toBe(false);

  // Le Guide s'ouvre sur « Chaînes ».
  await page.evaluate(() => window.applyFilter('all'));
  await expect(page.locator('#marea .dsp-chaines')).toHaveCount(1);
  expect(await page.evaluate(() => document.getElementById('pref-disposition-guide').value)).toBe('chaines');
  expect(pageErrors, 'aucune exception :\n' + pageErrors.join('\n---\n')).toEqual([]);
});

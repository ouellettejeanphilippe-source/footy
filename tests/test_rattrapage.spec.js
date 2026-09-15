/* Quand le serveur se tait : le bandeau et le rattrapage, dans un vrai navigateur.

   Panne du 10 au 12 septembre 2026 : le workflow des liens est mort pendant 45 heures.
   L'application a servi les liens de l'avant-veille tout ce temps SANS RIEN DIRE — elle
   connaissait pourtant l'âge du cache (`prefetchedStreamsInfo.ageMin`), et l'écran
   Journaux l'affichait en vert — et sans rien chercher elle-même : entre 90 minutes et
   trois heures de cache, elle ne relit ni les pages de liste ni les pages de match.

   Ce test tient ce trou-là, celui de 2 h de cache, parce que c'est le seul où RIEN
   d'autre ne bouge : le repli sur les sources ne part qu'à trois heures (`prefetchUsable`,
   js/main.js), donc toute page de match lue ici vient du rattrapage et de lui seul.

   Tout le réseau sortant est coupé. Le calendrier, les liens et les pages de match sont
   des gabarits servis par le serveur local — pas par `page.route`, qui n'intercepte pas
   les requêtes du service worker : la première version de ce test croyait servir un cache
   de deux heures et l'application lisait le vrai `data/streams.json` du dépôt, par le
   service worker, sans que rien ne le signale. Aucun site tiers, aucune horloge réelle,
   donc aucune instabilité possible. */
import { test, expect } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

/* Ce que le serveur local sert en ce moment, et ce qu'on lui a demandé. Les tests d'un
   même fichier s'exécutent l'un après l'autre : un seul jeu suffit, posé par `demarrer`. */
const etat = { cal: null, flux: null, pagesLues: [] };

let server;
let origin;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://local');
    if (u.pathname === '/data/schedule.json' || u.pathname === '/data/streams.json') {
      const corps = u.pathname.indexOf('schedule') > -1 ? etat.cal : etat.flux;
      res.writeHead(corps ? 200 : 503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(corps || { error: 'gabarit absent' }));
    }
    if (u.pathname === '/__match') {
      const cle = u.searchParams.get('n');
      etat.pagesLues.push(cle);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(pageDeMatch(cle));
    }
    let rel = decodeURIComponent(u.pathname);
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

/* 20 h à New York, un jour fixe : l'heure de l'application est gelée là, et les gabarits
   sont datés du même jour. Rien ne dépend donc du moment où la suite tourne. */
const INSTANT = Date.parse('2026-09-15T20:00:00-04:00');
const JOUR = '2026-09-15';
const JOUR_COMPACT = '20260915';

/* L'heure de coup d'envoi d'un match commencé il y a `ilYA` minutes (ou à venir dans
   `-ilYA`), en heure de New York, puisque c'est le seul fuseau de l'application. */
function heure(ilYA) {
  const mn = 20 * 60 - ilYA;
  return String(Math.floor(mn / 60)).padStart(2, '0') + ':' + String(mn % 60).padStart(2, '0');
}

/* Les neuf matchs du gabarit. `ilYA` est la minute du coup d'envoi relative à l'instant
   gelé ; `liens` dit si le cache serveur porte déjà un lecteur pour ce match.

   Six matchs en direct sans aucun lien, alors que le rattrapage s'en autorise quatre sans
   le script utilisateur : c'est la borne qu'on veut voir tenir. Un téléphone qui partirait
   sur les six cents pages de match par proxy public serait pire que de ne rien faire.

   L'ORDRE DE CETTE LISTE EST VOLONTAIREMENT MÊLÉ. Une première version la donnait dans
   l'ordre d'urgence : les identifiants suivaient donc le même ordre, et l'assertion sur
   les quatre pages lues passait même après avoir retiré le tri par proximité du coup
   d'envoi — elle ne vérifiait que « les quatre premiers de la liste ». Mêlée, elle
   distingue l'urgence de l'ordre d'arrivée des données. */
const GABARIT = [
  { cle: 'live05', dom: 'Kilo Olympic', ext: 'Lima Victoria', ilYA: 5, statut: 'live', liens: false },
  { cle: 'live20', dom: 'Golf Rangers', ext: 'Hotel Albion', ilYA: 20, statut: 'live', liens: false },
  { cle: 'fini', dom: 'Oscar Crusaders', ext: 'Papa Rangers', ilYA: 200, statut: 'finished', liens: false },
  { cle: 'live50', dom: 'Alpha United', ext: 'Bravo City', ilYA: 50, statut: 'live', liens: false },
  { cle: 'ceSoir', dom: 'Quebec Sounders', ext: 'Romeo Whitecaps', ilYA: -180, statut: 'upcoming', liens: false },
  { cle: 'live30', dom: 'Echo Athletic', ext: 'Foxtrot Wanderers', ilYA: 30, statut: 'live', liens: false },
  { cle: 'pourvu', dom: 'Mike Galaxy', ext: 'November Union', ilYA: 45, statut: 'live', liens: true },
  { cle: 'live10', dom: 'India Dynamo', ext: 'Juliett Sporting', ilYA: 10, statut: 'live', liens: false },
  { cle: 'live40', dom: 'Charlie Town', ext: 'Delta Rovers', ilYA: 40, statut: 'live', liens: false }
];

/* Le calendrier (data/schedule.json) fait les cartes ; les liens (data/streams.json) ne
   font que s'y attacher. Un flux sans match au calendrier ne crée AUCUNE carte
   (mergeFluxToApi, js/api.js), donc le gabarit doit servir les deux faces. */
function calendrier() {
  return {
    fetchDate: JOUR_COMPACT,
    matches: GABARIT.map((g, i) => ({
      id: 'gab_' + i, league: 'MLS', flag: '⚽', color: '#3a3',
      homeTeam: g.dom, awayTeam: g.ext,
      matchDate: JOUR, startTime: heure(g.ilYA), durationMinutes: 180,
      status: g.statut, source: 'api'
    }))
  };
}

function liens(ageMin) {
  return {
    generatedAt: new Date(INSTANT - ageMin * 60000).toISOString(),
    date: JOUR,
    sources: [], hostPolicy: {}, hostPlay: {},
    matches: GABARIT.map((g) => ({
      source: 'footybite', league: 'MLS',
      homeTeam: g.dom, awayTeam: g.ext,
      startTime: heure(g.ilYA), matchDate: JOUR, status: g.statut,
      durationMinutes: 180,
      matchUrl: origin + '/__match?n=' + g.cle,
      altUrls: [],
      streamLinks: g.liens ? [{ name: 'Serveur 1', url: 'https://lecteur-du-cache.test/embed/' + g.cle, site: 'lecteur-du-cache.test', source: 'footybite' }] : []
    }))
  };
}

/* Une fausse page de match : le lecteur y est posé en iframe, comme sur les vraies. Le
   remplissage porte la page au-delà des 200 caractères en dessous desquels `fetchPage`
   considère une réponse comme vide (un stub de proxy). */
function pageDeMatch(cle) {
  return '<!doctype html><html><head><title>' + cle + '</title></head><body>'
    + '<h1>Live stream</h1>'
    + '<iframe src="https://lecteur-' + cle + '.test/embed/1" width="640" height="360" allowfullscreen></iframe>'
    + '<p>' + 'Regardez le match en direct. '.repeat(10) + '</p>'
    + '</body></html>';
}

/* Démarre l'application avec un cache serveur vieux de `ageMin` minutes. Rend la liste
   des pages de match réellement téléchargées, dans l'ordre, et les exceptions de page. */
async function demarrer(page, ageMin, options) {
  const opts = options || {};
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));

  etat.cal = calendrier();
  etat.flux = opts.liens ? opts.liens(ageMin) : liens(ageMin);
  etat.pagesLues.length = 0;

  await page.clock.setFixedTime(INSTANT);
  // La fenêtre « Installer le script » du premier chargement recouvrirait le bandeau.
  await page.addInitScript(() => { try { localStorage.setItem('hasSeenScriptModal', 'true'); } catch (e) {} });
  // Rien de ce qui n'est pas servi ici ne passe : ni ESPN, ni proxy CORS, ni site source.
  await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));

  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.hasLoadedOnce === true, null, { timeout: 60000 });
  return { pagesLues: etat.pagesLues, erreurs };
}

const etatBandeau = (page) => page.evaluate(() => {
  const el = document.getElementById('bandeau-cache');
  if (!el) return null;
  const btn = el.querySelector('button');
  return {
    cache: !!el.hidden,
    classe: el.className,
    texte: (el.textContent || '').trim(),
    bouton: btn ? (btn.textContent || '').trim() : null,
    action: btn ? (btn.getAttribute('onclick') || '') : null
  };
});

/* ── 1. Le bandeau ────────────────────────────────────────────────────────────
   Tous les matchs du gabarit portent un lien : le rattrapage ne trouve aucune cible et
   n'écrase donc pas le texte du bandeau par son avancement. C'est l'état AU REPOS qu'on
   lit ici. */
test('le bandeau dit l\'âge du cache et propose de chercher', async ({ page }) => {
  const tousPourvus = (ageMin) => {
    const d = liens(ageMin);
    d.matches.forEach((m) => { if (!m.streamLinks.length) m.streamLinks.push({ name: 'S1', url: 'https://lecteur-du-cache.test/embed/' + m.homeTeam, site: 'lecteur-du-cache.test' }); });
    return d;
  };
  const { pagesLues, erreurs } = await demarrer(page, 120, { liens: tousPourvus });

  const perime = await etatBandeau(page);
  expect(perime, 'le bandeau #bandeau-cache doit exister dans index.html').not.toBeNull();
  expect(perime.cache, 'deux passages manqués : le bandeau se montre').toBeFalsy();
  expect(perime.texte, 'il dit l\'âge en clair, pas « 120 min »').toContain('2 h');
  expect(perime.texte, 'et ce que ça veut dire, parce que « 2 h » seul ne se décide pas').toContain('ne publie plus');
  expect(perime.classe, 'passé 90 min, c\'est l\'alerte, pas la note grise').not.toContain('vieux');
  expect(perime.bouton, 'le bouton lance la recherche directe : sinon il faut deviner qu\'« actualiser » existe ailleurs').toContain('Chercher les liens ici');
  expect(perime.action).toContain('lancerRattrapage');
  expect(await page.evaluate(() => typeof window.lancerRattrapage), 'et la fonction qu\'il appelle existe vraiment').toBe('function');
  expect(pagesLues, 'tous les matchs sont pourvus : le rattrapage comble des trous, il ne relit pas ce qui est déjà là').toEqual([]);

  /* Un seul passage manqué n'est pas une panne : on le note, en gris, sans proposer à un
     téléphone de faire le travail du serveur. */
  await page.evaluate(() => { window.prefetchedStreamsInfo.ageMin = 50; window.majBandeauCache(); });
  const vieux = await etatBandeau(page);
  expect(vieux.cache).toBeFalsy();
  expect(vieux.classe, 'sous 90 min, la note est grise').toContain('vieux');
  expect(vieux.texte).toContain('50 min');
  expect(vieux.bouton, 'à 50 min, le cache reste meilleur qu\'une lecture par proxy : on n\'offre que d\'actualiser').toContain('Actualiser');

  /* Et la gigue du cron ne se raconte pas : sous 45 minutes, rien du tout. Un bandeau
     permanent ne serait plus lu du tout le jour où il compte. */
  await page.evaluate(() => { window.prefetchedStreamsInfo.ageMin = 12; window.majBandeauCache(); });
  const frais = await etatBandeau(page);
  expect(frais.cache, 'un cache frais ne dit rien').toBeTruthy();
  expect(frais.texte).toBe('');

  expect(erreurs, 'aucune exception :\n' + erreurs.join('\n')).toEqual([]);
});

/* ── 2. Le rattrapage ─────────────────────────────────────────────────────────
   Le cœur de la demande du 12 septembre 2026 : « l'app peut pas le faire par elle-même si
   GitHub Actions bugge, c'est pas super comme workflow ». */
test('le serveur muet, l\'application lit elle-même les pages de match', async ({ page }) => {
  const { pagesLues, erreurs } = await demarrer(page, 120);

  /* Le rattrapage part après la passe de chargement, une page à la fois. */
  await page.waitForFunction(() => !!window.dernierRattrapage && !window.rattrapageEtat, null, { timeout: 60000 });

  expect(pagesLues, 'quatre pages, les plus avancées d\'abord : sans le script utilisateur '
    + 'chaque page part par un proxy public, et trente attentes en file valent moins que quatre réponses')
    .toEqual(['live50', 'live40', 'live30', 'live20']);

  const parMatch = await page.evaluate(() => {
    const par = {};
    (window.S.matches || []).forEach((m) => {
      const cle = (m.matchUrl || '').split('n=')[1];
      if (cle) par[cle] = (m.streamLinks || []).map((l) => l.url);
    });
    return par;
  });

  expect(parMatch.live50, 'le match en cours a reçu le lecteur lu sur sa page')
    .toContain('https://lecteur-live50.test/embed/1');
  expect(parMatch.live20, 'les quatre cibles sont servies, pas seulement la première')
    .toContain('https://lecteur-live20.test/embed/1');
  expect(parMatch.pourvu, 'un match déjà pourvu garde ses liens')
    .toContain('https://lecteur-du-cache.test/embed/pourvu');

  expect(erreurs, 'aucune exception :\n' + erreurs.join('\n')).toEqual([]);
});

/* ── 3. Un cache frais ne déclenche rien ──────────────────────────────────────
   La borne inverse, et la plus importante : le rattrapage doit rester exceptionnel. Un
   cache de 20 minutes est meilleur que ce qu'un téléphone lit par proxy, et une passe à
   chaque chargement ferait de chaque ouverture de l'application une rafale de requêtes
   vers des sites qui la refusent. */
test('un cache frais ne déclenche aucune lecture de page', async ({ page }) => {
  const { pagesLues, erreurs } = await demarrer(page, 20);

  const bandeau = await etatBandeau(page);
  expect(bandeau.cache, 'rien à dire à 20 minutes').toBeTruthy();

  /* Le temps que la passe aurait pris : la première page part dans la foulée de
     `hasLoadedOnce`, donc si rien n'est venu ici, rien ne viendra. */
  await page.waitForTimeout(3000);
  expect(pagesLues, 'aucune page de match lue : le cache suffit').toEqual([]);
  expect(await page.evaluate(() => !!window.dernierRattrapage), 'et aucune passe n\'a même été entamée').toBeFalsy();

  /* Le bouton du bandeau, lui, force la passe : quand l'utilisateur la demande, elle part
     quel que soit l'âge du cache. */
  await page.evaluate(() => window.lancerRattrapage(true));
  expect(pagesLues.length, 'forcée à la main, la passe lit bien les pages').toBe(4);

  expect(erreurs, 'aucune exception :\n' + erreurs.join('\n')).toEqual([]);
});

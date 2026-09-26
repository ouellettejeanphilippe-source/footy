// Guide des Sports en application de bureau.
//
// Ce que l'application de bureau remplace
// ---------------------------------------
// Le site vivait sur GitHub Pages avec deux Actions : une qui régénérait le
// calendrier du jour, une qui relisait les liens de diffusion. Sans elles, le
// calendrier embarqué périme en une journée — il est daté, et l'application
// n'affiche que les matchs du jour. L'application régénère donc le calendrier
// elle-même, au démarrage, quand celui qu'elle a n'est pas celui d'aujourd'hui
// (heure de New York, comme tout le reste de l'application).
//
// Elle fait aussi mieux que la version hébergée sur un point : les pages des
// sites agrégateurs ne s'ouvrent pas depuis un navigateur ordinaire (pas
// d'en-tête CORS), ce qui obligeait à passer par des proxys CORS publics —
// lents, souvent en panne, et qui voient tout ce qu'on demande. Ici les
// en-têtes de réponse sont complétés localement, donc les sources se lisent
// EN DIRECT, sans proxy et sans intermédiaire.
//
// Où vivent les fichiers
// ----------------------
// Le dossier embarqué dans l'exécutable est en lecture seule (sous
// « Program Files » après une installation, et dans un dossier temporaire pour
// la version portable). Or le calendrier, les liens et `domains.json` sont
// réécrits pendant l'exécution. L'application travaille donc sur une copie
// dans le profil de l'utilisateur, qu'elle rafraîchit quand une nouvelle
// version apporte du code plus récent — sans jamais écraser les données déjà
// récoltées.

const { app, BrowserWindow, Menu, shell, dialog, session, utilityProcess } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const PORT = 47821;
const HOST = '127.0.0.1';

// Le port est FIXE parce qu'il porte l'origine (http://127.0.0.1:47821) sous
// laquelle le navigateur range localStorage : équipes et ligues favorites,
// niveaux de ligue, palette, réglages du lecteur. Un port tiré au hasard
// perdrait tous les réglages à chaque lancement.

const SOURCE = app.isPackaged
  ? path.join(process.resourcesPath, 'site')
  : path.join(__dirname, '..');

// En développement on travaille directement dans le dépôt ; empaqueté, sur une
// copie inscriptible.
const RACINE = app.isPackaged
  ? path.join(app.getPath('userData'), 'site')
  : SOURCE;

// Ce que l'exécution produit, et qu'une mise à jour de l'application ne doit
// donc jamais écraser : le calendrier et les liens récoltés, et les adresses
// des sources que l'application corrige toute seule.
const VIVANT = ['data', 'domains.json'];

const TYPES = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}));

// --------------------------------------------------------------------------
// La copie inscriptible
// --------------------------------------------------------------------------

async function existe(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function preparerRacine() {
  if (!app.isPackaged) return;
  await fsp.mkdir(RACINE, { recursive: true });

  const entrees = await fsp.readdir(SOURCE, { withFileTypes: true });
  for (const e of entrees) {
    const depuis = path.join(SOURCE, e.name);
    const vers = path.join(RACINE, e.name);

    if (VIVANT.includes(e.name)) {
      // Semé une seule fois : ensuite, c'est l'exécution qui en est
      // propriétaire. Le calendrier récolté hier vaut mieux que celui, plus
      // vieux encore, qui a été empaqueté avec l'application.
      if (!(await existe(vers))) {
        await fsp.cp(depuis, vers, { recursive: true });
      }
      continue;
    }
    // Le code, lui, suit toujours l'application.
    await fsp.rm(vers, { recursive: true, force: true });
    await fsp.cp(depuis, vers, { recursive: true });
  }
}

// --------------------------------------------------------------------------
// Le serveur local
// --------------------------------------------------------------------------

function servir() {
  return new Promise((resolve, reject) => {
    const serveur = http.createServer(async (req, res) => {
      let chemin;
      try {
        chemin = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
      } catch {
        res.writeHead(400).end('Requête illisible');
        return;
      }
      if (chemin.endsWith('/')) chemin += 'index.html';

      const cible = path.join(RACINE, path.normalize(chemin));
      if (cible !== RACINE && !cible.startsWith(RACINE + path.sep)) {
        res.writeHead(403).end('Hors du dossier');
        return;
      }

      try {
        const info = await fsp.stat(cible);
        if (info.isDirectory()) {
          res.writeHead(302, { Location: chemin.replace(/\/?$/, '/') }).end();
          return;
        }
        // Les scripts utilisateur se terminent en `.user.js` : l'extension que
        // `path.extname` en tire est `.js`, ce qui donne le bon type.
        res.writeHead(200, {
          'Content-Type': TYPES.get(path.extname(cible).toLowerCase()) || 'application/octet-stream',
          'Content-Length': info.size,
          // Le calendrier et les liens sont réécrits sous l'application : un
          // cache HTTP les figerait.
          'Cache-Control': 'no-store',
        });
        fs.createReadStream(cible).pipe(res);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable : ' + chemin);
      }
    });
    serveur.once('error', reject);
    serveur.listen(PORT, HOST, () => resolve(serveur));
  });
}

// --------------------------------------------------------------------------
// Lire les sources sans proxy
// --------------------------------------------------------------------------

function leverCORS(sess) {
  const NOTRE_ORIGINE = `http://${HOST}:${PORT}`;

  // Un site agrégateur qui voit `Origin: http://127.0.0.1:47821` peut refuser
  // la requête ; sans en-tête Origin, il répond comme à une visite normale.
  sess.webRequest.onBeforeSendHeaders((details, callback) => {
    const h = { ...details.requestHeaders };
    if (!details.url.startsWith(NOTRE_ORIGINE)) {
      delete h.Origin;
      h['User-Agent'] = h['User-Agent'] ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    }
    callback({ requestHeaders: h });
  });

  // C'est ici que le proxy CORS devient inutile : la réponse d'un site tiers
  // repart vers la page avec l'autorisation que le site n'a pas donnée. Ne
  // concerne QUE les réponses venant d'ailleurs que du serveur local, dont les
  // en-têtes sont laissés intacts.
  sess.webRequest.onHeadersReceived((details, callback) => {
    if (details.url.startsWith(NOTRE_ORIGINE)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    const h = { ...details.responseHeaders };
    for (const cle of Object.keys(h)) {
      const bas = cle.toLowerCase();
      if (bas === 'access-control-allow-origin' ||
        bas === 'access-control-allow-headers' ||
        bas === 'access-control-allow-methods' ||
        bas === 'x-frame-options' || // sinon la page refuse de s'afficher dans le lecteur
        bas === 'content-security-policy' ||
        bas === 'content-security-policy-report-only') {
        delete h[cle];
      }
    }
    h['Access-Control-Allow-Origin'] = ['*'];
    h['Access-Control-Allow-Headers'] = ['*'];
    h['Access-Control-Allow-Methods'] = ['GET,POST,HEAD,OPTIONS'];
    callback({ responseHeaders: h });
  });
}

// --------------------------------------------------------------------------
// Le blocage des publicités
// --------------------------------------------------------------------------
//
// Le mode d'emploi demandait uBlock Origin dans le navigateur. Ici, l'extension
// elle-même ne peut pas servir : Electron ne met à la disposition des extensions
// qu'une petite partie des API de Chrome, et les API de blocage réseau dont
// uBlock a besoin n'en font pas partie — l'extension se charge et ne bloque
// rien.
//
// Ce qui marche, c'est de faire le blocage depuis l'application, avec LES MÊMES
// listes : EasyList, EasyPrivacy et les listes propres d'uBlock. Le moteur lit
// aussi les règles cosmétiques, donc les emplacements vides sont masqués comme
// dans un navigateur équipé.
//
// Les listes sont téléchargées au premier lancement puis gardées en cache dans
// le profil de l'utilisateur ; sans réseau, le blocage repart du cache, et
// l'application démarre quand même si les deux manquent.

async function activerBlocage(sess) {
  try {
    const { ElectronBlocker, fullLists } = require('@ghostery/adblocker-electron');
    const cache = path.join(app.getPath('userData'), 'adblocker-engine.bin');
    const blocker = await ElectronBlocker.fromLists(
      fetch,
      fullLists,
      { enableCompression: true },
      { path: cache, read: fsp.readFile, write: fsp.writeFile }
    );
    blocker.enableBlockingInSession(sess);
    return true;
  } catch (e) {
    console.error("[Guide des Sports] blocage des publicités indisponible :", e.message);
    return false;
  }
}

// --------------------------------------------------------------------------
// Le calendrier du jour
// --------------------------------------------------------------------------

function jourNewYork() {
  // Le même repère que l'application : la date à New York, en AAAAMMJJ.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${v.year}${v.month}${v.day}`;
}

async function calendrierEstDuJour() {
  try {
    const brut = await fsp.readFile(path.join(RACINE, 'data', 'schedule.json'), 'utf8');
    return JSON.parse(brut).fetchDate === jourNewYork();
  } catch {
    return false;
  }
}

// Le scraper est un module ES qui écrit `data/schedule.json` en chemin
// RELATIF : il doit tourner avec la racine du site comme dossier de travail.
function regenererCalendrier() {
  return new Promise((resolve) => {
    const script = path.join(RACINE, 'scripts', 'scrape_schedule.mjs');
    const enfant = utilityProcess.fork(script, [], {
      cwd: RACINE,
      stdio: 'pipe',
      serviceName: 'scrape-schedule',
    });
    let journal = '';
    enfant.stdout?.on('data', (d) => {
      journal += d.toString();
    });
    enfant.stderr?.on('data', (d) => {
      journal += d.toString();
    });
    enfant.on('exit', (code) => resolve({ code, journal }));
  });
}

let fenetre = null;
let scrapeEnCours = false;

async function majCalendrier({ force = false } = {}) {
  if (scrapeEnCours) return;
  if (!force && (await calendrierEstDuJour())) return;

  scrapeEnCours = true;
  fenetre?.setTitle('Guide des Sports — mise à jour du calendrier…');
  const { code, journal } = await regenererCalendrier();
  scrapeEnCours = false;
  fenetre?.setTitle('Guide des Sports');

  if (code === 0) {
    fenetre?.webContents.reload();
    return;
  }
  // ESPN injoignable : le scraper laisse le fichier précédent intact, donc
  // l'application reste utilisable avec des matchs périmés plutôt que vide.
  dialog.showMessageBox(fenetre, {
    type: 'warning',
    title: 'Calendrier non mis à jour',
    message: "Le calendrier du jour n'a pas pu être récupéré.",
    detail:
      (journal.trim().split('\n').slice(-12).join('\n') || 'Aucun détail.') +
      "\n\nL'application continue avec le calendrier précédent.",
  });
}

// --------------------------------------------------------------------------

function ouvrir() {
  fenetre = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 380,
    backgroundColor: '#0b0f14',
    title: 'Guide des Sports',
    autoHideMenuBar: true,
    webPreferences: {
      // Le script de nettoyage des lecteurs, injecté à la place de Tampermonkey.
      // Voir preload-userscript.js : c'est lui qui explique pourquoi les trois
      // réglages ci-dessous sont ce qu'ils sont.
      preload: path.join(__dirname, 'preload-userscript.js'),

      // Le script remplace `window.open`, lit `window.parent` et parle à
      // l'application par `postMessage` : il doit tourner dans le monde de la
      // page, comme sous Tampermonkey. Un monde isolé le rendrait inopérant.
      contextIsolation: false,
      sandbox: false,

      // Le nettoyeur ne travaille QUE dans les iframes des lecteurs : sans
      // ceci, le préchargement ne les atteindrait pas.
      nodeIntegrationInSubFrames: true,

      // En revanche aucune page — ni l'application, ni un site de lecteur — ne
      // reçoit Node : Electron le retire du contexte de la page dès que le
      // préchargement a fini.
      nodeIntegration: false,
    },
  });

  fenetre.loadURL(`http://${HOST}:${PORT}/`);

  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://${HOST}`)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  fenetre.on('closed', () => {
    fenetre = null;
  });
}

function menu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Guide des Sports',
        submenu: [
          { label: 'Recharger', accelerator: 'CmdOrCtrl+R', click: () => fenetre?.webContents.reload() },
          {
            label: 'Mettre à jour le calendrier maintenant',
            accelerator: 'CmdOrCtrl+U',
            click: () => majCalendrier({ force: true }),
          },
          {
            label: 'Vider le cache hors ligne et recharger',
            click: async () => {
              await fenetre?.webContents.session.clearStorageData({
                storages: ['serviceworkers', 'cachestorage'],
              });
              fenetre?.webContents.reload();
            },
          },
          { type: 'separator' },
          { label: 'Ouvrir le dossier des données', click: () => shell.openPath(path.join(RACINE, 'data')) },
          { type: 'separator' },
          { label: 'Plein écran', accelerator: 'F11', click: () => fenetre?.setFullScreen(!fenetre.isFullScreen()) },
          { label: 'Outils de développement', accelerator: 'F12', click: () => fenetre?.webContents.toggleDevTools() },
          { type: 'separator' },
          { label: 'Quitter', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
        ],
      },
      { label: 'Édition', role: 'editMenu' },
    ])
  );
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (fenetre) {
      if (fenetre.isMinimized()) fenetre.restore();
      fenetre.focus();
    }
  });

  app.whenReady().then(async () => {
    await preparerRacine();
    try {
      await servir();
    } catch (err) {
      dialog.showErrorBox(
        'Guide des Sports ne peut pas démarrer',
        `Le port ${PORT} est déjà pris (${err.code}).\n\n` +
          `Ce port est fixe parce qu'il porte l'origine sous laquelle vos favoris ` +
          `et vos réglages sont rangés. Fermez le programme qui l'occupe, puis relancez.`
      );
      app.quit();
      return;
    }
    leverCORS(session.defaultSession);

    // Le préchargement lit le script dans la copie inscriptible, pas dans le
    // dépôt : c'est celle-là qui suit les mises à jour de l'application.
    process.env.FOOTY_USERSCRIPT = path.join(RACINE, 'multiview-cleaner.user.js');

    // Avant d'ouvrir la fenêtre : les listes se chargent en quelques secondes,
    // et un lecteur ouvert avant que le blocage soit en place verrait passer
    // ses publicités.
    await activerBlocage(session.defaultSession);

    menu();
    ouvrir();
    // Après l'ouverture : la fenêtre s'affiche tout de suite avec ce qu'elle a,
    // et le calendrier se met à jour derrière si ce n'est pas celui du jour.
    majCalendrier();
  });

  app.on('window-all-closed', () => app.quit());
}

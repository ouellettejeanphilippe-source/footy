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

/* Où l'application travaille, et pourquoi elle peut travailler dans le dépôt
   -------------------------------------------------------------------------
   Par défaut, l'application empaquetée travaille sur une copie inscriptible
   dans le profil de l'utilisateur : le dossier embarqué dans l'exécutable est
   en lecture seule, et le calendrier, les liens et `domains.json` sont réécrits
   pendant l'exécution.

   Mais sur la machine qui porte le dépôt, cette copie est un PIÈGE. Le pipeline
   (local/pipeline.ps1) fait les trois étapes — calendrier, liens, et surtout la
   vérification des lecteurs dans un vrai Chromium — et il les écrit DANS LE
   DÉPÔT. L'application, elle, ne rafraîchit que le calendrier. Constaté le
   26 septembre 2026 : la copie de l'application portait un registre de 60 hôtes
   daté du 21, pendant que le dépôt en avait 109 du jour. Les liens morts
   n'étaient donc marqués nulle part dans l'application, alors que le dépôt
   savait lesquels l'étaient.

   Pointée sur un dépôt, l'application y travaille directement : une seule copie
   des données sur la machine, partagée par l'exécutable, le pipeline et la
   fabrication de l'APK. Sur une machine qui n'a que l'exécutable, rien ne change.

   Le chemin se règle par `FOOTY_DEPOT`, ou par le menu (« Travailler dans un
   dépôt… »), qui l'écrit dans `depot.txt` à côté des réglages. */

function depotConfigure() {
  const candidat = (process.env.FOOTY_DEPOT || lireDepotEnregistre() || '').trim();
  if (!candidat) return null;
  // Un dépôt, et pas n'importe quel dossier : il doit porter le site ET ses
  // scripts, puisque c'est là que le calendrier sera régénéré.
  for (const atteste of ['index.html', 'data', 'scripts']) {
    if (!fs.existsSync(path.join(candidat, atteste))) return null;
  }
  return candidat;
}

function fichierDepot() {
  return path.join(app.getPath('userData'), 'depot.txt');
}

function lireDepotEnregistre() {
  try { return fs.readFileSync(fichierDepot(), 'utf8'); } catch (e) { return ''; }
}

const DEPOT = app.isPackaged ? depotConfigure() : null;

// En développement on travaille dans le dépôt ; empaqueté, dans le dépôt
// configuré s'il y en a un, sinon sur une copie inscriptible.
const RACINE = DEPOT || (app.isPackaged ? path.join(app.getPath('userData'), 'site') : SOURCE);

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
  // Pointée sur un dépôt, l'application n'y recopie RIEN : le dépôt est la
  // source, pas une destination. Écraser son code par celui qu'on transporte
  // reviendrait à défaire, à chaque lancement, ce qui y a été modifié.
  if (DEPOT) return;
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

/* Le bloqueur, quand ses listes sont prêtes. Il est posé ICI et non dans une
   variable locale parce que la levée CORS doit pouvoir lui déléguer : voir
   leverCORS, juste en dessous. */
let bloqueur = null;

function leverCORS(sess) {
  const NOTRE_ORIGINE = `http://${HOST}:${PORT}`;

  /* L'origine du demandeur, retenue le temps d'un aller-retour.

     Elle est nécessaire à la réponse, et la réponse ne la connaît pas : les détails
     d'`onHeadersReceived` ne portent pas les en-têtes de la requête. On la note donc
     ici, sous l'identifiant de la requête, juste avant de retirer l'en-tête Origin. */
  const originesEnVol = new Map();

  // Un site agrégateur qui voit `Origin: http://127.0.0.1:47821` peut refuser la
  // requête ; sans en-tête Origin, il répond comme à une visite normale.
  sess.webRequest.onBeforeSendHeaders((details, callback) => {
    const h = { ...details.requestHeaders };
    if (!details.url.startsWith(NOTRE_ORIGINE)) {
      if (h.Origin) originesEnVol.set(details.id, h.Origin);
      delete h.Origin;
      h['User-Agent'] = h['User-Agent'] ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    }
    callback({ requestHeaders: h });
  });

  /* C'est ici que le proxy CORS devient inutile : la réponse d'un site tiers
     repart vers la page avec l'autorisation que le site n'a pas donnée. Ne
     concerne QUE les réponses venant d'ailleurs que du serveur local, dont les
     en-têtes sont laissés intacts.

     UN SEUL ÉCOUTEUR, ET IL DOIT ÊTRE CELUI-CI
     ------------------------------------------
     `session.webRequest.onHeadersReceived` n'accepte qu'un écouteur par session :
     un second enregistrement REMPLACE le premier, sans rien dire. Le bloqueur de
     publicités pose le sien, et comme il était activé après cette fonction, il
     effaçait la levée CORS. Relevé le 26 septembre 2026 en lançant l'application
     avec ELECTRON_ENABLE_LOGGING :

       Access to fetch at 'https://soccersurge.io/watch-ligue-1-streams/' from
       origin 'http://127.0.0.1:47821' has been blocked by CORS policy

     L'application retombait donc sur les proxys CORS publics — exactement ce que
     la version de bureau existe pour éviter, et sans que rien ne le signale.

     D'où cet arrangement : cette fonction garde l'unique écouteur, et DÉLÈGUE au
     bloqueur quand ses listes sont chargées. L'ordre compte — le bloqueur décide
     d'abord (il peut vouloir poser sa propre politique de sécurité pour ses
     filtres `$csp`), et la levée CORS s'applique par-dessus. */
  /* L'ORIGINE EXACTE, PAS L'ÉTOILE.

     La première version répondait `Access-Control-Allow-Origin: *`, et le navigateur
     la refusait quand même — avec un autre message, qu'il fallait lire :

       The value of the 'Access-Control-Allow-Origin' header in the response must not
       be the wildcard '*' when the request's credentials mode is 'include'.

     L'application demande ses pages avec les cookies (`credentials: 'include'`, ce qui
     est justement ce qui la fait passer là où un proxy anonyme se fait refouler), et la
     spécification interdit l'étoile dans ce cas : il faut nommer l'origine, et
     l'accompagner de `Allow-Credentials`. Même chose pour `Allow-Headers`, dont
     l'étoile ne vaut rien avec des créances — on renvoie donc ce qui a été demandé. */
  const ajouterLesAutorisations = (enTetes, details) => {
    const h = { ...(enTetes || {}) };
    let demandes = null;
    for (const cle of Object.keys(h)) {
      const bas = cle.toLowerCase();
      if (bas === 'access-control-allow-origin' ||
        bas === 'access-control-allow-credentials' ||
        bas === 'access-control-allow-headers' ||
        bas === 'access-control-allow-methods' ||
        bas === 'x-frame-options' || // sinon la page refuse de s'afficher dans le lecteur
        bas === 'content-security-policy' ||
        bas === 'content-security-policy-report-only') {
        delete h[cle];
      } else if (bas === 'access-control-request-headers') {
        demandes = h[cle];
      }
    }
    h['Access-Control-Allow-Origin'] = [originesEnVol.get(details.id) || NOTRE_ORIGINE];
    h['Access-Control-Allow-Credentials'] = ['true'];
    h['Access-Control-Allow-Methods'] = ['GET,POST,HEAD,OPTIONS'];
    if (demandes) h['Access-Control-Allow-Headers'] = demandes;
    /* Ce qui reste refusé, et pourquoi on le laisse
       ---------------------------------------------
       Mesuré le 26 septembre 2026 sur un démarrage complet : 120 refus CORS avant,
       3 après — et les trois sont la MÊME requête, une balise d'empreinte que la page
       de sigmastream.lol envoie à un domaine de pistage, refusée sur son préambule
       (« Request header field content-type is not allowed »). Pour l'autoriser il
       faudrait renvoyer les en-têtes demandés par le préambule, qui vivent dans la
       REQUÊTE et non dans la réponse.
       On ne le fait pas : aucune requête de l'application n'en a besoin (elle lit des
       pages en GET, sans préambule), et la seule chose que cela débloquerait est un
       traceur. C'est le travail du bloqueur, pas le nôtre. */
    originesEnVol.delete(details.id);
    return h;
  };

  sess.webRequest.onHeadersReceived((details, callback) => {
    // Nos propres fichiers : rien à autoriser, rien à bloquer.
    if (details.url.startsWith(NOTRE_ORIGINE)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    if (bloqueur && typeof bloqueur.onHeadersReceived === 'function') {
      bloqueur.onHeadersReceived(details, (reponse) => {
        // `cancel` du bloqueur fait loi : on ne relance pas une requête qu'il refuse.
        if (reponse && reponse.cancel) { originesEnVol.delete(details.id); callback(reponse); return; }
        const base = (reponse && reponse.responseHeaders) || details.responseHeaders;
        callback({ responseHeaders: ajouterLesAutorisations(base, details) });
      });
      return;
    }
    callback({ responseHeaders: ajouterLesAutorisations(details.responseHeaders, details) });
  });

  /* Une requête qui échoue ne passe jamais par `onHeadersReceived` : sans ceci son
     origine resterait dans la table, et sur une session longue — le lecteur en ouvre
     des milliers — la table ne ferait que grossir. */
  sess.webRequest.onErrorOccurred((details) => { originesEnVol.delete(details.id); });
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

    // Pose le blocage réseau (`onBeforeRequest`) et le préchargement qui fait le
    // filtrage cosmétique. Au passage, il remplace l'écouteur d'en-têtes...
    blocker.enableBlockingInSession(sess);

    // ...qu'on reprend tout de suite, en lui délégeant cette fois. Sans ces deux
    // lignes dans CET ordre, la levée CORS disparaît sans un mot (voir leverCORS).
    bloqueur = blocker;
    leverCORS(sess);
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

/* Le choix du dépôt ne prend effet qu'au relancement : `RACINE` est lu au
   démarrage par le serveur, par la copie inscriptible et par le scraper. Le
   changer à chaud demanderait de tout redémarrer — autant le dire franchement. */
async function choisirDepot() {
  const r = await dialog.showOpenDialog(fenetre, {
    title: 'Le dossier du dépôt Guide des Sports',
    message: "Choisissez le dossier qui contient index.html, data/ et scripts/.",
    properties: ['openDirectory'],
    defaultPath: DEPOT || undefined,
  });
  if (r.canceled || !r.filePaths.length) return;
  const choix = r.filePaths[0];

  const manquants = ['index.html', 'data', 'scripts'].filter((n) => !fs.existsSync(path.join(choix, n)));
  if (manquants.length) {
    dialog.showMessageBox(fenetre, {
      type: 'error',
      title: "Ce n'est pas le dépôt",
      message: 'Ce dossier ne ressemble pas au dépôt du Guide des Sports.',
      detail: 'Il manque : ' + manquants.join(', ') + '.',
    });
    return;
  }

  await fsp.writeFile(fichierDepot(), choix, 'utf8');
  const suite = await dialog.showMessageBox(fenetre, {
    type: 'info',
    title: 'Dépôt enregistré',
    message: 'L’application travaillera dans :\n' + choix,
    detail: "Le changement prend effet au prochain lancement. Ensuite, le calendrier, "
      + "les liens et la vérification des lecteurs seront ceux du dépôt — donc ceux que "
      + "le pipeline (local\\pipeline.ps1) tient à jour.",
    buttons: ['Relancer maintenant', 'Plus tard'],
    defaultId: 0,
    cancelId: 1,
  });
  if (suite.response === 0) { app.relaunch(); app.exit(0); }
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
          {
            label: DEPOT ? 'Travailler dans un dépôt… (actuel : ' + DEPOT + ')' : 'Travailler dans un dépôt…',
            click: choisirDepot,
          },
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
    // La levée CORS AVANT la fenêtre : l'application va chercher ses sources dès
    // son premier souffle, et une seule requête partie sans l'autorisation la
    // ferait basculer sur les proxys publics.
    leverCORS(session.defaultSession);

    process.env.FOOTY_USERSCRIPT = path.join(RACINE, 'multiview-cleaner.user.js');

    menu();
    ouvrir();

    /* Le blocage des publicités APRÈS la fenêtre, et sans l'attendre.

       Il charge quelques mega-octets de listes de filtres, ce qui prend de une à
       plusieurs secondes selon le réseau et le cache. Attendu avant l'ouverture,
       il laissait l'utilisateur devant rien — et le portable, qui se déballe déjà
       dans un dossier temporaire, ajoutait son temps au même silence.

       Rien n'est perdu à le poser après : la seule page déjà chargée est la
       nôtre, qui n'a pas de publicité. Les pages des lecteurs, elles, ne
       s'ouvrent que quand l'utilisateur clique, bien après. */
    activerBlocage(session.defaultSession);

    // Le calendrier se met à jour derrière si ce n'est pas celui du jour.
    majCalendrier();
  });

  app.on('window-all-closed', () => app.quit());
}

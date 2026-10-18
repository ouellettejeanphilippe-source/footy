/* Nettoyage de la tuile par le script utilisateur (multiview-cleaner.user.js).

   Question posée à l'usage : « le script devrait pas nuke la page sauf le vidéo ? » — oui,
   c'est sa raison d'être, et il ne le faisait pas de façon fiable. Deux défauts, tous deux
   reproduits ici avant d'être corrigés.

   1. **Il renonçait au bout de 15 secondes.** La recherche du lecteur sondait toutes les
      500 ms puis s'arrêtait définitivement. Sur ces sites le lecteur arrive au bout d'une
      chaîne d'iframes, parfois bien plus tard — certains annoncent eux-mêmes « stream will
      go live 30 minutes before the match starts ». Passé le délai, plus rien ne relançait
      la recherche : la tuile gardait tout le décor du site autour de la vidéo.

   2. **L'écouteur de messages vivait DANS la fonction de nettoyage.** Il n'existait donc
      qu'une fois le nettoyage réussi. Sur une page où le lecteur n'avait jamais été trouvé
      — précisément le cas où l'utilisateur a besoin d'agir — la tuile n'obéissait à rien,
      ni pour couper le son, ni pour nettoyer.

   Le script est injecté dans le cadre comme le ferait Tampermonkey, et le cadre est servi
   sous « localhost » quand la page hôte est sous « 127.0.0.1 » : deux origines distinctes,
   donc la vraie situation d'une iframe d'origine croisée. */
import { test, expect } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = fs.readFileSync(path.join(ROOT, 'multiview-cleaner.user.js'), 'utf8');

let server, origin, autreOrigine;

/* Page imitant un site de flux : un décor bien visible, et un lecteur qui n'arrive que
   lorsqu'on le demande — comme un flux qui « passe en direct » plus tard. */
const SITE = `<html><body style="margin:0">
  <header id="decor" style="height:80px;background:#900">BANDEAU DU SITE</header>
  <div id="avis" style="height:40px">Stream will go live 30 minutes before the match starts.</div>
  <div id="zone"></div>
  <a id="lien-blank" href="/pub" target="_blank" style="display:block;height:30px">Ouvrir la pub</a>
  <button id="bouton-pop" style="display:block;height:30px" onclick="window.__resultatOpen = (window.open('/pub', '_blank') !== null)">Popunder</button>
  <script>
    /* Ce que fait un lecteur HLS : demander son manifeste. La ressource entre dans la
       chronologie du cadre, que le script surveille. */
    fetch('/live/stream.m3u8?token=abc').catch(function () {});
    fetch('/ads/preroll.m3u8').catch(function () {});
    /* Ce que fait une régie : garder SA référence à window.open dès le premier script,
       pour l'appeler plus tard au clic. Si le script arrive après, cette référence est
       la vraie fonction. */
    window.__openDuSite = window.open;
    /* Ce que fait un navigateur qui refuse la lecture automatique avec le son : play()
       rejette. On compte les appels et on note si le dernier était muet. */
    window.__appelsPlay = 0;
    HTMLMediaElement.prototype.play = function () {
      window.__appelsPlay++; window.__dernierMuet = this.muted;
      return Promise.reject(new DOMException('play() refusé sans geste', 'NotAllowedError'));
    };
    window.addEventListener('message', function (e) {
      if (e.data === 'poser_lecteur') {
        var v = document.createElement('video');
        v.id = 'lecteur'; v.width = 640; v.height = 360;
        v.setAttribute('style', 'width:640px;height:360px');
        document.getElementById('zone').appendChild(v);
      }
      /* Une vidéo trop petite pour que le nettoyage la prenne pour le lecteur (il exige
         plus de 50 px) : la page n'est donc jamais nettoyée, et rien ne lance cette
         vidéo — sauf un ordre explicite. C'est le différentiel du test de mv_play. */
      /* Un navigateur qui n'autorise la lecture QUE muette : play() rejette dès que le
         son est rendu, et la vidéo se met en pause — exactement ce que fait Chrome sans
         activation de l'utilisateur. */
      if (e.data === 'poser_lecteur_sonrefuse') {
        var vs = document.createElement('video');
        vs.id = 'lecteur'; vs.width = 640; vs.height = 360;
        vs.setAttribute('style', 'width:640px;height:360px');
        var enPause = true;
        Object.defineProperty(vs, 'paused', { get: function () { return enPause; } });
        vs.play = function () {
          window.__appelsPlay++; window.__dernierMuet = this.muted;
          if (!this.muted) { enPause = true; return Promise.reject(new DOMException('son refuse', 'NotAllowedError')); }
          enPause = false; return Promise.resolve();
        };
        document.getElementById('zone').appendChild(vs);
      }
      /* Une page de match ordinaire : le lecteur en iframe, et une boîte de discussion en
         colonne à côté, PLUS GRANDE que lui (350 × 700 contre 640 × 360). */
      if (e.data === 'poser_chat_et_lecteur') {
        var colonne = document.createElement('div');
        colonne.id = 'colonne-chat';
        colonne.innerHTML = '<iframe id="chat" src="/salon" style="width:350px;height:700px;border:0"></iframe>';
        var scene = document.createElement('div');
        scene.innerHTML = '<iframe id="lecteur-cadre" src="/embed/1" style="width:640px;height:360px;border:0"></iframe>';
        document.getElementById('zone').appendChild(colonne);
        document.getElementById('zone').appendChild(scene);
      }
      /* « J'ai à nouveau des pubs dans les frames du multiview » (18 octobre 2026) : un
         lecteur dont l'emballage porte aussi une bannière de paris, l'iframe d'une régie
         posée sur l'image, ses commandes, son logo et son affiche. */
      if (e.data === 'poser_lecteur_et_pub') {
        var p = document.createElement('div');
        p.className = 'player'; p.setAttribute('style', 'position:relative;width:640px;height:360px');
        p.innerHTML = '<video id="lecteur" width="640" height="360" style="width:640px;height:360px"></video>'
          + '<div id="affiche" style="position:absolute;left:0;top:0;width:640px;height:360px;background:#123"></div>'
          + '<div id="pub-banniere" style="position:absolute;left:120px;top:100px;width:400px;height:160px;background:#fc0;z-index:20">'
          +   '<a href="https://paris.example/bonus" style="display:block;width:400px;height:140px">MISEZ</a><span class="close-btn">x</span></div>'
          + '<iframe id="pub-cadre" src="/pub" style="position:absolute;right:0;bottom:0;width:300px;height:250px;border:0"></iframe>'
          + '<div id="commandes" class="vjs-control-bar" style="position:absolute;left:0;bottom:0;width:640px;height:40px;background:#000"><button>lecture</button>'
          +   '<a href="https://lecteur.example/" style="display:inline-block;width:60px;height:20px">propulsé par</a></div>'
          + '<a id="logo" href="https://lecteur.example/" style="position:absolute;right:8px;top:8px;width:80px;height:30px">logo</a>';
        document.getElementById('zone').appendChild(p);
      }
      /* La régie qui attend que la vidéo parte pour poser sa bannière, z-index modeste. */
      if (e.data === 'poser_pub_tardive') {
        var t = document.createElement('div');
        t.id = 'pub-tardive';
        t.setAttribute('style', 'position:absolute;left:0;top:0;width:640px;height:120px;background:#c00;z-index:50');
        t.innerHTML = '<a href="https://paris.example/tard">COTE x10</a>';
        document.querySelector('.player').appendChild(t);
      }
      /* Un lecteur déjà dans la page mais caché (compte à rebours, avis à fermer), montré
         plus tard par un simple changement de style : aucun nœud n'est ajouté. */
      if (e.data === 'poser_lecteur_cache') {
        var cache = document.createElement('div');
        cache.id = 'enveloppe-cachee'; cache.style.display = 'none';
        cache.innerHTML = '<video id="lecteur" width="640" height="360" style="width:640px;height:360px"></video>';
        document.getElementById('zone').appendChild(cache);
      }
      if (e.data === 'montrer_lecteur') document.getElementById('enveloppe-cachee').style.display = 'block';
      /* Un lecteur en élément personnalisé : sa <video> vit dans une racine fantôme. */
      if (e.data === 'poser_lecteur_ombre') {
        var hote = document.createElement('div');
        hote.id = 'hote-ombre';
        hote.attachShadow({ mode: 'open' }).innerHTML = '<video id="lecteur-ombre" width="640" height="360" style="width:640px;height:360px"></video>';
        document.getElementById('zone').appendChild(hote);
      }
      /* Lecteur et discussion dans un emballage qui porte « chat » dans son nom. */
      if (e.data === 'poser_lecteur_emballage_chat') {
        var emb = document.createElement('div');
        emb.className = 'stream-chat-container';
        emb.innerHTML = '<div class="col"><iframe id="lecteur-cadre" src="/embed/1" style="width:640px;height:360px;border:0"></iframe></div>'
          + '<div class="col"><iframe id="chat" src="/salon" style="width:300px;height:360px;border:0"></iframe></div>';
        document.getElementById('zone').appendChild(emb);
      }
      if (e.data === 'poser_video_minuscule') {
        var vp = document.createElement('video');
        vp.id = 'minuscule'; vp.width = 40; vp.height = 30;
        vp.setAttribute('style', 'width:40px;height:30px');
        document.getElementById('zone').appendChild(vp);
      }
      /* Un lecteur « à la Video.js » : la vidéo dans un emballage reconnu, et un gros
         bouton de lecture par-dessus qui attend le clic de l'utilisateur. */
      if (e.data === 'poser_lecteur_bouton') {
        var w = document.createElement('div');
        w.className = 'video-js player'; w.setAttribute('style', 'width:640px;height:360px;position:relative');
        var v2 = document.createElement('video');
        v2.id = 'lecteur'; v2.width = 640; v2.height = 360; v2.setAttribute('style', 'width:640px;height:360px');
        var b = document.createElement('button');
        b.className = 'vjs-big-play-button'; b.id = 'gros-play';
        b.setAttribute('style', 'position:absolute;left:280px;top:150px;width:80px;height:60px');
        b.addEventListener('click', function () { window.__clicsPlay = (window.__clicsPlay || 0) + 1; });
        w.appendChild(v2); w.appendChild(b);
        document.getElementById('zone').appendChild(w);
      }
    });
  </script>
</body></html>`;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/__site-stream') {
      /* Le script est servi comme PREMIER script du document, avant tout script du site :
         c'est ce que fait Tampermonkey à @run-at document-start (<html> existe, <head>
         pas encore). Un script d'initialisation Playwright tournerait avant même <html>,
         ce qu'aucun gestionnaire d'extensions ne fait, et le blocage des popups n'aurait
         nulle part où se poser à temps. */
      const avecScript = !/(^|[?&])sans=1/.test(req.url);
      /* Un site de chaînes, avec sa grille de programmes (« .epg ») : le script le prenait
         pour l'application et n'y touchait pas. */
      const site = /(^|[?&])epg=1/.test(req.url) ? SITE.replace('<div id="zone">', '<div class="epg">Grille des programmes</div><div id="zone">') : SITE;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(avecScript ? site.replace('<html>', '<html><script>' + SCRIPT + '</script>') : site);
    }
    /* La fenêtre principale de l'application, réduite à ce que le pont reconnaît, avec un
       faux GM_xmlhttpRequest qui note ce qu'on lui demande. `info=1` : un vrai
       gestionnaire de scripts (GM_info) ; sinon, une copie bâtie sur fetch. */
    if (rel === '/__app-factice') {
      const gm = '<script>window.__gm = [];'
        + (/(^|[?&])info=1/.test(req.url) ? 'window.GM_info = { script: { version: "1.14" } };' : '')
        + 'window.GM_xmlhttpRequest = function (o) { window.__gm.push({ url: o.url, headers: o.headers, responseType: o.responseType });'
        + ' setTimeout(function () { o.onload({ status: 200, response: new Uint8Array([7, 7, 7]).buffer, responseText: "", finalUrl: o.url }); }, 10);'
        + ' return { abort: function () {} }; };</script>';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<html>' + gm + '<script>' + SCRIPT + '</script><body><div id="marea"></div><main class="epg"></main></body></html>');
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body style="margin:0"></body></html>');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  origin = `http://127.0.0.1:${port}`;
  autreOrigine = `http://localhost:${port}`;
});

test.afterAll(async () => { await new Promise((r) => server.close(r)); });

/* Monte une tuile : page hôte sur une origine, cadre sur l'autre, script injecté dans
   tous les cadres comme le ferait Tampermonkey. */
async function monterTuile(page, avecHorloge, sansScript, requete, origineCadre) {
  /* L'horloge doit être installée AVANT toute navigation, sinon elle ne gouverne pas les
     minuteries que le script pose à son démarrage — et un test qui avance une horloge
     qu'il ne contrôle pas ne prouve rien. */
  if (avecHorloge) await page.clock.install();
  await page.goto(origin + '/hote');
  await page.evaluate((src) => {
    const f = document.createElement('iframe');
    f.id = 'tuile'; f.src = src;
    f.setAttribute('style', 'width:800px;height:600px;border:0');
    document.body.appendChild(f);
  }, (origineCadre || autreOrigine) + '/__site-stream' + (sansScript ? '?sans=1' : (requete ? '?' + requete : '')));
  const cadre = await (await page.locator('#tuile').elementHandle()).contentFrame();
  await cadre.waitForSelector('#decor');
  return cadre;
}

/* Fenêtres surgissantes. L'application ne peut rien contre elles (iframe d'origine
   croisée, sans bac à sable) ; le script, lui, est dans la page — à condition d'arriver
   AVANT son premier script, qui garde sa référence à window.open. Différentiel : sans le
   script, un vrai clic ouvre la fenêtre (sinon le test ne prouverait rien). */
async function tenterPopups(page, cadre) {
  let popups = 0;
  page.on('popup', () => { popups++; });
  await cadre.click('#bouton-pop');
  await cadre.click('#lien-blank');
  await page.waitForTimeout(600);
  const parReference = await cadre.evaluate(() => {
    try { return window.__openDuSite.call(window, '/pub', '_blank') !== null; } catch (e) { return false; }
  });
  await page.waitForTimeout(300);
  return { popups, ouverte: await cadre.evaluate(() => window.__resultatOpen), parReference };
}

test('sans le script, un vrai clic ouvre bien une fenêtre (le différentiel a un sens)', async ({ page }) => {
  const cadre = await monterTuile(page, false, true);
  const r = await tenterPopups(page, cadre);
  expect(r.ouverte).toBe(true);
  expect(r.popups).toBeGreaterThan(0);
});

test('avec le script, ni window.open, ni le lien _blank, ni la référence gardée n\'ouvrent quoi que ce soit', async ({ page }) => {
  const cadre = await monterTuile(page, false, false);
  const r = await tenterPopups(page, cadre);
  expect(r.ouverte).toBe(false);
  expect(r.parReference).toBe(false);
  expect(r.popups).toBe(0);
});

/* Débit et définition : le script rapporte ce qu'il MESURE, jamais une estimation.
   La définition vient de l'élément <video> ; le débit des octets réellement transférés. */
test('le script rapporte la définition réelle du lecteur', async ({ page }) => {
  const cadre = await monterTuile(page, false);
  await page.evaluate(() => {
    window.__mesures = [];
    window.addEventListener('message', (e) => { if (e.data && e.data.__mv === 'video_stats') window.__mesures.push(e.data); });
  });
  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('poser_lecteur', '*'); });
  await expect(cadre.locator('#lecteur')).toBeAttached();
  await cadre.evaluate(() => {
    const v = document.getElementById('lecteur');
    Object.defineProperty(v, 'videoWidth', { value: 1920 });
    Object.defineProperty(v, 'videoHeight', { value: 1080 });
  });
  await expect.poll(async () => (await page.evaluate(() => window.__mesures)).length, { timeout: 12000 }).toBeGreaterThan(0);
  const m = (await page.evaluate(() => window.__mesures))[0];
  expect(m.h).toBe(1080);
  expect(m.w).toBe(1920);
  /* Le banc ne sert aucun segment vidéo : le débit n'est pas mesurable, et doit valoir 0
     plutôt qu'un chiffre inventé. */
  expect(m.kbps).toBe(0);
});

/* Mode direct : le manifeste que la page demande remonte à la fenêtre principale, une
   fois, sans les manifestes publicitaires. */
test('le script remonte le manifeste vidéo que la page demande', async ({ page }) => {
  await page.goto(origin + '/hote');
  await page.evaluate(() => {
    window.__manifestes = [];
    window.addEventListener('message', (e) => { if (e.data && e.data.__mv === 'media_url') window.__manifestes.push(e.data); });
  });
  await page.evaluate((src) => {
    const f = document.createElement('iframe');
    f.id = 'tuile'; f.src = src;
    document.body.appendChild(f);
  }, autreOrigine + '/__site-stream');
  await expect.poll(async () => (await page.evaluate(() => window.__manifestes)).length, { timeout: 8000 }).toBeGreaterThan(0);
  const vus = await page.evaluate(() => window.__manifestes);
  expect(vus.map((v) => v.url)).toEqual([autreOrigine + '/live/stream.m3u8?token=abc']);
  expect(vus[0].pageUrl).toBe(autreOrigine + '/__site-stream');
});

/* « Vidéo en lecture » : le seul signal que la tuile puisse recevoir sur ce qui joue.
   Depuis l'application, le cadre est opaque ; le script, lui, y est. Il doit dire à la
   fenêtre principale quand un <video> joue vraiment — données prêtes, non en pause — et
   se taire tant que rien ne joue. */
test('le script signale à la fenêtre principale quand une vidéo joue', async ({ page }) => {
  const cadre = await monterTuile(page, false);
  await page.evaluate(() => {
    window.__signaux = [];
    window.addEventListener('message', (e) => { if (e.data && e.data.__mv === 'video_state') window.__signaux.push(e.data); });
  });

  // Un lecteur posé mais qui ne joue pas : aucun signal « joue ».
  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('poser_lecteur', '*'); });
  await expect(cadre.locator('#lecteur')).toBeAttached();
  await page.waitForTimeout(3000);
  expect((await page.evaluate(() => window.__signaux)).filter((s) => s.playing)).toEqual([]);

  // Le lecteur se met à jouer (données prêtes, non en pause, temps qui avance).
  await cadre.evaluate(() => {
    const v = document.getElementById('lecteur');
    Object.defineProperty(v, 'readyState', { value: 4 });
    Object.defineProperty(v, 'paused', { value: false });
    Object.defineProperty(v, 'currentTime', { value: 12 });
  });
  await expect.poll(async () => (await page.evaluate(() => window.__signaux)).filter((s) => s.playing).length, { timeout: 8000 }).toBeGreaterThan(0);
  const signal = (await page.evaluate(() => window.__signaux)).find((s) => s.playing);
  expect(signal.host).toBe('localhost');
});

/* POURQUOI ça ne joue plus, et non seulement que ça ne joue plus.

   « Trop vite à switch de sources quand ça bugge, au lieu de tenter de recharger »
   (19 septembre 2026) : l'application recharge maintenant la source quand un flux
   s'arrête, et deux arrêts ne se ressemblent pas. Une vidéo PRÊTE mais arrêtée, c'est
   l'utilisateur qui l'a mise en pause — recharger par-dessus serait une nuisance. Une
   vidéo qui n'a plus ses données, ou un lecteur disparu de la page, c'est une panne, et
   c'est elle qui mérite le rechargement. Seul le script, qui est DANS le cadre, peut
   faire la différence ; il la remonte dans `cause` (js/playability.js,
   arretMeriteRechargement). */
test('le script dit POURQUOI la vidéo ne joue plus : une pause n\'est pas une panne', async ({ page }) => {
  const cadre = await monterTuile(page, false);
  await page.evaluate(() => {
    window.__signaux = [];
    window.addEventListener('message', (e) => { if (e.data && e.data.__mv === 'video_state') window.__signaux.push(e.data); });
  });
  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('poser_lecteur', '*'); });
  await expect(cadre.locator('#lecteur')).toBeAttached();

  /* Un état que le test PILOTE : les trois propriétés que le script consulte sont lues
     depuis un objet, pour pouvoir les changer en cours de route. */
  await cadre.evaluate(() => {
    const v = document.getElementById('lecteur');
    window.__etat = { readyState: 4, paused: false, currentTime: 12 };
    ['readyState', 'paused', 'currentTime'].forEach((k) => {
      Object.defineProperty(v, k, { configurable: true, get: () => window.__etat[k] });
    });
  });
  const dernier = async () => (await page.evaluate(() => window.__signaux)).slice(-1)[0];
  await expect.poll(async () => (await dernier() || {}).playing, { timeout: 8000 }).toBe(true);
  expect((await dernier()).cause).toBe('joue');

  // L'utilisateur met en pause : la vidéo reste PRÊTE, seulement arrêtée.
  await cadre.evaluate(() => { window.__etat.paused = true; });
  await expect.poll(async () => (await dernier() || {}).playing, { timeout: 8000 }).toBe(false);
  expect((await dernier()).cause, 'une vidéo prête et arrêtée est une pause, pas une panne').toBe('pause');

  // Elle repart, puis elle perd ses données : là, c'est une panne.
  await cadre.evaluate(() => { window.__etat.paused = false; });
  await expect.poll(async () => (await dernier() || {}).playing, { timeout: 8000 }).toBe(true);
  await cadre.evaluate(() => { window.__etat.readyState = 1; });
  await expect.poll(async () => (await dernier() || {}).playing, { timeout: 8000 }).toBe(false);
  expect((await dernier()).cause, 'plus de données prêtes : ré-tampon ou segment perdu').toBe('attente');
});

test('le décor du site disparaît quand le lecteur arrive tardivement', async ({ page }) => {
  const cadre = await monterTuile(page, true);

  // Le décor est bien là, et rien n'a encore été nettoyé : il n'y a pas de lecteur.
  await expect(cadre.locator('#decor')).toBeVisible();

  /* On dépasse largement les 15 secondes de l'ancienne fenêtre de recherche. L'horloge,
     installée avant la navigation, gouverne bien les minuteries du script ; l'observateur
     du DOM, lui, n'en dépend pas et réagit à la vraie mutation qui suit. */
  await page.clock.fastForward('00:30');

  // Le flux « passe en direct » : le lecteur est inséré, bien après l'abandon.
  await page.evaluate(() => {
    document.getElementById('tuile').contentWindow.postMessage('poser_lecteur', '*');
  });

  await expect(cadre.locator('#lecteur')).toBeAttached();
  /* Le décor doit avoir été retiré : c'est tout l'objet du script. Avant correction, la
     recherche avait renoncé et le bandeau restait autour de la vidéo. */
  await expect(cadre.locator('#decor')).toHaveCount(0, { timeout: 10000 });
  await expect(cadre.locator('#avis')).toHaveCount(0);
  await expect(cadre.locator('#lecteur')).toBeAttached();
});

/* « Ça pogne pas toujours le bon iframe (genre chat). » Le nettoyage gardait la plus
   grande iframe de la page : la colonne de discussion l'emportait sur le lecteur, et la
   tuile était réduite au chat. */
test('le nettoyage garde le lecteur, pas la boîte de discussion plus grande que lui', async ({ page }) => {
  const cadre = await monterTuile(page, false);
  await page.evaluate(() => {
    document.getElementById('tuile').contentWindow.postMessage('poser_chat_et_lecteur', '*');
  });
  await expect(cadre.locator('#decor')).toHaveCount(0, { timeout: 10000 });
  await expect(cadre.locator('#lecteur-cadre')).toBeAttached();
  await expect(cadre.locator('#chat')).toHaveCount(0);
});

/* « Faire que les vidéos dans le multiview se lancent directement. » Une fois la page
   réduite au lecteur, la vidéo attendait encore un clic. Le script appelle play() —
   refusé avec le son, il coupe le son et réessaie — et clique une fois, pas deux, le
   gros bouton de lecture du lecteur. */
test('la vidéo est lancée sans clic : play() appelé, relancé muet si refusé, gros bouton cliqué une fois', async ({ page }) => {
  const cadre = await monterTuile(page, false);
  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('poser_lecteur_bouton', '*'); });
  await expect(cadre.locator('#lecteur')).toBeAttached();
  await expect(cadre.locator('#decor')).toHaveCount(0, { timeout: 10000 });

  await expect.poll(() => cadre.evaluate(() => window.__appelsPlay), { timeout: 8000 }).toBeGreaterThanOrEqual(2);
  const etat = await cadre.evaluate(() => ({ muet: window.__dernierMuet, clics: window.__clicsPlay || 0, bouton: !!document.getElementById('gros-play') }));
  expect(etat.muet, 'refusé avec le son, relancé muet').toBe(true);
  expect(etat.bouton, 'le bouton de lecture a survécu au nettoyage (c\'est un contrôle)').toBe(true);
  expect(etat.clics, 'le gros bouton de lecture a été cliqué').toBe(1);

  await page.waitForTimeout(2500);
  expect(await cadre.evaluate(() => window.__clicsPlay), 'et une seule fois : un second clic mettrait en pause').toBe(1);
});

test('la tuile obéit aux ordres même sans nettoyage préalable', async ({ page }) => {
  const cadre = await monterTuile(page);

  /* Aucun lecteur, donc aucun nettoyage possible : c'est exactement l'état où l'écouteur
     n'existait pas, l'ancien code ne le posant qu'à la fin d'un nettoyage réussi. */
  await expect(cadre.locator('#decor')).toBeVisible();

  /* L'ordre doit avoir un effet OBSERVABLE, sinon le test ne prouve rien.

     C'est ce qui manquait jusqu'au 12 septembre 2026 : ce test posait `mv_clean` puis
     vérifiait que le décor disparaissait — ce que la recherche automatique fait de toute
     façon. Il passait donc alors que la tuile n'obéissait à RIEN : le piège
     anti-détournement remplace `window.parent` par un Proxy neuf à chaque lecture, et le
     filtre « seule la fenêtre qui nous encadre commande » (`e.source !== window.parent`)
     rejetait tous les messages, y compris ceux de l'application. Le son de la tuile
     active, le nettoyage à la demande et le lancement de la lecture étaient morts.
     `window.mvUnmutedState` est le témoin : il ne change que si l'ordre est reçu. */
  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('mv_unmute', '*'); });
  await expect.poll(() => cadre.evaluate(() => window.mvUnmutedState), { timeout: 5000 }).toBe(true);
  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('mv_mute', '*'); });
  await expect.poll(() => cadre.evaluate(() => window.mvUnmutedState), { timeout: 5000 }).toBe(false);

  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('mv_clean', '*'); });

  // L'ordre est reçu : on pose ensuite le lecteur, et le nettoyage doit suivre.
  await page.evaluate(() => {
    document.getElementById('tuile').contentWindow.postMessage('poser_lecteur', '*');
  });
  await expect(cadre.locator('#decor')).toHaveCount(0, { timeout: 10000 });
});

/* « Lecture automatique des lecteurs » (12 septembre 2026). Le mode câble envoie `mv_play`
   après chaque changement de chaîne ou de source. Contrairement à `mv_unmute`, cet ordre
   n'attend pas que le nettoyage ait réussi : c'est justement sur une page où le lecteur
   n'a pas été trouvé que la vidéo reste en pause. Différentiel : la vidéo posée ici est
   trop petite pour que le nettoyage la reconnaisse, donc rien ne la lance tant que
   l'ordre n'arrive pas. */
test('mv_play lance la vidéo même quand le lecteur n\'a jamais été trouvé', async ({ page }) => {
  const cadre = await monterTuile(page, false);
  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('poser_video_minuscule', '*'); });
  await expect(cadre.locator('#minuscule')).toBeAttached();
  await page.waitForTimeout(1500);
  expect(await cadre.evaluate(() => window.__appelsPlay), 'le nettoyage ignore cette vidéo : personne ne la lance').toBe(0);
  await expect(cadre.locator('#decor')).toBeVisible();

  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('mv_play', '*'); });
  await expect.poll(() => cadre.evaluate(() => window.__appelsPlay), { timeout: 8000 }).toBeGreaterThanOrEqual(2);
  expect(await cadre.evaluate(() => window.__dernierMuet), 'refusée avec le son, relancée muette').toBe(true);
});

/* « Son automatique on » (13 septembre 2026). Rendre le son peut ARRÊTER la vidéo : sans
   activation de l'utilisateur, le navigateur n'autorise que le muet. Le script vérifie
   donc le résultat au lieu de le supposer — il remet le muet pour que la vidéo continue
   de jouer, et le DIT à l'application (`sound_state`, blocked), qui n'insistera plus
   jusqu'au prochain geste. Sans ce rapport, la tuile restait muette sans que personne
   sache pourquoi. */
test('le son rendu est vérifié : la vidéo qui s\'arrête est remise en muet, et le refus est rapporté', async ({ page }) => {
  const cadre = await monterTuile(page, false);
  await page.evaluate(() => {
    window.__etatsSon = [];
    window.addEventListener('message', (e) => { if (e.data && e.data.__mv === 'sound_state') window.__etatsSon.push(e.data); });
    document.getElementById('tuile').contentWindow.postMessage('poser_lecteur_sonrefuse', '*');
  });
  await expect(cadre.locator('#lecteur')).toBeAttached();
  await expect(cadre.locator('#decor')).toHaveCount(0, { timeout: 10000 });
  // La vidéo joue, muette (le repli du script).
  await expect.poll(() => cadre.evaluate(() => !document.querySelector('#lecteur').paused), { timeout: 8000 }).toBe(true);

  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('mv_unmute', '*'); });
  await expect.poll(() => page.evaluate(() => window.__etatsSon.length), { timeout: 8000 }).toBeGreaterThan(0);

  const rapport = await page.evaluate(() => window.__etatsSon[window.__etatsSon.length - 1]);
  expect(rapport.blocked, 'le refus du navigateur est rapporté à l\'application').toBe(true);
  expect(rapport.unmuted, 'et le son n\'est pas annoncé comme rendu').toBe(false);
  const etat = await cadre.evaluate(() => ({ muet: document.querySelector('#lecteur').muted, joue: !document.querySelector('#lecteur').paused }));
  expect(etat.muet, 'le muet est remis : une vidéo qui joue sans son vaut mieux qu\'une vidéo arrêtée').toBe(true);
  expect(etat.joue, 'et elle joue de nouveau').toBe(true);
});

test('seule la fenêtre qui encadre la tuile peut lui donner des ordres', async ({ page }) => {
  /* Sans ce filtre, n'importe quel cadre de la page — une régie publicitaire, par
     exemple — pourrait piloter le lecteur. Le témoin est le même que ci-dessus
     (`mvUnmutedState`) : « le décor reste » ne prouvait rien, puisqu'il reste aussi quand
     l'ordre est accepté mais qu'aucun lecteur n'a été trouvé. */
  const cadre = await monterTuile(page);
  await cadre.evaluate(() => {
    // Message émis DEPUIS le cadre lui-même : e.source vaut ce cadre, pas la fenêtre parente.
    window.postMessage('mv_unmute', '*');
    window.postMessage('mv_clean', '*');
  });
  await page.waitForTimeout(600);
  expect(await cadre.evaluate(() => window.mvUnmutedState), 'un ordre qui ne vient pas de la fenêtre parente est ignoré').toBe(false);
  await expect(cadre.locator('#decor')).toBeVisible();
});

/* « J'ai à nouveau des pubs dans les frames du multiview » : une pub par-dessus la vidéo
   (18 octobre 2026). Le nettoyage ne retirait de l'emballage du lecteur que les calques
   transparents, et ceux ajoutés après coup avec un z-index de plus de 1000. Une bannière
   visible ou l'iframe d'une régie restaient sur l'image. Ce qui mène ailleurs et couvre la
   vidéo part ; les commandes, l'affiche et le petit logo restent. */
test('les calques de pub posés sur la vidéo disparaissent, les commandes du lecteur restent', async ({ page }) => {
  const cadre = await monterTuile(page, false);
  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('poser_lecteur_et_pub', '*'); });
  await expect(cadre.locator('#decor')).toHaveCount(0, { timeout: 10000 });
  await expect(cadre.locator('#pub-banniere'), 'la bannière de paris posée sur l\'image').toBeHidden({ timeout: 5000 });
  await expect(cadre.locator('#pub-cadre'), 'l\'iframe d\'une régie dans l\'emballage d\'une <video>').toBeHidden();
  await expect(cadre.locator('#lecteur')).toBeVisible();
  await expect(cadre.locator('#commandes'), 'les commandes du lecteur, même avec leur petit lien « propulsé par »').toBeVisible();
  await expect(cadre.locator('#logo'), 'son logo, qui ne couvre presque rien').toBeVisible();
  await expect(cadre.locator('#affiche'), 'son affiche, qui ne mène nulle part').toBeVisible();

  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('poser_pub_tardive', '*'); });
  await expect(cadre.locator('#pub-tardive'), 'la bannière posée après le départ de la vidéo, z-index 50').toBeHidden({ timeout: 5000 });
  await expect(cadre.locator('#commandes')).toBeVisible();
});

/* Un lecteur déjà dans la page mais caché, montré plus tard par un changement de style :
   l'observateur ne voit que les nœuds ajoutés, et le sondage s'arrêtait à 15 s. La page
   restait entière autour de la vidéo. */
test('un lecteur montré tard, sans nœud ajouté, est quand même trouvé', async ({ page }) => {
  const cadre = await monterTuile(page, true);
  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('poser_lecteur_cache', '*'); });
  await expect(cadre.locator('#lecteur')).toBeAttached();
  await page.clock.fastForward('00:30');
  await expect(cadre.locator('#decor'), 'caché, il ne compte pas').toBeVisible();
  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('montrer_lecteur', '*'); });
  await page.waitForTimeout(200);
  await page.clock.fastForward('00:04');
  await expect(cadre.locator('#decor')).toHaveCount(0, { timeout: 5000 });
  await expect(cadre.locator('#lecteur')).toBeVisible();
});

test('un lecteur dont la vidéo vit dans une racine fantôme est nettoyé', async ({ page }) => {
  const cadre = await monterTuile(page, false);
  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('poser_lecteur_ombre', '*'); });
  await expect(cadre.locator('#decor')).toHaveCount(0, { timeout: 12000 });
  await expect(cadre.locator('#hote-ombre')).toBeVisible();
});

/* Le script se croyait dans l'application dès qu'un élément « .epg » existait : un site de
   chaînes et sa grille de programmes n'étaient jamais nettoyés. */
test('un site qui a sa grille de programmes (.epg) est nettoyé comme les autres', async ({ page }) => {
  const cadre = await monterTuile(page, false, false, 'epg=1');
  await expect(cadre.locator('.epg')).toBeAttached();
  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('poser_lecteur', '*'); });
  await expect(cadre.locator('#decor')).toHaveCount(0, { timeout: 10000 });
  await expect(cadre.locator('#lecteur')).toBeAttached();
});

/* Un emballage nommé « stream-chat-container » qui porte le lecteur ET la discussion : son
   nom écartait le lecteur aussi (1.12), et plus rien n'était à garder. */
test('un emballage qui contient le lecteur et la discussion ne fait pas écarter le lecteur', async ({ page }) => {
  const cadre = await monterTuile(page, false);
  await page.evaluate(() => { document.getElementById('tuile').contentWindow.postMessage('poser_lecteur_emballage_chat', '*'); });
  await expect(cadre.locator('#decor')).toHaveCount(0, { timeout: 10000 });
  await expect(cadre.locator('#lecteur-cadre')).toBeAttached();
  await expect(cadre.locator('#chat')).toHaveCount(0);
});

/* Le pont lit en binaire pour le mode direct (« le bouton direct, ça marche avec AUCUN
   SITE », 18 octobre 2026), avec le Referer et l'Origin du lecteur, et seulement sous un
   vrai gestionnaire de scripts : les copies de l'extension, du bureau et de l'APK bâtissent
   GM_xmlhttpRequest sur fetch, qui ne sait ni lire en binaire ni poser un Referer. */
async function questionnerPont(page, info) {
  await page.goto(origin + '/__app-factice' + (info ? '?info=1' : ''));
  return page.evaluate(() => new Promise((resolve) => {
    const recu = { pret: null, page: null };
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || !d.__mvBridge) return;
      if (d.__mvBridge === 'mv_bridge_ready' && !recu.pret) {
        recu.pret = d;
        window.postMessage({ __mvBridge: 'mv_bridge_fetch', id: 'x1', url: 'https://cdn.test/hls/seg-1.ts', binaire: true,
          referer: 'https://lecteur.test/', origine: 'https://lecteur.test', plage: 'bytes=0-99', timeout: 5000 }, '*');
      }
      if (d.__mvBridge === 'mv_bridge_page' && d.id === 'x1') {
        recu.page = { ok: d.ok, binaire: d.binaire, octets: d.octets ? Array.from(new Uint8Array(d.octets)) : null, error: d.error };
        resolve({ recu, gm: window.__gm });
      }
    });
    window.postMessage({ __mvBridge: 'mv_bridge_hello' }, '*');
  }));
}

test('le pont lit en binaire, avec le Referer du lecteur, sous un vrai gestionnaire de scripts', async ({ page }) => {
  const { recu, gm } = await questionnerPont(page, true);
  const [maj, min] = String(recu.pret.version).split('.').map(Number);
  expect(maj > 1 || (maj === 1 && min >= 14), 'au moins 1.14, la version qui lit en binaire : ' + recu.pret.version).toBe(true);
  expect(recu.pret.binaire, 'lecture binaire annoncée').toBe(true);
  expect(recu.page).toEqual({ ok: true, binaire: true, octets: [7, 7, 7], error: '' });
  expect(gm).toEqual([{ url: 'https://cdn.test/hls/seg-1.ts', responseType: 'arraybuffer',
    headers: { Referer: 'https://lecteur.test/', Origin: 'https://lecteur.test', Range: 'bytes=0-99' } }]);
});

test('sans gestionnaire de scripts, le pont ne promet pas la lecture binaire', async ({ page }) => {
  const { recu, gm } = await questionnerPont(page, false);
  expect(recu.pret.binaire).toBe(false);
  expect(recu.page.ok).toBe(false);
  expect(gm, 'rien n\'est demandé au GM_xmlhttpRequest bâti sur fetch').toEqual([]);
});

/* La garde « Quitter le site ? » de l'application se lève quand l'utilisateur s'en va
   (18 octobre 2026) : pointeur sorti par le haut, touche de raccourci. Quand le pointeur
   ou le focus est dans une tuile, seul ce cadre les voit : le script les signale. */
test('le script signale le pointeur qui sort par le haut, qui revient, et la touche Ctrl', async ({ page }) => {
  /* Cadre de même origine ici : Chromium sans écran simule l'entrée du pointeur dans un
     cadre d'une autre origine, pas sa sortie (vérifié le 18 octobre 2026). Le script, lui,
     ne fait aucune différence. */
  const cadre = await monterTuile(page, false, false, '', origin);
  await page.evaluate(() => {
    window.__depart = [];
    window.addEventListener('message', (e) => {
      if (e.data && (e.data.__mv === 'pointeur' || e.data.__mv === 'touche')) window.__depart.push(e.data);
    });
    /* La tuile commence 20 px plus bas : le pointeur qui la quitte par le haut entre dans
       la page hôte, comme quand il monte vers la barre du lecteur. */
    document.body.style.paddingTop = '20px';
  });
  await cadre.waitForSelector('#decor');
  const vus = () => page.evaluate(() => window.__depart.splice(0));
  await page.mouse.move(100, 200);
  await page.mouse.move(100, 120, { steps: 2 });
  expect(await vus(), 'le pointeur entre dans la tuile depuis la page').toContainEqual({ __mv: 'pointeur', dehors: false });
  await page.mouse.move(100, 8);
  await page.waitForTimeout(200);
  expect(await vus(), 'il en sort par le haut').toContainEqual({ __mv: 'pointeur', dehors: true });
  await page.mouse.move(100, 300);
  await page.waitForTimeout(200);
  await vus();
  await page.mouse.move(100, 300, { steps: 1 });
  await page.mouse.move(400, 590);
  await page.mouse.move(400, 640);
  await page.waitForTimeout(200);
  expect((await vus()).filter((m) => m.__mv === 'pointeur' && m.dehors), 'sortir par le bas n\'est pas partir vers les onglets').toEqual([]);

  await cadre.click('#avis');
  await page.keyboard.down('Control');
  await page.waitForTimeout(200);
  expect(await vus(), 'Ctrl enfoncé dans la tuile').toContainEqual({ __mv: 'touche', modificateur: true, depart: false });
  await page.keyboard.up('Control');
  await page.waitForTimeout(200);
  expect(await vus(), 'et relâché').toContainEqual({ __mv: 'touche', modificateur: false, depart: false });
});

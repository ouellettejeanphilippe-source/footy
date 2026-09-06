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
    window.addEventListener('message', function (e) {
      if (e.data === 'poser_lecteur') {
        var v = document.createElement('video');
        v.id = 'lecteur'; v.width = 640; v.height = 360;
        v.setAttribute('style', 'width:640px;height:360px');
        document.getElementById('zone').appendChild(v);
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
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(avecScript ? SITE.replace('<html>', '<html><script>' + SCRIPT + '</script>') : SITE);
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
async function monterTuile(page, avecHorloge, sansScript) {
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
  }, autreOrigine + '/__site-stream' + (sansScript ? '?sans=1' : ''));
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

test('la tuile obéit aux ordres même sans nettoyage préalable', async ({ page }) => {
  const cadre = await monterTuile(page);

  /* Aucun lecteur, donc aucun nettoyage possible : c'est exactement l'état où l'écouteur
     n'existait pas, l'ancien code ne le posant qu'à la fin d'un nettoyage réussi. */
  await expect(cadre.locator('#decor')).toBeVisible();

  const repond = await page.evaluate(async () => {
    const f = document.getElementById('tuile');
    f.contentWindow.postMessage('mv_clean', '*');
    return true;
  });
  expect(repond).toBe(true);

  // L'ordre est reçu : on pose ensuite le lecteur, et le nettoyage doit suivre.
  await page.evaluate(() => {
    document.getElementById('tuile').contentWindow.postMessage('poser_lecteur', '*');
  });
  await expect(cadre.locator('#decor')).toHaveCount(0, { timeout: 10000 });
});

test('seule la fenêtre qui encadre la tuile peut lui donner des ordres', async ({ page }) => {
  /* Sans ce filtre, n'importe quel cadre de la page — une régie publicitaire, par
     exemple — pourrait piloter le lecteur. On vérifie qu'un message qui ne vient pas du
     parent est ignoré : le décor reste, faute d'ordre valable. */
  const cadre = await monterTuile(page);
  await cadre.evaluate(() => {
    // Message émis DEPUIS le cadre lui-même : e.source vaut ce cadre, pas window.parent.
    window.postMessage('mv_clean', '*');
  });
  await page.waitForTimeout(500);
  await expect(cadre.locator('#decor')).toBeVisible();
});

/* L'extension Chrome (extension/), chargée pour de vrai dans Chromium.

   « Ya moyen d'améliorer le ad block sur Chrome pour éviter que ça soit juste Firefox
   qui peut ? » (13 octobre 2026). uBlock Origin ne s'installe plus sur Chrome
   (Manifest V2 retiré) : l'extension maison reprend le blocage réseau, le script de
   nettoyage et la levée de X-Frame-Options. Ce test prouve chacun des trois dans un
   navigateur qui a chargé l'extension, sans réseau :

   - l'application sert sous 127.0.0.1, le « site de flux » sous 127.0.0.2 : deux
     origines, et la seconde n'est PAS une adresse de l'application ;
   - le site de flux répond `X-Frame-Options: DENY` et une CSP `frame-ancestors 'none'` :
     sans l'extension, la tuile reste vide (vérifié d'abord dans un navigateur nu, sinon
     le test ne prouverait rien) ;
   - un hôte des listes (doubleclick.net) est refusé avant le réseau ;
   - le pont lit une page du site de flux depuis l'application ;
   - le même site, ouvert hors de l'application, n'est pas touché par le script. */
import { test, expect, chromium } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const EXTENSION = path.join(ROOT, 'extension');

const APP = `<html><body>
  <div id="marea"><div class="epg"></div></div>
  <iframe id="tuile" style="width:800px;height:500px"></iframe>
</body></html>`;

const SITE = `<html><body>
  <div id="decor">DECOR</div>
  <button id="pop" onclick="window.__ouvert = (window.open('/pub') !== null)">pub</button>
  <script>
    window.__charge = true;
    fetch('http://doubleclick.net/pixel').then(function () { window.__pub = 'passe'; }, function () { window.__pub = 'bloquee'; });
  </script>
</body></html>`;

let serveur, port;

test.beforeAll(async () => {
  serveur = http.createServer((req, res) => {
    const hote = (req.headers.host || '').split(':')[0];
    if (hote === '127.0.0.2') {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'x-frame-options': 'DENY',
        'content-security-policy': "frame-ancestors 'none'"
      });
      res.end(req.url === '/page-source' ? '<html><body>PAGE DE LA SOURCE</body></html>' : SITE);
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(APP);
  });
  await new Promise((r) => serveur.listen(0, '0.0.0.0', r));
  port = serveur.address().port;
});

test.afterAll(async () => { await new Promise((r) => serveur.close(r)); });

async function lancer(avecExtension) {
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-ext-'));
  const args = ['--headless=new'];
  if (avecExtension) args.push(`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`);
  /* Le Chromium d'une configuration locale (§13 d'ARCHITECTURE) vaut aussi ici : un
     contexte persistant ne lit pas `use.launchOptions` de lui-même. */
  const lo = (test.info().project.use || {}).launchOptions || {};
  const contexte = await chromium.launchPersistentContext(profil, {
    channel: 'chromium', headless: false, args, executablePath: lo.executablePath
  });
  /* Aucun réseau extérieur : tout ce qui ne vise pas notre serveur échoue. Le blocage de
     l'extension se voit quand même, il refuse AVANT d'atteindre ce filet. */
  await contexte.route(/^https?:\/\/(?!127\.0\.0\.[12][:/])/, (r) => r.abort());
  /* Sauf la régie : servie normalement, elle PASSERAIT. Si elle échoue, c'est l'extension. */
  await contexte.route(/doubleclick\.net/, (r) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'ok' }));
  if (avecExtension) {
    let sw = contexte.serviceWorkers()[0];
    if (!sw) sw = await contexte.waitForEvent('serviceworker');
  }
  return { contexte, nettoyer: () => { try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) {} } };
}

async function cadreDuSite(page) {
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate((p) => { document.getElementById('tuile').src = `http://127.0.0.2:${p}/lecteur`; }, port);
  await page.waitForTimeout(1500);
  return page.frames().find((f) => f.url().includes('127.0.0.2'));
}

test('sans l\'extension, le site de flux refuse la tuile (le différentiel)', async () => {
  const { contexte, nettoyer } = await lancer(false);
  try {
    const page = await contexte.newPage();
    const cadre = await cadreDuSite(page);
    const charge = cadre ? await cadre.evaluate(() => !!window.__charge).catch(() => false) : false;
    expect(charge).toBe(false);
    // Et la régie passe : c'est ce que l'extension doit refuser.
    const seul = await contexte.newPage();
    await seul.goto(`http://127.0.0.2:${port}/lecteur`);
    await expect.poll(() => seul.evaluate(() => window.__pub)).toBe('passe');
  } finally { await contexte.close(); nettoyer(); }
});

test('avec l\'extension : la tuile s\'affiche, la pub est bloquée, le script tourne, le pont lit', async () => {
  const { contexte, nettoyer } = await lancer(true);
  try {
    const page = await contexte.newPage();
    const cadre = await cadreDuSite(page);
    expect(cadre).toBeTruthy();
    await expect.poll(() => cadre.evaluate(() => !!window.__charge)).toBe(true);

    // Le blocage réseau des listes d'uBlock.
    await expect.poll(() => cadre.evaluate(() => window.__pub)).toBe('bloquee');

    // Le script de nettoyage, posé avant le premier script de la page.
    expect(await cadre.evaluate(() => window.__footyNettoyeur === true)).toBe(true);
    await cadre.click('#pop');
    expect(await cadre.evaluate(() => window.__ouvert)).toBe(false);

    // L'application voit l'extension et le pont.
    expect(await page.evaluate(() => window.__footyExtension)).toBe(JSON.parse(fs_manifest()).version);
    const lu = await page.evaluate((p) => new Promise((resolve) => {
      window.addEventListener('message', (e) => {
        if (e.data && e.data.__mvBridge === 'mv_bridge_page' && e.data.id === 't1') resolve(e.data);
      });
      window.postMessage({ __mvBridge: 'mv_bridge_fetch', id: 't1', url: `http://127.0.0.2:${p}/page-source` }, '*');
    }), port);
    expect(lu.ok).toBe(true);
    expect(lu.html).toContain('PAGE DE LA SOURCE');

    // Hors de l'application, le script ne touche à rien.
    const ailleurs = await contexte.newPage();
    await ailleurs.goto(`http://127.0.0.2:${port}/lecteur`);
    expect(await ailleurs.evaluate(() => window.__footyNettoyeur === true || !!window.__footyExtension)).toBe(false);
  } finally { await contexte.close(); nettoyer(); }
});

function fs_manifest() { return fs.readFileSync(path.join(EXTENSION, 'manifest.json'), 'utf8'); }

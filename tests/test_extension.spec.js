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
   - le même site, ouvert hors de l'application, n'est pas touché par le script.

   « Les mêmes fonctions sur Firefox et Chrome » (25 octobre 2026) : le pont lit aussi en
   binaire, avec le `Referer`, l'`Origin` et la plage du lecteur, comme sous Tampermonkey
   (le mode direct), sans toucher la même adresse chargée par un onglet ; et le second
   écran, une fenêtre surgissante, affiche lui aussi les pages qui refusent l'iframe. */
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

/* Un « segment » de flux : 200 000 octets connus, servis seulement au Referer et à
   l'Origin de son lecteur, comme les CDN mesurés le 18 octobre 2026 (403 sinon). */
const LECTEUR = { referer: 'https://lecteur.test/embed/1', origine: 'https://lecteur.test' };
const SEGMENT = Buffer.from(Array.from({ length: 200000 }, (_, i) => i % 251));

let serveur, port;

test.beforeAll(async () => {
  serveur = http.createServer((req, res) => {
    const hote = (req.headers.host || '').split(':')[0];
    if (hote === '127.0.0.2' && req.url.startsWith('/segment')) {
      if (req.headers.referer !== LECTEUR.referer || req.headers.origin !== LECTEUR.origine) {
        res.writeHead(403); res.end('refus'); return;
      }
      const plage = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range || '');
      if (plage) {
        res.writeHead(206, { 'content-type': 'video/mp2t', 'content-range': `bytes ${plage[1]}-${plage[2]}/${SEGMENT.length}` });
        res.end(SEGMENT.subarray(Number(plage[1]), Number(plage[2]) + 1));
        return;
      }
      res.writeHead(200, { 'content-type': 'video/mp2t' });
      res.end(SEGMENT);
      return;
    }
    /* Ce que le serveur a reçu ; `lent=1` répond après 1,5 s, le temps qu'un onglet
       demande la même adresse pendant la lecture du pont. */
    if (hote === '127.0.0.2' && req.url.startsWith('/entetes')) {
      const corps = JSON.stringify({ referer: req.headers.referer || '', origin: req.headers.origin || '' });
      setTimeout(() => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end(corps); }, /lent=1/.test(req.url) ? 1500 : 0);
      return;
    }
    /* Une page d'un site qui encadre le lecteur qui refuse l'iframe. */
    if (hote === '127.0.0.2' && req.url === '/hote-cadre') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<html><body><iframe id="cadre" src="/lecteur" style="width:600px;height:400px"></iframe></body></html>`);
      return;
    }
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
  const profilChrome = path.join(profil, 'profil');
  const args = ['--headless=new'];
  /* Une copie : Chrome écrit son index des règles (`_metadata/`) dans le dossier qu'il
     charge, et ce dossier-là ne doit pas être celui du dépôt. */
  const copie = path.join(profil, 'extension');
  if (avecExtension) {
    fs.cpSync(EXTENSION, copie, { recursive: true, filter: (f) => !f.includes('_metadata') });
    args.push(`--disable-extensions-except=${copie}`, `--load-extension=${copie}`);
  }
  /* Le Chromium d'une configuration locale (§13 d'ARCHITECTURE) vaut aussi ici : un
     contexte persistant ne lit pas `use.launchOptions` de lui-même. */
  const lo = (test.info().project.use || {}).launchOptions || {};
  const contexte = await chromium.launchPersistentContext(profilChrome, {
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
  /* On attend le cadre, pas un délai : 1,5 s fixes ne suffisaient pas quand la machine était
     chargée (28 octobre 2026, `cadre` indéfini une fois sur un passage complet, 3 sur 3 réussis
     seul) — le test mesure ce que fait l'extension, pas la vitesse du chargement. Sans
     l'extension le cadre est refusé et n'a jamais cette adresse : on rend alors `undefined`
     au bout de 8 s, ce que le différentiel attend. */
  const trouve = () => page.frames().find((f) => f.url().includes('127.0.0.2'));
  for (let i = 0; i < 32 && !trouve(); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(300);
  return trouve();
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

/* Pose une question au pont, comme le fait js/embed-bridge.js, et rend la réponse
   réduite à ce qui se compare. */
async function demanderAuPont(page, demandes) {
  return page.evaluate(async (liste) => {
    const pret = await new Promise((resolve) => {
      const ecoute = (e) => { if (e.data && e.data.__mvBridge === 'mv_bridge_ready') { window.removeEventListener('message', ecoute); resolve(e.data); } };
      window.addEventListener('message', ecoute);
      window.postMessage({ __mvBridge: 'mv_bridge_hello' }, '*');
    });
    const demander = (corps, n) => new Promise((resolve) => {
      const id = 'q' + n;
      const ecoute = (e) => {
        const d = e.data;
        if (!d || d.__mvBridge !== 'mv_bridge_page' || d.id !== id) return;
        window.removeEventListener('message', ecoute);
        const o = d.octets ? new Uint8Array(d.octets) : null;
        resolve({ ok: d.ok, status: d.status, error: d.error, html: d.html,
          taille: o ? o.length : -1, debut: o ? Array.from(o.slice(0, 3)) : null, fin: o ? Array.from(o.slice(-3)) : null });
      };
      window.addEventListener('message', ecoute);
      window.postMessage(Object.assign({ __mvBridge: 'mv_bridge_fetch', id }, corps), '*');
    });
    return { pret, reponses: await Promise.all(liste.map(demander)) };
  }, demandes);
}

test('le pont de l\'extension lit en binaire, avec le Referer, l\'Origin et la plage du lecteur (le mode direct)', async () => {
  const { contexte, nettoyer } = await lancer(true);
  try {
    const page = await contexte.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    const base = `http://127.0.0.2:${port}`;
    const { pret, reponses: [segment, plage, texte] } = await demanderAuPont(page, [
      { url: base + '/segment', binaire: true, ...LECTEUR, timeout: 10000 },
      { url: base + '/segment', binaire: true, ...LECTEUR, plage: 'bytes=1000-1009', timeout: 10000 },
      { url: base + '/entetes' }
    ]);
    /* À part : la règle d'une lecture en cours vaut pour toute lecture de la MÊME adresse
       par le pont, et c'est la même ressource. */
    const { reponses: [sansLecteur] } = await demanderAuPont(page, [{ url: base + '/segment', binaire: true, timeout: 10000 }]);
    // L'application ne propose le direct que si le pont annonce la lecture binaire.
    expect(pret.binaire).toBe(true);
    expect(pret.version).toBe(fs.readFileSync(path.join(ROOT, 'multiview-cleaner.user.js'), 'utf8').match(/@version\s+(\S+)/)[1]);
    expect(segment).toMatchObject({ ok: true, status: 200, taille: SEGMENT.length, debut: [0, 1, 2], fin: [...SEGMENT.subarray(-3)] });
    expect(plage).toMatchObject({ ok: true, status: 206, taille: 10, debut: [1000 % 251, 1001 % 251, 1002 % 251] });
    // Différentiel : sans le Referer du lecteur, le « CDN » refuse. C'est donc bien la règle qui l'a posé.
    expect(sansLecteur).toMatchObject({ ok: false, status: 403 });
    // Une page lue en texte part avec son propre Referer, comme sous Tampermonkey.
    expect(texte.ok).toBe(true);
    expect(JSON.parse(texte.html).referer).toBe(base + '/entetes');
  } finally { await contexte.close(); nettoyer(); }
});

test('les en-têtes du pont ne touchent pas la même adresse chargée par un onglet', async () => {
  const { contexte, nettoyer } = await lancer(true);
  try {
    const page = await contexte.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    const url = `http://127.0.0.2:${port}/entetes?lent=1`;
    const onglet = await contexte.newPage();
    await onglet.goto(`http://127.0.0.2:${port}/lecteur`);
    const pont = demanderAuPont(page, [{ url, ...LECTEUR, binaire: true, timeout: 10000 }]);
    /* Pendant que la règle du pont est posée, la page d'un onglet lit la même adresse.
       Par fetch, pas par une navigation : une règle sans types ne vise jamais
       `main_frame`, et le test ne prouverait rien. */
    await page.waitForTimeout(400);
    const vuParOnglet = JSON.parse(await onglet.evaluate((u) => fetch(u).then((r) => r.text()), url));
    expect(vuParOnglet.referer).not.toBe(LECTEUR.referer);
    expect(vuParOnglet.origin).not.toBe(LECTEUR.origine);
    const { reponses: [lu] } = await pont;
    expect(lu.ok).toBe(true);
  } finally { await contexte.close(); nettoyer(); }
});

test('le second écran (fenêtre surgissante de l\'application) affiche les pages qui refusent l\'iframe, un simple onglet non', async () => {
  const { contexte, nettoyer } = await lancer(true);
  try {
    const page = await contexte.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    // Comme toggleDeuxEcrans (js/multiview.js) : une fenêtre vide, nommée, avec ses dimensions.
    const [ecran2] = await Promise.all([
      contexte.waitForEvent('page'),
      page.evaluate(() => { window.__ecran2 = window.open('', 'footy-ecran2', 'width=700,height=500'); })
    ]);
    await page.waitForTimeout(500);
    await page.evaluate((p) => {
      const d = window.__ecran2.document;
      const f = d.createElement('iframe');
      f.src = `http://127.0.0.2:${p}/lecteur`;
      f.style.cssText = 'width:600px;height:400px';
      d.body.appendChild(f);
    }, port);
    await expect.poll(() => ecran2.frames().some((f) => f.url().includes('127.0.0.2'))).toBe(true);
    const cadre = ecran2.frames().find((f) => f.url().includes('127.0.0.2'));
    await expect.poll(() => cadre.evaluate(() => !!window.__charge).catch(() => false)).toBe(true);

    // Un onglet ordinaire ouvert depuis l'application (« ouvrir le site ») garde sa protection.
    const [site] = await Promise.all([
      contexte.waitForEvent('page'),
      page.evaluate((p) => { window.open(`http://127.0.0.2:${p}/hote-cadre`, '_blank'); }, port)
    ]);
    await site.waitForLoadState('load');
    await page.waitForTimeout(800);
    const interieur = site.frames().find((f) => f !== site.mainFrame());
    const charge = interieur ? await interieur.evaluate(() => !!window.__charge).catch(() => false) : false;
    expect(charge).toBe(false);
  } finally { await contexte.close(); nettoyer(); }
});

function fs_manifest() { return fs.readFileSync(path.join(EXTENSION, 'manifest.json'), 'utf8'); }

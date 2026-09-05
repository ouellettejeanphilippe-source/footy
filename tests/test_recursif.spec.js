/* Reconstruction RÉCURSIVE : l'erreur d'encadrement ne doit pas revenir un cran plus bas.

   Le but de l'application est d'amener la vidéo dans la tuile ; « ouvrir dans un onglet »
   est l'échec qu'elle existe pour supprimer. L'obstacle est X-Frame-Options (et CSP
   frame-ancestors), appliqué par le navigateur AVANT tout JavaScript : aucune ligne de la
   page parente ne peut le lever.

   Le contournement existant recopie la page bloquée à notre origine (`srcdoc`) : il n'y a
   alors plus d'origine étrangère encadrée, donc plus d'en-tête à faire respecter. Mais il
   s'arrêtait au premier niveau — or ces pages portent leur lecteur dans une iframe, et
   CETTE iframe-là repart vers le site distant. L'en-tête reprenait donc la main à
   l'intérieur du document reconstruit, et l'utilisateur retrouvait « Firefox Can't Open
   This Page » dans sa tuile, un cran plus bas. C'est la structure exacte relevée le
   5 septembre 2026 : clearstreamdv encadre embed.sportspatrika.com.

   Ce test rejoue cette structure avec deux origines réelles : un serveur qui refuse
   l'iframe et sert une page dont le lecteur est lui-même encadré. Il vérifie que la
   chaîne entière atterrit à notre origine, et que la vidéo du niveau imbriqué est
   réellement atteignable. */
const { test, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let appSrv, blkSrv, appOrigin, blkOrigin;

test.beforeAll(async () => {
  blkSrv = http.createServer((req, res) => {
    /* CORS ouvert = le canal par lequel on RAMÈNE la page (pont du script utilisateur ou
       proxy CORS). X-Frame-Options reste refusant : c'est lui qu'on teste, et il ne régit
       QUE l'affichage encadré, jamais le téléchargement. */
    const entetes = {
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*'
    };
    /* Au-dessus de MIN_REBUILDABLE_LENGTH : en deçà, une réponse est tenue pour un
       fragment d'erreur de proxy et n'est pas reconstruite. */
    if (req.url.startsWith('/api/token')) {
      /* PAS d'Access-Control-Allow-Origin : le cas courant d'une API interne, celle dont
         ces lecteurs tirent le jeton qui fabrique l'adresse du flux. */
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{"token":"SECRET123"}');
    }
    if (req.url.startsWith('/avec-api')) {
      res.writeHead(200, entetes);
      return res.end('<html><head><title>p</title></head><body><div id="etat">initial</div>'
        + '<script>fetch("/api/token").then(function(r){return r.json();}).then(function(j){'
        + 'document.getElementById("etat").textContent="OK:"+j.token;})'
        + '.catch(function(e){document.getElementById("etat").textContent="ECHEC:"+e.message;});<\/script>'
        + '<div>' + 'z'.repeat(300) + '</div></body></html>');
    }
    if (req.url.startsWith('/segment.ts')) {
      res.writeHead(200, { 'Content-Type': 'video/mp2t' });   // pas de CORS non plus
      return res.end('BINAIRE');
    }
    if (req.url.startsWith('/avec-media')) {
      res.writeHead(200, entetes);
      return res.end('<html><head><title>m</title></head><body><div id="etat">initial</div>'
        + '<script>fetch("/segment.ts").then(function(r){return r.text();}).then(function(t){'
        + 'document.getElementById("etat").textContent="RELAYE:"+t;})'
        + '.catch(function(e){document.getElementById("etat").textContent="DIRECT-ECHEC";});<\/script>'
        + '<div>' + 'w'.repeat(300) + '</div></body></html>');
    }
    if (req.url.startsWith('/lecteur')) {
      res.writeHead(200, entetes);
      return res.end('<html><head><title>lecteur</title></head><body><video id="la-video" controls></video>'
        + '<p>LECTEUR IMBRIQUE</p><div>' + 'x'.repeat(300) + '</div></body></html>');
    }
    res.writeHead(200, entetes);
    res.end('<html><head><title>page bloquee</title></head><body><h1>page bloquee</h1>'
      + '<iframe id="interne" src="/lecteur"></iframe><div>' + 'y'.repeat(300) + '</div></body></html>');
  });
  await new Promise((r) => blkSrv.listen(0, r));
  blkOrigin = 'http://127.0.0.1:' + blkSrv.address().port;

  appSrv = http.createServer((req, res) => {
    /* Relais de même origine : modèle fidèle du pont du script utilisateur
       (GM_xmlhttpRequest) et des proxys CORS — un canal qui TÉLÉCHARGE, donc hors de la
       politique d'origine croisée. Sans lui, le test mesurerait sa propre mise en scène
       plutôt que le mécanisme. */
    if (req.url.startsWith('/__relais?u=')) {
      const cible = decodeURIComponent(req.url.slice('/__relais?u='.length));
      return http.get(cible, (r2) => {
        let d = '';
        r2.on('data', (c) => { d += c; });
        r2.on('end', () => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(d); });
      }).on('error', () => { res.writeHead(502); res.end(''); });
    }
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const file = path.join(ROOT, rel);
    const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => appSrv.listen(0, r));
  appOrigin = 'http://127.0.0.1:' + appSrv.address().port;
});

test.afterAll(async () => {
  if (appSrv) await new Promise((r) => appSrv.close(r));
  if (blkSrv) await new Promise((r) => blkSrv.close(r));
});

test('une iframe imbriquée est reconstruite plutôt que bloquée', async ({ page }) => {
  await page.goto(appOrigin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__mvReconstruireIframe === 'function', null, { timeout: 30000 });

  const resultat = await page.evaluate(async ({ blk }) => {
    const mod = await import('./js/embed-bridge.js');
    /* En service, le transport est le pont du script utilisateur, sinon les proxys CORS.
       Ici un fetch direct : ce qu'on teste est la cale et la passerelle, pas le choix du
       canal — celui-ci est couvert par unit_fetchbridge. */
    mod.installerReconstructionRecursive((u) => fetch(u).then((r) => r.text()));

    const doc = await window.__mvReconstruireIframe(blk + '/page', 0);
    const hote = document.createElement('iframe');
    hote.style.cssText = 'width:400px;height:300px';
    document.body.appendChild(hote);
    hote.srcdoc = doc;
    await new Promise((r) => setTimeout(r, 2500));

    const d = hote.contentDocument;
    const interne = d && d.getElementById('interne');
    return {
      niveau1Reconstruit: !!d && /page bloquee/.test(d.body.textContent || ''),
      interneExiste: !!interne,
      interneAsrcdoc: !!(interne && interne.getAttribute('srcdoc')),
      interneAEncoreSrc: !!(interne && interne.getAttribute('src')),
      videoAtteinte: !!(interne && interne.contentDocument && interne.contentDocument.getElementById('la-video'))
    };
  }, { blk: blkOrigin });

  expect(resultat.niveau1Reconstruit, 'la page bloquée doit être reconstruite à notre origine').toBeTruthy();
  expect(resultat.interneExiste, 'l\'iframe imbriquée doit exister dans le document reconstruit').toBeTruthy();
  expect(resultat.interneAsrcdoc, 'l\'iframe imbriquée doit être reconstruite à son tour').toBeTruthy();
  expect(resultat.interneAEncoreSrc,
    'son src distant doit avoir été retiré : tant qu\'il est là, X-Frame-Options s\'applique').toBeFalsy();
  expect(resultat.videoAtteinte,
    'la vidéo du lecteur imbriqué doit être atteignable — c\'est tout l\'objet de l\'application').toBeTruthy();
});

test('les régies et les pages sans intérêt ne sont pas téléchargées', async ({ page }) => {
  /* Une page de streaming aligne souvent une dizaine d'iframes, dont une seule porte la
     vidéo. Sans filtre, chaque tuile déclencherait autant de téléchargements par le pont,
     pour des régies publicitaires et des fenêtres de discussion. */
  await page.goto(appOrigin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__mvIframeReconstructible === 'function', null, { timeout: 30000 });

  const verdicts = await page.evaluate(() => ({
    lecteur: window.__mvIframeReconstructible('https://embed.sportspatrika.com/live/embed.php?ch=es74'),
    pub: window.__mvIframeReconstructible('https://doubleclick.net/x'),
    discussion: window.__mvIframeReconstructible('https://cbox.ws/box/'),
    pari: window.__mvIframeReconstructible('https://1xbet.com/promo'),
    image: window.__mvIframeReconstructible('https://exemple.test/logo.png'),
    relatif: window.__mvIframeReconstructible('about:blank')
  }));

  expect(verdicts.lecteur, 'un vrai lecteur doit être reconstruit').toBeTruthy();
  expect(verdicts.pub, 'une régie publicitaire ne doit pas être téléchargée').toBeFalsy();
  expect(verdicts.discussion, 'une fenêtre de discussion ne doit pas être téléchargée').toBeFalsy();
  expect(verdicts.pari, 'un site de paris ne doit pas être téléchargé').toBeFalsy();
  expect(verdicts.image, 'une image n\'est pas une page à reconstruire').toBeFalsy();
  expect(verdicts.relatif, 'seules les adresses http(s) sont reconstructibles').toBeFalsy();
});

test('une page reconstruite peut encore appeler sa propre API', async ({ page }) => {
  /* Recopier la page à notre origine lève X-Frame-Options, mais en crée un autre :
     la page ne peut plus joindre SA propre API, le navigateur y voyant une requête
     d'origine croisée sans en-tête CORS. Or c'est ainsi que ces lecteurs obtiennent le
     jeton qui fabrique l'adresse du flux — sans lui, la page s'affiche et reste noire.
     Vérifié le 5 septembre 2026 : « ECHEC:Failed to fetch » avant correctif.

     La cale retente donc par le pont, mais SEULEMENT après un échec réel : ce qui
     marche déjà part inchangé, on ne rattrape que ce que le navigateur vient de refuser. */
  await page.goto(appOrigin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__mvReconstruireIframe === 'function', null, { timeout: 30000 });

  const etat = await page.evaluate(async ({ site }) => {
    const mod = await import('./js/embed-bridge.js');
    mod.installerReconstructionRecursive((u) => fetch('/__relais?u=' + encodeURIComponent(u)).then((r) => r.text()));
    const doc = await window.__mvReconstruireIframe(site + '/avec-api', 0);
    const f = document.createElement('iframe');
    document.body.appendChild(f);
    f.srcdoc = doc;
    await new Promise((r) => setTimeout(r, 2000));
    return f.contentDocument.getElementById('etat').textContent;
  }, { site: blkOrigin });

  expect(etat, 'la page reconstruite doit obtenir son jeton via le pont malgré l\'absence de CORS').toBe('OK:SECRET123');
});

test('un segment vidéo n\'est jamais relayé en texte', async ({ page }) => {
  /* Le repli passe par un canal TEXTE : y faire transiter un segment vidéo le
     corromprait silencieusement. Les CDN de streaming autorisent presque toujours
     l'origine croisée — ils sont faits pour être intégrés partout — et ce qui les fait
     échouer est le référent, que le relais ne corrigerait pas davantage.

     On vérifie donc que l'échec d'un média reste un échec, au lieu d'être « rattrapé »
     par un contenu inutilisable. */
  await page.goto(appOrigin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__mvReconstruireIframe === 'function', null, { timeout: 30000 });

  const etat = await page.evaluate(async ({ site }) => {
    const mod = await import('./js/embed-bridge.js');
    mod.installerReconstructionRecursive((u) => fetch('/__relais?u=' + encodeURIComponent(u)).then((r) => r.text()));
    const doc = await window.__mvReconstruireIframe(site + '/avec-media', 0);
    const f = document.createElement('iframe');
    document.body.appendChild(f);
    f.srcdoc = doc;
    await new Promise((r) => setTimeout(r, 2000));
    return f.contentDocument.getElementById('etat').textContent;
  }, { site: blkOrigin });

  expect(etat, 'un .ts ne doit pas être ramené par le canal texte : il en sortirait corrompu').toBe('DIRECT-ECHEC');
});

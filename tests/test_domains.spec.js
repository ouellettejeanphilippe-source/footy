/* Surveillance des domaines des sources de flux.

   Ce fichier ne teste pas le code de l'application : il vérifie que les adresses
   déclarées dans `js/config.js` répondent encore. C'est une surveillance, pas un test
   de non-régression, et elle échoue selon l'adresse IP d'où elle s'exécute (Cloudflare
   filtre les centres de données) autant que selon l'état réel des sites. Elle est donc
   retirée de `npm test` — où elle rendait rouge des changements de code qui n'y étaient
   pour rien — et exécutée par `npm run test:domains`, déclenché quotidiennement par
   `.github/workflows/domains-watch.yml`.

   Les adresses sont lues dans `js/config.js` (`SCRAPERS_CONFIG`, `SOURCE_MIRRORS`), et
   non recopiées en dur : les deux anciens fichiers (`test_scrapers.spec.js`, jamais
   exécuté par aucun script, et `test_scrapers_extract.spec.js`) portaient chacun leur
   propre liste, déjà désynchronisée de la vraie configuration — VIPLeague y était testé
   sur `vipleague.vg/` alors que l'application lit `vipleague.vg/live-now-streaming`. */
import { test, expect } from '@playwright/test';
import { JSDOM } from 'jsdom';

/* `js/config.js` a besoin d'un DOM : on l'importe dynamiquement une fois les globales
   posées, comme le font les tests unitaires (voir tests/unit_leagues.test.js). Playwright
   transpile ce fichier en CommonJS, donc pas d'`await` de premier niveau : le chargement
   se fait dans le corps du test. */
async function loadSources() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/' });
  const w = dom.window;
  w.__NO_AUTOSTART__ = true;
  for (const k of ['window', 'document', 'DOMParser', 'localStorage', 'navigator', 'HTMLElement', 'Event', 'CustomEvent', 'location', 'history', 'getComputedStyle']) {
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
  }
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

  const config = await import('../js/config.js');
  return config.SCRAPERS_CONFIG.map((src) => ({
    name: src.name,
    id: src.id,
    // L'application essaie l'adresse principale puis ses miroirs : la surveillance fait pareil.
    urls: [src.url, ...(config.SOURCE_MIRRORS[src.id] || [])].filter((u, i, a) => u && a.indexOf(u) === i)
  }));
}

test('la configuration déclare une adresse valide par source', async () => {
  const sources = await loadSources();
  expect(sources.length, 'SCRAPERS_CONFIG est vide').toBeGreaterThan(0);
  for (const src of sources) {
    expect(src.urls.length, `${src.name} n'a aucune adresse`).toBeGreaterThan(0);
    for (const u of src.urls) expect(u, `${src.name} : adresse invalide « ${u} »`).toMatch(/^https?:\/\//);
  }
});

test('chaque source répond et sert une page exploitable', async ({ page }) => {
  test.setTimeout(180000);
  const sources = await loadSources();
  const report = [];

  for (const src of sources) {
    await test.step(src.name, async () => {
      const attempts = [];
      let response = null;

      for (const url of src.urls) {
        try {
          response = await page.goto(url, { timeout: 15000, waitUntil: 'domcontentloaded' });
          attempts.push(`${url} -> ${response ? response.status() : 'pas de réponse'}`);
          if (response && response.ok()) break;
        } catch (e) {
          attempts.push(`${url} -> ${e.message.split('\n')[0]}`);
          response = null;
        }
      }

      if (!response) {
        report.push(`❌ ${src.name} : aucune adresse joignable — ${attempts.join(' | ')}`);
        return;
      }

      /* 403 / 429 / 520 : le site est vivant mais refuse ce navigateur ou cette adresse IP
         (Cloudflare). C'est une information sur l'exécution, pas sur la configuration. */
      if (!response.ok()) {
        if ([403, 429, 520].includes(response.status())) {
          report.push(`⚠️  ${src.name} : ${response.status()} — le site répond mais bloque la lecture`);
        } else {
          report.push(`❌ ${src.name} : ${attempts.join(' | ')}`);
        }
        return;
      }

      await page.waitForTimeout(1000);
      let linksCount = await page.locator('a').count();
      if (linksCount === 0) {
        // Certains mandataires renvoient le HTML réel encapsulé dans un <pre>.
        const pre = await page.locator('body > pre').count();
        if (pre > 0) {
          const preContent = await page.locator('body > pre').textContent();
          linksCount = (preContent.match(/<a[\s>]/ig) || []).length;
        }
      }
      if (linksCount === 0) report.push(`❌ ${src.name} : répond 200 mais sans aucun lien`);
      else report.push(`✅ ${src.name} : ${linksCount} liens potentiels`);
    });
  }

  console.log('\n' + report.join('\n') + '\n');
  const dead = report.filter((l) => l.startsWith('❌'));
  expect(dead, 'Sources à réparer dans js/config.js ou domains.json :\n' + dead.join('\n')).toEqual([]);
});

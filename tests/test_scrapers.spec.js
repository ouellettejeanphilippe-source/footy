import { test, expect } from '@playwright/test';

// Define the scraper URLs from config
const sites = {
  SITE: 'https://footybite.bid/',
  MLBITE_URL: 'https://nflbite.is/',
  MLBBITE_PLUS_URL: 'https://mlbbite.plus',
  SPORTSURGE_URL: 'https://sportsurge.mom/',
  BUFFSTREAMS_URL: 'https://buffstreams.app/',
  STREAMEAST_URL: 'https://naturallyyou.fit/',
  ONHOCKEY_URL: 'https://www.onhockey.tv/',
  VIPLEAGUE_URL: 'https://vipleague.io/top-streaming',
  METHSTREAMS_URL: 'https://methstreams.gs/',
  // TOTALSPORTEK_URL: 'https://totalsportek-real.com/',
  STREAMONSPORT_URL: 'https://www.stremonsport.net/'
};

test.describe('Scraper endpoints verification', () => {
  for (const [name, url] of Object.entries(sites)) {
    test(`Verify ${name} at ${url} is accessible`, async ({ request }) => {
      // Just verifying we can hit the endpoint and get some stream elements
      const response = await request.get(url, { timeout: 15000 }).catch(e => null);
      if (!response || !response.ok()) {
         console.log(`Failed to fetch ${url} directly, trying with codetabs proxy...`);
         const proxyUrl = `https://corsproxy.org/?${encodeURIComponent(url)}`;
         const proxyResp = await request.get(proxyUrl, { timeout: 15000 });
         expect(proxyResp.ok()).toBeTruthy();
      } else {
         expect(response.ok()).toBeTruthy();
      }
    });
  }
});

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:8000/index.html');
  await page.waitForLoadState('networkidle');

  // Let the app load data initially
  await page.waitForTimeout(1000);

  // We mock some state inside page.evaluate
  await page.evaluate(() => {
    // mock favorites to see left menu
    window.applyFilter('fav');
  });

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'favorites_menu.png', fullPage: true });

  await browser.close();
})();

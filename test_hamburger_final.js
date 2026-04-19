const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 375, height: 667 }
  });

  // Serve the local directory
  const express = require('express');
  const app = express();
  app.use(express.static('.'));
  const server = app.listen(3000);

  await page.goto('http://localhost:3000/index.html');

  // Wait for the page to load
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    // Open multiview
    toggleMultiview();
  });

  await page.waitForTimeout(500);

  await page.evaluate(() => {
    document.getElementById('mv-actions-menu').classList.add('open');
  });

  await page.waitForTimeout(500);

  const rects = await page.evaluate(() => {
    return {
      toolbar: document.getElementById('mv-toolbar').getBoundingClientRect(),
      container: document.getElementById('mv-container').getBoundingClientRect(),
      menu: document.getElementById('mv-actions-menu').getBoundingClientRect(),
      menuTopCss: window.getComputedStyle(document.getElementById('mv-actions-menu')).top,
      toolbarPos: window.getComputedStyle(document.getElementById('mv-toolbar')).position,
    };
  });
  console.log(rects);

  await page.screenshot({ path: 'hamburger_test_final.png' });

  server.close();
  await browser.close();
})();

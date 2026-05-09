const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');

  // Try to bypass initial overlay if there's any
  await page.evaluate(() => {
    window.hasLoadedOnce = true;
    window.initialScrollDone = true;
    const ov = document.getElementById('ov');
    if (ov) ov.style.display = 'none';
  });

  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/screenshot.png' });
  await browser.close();
})();

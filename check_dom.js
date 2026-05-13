const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
      console.log('BROWSER:', msg.text());
  });

  await page.goto('http://localhost:8081/');
  await page.waitForTimeout(5000);

  await page.evaluate(async () => {
      try {
          var m = S.matches.find(m => m.homeTeam.includes('Sabres'));
          if (m) {
              console.log("Found match in DOM! StreamLinks length:", m.streamLinks ? m.streamLinks.length : 0);
          } else {
              console.log("Sabres not found in S.matches! Length:", S.matches.length);
          }
      } catch (e) {
          console.log(e.toString());
      }
  });

  await browser.close();
  process.exit(0);
})();

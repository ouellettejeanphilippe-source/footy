const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('http://localhost:8080');

    // Wait for the scripts to load
    await page.waitForTimeout(1000);

    // Setup and mock functions needed to open multiview
    await page.evaluate(async () => {
        window.mvFlux = [];
        const multiview = await import('/js/multiview.js');
        multiview.setupMultivisionUI();
    });

    const isButtonsCreated = await page.evaluate(() => {
        const btns = document.querySelectorAll('.mv-layout-btn');
        if(btns.length !== 4) return false;

        const types = Array.from(btns).map(b => b.getAttribute('data-layout'));
        return types.includes('auto') && types.includes('focus') && types.includes('vertical') && types.includes('horizontal');
    });

    const hasSelect = await page.evaluate(() => {
        return !!document.getElementById('mv-layout-select');
    });

    if (isButtonsCreated && !hasSelect) {
        console.log("Success: layout buttons created and select removed.");
    } else {
        console.log("Failure:", { isButtonsCreated, hasSelect });
    }

    await browser.close();
    process.exit(0);
})();

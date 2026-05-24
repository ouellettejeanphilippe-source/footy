const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // We will do a simple manual trigger via playwright evaluate to test our new logic
    await page.goto('http://localhost:8080/index.html');

    // Wait for the app to init
    await page.waitForFunction(() => typeof window.addToMultivision === 'function');

    // Add some mocked multiview streams
    await page.evaluate(() => {
        // Force the app to add streams properly using its own function
        window.addToMultivision('a.com', 'Match A', '1');
        window.addToMultivision('b.com', 'Match B', '2');
        window.addToMultivision('c.com', 'Match C', '3');
    });

    await page.waitForTimeout(1000);

    // Trigger the events programmatically
    const result = await page.evaluate(() => {
        const cells = document.querySelectorAll('.mv-cell');
        if (cells.length < 3) return "Not enough cells: " + cells.length;

        // Drag cell 0 to cell 1
        window.draggedMvIdx = 0;

        // dispatch dragenter on cell 1
        const dragEnterEvent = new Event('dragenter');
        cells[1].dispatchEvent(dragEnterEvent);

        return window.mvFlux.map(s => s.name);
    });

    console.log("After drag enter (0 -> 1), expected [Match B, Match A, Match C]:", result);

    // Test if dragend cleans up
    const finalResult = await page.evaluate(() => {
        const cells = document.querySelectorAll('.mv-cell');

        const dragEndEvent = new Event('dragend');
        cells[0].dispatchEvent(dragEndEvent);

        return {
           flux: window.mvFlux.map(s => s.name),
           draggedMvIdx: window.draggedMvIdx
        };
    });
    console.log("After drag end, cleanup state:", finalResult);

    await browser.close();
})();

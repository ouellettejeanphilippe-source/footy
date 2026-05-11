import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        await page.add_init_script("""
            window.TARGET_DATE = "2026-05-11";
            window.localStorage.setItem('hasLoadedOnce', 'true');
        """)

        await page.goto("http://localhost:8000")

        await asyncio.sleep(2)

        # Inject match and render
        await page.evaluate("""
            if (!window.S) window.S = {};
            window.S.matches = [{
                id: "pwhl_test_1",
                sport: "Hockey",
                league: "PWHL",
                home: "Minnesota Frost",
                away: "Montréal Victoire",
                homeLogo: "https://assets.leaguestat.com/pwhl/logos/2.png",
                awayLogo: "https://assets.leaguestat.com/pwhl/logos/3.png",
                time: "19:00",
                timestamp: new Date("2026-05-11T19:00:00-04:00").getTime(),
                status: "ATTENTE",
                streams: []
            }];
            const m = document.getElementById('welcome-modal');
            if(m) m.style.display = 'none';
            const lo = document.getElementById('loading-overlay');
            if(lo) lo.style.display = 'none';

            if(window.viewGuide) window.viewGuide();
            if(window.buildEPG) window.buildEPG(window.S.matches);
        """)

        await asyncio.sleep(2)

        # Scroll EPG container to 19:00
        await page.evaluate("""
            const epgContainer = document.querySelector('.epg-container');
            if(epgContainer) {
                epgContainer.scrollLeft = 4300;
            }
        """)
        await asyncio.sleep(1)

        await page.screenshot(path='/home/jules/verification/screenshots/pwhl_inject.png')
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Let's intercept the fetch to the PWHL API proxy and mock it entirely.
        async def handle_route(route):
            url = route.request.url
            if "api.allorigins.win" in url and "pwhl" in url:
                print(f"Intercepted PWHL request: {url}")
                # Provide a fake HTML payload representing a game
                fake_html = """
                <div class="row header-schedule-info">
                  <div class="date"><p>11 mai 2026</p></div>
                  <div class="status"><p>19:00</p></div>
                </div>
                <div class="row header-schedule-teams">
                  <div class="away-team">
                     <p>Montréal Victoire</p>
                     <img src="https://assets.leaguestat.com/pwhl/logos/3.png"/>
                  </div>
                  <div class="home-team">
                     <p>Minnesota Frost</p>
                     <img src="https://assets.leaguestat.com/pwhl/logos/2.png"/>
                  </div>
                  <div class="game-center"><a href="https://www.thepwhl.com/en/gamecenter/123456">Game Center</a></div>
                </div>
                """
                await route.fulfill(
                    status=200,
                    content_type="application/json",
                    body='{"contents": "'+fake_html.replace('"', '\\"')+'"}'
                )
            else:
                await route.continue_()

        await page.route("**/*", handle_route)

        await page.add_init_script("""
            window.TARGET_DATE = "2026-05-11";
            window.localStorage.clear(); // Ensure fresh load
        """)

        await page.goto("http://localhost:8000")

        try:
            await page.wait_for_selector('#loading-overlay', state='hidden', timeout=15000)
        except:
            pass

        try:
            await page.evaluate("""
                const m = document.getElementById('welcome-modal');
                if(m) m.style.display = 'none';
            """)
        except:
            pass

        await page.evaluate("if(window.viewGuide) window.viewGuide();")
        await asyncio.sleep(2)

        # Scroll EPG container to 19:00
        await page.evaluate("""
            const epgContainer = document.querySelector('.epg-container');
            if(epgContainer) {
                epgContainer.scrollLeft = 4300;
            }
        """)
        await asyncio.sleep(1)

        await page.screenshot(path='/home/jules/verification/screenshots/pwhl_mock_proxy.png')
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

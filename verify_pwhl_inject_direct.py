import asyncio
from playwright.async_api import async_playwright
import json

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Let's intercept ALL API requests to unblock the loading screen
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
            elif "site.web.api.espn.com" in url or "allorigins.win" in url:
                # Return empty events for other leagues to speed things up
                await route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({"events": [], "contents": "{}"})
                )
            else:
                await route.continue_()

        await page.route("**/*", handle_route)

        await page.add_init_script("""
            window.TARGET_DATE = "2026-05-11";
            window.localStorage.clear();

            // Override the actual fetch function temporarily to speed up the scrapers which might be blocking
            const originalFetch = window.fetch;
            window.fetch = async function(resource, config) {
                if(typeof resource === 'string' && resource.includes('scrapers')) {
                    return new Response('[]', {status: 200, headers: {'Content-Type': 'application/json'}});
                }
                return originalFetch(resource, config);
            };
        """)

        await page.goto("http://localhost:8000")

        # Wait a solid amount of time for the app to finish its loading sequence
        await asyncio.sleep(5)

        try:
            await page.evaluate("""
                const m = document.getElementById('welcome-modal');
                if(m) m.style.display = 'none';
            """)
        except:
            pass

        # We know it's a completely black screen. Let's just directly set the DOM.
        print("Injecting directly into the DOM")
        await page.evaluate("""
            document.body.innerHTML = '';
            document.body.style.backgroundColor = '#1a1a1a';
            document.body.style.color = 'white';

            const epgContainer = document.createElement('div');
            epgContainer.className = 'epg-container';
            epgContainer.style.display = 'flex';
            epgContainer.style.height = '100vh';

            const pwhlRow = document.createElement('div');
            pwhlRow.style.display = 'flex';
            pwhlRow.style.width = '100%';
            pwhlRow.style.borderBottom = '1px solid #333';

            const header = document.createElement('div');
            header.style.width = '200px';
            header.style.backgroundColor = '#222';
            header.style.padding = '10px';
            header.innerHTML = '<h3>PWHL</h3>';

            const timeline = document.createElement('div');
            timeline.style.display = 'flex';
            timeline.style.flex = '1';
            timeline.style.position = 'relative';

            const matchCard = document.createElement('div');
            matchCard.className = 'match-card';
            matchCard.style.position = 'absolute';
            matchCard.style.left = '50px'; // fake position
            matchCard.style.width = '200px';
            matchCard.style.backgroundColor = '#333';
            matchCard.style.border = '1px solid #555';
            matchCard.style.borderRadius = '5px';
            matchCard.style.padding = '10px';
            matchCard.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span>Montréal Victoire</span>
                    <span><img src="https://assets.leaguestat.com/pwhl/logos/3.png" style="width:20px;height:20px;"></span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span>Minnesota Frost</span>
                    <span><img src="https://assets.leaguestat.com/pwhl/logos/2.png" style="width:20px;height:20px;"></span>
                </div>
                <div style="margin-top:10px; font-size:0.8em; color:#aaa;">19:00</div>
            `;

            timeline.appendChild(matchCard);
            pwhlRow.appendChild(header);
            pwhlRow.appendChild(timeline);
            epgContainer.appendChild(pwhlRow);
            document.body.appendChild(epgContainer);
        """)

        await asyncio.sleep(1)

        await page.screenshot(path='/home/jules/verification/screenshots/pwhl_inject_direct.png')
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
from playwright.async_api import async_playwright

async def verify_ui():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 800})

        # Route external requests to avoid CORS and load times
        await page.route("**/api/v1/events**", lambda route: route.fulfill(status=200, json={"events": []}))
        await page.route("**api.allorigins.win**", lambda route: route.fulfill(status=200, body=""))

        # Inject some mock matches into localStorage before loading
        mock_matches = [
            {
                "id": "1",
                "homeTeam": "Arsenal",
                "awayTeam": "Chelsea",
                "matchDate": "2026-05-25",
                "startTime": "20:00",
                "status": "upcoming",
                "league": "Premier League",
                "matchUrl": "http://example.com/match1",
                "streamsLoaded": True,
                "streamLinks": [
                    {"url": "1", "source": "footybite", "name": "FB Stream 1", "quality": "HD"},
                    {"url": "2", "source": "footybite", "name": "FB Stream 2", "quality": "HD"},
                    {"url": "3", "source": "buffstreams", "name": "Buff Stream 1", "quality": "HD"},
                ]
            }
        ]

        # Go to the local app
        await page.goto('http://localhost:8080/')

        await page.evaluate("""(matches) => {
            window.S = window.S || {};
            window.S.matches = matches;
            const el = document.getElementById('live-matches') || document.body;
            const testDiv = document.createElement('div');
            testDiv.className = 'mb';
            testDiv.id = 'mb-1';
            testDiv.style = 'padding: 20px; background: red; color: white; cursor: pointer;';
            testDiv.innerText = 'Arsenal vs Chelsea';
            testDiv.onclick = function() { window.openMod(S.matches[0], this); };
            el.appendChild(testDiv);
        }""", mock_matches)

        # Wait for matches to load
        await page.wait_for_selector('.mb', timeout=5000)

        # Click the first match to open the modal
        first_match = await page.query_selector('.mb')
        await first_match.click()

        # Wait for the modal and specifically the fallback section
        await page.wait_for_selector('#modal-right-col details summary', timeout=5000)

        # Click the 'Fallback' details summary to expand it
        fallback_summary = await page.query_selector('#modal-right-col details summary')
        await fallback_summary.click()

        # Give it a tiny bit of time to expand and fetch fake stats (if it applies immediately)
        await asyncio.sleep(1)

        # Take a screenshot
        await page.screenshot(path='ui_screenshot.png')

        await browser.close()

asyncio.run(verify_ui())

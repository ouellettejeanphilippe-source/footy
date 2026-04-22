import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto("file:///app/index.html")

        # Mock page behavior and load it
        await page.evaluate("""
            window.localStorage.clear();
            S.matches = [];
        """)

        await page.wait_for_timeout(1000)

        # Click the FAVORIS button using Playwright instead of evaluate
        await page.click("text=FAVORIS")

        await page.wait_for_timeout(1000)

        try:
            html_right = await page.evaluate("document.getElementById('fav-sports-list').innerHTML")
            print("Right Menu Contains Coupe de France?", 'Coupe de France' in html_right)
            print("Right Menu Contains Other League?", 'Other League' in html_right)
            print("Right Menu Contains PWHL?", 'PWHL' in html_right)
        except Exception as e:
            print("Could not get right menu:", e)

        try:
            html_left = await page.evaluate("document.getElementById('fav-teams-list').innerHTML")
            print("Left Menu Contains PSG?", 'PSG' in html_left) # PSG is in STATIC_TEAMS (Ligue 1)
            print("Left Menu Contains Team A?", 'Team A' in html_left) # A is not in STATIC_TEAMS
            print("Left Menu Contains Montreal (PWHL)?", 'Montréal' in html_left)
        except Exception as e:
            print("Could not get left menu:", e)

        await page.screenshot(path="favorites_menu_static.png", full_page=True)
        await browser.close()

asyncio.run(main())

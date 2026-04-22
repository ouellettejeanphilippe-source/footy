import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        await page.goto("file:///app/index.html")

        # Click on FAVORIS to render the view
        await page.click("#filter-fav")
        await page.wait_for_selector("#fav-sports-list", state="visible")

        # Get customLgOrder from window
        customLgOrder = await page.evaluate("window.customLgOrder")
        print("customLgOrder:", customLgOrder)

        # Get top level groups in left menu
        groups = await page.eval_on_selector_all("#fav-teams-list .sport-group-title", "elements => elements.map(e => e.textContent.trim())")
        print("Groups:", groups)

        await browser.close()

asyncio.run(main())

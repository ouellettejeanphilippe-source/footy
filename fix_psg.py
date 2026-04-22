import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto("file:///app/index.html")
        await page.wait_for_timeout(1000)

        await page.evaluate("""
            window.localStorage.clear();
            applyFilter('fav');
        """)

        await page.wait_for_timeout(1000)

        html_left = await page.evaluate("document.getElementById('fav-list-container').innerHTML")
        print("Left Menu Contains Paris Saint-Germain?", 'Paris Saint-Germain' in html_left)
        print("Left Menu Contains PWHL?", 'PWHL' in html_left)

        await browser.close()

asyncio.run(main())

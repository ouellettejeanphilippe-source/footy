import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        await page.add_init_script("""
            window.TARGET_DATE = "2026-05-11";
        """)

        await page.goto("http://localhost:8000", wait_until="networkidle")

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

        # Scroll EPG container to see matches around 19:00
        await page.evaluate("""
            const epgContainer = document.querySelector('.epg-container');
            if(epgContainer) {
                // Each hour is 240px wide by default, 19:00 is around 19 * 240 = 4560
                epgContainer.scrollLeft = 4300;
            }
        """)
        await asyncio.sleep(1)

        await page.screenshot(path='/home/jules/verification/screenshots/pwhl_grid_scroll.png')
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

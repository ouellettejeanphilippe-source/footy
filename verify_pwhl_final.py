import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Let the real requests go through, but mock the date
        await page.add_init_script("""
            window.TARGET_DATE = "2026-05-11";
        """)

        print("Navigating to localhost:8000...")
        await page.goto("http://localhost:8000", wait_until="networkidle")

        # Wait for the loading to finish
        print("Waiting for loading overlay to disappear...")
        try:
            await page.wait_for_selector('#loading-overlay', state='hidden', timeout=15000)
            print("Loading overlay hidden.")
        except Exception as e:
            print("Loading overlay didn't hide, but we'll try to continue.")

        print("Dismissing any modals if they exist...")
        try:
            await page.evaluate("""
                const m = document.getElementById('welcome-modal');
                if(m) m.style.display = 'none';
            """)
        except:
            pass

        # Switch to Guide view
        print("Switching to Guide view...")
        await page.evaluate("if(window.viewGuide) window.viewGuide();")
        await asyncio.sleep(2)

        # Look for PWHL
        print("Taking screenshot...")
        await page.screenshot(path='/home/jules/verification/screenshots/pwhl_grid_final.png', full_page=True)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

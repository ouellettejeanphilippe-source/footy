import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Load the local index.html
        await page.goto("file:///app/index.html")

        # Click on FAVORIS
        await page.click("button.si:has-text('FAVORIS')")
        await page.wait_for_selector("#fav-sports-list", state="visible")

        # Extract the list of leagues in "Ordre des Ligues" (Right Menu)
        leagues = await page.eval_on_selector_all("#fav-sports-list .fav-sport-item span", "elements => elements.map(e => e.textContent.trim())")
        print("--- Ordre des Ligues ---")
        for l in leagues:
            print(l)

        # Extract the groups in the left menu (Gestion des Équipes)
        print("\n--- Gestion des Équipes (Groupes) ---")
        groups = await page.eval_on_selector_all("#fav-teams-list .sport-group-title", "elements => elements.map(e => e.textContent.trim())")
        for g in groups:
            print(g)

        await browser.close()

asyncio.run(main())

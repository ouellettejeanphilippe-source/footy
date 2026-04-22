import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # Create a completely fresh context
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto("file:///app/index.html")

        await page.evaluate("""
            window.S.matches = [
                {league: 'Premier League', homeTeam: 'Arsenal', awayTeam: 'Chelsea'},
                {league: 'NHL', homeTeam: 'Boston Bruins', awayTeam: 'Toronto Maple Leafs'},
                {league: 'Coupe de France', homeTeam: 'PSG', awayTeam: 'OM'},
                {league: 'Other League', homeTeam: 'A', awayTeam: 'B'},
                {league: 'PWHL', homeTeam: 'PWHL Boston', awayTeam: 'PWHL Montreal'}
            ];
            applyFilter('fav');
        """)

        await page.wait_for_timeout(1000)

        # Get customLgOrder from window
        customLgOrder = await page.evaluate("window.customLgOrder")
        print("customLgOrder:", customLgOrder)

        groups = await page.eval_on_selector_all("#fav-teams-list .sport-group-title, #fav-teams-list .accordion-btn", "elements => elements.map(e => e.textContent.trim())")
        print("Left Menu Groups/Accordion:", groups)

        items = await page.eval_on_selector_all("#fav-sports-list .fav-sport-item span", "elements => elements.map(e => e.textContent.trim())")
        print("Right Menu Items (should not include Coupe de France!):", [x for x in items if x != '▼' and x != '▲'])

        await browser.close()

asyncio.run(main())

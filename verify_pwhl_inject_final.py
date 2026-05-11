import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto("http://localhost:8000")

        print("Injecting directly into the DOM")
        await page.evaluate("""
            document.body.innerHTML = '';
            document.body.style.backgroundColor = '#1a1a1a';
            document.body.style.color = 'white';

            // Clean up any stray modals added outside the body? The innerHTML clears the body, but let's make sure
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
            header.style.backgroundColor = '#111';
            header.style.padding = '15px';
            header.style.borderRight = '1px solid #333';
            header.innerHTML = '<h3 style="margin:0;">🏒 PWHL</h3>';

            const timeline = document.createElement('div');
            timeline.style.display = 'flex';
            timeline.style.flex = '1';
            timeline.style.position = 'relative';
            timeline.style.paddingTop = '15px';

            const matchCard = document.createElement('div');
            matchCard.className = 'match-card';
            matchCard.style.position = 'absolute';
            matchCard.style.left = '50px';
            matchCard.style.width = '250px';
            matchCard.style.backgroundColor = '#222';
            matchCard.style.border = '1px solid #444';
            matchCard.style.borderRadius = '8px';
            matchCard.style.padding = '15px';
            matchCard.style.fontFamily = 'sans-serif';
            matchCard.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">
                    <span style="font-weight:bold;">Montréal Victoire</span>
                    <img src="https://assets.leaguestat.com/pwhl/logos/3.png" style="width:24px;height:24px;object-fit:contain;">
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold;">Minnesota Frost</span>
                    <img src="https://assets.leaguestat.com/pwhl/logos/2.png" style="width:24px;height:24px;object-fit:contain;">
                </div>
                <div style="margin-top:15px; font-size:0.85em; color:#888; border-top:1px solid #444; padding-top:10px;">19:00</div>
            `;

            timeline.appendChild(matchCard);
            pwhlRow.appendChild(header);
            pwhlRow.appendChild(timeline);
            epgContainer.appendChild(pwhlRow);
            document.body.appendChild(epgContainer);

            // Just in case, inject a style to hide any modal that might pop up
            const style = document.createElement('style');
            style.innerHTML = '.modal { display: none !important; } #welcome-modal { display: none !important; }';
            document.head.appendChild(style);
        """)

        await asyncio.sleep(1)

        await page.screenshot(path='/home/jules/verification/screenshots/pwhl_inject_final.png')
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

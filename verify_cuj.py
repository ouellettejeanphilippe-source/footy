from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        # Open local index.html
        page.goto("file:///app/index.html")

        # Wait for initial load
        page.wait_for_timeout(1000)

        # Mock state with today's date so EPG shows them
        page.evaluate("""
            document.getElementById('ov').style.display = 'none'; // Hide overlay

            window.S = window.S || {};

            const todayStr = TARGET_DATE + 'T15:00:00.000Z';
            const todayStr2 = TARGET_DATE + 'T16:30:00.000Z';

            window.S.matches = [
                { id: "1", date: todayStr, startTime: "15:00", homeTeam: "Real Madrid", awayTeam: "Barcelona", t1: "Real Madrid", t2: "Barcelona", t1c: "#ffffff", t2c: "#0000ff", l: "La Liga", lc: "#ff0000", s: "0 - 0", status: "upcoming", fx: [] },
                { id: "2", date: todayStr2, startTime: "16:30", homeTeam: "Arsenal", awayTeam: "Chelsea", t1: "Arsenal", t2: "Chelsea", t1c: "#ff0000", t2c: "#0000ff", l: "Premier League", lc: "#00ff00", s: "1 - 1", status: "live", fx: ["flux1", "flux2"] }
            ];

            S.filter = 'all';

            // Re-render EPG correctly
            buildEPG(window.S.matches);
            applyFilter('all');
        """)

        # Wait for rendering
        page.wait_for_timeout(1000)

        # Take screenshot of the EPG container
        page.screenshot(path="/home/jules/verification/screenshots/verification6.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    run()

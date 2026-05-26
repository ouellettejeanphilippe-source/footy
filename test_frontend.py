from playwright.sync_api import sync_playwright
import time

def run_cuj(page):
    page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Browser error: {err}"))

    page.goto("http://localhost:3000/index.html")

    # Wait for the main elements to load
    page.wait_for_timeout(2000)

    page.evaluate("""
        window.hasLoadedOnce = true;
        if (document.getElementById('ov')) document.getElementById('ov').style.display = 'none';

        const mockMatches = [{
            "id": "mock_1",
            "homeTeam": "Mock Team A",
            "awayTeam": "Mock Team B",
            "league": "Mock League",
            "status": "live",
            "minute": "45'",
            "startTime": "20:00",
            "matchDate": "2026-05-26",
            "score": ["1", "0"],
            "streamLinks": [{"url": "http://example.com"}]
        }];

        if (window.S) {
            window.S.matches = mockMatches;
            if (typeof window.buildEPG === 'function') {
                window.buildEPG(mockMatches);
            } else if (typeof window.updateMatchUiAfterScrape === 'function') {
                window.updateMatchUiAfterScrape(mockMatches, true);
            }
        }
    """)
    page.wait_for_timeout(2000)
    page.screenshot(path="verification_screenshot2.png")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    run_cuj(page)
    browser.close()

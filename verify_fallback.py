from playwright.sync_api import sync_playwright
import time

def run_cuj(page):
    page.goto("http://localhost:3000")
    page.wait_for_timeout(3000) # wait for page to load data

    # Click on the first match card to open the modal
    page.locator(".match-card").first.click()
    page.wait_for_timeout(1000)

    # Find and click the details summary "Recherche manuelle & Sites de base (Fallback)"
    page.get_by_text("Recherche manuelle & Sites de base (Fallback)").click()
    page.wait_for_timeout(1000)

    # Take screenshot at the key moment showing the expanded list of scrapers
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)  # Hold final state for the video

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={'width': 1280, 'height': 720}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()  # MUST close context to save the video
            browser.close()

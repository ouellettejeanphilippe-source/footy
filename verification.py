from playwright.sync_api import sync_playwright
import time
import os

def run_cuj(page):
    # Load local file
    page.goto("file:///app/index.html")
    page.wait_for_timeout(2000)

    # Force hide overlay
    page.evaluate('''
        document.getElementById('ov').style.display = 'none';

        // Switch to Favoris tab directly
        if(typeof applyFilter === 'function') {
            applyFilter('fav');
        } else {
            var btn = document.getElementById('filter-fav');
            if(btn) btn.click();
        }
    ''')
    page.wait_for_timeout(2000)

    # Take screenshot at the key moment
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={'width': 1280, 'height': 800}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()

from playwright.sync_api import sync_playwright
import os
import glob

def run_cuj(page):
    page.goto("http://localhost:8080")
    page.wait_for_timeout(2000)

    # Take screenshot at the key moment (showing NHL matches with "finished" status)
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(2000)

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    # clean up previous videos
    for f in glob.glob("/home/jules/verification/videos/*.webm"):
        os.remove(f)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Record at 680px width to test mobile layout per plan
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={'width': 400, 'height': 800}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()

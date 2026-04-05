from playwright.sync_api import sync_playwright
import os
import glob

def run_cuj(page):
    # Navigate to our local file
    file_url = f"file://{os.path.abspath('index.html')}"
    page.goto(file_url)
    page.wait_for_timeout(1000)

    # 1. Initial State Screenshot
    page.screenshot(path="screenshot_initial.png")
    page.wait_for_timeout(500)

    # 2. Open Settings
    page.click('button[onclick="openSettings()"]')
    page.wait_for_timeout(500)

    # 3. Enter API Key
    page.fill('#apiKeyInput', 'test-api-key-1234')
    page.wait_for_timeout(500)
    page.screenshot(path="screenshot_settings.png")

    # 4. Save API Key (this triggers a reload)
    page.click('button[onclick="saveSettings()"]')
    page.wait_for_timeout(1000)

    # 5. Take screenshot of the toast and loading state
    page.screenshot(path="screenshot_after_save.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    os.makedirs("verification_videos", exist_ok=True)
    # Clean old videos
    for f in glob.glob("verification_videos/*.webm"):
        os.remove(f)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="verification_videos",
            viewport={"width": 1280, "height": 720}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()

from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    page.goto(f"file://{os.path.abspath('footyfast-v2.html')}")
    page.wait_for_timeout(2000)

    # 1. Capture initiale avec les leagues par défaut (toggle all on)
    page.screenshot(path="/home/jules/verification/screenshots/initial.png")
    page.wait_for_timeout(1000)

    # 2. Replier (Collapse) la première ligue
    headers = page.locator(".lg-hdr")
    if headers.count() > 0:
        headers.nth(0).click()
        page.wait_for_timeout(1000)
        page.screenshot(path="/home/jules/verification/screenshots/collapsed.png")

    # 3. Masquer la première ligue avec le chip en haut (Toggle)
    chips = page.locator(".lchip")
    if chips.count() > 0:
        chips.nth(0).click()
        page.wait_for_timeout(1000)
        page.screenshot(path="/home/jules/verification/screenshots/toggled.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 1280, "height": 720}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()

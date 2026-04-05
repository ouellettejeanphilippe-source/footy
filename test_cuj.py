from playwright.sync_api import sync_playwright
import os
import glob

def run_cuj(page):
    filepath = "file://" + os.path.abspath("footyfast-guide(4).html")
    print(f"Loading {filepath}")
    page.goto(filepath)
    page.wait_for_timeout(1000)

    # Screenshot of initial state
    page.screenshot(path="screenshot_initial.png")

    # 1. Search for "premier"
    print("Searching for 'premier'")
    page.locator("#searchInput").fill("premier")
    page.wait_for_timeout(500)
    page.screenshot(path="screenshot_search.png")

    # Clear search
    page.locator("#searchInput").fill("")
    page.wait_for_timeout(500)

    # 2. Toggle a league off and on from the top bar chips
    print("Toggling first league chip")
    chips = page.locator(".lchip")
    if chips.count() > 0:
        chips.first.click()
        page.wait_for_timeout(500)
        page.screenshot(path="screenshot_toggled_off.png")
        chips.first.click() # toggle back on
        page.wait_for_timeout(500)
        page.screenshot(path="screenshot_toggled_on.png")

    # 3. Test accordion collapse
    print("Testing accordion collapse")
    chan_cells = page.locator(".chan-col .chan-cell")
    if chan_cells.count() > 0:
        chan_cells.first.click()
        page.wait_for_timeout(500)
        page.screenshot(path="screenshot_accordion_collapsed.png")
        chan_cells.first.click() # expand again
        page.wait_for_timeout(500)

    print("Test complete")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create temp dir for video
        os.makedirs("verification_videos", exist_ok=True)
        context = browser.new_context(record_video_dir="verification_videos")
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()

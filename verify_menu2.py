from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    # Desktop viewport
    context = browser.new_context(viewport={'width': 1200, 'height': 800})
    page = context.new_page()
    page.goto('http://localhost:8080/index.html')

    # Wait for the page to load
    page.wait_for_timeout(2000)

    page.screenshot(path='/home/jules/verification/screenshots/desktop_fixed.png')
    browser.close()

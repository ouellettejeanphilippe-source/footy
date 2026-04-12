from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    # Mobile viewport
    context = browser.new_context(viewport={'width': 375, 'height': 812})
    page = context.new_page()
    page.goto('http://localhost:8080/index.html')

    # Wait for the page to load
    page.wait_for_timeout(2000)

    # Click hamburger menu
    page.evaluate('toggleMenu()')

    # Wait a bit for animation
    page.wait_for_timeout(1000)

    page.screenshot(path='/home/jules/verification/screenshots/menu_fixed.png')
    browser.close()

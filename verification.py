from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    context = browser.new_context()
    page = context.new_page()
    page.goto("http://localhost:8000/index.html")

    page.evaluate("""() => {
        document.getElementById('errbox').classList.remove('show');
        document.getElementById('ov').style.display = 'none';

        S.matches = [
             {homeTeam: "Arsenal", awayTeam: "Chelsea", league: "premier league", status: "live"},
             {homeTeam: "Montréal Victoire", awayTeam: "Boston Fleet", league: "pwhl", status: "upcoming"},
             {homeTeam: "Québec Remparts", awayTeam: "Halifax Mooseheads", league: "lhjmq", status: "upcoming"},
             {homeTeam: "France", awayTeam: "Argentina", league: "world cup", status: "upcoming"},
             {homeTeam: "Real Madrid", awayTeam: "Barcelona", league: "champions league", status: "upcoming"}
          ];

        window.applyFilter('fav');
    }""")

    page.wait_for_timeout(1000)

    # Click the "Autres Ligues" button to open the accordion
    page.click("text=Autres Ligues")
    page.wait_for_timeout(1000)

    page.screenshot(path="favorites_menu_expanded.png")
    context.close()
    browser.close()

with sync_playwright() as playwright:
    run(playwright)

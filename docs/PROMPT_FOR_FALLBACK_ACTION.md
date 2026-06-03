# Prompt for AI Agent: Setup Scraping Fallback GitHub Action

**Goal**: The user wants to create a third GitHub Action that periodically (e.g., every 6 hours via cron) runs the application's stream scraper logic and saves the compiled match/stream data to a JSON file in a separate branch (like `data` or `gh-pages`). This allows the static frontend to fetch the JSON file as a fallback data source if the client-side scrapers fail due to CORS or proxy issues.

**Context**:
- The current application is a completely client-side HTML/JS app.
- The scraping logic (found in `js/scrapers.js` and `js/api.js`) relies heavily on `window.fetch` using a CORS proxy, manipulating DOM elements (using `DOMParser`), and interacting with global objects like `baseMatches` and `localStorage`.
- There is currently no server-side Node.js script that simply runs the scrape and writes the output to stdout or a file.

**Tasks Required**:
1. **Create a Headless Scraper Script**: Write a Node.js script (using Playwright or JSDOM) that loads the local application environment, waits for the initial ESPN API fetch and the subsequent proxy scrapes to finish (i.e., waits until `window.baseMatches` is populated with `streamLinks`), and then extracts that data to a local `matches_fallback.json` file.
2. **Modify Frontend Logic**: Update the frontend (`js/api.js` or `js/main.js`) so that if the normal scraper proxy fails (or simply as a fast initial load), it attempts to `fetch('https://raw.githubusercontent.com/<user>/<repo>/data/matches_fallback.json')` and merges those streams into the local state.
3. **Create the GitHub Action**: Create `.github/workflows/scrape-fallback.yml` that:
   - Runs on a schedule (`schedule: - cron: '0 */6 * * *'`).
   - Checks out the main code.
   - Installs Node/Playwright dependencies.
   - Runs the headless scraper script from Task 1.
   - Commits and pushes the resulting `matches_fallback.json` to an orphaned or separate branch named `data`.

**Constraints**:
- Keep the new Node script clean and ensure it doesn't break the existing `npm test` workflow.
- Ensure the Action uses `actions/checkout` and correctly configures Git user settings before committing to the `data` branch.

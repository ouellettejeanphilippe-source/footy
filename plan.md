1.  **Refactor naive URL concatenation in `js/scrapers.js`:**
    *   Many scrapers (e.g., `parseStreameast`, `parseSportsurge`, `parseStreamonsport`, `parseTotalsportek`, `parseVipleague`, `parseNflbite`, `parsefootybite` (various others using `.startsWith('/')` concat)) manually concatenate paths to base URLs instead of using the newly created `resolveUrl` helper from `js/config.js`. I will replace these manual concatenations with `resolveUrl` calls.
    *   Example: `streamUrl = (STREAMEAST_URL.endsWith('/') ? STREAMEAST_URL.slice(0, -1) : STREAMEAST_URL) + (streamUrl.startsWith('/') ? streamUrl : '/' + streamUrl);` -> `streamUrl = resolveUrl(streamUrl, STREAMEAST_URL);`

2.  **Verify refactored URL logic:**
    *   Use `run_in_bash_session` to run `git diff js/scrapers.js` and confirm the `resolveUrl` refactoring was applied correctly without syntax errors.

3.  **Update `debugMatchPair` strictness in `js/match.js`:**
    *   Edit `js/match.js` to update the `debugMatchPair` function, ensuring it strictly checks for the existence of `homeTeam` and `awayTeam` properties using the `in` operator (e.g., `!('homeTeam' in m1)`) instead of relying on truthiness which could falsely reject empty strings.

4.  **Verify matching system strictness:**
    *   Use `run_in_bash_session` to run `git diff js/match.js` and confirm the `in` operators were applied correctly without syntax errors. Ensure that `m1.homeTeam` is checked properly.

5.  **Run Tests:**
    *   Run `npm test` and `python3 run_checks.py`.

6.  **Complete pre commit steps:**
    *   Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

7.  **Submit the change:**
    *   Commit and submit the change.

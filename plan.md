Plan:
1. **Fix URL Parsing in `js/config.js` and `js/scrapers.js`**:
   - `getDomain(url)` currently strips protocols but fails to gracefully inject them for URLs that are protocol-relative (e.g., `//example.com`) or naked domains (`example.com`). It will be updated to prefix `http:` or `http://` before executing `new URL(url)` to prevent exceptions.
   - Implement and export `resolveUrl(href, base)` in `js/config.js`. It will safely resolve relative paths using `new URL()`. If it fails (e.g. `base` is missing a protocol), it will use `getDomain(base)` to reconstruct a valid base URL (e.g. `https://<domain>`) and retry, falling back to returning `href` as-is.
   - Update `js/scrapers.js` to import and utilize `resolveUrl`. Replace all the brittle `try/catch` fallbacks like `new URL(href, m.matchUrl).href ... new URL(href, 'https://' + m.matchUrl).href` with `resolveUrl(href, m.matchUrl)`.

2. **Verify Matching System (`js/match.js`)**:
   - The user mentioned "Make sure the url parsing and the matching system is fully functional without bugs".
   - `js/match.js` heavily relies on sliding window string comparisons (`stringSimilarity`). The logic appears robust (`minWindow`, `maxWindow`, loop bounds).
   - I will double-check for edge cases like missing properties (`m1.homeTeam` undefined), but existing checks (`!name1 || !name2`, `var m1H = normName(m1.homeTeam)`) generally prevent these.
   - I will add a test script for url parsing.

3. **Pre-commit Checks**:
   - Follow instructions from `pre_commit_instructions` before submitting to ensure tests pass and code meets the repository's guidelines.

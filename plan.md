1.  **Consolidate Team Data**: Use `run_in_bash_session` to execute a Python script that parses `js/db.js` and `js/utils.js` to extract all currently available team data (`STATIC_TEAMS`, `TEAM_COLORS`, `TEAM_ALIASES`, `STATIC_LOGOS_RAW`) and merge them into a single `TEAM_DATA` dictionary mapping exported from a new file `js/teams.js`.
2.  **Scrape Missing Logos**: Use `run_in_bash_session` to run a Python script that searches the ESPN APIs generally for logos of teams that do not have one. If not found on ESPN, fallback to TheSportsDB.
3.  **Ensure ALL Teams have ALL info**: Use `run_in_bash_session` to execute a Python script that iterates over the generated `TEAM_DATA` mapping. If a team lacks a `logo`, default it to the standard `ui-avatars` URL. If it lacks `colors`, apply the default hashing color function previously found in `js/db.js`. If it lacks `aliases`, set it to an empty array. Write this final data structure back to `js/teams.js`.
4.  **Update `js/db.js`**:
    - Remove `STATIC_TEAMS`, `TEAM_COLORS`, `TEAM_ALIASES` variables.
    - Import `TEAM_DATA` from `js/teams.js`.
    - Dynamically map `TEAM_DATA` to recreate the `STATIC_TEAMS`, `TEAM_COLORS`, and `TEAM_ALIASES` constants in `js/db.js` for backward compatibility.
    - Refactor `getTeamColors()`, `normName()`, and `STATIC_TEAM_MAP` building loop to use `TEAM_DATA`.
    - Change `getLogo()` to primarily look up `TEAM_DATA[key].logo`, falling back to ui-avatars.
    - Remove the dynamic `fetchAndCacheLogoDynamically` function, as all logos should be statically available.
5.  **Update `js/utils.js`**:
    - Remove `STATIC_LOGOS_RAW`.
    - Remove `cacheLogo` and `ensureLogoCache` functions as caching dynamically fetched logos is no longer needed.
6.  **Verify Code syntax**: Run a bash script leveraging `acorn` to check for JS syntax errors on `js/db.js`, `js/utils.js` and `js/teams.js`.
7.  **Refactor Imports**: Use `grep` to identify references, and then use `run_in_bash_session` with Python to cleanly remove obsolete imports. Update imports in `js/main.js` to ensure the recreated `STATIC_TEAMS` and `TEAM_ALIASES` are still imported correctly from `js/db.js`.
8.  **Run Tests**: Run `npm test` and `python3 run_checks.py` to ensure all functionality is preserved.
9.  **Pre-commit Steps**: Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
10. **Submit Changes**: Submit code.

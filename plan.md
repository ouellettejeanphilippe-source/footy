1.  **Fix "Autres Flux" not toggling:**
    - The issue is that in the Live/Upcoming view, `.match-card` elements are created, but they don't have the `data-lg` attribute, and `toggleAccordion` currently only toggles elements with `.mrow[data-lg="..."]` (which are used in the Timeline Guide view) or `.marea-row`.
    - We need to:
        - Add `b.setAttribute('data-lg', lg.league);` to the `.match-card` creation in `renderMatches` in `js/ui.js` (around line 267).
        - Update `toggleAccordion` in `js/utils.js` to also select `.match-card[data-lg="..."]` and toggle their `display` between `'none'` and `'flex'`.
    - Also, `toggleLeague` in `js/utils.js` should probably hide `.match-card` when toggling. Currently it selects `.marea-row, .mrow, .lg-container`. Wait, `.match-card` is just a flex child, so hiding it is good. Or maybe we hide the whole `lg-hdr` and `match-card` in Live mode.

2.  **Add a toggle for "Autres Flux" in the "En Direct" view, at the bottom:**
    - The user wants "Autres streams" (which translates to the "Autres Flux" league) to be in a separate, toggleable section at the bottom of the "En direct" tab.
    - In `js/ui.js` inside `buildEPG`, when `S.filter === 'live'`, we divide matches into `liveNow`, `upNext`, and `laterToday`.
    - We should extract `m.league === 'Autres Flux'` from `liveNow`, `upNext`, and `laterToday`.
    - Or we can group all `Autres Flux` matches into a separate array `autresFluxMatches`, and render them separately at the end.
    - Wait, `renderMatches` groups matches by league *inside* the section. If we render a separate section using `renderMatches` at the end with `titleStr="Autres streams"` and `isCollapsible=true`, it will create a collapsible section just for these!
    - So, in `buildEPG` for `S.filter === 'live'`:
        - Filter out `Autres Flux` from `liveNow`, `upNext`, `laterToday`.
        - Create an `autresFluxMatches` array.
        - Render `liveNow`, `upNext`, `laterToday` normally.
        - At the end, if `autresFluxMatches.length > 0`, call `renderMatches(autresFluxMatches, epgContainer, "Autres streams", true, 'autresStreams')`.
        - We should also probably do this for `upcoming` view? The user specifically said "dans En direct, sous le reste".
        - This provides the toggle out of the box using `renderMatches`' built-in `isCollapsible` feature!

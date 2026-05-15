# Worklog

## En cours

## Fait
- 2026-05-14 - Refined match modal for game streaming in `js/ui.js` by hiding legacy header/footer, injecting a new close button into `wrapperHtml`, and fixing the async stream render target in `js/scrapers.js` to update the new split layout instead of overwriting the entire modal.
- 2026-05-14 - Redesigned stream modal layout (desktop and mobile) to use a 2-column view with stickied game info on the left (reusing live cards design) and stream links on the right.
- Added auto-refresh mechanism for match streams when their status transitions to "live", bypassing stream caches and resetting the `streamsLoaded` state flag.
- Ajouter lien vers match sur ESPN dans modal des streams.
- À droite, mettre carte du match avec le 45 dégradé et logo.
- Ou mettre une photo ou un texte de preview du match si ESPN ou autre peut en fournir?

## Fait
- 2026-05-14 - Fixed "Autres Flux" display toggling in grid views and separated it into a dedicated collapsible section at the bottom of the "En direct" tab.
- 2026-05-14 - Removed arbitrary stream bounds limiting in `scrapeMatchFlux` and updated stream quantity threshold to 1000 so that every game will have every stream displayed.
- Added parsing logic in `js/api.js` for ESPN article text, photo, and web link.
- Modernized the `openMod` layout in `js/ui.js` to feature a stylish 45-degree gradient VS matchup card.
- Implemented logic in `fetchAndRenderModalStats` to overlay the ESPN article photo and text on the matchup card when available.
- Appended a new `Lire sur ESPN` button underneath the poster card.
- 2026-05-14 - Flattened stream link layout in js/ui.js to a single line and removed "Recommandé/Alternatif" text to simplify UI.
- Increase stream limits in scrapeMatchFlux (js/scrapers.js) to display all streams for sources with large volumes.
- 2026-05-13 - Update Footybite URL to army.footybite.to in js/config.js and js/ui.js.
- 2026-05-13 - Fixed missing leagues in the EPG guide by moving DEFAULT_LEAGUES to db.js and handling case-insensitive logic in UI display sorting.
- Refonte visuelle de la carte de match dans `js/ui.js` (mode Scoreboard).
- Simplification du bouton Multivision dans la liste de flux en icône carrée simple.
- Correction du scroll mobile pour `#modal-left-col` (retrait de la couleur de fond fixe et du sticky) dans `styles.css`.

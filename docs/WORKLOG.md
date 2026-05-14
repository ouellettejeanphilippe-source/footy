# Worklog

## En cours

## Fait
- Added auto-refresh mechanism for match streams when their status transitions to "live", bypassing stream caches and resetting the `streamsLoaded` state flag.
- Ajouter lien vers match sur ESPN dans modal des streams.
- À droite, mettre carte du match avec le 45 dégradé et logo.
- Ou mettre une photo ou un texte de preview du match si ESPN ou autre peut en fournir?

## Fait
- Fix missing streams for Montreal teams by normalizing diacritics in stream text filtering and removing ambiguous aliases from js/teams.js.
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

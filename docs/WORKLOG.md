# Worklog

## En cours

## Fait
- 2026-05-16 - Fixed URL matching/parsing in `js/scrapers.js` where `new URL` failed silently for base URLs lacking a protocol, preventing relative streams from resolving properly.
- 2026-05-16 - Enhanced `getDomain` in `js/config.js` with regex fallback to gracefully parse naked domains if `new URL` throws an exception, avoiding full URL returns when protocols are missing.
- 2024-05-15 - Fixed premature stream scraping blocks by introducing a `hasEnoughStreams` check in `fetchSubPages` (background scraper) and `openMod` (foreground modal). This ensures matches that were checked too early and had 0 streams are eligible for re-scraping later, solving the missing streams issue.
- 2026-05-15 - Ajout de logs de debug détaillés (diagnosticScrape), persistance des streams manuels (via saveStreamCache), fonction globale copyToClipboard et affichage des logs multilignes dans le Multiview.
- 2024-05-15 - Fixed URL matching/parsing in `js/scrapers.js` for `MLBITE_URL` trailing slash replacement bug by checking `endsWith('/')` rather than blindly using string `.replace(/\/$/, '')`.
- 2024-05-15 - Refined match modal for game streaming in `js/ui.js` by hiding legacy header/footer, injecting a new close button into `wrapperHtml`, and fixing the async stream render target in `js/scrapers.js` to update the new split layout instead of overwriting the entire modal.
- 2024-05-15 - Redesigned stream modal layout (desktop and mobile) to use a 2-column view with stickied game info on the left (reusing live cards design) and stream links on the right.
- 2026-05-15 - Ajout de l'outil de diagnostic et extraction manuelle de flux dans la fenêtre de match. Refactorisation de `isMatchPair` vers `debugMatchPair` pour exposer la raison de l'échec de l'association.
- 2026-05-14 - Fixed URL matching/parsing in `js/scrapers.js` for `MLBITE_URL` trailing slash replacement bug by checking `endsWith('/')` rather than blindly using string `.replace(/\/$/, '')`.
- 2026-05-14 - Refined match modal for game streaming in `js/ui.js` by hiding legacy header/footer, injecting a new close button into `wrapperHtml`, and fixing the async stream render target in `js/scrapers.js` to update the new split layout instead of overwriting the entire modal.
- 2026-05-14 - Redesigned stream modal layout (desktop and mobile) to use a 2-column view with stickied game info on the left (reusing live cards design) and stream links on the right.
- Added auto-refresh mechanism for match streams when their status transitions to "live", bypassing stream caches and resetting the `streamsLoaded` state flag.
- Ajouter lien vers match sur ESPN dans modal des streams.
- À droite, mettre carte du match avec le 45 dégradé et logo.
- Ou mettre une photo ou un texte de preview du match si ESPN ou autre peut en fournir?

## Fait
- 2024-05-15 - Fixed "Autres Flux" display toggling in grid views and separated it into a dedicated collapsible section at the bottom of the "En direct" tab.
- 2024-05-15 - Removed arbitrary stream bounds limiting in `scrapeMatchFlux` and updated stream quantity threshold to 1000 so that every game will have every stream displayed.
- Added parsing logic in `js/api.js` for ESPN article text, photo, and web link.
- Modernized the `openMod` layout in `js/ui.js` to feature a stylish 45-degree gradient VS matchup card.
- Implemented logic in `fetchAndRenderModalStats` to overlay the ESPN article photo and text on the matchup card when available.
- Appended a new `Lire sur ESPN` button underneath the poster card.
- 2024-05-15 - Flattened stream link layout in js/ui.js to a single line and removed "Recommandé/Alternatif" text to simplify UI.
- Increase stream limits in scrapeMatchFlux (js/scrapers.js) to display all streams for sources with large volumes.
- 2024-05-13 - Update Footybite URL to army.footybite.to in js/config.js and js/ui.js.
- 2024-05-13 - Fixed missing leagues in the EPG guide by moving DEFAULT_LEAGUES to db.js and handling case-insensitive logic in UI display sorting.
- Refonte visuelle de la carte de match dans `js/ui.js` (mode Scoreboard).
- Simplification du bouton Multivision dans la liste de flux en icône carrée simple.
- Correction du scroll mobile pour `#modal-left-col` (retrait de la couleur de fond fixe et du sticky) dans `styles.css`.

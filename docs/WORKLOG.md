
## En cours

## Fait
- 2026-08-24 - Updated `LEAGUE_ALIASES` in `js/db.js` and `scripts/scrape_schedule.mjs` to map full ESPN league names (e.g. English Premier League, Spanish LaLiga, Italian Serie A, German Cup, Portuguese Primeira Liga, MLB) to standard league keys recognized by `DEFAULT_LEAGUES` and `OTHER_LEAGUES`. Regenerated `data/schedule.json` to fix guide categorizations.
- 2026-06-08 - Audit complet du calendrier des ligues et mise à jour des domaines de streaming. Restauration des endpoints fonctionnels pour Streameast (naturallyyou.fit), OnHockey (onhockey.tv) et StreamOnSport (streamonsport.pro) dans domains.json, js/config.js et tests. Ajout du support de mise en forme et icônes pour AEW et MotoGP dans js/db.js.
- Fix Footybite stream extraction fallback in `scrapeMatchFlux` to parse DOM structure when Next.js payload is missing.
- Note for future scrapers: Added explicit site-specific fallback pattern inside `scrapeMatchFlux` to allow bypassing generic class-based extraction if Cloudflare blocks Next.js payloads.
- Update `scrape_schedule.yml` Github Action to trigger on `push` to `main`, ensuring `schedule.json` updates automatically and first load is fast.
- 2026-06-07 - Implemented advanced Next.js JSON payload parsing in `js/scrapers.js` for Footybite, Streameast, and MLBite to correctly extract match schedules from their new React-based architecture.
- 2026-06-07 - Enhanced `scrapeMatchFlux` to parse embedded stream links and iframes directly from script tags and Next.js payloads on individual match pages, bypassing Cloudflare 403 blocks on direct DOM loads.


* **2026-06-07**: Correction du bogue critique provoquant des erreurs 404 (GitHub Pages) dans le Multiview. Import et utilisation globale de `resolveUrl` au sein de `resolveStreamUrl` dans `js/utils.js` pour imposer des URLs de flux absolues strictes (`https://`).

- 2026-06-05 - Fixed scraper extraction issues by updating hardcoded base URLs for Footybite (`home.footybite.vc`), Totalsportek (`totalsportekz.com`), Buffstreams (`app.buffstreams.is/indexcracked29`), and VIPLeague (`www.vipleague.ws`).
- 2026-06-05 - Implemented dynamic domain resolution in `js/config.js` and `js/main.js` which fetches a remote `domains.json` file from the repository at startup to seamlessly update domains without requiring full app updates.
- 2026-06-03 - Fixed CI playwright extraction test failing due to Sportsurge/Methstreams scraping proxies returning wrapped HTML in `<pre>` instead of standard DOM output. Also handled `520` Cloudflare status codes. Updated base URLs for Buffstreams and VIPLeague to resolve endpoint fetch errors.
- 2026-06-03 - Updated GitHub Action workflows (`android-build.yml` and `tests.yml`) to use Node.js version 22 instead of 20, fixing the `@capacitor/cli` compatibility failure during the CI process.
- 2026-06-03 - Fixed tests.yml failure when downloading browsers or testing by updating Playwright GitHub Action to not be deprecated and fixed capacitor webDir setting.

# Worklog

## En cours

## Fait
- Update `scrape_schedule.yml` Github Action to change schedule to 09:00 UTC (4 AM EST).
- Fix Footybite stream extraction fallback in `scrapeMatchFlux` to parse DOM structure when Next.js payload is missing.
- Note for future scrapers: Added explicit site-specific fallback pattern inside `scrapeMatchFlux` to allow bypassing generic class-based extraction if Cloudflare blocks Next.js payloads.
- Update `scrape_schedule.yml` Github Action to trigger on `push` to `main`, ensuring `schedule.json` updates automatically and first load is fast.
- 2026-05-28 - Ajout d'attributs `aria-label` aux boutons avec des icônes uniquement dans `index.html`, `js/ui.js`, et `js/multiview.js` pour améliorer l'accessibilité.
- Optimizing array iterations (forEach, map, filter, find) to traditional for loops to improve performance and reduce resource usage.
- 2026-05-18 - Fix robust URL parsing using getDomain with a custom fallback and a new resolveUrl helper in js/config.js to resolve scrapers missing protocol bugs without error. Replaced naive new URL try/catch blocks in js/scrapers.js.
- 2026-05-16 - Déplacer bouton de mise à jour de la liste des streams et mettre en haut de la liste des streams, sans rond autour, juste l'icone, à côté, ajouter une icone de multiview qui ajoute un stream random du match (sauf si 4k stream dispo, mettre 4k stream). Aussi, 4k streams et Buffstream Flux toujours favoris en haut.
- 2026-05-16 - Fixed stream cache persistence issue where cached streamLinks were discarded upon page refresh. Updated `getApiFirstMatches` in `js/api.js` to eagerly inject saved `stream_cache` into newly fetched API matches before saving them into the local calendar cache.
- 2024-05-18 - Mettre "Manches" au lieu de "Temps" pour le baseball dans la section des scores.
- 2026-05-16 - Fixed URL matching/parsing in `js/scrapers.js` where `new URL` failed silently for base URLs lacking a protocol, preventing relative streams from resolving properly.
- 2026-05-16 - Enhanced `getDomain` in `js/config.js` with regex fallback to gracefully parse naked domains if `new URL` throws an exception, avoiding full URL returns when protocols are missing.
- 2024-05-16 - Correction du bug undefined BP/BC et mise à jour des statistiques par défaut (statsToCompare) dans js/ui.js pour correspondre aux Team Stats affichées par ESPN pour chaque sport (Soccer, Hockey, MLB, etc.), regroupées dans la section Voir les statistiques de la saison.

## Fait
- Fix Footybite stream extraction fallback in `scrapeMatchFlux` to parse DOM structure when Next.js payload is missing.
- Note for future scrapers: Added explicit site-specific fallback pattern inside `scrapeMatchFlux` to allow bypassing generic class-based extraction if Cloudflare blocks Next.js payloads.
- Update `scrape_schedule.yml` Github Action to trigger on `push` to `main`, ensuring `schedule.json` updates automatically and first load is fast.
- 2024-05-18 - Mettre "Manches" au lieu de "Temps" pour le baseball dans la section des scores.
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
- Fix Footybite stream extraction fallback in `scrapeMatchFlux` to parse DOM structure when Next.js payload is missing.
- Note for future scrapers: Added explicit site-specific fallback pattern inside `scrapeMatchFlux` to allow bypassing generic class-based extraction if Cloudflare blocks Next.js payloads.
- Update `scrape_schedule.yml` Github Action to trigger on `push` to `main`, ensuring `schedule.json` updates automatically and first load is fast.
- 2024-05-18 - Mettre "Manches" au lieu de "Temps" pour le baseball dans la section des scores.
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
- 2024-05-18 - Implemented frontend UI for the Scraper Investigator inside the options modal, integrating interactive DOM selection to dynamically build custom scraper rules bypassing X-Frame-Options.

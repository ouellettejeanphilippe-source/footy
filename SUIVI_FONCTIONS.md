# 📜 Dictionnaire et Cartographie des Fonctions JavaScript (`app.js`)

Ce document contient la liste exhaustive des fonctions présentes dans l'application (`app.js`), avec leur rôle et leurs dépendances (appels). Il a été mis à jour automatiquement pour auditer les fonctions.

## 🔍 Résumé de l'Audit

### Nouvelles fonctions (ajoutées au code)
Ces fonctions ont été trouvées dans le code mais n'étaient pas documentées :
* `addScrapeLog`
* `addToMultivision`
* `applyBgStyle`
* `applyFilter`
* `applyMvAudioState`
* `applyMvFocusStyling`
* `applyPredefinedTheme`
* `applySportFilter`
* `applyUserBgStyleOnly`
* `applyUserPrefs`
* `buildSwatches`
* `cacheLogo`
* `clearMultivision`
* `closeListener`
* `closePinnedStats`
* `fallbackToIframe`
* `fetchAndCacheLogoDynamically`
* `fetchAndRenderModalStats`
* `fetchGameStats`
* `fetchLeagueStandings`
* `fetchTeamStats`
* `filterBuggyMatches`
* `findLeagueHeader`
* `findSchedule`
* `focusStream`
* `formatLeagueName`
* `formatStatLabel`
* `getDomain`
* `getEspnDateStr`
* `getLeagueDuration`
* `getLogo`
* `getOfficialTeamName`
* `getOriginalMatchId`
* `getSortTime`
* `getStreamCache`
* `getTeamColors`
* `hideMultivision`
* `initPrefs`
* `installTampermonkey`
* `isMatchPair`
* `lgColor`
* `lgFlag`
* `markCustomTheme`
* `mergeFluxToApi`
* `moveMultiviewStream`
* `next`
* `normName`
* `openFlux`
* `openGlobalStats`
* `openGlobalStatsFromMatch`
* `openLogsPage`
* `openMultiviewTab`
* `openOptionsPage`
* `openPinnedStats`
* `openScriptPage`
* `parseMethstreams`
* `parseMlbbite`
* `parseNflbite`
* `parseOnHockey`
* `parsePWHLSchedule`
* `parseSportsurge`
* `parseTotalsportek`
* `parseVipleague`
* `removeFromMultivision`
* `renderFluxItem`
* `renderMatches`
* `renderScorersHtml`
* `renderScrapeLogs`
* `renderSourcesStatus`
* `restoreMultivisionState`
* `saveApiKey`
* `saveCustomLgOrder`
* `saveDomainPrefs`
* `saveMultivisionState`
* `saveStreamCache`
* `scrapeMatchFlux`
* `scrollToNow`
* `setupMultivisionUI`
* `showFluxSelector`
* `showMatchSelector`
* `showToast`
* `sortFluxLinks`
* `stepOk`
* `switchGmTab`
* `toggleAccordion`
* `toggleAutresFlux`
* `toggleFullscreen`
* `toggleGlobalStats`
* `toggleGmPinMatch`
* `toggleLeague`
* `toggleMenu`
* `toggleMultiview`
* `toggleMvGameMode`
* `toggleSportFilters`
* `toggleTheaterMode`
* `updateGmCurrentTab`
* `updateGmScoresTab`
* `updateLiveScores`
* `updateMatchUiAfterScrape`
* `updateMultivisionLayout`
* `updateMvGameModeStats`
* `updateSourceStatus`

### Fonctions obsolètes ou renommées (supprimées du code)
Ces fonctions étaient documentées mais ne se trouvent plus dans le code actuel :
* `getLeagueInfo`
* `openOptions`
* `openLogs`
* `closeOptions`
* `closeLogs`
* `closePlayer`
* `mergeStreamsToApi`
* `openStream`
* `populatePlayerSidebar`
* `renderStreamItem`
* `scrapeMatchStreams`
* `setupMultiviewUI`
* `sortStreamLinks`
* `toggleCrop`
* `updateMultiviewLayout`

## 📖 Dictionnaire des Fonctions (État Actuel)

### `addScrapeLog`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `next`, `scrapeMatchFlux`, `loadAll`

### `addToMultivision`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `getOriginalMatchId`, `showToast`, `saveMultivisionState`, `updateMultivisionLayout`, `toggleMultiview`

**Appelée par :** `openMod`, `openFlux`

### `applyBgStyle`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `initPrefs`

### `applyFilter`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `toggleMultiviewPip`, `openOptionsPage`, `openLogsPage`, `openScriptPage`, `buildEPG`

**Appelée par :** `hideMultivision`

### `applyMvAudioState`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `focusStream`, `updateMultivisionLayout`

### `applyMvFocusStyling`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `focusStream`, `updateMultivisionLayout`

### `applyPredefinedTheme`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `applyUserPrefs`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `applySportFilter`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `buildEPG`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `applyUserBgStyleOnly`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `applyUserPrefs`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `applyUserPrefs`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `initPrefs`, `buildEPG`, `showToast`

**Appelée par :** `markCustomTheme`, `applyUserBgStyleOnly`, `applyPredefinedTheme`

### `buildEPG`
**Description:** Construit la grille télé de 24h. Trie les ligues, gère le filtrage (En direct, À venir, Recherche, Sport), calcule les positions en pixels, et génère le code HTML des lignes de compétition et des blocs de matchs (`.mb`).

**Appelle :** `getEstTimeStrFromDate`, `normName`, `getSortTime`, `saveCustomLgOrder`, `formatLeagueName`, `lgFlag`, `esc`, `getLogo`, `getTeamColors`, `escJs`, `renderMatches`, `pad`, `lgColor`, `toggleAccordion`, `openMod`, `toggleLeague`, `updateNowLine`

**Appelée par :** `toggleFavTeam`, `applyFilter`, `applySportFilter`, `toggleLeague`, `toggleAutresFlux`, `toggleAccordion`, `applyUserPrefs`, `loadAll`

### `buildSwatches`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `markCustomTheme`

**Appelée par :** `openOptionsPage`

### `cacheLogo`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `normName`

**Appelée par :** `fetchAndCacheLogoDynamically`, `findSchedule`, `extractFootybiteLogos`, `mergeMatches`, `updateMatchDataFromApi`, `getApiFirstMatches`

### `clearMultivision`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `saveMultivisionState`, `updateMultivisionLayout`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `closeListener`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `closeMod`
**Description:** Ferme la modale.

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `openMod`, `openFlux`

### `closePinnedStats`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `updateMvGameModeStats`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `esc`
**Description:** Échappe le HTML pour prévenir les failles XSS.

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `openGlobalStatsFromMatch`, `openGlobalStats`, `fetchTeamStats`, `buildEPG`, `renderMatches`, `renderFluxItem`, `openMod`, `updateGmScoresTab`, `updateMvGameModeStats`, `showFluxSelector`, `showMatchSelector`, `updateMultivisionLayout`, `renderScorersHtml`, `updateLiveScores`, `loadAll`

### `escJs`
**Description:** Échappe les guillemets et apostrophes pour insérer des chaînes de caractères en toute sécurité dans les gestionnaires d'événements en ligne (ex: `onclick="..."`).

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `openGlobalStatsFromMatch`, `fetchTeamStats`, `buildEPG`, `renderMatches`, `renderFluxItem`, `updateMultivisionLayout`, `loadAll`

### `extractFootybiteLogos`
**Description:** Extrait et met en cache les URL des logos depuis Footybite.

**Appelle :** `cacheLogo`

**Appelée par :** `parseFootybite`

### `fallbackToIframe`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `updateMultivisionLayout`

### `fetchAndCacheLogoDynamically`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `normName`, `cacheLogo`, `getLogo`

**Appelée par :** `fetchTeamStats`

### `fetchAndRenderModalStats`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `fetchGameStats`, `renderScorersHtml`

**Appelée par :** `openMod`

### `fetchApiSportsFixtures`
**Description:** Appel à API-Sports (nécessite la clé API locale). Met en cache pour 4 heures.

**Appelle :** `lg`

**Appelée par :** `getApiFirstMatches`

### `fetchEspnSchedule`
**Description:** Appel à l'API gratuite d'ESPN.

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `getApiFirstMatches`

### `fetchGameStats`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `openGlobalStatsFromMatch`, `fetchAndRenderModalStats`, `updateMvGameModeStats`

### `fetchLeagueStandings`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `fetchTeamStats`

### `fetchPage`
**Description:** Utilise l'un des 3 serveurs mandataires (proxies) CORS configurés (`PROXIES`) pour récupérer le code HTML d'une URL externe.

**Appelle :** `next`

**Appelée par :** `scrapeMatchFlux`, `getApiFirstMatches`, `loadAll`

### `fetchSubPages`
**Description:** Système de file d'attente asynchrone pour aller moissonner individuellement la page de flux de chaque match.

**Appelle :** `next`

**Appelée par :** `loadAll`

### `fetchTeamStats`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `normName`, `fetchAndCacheLogoDynamically`, `getLogo`, `esc`, `escJs`, `fetchLeagueStandings`, `isMatch`

**Appelée par :** `openGlobalStats`

### `filterBuggyMatches`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `getApiFirstMatches`

### `findLeagueHeader`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `parseFootybite`

### `findSchedule`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `getOfficialTeamName`, `cacheLogo`, `findSchedule`

**Appelée par :** `findSchedule`, `parsePWHLSchedule`

### `focusStream`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `saveMultivisionState`, `updateMultivisionLayout`, `applyMvFocusStyling`, `applyMvAudioState`, `updateMvGameModeStats`

**Appelée par :** `setupMultivisionUI`, `updateMultivisionLayout`

### `formatLeagueName`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `parseStreameast`, `parseOnHockey`, `parseBuffstreams`, `parseFootybite`, `buildEPG`, `getApiFirstMatches`

### `formatStatLabel`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `openGlobalStatsFromMatch`, `updateMvGameModeStats`

### `getApiFirstMatches`
**Description:** Fonction orchestratrice. Récupère le calendrier depuis ESPN et API-Sports pour la date cible (en incluant la veille et le lendemain pour les fuseaux horaires) et construit le tableau de base `matches`.

**Appelle :** `getEspnDateStr`, `fetchEspnSchedule`, `getEstTimeStrFromDate`, `getEstDateStrFromDate`, `formatLeagueName`, `lgFlag`, `lgColor`, `getOfficialTeamName`, `getLeagueDuration`, `cacheLogo`, `fetchApiSportsFixtures`, `isMatch`, `updateMatchDataFromApi`, `fetchPage`, `parsePWHLSchedule`, `lg`, `filterBuggyMatches`

**Appelée par :** `loadAll`

### `getDomain`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `sortFluxLinks`, `renderFluxItem`, `showFluxSelector`, `updateMultivisionLayout`

### `getEspnDateStr`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `pad`

**Appelée par :** `getApiFirstMatches`, `loadAll`

### `getEstDateStrFromDate`
**Description:** Retourne la date au format YYYY-MM-DD dans le fuseau horaire EST.

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `parseOnHockey`, `getApiFirstMatches`, `mergeFluxToApi`, `loadAll`

### `getEstTime`
**Description:** Convertit une heure du Royaume-Uni (généralement fournie par les sites de moissonnage) en EST (environ -5h).

**Appelle :** `pad`

**Appelée par :** `parseFootybite`

### `getEstTimeStrFromDate`
**Description:** Retourne l'heure (HH:MM) dans le fuseau horaire EST, en gérant le bogue de minuit (24:00 -> 00:00).

**Appelle :** `pad`

**Appelée par :** `parseBuffstreams`, `updateMatchDataFromApi`, `buildEPG`, `updateNowLine`, `scrollToNow`, `showMatchSelector`, `getApiFirstMatches`

### `getLeagueDuration`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `parseStreameast`, `parseOnHockey`, `parseBuffstreams`, `parseFootybite`, `getApiFirstMatches`

### `getLogo`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `normName`, `getTeamColors`

**Appelée par :** `fetchAndCacheLogoDynamically`, `openGlobalStatsFromMatch`, `fetchTeamStats`, `buildEPG`, `renderMatches`, `showMatchSelector`

### `getOfficialTeamName`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `isMatch`, `stringSimilarity`

**Appelée par :** `parseStreameast`, `findSchedule`, `parseSportsurge`, `parseOnHockey`, `parseBuffstreams`, `parseNflbite`, `parseMlbbite`, `parseFootybite`, `getApiFirstMatches`

### `getOriginalMatchId`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `toggleDomainPref`, `showFluxSelector`, `addToMultivision`, `openFlux`

### `getSortTime`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `buildEPG`

### `getStreamCache`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `scrapeMatchFlux`

### `getTeamColors`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `normName`

**Appelée par :** `getLogo`, `buildEPG`, `renderMatches`, `showMatchSelector`

### `hideMultivision`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `applyFilter`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `initPrefs`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `applyBgStyle`

**Appelée par :** `applyUserPrefs`, `openOptionsPage`

### `installTampermonkey`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `loadAll`

### `isMatch`
**Description:** Fonction principale qui décide si deux noms d'équipe correspondent (score > 0.75 ou sous-chaîne incluse).

**Appelle :** `stringSimilarity`

**Appelée par :** `getOfficialTeamName`, `fetchTeamStats`, `isMatchPair`, `getApiFirstMatches`

### `isMatchPair`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `normName`, `isMatch`, `stringSimilarity`

**Appelée par :** `mergeMatches`, `mergeFluxToApi`

### `levenshtein`
**Description:** Calcule la distance de Levenshtein entre deux chaînes de caractères.

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `stringSimilarity`

### `lg`
**Description:** Fonction de journalisation interne poussant dans `S.log` (visible via la modale de débogage).

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `parseStreameast`, `parsePWHLSchedule`, `parseSportsurge`, `parseOnHockey`, `parseBuffstreams`, `next`, `parseNflbite`, `parseMlbbite`, `parseFootybite`, `fetchApiSportsFixtures`, `scrapeMatchFlux`, `openMod`, `getApiFirstMatches`

### `lgColor`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `parseStreameast`, `parseBuffstreams`, `parseFootybite`, `renderMatches`, `buildEPG`, `showMatchSelector`, `getApiFirstMatches`

### `lgFlag`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `parseStreameast`, `parseBuffstreams`, `parseFootybite`, `buildEPG`, `showMatchSelector`, `getApiFirstMatches`, `loadAll`

### `loadAll`
**Description:** Fonction maîtresse. Réinitialise l'état (`S`), affiche l'écran de chargement, lance `getApiFirstMatches`, lance le moissonnage en parallèle, fusionne le tout, remplit les options de filtrage et appelle `buildEPG()`.

**Appelle :** `setupMultivisionUI`, `showToast`, `getApiFirstMatches`, `stepOk`, `mergeFluxToApi`, `getEspnDateStr`, `getEstDateStrFromDate`, `updateLiveScores`, `fetchPage`, `addScrapeLog`, `updateSourceStatus`, `parseFootybite`, `mergeMatches`, `parseNflbite`, `parseSportsurge`, `parseBuffstreams`, `parseStreameast`, `parseOnHockey`, `parseMlbbite`, `parseVipleague`, `parseMethstreams`, `parseTotalsportek`, `escJs`, `lgFlag`, `esc`, `updateMatchUiAfterScrape`, `buildEPG`, `fetchSubPages`, `installTampermonkey`

**Appelée par :** `saveApiKey`

### `markCustomTheme`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `applyUserPrefs`

**Appelée par :** `buildSwatches`

### `mergeFluxToApi`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `getEstDateStrFromDate`, `isMatchPair`

**Appelée par :** `loadAll`

### `mergeMatches`
**Description:** Fusionne deux listes de matchs (souvent de sources de moissonnage différentes) en évitant les doublons d'équipes ou de flux.

**Appelle :** `isMatchPair`, `cacheLogo`

**Appelée par :** `loadAll`

### `moveMultiviewStream`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `saveMultivisionState`, `updateMultivisionLayout`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `next`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `lg`, `next`, `scrapeMatchFlux`, `addScrapeLog`, `updateMatchUiAfterScrape`

**Appelée par :** `next`, `fetchPage`, `fetchSubPages`

### `normName`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `getTeamColors`, `cacheLogo`, `getLogo`, `fetchAndCacheLogoDynamically`, `fetchTeamStats`, `isMatchPair`, `buildEPG`, `renderMatches`, `showMatchSelector`

### `openFlux`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `getOriginalMatchId`, `saveMultivisionState`, `updateMultivisionLayout`, `addToMultivision`, `closeMod`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `openGlobalStats`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `esc`, `fetchTeamStats`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `openGlobalStatsFromMatch`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `openGlobalStatsFromMatch`, `fetchGameStats`, `getLogo`, `escJs`, `esc`, `renderScorersHtml`, `formatStatLabel`

**Appelée par :** `openGlobalStatsFromMatch`

### `openLogsPage`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `renderScrapeLogs`

**Appelée par :** `applyFilter`

### `openMod`
**Description:** Ouvre la modale listant les flux disponibles pour un match. Lance le moissonnage si non fait.

**Appelle :** `esc`, `fetchAndRenderModalStats`, `lg`, `scrapeMatchFlux`, `openMod`, `sortFluxLinks`, `addToMultivision`, `closeMod`, `renderFluxItem`

**Appelée par :** `toggleDomainPref`, `renderMatches`, `buildEPG`, `openMod`, `showMatchSelector`

### `openMultiviewTab`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `toggleMultiview`, `toggleMultiviewPip`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `openOptionsPage`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `buildSwatches`, `initPrefs`

**Appelée par :** `applyFilter`

### `openPinnedStats`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `updateMvGameModeStats`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `openScriptPage`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `applyFilter`

### `pad`
**Description:** Ajoute un zéro initial aux nombres < 10 (ex: "09" au lieu de "9").

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `getEstTimeStrFromDate`, `parseStreameast`, `parseFootybite`, `getEspnDateStr`, `getEstTime`, `buildEPG`

### `parseBuffstreams`
**Description:** Extrait les matchs de Buffstreams via une expression régulière lisant les données JSON injectées dans la page.

**Appelle :** `getEstTimeStrFromDate`, `formatLeagueName`, `lgFlag`, `lgColor`, `getOfficialTeamName`, `getLeagueDuration`, `lg`

**Appelée par :** `loadAll`

### `parseFootybite`
**Description:** Extrait chirurgicalement la liste des matchs de Footybite en analysant `.div-child-box`, `.txt-team`, `.time-txt`.

**Appelle :** `lg`, `extractFootybiteLogos`, `pad`, `getEstTime`, `formatLeagueName`, `lgFlag`, `lgColor`, `getOfficialTeamName`, `getLeagueDuration`, `findLeagueHeader`

**Appelée par :** `loadAll`

### `parseMethstreams`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `loadAll`

### `parseMlbbite`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `getOfficialTeamName`, `lg`

**Appelée par :** `loadAll`

### `parseNflbite`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `getOfficialTeamName`, `lg`

**Appelée par :** `loadAll`

### `parseOnHockey`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `formatLeagueName`, `getOfficialTeamName`, `getLeagueDuration`, `getEstDateStrFromDate`, `lg`

**Appelée par :** `loadAll`

### `parsePWHLSchedule`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `findSchedule`, `lg`

**Appelée par :** `getApiFirstMatches`

### `parseSportsurge`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `getOfficialTeamName`, `lg`

**Appelée par :** `loadAll`

### `parseStreameast`
**Description:** Extrait les matchs de Streameast en lisant les attributs `data-team1`, `data-time2`, etc.

**Appelle :** `pad`, `formatLeagueName`, `lgFlag`, `lgColor`, `getOfficialTeamName`, `getLeagueDuration`, `lg`

**Appelée par :** `loadAll`

### `parseTotalsportek`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `loadAll`

### `parseVipleague`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `loadAll`

### `removeFromMultivision`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `saveMultivisionState`, `updateMultivisionLayout`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `renderFluxItem`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `escJs`, `getDomain`, `esc`

**Appelée par :** `updateMatchUiAfterScrape`, `openMod`

### `renderMatches`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `esc`, `toggleAccordion`, `normName`, `lgColor`, `getTeamColors`, `getLogo`, `escJs`, `openMod`

**Appelée par :** `buildEPG`

### `renderScorersHtml`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `esc`

**Appelée par :** `openGlobalStatsFromMatch`, `fetchAndRenderModalStats`, `updateMvGameModeStats`

### `renderScrapeLogs`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `renderSourcesStatus`

**Appelée par :** `openLogsPage`

### `renderSourcesStatus`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `renderScrapeLogs`

### `restoreMultivisionState`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `updateMultivisionLayout`

**Appelée par :** `setupMultivisionUI`

### `saveApiKey`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `showToast`, `loadAll`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `saveCustomLgOrder`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `buildEPG`

### `saveDomainPrefs`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `toggleDomainPref`

### `saveMultivisionState`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `showFluxSelector`, `moveMultiviewStream`, `focusStream`, `updateMultivisionLayout`, `addToMultivision`, `removeFromMultivision`, `clearMultivision`, `openFlux`

### `saveStreamCache`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `scrapeMatchFlux`

### `scrapeMatchFlux`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `getStreamCache`, `lg`, `updateMatchUiAfterScrape`, `fetchPage`, `addScrapeLog`, `saveStreamCache`

**Appelée par :** `next`, `openMod`, `showFluxSelector`

### `scrollToNow`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `getEstTimeStrFromDate`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `setupMultivisionUI`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `focusStream`, `toggleTheaterMode`, `restoreMultivisionState`

**Appelée par :** `loadAll`

### `showFluxSelector`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `getOriginalMatchId`, `sortFluxLinks`, `getDomain`, `saveMultivisionState`, `updateMultivisionLayout`, `esc`, `showToast`, `scrapeMatchFlux`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `showMatchSelector`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `showToast`, `getEstTimeStrFromDate`, `normName`, `lgColor`, `getTeamColors`, `esc`, `getLogo`, `lgFlag`, `openMod`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `showToast`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `showFluxSelector`, `showMatchSelector`, `addToMultivision`, `applyUserPrefs`, `saveApiKey`, `loadAll`

### `sortFluxLinks`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `getDomain`

**Appelée par :** `updateMatchUiAfterScrape`, `openMod`, `showFluxSelector`

### `stepOk`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `loadAll`

### `stringSimilarity`
**Description:** Retourne un score de 0.0 à 1.0 basé sur la distance de Levenshtein.

**Appelle :** `levenshtein`

**Appelée par :** `getOfficialTeamName`, `isMatchPair`, `isMatch`

### `switchGmTab`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `updateMvGameModeStats`, `updateGmScoresTab`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `toggleAccordion`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `buildEPG`

**Appelée par :** `renderMatches`, `buildEPG`

### `toggleAutresFlux`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `buildEPG`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `toggleDomainPref`
**Description:** Gère les boutons ⭐ et 👎 des domaines de diffusion.

**Appelle :** `getOriginalMatchId`, `saveDomainPrefs`, `openMod`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `toggleFavTeam`
**Description:** Ajoute ou enlève l'étoile ★ et met à jour le stockage local.

**Appelle :** `buildEPG`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `toggleFullscreen`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `toggleFullscreen`

**Appelée par :** `toggleFullscreen`

### `toggleGlobalStats`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `toggleGmPinMatch`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `updateGmScoresTab`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `toggleLeague`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `buildEPG`

**Appelée par :** `buildEPG`

### `toggleMenu`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `toggleMultiview`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `updateMultivisionLayout`, `toggleMultiviewPip`

**Appelée par :** `openMultiviewTab`, `addToMultivision`

### `toggleMultiviewPip`
**Description:** Alterne entre la Multivision en plein écran et une vue en colonne latérale.

**Appelle :** `updateMultivisionLayout`

**Appelée par :** `applyFilter`, `openMultiviewTab`, `toggleMultiview`

### `toggleMvGameMode`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `updateGmCurrentTab`

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `toggleSportFilters`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** *(Événement DOM, callback externe, ou Script global)*

### `toggleTheaterMode`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `toggleTheaterMode`

**Appelée par :** `setupMultivisionUI`, `toggleTheaterMode`

### `updateGmCurrentTab`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `updateMvGameModeStats`, `updateGmScoresTab`

**Appelée par :** `toggleMvGameMode`

### `updateGmScoresTab`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `esc`

**Appelée par :** `switchGmTab`, `toggleGmPinMatch`, `updateGmCurrentTab`

### `updateLiveScores`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `esc`

**Appelée par :** `loadAll`

### `updateMatchDataFromApi`
**Description:** Met à jour le statut, le pointage, la minute et les logos d'un match existant à partir de nouvelles données de l'API.

**Appelle :** `getEstTimeStrFromDate`, `cacheLogo`

**Appelée par :** `getApiFirstMatches`

### `updateMatchUiAfterScrape`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `sortFluxLinks`, `renderFluxItem`

**Appelée par :** `next`, `scrapeMatchFlux`, `loadAll`

### `updateMultivisionLayout`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `fallbackToIframe`, `focusStream`, `saveMultivisionState`, `updateMultivisionLayout`, `getDomain`, `esc`, `escJs`, `applyMvFocusStyling`, `applyMvAudioState`

**Appelée par :** `showFluxSelector`, `toggleMultiviewPip`, `moveMultiviewStream`, `restoreMultivisionState`, `focusStream`, `updateMultivisionLayout`, `addToMultivision`, `removeFromMultivision`, `clearMultivision`, `toggleMultiview`, `openFlux`

### `updateMvGameModeStats`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** `esc`, `fetchGameStats`, `renderScorersHtml`, `formatStatLabel`

**Appelée par :** `switchGmTab`, `updateGmCurrentTab`, `closePinnedStats`, `openPinnedStats`, `focusStream`

### `updateNowLine`
**Description:** Positionne la ligne rouge verticale de l'heure actuelle.

**Appelle :** `getEstTimeStrFromDate`

**Appelée par :** `buildEPG`

### `updateSourceStatus`
**Description:** *(Nouvelle fonction non documentée)*

**Appelle :** *(Aucune fonction interne)*

**Appelée par :** `loadAll`


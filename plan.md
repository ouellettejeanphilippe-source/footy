1. **Multiview Auto Sidebar**
   - Modifier `applyFilter(f)` dans `index.html` pour ne plus cacher le multiview `hideMultivision()`, mais utiliser `toggleMultiviewPip()` pour le basculer s'il est affiché en plein écran et qu'on navigue ailleurs.
   - Retirer le bouton `◨ Réduire` du toolbar du Multiview.
   - S'assurer que le bouton Multiview de la barre de navigation fonctionne correctement avec la nouvelle logique pip.

2. **Refonte des boutons "Stats"**
   - Retirer le `<button class="btn o" id="stats-toggle-btn" onclick="toggleGlobalStats()">📊 Scores & Stats</button>` en haut.
   - Ajouter un bouton `📊 Infos & Stats` dans le menu déroulant (dropdown) de chaque flux de la modale Multiview (`controlsHtml`).
   - Mettre à jour la logique de `renderFavTeams` pour que le clic sur la carte d'une équipe ouvre `openGlobalStats(equipe)`.
   - L'étoile doit être l'unique bouton qui gère l'ajout/suppression des favoris via `toggleFavTeam()`.
   - Améliorer `fetchTeamStats(teamName)` pour appeler `fetchGameStats` et/ou `fetchLeagueStandings` et simuler un affichage riche type "TheScore" avec des données.

3. **Logos et Couleurs obligatoires**
   - S'assurer que `getTeamColors(teamName)` et `getLogo(teamName)` sont robustes. Si `logoCache` n'a pas de logo, on tentera d'en chercher un via `api-sports` ou `ESPN` si possible en temps réel dans `fetchTeamStats` et de le mettre en cache, mais `ui-avatars` reste la dernière option fiable de fallback visuel si on ne trouve rien.

4. **Ordre des Ligues**
   - Modifier `buildEPG` et la génération de `scrapedMatches`/`apiMatches` pour que le filtre `customLgOrder` (qui s'applique dans Favoris) dicte aussi l'ordre global des matchs.
   - Ajouter la logique pour que les matchs dont la ligue est "Autres Flux" apparaissent toujours tout en bas, peu importe le tri.

5. **Complete pre commit steps**
   - Effectuer toutes les vérifications et tests nécessaires (dont les instructions de pré-commit et la vérification de l'interface) avant le submit.

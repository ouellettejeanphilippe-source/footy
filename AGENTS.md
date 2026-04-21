# Historique de Projet & Consignes de l'Agent

## Philosophie et État d'Esprit
- L'application est un guide TV sportif ("API-First") avec du moissonnage pour les sources non officielles.
- Les sites de flux (streams) contiennent énormément d'erreurs typographiques et orthographiques sur les noms des équipes, causant des doublons lors de la fusion.
- Nous gardons une politique de noms stricts: `getOfficialTeamName` force tout le monde vers la base de données interne (`STATIC_TEAMS`).
- UI/UX doit être asynchrone, fluide, et ressembler à du Prime Video / Apple TV.

## Réalisations Récents
- ✅ Résolution des doublons causés par l'orthographe en créant une map stricte (`STATIC_TEAM_MAP`).
- ✅ Ajout de pages pour les équipes (Sidebar) pour y voir leurs statistiques et matchs du jour.
- ✅ Normalisation améliorée sans tronquer abusivement (maintien de Man City vs Man Utd distincts).

## À Faire (To-Do)
- Utiliser l'API-Sports pour remplir de vraies statistiques et les classements sur la page des équipes.
- Continuer à identifier les alias d'équipes qui ne correspondent pas.

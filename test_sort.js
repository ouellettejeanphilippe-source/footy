
// Simulate customLgOrder sorting logic
const allowedLeagues = ['PWHL', 'Champions League', 'World Cup', 'LHJMQ'];
let customLgOrder = ['Champions League', 'World Cup', 'PWHL', 'LHJMQ'];
let allTeams = {
  'A': 'Champions League',
  'B': 'World Cup',
  'C': 'PWHL',
  'D': 'LHJMQ',
  'E': 'NFL',
  'F': 'NBA',
  'G': 'Autres Flux'
};
let favTeams = {};

// Sort teams
var teamNames = Object.keys(allTeams).sort(function(a,b) {
    // Favorites first
    if (favTeams[a] && !favTeams[b]) return -1;
    if (!favTeams[a] && favTeams[b]) return 1;

    var lA = allTeams[a];
    var lB = allTeams[b];

    if (lA !== lB) {
        // Use customLgOrder to determine the rank of the leagues.
        // Leagues not in customLgOrder should come after those that are.
        var idxA = customLgOrder.indexOf(lA);
        var idxB = customLgOrder.indexOf(lB);

        var isAllowedA = allowedLeagues.includes(lA) || idxA !== -1;
        var isAllowedB = allowedLeagues.includes(lB) || idxB !== -1;

        // If both are in the allowed list, sort by their order
        if (isAllowedA && isAllowedB) {
            return idxA - idxB;
        }

        // If only one is allowed, the allowed one comes first
        if (isAllowedA && !isAllowedB) return -1;
        if (!isAllowedA && isAllowedB) return 1;

        // If neither are allowed, Ensure 'Autres Flux' is at the very bottom
        if (lA === 'Autres Flux') return 1;
        if (lB === 'Autres Flux') return -1;

        return lA.localeCompare(lB);
    }

    // Sort alphabetically within the same league
    return a.localeCompare(b);
});

console.log(teamNames);

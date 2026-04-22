
// Simulate customLgOrder sorting logic
const allowedLeagues = ['PWHL', 'Champions League', 'World Cup', 'LHJMQ'];
let customLgOrder = ['Champions League', 'World Cup'];
let sports = {'PWHL': true, 'NBA': true, 'LHJMQ': true, 'NFL': true};

// Re-sync customLgOrder with all discovered sports
var newOrder = [];
customLgOrder.forEach(function(lg) {
    if (sports[lg]) { newOrder.push(lg); delete sports[lg]; }
    else if (allowedLeagues.includes(lg)) { newOrder.push(lg); }
});

// Add any remaining sports to the end, but only if they are allowed
Object.keys(sports).forEach(function(lg) {
    if (allowedLeagues.includes(lg)) {
        newOrder.push(lg);
    }
});
customLgOrder = newOrder;
console.log(customLgOrder);

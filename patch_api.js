const { readFileSync, writeFileSync } = require('fs');
let code = readFileSync('js/api.js', 'utf8');

const newCode = `export function fetchLolEsportsEventDetails(id) {
    var url = 'https://esports-api.lolesports.com/persisted/gw/getEventDetails?hl=en-US&id=' + id;
    return fetch(url, {
        headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' },
        signal: AbortSignal.timeout(8000)
    }).then(function(res) { return res.json(); }).catch(function(){ return null; });
}

export function filterBuggyMatches`;

code = code.replace(/export function filterBuggyMatches/, newCode);

writeFileSync('js/api.js', code);

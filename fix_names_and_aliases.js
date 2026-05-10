const fs = require('fs');

const js = fs.readFileSync('js/teams.js', 'utf8');

const match = js.match(/export const TEAM_DATA = (\{[\s\S]*?\});/);
if (!match) process.exit(1);

const { createContext, runInContext } = require('vm');
const sandbox = {};
createContext(sandbox);
runInContext('var data = ' + match[1] + ';', sandbox);
const teamData = sandbox.data;

const GENERIC_WORDS = new Set([
    'fc', 'cf', 'sc', 'hc', 'rc', 'as', 'ac', 'afc', 'united', 'city',
    'town', 'rovers', 'wanderers', 'athletic', 'club', 'de', 'madrid',
    'real', 'sporting', 'albion', 'wednesday', 'hotspur', 'argyle',
    'county', 'villa', 'palace', 'forest', 'north', 'end', 'balompie', 'futbol'
]);

function norm(s) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s&]/g, "").trim();
}

function generateAliases(name, league, currentAliases) {
    let aliases = new Set((currentAliases || []).map(a => a.toLowerCase()));
    let n = norm(name);
    let words = n.split(/\s+/);

    // Initialism (e.g. AFC Bournemouth -> afcb, Manchester United -> mu)
    let initials = words.map(w => w[0]).join('');
    if (initials.length >= 2 && initials.length <= 4) {
        aliases.add(initials);
    }

    // Stripped name (remove generic words)
    let nonGenericWords = words.filter(w => !GENERIC_WORDS.has(w) && w.length > 2);

    // Add specific words if they are not generic
    for (let word of nonGenericWords) {
        aliases.add(word);
    }

    // If it's a 2-word non-generic name, add the joined version without spaces
    if (nonGenericWords.length === 2) {
        aliases.add(nonGenericWords.join(''));
        aliases.add(nonGenericWords.join(' '));
    }

    // For NA sports, the last word is often the mascot, first word(s) is city
    if (['nba', 'nhl', 'nfl', 'mlb', 'cfl', 'pwhl'].includes(league)) {
        if (words.length >= 2) {
            let mascot = words[words.length - 1];
            let city = words.slice(0, words.length - 1).join(' ');
            aliases.add(mascot);
            aliases.add(city);
            if (city.length > 2) aliases.add(city.substring(0, 3) + mascot.substring(0, 3));
        }
    }

    // Add first 3 chars of the most distinguishing word
    if (nonGenericWords.length > 0) {
        aliases.add(nonGenericWords[0].substring(0, 3));
    } else if (words.length > 0 && words[0].length >= 3) {
        aliases.add(words[0].substring(0, 3));
    }

    // Filter out generic single-word aliases that might have sneaked in
    let finalAliases = Array.from(aliases).filter(a => {
        if (a === n) return false;
        if (a.length < 2) return false;
        if (!a.includes(' ') && GENERIC_WORDS.has(a)) return false;
        return true;
    });

    return finalAliases;
}

for (let key in teamData) {
    let t = teamData[key];
    if (t.league !== 'Autres' && t.league !== 'Autres Flux') {
        let generated = generateAliases(t.name, t.league, t.aliases);
        t.aliases = generated;
    }
}

// Now generate the JS string
let outStr = 'export const TEAM_DATA = {\n';
for (let key in teamData) {
    outStr += `  '${key}': ${JSON.stringify(teamData[key])},\n`;
}
outStr += '};\n';

fs.writeFileSync('js/teams.js', outStr);

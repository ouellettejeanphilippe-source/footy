const fs = require('fs');
const vm = require('vm');

const sandbox = { console: console, window: {} };
vm.createContext(sandbox);

let code = '';
code += fs.readFileSync('js/teams.js', 'utf8').replace(/export /g, '').replace(/import .*;/g, '') + '\n';
code += fs.readFileSync('js/db.js', 'utf8').replace(/export /g, '').replace(/import .*;/g, '') + '\n';
code += fs.readFileSync('js/match.js', 'utf8').replace(/export /g, '').replace(/import .*;/g, '') + '\n';

vm.runInContext(code, sandbox);

const { debugMatchPair, isMatch } = sandbox;

console.log('Testing isMatch:');
console.log('Arsenal vs Arsenal:', isMatch('Arsenal', 'Arsenal'));
console.log('Man City vs Man United:', isMatch('Manchester City', 'Manchester United'));
console.log('Montreal Canadiens vs CF Montreal:', isMatch('Montreal Canadiens', 'CF Montreal'));

console.log('\nTesting debugMatchPair:');
console.log('Direct Match:', debugMatchPair(
  { homeTeam: 'Chelsea', awayTeam: 'Arsenal' },
  { homeTeam: 'Chelsea', awayTeam: 'Arsenal' }
));
console.log('Reversed Match:', debugMatchPair(
  { homeTeam: 'Chelsea', awayTeam: 'Arsenal' },
  { homeTeam: 'Arsenal', awayTeam: 'Chelsea' }
));
console.log('Distinct Teams Same City:', debugMatchPair(
  { homeTeam: 'Manchester City', awayTeam: 'Liverpool' },
  { homeTeam: 'Manchester United', awayTeam: 'Liverpool' }
));

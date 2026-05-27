import { getEspnPath, fetchGameStats, fetchTeamInfo, fetchTeamSchedule, fetchLeagueStandings } from './js/api.js';

console.log('Testing getEspnPath directly:');
console.log('Premier League:', getEspnPath('Premier League'));
console.log('Unknown League:', getEspnPath('Unknown League'));

console.log('All functions successfully imported and present.');

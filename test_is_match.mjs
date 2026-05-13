import { isMatchPair, isMatch } from './js/match.js';
import { normName, TEAM_ALIASES } from './js/db.js';

var apiMatch = {
   homeTeam: "Montreal Canadiens",
   awayTeam: "Buffalo Sabres",
   league: "NHL",
   matchDate: "2026-05-12"
};

var scrapedMatch = {
   homeTeam: "Buffalo Sabres",
   awayTeam: "Montréal",
   league: "NHL",
   matchDate: "2026-05-12"
};

console.log(isMatchPair(apiMatch, scrapedMatch));

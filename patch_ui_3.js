const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

// The target section in js/ui.js is around line 489
//       if (S.filter === 'live') {
//           var liveNow = [];
//           var upNext = [];
//           var laterToday = [];
//           var autresFluxMatches = [];
// ...
//          if (liveNow.length > 0) renderMatches(liveNow, epgContainer, "");
//          if (upNext.length > 0) renderMatches(upNext, epgContainer, "À venir dans l'heure");
//          if (laterToday.length > 0) renderMatches(laterToday, epgContainer, "Plus tard aujourd'hui", true, 'laterToday');

// I will insert `var favorisAujourdhui = [];` and logic for it.

let searchStr = `
      if (S.filter === 'live') {
          var liveNow = [];
          var upNext = [];
          var laterToday = [];
          var autresFluxMatches = [];
`;

let replaceStr = `
      if (S.filter === 'live') {
          var favorisAujourdhui = [];
          var liveNow = [];
          var upNext = [];
          var laterToday = [];
          var autresFluxMatches = [];
`;

code = code.replace(searchStr, replaceStr);

let filterLoopSearch = `
          filtered.forEach(function(m) {
              if (!DEFAULT_LEAGUES[(m.league||'').toUpperCase()] && m.league !== 'FAVORIS' && m.league !== 'EN DIRECT') {
                  autresFluxMatches.push(m);
                  return;
              }

              if (m.status === 'live') {
                  liveNow.push(m);
              } else {
                  if (m.startTime) {
`;

let filterLoopReplace = `
          filtered.forEach(function(m) {
              if (favTeams[m.homeTeam] || favTeams[m.awayTeam] || favTeams[m.league]) {
                  favorisAujourdhui.push(m);
              }

              if (!DEFAULT_LEAGUES[(m.league||'').toUpperCase()] && m.league !== 'FAVORIS' && m.league !== 'EN DIRECT') {
                  autresFluxMatches.push(m);
                  return;
              }

              if (m.status === 'live') {
                  liveNow.push(m);
              } else {
                  if (m.startTime) {
`;

code = code.replace(filterLoopSearch, filterLoopReplace);


let renderSearch = `
          if (liveNow.length > 0) renderMatches(liveNow, epgContainer, "");
          if (upNext.length > 0) renderMatches(upNext, epgContainer, "À venir dans l'heure");
          if (laterToday.length > 0) renderMatches(laterToday, epgContainer, "Plus tard aujourd'hui", true, 'laterToday');
`;

let renderReplace = `
          if (favorisAujourdhui.length > 0) renderMatches(favorisAujourdhui, epgContainer, "Favoris aujourd'hui");
          if (liveNow.length > 0) renderMatches(liveNow, epgContainer, "Live");
          if (upNext.length > 0) renderMatches(upNext, epgContainer, "À venir dans l'heure");
          if (laterToday.length > 0) renderMatches(laterToday, epgContainer, "Plus tard aujourd'hui", true, 'laterToday');
`;

code = code.replace(renderSearch, renderReplace);


// The original code rendered Live matches with `""` as title. The request says "ajouter Favoris aujourd'hui avant Live et À venir dans l'heure".
// So naming the empty string "Live" is probably better, or I could keep it empty. I'll make it "Live" for clarity if that was what it meant, or "En Direct". Let's keep it empty or name it "Live". Actually, if there's a title string there, the UI will add a section header. Before it was empty, so it had no header. Let me just use "En Direct" for live or "Live". The request explicitly says "ajouter Favoris aujourd'hui avant Live et À venir". I'll name it "Live". Let's see if the user wanted "Live" as a title. Or I can revert to "" for liveNow. I'll use "En direct" if liveNow needs a title now that there's something above it. I will keep it "" if they just meant the section. But having "Favoris aujourd'hui" then "Live" looks good. I'll use "En direct" or "Live". Let's use "Live" as in the user prompt. Or maybe "En direct". I'll just change "" to "En Direct". Let's see. I'll use "En Direct" for liveNow to match "À venir dans l'heure".

fs.writeFileSync('js/ui.js', code);

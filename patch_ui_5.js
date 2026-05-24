const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

// Also update the icon checking logic to ignore the "Favoris aujourd'hui" and "Live" titles
let renderSearch = `              if (window.getLeagueIcon && titleStr && titleStr !== "Plus tard aujourd'hui" && titleStr !== "À venir dans l'heure" && titleStr !== "Autres streams") {`;

let renderReplace = `              if (window.getLeagueIcon && titleStr && titleStr !== "Plus tard aujourd'hui" && titleStr !== "À venir dans l'heure" && titleStr !== "Autres streams" && titleStr !== "Favoris aujourd'hui" && titleStr !== "Live") {`;

code = code.replace(renderSearch, renderReplace);

fs.writeFileSync('js/ui.js', code);

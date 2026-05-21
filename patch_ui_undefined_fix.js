const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

// Ensure that secondary leagues display properly with their icons
code = code.replace(
    /var textSpan = document\.createElement\('span'\);\n\s*textSpan\.textContent = titleStr;/g,
    `var textSpan = document.createElement('span');
              var prefix = '';
              if (window.getLeagueIcon && titleStr && titleStr !== "Plus tard aujourd'hui" && titleStr !== "À venir dans l'heure" && titleStr !== "Autres streams") {
                  var icon = window.getLeagueIcon(titleStr);
                  if (icon && icon !== '🏆') {
                      prefix = icon + ' ';
                  }
              }
              textSpan.textContent = prefix + titleStr;`
);

fs.writeFileSync('js/ui.js', code);
console.log("Patched ui.js with prefix logic");

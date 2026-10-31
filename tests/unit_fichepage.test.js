/* La fiche du match, page des liens (js/ui.js, styles.css).

   « Page de liens, mettre stats dans le haut, jamais le côté, et si stream sélectionné par
   manette, assurer que ça hover tout car là, c'est difficile à lire » (31 octobre 2026).
   1. Les statistiques (buteurs, classement, alignements : #modal-left-col) étaient À CÔTÉ des
      flux sur un écran large, collantes. Elles sont au-dessus, toujours.
   2. À la manette, le focus est sur le lien .si-main, que :hover ne rejoint jamais : seul un
      petit contour entourait le lien. La ligne ENTIÈRE se met en valeur, comme au survol. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const ui = lire('js/ui.js');
const css = lire('styles.css');
let n = 0;
const ok = (name) => { n++; console.log('  ✓ ' + name); };

// 1. Les colonnes sont empilées, les statistiques d'abord.
const cols = ui.match(/<div class="fiche-cols" style="([^"]*)"/);
assert.ok(cols, 'la fiche a ses colonnes');
assert.ok(/flex-direction:\s*column/.test(cols[1]) && !/flex-direction:\s*row/.test(cols[1]), 'en colonne, jamais en rangée');
assert.ok(!/flex-wrap:\s*wrap\b/.test(cols[1]), 'sans retour à la ligne qui remettrait les blocs côte à côte');
const gauche = ui.match(/<div id="modal-left-col" style="([^"]*)"/)[1];
const droite = ui.match(/<div id="modal-right-col" style="([^"]*)"/)[1];
assert.ok(/width:\s*100%/.test(gauche) && /width:\s*100%/.test(droite), 'chaque bloc prend toute la largeur');
assert.ok(!/min-width:\s*280px/.test(gauche + droite), 'plus de colonne de 280 px');
assert.ok(ui.indexOf('id="modal-left-col"') < ui.indexOf('id="modal-right-col"'), 'les statistiques sont avant les flux');
assert.ok(!/#modal-left-col\s*\{[^}]*position:\s*sticky/.test(css), 'plus de colonne collante à côté des flux');
assert.ok(/\.fiche-cols\s*\{\s*flex-direction:\s*column;\s*\}/.test(css), 'la feuille de style le dit aussi');
ok('les statistiques sont en haut, jamais à côté');

// 2. La ligne entière se met en valeur au focus (clavier, manette, télécommande).
for (const sel of ['.si:has(:focus-visible)', 'body.manette .si:focus-within', 'body.tv-mode .si:focus-within']) {
    assert.ok(css.includes(sel), 'sélecteur : ' + sel);
}
const regle = css.match(/\.si:has\(:focus-visible\), body\.manette \.si:focus-within, body\.tv-mode \.si:focus-within \{([^}]*)\}/);
assert.ok(regle, 'la règle de la ligne entière');
assert.ok(/background:\s*var\(--s3\)/.test(regle[1]), 'fond plus clair que le survol (--s2)');
assert.ok(/inset 0 0 0 3px var\(--accent\)/.test(regle[1]), 'un anneau intérieur sur toute la ligne, jamais rogné par overflow:hidden');
assert.ok(/\.si-main:focus-visible, \.si-main:focus \{ outline: none; \}/.test(css), 'plus de petit contour sur le seul lien');
assert.ok(/\.si:hover \{ background: var\(--s2\)/.test(css), 'le survol à la souris est resté');
ok('la ligne entière se met en valeur au focus');

console.log('unit_fichepage: OK (' + n + ')');

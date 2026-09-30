/* Les blasons de la bannière de la fiche de match ne sont pas écrasés par leur remplissage
   (styles.css : .fb-team .prime-logo).

   Capture du 29 septembre 2026 : la fiche Maple Leafs – Canadiens montrait deux disques
   blancs vides, alors que les cartes affichaient les blasons. Le remplissage de
   .prime-logo est en POURCENTAGE, et un pourcentage de remplissage se calcule sur la
   largeur du bloc parent : une petite case dans la carte, une colonne de près de 500 px
   dans la bannière, soit plus de 40 px de chaque côté d'un disque de 64 px. L'image
   n'avait plus de place. Sans réseau. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
const regles = [...css.matchAll(/\.fb-team \.prime-logo\s*\{([^}]*)\}/g)].map((m) => m[1]);
assert.ok(regles.length >= 1, 'la règle du blason de la bannière existe');
regles.forEach((r) => {
    const pad = /(?:^|;)\s*padding\s*:\s*([^;]+)/.exec(r);
    assert.ok(pad, 'chaque règle du blason de bannière fixe son propre remplissage : ' + r.trim());
    assert.ok(!/%/.test(pad[1]), 'en unités fixes, jamais en pourcentage : ' + pad[1]);
    const w = /width\s*:\s*(\d+)px/.exec(r);
    const p = parseFloat(pad[1]);
    if (w) assert.ok(w[1] - 2 * p >= 30, 'il reste au moins 30 px pour l\'image dans un disque de ' + w[1] + ' px');
});
console.log('unit_banniereblason: OK (' + regles.length + ' règles)');

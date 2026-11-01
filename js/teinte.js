/* La couleur de l'interface selon le match (1er novembre 2026) : « couleur de l'interface selon
   le match actuellement ».

   Le match « actuel » : celui de la fiche ouverte, sinon de la vidéo choisie dans le lecteur, sinon
   celui du bandeau vedette du Live (js/multiview.js, majTeinte). Sa couleur d'équipe (domicile d'abord, puis visiteur) devient la couleur
   d'accent (`--accent`, boutons, onglet actif, focus) et une lueur sur le fond (`--teinte-lueur`).
   Une couleur d'équipe trop sombre, trop claire ou grise (noir, blanc, argent) ne sert pas telle
   quelle : on prend la suivante, et sa luminosité est ramenée dans une plage lisible sur le fond
   sombre. Sans couleur utilisable, ou si Réglages → Look le coupe (`userPrefs.teinteMatch ===
   false`), l'accent de la palette revient.

   SANS IMPORT : les couleurs d'équipe sont injectées (`teamColorPair` de js/db.js). */

/* « #rrggbb », « #rgb » ou « hsl(h, s%, l%) » → { h, s, l } (0–360, 0–1, 0–1), ou null. */
export function versHsl(c) {
  c = String(c || '').trim().toLowerCase();
  var m = c.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
  if (m) return { h: +m[1] % 360, s: Math.min(1, +m[2] / 100), l: Math.min(1, +m[3] / 100) };
  m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  var x = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
  var r = parseInt(x.slice(0, 2), 16) / 255, g = parseInt(x.slice(2, 4), 16) / 255, b = parseInt(x.slice(4, 6), 16) / 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l: l };
  var s = d / (1 - Math.abs(2 * l - 1));
  var h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = Math.round(h * 60); if (h < 0) h += 360;
  return { h: h, s: Math.min(1, s), l: l };
}

function hex2(v) { var x = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16); return x.length < 2 ? '0' + x : x; }

/* { h, s, l } → « #rrggbb ». */
export function versHex(c) {
  var s = c.s, l = c.l, k = function(n) { return (n + c.h / 30) % 12; };
  var a = s * Math.min(l, 1 - l);
  var f = function(n) { return l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); };
  return '#' + hex2(f(0)) + hex2(f(8)) + hex2(f(4));
}

/* Une couleur d'équipe utilisable comme accent : assez saturée (pas noire, blanche ni grise), sa
   luminosité ramenée entre 48 % et 64 % et sa saturation à 55 % au moins ; null sinon. */
export function accentLisible(c) {
  var t = versHsl(c);
  if (!t || t.s < 0.28 || t.l < 0.08 || t.l > 0.94) return null;
  return versHex({ h: t.h, s: Math.max(0.55, t.s), l: Math.min(0.64, Math.max(0.48, t.l)) });
}

/* La couleur d'accent d'un match : la première couleur utilisable parmi celles du domicile, puis
   du visiteur ; null sinon. `paire(nom)` rend [couleur1, couleur2] (teamColorPair). */
export function teinteDuMatch(m, paire) {
  if (!m || typeof paire !== 'function') return null;
  var noms = [m.homeTeam, m.awayTeam].filter(Boolean);
  for (var i = 0; i < noms.length; i++) {
    var p = paire(noms[i]) || [];
    for (var j = 0; j < p.length; j++) {
      var a = accentLisible(p[j]);
      if (a) return a;
    }
  }
  return null;
}

/* « #rrggbb » + opacité → « rgba(…) ». */
export function transparente(hex, a) {
  var x = String(hex).replace('#', '');
  return 'rgba(' + parseInt(x.slice(0, 2), 16) + ', ' + parseInt(x.slice(2, 4), 16) + ', ' + parseInt(x.slice(4, 6), 16) + ', ' + a + ')';
}

/* Pose la teinte sur la page (`racine` : document.documentElement). `couleur` null rend l'accent de
   la palette (`accentPalette`). Rend la couleur posée. */
export function appliquerTeinte(racine, couleur, accentPalette) {
  if (!racine || !racine.style) return null;
  var c = couleur || accentPalette || '#0a84ff';
  racine.style.setProperty('--accent', c);
  if (couleur) {
    racine.style.setProperty('--accent-glow', transparente(couleur, 0.2));
    racine.style.setProperty('--teinte-lueur', transparente(couleur, 0.16));
    racine.setAttribute('data-teinte', couleur);
  } else {
    racine.style.removeProperty('--accent-glow');
    racine.style.removeProperty('--teinte-lueur');
    racine.removeAttribute('data-teinte');
  }
  return c;
}

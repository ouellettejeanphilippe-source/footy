/* Dispositions du Live et du Guide (js/dispositions.js, 13 octobre 2026).

   « Les 4, avec l'actuelle toujours comme default ». Ce que l'utilisateur a demandé en
   chemin et qu'un changement pourrait défaire sans bruit :
   - « actuelle » reste la valeur par défaut, et toute valeur inconnue y retombe ;
   - le Guide ne range JAMAIS un match en cours avant l'heure actuelle (« on dirait que
     c'est passé ») : en cours d'abord, puis à venir par heure, puis terminés à part ;
   - pas de titre « Guide des Sports » ni de sous-titre (« juste le ui ») ;
   - chaque match rendu reste cliquable (data-mid) pour ouvrir sa fiche. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let D;
test.before(async () => { D = await import(path.join(ROOT, 'js', 'dispositions.js')); });

const fiche = (id, etat, debut, extra) => Object.assign({
  id, ligue: 'NHL', dom: 'Montreal Canadiens', ext: 'Buffalo Sabres', seul: false,
  logoDom: { url: 'https://a.espncdn.com/i/teamlogos/nhl/500/scoreboard/mtl.png' }, logoExt: null,
  cDom: '#af1e2d', cExt: '#003087', heure: String(Math.floor(debut / 60)).padStart(2, '0') + ':' + String(debut % 60).padStart(2, '0'),
  debut, duree: 150, etat, chrono: etat === 'live' ? '3e · 06:56' : '', sDom: etat === 'plus-tard' || etat === 'bientot' ? null : 2,
  sExt: etat === 'plus-tard' || etat === 'bientot' ? null : 1, flux: 12, fav: false, jour: ''
}, extra || {});

const MAINTENANT = 20 * 60 + 40;
const jeu = () => [
  fiche('fini', 'fin', 15 * 60),
  fiche('encours', 'live', 18 * 60 + 30, { fav: true }),
  fiche('bientot', 'bientot', 21 * 60),
  fiche('tard', 'plus-tard', 22 * 60 + 30),
  fiche('demain', 'plus-tard', 1440 + 12 * 60 + 45, { jour: 'demain' }),
];

test('« actuelle » est la valeur par défaut, et une valeur inconnue y retombe', () => {
  assert.strictEqual(D.dispositionValide(undefined), 'actuelle');
  assert.strictEqual(D.dispositionValide('n-importe-quoi'), 'actuelle');
  for (const [k] of D.DISPOSITIONS) assert.strictEqual(D.dispositionValide(k), k);
  assert.deepStrictEqual(D.DISPOSITIONS.map(d => d[0]), ['actuelle', 'tableau', 'maintenant', 'affiches', 'chaines']);
  assert.strictEqual(D.rendreDisposition('actuelle', 'live', jeu(), {}), '', 'actuelle laisse le rendu historique');
});

test('le Guide range : en cours, puis à venir par heure, puis terminés — jamais un direct dans le passé', () => {
  const c = D.classerPourGuide(jeu());
  assert.deepStrictEqual(c.enCours.map(f => f.id), ['encours']);
  assert.deepStrictEqual(c.termines.map(f => f.id), ['fini']);
  assert.deepStrictEqual(c.heures.map(h => h.libelle), ['21 h', '22 h', 'Demain 12 h']);
  for (const h of c.heures) for (const f of h.fiches) assert.notStrictEqual(f.etat, 'live');
});

for (const nom of ['tableau', 'maintenant', 'affiches', 'chaines']) {
  test(`${nom} : Live et Guide se rendent, sans titre, chaque match cliquable`, () => {
    for (const vue of ['live', 'guide']) {
      const fiches = vue === 'live' ? jeu().filter(f => f.etat === 'live' || f.etat === 'bientot') : jeu();
      D.etatDisposition.termines = true;
      const html = D.rendreDisposition(nom, vue, fiches, { maintenant: MAINTENANT, couleurs: 'home' });
      D.etatDisposition.termines = false;
      assert.match(html, new RegExp('class="dsp dsp-' + nom + ' dsp-vue-' + vue));
      assert.doesNotMatch(html, /Guide des Sports/);
      assert.doesNotMatch(html, /<h1/);
      for (const f of fiches) {
        assert.ok(html.includes('data-mid="' + f.id + '"') || html.includes('data-v="' + f.id + '"'), `${nom}/${vue} : ${f.id} doit être cliquable`);
      }
      if (vue === 'guide') {
        const iLive = html.indexOf('"encours"'), iVenir = html.indexOf('"bientot"');
        assert.ok(iLive >= 0 && iLive < iVenir, `${nom} : le match en cours vient avant ce qui commence`);
      }
    }
  });
}

test('Chaînes : la grille commence à l\'heure actuelle, aucun bloc dans le passé', () => {
  const html = D.rendreDisposition('chaines', 'guide', jeu(), { maintenant: MAINTENANT });
  const positions = [...html.matchAll(/class="dsp-pg[^"]*"[^>]*style="--a:(-?\d+)/g)].map(m => Number(m[1]));
  assert.ok(positions.length >= 3);
  for (const a of positions) assert.ok(a >= 0, 'bloc à ' + a);
  assert.match(html, /dsp-suite/, 'le match en cours entre par le bord gauche');
});

test('La couleur suit « Couleur des cartes », avec la règle exacte de la carte par défaut', () => {
  const f = fiche('x', 'live', 0);
  assert.strictEqual(D.fondEquipes(f, 'home'), '#af1e2d');
  assert.strictEqual(D.fondEquipes(f, 'dark'), 'rgba(255,255,255,0.05)');
  assert.strictEqual(D.fondEquipes(f, 'split'), 'linear-gradient(135deg, #af1e2d 50%, #003087 50%)');
  assert.strictEqual(D.fondEquipes(f, 'gradient'), 'linear-gradient(90deg, #af1e2d 0%, #003087 100%)');
  assert.strictEqual(D.fondEquipes(f, 'gradient-45'), 'linear-gradient(135deg, #af1e2d 0%, #003087 100%)');
});

test('Les cartes des dispositions sont les cartes par défaut (.match-card, .prime-*)', () => {
  for (const [nom, vue] of [['maintenant', 'live'], ['affiches', 'live'], ['affiches', 'guide'], ['chaines', 'live'], ['chaines', 'guide']]) {
    const html = D.rendreDisposition(nom, vue, jeu(), { maintenant: MAINTENANT, couleurs: 'gradient-45' });
    assert.match(html, /class="match-card dsp-carte/, nom + '/' + vue);
    for (const c of ['prime-head', 'prime-thumbnail', 'prime-logo', 'prime-title', 'prime-info', 'prime-foot', 'card-streams']) assert.ok(html.includes(c), nom + '/' + vue + ' : ' + c);
  }
});

test('Étiquettes et abréviations', () => {
  assert.strictEqual(D.etiquetteEtat(fiche('a', 'bientot', MAINTENANT + 5), MAINTENANT), 'dans 5 min');
  assert.strictEqual(D.etiquetteEtat(fiche('a', 'fin?', 0)), 'Fin ?');
  assert.strictEqual(D.abreviation('Montreal Canadiens', { url: 'https://a.espncdn.com/i/teamlogos/nhl/500/scoreboard/mtl.png' }), 'MTL');
  assert.strictEqual(D.abreviation('CF Montréal', null), 'MON');
  assert.strictEqual(D.libelleHeure(25), 'Demain 1 h');
});

test('Le texte venu des sources est échappé', () => {
  const html = D.rendreDisposition('tableau', 'live', [fiche('<x>', 'live', 0, { dom: '<img onerror=1>' })], { maintenant: 30 });
  assert.doesNotMatch(html, /<img onerror/);
});

test('Options propose les cinq dispositions pour le Live et pour le Guide, « Actuelle » au Live, « Chaînes » au Guide, et le module est précaché', () => {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const id of ['pref-disposition-live', 'pref-disposition-guide']) {
    const bloc = index.slice(index.indexOf('id="' + id + '"'), index.indexOf('</select>', index.indexOf('id="' + id + '"')));
    assert.deepStrictEqual([...bloc.matchAll(/value="([a-z]+)"/g)].map(m => m[1]), ['actuelle', 'tableau', 'maintenant', 'affiches', 'chaines'], id);
    // « Guide par défaut : Chaînes » (25 octobre 2026).
    assert.match(bloc, id === 'pref-disposition-guide' ? /value="chaines" selected/ : /value="actuelle" selected/, id);
    assert.strictEqual((bloc.match(/ selected/g) || []).length, 1, id);
  }
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /'\.\/js\/dispositions\.js'/);
});

test('Chaînes : un bloc court a de quoi afficher les abréviations ; l\'étoile ne tronque pas le nom', () => {
  const html = D.rendreDisposition('chaines', 'guide', jeu(), { maintenant: MAINTENANT });
  assert.match(html, /<span class="dsp-court">MTL–[A-Z]{2,4}<\/span>/);
  assert.match(html, /<span class="dsp-long">Montreal Canadiens – Buffalo Sabres<\/span>/);
  const t = D.rendreDisposition('tableau', 'guide', jeu(), { maintenant: MAINTENANT });
  assert.match(t, /<span>Montreal Canadiens – Buffalo Sabres<\/span><span class="dsp-fav"/, 'l\'étoile est hors de la zone tronquée');
});

test('Guide Chaînes : des pastilles de ligue en tête, qui filtrent la grille (« toggles en haut par ligue »)', () => {
  const fiches = jeu().concat([fiche('foot', 'bientot', 21 * 60 + 15, { ligue: 'LA LIGA', dom: 'Barcelona', ext: 'Real Madrid' })]);
  const tout = D.rendreDisposition('chaines', 'guide', fiches, { maintenant: MAINTENANT });
  assert.match(tout, /^<div class="dsp [^"]*"><div class="dsp-filtres">/, 'en tête du Guide');
  assert.match(tout, /data-dsp="ligue" data-v="toutes" aria-pressed="true">Toutes · 6</);
  assert.match(tout, /data-dsp="ligue" data-v="NHL" aria-pressed="false">NHL · 5</);
  assert.match(tout, /data-dsp="ligue" data-v="LA LIGA" aria-pressed="false">LA LIGA · 1</);
  assert.match(tout, /Barcelona/);
  D.etatDisposition.ligue = 'LA LIGA';
  try {
    const liga = D.rendreDisposition('chaines', 'guide', fiches, { maintenant: MAINTENANT });
    assert.match(liga, /data-v="LA LIGA" aria-pressed="true"/);
    assert.ok(!/<div class="dsp-lgh">NHL</.test(liga), 'les autres ligues sortent de la grille');
    assert.match(liga, /<div class="dsp-lgh">LA LIGA</);
  } finally { D.etatDisposition.ligue = 'toutes'; }
});

/* La marque de jouabilité sur la ligne d'un lien (marqueJouabilite, js/playability.js).
 *
 * Ce que ce test protège : `sortFluxLinks` mettait déjà les liens jouables en
 * tête, mais la liste affichait tous les autres à la suite sans rien pour les
 * distinguer. Mesuré le 26 septembre 2026 sur le cache du jour : 2205 des 4825
 * liens (46 %) portaient sur un hôte éprouvé au moins trois fois qui n'a JAMAIS
 * joué — sportplus.watch à lui seul en portait 950, un cinquième du total.
 *
 * `js/playability.js` n'importe rien et ne touche pas au DOM : la règle s'éprouve
 * donc directement, sans navigateur et sans le faux DOM que demandent les modules
 * d'interface. C'est la raison pour laquelle la décision vit là et non dans
 * js/ui.js, qui ne fait que l'habiller (badgeJouabilite).
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');

// Le registre tel que le serveur le livre : `window.hostPlayLedger`, rempli par
// js/main.js depuis le champ `hostPlay` de data/streams.json.
const REGISTRE = {
    'jamais.example': { tested: 12, plays: 0 },   // éprouvé souvent, jamais joué
    'parfois.example': { tested: 10, plays: 6 },  // joue le plus souvent
    'apeine.example': { tested: 2, plays: 0 },    // trop peu éprouvé pour juger
    'moitie.example': { tested: 10, plays: 2 },   // joue parfois
};

let marqueJouabilite;

test.before(async () => {
    ({ marqueJouabilite } = await import('../js/playability.js'));
});

const lien = (url, extra) => Object.assign({ name: 'Flux', url }, extra || {});

test("un hôte éprouvé qui n'a jamais joué est marqué, avec son compte", () => {
    const mq = marqueJouabilite(lien('https://jamais.example/live/1'), REGISTRE);
    assert.ok(mq, 'la marque doit être là');
    assert.equal(mq.classe, 'si-mort');
    // 0/4 et 0/24 ne méritent pas la même confiance : le compte part en clair.
    assert.equal(mq.texte, '0/12');
    assert.match(mq.infobulle, /12 fois/);
});

test("un hôte qui joue le plus souvent n'est pas marqué", () => {
    // Sans observation SUR CE LIEN, rien n'est promis : le classement suffit.
    assert.equal(marqueJouabilite(lien('https://parfois.example/live/1'), REGISTRE), null);
});

test("un hôte trop peu éprouvé n'est pas marqué", () => {
    // Le seuil de trois est celui de playabilityScore : au-dessous, l'hôte peut
    // simplement être tombé pendant l'essai. Marquer sur un doute serait du bruit.
    assert.equal(marqueJouabilite(lien('https://apeine.example/live/1'), REGISTRE), null);
});

test("un hôte qui joue parfois n'est pas marqué", () => {
    assert.equal(marqueJouabilite(lien('https://moitie.example/live/1'), REGISTRE), null);
});

test('un lien vu en train de jouer porte sa marque, même sur un hôte douteux', () => {
    const mq = marqueJouabilite(lien('https://moitie.example/live/1', { verified: 'plays' }), REGISTRE);
    assert.ok(mq);
    assert.equal(mq.classe, 'si-joue');
});

test("un hôte inconnu du registre n'est pas marqué", () => {
    assert.equal(marqueJouabilite(lien('https://inconnu.example/live/1'), REGISTRE), null);
});

test('un registre vide ou absent ne marque rien, et ne casse rien', () => {
    assert.equal(marqueJouabilite(lien('https://jamais.example/live/1'), {}), null);
    assert.equal(marqueJouabilite(lien('https://jamais.example/live/1'), null), null);
    assert.equal(marqueJouabilite(null, REGISTRE), null);
    assert.equal(marqueJouabilite({ name: 'sans url' }, REGISTRE), null);
});

test("le verdict porte sur la cible de la tuile, pas sur l'adresse affichée", async () => {
    /* `tileTarget` déplie un lien qui passe par un intermédiaire : l'hôte
       RÉELLEMENT chargé dans la tuile est le seul qui ait été éprouvé, donc le
       seul sur lequel le registre a quelque chose à dire. La marque doit lire le
       même hôte que `playabilityScore`, qui fait `hostOfUrl(tileTarget(link))` —
       sinon un lien serait classé sur un hôte et marqué sur un autre. */
    const { tileTarget, hostOfUrl, playabilityScore } = await import('../js/playability.js');

    const l = lien('https://intermediaire.example/go?u=https%3A%2F%2Fjamais.example%2Flive%2F1');
    const hoteJuge = hostOfUrl(tileTarget(l));
    const registre = {};
    registre[hoteJuge] = { tested: 9, plays: 0 };

    const mq = marqueJouabilite(l, registre);
    assert.ok(mq, 'la marque doit suivre le même hôte que le classement');
    assert.equal(mq.texte, '0/9');
    // Et le classement doit être d'accord : hôte éprouvé qui ne joue jamais → 0.
    assert.equal(playabilityScore(l, registre), 0);
});

test('la règle et son habillage restent branchés ensemble', () => {
    /* Le test précédent éprouve la règle ; celui-ci vérifie qu'elle est encore
       posée sur la ligne. Une règle juste que l'interface a cessé d'appeler ne se
       voit dans aucun test de logique. */
    const ui = fs.readFileSync(path.join(RACINE, 'js', 'ui.js'), 'utf8');
    assert.match(ui, /marqueJouabilite/, 'js/ui.js doit importer la règle');
    assert.match(ui, /badgeJouabilite\(s, ledger\)/, 'la ligne du flux doit poser la marque');

    // Une marque sans style est invisible : on la lit là où elle vit.
    const css = fs.readFileSync(path.join(RACINE, 'styles.css'), 'utf8');
    assert.match(css, /\.si-joue/, '.si-joue doit être stylée');
    assert.match(css, /\.si-mort/, '.si-mort doit être stylée');
});

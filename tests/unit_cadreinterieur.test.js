/* Le script utilisateur reprend UN cadre intérieur seulement quand Firefox y a écrit
   sa page d'erreur. La tuile, elle, ne reconstruit rien. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.join(__dirname, '..', 'multiview-cleaner.user.js'), 'utf8');
const mv = fs.readFileSync(path.join(__dirname, '..', 'js', 'multiview.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

assert.ok(/function reprendreCadreRefuse\(iframe\)/.test(script), 'le script sait reprendre un cadre refusé');
assert.ok(/can\.\?t open this page/.test(script), 'il reconnaît la page d\'erreur de Firefox');
assert.ok(/catch \(e\) \{ return; \}/.test(script), 'un cadre d\'une autre origine, illisible, est laissé tel quel');
assert.ok(/texte\.length < 40/.test(script), 'une page vide ou about:blank ne déclenche pas la reprise');
assert.ok(/cadresRepris >= 1/.test(script), 'une seule reprise par page');
assert.ok(/iframe\.srcdoc = '<base href="'/.test(script), 'le HTML relu est posé dans le cadre, avec sa base');
/* La reprise est arrivée avec la 1.10 ; une version plus récente la garde. Ce qui compte,
   c'est que la version annoncée à l'application soit celle de l'en-tête. */
const enTete = (script.match(/@version\s+(\d+)\.(\d+)/) || []).slice(1).map(Number);
const annoncee = (script.match(/var VERSION = '(\d+)\.(\d+)'/) || []).slice(1).map(Number);
assert.ok(enTete.length === 2 && enTete.join('.') === annoncee.join('.'), 'la version annoncée suit l\'en-tête');
assert.ok(enTete[0] > 1 || (enTete[0] === 1 && enTete[1] >= 10), 'au moins la 1.10, qui sait reprendre un cadre');
assert.ok(!/srcdoc/.test(mv), 'le Multivision ne reconstruit toujours pas la page de la tuile');

console.log('unit_cadreinterieur: OK');

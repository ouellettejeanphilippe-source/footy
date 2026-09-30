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
assert.ok(/@version\s+1\.10/.test(script) && /var VERSION = '1\.10'/.test(script), 'la version annoncée suit l\'en-tête');
assert.ok(!/srcdoc/.test(mv), 'le Multivision ne reconstruit toujours pas la page de la tuile');

console.log('unit_cadreinterieur: OK');

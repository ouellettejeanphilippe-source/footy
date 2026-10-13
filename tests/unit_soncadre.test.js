/* Le son doit atteindre la vidéo, même dans un cadre intérieur, et le clic doit
   le rendre avant que Firefox n'oublie l'activation. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.join(__dirname, '..', 'multiview-cleaner.user.js'), 'utf8');
const mv = fs.readFileSync(path.join(__dirname, '..', 'js', 'multiview.js'), 'utf8');

/* Le son dans le cadre intérieur est arrivé avec la 1.11 ; une version plus récente le
   garde, et la version annoncée à l'application suit l'en-tête. */
const enTete = (script.match(/@version\s+(\d+)\.(\d+)/) || []).slice(1).map(Number);
const annoncee = (script.match(/var VERSION = '(\d+)\.(\d+)'/) || []).slice(1).map(Number);
assert.ok(enTete.length === 2 && enTete.join('.') === annoncee.join('.'), 'la version annoncée suit l\'en-tête');
assert.ok(enTete[0] > 1 || (enTete[0] === 1 && enTete[1] >= 11), 'au moins la 1.11');
assert.ok(/ifr\.contentWindow\.postMessage\(e\.data, '\*'\)/.test(script),
  'mv_unmute est transmis au cadre du lecteur');
assert.ok(/addEventListener\('mousedown'[\s\S]{0,280}el\.muted = false/.test(script),
  'le clic rend le son dans le même tour');
assert.ok(/window\.top\.postMessage\(\{ __mv: 'sound_state'/.test(script),
  'l\'état du son remonte à l\'application, pas seulement au cadre parent');
assert.ok(!/window\.parent\.postMessage\('mv_frame_clicked'/.test(script),
  'un clic dans un lecteur imbriqué ne s\'arrête plus au cadre du dessus');
assert.ok(/e\.data === 'mv_frame_clicked'[\s\S]{0,200}indexDeTuilePour\(e\.source\)/.test(mv),
  'l\'application reconnaît la tuile même si le clic vient d\'un cadre intérieur');

console.log('unit_soncadre: OK');

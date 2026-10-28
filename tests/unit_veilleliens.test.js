/* Veille des liens sans service externe (28 octobre 2026, « Je veux pas faire rien
   d'externe ») : scripts/age_liens.mjs dit l'âge de data/streams.json, et le job `veille`
   de .github/workflows/scrape_schedule.yml ouvre, commente ou ferme une issue d'après sa
   réponse. Sans réseau, sans GitHub : le script est appelé sur des fichiers fabriqués, et
   le workflow est lu comme du texte. */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const SCRIPT = path.join(RACINE, 'scripts', 'age_liens.mjs');
const WORKFLOW = path.join(RACINE, '.github', 'workflows', 'scrape_schedule.yml');

function lancer(fichier, ...options) {
    const r = spawnSync(process.execPath, [SCRIPT, fichier, ...options], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, 'le script ne fait jamais échouer le passage : ' + r.stderr);
    return JSON.parse(r.stdout.trim());
}

async function main() {
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'veille-'));
    const ecrire = (nom, contenu) => { const p = path.join(dossier, nom); fs.writeFileSync(p, contenu); return p; };
    const MAINTENANT = '2026-10-29T12:00:00Z';

    // ── 1. Le script : frais, périmé, seuil, absent, illisible, sans date ─────────
    const frais = lancer(ecrire('frais.json', JSON.stringify({ generatedAt: '2026-10-29T11:30:00Z', matches: [] })), '--maintenant', MAINTENANT);
    assert.deepStrictEqual([frais.ageMin, frais.perime, frais.seuilMin], [30, false, 180]);
    const perime = lancer(ecrire('vieux.json', JSON.stringify({ generatedAt: '2026-10-29T08:00:00Z' })), '--maintenant', MAINTENANT);
    assert.deepStrictEqual([perime.ageMin, perime.perime], [240, true]);
    const seuil = lancer(path.join(dossier, 'vieux.json'), '--maintenant', MAINTENANT, '--seuil-min', '300');
    assert.strictEqual(seuil.perime, false, 'le seuil se règle');
    const futur = lancer(ecrire('futur.json', JSON.stringify({ generatedAt: '2026-10-29T12:05:00Z' })), '--maintenant', MAINTENANT);
    assert.deepStrictEqual([futur.ageMin, futur.perime], [0, false], 'une horloge en avance ne donne pas un âge négatif');
    const absent = lancer(path.join(dossier, 'absent.json'));
    assert.deepStrictEqual([absent.perime, absent.raison, absent.ageMin], [true, 'fichier absent', null]);
    const illisible = lancer(ecrire('casse.json', '{pas du json'));
    assert.deepStrictEqual([illisible.perime, illisible.raison], [true, 'fichier illisible']);
    const sansDate = lancer(ecrire('sansdate.json', JSON.stringify({ matches: [] })));
    assert.deepStrictEqual([sansDate.perime, sansDate.raison], [true, 'generatedAt absent']);
    ok('age_liens.mjs : frais, périmé, seuil réglable, horloge en avance, absent, illisible, sans date');

    // ── 2. La fonction importée, pour les scripts qui voudraient la réutiliser ────
    const mod = await import(SCRIPT);
    assert.strictEqual(mod.SEUIL_MIN_DEFAUT, 180);
    assert.strictEqual(mod.ageDuCache('{"generatedAt":"2026-10-29T09:00:00Z"}', Date.parse(MAINTENANT)).perime, false, '180 min, pas plus que le seuil : pas périmé');
    assert.strictEqual(mod.ageDuCache('{"generatedAt":"2026-10-29T08:59:00Z"}', Date.parse(MAINTENANT)).perime, true, '181 min : périmé');
    ok('ageDuCache : le seuil est strict, et importable');

    // ── 3. Le workflow : un job de veille après le calendrier, qui ne fait rien échouer ─
    const source = fs.readFileSync(WORKFLOW, 'utf8');
    const veille = source.slice(source.indexOf('\n  veille:'));
    assert.ok(veille.length > 20, 'le job veille existe');
    assert.ok(/needs:\s*scrape/.test(veille) && /if:\s*always\(\)/.test(veille), 'il suit le calendrier, même échoué');
    assert.ok(/issues:\s*write/.test(veille) && /contents:\s*read/.test(veille), 'il écrit des issues et ne commite rien');
    assert.ok(/node scripts\/age_liens\.mjs data\/streams\.json/.test(veille), 'il lit l\'âge par le script');
    assert.ok(/gh issue create/.test(veille) && /gh issue comment/.test(veille) && /gh issue close/.test(veille),
        'il ouvre, commente ou ferme une issue');
    assert.ok(veille.indexOf('gh issue list') < veille.indexOf('gh issue create'), 'il cherche l\'issue ouverte avant d\'en créer une');
    assert.ok(!/scrape_schedule\.mjs|scrape_streams\.mjs|git-auto-commit/.test(veille), 'il ne produit ni ne commite rien');
    assert.strictEqual((veille.match(/\|\| true/g) || []).length >= 4, true, 'chaque appel à GitHub est toléré en échec');
    assert.ok(!/healthchecks|hc-ping|workers\.dev/i.test(source), 'rien d\'externe à GitHub');
    ok('scrape_schedule.yml : le job veille, après le calendrier, sans rien d\'externe ni rien qui échoue');

    fs.rmSync(dossier, { recursive: true, force: true });
    console.log(`unit_veilleliens: ${n} groupes de tests OK`);
}

main().catch((e) => { console.error(e); process.exit(1); });

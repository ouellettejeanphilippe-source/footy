/* Le cache des liens est publié AVANT la vérification des lecteurs
   (.github/workflows/scrape_streams.yml). Sans réseau, sans GitHub : on lit le workflow
   comme du texte et on vérifie l'ordre de ses étapes.

   « C'est vraiment long » (12 septembre 2026). Mesuré sur le passage de 19:35 ce jour-là,
   étape par étape :

       lecture des onze sources           19:35:00 → 19:39:28   (4 min 28 s)
       npx playwright install             19:39:28 → 19:39:40
       vérification des lecteurs          19:39:40 → 19:44:53   (5 min 13 s)
       commit du cache                    19:44:54 → 19:44:56

   Les liens existaient donc depuis 19:39:28 et n'atteignaient l'application qu'à 19:44:56 :
   ils attendaient derrière une étape qui ne fait que les ANNOTER (quels lecteurs jouent,
   `verified` par lien et `hostPlay` par hôte). Et un runner perdu, une vérification qui
   traîne au-delà du `timeout-minutes`, ou un Chromium qui refuse de s'installer
   emportaient avec eux un cache déjà complet.

   Deux temps depuis : le cache est commité dès qu'il existe, l'annotation dans un second
   commit — depuis le 29 octobre 2026, par un autre job, après trois machines de
   vérification en parallèle. Ce test verrouille cet ordre, parce qu'il se défait d'un simple déplacement de
   bloc et que rien, dans le fichier, ne le rendrait visible. Il vérifie aussi ce qui
   rendait la panne du 6 septembre possible (le rebase avant chaque commit) et que la
   vérification reste facultative (`continue-on-error`), sans quoi son échec ferait échouer
   le passage et déclencherait le relais pour rien. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WORKFLOW = path.join(__dirname, '..', '.github', 'workflows', 'scrape_streams.yml');

/* Le texte de chaque job (`  nom:` indenté de deux espaces, sous `jobs:`), et les noms
   de ses étapes dans l'ordre du fichier (un `- name:` indenté de six espaces). */
function jobs(source) {
    const corps = source.slice(source.indexOf('\njobs:'));
    const out = {};
    let courant = null;
    for (const ligne of corps.split('\n')) {
        const j = /^  ([a-z_-]+):\s*$/.exec(ligne);
        if (j) { courant = j[1]; out[courant] = { texte: '', etapes: [] }; continue; }
        if (!courant) continue;
        out[courant].texte += ligne + '\n';
        const m = /^      - name:\s*(.+?)\s*$/.exec(ligne);
        if (m) out[courant].etapes.push(m[1]);
    }
    return out;
}

function main() {
    const source = fs.readFileSync(WORKFLOW, 'utf8');
    const J = jobs(source);
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const position = (etapes, fragment) => etapes.findIndex((e) => e.toLowerCase().includes(fragment));

    // ── 1. Les étapes qui comptent existent, chacune dans son job ─────────────
    /* Depuis le 29 octobre 2026, la vérification tourne sur trois machines en parallèle
       (job `verifier`, une matrice) et ses relevés sont appliqués par un job à part
       (`annoter`) : « rendre plus rapide… le taux de fonctionnement des streams ». */
    assert.ok(J.scrape && J.verifier && J.annoter && J.relais, 'les quatre jobs sont là');
    const S = J.scrape.etapes, V = J.verifier.etapes, A = J.annoter.etapes;
    const scrape = position(S, 'prefetch stream links'), commitLiens = position(S, 'commit changes');
    const chromium = position(V, 'install chromium'), verif = position(V, 'verify which players');
    const appliquer = position(A, 'apply the observations'), commitVerif = position(A, 'commit the player verification');
    assert.ok(scrape >= 0, 'la lecture des sources est là');
    assert.ok(commitLiens >= 0, 'le commit du cache est là');
    assert.ok(chromium >= 0 && verif >= 0, 'la vérification des lecteurs est là');
    assert.ok(appliquer >= 0 && commitVerif >= 0, 'l\'annotation est appliquée puis commitée (second temps)');
    ok('le workflow porte bien ses étapes de production');

    // ── 2. L'ordre : publier, puis vérifier ───────────────────────────────────
    /* Les liens existaient à 19:39:28 et n'atteignaient l'application qu'à 19:44:56,
       derrière une étape qui ne fait que les annoter (relevé le 12 septembre 2026). */
    assert.ok(scrape < commitLiens, 'on commite le cache après l\'avoir produit');
    assert.ok(position(S, 'verify which players') < 0 && position(S, 'install chromium') < 0,
        'la vérification n\'est plus dans le job qui publie le cache');
    assert.ok(/needs:\s*scrape\b/.test(J.verifier.texte),
        'la vérification attend le job qui publie : le cache est publié AVANT elle');
    assert.ok(position(S, 'upload the cache') > commitLiens, 'elle reçoit le cache publié, après son commit');
    assert.ok(/needs:\s*\[\s*scrape\s*,\s*verifier\s*\]/.test(J.annoter.texte), 'l\'annotation attend les trois parts');
    assert.ok(appliquer < commitVerif, 'l\'annotation est commitée après avoir été produite');
    ok('les liens sont publiés d\'abord, la vérification annote ensuite');

    // ── 3. Les parts : la même liste, une cible sur N chacune ────────────────
    const parts = /part:\s*\[([^\]]+)\]/.exec(J.verifier.texte);
    assert.ok(parts, 'une matrice de parts');
    const N = parts[1].split(',').length;
    assert.ok(N >= 2, 'au moins deux machines');
    assert.deepStrictEqual(parts[1].split(',').map((x) => Number(x.trim())), [...Array(N).keys()], 'parts 0 à N-1');
    assert.ok(new RegExp('--part \\$\\{\\{ matrix\\.part \\}\\}/' + N + '\\b').test(J.verifier.texte), 'chaque machine prend sa part sur ' + N);
    assert.ok(/--maintenant \$\{\{ needs\.scrape\.outputs\.maintenant \}\}/.test(J.verifier.texte),
        'le même instant pour toutes : elles calculent la même liste de cibles');
    assert.ok(/name:\s*cache-a-verifier/.test(J.verifier.texte) && /name:\s*cache-a-verifier/.test(J.scrape.texte),
        'le même fichier pour toutes : celui qui vient d\'être publié');
    assert.ok(/fail-fast:\s*false/.test(J.verifier.texte), 'une part qui tombe n\'arrête pas les autres');
    assert.ok(/--appliquer releves\/\*\.json/.test(J.annoter.texte) && /pattern:\s*releves-\*/.test(J.annoter.texte),
        'l\'annotation applique les relevés de toutes les parts');
    ok('N parts sur la même liste, au même instant, réunies à la fin');

    // ── 4. Chaque commit est précédé d'un rebase ──────────────────────────────
    /* Le 6 septembre 2026, un cache frais n'a pas pu être poussé (« non-fast-forward » :
       main avait bougé pendant le scrape) et l'application est restée deux heures sur des
       liens périmés. Chaque commit doit donc se replacer sur main d'abord. */
    const rebaseS = S.findIndex((e) => /rebase/i.test(e)), rebaseA = A.findIndex((e) => /rebase/i.test(e));
    assert.ok(rebaseS > scrape && rebaseS < commitLiens, 'le premier rebase précède le commit du cache');
    assert.ok(rebaseA > appliquer && rebaseA < commitVerif, 'le second précède le commit de l\'annotation');
    ok('chaque commit se replace sur main avant de pousser');

    // ── 5. La vérification reste facultative ──────────────────────────────────
    /* Un Chromium qui refuse de s'installer, ou une vérification qui échoue, ne doit pas
       faire échouer le passage : le cache est déjà publié, et un passage « rouge » pour
       cette raison ferait croire à une panne de liens. */
    const bloc = J.verifier.texte.slice(J.verifier.texte.indexOf('Install Chromium'), J.verifier.texte.indexOf('Upload the observations'));
    assert.strictEqual((bloc.match(/continue-on-error:\s*true/g) || []).length, 2,
        'les deux étapes de vérification portent continue-on-error');
    assert.ok(/if:\s*always\(\) && needs\.scrape\.result == 'success'/.test(J.annoter.texte),
        'l\'annotation passe même si une part a échoué');
    assert.ok(/needs:\s*scrape\b/.test(J.relais.texte), 'le relais ne dépend que du scrape, pas de la vérification');
    ok('la vérification des lecteurs ne peut pas faire échouer le passage');

    // ── 6. Ce que chaque commit emporte ───────────────────────────────────────
    /* `domains.json` porte l'apprentissage des miroirs : sans lui, le navigateur
       repartirait sur une adresse morte. Le second commit, lui, ne touche qu'au cache :
       la vérification n'écrit que data/streams.json et data/tv.json. */
    const motifs = source.match(/file_pattern:\s*"([^"]+)"/g) || [];
    assert.strictEqual(motifs.length, 2);
    assert.ok(/data\/streams\.json/.test(motifs[0]) && /domains\.json/.test(motifs[0]),
        'le premier commit emporte le cache, le calendrier et l\'apprentissage des miroirs');
    assert.ok(/data\/streams\.json/.test(motifs[1]) && !/domains\.json/.test(motifs[1]),
        'le second ne touche qu\'au cache, seul fichier que la vérification écrit');
    ok('chaque commit emporte exactement ce que son étape a produit');

    // ── 7. Le relais réessaie sa relance ─────────────────────────────────────
    /* Le 6 octobre 2026, `gh workflow run` a reçu un HTTP 500 : un seul essai, la chaîne
       s'est arrêtée, et le cron ne tournait plus depuis le 20 septembre. Les liens sont
       restés figés deux jours et demi. La relance doit être dans une boucle d'essais, et
       chaque essai doit d'abord vérifier qu'un passage n'existe pas déjà (une erreur de
       l'API n'empêche pas forcément la création du passage). */
    const relais = J.relais.texte;
    assert.ok(relais.length > 20, 'le job relais existe');
    const boucle = /for essai in ([\d ]+); do([\s\S]*?)\n\s*done/.exec(relais);
    assert.ok(boucle, 'la relance est dans une boucle d\'essais');
    assert.ok(boucle[1].trim().split(/\s+/).length >= 3, 'au moins trois essais');
    const corps = boucle[2];
    assert.ok(/gh workflow run scrape_streams\.yml/.test(corps), 'la relance est dans la boucle');
    assert.ok(corps.indexOf('autres') < corps.indexOf('gh workflow run'),
        'chaque essai vérifie d\'abord qu\'aucun passage n\'est déjà en route');
    assert.ok(/sleep/.test(corps), 'les essais sont espacés');
    assert.strictEqual((relais.match(/gh workflow run/g) || []).length, 1,
        'aucune relance hors de la boucle');
    ok('le relais réessaie sa relance au lieu de casser la chaîne');

    console.log(`unit_workflowliens: ${n} groupes de tests OK`);
}

main();

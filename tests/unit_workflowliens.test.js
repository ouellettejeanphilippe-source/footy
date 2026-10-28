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
   commit. Ce test verrouille cet ordre, parce qu'il se défait d'un simple déplacement de
   bloc et que rien, dans le fichier, ne le rendrait visible. Il vérifie aussi ce qui
   rendait la panne du 6 septembre possible (le rebase avant chaque commit) et que la
   vérification reste facultative (`continue-on-error`), sans quoi son échec ferait échouer
   le passage et déclencherait le relais pour rien. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WORKFLOW = path.join(__dirname, '..', '.github', 'workflows', 'scrape_streams.yml');

/* Les noms d'étapes dans l'ordre du fichier. Un `- name:` indenté de six espaces est une
   étape ; le job `relais` a les siennes, on ne garde que celles du job `scrape`. */
function etapesDuJobScrape(source) {
    const lignes = source.split('\n');
    const etapes = [];
    let dansScrape = false;
    for (const ligne of lignes) {
        if (/^  [a-z_-]+:\s*$/.test(ligne)) dansScrape = /^  scrape:/.test(ligne);
        const m = /^      - name:\s*(.+?)\s*$/.exec(ligne);
        if (m && dansScrape) etapes.push(m[1]);
    }
    return etapes;
}

function main() {
    const source = fs.readFileSync(WORKFLOW, 'utf8');
    const etapes = etapesDuJobScrape(source);
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };

    const position = (fragment) => etapes.findIndex((e) => e.toLowerCase().includes(fragment));
    const scrape = position('prefetch stream links');
    const commitLiens = position('commit changes');
    const chromium = position('install chromium');
    const verif = position('verify which players');
    const commitVerif = position('commit the player verification');

    // ── 1. Les cinq étapes qui comptent existent ──────────────────────────────
    assert.ok(scrape >= 0, 'la lecture des sources est là');
    assert.ok(commitLiens >= 0, 'le commit du cache est là');
    assert.ok(chromium >= 0 && verif >= 0, 'la vérification des lecteurs est là');
    assert.ok(commitVerif >= 0, 'le commit de l\'annotation est là (second temps)');
    ok('le workflow porte bien ses cinq étapes de production');

    // ── 2. L'ordre : publier, puis vérifier ───────────────────────────────────
    assert.ok(scrape < commitLiens,
        'on commite le cache après l\'avoir produit');
    assert.ok(commitLiens < chromium && commitLiens < verif,
        'le cache est publié AVANT la vérification des lecteurs — sinon les liens attendent '
        + 'cinq minutes derrière une étape qui ne fait que les annoter (relevé le 12 septembre 2026)');
    assert.ok(verif < commitVerif, 'l\'annotation est commitée après avoir été produite');
    ok('les liens sont publiés d\'abord, la vérification annote ensuite');

    // ── 3. Chaque commit est précédé d'un rebase ──────────────────────────────
    /* Le 6 septembre 2026, un cache frais n'a pas pu être poussé (« non-fast-forward » :
       main avait bougé pendant le scrape) et l'application est restée deux heures sur des
       liens périmés. Chaque commit doit donc se replacer sur main d'abord. */
    const rebases = etapes.map((e, i) => ({ e, i })).filter((x) => /rebase/i.test(x.e)).map((x) => x.i);
    assert.strictEqual(rebases.length, 2, 'un rebase par commit');
    assert.ok(rebases[0] < commitLiens && rebases[0] > scrape, 'le premier rebase précède le commit du cache');
    assert.ok(rebases[1] < commitVerif && rebases[1] > verif, 'le second précède le commit de l\'annotation');
    ok('chaque commit se replace sur main avant de pousser');

    // ── 4. La vérification reste facultative ──────────────────────────────────
    /* Un Chromium qui refuse de s'installer, ou une vérification qui échoue, ne doit pas
       faire échouer le passage : le cache est déjà publié, et un passage « rouge » pour
       cette raison ferait croire à une panne de liens. */
    const bloc = source.slice(source.indexOf('Install Chromium'), source.indexOf('Rebase again'));
    assert.strictEqual((bloc.match(/continue-on-error:\s*true/g) || []).length, 2,
        'les deux étapes de vérification portent continue-on-error');
    ok('la vérification des lecteurs ne peut pas faire échouer le passage');

    // ── 5. Ce que chaque commit emporte ───────────────────────────────────────
    /* `domains.json` porte l'apprentissage des miroirs : sans lui, le navigateur
       repartirait sur une adresse morte. Le second commit, lui, ne touche qu'au cache :
       la vérification n'écrit que data/streams.json (scripts/verify_players.mjs). */
    const motifs = source.match(/file_pattern:\s*"([^"]+)"/g) || [];
    assert.strictEqual(motifs.length, 2);
    assert.ok(/data\/streams\.json/.test(motifs[0]) && /domains\.json/.test(motifs[0]),
        'le premier commit emporte le cache, le calendrier et l\'apprentissage des miroirs');
    assert.ok(/data\/streams\.json/.test(motifs[1]) && !/domains\.json/.test(motifs[1]),
        'le second ne touche qu\'au cache, seul fichier que la vérification écrit');
    ok('chaque commit emporte exactement ce que son étape a produit');

    // ── 6. Le relais réessaie sa relance ─────────────────────────────────────
    /* Le 6 octobre 2026, `gh workflow run` a reçu un HTTP 500 : un seul essai, la chaîne
       s'est arrêtée, et le cron ne tournait plus depuis le 20 septembre. Les liens sont
       restés figés deux jours et demi. La relance doit être dans une boucle d'essais, et
       chaque essai doit d'abord vérifier qu'un passage n'existe pas déjà (une erreur de
       l'API n'empêche pas forcément la création du passage). */
    const relais = source.slice(source.indexOf('\n  relais:'));
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

    // ── 7. La surveillance est prévenue dès que le cache est publié ──────────
    /* La chaîne s'est déjà arrêtée sans prévenir (cron mort du 20 septembre au 9 octobre
       2026, relance en HTTP 500 le 6 octobre), et on l'a appris par le bandeau « Liens
       datant de 9 h ». Un ping vers un « dead man's switch » part juste après le commit
       du cache — AVANT la vérification des lecteurs, qui peut traîner cinq minutes et
       ferait croire à un créneau manqué. Sans le secret, l'étape ne fait rien ; une panne
       du service de surveillance ne fait pas échouer le passage. Un passage qui échoue
       avant de publier le signale lui-même (`/fail`). */
    const ping = position('ping the watchdog');
    assert.ok(ping >= 0, 'l\'étape de ping existe');
    assert.ok(ping > commitLiens && ping < chromium,
        'le ping part après le commit du cache et avant la vérification des lecteurs');
    const blocPing = source.slice(source.indexOf('Ping the watchdog'), source.indexOf('Install Chromium'));
    assert.ok(/secrets\.HC_PING_URL/.test(blocPing), 'l\'adresse vient du secret HC_PING_URL');
    assert.ok(/-z "\$HC_PING_URL"/.test(blocPing), 'sans secret, l\'étape ne fait rien');
    assert.ok(/continue-on-error:\s*true/.test(blocPing), 'une panne de la surveillance ne fait pas échouer le passage');
    assert.ok(/curl .*--retry \d/.test(blocPing), 'le ping est réessayé');
    const echec = position('tell the watchdog the run failed');
    assert.ok(echec > commitVerif, 'le signal d\'échec est la dernière étape du job');
    const blocEchec = source.slice(source.indexOf('Tell the watchdog'), source.indexOf('\n  relais:'));
    assert.ok(/if:\s*failure\(\)/.test(blocEchec), 'le signal d\'échec ne part que sur un échec');
    assert.ok(/\$HC_PING_URL\/fail/.test(blocEchec), 'il va sur /fail');
    assert.ok(/continue-on-error:\s*true/.test(blocEchec), 'et ne peut pas non plus faire échouer le passage');
    ok('la surveillance est prévenue dès que le cache est publié, et dès qu\'un passage échoue');

    console.log(`unit_workflowliens: ${n} groupes de tests OK`);
}

main();

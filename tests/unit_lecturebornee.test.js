/* Lecture bornée du corps des réponses (scripts/scrape_streams.mjs).

   Le passage horaire du 5 septembre 2026 est mort trois fois de suite sur
   « FATAL ERROR: Ineffective mark-compacts near heap limit — JavaScript heap out of
   memory », 4 Go épuisés. Il avait relevé ses 633 pages de match sans peine : c'est la
   phase d'extraction des lecteurs qui a fait sauter le tas. Conséquence pour
   l'utilisateur : le cache servi est resté figé sur la version de 23 h, et les correctifs
   fusionnés entre-temps n'ont jamais atteint personne.

   La cause est structurelle. On suit des chaînes de lecteurs — jusqu'à trois sauts, douze
   en parallèle — vers des adresses dont on ne sait rien à l'avance ; `r.text()` avale ce
   qu'on lui donne, y compris un segment vidéo servi en flux continu, sans longueur
   annoncée. Le nombre de liens sondés étant passé de 700 à 3000, ce qui ne coûtait qu'un
   pic est devenu fatal.

   Ces cas vérifient les deux bornes sur la fonction elle-même, pas sur sa forme. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

/* On extrait la fonction de la source du script et on l'évalue : le script est un module
   ESM à effets de bord (il scrape en s'exécutant), on ne peut donc pas simplement
   l'importer pour l'interroger. */
function chargerTexteBorne(src) {
    const debut = src.indexOf('const EXTRACT_MAX_OCTETS');
    assert.ok(debut > 0, 'EXTRACT_MAX_OCTETS doit exister dans le script');
    const fin = src.indexOf('\n}\n', src.indexOf('async function texteBorne'));
    assert.ok(fin > debut, 'texteBorne doit exister dans le script');
    const code = src.slice(debut, fin + 3);
    // eslint-disable-next-line no-new-func
    return new Function('Buffer', code + '\nreturn { texteBorne, EXTRACT_MAX_OCTETS };')(Buffer);
}

/* Une réponse dont le corps est un flux sans fin : exactement ce qu'est un segment vidéo
   servi en direct, et exactement ce qui a tué le passage horaire. */
function reponseSansFin(type) {
    const bloc = new Uint8Array(64 * 1024).fill(65);
    let servis = 0;
    return {
        headers: { get: () => type },
        body: {
            getReader: () => ({
                /* Le flux s'arrête de lui-même à 50 Mo : sans plafond côté lecture, la boucle
               ne rendrait jamais la main et le test pendrait au lieu d'échouer. On veut
               une assertion qui nomme le défaut, pas un banc d'essai qui gèle. */
            read: () => {
                if (servis >= 50 * 1024 * 1024) return Promise.resolve({ done: true });
                servis += bloc.length;
                return Promise.resolve({ done: false, value: bloc });
            },
                cancel: () => Promise.resolve()
            })
        },
        octetsServis: () => servis
    };
}

function reponseFinie(type, octets) {
    let reste = octets;
    let annulee = false;
    return {
        headers: { get: () => type },
        body: {
            getReader: () => ({
                read: () => {
                    if (reste <= 0) return Promise.resolve({ done: true });
                    const n = Math.min(reste, 32 * 1024);
                    reste -= n;
                    return Promise.resolve({ done: false, value: new Uint8Array(n).fill(66) });
                },
                cancel: () => Promise.resolve()
            }),
            cancel: () => { annulee = true; return Promise.resolve(); }
        },
        aEteAnnulee: () => annulee
    };
}

async function main() {
    let n = 0;
    const ok = (name) => { n++; console.log('  ✓ ' + name); };
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'scrape_streams.mjs'), 'utf8');
    const { texteBorne, EXTRACT_MAX_OCTETS } = chargerTexteBorne(src);

    // ── 1. Un flux sans fin s'arrête au plafond ─────────────────────────────
    const infini = reponseSansFin('text/html');
    const lu = await texteBorne(infini);
    assert.ok(lu.length <= EXTRACT_MAX_OCTETS,
        'la lecture doit s\'arrêter au plafond : c\'est ce flux-là qui a épuisé les 4 Go du tas '
        + '(obtenu ' + lu.length + ' octets pour un plafond de ' + EXTRACT_MAX_OCTETS + ')');
    assert.ok(infini.octetsServis() < EXTRACT_MAX_OCTETS + 200 * 1024,
        'on ne doit pas continuer à tirer du réseau après avoir atteint le plafond');
    ok('un corps sans fin est coupé au plafond, et le réseau n\'est plus sollicité après');

    // ── 2. Ce qui n'est pas du texte n'est même pas lu ──────────────────────
    for (const type of ['video/mp2t', 'application/octet-stream', 'video/mp4', 'image/png']) {
        const bin = reponseFinie(type, 5 * 1024 * 1024);
        assert.strictEqual(await texteBorne(bin), '',
            'un corps « ' + type + ' » n\'a rien à apprendre à l\'extracteur et ne doit pas être chargé');
        assert.ok(bin.aEteAnnulee(), 'le corps refusé doit être annulé, pas laissé ouvert');
    }
    ok('les corps non textuels sont refusés à l\'en-tête et leur flux est annulé');

    // ── 3. Le cas normal passe intact ───────────────────────────────────────
    /* Une vraie page de lecteur relevée ce jour-là fait 652 882 octets ; elle doit être
       lue en entier, sinon on couperait l'adresse du flux qu'elle contient. */
    for (const type of ['text/html; charset=utf-8', 'application/json', 'text/javascript', '']) {
        const page = reponseFinie(type, 652882);
        const t = await texteBorne(page);
        assert.strictEqual(t.length, 652882,
            'une page de ' + (type || 'type non déclaré') + ' sous le plafond doit être lue en entier');
    }
    ok('une page normale est lue intégralement, type absent compris');

    // ── 4. Le plafond laisse passer les pages réelles ───────────────────────
    assert.ok(EXTRACT_MAX_OCTETS >= 700000,
        'le plafond doit rester au-dessus des pages de lecteur réellement observées (652 882 octets)');
    ok('le plafond reste au-dessus des pages réellement observées');

    console.log('unit_lecturebornee: ' + n + ' groupes OK');
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

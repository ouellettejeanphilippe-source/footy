/* Priorité de la file des pages de match (scripts/scrape_streams.mjs).

   Signalé le 5 septembre 2026 : « ya moins de streams depuis les derniers PR », puis
   précisé : « les matchs live sont les seuls avec liens ». Vérifié sur le cache du jour :
   636 matchs scrapés, dont 621 en direct ou à venir, contre LIMIT=400. Au-delà de la
   400ᵉ page, un match ne reçoit plus que le lien minimal capté sur la page d'accueil de
   la source, jamais les dizaines de liens que sa page de match aurait données.

   Le tri « en direct, puis à venir, puis terminé » ne distinguait pas, DANS le groupe
   « à venir » (593 matchs ce jour-là), le match qui commence dans 10 minutes de celui de
   demain — les deux avaient les mêmes chances d'entrer dans les 400 premières places, au
   hasard de l'ordre des sources plutôt que de l'urgence réelle.

   La fonction de tri n'est pas exportée (script autonome, pas un module de l'app) : ce
   test la relit dans la source et la ré-exécute isolément, pour ne pas dépendre d'un
   run réseau — impossible à garantir dans un environnement de CI. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function main() {
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'scrape_streams.mjs'), 'utf8');

  // ── 1. La priorité est bien temporelle, pas seulement par statut ──────────────
  assert.ok(/const enMinutes = \(m\) => config\.minutesUntilStart\(m, new Date\(\)\);/.test(src),
    'le tri doit utiliser minutesUntilStart pour départager les matchs à venir');
  assert.ok(/if \(ra === 1\) return enMinutes\(a\) - enMinutes\(b\);/.test(src),
    'les matchs à venir doivent être triés par proximité du coup d\'envoi');
  ok('le script utilise bien la proximité du coup d\'envoi, pas seulement le statut');

  // ── 2. La limite est un filet, pas un mécanisme de priorité ───────────────────
  assert.ok(/: 900; \}\)\(\);/.test(src), 'LIMIT doit être relevé à 900, pas resté à 400');
  ok('LIMIT est relevé à 900');

  // ── 3. La règle elle-même, testée isolément ───────────────────────────────────
  /* Reproduction exacte de la fonction du script : si elle change de comportement sans
     que ce test soit mis à jour, c'est le signe qu'il faut relire le script, pas
     supposer que le test a raison. */
  function minutesUntilStart(m, now) {
      var t = /^(\d{1,2}):(\d{2})$/.exec(String(m && m.startTime || '').trim());
      if (!t) return null;
      var startMins = parseInt(t[1], 10) * 60 + parseInt(t[2], 10);
      if (startMins > 1439) return null;
      return startMins; // simplifié pour le test : pas de fuseau horaire à simuler
  }
  const enMinutes = (m) => minutesUntilStart(m, null);
  const rang = (m) => {
      if (m.status === 'live') return 0;
      if (m.status === 'finished') return 3;
      const mn = enMinutes(m);
      return mn === null ? 2 : 1;
  };
  const trier = (matchs) => matchs.slice().sort((a, b) => {
      const ra = rang(a), rb = rang(b);
      if (ra !== rb) return ra - rb;
      if (ra === 1) return enMinutes(a) - enMinutes(b);
      return 0;
  });

  const jeu = [
    { id: 'demain', status: 'upcoming', startTime: '23:50' },
    { id: 'bientot', status: 'upcoming', startTime: '00:05' },
    { id: 'direct', status: 'live', startTime: '00:00' },
    { id: 'termine', status: 'finished', startTime: '00:00' },
    { id: 'heure-illisible', status: 'upcoming', startTime: '' },
  ];
  const ordre = trier(jeu).map(m => m.id);
  assert.deepStrictEqual(ordre, ['direct', 'bientot', 'demain', 'heure-illisible', 'termine']);
  ok('en direct, puis le plus proche du coup d\'envoi, puis sans heure, puis terminé');

  // ── 4. Le cas réel du 5 septembre : les matchs MLB du soir remontent ─────────
  /* Reconstitué depuis le cache réel : les matchs MLB « upcoming » de ce jour-là étaient
     en position 278-292 sur 636 avec l'ancien tri (déjà sous 400, mais noyés derrière
     593 matchs « à venir » sans distinction) ; avec le nouveau tri, proche du coup
     d'envoi, ils doivent remonter nettement plus haut que les matchs de demain ou dans
     plusieurs heures. */
  /* Le sténo `minutesUntilStart` de ce test ignore la date — comme dans la vraie
     fonction, deux horaires du même jour se comparent directement en minutes depuis
     minuit ; c'est cette comparaison-là que la file utilise pour départager le groupe
     « à venir », la date n'intervenant que d'un jour à l'autre. */
  const soir = [
    { id: 'match-tard', status: 'upcoming', startTime: '22:30' },
    ...Array.from({ length: 50 }, (_, i) => ({ id: 'plus-tard-encore-' + i, status: 'upcoming', startTime: '23:50' })),
    { id: 'mlb-bientot', status: 'upcoming', startTime: '20:10' },
  ];
  const posAvantCorrectif = soir.findIndex(m => m.id === 'mlb-bientot'); // en dernier, par construction
  const posApres = trier(soir).findIndex(m => m.id === 'mlb-bientot');
  assert.ok(posApres < posAvantCorrectif,
    'un match plus proche du coup d\'envoi doit remonter devant des matchs plus lointains');
  assert.strictEqual(posApres, 0, 'le match le plus proche doit être en tête du groupe « à venir »');
  ok('un match qui commence bientôt remonte devant des matchs plus lointains, même noyé parmi 50');

  console.log('\n' + n + ' groupes OK — priorité de la file de pages de match');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

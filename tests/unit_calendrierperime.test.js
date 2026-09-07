/* Le calendrier du jour vieillit (js/api.js).

   « Sur mon téléphone, y a pas de streams, mais ailleurs oui. Pas de score à date nulle
   part. » — puis, plus précisément : « selon le device, ça voit ou non les scores et les
   streams en général ». Ce n'était pas une histoire de match ni de ligue.

   Le calendrier du jour rangé dans le stockage local n'était jugé QUE sur sa date
   (`cache.fetchDate === todayStr`). Le premier chargement de la journée écrivait donc un
   instantané — la plupart des matchs « à venir », sans score — et tous les chargements
   suivants le resservaient tel quel jusqu'à minuit, sans jamais relire
   `data/schedule.json`, que le serveur régénère avec les scores et les états réels.

   Restait le rafraîchissement des scores, qui appelle ESPN EN DIRECT depuis le
   navigateur. Sur un appareil où cet appel échoue — bloqueur qui filtre le domaine,
   résolveur d'entreprise, VPN, réseau plus lent que le délai de 8 s — plus rien ne
   bougeait de la journée : grille figée au matin, aucun score, onglet Live faux. Sur un
   autre appareil, tout marchait. D'où « selon le device ».

   Ces cas verrouillent la règle : passé dix minutes, le calendrier local est relu. */
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="marea"></div></body></html>',
                        { url: 'https://exemple.test/' });
  for (const k of ['window', 'document', 'DOMParser', 'navigator', 'localStorage', 'HTMLElement'])
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  globalThis.fetch = () => Promise.reject(new Error('réseau coupé'));

  const api = await import('../js/api.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };

  const jour = '20260907';
  const now = 1_800_000_000_000;
  const frais = { fetchDate: jour, savedAt: now - 60_000, matches: [{ id: 'x' }] };

  // ── 1. Frais tant qu'il n'a pas dix minutes ────────────────────────────────
  assert.strictEqual(api.calendrierPerime(frais, jour, now), false, 'une minute : encore bon');
  assert.strictEqual(api.calendrierPerime({ ...frais, savedAt: now - 9 * 60_000 }, jour, now), false, 'neuf minutes : encore bon');
  ok('un calendrier récent est resservi sans aller-retour réseau');

  // ── 2. Périmé passé le seuil, et c'est CE cas qui figeait la journée ───────
  assert.strictEqual(api.calendrierPerime({ ...frais, savedAt: now - 11 * 60_000 }, jour, now), true, 'onze minutes : à relire');
  assert.strictEqual(api.calendrierPerime({ ...frais, savedAt: now - 6 * 3600_000 }, jour, now), true, 'six heures : à relire');
  assert.strictEqual(api.CALENDAR_STALE_MS, 10 * 60 * 1000, 'même seuil que le cache des liens');
  ok('passé dix minutes, le calendrier du jour est relu au lieu d\'être resservi jusqu\'à minuit');

  // ── 3. Un cache d'une version antérieure n'a pas d'horodatage ──────────────
  /* C'est l'état des appareils déjà figés : sans `savedAt`, on ne peut pas savoir de
     quand il date, donc on le relit — c'est exactement ce qu'on veut pour eux. */
  assert.strictEqual(api.calendrierPerime({ fetchDate: jour, matches: [{ id: 'x' }] }, jour, now), true,
    'sans savedAt (version antérieure), on relit');
  ok('un appareil figé par l\'ancienne version se remet à jour au prochain chargement');

  // ── 4. Ce qui n'était pas un calendrier du jour ne l'est toujours pas ──────
  assert.strictEqual(api.calendrierPerime(null, jour, now), true);
  assert.strictEqual(api.calendrierPerime({ fetchDate: '20260906', savedAt: now, matches: [{ id: 'x' }] }, jour, now), true, 'la veille');
  assert.strictEqual(api.calendrierPerime({ fetchDate: jour, savedAt: now, matches: [] }, jour, now), true, 'une liste vide n\'est pas un calendrier');
  assert.strictEqual(api.calendrierPerime({ fetchDate: jour, savedAt: now + 60_000, matches: [{ id: 'x' }] }, jour, now), true,
    'horodatage dans le futur (horloge changée) : on relit plutôt que de faire confiance');
  ok('date d\'un autre jour, liste vide, horloge incohérente : relecture');

  // ── 5. L'échec d'ESPN est compté, plus avalé en silence ────────────────────
  assert.ok(api.espnInfo && typeof api.espnInfo.tentatives === 'number', 'le compteur existe');
  const avant = api.espnInfo.tentatives;
  const res = await api.fetchEspnSchedule('basketball/nba', jour);
  assert.strictEqual(res, null, 'un échec rend toujours null : les appelants ne changent pas');
  assert.strictEqual(api.espnInfo.tentatives, avant + 1, 'la tentative est comptée');
  assert.ok(api.espnInfo.echecs > 0, 'l\'échec est compté');
  assert.ok(api.espnInfo.derniereErreur, 'la raison est retenue, pour que la page Logs puisse la dire');
  ok('un appel ESPN qui échoue est compté et sa raison retenue');

  console.log(`unit_calendrierperime: ${n} groupes de tests OK`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

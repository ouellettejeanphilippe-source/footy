/* Fin présumée (js/finpresumee.js).

   « Des matchs qui n'arrêtent pas même si finaux sur ESPN » : quand ESPN ne répond plus,
   un match « live » restait DIRECT des heures. La règle : ESPN qui parle a raison ;
   sans nouvelle, passé la durée du sport plus une marge, on présume la fin — marge bien
   plus large si la dernière nouvelle disait déjà « manches supplémentaires » ou
   « prolongation » (« ça continue sauf si indication de ESPN de extra innings ou
   périodes ? »). */
const assert = require('assert');

async function main() {
  const F = await import('../js/finpresumee.js');
  let n = 0;
  const ok = (name) => { n++; console.log('  ✓ ' + name); };
  const NOW = Date.parse('2026-09-06T23:00:00Z');
  const live = (extra) => Object.assign({ status: 'live', league: 'MLB' }, extra || {});

  // ── 1. ESPN qui parle a raison ─────────────────────────────────────────────
  assert.strictEqual(F.finPresumee(live({ _scoreAt: NOW - 5 * 60000 }), 400, 180, NOW), false, 'nouvelle récente : jamais présumé, même très long');
  assert.strictEqual(F.finPresumee(live({ _scoreAt: NOW - 30 * 60000 }), 400, 180, NOW), true, 'nouvelle vieille de 30 min : présumé');
  assert.strictEqual(F.finPresumee(live(), 400, 180, NOW), true, 'aucune nouvelle : présumé');
  ok('une mise à jour ESPN récente désarme la règle');

  // ── 2. Durée + marge ───────────────────────────────────────────────────────
  assert.strictEqual(F.finPresumee(live(), 200, 180, NOW), false, '200 min : dans la marge de 45');
  assert.strictEqual(F.finPresumee(live(), 226, 180, NOW), true, '226 min : au-delà de 180 + 45');
  assert.strictEqual(F.finPresumee({ status: 'finished', league: 'MLB' }, 500, 180, NOW), false, 'déjà fini : rien à présumer');
  assert.strictEqual(F.finPresumee({ status: 'upcoming', league: 'MLB' }, 500, 180, NOW), false, 'à venir : rien à présumer');
  assert.strictEqual(F.finPresumee(live(), null, 180, NOW), false, 'heure inconnue : on ne présume pas');
  ok('présumé fini seulement passé la durée normale plus 45 min');

  // ── 3. Prolongation connue : marge élargie ─────────────────────────────────
  assert.strictEqual(F.enProlongation(live({ period: 10 })), true, 'manche 10 en MLB');
  assert.strictEqual(F.enProlongation(live({ period: 9 })), false, 'manche 9 en MLB');
  assert.strictEqual(F.enProlongation(live({ detail: 'Top 11th' })), true, '« Top 11th »');
  assert.strictEqual(F.enProlongation(live({ detail: 'Bot 7th' })), false, '« Bot 7th »');
  assert.strictEqual(F.enProlongation({ status: 'live', league: 'NHL', period: 4 }), true, '4e période au hockey');
  assert.strictEqual(F.enProlongation({ status: 'live', league: 'NHL', detail: 'OT' }), true, '« OT »');
  assert.strictEqual(F.enProlongation({ status: 'live', league: 'NHL', detail: 'Shootout' }), true, 'tirs au but');
  assert.strictEqual(F.enProlongation({ status: 'live', league: 'NFL', detail: '2nd OT' }), true, '« 2nd OT »');
  assert.strictEqual(F.enProlongation({ status: 'live', league: 'NBA', period: 4, minute: '2:31' }), false, '4e quart NBA : réglementaire');
  assert.strictEqual(F.enProlongation({ status: 'live', league: 'Premier League', period: 3 }), true, 'prolongation au soccer');
  assert.strictEqual(F.enProlongation({ status: 'live', league: 'NASCAR', period: 12 }), false, 'sport sans périodes connues : jamais');
  assert.strictEqual(F.finPresumee(live({ period: 11 }), 250, 180, NOW), false, '250 min en 11e manche : on attend (marge 120)');
  assert.strictEqual(F.finPresumee(live({ period: 11 }), 310, 180, NOW), true, '310 min en 11e manche : présumé quand même');
  ok('une prolongation connue élargit la marge à 120 min');

  // ── 4. Explication ────────────────────────────────────────────────────────
  const r = F.raisonFinPresumee(live({ _scoreAt: NOW - 40 * 60000, period: 10 }), 260, 180, NOW);
  assert.ok(/40 min/.test(r) && /260 min/.test(r) && /prolongation/.test(r), r);
  ok('l\'infobulle dit depuis quand ESPN se tait et de combien la durée est dépassée');

  console.log('unit_finpresumee: ' + n + ' groupes de tests OK');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

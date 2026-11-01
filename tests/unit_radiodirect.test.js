/* « Ya moyen de partir les streams tunein et cie directement ? » (1er novembre 2026) : le flux audio
   d'une station (TuneIn, iHeartRadio) lu dans <audio>, sans cadre ni second geste. js/radio.js lit
   les réponses des annuaires ; js/radiodirect.js trouve le flux (data/radio.json, puis iHeartRadio
   à la volée) et retombe sur le lecteur de TuneIn ou le lien sans flux lisible. Aucun réseau. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const racine = path.resolve(__dirname, '..');
let R, D;
test.before(async () => {
  R = await import(path.join(racine, 'js', 'radio.js'));
  D = await import(path.join(racine, 'js', 'radiodirect.js'));
});
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const reponse = (j, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(j) });

test('TuneIn : un flux continu en https avant le HLS ; ni http, ni .pls, ni .m3u', () => {
  assert.deepStrictEqual(R.fluxDeTuneIn({ body: [
    { url: 'http://a.example/x.mp3', media_type: 'mp3' },
    { url: 'https://b.example/liste.pls', media_type: 'mp3' },
    { url: 'https://c.example/live.m3u8', media_type: 'hls' },
    { url: 'https://d.example/4473_96.mp3', media_type: 'mp3' }
  ] }), { url: 'https://d.example/4473_96.mp3', type: 'continu' });
  assert.deepStrictEqual(R.fluxDeTuneIn({ body: [{ url: 'https://c.example/live.m3u8', media_type: 'hls' }] }), { url: 'https://c.example/live.m3u8', type: 'hls' });
  assert.strictEqual(R.fluxDeTuneIn({ body: [{ url: 'http://a.example/x.mp3', media_type: 'mp3' }] }), null);
  assert.strictEqual(R.fluxDeTuneIn(null), null);
});

test('iHeartRadio : le flux continu sécurisé, puis le HLS sécurisé, jamais le http', () => {
  const s = { secure_shoutcast_stream: 'https://x.example/a.aac', shoutcast_stream: 'http://x.example/a.aac', secure_hls_stream: 'https://x.example/a.m3u8' };
  assert.deepStrictEqual(R.fluxDIHeart({ hits: [{ streams: s }] }), { url: 'https://x.example/a.aac', type: 'continu' });
  assert.deepStrictEqual(R.fluxDIHeart({ hits: [{ streams: { secure_hls_stream: 'https://x.example/a.m3u8' } }] }), { url: 'https://x.example/a.m3u8', type: 'hls' });
  assert.strictEqual(R.fluxDIHeart({ hits: [{ streams: { shoutcast_stream: 'http://x.example/a.aac' } }] }), null);
  assert.strictEqual(R.fluxDIHeart({ hits: [] }), null);
});

test('les adresses des annuaires et les clés de flux', () => {
  assert.deepStrictEqual(R.adressesDuFlux('tunein:s137385'), ['https://opml.radiotime.com/Tune.ashx?id=s137385&render=json&formats=mp3,aac,ogg,hls']);
  assert.strictEqual(R.adressesDuFlux('iheart:11724').length, 2, 'États-Unis puis Canada');
  assert.deepStrictEqual(R.adressesDuFlux('tunein:javascript:1'), []);
  assert.deepStrictEqual(R.adressesDuFlux('autre:1'), []);
  const cles = R.toutesLesClesDeFlux();
  assert.ok(cles.includes('tunein:s137385'), 'la station des Canadiens');
  assert.ok(cles.every((c) => /^(tunein:s\d+|iheart:\d+)$/.test(c)));
});

test('la fiche : « Écouter » pour chaque lien TuneIn et iHeartRadio, jamais pour la page d\'un site', () => {
  const html = R.radioHtml(R.radiosDuMatch({ homeTeam: 'Arizona Cardinals', awayTeam: 'Montreal Canadiens', league: 'NFL' }), esc);
  const boutons = html.match(/<button[^>]*class="radio-ecouter"[^>]*>/g) || [];
  assert.ok(boutons.length >= 2);
  for (const b of boutons) assert.match(b, /data-ecoute="(tunein:s\d+|iheart:\d+)"/);
  assert.ok(boutons.some((b) => /data-ecoute="iheart:/.test(b)), 'un bouton pour iHeartRadio aussi');
  const st = R.STATIONS['lagalaxyradiofluxduclub'];
  assert.ok(st && st.site && !st.tunein && !st.iheart);
  const site = R.radioHtml(R.radiosDuMatch({ homeTeam: 'LA Galaxy', awayTeam: 'X', league: 'MLS' }), esc);
  assert.doesNotMatch(site, /radio-ecouter/, 'un site n\'a pas de flux vérifié');
});

test('data/radio.json : des flux https, pour des clés que la fiche connaît', () => {
  const j = JSON.parse(fs.readFileSync(path.join(racine, 'data', 'radio.json'), 'utf8'));
  const connues = new Set(R.toutesLesClesDeFlux());
  assert.ok(Object.keys(j.flux).length > 0);
  for (const [cle, f] of Object.entries(j.flux)) {
    assert.ok(connues.has(cle), 'clé connue : ' + cle);
    assert.match(f.url, /^https:\/\//, cle);
    assert.ok(f.type === 'continu' || f.type === 'hls', cle);
  }
});

test('trouverFlux : data/radio.json d\'abord, puis iHeartRadio à la volée (Canada après les États-Unis), jamais TuneIn à la volée', async () => {
  const appels = [];
  const fetchFn = (u) => {
    appels.push(u);
    if (u === 'data/radio.json') return reponse({ flux: { 'tunein:s1': { url: 'https://t.example/1.mp3', type: 'continu' } } });
    if (u.startsWith('https://us.api')) return reponse({}, false);
    if (u.startsWith('https://ca.api')) return reponse({ hits: [{ streams: { secure_shoutcast_stream: 'https://i.example/2.aac' } }] });
    return reponse({}, false);
  };
  const o = { fetch: fetchFn, adresses: R.adressesDuFlux, lireReponse: R.fluxDeReponse };
  assert.deepStrictEqual(await D.trouverFlux('tunein:s1', o), { url: 'https://t.example/1.mp3', type: 'continu' });
  assert.deepStrictEqual(await D.trouverFlux('iheart:42', o), { url: 'https://i.example/2.aac', type: 'continu' });
  assert.strictEqual(await D.trouverFlux('tunein:s999', o), null);
  assert.strictEqual(appels.filter((u) => u === 'data/radio.json').length, 1, 'lu une fois');
  assert.ok(!appels.some((u) => u.includes('radiotime')), 'TuneIn refuse le navigateur : jamais appelé d\'ici');
});

test('fluxLisible : un HLS seulement là où <audio> le sait', () => {
  assert.strictEqual(D.fluxLisible({ url: 'https://a/x.mp3', type: 'continu' }), true);
  assert.strictEqual(D.fluxLisible({ url: 'https://a/x.m3u8', type: 'hls' }, { canPlayType: () => '' }), false);
  assert.strictEqual(D.fluxLisible({ url: 'https://a/x.m3u8', type: 'hls' }, { canPlayType: () => 'maybe' }), true);
  assert.strictEqual(D.fluxLisible(null), false);
});

/* La barre radio dans une page : « Écouter » joue tout de suite, la barre dit quoi ; sans flux, le
   repli (lecteur TuneIn ou lien) prend la main et la barre ne reste pas. <audio> est simulé. */
test('ecouterRadio : joue dans la barre, pause, arrêt ; repli sans flux', async () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><body></body>');
  const joues = [];
  class FauxAudio {
    constructor() { this.paused = true; this.ecoutes = {}; this.src = ''; }
    addEventListener(t, f) { (this.ecoutes[t] = this.ecoutes[t] || []).push(f); }
    removeEventListener(t, f) { this.ecoutes[t] = (this.ecoutes[t] || []).filter((g) => g !== f); }
    removeAttribute() { this.src = ''; }
    load() {}
    canPlayType() { return ''; }
    play() { this.paused = false; joues.push(this.src); (this.ecoutes.playing || []).forEach((f) => f()); return Promise.resolve(); }
    pause() { this.paused = true; (this.ecoutes.pause || []).forEach((f) => f()); }
  }
  const avant = { document: global.document, Audio: global.Audio };
  global.document = dom.window.document; global.Audio = FauxAudio;
  D.oublierFluxRadio();
  try {
    const fetchFn = (u) => u === 'data/radio.json'
      ? reponse({ flux: { 'tunein:s1': { url: 'https://t.example/1.mp3', type: 'continu' }, 'tunein:s2': { url: 'https://t.example/2.m3u8', type: 'hls' } } })
      : reponse({}, false);
    const o = { fetch: fetchFn, adresses: R.adressesDuFlux, lireReponse: R.fluxDeReponse };
    assert.strictEqual(await D.ecouterRadio({ cle: 'tunein:s1', nom: 'Canadiens · Station' }, o), true);
    assert.deepStrictEqual(joues, ['https://t.example/1.mp3'], 'le flux part tout de suite');
    const barre = dom.window.document.getElementById('radio-direct');
    assert.ok(barre && !barre.hidden);
    assert.strictEqual(barre.querySelector('.rd-nom').textContent, 'Canadiens · Station');
    assert.strictEqual(barre.querySelector('.rd-etat').textContent, 'En direct');
    barre.querySelector('.rd-lecture').click();
    assert.strictEqual(D.radioEnCours().enPause, true);
    barre.querySelector('.rd-fermer').click();
    assert.strictEqual(D.radioEnCours(), null);
    assert.ok(barre.hidden);
    // Sans flux lisible (HLS que ce navigateur ne lit pas, ou station inconnue) : le repli.
    const replis = [];
    o.repli = (s) => replis.push(s.cle);
    assert.strictEqual(await D.ecouterRadio({ cle: 'tunein:s2', nom: 'X' }, o), false);
    assert.strictEqual(await D.ecouterRadio({ cle: 'tunein:s9', nom: 'Y' }, o), false);
    assert.deepStrictEqual(replis, ['tunein:s2', 'tunein:s9']);
    assert.ok(barre.hidden, 'la barre ne reste pas pour un repli');
  } finally {
    global.document = avant.document; global.Audio = avant.Audio;
  }
});

test('stationAEcouter : la première station qui a un flux, domicile, visiteur, puis championnat', () => {
  const r = R.radiosDuMatch({ homeTeam: 'Montreal Canadiens', awayTeam: 'Toronto Maple Leafs', league: 'NHL' });
  assert.deepStrictEqual(R.stationAEcouter(r), { cle: 'tunein:s137385', nom: 'Montreal Canadiens · Station de l’équipe' });
  assert.strictEqual(R.stationAEcouter(R.radiosDuMatch({ homeTeam: 'LA Galaxy', awayTeam: 'Inconnu', league: 'MLS' })), null, 'une page de site n\'a pas de flux');
  assert.strictEqual(R.stationAEcouter(R.radiosDuMatch(null)), null);
  const pl = R.stationAEcouter(R.radiosDuMatch({ homeTeam: 'Inconnu A', awayTeam: 'Inconnu B', league: 'Premier League' }));
  assert.ok(pl && /^Premier League/.test(pl.nom), 'le championnat en dernier recours : ' + JSON.stringify(pl));
});

test('la source radio d\'une tuile : radio.html avec le flux, reconnue, et ses stations', () => {
  const base = 'https://exemple.test/footy/index.html';
  const u = R.adresseSourceRadio(base, { url: 'https://t.example/1.mp3', type: 'continu' }, 'Canadiens · Station', 'tunein:s1');
  assert.ok(u.startsWith('https://exemple.test/footy/radio.html?'), u);
  assert.strictEqual(new URL(u).searchParams.get('u'), 'https://t.example/1.mp3');
  assert.strictEqual(R.estSourceRadio(u, 'https://exemple.test'), true);
  assert.strictEqual(R.estSourceRadio(u, 'https://autre.test'), false, 'une radio.html d\'un autre site n\'en est pas une');
  assert.strictEqual(R.estSourceRadio('https://exemple.test/footy/radio.html', 'https://exemple.test'), false, 'sans flux');
  assert.strictEqual(R.estSourceRadio('https://site.test/embed/1'), false);
  assert.deepStrictEqual(R.infoSourceRadio(u), { nom: 'Canadiens · Station', cle: 'tunein:s1' });
  const toutes = R.stationsAEcouter(R.radiosDuMatch({ homeTeam: 'Montreal Canadiens', awayTeam: 'Toronto Maple Leafs', league: 'NHL' }));
  assert.ok(toutes.length >= 4, 'les stations des deux équipes');
  assert.strictEqual(new Set(toutes.map((s) => s.cle)).size, toutes.length, 'sans doublon');
  assert.strictEqual(toutes[0].cle, 'tunein:s137385');
});

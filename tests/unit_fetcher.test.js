// Tests unitaires pour js/fetcher.js (helpers purs de fetchPage)
const assert = require('assert');

async function run() {
  const f = await import('../js/fetcher.js');
  let passed = 0;
  function t(name, fn) { fn(); console.log('✅ [PASS] ' + name); passed++; }

  t('applyProxyTemplate {url}', () => assert.strictEqual(f.applyProxyTemplate('https://p.example/?u={url}', 'https://a.b/c?d=1'), 'https://p.example/?u=https%3A%2F%2Fa.b%2Fc%3Fd%3D1'));
  t('applyProxyTemplate trailing =', () => assert.strictEqual(f.applyProxyTemplate('https://p.example/?url=', 'https://a.b/'), 'https://p.example/?url=https%3A%2F%2Fa.b%2F'));
  t('applyProxyTemplate cors-anywhere style', () => assert.strictEqual(f.applyProxyTemplate('https://p.example', 'https://a.b/'), 'https://p.example/https://a.b/'));

  t('buildProxyList default order', () => {
    const ids = f.buildProxyList({}).map(p => p.id);
    assert.deepStrictEqual(ids, ['direct', 'jina', 'cors.sh', 'allorigins-raw', 'allorigins-get', 'codetabs']);
  });
  /* r.jina.ai est le seul transport public qui tienne encore depuis un navigateur
     (29 septembre 2026) : il vient donc juste après l'accès direct, avant les proxys morts. */
  t('jina vient juste après direct, avec l\'en-tête qui demande le HTML brut', () => {
    const j = f.buildProxyList({}).find(p => p.id === 'jina');
    assert.strictEqual(j.build('https://a.b/c?d=1'), 'https://r.jina.ai/https://a.b/c?d=1');
    assert.deepStrictEqual(j.headers, { 'X-Return-Format': 'html' });
    assert.ok(j.timeout > f.DEFAULT_PROXY_TIMEOUT, 'il charge la page dans un navigateur : plus de temps que les relais bruts');
  });
  t('jina parse : une page HTML passe telle quelle', () => {
    const j = f.buildProxyList({}).find(p => p.id === 'jina');
    const page = '<html><body>' + '<a href="/x">x</a>'.repeat(20) + '</body></html>';
    assert.strictEqual(j.parse(page), page);
  });
  t('jina parse : un point d\'API enveloppé en <pre> est déballé et désentitisé', () => {
    const j = f.buildProxyList({}).find(p => p.id === 'jina');
    const enveloppe = '<html><head><meta name="color-scheme" content="light dark"></head><body><pre style="word-wrap: break-word; white-space: pre-wrap;">[{"id":"a&amp;b","t":"&lt;x&gt;"}]</pre></body></html>';
    assert.deepStrictEqual(JSON.parse(j.parse(enveloppe)), [{ id: 'a&b', t: '<x>' }]);
  });
  t('jina parse : une erreur JSON de Jina est rejetée, un petit JSON légitime passe', () => {
    const j = f.buildProxyList({}).find(p => p.id === 'jina');
    assert.throws(() => j.parse('{"data":null,"path":"url","code":422,"name":"SubmittedDataMalformedError","status":42203,"message":"Domain could not be resolved"}'));
    assert.strictEqual(j.parse('{"score":1}'), '{"score":1}');
  });
  t('buildProxyList with custom proxy and keys', () => {
    const list = f.buildProxyList({ customProxy: 'https://w.example/?url=', corsShKey: 'k1', corsProxyIoKey: 'k2' });
    assert.strictEqual(list[0].id, 'custom');
    assert.strictEqual(list[0].build('https://x.y/'), 'https://w.example/?url=https%3A%2F%2Fx.y%2F');
    const sh = list.find(p => p.id === 'cors.sh');
    assert.deepStrictEqual(sh.headers, { 'x-cors-api-key': 'k1' });
    const io = list.find(p => p.id === 'corsproxy.io');
    assert.ok(io.build('https://x.y/').indexOf('key=k2') > 0);
  });
  t('allorigins-get parse extracts contents', () => {
    const p = f.buildProxyList({}).find(x => x.id === 'allorigins-get');
    assert.strictEqual(p.parse(JSON.stringify({ contents: '<html>ok</html>' })), '<html>ok</html>');
  });

  const big = '<html><body>' + '<a href="/x">x</a>'.repeat(50) + '</body></html>';
  t('inspectPageContent accepts real page', () => assert.strictEqual(f.inspectPageContent(big), null));
  t('inspectPageContent accepts small JSON', () => assert.strictEqual(f.inspectPageContent('{"score":1}'), null));
  t('inspectPageContent rejects empty', () => assert.ok(f.inspectPageContent('').proxyFault));
  t('inspectPageContent rejects short', () => assert.ok(f.inspectPageContent('<html></html>').proxyFault));
  t('inspectPageContent rejects cloudflare error code', () => assert.ok(f.inspectPageContent('error code: 522').proxyFault));
  t('inspectPageContent rejects 301 stub', () => assert.ok(f.inspectPageContent('<html><head><title>301 Moved Permanently</title></head><body><center><h1>301 Moved Permanently</h1></center><hr><center>cloudflare</center></body></html>').proxyFault));
  t('inspectPageContent rejects hidemy ad', () => assert.ok(f.inspectPageContent(big + 'hidemy.name').proxyFault));
  t('inspectPageContent rejects corsproxy.io keyless json', () => assert.ok(f.inspectPageContent('{"success":false,"status":403,"error":"keyless_legacy_url","message":"Anonymous legacy proxy URLs are no longer supported. Use the CORSPROXY API with an API key."}').proxyFault));
  t('inspectPageContent rejects corsfix json', () => assert.ok(f.inspectPageContent('{ "corsfix_error": "domain_not_registered", "message": "x" }').proxyFault));
  t('inspectPageContent flags cloudflare challenge as site fault', () => {
    const r = f.inspectPageContent('<!DOCTYPE html><html><head><title>Just a moment...</title></head><body><script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script>' + 'x'.repeat(500) + '</body></html>');
    assert.ok(r && r.proxyFault === false);
  });
  t('inspectPageContent flags seized domain as site fault', () => {
    const r = f.inspectPageContent('<!DOCTYPE html><html><head><title>THIS DOMAIN HAS BEEN SEIZED</title></head><body>' + 'x'.repeat(500) + '</body></html>');
    assert.ok(r && r.proxyFault === false);
  });
  t('inspectPageContent accepts ICS calendar', () => assert.strictEqual(f.inspectPageContent('BEGIN:VCALENDAR\n' + 'X:y\n'.repeat(100) + 'END:VCALENDAR'), null));

  t('orderProxies demotes recently failed proxy', () => {
    const list = f.buildProxyList({});
    const now = 1000000;
    let health = {};
    health = f.recordProxyResult(health, list[1], 'https://x.y/', false, now);
    const ordered = f.orderProxies(list, health, 'https://x.y/', now + 1000).map(p => p.id);
    assert.deepStrictEqual(ordered, ['direct', 'cors.sh', 'allorigins-raw', 'allorigins-get', 'codetabs', 'jina']);
    const later = f.orderProxies(list, health, 'https://x.y/', now + f.PROXY_COOLDOWN_MS + 1).map(p => p.id);
    assert.strictEqual(later[1], 'jina');
  });
  t('direct health is per host', () => {
    const list = f.buildProxyList({});
    let health = f.recordProxyResult({}, list[0], 'https://a.example/p', false, 5000);
    assert.strictEqual(f.orderProxies(list, health, 'https://a.example/q', 6000)[0].id, 'jina');
    assert.strictEqual(f.orderProxies(list, health, 'https://b.example/q', 6000)[0].id, 'direct');
  });
  t('success after failure restores health', () => {
    const list = f.buildProxyList({});
    let health = f.recordProxyResult({}, list[1], 'u', false, 100);
    health = f.recordProxyResult(health, list[1], 'u', true, 200);
    assert.strictEqual(f.orderProxies(list, health, 'u', 300)[1].id, 'jina');
  });

  console.log('\nAll ' + passed + ' tests passed!');
}
run().catch(e => { console.error('❌ FAIL', e); process.exit(1); });

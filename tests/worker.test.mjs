import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { migrate } from './helpers/migrate.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { BRIGHT_STARS } from '../src/lib/starData.js';
import { HUNTS } from '../src/lib/huntCatalog.js';
import { equatorialToHorizontal } from '../src/lib/astronomy.js';

let mf, db, persist, script;
const runtime = () => new Miniflare({ ...convertV4MiniflareOptions({
  modules: true, script, compatibilityDate: '2026-11-06',
  d1Databases: { STARS_DB: 'stars-test' },
  bindings: { CLAIM_MODE: 'demo' },
  serviceBindings: { ASSETS: () => new Response('static asset') },
}), resourcePersistencePath: persist });
before(async () => {
  persist = await mkdtemp(join(tmpdir(), 'youneek-stars-test-'));
  script = (await build({ entryPoints: ['worker/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' })).outputFiles[0].text;
  mf = runtime();
  db = await mf.getD1Database('STARS_DB');
  await migrate(db);
});
after(async () => { await mf?.dispose(); await rm(persist, { recursive: true, force: true }); });
function client(host = 'localhost') {
  let cookie = '';
  return async (path, payload, extra = {}) => {
    const response = await mf.dispatchFetch(`http://${host}${path}`, {
      method: payload === undefined ? 'GET' : 'POST',
      headers: { Cookie: cookie, ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra },
      ...(payload === undefined ? {} : { body: typeof payload === 'string' ? payload : JSON.stringify(payload) }),
    });
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, headers: response.headers, data: await response.json() };
  };
}

test('catalog covers every daily hunt, identifiers are unique, horizon math is finite', () => {
  assert.equal(new Set(BRIGHT_STARS.map(s => s.id)).size, BRIGHT_STARS.length);
  for (const hunt of HUNTS) assert.ok(BRIGHT_STARS.some(s => s.name === hunt.target_star), hunt.target_star);
  // At the north pole a star's altitude equals its declination.
  const sky = equatorialToHorizontal(37, 25, 90, 0, new Date('2026-11-06T00:00:00Z'));
  assert.ok(Math.abs(sky.altitude - 25) < 1e-8);
  assert.ok(sky.azimuth >= 0 && sky.azimuth < 360);
});
test('health, private cookie, catalog, static fallback and JSON API 404', async () => {
  const request = client();
  const health = await request('/api/health');
  assert.equal(health.data.ok, true);
  assert.match(health.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.equal((await request('/api/config')).data.claimMode, 'demo');
  assert.equal((await request('/api/stars')).data.length, BRIGHT_STARS.length);
  assert.equal((await request('/api/missing')).status, 404);
  assert.equal((await request('/api')).status, 404);
  assert.equal(await (await mf.dispatchFetch('http://localhost/profile')).text(), 'static asset');
});
test('public host cannot enable unpaid claims even with demo env', async () => {
  const request = client('stars.youneek.xyz');
  assert.equal((await request('/api/config')).data.claimMode, 'disabled');
  assert.equal((await request('/api/stars/claim', { star_id: 'sirius', buyer_name: 'Visitor', tier: 'base' })).status, 503);
});
test('validate content, bound bodies, reject cross-origin writes and forged star/tier', async () => {
  const request = client();
  assert.equal((await request('/api/profile', { name: 'Attacker' }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await request('/api/profile', { name: 'Attacker' }, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await request('/api/profile', '{')).status, 400);
  assert.equal((await request('/api/profile', { name: 'Test' }, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await request('/api/profile', { name: 'A'.repeat(9000) })).status, 413);
  assert.equal((await request('/api/stars/claim', { star_id: 'made-up', tier: 'base', buyer_name: 'Test' })).status, 400);
  assert.equal((await request('/api/stars/claim', { star_id: 'vega', tier: 'free', buyer_name: 'Test' })).status, 400);
});
test('simultaneous claims have one winner; D1 claim and server-priced demo purchase commit together', async () => {
  const a = client(), b = client();
  await a('/api/config'); await b('/api/config');
  const claim = { star_id: 'sirius', buyer_name: 'Dedication', buyer_email: 'private@example.test', tier: 'premium', amount_cents: 1, star_name: 'Forged name' };
  const results = await Promise.all([a('/api/stars/claim', claim), b('/api/stars/claim', claim)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  const success = results.find(r => r.status === 201);
  assert.equal(success.data.star.name, 'Sirius');
  assert.equal(success.data.star.star_key, 'hip:32349');
  assert.equal(success.data.star.ra, BRIGHT_STARS.find(s => s.id === 'sirius').ra);
  const purchase = await db.prepare("SELECT * FROM purchases WHERE star_key = 'hip:32349'").all();
  assert.equal(purchase.results.length, 1);
  assert.equal(purchase.results[0].amount_cents, 2000);
  assert.equal(purchase.results[0].status, 'demo');
  const publicStars = JSON.stringify((await a('/api/stars?is_named=true')).data);
  assert.ok(!publicStars.includes('private@example.test'));
  assert.ok(!publicStars.includes('player_id'));
  assert.ok(!publicStars.includes('owner_user_id'));
  const mine = (await a('/api/profile')).data.stars.length;
  const theirs = (await b('/api/profile')).data.stars.length;
  assert.equal(mine + theirs, 1);
  assert.equal((await client()('/api/profile')).data.stars.length, 0);
});
test('base tier also uses server pricing and does not keep premium-only stories', async () => {
  const request = client();
  await request('/api/config');
  const result = await request('/api/stars/claim', { star_id: 'vega', buyer_name: 'Base Demo', tier: 'base', amount_cents: 2000, custom_myth: 'Not included' });
  assert.equal(result.status, 201);
  assert.equal(result.data.star.custom_myth, '');
  const purchase = await db.prepare("SELECT amount_cents, status FROM purchases WHERE legacy_star_id = 'vega'").first();
  assert.equal(purchase.amount_cents, 1000);
  assert.equal(purchase.status, 'demo');
});
test('a failed purchase write rolls the claim back instead of leaving partial ownership', async () => {
  const request = client();
  await request('/api/config');
  await db.prepare("CREATE TRIGGER fail_purchase BEFORE INSERT ON purchases WHEN NEW.star_key = 'hip:26311' BEGIN SELECT RAISE(ABORT, 'test failure'); END").run();
  try {
    const result = await request('/api/stars/claim', { star_id: 'alnilam', buyer_name: 'Rollback Demo', tier: 'base' });
    assert.equal(result.status, 503);
    assert.equal(await db.prepare("SELECT star_key FROM claims WHERE legacy_star_id = 'alnilam'").first(), null);
    assert.equal(await db.prepare("SELECT star_key FROM purchases WHERE legacy_star_id = 'alnilam'").first(), null);
    assert.ok(!JSON.stringify(result.data).includes('test failure'));
  } finally { await db.prepare('DROP TRIGGER fail_purchase').run(); }
});
test('same display names stay separate; hunt points and daily uniqueness are server-authoritative', async () => {
  const a = client(), b = client();
  await a('/api/config'); await b('/api/config');
  const hunt = { hunt_id: 'hunt-1', player_name: 'Same Name', points: 999999, target_star: 'Polaris' };
  assert.equal((await a('/api/hunts/complete', { ...hunt, target_star: 'Vega' })).status, 400);
  const responses = await Promise.all([a('/api/hunts/complete', hunt), a('/api/hunts/complete', hunt)]);
  assert.equal(responses[0].data.completion.points, 100);
  assert.equal(responses.filter(r => r.data.alreadyCompleted).length, 1);
  await b('/api/hunts/complete', hunt);
  const board = (await a('/api/leaderboard')).data;
  assert.equal(board.filter(e => e.name === 'Same Name').length, 2);
  assert.equal(board.filter(e => e.isYou).length, 1);
  assert.equal((await a('/api/hunts/completions')).data.length, 1);
  assert.equal((await a('/api/profile')).data.completions.length, 1);
  await a('/api/profile', { name: 'Renamed' });
  assert.equal((await a('/api/leaderboard')).data.find(e => e.isYou).name, 'Renamed');
  assert.equal((await a('/api/profile')).data.points, 100);
});
test('yesterday does not block today; local D1 state survives a Worker restart', async () => {
  const request = client();
  await request('/api/config');
  await request('/api/hunts/complete', { hunt_id: 'hunt-2', player_name: 'Daily', target_star: 'Pleiades' });
  const player = await db.prepare("SELECT player_id FROM hunt_completions WHERE hunt_id = 'hunt-2'").first();
  await db.prepare("UPDATE hunt_completions SET hunt_day = '2000-01-01' WHERE player_id = ?").bind(player.player_id).run();
  assert.equal((await request('/api/hunts/completions')).data.length, 0);
  assert.equal((await request('/api/hunts/complete', { hunt_id: 'hunt-2', player_name: 'Daily', target_star: 'Pleiades' })).data.alreadyCompleted, false);
  assert.equal((await request('/api/profile')).data.points, 500);
  await mf.dispose();
  mf = runtime(); db = await mf.getD1Database('STARS_DB');
  assert.equal((await request('/api/profile')).data.points, 500);
  assert.equal((await request('/api/profile')).data.completions.length, 1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM purchases').first()).count, 2);
});

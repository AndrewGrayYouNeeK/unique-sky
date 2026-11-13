import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import {
  magnitudeLimitForFov, labelMagnitudeForFov, fadeForMagnitude, binsForLimit, tileKeyFor, tilesForCone,
  createCatalogLoader, decodeColumnar, magnitudeLevel, DEFAULT_FOV,
} from '../src/lib/catalogTiles.js';
import { createProjector, equatorialToHorizontalMatrix, placeLabels, raDecToVector } from '../src/lib/skyProjection.js';
import { equatorialToHorizontal } from '../src/lib/astronomy.js';
import { skyToVector } from '../src/lib/orientation.js';
import { starKey, legacyIdToStarKey, LEGACY_STAR_IDS, parseStarKey, displayNames } from '../src/lib/starKey.js';
import { BRIGHT_STARS } from '../src/lib/starData.js';

test('magnitude limit rises monotonically as the FOV shrinks, and labels lag behind it', () => {
  near(magnitudeLimitForFov(DEFAULT_FOV), 5.5);
  let prev = -Infinity;
  for (const fov of [100, 70, 40, 20, 10, 5, 2]) {
    const m = magnitudeLimitForFov(fov);
    assert.ok(m >= prev, `limit not monotonic at ${fov}`); prev = m;
    assert.ok(labelMagnitudeForFov(fov) < m);
  }
  assert.ok(magnitudeLimitForFov(2) > 9 && magnitudeLimitForFov(2) <= 10.5);
  assert.equal(magnitudeLimitForFov(0.01), magnitudeLimitForFov(2)); // clamped
});

test('fade ramps smoothly near the limit', () => {
  assert.equal(fadeForMagnitude(4, 6), 1);
  assert.equal(fadeForMagnitude(6.2, 6), 0);
  const mid = fadeForMagnitude(5.7, 6);
  assert.ok(mid > 0 && mid < 1);
  assert.deepEqual([magnitudeLevel(-1), magnitudeLevel(4), magnitudeLevel(5.5), magnitudeLevel(7)], [0, 1, 2, 3]);
});

test('bins are requested only when the limit reaches them', () => {
  const bins = [{ id: 0, magMin: 6.5 }, { id: 1, magMin: 7.5 }, { id: 2, magMin: 8.5 }];
  assert.deepEqual(binsForLimit(bins, 5.5).map(b => b.id), []);
  assert.deepEqual(binsForLimit(bins, 7).map(b => b.id), [0]);
  assert.deepEqual(binsForLimit(bins, 9).map(b => b.id), [0, 1, 2]);
});

test('RA/Dec tiling: keys, wraparound and poles', () => {
  assert.equal(tileKeyFor(0, 0), 'r00d3');
  assert.equal(tileKeyFor(359.9, -90), 'r11d0');
  assert.equal(tileKeyFor(360, 90), 'r00d5');
  const wrap = tilesForCone(2, 10, 5);
  assert.ok(wrap.includes('r00d3') && wrap.includes('r11d3'));
  const pole = tilesForCone(10, 88, 5);
  assert.equal(pole.filter(k => k.endsWith('d5')).length, 12);
  assert.equal(tilesForCone(0, 0, 120).length, 72);
});

near.eps = 1e-6;
function near(a, b, eps = 1e-6) { assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`); }

test('loader: Tier 0 once, Tier 1 tiles only when FOV needs them, cached, shared in-flight', async () => {
  const manifest = JSON.parse(await readFile('public/catalog/manifest.json', 'utf8'));
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    const body = await readFile(`public${url}`, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  };
  const loader = createCatalogLoader({ baseUrl: '/catalog/', fetchImpl });
  const [t0] = await Promise.all([loader.loadTier0(), loader.loadTier0(), loader.ensureView({ ra: 0, dec: 0, radius: 30, limit: 5 })]);
  assert.equal(t0.n, manifest.tiers[0].count);
  await loader.loadTier0();
  assert.equal(calls.filter(c => c.endsWith('t0.json')).length, 1);
  assert.equal(calls.filter(c => c.endsWith('manifest.json')).length, 1, 'manifest fetched once even when requested concurrently');

  await loader.ensureView({ ra: 56.75, dec: 24.12, radius: 40, limit: magnitudeLimitForFov(70) });
  assert.equal(calls.filter(c => c.includes('/t1/')).length, 0, 'wide view must not fetch Tier 1');

  const before = calls.length;
  const [a, b] = await Promise.all([
    loader.ensureView({ ra: 56.75, dec: 24.12, radius: 6, limit: 8 }),
    loader.ensureView({ ra: 56.75, dec: 24.12, radius: 6, limit: 8 }),
  ]);
  assert.deepEqual(a, b);
  const fetched = calls.slice(before);
  assert.ok(fetched.length > 0 && fetched.every(u => /\/t1\/b[01]\//.test(u)), `unexpected ${fetched}`);
  assert.equal(new Set(fetched).size, fetched.length, 'duplicate fetches');
  await loader.ensureView({ ra: 56.75, dec: 24.12, radius: 6, limit: 8 });
  assert.equal(calls.length, before + fetched.length, 'cached tiles refetched');
  assert.ok(loader.version >= 2);
});

test('catalog files: Tier 0 keeps curated stars, sizes stay well inside Workers asset limits', async () => {
  const manifest = JSON.parse(await readFile('public/catalog/manifest.json', 'utf8'));
  assert.equal(manifest.license, 'CC BY-SA 4.0');
  const t0 = decodeColumnar(JSON.parse(await readFile('public/catalog/hyg41/t0.json', 'utf8')), manifest.scale);
  for (const star of BRIGHT_STARS) {
    const ids = LEGACY_STAR_IDS[star.id];
    assert.ok(ids, `no identifiers for ${star.id}`);
    if (!ids.hip) continue;
    const i = t0.hip.indexOf(ids.hip);
    assert.ok(i >= 0, `${star.name} missing from Tier 0`);
    assert.equal(t0.proper[i], star.name);
    assert.ok(Math.abs(t0.ra[i] - star.ra) < 0.05 && Math.abs(t0.dec[i] - star.dec) < 0.05, `${star.name} position mismatch`);
  }
  assert.ok(manifest.totals.bytes < 10 * 1024 * 1024);
  const tier0 = await stat('public/catalog/hyg41/t0.json');
  assert.ok(tier0.size < 25 * 1024 * 1024);
});

test('star keys: precedence, legacy mapping, immutable real names', () => {
  assert.equal(starKey({ gaia_source_id: '123', hip: 5 }), 'gaia:123');
  assert.equal(starKey({ hip: 32349, hd: 48915 }), 'hip:32349');
  assert.equal(starKey({ hd: 48915, hr: 2491 }), 'hd:48915');
  assert.equal(starKey({ hyg: 7 }), 'hyg:7');
  assert.equal(starKey({}), null);
  assert.equal(legacyIdToStarKey('sirius'), 'hip:32349');
  assert.equal(legacyIdToStarKey('pleiades'), 'mel:22');
  assert.deepEqual(parseStarKey('hip:32349'), { catalog: 'hip', id: '32349' });
  const keys = BRIGHT_STARS.map(s => legacyIdToStarKey(s.id));
  assert.equal(new Set(keys).size, keys.length, 'legacy ids must map to unique keys');
  assert.deepEqual(displayNames({ iau_name: 'Sirius' }, { owner_name: 'Mom' }), { real: 'Sirius', edition: 'Mom' });
});

test('projection: azimuth increases to the RIGHT, altitude up, roll rotates the sky', () => {
  const p = createProjector({ azimuth: 180, altitude: 30, roll: 0, fov: 60 }, 400, 800, null);
  const out = { x: 0, y: 0 };
  p.project(...skyToVector(190, 30), out); assert.ok(out.x > 200);
  p.project(...skyToVector(170, 30), out); assert.ok(out.x < 200);
  p.project(...skyToVector(180, 40), out); assert.ok(out.y < 400);
  assert.equal(p.project(...skyToVector(0, -30), out), false); // behind the camera
  const r = createProjector({ azimuth: 180, altitude: 30, roll: 20, fov: 60 }, 400, 800, null);
  r.project(...skyToVector(180, 40), out); assert.ok(out.x < 200, 'phone rotated clockwise -> sky appears rotated counter-clockwise');
});

test('equatorial->horizontal matrix matches astronomy.js', () => {
  const loc = { latitude: 41.9, longitude: -87.6 };
  const date = new Date('2026-11-10T04:00:00Z');
  const M = equatorialToHorizontalMatrix(loc, date);
  for (const s of BRIGHT_STARS.slice(0, 10)) {
    const v = raDecToVector(s.ra, s.dec);
    const e = M.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
    const ref = equatorialToHorizontal(s.ra, s.dec, loc.latitude, loc.longitude, date);
    near(Math.asin(e[2]) * 180 / Math.PI, ref.altitude, 1e-6);
    const az = (Math.atan2(e[0], e[1]) * 180 / Math.PI + 360) % 360;
    near(Math.abs(((az - ref.azimuth + 540) % 360) - 180), 0, 1e-6);
  }
});

test('label placement avoids overlaps and keeps priority order', () => {
  const placed = placeLabels([
    { x: 10, y: 20, text: 'faint', width: 40, priority: 9 },
    { x: 12, y: 22, text: 'owned', width: 40, priority: 0 },
    { x: 200, y: 20, text: 'far', width: 20, priority: 5 },
  ]);
  assert.deepEqual(placed.map(p => p.text), ['owned', 'far']);
});

test('loader: tiled tiers can come from a separate base URL (future R2/CDN)', async () => {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    const local = url.replace('https://tiles.example/', '/catalog/');
    const body = await readFile(`public${local}`, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  };
  const loader = createCatalogLoader({ baseUrl: '/catalog/', tileBaseUrl: 'https://tiles.example/', fetchImpl });
  await loader.loadTier0();
  await loader.ensureView({ ra: 56.75, dec: 24.12, radius: 5, limit: 7 });
  assert.ok(calls.some(u => u === '/catalog/hyg41/t0.json'));
  assert.ok(calls.filter(u => u.includes('/t1/')).every(u => u.startsWith('https://tiles.example/hyg41/t1/')));
  assert.ok(calls.some(u => u.includes('/t1/')));
});

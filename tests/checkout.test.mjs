// Stripe web checkout: reservations, signed webhooks, idempotency, refunds.
// Stripe is never contacted: Worker fetches are intercepted by a mock.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { migrate } from './helpers/migrate.mjs';

const WHSEC = 'whsec_test_only_not_a_real_secret';
const HOST = 'stars.youneek.xyz';
let script, persist;
const stripeCalls = [];
let sessionCounter = 0;
let refundFailures = 0;

async function mockStripe(request) {
  const url = new URL(request.url);
  if (url.hostname !== 'api.stripe.com') return new Response('blocked', { status: 599 });
  const body = new URLSearchParams(await request.text());
  stripeCalls.push({ path: url.pathname, body, headers: Object.fromEntries(request.headers) });
  if (url.pathname === '/v1/checkout/sessions') {
    const id = `cs_test_${++sessionCounter}`;
    return Response.json({ id, url: `https://checkout.stripe.com/c/pay/${id}` });
  }
  if (url.pathname === '/v1/refunds') {
    if (refundFailures > 0) { refundFailures--; return Response.json({ error: { message: 'boom' } }, { status: 500 }); }
    return Response.json({ id: `re_${body.get('payment_intent')}` });
  }
  return Response.json({ error: { message: 'unexpected' } }, { status: 404 });
}

const instances = [];
async function runtime(bindings) {
  const mf = new Miniflare({ ...convertV4MiniflareOptions({
    modules: true, script, compatibilityDate: '2026-11-06',
    d1Databases: { STARS_DB: `db-${instances.length}` },
    bindings, outboundService: mockStripe,
    serviceBindings: { ASSETS: () => new Response('static asset') },
  }), resourcePersistencePath: persist });
  instances.push(mf);
  const db = await mf.getD1Database('STARS_DB');
  await migrate(db);
  return { mf, db };
}
let stripe, disabled;
before(async () => {
  persist = await mkdtemp(join(tmpdir(), 'youneek-checkout-test-'));
  script = (await build({ entryPoints: ['worker/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' })).outputFiles[0].text;
  stripe = await runtime({ CLAIM_MODE: 'stripe', STRIPE_SECRET_KEY: 'sk_test_mock', STRIPE_WEBHOOK_SECRET: WHSEC });
  disabled = await runtime({ CLAIM_MODE: 'disabled', STRIPE_SECRET_KEY: 'sk_test_mock', STRIPE_WEBHOOK_SECRET: WHSEC });
});
after(async () => { for (const mf of instances) await mf.dispose(); await rm(persist, { recursive: true, force: true }); });
beforeEach(() => { stripeCalls.length = 0; refundFailures = 0; });

function client(mf, host = HOST) {
  let cookie = '';
  return async (path, payload, extra = {}) => {
    const response = await mf.dispatchFetch(`https://${host}${path}`, {
      method: payload === undefined ? 'GET' : 'POST',
      headers: { Cookie: cookie, ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, data: await response.json() };
  };
}
const sign = (payload, t = Math.floor(Date.now() / 1000), secret = WHSEC) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;
async function deliver(mf, event, header) {
  const payload = JSON.stringify(event);
  const response = await mf.dispatchFetch(`https://${HOST}/api/stripe/webhook`, {
    method: 'POST', body: payload,
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': header ?? sign(payload) },
  });
  return { status: response.status, data: await response.json().catch(() => ({})), cookie: response.headers.get('set-cookie') };
}
let eventCounter = 0;
function completed(session, { amount, id } = {}) {
  const meta = Object.fromEntries([...session.body].filter(([k]) => k.startsWith('metadata[')).map(([k, v]) => [k.slice(9, -1), v]));
  return { id: id || `evt_${++eventCounter}`, type: 'checkout.session.completed', data: { object: {
    id: session.id, object: 'checkout.session', payment_status: 'paid', currency: 'usd',
    amount_total: amount ?? Number(session.body.get('line_items[0][price_data][unit_amount]')),
    client_reference_id: session.body.get('client_reference_id'), payment_intent: `pi_${session.id}`, metadata: meta,
  } } };
}
/** Start a checkout and return the mocked Stripe session it created. */
async function checkout(request, payload) {
  const before = stripeCalls.length;
  const result = await request('/api/checkout', payload);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  const call = stripeCalls.slice(before).find(c => c.path === '/v1/checkout/sessions');
  return { ...result.data, id: new URL(result.data.url).pathname.split('/').pop(), body: call.body, headers: call.headers };
}

test('disabled mode stays closed: no checkout, no Stripe call, no direct public claim', async () => {
  const request = client(disabled.mf);
  assert.equal((await request('/api/config')).data.claimMode, 'disabled');
  const result = await request('/api/checkout', { star: 'hip:32349', tier: 'base', owner_name: 'Alex' });
  assert.equal(result.status, 503);
  assert.equal(stripeCalls.length, 0);
  assert.equal((await request('/api/stars/claim', { star_id: 'sirius', buyer_name: 'Alex', tier: 'base' })).status, 503);
  assert.equal((await stripe.mf.dispatchFetch(`https://${HOST}/api/config`).then(r => r.json())).claimMode, 'stripe');
  // Stripe mode never re-enables the unpaid direct claim on a public host.
  assert.equal((await client(stripe.mf)('/api/stars/claim', { star_id: 'sirius', buyer_name: 'Alex', tier: 'base' })).status, 503);
});

test('webhook signature: valid accepted; invalid, wrong secret, stale, future and missing rejected', async () => {
  const event = { id: 'evt_sig', type: 'ping.unhandled', data: { object: {} } };
  const payload = JSON.stringify(event);
  const now = Math.floor(Date.now() / 1000);
  assert.equal((await deliver(stripe.mf, event, `t=${now},v1=${'0'.repeat(64)}`)).status, 400);
  assert.equal((await deliver(stripe.mf, event, sign(payload, now, 'whsec_wrong'))).status, 400);
  assert.equal((await deliver(stripe.mf, event, sign(payload, now - 301))).status, 400);
  assert.equal((await deliver(stripe.mf, event, sign(payload, now + 301))).status, 400);
  assert.equal((await deliver(stripe.mf, event, '')).status, 400);
  // Tampered body with a signature for the original payload.
  assert.equal((await deliver(stripe.mf, { ...event, id: 'evt_tampered' }, sign(payload, now))).status, 400);
  const ok = await deliver(stripe.mf, event, `t=${now},v1=${'f'.repeat(64)},${sign(payload, now).split(',')[1]}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.outcome, 'ignored_type');
  assert.equal(ok.cookie, null, 'webhook responses never set a browser cookie');
});

test('paid checkout creates the claim once; real name kept; duplicate event is a no-op', async () => {
  const buyer = client(stripe.mf);
  const session = await checkout(buyer, { star: 'sirius', tier: 'premium', owner_name: '  Alex\u0000\u202e ', custom_myth: 'For Mom' });
  assert.equal(session.body.get('line_items[0][price_data][unit_amount]'), '2000');
  assert.equal(session.body.get('line_items[0][price_data][currency]'), 'usd');
  assert.equal(session.body.get('metadata[star_key]'), 'hip:32349');
  assert.equal(session.body.get('metadata[star_id]'), 'sirius');
  assert.ok(session.body.get('metadata[reservation_id]'));
  assert.match(session.body.get('success_url'), /^https:\/\/stars\.youneek\.xyz\/claim\/success\?session_id=\{CHECKOUT_SESSION_ID\}$/);
  assert.match(session.body.get('cancel_url'), /\/claim\?star=hip%3A32349$/);
  assert.match(session.body.get('line_items[0][price_data][product_data][description]'), /Star naming is symbolic only and is not recognized by the IAU or any official astronomical body\./);
  assert.equal(session.headers['idempotency-key'], `youneek-stars-checkout-${session.body.get('metadata[reservation_id]')}`);
  assert.equal(session.headers.authorization, 'Bearer sk_test_mock');
  const expiresIn = Number(session.body.get('expires_at')) - Date.now() / 1000;
  assert.ok(expiresIn >= 30 * 60 && expiresIn < 35 * 60);
  // A held star is not offered to anyone else.
  assert.equal((await client(stripe.mf)('/api/stars/hip:32349')).data.available, false);
  assert.equal((await buyer(`/api/claims/session/${session.id}`)).data.status, 'pending');

  const event = completed(session);
  const first = await deliver(stripe.mf, event);
  assert.equal(first.status, 200);
  assert.equal(first.data.outcome, 'claimed');
  const again = await deliver(stripe.mf, event);
  assert.equal(again.data.duplicate, true);
  // Same payment, different event id (Stripe retry semantics): still one claim.
  assert.equal((await deliver(stripe.mf, completed(session))).data.outcome, 'noop_paid');
  assert.equal((await stripe.db.prepare("SELECT COUNT(*) AS n FROM claims WHERE star_key = 'hip:32349'").first()).n, 1);

  const everyone = client(stripe.mf);
  const star = (await everyone('/api/stars/hip:32349')).data;
  assert.equal(star.name, 'Sirius');
  assert.equal(star.owner_name, 'Alex');
  assert.equal(star.custom_myth, 'For Mom');
  assert.equal(star.available, false);
  assert.ok((await everyone('/api/stars?is_named=true')).data.some(s => s.star_key === 'hip:32349' && s.owner_name === 'Alex'));
  const status = (await everyone(`/api/claims/session/${session.id}`)).data;
  assert.equal(status.status, 'paid');
  assert.equal(status.star.owner_name, 'Alex');
  assert.equal((await buyer('/api/profile')).data.stars[0].name, 'Sirius');
  assert.equal((await everyone('/api/checkout', { star: 'hip:32349', tier: 'base', owner_name: 'Late' })).status, 409);
});

test('race: two simultaneous checkouts for one star get exactly one reservation', async () => {
  const [a, b] = await Promise.all([
    client(stripe.mf)('/api/checkout', { star: 'hip:91262', tier: 'base', owner_name: 'Ana' }),
    client(stripe.mf)('/api/checkout', { star: 'vega', tier: 'base', owner_name: 'Ben' }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  assert.equal(stripeCalls.filter(c => c.path === '/v1/checkout/sessions').length, 1);
  assert.equal((await stripe.db.prepare("SELECT COUNT(*) AS n FROM reservations WHERE star_key = 'hip:91262' AND status = 'pending'").first()).n, 1);
});

test('late payment for a star someone else claimed is refunded (idempotently, with retry)', async () => {
  const first = await checkout(client(stripe.mf), { star: 'rigel', tier: 'base', owner_name: 'First' });
  // First buyer's hold lapses; second buyer reserves and pays.
  await stripe.db.prepare("UPDATE reservations SET expires_at = '2000-01-01T00:00:00.000Z' WHERE stripe_session_id = ?").bind(first.id).run();
  const second = await checkout(client(stripe.mf), { star: 'hip:24436', tier: 'base', owner_name: 'Second' });
  assert.equal((await deliver(stripe.mf, completed(second))).data.outcome, 'claimed');
  // First buyer's payment lands late. Refund fails once: webhook 5xx, not marked processed.
  refundFailures = 1;
  const late = completed(first);
  const failed = await deliver(stripe.mf, late);
  assert.equal(failed.status, 500);
  assert.equal(await stripe.db.prepare('SELECT 1 FROM processed_events WHERE id = ?').bind(late.id).first(), null);
  const retried = await deliver(stripe.mf, late);
  assert.equal(retried.data.outcome, 'refunded');
  const refunds = stripeCalls.filter(c => c.path === '/v1/refunds');
  assert.equal(refunds.length, 2);
  assert.equal(new Set(refunds.map(r => r.headers['idempotency-key'])).size, 1, 'same idempotency key on retry');
  assert.equal(refunds[0].body.get('payment_intent'), `pi_${first.id}`);
  const ledger = await stripe.db.prepare('SELECT status, refund_reason, stripe_refund_id FROM reservations WHERE stripe_session_id = ?').bind(first.id).first();
  assert.deepEqual({ ...ledger }, { status: 'refunded', refund_reason: 'star_taken', stripe_refund_id: `re_pi_${first.id}` });
  assert.equal((await deliver(stripe.mf, late)).data.duplicate, true);
  assert.equal(stripeCalls.filter(c => c.path === '/v1/refunds').length, 2);
  assert.equal((await client(stripe.mf)('/api/stars/hip:24436')).data.owner_name, 'Second');
  const status = (await client(stripe.mf)(`/api/claims/session/${first.id}`)).data;
  assert.equal(status.status, 'refunded');
  assert.equal(status.star, null);
});

test('amount mismatch is refunded, never claimed; other apps on the Stripe account are ignored', async () => {
  const session = await checkout(client(stripe.mf), { star: 'hip:37279', tier: 'premium', owner_name: 'Cheap' });
  assert.equal((await deliver(stripe.mf, completed(session, { amount: 1 }))).data.outcome, 'refunded');
  assert.equal(await stripe.db.prepare("SELECT 1 FROM claims WHERE star_key = 'hip:37279'").first(), null);
  const foreign = completed(session);
  foreign.data.object.metadata = { app: 'some-other-site', reservation_id: 'x' };
  assert.equal((await deliver(stripe.mf, foreign)).data.outcome, 'ignored_other_app');
});

test('expired checkout releases the hold; full refund revokes by flag (row kept); partial keeps the name', async () => {
  const expiring = await checkout(client(stripe.mf), { star: 'hip:27989', tier: 'base', owner_name: 'Gone' });
  const expired = await deliver(stripe.mf, { id: 'evt_exp', type: 'checkout.session.expired', data: { object: { id: expiring.id, metadata: { app: 'youneek-stars', reservation_id: expiring.body.get('metadata[reservation_id]') } } } });
  assert.equal(expired.data.outcome, 'released');
  assert.equal((await client(stripe.mf)('/api/stars/hip:27989')).data.available, true);

  const paid = await checkout(client(stripe.mf), { star: 'hip:27989', tier: 'base', owner_name: 'Refundee' });
  await deliver(stripe.mf, completed(paid));
  const charge = { payment_intent: `pi_${paid.id}`, amount: 1000 };
  assert.equal((await deliver(stripe.mf, { id: 'evt_partial', type: 'charge.refunded', data: { object: { ...charge, refunded: false, amount_refunded: 300 } } })).data.outcome, 'partial_refund_recorded');
  assert.equal((await client(stripe.mf)('/api/stars/hip:27989')).data.owner_name, 'Refundee');
  assert.equal((await deliver(stripe.mf, { id: 'evt_full', type: 'charge.refunded', data: { object: { ...charge, refunded: true, amount_refunded: 1000 } } })).data.outcome, 'claim_revoked');
  const row = await stripe.db.prepare("SELECT status, refunded_at, owner_name FROM claims WHERE star_key = 'hip:27989'").first();
  assert.equal(row.status, 'refunded');
  assert.ok(row.refunded_at);
  assert.equal(row.owner_name, 'Refundee', 'refunded claim is flagged, not deleted');
  const star = (await client(stripe.mf)('/api/stars/hip:27989')).data;
  assert.equal(star.is_named, false);
  assert.equal(star.available, true);
  assert.ok(!(await client(stripe.mf)('/api/stars?is_named=true')).data.some(s => s.star_key === 'hip:27989'));
  // The star can be named again after a revoked claim.
  const next = await checkout(client(stripe.mf), { star: 'hip:27989', tier: 'base', owner_name: 'Next' });
  assert.equal((await deliver(stripe.mf, completed(next))).data.outcome, 'claimed');
  assert.equal((await client(stripe.mf)('/api/stars/hip:27989')).data.owner_name, 'Next');
});

test('dedication validation and moderation basics; unnamed objects cannot be bought', async () => {
  const request = client(stripe.mf);
  const cases = [
    { star: 'hip:65474', tier: 'base', owner_name: '' },
    { star: 'hip:65474', tier: 'base', owner_name: 'A'.repeat(41) },
    { star: 'hip:65474', tier: 'base', owner_name: 'visit www.example.com' },
    { star: 'hip:65474', tier: 'base', owner_name: 'me@example.com' },
    { star: 'hip:65474', tier: 'base', owner_name: 'Sh1t head' },
    { star: 'hip:65474', tier: 'gold', owner_name: 'Alex' },
    { star: 'hip:65474', tier: 'premium', owner_name: 'Alex', custom_myth: 'x'.repeat(501) },
    { star: 'venus', tier: 'base', owner_name: 'Alex' },
    { star: 'pleiades', tier: 'base', owner_name: 'Alex' },
    { star: 'hip:99999999', tier: 'base', owner_name: 'Alex' },
  ];
  for (const payload of cases) assert.equal((await request('/api/checkout', payload)).status, 400, JSON.stringify(payload));
  assert.equal(stripeCalls.length, 0);
  assert.equal((await request('/api/checkout', { star: 'hip:65474', tier: 'base', owner_name: 'Alex' }, { Origin: 'https://evil.example' })).status, 403);
  const base = await checkout(request, { star: 'hip:65474', tier: 'base', owner_name: 'Dick Smith', custom_myth: 'not stored for base' });
  const row = await stripe.db.prepare('SELECT custom_myth, amount_cents FROM reservations WHERE stripe_session_id = ?').bind(base.id).first();
  assert.deepEqual({ ...row }, { custom_myth: '', amount_cents: 1000 });
  assert.equal((await request('/api/claims/session/not-a-session')).status, 400);
});

test('migration 0002 maps legacy claim slugs to stable keys without losing rows', async () => {
  const mf = new Miniflare({ ...convertV4MiniflareOptions({ modules: true, script, compatibilityDate: '2026-11-06', d1Databases: { STARS_DB: 'migration-db' } }), resourcePersistencePath: persist });
  instances.push(mf);
  const db = await mf.getD1Database('STARS_DB');
  await migrate(db, ['0001_initial.sql']);
  await db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Old')"),
    db.prepare("INSERT INTO claims VALUES ('sirius', 'p1', 'Alex', 'premium', 'story', '2026-11-01')"),
    db.prepare("INSERT INTO claims VALUES ('venus', 'p1', 'Pat', 'base', '', '2026-11-02')"),
    db.prepare("INSERT INTO purchases VALUES ('u1', 'sirius', 'p1', 2000, 'demo', '2026-11-01')"),
  ]);
  await migrate(db, ['0002_stable_keys_and_checkout.sql']);
  const claims = (await db.prepare('SELECT star_key, legacy_star_id, owner_name, custom_myth, status FROM claims ORDER BY legacy_star_id').all()).results;
  assert.deepEqual(claims.map(c => ({ ...c })), [
    { star_key: 'hip:32349', legacy_star_id: 'sirius', owner_name: 'Alex', custom_myth: 'story', status: 'active' },
    { star_key: 'legacy:venus', legacy_star_id: 'venus', owner_name: 'Pat', custom_myth: '', status: 'active' },
  ]);
  assert.deepEqual({ ...(await db.prepare('SELECT star_key, legacy_star_id, amount_cents FROM purchases').first()) }, { star_key: 'hip:32349', legacy_star_id: 'sirius', amount_cents: 2000 });
  await assert.rejects(db.prepare("INSERT INTO claims (star_key, player_id, owner_name, tier, created_at) VALUES ('sirius', 'p1', 'x', 'base', 'now')").run());
  await assert.rejects(db.prepare("INSERT INTO claims (star_key, player_id, owner_name, tier, created_at) VALUES ('hip:32349', 'p1', 'x', 'base', 'now')").run());
});

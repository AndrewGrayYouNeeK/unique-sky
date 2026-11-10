import { BRIGHT_STARS } from '../src/lib/starData.js';
import { HUNTS } from '../src/lib/huntCatalog.js';
import { brightStarKey } from '../src/lib/brightStarKeys.js';
import { isStarKey } from '../src/lib/starKey.js';
import { DISCLAIMER, TIERS, validateDedication } from '../src/lib/dedication.js';
import { StripeError, stripePost, verifyStripeSignature } from './stripe';
import { handleScientistRoutes } from './scientist';

type AppEnv = Env & { STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string };
type Tier = 'base' | 'premium';
type CatalogStar = (typeof BRIGHT_STARS)[number] & { star_key: string | null };
type Claim = { star_key: string; legacy_star_id: string | null; owner_name: string; tier: string; custom_myth: string; created_at: string };
type Reservation = {
  id: string; star_key: string; legacy_star_id: string | null; player_id: string; owner_name: string; tier: Tier;
  custom_myth: string; amount_cents: number; status: string; stripe_session_id: string | null;
  stripe_payment_intent: string | null; stripe_refund_id: string | null; expires_at: string;
};
type StripeSession = {
  id: string; object?: string; payment_status?: string; amount_total?: number; currency?: string;
  payment_intent?: string | null; client_reference_id?: string | null; metadata?: Record<string, string>;
};
type StripeCharge = { payment_intent?: string | null; refunded?: boolean; amount?: number; amount_refunded?: number };

const COOKIE = 'youneek_session';
const APP_TAG = 'youneek-stars';
const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];
// Stripe Checkout must expire before our hold, so a session cannot be paid after
// its reservation is released (Stripe minimum is 30 minutes).
const STRIPE_SESSION_SECONDS = 31 * 60;
const RESERVATION_MS = 35 * 60 * 1000;
const PUBLIC_FIELDS = 'star_key, legacy_star_id, owner_name, tier, custom_myth, created_at';
const CATALOG: CatalogStar[] = BRIGHT_STARS.map(s => ({ ...s, star_key: brightStarKey(s.id) }));
const BY_KEY = new Map(CATALOG.filter(s => s.star_key).map(s => [s.star_key as string, s]));

class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const json = (value: unknown, status = 200) => Response.json(value, {
  // Claims must reach every client promptly: API responses are never cached.
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
const now = () => new Date().toISOString();
const day = () => now().slice(0, 10); // Shared UTC challenge boundary.
const isLoopback = (url: URL) => LOOPBACK.includes(url.hostname);

function claimMode(env: AppEnv, url: URL): 'demo' | 'stripe' | 'disabled' {
  if (env.CLAIM_MODE === 'demo' && isLoopback(url)) return 'demo';
  if (env.CLAIM_MODE === 'stripe' && env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) return 'stripe';
  return 'disabled';
}
function text(value: unknown, label: string, max: number, required = true): string {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > max) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return value.trim();
}
async function rawBody(request: Request, limit: number): Promise<string> {
  // Streaming limit also covers chunked requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Missing body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new ApiError(413, 'Request too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiError(415, 'Use application/json');
  const raw = await rawBody(request, 8192);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { throw new ApiError(400, 'Invalid JSON body'); }
}

/** Accept a stable key (hip:32349) or a built-in slug (sirius). */
function findStar(ref: unknown): CatalogStar | undefined {
  if (typeof ref !== 'string') return undefined;
  if (isStarKey(ref)) return BY_KEY.get(ref);
  return CATALOG.find(s => s.id === ref);
}
function catalogView(star: CatalogStar) {
  // Real catalog name always comes from the server catalog; claims never change it.
  return { ...star, hip_id: star.id, star_key: star.star_key, claimable: Boolean(star.star_key), is_named: false };
}
function starView(claim: Claim) {
  const star = BY_KEY.get(claim.star_key) || CATALOG.find(s => s.id === claim.legacy_star_id);
  if (!star) return null;
  return { ...catalogView(star), is_named: true, owner_name: claim.owner_name,
    ownership_tier: claim.tier, custom_myth: claim.custom_myth, ownership_date: claim.created_at };
}
async function activeClaims(db: D1Database) {
  const { results } = await db.prepare(`SELECT ${PUBLIC_FIELDS} FROM claims WHERE status = 'active' ORDER BY created_at DESC`).all<Claim>();
  return results;
}
async function leaderboard(db: D1Database, player: string) {
  const { results } = await db.prepare(`SELECT p.id, p.name, SUM(h.points) AS points, COUNT(*) AS badges
    FROM hunt_completions h JOIN players p ON p.id = h.player_id
    GROUP BY p.id ORDER BY points DESC, p.id ASC`).all<{id: string; name: string; points: number; badges: number}>();
  return results.map((e, i) => ({ name: e.name, points: e.points, badges: e.badges, rank: i + 1, isYou: e.id === player }));
}

// ---- Stripe checkout -------------------------------------------------------
async function createCheckout(request: Request, env: AppEnv, db: D1Database, player: string, url: URL) {
  if (claimMode(env, url) !== 'stripe') {
    throw new ApiError(503, 'Paid star claims are not enabled yet. No payment was taken.');
  }
  const data = await body(request);
  const star = findStar(data.star);
  if (!star?.star_key) throw new ApiError(400, 'This sky object cannot be named.');
  const check = validateDedication({ tier: data.tier, owner_name: data.owner_name, custom_myth: data.custom_myth });
  if (!check.ok) return json({ error: Object.values(check.errors)[0], errors: check.errors }, 400);
  const { tier, owner_name, custom_myth } = check.value;
  const price = TIERS[tier].amount_cents;
  if (await db.prepare("SELECT 1 FROM claims WHERE star_key = ? AND status = 'active'").bind(star.star_key).first()) {
    throw new ApiError(409, `${star.name} has already been named. Choose another star.`);
  }
  const id = crypto.randomUUID();
  const created = now();
  try {
    await db.batch([
      db.prepare("UPDATE reservations SET status = 'released', updated_at = ? WHERE star_key = ? AND status = 'pending' AND expires_at <= ?")
        .bind(created, star.star_key, created),
      db.prepare(`INSERT INTO reservations (id, star_key, legacy_star_id, player_id, owner_name, tier, custom_myth, amount_cents, status, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`)
        .bind(id, star.star_key, star.id, player, owner_name, tier, custom_myth, price, new Date(Date.now() + RESERVATION_MS).toISOString(), created, created),
    ]);
  } catch (error) {
    if (String(error).includes('UNIQUE')) throw new ApiError(409, `Someone is checking out ${star.name} right now. Try again in about 30 minutes or choose another star.`);
    throw error;
  }
  const back = `${url.origin}/claim?star=${encodeURIComponent(star.star_key)}`;
  let session: { id: string; url: string };
  try {
    session = await stripePost(env.STRIPE_SECRET_KEY as string, '/checkout/sessions', {
      mode: 'payment',
      'payment_method_types[0]': 'card',
      client_reference_id: id,
      success_url: `${url.origin}/claim/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: back,
      expires_at: Math.floor(Date.now() / 1000) + STRIPE_SESSION_SECONDS,
      submit_type: 'pay',
      line_items: { 0: { quantity: 1, price_data: { currency: 'usd', unit_amount: price, product_data: {
        name: `${star.name} – ${TIERS[tier].label} symbolic star naming`,
        description: `Dedication: Named by ${owner_name} – “Forever”. ${DISCLAIMER}`,
      } } } },
      metadata: { app: APP_TAG, star_key: star.star_key, star_id: star.id, reservation_id: id, tier },
      payment_intent_data: { metadata: { app: APP_TAG, star_key: star.star_key, reservation_id: id } },
      custom_text: { submit: { message: DISCLAIMER } },
    }, `${APP_TAG}-checkout-${id}`);
  } catch (error) {
    await db.prepare("UPDATE reservations SET status = 'released', updated_at = ? WHERE id = ? AND status = 'pending'").bind(now(), id).run();
    console.error(JSON.stringify({ event: 'stripe_checkout_failed', status: error instanceof StripeError ? error.status : 0 }));
    throw new ApiError(502, 'Checkout is unavailable right now. No payment was taken.');
  }
  await db.prepare('UPDATE reservations SET stripe_session_id = ?, updated_at = ? WHERE id = ?').bind(session.id, now(), id).run();
  return json({ url: session.url, reservation_id: id, expires_at: new Date(Date.now() + RESERVATION_MS).toISOString() }, 201);
}

async function refundReservation(env: AppEnv, db: D1Database, reservation: Reservation) {
  if (!reservation.stripe_payment_intent) throw new Error('refund_without_payment_intent');
  const refund = await stripePost<{ id: string }>(env.STRIPE_SECRET_KEY as string, '/refunds', {
    payment_intent: reservation.stripe_payment_intent,
    metadata: { app: APP_TAG, reservation_id: reservation.id, star_key: reservation.star_key },
  }, `${APP_TAG}-refund-${reservation.id}`); // Same key on every retry: Stripe refunds once.
  await db.prepare("UPDATE reservations SET status = 'refunded', stripe_refund_id = ?, updated_at = ? WHERE id = ? AND status = 'refund_pending'")
    .bind(refund.id, now(), reservation.id).run();
  return 'refunded';
}

async function fulfill(env: AppEnv, db: D1Database, session: StripeSession): Promise<string> {
  if (session.metadata?.app !== APP_TAG) return 'ignored_other_app'; // Shared Stripe account: never touch other products.
  if (session.payment_status !== 'paid') return 'awaiting_payment';
  const reservationId = session.metadata?.reservation_id;
  const reservation = await db.prepare('SELECT * FROM reservations WHERE id = ? AND (stripe_session_id = ? OR stripe_session_id IS NULL)')
    .bind(reservationId ?? '', session.id).first<Reservation>();
  if (!reservation || session.client_reference_id !== reservation.id) {
    console.error(JSON.stringify({ event: 'stripe_unmatched_session' }));
    return 'unmatched_session';
  }
  const amountOk = session.amount_total === reservation.amount_cents && session.currency === 'usd';
  const stamp = now();
  const results = await db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES (?, ?) ON CONFLICT(id) DO NOTHING").bind(reservation.player_id, reservation.owner_name),
    // One owner per star: insert, or take over only a refunded (revoked) claim row.
    db.prepare(`INSERT INTO claims (star_key, legacy_star_id, player_id, owner_name, tier, custom_myth, created_at, status, reservation_id)
      SELECT r.star_key, r.legacy_star_id, r.player_id, r.owner_name, r.tier, r.custom_myth, ?, 'active', r.id
      FROM reservations r WHERE r.id = ? AND r.status IN ('pending', 'released') AND ? = 1
      ON CONFLICT(star_key) DO UPDATE SET legacy_star_id = excluded.legacy_star_id, player_id = excluded.player_id,
        owner_name = excluded.owner_name, tier = excluded.tier, custom_myth = excluded.custom_myth,
        created_at = excluded.created_at, status = 'active', reservation_id = excluded.reservation_id, refunded_at = NULL
      WHERE claims.status = 'refunded'`).bind(stamp, reservation.id, amountOk ? 1 : 0),
    db.prepare(`UPDATE reservations SET
        status = CASE WHEN EXISTS (SELECT 1 FROM claims c WHERE c.star_key = reservations.star_key AND c.reservation_id = reservations.id AND c.status = 'active')
          THEN 'paid' ELSE 'refund_pending' END,
        refund_reason = CASE WHEN ? = 0 THEN 'amount_mismatch'
          WHEN EXISTS (SELECT 1 FROM claims c WHERE c.star_key = reservations.star_key AND c.reservation_id = reservations.id AND c.status = 'active')
          THEN NULL ELSE 'star_taken' END,
        stripe_session_id = ?, stripe_payment_intent = ?, updated_at = ?
      WHERE id = ? AND status IN ('pending', 'released')`).bind(amountOk ? 1 : 0, session.id, session.payment_intent ?? null, stamp, reservation.id),
    db.prepare('SELECT * FROM reservations WHERE id = ?').bind(reservation.id),
  ]);
  const current = results[3].results[0] as Reservation;
  if (current.status === 'refund_pending') return refundReservation(env, db, current);
  return current.status === 'paid' && results[2].meta.changes ? 'claimed' : `noop_${current.status}`;
}

async function expire(db: D1Database, session: StripeSession): Promise<string> {
  if (session.metadata?.app !== APP_TAG) return 'ignored_other_app';
  const result = await db.prepare("UPDATE reservations SET status = 'released', updated_at = ? WHERE id = ? AND stripe_session_id = ? AND status = 'pending'")
    .bind(now(), session.metadata?.reservation_id ?? '', session.id).run();
  return result.meta.changes ? 'released' : 'noop';
}

/**
 * Refund policy (documented in README):
 * - Full refund of a fulfilled claim: claims.status -> 'refunded', refunded_at set. The
 *   row is kept (never deleted), hidden from public views, and the star becomes
 *   available again. The reservation ledger keeps the original dedication.
 * - Partial refund: the dedication stays; only amount_refunded_cents is recorded.
 */
async function chargeRefunded(db: D1Database, charge: StripeCharge): Promise<string> {
  if (!charge.payment_intent) return 'ignored';
  const reservation = await db.prepare('SELECT * FROM reservations WHERE stripe_payment_intent = ?').bind(charge.payment_intent).first<Reservation>();
  if (!reservation) return 'ignored_unmatched';
  const stamp = now();
  if (!charge.refunded) {
    await db.prepare('UPDATE reservations SET amount_refunded_cents = ?, updated_at = ? WHERE id = ?').bind(charge.amount_refunded ?? 0, stamp, reservation.id).run();
    return 'partial_refund_recorded';
  }
  const results = await db.batch([
    db.prepare("UPDATE claims SET status = 'refunded', refunded_at = ? WHERE reservation_id = ? AND status = 'active'").bind(stamp, reservation.id),
    db.prepare("UPDATE reservations SET status = 'refunded', amount_refunded_cents = ?, updated_at = ? WHERE id = ?").bind(charge.amount_refunded ?? reservation.amount_cents, stamp, reservation.id),
  ]);
  return results[0].meta.changes ? 'claim_revoked' : 'refund_recorded';
}

async function webhook(request: Request, env: AppEnv, db: D1Database): Promise<Response> {
  // Webhooks are processed whenever the secret exists, even if CLAIM_MODE was later
  // switched off, so money already taken is always fulfilled or refunded.
  if (!env.STRIPE_WEBHOOK_SECRET) throw new ApiError(503, 'Webhook not configured');
  const payload = await rawBody(request, 256 * 1024);
  if (!await verifyStripeSignature(payload, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET)) {
    throw new ApiError(400, 'Invalid signature');
  }
  let event: { id?: string; type?: string; data?: { object?: unknown } };
  try { event = JSON.parse(payload); } catch { throw new ApiError(400, 'Invalid JSON body'); }
  if (typeof event.id !== 'string' || typeof event.type !== 'string') throw new ApiError(400, 'Invalid event');
  if (await db.prepare('SELECT 1 FROM processed_events WHERE id = ?').bind(event.id).first()) return json({ received: true, duplicate: true });
  const object = event.data?.object as StripeSession & StripeCharge;
  let outcome = 'ignored_type';
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    if (!env.STRIPE_SECRET_KEY) throw new ApiError(503, 'Stripe not configured'); // Needed for refunds; Stripe will retry.
    outcome = await fulfill(env, db, object);
  } else if (event.type === 'checkout.session.expired') outcome = await expire(db, object);
  else if (event.type === 'charge.refunded') outcome = await chargeRefunded(db, object);
  // Recorded only after success; a thrown error returns 5xx and Stripe retries.
  await db.prepare('INSERT INTO processed_events (id, type, outcome, processed_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
    .bind(event.id, event.type, outcome, now()).run();
  console.log(JSON.stringify({ event: 'stripe_webhook', type: event.type, outcome }));
  return json({ received: true, outcome });
}

// ---- Routes ----------------------------------------------------------------
async function api(request: Request, env: AppEnv, player: string): Promise<Response> {
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname}`;
  if (route === 'GET /api/health') return json({ ok: true });
  if (route === 'GET /api/config') return json({ claimMode: claimMode(env, url) });
  // Scientist Mode proxies (no D1). Keep ahead of the STARS_DB gate so offline-capable
  // clients can still hit these when only enrichment is needed.
  const scientist = await handleScientistRoutes(request, json);
  if (scientist) return scientist;
  const db = env.STARS_DB;
  if (!db) throw new ApiError(503, 'STARS_DB binding is required');
  if (route === 'POST /api/stripe/webhook') return webhook(request, env, db);
  if (route === 'POST /api/checkout') return createCheckout(request, env, db, player, url);
  if (route === 'GET /api/stars') {
    const named = (await activeClaims(db)).map(starView).filter(Boolean);
    const stars = url.searchParams.get('is_named') === 'true' ? named : CATALOG.map(s => named.find(n => n?.id === s.id) || catalogView(s));
    const limit = url.searchParams.get('limit');
    if (limit && (!/^\d+$/.test(limit) || Number(limit) < 1)) throw new ApiError(400, 'Invalid limit');
    return json(limit ? stars.slice(0, Math.min(Number(limit), 1000)) : stars);
  }
  if (request.method === 'GET' && url.pathname.startsWith('/api/stars/')) {
    const star = findStar(decodeURIComponent(url.pathname.slice('/api/stars/'.length)));
    if (!star) throw new ApiError(404, 'Unknown star');
    const claim = star.star_key
      ? await db.prepare(`SELECT ${PUBLIC_FIELDS} FROM claims WHERE star_key = ? AND status = 'active'`).bind(star.star_key).first<Claim>()
      : null;
    const pending = star.star_key && !claim
      ? await db.prepare("SELECT 1 FROM reservations WHERE star_key = ? AND status = 'pending' AND expires_at > ?").bind(star.star_key, now()).first()
      : null;
    return json({ ...(claim ? starView(claim) : catalogView(star)), available: Boolean(star.star_key) && !claim && !pending, checkout_pending: Boolean(pending) });
  }
  if (request.method === 'GET' && url.pathname.startsWith('/api/claims/session/')) {
    const sessionId = url.pathname.slice('/api/claims/session/'.length);
    if (!/^cs_(test|live)_[A-Za-z0-9]{1,200}$/.test(sessionId)) throw new ApiError(400, 'Invalid session');
    const reservation = await db.prepare('SELECT id, star_key, status FROM reservations WHERE stripe_session_id = ?').bind(sessionId).first<{id: string; star_key: string; status: string}>();
    if (!reservation) throw new ApiError(404, 'Checkout session not found');
    const claim = reservation.status === 'paid'
      ? await db.prepare(`SELECT ${PUBLIC_FIELDS} FROM claims WHERE star_key = ? AND reservation_id = ? AND status = 'active'`).bind(reservation.star_key, reservation.id).first<Claim>()
      : null;
    const star = BY_KEY.get(reservation.star_key);
    return json({ status: reservation.status, star_key: reservation.star_key, star_name: star?.name, star: claim ? starView(claim) : null });
  }
  if (route === 'GET /api/leaderboard') return json(await leaderboard(db, player));
  if (route === 'GET /api/hunts/completions') {
    const { results } = await db.prepare('SELECT hunt_id, points, completed_at, hunt_day FROM hunt_completions WHERE player_id = ? AND hunt_day = ?').bind(player, day()).all();
    return json(results);
  }
  if (route === 'GET /api/profile') {
    const [profile, claims, hunts, board] = await Promise.all([
      db.prepare('SELECT name FROM players WHERE id = ?').bind(player).first<{name: string}>(),
      db.prepare(`SELECT ${PUBLIC_FIELDS} FROM claims WHERE player_id = ? AND status = 'active'`).bind(player).all<Claim>(),
      db.prepare('SELECT hunt_id, points, completed_at, hunt_day FROM hunt_completions WHERE player_id = ? AND hunt_day = ?').bind(player, day()).all(),
      leaderboard(db, player),
    ]);
    return json({ name: profile?.name || 'Sky Explorer', stars: claims.results.map(starView).filter(Boolean),
      completions: hunts.results, rank: board.find(e => e.isYou)?.rank || null,
      points: board.find(e => e.isYou)?.points || 0 });
  }
  if (route === 'POST /api/profile') {
    const data = await body(request);
    const name = text(data.name, 'name', 40);
    await db.prepare('INSERT INTO players (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name').bind(player, name).run();
    return json({ name });
  }
  if (route === 'POST /api/hunts/complete') {
    const data = await body(request);
    const hunt = HUNTS.find(h => h.id === data.hunt_id);
    if (!hunt || data.target_star !== hunt.target_star) throw new ApiError(400, 'Invalid hunt target');
    const name = text(data.player_name, 'player name', 40);
    const today = day();
    const result = await db.batch([
      db.prepare('INSERT INTO players (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name').bind(player, name),
      db.prepare(`INSERT INTO hunt_completions (id, hunt_id, player_id, hunt_day, points, completed_at)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(player_id, hunt_id, hunt_day) DO NOTHING`)
        .bind(crypto.randomUUID(), hunt.id, player, today, hunt.points, now()),
      db.prepare('SELECT hunt_id, points, completed_at, hunt_day FROM hunt_completions WHERE player_id = ? AND hunt_id = ? AND hunt_day = ?').bind(player, hunt.id, today),
    ]);
    return json({ success: true, completion: result[2].results[0], alreadyCompleted: result[1].meta.changes === 0 });
  }
  if (route === 'POST /api/stars/claim') {
    // Unpaid demo claims: loopback hosts only, explicitly opted in. Public hosts
    // (including stars.youneek.xyz) can only claim through Stripe Checkout.
    if (claimMode(env, url) !== 'demo') {
      throw new ApiError(503, 'Direct claims are disabled. Name a star through the checkout page.');
    }
    const data = await body(request);
    const star = findStar(data.star_id);
    if (!star) throw new ApiError(400, 'Unknown catalog star');
    if (!star.star_key) throw new ApiError(400, 'This sky object cannot be named.');
    if (data.tier !== 'base' && data.tier !== 'premium') throw new ApiError(400, 'Invalid tier');
    const check = validateDedication({ tier: data.tier, owner_name: data.buyer_name, custom_myth: data.custom_myth });
    if (!check.ok) return json({ error: Object.values(check.errors)[0], errors: check.errors }, 400);
    const { tier, owner_name: name, custom_myth: myth } = check.value;
    const created = now();
    try {
      await db.batch([
        db.prepare('INSERT INTO players (id, name) VALUES (?, ?) ON CONFLICT(id) DO NOTHING').bind(player, name),
        db.prepare('INSERT INTO claims (star_key, legacy_star_id, player_id, owner_name, tier, custom_myth, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(star.star_key, star.id, player, name, tier, myth, created),
        db.prepare('INSERT INTO purchases (id, star_key, legacy_star_id, player_id, amount_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(crypto.randomUUID(), star.star_key, star.id, player, TIERS[tier].amount_cents, 'demo', created),
      ]);
    } catch (error) {
      if (await db.prepare('SELECT 1 FROM claims WHERE star_key = ?').bind(star.star_key).first()) throw new ApiError(409, `${star.name} has already been claimed. Choose another star.`);
      throw error;
    }
    return json({ success: true, demo: true, star: starView({ star_key: star.star_key, legacy_star_id: star.id, owner_name: name, tier, custom_myth: myth, created_at: created }) }, 201);
  }
  throw new ApiError(404, 'API route not found');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const isWebhook = url.pathname === '/api/stripe/webhook';
    const existing = request.headers.get('Cookie')?.match(/(?:^|;\s*)youneek_session=([a-f0-9-]{36})(?:;|$)/)?.[1];
    const player = existing || crypto.randomUUID();
    let response: Response;
    try {
      // Browser writes must be same-origin. Stripe's server-to-server webhook is
      // authenticated by its signature instead.
      if (!isWebhook && !['GET', 'HEAD'].includes(request.method)) {
        const origin = request.headers.get('Origin');
        if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new ApiError(403, 'Cross-origin writes are not allowed');
      }
      response = await api(request, env as AppEnv, player);
    } catch (error) {
      if (error instanceof ApiError) response = json({ error: error.message }, error.status);
      else {
        console.error(JSON.stringify({ event: 'api_error', path: isWebhook ? url.pathname : url.pathname.split('/').slice(0, 3).join('/') }));
        response = json({ error: 'Storage unavailable. Check the STARS_DB binding and migrations.' }, isWebhook ? 500 : 503);
      }
    }
    if (!existing && !isWebhook) response.headers.append('Set-Cookie', `${COOKIE}=${player}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}`);
    return response;
  },
} satisfies ExportedHandler<Env>;

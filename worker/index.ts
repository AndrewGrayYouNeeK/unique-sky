import { BRIGHT_STARS } from '../src/lib/starData.js';
import { HUNTS } from '../src/lib/huntCatalog.js';
import { handleScientistRoutes } from './scientist';

const COOKIE = 'youneek_session';
const PUBLIC_FIELDS = `star_id, owner_name, tier, custom_myth, created_at`;
type Claim = { star_id: string; owner_name: string; tier: string; custom_myth: string; created_at: string };
class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const json = (value: unknown, status = 200) => Response.json(value, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
const day = () => new Date().toISOString().slice(0, 10); // Shared UTC challenge boundary.
function text(value: unknown, label: string, max: number, required = true): string {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > max) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return value.trim();
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiError(415, 'Use application/json');
  // Streaming limit also covers chunked requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Missing JSON body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); throw new ApiError(413, 'Request too large'); }
    chunks.push(value);
  }
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { throw new ApiError(400, 'Invalid JSON body'); }
}
function starView(claim: Claim) {
  const star = BRIGHT_STARS.find(s => s.id === claim.star_id);
  if (!star) return null;
  return { ...star, hip_id: star.id, is_named: true, owner_name: claim.owner_name,
    ownership_tier: claim.tier, custom_myth: claim.custom_myth, ownership_date: claim.created_at };
}
async function leaderboard(db: D1Database, player: string) {
  const { results } = await db.prepare(`SELECT p.id, p.name, SUM(h.points) AS points, COUNT(*) AS badges
    FROM hunt_completions h JOIN players p ON p.id = h.player_id
    GROUP BY p.id ORDER BY points DESC, p.id ASC`).all<{id: string; name: string; points: number; badges: number}>();
  return results.map((e, i) => ({ name: e.name, points: e.points, badges: e.badges, rank: i + 1, isYou: e.id === player }));
}
async function api(request: Request, env: Env, player: string): Promise<Response> {
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname}`;
  if (route === 'GET /api/health') return json({ ok: true });
  if (route === 'GET /api/config') return json({ claimMode: env.CLAIM_MODE === 'demo' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? 'demo' : 'disabled' });
  // Scientist Mode proxies (no D1). Keep ahead of the STARS_DB gate so offline-capable
  // clients can still hit these when only enrichment is needed.
  const scientist = await handleScientistRoutes(request, json);
  if (scientist) return scientist;
  const db = env.STARS_DB;
  if (!db) throw new ApiError(503, 'STARS_DB binding is required');
  if (route === 'GET /api/stars') {
    const { results } = await db.prepare(`SELECT ${PUBLIC_FIELDS} FROM claims ORDER BY created_at DESC`).all<Claim>();
    const named = results.map(starView).filter(Boolean);
    const stars = url.searchParams.get('is_named') === 'true' ? named : BRIGHT_STARS.map(s => named.find(n => n?.id === s.id) || { ...s, hip_id: s.id, is_named: false });
    const limit = url.searchParams.get('limit');
    if (limit && (!/^\d+$/.test(limit) || Number(limit) < 1)) throw new ApiError(400, 'Invalid limit');
    return json(limit ? stars.slice(0, Math.min(Number(limit), 1000)) : stars);
  }
  if (route === 'GET /api/leaderboard') return json(await leaderboard(db, player));
  if (route === 'GET /api/hunts/completions') {
    const { results } = await db.prepare('SELECT hunt_id, points, completed_at, hunt_day FROM hunt_completions WHERE player_id = ? AND hunt_day = ?').bind(player, day()).all();
    return json(results);
  }
  if (route === 'GET /api/profile') {
    const [profile, claims, hunts, board] = await Promise.all([
      db.prepare('SELECT name FROM players WHERE id = ?').bind(player).first<{name: string}>(),
      db.prepare(`SELECT ${PUBLIC_FIELDS} FROM claims WHERE player_id = ?`).bind(player).all<Claim>(),
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
        .bind(crypto.randomUUID(), hunt.id, player, today, hunt.points, new Date().toISOString()),
      db.prepare('SELECT hunt_id, points, completed_at, hunt_day FROM hunt_completions WHERE player_id = ? AND hunt_id = ? AND hunt_day = ?').bind(player, hunt.id, today),
    ]);
    return json({ success: true, completion: result[2].results[0], alreadyCompleted: result[1].meta.changes === 0 });
  }
  if (route === 'POST /api/stars/claim') {
    // Existing app pretended payment succeeded without a processor. Never do that
    // publicly. Demo claims are allowed ONLY on loopback, explicitly opted in.
    if (env.CLAIM_MODE !== 'demo' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new ApiError(503, 'Paid star claims are not enabled. Payment integration must be approved and connected first.');
    }
    const data = await body(request);
    const star = BRIGHT_STARS.find(s => s.id === data.star_id);
    if (!star) throw new ApiError(400, 'Unknown catalog star');
    if (data.tier !== 'base' && data.tier !== 'premium') throw new ApiError(400, 'Invalid tier');
    const name = text(data.buyer_name, 'buyer name', 40);
    const myth = text(data.custom_myth, 'story', 500, false);
    const tier = data.tier;
    const created = new Date().toISOString();
    try {
      await db.batch([
        db.prepare('INSERT INTO players (id, name) VALUES (?, ?) ON CONFLICT(id) DO NOTHING').bind(player, name),
        db.prepare('INSERT INTO claims (star_id, player_id, owner_name, tier, custom_myth, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(star.id, player, name, tier, tier === 'premium' ? myth : '', created),
        db.prepare('INSERT INTO purchases (id, star_id, player_id, amount_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(crypto.randomUUID(), star.id, player, tier === 'premium' ? 2000 : 1000, 'demo', created),
      ]);
    } catch (error) {
      if (await db.prepare('SELECT star_id FROM claims WHERE star_id = ?').bind(star.id).first()) throw new ApiError(409, `${star.name} has already been claimed. Choose another star.`);
      throw error;
    }
    return json({ success: true, demo: true, star: starView({ star_id: star.id, owner_name: name, tier, custom_myth: tier === 'premium' ? myth : '', created_at: created }) }, 201);
  }
  throw new ApiError(404, 'API route not found');
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const existing = request.headers.get('Cookie')?.match(/(?:^|;\s*)youneek_session=([a-f0-9-]{36})(?:;|$)/)?.[1];
    const player = existing || crypto.randomUUID();
    let response: Response;
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        const origin = request.headers.get('Origin');
        if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new ApiError(403, 'Cross-origin writes are not allowed');
      }
      response = await api(request, env, player);
    } catch (error) {
      if (error instanceof ApiError) response = json({ error: error.message }, error.status);
      else {
        console.error(JSON.stringify({ event: 'api_error', path: url.pathname }));
        response = json({ error: 'Storage unavailable. Check the STARS_DB binding and migrations.' }, 503);
      }
    }
    if (!existing) response.headers.append('Set-Cookie', `${COOKIE}=${player}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}`);
    return response;
  },
} satisfies ExportedHandler<Env>;

-- 0002: stable scientific star keys + Stripe web checkout ledger.
-- Needs Andrew's approval before `wrangler d1 migrations apply --remote`.
-- No rows are deleted: every existing claim/purchase is copied with its old slug
-- kept in legacy_star_id. Slugs without a stable ID become 'legacy:<slug>'.
PRAGMA defer_foreign_keys = on;

CREATE TABLE star_key_map (
  legacy_star_id TEXT PRIMARY KEY,
  star_key TEXT NOT NULL UNIQUE
);
INSERT INTO star_key_map (legacy_star_id, star_key) VALUES
  ('sirius', 'hip:32349'),
  ('canopus', 'hip:30438'),
  ('arcturus', 'hip:69673'),
  ('vega', 'hip:91262'),
  ('capella', 'hip:24608'),
  ('rigel', 'hip:24436'),
  ('procyon', 'hip:37279'),
  ('betelgeuse', 'hip:27989'),
  ('altair', 'hip:97649'),
  ('aldebaran', 'hip:21421'),
  ('spica', 'hip:65474'),
  ('antares', 'hip:80763'),
  ('pollux', 'hip:37826'),
  ('fomalhaut', 'hip:113368'),
  ('deneb', 'hip:102098'),
  ('regulus', 'hip:49669'),
  ('polaris', 'hip:11767'),
  ('castor', 'hip:36850'),
  ('bellatrix', 'hip:25336'),
  ('elnath', 'hip:25428'),
  ('miaplacidus', 'hip:45238'),
  ('alnilam', 'hip:26311'),
  ('alnitak', 'hip:26727'),
  ('alioth', 'hip:62956'),
  ('dubhe', 'hip:54061'),
  ('mirfak', 'hip:15863'),
  ('wezen', 'hip:34444'),
  ('kaus-australis', 'hip:90185'),
  ('avior', 'hip:41037'),
  ('alkaid', 'hip:67301');

-- claims: one row per star (PRIMARY KEY star_key). Refunds flip status, never delete.
CREATE TABLE claims_v2 (
  star_key TEXT PRIMARY KEY CHECK (
    star_key GLOB 'gaia:[1-9]*' OR star_key GLOB 'hip:[1-9]*' OR star_key GLOB 'hd:[1-9]*' OR star_key GLOB 'legacy:?*'),
  legacy_star_id TEXT,
  player_id TEXT NOT NULL REFERENCES players(id),
  owner_name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('base', 'premium')),
  custom_myth TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'refunded')),
  reservation_id TEXT,
  refunded_at TEXT
);
INSERT INTO claims_v2 (star_key, legacy_star_id, player_id, owner_name, tier, custom_myth, created_at)
  SELECT COALESCE(m.star_key, 'legacy:' || c.star_id), c.star_id, c.player_id, c.owner_name, c.tier, c.custom_myth, c.created_at
  FROM claims c LEFT JOIN star_key_map m ON m.legacy_star_id = c.star_id;

-- purchases stays the unpaid local-demo ledger. Stripe orders live in reservations.
CREATE TABLE purchases_v2 (
  id TEXT PRIMARY KEY,
  star_key TEXT NOT NULL,
  legacy_star_id TEXT,
  player_id TEXT NOT NULL REFERENCES players(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents IN (1000, 2000)),
  status TEXT NOT NULL CHECK(status IN ('demo', 'paid')),
  created_at TEXT NOT NULL
);
INSERT INTO purchases_v2 (id, star_key, legacy_star_id, player_id, amount_cents, status, created_at)
  SELECT p.id, COALESCE(m.star_key, 'legacy:' || p.star_id), p.star_id, p.player_id, p.amount_cents, p.status, p.created_at
  FROM purchases p LEFT JOIN star_key_map m ON m.legacy_star_id = p.star_id;

DROP TABLE purchases;
DROP TABLE claims;
ALTER TABLE claims_v2 RENAME TO claims;
ALTER TABLE purchases_v2 RENAME TO purchases;
CREATE INDEX claims_player ON claims(player_id);
CREATE INDEX purchases_star ON purchases(star_key);

-- Short-lived checkout holds and the Stripe order ledger.
-- pending -> paid | refund_pending -> refunded | released (expired/cancelled)
CREATE TABLE reservations (
  id TEXT PRIMARY KEY,
  star_key TEXT NOT NULL,
  legacy_star_id TEXT,
  player_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('base', 'premium')),
  custom_myth TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL CHECK(amount_cents IN (1000, 2000)),
  status TEXT NOT NULL CHECK(status IN ('pending', 'paid', 'refund_pending', 'refunded', 'released')),
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  stripe_refund_id TEXT,
  refund_reason TEXT,
  amount_refunded_cents INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- At most one live checkout hold per star, so two buyers cannot both pay.
CREATE UNIQUE INDEX reservations_one_pending_per_star ON reservations(star_key) WHERE status = 'pending';
CREATE INDEX reservations_payment_intent ON reservations(stripe_payment_intent);

-- Webhook idempotency: each Stripe event id is acted on once.
CREATE TABLE processed_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  processed_at TEXT NOT NULL
);

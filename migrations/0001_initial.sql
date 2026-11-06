-- D1 is authoritative. No writable filesystem or eventual-consistency claim locks.
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Sky Explorer'
);
CREATE TABLE claims (
  star_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  owner_name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('base', 'premium')),
  custom_myth TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  star_id TEXT NOT NULL UNIQUE REFERENCES claims(star_id),
  player_id TEXT NOT NULL REFERENCES players(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents IN (1000, 2000)),
  status TEXT NOT NULL CHECK(status IN ('demo', 'paid')),
  created_at TEXT NOT NULL
);
CREATE TABLE hunt_completions (
  id TEXT PRIMARY KEY,
  hunt_id TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id),
  hunt_day TEXT NOT NULL,
  points INTEGER NOT NULL CHECK(points > 0),
  completed_at TEXT NOT NULL,
  UNIQUE(player_id, hunt_id, hunt_day)
);
CREATE INDEX hunt_player ON hunt_completions(player_id);
CREATE INDEX claims_player ON claims(player_id);

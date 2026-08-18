import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 3001;

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { stars: [], purchases: [], huntCompletions: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/stars', (req, res) => {
  const data = readData();
  let stars = data.stars;

  if (req.query.is_named === 'true') {
    stars = stars.filter((s) => s.is_named);
  }

  const sort = req.query.sort || '';
  if (sort.startsWith('-')) {
    const field = sort.slice(1);
    stars = [...stars].sort((a, b) => String(b[field] || '').localeCompare(String(a[field] || '')));
  }

  const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
  if (limit) stars = stars.slice(0, limit);

  res.json(stars);
});

app.post('/api/stars/claim', (req, res) => {
  const { star_id, star_name, buyer_name, buyer_email, tier, custom_myth, amount_cents } = req.body || {};

  if (!star_id || !buyer_name || !tier) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const data = readData();
  const normalizedName = star_name?.toLowerCase();

  const alreadyClaimed = data.stars.find(
    (s) => s.is_named && (s.hip_id === star_id || s.name?.toLowerCase() === normalizedName)
  );

  if (alreadyClaimed) {
    return res.json({
      success: false,
      error: `"${star_name}" has already been claimed by ${alreadyClaimed.owner_name}. Please choose another star.`,
    });
  }

  const existingStar = data.stars.find(
    (s) => s.hip_id === star_id || s.name?.toLowerCase() === normalizedName
  );

  const ownershipData = {
    is_named: true,
    owner_name: buyer_name,
    owner_user_id: buyer_email || buyer_name,
    ownership_tier: tier,
    ownership_date: new Date().toISOString(),
    custom_myth: tier === 'premium' ? (custom_myth || '') : '',
  };

  let claimedStar;
  if (existingStar) {
    claimedStar = { ...existingStar, ...ownershipData };
    data.stars = data.stars.map((s) => (s.id === existingStar.id ? claimedStar : s));
  } else {
    claimedStar = {
      id: randomUUID(),
      hip_id: star_id,
      name: star_name,
      ra: 0,
      dec: 0,
      magnitude: 5,
      ...ownershipData,
    };
    data.stars.push(claimedStar);
  }

  data.purchases.push({
    id: randomUUID(),
    star_id: claimedStar.id,
    star_name,
    buyer_name,
    buyer_email: buyer_email || '',
    tier,
    amount_cents: amount_cents || (tier === 'premium' ? 2000 : 1000),
    status: 'completed',
    custom_myth: tier === 'premium' ? (custom_myth || '') : '',
    created_at: new Date().toISOString(),
  });

  writeData(data);

  res.json({
    success: true,
    star: claimedStar,
    message: `${star_name} has been claimed by ${buyer_name}!`,
  });
});

app.get('/api/hunts/completions', (_req, res) => {
  const data = readData();
  res.json(data.huntCompletions);
});

app.post('/api/hunts/complete', (req, res) => {
  const { hunt_id, player_name, points } = req.body || {};
  if (!hunt_id || !player_name) {
    return res.status(400).json({ error: 'Missing hunt_id or player_name' });
  }

  const data = readData();
  const existing = data.huntCompletions.find(
    (c) => c.hunt_id === hunt_id && c.player_name === player_name
  );

  if (existing) {
    return res.json({ success: true, completion: existing, alreadyCompleted: true });
  }

  const completion = {
    id: randomUUID(),
    hunt_id,
    player_name,
    points: points || 0,
    completed_at: new Date().toISOString(),
  };

  data.huntCompletions.push(completion);
  writeData(data);
  res.json({ success: true, completion });
});

app.get('/api/leaderboard', (_req, res) => {
  const data = readData();
  const scores = {};

  data.huntCompletions.forEach((c) => {
    if (!scores[c.player_name]) {
      scores[c.player_name] = { name: c.player_name, points: 0, badges: 0 };
    }
    scores[c.player_name].points += c.points || 0;
    scores[c.player_name].badges += 1;
  });

  const leaderboard = Object.values(scores)
    .sort((a, b) => b.points - a.points)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  res.json(leaderboard);
});

app.listen(PORT, () => {
  console.log(`YouneeK Stars API running on http://localhost:${PORT}`);
});

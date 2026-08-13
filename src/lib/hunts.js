import { api } from '@/api/apiClient';

export const HUNTS = [
  {
    id: 'hunt-1',
    title: 'Find Polaris',
    description: 'Locate the North Star in the sky and tap it to complete the challenge.',
    target_star: 'Polaris',
    target_constellation: 'Ursa Minor',
    icon: '⭐',
    difficulty: 'easy',
    points: 100,
    hint: 'Look almost exactly north. It barely moves all night.',
    participants: 2841,
  },
  {
    id: 'hunt-2',
    title: 'Spot the Pleiades',
    description: 'Identify the famous Seven Sisters cluster in Taurus.',
    target_star: 'Pleiades',
    target_constellation: 'Taurus',
    icon: '🌟',
    difficulty: 'medium',
    points: 250,
    hint: 'Look for a tiny tight cluster of stars — they look like a mini dipper.',
    participants: 1203,
  },
  {
    id: 'hunt-3',
    title: "Orion's Belt",
    description: "Tap Alnilam, the middle star of Orion's belt.",
    target_star: 'Alnilam',
    target_constellation: 'Orion',
    icon: '⚔️',
    difficulty: 'medium',
    points: 300,
    hint: 'Three stars in a nearly perfect line in the winter sky.',
    participants: 1876,
  },
  {
    id: 'hunt-4',
    title: 'Sirius Rising',
    description: 'Find Sirius, the brightest star in the night sky.',
    target_star: 'Sirius',
    target_constellation: 'Canis Major',
    icon: '💎',
    difficulty: 'easy',
    points: 150,
    hint: 'The absolute brightest thing in the night sky. You cannot miss it.',
    participants: 4102,
  },
  {
    id: 'hunt-5',
    title: 'Summer Triangle',
    description: 'Identify Vega, the brightest corner of the Summer Triangle.',
    target_star: 'Vega',
    target_constellation: 'Lyra',
    icon: '🔺',
    difficulty: 'hard',
    points: 500,
    hint: 'A giant triangle overhead in summer evenings. Vega is the brightest.',
    participants: 698,
  },
];

const PROGRESS_KEY = 'youneek_hunt_progress';
const ACTIVE_HUNT_KEY = 'youneekmeteor_active_hunt';
const PLAYER_KEY = 'youneek_player_name';

export function getPlayerName() {
  return localStorage.getItem(PLAYER_KEY) || 'Sky Explorer';
}

export function setPlayerName(name) {
  localStorage.setItem(PLAYER_KEY, name.trim());
}

export function getLocalHuntProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveLocalHuntProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export function getActiveHuntTarget() {
  return localStorage.getItem(ACTIVE_HUNT_KEY);
}

export function setActiveHuntTarget(targetStar) {
  if (targetStar) {
    localStorage.setItem(ACTIVE_HUNT_KEY, targetStar);
  } else {
    localStorage.removeItem(ACTIVE_HUNT_KEY);
  }
}

export function isHuntCompleted(huntId, progress = getLocalHuntProgress()) {
  return Boolean(progress[huntId]?.completed_at);
}

export function getCompletedHuntIds(progress = getLocalHuntProgress()) {
  return Object.keys(progress).filter((id) => progress[id]?.completed_at);
}

export function getTotalPoints(progress = getLocalHuntProgress()) {
  return getCompletedHuntIds(progress).reduce((sum, id) => {
    const hunt = HUNTS.find((h) => h.id === id);
    return sum + (hunt?.points || 0);
  }, 0);
}

export function findHuntByTargetStar(starName) {
  if (!starName) return null;
  const normalized = starName.toLowerCase();
  return HUNTS.find((h) => h.target_star.toLowerCase() === normalized) || null;
}

export async function completeHunt(huntId) {
  const hunt = HUNTS.find((h) => h.id === huntId);
  if (!hunt) return null;

  const progress = getLocalHuntProgress();
  if (progress[huntId]?.completed_at) {
    return progress[huntId];
  }

  const entry = {
    hunt_id: huntId,
    completed_at: new Date().toISOString(),
    points: hunt.points,
  };

  progress[huntId] = entry;
  saveLocalHuntProgress(progress);

  const playerName = getPlayerName();
  try {
    await api.hunts.complete({
      hunt_id: huntId,
      player_name: playerName,
      points: hunt.points,
    });
  } catch {
    // Local progress is saved; sync when API is available
  }

  if (getActiveHuntTarget()?.toLowerCase() === hunt.target_star.toLowerCase()) {
    setActiveHuntTarget(null);
  }

  return entry;
}

export function starMatchesHuntTarget(star, targetName) {
  if (!star || !targetName) return false;
  return star.name?.toLowerCase() === targetName.toLowerCase();
}

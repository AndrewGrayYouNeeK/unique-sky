import { api } from '@/api/apiClient';
import { HUNTS } from './huntCatalog';
export { HUNTS };

const progressKey = () => `youneek_hunt_progress_${new Date().toISOString().slice(0, 10)}`;
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
    const progress = JSON.parse(localStorage.getItem(progressKey()) || '{}');
    const today = new Date().toISOString().slice(0, 10);
    return Object.fromEntries(Object.entries(progress).filter(([, entry]) => entry?.hunt_day === today));
  } catch {
    return {};
  }
}

export function saveLocalHuntProgress(progress) {
  localStorage.setItem(progressKey(), JSON.stringify(progress));
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
  return HUNTS.filter(hunt => progress[hunt.id]?.completed_at).map(hunt => hunt.id);
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

export async function syncHuntProgress() {
  const completions = await api.hunts.getCompletions();
  const progress = Object.fromEntries(completions.map(entry => [entry.hunt_id, entry]));
  saveLocalHuntProgress(progress);
  return progress;
}

export async function completeHunt(huntId) {
  const hunt = HUNTS.find(h => h.id === huntId);
  if (!hunt) return null;
  const result = await api.hunts.complete({
    hunt_id: huntId,
    target_star: hunt.target_star,
    player_name: getPlayerName(),
  });
  const progress = getLocalHuntProgress();
  progress[huntId] = result.completion;
  saveLocalHuntProgress(progress);
  if (getActiveHuntTarget()?.toLowerCase() === hunt.target_star.toLowerCase()) setActiveHuntTarget(null);
  return result.completion;
}

export function starMatchesHuntTarget(star, targetName) {
  if (!star || !targetName) return false;
  return star.name?.toLowerCase() === targetName.toLowerCase();
}

// Offline claim queue — localStorage backed
// Winner = earliest valid timestamp on reconnect
const QUEUE_KEY = 'uniquesky_offline_claims';

export function queueClaim(claimData) {
  const queue = getQueue();
  const entry = {
    ...claimData,
    queued_at: new Date().toISOString(),
    id: `${claimData.star_id}_${Date.now()}`,
    status: 'pending',
  };
  queue.push(entry);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return entry;
}

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function removeFromQueue(id) {
  const queue = getQueue().filter(e => e.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function hasPendingClaims() {
  return getQueue().length > 0;
}

// Returns true if online
export function isOnline() {
  return navigator.onLine;
}

// Listen for reconnect and flush queue
export function setupQueueFlusher(onFlush) {
  const handleOnline = () => {
    const queue = getQueue();
    if (queue.length > 0) {
      onFlush(queue);
    }
  };
  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}
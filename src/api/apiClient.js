const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// Establish the private browser session before parallel page requests. Otherwise
// first-load responses could each set a different cookie and split progress.
let sessionReady;
async function config() {
  if (!sessionReady) {
    sessionReady = fetch(`${API_BASE}/config`, { credentials: 'same-origin' })
      .then(async res => {
        if (!res.ok) throw new Error('API unavailable');
        return res.json();
      }).catch(error => { sessionReady = undefined; throw error; });
  }
  return sessionReady;
}

/** @param {string} path @param {RequestInit} [options] */
async function request(path, options = {}) {
  await config();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  return data;
}

export const api = {
  config,
  profile: {
    get: () => request('/profile'),
    update: (name) => request('/profile', { method: 'POST', body: JSON.stringify({ name }) }),
  },
  stars: {
    /** @param {{isNamed?: boolean, sort?: string, limit?: number}} [options] */
    list({ isNamed, sort, limit } = {}) {
      const params = new URLSearchParams();
      if (isNamed) params.set('is_named', 'true');
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      return request(`/stars?${params}`);
    },
    claim: payload => request('/stars/claim', { method: 'POST', body: JSON.stringify(payload) }),
  },
  hunts: {
    getCompletions: () => request('/hunts/completions'),
    complete: payload => request('/hunts/complete', { method: 'POST', body: JSON.stringify(payload) }),
  },
  leaderboard: () => request('/leaderboard'),
};
export const claimStar = payload => api.stars.claim(payload);
export const getNamedStars = (options = {}) => api.stars.list({ ...options, isNamed: true });

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  stars: {
    list({ isNamed, sort, limit } = {}) {
      const params = new URLSearchParams();
      if (isNamed) params.set('is_named', 'true');
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      return request(`/stars${qs ? `?${qs}` : ''}`);
    },

    claim(payload) {
      return request('/stars/claim', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  hunts: {
    getCompletions() {
      return request('/hunts/completions');
    },

    complete(payload) {
      return request('/hunts/complete', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  leaderboard() {
    return request('/leaderboard');
  },
};

export async function claimStar(payload) {
  return api.stars.claim(payload);
}

export async function getNamedStars(options) {
  return api.stars.list({ isNamed: true, ...options });
}

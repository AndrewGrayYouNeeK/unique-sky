import { useCallback, useEffect, useState } from 'react';
import { getNamedStars } from '@/api/apiClient';

// Claims are global and the API is uncached (no-store), so a short poll plus a
// refresh whenever the tab/app regains focus shows new edition names promptly.
export const NAMED_STARS_REFRESH_MS = 30000;

export default function useNamedStars() {
  const [named, setNamed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(() => getNamedStars()
    .then(stars => { setNamed(stars); setError(''); })
    .catch(err => setError(err.message))
    .finally(() => setLoading(false)), []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') refresh(); }, NAMED_STARS_REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  return { named, loading, error, refresh };
}

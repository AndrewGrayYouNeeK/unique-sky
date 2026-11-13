// YouNeeK Stars service worker: caches the static star catalog (Tier 0 + any Tier 1 tiles
// already viewed) so the sky still renders offline. It only handles /catalog/ requests;
// the app shell and /api are always fetched from the network.
const CATALOG_CACHE = 'youneek-catalog-hyg41-v1';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CATALOG_CACHE).then(cache => cache.addAll(['/catalog/manifest.json', '/catalog/hyg41/t0.json'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('youneek-catalog-') && k !== CATALOG_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/catalog/')) return;
  event.respondWith(caches.open(CATALOG_CACHE).then(async cache => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) cache.put(event.request, response.clone());
    return response;
  }));
});

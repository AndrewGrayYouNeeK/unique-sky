import assert from 'node:assert/strict';

// Run while `npm run preview` (or `npm run dev`) is running. Loopback only.
const base = 'http://localhost:3001';
for (const path of ['/', '/name-a-star', '/hunts', '/star-map', '/profile']) {
  const response = await fetch(base + path, { headers: { Accept: 'text/html' } });
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get('content-type'), /text\/html/, path);
  const html = await response.text();
  assert.match(html, /id="root"/, path);
  const asset = html.match(/src="(\/assets\/[^\"]+\.js)"/)?.[1];
  assert.ok(asset, `${path}: missing built JS asset`);
  assert.equal((await fetch(base + asset)).status, 200, asset);
  console.log(`PASS SPA deep link + built asset: ${path}`);
}
for (const [path, status] of [['/api/health', 200], ['/api/config', 200], ['/api/stars', 200], ['/api/missing', 404], ['/api', 404]]) {
  const response = await fetch(base + path, { headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' } });
  assert.equal(response.status, status, path);
  assert.match(response.headers.get('content-type'), /application\/json/, path);
  await response.json();
  console.log(`PASS JSON API (including navigation requests): ${path}`);
}

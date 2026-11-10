// SSR render smoke tests (no desktop/browser automation). Real mobile permission
// and touch behavior still need a phone check before public launch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';

test('all five product pages and the not-found page render under declarative routing', async () => {
  const output = resolve(`tests/.render-${process.pid}.mjs`);
  const bundled = await build({
    stdin: { contents: 'export { AppRoutes } from "./src/App.jsx"; export { AuthProvider } from "./src/lib/AuthContext.jsx";', resolveDir: process.cwd(), loader: 'jsx' },
    bundle: true, platform: 'node', packages: 'external', format: 'esm', jsx: 'automatic', write: false,
    define: { 'import.meta.env': '{"VITE_API_URL":"/api"}' },
  });
  await writeFile(output, bundled.outputFiles[0].text);
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null };
  try {
    const { AppRoutes, AuthProvider } = await import(pathToFileURL(output).href);
    for (const [path, heading] of [['/', 'YouneeK Stars'], ['/name-a-star', 'Name a Star'], ['/hunts', 'Daily Hunts'], ['/star-map', 'Star Map'], ['/profile', 'Your Universe'], ['/claim?star=hip:32349', 'animate-spin'], ['/claim/success?session_id=cs_test_1', 'Confirming your payment'], ['/unknown', 'Page Not Found']]) {
      const markup = renderToString(React.createElement(StaticRouter, { location: path }, React.createElement(AuthProvider, null, React.createElement(AppRoutes))));
      // NameAStar deliberately waits for authoritative availability before rendering.
      assert.ok(markup.includes(path === '/name-a-star' ? 'animate-spin' : heading), `${path} failed to render`);
    }
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
    await unlink(output);
  }
});

test('real name first, edition badge after it; claim button only for free, claimable stars', async () => {
  const output = resolve(`tests/.render-ui-${process.pid}.mjs`);
  const bundled = await build({
    stdin: { contents: 'export { default as StarDetailModal } from "./src/components/sky/StarDetailModal.jsx"; export { default as StarName } from "./src/components/claims/StarName.jsx"; export * from "./src/lib/dedication.js";', resolveDir: process.cwd(), loader: 'jsx' },
    bundle: true, platform: 'node', packages: 'external', format: 'esm', jsx: 'automatic', write: false,
    alias: { '@': resolve('src') },
  });
  await writeFile(output, bundled.outputFiles[0].text);
  try {
    const { StarDetailModal, StarName, starLabel, DISCLAIMER } = await import(pathToFileURL(output).href);
    assert.equal(starLabel('Sirius', 'Alex'), 'Sirius ★ Named by Alex – “Forever”');
    assert.equal(DISCLAIMER, 'Star naming is symbolic only and is not recognized by the IAU or any official astronomical body.');
    const text = html => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'");
    assert.equal(text(renderToString(React.createElement(StarName, { name: 'Sirius', owner: 'Alex' }))), 'Sirius ★ Named by Alex – “Forever”');
    const sirius = { id: 'sirius', name: 'Sirius', constellation: 'Canis Major', magnitude: -1.46, distance_ly: 8.6, spectral: 'A1V', color: 'blue' };
    const owned = text(renderToString(React.createElement(StarDetailModal, { star: { ...sirius, is_named: true, owner_name: 'Alex', claimable: true }, onClose() {}, onBuyName() {} })));
    assert.ok(owned.indexOf('Sirius') < owned.indexOf('Named by Alex'), 'real name must come first');
    assert.ok(!owned.includes('Name This Star'), 'no claim button on a named star');
    assert.ok(owned.includes(DISCLAIMER));
    const free = text(renderToString(React.createElement(StarDetailModal, { star: { ...sirius, claimable: true }, onClose() {}, onBuyName() {} })));
    assert.ok(free.includes('Name This Star'));
    assert.ok(!free.includes('Named by'));
    const planet = text(renderToString(React.createElement(StarDetailModal, { star: { ...sirius, name: 'Venus', claimable: false }, onClose() {}, onBuyName() {} })));
    assert.ok(!planet.includes('Name This Star'));
  } finally { await unlink(output); }
});

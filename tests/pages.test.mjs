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
    for (const [path, heading] of [['/', 'YouneeK Stars'], ['/name-a-star', 'Name a Star'], ['/hunts', 'Daily Hunts'], ['/star-map', 'Star Map'], ['/profile', 'Your Universe'], ['/unknown', 'Page Not Found']]) {
      const markup = renderToString(React.createElement(StaticRouter, { location: path }, React.createElement(AuthProvider, null, React.createElement(AppRoutes))));
      // NameAStar deliberately waits for authoritative availability before rendering.
      assert.ok(path === '/name-a-star' ? markup.includes('animate-spin') : markup.includes(heading), `${path} failed to render`);
    }
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
    await unlink(output);
  }
});

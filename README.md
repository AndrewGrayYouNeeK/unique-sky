# YouneeK Stars

An AR star-naming app with sky exploration, daily hunts, and a global star map.

## Features

- **AR Sky View** — Pan the night sky with touch or device orientation
- **Name a Star** — Claim stars with symbolic ownership ($10 base / $20 premium)
- **Daily Hunts** — Complete sky challenges and earn points
- **Star Map** — Browse the celestial catalog with claimed stars highlighted
- **Profile** — Track your stars, hunt progress, and leaderboard rank

**Paid claims are not live yet.** The original Express endpoint marked purchases
“completed” without processing a payment. This rebuild does not pretend to charge
money. Public claims fail closed until a payment provider and verified-payment
flow are approved and implemented. Local development has an explicitly unpaid
demo so the claim → sky/map → profile flow can be tested. Both tiers retain the
README prices; no certificate, narration, refund policy, or extra benefits are
promised.

## Local setup

Use **Node.js 22+** and npm. Wrangler is pinned locally; no global CLI or
Cloudflare login/token is needed for local work.

```bash
npm ci
cp .dev.vars.example .dev.vars  # optional: unpaid demo claims on loopback only
npm run dev
```

Open **http://localhost:5173**. `dev` builds static assets once, applies **local**
D1 migrations, and starts Vite (HMR) plus the Worker API on port 3001. Vite proxies
`/api` to that local Worker. Keep the same hostname (`localhost`, not a mix of
`localhost` and `127.0.0.1`) so the browser profile cookie stays consistent.

Commands for separate terminals, after `npm run build` and
`npm run db:migrate:local`:

```bash
npm run server  # Wrangler Worker + static assets, localhost:3001
npm run client  # Vite, localhost:5173, proxies /api to port 3001
```

To test the **production build** with its real Worker API and SPA deep links:

```bash
npm run preview  # build + local migrations + Worker/static assets on port 3001
```

- `.dev.vars` is ignored and never uploaded. `CLAIM_MODE=demo` enables unpaid
  claims **only** for loopback hostnames; the same flag cannot enable them on
  `stars.youneek.xyz` or another public host.
- Without `.dev.vars`, claims are disabled, including locally.
- All Wrangler development uses `--local`; no binding uses `remote: true`.
- Local D1 state lives under `.wrangler/state/`, survives restarts and repeated
  migrations, and must never be copied into production as customer purchases.
- The default API URL is same-origin `/api`. `VITE_API_URL` is optional and should
  remain same-origin; browser sessions do not support cross-origin API hosting.
- Device orientation is opt-in with **Enable device sky** (required for iOS
  permission gestures). Touch/mouse dragging works without motion permissions.
  Location permission is optional and coordinates remain in the browser. Without
  location the sky is a labeled catalog preview. With location it uses approximate
  sidereal/horizontal coordinates, not navigation-grade alignment. HTTPS is needed
  for device/location APIs outside localhost; test on a real phone before launch.

## Cloudflare architecture (prepared, not deployed)

Target URL: **https://stars.youneek.xyz**
Account: `d74b0de637f4d9d9eb3efb9e13142784`
Proposed Worker: `youneek-stars`

- Vite builds the React app into `dist/`.
- `worker/index.ts` replaces `server/index.js` and implements the `/api` routes
  without Express, CORS middleware, Node filesystem writes, or a separate host.
- Workers static assets serve `dist/`. SPA fallback supports `/name-a-star`,
  `/hunts`, `/star-map`, and `/profile` on refresh. `/api` and `/api/*` run the
  Worker first, so an unknown API path returns JSON 404, not the SPA HTML.
- D1 binding **`STARS_DB`** stores players, unique claims, purchases, and daily
  hunt completions. Migration: `migrations/0001_initial.sql`.
- A unique star primary key and a transactional D1 batch make claim + purchase
  atomic. Conflicting concurrent claims return 409. Catalog coordinates,
  permitted tiers, prices, hunt IDs, and points come from server-controlled data;
  client-supplied prices or points are ignored.
- `server/data.json` is retained as the original empty archival seed. It has no
  claims/purchases/completions to import in this checkout. It is **not** used as a
  writable database or exposed as a static asset. If a separate production copy
  contains records, back it up and review a one-time D1 import and identity mapping
  before launch; do not silently overwrite it or import demo purchases as paid.
- Public star responses contain catalog data and dedication names, not emails,
  private profile identifiers, or purchase records. No email is collected.
- The profile is identified by a random HttpOnly, SameSite browser cookie (Secure
  on HTTPS). Display names are not credentials; matching names cannot see one
  another's claims. Clearing cookies loses access to that browser's profile;
  cross-device accounts/recovery are not implemented or promised.
- Hunts are self-reported by tapping the target, not sensor-verified. Each challenge
  awards points once per browser profile per day. The shared reset is midnight UTC
  (**6 PM CST / 7 PM CDT**); profile totals/rank are all-time and progress is today's.
  Server uniqueness prevents replayed requests from increasing scores. A failed
  completion shows an error and does not silently award local-only points.

### Deployment status

Andrew approved the first deployment on Nov 10, 2026:

1. The D1 database `youneek-stars` (`7f15abe2-47ab-4788-9239-7020ddc1bd7f`) is created
   in the account above and bound as `STARS_DB` in `wrangler.jsonc`.
2. `migrations/0001_initial.sql` is applied with
   `npx wrangler d1 migrations apply youneek-stars --remote`.
3. **Only `stars.youneek.xyz`** is attached as a Worker Custom Domain. Do not edit
   the youneek.xyz apex, youneek.dev, or other sites.
4. Keep `CLAIM_MODE=disabled` publicly until a real payment provider, its secrets,
   signature-verified webhook, idempotency, and fulfillment/refund behavior are
   implemented and reviewed. This is a launch blocker for accepting paid claims,
   not a working checkout.
5. Deploy only from GitHub `main`: `npm run build && npx wrangler deploy`, with
   `CLOUDFLARE_API_TOKEN` from the environment; never print or commit it. Worker
   logs and traces are enabled without recording request bodies, cookies, payment
   details, or secrets.

There is no CI deploy hook. Workers development subdomains and preview URLs are
disabled. New migrations or domain changes need Andrew's approval first.

References: [Worker static assets](https://developers.cloudflare.com/workers/static-assets/),
[D1 transactions/batches](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch),
[Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## Sky catalog (AR Sky View)

The AR Sky View draws a tiered, tiled star catalog built from the
**HYG Database v4.1** by David Nash / astronexus.com
(<https://github.com/astronexus/HYG-Database>), licensed
**[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**. The derived
files in `public/catalog/` are shared under the same license. Attribution is shown
in the app's sky view.

| Tier | Contents | Stars | Files |
| --- | --- | ---: | --- |
| Tier 0 | mag ≤ 6.5 plus every star with a proper name | 9,026 | `hyg41/t0.json`, 626 KB (218 KB gzip) |
| Tier 1 bin 0 | 6.5 < mag ≤ 7.5 | 16,852 | 72 tiles, largest 22 KB |
| Tier 1 bin 1 | 7.5 < mag ≤ 8.5 | 35,985 | 72 tiles, largest 40 KB |
| Tier 1 bin 2 | 8.5 < mag ≤ ~21 | 57,762 | 72 tiles, largest 57 KB |

Total: 119,625 stars, 5.1 MB raw / 2.1 MB gzip across 218 files
(Workers static assets allow 25 MiB per file).

- **Tier 0** ships with the app's static assets and is always loaded. Labels, hunts,
  and the curated claimable stars rely on it.
- **Tier 1** is split by magnitude bin and by 30°×30° RA/Dec tile. A tile is fetched
  only when the zoom's magnitude limit reaches its bin and the tile overlaps the view.
  Fetched tiles stay in memory.
- **Zoom**: pinch, mouse wheel, or the +/- buttons (2°–100° field of view). The
  magnitude limit is `5.5 + 3.5·log10(70°/FOV)`, which gives about 5.5 at 70°, 7.6
  at 17°, and 9.6 at 5°. Stars fade in near the limit, and at most 3,500 catalog
  points are drawn per frame. Labels follow a similar, brighter limit, and
  overlapping labels are skipped.
- **Offline**: `public/sw.js` (production only) caches the manifest and Tier 0 on
  install. Every Tier 1 tile that has been viewed is cached as well.
- **Storage / future tiers**: the manifest format (`youneek-catalog/1`) supports
  more tiled tiers and other tiling schemes, such as HEALPix. A tier can set its own
  `baseUrl`, and a build can set `VITE_CATALOG_TILE_BASE_URL` to serve tiles from
  another origin. Tycho-2 or Gaia tiers with millions of stars would go in an R2
  bucket behind that URL rather than in static assets. **No R2 bucket exists yet.**
  Creating one needs Andrew's approval. The bucket would also need CORS for the app
  origin, and the service worker would need to cache that origin too.
- **Rebuilding**: download `hygdata_v41.csv` (sha256 in the script header) and run
  `node scripts/build-catalog.mjs path/to/hygdata_v41.csv`.

Star identity uses `src/lib/starKey.js` (`gaia:` > `hip:` > `tyc:` > `hd:` > `hr:` >
`hyg:`). See [docs/star-keys.md](docs/star-keys.md) for the planned rekeying of
claims.

## Checks

```bash
npm run build
npm run typecheck  # checks React pages and generates/checks Worker binding types
npm run lint
npm test           # local workerd/D1 integration + server-render smoke tests
npm run smoke:http # with preview/dev running: real static-assets/API/deep-link checks
```

The API tests cover catalog/hunt coverage, cookie privacy, API routing, validation,
server-authoritative pricing/points, concurrent claims, daily replay protection,
profile isolation, public claim gating, and database persistence across restarts. Route-render tests also cover all five
pages and the not-found route. These are not visual browser tests: real-phone
orientation/permission behavior and a visual/accessibility pass remain pre-launch
checks. Unused template dependencies were removed and the remaining dependencies
were patched; `npm audit` is clean.

## Disclaimer

Star naming in YouneeK Stars is symbolic only and is not recognized by the International Astronomical Union or any official astronomical body.

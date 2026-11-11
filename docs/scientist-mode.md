# Scientist Mode

Optional AR Sky overlay for catalog lookup and scientific enrichment. It does
**not** claim to be an official IAU catalog. The in-app disclaimer remains:

> Star naming is symbolic only and is not recognized by the IAU or any official astronomical body.

HYG attribution (CC BY-SA 4.0) is unchanged.

## What landed

| Piece | Where |
| --- | --- |
| Toggle + search dock + detail sheet | `ARSkyView` → `ScientistPanel` / `ScientistDetailCard` (does **not** edit `StarDetailModal`) |
| Local search / merge | `src/lib/scientistCatalog.js` |
| CSV / VOTable / JSON export | `src/lib/scientistExport.js` |
| Gaia / SIMBAD / VizieR links | `src/lib/scientistLinks.js` |
| Client enrichment calls | `src/lib/scientistRemote.js` |
| Same-origin proxies | `GET /api/scientist/gaia`, `GET /api/scientist/simbad` in `worker/scientist.ts` |

`CLAIM_MODE`, checkout, and D1 claim schema are untouched. Tier 2 / R2 tiles are
out of scope; the empty `youneek-stars-tiles` bucket is not bound.

## Local vs live fields

**Always available offline** (bundled HYG Tier 0; Tier 1 when tiles are already
loaded or fetched for a cone — still same-origin static assets, no third-party
network):

- Identifiers: HIP, HD, HR, HYG, Bayer / proper name (Tier 0)
- ICRS RA / Dec (HYG J2000)
- V magnitude, spectral type string, distance (ly)
- Parallax **derived** from HYG distance (`1000 / d_pc`) — labeled as such, not a measured ϖ

**Live only** (Worker → Gaia TAP / SIMBAD; fails soft if offline or rate-limited):

- Gaia DR3 `source_id`, measured parallax + error, proper motion, RUWE, Teff (GSP-Phot), G/BP/RP
- SIMBAD main id / object type (and spectral type when present)

Gaia source IDs are **not** in the HYG tiles. A Gaia-ID search uses the live TAP
proxy; cone / HIP / HD / name search prefers the local index.

## Rate limits & caveats

- Gaia Archive and SIMBAD are third-party services with their own fair-use limits.
  Queries are capped (TOP 5, 12s timeout) and proxied same-origin to avoid CORS.
- Enrichment is best-effort: the detail card always shows local fields first, then
  merges live data or shows a soft “unavailable” note.
- HIP→Gaia uses `gaiadr3.hipparcos2_best_neighbour`; crowded fields may need a
  manual cone check.
- This app is not a substitute for the ESA Gaia Archive, CDS SIMBAD, or VizieR.

## Rebase note (vs `feat/web-checkout-claims`)

Scientist Mode intentionally avoids editing `StarDetailModal.jsx` and
`StarCanvas.jsx`. Overlap with checkout is mostly `ARSkyView.jsx` (toggle +
conditional detail) and a small `worker/index.ts` route hook into
`worker/scientist.ts`.

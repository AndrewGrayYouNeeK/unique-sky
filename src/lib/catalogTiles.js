// Tiled star-catalog format + progressive loader ("youneek-catalog/1").
// Pure ESM with no app imports so node tests and scripts can use it directly.
//
// Tiers:
//   Tier 0  one file, always loaded: bright (mag <= 6.5) + every named star. Used for labels/claims/hunts.
//   Tier 1  fainter stars split by magnitude bin and RA/Dec tile; fetched only when the FOV's
//           magnitude limit reaches the bin and the tile intersects the view.
// Deeper tiers (Tycho-2 / Gaia, millions of stars) can be added as more "tiled" tiers in the
// manifest, optionally with another tiling scheme (e.g. HEALPix) registered in TILING_SCHEMES,
// and optionally served from another origin (R2) via the tier's "baseUrl".

export const RADEC_TILING = { scheme: 'radec', raStep: 30, decStep: 30 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const DEG = Math.PI / 180;

export function tileKeyFor(raDeg, decDeg, tiling = RADEC_TILING) {
  const ra = ((raDeg % 360) + 360) % 360;
  const ri = Math.min(Math.floor(ra / tiling.raStep), Math.round(360 / tiling.raStep) - 1);
  const di = Math.min(Math.floor((clamp(decDeg, -90, 90) + 90) / tiling.decStep), Math.round(180 / tiling.decStep) - 1);
  return `r${String(ri).padStart(2, '0')}d${di}`;
}

// All tile keys whose cell intersects a cone of radius `radiusDeg` around (ra, dec).
// Conservative (may include a few extra tiles), never misses one.
export function tilesForCone(raDeg, decDeg, radiusDeg, tiling = RADEC_TILING) {
  const nRa = Math.round(360 / tiling.raStep);
  const nDec = Math.round(180 / tiling.decStep);
  const decLo = decDeg - radiusDeg;
  const decHi = decDeg + radiusDeg;
  const keys = [];
  const nearPole = decHi >= 90 || decLo <= -90 || radiusDeg >= 90;
  const maxAbsDec = Math.min(89.9, Math.max(Math.abs(decLo), Math.abs(decHi)));
  const raHalf = nearPole ? 180 : Math.min(180, radiusDeg / Math.cos(maxAbsDec * DEG));
  for (let di = 0; di < nDec; di++) {
    const cellLo = -90 + di * tiling.decStep;
    const cellHi = cellLo + tiling.decStep;
    if (cellHi < decLo || cellLo > decHi) continue;
    for (let ri = 0; ri < nRa; ri++) {
      if (raHalf < 180) {
        const cellCenter = ri * tiling.raStep + tiling.raStep / 2;
        let d = Math.abs(((cellCenter - raDeg) % 360 + 540) % 360 - 180);
        if (d > raHalf + tiling.raStep / 2) continue;
      }
      keys.push(`r${String(ri).padStart(2, '0')}d${di}`);
    }
  }
  return keys;
}

export const TILING_SCHEMES = { radec: { tilesForCone } };

// Faintest magnitude drawn for a given field of view (degrees across the long screen axis).
// ~5.5 at the default 70° view (keeps mobile light), each 2x zoom adds ~1 magnitude.
export const MIN_FOV = 2;
export const MAX_FOV = 100;
export const DEFAULT_FOV = 70;
export function magnitudeLimitForFov(fov) {
  const f = clamp(fov, MIN_FOV, MAX_FOV);
  return clamp(5.5 + 3.5 * Math.log10(DEFAULT_FOV / f), 4.5, 10.5);
}
// Faintest magnitude that gets a text label (named/owned/hunt/selected stars are always eligible).
export function labelMagnitudeForFov(fov) {
  return magnitudeLimitForFov(fov) - 3.5;
}
// Smooth fade-in: stars within FADE_BAND of the limit ramp from 0 to full opacity.
export const FADE_BAND = 0.75;
export function fadeForMagnitude(mag, limit) {
  return clamp((limit - mag) / FADE_BAND, 0, 1);
}
// Coarse brightness level used for styling (0 brightest .. 3 faint).
export function magnitudeLevel(mag) {
  return mag <= 3 ? 0 : mag <= 4.5 ? 1 : mag <= 6 ? 2 : 3;
}

export function binsForLimit(bins, limit) {
  return bins.filter(b => b.magMin < limit);
}

// Decode a columnar file into typed arrays with precomputed J2000 unit vectors.
export function decodeColumnar(file, scale, nullCi = -999) {
  const { n, cols } = file;
  const x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n);
  const ra = new Float32Array(n), dec = new Float32Array(n), mag = new Float32Array(n), ci = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = cols.ra[i] / scale.ra, d = cols.dec[i] / scale.dec;
    ra[i] = r; dec[i] = d;
    const cd = Math.cos(d * DEG);
    x[i] = cd * Math.cos(r * DEG); y[i] = cd * Math.sin(r * DEG); z[i] = Math.sin(d * DEG);
    mag[i] = cols.mag[i] / scale.mag;
    ci[i] = cols.ci[i] === nullCi ? NaN : cols.ci[i] / scale.ci;
  }
  return {
    n, x, y, z, ra, dec, mag, ci,
    hip: Int32Array.from(cols.hip), hd: Int32Array.from(cols.hd), hyg: Int32Array.from(cols.hyg),
    distLy: Float32Array.from(cols.distLy, v => v / scale.distLy),
    hr: cols.hr ? Int32Array.from(cols.hr) : null,
    proper: cols.proper || null, bayer: cols.bayer || null, flam: cols.flam || null, con: cols.con || null, spect: cols.spect || null,
  };
}

export function createCatalogLoader({ baseUrl = '/catalog/', fetchImpl = (url) => globalThis.fetch(url) } = {}) {
  let manifest = null;
  let tier0 = null;
  const tiles = new Map();      // `${tier}/${bin}/${tile}` -> decoded tile
  const inflight = new Map();   // same key -> promise
  const failed = new Set();
  let version = 0;              // bumps whenever new data arrives (render loop can watch it)
  const getJson = async url => {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`catalog ${url}: HTTP ${res.status}`);
    return res.json();
  };
  const tierBase = tier => tier.baseUrl || baseUrl;

  let manifestPromise = null;
  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = getJson(`${baseUrl}manifest.json`).then(m => { manifest = m; return m; });
      manifestPromise.catch(() => { manifestPromise = null; });
    }
    return manifestPromise;
  }
  let tier0Promise = null;
  function loadTier0() {
    if (!tier0Promise) {
      tier0Promise = loadManifest().then(async m => {
        const t = m.tiers.find(t => t.id === 0);
        tier0 = decodeColumnar(await getJson(`${tierBase(t)}${t.url}`), m.scale, m.nullCi);
        version++;
        return tier0;
      });
      tier0Promise.catch(() => { tier0Promise = null; });
    }
    return tier0Promise;
  }
  // Fetch every tile needed for the view; resolves with the list of keys requested.
  // Already-cached tiles are not refetched; concurrent calls share in-flight requests.
  async function ensureView({ ra, dec, radius, limit }) {
    const m = await loadManifest();
    const wanted = [];
    for (const tier of m.tiers) {
      if (tier.kind !== 'tiled') continue;
      const scheme = TILING_SCHEMES[tier.tiling.scheme];
      if (!scheme) continue;
      const cone = scheme.tilesForCone(ra, dec, radius, tier.tiling);
      for (const bin of binsForLimit(tier.bins, limit)) {
        for (const tile of cone) {
          if (!bin.tiles[tile]) continue;
          const key = `${tier.id}/${bin.id}/${tile}`;
          wanted.push(key);
          if (tiles.has(key) || inflight.has(key) || failed.has(key)) continue;
          const url = `${tierBase(tier)}${tier.urlTemplate.replace('{bin}', bin.id).replace('{tile}', tile)}`;
          const p = getJson(url)
            .then(file => { tiles.set(key, { ...decodeColumnar(file, m.scale, m.nullCi), magMin: bin.magMin }); version++; })
            .catch(() => { failed.add(key); setTimeout(() => failed.delete(key), 30000); })
            .finally(() => inflight.delete(key));
          inflight.set(key, p);
        }
      }
    }
    await Promise.all(wanted.map(k => inflight.get(k)).filter(Boolean));
    return wanted;
  }
  return {
    loadManifest, loadTier0, ensureView,
    get tier0() { return tier0; },
    get manifest() { return manifest; },
    get version() { return version; },
    loadedTiles: () => tiles,
    hasTile: key => tiles.has(key),
  };
}

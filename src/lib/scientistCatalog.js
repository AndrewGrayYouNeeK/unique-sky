// Local Scientist Mode lookup over the bundled HYG Tier 0 / Tier 1 catalog.
// Standalone (no React) so node tests can import it directly.
// Offline-capable: basic ID / name / cone / magnitude / derived-parallax search
// never requires the network once Tier 0 (and any needed Tier 1 tiles) are loaded.

import { starKey } from './starKey.js';
import { tilesForCone, RADEC_TILING } from './catalogTiles.js';

export const PC_TO_LY = 3.26156;
const DEG = Math.PI / 180;

/** Parallax in milliarcseconds from HYG distance (ly). Approximate; not a measured plx. */
export function parallaxMasFromDistLy(distLy) {
  if (distLy == null || !(distLy > 0)) return null;
  return 1000 / (distLy / PC_TO_LY);
}

export function angularSeparationDeg(ra1, dec1, ra2, dec2) {
  const a1 = ra1 * DEG, d1 = dec1 * DEG, a2 = ra2 * DEG, d2 = dec2 * DEG;
  const cos = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(a1 - a2);
  return Math.acos(Math.max(-1, Math.min(1, cos))) / DEG;
}

/** Normalize free-text / structured query fields for local search. */
export function parseScientistQuery(input = {}) {
  const out = {
    text: (input.text || '').trim(),
    gaia: null,
    hip: null,
    hd: null,
    hr: null,
    hyg: null,
    name: (input.name || '').trim().toLowerCase() || null,
    ra: numOrNull(input.ra),
    dec: numOrNull(input.dec),
    radiusDeg: numOrNull(input.radiusDeg) ?? numOrNull(input.radius) ?? null,
    magMin: numOrNull(input.magMin),
    magMax: numOrNull(input.magMax),
    plxMin: numOrNull(input.plxMin),
    plxMax: numOrNull(input.plxMax),
    limit: Math.min(Math.max(1, Math.floor(numOrNull(input.limit) || 50)), 500),
  };

  // Structured id fields win over free text.
  out.gaia = strId(input.gaia);
  out.hip = positiveInt(input.hip);
  out.hd = positiveInt(input.hd);
  out.hr = positiveInt(input.hr);
  out.hyg = positiveInt(input.hyg);

  if (!out.gaia && !out.hip && !out.hd && !out.hr && !out.hyg && !out.name && out.text) {
    const t = out.text;
    const gaia = /^(?:gaia[:\s]*)?(\d{8,})$/i.exec(t);
    const hip = /^(?:hip[:\s]*)(\d+)$/i.exec(t) || /^hip\s*(\d+)$/i.exec(t);
    const hd = /^(?:hd[:\s]*)(\d+)$/i.exec(t);
    const hr = /^(?:hr[:\s]*)(\d+)$/i.exec(t);
    const hyg = /^(?:hyg[:\s]*)(\d+)$/i.exec(t);
    const key = /^(gaia|hip|hd|hr|hyg):(.+)$/i.exec(t);
    if (key) {
      const cat = key[1].toLowerCase();
      if (cat === 'gaia') out.gaia = key[2];
      else if (cat === 'hip') out.hip = positiveInt(key[2]);
      else if (cat === 'hd') out.hd = positiveInt(key[2]);
      else if (cat === 'hr') out.hr = positiveInt(key[2]);
      else if (cat === 'hyg') out.hyg = positiveInt(key[2]);
    } else if (gaia) out.gaia = gaia[1];
    else if (hip) out.hip = positiveInt(hip[1]);
    else if (hd) out.hd = positiveInt(hd[1]);
    else if (hr) out.hr = positiveInt(hr[1]);
    else if (hyg) out.hyg = positiveInt(hyg[1]);
    else out.name = t.toLowerCase();
  }
  return out;
}

/**
 * Build a Scientist Mode record from a decoded catalog tile row.
 * Local fields only — proper motion / Teff / RUWE / measured parallax come from live queries.
 */
export function tileRowToScientistRecord(tile, i, { source = 'local-hyg41-tier0' } = {}) {
  const hip = tile.hip[i] || null;
  const hd = tile.hd[i] || null;
  const hr = tile.hr?.[i] || null;
  const hyg = tile.hyg[i];
  const ids = { hip, hd, hr, hyg };
  const proper = tile.proper?.[i] || '';
  const bayer = tile.bayer?.[i] || '';
  const spect = tile.spect?.[i] || null;
  const distLy = tile.distLy[i] || null;
  const plx = parallaxMasFromDistLy(distLy);
  const key = starKey(ids);
  const name = proper || bayer || (hip ? `HIP ${hip}` : hd ? `HD ${hd}` : `HYG ${hyg}`);
  return {
    id: key,
    star_key: key,
    hip, hd, hr, hyg,
    gaia_source_id: null,
    tycho: null,
    name,
    iau_name: proper || null,
    bayer: bayer || null,
    flamsteed: tile.flam?.[i] ? `${tile.flam[i]} ${tile.con[i]}` : null,
    constellation: tile.con?.[i] || '',
    ra: tile.ra[i],
    dec: tile.dec[i],
    ra_icrs: tile.ra[i],
    dec_icrs: tile.dec[i],
    magnitude: Math.round(tile.mag[i] * 100) / 100,
    mag_v: Math.round(tile.mag[i] * 100) / 100,
    distance_ly: distLy ? Math.round(distLy) : null,
    spectral: spect,
    spectral_type: spect,
    teff: null,
    parallax_mas: plx == null ? null : Math.round(plx * 1000) / 1000,
    parallax_error_mas: null,
    pmra_mas_yr: null,
    pmdec_mas_yr: null,
    ruwe: null,
    claimable: false,
    provenance: {
      local: {
        catalog: 'HYG Database v4.1',
        license: 'CC BY-SA 4.0',
        source,
        fields: {
          ra_icrs: 'HYG',
          dec_icrs: 'HYG',
          mag_v: 'HYG',
          spectral_type: spect ? 'HYG' : null,
          parallax_mas: plx != null ? 'derived-from-hyg-distance' : null,
          distance_ly: distLy ? 'HYG' : null,
        },
      },
      remote: null,
    },
  };
}

/** Index Tier 0 for O(1) id / name lookups. */
export function buildLocalIndex(tile, source = 'local-hyg41-tier0') {
  const byHip = new Map();
  const byHd = new Map();
  const byHr = new Map();
  const byHyg = new Map();
  const byName = new Map(); // lowercased proper / bayer → indices
  const records = [];
  for (let i = 0; i < tile.n; i++) {
    const rec = tileRowToScientistRecord(tile, i, { source });
    records.push(rec);
    if (rec.hip) byHip.set(rec.hip, i);
    if (rec.hd) byHd.set(rec.hd, i);
    if (rec.hr) byHr.set(rec.hr, i);
    if (rec.hyg) byHyg.set(rec.hyg, i);
    if (rec.iau_name) {
      const k = rec.iau_name.toLowerCase();
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k).push(i);
    }
    if (rec.bayer) {
      const k = rec.bayer.toLowerCase();
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k).push(i);
    }
  }
  return { tile, records, byHip, byHd, byHr, byHyg, byName, source };
}

function matchesFilters(rec, q) {
  if (q.magMin != null && !(rec.mag_v >= q.magMin)) return false;
  if (q.magMax != null && !(rec.mag_v <= q.magMax)) return false;
  if (q.plxMin != null && (rec.parallax_mas == null || !(rec.parallax_mas >= q.plxMin))) return false;
  if (q.plxMax != null && (rec.parallax_mas == null || !(rec.parallax_mas <= q.plxMax))) return false;
  if (q.ra != null && q.dec != null && q.radiusDeg != null) {
    if (angularSeparationDeg(q.ra, q.dec, rec.ra_icrs, rec.dec_icrs) > q.radiusDeg) return false;
  }
  return true;
}

/**
 * Search a built local index (Tier 0) and optionally additional decoded tiles (Tier 1).
 * Gaia IDs are not present in HYG; returns empty for gaia-only queries (caller may use live TAP).
 */
export function searchLocalCatalog(index, query = {}, extraTiles = []) {
  const q = parseScientistQuery(query);
  if (q.gaia && !q.hip && !q.hd && !q.hr && !q.hyg && !q.name && q.ra == null) {
    return { results: [], query: q, note: 'Local HYG catalog has no Gaia source IDs; use a live Gaia TAP lookup.' };
  }

  /** @type {Map<string, object>} */
  const hit = new Map();
  const take = (rec) => {
    if (!rec || !matchesFilters(rec, q)) return;
    const k = rec.star_key || `${rec.hyg}`;
    if (!hit.has(k)) hit.set(k, rec);
  };

  const idLookup = () => {
    if (q.hip && index.byHip.has(q.hip)) take(index.records[index.byHip.get(q.hip)]);
    if (q.hd && index.byHd.has(q.hd)) take(index.records[index.byHd.get(q.hd)]);
    if (q.hr && index.byHr.has(q.hr)) take(index.records[index.byHr.get(q.hr)]);
    if (q.hyg && index.byHyg.has(q.hyg)) take(index.records[index.byHyg.get(q.hyg)]);
    if (q.name) {
      const exact = index.byName.get(q.name) || [];
      for (const i of exact) take(index.records[i]);
      if (exact.length === 0) {
        for (const rec of index.records) {
          if (rec.iau_name?.toLowerCase().includes(q.name) || rec.bayer?.toLowerCase().includes(q.name)) take(rec);
        }
      }
    }
  };

  const hasIdOrName = q.hip || q.hd || q.hr || q.hyg || q.name;
  if (hasIdOrName) idLookup();

  // Cone / magnitude / parallax scan (Tier 0), or full filter scan when no id/name.
  if (!hasIdOrName || q.ra != null || q.magMin != null || q.magMax != null || q.plxMin != null || q.plxMax != null) {
    if (!hasIdOrName) {
      for (const rec of index.records) take(rec);
    }
  }

  // Extra tiles (Tier 1): linear scan — used after ensureView for a cone.
  for (const tile of extraTiles) {
    const source = 'local-hyg41-tier1';
    for (let i = 0; i < tile.n; i++) {
      const rec = tileRowToScientistRecord(tile, i, { source });
      if (q.hip && rec.hip !== q.hip) continue;
      if (q.hd && rec.hd !== q.hd) continue;
      if (q.hr && rec.hr !== q.hr) continue;
      if (q.hyg && rec.hyg !== q.hyg) continue;
      if (q.name) continue; // Tier 1 has no names
      take(rec);
    }
  }

  let results = [...hit.values()];
  if (q.ra != null && q.dec != null) {
    results.sort((a, b) =>
      angularSeparationDeg(q.ra, q.dec, a.ra_icrs, a.dec_icrs) -
      angularSeparationDeg(q.ra, q.dec, b.ra_icrs, b.dec_icrs));
  } else {
    results.sort((a, b) => a.mag_v - b.mag_v);
  }
  results = results.slice(0, q.limit);
  return { results, query: q, note: null };
}

/** Which Tier 1 tiles a cone query needs (for ensureView). */
export function coneTilePlan(ra, dec, radiusDeg, magMax = 10.5, tiling = RADEC_TILING) {
  return {
    ra, dec,
    radius: radiusDeg,
    limit: magMax,
    tiles: tilesForCone(ra, dec, radiusDeg, tiling),
  };
}

/**
 * Merge live Gaia / SIMBAD fields onto a local record. Local ICRS coords stay
 * as HYG unless the remote explicitly provides replacements; provenance tracks both.
 */
export function mergeRemoteScientistData(local, remote = {}) {
  const next = { ...local, provenance: { ...local.provenance, remote: { ...(local.provenance?.remote || {}) } } };
  const remoteProv = next.provenance.remote;

  if (remote.gaia_source_id) {
    next.gaia_source_id = String(remote.gaia_source_id);
    remoteProv.gaia_source_id = remote.gaia_source || 'Gaia DR3';
  }
  for (const [field, meta] of [
    ['ra_icrs', 'ra'],
    ['dec_icrs', 'dec'],
    ['pmra_mas_yr', 'pmra'],
    ['pmdec_mas_yr', 'pmdec'],
    ['parallax_mas', 'parallax'],
    ['parallax_error_mas', 'parallax_error'],
    ['ruwe', 'ruwe'],
    ['teff', 'teff'],
    ['mag_g', 'phot_g_mean_mag'],
    ['mag_bp', 'phot_bp_mean_mag'],
    ['mag_rp', 'phot_rp_mean_mag'],
    ['spectral_type', 'spectral_type'],
  ]) {
    const key = meta;
    if (remote[key] != null && remote[key] !== '') {
      const n = typeof remote[key] === 'number' ? remote[key] : Number(remote[key]);
      next[field] = Number.isFinite(n) && field !== 'spectral_type' ? n : remote[key];
      remoteProv[field] = remote.source || 'remote';
    }
  }
  if (remote.simbad_main_id) {
    next.simbad_main_id = remote.simbad_main_id;
    remoteProv.simbad_main_id = 'SIMBAD';
  }
  if (remote.simbad_otype) {
    next.simbad_otype = remote.simbad_otype;
    remoteProv.simbad_otype = 'SIMBAD';
  }
  if (remote.error) remoteProv.error = remote.error;
  if (remote.unavailable) remoteProv.unavailable = remote.unavailable;
  return next;
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function positiveInt(v) {
  const n = numOrNull(v);
  return n != null && Number.isInteger(n) && n > 0 ? n : null;
}
function strId(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  return s || null;
}

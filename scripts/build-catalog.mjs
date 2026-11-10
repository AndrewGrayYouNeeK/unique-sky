#!/usr/bin/env node
// Build the static, tiled star catalog served from public/catalog/.
//
// Source: HYG Database v4.1 (astronexus/HYG-Database, hyg/CURRENT/hygdata_v41.csv)
//   https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv
//   sha256 d9f69fd86bbf90a4e4d52b4c5c53eacfa6dfc0bfdef85bfd94f095e0bebe4ebd
// License: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
// The derived files in public/catalog/ are shared under the same license.
//
// Usage: node scripts/build-catalog.mjs path/to/hygdata_v41.csv
//
// Output layout (format "youneek-catalog/1"):
//   public/catalog/manifest.json            tiers, bins, tiling scheme, sizes
//   public/catalog/hyg41/t0.json            Tier 0: always loaded, mag <= T0_MAG or named
//   public/catalog/hyg41/t1/b{bin}/{tile}.json  Tier 1: fainter stars by magnitude bin + RA/Dec tile
// Each file is columnar: { n, cols: { ra:[...], dec:[...], ... } } with integer-scaled values
// (see "scale" in the manifest) so it stays small and gzip-friendly.
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tileKeyFor, RADEC_TILING } from '../src/lib/catalogTiles.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public', 'catalog');
const CATALOG = 'hyg41';
const T0_MAG = 6.5;
// Tier 1 magnitude bins (upper bound inclusive). Last bin is open-ended (HYG goes to ~mag 21 for Gliese stars).
const T1_BINS = [
  { id: 0, magMin: T0_MAG, magMax: 7.5 },
  { id: 1, magMin: 7.5, magMax: 8.5 },
  { id: 2, magMin: 8.5, magMax: 99 },
];
const PC_TO_LY = 3.26156;
const GREEK = { alp: 'α', bet: 'β', gam: 'γ', del: 'δ', eps: 'ε', zet: 'ζ', eta: 'η', the: 'θ', iot: 'ι', kap: 'κ', lam: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omi: 'ο', pi: 'π', rho: 'ρ', sig: 'σ', tau: 'τ', ups: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', ome: 'ω' };

function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function bayerLabel(bayer, con) {
  if (!bayer) return '';
  const m = /^([A-Za-z]+)(-?\d*)$/.exec(bayer);
  const g = m && GREEK[m[1].toLowerCase()];
  return `${g ? g + (m[2] ? m[2].replace('-', '') : '') : bayer} ${con}`.trim();
}

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-catalog.mjs hygdata_v41.csv'); process.exit(1); }
const lines = readFileSync(src, 'utf8').split(/\r?\n/).filter(Boolean);
const header = parseCsvLine(lines[0]);
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const num = v => (v === '' || v === undefined ? null : Number(v));

const stars = [];
for (let i = 1; i < lines.length; i++) {
  const r = parseCsvLine(lines[i]);
  const id = Number(r[col.id]);
  if (id === 0) continue; // Sol
  const mag = num(r[col.mag]);
  if (mag === null || Number.isNaN(mag)) continue;
  const dist = num(r[col.dist]);
  stars.push({
    hyg: id,
    hip: num(r[col.hip]) || 0,
    hd: num(r[col.hd]) || 0,
    hr: num(r[col.hr]) || 0,
    ra: num(r[col.ra]) * 15, // hours -> degrees
    dec: num(r[col.dec]),
    mag,
    ci: num(r[col.ci]),
    distLy: dist && dist < 100000 ? dist * PC_TO_LY : 0,
    proper: r[col.proper] || '',
    bayer: r[col.bayer] || '',
    flam: num(r[col.flam]) || 0,
    con: r[col.con] || '',
    spect: r[col.spect] || '',
  });
}
stars.sort((a, b) => a.mag - b.mag);

const q = (v, s) => Math.round(v * s);
const SCALE = { ra: 1000, dec: 1000, mag: 100, ci: 100, distLy: 1 };
function columnar(list, withNames) {
  const cols = { ra: [], dec: [], mag: [], ci: [], distLy: [], hip: [], hd: [], hyg: [] };
  if (withNames) Object.assign(cols, { hr: [], proper: [], bayer: [], flam: [], con: [], spect: [] });
  for (const s of list) {
    cols.ra.push(q(s.ra, SCALE.ra)); cols.dec.push(q(s.dec, SCALE.dec)); cols.mag.push(q(s.mag, SCALE.mag));
    cols.ci.push(s.ci === null ? -999 : q(s.ci, SCALE.ci)); cols.distLy.push(q(s.distLy, SCALE.distLy));
    cols.hip.push(s.hip); cols.hd.push(s.hd); cols.hyg.push(s.hyg);
    if (withNames) { cols.hr.push(s.hr); cols.proper.push(s.proper); cols.bayer.push(bayerLabel(s.bayer, s.con)); cols.flam.push(s.flam); cols.con.push(s.con); cols.spect.push(s.spect); }
  }
  return { n: list.length, cols };
}
const sizeOf = path => { const raw = statSync(path).size; return { bytes: raw, gzip: gzipSync(readFileSync(path)).length }; };

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, CATALOG, 't1'), { recursive: true });

const tier0 = stars.filter(s => s.mag <= T0_MAG || s.proper);
const t0Path = join(OUT, CATALOG, 't0.json');
writeFileSync(t0Path, JSON.stringify(columnar(tier0, true)));
const tier1Stars = stars.filter(s => s.mag > T0_MAG && !s.proper);

const bins = [];
let total = sizeOf(t0Path); const totals = { bytes: total.bytes, gzip: total.gzip };
for (const bin of T1_BINS) {
  const inBin = tier1Stars.filter(s => s.mag > bin.magMin && s.mag <= bin.magMax);
  const byTile = new Map();
  for (const s of inBin) { const k = tileKeyFor(s.ra, s.dec, RADEC_TILING); if (!byTile.has(k)) byTile.set(k, []); byTile.get(k).push(s); }
  const tiles = {};
  mkdirSync(join(OUT, CATALOG, 't1', `b${bin.id}`), { recursive: true });
  for (const [k, list] of [...byTile.entries()].sort()) {
    const p = join(OUT, CATALOG, 't1', `b${bin.id}`, `${k}.json`);
    writeFileSync(p, JSON.stringify(columnar(list, false)));
    const sz = sizeOf(p); totals.bytes += sz.bytes; totals.gzip += sz.gzip;
    tiles[k] = { n: list.length, bytes: sz.bytes };
  }
  bins.push({ ...bin, count: inBin.length, tiles });
}

const manifest = {
  format: 'youneek-catalog/1',
  catalog: CATALOG,
  source: 'HYG Database v4.1 (astronexus.com / github.com/astronexus/HYG-Database)',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  attribution: 'Star data: HYG Database v4.1 by David Nash (astronexus.com), CC BY-SA 4.0. Derived tiles CC BY-SA 4.0.',
  scale: SCALE,
  nullCi: -999,
  tiers: [
    { id: 0, kind: 'all', magMax: T0_MAG, includesNamed: true, url: `${CATALOG}/t0.json`, count: tier0.length, ...sizeOf(t0Path) },
    { id: 1, kind: 'tiled', tiling: RADEC_TILING, urlTemplate: `${CATALOG}/t1/b{bin}/{tile}.json`, bins },
  ],
  totals: { stars: tier0.length + tier1Stars.length, ...totals },
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest));
console.log(JSON.stringify({ tier0: tier0.length, tier0Bytes: manifest.tiers[0].bytes, tier0Gzip: manifest.tiers[0].gzip, bins: bins.map(b => ({ id: b.id, magMin: b.magMin, magMax: b.magMax, count: b.count, tiles: Object.keys(b.tiles).length, maxTileBytes: Math.max(...Object.values(b.tiles).map(t => t.bytes)) })), totals: manifest.totals }, null, 1));

// Same-origin proxies for Gaia TAP + SIMBAD used by Scientist Mode.
// Isolated module so a later rebase onto feat/web-checkout-claims only needs to
// re-wire the two routes — CLAIM_MODE and claim handlers are untouched.

import { parseSimbadAscii } from '../src/lib/scientistSimbad.js';

const GAIA_TAP = 'https://gea.esac.esa.int/tap-server/tap/sync';
const SIMBAD_ID = 'https://simbad.cds.unistra.fr/simbad/sim-id';
const TIMEOUT_MS = 12_000;
const MAX_ROWS = 5;

export type ScientistJson = (value: unknown, status?: number) => Response;

function bad(json: ScientistJson, message: string, status = 400) {
  return json({ ok: false, unavailable: false, error: message }, status);
}

function unavailable(json: ScientistJson, message: string, status = 502) {
  return json({ ok: false, unavailable: true, error: message }, status);
}

function num(v: string | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function positiveInt(v: string | null): number | null {
  const n = num(v);
  return n != null && Number.isInteger(n) && n > 0 ? n : null;
}

/** CSV keeps Gaia source_id as a full digit string (JSON numbers lose precision above 2^53). */
function parseTapCsv(text: string): Record<string, unknown>[] {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const cols = splitCsvLine(lines[0]).map(c => c.replace(/^"|"$/g, ''));
  return lines.slice(1, 1 + MAX_ROWS).map(line => {
    const cells = splitCsvLine(line).map(c => c.replace(/^"|"$/g, ''));
    const row: Record<string, unknown> = {};
    cols.forEach((name, i) => {
      const raw = cells[i] ?? '';
      if (raw === '' || raw.toLowerCase() === 'null') row[name] = null;
      else if (name === 'source_id' || name.endsWith('_id')) row[name] = raw;
      else {
        const n = Number(raw);
        row[name] = Number.isFinite(n) && raw.trim() !== '' ? n : raw;
      }
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function tapQuery(endpoint: string, adql: string, fetchImpl: typeof fetch): Promise<{ rows: Record<string, unknown>[]; raw: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body = new URLSearchParams({
      REQUEST: 'doQuery',
      LANG: 'ADQL',
      FORMAT: 'csv',
      QUERY: adql,
    });
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/csv' },
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`TAP HTTP ${res.status}`);
    return { rows: parseTapCsv(text), raw: text };
  } finally {
    clearTimeout(timer);
  }
}

function gaiaAdql(params: URLSearchParams): string | null {
  const gaia = params.get('gaia')?.trim();
  const hip = positiveInt(params.get('hip'));
  const ra = num(params.get('ra'));
  const dec = num(params.get('dec'));
  const radius = num(params.get('radius')) ?? 0.002; // degrees (~7.2")

  const fields = `source_id, ra, dec, pmra, pmdec, parallax, parallax_error, ruwe,
    phot_g_mean_mag, phot_bp_mean_mag, phot_rp_mean_mag, teff_gspphot`;

  if (gaia && /^\d+$/.test(gaia)) {
    return `SELECT TOP 1 ${fields} FROM gaiadr3.gaia_source WHERE source_id = ${gaia}`;
  }
  if (hip) {
    // hipparcos2_best_neighbour is the recommended Gaia↔HIP crossmatch.
    return `SELECT TOP 1 g.source_id, g.ra, g.dec, g.pmra, g.pmdec, g.parallax, g.parallax_error, g.ruwe,
      g.phot_g_mean_mag, g.phot_bp_mean_mag, g.phot_rp_mean_mag, g.teff_gspphot
      FROM gaiadr3.gaia_source AS g
      JOIN gaiadr3.hipparcos2_best_neighbour AS x ON g.source_id = x.source_id
      WHERE x.original_ext_source_id = ${hip}`;
  }
  if (ra != null && dec != null) {
    const r = Math.min(Math.max(radius, 0.0001), 0.1);
    return `SELECT TOP ${MAX_ROWS} ${fields} FROM gaiadr3.gaia_source
      WHERE 1 = CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${ra}, ${dec}, ${r}))
      ORDER BY DISTANCE(POINT('ICRS', ra, dec), POINT('ICRS', ${ra}, ${dec}))`;
  }
  return null;
}

export async function handleScientistGaia(
  request: Request,
  json: ScientistJson,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== 'GET') return bad(json, 'Use GET', 405);
  const url = new URL(request.url);
  const adql = gaiaAdql(url.searchParams);
  if (!adql) return bad(json, 'Provide gaia=, hip=, or ra=&dec=');
  try {
    const { rows } = await tapQuery(GAIA_TAP, adql, fetchImpl);
    if (!rows.length) return json({ ok: true, found: false, source: 'Gaia DR3 TAP', rows: [] });
    const best = rows[0];
    return json({
      ok: true,
      found: true,
      source: 'Gaia DR3 TAP',
      source_id: best.source_id != null ? String(best.source_id) : null,
      gaia_source_id: best.source_id != null ? String(best.source_id) : null,
      ra: best.ra ?? null,
      dec: best.dec ?? null,
      pmra: best.pmra ?? null,
      pmdec: best.pmdec ?? null,
      parallax: best.parallax ?? null,
      parallax_error: best.parallax_error ?? null,
      ruwe: best.ruwe ?? null,
      teff_gspphot: best.teff_gspphot ?? null,
      teff: best.teff_gspphot ?? null,
      phot_g_mean_mag: best.phot_g_mean_mag ?? null,
      phot_bp_mean_mag: best.phot_bp_mean_mag ?? null,
      phot_rp_mean_mag: best.phot_rp_mean_mag ?? null,
      rows,
      query: adql.replace(/\s+/g, ' ').trim(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gaia TAP unavailable';
    return unavailable(json, message.includes('abort') ? 'Gaia TAP timed out' : message);
  }
}

export async function handleScientistSimbad(
  request: Request,
  json: ScientistJson,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== 'GET') return bad(json, 'Use GET', 405);
  const url = new URL(request.url);
  const id = url.searchParams.get('id')?.trim();
  if (!id || id.length > 120) return bad(json, 'Provide id= (catalog identifier or name)');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const simbadUrl = `${SIMBAD_ID}?Ident=${encodeURIComponent(id)}&output.format=ASCII&nbIdent=1`;
    const res = await fetchImpl(simbadUrl, {
      headers: { Accept: 'text/plain' },
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) return unavailable(json, `SIMBAD HTTP ${res.status}`);
    const parsed = parseSimbadAscii(text);
    if (!parsed) return json({ ok: true, found: false, source: 'SIMBAD', rows: [] });
    return json({
      ok: true,
      found: true,
      source: 'SIMBAD',
      main_id: parsed.main_id,
      simbad_main_id: parsed.main_id,
      otype: parsed.otype,
      simbad_otype: parsed.otype,
      spectral_type: parsed.spectral_type,
      ra: parsed.ra,
      dec: parsed.dec,
      rows: [parsed],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SIMBAD unavailable';
    return unavailable(json, message.includes('abort') ? 'SIMBAD timed out' : message);
  } finally {
    clearTimeout(timer);
  }
}

/** Route dispatcher used by worker/index.ts — returns null if not a scientist route. */
export async function handleScientistRoutes(
  request: Request,
  json: ScientistJson,
  fetchImpl: typeof fetch = fetch,
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === '/api/scientist/gaia') return handleScientistGaia(request, json, fetchImpl);
  if (path === '/api/scientist/simbad') return handleScientistSimbad(request, json, fetchImpl);
  return null;
}

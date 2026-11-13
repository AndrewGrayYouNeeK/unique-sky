// Live Gaia TAP + SIMBAD enrichment via same-origin Worker proxies.
// Fails soft: every function returns { ok:false, unavailable, error } instead of throwing
// when the network / upstream is down. Local catalog lookup does not call this module.

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api';

/**
 * @param {string} path
 * @param {{ fetchImpl?: typeof fetch, signal?: AbortSignal }} [opts]
 */
async function getJson(path, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const res = await fetchImpl(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal: opts.signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      unavailable: true,
      error: data.error || `HTTP ${res.status}`,
      status: res.status,
    };
  }
  return data;
}

/** Resolve Gaia DR3 fields by HIP, Gaia source id, or ICRS cone. */
export async function fetchGaiaEnrichment(query = {}, opts = {}) {
  const params = new URLSearchParams();
  if (query.gaia || query.gaia_source_id) params.set('gaia', String(query.gaia || query.gaia_source_id));
  if (query.hip) params.set('hip', String(query.hip));
  if (query.ra != null && query.dec != null) {
    params.set('ra', String(query.ra));
    params.set('dec', String(query.dec));
    if (query.radiusDeg != null) params.set('radius', String(query.radiusDeg));
  }
  if (!params.toString()) {
    return { ok: false, unavailable: true, error: 'Need gaia, hip, or ra/dec for Gaia lookup' };
  }
  try {
    const data = await getJson(`/scientist/gaia?${params}`, opts);
    if (data.ok === false) return data;
    return { ok: true, source: 'Gaia DR3 TAP', ...data };
  } catch (err) {
    return { ok: false, unavailable: true, error: err.message || 'Gaia TAP unavailable' };
  }
}

/** Resolve SIMBAD identifiers / object type for a catalog id or name. */
export async function fetchSimbadEnrichment(query = {}, opts = {}) {
  const params = new URLSearchParams();
  if (query.id) params.set('id', String(query.id));
  else if (query.hip) params.set('id', `HIP ${query.hip}`);
  else if (query.hd) params.set('id', `HD ${query.hd}`);
  else if (query.hr) params.set('id', `HR ${query.hr}`);
  else if (query.gaia || query.gaia_source_id) params.set('id', `Gaia DR3 ${query.gaia || query.gaia_source_id}`);
  else if (query.name) params.set('id', String(query.name));
  if (!params.get('id')) {
    return { ok: false, unavailable: true, error: 'Need an identifier for SIMBAD lookup' };
  }
  try {
    const data = await getJson(`/scientist/simbad?${params}`, opts);
    if (data.ok === false) return data;
    return { ok: true, source: 'SIMBAD', ...data };
  } catch (err) {
    return { ok: false, unavailable: true, error: err.message || 'SIMBAD unavailable' };
  }
}

/**
 * Parallel Gaia + SIMBAD enrichment. Never throws; partial success is ok.
 * Returns a flat remote bag suitable for mergeRemoteScientistData().
 */
export async function enrichScientistRecord(star = {}, opts = {}) {
  const [gaia, simbad] = await Promise.all([
    fetchGaiaEnrichment({
      gaia: star.gaia_source_id,
      hip: star.hip,
      ra: star.ra_icrs ?? star.ra,
      dec: star.dec_icrs ?? star.dec,
      radiusDeg: 0.002,
    }, opts),
    fetchSimbadEnrichment({
      hip: star.hip,
      hd: star.hd,
      hr: star.hr,
      gaia: star.gaia_source_id,
      name: star.iau_name || star.name,
    }, opts),
  ]);

  const remote = {
    source: [gaia.ok && 'Gaia DR3', simbad.ok && 'SIMBAD'].filter(Boolean).join('+') || 'none',
    unavailable: [],
    error: null,
  };
  if (!gaia.ok) remote.unavailable.push(`gaia:${gaia.error || 'unavailable'}`);
  else Object.assign(remote, {
    gaia_source_id: gaia.source_id ?? gaia.gaia_source_id,
    gaia_source: 'Gaia DR3',
    ra: gaia.ra,
    dec: gaia.dec,
    pmra: gaia.pmra,
    pmdec: gaia.pmdec,
    parallax: gaia.parallax,
    parallax_error: gaia.parallax_error,
    ruwe: gaia.ruwe,
    teff: gaia.teff_gspphot ?? gaia.teff,
    phot_g_mean_mag: gaia.phot_g_mean_mag,
    phot_bp_mean_mag: gaia.phot_bp_mean_mag,
    phot_rp_mean_mag: gaia.phot_rp_mean_mag,
  });
  if (!simbad.ok) remote.unavailable.push(`simbad:${simbad.error || 'unavailable'}`);
  else Object.assign(remote, {
    simbad_main_id: simbad.main_id ?? simbad.simbad_main_id,
    simbad_otype: simbad.otype ?? simbad.simbad_otype,
    spectral_type: simbad.spectral_type || remote.spectral_type,
  });
  if (remote.unavailable.length) remote.error = remote.unavailable.join('; ');
  return remote;
}

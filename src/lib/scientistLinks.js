// External catalog deep-links for a selected Scientist Mode object.
// Prefer the strongest available identifier; fall back to ICRS cone where needed.

export function gaiaArchiveUrl(star = {}) {
  if (star.gaia_source_id) {
    return `https://gea.esac.esa.int/archive/#!datasearch?query=SELECT+*+FROM+gaiadr3.gaia_source+WHERE+source_id=${encodeURIComponent(String(star.gaia_source_id))}&dataRelease=Gaia+DR3`;
  }
  if (star.ra_icrs != null && star.dec_icrs != null) {
    const ra = Number(star.ra_icrs).toFixed(6);
    const dec = Number(star.dec_icrs).toFixed(6);
    return `https://gea.esac.esa.int/archive/`;
  }
  return 'https://gea.esac.esa.int/archive/';
}

/** Compact Gaia source page via Vizier when we only have coordinates / HIP. */
export function gaiaVizierUrl(star = {}) {
  if (star.gaia_source_id) {
    return `https://vizier.cds.unistra.fr/viz-bin/VizieR-5?-ref=VIZ&-out.add=.&-source=I/355/gaiadr3&Source=${encodeURIComponent(String(star.gaia_source_id))}`;
  }
  if (star.hip) {
    return `https://vizier.cds.unistra.fr/viz-bin/VizieR-4?-source=I/355/gaiadr3&-out.max=10&HIP=${encodeURIComponent(String(star.hip))}`;
  }
  if (star.ra_icrs != null && star.dec_icrs != null) {
    return `https://vizier.cds.unistra.fr/viz-bin/VizieR-4?-source=I/355/gaiadr3&-c=${encodeURIComponent(`${star.ra_icrs} ${star.dec_icrs}`)}&-c.rm=5&-out.max=10`;
  }
  return 'https://vizier.cds.unistra.fr/viz-bin/VizieR';
}

export function simbadUrl(star = {}) {
  const ident = simbadIdent(star);
  if (ident) return `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(ident)}`;
  if (star.ra_icrs != null && star.dec_icrs != null) {
    return `https://simbad.cds.unistra.fr/simbad/sim-coo?Coord=${encodeURIComponent(`${star.ra_icrs} ${star.dec_icrs}`)}&Radius=5&Radius.unit=arcsec`;
  }
  return 'https://simbad.cds.unistra.fr/simbad/';
}

export function vizierUrl(star = {}) {
  if (star.hip) {
    return `https://vizier.cds.unistra.fr/viz-bin/VizieR-4?-source=I/239/hip_main&HIP=${encodeURIComponent(String(star.hip))}`;
  }
  if (star.hd) {
    return `https://vizier.cds.unistra.fr/viz-bin/VizieR-4?-source=III/135A/catalog&HD=${encodeURIComponent(String(star.hd))}`;
  }
  if (star.gaia_source_id) return gaiaVizierUrl(star);
  if (star.ra_icrs != null && star.dec_icrs != null) {
    return `https://vizier.cds.unistra.fr/viz-bin/VizieR?-c=${encodeURIComponent(`${star.ra_icrs} ${star.dec_icrs}`)}&-c.rm=5&-out.max=20`;
  }
  return 'https://vizier.cds.unistra.fr/';
}

export function simbadIdent(star = {}) {
  if (star.simbad_main_id) return star.simbad_main_id;
  if (star.hip) return `HIP ${star.hip}`;
  if (star.hd) return `HD ${star.hd}`;
  if (star.hr) return `HR ${star.hr}`;
  if (star.gaia_source_id) return `Gaia DR3 ${star.gaia_source_id}`;
  if (star.iau_name) return star.iau_name;
  if (star.name && !/^HIP |^HD |^HYG |^HR /.test(star.name)) return star.name;
  return null;
}

export function scientistExternalLinks(star = {}) {
  return {
    gaia: gaiaArchiveUrl(star),
    gaia_vizier: gaiaVizierUrl(star),
    simbad: simbadUrl(star),
    vizier: vizierUrl(star),
  };
}

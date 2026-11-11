// Export Scientist Mode search / detail rows as CSV, VOTable, or JSON.
// Pure ESM — no DOM required (tests can call directly; UI triggers a download).

const EXPORT_COLUMNS = [
  'star_key', 'name', 'hip', 'hd', 'hr', 'hyg', 'gaia_source_id',
  'ra_icrs', 'dec_icrs', 'pmra_mas_yr', 'pmdec_mas_yr',
  'parallax_mas', 'parallax_error_mas', 'mag_v', 'mag_g',
  'spectral_type', 'teff', 'ruwe', 'distance_ly', 'constellation',
  'simbad_main_id',
];

function cell(row, key) {
  const v = row?.[key];
  if (v == null || v === '') return '';
  return v;
}

function csvEscape(value) {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows = [], columns = EXPORT_COLUMNS) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map(c => csvEscape(cell(row, c))).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const VOTABLE_TYPES = {
  star_key: 'char', name: 'char', hip: 'long', hd: 'long', hr: 'long', hyg: 'long',
  gaia_source_id: 'char', ra_icrs: 'double', dec_icrs: 'double',
  pmra_mas_yr: 'double', pmdec_mas_yr: 'double',
  parallax_mas: 'double', parallax_error_mas: 'double',
  mag_v: 'float', mag_g: 'float', spectral_type: 'char', teff: 'float',
  ruwe: 'float', distance_ly: 'float', constellation: 'char', simbad_main_id: 'char',
};

/** Minimal IVOA VOTable 1.3 document for interoperability with TOPCAT et al. */
export function rowsToVotable(rows = [], columns = EXPORT_COLUMNS, { description = 'YouNeeK Stars Scientist Mode export' } = {}) {
  const fields = columns.map(c => {
    const datatype = VOTABLE_TYPES[c] || 'char';
    const arraysize = datatype === 'char' ? ' arraysize="*"' : '';
    return `    <FIELD name="${xmlEscape(c)}" datatype="${datatype}"${arraysize}/>`;
  }).join('\n');
  const trs = rows.map(row => {
    const tds = columns.map(c => {
      const v = cell(row, c);
      return v === '' ? '      <TD/>' : `      <TD>${xmlEscape(v)}</TD>`;
    }).join('\n');
    return `    <TR>\n${tds}\n    </TR>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<VOTABLE version="1.3" xmlns="http://www.ivoa.net/xml/VOTable/v1.3">
  <RESOURCE>
    <DESCRIPTION>${xmlEscape(description)}</DESCRIPTION>
    <INFO name="QUERY_STATUS" value="OK"/>
    <INFO name="provenance" value="Local HYG v4.1 (CC BY-SA 4.0) plus optional live Gaia/SIMBAD enrichment. Not an official IAU catalog."/>
    <TABLE>
${fields}
    <DATA>
      <TABLEDATA>
${trs}
      </TABLEDATA>
    </DATA>
    </TABLE>
  </RESOURCE>
</VOTABLE>
`;
}

export function rowsToJson(rows = [], { meta = {} } = {}) {
  return `${JSON.stringify({
    format: 'youneek-scientist/1',
    disclaimer: 'Star naming is symbolic only and is not recognized by the IAU or any official astronomical body.',
    attribution: 'Star data: HYG Database v4.1 by David Nash (astronexus.com), CC BY-SA 4.0. Live fields may include Gaia DR3 and SIMBAD.',
    meta,
    count: rows.length,
    rows,
  }, null, 2)}\n`;
}

export function exportScientistData(rows, format, options = {}) {
  const fmt = String(format || 'json').toLowerCase();
  if (fmt === 'csv') return { mime: 'text/csv;charset=utf-8', ext: 'csv', body: rowsToCsv(rows, options.columns) };
  if (fmt === 'votable' || fmt === 'vot' || fmt === 'xml') {
    return { mime: 'application/x-votable+xml;charset=utf-8', ext: 'vot', body: rowsToVotable(rows, options.columns, options) };
  }
  if (fmt === 'json') return { mime: 'application/json;charset=utf-8', ext: 'json', body: rowsToJson(rows, options) };
  throw new Error(`Unsupported export format: ${format}`);
}

/** Browser helper — no-ops under node. */
export function downloadScientistExport(rows, format, filenameBase = 'youneek-scientist') {
  const { mime, ext, body } = exportScientistData(rows, format);
  if (typeof document === 'undefined' || typeof URL === 'undefined') return { mime, ext, body };
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}.${ext}`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { mime, ext, body };
}

export { EXPORT_COLUMNS };

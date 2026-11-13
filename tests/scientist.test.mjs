import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decodeColumnar } from '../src/lib/catalogTiles.js';
import {
  angularSeparationDeg,
  buildLocalIndex,
  mergeRemoteScientistData,
  parallaxMasFromDistLy,
  parseScientistQuery,
  searchLocalCatalog,
} from '../src/lib/scientistCatalog.js';
import { exportScientistData, rowsToCsv, rowsToJson, rowsToVotable } from '../src/lib/scientistExport.js';
import { scientistExternalLinks, simbadIdent } from '../src/lib/scientistLinks.js';
import { parseSimbadAscii } from '../src/lib/scientistSimbad.js';

async function tier0Index() {
  const manifest = JSON.parse(await readFile('public/catalog/manifest.json', 'utf8'));
  const file = JSON.parse(await readFile('public/catalog/hyg41/t0.json', 'utf8'));
  const tile = decodeColumnar(file, manifest.scale, manifest.nullCi);
  return buildLocalIndex(tile);
}

test('parseScientistQuery recognizes HIP/HD/Gaia/name and numeric filters', () => {
  assert.equal(parseScientistQuery({ text: 'HIP 32349' }).hip, 32349);
  assert.equal(parseScientistQuery({ text: 'hd:48915' }).hd, 48915);
  assert.equal(parseScientistQuery({ text: 'gaia:1234567890123456789' }).gaia, '1234567890123456789');
  assert.equal(parseScientistQuery({ text: 'Sirius' }).name, 'sirius');
  assert.equal(parseScientistQuery({ hip: '11767', magMax: '2' }).magMax, 2);
  assert.equal(parseScientistQuery({ ra: 101.2, dec: -16.7, radiusDeg: 0.5 }).radiusDeg, 0.5);
});

test('parallax is derived from HYG distance and angular separation is sane', () => {
  const plx = parallaxMasFromDistLy(8.6); // ~Sirius
  assert.ok(plx > 300 && plx < 450);
  assert.equal(parallaxMasFromDistLy(0), null);
  assert.ok(angularSeparationDeg(101.287, -16.716, 101.287, -16.716) < 1e-6);
  assert.ok(angularSeparationDeg(0, 0, 180, 0) > 179);
});

test('local Tier 0 search: HIP, name, cone, magnitude, derived parallax', async () => {
  const index = await tier0Index();
  const hip = searchLocalCatalog(index, { hip: 32349 });
  assert.equal(hip.results.length, 1);
  assert.equal(hip.results[0].iau_name, 'Sirius');
  assert.equal(hip.results[0].star_key, 'hip:32349');
  assert.ok(hip.results[0].parallax_mas > 300);
  assert.equal(hip.results[0].provenance.local.fields.parallax_mas, 'derived-from-hyg-distance');

  const byName = searchLocalCatalog(index, { text: 'Vega' });
  assert.ok(byName.results.some(r => r.iau_name === 'Vega'));

  const cone = searchLocalCatalog(index, { ra: 101.287, dec: -16.716, radiusDeg: 2, magMax: 3, limit: 20 });
  assert.ok(cone.results.length >= 1);
  assert.equal(cone.results[0].iau_name, 'Sirius');

  const bright = searchLocalCatalog(index, { magMax: 0, limit: 10 });
  assert.ok(bright.results.every(r => r.mag_v <= 0));
  assert.ok(bright.results.length >= 1);

  const near = searchLocalCatalog(index, { plxMin: 200, magMax: 2, limit: 20 });
  assert.ok(near.results.every(r => r.parallax_mas >= 200));

  const gaiaOnly = searchLocalCatalog(index, { gaia: '1234567890123456789' });
  assert.equal(gaiaOnly.results.length, 0);
  assert.match(gaiaOnly.note, /no Gaia/i);
});

test('tileRowToScientistRecord and mergeRemoteScientistData track provenance', async () => {
  const index = await tier0Index();
  const local = index.records[index.byHip.get(91262)];
  assert.ok(local);
  const merged = mergeRemoteScientistData(local, {
    source: 'Gaia DR3',
    gaia_source_id: '2105645684481610624',
    pmra: 200.94,
    pmdec: 286.23,
    parallax: 130.23,
    parallax_error: 0.36,
    ruwe: 0.95,
    teff: 9602,
    phot_g_mean_mag: 0.03,
  });
  assert.equal(merged.gaia_source_id, '2105645684481610624');
  assert.equal(merged.pmra_mas_yr, 200.94);
  assert.equal(merged.parallax_mas, 130.23);
  assert.equal(merged.provenance.remote.parallax_mas, 'Gaia DR3');
  assert.equal(merged.provenance.local.fields.mag_v, 'HYG');
});

test('export CSV, VOTable, and JSON include identifiers and disclaimer', () => {
  const rows = [{
    star_key: 'hip:32349', name: 'Sirius', hip: 32349, hd: 48915,
    ra_icrs: 101.287, dec_icrs: -16.716, mag_v: -1.44, spectral_type: 'A0m...',
  }];
  const csv = rowsToCsv(rows);
  assert.match(csv, /^star_key,/);
  assert.match(csv, /hip:32349/);

  const vot = rowsToVotable(rows);
  assert.match(vot, /<VOTABLE/);
  assert.match(vot, /<FIELD name="ra_icrs"/);
  assert.match(vot, /Sirius/);

  const json = JSON.parse(rowsToJson(rows));
  assert.equal(json.format, 'youneek-scientist/1');
  assert.match(json.disclaimer, /symbolic only/);
  assert.equal(json.count, 1);

  assert.equal(exportScientistData(rows, 'csv').ext, 'csv');
  assert.equal(exportScientistData(rows, 'votable').ext, 'vot');
  assert.equal(exportScientistData(rows, 'json').ext, 'json');
  assert.throws(() => exportScientistData(rows, 'fits'));
});

test('external links prefer strongest identifiers', () => {
  const links = scientistExternalLinks({
    hip: 32349, hd: 48915, gaia_source_id: '2947050466531873024',
    ra_icrs: 101.287, dec_icrs: -16.716,
  });
  assert.match(links.simbad, /HIP\+32349|HIP%2032349/);
  assert.match(links.vizier, /HIP/);
  assert.match(links.gaia_vizier, /2947050466531873024/);
  assert.equal(simbadIdent({ name: 'HIP 1', hip: 1 }), 'HIP 1');
});

test('parseSimbadAscii extracts main id and spectral type', () => {
  const sample = `
Object Sirius
Identifier (from catalog): * alf CMa
Object type: Star
Spectral type: A0m...
Coordinates(ICRS,ep=J2000,eq=2000): 06 45 08.91728  -16 42 58.0171
`;
  const parsed = parseSimbadAscii(sample);
  assert.equal(parsed.main_id, 'Sirius');
  assert.match(parsed.spectral_type, /^A0/);
  assert.ok(parsed.ra > 100 && parsed.ra < 102);
  assert.ok(parsed.dec < -16 && parsed.dec > -17);
  assert.equal(parseSimbadAscii('No astronomical object found : foo'), null);
});

test('worker scientist routes: validation and mocked Gaia/SIMBAD success + failure', async () => {
  const { handleScientistRoutes } = await import('../worker/scientist.ts');
  const json = (value, status = 200) => Response.json(value, { status });

  const missing = await handleScientistRoutes(new Request('https://x/api/scientist/gaia'), json);
  assert.equal(missing.status, 400);

  const gaiaFetch = async () => new Response([
    'source_id,ra,dec,pmra,pmdec,parallax,parallax_error,ruwe,phot_g_mean_mag,phot_bp_mean_mag,phot_rp_mean_mag,teff_gspphot',
    '2105645684481610624,279.234,38.783,200.9,286.2,130.23,0.36,0.9,0.03,0.1,0.0,9602',
  ].join('\n'), { status: 200 });
  const gaiaOk = await handleScientistRoutes(
    new Request('https://x/api/scientist/gaia?hip=91262'),
    json,
    gaiaFetch,
  );
  const gaiaBody = await gaiaOk.json();
  assert.equal(gaiaBody.ok, true);
  assert.equal(String(gaiaBody.source_id), '2105645684481610624');
  assert.equal(gaiaBody.parallax, 130.23);

  const gaiaFail = await handleScientistRoutes(
    new Request('https://x/api/scientist/gaia?hip=91262'),
    json,
    async () => { throw new Error('network down'); },
  );
  const gaiaFailBody = await gaiaFail.json();
  assert.equal(gaiaFailBody.ok, false);
  assert.equal(gaiaFailBody.unavailable, true);

  const simbadFetch = async () => new Response(`Object Vega\nObject type: Star\nSpectral type: A0Va\nCoordinates(ICRS,ep=J2000,eq=2000): 18 36 56.33635  +38 47 01.2802\n`, { status: 200 });
  const simbadOk = await handleScientistRoutes(
    new Request('https://x/api/scientist/simbad?id=HIP%2091262'),
    json,
    simbadFetch,
  );
  const simbadBody = await simbadOk.json();
  assert.equal(simbadBody.ok, true);
  assert.equal(simbadBody.main_id, 'Vega');

  assert.equal(await handleScientistRoutes(new Request('https://x/api/stars'), json), null);
});

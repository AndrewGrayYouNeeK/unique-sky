import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FlaskConical, Loader2, Search, X } from 'lucide-react';
import { getSharedCatalogLoader } from '@/components/sky/StarCanvas';
import {
  buildLocalIndex,
  coneTilePlan,
  parseScientistQuery,
  searchLocalCatalog,
} from '@/lib/scientistCatalog';
import { downloadScientistExport } from '@/lib/scientistExport';
import { fetchGaiaEnrichment } from '@/lib/scientistRemote';

/**
 * Scientist Mode search dock — local Tier 0/1 first, optional live Gaia for Gaia-ID queries.
 * Mounted only when the AR sky toggle is on; keeps StarDetailModal untouched.
 */
export default function ScientistPanel({
  open,
  onClose,
  onSelect,
  loader: loaderProp = null,
}) {
  const catalog = loaderProp || getSharedCatalogLoader();
  const [index, setIndex] = useState(null);
  const [text, setText] = useState('');
  const [ra, setRa] = useState('');
  const [dec, setDec] = useState('');
  const [radius, setRadius] = useState('1');
  const [magMax, setMagMax] = useState('6.5');
  const [plxMin, setPlxMin] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    catalog.loadTier0()
      .then((tile) => {
        if (!cancelled) setIndex(buildLocalIndex(tile));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Catalog unavailable');
      });
    return () => { cancelled = true; };
  }, [open, catalog]);

  const runSearch = useCallback(async () => {
    if (!index) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      const query = parseScientistQuery({
        text,
        ra: ra === '' ? null : ra,
        dec: dec === '' ? null : dec,
        radiusDeg: radius === '' ? null : radius,
        magMax: magMax === '' ? null : magMax,
        plxMin: plxMin === '' ? null : plxMin,
        limit: 40,
      });

      let extraTiles = [];
      if (query.ra != null && query.dec != null && query.radiusDeg != null) {
        const plan = coneTilePlan(query.ra, query.dec, query.radiusDeg, query.magMax ?? 10.5);
        await catalog.ensureView({ ra: plan.ra, dec: plan.dec, radius: plan.radius, limit: plan.limit });
        extraTiles = [...catalog.loadedTiles().values()];
      }

      let { results: local, note: localNote } = searchLocalCatalog(index, query, extraTiles);

      // Gaia ID is absent from HYG — try live TAP, then optionally match by position.
      if (query.gaia && local.length === 0) {
        const gaia = await fetchGaiaEnrichment({ gaia: query.gaia });
        if (gaia.ok && gaia.found) {
          const remoteRec = {
            id: `gaia:${gaia.source_id}`,
            star_key: `gaia:${gaia.source_id}`,
            name: `Gaia DR3 ${gaia.source_id}`,
            gaia_source_id: String(gaia.source_id),
            hip: null, hd: null, hr: null, hyg: null,
            ra_icrs: gaia.ra, dec_icrs: gaia.dec, ra: gaia.ra, dec: gaia.dec,
            mag_v: gaia.phot_g_mean_mag ?? null, magnitude: gaia.phot_g_mean_mag ?? null,
            mag_g: gaia.phot_g_mean_mag ?? null,
            pmra_mas_yr: gaia.pmra, pmdec_mas_yr: gaia.pmdec,
            parallax_mas: gaia.parallax, parallax_error_mas: gaia.parallax_error,
            teff: gaia.teff_gspphot, ruwe: gaia.ruwe,
            spectral_type: null, constellation: '', claimable: false,
            provenance: {
              local: null,
              remote: { source: 'Gaia DR3 TAP', fields: 'live' },
            },
          };
          local = [remoteRec];
          localNote = 'Resolved via live Gaia TAP (not in bundled HYG tiles).';
        } else {
          localNote = gaia.error || localNote || 'Gaia ID not found (live query failed or empty).';
        }
      }

      setResults(local);
      setNote(localNote || (local.length ? `${local.length} result${local.length === 1 ? '' : 's'} (local HYG unless noted)` : 'No matches in loaded catalog'));
    } catch (err) {
      setError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setBusy(false);
    }
  }, [index, text, ra, dec, radius, magMax, plxMin, catalog]);

  const exportRows = useMemo(() => results, [results]);

  if (!open) return null;

  return (
    <div
      className="absolute bottom-36 left-3 right-3 z-40 max-w-lg mx-auto"
      data-testid="scientist-panel"
    >
      <div className="glass-dark rounded-2xl border border-accent/30 p-3 shadow-lg max-h-[55vh] flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-accent text-sm font-space font-semibold flex items-center gap-1.5">
            <FlaskConical size={14} /> Scientist Mode
          </p>
          <button type="button" aria-label="Close scientist search" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={16} />
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground font-inter leading-snug">
          Offline lookup uses bundled HYG Tier 0 / loaded Tier 1 tiles. Gaia IDs, proper motion, measured parallax, Teff, and RUWE need a live query.
        </p>

        <div className="flex gap-2">
          <input
            data-testid="scientist-search-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            placeholder="Name, HIP, HD, Gaia ID…"
            className="flex-1 bg-muted/40 border border-border/50 rounded-xl px-3 py-2 text-sm font-inter text-foreground placeholder:text-muted-foreground/60"
          />
          <button
            type="button"
            data-testid="scientist-search-btn"
            onClick={runSearch}
            disabled={busy || !index}
            className="bg-accent/20 border border-accent/50 text-accent rounded-xl px-3 py-2 flex items-center gap-1 text-sm font-space disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <Field label="RA°" value={ra} onChange={setRa} testId="scientist-ra" />
          <Field label="Dec°" value={dec} onChange={setDec} testId="scientist-dec" />
          <Field label="Radius°" value={radius} onChange={setRadius} testId="scientist-radius" />
          <Field label="Mag ≤" value={magMax} onChange={setMagMax} testId="scientist-magmax" />
          <Field label="Plx ≥ mas" value={plxMin} onChange={setPlxMin} testId="scientist-plxmin" className="sm:col-span-2" />
        </div>

        {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
        {note && !error && <p className="text-[10px] text-muted-foreground">{note}</p>}

        <div className="overflow-y-auto min-h-0 flex-1 space-y-1" data-testid="scientist-results">
          {results.map((star) => (
            <button
              key={star.star_key || star.id}
              type="button"
              onClick={() => onSelect?.(star)}
              className="w-full text-left px-2.5 py-2 rounded-xl bg-muted/30 hover:bg-accent/10 border border-transparent hover:border-accent/30 transition-colors"
            >
              <div className="flex justify-between gap-2">
                <span className="text-sm font-space text-foreground truncate">{star.name}</span>
                <span className="text-[10px] font-space text-muted-foreground shrink-0">mag {star.mag_v?.toFixed?.(2) ?? '—'}</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-inter truncate">
                {[star.star_key, star.constellation, fmtCoord(star.ra_icrs, star.dec_icrs)].filter(Boolean).join(' · ')}
              </p>
            </button>
          ))}
          {!results.length && !busy && (
            <p className="text-xs text-muted-foreground/80 py-2 text-center font-inter">No results yet</p>
          )}
        </div>

        {results.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
            {['csv', 'votable', 'json'].map((fmt) => (
              <button
                key={fmt}
                type="button"
                data-testid={`scientist-export-${fmt}`}
                onClick={() => downloadScientistExport(exportRows, fmt)}
                className="text-[10px] font-space uppercase tracking-wide px-2 py-1 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-accent/40 flex items-center gap-1"
              >
                <Download size={10} /> {fmt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, testId, className = '' }) {
  return (
    <label className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-space">{label}</span>
      <input
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="bg-muted/40 border border-border/50 rounded-lg px-2 py-1.5 text-xs font-inter text-foreground"
      />
    </label>
  );
}

function fmtCoord(ra, dec) {
  if (ra == null || dec == null) return '';
  return `${Number(ra).toFixed(3)}° ${Number(dec) >= 0 ? '+' : ''}${Number(dec).toFixed(3)}°`;
}

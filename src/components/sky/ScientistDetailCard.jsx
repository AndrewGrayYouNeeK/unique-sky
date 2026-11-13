import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, ExternalLink, FlaskConical, Loader2, X } from 'lucide-react';
import { mergeRemoteScientistData } from '@/lib/scientistCatalog';
import { downloadScientistExport } from '@/lib/scientistExport';
import { scientistExternalLinks } from '@/lib/scientistLinks';
import { enrichScientistRecord } from '@/lib/scientistRemote';

const DISCLAIMER = 'Star naming is symbolic only and is not recognized by the IAU or any official astronomical body.';

/**
 * Scientist Mode detail sheet — separate from StarDetailModal so the checkout branch
 * rebase stays easier. Shows ICRS + live Gaia/SIMBAD enrichment with provenance.
 */
export default function ScientistDetailCard({ star, onClose }) {
  const [record, setRecord] = useState(star);
  const [liveStatus, setLiveStatus] = useState('idle'); // idle | loading | ready | partial | offline
  const [liveNote, setLiveNote] = useState('');

  useEffect(() => {
    setRecord(star);
    if (!star) return undefined;
    let cancelled = false;
    setLiveStatus('loading');
    setLiveNote('');
    enrichScientistRecord(star)
      .then((remote) => {
        if (cancelled) return;
        const merged = mergeRemoteScientistData(star, remote);
        setRecord(merged);
        if (remote.unavailable?.length) {
          setLiveStatus(remote.gaia_source_id || remote.simbad_main_id ? 'partial' : 'offline');
          setLiveNote(remote.error || 'Some live services were unavailable.');
        } else {
          setLiveStatus('ready');
          setLiveNote('Live Gaia DR3 + SIMBAD enrichment applied.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLiveStatus('offline');
        setLiveNote(err.message || 'Live enrichment unavailable — showing local HYG fields only.');
      });
    return () => { cancelled = true; };
  }, [star]);

  if (!record) return null;
  const links = scientistExternalLinks(record);
  const localProv = record.provenance?.local;
  const remoteProv = record.provenance?.remote;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        data-testid="scientist-detail"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div
          className="relative w-full max-w-md glass-card rounded-2xl p-5 z-10 max-h-[85vh] overflow-y-auto"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={18} />
          </button>

          <div className="flex items-start gap-3 mb-4 pr-6">
            <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center shrink-0">
              <FlaskConical size={18} className="text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-space font-bold text-foreground">{record.name}</h2>
              <p className="text-muted-foreground text-xs font-inter">
                {[record.constellation, record.star_key].filter(Boolean).join(' · ')}
              </p>
              <p className="text-[10px] text-accent/80 font-space mt-0.5 uppercase tracking-wider">Scientist Mode · not an official catalog</p>
            </div>
          </div>

          <Section title="ICRS coordinates">
            <Grid>
              <Cell label="RA" value={fmtDeg(record.ra_icrs, 6)} unit="°" />
              <Cell label="Dec" value={fmtDeg(record.dec_icrs, 6)} unit="°" />
            </Grid>
          </Section>

          <Section title="Astrometry">
            <Grid>
              <Cell label="μ_α*" value={fmtNum(record.pmra_mas_yr)} unit="mas/yr" hint={srcHint(remoteProv, 'pmra_mas_yr')} />
              <Cell label="μ_δ" value={fmtNum(record.pmdec_mas_yr)} unit="mas/yr" hint={srcHint(remoteProv, 'pmdec_mas_yr')} />
              <Cell label="ϖ" value={fmtNum(record.parallax_mas)} unit="mas" hint={parallaxHint(record)} />
              <Cell label="σ_ϖ" value={fmtNum(record.parallax_error_mas)} unit="mas" hint={srcHint(remoteProv, 'parallax_error_mas')} />
              <Cell label="RUWE" value={fmtNum(record.ruwe)} hint={srcHint(remoteProv, 'ruwe')} />
            </Grid>
          </Section>

          <Section title="Photometry & spectrum">
            <Grid>
              <Cell label="V mag" value={fmtNum(record.mag_v)} hint={srcHint(localProv?.fields, 'mag_v') || 'HYG'} />
              <Cell label="G mag" value={fmtNum(record.mag_g)} hint={srcHint(remoteProv, 'mag_g')} />
              <Cell label="SpT" value={record.spectral_type || record.spectral || '—'} hint={spectralHint(record)} />
              <Cell label="Teff" value={fmtNum(record.teff)} unit="K" hint={srcHint(remoteProv, 'teff')} />
            </Grid>
          </Section>

          <Section title="Identifiers">
            <p className="text-xs font-inter text-foreground/85 break-words" data-testid="scientist-identifiers">
              {[
                record.gaia_source_id && `Gaia DR3 ${record.gaia_source_id}`,
                record.hip && `HIP ${record.hip}`,
                record.hd && `HD ${record.hd}`,
                record.hr && `HR ${record.hr}`,
                record.hyg && `HYG ${record.hyg}`,
                record.simbad_main_id && `SIMBAD ${record.simbad_main_id}`,
              ].filter(Boolean).join(' · ') || '—'}
            </p>
          </Section>

          <Section title="External archives">
            <div className="flex flex-wrap gap-2">
              <ExtLink href={links.gaia} label="Gaia" />
              <ExtLink href={links.simbad} label="SIMBAD" />
              <ExtLink href={links.vizier} label="VizieR" />
            </div>
          </Section>

          <Section title="Provenance">
            <div className="text-[11px] text-muted-foreground font-inter space-y-1 leading-snug">
              <p className="flex items-center gap-1.5">
                {liveStatus === 'loading' && <Loader2 size={12} className="animate-spin text-accent" />}
                {liveNote || 'Local HYG fields only until live enrichment finishes.'}
              </p>
              {localProv && (
                <p>Local: {localProv.catalog} ({localProv.license}) · {localProv.source}</p>
              )}
              {remoteProv?.error && <p className="text-star-gold/90">Live: {remoteProv.error}</p>}
            </div>
          </Section>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {['csv', 'votable', 'json'].map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => downloadScientistExport([record], fmt, `youneek-${(record.star_key || 'star').replace(/:/g, '-')}`)}
                className="text-[10px] font-space uppercase tracking-wide px-2 py-1.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Download size={10} /> {fmt}
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4 font-inter">{DISCLAIMER}</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-space uppercase tracking-widest text-muted-foreground mb-1.5">{title}</p>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function Cell({ label, value, unit = '', hint = '' }) {
  return (
    <div className="bg-muted/40 rounded-xl px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-space">{label}</p>
      <p className="text-sm font-space text-foreground">
        {value ?? '—'}{value != null && value !== '—' && unit ? <span className="text-muted-foreground text-[10px] ml-0.5">{unit}</span> : null}
      </p>
      {hint ? <p className="text-[9px] text-muted-foreground/80 font-inter mt-0.5">{hint}</p> : null}
    </div>
  );
}

function ExtLink({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-space text-accent border border-accent/40 rounded-lg px-2.5 py-1.5 hover:bg-accent/10"
    >
      {label} <ExternalLink size={11} />
    </a>
  );
}

function fmtDeg(v, digits = 4) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Number(v).toFixed(digits);
}
function fmtNum(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'string') return v;
  if (!Number.isFinite(Number(v))) return null;
  const n = Number(v);
  return Math.abs(n) >= 100 ? n.toFixed(1) : n.toFixed(3);
}
function srcHint(prov, field) {
  if (!prov) return '';
  if (typeof prov === 'object' && field in prov && prov[field]) return String(prov[field]);
  return '';
}
function parallaxHint(record) {
  const remote = srcHint(record.provenance?.remote, 'parallax_mas');
  if (remote) return remote;
  const local = record.provenance?.local?.fields?.parallax_mas;
  return local || '';
}
function spectralHint(record) {
  return srcHint(record.provenance?.remote, 'spectral_type')
    || srcHint(record.provenance?.local?.fields, 'spectral_type')
    || '';
}

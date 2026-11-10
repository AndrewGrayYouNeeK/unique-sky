import { useRef, useEffect, useCallback } from 'react';
import { BRIGHT_STARS, getStarColorHex, magnitudeToSize, magnitudeToOpacity } from '@/lib/starData';
import { LEGACY_STAR_IDS, starKey } from '@/lib/starKey';
import { createProjector, equatorialToHorizontalMatrix, raDecToVector, colorForCi, placeLabels } from '@/lib/skyProjection';
import { skyToVector } from '@/lib/orientation';
import { createCatalogLoader, magnitudeLimitForFov, labelMagnitudeForFov, fadeForMagnitude, tilesForCone, RADEC_TILING } from '@/lib/catalogTiles';

// Hard cap on catalog points drawn per frame so phones stay smooth at any zoom.
const MAX_CATALOG_DRAW = 3500;
const MAX_LABELS = 45;

// Curated, claimable stars (and the Pleiades hunt marker) with their unit vectors.
/** @type {any[]} */
const CURATED = BRIGHT_STARS.map(star => ({
  ...star,
  ...(LEGACY_STAR_IDS[star.id] ? { star_key: starKey(LEGACY_STAR_IDS[star.id]) } : {}),
  vec: raDecToVector(star.ra, star.dec),
  rgb: hexToRgb(getStarColorHex(star.color || 'white')),
}));
// HIP numbers already represented by a curated star, so catalog copies are not drawn twice.
const CURATED_HIP = new Set(Object.values(LEGACY_STAR_IDS).map(ids => ids.hip).filter(Boolean));

let sharedLoader = null;
export function getSharedCatalogLoader() {
  if (!sharedLoader) sharedLoader = createCatalogLoader({ baseUrl: '/catalog/' });
  return sharedLoader;
}

function catalogStar(tile, i) {
  const proper = tile.proper?.[i] || '';
  const bayer = tile.bayer?.[i] || '';
  const ids = { hip: tile.hip[i] || null, hd: tile.hd[i] || null, hr: tile.hr?.[i] || null, hyg: tile.hyg[i] };
  const name = proper || bayer || (ids.hip ? `HIP ${ids.hip}` : ids.hd ? `HD ${ids.hd}` : `HYG ${ids.hyg}`);
  return {
    id: starKey(ids), star_key: starKey(ids), ...ids,
    gaia_source_id: null, tycho: null,
    iau_name: proper || null, bayer: bayer || null,
    flamsteed: tile.flam?.[i] ? `${tile.flam[i]} ${tile.con[i]}` : null,
    name, constellation: tile.con?.[i] || '',
    ra: tile.ra[i], dec: tile.dec[i], magnitude: Math.round(tile.mag[i] * 100) / 100,
    distance_ly: tile.distLy[i] ? Math.round(tile.distLy[i]) : null,
    spectral: tile.spect?.[i] || null, claimable: false,
  };
}

export default function StarCanvas({
  viewRef, azimuth = 180, altitude = 45, fov = 70, roll = 0,
  onStarClick, ownedStars = {}, huntTarget = null, selectedStarId = null, location = null, loader = null,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const timeRef = useRef(Date.now());
  /** @type {import('react').MutableRefObject<any[]>} */
  const hitRef = useRef([]);
  const fetchRef = useRef({ at: 0, key: '' });
  /** @type {import('react').MutableRefObject<any>} */
  const propsRef = useRef({});
  propsRef.current = { ownedStars, huntTarget, selectedStarId, location, azimuth, altitude, fov, roll };
  const catalog = loader || getSharedCatalogLoader();

  useEffect(() => { catalog.loadTier0().catch(() => {}); }, [catalog]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = canvas.width / Math.max(1, canvas.offsetWidth);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const p = propsRef.current;
    const view = viewRef?.current || { azimuth: p.azimuth, altitude: p.altitude, fov: p.fov, roll: p.roll };
    const t = (Date.now() - timeRef.current) / 1000;
    const eqToHor = equatorialToHorizontalMatrix(p.location, new Date());
    const projector = createProjector(view, w, h, eqToHor);
    const horizon = createProjector(view, w, h, null);
    const limit = magnitudeLimitForFov(view.fov);
    const labelMag = labelMagnitudeForFov(view.fov);
    const pt = { x: 0, y: 0 };
    /** @type {any[]} */
    const hits = [];
    const labels = [];
    const measure = (text, font) => { ctx.font = font; return ctx.measureText(text).width; };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // ── Altitude rings (horizon + 30/60°) in the horizontal frame ──
    ctx.save();
    for (const ringAlt of [0, 30, 60]) {
      ctx.beginPath();
      let pen = false;
      for (let az = 0; az <= 360; az += 3) {
        const v = skyToVector(az, ringAlt);
        if (horizon.project(v[0], v[1], v[2], pt)) { if (pen) ctx.lineTo(pt.x, pt.y); else ctx.moveTo(pt.x, pt.y); pen = true; } else pen = false;
      }
      ctx.strokeStyle = ringAlt === 0 ? 'rgba(34, 211, 238, 0.28)' : 'rgba(100, 130, 200, 0.12)';
      ctx.lineWidth = ringAlt === 0 ? 1.5 : 0.6;
      ctx.setLineDash(ringAlt === 0 ? [] : [6, 12]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const cardinal = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];
    ctx.font = 'bold 10px Space Grotesk';
    ctx.fillStyle = 'rgba(34, 211, 238, 0.6)';
    for (const [label, az] of cardinal) {
      const v = skyToVector(az, 0);
      if (horizon.project(v[0], v[1], v[2], pt)) ctx.fillText(p.location ? label : `${label}*`, pt.x - 4, pt.y - 4);
    }
    ctx.restore();

    // ── Catalog stars (Tier 0 always, Tier 1 tiles as zoom requires) ──
    const center = projector.centerRaDec();
    const radius = projector.halfDiagDeg + 4;
    const fetchKey = `${Math.round(center.ra / 10)}:${Math.round(center.dec / 10)}:${Math.round(limit * 2)}`;
    if (fetchKey !== fetchRef.current.key && Date.now() - fetchRef.current.at > 250) {
      fetchRef.current = { at: Date.now(), key: fetchKey };
      catalog.ensureView({ ra: center.ra, dec: center.dec, radius, limit }).catch(() => {});
    }
    let drawn = 0;
    const drawSource = (tile, isTier0) => {
      for (let i = 0; i < tile.n && drawn < MAX_CATALOG_DRAW; i++) {
        const mag = tile.mag[i];
        if (mag > limit) { if (isTier0) break; continue; } // Tier 0 is magnitude-sorted
        if (isTier0 && CURATED_HIP.has(tile.hip[i])) continue;
        if (!projector.project(tile.x[i], tile.y[i], tile.z[i], pt)) continue;
        if (pt.x < -10 || pt.x > w + 10 || pt.y < -10 || pt.y > h + 10) continue;
        const fade = fadeForMagnitude(mag, limit);
        if (fade <= 0.02) continue;
        // Size/brightness relative to the current limit, so zooming in reveals fainter stars
        // the way a telescope does instead of leaving them as invisible specks.
        const rel = limit - mag;
        const r = Math.max(0.7, Math.min(3.2, 0.7 + rel * 0.45));
        ctx.globalAlpha = Math.max(0.35, Math.min(1, 0.4 + rel * 0.22)) * fade;
        ctx.fillStyle = `rgb(${colorForCi(tile.ci[i])})`;
        if (r < 1.2) ctx.fillRect(pt.x - r, pt.y - r, r * 2, r * 2);
        else { ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill(); }
        drawn++;
        hits.push({ x: pt.x, y: pt.y, mag, tile, i });
        if (isTier0) {
          const proper = tile.proper[i];
          const isSelected = p.selectedStarId && p.selectedStarId === starKey({ hip: tile.hip[i], hd: tile.hd[i], hr: tile.hr[i], hyg: tile.hyg[i] });
          const text = proper || (view.fov < 20 ? tile.bayer[i] : '');
          if (text && (mag <= labelMag || isSelected)) {
            const font = '9px Space Grotesk';
            labels.push({ x: pt.x + r + 4, y: pt.y - 1, text, font, width: measure(text, font), priority: isSelected ? 2 : 10 + mag, color: 'rgba(190,205,240,0.7)' });
          }
        }
      }
    };
    ctx.save();
    if (catalog.tier0) drawSource(catalog.tier0, true);
    const tiling = catalog.manifest?.tiers?.find(tier => tier.kind === 'tiled')?.tiling || RADEC_TILING;
    const visibleTiles = new Set(tilesForCone(center.ra, center.dec, radius, tiling));
    const tierTiles = [...catalog.loadedTiles().entries()]
      .filter(([key, tile]) => tile.magMin < limit && visibleTiles.has(key.split('/')[2]))
      .sort((a, b) => a[1].magMin - b[1].magMin);
    for (const [, tile] of tierTiles) drawSource(tile, false);
    ctx.restore();

    // ── Curated stars: constellation lines, hunt target, claimable stars ──
    const positions = new Map();
    for (const star of CURATED) {
      if (projector.project(star.vec[0], star.vec[1], star.vec[2], pt)) positions.set(star.id, { x: pt.x, y: pt.y });
    }
    const groups = {};
    for (const star of CURATED) (groups[star.constellation] ||= []).push(star);
    ctx.save();
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.18)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([5, 9]);
    ctx.lineDashOffset = -t * 3;
    for (const stars of Object.values(groups)) {
      for (let i = 0; i < stars.length - 1; i++) {
        const a = positions.get(stars[i].id), b = positions.get(stars[i + 1].id);
        if (!a || !b) continue;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    ctx.restore();

    const huntStar = p.huntTarget && CURATED.find(s => s.name === p.huntTarget || s.id === p.huntTarget);
    if (huntStar) {
      const hp = positions.get(huntStar.id);
      const onScreen = hp && hp.x > -40 && hp.x < w + 40 && hp.y > -40 && hp.y < h + 40;
      if (onScreen) {
        const pulse = Math.sin(t * 4) * 0.5 + 0.5;
        ctx.save();
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.4 + pulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(hp.x, hp.y, 20 + pulse * 8, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.15 + pulse * 0.2})`;
        ctx.beginPath(); ctx.arc(hp.x, hp.y, 35 + pulse * 12, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(34, 211, 238, ${0.7 + pulse * 0.3})`;
        ctx.font = 'bold 10px Space Grotesk';
        ctx.textAlign = 'center';
        ctx.fillText('🎯 TARGET', hp.x, hp.y - 28);
        ctx.restore();
      } else {
        // Direction arrow toward the off-screen target (computed from the camera frame).
        const v = huntStar.vec, C = projector.matrix;
        const dx = C[0][0] * v[0] + C[0][1] * v[1] + C[0][2] * v[2];
        const dy = C[1][0] * v[0] + C[1][1] * v[1] + C[1][2] * v[2];
        drawDirectionArrow(ctx, w, h, Math.atan2(-dy, dx), t);
      }
    }

    for (const star of CURATED) {
      const pos = positions.get(star.id);
      if (!pos || pos.x < -60 || pos.x > w + 60 || pos.y < -60 || pos.y > h + 60) continue;
      const owner = p.ownedStars[star.id] || p.ownedStars[star.hip_id] || p.ownedStars[star.name?.toLowerCase()];
      const isHunt = huntStar && huntStar.id === star.id;
      const isSelected = p.selectedStarId === star.id;
      const size = magnitudeToSize(star.magnitude) * (view.fov < 30 ? 1.15 : 1);
      const opacity = magnitudeToOpacity(star.magnitude);
      const twinkle = Math.sin(t * 1.8 + star.ra * 0.07) * 0.15 + 0.85;
      const rgb = owner ? '251,191,36' : isHunt ? '34,211,238' : star.rgb;
      ctx.save();
      const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size * 5);
      glow.addColorStop(0, `rgba(${rgb},${opacity * twinkle * 0.9})`);
      glow.addColorStop(0.5, `rgba(${rgb},${opacity * twinkle * 0.25})`);
      glow.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, size * 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${opacity * twinkle})`;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2); ctx.fill();
      if (star.magnitude < 1) {
        ctx.strokeStyle = `rgba(${rgb},${opacity * twinkle})`;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.4;
        const spike = size * 3;
        ctx.beginPath();
        ctx.moveTo(pos.x - spike, pos.y); ctx.lineTo(pos.x + spike, pos.y);
        ctx.moveTo(pos.x, pos.y - spike); ctx.lineTo(pos.x, pos.y + spike);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (owner) {
        const pulse2 = Math.sin(t * 2 + star.ra) * 0.15 + 0.85;
        ctx.strokeStyle = `rgba(251,191,36,${0.35 * pulse2})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.arc(pos.x, pos.y, size + 6 + pulse2 * 2, 0, Math.PI * 2); ctx.stroke();
      }
      if (isSelected) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(pos.x, pos.y, size + 10, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      hits.push({ x: pos.x, y: pos.y, mag: star.magnitude - 3, curated: star });
      // Real name always; the claim's edition name is added under it, never instead of it.
      const always = owner || isHunt || isSelected;
      if (always || star.magnitude <= Math.max(1.8, labelMag)) {
        const font = owner ? 'bold 11px Space Grotesk' : '10px Space Grotesk';
        labels.push({ x: pos.x + size + 5, y: pos.y - 1, text: star.name, font, width: measure(star.name, font), priority: owner ? 0 : isHunt ? 1 : isSelected ? 2 : 5 + star.magnitude, color: owner ? 'rgba(251,191,36,0.95)' : isHunt ? 'rgba(34,211,238,0.9)' : 'rgba(200,220,255,0.8)' });
        if (owner) {
          const text = `★ ${owner}`;
          labels.push({ x: pos.x + size + 5, y: pos.y + 11, text, font: 'bold 9px Space Grotesk', width: measure(text, 'bold 9px Space Grotesk'), priority: 0.5, color: 'rgba(251,191,36,0.85)' });
        }
      }
    }

    // Selected catalog star ring
    if (p.selectedStarId && !positions.has(p.selectedStarId)) {
      const sel = hits.find(hit => hit.tile && starKey({ hip: hit.tile.hip[hit.i], hd: hit.tile.hd[hit.i], hr: hit.tile.hr?.[hit.i], hyg: hit.tile.hyg[hit.i] }) === p.selectedStarId);
      if (sel) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sel.x, sel.y, 9, 0, Math.PI * 2); ctx.stroke(); }
    }

    // ── Labels with collision avoidance ──
    for (const label of placeLabels(labels, { max: MAX_LABELS, bounds: { w, h } })) {
      ctx.font = label.font;
      ctx.fillStyle = label.color;
      ctx.fillText(label.text, label.x, label.y);
    }

    hitRef.current = hits;
    animFrameRef.current = requestAnimationFrame(draw);
  }, [viewRef, catalog]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap for mobile fill-rate
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !onStarClick) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best = null;
    let bestScore = Infinity;
    for (const hit of hitRef.current) {
      const d = Math.hypot(hit.x - x, hit.y - y);
      const reach = hit.curated ? 44 : 26;
      if (d > reach) continue;
      const score = d + hit.mag * 3; // prefer brighter (and curated) stars when crowded
      if (score < bestScore) { bestScore = score; best = hit; }
    }
    if (best) onStarClick(best.curated ? { ...best.curated, claimable: true } : catalogStar(best.tile, best.i));
  }, [onStarClick]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="w-full h-full cursor-crosshair"
      style={{ touchAction: 'none' }}
      data-testid="star-canvas"
    />
  );
}

// Pulsing arrow at the screen edge pointing toward an off-screen target (angle in screen space).
function drawDirectionArrow(ctx, w, h, angle, t) {
  const margin = 40;
  const edgeX = Math.max(margin, Math.min(w - margin, w / 2 + Math.cos(angle) * (w / 2 - margin)));
  const edgeY = Math.max(margin, Math.min(h - margin, h / 2 + Math.sin(angle) * (h / 2 - margin)));
  ctx.save();
  ctx.translate(edgeX, edgeY);
  ctx.rotate(angle);
  ctx.globalAlpha = Math.sin(t * 5) * 0.4 + 0.6;
  ctx.fillStyle = 'rgba(34, 211, 238, 0.9)';
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(-8, -8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function hexToRgb(hex) {
  return `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;
}

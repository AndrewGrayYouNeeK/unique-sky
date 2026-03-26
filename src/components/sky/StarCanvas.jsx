import { useRef, useEffect, useCallback } from 'react';
import { BRIGHT_STARS, PLANETS, getStarColorHex, magnitudeToSize, magnitudeToOpacity } from '@/lib/starData';

// Proper spherical projection: equatorial → horizontal → screen
function equatorialToHorizontal(ra, dec, azimuth, altitude) {
  const raRad = (ra * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;
  const azRad = (azimuth * Math.PI) / 180;
  const altRad = (altitude * Math.PI) / 180;

  // Hour angle (simplified — treats RA as LST offset)
  const ha = azRad - raRad;

  // Alt-Az from equatorial
  const sinAlt = Math.sin(decRad) * Math.sin(altRad) + Math.cos(decRad) * Math.cos(altRad) * Math.cos(ha);
  const starAlt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  const cosAz = (Math.sin(decRad) - Math.sin(starAlt) * Math.sin(altRad)) /
    (Math.cos(starAlt) * Math.cos(altRad) + 0.0001);
  const starAz = Math.sin(ha) > 0
    ? 2 * Math.PI - Math.acos(Math.max(-1, Math.min(1, cosAz)))
    : Math.acos(Math.max(-1, Math.min(1, cosAz)));

  return { az: starAz, alt: starAlt };
}

function projectToScreen(starAz, starAlt, viewAz, viewAlt, fovRad, w, h) {
  const dAz = starAz - viewAz;
  // Normalize to -PI..PI
  const dAzNorm = Math.atan2(Math.sin(dAz), Math.cos(dAz));
  const dAlt = starAlt - viewAlt;
  const scale = 1 / fovRad;
  const x = w / 2 - dAzNorm * scale * w;
  const y = h / 2 - dAlt * scale * h;
  return { x, y };
}

export default function StarCanvas({
  azimuth, altitude, fov = 80, yearOffset = 0,
  onStarClick, ownedStars = {}, huntTarget = null, showMythOverlay = false
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const timeRef = useRef(Date.now());

  const viewAzRad = (azimuth * Math.PI) / 180;
  const viewAltRad = (altitude * Math.PI) / 180;
  const fovRad = (fov * Math.PI) / 180;

  const projectStar = useCallback((ra, dec, w, h) => {
    const precession = yearOffset * 0.013889;
    const adjustedRa = ((ra + precession) % 360 + 360) % 360;
    const { az, alt } = equatorialToHorizontal(adjustedRa, dec, azimuth, altitude);
    return projectToScreen(az, alt, viewAzRad, viewAltRad, fovRad, w, h);
  }, [azimuth, altitude, yearOffset, viewAzRad, viewAltRad, fovRad]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const t = (Date.now() - timeRef.current) / 1000;

    // ── Altitude rings ──────────────────────────────────────────────
    const ringAlts = [0, 30, 60, 90];
    ringAlts.forEach(ringAlt => {
      const ringAltRad = (ringAlt * Math.PI) / 180;
      const dAlt = ringAltRad - viewAltRad;
      const ry = h / 2 - dAlt * (h / fovRad);
      const rx = w * 0.9; // horizontal extent of ring
      ctx.save();
      ctx.strokeStyle = ringAlt === 0
        ? 'rgba(34, 211, 238, 0.25)'   // horizon = cyan
        : 'rgba(100, 130, 200, 0.08)';
      ctx.lineWidth = ringAlt === 0 ? 1.5 : 0.5;
      ctx.setLineDash(ringAlt === 0 ? [] : [6, 12]);
      ctx.beginPath();
      ctx.ellipse(w / 2, ry, rx, rx * 0.15, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (ringAlt > 0 && ringAlt < 90) {
        ctx.fillStyle = 'rgba(100, 130, 200, 0.35)';
        ctx.font = '9px Space Grotesk';
        ctx.fillText(`${ringAlt}°`, w * 0.06, ry - 2);
      }
      if (ringAlt === 0) {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.5)';
        ctx.font = 'bold 9px Space Grotesk';
        ctx.fillText('Horizon', w * 0.06, ry - 3);
      }
      ctx.restore();
    });

    // ── Compute star screen positions ───────────────────────────────
    const starPositions = {};
    BRIGHT_STARS.forEach(star => {
      starPositions[star.id] = projectStar(star.ra, star.dec, w, h);
    });

    // ── Constellation lines ─────────────────────────────────────────
    const constellationGroups = {};
    BRIGHT_STARS.forEach(star => {
      if (!constellationGroups[star.constellation]) constellationGroups[star.constellation] = [];
      constellationGroups[star.constellation].push(star);
    });

    Object.entries(constellationGroups).forEach(([, stars]) => {
      if (stars.length < 2) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.18)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([5, 9]);
      ctx.lineDashOffset = -t * 3;
      for (let i = 0; i < stars.length - 1; i++) {
        const a = starPositions[stars[i].id];
        const b = starPositions[stars[i + 1].id];
        if (!a || !b) continue;
        const margin = 300;
        if (a.x > -margin && a.x < w + margin && b.x > -margin && b.x < w + margin) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    });

    // ── Hunt target highlight ───────────────────────────────────────
    if (huntTarget) {
      const huntStar = BRIGHT_STARS.find(s => s.name === huntTarget || s.id === huntTarget);
      if (huntStar) {
        const hp = starPositions[huntStar.id];
        if (hp) {
          const pulse = Math.sin(t * 4) * 0.5 + 0.5;
          // Pulsing ring
          ctx.save();
          ctx.strokeStyle = `rgba(34, 211, 238, ${0.4 + pulse * 0.4})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(hp.x, hp.y, 20 + pulse * 8, 0, Math.PI * 2);
          ctx.stroke();
          // Second ring
          ctx.strokeStyle = `rgba(34, 211, 238, ${0.15 + pulse * 0.2})`;
          ctx.beginPath();
          ctx.arc(hp.x, hp.y, 35 + pulse * 12, 0, Math.PI * 2);
          ctx.stroke();
          // "TARGET" label
          ctx.fillStyle = `rgba(34, 211, 238, ${0.7 + pulse * 0.3})`;
          ctx.font = 'bold 10px Space Grotesk';
          ctx.textAlign = 'center';
          ctx.fillText('🎯 TARGET', hp.x, hp.y - 28);
          ctx.textAlign = 'left';
          ctx.restore();

          // Off-screen arrow if target is out of view
          if (hp.x < -40 || hp.x > w + 40 || hp.y < -40 || hp.y > h + 40) {
            drawDirectionArrow(ctx, w, h, hp.x, hp.y, t);
          }
        }
      }
    }

    // ── Stars ───────────────────────────────────────────────────────
    BRIGHT_STARS.forEach(star => {
      const pos = starPositions[star.id];
      if (!pos) return;
      const margin = 80;
      if (pos.x < -margin || pos.x > w + margin || pos.y < -margin || pos.y > h + margin) return;

      const size = magnitudeToSize(star.magnitude);
      const opacity = magnitudeToOpacity(star.magnitude);
      const colorHex = getStarColorHex(star.color || 'white');
      const isOwned = ownedStars[star.id] || ownedStars[star.hip_id] || ownedStars[star.name?.toLowerCase()];
      const isHuntTarget = huntTarget && (star.name === huntTarget || star.id === huntTarget);
      const twinkle = Math.sin(t * 1.8 + star.ra * 0.07) * 0.15 + 0.85;

      ctx.save();

      // Glow halo
      const glowR = isOwned ? 'rgba(251, 191, 36, ' : isHuntTarget ? 'rgba(34, 211, 238, ' : `rgba(${hexToRgb(colorHex)}, `;
      const glowGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size * 5);
      glowGrad.addColorStop(0, glowR + (opacity * twinkle * 0.9) + ')');
      glowGrad.addColorStop(0.5, glowR + (opacity * twinkle * 0.25) + ')');
      glowGrad.addColorStop(1, glowR + '0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size * 5, 0, Math.PI * 2);
      ctx.fill();

      // Core
      const coreColor = isOwned ? `rgba(251,191,36,${opacity * twinkle})`
        : isHuntTarget ? `rgba(34,211,238,${opacity * twinkle})`
        : `rgba(${hexToRgb(colorHex)},${opacity * twinkle})`;
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fill();

      // Spike cross for bright stars (magnitude < 1)
      if (star.magnitude < 1) {
        ctx.save();
        ctx.strokeStyle = coreColor;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.4;
        const spikeLen = size * 3;
        ctx.beginPath();
        ctx.moveTo(pos.x - spikeLen, pos.y);
        ctx.lineTo(pos.x + spikeLen, pos.y);
        ctx.moveTo(pos.x, pos.y - spikeLen);
        ctx.lineTo(pos.x, pos.y + spikeLen);
        ctx.stroke();
        ctx.restore();
      }

      // Labels
      if (star.magnitude < 1.8 || isOwned || isHuntTarget) {
        ctx.fillStyle = isOwned ? 'rgba(251,191,36,0.95)' : isHuntTarget ? 'rgba(34,211,238,0.9)' : 'rgba(200,220,255,0.75)';
        ctx.font = isOwned ? 'bold 11px Space Grotesk' : '10px Space Grotesk';
        ctx.fillText(star.name, pos.x + size + 5, pos.y - 1);
      }

      // Owner tag
      if (isOwned) {
        const pulse2 = Math.sin(t * 2 + star.ra) * 0.15 + 0.85;
        // Dashed ownership ring (pulsing)
        ctx.strokeStyle = `rgba(251,191,36,${0.35 * pulse2})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size + 6 + pulse2 * 2, 0, Math.PI * 2);
        ctx.stroke();
        // "★ Owner" badge
        ctx.font = 'bold 9px Space Grotesk';
        ctx.fillStyle = `rgba(251,191,36,${0.8 * pulse2})`;
        ctx.fillText(`★ ${isOwned}`, pos.x + size + 5, pos.y + 11);
      }

      // Myth overlay (zodiac figure silhouette on constellation)
      if (showMythOverlay && star.magnitude < 2) {
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = 'rgba(167, 139, 250, 1)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size * 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    });

    // ── Planets ─────────────────────────────────────────────────────
    PLANETS.forEach((planet, i) => {
      const angle = t * 0.04 + i * (Math.PI * 2 / PLANETS.length);
      const px = w * 0.15 + Math.cos(angle * 0.25 + i * 1.3) * w * 0.35 + i * w * 0.08;
      const py = h * 0.12 + Math.sin(angle * 0.18 + i) * h * 0.08;
      if (px < -20 || px > w + 20) return;

      ctx.save();
      const pg = ctx.createRadialGradient(px, py, 0, px, py, 14);
      pg.addColorStop(0, planet.color + 'dd');
      pg.addColorStop(1, planet.color + '00');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = planet.color;
      ctx.beginPath();
      ctx.arc(px, py, planet.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,220,100,0.75)';
      ctx.font = `${planet.symbol} 8px Space Grotesk`;
      ctx.font = '9px Space Grotesk';
      ctx.fillText(`${planet.symbol} ${planet.name}`, px + planet.size + 4, py + 3);
      ctx.restore();
    });

    // ── Milky Way band ──────────────────────────────────────────────
    ctx.save();
    const mwG = ctx.createLinearGradient(w * 0.25, 0, w * 0.75, h);
    mwG.addColorStop(0, 'rgba(100,120,180,0)');
    mwG.addColorStop(0.35, 'rgba(100,120,200,0.05)');
    mwG.addColorStop(0.5, 'rgba(120,140,220,0.07)');
    mwG.addColorStop(0.65, 'rgba(100,120,200,0.05)');
    mwG.addColorStop(1, 'rgba(80,100,160,0)');
    ctx.fillStyle = mwG;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    ctx.restore(); // pop the scale
    animFrameRef.current = requestAnimationFrame(draw);
  }, [azimuth, altitude, projectStar, ownedStars, huntTarget, showMythOverlay, fovRad]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    const clickY = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
    const w = rect.width;
    const h = rect.height;

    let closest = null;
    let closestDist = 44;
    BRIGHT_STARS.forEach(star => {
      const pos = projectStar(star.ra, star.dec, w, h);
      const dist = Math.hypot(pos.x - clickX, pos.y - clickY);
      if (dist < closestDist) { closestDist = dist; closest = star; }
    });
    if (closest && onStarClick) onStarClick(closest);
  }, [projectStar, onStarClick]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="w-full h-full cursor-crosshair"
      style={{ touchAction: 'none' }}
    />
  );
}

// Draw a pulsing arrow at screen edge pointing toward off-screen target
function drawDirectionArrow(ctx, w, h, tx, ty, t) {
  const cx = w / 2;
  const cy = h / 2;
  const angle = Math.atan2(ty - cy, tx - cx);
  const margin = 40;
  const edgeX = Math.max(margin, Math.min(w - margin, cx + Math.cos(angle) * (w / 2 - margin)));
  const edgeY = Math.max(margin, Math.min(h - margin, cy + Math.sin(angle) * (h / 2 - margin)));
  const pulse = Math.sin(t * 5) * 0.4 + 0.6;

  ctx.save();
  ctx.translate(edgeX, edgeY);
  ctx.rotate(angle);
  ctx.globalAlpha = pulse;

  // Arrow shape
  ctx.fillStyle = 'rgba(34, 211, 238, 0.9)';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-8, -8);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
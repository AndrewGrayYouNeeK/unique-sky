import { useRef, useEffect, useCallback } from 'react';
import { BRIGHT_STARS, PLANETS, getStarColorHex, magnitudeToSize, magnitudeToOpacity } from '@/lib/starData';

export default function StarCanvas({ azimuth, altitude, fov = 80, yearOffset = 0, onStarClick, ownedStars = {} }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const timeRef = useRef(Date.now());

  const projectStar = useCallback((ra, dec, az, alt, w, h) => {
    // Apply year offset to RA (precession simulation)
    const precession = yearOffset * 0.013889; // ~50"/year
    const adjustedRa = (ra + precession) % 360;

    // Convert to radians
    const raRad = (adjustedRa * Math.PI) / 180;
    const decRad = (dec * Math.PI) / 180;
    const azRad = (az * Math.PI) / 180;
    const altRad = (alt * Math.PI) / 180;

    const fovRad = (fov * Math.PI) / 180;

    // Angular separation from center
    const dRa = raRad - azRad * 2;
    const dDec = decRad - altRad;

    const px = w / 2 + (dRa / fovRad) * w * 0.6;
    const py = h / 2 - (dDec / fovRad) * h * 0.6;

    return { x: px, y: py };
  }, [fov, yearOffset]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Sky gradient background
    const skyGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h));
    skyGrad.addColorStop(0, 'rgba(8, 15, 40, 0.0)');
    skyGrad.addColorStop(1, 'rgba(2, 6, 18, 0.0)');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    const t = (Date.now() - timeRef.current) / 1000;

    // Draw constellation lines first
    const starPositions = {};
    BRIGHT_STARS.forEach(star => {
      const pos = projectStar(star.ra, star.dec, azimuth, altitude, w, h);
      starPositions[star.id] = pos;
    });

    // Constellation lines
    const constellationGroups = {};
    BRIGHT_STARS.forEach(star => {
      if (!constellationGroups[star.constellation]) {
        constellationGroups[star.constellation] = [];
      }
      constellationGroups[star.constellation].push(star);
    });

    Object.entries(constellationGroups).forEach(([constellation, stars]) => {
      if (stars.length < 2) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.15)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 8]);
      ctx.lineDashOffset = t * 2;

      for (let i = 0; i < stars.length - 1; i++) {
        const a = starPositions[stars[i].id];
        const b = starPositions[stars[i + 1].id];
        if (!a || !b) continue;
        // Only draw lines if both stars are on screen (with margin)
        const margin = 200;
        if (a.x > -margin && a.x < w + margin && b.x > -margin && b.x < w + margin) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    });

    // Draw stars
    BRIGHT_STARS.forEach(star => {
      const pos = starPositions[star.id];
      if (!pos) return;

      const margin = 60;
      if (pos.x < -margin || pos.x > w + margin || pos.y < -margin || pos.y > h + margin) return;

      const size = magnitudeToSize(star.magnitude);
      const opacity = magnitudeToOpacity(star.magnitude);
      const colorHex = getStarColorHex(star.color || 'white');
      const isOwned = ownedStars[star.id];

      // Twinkle
      const twinkle = Math.sin(t * 2 + star.ra * 0.1) * 0.2 + 0.8;

      ctx.save();

      // Glow
      const glowColor = isOwned ? 'rgba(251, 191, 36, ' : `rgba(${hexToRgb(colorHex)}, `;
      const glowGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size * 4);
      glowGrad.addColorStop(0, glowColor + (opacity * twinkle * 0.8) + ')');
      glowGrad.addColorStop(0.4, glowColor + (opacity * twinkle * 0.3) + ')');
      glowGrad.addColorStop(1, glowColor + '0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size * 4, 0, Math.PI * 2);
      ctx.fill();

      // Core star dot
      ctx.fillStyle = isOwned ? `rgba(251, 191, 36, ${opacity * twinkle})` : `rgba(${hexToRgb(colorHex)}, ${opacity * twinkle})`;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fill();

      // Star name label
      if (star.magnitude < 1.5 || isOwned) {
        ctx.fillStyle = isOwned ? 'rgba(251, 191, 36, 0.9)' : 'rgba(200, 220, 255, 0.7)';
        ctx.font = isOwned ? 'bold 11px Space Grotesk' : '10px Space Grotesk';
        ctx.fillText(star.name, pos.x + size + 4, pos.y - 2);
      }

      // Owner tag
      if (isOwned) {
        const ownerText = `★ ${isOwned}`;
        ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
        ctx.font = '9px Space Grotesk';
        ctx.fillText(ownerText, pos.x + size + 4, pos.y + 10);

        // Ownership ring
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    });

    // Draw planets (simplified positions)
    PLANETS.forEach((planet, i) => {
      const angle = (t * 0.05 + i * 60) * Math.PI / 180;
      const px = w * 0.1 + Math.cos(angle * 0.3 + i) * w * 0.4 + w * 0.1 * i;
      const py = h * 0.15 + Math.sin(angle * 0.2 + i) * h * 0.1;

      // Check if roughly in view
      if (px < -30 || px > w + 30) return;

      ctx.save();
      const planGlow = ctx.createRadialGradient(px, py, 0, px, py, 12);
      planGlow.addColorStop(0, planet.color + 'cc');
      planGlow.addColorStop(1, planet.color + '00');
      ctx.fillStyle = planGlow;
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = planet.color;
      ctx.beginPath();
      ctx.arc(px, py, planet.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,220,100,0.7)';
      ctx.font = '9px Space Grotesk';
      ctx.fillText(planet.name, px + planet.size + 3, py - 2);
      ctx.restore();
    });

    // Milky Way band (subtle)
    ctx.save();
    const mwGrad = ctx.createLinearGradient(w * 0.3, 0, w * 0.7, h);
    mwGrad.addColorStop(0, 'rgba(100, 120, 180, 0.0)');
    mwGrad.addColorStop(0.3, 'rgba(100, 120, 200, 0.04)');
    mwGrad.addColorStop(0.5, 'rgba(120, 140, 220, 0.06)');
    mwGrad.addColorStop(0.7, 'rgba(100, 120, 200, 0.04)');
    mwGrad.addColorStop(1, 'rgba(80, 100, 160, 0.0)');
    ctx.fillStyle = mwGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    animFrameRef.current = requestAnimationFrame(draw);
  }, [azimuth, altitude, projectStar, ownedStars]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
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
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    let closest = null;
    let closestDist = 40;

    BRIGHT_STARS.forEach(star => {
      const pos = projectStar(star.ra, star.dec, azimuth, altitude, w, h);
      const dist = Math.hypot(pos.x - clickX, pos.y - clickY);
      if (dist < closestDist) {
        closestDist = dist;
        closest = star;
      }
    });

    if (closest && onStarClick) onStarClick(closest);
  }, [azimuth, altitude, projectStar, onStarClick]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="w-full h-full cursor-crosshair"
      style={{ touchAction: 'none' }}
    />
  );
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
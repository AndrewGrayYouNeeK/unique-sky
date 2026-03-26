import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, ChevronDown, ChevronUp, Crosshair, Wifi, WifiOff } from 'lucide-react';
import StarCanvas from '@/components/sky/StarCanvas';
import StarDetailModal from '@/components/sky/StarDetailModal';
import StarPurchaseModal from '@/components/purchase/StarPurchaseModal';
import CompassRose from '@/components/sky/CompassRose';
import DirectionHUD from '@/components/sky/DirectionHUD';
import TimeSlider from '@/components/sky/TimeSlider';
import { base44 } from '@/api/base44Client';

export default function ARSkyView() {
  const [azimuth, setAzimuth] = useState(180);
  const [altitude, setAltitude] = useState(45);
  const [yearOffset, setYearOffset] = useState(0);
  const [selectedStar, setSelectedStar] = useState(null);
  const [purchaseStar, setPurchaseStar] = useState(null);
  const [showTimeSlider, setShowTimeSlider] = useState(false);
  const [ownedStars, setOwnedStars] = useState({});
  const [hasMotion, setHasMotion] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);
  const containerRef = useRef(null);

  // Load owned stars
  useEffect(() => {
    base44.entities.Star.filter({ is_named: true }, '-ownership_date', 100)
      .then(stars => {
        const map = {};
        stars.forEach(s => { if (s.is_named && s.owner_name) map[s.id || s.name.toLowerCase()] = s.owner_name; });
        setOwnedStars(map);
      })
      .catch(() => {});
  }, []);

  // Device orientation (AR)
  useEffect(() => {
    const handleOrientation = (e) => {
      if (e.alpha !== null) {
        setHasMotion(true);
        setAzimuth(e.alpha || 0);
        setAltitude(Math.min(90, Math.max(-90, 90 - (e.beta || 45))));
      }
    };

    if (window.DeviceOrientationEvent) {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+
        DeviceOrientationEvent.requestPermission()
          .then(perm => { if (perm === 'granted') window.addEventListener('deviceorientation', handleOrientation); })
          .catch(() => {});
      } else {
        window.addEventListener('deviceorientation', handleOrientation);
      }
    }

    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  // Manual drag/pan
  const handlePointerDown = useCallback((e) => {
    if (hasMotion) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX || e.touches?.[0]?.clientX, y: e.clientY || e.touches?.[0]?.clientY, az: azimuth, alt: altitude };
  }, [hasMotion, azimuth, altitude]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging || !dragStart.current) return;
    const cx = e.clientX || e.touches?.[0]?.clientX;
    const cy = e.clientY || e.touches?.[0]?.clientY;
    const dx = cx - dragStart.current.x;
    const dy = cy - dragStart.current.y;
    setAzimuth((dragStart.current.az - dx * 0.3 + 360) % 360);
    setAltitude(Math.min(90, Math.max(-90, dragStart.current.alt + dy * 0.2)));
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  const handleStarClaimed = useCallback((claimedStar) => {
    setOwnedStars(prev => ({ ...prev, [claimedStar.id || claimedStar.name.toLowerCase()]: claimedStar.owner_name }));
    setPurchaseStar(null);
  }, []);

  return (
    <div className="fixed inset-0 sky-gradient overflow-hidden">
      {/* Subtle scan line effect */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        <div className="animate-scan w-full h-24" style={{ background: 'linear-gradient(to bottom, transparent, rgba(34, 211, 238, 0.015), transparent)' }} />
      </div>

      {/* Stars canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
      >
        <StarCanvas
          azimuth={azimuth}
          altitude={altitude}
          yearOffset={yearOffset}
          onStarClick={setSelectedStar}
          ownedStars={ownedStars}
        />
      </div>

      {/* Crosshair center */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <Crosshair size={28} className="text-accent/30" strokeWidth={1} />
      </div>

      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4">
        <div className="flex items-start justify-between">
          {/* App title */}
          <div>
            <h1 className="nebula-text font-space font-bold text-xl leading-none">Unique Sky</h1>
            <p className="text-muted-foreground text-xs mt-0.5 font-inter">
              {hasMotion ? (
                <span className="flex items-center gap-1 text-accent"><Wifi size={10} /> Live AR</span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground"><WifiOff size={10} /> Drag to explore</span>
              )}
            </p>
          </div>

          {/* Direction HUD */}
          <DirectionHUD azimuth={azimuth} altitude={altitude} />

          {/* Compass */}
          <CompassRose azimuth={azimuth} />
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-20 left-0 right-0 z-30 px-4 space-y-3">
        {/* Time slider toggle */}
        <AnimatePresence>
          {showTimeSlider && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <TimeSlider yearOffset={yearOffset} onChange={setYearOffset} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Control row */}
        <div className="flex items-center gap-3">
          {/* Time travel toggle */}
          <button
            onClick={() => setShowTimeSlider(v => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl glass-dark border text-sm font-space transition-all ${
              showTimeSlider ? 'border-star-gold/50 text-star-gold' : 'border-border/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings2 size={14} />
            Time Travel
            {showTimeSlider ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          {/* Year badge */}
          {yearOffset !== 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-3 py-2.5 rounded-xl glass-dark border border-accent/30 text-accent text-sm font-space"
            >
              {yearOffset > 0 ? `+${yearOffset}yr` : `${yearOffset}yr`}
            </motion.div>
          )}

          {/* Reset time */}
          {yearOffset !== 0 && (
            <button
              onClick={() => setYearOffset(0)}
              className="px-3 py-2.5 rounded-xl glass-dark border border-border/50 text-muted-foreground text-sm font-space hover:text-foreground transition-colors"
            >
              Now
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedStar && !purchaseStar && (
        <StarDetailModal
          star={{
            ...selectedStar,
            is_named: ownedStars[selectedStar.id] !== undefined,
            owner_name: ownedStars[selectedStar.id],
          }}
          onClose={() => setSelectedStar(null)}
          onBuyName={(star) => { setSelectedStar(null); setPurchaseStar(star); }}
        />
      )}

      {purchaseStar && (
        <StarPurchaseModal
          star={purchaseStar}
          onClose={() => setPurchaseStar(null)}
          onSuccess={handleStarClaimed}
        />
      )}
    </div>
  );
}
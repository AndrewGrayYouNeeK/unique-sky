import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings2, ChevronDown, ChevronUp, Crosshair,
  Wifi, WifiOff, Sparkles, Target, WifiOff as OfflineIcon, Zap
} from 'lucide-react';
import StarCanvas from '@/components/sky/StarCanvas';
import StarDetailModal from '@/components/sky/StarDetailModal';
import StarPurchaseModal from '@/components/purchase/StarPurchaseModal';
import CompassRose from '@/components/sky/CompassRose';
import DirectionHUD from '@/components/sky/DirectionHUD';
import AltitudeRingHUD from '@/components/sky/AltitudeRingHUD';
import TimeSlider from '@/components/sky/TimeSlider';
import { base44 } from '@/api/base44Client';
import { queueClaim, setupQueueFlusher, hasPendingClaims, getQueue, removeFromQueue } from '@/lib/offlineQueue';

export default function ARSkyView() {
  const [azimuth, setAzimuth] = useState(180);
  const [altitude, setAltitude] = useState(45);
  const [yearOffset, setYearOffset] = useState(0);
  const [selectedStar, setSelectedStar] = useState(null);
  const [purchaseStar, setPurchaseStar] = useState(null);
  const [showTimeSlider, setShowTimeSlider] = useState(false);
  const [showMythOverlay, setShowMythOverlay] = useState(false);
  const [ownedStars, setOwnedStars] = useState({});
  const [hasMotion, setHasMotion] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingClaims, setPendingClaims] = useState(hasPendingClaims());
  const [huntTarget, setHuntTarget] = useState(() => localStorage.getItem('uniquesky_active_hunt') || null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);
  const motionPermAsked = useRef(false);

  // Online / offline tracking
  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // Flush offline queue on reconnect
  useEffect(() => {
    const cleanup = setupQueueFlusher(async (queue) => {
      for (const claim of queue) {
        try {
          const res = await base44.functions.invoke('claimStar', claim);
          if (res.data?.success) {
            removeFromQueue(claim.id);
            setOwnedStars(prev => ({ ...prev, [claim.star_id]: claim.buyer_name }));
          }
        } catch { /* leave in queue */ }
      }
      setPendingClaims(hasPendingClaims());
    });
    return cleanup;
  }, []);

  // Load owned stars
  useEffect(() => {
    base44.entities.Star.filter({ is_named: true }, '-ownership_date', 100)
      .then(stars => {
        const map = {};
        stars.forEach(s => {
          if (s.is_named && s.owner_name) {
            map[s.hip_id] = s.owner_name;
            map[s.name?.toLowerCase()] = s.owner_name;
          }
        });
        setOwnedStars(map);
      })
      .catch(() => {});
  }, []);

  // Device orientation
  useEffect(() => {
    const handleOrientation = (e) => {
      if (e.alpha !== null && e.alpha !== undefined) {
        setHasMotion(true);
        setAzimuth(((e.alpha || 0) + 360) % 360);
        // beta: 0=flat, 90=upright facing up, 180=flat upside-down
        const tilt = Math.max(-90, Math.min(90, 90 - (e.beta || 45)));
        setAltitude(tilt);
      }
    };

    if (window.DeviceOrientationEvent) {
      if (typeof DeviceOrientationEvent.requestPermission === 'function' && !motionPermAsked.current) {
        motionPermAsked.current = true;
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
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    dragStart.current = { x: cx, y: cy, az: azimuth, alt: altitude };
  }, [hasMotion, azimuth, altitude]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging || !dragStart.current) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    const dx = cx - dragStart.current.x;
    const dy = cy - dragStart.current.y;
    setAzimuth(((dragStart.current.az - dx * 0.25) + 360) % 360);
    setAltitude(Math.min(90, Math.max(-90, dragStart.current.alt + dy * 0.18)));
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  const handleStarClaimed = useCallback((claimedStar) => {
    setOwnedStars(prev => ({
      ...prev,
      [claimedStar.hip_id || claimedStar.id]: claimedStar.owner_name,
      [claimedStar.name?.toLowerCase()]: claimedStar.owner_name,
    }));
    setPurchaseStar(null);
  }, []);

  // Handle offline claim queue
  const handleOfflineClaim = useCallback((claimData) => {
    const entry = queueClaim(claimData);
    // Optimistically show in AR
    setOwnedStars(prev => ({ ...prev, [claimData.star_id]: claimData.buyer_name }));
    setPendingClaims(true);
    setPurchaseStar(null);
    return entry;
  }, []);

  return (
    <div className="fixed inset-0 sky-gradient overflow-hidden">
      {/* Scan line FX */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        <div className="animate-scan w-full h-20" style={{ background: 'linear-gradient(to bottom, transparent, rgba(34,211,238,0.012), transparent)' }} />
      </div>

      {/* Star canvas */}
      <div
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
          huntTarget={huntTarget}
          showMythOverlay={showMythOverlay}
        />
      </div>

      {/* Center crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <Crosshair size={30} className="text-accent/25" strokeWidth={1} />
      </div>

      {/* ── Top HUD ─────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 pt-4">
        <div className="flex items-start justify-between gap-2">

          {/* App title + status */}
          <div className="flex flex-col gap-1">
            <h1 className="nebula-text font-space font-bold text-xl leading-none">Unique Sky</h1>
            <div className="flex items-center gap-2">
              {hasMotion ? (
                <span className="flex items-center gap-1 text-accent text-[10px] font-space"><Wifi size={9} /> Live AR</span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground text-[10px] font-space"><WifiOff size={9} /> Drag sky</span>
              )}
              {!isOnline && (
                <span className="flex items-center gap-1 text-star-gold text-[10px] font-space bg-star-gold/10 px-1.5 py-0.5 rounded border border-star-gold/30">
                  <OfflineIcon size={8} /> Offline
                </span>
              )}
              {pendingClaims && (
                <span className="flex items-center gap-1 text-secondary text-[10px] font-space bg-secondary/10 px-1.5 py-0.5 rounded border border-secondary/30">
                  <Zap size={8} /> {getQueue().length} queued
                </span>
              )}
            </div>
          </div>

          {/* Az/Alt HUD */}
          <DirectionHUD azimuth={azimuth} altitude={altitude} />

          {/* Compass rose */}
          <CompassRose azimuth={azimuth} />
        </div>
      </div>

      {/* ── Right side altitude indicator ──────────────────────── */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
        <AltitudeRingHUD altitude={altitude} />
      </div>

      {/* ── Hunt active banner ──────────────────────────────────── */}
      <AnimatePresence>
        {huntTarget && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-4 right-4 z-30"
          >
            <div className="glass-dark rounded-xl px-4 py-2.5 flex items-center gap-3 border border-accent/30">
              <Target size={16} className="text-accent flex-shrink-0" />
              <div className="flex-1">
                <p className="text-accent text-sm font-space font-semibold">Hunt Active</p>
                <p className="text-muted-foreground text-xs">Find & tap: <span className="text-foreground">{huntTarget}</span></p>
              </div>
              <button onClick={() => { setHuntTarget(null); localStorage.removeItem('uniquesky_active_hunt'); }} className="text-muted-foreground text-xs hover:text-foreground font-space">✕ Stop</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom controls ─────────────────────────────────────── */}
      <div className="absolute bottom-20 left-0 right-0 z-30 px-4 space-y-3">
        <AnimatePresence>
          {showTimeSlider && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
            >
              <TimeSlider yearOffset={yearOffset} onChange={setYearOffset} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Time travel */}
          <button
            onClick={() => setShowTimeSlider(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl glass-dark border text-xs font-space transition-all ${
              showTimeSlider ? 'border-star-gold/50 text-star-gold' : 'border-border/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings2 size={13} />
            Time
            {showTimeSlider ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>

          {/* Myth overlay */}
          <button
            onClick={() => setShowMythOverlay(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl glass-dark border text-xs font-space transition-all ${
              showMythOverlay ? 'border-secondary/50 text-secondary glow-purple' : 'border-border/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles size={13} />
            Myth AR
          </button>

          {/* Year offset badge */}
          {yearOffset !== 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-3 py-2 rounded-xl glass-dark border border-accent/30 text-accent text-xs font-space"
            >
              {yearOffset > 0 ? `+${yearOffset}y` : `${yearOffset}y`}
            </motion.div>
          )}
          {yearOffset !== 0 && (
            <button
              onClick={() => setYearOffset(0)}
              className="px-3 py-2 rounded-xl glass-dark border border-border/40 text-muted-foreground text-xs font-space hover:text-foreground transition-colors"
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
            is_named: ownedStars[selectedStar.hip_id || selectedStar.id] !== undefined || ownedStars[selectedStar.name?.toLowerCase()] !== undefined,
            owner_name: ownedStars[selectedStar.hip_id || selectedStar.id] || ownedStars[selectedStar.name?.toLowerCase()],
          }}
          onClose={() => setSelectedStar(null)}
          onBuyName={(star) => { setSelectedStar(null); setPurchaseStar(star); }}
        />
      )}

      {purchaseStar && (
        <StarPurchaseModal
          star={purchaseStar}
          isOffline={!isOnline}
          onClose={() => setPurchaseStar(null)}
          onSuccess={handleStarClaimed}
          onOfflineClaim={handleOfflineClaim}
        />
      )}
    </div>
  );
}
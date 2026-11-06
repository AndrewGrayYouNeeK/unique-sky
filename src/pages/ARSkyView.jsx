import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crosshair,
  Wifi, WifiOff, Target, WifiOff as OfflineIcon, Trophy
} from 'lucide-react';
import StarCanvas from '@/components/sky/StarCanvas';
import StarDetailModal from '@/components/sky/StarDetailModal';
import StarPurchaseModal from '@/components/purchase/StarPurchaseModal';
import CompassRose from '@/components/sky/CompassRose';
import DirectionHUD from '@/components/sky/DirectionHUD';
import AltitudeRingHUD from '@/components/sky/AltitudeRingHUD';
import { getNamedStars } from '@/api/apiClient';
import {
  getActiveHuntTarget,
  setActiveHuntTarget,
  findHuntByTargetStar,
  completeHunt,
  starMatchesHuntTarget,
} from '@/lib/hunts';

export default function ARSkyView() {
  const [azimuth, setAzimuth] = useState(180);
  const [altitude, setAltitude] = useState(45);
  const [selectedStar, setSelectedStar] = useState(null);
  const [purchaseStar, setPurchaseStar] = useState(null);
  const [ownedStars, setOwnedStars] = useState({});
  const [ownedStarDetails, setOwnedStarDetails] = useState({});
  const [hasMotion, setHasMotion] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [huntTarget, setHuntTarget] = useState(getActiveHuntTarget());
  const [huntCompleteBanner, setHuntCompleteBanner] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStart = useRef(null);
  const dragMoved = useRef(false);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [skyLocation, setSkyLocation] = useState(null);
  const [skyError, setSkyError] = useState('');
  const enableDeviceSky = async () => {
    setSkyError('');
    const orientation = window.DeviceOrientationEvent;
    if (!orientation) { setSkyError('Motion is unavailable. You can still drag the sky.'); return; }
    try {
      // iOS permission must originate from this button's user gesture.
      if ('requestPermission' in orientation && typeof orientation.requestPermission === 'function') {
        if (await orientation.requestPermission() !== 'granted') throw new Error('Motion permission denied. Drag the sky instead.');
      }
      setMotionEnabled(true);
      navigator.geolocation?.getCurrentPosition(position => {
        setSkyLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      }, () => setSkyError('Location unavailable. Showing a catalog preview; drag to explore.'), { timeout: 10000 });
    } catch (err) { setSkyError(err.message || 'Device sky is unavailable.'); }
  };

  const loadOwnedStars = useCallback(() => {
    getNamedStars({ sort: '-ownership_date', limit: 100 })
      .then(stars => {
        const map = {};
        const details = {};
        stars.forEach(s => {
          if (s.is_named && s.owner_name) {
            map[s.hip_id] = s.owner_name;
            map[s.name?.toLowerCase()] = s.owner_name;
            details[s.hip_id || s.name?.toLowerCase()] = s;
          }
        });
        setOwnedStars(map);
        setOwnedStarDetails(details);
      })
      .catch(err => setSkyError(`Claims unavailable: ${err.message}`));
  }, []);

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  useEffect(() => {
    loadOwnedStars();
  }, [loadOwnedStars]);

  useEffect(() => {
    const handleOrientation = (e) => {
      if (isDraggingRef.current) return;
      if (e.alpha === null || e.alpha === undefined) return;

      setHasMotion(true);

      const alpha = e.alpha || 0;
      const beta  = e.beta  || 0;
      const gamma = e.gamma || 0;

      const altitudeVal = Math.max(-90, Math.min(90, beta - 90));
      const gammaRad = (gamma * Math.PI) / 180;
      const heading = 'webkitCompassHeading' in e && typeof e.webkitCompassHeading === 'number' ? e.webkitCompassHeading : 360 - alpha;
      const azimuthCorrected = ((heading + Math.sin(gammaRad) * 90) + 360) % 360;

      setAzimuth(azimuthCorrected);
      setAltitude(-altitudeVal);
    };

    if (motionEnabled) window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [motionEnabled]);

  const handlePointerDown = useCallback((e) => {
    dragMoved.current = false;
    isDraggingRef.current = true;
    setIsDragging(true);
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    dragStart.current = { x: cx, y: cy, az: azimuth, alt: altitude };
  }, [azimuth, altitude]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging || !dragStart.current) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    const dx = cx - dragStart.current.x;
    const dy = cy - dragStart.current.y;
    if (Math.hypot(dx, dy) > 6) dragMoved.current = true;
    setAzimuth(((dragStart.current.az - dx * 0.25) + 360) % 360);
    setAltitude(Math.min(90, Math.max(-90, dragStart.current.alt + dy * 0.18)));
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
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
    loadOwnedStars();
  }, [loadOwnedStars]);

  const handleStarClick = useCallback(async (star) => {
    if (dragMoved.current) return;
    if (huntTarget && starMatchesHuntTarget(star, huntTarget)) {
      const hunt = findHuntByTargetStar(huntTarget);
      if (hunt) {
        const result = await completeHunt(hunt.id).catch(err => { setSkyError(`Hunt not saved: ${err.message}. Tap the target to retry.`); return null; });
        if (result) {
          setHuntTarget(null);
          setActiveHuntTarget(null);
          setHuntCompleteBanner({ hunt, points: hunt.points });
          setTimeout(() => setHuntCompleteBanner(null), 4000);
        }
      }
    }
    setSelectedStar(star);
  }, [huntTarget]);

  const stopHunt = () => {
    setHuntTarget(null);
    setActiveHuntTarget(null);
  };

  return (
    <div className="fixed inset-0 sky-gradient overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        <div className="animate-scan w-full h-20" style={{ background: 'linear-gradient(to bottom, transparent, rgba(34,211,238,0.012), transparent)' }} />
      </div>

      <div
        className="absolute inset-0"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
        style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'crosshair' }}
      >
        <StarCanvas
          location={skyLocation}
          azimuth={azimuth}
          altitude={altitude}
          onStarClick={handleStarClick}
          ownedStars={ownedStars}
          huntTarget={huntTarget}
        />
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <Crosshair size={30} className="text-accent/25" strokeWidth={1} />
      </div>

      <div className="absolute top-0 left-0 right-0 z-30 p-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h1 className="nebula-text font-space font-bold text-xl leading-none">YouneeK Stars</h1>
            <div className="flex items-center gap-2">
              {hasMotion ? (
                <span className="flex items-center gap-1 text-accent text-[10px] font-space"><Wifi size={9} /> {skyLocation ? 'Device sky · approximate' : 'Device sky · catalog preview'}</span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground text-[10px] font-space"><WifiOff size={9} /> Drag sky · catalog preview</span>
              )}
              {!isOnline && (
                <span className="flex items-center gap-1 text-star-gold text-[10px] font-space bg-star-gold/10 px-1.5 py-0.5 rounded border border-star-gold/30">
                  <OfflineIcon size={8} /> Offline
                </span>
              )}
            </div>
          </div>
          <DirectionHUD azimuth={azimuth} altitude={altitude} />
          <CompassRose azimuth={azimuth} />
        </div>
      </div>

      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
        <AltitudeRingHUD altitude={altitude} />
      </div>

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
              <button onClick={stopHunt} className="text-muted-foreground text-xs hover:text-foreground font-space">✕ Stop</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {huntCompleteBanner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute top-20 left-4 right-4 z-40"
          >
            <div className="glass-dark rounded-xl px-4 py-3 flex items-center gap-3 border border-star-gold/40 bg-star-gold/10">
              <Trophy size={18} className="text-star-gold flex-shrink-0" />
              <div>
                <p className="text-star-gold text-sm font-space font-bold">Hunt Complete!</p>
                <p className="text-foreground text-xs">{huntCompleteBanner.hunt.title} · +{huntCompleteBanner.points} pts</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-20 left-0 right-0 z-30 px-4 space-y-3">
        {skyError && <p role="alert" className="glass-dark p-3 rounded-xl text-sm">{skyError}</p>}
        <button onClick={enableDeviceSky} className="glass-dark border border-accent/40 text-accent px-3 py-2 rounded-xl text-sm">Enable device sky</button>
      </div>

      {selectedStar && !purchaseStar && (
        <StarDetailModal
          star={{
            ...selectedStar,
            ...ownedStarDetails[selectedStar.hip_id || selectedStar.id] || ownedStarDetails[selectedStar.name?.toLowerCase()],
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
          onClose={() => setPurchaseStar(null)}
          onSuccess={handleStarClaimed}
        />
      )}
    </div>
  );
}

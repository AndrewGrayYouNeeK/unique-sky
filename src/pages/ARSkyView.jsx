import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crosshair, Plus, Minus, Bug,
  Wifi, WifiOff, Target, WifiOff as OfflineIcon, Trophy
} from 'lucide-react';
import StarCanvas from '@/components/sky/StarCanvas';
import StarDetailModal from '@/components/sky/StarDetailModal';
import ScientistPanel from '@/components/sky/ScientistPanel';
import ScientistDetailCard from '@/components/sky/ScientistDetailCard';
import StarPurchaseModal from '@/components/purchase/StarPurchaseModal';
import CompassRose from '@/components/sky/CompassRose';
import DirectionHUD from '@/components/sky/DirectionHUD';
import AltitudeRingHUD from '@/components/sky/AltitudeRingHUD';
import { getNamedStars } from '@/api/apiClient';
import { orientationToSky, smoothVector, vectorsToSky } from '@/lib/orientation';
import { DEFAULT_FOV, MIN_FOV, MAX_FOV, magnitudeLimitForFov } from '@/lib/catalogTiles';
import { equatorialToHorizontal } from '@/lib/astronomy';
import {
  getActiveHuntTarget,
  setActiveHuntTarget,
  findHuntByTargetStar,
  completeHunt,
  starMatchesHuntTarget,
} from '@/lib/hunts';

const FLIP_LR_KEY = 'youneek_debug_flip_lr';
const FLIP_ALT_KEY = 'youneek_debug_flip_alt';
const SCIENTIST_KEY = 'youneek_scientist_mode';
const readFlag = key => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
const writeFlag = (key, value) => { try { if (value) localStorage.setItem(key, '1'); else localStorage.removeItem(key); } catch { /* private mode */ } };
const clampFov = f => Math.max(MIN_FOV, Math.min(MAX_FOV, f));
const screenAngle = () => (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number'
  ? screen.orientation.angle
  : typeof window.orientation === 'number' ? window.orientation : 0);

export default function ARSkyView() {
  // The live view lives in a ref so 60 Hz sensor/gesture updates never re-render React;
  // the HUD reads a throttled copy.
  const viewRef = useRef({ azimuth: 180, altitude: 45, roll: 0, fov: DEFAULT_FOV });
  const [hud, setHud] = useState({ azimuth: 180, altitude: 45, fov: DEFAULT_FOV });
  const hudTimer = useRef(null);
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
  const pinchStart = useRef(null);
  const dragMoved = useRef(false);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [skyLocation, setSkyLocation] = useState(null);
  const [skyError, setSkyError] = useState('');
  const [flipLR, setFlipLR] = useState(() => readFlag(FLIP_LR_KEY));
  const [flipAlt, setFlipAlt] = useState(() => readFlag(FLIP_ALT_KEY));
  const [showDebug, setShowDebug] = useState(false);
  const [scientistMode, setScientistMode] = useState(() => readFlag(SCIENTIST_KEY));
  const [scientistSearchOpen, setScientistSearchOpen] = useState(false);
  const [scientistStar, setScientistStar] = useState(null);
  const flipsRef = useRef({ flipLR, flipAlt });
  flipsRef.current = { flipLR, flipAlt };

  const pushView = useCallback((patch) => {
    Object.assign(viewRef.current, patch);
    if (hudTimer.current) return;
    hudTimer.current = setTimeout(() => {
      hudTimer.current = null;
      const v = viewRef.current;
      setHud({ azimuth: v.azimuth, altitude: v.altitude, fov: v.fov });
    }, 100);
  }, []);
  useEffect(() => () => clearTimeout(hudTimer.current), []);

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
    if (!motionEnabled) return undefined;
    // Android Chrome exposes an Earth-referenced stream as `deviceorientationabsolute`; iOS adds
    // webkitCompassHeading to plain `deviceorientation`. Once absolute data arrives, relative
    // events are ignored so the heading cannot drift.
    const useAbsoluteEvent = 'ondeviceorientationabsolute' in window;
    let gotAbsolute = false;
    let smoothF = null;
    let smoothU = null;
    const handleOrientation = (e) => {
      if (isDraggingRef.current || pinchStart.current) return;
      const sky = orientationToSky(e, { screenAngle: screenAngle() });
      if (!sky) return;
      if (sky.absolute) gotAbsolute = true;
      else if (gotAbsolute) return;
      setHasMotion(true);
      smoothF = smoothVector(smoothF, sky.forward, 0.3);
      smoothU = smoothVector(smoothU, sky.up, 0.3);
      const out = vectorsToSky(smoothF, smoothU);
      const { flipLR: lr, flipAlt: alt } = flipsRef.current;
      pushView({
        azimuth: lr ? (360 - out.azimuth) % 360 : out.azimuth,
        altitude: alt ? -out.altitude : out.altitude,
        roll: lr !== alt ? -out.roll : out.roll,
      });
    };
    const eventName = useAbsoluteEvent ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(eventName, handleOrientation);
    if (useAbsoluteEvent) window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener(eventName, handleOrientation);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [motionEnabled, pushView]);

  // ── Gestures: drag to pan (the sky follows the finger), pinch / wheel / buttons to zoom ──
  const degreesPerPixel = () => viewRef.current.fov / Math.max(window.innerWidth, window.innerHeight);
  const touchDistance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

  const handlePointerDown = useCallback((e) => {
    if (e.touches?.length === 2) {
      pinchStart.current = { dist: touchDistance(e.touches), fov: viewRef.current.fov };
      dragStart.current = null;
      dragMoved.current = true;
      return;
    }
    dragMoved.current = false;
    isDraggingRef.current = true;
    setIsDragging(true);
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    dragStart.current = { x: cx, y: cy, az: viewRef.current.azimuth, alt: viewRef.current.altitude };
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (pinchStart.current && e.touches?.length === 2) {
      pushView({ fov: clampFov(pinchStart.current.fov * pinchStart.current.dist / Math.max(1, touchDistance(e.touches))) });
      return;
    }
    if (!isDraggingRef.current || !dragStart.current) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    const dx = cx - dragStart.current.x;
    const dy = cy - dragStart.current.y;
    if (Math.hypot(dx, dy) > 6) dragMoved.current = true;
    const k = degreesPerPixel();
    // Finger right -> sky moves right -> we look further left (lower azimuth). Finger down -> look up.
    pushView({
      azimuth: ((dragStart.current.az - dx * k) % 360 + 360) % 360,
      altitude: Math.min(90, Math.max(-90, dragStart.current.alt + dy * k)),
      roll: 0,
    });
  }, [pushView]);

  const handlePointerUp = useCallback((e) => {
    if (e?.touches?.length) return; // a finger is still down (end of pinch)
    pinchStart.current = null;
    isDraggingRef.current = false;
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  const zoomBy = useCallback(factor => pushView({ fov: clampFov(viewRef.current.fov * factor) }), [pushView]);
  const surfaceRef = useRef(null);
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return undefined;
    // Non-passive so the page itself doesn't scroll/zoom.
    const onWheel = e => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.0015)); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const toggleFlip = (which) => {
    if (which === 'lr') { setFlipLR(v => { writeFlag(FLIP_LR_KEY, !v); return !v; }); }
    else { setFlipAlt(v => { writeFlag(FLIP_ALT_KEY, !v); return !v; }); }
  };

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
    if (scientistMode) {
      // Prefer a Scientist record shape; curated stars already have ra/dec/ids.
      const sci = star.ra_icrs != null ? star : {
        ...star,
        ra_icrs: star.ra,
        dec_icrs: star.dec,
        mag_v: star.magnitude,
        spectral_type: star.spectral,
        parallax_mas: null,
        provenance: {
          local: { catalog: 'HYG Database v4.1', license: 'CC BY-SA 4.0', source: star.claimable === false ? 'sky-catalog' : 'curated', fields: {} },
          remote: null,
        },
      };
      setScientistStar(sci);
      setSelectedStar(null);
      return;
    }
    setSelectedStar(star);
  }, [huntTarget, scientistMode]);

  const handleScientistSelect = useCallback((star) => {
    setScientistStar(star);
    setScientistSearchOpen(false);
    // Pan toward the target when we have a sky location; otherwise leave the view alone.
    if (skyLocation && star.ra_icrs != null && star.dec_icrs != null) {
      const { azimuth, altitude } = equatorialToHorizontal(
        star.ra_icrs, star.dec_icrs, skyLocation.latitude, skyLocation.longitude,
      );
      pushView({ azimuth, altitude, roll: 0 });
    }
  }, [skyLocation, pushView]);

  const toggleScientistMode = () => {
    setScientistMode(v => {
      const next = !v;
      writeFlag(SCIENTIST_KEY, next);
      if (!next) {
        setScientistSearchOpen(false);
        setScientistStar(null);
      } else {
        setScientistSearchOpen(true);
        setSelectedStar(null);
        setPurchaseStar(null);
      }
      return next;
    });
  };

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
        ref={surfaceRef}
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
          viewRef={viewRef}
          location={skyLocation}
          onStarClick={handleStarClick}
          ownedStars={ownedStars}
          huntTarget={huntTarget}
          selectedStarId={selectedStar?.id || null}
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
          <DirectionHUD azimuth={hud.azimuth} altitude={hud.altitude} />
          <CompassRose azimuth={hud.azimuth} />
        </div>
      </div>

      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2">
        <button aria-label="Zoom in" onClick={() => zoomBy(1 / 1.4)} className="glass-dark border border-accent/40 text-accent w-9 h-9 rounded-full flex items-center justify-center"><Plus size={16} /></button>
        <span className="glass-dark text-[10px] font-space text-muted-foreground px-1.5 py-0.5 rounded" data-testid="fov-readout">{Math.round(hud.fov)}° · mag {magnitudeLimitForFov(hud.fov).toFixed(1)}</span>
        <button aria-label="Zoom out" onClick={() => zoomBy(1.4)} className="glass-dark border border-accent/40 text-accent w-9 h-9 rounded-full flex items-center justify-center"><Minus size={16} /></button>
      </div>

      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
        <AltitudeRingHUD altitude={hud.altitude} />
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
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={enableDeviceSky} className="glass-dark border border-accent/40 text-accent px-3 py-2 rounded-xl text-sm">Enable device sky</button>
          <label className={`glass-dark text-xs font-space px-2.5 py-2 rounded-xl flex items-center gap-1.5 border ${scientistMode ? 'border-accent/50 text-accent' : 'border-border/40 text-muted-foreground'}`}>
            <input
              type="checkbox"
              data-testid="scientist-mode-toggle"
              checked={scientistMode}
              onChange={toggleScientistMode}
            />
            Scientist Mode
          </label>
          {scientistMode && (
            <button
              type="button"
              data-testid="scientist-search-open"
              onClick={() => setScientistSearchOpen(v => !v)}
              className="glass-dark border border-accent/40 text-accent px-3 py-2 rounded-xl text-xs font-space"
            >
              {scientistSearchOpen ? 'Hide search' : 'Search'}
            </button>
          )}
          <button aria-label="Sensor debug" onClick={() => setShowDebug(v => !v)} className="glass-dark border border-border/40 text-muted-foreground p-2 rounded-xl"><Bug size={14} /></button>
          {showDebug && (
            <>
              <label className="glass-dark text-xs font-space px-2 py-1.5 rounded-lg flex items-center gap-1"><input type="checkbox" checked={flipLR} onChange={() => toggleFlip('lr')} /> Flip left/right</label>
              <label className="glass-dark text-xs font-space px-2 py-1.5 rounded-lg flex items-center gap-1"><input type="checkbox" checked={flipAlt} onChange={() => toggleFlip('alt')} /> Flip altitude</label>
            </>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/80 font-inter leading-snug">Star naming is symbolic only and is not recognized by the IAU or any official astronomical body. · Star data: HYG Database v4.1, CC BY-SA 4.0</p>
      </div>

      {scientistMode && (
        <ScientistPanel
          open={scientistSearchOpen && !scientistStar}
          onClose={() => setScientistSearchOpen(false)}
          onSelect={handleScientistSelect}
        />
      )}

      {scientistMode && scientistStar && (
        <ScientistDetailCard star={scientistStar} onClose={() => setScientistStar(null)} />
      )}

      {!scientistMode && selectedStar && !purchaseStar && (
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

      {!scientistMode && purchaseStar && (
        <StarPurchaseModal
          star={purchaseStar}
          onClose={() => setPurchaseStar(null)}
          onSuccess={handleStarClaimed}
        />
      )}
    </div>
  );
}

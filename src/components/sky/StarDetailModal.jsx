import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Zap, Globe, Music, ShoppingBag, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStarColorHex } from '@/lib/starData';
import StarName from '@/components/claims/StarName';
import { DISCLAIMER } from '@/lib/dedication';

export default function StarDetailModal({ star, onClose, onBuyName }) {
  if (!star) return null;

  const colorHex = getStarColorHex(star.color || 'white');
  const isOwned = star.is_named && star.owner_name;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <motion.div
          className="relative w-full max-w-md glass-card rounded-2xl p-6 z-10"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>

          {/* Star glow header */}
          <div className="flex items-center gap-4 mb-5">
            <div className="relative flex-shrink-0">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: `radial-gradient(circle, ${colorHex}33 0%, ${colorHex}11 60%, transparent 100%)`, border: `1px solid ${colorHex}44` }}
              >
                <div className="w-4 h-4 rounded-full" style={{ background: colorHex, boxShadow: `0 0 12px ${colorHex}` }} />
              </div>
              {isOwned && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-star-gold rounded-full flex items-center justify-center">
                  <Lock size={10} className="text-background" />
                </div>
              )}
            </div>
            <div>
              <StarName as="h2" name={star.name} owner={isOwned ? star.owner_name : null} className="text-xl font-space font-bold text-foreground" />
              <p className="text-muted-foreground text-sm font-inter">{star.constellation}</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatBox label="Magnitude" value={star.magnitude?.toFixed(2)} icon={<Zap size={12} />} />
            <StatBox label="Distance" value={star.distance_ly ? `${star.distance_ly.toLocaleString()} ly` : '—'} icon={<Globe size={12} />} />
            <StatBox label="Type" value={star.spectral || '—'} icon={<Star size={12} />} />
          </div>

          {/* Mythology */}
          {star.myth && (
            <div className="mb-5">
              <p className="text-xs font-space uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <Music size={10} /> Mythology
              </p>
              <p className="text-sm text-foreground/80 font-inter leading-relaxed">{star.myth}</p>
            </div>
          )}

          {/* Owner custom myth */}
          {star.custom_myth && (
            <div className="mb-5 p-3 rounded-xl bg-star-gold/10 border border-star-gold/20">
              <p className="text-xs font-space uppercase tracking-widest text-star-gold/70 mb-1.5">★ Owner's Story</p>
              <p className="text-sm text-foreground/80 font-inter leading-relaxed italic">"{star.custom_myth}"</p>
            </div>
          )}

          {(star.bayer || star.hip || star.hd || star.star_key) && (
            <p className="text-[11px] text-muted-foreground font-space mb-4 break-words" data-testid="star-identifiers">
              {[star.bayer, star.flamsteed, star.hip && `HIP ${star.hip}`, star.hd && `HD ${star.hd}`, star.star_key && `key ${star.star_key}`].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* Action: claimable===false covers catalog tiles and objects with no gaia/hip/hd key. */}
          {isOwned ? (
            <div className="w-full py-3 rounded-xl bg-muted/50 border border-border text-center">
              <p className="text-muted-foreground text-sm font-space flex items-center justify-center gap-2">
                <Lock size={14} className="text-star-gold" />
                One edition name per star · already named
              </p>
            </div>
          ) : star.claimable === false ? (
            <div className="w-full py-3 rounded-xl bg-muted/50 border border-border text-center">
              <p className="text-muted-foreground text-sm font-space">
                {star.star_key || star.hip || star.hd
                  ? 'Catalog star · not in the claimable set yet'
                  : 'This sky object has no stable star ID and cannot be named.'}
              </p>
            </div>
          ) : (
            <Button
              onClick={() => onBuyName(star)}
              className="w-full bg-star-gold hover:bg-star-gold/90 text-background font-space font-semibold rounded-xl h-12 glow-gold transition-all"
            >
              <ShoppingBag size={16} className="mr-2" />
              Name This Star — From $10
            </Button>
          )}

          <p className="text-center text-xs text-muted-foreground mt-3 font-inter">
            {DISCLAIMER}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function StatBox({ label, value, icon }) {
  return (
    <div className="bg-muted/50 rounded-xl p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs font-space uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-foreground font-space font-semibold text-sm">{value}</div>
    </div>
  );
}
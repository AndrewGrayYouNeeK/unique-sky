import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Zap, Globe, Music, ShoppingBag, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStarColorHex } from '@/lib/starData';

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
              <h2 className="text-xl font-space font-bold text-foreground">{star.name}</h2>
              <p className="text-muted-foreground text-sm font-inter">{star.constellation}</p>
              {isOwned && (
                <p className="text-star-gold text-xs font-space mt-0.5 flex items-center gap-1">
                  <Star size={10} fill="currentColor" /> Owned by {star.owner_name}
                </p>
              )}
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

          {/* Action */}
          {!isOwned ? (
            <Button
              onClick={() => onBuyName(star)}
              className="w-full bg-star-gold hover:bg-star-gold/90 text-background font-space font-semibold rounded-xl h-12 glow-gold transition-all"
            >
              <ShoppingBag size={16} className="mr-2" />
              Claim This Star — From $10
            </Button>
          ) : (
            <div className="w-full py-3 rounded-xl bg-muted/50 border border-border text-center">
              <p className="text-muted-foreground text-sm font-space flex items-center justify-center gap-2">
                <Lock size={14} className="text-star-gold" />
                Exclusively claimed · <span className="text-star-gold">{star.owner_name}</span>
              </p>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-3 font-inter">
            Symbolic ownership · Not official astronomical naming
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
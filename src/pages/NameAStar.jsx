import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Star, Lock, Crown, Filter, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import StarPurchaseModal from '@/components/purchase/StarPurchaseModal';
import { BRIGHT_STARS, getStarColorHex } from '@/lib/starData';
import { base44 } from '@/api/base44Client';

const FILTERS = ['All Stars', 'Available', 'Claimed', 'Bright', 'Faint'];

export default function NameAStar() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All Stars');
  const [selectedStar, setSelectedStar] = useState(null);
  const [ownedStars, setOwnedStars] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Star.filter({ is_named: true })
      .then(stars => {
        const map = {};
        stars.forEach(s => { map[s.hip_id || s.name.toLowerCase()] = { owner: s.owner_name, tier: s.ownership_tier }; });
        setOwnedStars(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getStarOwnership = (star) => ownedStars[star.id] || ownedStars[star.name.toLowerCase()];

  const filtered = BRIGHT_STARS.filter(star => {
    const ownership = getStarOwnership(star);
    const matchSearch = star.name.toLowerCase().includes(search.toLowerCase()) ||
      star.constellation.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'Available') return !ownership;
    if (filter === 'Claimed') return !!ownership;
    if (filter === 'Bright') return star.magnitude < 1;
    if (filter === 'Faint') return star.magnitude >= 1.5;
    return true;
  });

  const handleSuccess = (star) => {
    setOwnedStars(prev => ({ ...prev, [star.id]: { owner: star.owner_name, tier: star.ownership_tier } }));
    setSelectedStar(null);
  };

  const totalStars = BRIGHT_STARS.length;
  const claimedCount = Object.keys(ownedStars).length;
  const availableCount = totalStars - claimedCount;

  return (
    <div className="min-h-screen sky-gradient pb-24 pt-6">
      {/* Header */}
      <div className="px-4 mb-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="nebula-text font-space font-bold text-3xl mb-1">Name a Star</h1>
          <p className="text-muted-foreground text-sm font-inter">
            Claim a star — your name appears in AR for everyone, forever.
          </p>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          className="flex gap-3 mt-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        >
          <StatPill label="Total Stars" value={totalStars} color="text-foreground" />
          <StatPill label="Claimed" value={claimedCount} color="text-star-gold" />
          <StatPill label="Available" value={availableCount} color="text-accent" />
        </motion.div>

        {/* Scarcity bar */}
        {claimedCount > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1 font-space">
              <span>Stars remaining</span>
              <span className="text-star-gold">{Math.round((availableCount / totalStars) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-star-gold to-secondary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(availableCount / totalStars) * 100}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search stars or constellations..."
            className="pl-9 bg-muted/30 border-border/50 font-space text-sm rounded-xl h-11"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-space transition-all ${
              filter === f
                ? 'bg-star-gold/20 text-star-gold border border-star-gold/30'
                : 'bg-muted/40 text-muted-foreground border border-transparent hover:border-border'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Star grid */}
      <div className="px-4 space-y-2">
        {filtered.map((star, i) => {
          const ownership = getStarOwnership(star);
          const colorHex = getStarColorHex(star.color || 'white');

          return (
            <motion.button
              key={star.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => !ownership && setSelectedStar(star)}
              className={`w-full glass-card rounded-xl p-4 flex items-center gap-4 text-left transition-all ${
                ownership ? 'opacity-70 cursor-default' : 'hover:border-star-gold/30 active:scale-98'
              }`}
            >
              {/* Star icon */}
              <div
                className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ background: `radial-gradient(circle, ${colorHex}30 0%, transparent 70%)`, border: `1px solid ${colorHex}40` }}
              >
                <div className="w-3 h-3 rounded-full star-shimmer" style={{ background: colorHex, boxShadow: `0 0 8px ${colorHex}` }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-space font-semibold text-foreground text-sm">{star.name}</span>
                  {ownership?.tier === 'premium' && <Crown size={12} className="text-secondary flex-shrink-0" />}
                </div>
                <p className="text-muted-foreground text-xs font-inter truncate">{star.constellation} · {star.spectral}</p>
                {ownership ? (
                  <p className="text-star-gold text-xs font-space mt-0.5 flex items-center gap-1">
                    <Lock size={10} /> Owned by {ownership.owner}
                  </p>
                ) : (
                  <p className="text-accent text-xs font-space mt-0.5 flex items-center gap-1">
                    <Sparkles size={10} /> Available — from $10
                  </p>
                )}
              </div>

              {/* Magnitude */}
              <div className="text-right flex-shrink-0">
                <div className="text-foreground font-space font-bold text-sm">{star.magnitude.toFixed(1)}</div>
                <div className="text-muted-foreground text-xs">mag</div>
                {star.distance_ly && <div className="text-muted-foreground text-xs">{star.distance_ly} ly</div>}
              </div>
            </motion.button>
          );
        })}
      </div>

      {selectedStar && (
        <StarPurchaseModal
          star={selectedStar}
          onClose={() => setSelectedStar(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div className="glass-dark rounded-xl px-3 py-2 flex-1 text-center border border-border/30">
      <div className={`font-space font-bold text-lg leading-none ${color}`}>{value}</div>
      <div className="text-muted-foreground text-xs mt-0.5 font-inter">{label}</div>
    </div>
  );
}
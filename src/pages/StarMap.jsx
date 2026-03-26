import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Lock, Star, Crown, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BRIGHT_STARS, getStarColorHex, magnitudeToSize } from '@/lib/starData';

const CONSTELLATIONS = [...new Set(BRIGHT_STARS.map(s => s.constellation))];

export default function StarMap() {
  const [search, setSearch] = useState('');
  const [selectedConstellation, setSelectedConstellation] = useState('All');
  const [hoveredStar, setHoveredStar] = useState(null);

  const filtered = BRIGHT_STARS.filter(star => {
    const matchSearch = star.name.toLowerCase().includes(search.toLowerCase());
    const matchConst = selectedConstellation === 'All' || star.constellation === selectedConstellation;
    return matchSearch && matchConst;
  });

  // Map dimensions
  const W = 800;
  const H = 500;

  // Project RA/Dec to flat map
  const project = (ra, dec) => {
    const x = (ra / 360) * W;
    const y = H / 2 - (dec / 90) * (H / 2);
    return { x, y };
  };

  return (
    <div className="min-h-screen sky-gradient pb-24 pt-6">
      {/* Header */}
      <div className="px-4 mb-5">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="nebula-text font-space font-bold text-3xl mb-1">Star Map</h1>
          <p className="text-muted-foreground text-sm font-inter">Global catalog · {BRIGHT_STARS.length} stars charted</p>
        </motion.div>
      </div>

      {/* Search */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search stars..."
            className="pl-9 bg-muted/30 border-border/50 font-space text-sm rounded-xl h-11"
          />
        </div>
      </div>

      {/* Constellation filter */}
      <div className="px-4 mb-4 flex gap-2 overflow-x-auto pb-1">
        {['All', ...CONSTELLATIONS.slice(0, 12)].map(c => (
          <button
            key={c}
            onClick={() => setSelectedConstellation(c)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-space transition-all ${
              selectedConstellation === c
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'bg-muted/40 text-muted-foreground border border-transparent hover:border-border'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Sky map SVG */}
      <div className="px-4 mb-4">
        <div className="glass-card rounded-2xl overflow-hidden relative">
          <div className="absolute top-3 left-3 text-xs text-muted-foreground font-space z-10 flex items-center gap-1">
            <Globe size={12} /> Celestial Equator Map
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ background: 'radial-gradient(ellipse at center, #0a1225 0%, #030810 100%)' }}
          >
            {/* Grid lines */}
            {[-60, -30, 0, 30, 60].map(dec => {
              const y = H / 2 - (dec / 90) * (H / 2);
              return (
                <g key={dec}>
                  <line x1={0} y1={y} x2={W} y2={y} stroke="rgba(100,120,200,0.1)" strokeWidth={dec === 0 ? 1.5 : 0.5} strokeDasharray={dec === 0 ? '0' : '4,8'} />
                  <text x={4} y={y - 2} fill="rgba(100,130,200,0.4)" fontSize={8} fontFamily="Space Grotesk">{dec}°</text>
                </g>
              );
            })}
            {[0, 60, 120, 180, 240, 300, 360].map(ra => {
              const x = (ra / 360) * W;
              return (
                <g key={ra}>
                  <line x1={x} y1={0} x2={x} y2={H} stroke="rgba(100,120,200,0.08)" strokeWidth={0.5} />
                  <text x={x + 2} y={H - 4} fill="rgba(100,130,200,0.4)" fontSize={8} fontFamily="Space Grotesk">{ra}h</text>
                </g>
              );
            })}

            {/* Milky Way band */}
            <rect x={200} y={H * 0.2} width={400} height={H * 0.6} rx={80} fill="rgba(100,120,200,0.03)" />

            {/* Stars */}
            {filtered.map(star => {
              const { x, y } = project(star.ra, star.dec);
              const size = magnitudeToSize(star.magnitude) * 0.7;
              const colorHex = getStarColorHex(star.color || 'white');
              const isHovered = hoveredStar?.id === star.id;

              return (
                <g
                  key={star.id}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Glow */}
                  <circle cx={x} cy={y} r={size * 3} fill={colorHex} opacity={0.07} />
                  {/* Star */}
                  <circle cx={x} cy={y} r={size} fill={star.is_named ? '#fbbf24' : colorHex} opacity={0.9} />
                  {/* Owner ring */}
                  {star.is_named && (
                    <circle cx={x} cy={y} r={size + 3} fill="none" stroke="#fbbf24" strokeWidth={0.8} opacity={0.5} strokeDasharray="2,2" />
                  )}
                  {/* Hover label */}
                  {(isHovered || star.magnitude < 0.5) && (
                    <text x={x + size + 3} y={y + 3} fill="rgba(200,220,255,0.8)" fontSize={9} fontFamily="Space Grotesk">
                      {star.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Hovered star tooltip */}
          {hoveredStar && (
            <div className="absolute bottom-3 left-3 right-3 glass-dark rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${getStarColorHex(hoveredStar.color || 'white')}20` }}>
                <div className="w-2 h-2 rounded-full" style={{ background: getStarColorHex(hoveredStar.color || 'white') }} />
              </div>
              <div>
                <p className="font-space font-semibold text-foreground text-sm">{hoveredStar.name}</p>
                <p className="text-muted-foreground text-xs">{hoveredStar.constellation} · {hoveredStar.magnitude.toFixed(2)} mag · {hoveredStar.distance_ly} ly</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4">
        <div className="glass-dark rounded-xl p-4 flex items-center gap-6 flex-wrap">
          <LegendItem color="#93c5fd" label="Blue/White" />
          <LegendItem color="#fef08a" label="Yellow" />
          <LegendItem color="#fb923c" label="Orange" />
          <LegendItem color="#f87171" label="Red Giant" />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-star-gold ring-1 ring-star-gold ring-offset-1 ring-offset-background" />
            <span className="text-xs text-muted-foreground font-space flex items-center gap-1">
              <Lock size={10} /> Named
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ background: color }} />
      <span className="text-xs text-muted-foreground font-space">{label}</span>
    </div>
  );
}
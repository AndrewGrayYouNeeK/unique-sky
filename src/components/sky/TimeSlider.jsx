import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';

const MIN_YEAR = -5000;
const MAX_YEAR = 5000;

export default function TimeSlider({ yearOffset, onChange }) {
  const [isDragging, setIsDragging] = useState(false);

  const currentYear = new Date().getFullYear() + yearOffset;

  const formatYear = (year) => {
    if (year < 0) return `${Math.abs(year).toLocaleString()} BCE`;
    if (year > 9999) return `${(year / 1000).toFixed(1)}K CE`;
    return `${year.toLocaleString()} CE`;
  };

  const getEraLabel = (year) => {
    if (year < -8000) return '🌑 Ice Age';
    if (year < -3000) return '🏺 Ancient';
    if (year < -500) return '⚔️ Classical';
    if (year < 500) return '🏛️ Roman Era';
    if (year < 1400) return '🏰 Medieval';
    if (year < 1800) return '⚓ Age of Sail';
    if (year < 2000) return '🚂 Industrial';
    if (year < 2030) return '🛸 Now';
    if (year < 2100) return '🚀 Near Future';
    return '🌌 Far Future';
  };

  const quickJumps = [
    { label: '10K BCE', year: -10000 },
    { label: '3K BCE', year: -3000 },
    { label: '0 CE', year: -2026 },
    { label: 'Now', year: 0 },
    { label: '2100', year: 74 },
    { label: '3000', year: 974 },
  ];

  return (
    <div className="glass-dark rounded-2xl p-4">
      {/* Time display */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-accent" />
          <span className="text-xs font-space uppercase tracking-widest text-muted-foreground">Time Travel</span>
        </div>
        <div className="text-right">
          <div className="text-star-gold font-space font-bold text-base leading-none">{formatYear(currentYear)}</div>
          <div className="text-muted-foreground text-xs mt-0.5">{getEraLabel(currentYear)}</div>
        </div>
      </div>

      {/* Slider */}
      <div className="relative mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange(Math.max(MIN_YEAR, yearOffset - 100))}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 relative">
            <input
              type="range"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={yearOffset}
              onChange={e => onChange(Number(e.target.value))}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              className="w-full"
              style={{
                background: `linear-gradient(to right, hsl(var(--star-gold)) 0%, hsl(var(--star-gold)) ${((yearOffset - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100}%, hsl(var(--muted)) ${((yearOffset - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100}%, hsl(var(--muted)) 100%)`
              }}
            />
          </div>
          <button
            onClick={() => onChange(Math.min(MAX_YEAR, yearOffset + 100))}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {/* Now marker */}
        <div
          className="absolute top-0 w-0.5 h-full bg-accent/50 pointer-events-none"
          style={{ left: `calc(${((0 - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100}% - 2px)` }}
        />
      </div>

      {/* Quick jumps */}
      <div className="flex gap-1 flex-wrap">
        {quickJumps.map(jump => (
          <button
            key={jump.label}
            onClick={() => onChange(jump.year)}
            className={`px-2 py-0.5 rounded-md text-xs font-space transition-all ${
              Math.abs(yearOffset - jump.year) < 10
                ? 'bg-star-gold/20 text-star-gold border border-star-gold/30'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {jump.label}
          </button>
        ))}
      </div>
    </div>
  );
}
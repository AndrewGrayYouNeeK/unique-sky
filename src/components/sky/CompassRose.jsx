import { useEffect, useState } from 'react';

export default function CompassRose({ azimuth }) {
  const [pulse, setPulse] = useState(0);
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  // Pulse when nearly aligned to cardinal direction
  useEffect(() => {
    const nearCard = [0, 90, 180, 270].some(a => Math.abs((azimuth % 360) - a) < 5);
    setPulse(nearCard ? 1 : 0);
  }, [azimuth]);

  return (
    <div className="relative w-[72px] h-[72px]">
      {/* Outer ring */}
      <div
        className={`absolute inset-0 rounded-full border glass-dark transition-all duration-300 ${
          pulse ? 'border-star-gold/60 shadow-[0_0_12px_rgba(251,191,36,0.4)]' : 'border-border/30'
        }`}
      />

      {/* Inner ring */}
      <div className="absolute inset-2 rounded-full border border-border/15" />

      {/* Direction ticks + labels */}
      {dirs.map((dir, i) => {
        const angleDeg = i * 45 - azimuth;
        const angleRad = (angleDeg * Math.PI) / 180;
        const r = 26;
        const x = 36 + r * Math.sin(angleRad);
        const y = 36 - r * Math.cos(angleRad);
        const isCardinal = i % 2 === 0;
        const isNorth = dir === 'N';

        return (
          <span
            key={dir}
            className="absolute font-space font-bold -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
            style={{
              left: x,
              top: y,
              fontSize: isNorth ? '11px' : isCardinal ? '9px' : '7px',
              color: isNorth
                ? (pulse ? '#fbbf24' : 'rgba(251,191,36,0.9)')
                : isCardinal
                  ? 'rgba(200,220,255,0.8)'
                  : 'rgba(130,160,220,0.4)',
            }}
          >
            {dir}
          </span>
        );
      })}

      {/* Needle (always points N = up when azimuth=0) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-0.5 h-5 origin-bottom rounded-full"
          style={{
            background: 'linear-gradient(to top, rgba(251,191,36,0.8), rgba(251,191,36,0.2))',
            transform: `rotate(${-azimuth}deg)`,
            transformOrigin: 'bottom center',
            marginTop: '-10px',
          }}
        />
      </div>

      {/* Center dot */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${pulse ? 'bg-star-gold' : 'bg-star-gold/50'}`} />
      </div>
    </div>
  );
}
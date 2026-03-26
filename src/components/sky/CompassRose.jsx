export default function CompassRose({ azimuth }) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  return (
    <div className="relative w-20 h-20">
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full border border-star-gold/30 glass-dark" />

      {/* Direction labels */}
      {dirs.map((dir, i) => {
        const angle = (i * 45 - azimuth) * (Math.PI / 180);
        const r = 32;
        const x = 40 + r * Math.sin(angle);
        const y = 40 - r * Math.cos(angle);
        const isCardinal = i % 2 === 0;
        return (
          <span
            key={dir}
            className="absolute text-xs font-space font-semibold -translate-x-1/2 -translate-y-1/2"
            style={{
              left: x,
              top: y,
              color: dir === 'N' ? 'hsl(var(--star-gold))' : isCardinal ? 'rgba(200,220,255,0.9)' : 'rgba(150,170,220,0.5)',
              fontSize: isCardinal ? '10px' : '8px',
            }}
          >
            {dir}
          </span>
        );
      })}

      {/* Center dot */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-star-gold/60" />
      </div>
    </div>
  );
}
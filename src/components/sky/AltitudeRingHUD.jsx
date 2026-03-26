// On-screen altitude ring indicator (side panel)
export default function AltitudeRingHUD({ altitude }) {
  const rings = [
    { alt: 90, label: 'Zenith', color: 'bg-secondary/80' },
    { alt: 60, label: '60°', color: 'bg-secondary/40' },
    { alt: 30, label: '30°', color: 'bg-accent/40' },
    { alt: 0, label: 'Horizon', color: 'bg-accent/70' },
  ];

  return (
    <div className="flex flex-col items-center gap-1">
      {rings.map(ring => {
        const diff = Math.abs(altitude - ring.alt);
        const isActive = diff < 12;
        return (
          <div key={ring.alt} className="flex items-center gap-1.5">
            <span className={`text-[9px] font-space w-10 text-right ${isActive ? 'text-star-gold' : 'text-muted-foreground/50'}`}>
              {ring.label}
            </span>
            <div className={`h-px transition-all duration-300 ${isActive ? 'w-5 ' + ring.color.replace('bg-', 'bg-star-gold') : 'w-3 ' + ring.color}`}
              style={{ background: isActive ? 'hsl(var(--star-gold))' : undefined }}
            />
          </div>
        );
      })}
      {/* Current altitude indicator */}
      <div className="mt-1 text-[10px] font-space text-star-gold font-bold">
        ↑ {Math.round(altitude)}°
      </div>
    </div>
  );
}
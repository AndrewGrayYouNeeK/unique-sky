export default function DirectionHUD({ azimuth, altitude }) {
  const getCardinalDir = (az) => {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(az / 22.5) % 16];
  };

  return (
    <div className="glass-dark rounded-xl px-4 py-2.5 flex items-center gap-4">
      <div className="text-center">
        <div className="text-star-gold font-space font-bold text-lg leading-none">
          {getCardinalDir(azimuth)}
        </div>
        <div className="text-muted-foreground text-xs mt-0.5">Az {Math.round(azimuth)}°</div>
      </div>
      <div className="w-px h-8 bg-border/50" />
      <div className="text-center">
        <div className="text-accent font-space font-bold text-lg leading-none">
          {altitude > 0 ? '+' : ''}{Math.round(altitude)}°
        </div>
        <div className="text-muted-foreground text-xs mt-0.5">Altitude</div>
      </div>
    </div>
  );
}
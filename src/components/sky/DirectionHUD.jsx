import { motion } from 'framer-motion';

export default function DirectionHUD({ azimuth, altitude }) {
  const getCardinalDir = (az) => {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(az / 22.5) % 16];
  };

  const cardinal = getCardinalDir(azimuth);
  const az = Math.round(azimuth);
  const alt = Math.round(altitude);
  const altSign = alt >= 0 ? '+' : '';

  // Colour based on altitude
  const altColor = alt > 60 ? 'text-secondary' : alt > 30 ? 'text-accent' : alt > 0 ? 'text-foreground' : 'text-muted-foreground';

  return (
    <motion.div
      layout
      className="glass-dark rounded-xl px-3 py-2 flex items-center gap-3 border border-border/30"
    >
      {/* Azimuth */}
      <div className="text-center">
        <div className="text-star-gold font-space font-bold text-base leading-none tracking-tight">
          {cardinal}
        </div>
        <div className="text-muted-foreground text-[10px] mt-0.5 font-space">
          Az {az}°
        </div>
      </div>

      <div className="w-px h-7 bg-border/40" />

      {/* Altitude */}
      <div className="text-center">
        <div className={`font-space font-bold text-base leading-none tracking-tight ${altColor}`}>
          {altSign}{alt}°
        </div>
        <div className="text-muted-foreground text-[10px] mt-0.5 font-space">Alt</div>
      </div>

      {/* Alignment pulse dot — lights up when nearly zenith */}
      {alt > 75 && (
        <div className="w-2 h-2 rounded-full bg-secondary pulse-ring" />
      )}
    </motion.div>
  );
}
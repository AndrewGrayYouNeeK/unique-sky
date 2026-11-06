const radians = degrees => degrees * Math.PI / 180;
const degrees = radians => radians * 180 / Math.PI;
const wrap = value => ((value % 360) + 360) % 360;

// Approximate apparent horizontal coordinates from J2000 catalog coordinates.
// No refraction/precession corrections: an exploration aid, not navigation.
export function equatorialToHorizontal(ra, dec, latitude, longitude, date = new Date()) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const sidereal = wrap(280.46061837 + 360.98564736629 * (jd - 2451545) + longitude);
  const hourAngle = radians(wrap(sidereal - ra));
  const lat = radians(latitude);
  const declination = radians(dec);
  const sinAltitude = Math.sin(declination) * Math.sin(lat) + Math.cos(declination) * Math.cos(lat) * Math.cos(hourAngle);
  const altitude = degrees(Math.asin(Math.max(-1, Math.min(1, sinAltitude))));
  const azimuth = wrap(degrees(Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat))) + 180);
  return { azimuth, altitude };
}

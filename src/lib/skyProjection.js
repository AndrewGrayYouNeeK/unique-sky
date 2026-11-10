// Camera + sky projection math for the AR canvas (pure; unit-tested).
// Coordinates: horizontal frame is ENU (x=East, y=North, z=Up); equatorial J2000 unit vectors
// are (x toward RA 0h, y toward RA 6h, z toward the north celestial pole).

const DEG = Math.PI / 180;
const wrap360 = a => ((a % 360) + 360) % 360;

export function localSiderealDegrees(date, longitude) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  return wrap360(280.46061837 + 360.98564736629 * (jd - 2451545) + longitude);
}

// 3x3 matrix taking equatorial unit vectors to horizontal (ENU) unit vectors.
// Without a location we show a "catalog preview": the celestial sphere seen from inside with
// azimuth = 360° - RA and altitude = Dec, so RA increases to the left like the real sky.
export function equatorialToHorizontalMatrix(location, date = new Date()) {
  if (!location) return [[0, -1, 0], [1, 0, 0], [0, 0, 1]];
  const L = localSiderealDegrees(date, location.longitude) * DEG;
  const phi = location.latitude * DEG;
  const cL = Math.cos(L), sL = Math.sin(L), cP = Math.cos(phi), sP = Math.sin(phi);
  return [
    [-sL, cL, 0],
    [-sP * cL, -sP * sL, cP],
    [cP * cL, cP * sL, sP],
  ];
}

// Camera basis for a view direction + roll (clockwise tilt of the screen's top edge).
export function cameraBasis(azimuth, altitude, roll = 0) {
  const az = azimuth * DEG, alt = altitude * DEG;
  const forward = [Math.cos(alt) * Math.sin(az), Math.cos(alt) * Math.cos(az), Math.sin(alt)];
  const right0 = [Math.cos(az), -Math.sin(az), 0];
  const up0 = [-Math.sin(alt) * Math.sin(az), -Math.sin(alt) * Math.cos(az), Math.cos(alt)];
  const r = roll * DEG, c = Math.cos(r), s = Math.sin(r);
  // Rotating the device clockwise by `roll` rotates the screen axes clockwise around forward.
  const right = [right0[0] * c - up0[0] * s, right0[1] * c - up0[1] * s, right0[2] * c - up0[2] * s];
  const up = [up0[0] * c + right0[0] * s, up0[1] * c + right0[1] * s, up0[2] * c + right0[2] * s];
  return { forward, right, up };
}

const mul3 = (a, b) => a.map(row => [0, 1, 2].map(j => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));

// Build a per-frame projector. view = { azimuth, altitude, roll, fov } (fov across the long axis).
export function createProjector(view, w, h, eqToHor) {
  const { forward, right, up } = cameraBasis(view.azimuth, view.altitude, view.roll || 0);
  const cam = [right, up, forward];
  const C = eqToHor ? mul3(cam, eqToHor) : cam;
  const focal = (Math.max(w, h) / 2) / Math.tan((Math.min(view.fov, 170) / 2) * DEG);
  const halfDiag = Math.atan(Math.hypot(w, h) / 2 / focal);
  const minZ = Math.cos(Math.min(halfDiag + 8 * DEG, 89 * DEG));
  const cx = w / 2, cy = h / 2;
  const [c0, c1, c2] = C;
  return {
    focal, halfDiagDeg: halfDiag / DEG, minZ, matrix: C,
    // Writes screen x,y into out and returns true when the point is in front of the camera
    // and inside the (slightly padded) view cone.
    project(x, y, z, out) {
      const zc = c2[0] * x + c2[1] * y + c2[2] * z;
      if (zc < minZ) return false;
      out.x = cx + ((c0[0] * x + c0[1] * y + c0[2] * z) / zc) * focal;
      out.y = cy - ((c1[0] * x + c1[1] * y + c1[2] * z) / zc) * focal;
      return true;
    },
    // View center in the source frame (RA/Dec when eqToHor is given), for tile selection.
    centerRaDec() {
      const v = [c2[0], c2[1], c2[2]];
      return { ra: wrap360(Math.atan2(v[1], v[0]) / DEG), dec: Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG };
    },
  };
}

export function raDecToVector(ra, dec) {
  const r = ra * DEG, d = dec * DEG;
  return [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)];
}

// B-V colour index -> "r,g,b" string bucket (cached strings, no per-frame allocation).
const CI_BUCKETS = [
  [-0.1, '170,191,255'], [0.15, '202,215,255'], [0.45, '240,244,255'], [0.7, '255,246,232'],
  [1.0, '255,228,190'], [1.4, '255,204,150'], [Infinity, '255,178,120'],
];
export function colorForCi(ci) {
  if (!Number.isFinite(ci)) return CI_BUCKETS[2][1];
  for (const [max, rgb] of CI_BUCKETS) if (ci <= max) return rgb;
  return CI_BUCKETS[CI_BUCKETS.length - 1][1];
}

// Greedy label placement with axis-aligned collision avoidance.
// candidates: [{ x, y, text, width, priority }] (lower priority value wins). Returns the placed ones.
export function placeLabels(candidates, { max = 60, pad = 3, height = 12, bounds = null } = {}) {
  const placed = [];
  const sorted = [...candidates].sort((a, b) => a.priority - b.priority);
  for (const c of sorted) {
    if (placed.length >= max) break;
    const box = { x0: c.x - pad, y0: c.y - height - pad, x1: c.x + c.width + pad, y1: c.y + pad };
    if (bounds && (box.x1 < 0 || box.x0 > bounds.w || box.y1 < 0 || box.y0 > bounds.h)) continue;
    if (placed.some(p => box.x0 < p.box.x1 && box.x1 > p.box.x0 && box.y0 < p.box.y1 && box.y1 > p.box.y0)) continue;
    placed.push({ ...c, box });
  }
  return placed;
}

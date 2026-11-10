// Device orientation -> sky pointing (pure, unit-tested; no DOM access).
//
// W3C DeviceOrientation: the device frame is rotated from the Earth frame (x=East, y=North,
// z=Up) by intrinsic Z-X'-Y'' angles alpha, beta, gamma:  R = Rz(alpha) * Rx(beta) * Ry(gamma).
// Columns of R are the device axes expressed in the Earth frame. The rear camera looks along
// device -Z, so the pointing vector is -R[:,2]. Screen "up" depends on screen.orientation.angle.

const DEG = Math.PI / 180;
const wrap360 = a => ((a % 360) + 360) % 360;

export function rotationMatrix(alpha, beta, gamma) {
  const a = alpha * DEG, b = beta * DEG, g = gamma * DEG;
  const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
  return [
    [cA * cG - sA * sB * sG, -cB * sA, cG * sA * sB + cA * sG],
    [cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB],
    [-cB * sG, sB, cB * cG],
  ];
}

const mulVec = (m, v) => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// Screen-up direction in device coordinates. angle 0 = portrait, 90 = landscape with the
// device rotated counter-clockwise (its right edge up), 180 = upside down, 270 = clockwise.
export function screenUpInDevice(screenAngle = 0) {
  const t = screenAngle * DEG;
  return [Math.sin(t), Math.cos(t), 0];
}

// Earth-frame vectors (East, North, Up) for the camera direction and the screen's up edge.
export function deviceVectors(alpha, beta, gamma, screenAngle = 0) {
  const R = rotationMatrix(alpha, beta, gamma);
  return {
    forward: norm([-R[0][2], -R[1][2], -R[2][2]]),
    up: norm(mulVec(R, screenUpInDevice(screenAngle))),
  };
}

// Convert camera forward + screen-up vectors to { azimuth, altitude, roll } in degrees.
// azimuth: 0=N, 90=E (clockwise from north). altitude: +90 zenith. roll: clockwise tilt of
// the screen's top edge relative to "zenith-up" (rotate the drawn sky by -roll).
// Near the zenith/nadir the forward vector's horizontal part vanishes, so the heading is
// blended with the screen-up vector near the poles (whose horizontal part points away from the view
// direction when looking up) to avoid gimbal jumps.
export function vectorsToSky(forward, up) {
  const [fe, fn, fu] = forward;
  const altitude = Math.asin(Math.max(-1, Math.min(1, fu))) / DEG;
  // Exact forward heading away from the poles; within ~18° of zenith/nadir blend in the
  // screen-up heading (weight 0 -> 1 as |sin(alt)| goes 0.95 -> 0.995).
  const wgt = Math.max(0, Math.min(1, (Math.abs(fu) - 0.95) / 0.045));
  const dirE = fe - wgt * fu * up[0];
  const dirN = fn - wgt * fu * up[1];
  const azimuth = wrap360(Math.atan2(dirE, dirN) / DEG);
  const az = azimuth * DEG, alt = altitude * DEG;
  const right = [Math.cos(az), -Math.sin(az), 0];
  const zenithUp = [-Math.sin(alt) * Math.sin(az), -Math.sin(alt) * Math.cos(az), Math.cos(alt)];
  const roll = Math.atan2(
    up[0] * right[0] + up[1] * right[1],
    up[0] * zenithUp[0] + up[1] * zenithUp[1] + up[2] * zenithUp[2],
  ) / DEG;
  return { azimuth, altitude, roll };
}

// Best absolute alpha for an event: iOS gives webkitCompassHeading (clockwise from magnetic
// north, already compensated for device pose); Android's deviceorientationabsolute (or
// absolute=true) gives an Earth-referenced alpha. Returns null if only a relative alpha exists.
export function absoluteAlpha(e) {
  if (e && typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) {
    return wrap360(360 - e.webkitCompassHeading);
  }
  if (e && e.absolute === true && typeof e.alpha === 'number') return wrap360(e.alpha);
  return null;
}

// Full pipeline for one event. `flipLR` / `flipAlt` are debug toggles for devices that report
// mirrored axes; they mirror the azimuth about the current heading origin / negate altitude.
export function orientationToSky(e, { screenAngle = 0, flipLR = false, flipAlt = false } = {}) {
  if (!e || typeof e.beta !== 'number' || typeof e.gamma !== 'number') return null;
  const absA = absoluteAlpha(e);
  const alpha = absA ?? (typeof e.alpha === 'number' ? e.alpha : null);
  if (alpha === null) return null;
  const { forward, up } = deviceVectors(alpha, e.beta, e.gamma, screenAngle);
  const sky = vectorsToSky(forward, up);
  return {
    ...sky,
    azimuth: flipLR ? wrap360(360 - sky.azimuth) : sky.azimuth,
    altitude: flipAlt ? -sky.altitude : sky.altitude,
    roll: flipLR !== flipAlt ? -sky.roll : sky.roll,
    absolute: absA !== null,
    forward, up,
  };
}

// Exponential smoothing on unit vectors (no 359°/0° wraparound problems).
export function smoothVector(prev, next, k = 0.25) {
  if (!prev) return next;
  return norm([prev[0] + (next[0] - prev[0]) * k, prev[1] + (next[1] - prev[1]) * k, prev[2] + (next[2] - prev[2]) * k]);
}

// Shortest-path angle smoothing (for headings that are already scalar).
export function smoothAngle(prev, next, k = 0.25) {
  if (prev === null || prev === undefined) return wrap360(next);
  const d = ((next - prev + 540) % 360) - 180;
  return wrap360(prev + d * k);
}

// Convert a sky direction to a unit vector (East, North, Up).
export function skyToVector(azimuth, altitude) {
  const az = azimuth * DEG, alt = altitude * DEG;
  return [Math.cos(alt) * Math.sin(az), Math.cos(alt) * Math.cos(az), Math.sin(alt)];
}

// The original (pre-fix) formula, kept only so tests document what was wrong.
export function legacyOrientation(alpha, beta, gamma, webkitCompassHeading) {
  const altitudeVal = Math.max(-90, Math.min(90, beta - 90));
  const heading = typeof webkitCompassHeading === 'number' ? webkitCompassHeading : 360 - alpha;
  return { azimuth: ((heading + Math.sin(gamma * DEG) * 90) + 360) % 360, altitude: -altitudeVal };
}

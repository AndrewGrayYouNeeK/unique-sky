import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orientationToSky, vectorsToSky, deviceVectors, smoothAngle, smoothVector, absoluteAlpha, legacyOrientation, skyToVector } from '../src/lib/orientation.js';

const near = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) < eps, msg || `${a} !~ ${b}`);
const angNear = (a, b, eps = 1e-6) => near(Math.abs(((a - b + 540) % 360) - 180), 0, eps, `${a} !~ ${b} (deg)`);

test('portrait, upright, facing north = horizon, azimuth 0', () => {
  const s = orientationToSky({ alpha: 0, beta: 90, gamma: 0 });
  angNear(s.azimuth, 0); near(s.altitude, 0); near(s.roll, 0);
});

test('tilting the top of the phone back toward the sky RAISES altitude (legacy formula inverted it)', () => {
  const s = orientationToSky({ alpha: 0, beta: 135, gamma: 0 });
  near(s.altitude, 45);
  assert.equal(legacyOrientation(0, 135, 0).altitude, -45); // documented bug
  near(orientationToSky({ alpha: 0, beta: 45, gamma: 0 }).altitude, -45); // tilted down toward the ground
});

test('azimuth follows alpha counter-clockwise (heading = 360 - alpha)', () => {
  angNear(orientationToSky({ alpha: 90, beta: 90, gamma: 0 }).azimuth, 270);
  angNear(orientationToSky({ alpha: 270, beta: 90, gamma: 0 }).azimuth, 90);
});

test('gamma on an upright phone turns the camera instead of adding an ad-hoc sin(gamma)*90 offset', () => {
  const s = orientationToSky({ alpha: 0, beta: 90, gamma: 30 });
  angNear(s.azimuth, 330); near(s.altitude, 0);
  angNear(legacyOrientation(0, 90, 30).azimuth, 45); // legacy turned the wrong way and by the wrong amount
});

test('pointing vector is a unit vector and matches the camera direction for arbitrary poses', () => {
  for (const [a, b, g] of [[10, 20, 30], [200, 120, -40], [359, 89, 5], [45, 140, -80], [300, 60, 70]]) {
    const { forward, up } = deviceVectors(a, b, g);
    near(Math.hypot(...forward), 1); near(Math.hypot(...up), 1);
    near(forward[0] * up[0] + forward[1] * up[1] + forward[2] * up[2], 0); // orthogonal
    const s = vectorsToSky(forward, up);
    assert.ok(Math.abs(s.altitude) < 71, 'test pose should be away from the poles');
    const v = skyToVector(s.azimuth, s.altitude);
    for (let i = 0; i < 3; i++) near(v[i], forward[i], 1e-9);
  }
});

test('landscape: screen.orientation.angle changes roll, not the camera direction', () => {
  // Device turned counter-clockwise onto its side (right edge up), camera facing east.
  const s = orientationToSky({ alpha: 0, beta: 0, gamma: -90 }, { screenAngle: 90 });
  angNear(s.azimuth, 90, 1e-6); near(s.altitude, 0, 1e-6); near(s.roll, 0, 1e-6);
  const portraitUI = orientationToSky({ alpha: 0, beta: 0, gamma: -90 }, { screenAngle: 0 });
  angNear(portraitUI.azimuth, 90, 1e-6); near(Math.abs(portraitUI.roll), 90, 1e-6);
});

test('no gimbal jump near the zenith: heading stays continuous as the phone tilts past 89°', () => {
  let prev = null;
  for (let beta = 150; beta <= 179.9; beta += 0.5) {
    const s = orientationToSky({ alpha: 40, beta, gamma: 0 });
    if (prev !== null) assert.ok(Math.abs(((s.azimuth - prev + 540) % 360) - 180) < 1, `jump at beta ${beta}`);
    prev = s.azimuth;
  }
  angNear(prev, 320, 1e-6);
});

test('iOS webkitCompassHeading and Android absolute alpha are preferred', () => {
  near(absoluteAlpha({ webkitCompassHeading: 90, alpha: 12 }), 270);
  near(absoluteAlpha({ absolute: true, alpha: 33 }), 33);
  assert.equal(absoluteAlpha({ absolute: false, alpha: 33 }), null);
  const s = orientationToSky({ alpha: 5, beta: 90, gamma: 0, webkitCompassHeading: 90 });
  angNear(s.azimuth, 90); assert.equal(s.absolute, true);
});

test('debug flips mirror azimuth and altitude', () => {
  const s = orientationToSky({ alpha: 300, beta: 120, gamma: 0 }, { flipLR: true, flipAlt: true });
  angNear(s.azimuth, 300); near(s.altitude, -30);
});

test('smoothing handles the 359°/0° wraparound', () => {
  angNear(smoothAngle(359, 1, 0.5), 0);
  angNear(smoothAngle(1, 359, 0.5), 0);
  const v = smoothVector(skyToVector(359, 0), skyToVector(1, 0), 0.5);
  angNear(vectorsToSky(v, [0, 0, 1]).azimuth, 0, 1e-9);
});

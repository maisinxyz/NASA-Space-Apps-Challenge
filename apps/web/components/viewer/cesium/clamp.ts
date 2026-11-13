// Pure camera-confinement maths for farm view (unit-tested, no Cesium import).
// Cesium's ScreenSpaceCameraController min/max zoom only limits mouse/touch zoom and has no
// horizontal bound, so the Globe applies this every frame instead.

/** Lowest the camera may sit above the ground under it, metres. Product choice ("roughly 20 m"). */
export const MIN_HEIGHT_ABOVE_GROUND_M = 20;
/** Highest the camera may sit above the ground under it, metres. Product choice ("3000 m"). */
export const MAX_HEIGHT_ABOVE_GROUND_M = 3000;
/** Easing rate of the pull-back, 1/s. ~95 % of the correction is applied after 3/EASE_RATE seconds. */
export const CLAMP_EASE_RATE = 6;

// WGS84 semi-major axis, metres (same value as Cesium's Ellipsoid.WGS84.maximumRadius).
// ponytail: flat-earth (equirectangular) distances around the farm centre; error is far below a metre
// at farm radii of a few km. Switch to geodesics only if radiusM ever reaches tens of km or near a pole.
const EARTH_RADIUS_M = 6378137;
const RAD = Math.PI / 180;

/** Camera position: degrees and metres above the ellipsoid. */
export type CameraPos = { lon: number; lat: number; height: number };
export type ClampArea = { lon: number; lat: number; radiusM: number };

/** Horizontal distance from the area centre, metres. */
export function horizontalDistanceM(pos: { lon: number; lat: number }, centre: { lon: number; lat: number }): number {
  const [x, y] = offsetM(pos, centre);
  return Math.hypot(x, y);
}

function offsetM(pos: { lon: number; lat: number }, centre: { lon: number; lat: number }): [number, number] {
  let dLon = pos.lon - centre.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  return [dLon * RAD * EARTH_RADIUS_M * Math.cos(centre.lat * RAD), (pos.lat - centre.lat) * RAD * EARTH_RADIUS_M];
}

/**
 * Nearest allowed camera position: within `radiusM` of the centre horizontally (same bearing), and between
 * MIN and MAX height above `groundHeightM` (ellipsoid height of the ground under the camera).
 * Returns the input values unchanged when already inside.
 */
export function clampCamera(pos: CameraPos, area: ClampArea, groundHeightM = 0): CameraPos {
  const [x, y] = offsetM(pos, area);
  const d = Math.hypot(x, y);
  const k = d > area.radiusM && d > 0 ? area.radiusM / d : 1;
  const height = Math.min(groundHeightM + MAX_HEIGHT_ABOVE_GROUND_M, Math.max(groundHeightM + MIN_HEIGHT_ABOVE_GROUND_M, pos.height));
  if (k === 1) return { lon: pos.lon, lat: pos.lat, height };
  return {
    lon: area.lon + (x * k) / (RAD * EARTH_RADIUS_M * Math.cos(area.lat * RAD)),
    lat: area.lat + (y * k) / (RAD * EARTH_RADIUS_M),
    height,
  };
}

/** One eased step from `pos` toward `target` after `dtS` seconds (exponential, frame-rate independent). */
export function easeToward(pos: CameraPos, target: CameraPos, dtS: number, rate = CLAMP_EASE_RATE): CameraPos {
  const t = 1 - Math.exp(-rate * Math.max(0, dtS));
  return {
    lon: pos.lon + (target.lon - pos.lon) * t,
    lat: pos.lat + (target.lat - pos.lat) * t,
    height: pos.height + (target.height - pos.height) * t,
  };
}

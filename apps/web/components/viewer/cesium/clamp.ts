// Pure camera maths for the farm-view turntable orbit (unit-tested, no Cesium import).
// The Globe keeps an orbit state {target offset, heading, pitch, range} around the simulation square and applies
// these hard clamps (no easing) before every frame.

/** Lowest the camera may sit above the ground under it, metres. Product choice ("roughly 20 m"). */
export const MIN_HEIGHT_ABOVE_GROUND_M = 20;
/** Orbit distance from the target (the point at the screen centre), metres. Product choice. */
export const MIN_RANGE_M = 150;
export const MAX_RANGE_M = 2500;
/** Pitch limits, radians (negative = looking down). Highest pitch -15 deg: the horizon is never in view. */
export const MAX_PITCH_RAD = (-15 * Math.PI) / 180;
export const MIN_PITCH_RAD = (-89 * Math.PI) / 180;

// WGS84 semi-major axis, metres (same value as Cesium's Ellipsoid.WGS84.maximumRadius).
// ponytail: flat-earth (equirectangular) offsets around the centre; error is far below a metre at a few km.
// Switch to geodesics only if the square ever reaches tens of km or sits near a pole.
const EARTH_RADIUS_M = 6378137;
const RAD = Math.PI / 180;

export type LonLat = { lon: number; lat: number };
/** East/north offset from a centre, metres. */
export type Offset = { x: number; y: number };
export type Orbit = { heading: number; pitch: number; range: number };
/** Axis-aligned box around a centre: half extents in metres. */
export type Box = LonLat & { halfX: number; halfY: number };

/** East/north offset of `pos` from `centre`, metres. */
export function offsetM(pos: LonLat, centre: LonLat): Offset {
  let dLon = pos.lon - centre.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  return { x: dLon * RAD * EARTH_RADIUS_M * Math.cos(centre.lat * RAD), y: (pos.lat - centre.lat) * RAD * EARTH_RADIUS_M };
}

/** Inverse of offsetM. */
export function fromOffsetM(centre: LonLat, o: Offset): LonLat {
  return { lon: centre.lon + o.x / (RAD * EARTH_RADIUS_M * Math.cos(centre.lat * RAD)), lat: centre.lat + o.y / (RAD * EARTH_RADIUS_M) };
}

/** The simulation square [west, south, east, north] as a centred box. */
export function boxOfBbox(b: readonly [number, number, number, number]): Box {
  const c = { lon: (b[0] + b[2]) / 2, lat: (b[1] + b[3]) / 2 };
  const { x, y } = offsetM({ lon: b[2], lat: b[3] }, c);
  return { ...c, halfX: Math.abs(x), halfY: Math.abs(y) };
}

/** Fallback when there is no simulation square: a box inscribed in the farm radius circle. */
export function boxOfRadius(c: LonLat, radiusM: number): Box {
  const h = radiusM / Math.SQRT2;
  return { ...c, halfX: h, halfY: h };
}

/** Hard stop: the target offset cannot leave the box. */
export function clampTarget(o: Offset, box: Pick<Box, "halfX" | "halfY">): Offset {
  return { x: Math.min(box.halfX, Math.max(-box.halfX, o.x)), y: Math.min(box.halfY, Math.max(-box.halfY, o.y)) };
}

/**
 * Hard-clamp the orbit: range 150 m - 2.5 km, pitch -89 deg .. -15 deg, heading wrapped to [0, 2pi).
 * `needAboveTargetM` = how far above the target the camera must be to keep 20 m over the ground (0 = ignore):
 * raises the pitch (looks more downward) when the range is long enough, never beyond the limits.
 */
export function clampOrbit(o: Orbit, needAboveTargetM = 0): Orbit {
  const range = Math.min(MAX_RANGE_M, Math.max(MIN_RANGE_M, o.range));
  let pitch = Math.min(MAX_PITCH_RAD, o.pitch);
  if (needAboveTargetM > 0) pitch = Math.min(pitch, -Math.asin(Math.min(1, needAboveTargetM / range)));
  pitch = Math.max(MIN_PITCH_RAD, pitch);
  const heading = ((o.heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return { heading, pitch, range };
}

/**
 * Fixed sun time for the lit farm view: 10:00 local mean solar time on 21 June 2026, as UTC milliseconds.
 * Constant date so the same inputs always give the same shading (determinism).
 */
export function localMorningUtcMs(lonDeg: number): number {
  return Date.UTC(2026, 5, 21, 10, 0, 0) - (lonDeg / 15) * 3600000;
}

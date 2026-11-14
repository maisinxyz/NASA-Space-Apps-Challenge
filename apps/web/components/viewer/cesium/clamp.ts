// Pure camera maths for the farm-view turntable orbit (unit-tested, no Cesium import).
// The Globe keeps an orbit state {target offset, heading, pitch, range} around the simulation square and applies
// these clamps before every frame (hard stops; panning eases to a soft stop at the pan margin, see panTarget).

/** Lowest the camera may sit above the ground under it, metres. Product choice ("roughly 20 m"). */
export const MIN_HEIGHT_ABOVE_GROUND_M = 20;
/** Orbit distance from the target (the point at the screen centre), metres. Product choice. */
export const MIN_RANGE_M = 150;
export const MAX_RANGE_M = 1500;
/** Pitch limits, radians (negative = looking down). Highest pitch -25 deg: no horizon, fewer far tiles to stream. */
export const MAX_PITCH_RAD = (-25 * Math.PI) / 180;
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

/**
 * How far the target may leave the simulation square, metres. Product choices: 300 m normally, 50 m for farms with
 * a minimum range (private farmland), so the view cannot wander over the neighbours.
 */
export const PAN_MARGIN_M = 300;
export const PAN_MARGIN_PRIVATE_M = 50;
export const panMarginFor = (minRangeM?: number) => (minRangeM ? PAN_MARGIN_PRIVATE_M : PAN_MARGIN_M);

/** Hard stop: the target offset cannot leave the box grown by `margin` metres. */
export function clampTarget(o: Offset, box: Pick<Box, "halfX" | "halfY">, margin = 0): Offset {
  const hx = box.halfX + margin;
  const hy = box.halfY + margin;
  return { x: Math.min(hx, Math.max(-hx, o.x)), y: Math.min(hy, Math.max(-hy, o.y)) };
}

/**
 * Soft stop for panning: move the target by `d`, but outward movement beyond the box edge is scaled by 1 - u^2
 * (u = how far into the margin, 0..1), so it eases to a stop at box + margin; then the hard stop. Inward is free.
 */
export function panTarget(o: Offset, d: Offset, box: Pick<Box, "halfX" | "halfY">, margin: number): Offset {
  const axis = (p: number, dp: number, half: number) => {
    const u = margin > 0 ? Math.min(1, Math.max(0, (Math.abs(p) - half) / margin)) : 1;
    return p * dp > 0 && Math.abs(p) > half ? p + dp * (1 - u * u) : p + dp;
  };
  return clampTarget({ x: axis(o.x, d.x, box.halfX), y: axis(o.y, d.y, box.halfY) }, box, margin);
}

/**
 * Zoom toward a ground point: `cursor` = the ground point under the cursor relative to the target (ENU metres). With
 * heading/pitch fixed that offset scales with the range, so moving the target by cursor * (1 - newRange/range) keeps
 * the point under the cursor. Zooming out also pulls the target back toward the box centre (fully centred at
 * MAX_RANGE_M) so the view cannot get lost. Hard stop at box + margin.
 */
export function zoomTarget(t: Offset, cursor: Offset, range: number, newRange: number, box: Pick<Box, "halfX" | "halfY">, margin: number): Offset {
  const f = newRange / range;
  let x = t.x + cursor.x * (1 - f);
  let y = t.y + cursor.y * (1 - f);
  if (newRange > range) {
    const keep = 1 - Math.min(1, (newRange - range) / Math.max(1e-9, MAX_RANGE_M - range));
    x *= keep;
    y *= keep;
  }
  return clampTarget({ x, y }, box, margin);
}

type Vec3 = { x: number; y: number; z: number };
/** Where a ray (in a local ENU frame) hits the z = 0 ground plane, or null if it points up or hits beyond `maxM`. */
export function groundHit(origin: Vec3, dir: Vec3, maxM: number): Offset | null {
  if (dir.z >= -1e-9 || origin.z <= 0) return null;
  const t = -origin.z / dir.z;
  const hit = { x: origin.x + t * dir.x, y: origin.y + t * dir.y };
  return Math.hypot(hit.x, hit.y) > maxM ? null : hit;
}

/**
 * Hard-clamp the orbit: range minRangeM (default 150 m) - 1.5 km, pitch -89 deg .. -25 deg, heading wrapped to [0, 2pi).
 * `needAboveTargetM` = how far above the target the camera must be to keep 20 m over the ground (0 = ignore):
 * raises the pitch (looks more downward) when the range is long enough, never beyond the limits.
 * `minRangeM` = the farm's closest allowed distance (Farm.minRangeM, e.g. 250 m for private farmland).
 */
export function clampOrbit(o: Orbit, needAboveTargetM = 0, minRangeM = MIN_RANGE_M): Orbit {
  const range = Math.min(MAX_RANGE_M, Math.max(Math.min(MAX_RANGE_M, minRangeM), o.range));
  let pitch = Math.min(MAX_PITCH_RAD, o.pitch);
  if (needAboveTargetM > 0) pitch = Math.min(pitch, -Math.asin(Math.min(1, needAboveTargetM / range)));
  pitch = Math.max(MIN_PITCH_RAD, pitch);
  const heading = ((o.heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return { heading, pitch, range };
}

/**
 * Default farm-view framing (no Farm.framing): low and oblique so barns, trees and relief read as 3D. Range =
 * 0.45 x the square's longer side, kept in 400-600 m; pitch -30 deg; heading north. Product choices.
 */
export const FRAME_RANGE_PER_SIDE = 0.45;
export const FRAME_RANGE_MIN_M = 400;
export const FRAME_RANGE_MAX_M = 600;
export const FRAME_PITCH_RAD = (-30 * Math.PI) / 180;

/** Farm.framing in components/globe/types.ts (degrees, metres). */
export type Framing = { lon: number; lat: number; rangeM: number; pitchDeg: number; headingDeg?: number };

/**
 * The farm-view start view (fly-in end and Reset view): `framing` when given, else the box centre at the default
 * range/pitch. The target is kept inside the box and the orbit is clamped (incl. minRangeM), so the flight ends
 * exactly where the clamped orbit starts.
 */
export function startFraming(box: Box, framing?: Framing, minRangeM?: number): { target: LonLat; o: Orbit } {
  const o: Orbit = framing
    ? { heading: (framing.headingDeg ?? 0) * RAD, pitch: framing.pitchDeg * RAD, range: framing.rangeM }
    : { heading: 0, pitch: FRAME_PITCH_RAD, range: Math.min(FRAME_RANGE_MAX_M, Math.max(FRAME_RANGE_MIN_M, 2 * Math.max(box.halfX, box.halfY) * FRAME_RANGE_PER_SIDE)) };
  const target = framing ? fromOffsetM(box, clampTarget(offsetM(framing, box), box)) : { lon: box.lon, lat: box.lat };
  return { target, o: clampOrbit(o, 0, minRangeM) };
}

/** Camera pose for share links: degrees and metres (same shape as CameraState in components/globe/types.ts). */
export type CameraPose = { lon: number; lat: number; height: number; heading: number; pitch: number };

/**
 * Camera pose of a turntable orbit around `target` (at ellipsoid height `ground`). Matches Cesium's lookAt
 * HeadingPitchRange: the camera sits at -range * (cos p sin h, cos p cos h, sin p) in the target's ENU frame.
 */
export function cameraFromOrbit(target: LonLat, ground: number, o: Orbit): CameraPose {
  const horiz = o.range * Math.cos(o.pitch);
  const at = fromOffsetM(target, { x: -horiz * Math.sin(o.heading), y: -horiz * Math.cos(o.heading) });
  return { lon: at.lon, lat: at.lat, height: ground - o.range * Math.sin(o.pitch), heading: o.heading / RAD, pitch: o.pitch / RAD };
}

/**
 * Inverse of cameraFromOrbit: the orbit whose camera is `c`, looking down at ground height `ground`. The pitch
 * is first limited to the farm-view range (the view ray must hit the ground); the caller still applies clampOrbit.
 */
export function orbitFromCamera(c: CameraPose, ground: number): { target: LonLat; o: Orbit } {
  const pitch = Math.max(MIN_PITCH_RAD, Math.min(MAX_PITCH_RAD, c.pitch * RAD));
  const heading = c.heading * RAD;
  const range = Math.max(1, c.height - ground) / -Math.sin(pitch);
  const horiz = range * Math.cos(pitch);
  // Exact inverse of cameraFromOrbit's offsets, which are scaled at the target's latitude: latitude first.
  const lat = fromOffsetM(c, { x: 0, y: horiz * Math.cos(heading) }).lat;
  const lon = fromOffsetM({ lon: c.lon, lat }, { x: horiz * Math.sin(heading), y: 0 }).lon;
  return { target: { lon, lat }, o: { heading, pitch, range } };
}

/**
 * Fixed sun time for the lit farm view: 10:00 local mean solar time on 21 June 2026, as UTC milliseconds.
 * Constant date so the same inputs always give the same shading (determinism).
 */
export function localMorningUtcMs(lonDeg: number): number {
  return Date.UTC(2026, 5, 21, 10, 0, 0) - (lonDeg / 15) * 3600000;
}

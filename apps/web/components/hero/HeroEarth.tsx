"use client";
// The hero's Earth: a Three.js sphere (react-three-fiber) styled as a dark data map: slate continents with a hint of
// NASA Blue Marble imagery, a flat navy sea, soft light, a blue fresnel rim, a faint graticule and a wide blue halo,
// on a procedural starfield and Milky Way (see Starfield). Palette constants live at the top of earthFrag. The sun is fixed to the viewer (left, toward the headline), so the face you see is always lit while the
// Earth turns under it. Rotation is a pure mesh rotation (no camera moves), so it is perfectly smooth.
//
// Interaction: drag rotates the Earth (about its axis left-right, tilt up-down, clamped) with inertia after release;
// it auto-rotates slowly when asked; it glides between the hero position (right) and the centre; picking a farm turns
// the Earth so that farm faces you (eased arc). Waypoints are DOM buttons placed over the sphere every frame (crisp,
// focusable, hoverable), shown only when `showPins`: red map pins with a black dot, the tip on the farm.
//
// The camera's field of view and distance match the Cesium globe's whole-Earth view (60 degree horizontal fov,
// 20,000 km above the surface), so the hand-over to Cesium for the dive happens at the same size.
// Textures: public/hero/earth/SOURCES.md (NASA, public domain).
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { type MutableRefObject, Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { cameraActionForKey, type CameraAction } from "@/lib/farm-view/camera-controls";

import type { Farm, PinHover } from "@/components/globe/types";

import { Pin3D, pinBox } from "./Pin3D";
import { easeInFlashOut, flyTo, hero, zoom as ZOOM } from "./tokens";

const DAY = "/hero/earth/earth-day-3840.jpg";
const NIGHT = "/hero/earth/earth-night-3840.jpg";
/** Land (255) / sea (0) mask from Natural Earth (scripts/build_globe_assets.py). */
const MASK = "/hero/earth/land-mask-4096.png";
/** Intro: the Earth wakes (brightens) and the camera pulls in from this multiple of the whole-Earth distance. */
const INTRO_MS = 2800;
const INTRO_FROM = 1.55;

/** Cesium whole-Earth view: camera 20,000 km above a 6,371 km Earth = 4.139 radii from the centre. */
const CAM_DIST = (6371 + 20000) / 6371;
/** Cesium's default frustum: 60 degrees across the wider screen dimension. */
const CESIUM_FOV_RAD = THREE.MathUtils.degToRad(60);
/** Auto-rotation: one turn in about three minutes. Clockwise seen from above the north pole: the near surface drifts to the left (applied as a negative spin below). */
const SPIN_RAD_S = THREE.MathUtils.degToRad(2);
/** Drag: radians of rotation per pixel = 1 / Earth radius in px (the point under the cursor follows it). Inertia decay /s. */
const INERTIA_DECAY = 3.2;
const MAX_TILT = THREE.MathUtils.degToRad(70);
/** Sun direction in view space: from the left, where the headline sits (slightly above and in front), so the face toward the text is lit and the far limb falls into shade. */
const SUN = new THREE.Vector3(-0.86, 0.2, 0.46).normalize();
/** Atmosphere shell radius, Earth radii. */
const GLOW_SCALE = 1.16;
/** Pin facing threshold: hide waypoints on the far side and right at the limb. */
const PIN_FACING = 0.12;

export type HeroEarthApi = {
  isFacing(id: string): boolean;
  /** Turn the Earth so this farm faces the viewer (eased arc); `onFlyDone` fires when it gets there. */
  face(id: string): void;
  /** Turn the Earth so any lon/lat faces the viewer (search results that are not farms). */
  faceLonLat(lon: number, lat: number): void;
  /** Glide back to the whole-Earth size (before the hand-over to the Cesium dive). */
  resetZoom(): void;
  /**
   * Seamless dive push-in on this globe: in `durationMs` (ease-in-out) the Earth turns so the farm is centred and the
   * camera flies in to `endDistance` Earth radii from the centre (default 1.12, about 760 km up). Pins hide and the
   * shader drops to a cheaper look while it runs. `onDone` fires once, when the end framing is reached; the view then
   * holds there until `cancelDive()` or `resetZoom()`.
   */
  startDive(id: string, durationMs: number, onDone?: () => void, endDistance?: number): void;
  /** Same as startDive with the default end framing (1.12 Earth radii from the centre, 1/8 radius up). */
  diveTo(farmId: string, durationMs: number, onDone: () => void): void;
  /** Stop a dive (running or held) and glide back to the whole-Earth view. */
  cancelDive(): void;
  isDiving(): boolean;
};

type Props = {
  farms: Farm[];
  selectedId: string | null;
  /** Where the Earth's centre sits: fraction of half the width from the centre (+ = right). Glides on change. */
  offsetX: number;
  autoRotate: boolean;
  showPins: boolean;
  atmosphere: boolean;
  /** Scroll-to-zoom is live (the Earth is centred). Off: the view eases back to the whole-Earth size. */
  zoomEnabled: boolean;
  reducedMotion: boolean;
  /** Render loop on/off (off while the farm view covers the hero). */
  active: boolean;
  onReady(): void;
  onProgress(fraction: number): void;
  onDragStart(): void;
  onDragEnd(): void;
  onPinClick(id: string): void;
  onHover(h: PinHover | null): void;
  /** Selected waypoint's screen position (for the farm card and the pulse). */
  onTrack(h: PinHover | null): void;
  /** The turn to face the selected farm has finished. */
  onFlyDone(id: string): void;
  onCamera(c: { lat: number; lon: number }): void;
  apiRef?: MutableRefObject<HeroEarthApi | null>;
};

/** Unit-sphere position of a lon/lat on THREE.SphereGeometry with an equirectangular texture (u = 0 at -180 degrees). */
export function lonLatToVec(lon: number, lat: number, out = new THREE.Vector3()) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return out.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
}

/** Spin (about Y) and tilt (about X) that bring a lon/lat to face the camera (+Z). */
export function faceAngles(lon: number, lat: number) {
  const v = lonLatToVec(lon, lat);
  return { spin: -Math.atan2(v.x, v.z), tilt: THREE.MathUtils.degToRad(lat) };
}

const shortest = (from: number, to: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const earthVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vPosV;
  varying vec3 vObj;
  varying mat3 vNM;
  void main() {
    vUv = uv;
    vObj = position;
    vNM = normalMatrix;
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vPosV = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;
const earthFrag = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform vec3 sunV;
  uniform vec3 rimColor;
  uniform float rimOn;
  uniform float time;
  uniform float lowDetail;
  uniform float cloudFill;
  uniform sampler2D landMap;
  uniform float awake;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vPosV;
  varying vec3 vObj;
  varying mat3 vNM;
  // Look: a dark, data-map globe. Slate continents with a hint of the imagery, flat navy sea, soft light, blue rim,
  // faint graticule, cool S-curve grade. No clouds or city lights. Tune the look here.
  const vec3 OCEAN = vec3(0.026, 0.058, 0.132);
  const float OCEAN_IMAGERY = 0.12;
  const vec3 SLATE_DARK = vec3(0.130, 0.168, 0.205);
  const vec3 SLATE_LIGHT = vec3(0.300, 0.325, 0.330);
  const float IMAGERY_MIX = 0.5;
  const float LIGHT_BASE = 1.15;
  const float LIGHT_SUN = 0.28;
  const vec3 GRID = vec3(0.090, 0.251, 0.663);
  const float GRID_ALPHA = 0.09;
  const float GRADE_MIX = 0.5;
  vec3 grade(vec3 c) {
    // A little more contrast and colour, kept natural.
    c = (c - 0.5) * 1.12 + 0.5;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    return clamp(mix(vec3(l), c, 1.22), 0.0, 1.0);
  }
  float waterOf(vec3 c) { return smoothstep(0.012, 0.1, c.b - max(c.r, c.g)); }
  float hash3(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  vec3 rotY(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }
  // Cloud density at a surface direction: stretched east-west (bands), fewer in the subtropics, more at the equator and mid-latitudes.
  float cloudAt(vec3 po, int oct) {
    vec3 cp = rotY(po, time * 0.0035);
    float lat = abs(cp.y);
    float bias = 0.10 * (1.0 - smoothstep(0.0, 0.2, lat)) + 0.14 * smoothstep(0.42, 0.78, lat) - 0.10 * smoothstep(0.16, 0.3, lat) * (1.0 - smoothstep(0.3, 0.46, lat));
    vec3 q = cp * vec3(2.6, 5.2, 2.6);
    q += 0.6 * vec3(vnoise(q * 0.7 + 3.1), vnoise(q * 0.7 + 7.7), 0.0);
    float f = 0.0, amp = 0.5;
    for (int i = 0; i < 5; i++) {
      if (i >= oct) break;
      f += amp * vnoise(q);
      q = q * 2.07 + 1.7;
      amp *= 0.5;
    }
    return smoothstep(0.53 - bias, 0.82 - bias, f / (1.0 - pow(0.5, float(oct))) * 0.98);
  }
  // Ocean swell: travelling waves on the sphere (analytic gradient, no texture). Coarse swell plus a fine chop that fades out when it would alias.
  vec3 swell(vec3 p, float t, float fine) {
    vec3 g = vec3(0.0);
    g += normalize(vec3( 0.83, 0.31, 0.46)) * cos(dot(p, vec3( 0.83, 0.31, 0.46)) * 71.0 + t * 0.34) * 0.80;
    g += normalize(vec3(-0.42, 0.77, 0.48)) * cos(dot(p, vec3(-0.42, 0.77, 0.48)) * 113.0 - t * 0.47) * 0.55;
    g += normalize(vec3( 0.15, -0.58, 0.80)) * cos(dot(p, vec3( 0.15, -0.58, 0.80)) * 167.0 + t * 0.61) * 0.40;
    g += normalize(vec3(-0.71, -0.24, 0.66)) * cos(dot(p, vec3(-0.71, -0.24, 0.66)) * 241.0 - t * 0.83) * 0.26;
    g += normalize(vec3( 0.52, 0.64, -0.56)) * cos(dot(p, vec3( 0.52, 0.64, -0.56)) * 331.0 + t * 1.07) * 0.16;
    g += fine * normalize(vec3(-0.12, 0.52, 0.85)) * cos(dot(p, vec3(-0.12, 0.52, 0.85)) * 577.0 + t * 1.45) * 0.20;
    g += fine * normalize(vec3( 0.66, -0.35, 0.67)) * cos(dot(p, vec3( 0.66, -0.35, 0.67)) * 823.0 - t * 1.8) * 0.13;
    return g;
  }
  // Anti-aliased line every stepDeg degrees along x (degrees).
  float gridLine(float x, float stepDeg) {
    float d = abs(fract(x / stepDeg + 0.5) - 0.5) * stepDeg;
    return 1.0 - smoothstep(0.0, fwidth(x) * 1.2, d);
  }
  vec3 sCurve(vec3 c) {
    vec3 s = c * c * (3.0 - 2.0 * c);
    s = clamp(s * 1.08 + 0.02, 0.0, 1.0);
    s.b = min(1.0, s.b * 1.05 + 0.012);
    s.r = min(1.0, s.r * 0.98 + s.r * s.r * s.r * 0.06);
    return s;
  }
  void main() {
    vec3 n0 = normalize(vNormalV);
    vec3 v = normalize(-vPosV);
    vec3 po = normalize(vObj);

    vec3 raw = texture2D(dayMap, vUv).rgb;
    float land = texture2D(landMap, vUv).r;
    float g = dot(raw, vec3(0.299, 0.587, 0.114));
    vec3 cont = mix(SLATE_DARK, SLATE_LIGHT, g);
    cont = mix(cont, raw * 0.8, IMAGERY_MIX);
    vec3 sea = mix(OCEAN, raw * vec3(0.8, 1.0, 1.15), OCEAN_IMAGERY);
    vec3 base = mix(sea, cont, land);

    float lambert = max(dot(n0, sunV), 0.0);
    float fres = pow(1.0 - max(dot(n0, v), 0.0), 3.0);
    vec3 col = base * (LIGHT_BASE + LIGHT_SUN * lambert) + rimColor * fres * 0.5 * rimOn;

    // Graticule: parallels every 30 degrees to +-60, meridians every 30 degrees.
    float latD = degrees(asin(clamp(po.y, -1.0, 1.0)));
    float lonD = degrees(atan(po.z, -po.x));
    float par = gridLine(latD, 30.0) * step(abs(latD), 61.0);
    float mer = gridLine(lonD, 30.0) * step(abs(latD), 84.0);
    col = mix(col, GRID, max(par, mer) * GRID_ALPHA * (1.0 - lowDetail));

    col = mix(col, sCurve(clamp(col, 0.0, 1.0)), GRADE_MIX);
    // Intro: the surface wakes from dark while the camera pulls in.
    col *= mix(0.24, 1.0, awake);

    // Whiteout at the end of the dive (hand-over to the Cesium view under the CloudLoader).
    if (cloudFill > 0.0) {
      float cl = cloudAt(po, 2);
      vec3 whiteCol = mix(vec3(0.82, 0.86, 0.92), vec3(0.97, 0.98, 1.0), clamp(cl * 0.75 + 0.35, 0.0, 1.0));
      col = mix(col, whiteCol, cloudFill * cloudFill);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;
const glowVert = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vPosV;
  void main() {
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vPosV = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;
const glowFrag = /* glsl */ `
  uniform vec3 glowColor;
  uniform vec3 sunV;
  varying vec3 vNormalV;
  varying vec3 vPosV;
  uniform float shellCos;
  void main() {
    vec3 n = normalize(vNormalV);
    vec3 v = normalize(-vPosV);
    // Back faces of the shell: brightest behind the Earth, fading to 0 at the shell edge (not normalised at the limb).
    float k = clamp(-dot(n, v), 0.0, 1.0);
    float halo = pow(k, 1.8) * 1.7;
    vec3 e = vec3(1.0) - exp(-glowColor * halo);
    gl_FragColor = vec4(e, 1.0);
  }
`;

/** Pins closer than this on screen (px) are fanned apart: glyph width (40) plus a visible gap, and glyph height. */
const PIN_SEP_W = 50;
const PIN_SEP_H = 50;
/** Name label beside each pin head (screen px from the pin's ground point): starts right of the head, centred on it. */
const LABEL_DX = 16;
const LABEL_DY = -31;
const LABEL_H = 24;
/** Short name for the label: the farm name up to its first comma or bracket (the full name is in the popup). */
export const shortName = (name: string) => name.split(/[,(]/)[0].trim();
type Rect = { x0: number; x1: number; y0: number; y1: number };
const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
type Labels = { els: Map<string, HTMLElement>; alpha: Map<string, number>; w: Map<string, number> };
type PinItem = { f: Farm; x: number; y: number; fdot: number; facing: boolean; alpha: number; tx: number };

type Motion = {
  spin: number;
  tilt: number;
  vSpin: number;
  vTilt: number;
  dragging: boolean;
  last: { x: number; y: number; t: number } | null;
  cloudFill: number;
  dive: { fromSpin: number; toSpin: number; fromTilt: number; toTilt: number; fromZoom: number; toZoom: number; t0: number; dur: number; done: boolean; onDone?: () => void } | null;
  fly: { fromSpin: number; toSpin: number; fromTilt: number; toTilt: number; t0: number; id: string } | null;
  off: { cur: number; from: number; to: number; t0: number };
  camAt: number;
  /** First frame time (ms), for the intro. */
  introT0: number;
  /** Camera distance as a multiple of the whole-Earth distance: current (eased) and where the wheel wants it. */
  zoom: number;
  zoomTo: number;
};

function Scene(p: Props & { motion: MutableRefObject<Motion>; pinEls: MutableRefObject<Map<string, HTMLElement>>; pinAlpha: MutableRefObject<Map<string, number>>; pinOff: MutableRefObject<Map<string, number>>; leaderEls: MutableRefObject<Map<string, SVGGElement>>; labels: MutableRefObject<Labels>; hovered: MutableRefObject<string | null>; places: MutableRefObject<PlaceLabels> }) {
  const { camera, size, gl } = useThree();
  const [day, night, mask] = useLoader(THREE.TextureLoader, [DAY, NIGHT, MASK]);
  const tilted = useRef<THREE.Group>(null);
  const spun = useRef<THREE.Group>(null);
  const earthMat = useRef<THREE.ShaderMaterial>(null);
  const live = useRef(p);
  live.current = p;

  useMemo(() => {
    for (const t of [day, night, mask]) {
      t.anisotropy = gl.capabilities.getMaxAnisotropy();
      t.colorSpace = THREE.NoColorSpace;
    }
  }, [day, night, mask, gl]);

  const uniforms = useMemo(
    () => ({
      dayMap: { value: day },
      nightMap: { value: night },
      sunV: { value: SUN.clone() },
      rimColor: { value: new THREE.Color(0.09, 0.25, 0.66) },
      rimOn: { value: 1 },
      time: { value: 0 },
      lowDetail: { value: 0 },
      cloudFill: { value: 0 },
      landMap: { value: mask },
      awake: { value: 0 },
    }),
    [day, night, mask],
  );
  const glowUniforms = useMemo(() => ({ glowColor: { value: new THREE.Color(0.09, 0.251, 0.663) }, sunV: { value: SUN.clone() }, shellCos: { value: Math.sqrt(1 - 1 / (GLOW_SCALE * GLOW_SCALE)) } }), []);

  useEffect(() => {
    p.onReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the textures have loaded
  }, []);

  // Match Cesium's projection: 60 degrees across the wider dimension.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    cam.fov = THREE.MathUtils.radToDeg(aspect >= 1 ? 2 * Math.atan(Math.tan(CESIUM_FOV_RAD / 2) / aspect) : CESIUM_FOV_RAD);
    cam.position.set(0, 0, CAM_DIST * live.current.motion.current.zoom);
    cam.near = 0.01;
    cam.far = 100;
    cam.updateProjectionMatrix();
  }, [camera, size]);

  const tmp = useMemo(() => ({ v: new THREE.Vector3(), n: new THREE.Vector3(), q: new THREE.Quaternion(), toCam: new THREE.Vector3() }), []);

  useFrame((_, rawDt) => {
    const q = live.current;
    const m = q.motion.current;
    const dt = Math.min(0.05, rawDt);
    const now = performance.now();
    // Glide between the hero position and the centre (eased, time based).
    if (q.offsetX !== m.off.to) {
      m.off = { cur: m.off.cur, from: m.off.cur, to: q.offsetX, t0: now };
    }
    if (m.off.cur !== m.off.to) {
      const k = q.reducedMotion ? 1 : Math.min(1, (now - m.off.t0) / hero.glideMs);
      m.off.cur = k >= 1 ? m.off.to : m.off.from + (m.off.to - m.off.from) * easeInOutCubic(k);
    }
    const cam = camera as THREE.PerspectiveCamera;
    // Zoom: the wheel sets a target, the camera glides to it (ease-out, frame-rate independent). Off => whole Earth.
    if (!q.zoomEnabled) m.zoomTo = 1;
    m.zoom = q.reducedMotion ? m.zoomTo : m.zoom + (m.zoomTo - m.zoom) * (1 - Math.exp(-dt / (ZOOM.glideMs / 1000 / 3)));
    if (Math.abs(m.zoom - m.zoomTo) < 1e-4) m.zoom = m.zoomTo;
    // Dive push-in: one eased move that turns the farm to the centre and flies the camera in (distance interpolated in log space, so the speed feels constant).
    const dv = m.dive;
    if (dv) {
      const k = dv.done || q.reducedMotion ? 1 : Math.min(1, (now - dv.t0) / dv.dur);
      const e = easeInOutCubic(k);
      m.spin = dv.fromSpin + (dv.toSpin - dv.fromSpin) * e;
      m.tilt = dv.fromTilt + (dv.toTilt - dv.fromTilt) * e;
      m.zoom = Math.exp(Math.log(dv.fromZoom) + (Math.log(dv.toZoom) - Math.log(dv.fromZoom)) * e);
      m.zoomTo = m.zoom;
      m.vSpin = 0;
      m.vTilt = 0;
      m.fly = null;
      if (k >= 1 && !dv.done) {
        dv.done = true;
        dv.onDone?.();
      }
    }
    if (!m.introT0) m.introT0 = now;
    const awake = q.reducedMotion ? 1 : Math.min(1, (now - m.introT0) / INTRO_MS);
    const introK = 1 + (INTRO_FROM - 1) * Math.pow(1 - awake, 3);
    cam.position.z = CAM_DIST * m.zoom * introK;
    cam.updateMatrixWorld();
    const halfW = CAM_DIST * m.zoom * introK * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect;
    if (tilted.current) tilted.current.position.x = m.off.cur * halfW;

    // Rotation: fly-to, else inertia / auto-spin.
    if (m.fly) {
      const k = q.reducedMotion ? 1 : Math.min(1, (now - m.fly.t0) / (flyTo.seconds * 1000));
      const e = easeInFlashOut(k);
      m.spin = m.fly.fromSpin + (m.fly.toSpin - m.fly.fromSpin) * e;
      m.tilt = m.fly.fromTilt + (m.fly.toTilt - m.fly.fromTilt) * e;
      if (k >= 1) {
        const id = m.fly.id;
        m.fly = null;
        q.onFlyDone(id);
      }
    } else if (!m.dragging && !m.dive) {
      if (Math.abs(m.vSpin) + Math.abs(m.vTilt) > 1e-4) {
        m.spin += m.vSpin * dt;
        m.tilt = THREE.MathUtils.clamp(m.tilt + m.vTilt * dt, -MAX_TILT, MAX_TILT);
        const decay = Math.exp(-INERTIA_DECAY * dt);
        m.vSpin *= decay;
        m.vTilt *= decay;
      } else if (q.autoRotate && !q.reducedMotion) {
        m.spin -= SPIN_RAD_S * dt;
      }
    }
    if (spun.current) spun.current.rotation.y = m.spin;
    if (tilted.current) tilted.current.rotation.x = m.tilt;
    if (earthMat.current) {
      // Cloud ramp: over the last ~35% of the push-in the cloud thickens to a near-white frame; eases back out after cancelDive().
      const kDive = m.dive ? (m.dive.done || q.reducedMotion ? 1 : Math.min(1, (now - m.dive.t0) / m.dive.dur)) : 0;
      const wantFill = m.dive ? THREE.MathUtils.smoothstep(kDive, 0.65, 1) : 0;
      m.cloudFill = m.dive ? wantFill : m.cloudFill + (0 - m.cloudFill) * (1 - Math.exp(-dt / 0.3));
      if (m.cloudFill < 1e-3) m.cloudFill = 0;
      earthMat.current.uniforms.cloudFill.value = m.cloudFill;
      earthMat.current.uniforms.awake.value = awake;
      earthMat.current.uniforms.lowDetail.value = m.dive ? 1 : 0;
      earthMat.current.uniforms.rimOn.value = q.atmosphere ? 1 : 0;
      // Ocean swell clock (frozen under reduced motion).
      if (!q.reducedMotion) earthMat.current.uniforms.time.value += dt;
    }

    // Waypoints: project to the screen; hide those facing away.
    tilted.current?.updateMatrixWorld();
    const world = spun.current?.matrixWorld;
    let trackSent = false;
    if (world) {
      // Pass 1: project every farm and ease its fade.
      const items: PinItem[] = [];
      for (const f of q.farms) {
        lonLatToVec(f.lon, f.lat, tmp.v).applyMatrix4(world);
        tmp.n.copy(tmp.v).sub(tilted.current!.position).normalize();
        tmp.toCam.copy(cam.position).sub(tmp.v).normalize();
        const fdot = tmp.n.dot(tmp.toCam);
        const s = tmp.v.clone().project(cam);
        const target = q.showPins && !q.motion.current.dive ? THREE.MathUtils.clamp((fdot - PIN_FACING) / 0.22, 0, 1) : 0;
        const prev = q.pinAlpha.current.get(f.id) ?? 0;
        const alpha = q.reducedMotion ? target : prev + (target - prev) * (1 - Math.exp(-dt / 0.06));
        q.pinAlpha.current.set(f.id, alpha);
        items.push({ f, x: (s.x * 0.5 + 0.5) * size.width, y: (-s.y * 0.5 + 0.5) * size.height, fdot, facing: fdot > PIN_FACING, alpha, tx: 0 });
      }
      // Pass 2: fan overlapping glyphs apart sideways (continuous in the positions, then eased, so no jitter while the Earth turns).
      for (let pass = 0; pass < 3; pass++) for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const A = items[i];
          const B = items[j];
          if (!A.facing || !B.facing || A.alpha < 0.05 || B.alpha < 0.05) continue;
          const dy = Math.abs(A.y - B.y);
          if (dy >= PIN_SEP_H) continue;
          const need = PIN_SEP_W * Math.sqrt(1 - (dy / PIN_SEP_H) ** 2);
          const dx = B.x + B.tx - (A.x + A.tx);
          const ad = Math.abs(dx);
          if (ad >= need) continue;
          const dir = ad > 0.5 ? Math.sign(dx) : A.f.id < B.f.id ? 1 : -1;
          const push = (need - ad) / 2;
          A.tx -= dir * push;
          B.tx += dir * push;
        }
      }
      // Labels: shown when their box clears every pin head and every label already placed. The selected and hovered
      // farms go first, then nearer pins. O(n^2) over a dozen pins, cheap.
      const L = q.labels.current;
      const placed: Rect[] = [];
      const heads: (Rect & { id: string })[] = items.filter((it) => it.facing && it.alpha > 0.05).map((it) => ({ id: it.f.id, x0: it.x + it.tx - 17, x1: it.x + it.tx + 17, y0: it.y - 48, y1: it.y - 4 }));
      const rank = (it: PinItem) => (it.f.id === q.selectedId ? 3 : it.f.id === q.hovered.current ? 2 : 0) + it.fdot;
      for (const it of [...items].sort((a, b) => rank(b) - rank(a))) {
        const el = L.els.get(it.f.id);
        if (!el) continue;
        let w = L.w.get(it.f.id) ?? 0;
        if (!w) L.w.set(it.f.id, (w = el.offsetWidth));
        const lx = it.x + it.tx + LABEL_DX;
        const ly = it.y + LABEL_DY;
        const r = { x0: lx, x1: lx + w, y0: ly - LABEL_H / 2, y1: ly + LABEL_H / 2 };
        const ok = it.facing && it.alpha > 0.6 && !placed.some((o) => overlaps(o, r)) && !heads.some((h) => h.id !== it.f.id && overlaps(h, r));
        if (ok) placed.push(r);
        const prev = L.alpha.get(it.f.id) ?? 0;
        const a = q.reducedMotion ? +ok : prev + (+ok - prev) * (1 - Math.exp(-dt / 0.09));
        L.alpha.set(it.f.id, a);
        el.style.opacity = a.toFixed(3);
      }
      // Pass 3: apply. The glyph sits at its displaced spot (lifted a little when displaced, on a hairline stem to the true spot); click and hover follow it.
      for (const it of items) {
        const { f, x, y, fdot, facing, alpha } = it;
        const want = Math.abs(it.tx) < 0.5 ? 0 : it.tx;
        const prevO = q.pinOff.current.get(f.id) ?? 0;
        const off = q.reducedMotion ? want : prevO + (want - prevO) * (1 - Math.exp(-dt / 0.07));
        q.pinOff.current.set(f.id, off);
        const k = Math.min(1, Math.abs(off) / 10);
        const dx = x + off;
        const dyy = y - 9 * k;
        const el = q.pinEls.current.get(f.id);
        if (el) {
          el.style.transform = `translate3d(${dx.toFixed(2)}px, ${dyy.toFixed(2)}px, 0) translate(-50%, -100%)`;
          // Pins ride on the Earth: fade out smoothly toward the limb (foreshortened) and when switched off. The nearer pin sits on top.
          el.style.opacity = alpha.toFixed(3);
          el.style.zIndex = String(Math.round(THREE.MathUtils.clamp(fdot, 0, 1) * 100));
          el.style.setProperty("--f", THREE.MathUtils.clamp(fdot, 0, 1).toFixed(3));
          const show = alpha > 0.5 && facing;
          el.style.pointerEvents = show && !q.motion.current.dragging ? "auto" : "none";
          el.tabIndex = show ? 0 : -1;
        }
        const lg = q.leaderEls.current.get(f.id);
        if (lg) {
          const lines = lg.children;
          lg.style.opacity = (alpha * k).toFixed(3);
          for (let i = 0; i < 2; i++) {
            lines[i].setAttribute("x1", x.toFixed(2));
            lines[i].setAttribute("y1", y.toFixed(2));
            lines[i].setAttribute("x2", dx.toFixed(2));
            lines[i].setAttribute("y2", dyy.toFixed(2));
          }
          lines[2].setAttribute("cx", x.toFixed(2));
          lines[2].setAttribute("cy", y.toFixed(2));
        }
        // The hovered waypoint's label follows it while the Earth moves.
        if (f.id === q.hovered.current) q.onHover(facing && q.showPins ? { id: f.id, x: dx, y: dyy } : null);
        if (f.id === q.selectedId) {
          trackSent = true;
          q.onTrack(facing ? { id: f.id, x: dx, y: dyy } : null);
        }
      }
    }
    if (!trackSent) q.onTrack(null);
    if (world) placeCityLabels(q.places.current, world, tilted.current!.position, cam, size, m, q.reducedMotion, dt, tmp);

    // Camera telemetry: the point under the view centre.
    if (now - m.camAt > 120) {
      m.camAt = now;
      tmp.q.setFromEuler(new THREE.Euler(m.tilt, m.spin, 0, "XYZ")).invert();
      const c = new THREE.Vector3(0, 0, 1).applyQuaternion(tmp.q);
      const lat = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(c.y, -1, 1)));
      let lon = THREE.MathUtils.radToDeg(Math.atan2(c.z, -c.x)) - 180;
      lon = ((((lon + 180) % 360) + 360) % 360) - 180;
      q.onCamera({ lat, lon });
    }
  });

  return (
    <>
    <Starfield reducedMotion={p.reducedMotion} />
    <group ref={tilted}>
      <group ref={spun}>
        <mesh>
          <sphereGeometry args={[1, 160, 160]} />
          <shaderMaterial ref={earthMat} vertexShader={earthVert} fragmentShader={earthFrag} uniforms={uniforms} />
        </mesh>
      </group>
      {p.atmosphere && (
        <mesh scale={GLOW_SCALE}>
          <sphereGeometry args={[1, 96, 96]} />
          <shaderMaterial vertexShader={glowVert} fragmentShader={glowFrag} uniforms={glowUniforms} transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </group>
    </>
  );
}

// ---------- city labels ----------
const PLACES = "/hero/places.json";
const CITY_LABELS_MAX = 28;
export type Place = { kind: "city" | "country"; name: string; country: string; lat: number; lon: number; pop: number };
type PlaceLabels = { cities: Place[]; els: HTMLElement[]; alpha: number[]; pointer: { x: number; y: number } | null };
/** Smallest population labelled at a camera distance (Earth radii): more names as you zoom in. */
const popFloor = (d: number) => (d > 3.6 ? 8e6 : d > 2.9 ? 4e6 : d > 2.3 ? 1.5e6 : 5e5);

function placeCityLabels(
  P: PlaceLabels,
  world: THREE.Matrix4,
  centre: THREE.Vector3,
  cam: THREE.PerspectiveCamera,
  size: { width: number; height: number },
  m: Motion,
  reduced: boolean,
  dt: number,
  tmp: { v: THREE.Vector3; n: THREE.Vector3; toCam: THREE.Vector3 },
) {
  if (!P.els.length) return;
  const floor = popFloor(cam.position.length());
  const focus = P.pointer ?? { x: size.width / 2, y: size.height / 2 };
  const reach = Math.min(220, size.width * 0.3);
  const placed: Rect[] = [];
  let k = 0;
  for (const c of P.cities) {
    if (k >= P.els.length) break;
    if (c.pop < floor) break; // sorted by population, largest first
    lonLatToVec(c.lon, c.lat, tmp.v).applyMatrix4(world);
    tmp.n.copy(tmp.v).sub(centre).normalize();
    tmp.toCam.copy(cam.position).sub(tmp.v).normalize();
    const facing = tmp.n.dot(tmp.toCam);
    if (facing < 0.2) continue;
    const s = tmp.v.project(cam);
    const x = (s.x * 0.5 + 0.5) * size.width;
    const y = (-s.y * 0.5 + 0.5) * size.height;
    const w = c.name.length * 8 + 14;
    if (x - w / 2 < 0 || x + w / 2 > size.width || y < 20 || y > size.height) continue;
    const r = { x0: x - w / 2, x1: x + w / 2, y0: y - 18, y1: y };
    if (placed.some((o) => overlaps(o, r))) continue;
    placed.push(r);
    const near = THREE.MathUtils.clamp((reach - Math.hypot(x - focus.x, y - focus.y)) / 80, 0, 1);
    const want = m.dive ? 0 : Math.min(1, (facing - 0.2) / 0.25) * (0.35 + 0.65 * near);
    const el = P.els[k];
    if (el.textContent !== c.name) {
      el.textContent = c.name;
      P.alpha[k] = 0;
    }
    const prev = P.alpha[k] ?? 0;
    const a = reduced ? want : prev + (want - prev) * (1 - Math.exp(-dt / 0.15));
    P.alpha[k] = a;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${(y + 2).toFixed(1)}px, 0) translate(-50%, -100%)`;
    el.style.opacity = a.toFixed(3);
    k++;
  }
  for (; k < P.els.length; k++) {
    P.alpha[k] = 0;
    P.els[k].style.opacity = "0";
  }
}

// ---------- space backdrop ----------
// Procedural and deterministic (seeded): no image to load or license. Stars sit on a far sphere, so they stay put while
// the Earth turns (the camera never rotates). About a third crowd a tilted band, over a faint milky glow, so the sky
// reads as a galaxy seen edge-on rather than uniform noise. Gentle twinkle, frozen under reduced motion.
const STAR_COUNT = 28000;
const SKY_R = 60;
/** Unit normal of the Milky Way band's plane (tilted across the view). */
const BAND_N = new THREE.Vector3(0.35, 0.86, -0.37).normalize();

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const starVert = /* glsl */ `
  attribute float size;
  attribute float phase;
  attribute vec3 tint;
  uniform float time;
  uniform float dpr;
  varying vec3 vTint;
  varying float vAlpha;
  varying float vSize;
  void main() {
    vTint = tint;
    vSize = size;
    float tw = 0.78 + 0.22 * sin(time * (0.6 + fract(phase * 7.13) * 1.6) + phase * 6.2831);
    vAlpha = tw;
    gl_PointSize = size * dpr;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const starFrag = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;
  varying float vSize;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float core = smoothstep(1.0, 0.0, d);
    // Big stars get a soft halo and a four-point flare; small ones stay pinpricks.
    float big = smoothstep(6.0, 14.0, vSize);
    float flare = (exp(-abs(c.x) * 60.0) * exp(-abs(c.y) * 5.0) + exp(-abs(c.y) * 60.0) * exp(-abs(c.x) * 5.0)) * big;
    float a = (pow(core, mix(1.8, 6.0, big)) + flare * 0.9 + pow(core, 2.0) * 0.25 * big) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vTint * a, a);
  }
`;
const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const skyFrag = /* glsl */ `
  uniform vec3 bandN;
  varying vec3 vDir;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  void main() {
    vec3 d = normalize(vDir);
    float lat = dot(d, bandN);
    float n = noise(d * 3.0) * 0.6 + noise(d * 7.0) * 0.3 + noise(d * 16.0) * 0.1;
    float band = exp(-lat * lat * 40.0) * (0.2 + 0.8 * n * n);
    float dust = smoothstep(0.55, 0.75, noise(d * 9.0 + 4.0)) * exp(-lat * lat * 90.0);
    vec3 col = mix(vec3(0.12, 0.16, 0.30), vec3(0.30, 0.30, 0.40), n) * band * (1.0 - 0.7 * dust);
    // A faint deep-blue haze over the whole sky so space is not flat black.
    col += vec3(0.008, 0.012, 0.03) * (0.6 + 0.4 * n);
    gl_FragColor = vec4(col * 0.8, 1.0);
  }
`;

function Starfield({ reducedMotion }: { reducedMotion: boolean }) {
  const { gl } = useThree();
  const geo = useMemo(() => {
    const rnd = mulberry32(20261114);
    const pos = new Float32Array(STAR_COUNT * 3);
    const size = new Float32Array(STAR_COUNT);
    const phase = new Float32Array(STAR_COUNT);
    const tint = new Float32Array(STAR_COUNT * 3);
    const v = new THREE.Vector3();
    const palette = [new THREE.Color("#9db8ff"), new THREE.Color("#cfdcff"), new THREE.Color("#ffffff"), new THREE.Color("#fff1d6"), new THREE.Color("#ffd2a1")];
    for (let i = 0; i < STAR_COUNT; i++) {
      // Uniform direction, then a third pulled toward the band plane.
      v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      if (v.lengthSq() < 1e-6) v.set(1, 0, 0);
      v.normalize();
      if (rnd() < 0.36) v.addScaledVector(BAND_N, -v.dot(BAND_N) * (0.82 + rnd() * 0.18)).normalize();
      v.multiplyScalar(SKY_R);
      pos.set([v.x, v.y, v.z], i * 3);
      // Mostly faint pinpricks, a few bright stars (power-law sizes).
      const m = Math.pow(rnd(), 9);
      size[i] = 1.6 + m * 16;
      phase[i] = rnd();
      const c = palette[Math.floor(rnd() * palette.length)];
      const b = 0.8 + 0.2 * Math.min(1, 0.3 + m * 3 + rnd() * 0.6);
      tint.set([c.r * b, c.g * b, c.b * b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("size", new THREE.BufferAttribute(size, 1));
    g.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("tint", new THREE.BufferAttribute(tint, 3));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const starUniforms = useMemo(() => ({ time: { value: 0 }, dpr: { value: gl.getPixelRatio() } }), [gl]);
  const skyUniforms = useMemo(() => ({ bandN: { value: BAND_N.clone() } }), []);
  useFrame((_, dt) => {
    starUniforms.dpr.value = gl.getPixelRatio();
    if (!reducedMotion) starUniforms.time.value += Math.min(0.05, dt);
  });
  return (
    <group renderOrder={-1}>
      <mesh renderOrder={-2}>
        <sphereGeometry args={[SKY_R + 5, 48, 32]} />
        <shaderMaterial vertexShader={skyVert} fragmentShader={skyFrag} uniforms={skyUniforms} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <points geometry={geo} renderOrder={-1}>
        <shaderMaterial vertexShader={starVert} fragmentShader={starFrag} uniforms={starUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

/** Reports texture loading progress (THREE.DefaultLoadingManager). */
function useLoadProgress(onProgress: (f: number) => void) {
  useEffect(() => {
    const mgr = THREE.DefaultLoadingManager;
    const prev = mgr.onProgress;
    mgr.onProgress = (_url, loaded, total) => onProgress(total ? loaded / total : 0);
    return () => {
      mgr.onProgress = prev;
    };
  }, [onProgress]);
}

export function HeroEarth(props: Props) {
  const motion = useRef<Motion>({ spin: 0, tilt: THREE.MathUtils.degToRad(20), vSpin: 0, vTilt: 0, dragging: false, last: null, fly: null, dive: null, cloudFill: 0, off: { cur: props.offsetX, from: props.offsetX, to: props.offsetX, t0: 0 }, camAt: 0, introT0: 0, zoom: 1, zoomTo: 1 });
  const pinEls = useRef(new Map<string, HTMLElement>());
  const pinAlpha = useRef(new Map<string, number>());
  const pinOff = useRef(new Map<string, number>());
  const leaderEls = useRef(new Map<string, SVGGElement>());
  const labels = useRef<Labels>({ els: new Map(), alpha: new Map(), w: new Map() });
  const hovered = useRef<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const places = useRef<PlaceLabels>({ cities: [], els: [], alpha: [], pointer: null });
  const lens = useRef<HTMLDivElement>(null);
  useLoadProgress(props.onProgress);
  useEffect(() => {
    let off = false;
    fetch(PLACES)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { places?: Place[] } | null) => {
        if (!off && d?.places) places.current.cities = d.places.filter((x) => x.kind === "city");
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);

  // Start facing the Americas (like the Cesium home view), then whatever the user does.
  useMemo(() => {
    const a = faceAngles(-100, 20);
    motion.current.spin = a.spin;
    motion.current.tilt = a.tilt;
  }, []);

  // Turn a farm to face the viewer (eased arc along the shortest way round).
  const { farms } = props;
  const face = (f: Farm | undefined) => {
    if (!f) return;
    const m = motion.current;
    const a = faceAngles(f.lon, f.lat);
    m.vSpin = 0;
    m.vTilt = 0;
    m.fly = { fromSpin: m.spin, toSpin: shortest(m.spin, a.spin), fromTilt: m.tilt, toTilt: a.tilt, t0: performance.now(), id: f.id };
  };
  const faceRef = useRef(face);
  faceRef.current = face;
  // Selecting does not turn the Earth (a pin click must leave the camera alone); callers use apiRef.face(id) when they want a turn.

  // Public: is this farm already facing the viewer (no turn needed before a dive)?
  useEffect(() => {
    if (!props.apiRef) return;
    props.apiRef.current = {
      isFacing(id) {
        const f = farms.find((x) => x.id === id);
        if (!f) return false;
        const m = motion.current;
        const a = faceAngles(f.lon, f.lat);
        return !m.fly && Math.abs(Math.atan2(Math.sin(a.spin - m.spin), Math.cos(a.spin - m.spin))) < 0.02 && Math.abs(a.tilt - m.tilt) < 0.02;
      },
      face(id) {
        faceRef.current(farms.find((x) => x.id === id));
      },
      faceLonLat(lon, lat) {
        const m = motion.current;
        const a = faceAngles(lon, lat);
        m.vSpin = 0;
        m.vTilt = 0;
        m.fly = { fromSpin: m.spin, toSpin: shortest(m.spin, a.spin), fromTilt: m.tilt, toTilt: THREE.MathUtils.clamp(a.tilt, -MAX_TILT, MAX_TILT), t0: performance.now(), id: "" };
      },
      resetZoom() {
        motion.current.zoomTo = 1;
        motion.current.dive = null;
      },
      startDive(id, durationMs, onDone, endDistance = 1.12) {
        const f = farms.find((x) => x.id === id);
        if (!f) return;
        const m = motion.current;
        const a = faceAngles(f.lon, f.lat);
        m.fly = null;
        m.dragging = false;
        m.dive = { fromSpin: m.spin, toSpin: shortest(m.spin, a.spin), fromTilt: m.tilt, toTilt: a.tilt, fromZoom: m.zoom, toZoom: endDistance / CAM_DIST, t0: performance.now(), dur: Math.max(1, durationMs), done: false, onDone };
      },
      diveTo(farmId, durationMs, onDone) {
        this.startDive(farmId, durationMs, onDone);
      },
      cancelDive() {
        const m = motion.current;
        m.dive = null;
        m.zoomTo = 1;
      },
      isDiving() {
        return !!motion.current.dive;
      },
    };
    // Dev only: lets headless QA and the keyframe script drive the globe (window.__heroEarth).
    if (process.env.NODE_ENV !== "production") (window as unknown as { __heroEarth?: HeroEarthApi }).__heroEarth = props.apiRef.current;
  }, [props.apiRef, farms]);

  // Scroll to zoom (when centred): up zooms in, down zooms out. Native listener, because React's onWheel is passive and
  // the page must not scroll.
  const zoomOn = useRef(props.zoomEnabled);
  zoomOn.current = props.zoomEnabled;
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!zoomOn.current) return;
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 100 : e.deltaY;
      const m = motion.current;
      m.zoomTo = THREE.MathUtils.clamp(m.zoomTo * Math.exp(px * ZOOM.perPx), ZOOM.min, ZOOM.max);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Drag: rotate under the cursor (1 / radius-in-px radians per px), inertia after release.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button !== 0 || (e.target as Element).closest("[data-pin], [data-camera-controls]")) return;
    const m = motion.current;
    if (m.dive) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    m.dragging = true;
    m.fly = null;
    m.vSpin = 0;
    m.vTilt = 0;
    m.last = { x: e.clientX, y: e.clientY, t: performance.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    started.current = false;
    downAt.current = { x: e.clientX, y: e.clientY };
  };
  const started = useRef(false);
  const downAt = useRef({ x: 0, y: 0 });
  const onPointerMove = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    if (e.pointerType === "mouse") {
      const r = wrap.current?.getBoundingClientRect();
      if (r) {
        places.current.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
        // Over the Earth's disc (centre and radius on screen from the camera distance)?
        const m0 = motion.current;
        const vf = r.width / r.height >= 1 ? 2 * Math.atan(Math.tan(CESIUM_FOV_RAD / 2) / (r.width / r.height)) : CESIUM_FOV_RAD;
        const d0 = CAM_DIST * m0.zoom;
        const rad = r.height / 2 / (Math.tan(vf / 2) * Math.sqrt(d0 * d0 - 1));
        const cx = r.width / 2 + (m0.off.cur * r.width) / 2;
        const over = Math.hypot(e.clientX - r.left - cx, e.clientY - r.top - r.height / 2) < rad;
        const ring = lens.current;
        if (ring) {
          ring.style.transform = `translate3d(${e.clientX - r.left}px, ${e.clientY - r.top}px, 0) translate(-50%, -50%)`;
          ring.style.opacity = over && !m0.dragging && !m0.dive ? "1" : "0";
        }
      }
    }
    const m = motion.current;
    if (!m.dragging || !m.last) return;
    if (!started.current && Math.hypot(e.clientX - downAt.current.x, e.clientY - downAt.current.y) >= hero.dragThresholdPx) {
      started.current = true;
      props.onDragStart();
    }
    const h = wrap.current?.clientHeight ?? 800;
    // Earth radius on screen: 1 unit at CAM_DIST with the current vertical fov.
    const w = wrap.current?.clientWidth ?? 1200;
    const vfov = w / h >= 1 ? 2 * Math.atan(Math.tan(CESIUM_FOV_RAD / 2) / (w / h)) : CESIUM_FOV_RAD;
    const dist = CAM_DIST * m.zoom;
    const radiusPx = (h / 2) / (Math.tan(vfov / 2) * Math.sqrt(dist * dist - 1));
    const now = performance.now();
    const dx = e.clientX - m.last.x;
    const dy = e.clientY - m.last.y;
    const dtS = Math.max(0.001, (now - m.last.t) / 1000);
    const dSpin = dx / radiusPx;
    const dTilt = dy / radiusPx;
    m.spin += dSpin;
    m.tilt = THREE.MathUtils.clamp(m.tilt + dTilt, -MAX_TILT, MAX_TILT);
    // Velocity for inertia: smoothed over recent moves.
    m.vSpin = m.vSpin * 0.6 + (dSpin / dtS) * 0.4;
    m.vTilt = m.vTilt * 0.6 + (dTilt / dtS) * 0.4;
    m.last = { x: e.clientX, y: e.clientY, t: now };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    const m = motion.current;
    if (!m.dragging) return;
    m.dragging = false;
    // A pause before release means no fling.
    if (m.last && performance.now() - m.last.t > 80) {
      m.vSpin = 0;
      m.vTilt = 0;
    }
    m.last = null;
    if (started.current) props.onDragEnd();
  };

  const moveCamera = (action: CameraAction) => {
    const m = motion.current;
    if (m.dive) return;
    m.fly = null;
    m.vSpin = 0;
    m.vTilt = 0;
    if (action.endsWith("left")) m.spin -= 0.14;
    if (action.endsWith("right")) m.spin += 0.14;
    if (action.endsWith("up")) m.tilt = THREE.MathUtils.clamp(m.tilt + 0.12, -MAX_TILT, MAX_TILT);
    if (action.endsWith("down")) m.tilt = THREE.MathUtils.clamp(m.tilt - 0.12, -MAX_TILT, MAX_TILT);
    if (props.zoomEnabled && action === "zoom-in") m.zoomTo = THREE.MathUtils.clamp(m.zoomTo * 0.85, ZOOM.min, ZOOM.max);
    if (props.zoomEnabled && action === "zoom-out") m.zoomTo = THREE.MathUtils.clamp(m.zoomTo * 1.18, ZOOM.min, ZOOM.max);
    props.onDragStart();
    props.onDragEnd();
  };

  return (
    <div
      ref={wrap}
      className="absolute inset-0 cursor-grab touch-none bg-black active:cursor-grabbing"
      tabIndex={props.zoomEnabled ? 0 : -1}
      aria-label="Earth camera. Arrow keys rotate, plus and minus zoom."
      onKeyDown={(e) => {
        if (!props.zoomEnabled || e.altKey || e.ctrlKey || e.metaKey || (e.target !== e.currentTarget && !(e.target as HTMLElement).closest("[data-camera-controls]"))) return;
        const action = cameraActionForKey(e.key, e.shiftKey);
        if (action) { e.preventDefault(); moveCamera(action); }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      onPointerLeave={() => {
        places.current.pointer = null;
        if (lens.current) lens.current.style.opacity = "0";
      }}
    >
      <Canvas linear flat dpr={[1, 2]} frameloop={props.active ? "always" : "never"} gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }} camera={{ position: [0, 0, CAM_DIST], fov: 35 }} onCreated={({ gl }) => gl.setClearColor("#000000", 1)}>
        <Suspense fallback={null}>
          <Scene {...props} motion={motion} pinEls={pinEls} pinAlpha={pinAlpha} pinOff={pinOff} leaderEls={leaderEls} labels={labels} hovered={hovered} places={places} />
        </Suspense>
      </Canvas>
      {props.zoomEnabled && (
        <details data-camera-controls className="absolute right-6 bottom-[140px] z-[120] max-w-[21rem] rounded-xl border border-white/20 bg-black/85 p-3 text-xs text-white">
          <summary className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Earth camera controls</summary>
          <p className="mt-2 mb-2">Arrow keys rotate · + / − zoom</p>
          <div className="flex flex-wrap gap-1">
            {([ ["pan-left", "Rotate left"], ["pan-right", "Rotate right"], ["pan-up", "Rotate up"], ["pan-down", "Rotate down"], ["zoom-in", "Zoom in"], ["zoom-out", "Zoom out"] ] as const).map(([action, label]) => (
              <button key={action} type="button" onClick={() => moveCamera(action)} className="rounded border border-white/25 px-2 py-1 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">{label}</button>
            ))}
          </div>
        </details>
      )}
      {/* Vignette: darkens the frame edges so the Earth holds the centre. */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.32) 100%)" }} aria-hidden />
      {/* Glass cursor: a small lens ring over the Earth (brightens and saturates what is under it). */}
      <div
        ref={lens}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 rounded-full transition-opacity duration-300"
        style={{ width: 72, height: 72, opacity: 0, border: "1px solid rgba(255,255,255,0.35)", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.35), 0 8px 24px rgba(0,0,0,0.35)", backdropFilter: "brightness(1.18) saturate(1.4) contrast(1.05)", WebkitBackdropFilter: "brightness(1.18) saturate(1.4) contrast(1.05)" }}
      />
      {/* Major city names: placed every frame by the scene, brighter near the cursor and as you zoom in. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {Array.from({ length: CITY_LABELS_MAX }, (_, i) => (
          <span
            key={i}
            ref={(el) => {
              if (el) places.current.els[i] = el;
            }}
            className="absolute left-0 top-0 whitespace-nowrap pb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-[rgba(255,253,226,0.74)] after:absolute after:bottom-0 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-[rgba(255,253,226,0.7)] after:content-['']"
            style={{ opacity: 0, textShadow: "0 1px 3px rgba(0,0,0,0.9)", fontFamily: "'Satoshi', var(--font-hero-ui), sans-serif" }}
          />
        ))}
      </div>
      {/* Waypoints: positioned every frame by the scene. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Hairline stems from a fanned-out glyph to its true spot (hidden until two pins overlap). */}
        <svg className="absolute inset-0 h-full w-full" aria-hidden>
          {props.farms.map((f) => (
            <g
              key={f.id}
              opacity={0}
              ref={(el) => {
                if (el) leaderEls.current.set(f.id, el);
                else leaderEls.current.delete(f.id);
              }}
            >
              <line stroke="#0b0d12" strokeWidth={3} strokeLinecap="round" />
              <line stroke="#ef3b36" strokeWidth={1.2} strokeLinecap="round" />
              <circle r={2.6} fill="#ef3b36" stroke="#0b0d12" strokeWidth={1.2} />
            </g>
          ))}
        </svg>
        {props.farms.map((f) => {
          const on = f.id === props.selectedId;
          const size = pinBox(f.pin, f.tier === "twin" ? { w: 22, h: 33 } : { w: 18, h: 27 });
          return (
            <button
              key={f.id}
              type="button"
              data-pin
              ref={(el) => {
                if (el) pinEls.current.set(f.id, el);
                else pinEls.current.delete(f.id);
              }}
              aria-label={`${f.name}, ${f.country}`}
              onClick={() => props.onPinClick(f.id)}
              onPointerEnter={() => void (hovered.current = f.id)}
              onPointerLeave={() => {
                hovered.current = null;
                props.onHover(null);
              }}
              onFocus={() => void (hovered.current = f.id)}
              onBlur={() => {
                hovered.current = null;
                props.onHover(null);
              }}
              className="group absolute top-0 left-0 opacity-0 outline-none"
              style={{ willChange: "transform", width: size.w, height: size.h }}
            >
              {/* The tip of the pin sits on the farm. Hover lifts it 2 px, press sinks it 1 px and squeezes to 0.9 (fast in, eased spring-back out), the selected one stands taller. */}
              <Pin3D
                width={size.w}
                height={size.h}
                tone={f.tier}
                design={f.pin}
                className="block origin-bottom transition-transform duration-[180ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:-translate-y-[2px] group-hover:scale-[1.08] group-focus-visible:-translate-y-[2px] group-focus-visible:scale-[1.08] group-active:translate-y-px group-active:scale-[0.9] group-active:duration-[60ms] group-active:ease-out motion-reduce:transition-none"
                style={{ transform: on ? "scale(1.18)" : undefined }}
              />
              {/* Name label beside the head (shown only where it does not cover another pin or label; see the scene). */}
              <span
                aria-hidden
                ref={(el) => {
                  if (el) labels.current.els.set(f.id, el);
                  else labels.current.els.delete(f.id);
                }}
                className="absolute flex max-w-[190px] items-center gap-1.5 rounded-full border border-white/[0.12] bg-[#07090d]/80 py-[3px] pr-2.5 pl-2 text-[12px] leading-[16px] font-medium whitespace-nowrap text-white/[0.94] opacity-0 shadow-[0_4px_14px_rgba(0,0,0,0.5)] backdrop-blur-md transition-colors group-hover:border-[#a3bfe9]/50 group-focus-visible:border-[#a3bfe9]/70"
                style={{ left: 36, top: 19, transform: "translateY(-50%)", ...(on && { borderColor: "rgba(163,191,233,0.7)" }) }}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: f.tier === "twin" ? "#a3bfe9" : "rgba(255,255,255,0.45)" }} />
                <span className="truncate">{shortName(f.name)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

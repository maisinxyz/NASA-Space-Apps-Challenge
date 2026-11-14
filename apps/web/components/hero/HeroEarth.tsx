"use client";
// The hero's Earth: a Three.js sphere (react-three-fiber) with NASA Blue Marble day imagery, NASA "Earth at night"
// lights on the far side of a soft terminator, a gentle ocean glint, an inner rim and an outer atmosphere glow, on a
// pure black background. The sun is fixed to the viewer (left, toward the headline), so the face you see is always lit while the
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

import type { Farm, PinHover } from "@/components/globe/types";

import { Pin3D, pinBox } from "./Pin3D";
import { easeInFlashOut, flyTo, hero, zoom as ZOOM } from "./tokens";

const DAY = "/hero/earth/earth-day-3840.jpg";
const NIGHT = "/hero/earth/earth-night-3840.jpg";

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
const GLOW_SCALE = 1.06;
/** Pin facing threshold: hide waypoints on the far side and right at the limb. */
const PIN_FACING = 0.12;

export type HeroEarthApi = {
  isFacing(id: string): boolean;
  /** Turn the Earth so this farm faces the viewer (eased arc); `onFlyDone` fires when it gets there. */
  face(id: string): void;
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
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vPosV;
  varying vec3 vObj;
  varying mat3 vNM;
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
  void main() {
    vec3 n0 = normalize(vNormalV);
    vec3 v = normalize(-vPosV);
    vec3 po = normalize(vObj);
    vec3 sunO = sunV * vNM; // sun direction in object space (transpose of a rotation)

    // Imagery with crisper coastlines (unsharp mask) and a coast-distance estimate from the land/water mask.
    vec3 raw = texture2D(dayMap, vUv).rgb;
    vec2 e1 = vec2(0.0004, 0.0008);
    vec3 blur = 0.25 * (texture2D(dayMap, vUv + vec2(e1.x, 0.0)).rgb + texture2D(dayMap, vUv - vec2(e1.x, 0.0)).rgb + texture2D(dayMap, vUv + vec2(0.0, e1.y)).rgb + texture2D(dayMap, vUv - vec2(0.0, e1.y)).rgb);
    vec3 day = grade(clamp(raw + (raw - blur) * 0.55, 0.0, 1.0));
    vec3 night = texture2D(nightMap, vUv).rgb;
    float water = waterOf(raw);
    float wNear = 0.0;
    if (lowDetail > 0.5) wNear = 8.0 * water; else {
    wNear += waterOf(texture2D(dayMap, vUv + vec2(0.003, 0.0)).rgb) + waterOf(texture2D(dayMap, vUv - vec2(0.003, 0.0)).rgb) + waterOf(texture2D(dayMap, vUv + vec2(0.0, 0.006)).rgb) + waterOf(texture2D(dayMap, vUv - vec2(0.0, 0.006)).rgb);
    wNear += waterOf(texture2D(dayMap, vUv + vec2(0.008, 0.0)).rgb) + waterOf(texture2D(dayMap, vUv - vec2(0.008, 0.0)).rgb) + waterOf(texture2D(dayMap, vUv + vec2(0.0, 0.016)).rgb) + waterOf(texture2D(dayMap, vUv - vec2(0.0, 0.016)).rgb);
    }
    float shallow = water * smoothstep(0.0, 0.7, 1.0 - wNear / 8.0);

    // Ocean: normal perturbed by the moving swell at two scales (fine chop fades before it would alias).
    float pxFreq = length(fwidth(po)) * 800.0;
    float fine = 1.0 - smoothstep(0.7, 1.8, pxFreq);
    vec3 gObj = swell(po, time, fine);
    gObj -= po * dot(gObj, po);
    vec3 n = normalize(n0 + normalize(vNM * gObj + 1e-5) * min(length(gObj), 2.0) * 0.011 * water);

    float ndl = dot(n0, sunV);
    float ndlW = dot(n, sunV);
    float dayMix = smoothstep(-0.2, 0.34, ndl);
    float diffuse = clamp(ndl * 0.8 + 0.22, 0.0, 1.0);

    // Clouds and their soft shadow on the surface below (the shadow is the same field sampled toward the sun, a little coarser).
    float cl = cloudAt(po, lowDetail > 0.5 ? 2 : 4);
    vec3 sunTan = sunO - po * dot(sunO, po);
    float cs = cloudAt(normalize(po + sunTan * 0.035), lowDetail > 0.5 ? 2 : 3);

    // Land: relief from the imagery's own shading and gentle colour variation; ocean: deeper face-on, lighter and bluer at the limb, turquoise on shallows, slow colour drift.
    float lum = dot(day, vec3(0.299, 0.587, 0.114));
    vec2 gl2 = vec2(dFdx(lum), dFdy(lum));
    float relief = clamp(dot(gl2, normalize(sunV.xy + 1e-4)) * 14.0, -0.12, 0.12);
    float vary = (vnoise(po * 28.0) - 0.5) * 0.10 + (vnoise(po * 70.0 + 5.0) - 0.5) * 0.06;
    vec3 landC = day * (1.0 + relief + vary) * mix(vec3(1.0), vec3(1.03, 1.0, 0.95), step(0.5, vnoise(po * 9.0)));
    vec3 deep = day * vec3(1.0, 1.12, 1.22) + vec3(0.004, 0.012, 0.03);
    float ang = 1.0 - max(dot(n0, v), 0.0);
    vec3 oceanC = mix(deep, day * vec3(1.05, 1.08, 1.06) + vec3(0.0, 0.015, 0.03), pow(ang, 2.0) * 0.6);
    oceanC = mix(oceanC, oceanC * vec3(0.6, 1.3, 1.28) + vec3(0.0, 0.03, 0.04), shallow * 0.5);
    oceanC *= 1.0 + (vnoise(po * 6.0 + 2.0) - 0.5) * 0.14;
    vec3 base = mix(landC, oceanC, water);
    base *= 1.0 - 0.38 * cs * (0.4 + 0.6 * dayMix);

    vec3 lit = base * (0.07 + 1.38 * diffuse);
    vec3 col = mix(night * vec3(1.0, 0.85, 0.6) * 0.9, lit, dayMix);

    // Sun on the sea: a faint broad sheen and a small glint that sparkles with the swell; clouds mask it.
    vec3 h = normalize(sunV + v);
    float nh = max(dot(n, h), 0.0);
    float sheen = pow(nh, 260.0) * 0.025 + pow(nh, 900.0) * 0.4;
    col += vec3(0.92, 0.96, 1.0) * sheen * water * smoothstep(0.0, 0.3, ndlW) * dayMix * (1.0 - cl);

    // Cloud layer: white, lit like the ground but a little brighter, thinner edges fade; self-shaded on the side away from the sun.
    float cloudDay = smoothstep(-0.25, 0.22, ndl);
    float selfShade = 1.0 - 0.28 * clamp(cs - cl * 0.6, 0.0, 1.0);
    vec3 cloudCol = vec3(0.95, 0.97, 1.0) * (0.05 + 1.12 * clamp(ndl * 0.85 + 0.2, 0.0, 1.0)) * selfShade;
    col = mix(col, cloudCol, cl * 0.66 * cloudDay);

    // Limb: a thin atmosphere seen edge-on (bluer, strongest on the lit side), plus a faint scatter at the terminator.
    float fres = pow(1.0 - max(dot(n0, v), 0.0), 3.0);
    float limb = pow(1.0 - max(dot(n0, v), 0.0), 4.5);
    col += vec3(0.28, 0.5, 0.95) * limb * (0.15 + 0.85 * dayMix) * 0.55;
    col += rimColor * fres * (0.12 + 0.88 * dayMix) * 0.7 * rimOn;
    float term = exp(-pow(ndl / 0.16, 2.0));
    col += vec3(0.05, 0.07, 0.12) * term * (0.4 + 0.6 * fres) * rimOn;
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
    // Back faces of the shell: -dot(n, v) is shellCos where the shell meets the Earth's limb and 0 at the shell's own
    // edge, so the glow starts at the limb (no dark gap) and fades out into space.
    float k = clamp(-dot(n, v) / shellCos, 0.0, 1.0);
    float a = pow(k, 2.2) * 0.9;
    float sunSide = 0.18 + 0.82 * smoothstep(-0.45, 0.6, dot(n, sunV));
    gl_FragColor = vec4(glowColor * a * sunSide, a * sunSide);
  }
`;

/** Pins closer than this on screen (px) are fanned apart: glyph width (36) plus a visible gap, and glyph height. */
const PIN_SEP_W = 48;
const PIN_SEP_H = 38;
type PinItem = { f: Farm; x: number; y: number; fdot: number; facing: boolean; alpha: number; tx: number };

type Motion = {
  spin: number;
  tilt: number;
  vSpin: number;
  vTilt: number;
  dragging: boolean;
  last: { x: number; y: number; t: number } | null;
  dive: { fromSpin: number; toSpin: number; fromTilt: number; toTilt: number; fromZoom: number; toZoom: number; t0: number; dur: number; done: boolean; onDone?: () => void } | null;
  fly: { fromSpin: number; toSpin: number; fromTilt: number; toTilt: number; t0: number; id: string } | null;
  off: { cur: number; from: number; to: number; t0: number };
  camAt: number;
  /** Camera distance as a multiple of the whole-Earth distance: current (eased) and where the wheel wants it. */
  zoom: number;
  zoomTo: number;
};

function Scene(p: Props & { motion: MutableRefObject<Motion>; pinEls: MutableRefObject<Map<string, HTMLElement>>; pinAlpha: MutableRefObject<Map<string, number>>; pinOff: MutableRefObject<Map<string, number>>; leaderEls: MutableRefObject<Map<string, SVGGElement>>; hovered: MutableRefObject<string | null> }) {
  const { camera, size, gl } = useThree();
  const [day, night] = useLoader(THREE.TextureLoader, [DAY, NIGHT]);
  const tilted = useRef<THREE.Group>(null);
  const spun = useRef<THREE.Group>(null);
  const earthMat = useRef<THREE.ShaderMaterial>(null);
  const live = useRef(p);
  live.current = p;

  useMemo(() => {
    for (const t of [day, night]) {
      t.anisotropy = gl.capabilities.getMaxAnisotropy();
      t.colorSpace = THREE.NoColorSpace;
    }
  }, [day, night, gl]);

  const uniforms = useMemo(
    () => ({
      dayMap: { value: day },
      nightMap: { value: night },
      sunV: { value: SUN.clone() },
      rimColor: { value: new THREE.Color("#7fb2ff") },
      rimOn: { value: 1 },
      time: { value: 0 },
      lowDetail: { value: 0 },
    }),
    [day, night],
  );
  const glowUniforms = useMemo(() => ({ glowColor: { value: new THREE.Color("#5f9dff") }, sunV: { value: SUN.clone() }, shellCos: { value: Math.sqrt(1 - 1 / (GLOW_SCALE * GLOW_SCALE)) } }), []);

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
    cam.position.z = CAM_DIST * m.zoom;
    cam.updateMatrixWorld();
    const halfW = CAM_DIST * m.zoom * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect;
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
  const motion = useRef<Motion>({ spin: 0, tilt: THREE.MathUtils.degToRad(20), vSpin: 0, vTilt: 0, dragging: false, last: null, fly: null, dive: null, off: { cur: props.offsetX, from: props.offsetX, to: props.offsetX, t0: 0 }, camAt: 0, zoom: 1, zoomTo: 1 });
  const pinEls = useRef(new Map<string, HTMLElement>());
  const pinAlpha = useRef(new Map<string, number>());
  const pinOff = useRef(new Map<string, number>());
  const leaderEls = useRef(new Map<string, SVGGElement>());
  const hovered = useRef<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useLoadProgress(props.onProgress);

  // Start facing the Americas (like the Cesium home view), then whatever the user does.
  useMemo(() => {
    const a = faceAngles(-100, 20);
    motion.current.spin = a.spin;
    motion.current.tilt = a.tilt;
  }, []);

  // Turn a farm to face the viewer (eased arc along the shortest way round); the selected farm turns on selection.
  const { selectedId, farms } = props;
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
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-pin]")) return;
    const m = motion.current;
    if (m.dive) return;
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
  const onPointerUp = () => {
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

  return (
    <div
      ref={wrap}
      className="absolute inset-0 cursor-grab touch-none bg-black active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Canvas linear flat dpr={[1, 2]} frameloop={props.active ? "always" : "never"} gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }} camera={{ position: [0, 0, CAM_DIST], fov: 35 }} onCreated={({ gl }) => gl.setClearColor("#000000", 1)}>
        <Suspense fallback={null}>
          <Scene {...props} motion={motion} pinEls={pinEls} pinAlpha={pinAlpha} pinOff={pinOff} leaderEls={leaderEls} hovered={hovered} />
        </Suspense>
      </Canvas>
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
              <line stroke="#ffc857" strokeWidth={1.2} strokeLinecap="round" />
              <circle r={2.6} fill="#ffc857" stroke="#0b0d12" strokeWidth={1.2} />
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
            </button>
          );
        })}
      </div>
    </div>
  );
}

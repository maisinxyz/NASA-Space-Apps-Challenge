"use client";
// The hero's Earth: a Three.js sphere (react-three-fiber) with NASA Blue Marble day imagery, NASA "Earth at night"
// lights on the far side of a soft terminator, a gentle ocean glint, an inner rim and an outer atmosphere glow, on a
// pure black background. The sun is fixed to the viewer (upper left), so the face you see is always lit while the
// Earth turns under it. Rotation is a pure mesh rotation (no camera moves), so it is perfectly smooth.
//
// Interaction: drag rotates the Earth (about its axis left-right, tilt up-down, clamped) with inertia after release;
// it auto-rotates slowly when asked; it glides between the hero position (right) and the centre; picking a farm turns
// the Earth so that farm faces you (eased arc). Waypoints are DOM buttons placed over the sphere every frame (crisp,
// focusable, hoverable), shown only when `showPins`.
//
// The camera's field of view and distance match the Cesium globe's whole-Earth view (60 degree horizontal fov,
// 20,000 km above the surface), so the hand-over to Cesium for the dive happens at the same size.
// Textures: public/hero/earth/SOURCES.md (NASA, public domain).
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { type MutableRefObject, Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { Farm, PinHover } from "@/components/globe/types";

import { color, easeInFlashOut, flyTo, hero } from "./tokens";

const DAY = "/hero/earth/earth-day-3840.jpg";
const NIGHT = "/hero/earth/earth-night-3840.jpg";

/** Cesium whole-Earth view: camera 20,000 km above a 6,371 km Earth = 4.139 radii from the centre. */
const CAM_DIST = (6371 + 20000) / 6371;
/** Cesium's default frustum: 60 degrees across the wider screen dimension. */
const CESIUM_FOV_RAD = THREE.MathUtils.degToRad(60);
/** Auto-rotation: one turn in about three minutes (matches the Cesium globe). */
const SPIN_RAD_S = THREE.MathUtils.degToRad(2);
/** Drag: radians of rotation per pixel = 1 / Earth radius in px (the point under the cursor follows it). Inertia decay /s. */
const INERTIA_DECAY = 3.2;
const MAX_TILT = THREE.MathUtils.degToRad(70);
/** Sun direction in view space (upper left, in front). */
const SUN = new THREE.Vector3(-0.62, 0.38, 0.69).normalize();
/** Atmosphere shell radius, Earth radii. */
const GLOW_SCALE = 1.06;
/** Pin facing threshold: hide waypoints on the far side and right at the limb. */
const PIN_FACING = 0.12;

export type HeroEarthApi = {
  isFacing(id: string): boolean;
  /** Turn the Earth so this farm faces the viewer (eased arc); `onFlyDone` fires when it gets there. */
  face(id: string): void;
};

type Props = {
  farms: Farm[];
  selectedId: string | null;
  /** Where the Earth's centre sits: fraction of half the width from the centre (+ = right). Glides on change. */
  offsetX: number;
  autoRotate: boolean;
  showPins: boolean;
  atmosphere: boolean;
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
  void main() {
    vUv = uv;
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
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vPosV;
  vec3 grade(vec3 c) {
    // A little more contrast and colour, kept natural.
    c = (c - 0.5) * 1.12 + 0.5;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    return clamp(mix(vec3(l), c, 1.22), 0.0, 1.0);
  }
  void main() {
    vec3 n = normalize(vNormalV);
    vec3 v = normalize(-vPosV);
    float ndl = dot(n, sunV);
    float dayMix = smoothstep(-0.12, 0.28, ndl);
    vec3 day = grade(texture2D(dayMap, vUv).rgb);
    vec3 night = texture2D(nightMap, vUv).rgb;
    vec3 lit = day * (0.18 + 0.92 * clamp(ndl * 0.85 + 0.25, 0.0, 1.0));
    vec3 col = mix(night * vec3(1.0, 0.85, 0.6) * 0.9, lit, dayMix);
    // Ocean glint: water is where blue clearly dominates.
    float water = smoothstep(0.02, 0.12, day.b - max(day.r, day.g));
    vec3 h = normalize(sunV + v);
    col += vec3(0.9, 0.95, 1.0) * pow(max(dot(n, h), 0.0), 160.0) * 0.32 * water * dayMix;
    // Inner rim: thin atmosphere seen edge-on.
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    col += rimColor * fres * (0.25 + 0.75 * dayMix) * 0.75 * rimOn;
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
    float sunSide = 0.35 + 0.65 * smoothstep(-0.5, 0.5, dot(n, sunV));
    gl_FragColor = vec4(glowColor * a * sunSide, a * sunSide);
  }
`;

type Motion = {
  spin: number;
  tilt: number;
  vSpin: number;
  vTilt: number;
  dragging: boolean;
  last: { x: number; y: number; t: number } | null;
  fly: { fromSpin: number; toSpin: number; fromTilt: number; toTilt: number; t0: number; id: string } | null;
  off: { cur: number; from: number; to: number; t0: number };
  camAt: number;
};

function Scene(p: Props & { motion: MutableRefObject<Motion>; pinEls: MutableRefObject<Map<string, HTMLElement>>; hovered: MutableRefObject<string | null> }) {
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
    cam.position.set(0, 0, CAM_DIST);
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
    const halfW = CAM_DIST * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect;
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
    } else if (!m.dragging) {
      if (Math.abs(m.vSpin) + Math.abs(m.vTilt) > 1e-4) {
        m.spin += m.vSpin * dt;
        m.tilt = THREE.MathUtils.clamp(m.tilt + m.vTilt * dt, -MAX_TILT, MAX_TILT);
        const decay = Math.exp(-INERTIA_DECAY * dt);
        m.vSpin *= decay;
        m.vTilt *= decay;
      } else if (q.autoRotate && !q.reducedMotion) {
        m.spin += SPIN_RAD_S * dt;
      }
    }
    if (spun.current) spun.current.rotation.y = m.spin;
    if (tilted.current) tilted.current.rotation.x = m.tilt;
    if (earthMat.current) earthMat.current.uniforms.rimOn.value = q.atmosphere ? 1 : 0.35;

    // Waypoints: project to the screen; hide those facing away.
    tilted.current?.updateMatrixWorld();
    const world = spun.current?.matrixWorld;
    let trackSent = false;
    if (world) {
      for (const f of q.farms) {
        const el = q.pinEls.current.get(f.id);
        lonLatToVec(f.lon, f.lat, tmp.v).applyMatrix4(world);
        tmp.n.copy(tmp.v).sub(tilted.current!.position).normalize();
        tmp.toCam.copy(cam.position).sub(tmp.v).normalize();
        const facing = tmp.n.dot(tmp.toCam) > PIN_FACING;
        const s = tmp.v.clone().project(cam);
        const x = (s.x * 0.5 + 0.5) * size.width;
        const y = (-s.y * 0.5 + 0.5) * size.height;
        if (el) {
          el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%)`;
          const show = q.showPins && facing;
          el.style.opacity = show ? "1" : "0";
          el.style.pointerEvents = show ? "auto" : "none";
          el.tabIndex = show ? 0 : -1;
        }
        // The hovered waypoint's label follows it while the Earth moves.
        if (f.id === q.hovered.current) q.onHover(facing && q.showPins ? { id: f.id, x, y } : null);
        if (f.id === q.selectedId) {
          trackSent = true;
          q.onTrack(facing ? { id: f.id, x, y } : null);
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
  const motion = useRef<Motion>({ spin: 0, tilt: THREE.MathUtils.degToRad(20), vSpin: 0, vTilt: 0, dragging: false, last: null, fly: null, off: { cur: props.offsetX, from: props.offsetX, to: props.offsetX, t0: 0 }, camAt: 0 });
  const pinEls = useRef(new Map<string, HTMLElement>());
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
  useEffect(() => {
    faceRef.current(farms.find((x) => x.id === selectedId));
  }, [selectedId, farms]);

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
    };
  }, [props.apiRef, farms]);

  // Drag: rotate under the cursor (1 / radius-in-px radians per px), inertia after release.
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-pin]")) return;
    const m = motion.current;
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
    const radiusPx = (h / 2) / (Math.tan(vfov / 2) * Math.sqrt(CAM_DIST * CAM_DIST - 1));
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
          <Scene {...props} motion={motion} pinEls={pinEls} hovered={hovered} />
        </Suspense>
      </Canvas>
      {/* Waypoints: positioned every frame by the scene; thin rings, the selected one in the accent colour. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {props.farms.map((f) => {
          const on = f.id === props.selectedId;
          const twin = f.tier === "twin";
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
              className="absolute top-0 left-0 grid h-10 w-10 place-items-center rounded-full opacity-0 transition-opacity duration-300 focus-visible:outline-1 focus-visible:outline-white/70"
              style={{ willChange: "transform" }}
            >
              <span
                className="grid place-items-center rounded-full bg-black/30"
                style={{ width: twin ? 22 : 15, height: twin ? 22 : 15, border: `1.5px solid ${on ? color.accent : "rgba(236,238,241,0.95)"}`, boxShadow: twin ? `0 0 0 4px rgba(0,0,0,0.25), 0 0 0 5px ${on ? color.accent : "rgba(236,238,241,0.45)"}` : undefined }}
              >
                <span className="block rounded-full" style={{ width: twin ? 6 : 4, height: twin ? 6 : 4, background: on ? color.accent : "#eceef1" }} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

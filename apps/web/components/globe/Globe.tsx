"use client";
// The Cesium Earth globe: farm pins, the dive / fly-in to a farm, turntable orbit around the simulation square in farm
// view. On the homepage it sits hidden under the hero Earth (components/hero/HeroEarth.tsx) and takes over at the dive
// (jumpTo hands over the whole-Earth view); space is pitch black to match the hero.
// Client-only (load with next/dynamic { ssr: false }). Contract: ./types.ts.
import "@/components/viewer/cesium/base";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cartographic,
  ClassificationType,
  Color,
  ConstantProperty,
  Ellipsoid,
  EllipsoidalOccluder,
  type Entity,
  HeadingPitchRange,
  HeightReference,
  JulianDate,
  LabelCollection,
  LabelStyle,
  Math as CesiumMath,
  Matrix4,
  PrimitiveCollection,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Transforms,
  VerticalOrigin,
  type Viewer,
} from "cesium";
import { forwardRef, type ForwardRefExoticComponent, type RefAttributes, useEffect, useImperativeHandle, useRef, useState } from "react";

import {
  type Box,
  boxOfBbox,
  boxOfRadius,
  cameraFromOrbit,
  clampOrbit,
  clampTarget,
  fromOffsetM,
  localMorningUtcMs,
  type LonLat,
  MIN_HEIGHT_ABOVE_GROUND_M,
  offsetM,
  type Orbit,
  orbitFromCamera,
  startFraming,
} from "@/components/viewer/cesium/clamp";
import { activeLook, createLookLayer, type LookLayer } from "@/components/viewer/cesium/look";
import { createGroundRenderer, type GroundRenderer } from "@/components/viewer/cesium/ground";
import { createFrameStats, createMotionTracker, createThrottle, GROUND_QUERY_MS, needsContinuousRender, qualityFor } from "@/components/viewer/cesium/perf";
import { applyQuality, createViewer, type LoadedTier, loadTier, pickSurface, progressToReport, setFarmCameraLimits, type Surface, tierOrderFromEnv } from "@/components/viewer/cesium/tiles";
import {
  createFieldCanvas,
  createFieldLayer,
  createOverlayLayer,
  createSquareOutline,
  type FieldLayer,
  fieldHoverText,
  fieldIdFromPick,
  type OverlayLayer,
  ringCentroid,
  splitSides,
  SQUARE_RAISE_M,
  type SquareOutline,
} from "@/components/viewer/cesium/twin";

import { createWeatherEngine, type WeatherEngine } from "@/components/viewer/cesium/weather";
import { dive as DIVE, easeInFlashOut } from "@/components/hero/tokens";

import type { CameraState, Farm, FarmSurface, GlobeHandle, GlobeProps, TileTier } from "./types";

// Camera framing (product choices, tune freely).
/** Whole-Earth view: camera height above the ellipsoid, metres. */
const GLOBE_HEIGHT_M = 2.0e7;
/** Continental-scale view used when a pin is selected in globe view, metres. */
const CONTINENT_HEIGHT_M = 7.0e6;
// Orbit framing after the fly-in: Farm.framing, else clamp.ts startFraming's default (-30 deg, 400-600 m).
/** Drag sensitivity, radians per pixel; wheel zoom is exponential in deltaY. */
const ORBIT_RAD_PER_PX = 0.005;
const WHEEL_ZOOM_PER_DELTA = 0.0015;
const FLY_SECONDS = 3;
/** Fly-in safety nets: give up waiting for the terrain height after this, and force the landing this long after the flight should have ended. */
const GROUND_TIMEOUT_S = 4;
const LAND_GRACE_S = 2;
/** Quick dive: cut the camera once the dive film is opaque (its fade-in is 120 ms), and wait this long for terrain at most. */
const CUT_AFTER_MS = 150;
const CUT_GROUND_TIMEOUT_S = 0.5;
const HOME = { lon: -100, lat: 25 };
/** Auto-rotate speed, radians per second (one turn in about three minutes). */
const AUTO_ROTATE_RAD_S = CesiumMath.toRadians(2);
/** Stops the wheel from zooming the Earth out to a dot (globe view), metres. */
const MAX_ZOOM_OUT_M = 4.0e7;
/** Globe tile detail: Cesium's default 2 px; finer in farm view for a sharper ground (costs some fps). */
const GLOBE_SSE_DEFAULT = 2;
const GLOBE_SSE_FARM = 1.5;
/**
 * Fields, overlays and the square outline: on terrain they classify the ground only (OSM buildings stay unpainted);
 * on Google's tiles they must classify the tiles (BOTH); overlays then rely on overlayMask to stay off roofs.
 */
const classificationFor = (s: Surface | null | undefined) => (s === "google" ? ClassificationType.BOTH : ClassificationType.TERRAIN);

/** Dev-only extras used by /dev/cesium. Not part of the shared contract; the exported `Globe` type hides them. */
export type GlobeDevProps = {
  tierOrder?: TileTier[];
  onViewer?(v: { viewer: Viewer; tier: LoadedTier } | null): void;
};

/** Turntable orbit around the simulation square. target = the point at the screen centre (stays inside the square). */
type OrbitState = { target: LonLat; o: Orbit; ground: number; camGround: number; dirty: boolean };

/** A running dive: the camera orbits the waypoint's ENU frame, so the waypoint stays dead centre every frame. */
type DiveState = {
  seq: number;
  target: LonLat;
  ground: number;
  t0: number;
  from: { heading: number; pitch: number; range: number };
  to: Orbit;
  land(): void;
};

type Runtime = {
  viewer: Viewer;
  tier: LoadedTier | null;
  pins: Map<string, { entity: Entity; position: Cartesian3 }>;
  hoverId: string | null;
  flying: boolean;
  flightSeq: number;
  interacted: boolean;
  farmGround: number | undefined;
  /** Terrain height at the farm centre from the fly-in's terrain sample (not roofs/trees), metres. */
  terrainGround: number | undefined;
  fields: FieldLayer;
  /** Field under the cursor (farm view) and its floating name/crop label. */
  hoverField: string | null;
  fieldLabel: LabelCollection;
  /** Overlays of A (whole screen, or left of the divider when comparing) and of B (right of the divider only). */
  overlays: OverlayLayer;
  overlaysB: OverlayLayer;
  /** Field fills as canvases for the A/B split (one per side). */
  fieldCanvasA: ReturnType<typeof createFieldCanvas>;
  fieldCanvasB: ReturnType<typeof createFieldCanvas>;
  outline: SquareOutline;
  look: LookLayer;
  /** Effect engines (weather, ground layers): created on entering farm view, destroyed on leaving. */
  weather: WeatherEngine | null;
  ground: GroundRenderer | null;
  /** Debounced camera-motion flag (dynamic tile quality) and the ~5 Hz gate for ground-height queries. */
  motion: ReturnType<typeof createMotionTracker>;
  groundDue: ReturnType<typeof createThrottle>;
  /** Last onLoadProgress report. */
  progress: { pending: number; at: number } | null;
  /** setCamera() received before the farm-view landing: applied when the orbit starts. */
  pendingCamera: CameraState | null;
  twinLayers: PrimitiveCollection;
  /** Non-null only in farm view after the fly-in; the camera then sits in the target's ENU frame. */
  orbit: OrbitState | null;
  /** The dive from space into a farm while it runs (driven per frame by stepDive). */
  dive: DiveState | null;
  /** Pending farm landing: enters the orbit framing. Forced by the watchdog at `landBy` (performance.now ms). */
  land: (() => void) | null;
  landBy: number;
};

/**
 * Sim-square outline: ground-clamped on terrain; on Google tiles a raised polyline at the terrain height (the
 * classified ground polyline breaks up on the tiles).
 */
function syncOutline(r: Runtime, p: GlobeProps, surface: Surface) {
  r.outline.set(p.simBbox, classificationFor(surface), surface === "google" ? (r.terrainGround ?? r.farmGround ?? 0) + SQUARE_RAISE_M : undefined);
  r.viewer.scene.requestRender();
}

/** Field look: invisible unless showCropFills (and not comparing: the split draws fills on canvases), faint edge on hover/selection. */
function repaintFields(r: Runtime, p: GlobeProps) {
  r.fields.paint(p.cropByField, p.selectedFieldId, !!p.showCropFills && !p.compare, r.hoverField);
}

/**
 * Hover label at the field's centroid (just above the ground, never hidden by tiles): "<name> · <crop> (illustrative)".
 * In the A/B split the crop is the one of the side under the cursor (`xFrac` = cursor x / canvas width).
 */
function setFieldHover(r: Runtime, p: GlobeProps, id: string | null, xFrac: number) {
  const f = id ? p.fields?.find((x) => x.id === id) : undefined;
  const crop = p.compare && xFrac > p.compare.divider ? p.compare.right.cropByField : p.cropByField;
  const text = f ? fieldHoverText(f, crop) : "";
  const changed = id !== r.hoverField;
  r.hoverField = f ? id : null;
  if (changed) repaintFields(r, p);
  const label = r.fieldLabel.length ? r.fieldLabel.get(0) : null;
  if (!f) {
    if (label?.show) {
      label.show = false;
      r.viewer.scene.requestRender();
    }
    return;
  }
  const [lon, lat] = ringCentroid(f.ring);
  const ground = r.tier?.groundAt(Cartographic.fromDegrees(lon, lat)) ?? r.terrainGround ?? 0;
  const position = Cartesian3.fromDegrees(lon, lat, ground + 3);
  if (label) Object.assign(label, { show: true, text, position });
  else
    r.fieldLabel.add({
      position,
      text,
      font: "600 13px system-ui, sans-serif",
      style: LabelStyle.FILL,
      fillColor: Color.WHITE,
      showBackground: true,
      backgroundColor: Color.fromCssColorString("#10201e").withAlpha(0.82), // dark glass, same as pin labels
      backgroundPadding: new Cartesian2(9, 6),
      verticalOrigin: VerticalOrigin.BOTTOM,
      pixelOffset: new Cartesian2(0, -8),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
  r.viewer.scene.requestRender();
}

/** Point the orbit at a camera pose (share link). The hard clamps apply on the next applyOrbit. */
function setOrbitCamera(r: Runtime, c: CameraState) {
  const s = r.orbit;
  if (!s) return;
  const { target, o } = orbitFromCamera(c, s.ground);
  s.target = target;
  s.o = o;
  s.dirty = true;
}

/** The area the farm-view camera is confined to: the simulation square, else a box inscribed in the farm radius. */
const boxOf = (p: GlobeProps, farm: Farm): Box => (p.simBbox ? boxOfBbox(p.simBbox) : boxOfRadius(farm, farm.radiusM));

/**
 * Show the surface tiles.ts pickSurface asks for, falling back if a source fails to load. Google counts as
 * "farm view" only once the fly-in has landed (r.orbit), so the tileset never streams the whole Earth mid-flight.
 */
function syncSurface(r: Runtime, p: GlobeProps, onShown: (s: Surface) => void, onGoogleFailed: () => void) {
  const t = r.tier;
  if (!t) return;
  const want = pickSurface({ tier: t.tier, view: p.view === "farm" && r.orbit ? "farm" : "globe", want: p.surface ?? "google", failed: t.failed });
  void t.setSurface(want).then((ok) => {
    if (r.viewer.isDestroyed()) return;
    if (ok) return onShown(t.surface);
    if (want === "google") onGoogleFailed();
    syncSurface(r, p, onShown, onGoogleFailed); // `failed` grew; pick again ("base" always succeeds)
  });
}

const toError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

// Pins differ by shape and size, not only colour: twin = large teal diamond with a centre dot, explore = small white disc.
const pinImages: { twin?: HTMLCanvasElement; explore?: HTMLCanvasElement } = {};
function pinImage(twin: boolean): HTMLCanvasElement {
  const key = twin ? "twin" : "explore";
  const cached = pinImages[key];
  if (cached) return cached;
  const size = twin ? 44 : 22;
  const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
  const g = canvas.getContext("2d")!;
  const c = size / 2;
  g.lineWidth = 3;
  g.strokeStyle = "#10201e";
  g.beginPath();
  if (twin) {
    g.moveTo(c, 3);
    g.lineTo(size - 3, c);
    g.lineTo(c, size - 3);
    g.lineTo(3, c);
    g.closePath();
    g.fillStyle = "#5fbfb2"; // --accent (dark theme) from app/globals.css
  } else {
    g.arc(c, c, c - 3, 0, Math.PI * 2);
    g.fillStyle = "#ffffff";
  }
  g.fill();
  g.stroke();
  if (twin) {
    g.beginPath();
    g.arc(c, c, 5, 0, Math.PI * 2);
    g.fillStyle = "#ffffff";
    g.fill();
  }
  return (pinImages[key] = canvas);
}

function stylePins(r: Runtime, selectedId: string | null) {
  for (const [id, { entity }] of r.pins) {
    entity.billboard!.scale = new ConstantProperty(id === selectedId ? 1.35 : 1);
    entity.label!.show = new ConstantProperty(id === selectedId || id === r.hoverId);
  }
  r.viewer.scene.requestRender();
}

function startFlight(r: Runtime) {
  const seq = ++r.flightSeq;
  r.flying = true;
  const done = () => {
    if (seq === r.flightSeq) r.flying = false;
  };
  return { seq, done };
}

/** Camera back to the normal globe frame (the orbit uses a local ENU frame). */
function leaveOrbit(r: Runtime) {
  r.orbit = null;
  r.dive = null;
  r.land = null;
  r.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
}

/** Apply the orbit state: hard clamps (target inside the square, range, pitch, 20 m floor), then lookAtTransform at the target. */
function applyOrbit(r: Runtime, p: GlobeProps, farm: Farm) {
  const s = r.orbit;
  if (!s) return;
  const box = boxOf(p, farm);
  s.target = fromOffsetM(box, clampTarget(offsetM(s.target, box), box));
  // The camera must stay MIN_HEIGHT_ABOVE_GROUND_M over the ground under it (last frame's value): tilt downward if needed.
  s.o = clampOrbit(s.o, s.camGround + MIN_HEIGHT_ABOVE_GROUND_M - s.ground, farm.minRangeM);
  const frame = Transforms.eastNorthUpToFixedFrame(Cartesian3.fromDegrees(s.target.lon, s.target.lat, s.ground));
  r.viewer.camera.lookAtTransform(frame, new HeadingPitchRange(s.o.heading, s.o.pitch, s.o.range));
  s.dirty = false;
  r.viewer.scene.requestRender();
}

/** Pure: the dive's progress curve over log-distance. Accelerates (quadratic) until `brakeAt`, then brakes (quadratic). */
export function diveProgress(t: number) {
  const b = DIVE.brakeAt;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < b) return b * (t / b) * (t / b);
  const u = (t - b) / (1 - b);
  return b + (1 - b) * (1 - (1 - u) * (1 - u));
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerpAngle = (a: number, b: number, w: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * w;

/** Heading / pitch / range of the camera as seen from a target's ENU frame (inverse of Cesium's lookAt offset). */
function hprFrom(r: Runtime, target: LonLat, ground: number) {
  const frame = Transforms.eastNorthUpToFixedFrame(Cartesian3.fromDegrees(target.lon, target.lat, ground));
  const local = Matrix4.multiplyByPoint(Matrix4.inverseTransformation(frame, new Matrix4()), r.viewer.camera.positionWC, new Cartesian3());
  const range = Cartesian3.magnitude(local);
  return { heading: Math.atan2(-local.x, -local.y), pitch: -Math.asin(Math.min(1, Math.max(-1, local.z / range))), range };
}

/** One frame of the dive. Returns false when it has finished (and landed). */
function stepDive(r: Runtime, now: number): boolean {
  const d = r.dive;
  if (!d) return false;
  if (d.seq !== r.flightSeq || r.viewer.isDestroyed()) {
    r.dive = null;
    return false;
  }
  const t = Math.min(1, (now - d.t0) / (DIVE.fallSeconds * 1000));
  const s = diveProgress(t);
  const range = Math.exp(Math.log(d.from.range) + (Math.log(d.to.range) - Math.log(d.from.range)) * s);
  // Pitch: straight down while far away, a low skim toward the waypoint across the land, then the farm framing.
  const skim = CesiumMath.toRadians(DIVE.skimPitchDeg);
  let pitch = d.from.pitch + (skim - d.from.pitch) * smooth(DIVE.skimFrom, DIVE.skimTo, s);
  pitch = pitch + (d.to.pitch - pitch) * smooth(DIVE.skimTo, 1, s);
  // Keep a safe height over the target while skimming.
  pitch = Math.min(pitch, -Math.asin(Math.min(1, DIVE.minHeightM / range)));
  const heading = lerpAngle(d.from.heading, d.to.heading, smooth(DIVE.skimFrom - 0.15, DIVE.skimTo, s));
  const frame = Transforms.eastNorthUpToFixedFrame(Cartesian3.fromDegrees(d.target.lon, d.target.lat, d.ground));
  r.viewer.camera.lookAtTransform(frame, new HeadingPitchRange(heading, pitch, range));
  r.viewer.scene.requestRender();
  if (t < 1) return true;
  r.dive = null;
  d.land();
  return false;
}

/**
 * Fly to the farm's orbit framing. `dive` = the hero's approach from space: swing the farm to the centre, then fall
 * (stepDive), or with `quickDive` (a dive film covers the screen) cut straight to the framing. Reduced motion: no dive.
 */
function flyToFarm(r: Runtime, p: GlobeProps, farm: Farm, dive = false) {
  leaveOrbit(r);
  const { seq, done } = startFlight(r);
  const { target: centre, o: framing } = startFraming(boxOf(p, farm), farm.framing, farm.minRangeM);
  let ground = r.farmGround ?? 0;
  // Landing = the orbit framing, exactly where a completed flight ends. It also runs when the flight is cancelled
  // without being superseded, and from the per-frame watchdog if the flight never finishes, so "Open twin" always
  // ends in the same framing as Reset view. The per-frame ground update then corrects `ground` if it was a guess.
  const land = () => {
    if (seq !== r.flightSeq || r.viewer.isDestroyed() || r.land !== land) return;
    r.land = null;
    done();
    r.orbit = { target: centre, o: framing, ground, camGround: ground, dirty: true };
    if (r.pendingCamera) setOrbitCamera(r, r.pendingCamera);
    r.pendingCamera = null;
    p.onArrive?.(farm.id);
  };
  const cut = dive && !p.reducedMotion && !!p.quickDive;
  const meteor = dive && !p.reducedMotion && !cut;
  r.land = land;
  r.landBy = performance.now() + (GROUND_TIMEOUT_S + (meteor ? DIVE.centreSeconds + DIVE.fallSeconds : FLY_SECONDS) + LAND_GRACE_S) * 1000;
  let started = false;
  const go = (g: number) => {
    if (started || seq !== r.flightSeq || r.viewer.isDestroyed()) return;
    started = true;
    ground = g;
    r.farmGround = g;
    r.terrainGround = g;
    if (r.tier) syncOutline(r, p, r.tier.surface);
    if (!meteor)
      return r.viewer.camera.flyToBoundingSphere(new BoundingSphere(Cartesian3.fromDegrees(centre.lon, centre.lat, g), 1), {
        offset: new HeadingPitchRange(framing.heading, framing.pitch, framing.range),
        duration: p.reducedMotion || cut ? 0 : FLY_SECONDS,
        complete: land,
        cancel: land, // a no-op when a newer flight superseded this one (seq changed)
      });
    // Dive: the farm is held dead centre the whole way (stepDive runs every frame in preUpdate).
    const fall = () => {
      if (seq !== r.flightSeq || r.viewer.isDestroyed()) return;
      r.dive = { seq, target: centre, ground: g, t0: performance.now(), from: hprFrom(r, centre, g), to: framing, land };
      r.viewer.scene.requestRender();
    };
    // First swing the farm to the centre of the view along a great circle, unless it is already there (jumpTo).
    const cam = r.viewer.camera;
    const toTarget = Cartesian3.normalize(Cartesian3.subtract(Cartesian3.fromDegrees(centre.lon, centre.lat, g), cam.positionWC, new Cartesian3()), new Cartesian3());
    const offCentre = Math.acos(Math.min(1, Cartesian3.dot(toTarget, cam.directionWC)));
    if (offCentre < CesiumMath.toRadians(1.5)) return fall();
    cam.flyTo({
      destination: Cartesian3.fromDegrees(centre.lon, centre.lat, cam.positionCartographic.height),
      orientation: { heading: 0, pitch: -CesiumMath.PI_OVER_TWO, roll: 0 },
      duration: DIVE.centreSeconds,
      easingFunction: easeInFlashOut,
      maximumHeight: cam.positionCartographic.height,
      complete: fall,
      cancel: land,
    });
  };
  // The target height comes from terrain so the flight does not end underground at high sites; do not wait forever.
  const lookup = () => {
    (r.tier ? r.tier.sampleGround(centre.lon, centre.lat) : Promise.resolve(0)).then(go, () => go(0));
    setTimeout(() => go(ground), (cut ? CUT_GROUND_TIMEOUT_S : meteor ? 1 : GROUND_TIMEOUT_S) * 1000);
  };
  if (cut) setTimeout(lookup, CUT_AFTER_MS);
  else lookup();
}

function flyToGlobe(r: Runtime, at: { lon: number; lat: number } | undefined, heightM: number, reducedMotion: boolean) {
  leaveOrbit(r);
  r.pendingCamera = null;
  const { done } = startFlight(r);
  const here = r.viewer.camera.positionCartographic;
  const lon = at?.lon ?? CesiumMath.toDegrees(here.longitude);
  const lat = at?.lat ?? CesiumMath.toDegrees(here.latitude);
  r.viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(lon, lat, heightM), duration: reducedMotion ? 0 : FLY_SECONDS, complete: done, cancel: done });
}

/**
 * Dev performance readout: window.__ftPerf() returns frame ms (avg/p95 between rendered frames), fps while rendering
 * continuously, render CPU ms, tile requests/processing, tileset memory and the active effect engines. A small overlay
 * (toggle: backtick key; shown from the start with ?perf=1) prints the same. Only in dev builds or with ?perf=1.
 */
function installPerfProbe(r: Runtime): () => void {
  const params = new URLSearchParams(window.location.search);
  if (process.env.NODE_ENV === "production" && params.get("perf") !== "1") return () => {};
  const { scene } = r.viewer;
  const frames = createFrameStats();
  const cpu = createFrameStats();
  let lastRender = 0;
  let renderStart = 0;
  const offPre = scene.preRender.addEventListener(() => (renderStart = performance.now()));
  const offPost = scene.postRender.addEventListener(() => {
    const t = performance.now();
    if (lastRender && t - lastRender < 250) frames.push(t - lastRender); // longer gaps = idle (requestRenderMode), not slow frames
    lastRender = t;
    if (renderStart) cpu.push(t - renderStart);
  });
  const snapshot = () => {
    const ts = r.tier?.tileset;
    const st = (ts as unknown as { statistics?: { numberOfPendingRequests: number; numberOfTilesProcessing: number } } | undefined)?.statistics; // not in the typings
    const f = frames.read();
    return {
      frameMsAvg: +f.avgMs.toFixed(1),
      frameMsP95: +f.p95Ms.toFixed(1),
      fps: +f.fps.toFixed(1),
      renderCpuMsAvg: +cpu.read().avgMs.toFixed(1),
      tilesPending: st?.numberOfPendingRequests ?? 0,
      tilesProcessing: st?.numberOfTilesProcessing ?? 0,
      tilesetMemoryMB: ts ? Math.round(ts.totalMemoryUsageInBytes / 1048576) : 0,
      resolutionScale: +r.viewer.resolutionScale.toFixed(2),
      sse: ts?.maximumScreenSpaceError ?? null,
      engines: { weather: !!r.weather?.active, ground: !!r.ground?.active },
    };
  };
  (window as unknown as { __ftPerf?: typeof snapshot }).__ftPerf = snapshot;
  const box = document.createElement("pre");
  Object.assign(box.style, { position: "absolute", right: "8px", top: "8px", zIndex: "20", margin: "0", padding: "6px 8px", font: "11px/1.4 ui-monospace, monospace", color: "#d7f3ee", background: "rgba(16,32,30,.82)", borderRadius: "6px", pointerEvents: "none", display: params.get("perf") === "1" ? "block" : "none" });
  r.viewer.container.appendChild(box);
  const draw = () => {
    if (box.style.display === "none") return;
    const s = snapshot();
    const fx = `weather ${s.engines.weather ? "on" : "off"}, ground ${s.engines.ground ? "on" : "off"}`;
    box.textContent = [`${s.fps} fps  ${s.frameMsAvg} ms avg  ${s.frameMsP95} ms p95`, `render cpu ${s.renderCpuMsAvg} ms  res ${s.resolutionScale}  sse ${s.sse}`, `tiles pending ${s.tilesPending}  processing ${s.tilesProcessing}`, `tileset ${s.tilesetMemoryMB} MB  fx ${fx}`].join("\n");
  };
  const timer = setInterval(draw, 500);
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== "Backquote") return;
    box.style.display = box.style.display === "none" ? "block" : "none";
    draw();
  };
  window.addEventListener("keydown", onKey);
  return () => {
    offPre();
    offPost();
    clearInterval(timer);
    window.removeEventListener("keydown", onKey);
    box.remove();
    delete (window as unknown as { __ftPerf?: unknown }).__ftPerf;
  };
}

const GlobeImpl = forwardRef<GlobeHandle, GlobeProps & GlobeDevProps>(function Globe(props, ref) {
  const { farms, selectedId, view, className } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const rt = useRef<Runtime | null>(null);
  const prev = useRef<{ view: string; selectedId: string | null } | null>(null);
  const [surface, setSurface] = useState<Surface | null>(null);
  // Re-pick the surface from the latest props (view, surface, landed or not). Google failing reports tier B.
  const syncRef = useRef(() => {});
  useEffect(() => {
    syncRef.current = () => {
      const r = rt.current;
      if (r) syncSurface(r, live.current, setSurface, () => live.current.onReady({ tier: "B" }));
    };
  });
  // Latest props for long-lived Cesium callbacks (the viewer is created once).
  const live = useRef(props);
  useEffect(() => {
    live.current = props;
  });

  const selectedFarm = () => live.current.farms.find((f) => f.id === live.current.selectedId);
  const resetView = () => {
    const r = rt.current;
    if (!r) return;
    const farm = selectedFarm();
    if (live.current.view === "farm" && farm) flyToFarm(r, live.current, farm);
    else flyToGlobe(r, farm, GLOBE_HEIGHT_M, live.current.reducedMotion);
  };
  const resetRef = useRef(resetView);
  useEffect(() => {
    resetRef.current = resetView;
  });
  useImperativeHandle(
    ref,
    () => ({
      resetView: () => resetRef.current(),
      getCamera: () => {
        const r = rt.current;
        if (!r) return null;
        if (r.orbit) return cameraFromOrbit(r.orbit.target, r.orbit.ground, r.orbit.o);
        const c = r.viewer.camera;
        const pc = c.positionCartographic;
        const deg = CesiumMath.toDegrees;
        return { lon: deg(pc.longitude), lat: deg(pc.latitude), height: pc.height, heading: deg(c.heading), pitch: deg(c.pitch) };
      },
      setCamera: (c) => {
        const r = rt.current;
        if (!r) return;
        if (live.current.view !== "farm") {
          const rad = CesiumMath.toRadians;
          r.viewer.camera.setView({ destination: Cartesian3.fromDegrees(c.lon, c.lat, c.height), orientation: { heading: rad(c.heading), pitch: rad(c.pitch), roll: 0 } });
        } else if (r.orbit && !r.flying) setOrbitCamera(r, c);
        else r.pendingCamera = c; // still flying in: applied on landing
      },
      // Hand-over from the hero Earth: whole-Earth view straight over a point, instantly (no flight).
      jumpTo: (lon: number, lat: number) => {
        const r = rt.current;
        if (!r) return;
        r.viewer.camera.cancelFlight();
        leaveOrbit(r);
        r.viewer.camera.setView({ destination: Cartesian3.fromDegrees(lon, lat, GLOBE_HEIGHT_M), orientation: { heading: 0, pitch: -CesiumMath.PI_OVER_TWO, roll: 0 } });
        r.viewer.scene.requestRender();
      },
    }),
    [],
  );

  // Viewer lifecycle: create once, destroy on unmount (safe under strict-mode double mount).
  useEffect(() => {
    let viewer: Viewer;
    try {
      viewer = createViewer(containerRef.current!);
    } catch (e) {
      live.current.onError(toError(e)); // WebGL unavailable
      return;
    }
    // Twin layers: fields under overlays under the outline (draw order = add order); shown in farm view only.
    const twinLayers = viewer.scene.primitives.add(new PrimitiveCollection({ show: false })) as PrimitiveCollection;
    const fieldsCol = twinLayers.add(new PrimitiveCollection()) as PrimitiveCollection;
    const overlaysCol = twinLayers.add(new PrimitiveCollection()) as PrimitiveCollection;
    const overlaysBCol = twinLayers.add(new PrimitiveCollection()) as PrimitiveCollection;
    const outlineCol = twinLayers.add(new PrimitiveCollection()) as PrimitiveCollection;
    const fieldLabel = twinLayers.add(new LabelCollection()) as LabelCollection;
    const r: Runtime = {
      viewer,
      tier: null,
      pins: new Map(),
      hoverId: null,
      flying: false,
      flightSeq: 0,
      interacted: false,
      farmGround: undefined,
      terrainGround: undefined,
      fields: createFieldLayer(fieldsCol),
      hoverField: null,
      fieldLabel,
      overlays: createOverlayLayer(overlaysCol),
      overlaysB: createOverlayLayer(overlaysBCol),
      fieldCanvasA: createFieldCanvas("ft-fields-a"),
      fieldCanvasB: createFieldCanvas("ft-fields-b"),
      outline: createSquareOutline(outlineCol),
      look: createLookLayer(viewer.scene),
      weather: null,
      ground: null,
      motion: createMotionTracker(),
      groundDue: createThrottle(GROUND_QUERY_MS),
      progress: null,
      pendingCamera: null,
      twinLayers,
      orbit: null,
      dive: null,
      land: null,
      landBy: 0,
    };
    rt.current = r;
    prev.current = null;
    const { scene } = viewer;
    const { camera, canvas } = scene;
    scene.screenSpaceCameraController.maximumZoomDistance = MAX_ZOOM_OUT_M;
    // Pitch-black space, as in the hero: no star field, sun or moon disc (the dive starts from the hero's black).
    if (scene.skyBox) scene.skyBox.show = false;
    if (scene.sun) scene.sun.show = false;
    if (scene.moon) scene.moon.show = false;
    scene.backgroundColor = Color.BLACK;
    viewer.clock.shouldAnimate = false; // the sun time is fixed (set per farm in the view effect), never animating
    camera.setView({ destination: Cartesian3.fromDegrees(HOME.lon, HOME.lat, GLOBE_HEIGHT_M) });

    let cancelled = false;
    loadTier(viewer, live.current.tierOrder ?? tierOrderFromEnv()).then(
      (tier) => {
        if (cancelled) return;
        r.tier = tier;
        live.current.onReady({ tier: tier.tier });
        live.current.onViewer?.({ viewer, tier });
        setSurface(tier.surface);
        syncRef.current();
        if (live.current.view === "farm") resetRef.current(); // redo the fly-in now that ground heights are known
      },
      (e) => {
        if (!cancelled) live.current.onError(toError(e));
      },
    );

    // Auto-rotate stops for good on the first user input.
    const stopAuto = () => {
      r.interacted = true;
    };
    const inputs = ["pointerdown", "wheel", "keydown"] as const;
    for (const ev of inputs) canvas.addEventListener(ev, stopAuto, { passive: true });
    const onContextLost = (e: Event) => {
      e.preventDefault();
      live.current.onError(new Error("WebGL context lost"));
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    const offRenderError = scene.renderError.addEventListener((_scene: unknown, e: unknown) => live.current.onError(toError(e)));

    // Pins: hover shows the label, click selects, click on empty space clears.
    // Farm view: click a field selects it, empty ground clears the field (the farm stays selected).
    const pinOf = (picked: unknown): string | null => {
      const id: unknown = (picked as { id?: { id?: unknown } } | undefined)?.id?.id;
      return typeof id === "string" && r.pins.has(id) ? id : null;
    };
    const inFarm = () => live.current.view === "farm" && live.current.selectedId != null;
    const handler = new ScreenSpaceEventHandler(canvas);
    handler.setInputAction((e: { position: Cartesian2 }) => {
      const picked: unknown = scene.pick(e.position);
      const pin = pinOf(picked);
      const p = live.current;
      if (!inFarm()) p.onSelect(pin);
      else if (pin && pin !== p.selectedId) p.onSelect(pin);
      else p.onSelectField?.(fieldIdFromPick(picked));
    }, ScreenSpaceEventType.LEFT_CLICK);
    let lastHoverPick = 0;
    handler.setInputAction((e: { endPosition: Cartesian2 }) => {
      // scene.pick reads the GPU back: not while dragging the camera, and at most ~12 times a second.
      const t = performance.now();
      if (r.orbit && (t - lastHoverPick < 80 || pointers.size > 0)) return;
      lastHoverPick = t;
      const picked: unknown = scene.pick(e.endPosition);
      const id = pinOf(picked);
      const fieldId = inFarm() ? fieldIdFromPick(picked) : null;
      if (fieldId !== r.hoverField || fieldId) setFieldHover(r, live.current, fieldId, e.endPosition.x / Math.max(1, canvas.clientWidth));
      canvas.style.cursor = id || (live.current.onSelectField && fieldId) ? "pointer" : "";
      if (id === r.hoverId) return;
      r.hoverId = id;
      stylePins(r, live.current.selectedId);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    // Farm-view input: our own turntable controls (Cesium's controller is off in farm view). Hard limits, no easing.
    // Left drag = orbit (heading) + tilt, right drag / ctrl+left drag = tilt, middle / shift+left drag = pan the
    // target (hard-stopped at the square), wheel / pinch = zoom. Every change goes through clampOrbit / clampTarget.
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const farmNow = () => live.current.farms.find((f) => f.id === live.current.selectedId);
    const onDown = (e: PointerEvent) => {
      if (!r.orbit || r.flying) return;
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const onMove = (e: PointerEvent) => {
      const st = r.orbit;
      const was = pointers.get(e.pointerId);
      const farm = farmNow();
      if (!st || !was || !farm || r.flying) return;
      const dx = e.clientX - was.x;
      const dy = e.clientY - was.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0 && d > 0) st.o = { ...st.o, range: st.o.range * (pinch / d) };
        pinch = d;
      } else if (e.buttons & 4 || (e.buttons & 1 && e.shiftKey)) {
        // Pan: the ground follows the cursor. In (east, north): forward = (sin h, cos h), right = (cos h, -sin h).
        const k = st.o.range * 0.0015;
        const h = st.o.heading;
        const c = offsetM(st.target, boxOf(live.current, farm));
        st.target = fromOffsetM(boxOf(live.current, farm), {
          x: c.x - Math.cos(h) * dx * k + Math.sin(h) * dy * k,
          y: c.y + Math.sin(h) * dx * k + Math.cos(h) * dy * k,
        });
      } else if (e.buttons & 2 || (e.buttons & 1 && e.ctrlKey)) {
        st.o = { ...st.o, pitch: st.o.pitch - dy * ORBIT_RAD_PER_PX };
      } else if (e.buttons & 1) {
        st.o = { ...st.o, heading: st.o.heading - dx * ORBIT_RAD_PER_PX, pitch: st.o.pitch - dy * ORBIT_RAD_PER_PX };
      } else return;
      r.motion.touch(performance.now());
      applyOrbit(r, live.current, farm);
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = 0;
    };
    const onWheel = (e: WheelEvent) => {
      const st = r.orbit;
      const farm = farmNow();
      if (!st || !farm || r.flying) return;
      e.preventDefault();
      st.o = { ...st.o, range: st.o.range * Math.exp(e.deltaY * WHEEL_ZOOM_PER_DELTA) };
      r.motion.touch(performance.now());
      applyOrbit(r, live.current, farm);
    };
    const onLeave = () => setFieldHover(r, live.current, null, 0);
    const noMenu = (e: Event) => {
      if (live.current.view === "farm") e.preventDefault();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", noMenu);
    canvas.addEventListener("pointerleave", onLeave);

    // Per-frame work. preUpdate fires every animation frame even in requestRenderMode; moving the camera
    // makes Cesium render, so an idle globe costs nothing.
    let last = performance.now();
    let tilesWereLoaded = true;
    let landed = false;
    const offPreUpdate = scene.preUpdate.addEventListener(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const p = live.current;

      // requestRenderMode can stop rendering before the last globe tiles are drawn (seen after the farm fly-in: the
      // camera had landed but the screen kept the coarse mid-flight tiles until something else asked for a frame).
      // Keep rendering while tiles load, plus one frame after they finish.
      const ts = r.tier?.tileset;
      const tilesLoaded = (!scene.globe.show || scene.globe.tilesLoaded) && (!ts?.show || ts.tilesLoaded);
      if (!tilesLoaded || !tilesWereLoaded) scene.requestRender();
      tilesWereLoaded = tilesLoaded;
      // Landing in / leaving farm view switches the surface (Google only after the fly-in).
      if (!!r.orbit !== landed) {
        landed = !!r.orbit;
        syncRef.current();
        setFarmCameraLimits(viewer, landed); // 3 km far plane + tighter fog in farm view, defaults on the globe
      }
      // Tile detail: the `detail` setting, coarser while the camera moves (debounced 1 s), paused refinement for low + scenario.
      const scenario = !!p.weather || !!p.groundLayers?.length;
      applyQuality(
        viewer,
        r.tier?.tileset,
        qualityFor(landed ? (p.detail ?? "medium") : "medium", window.devicePixelRatio || 1, { moving: landed && (r.flying || r.motion.moving(now)), scenario: landed && scenario }),
      );
      // CameraFlightPath switches Cesium's controller back on after every flight; farm view uses our own controls.
      if (p.view === "farm") scene.screenSpaceCameraController.enableInputs = false;
      // The dive drives the camera itself.
      if (r.dive) stepDive(r, now);

      // Twin layers: apply pending field colours once Cesium has built them; overlays re-upload on version change.
      // A/B split: A's overlays (and field fills, as a canvas) left of the divider, B's right of it; one camera.
      if (r.fields.flush()) scene.requestRender();
      if (r.tier) {
        const cls = classificationFor(r.tier.surface);
        const sides = splitSides(p.compare);
        const right = p.compare?.right;
        const fills = right && p.showCropFills; // split fills only on request (user choice: imagery stays visible)
        const fieldsA = fills ? r.fieldCanvasA(p.fields ?? [], p.cropByField, p.selectedFieldId) : null;
        const fieldsB = fills ? r.fieldCanvasB(p.fields ?? [], right.cropByField, p.selectedFieldId) : null;
        const ovA = fieldsA ? [fieldsA, ...(p.overlays ?? [])] : (p.overlays ?? []);
        const ovB = right ? (fieldsB ? [fieldsB, ...(right.overlays ?? [])] : (right.overlays ?? [])) : [];
        if (r.overlays.sync(ovA, cls, p.overlayMask, sides.a)) scene.requestRender();
        if (r.overlaysB.sync(ovB, cls, p.overlayMask, sides.b ?? "both")) scene.requestRender();
        if (sides.b && scene.splitPosition !== sides.divider) {
          scene.splitPosition = sides.divider;
          scene.requestRender();
        }
      }

      // Tile streaming progress (farm view only), throttled by progressToReport.
      const report = progressToReport(r.progress, p.view === "farm" && r.tier ? r.tier.pending() : 0, now);
      if (report) {
        r.progress = report;
        p.onLoadProgress?.({ pending: report.pending });
      }

      // Effect engines (farm view only, one per viewer). They cost nothing while idle; while one animates we keep rendering.
      if (p.view === "farm" && r.tier) {
        r.weather ??= createWeatherEngine(viewer);
        r.ground ??= createGroundRenderer(viewer);
        const surf: FarmSurface = r.tier.surface === "google" ? "google" : "terrain";
        const base = { detail: p.detail ?? "medium", reducedMotion: p.reducedMotion, dtS: dt, nowS: now / 1000, surface: surf } as const;
        r.weather.update(p.weather ?? null, base);
        r.ground.update(p.groundLayers ?? [], { ...base, fields: p.fields ?? [], simBbox: p.simBbox, overlayMask: p.overlayMask, cropByField: p.cropByField });
        if (needsContinuousRender(r.weather, r.ground)) scene.requestRender();
      } else if (r.weather || r.ground) {
        r.weather?.destroy();
        r.ground?.destroy();
        r.weather = r.ground = null;
      }

      // Pins ignore the depth buffer (so terrain/tiles never bury them); hide the ones behind the Earth, and in
      // farm view the open farm's own pin and label (they would sit over the fields).
      const occluder = new EllipsoidalOccluder(Ellipsoid.WGS84, camera.positionWC);
      for (const [id, { entity, position }] of r.pins) {
        const visible = occluder.isPointVisible(position) && !(p.view === "farm" && id === p.selectedId);
        if (entity.show !== visible) entity.show = visible;
      }

      if (r.land && now > r.landBy) {
        r.viewer.camera.cancelFlight();
        r.land(); // cancelFlight normally lands already (cancel callback); this covers a flight that never started
      }
      if (r.flying) return;
      if (p.view === "globe") {
        if (!r.interacted && !p.reducedMotion && p.selectedId == null) camera.rotate(Cartesian3.UNIT_Z, -AUTO_ROTATE_RAD_S * dt);
        return;
      }
      const farm = p.farms.find((f) => f.id === p.selectedId);
      const st = r.orbit;
      if (!farm || !st || !r.tier) return;
      // Ground under the target and under the camera (for the 20 m floor); re-apply the orbit when they change
      // (terrain tiles streaming in) or when the square changed.
      // The height lookup is a ray pick against the tileset: at most ~5 Hz (the last values are kept in between).
      if (r.groundDue(now)) {
        const ground = r.tier.groundAt(Cartographic.fromDegrees(st.target.lon, st.target.lat));
        if (ground != null && Math.abs(ground - st.ground) > 0.25) {
          st.ground = ground;
          r.farmGround = ground;
          st.dirty = true;
        }
        const camGround = r.tier.groundAt(camera.positionCartographic);
        if (camGround != null && Math.abs(camGround - st.camGround) > 0.25) {
          st.camGround = camGround;
          st.dirty = true;
        }
      }
      if (st.dirty) applyOrbit(r, p, farm);
    });

    const offPerf = installPerfProbe(r);

    return () => {
      cancelled = true;
      live.current.onViewer?.(null);
      offPreUpdate();
      offPerf();
      r.weather?.destroy();
      r.ground?.destroy();
      offRenderError();
      handler.destroy();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", noMenu);
      canvas.removeEventListener("pointerleave", onLeave);
      for (const ev of inputs) canvas.removeEventListener(ev, stopAuto);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      rt.current = null;
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, []);

  // Pins.
  useEffect(() => {
    const r = rt.current;
    if (!r) return;
    r.viewer.entities.removeAll();
    r.pins.clear();
    for (const f of farms) {
      const twin = f.tier === "twin";
      const position = Cartesian3.fromDegrees(f.lon, f.lat);
      const entity = r.viewer.entities.add({
        id: f.id,
        position,
        billboard: {
          image: pinImage(twin),
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `${f.name}, ${f.country}`,
          show: false,
          font: "600 14px system-ui, sans-serif",
          style: LabelStyle.FILL,
          fillColor: Color.WHITE,
          showBackground: true,
          backgroundColor: Color.fromCssColorString("#10201e").withAlpha(0.9),
          backgroundPadding: new Cartesian2(8, 5),
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, twin ? -30 : -18),
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      r.pins.set(f.id, { entity, position });
    }
    stylePins(r, selectedId);
  }, [farms, selectedId]);

  // Surface (Google vs terrain vs base) follows view + the surface prop; switching never reloads a loaded source.
  const { fields, cropByField, selectedFieldId, simBbox, exaggeration, surface: wantSurface } = props;
  useEffect(() => {
    syncRef.current();
  }, [view, wantSurface]);

  // Farm view only: twin layers, finer globe tiles, vertical exaggeration (pivoting at the farm's ground height),
  // sun lighting at a fixed mid-morning local time, our own camera controls instead of Cesium's.
  const farmLon = farms.find((f) => f.id === selectedId)?.lon;
  useEffect(() => {
    const r = rt.current;
    if (!r) return;
    const farm = view === "farm";
    const { scene } = r.viewer;
    r.twinLayers.show = farm;
    scene.screenSpaceCameraController.enableInputs = !farm;
    // Cesium's terrain collision push-out would fight the orbit; applyOrbit keeps the 20 m floor itself.
    scene.screenSpaceCameraController.enableCollisionDetection = !farm;
    scene.canvas.style.touchAction = farm ? "none" : "";
    scene.globe.maximumScreenSpaceError = farm ? GLOBE_SSE_FARM : GLOBE_SSE_DEFAULT;
    // Default 1 = true scale. Cesium applies scene.verticalExaggeration to 3D Tiles content too (Model
    // enableVerticalExaggeration defaults to true in @cesium/engine 26.5), so Google's tiles scale with the terrain.
    scene.verticalExaggeration = farm ? Math.max(0, exaggeration ?? 1) : 1;
    scene.verticalExaggerationRelativeHeight = farm ? (r.farmGround ?? 0) : 0;
    // Cheap realism: terrain shaded by the sun (vertex normals are requested in tiles.ts) plus ground atmosphere, sky
    // atmosphere and fog. Off in globe view, where it would just show the night side.
    scene.globe.enableLighting = farm;
    if (farm && farmLon != null) r.viewer.clock.currentTime = JulianDate.fromDate(new Date(localMorningUtcMs(farmLon)));
    scene.globe.showGroundAtmosphere = true;
    scene.fog.enabled = true;
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
    scene.requestRender();
  }, [view, exaggeration, farmLon]);

  // The simulation square's thin outline (the layer group is shown in farm view only); re-frame the clamp if it moved.
  useEffect(() => {
    const r = rt.current;
    if (!r || !surface) return;
    syncOutline(r, live.current, surface);
    if (r.orbit) r.orbit.dirty = true;
  }, [simBbox, surface]);

  // Look filter (post-process), farm view only.
  const { look } = props;
  useEffect(() => {
    rt.current?.look.set(activeLook(look, view === "farm"));
  }, [look, view]);

  // Fields: rebuild when the list or the surface changes; recolour otherwise.
  useEffect(() => {
    const r = rt.current;
    if (!r || !surface) return;
    r.fields.setFields(fields ?? [], classificationFor(surface));
    setFieldHover(r, live.current, null, 0);
    r.viewer.scene.requestRender();
  }, [fields, surface]);
  // Fills only with showCropFills; while comparing they come from the per-side canvases (preUpdate). The fill primitive stays for picking.
  const comparing = !!props.compare;
  const { showCropFills } = props;
  useEffect(() => {
    const r = rt.current;
    if (r) repaintFields(r, live.current);
  }, [fields, surface, cropByField, selectedFieldId, comparing, showCropFills]);

  // Camera: fly in / out / to the selected pin's region.
  useEffect(() => {
    const r = rt.current;
    if (!r) return;
    const was = prev.current;
    prev.current = { view, selectedId };
    const farm = live.current.farms.find((f) => f.id === selectedId);
    const reduced = live.current.reducedMotion;
    // From the globe (the hero hand-over) the farm is reached by the dive; a share link or reset flies in.
    if (view === "farm" && farm) flyToFarm(r, live.current, farm, was?.view === "globe");
    else if (view === "globe" && was?.view === "farm") flyToGlobe(r, farm, GLOBE_HEIGHT_M, reduced);
    else if (view === "globe" && farm && was?.selectedId !== selectedId) flyToGlobe(r, farm, CONTINENT_HEIGHT_M, reduced);
  }, [view, selectedId]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} role="application" aria-label="Interactive 3D globe with research farm pins" />;
});

/** Dev harness variant (extra dev-only props). */
export const GlobeDev = GlobeImpl;
/** The contract component: exactly GlobeProps + ref to GlobeHandle. */
export const Globe: ForwardRefExoticComponent<GlobeProps & RefAttributes<GlobeHandle>> = GlobeImpl;

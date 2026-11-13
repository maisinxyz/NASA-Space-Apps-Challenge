"use client";
// The Cesium Earth globe: stars, farm pins, fly-in to a farm, camera confined to the farm in farm view.
// Client-only (load with next/dynamic { ssr: false }). Contract: ./types.ts.
import "@/components/viewer/cesium/base";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Color,
  ConstantProperty,
  Ellipsoid,
  EllipsoidalOccluder,
  type Entity,
  HeadingPitchRange,
  HeightReference,
  LabelStyle,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  type Viewer,
} from "cesium";
import { forwardRef, type ForwardRefExoticComponent, type RefAttributes, useEffect, useImperativeHandle, useRef } from "react";

import { clampCamera, easeToward, horizontalDistanceM } from "@/components/viewer/cesium/clamp";
import { createViewer, type LoadedTier, loadTier, tierOrderFromEnv } from "@/components/viewer/cesium/tiles";

import type { Farm, GlobeHandle, GlobeProps, TileTier } from "./types";

// Camera framing (product choices, tune freely).
/** Whole-Earth view: camera height above the ellipsoid, metres. */
const GLOBE_HEIGHT_M = 2.0e7;
/** Continental-scale view used when a pin is selected in globe view, metres. */
const CONTINENT_HEIGHT_M = 7.0e6;
/** Farm overview: camera distance from the farm centre (about 1.5 km across at Cesium's default 60 degree fov). */
const FARM_RANGE_M = 1500;
const FARM_PITCH_RAD = CesiumMath.toRadians(45);
const FLY_SECONDS = 3;
const HOME = { lon: -100, lat: 25 };
/** Auto-rotate speed, radians per second (one turn in about three minutes). */
const AUTO_ROTATE_RAD_S = CesiumMath.toRadians(2);
/** Stops the wheel from zooming the Earth out to a dot (globe view), metres. */
const MAX_ZOOM_OUT_M = 4.0e7;

/** Dev-only extras used by /dev/cesium. Not part of the shared contract; the exported `Globe` type hides them. */
export type GlobeDevProps = {
  tierOrder?: TileTier[];
  onViewer?(v: { viewer: Viewer; tier: LoadedTier } | null): void;
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
};

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

function flyToFarm(r: Runtime, farm: Farm, reducedMotion: boolean) {
  const { seq, done } = startFlight(r);
  const go = (ground: number) => {
    if (seq !== r.flightSeq || r.viewer.isDestroyed()) return;
    r.farmGround = ground;
    // Keep the overview inside the clamp: the camera's horizontal offset must not exceed radiusM.
    const range = Math.min(FARM_RANGE_M, (0.9 * farm.radiusM) / Math.cos(FARM_PITCH_RAD));
    r.viewer.camera.flyToBoundingSphere(new BoundingSphere(Cartesian3.fromDegrees(farm.lon, farm.lat, ground), 1), {
      offset: new HeadingPitchRange(0, -FARM_PITCH_RAD, range),
      duration: reducedMotion ? 0 : FLY_SECONDS,
      complete: done,
      cancel: done,
    });
  };
  // The target height comes from terrain so the flight does not end underground at high sites.
  (r.tier ? r.tier.sampleGround(farm.lon, farm.lat) : Promise.resolve(0)).then(go, () => go(0));
}

function flyToGlobe(r: Runtime, at: { lon: number; lat: number } | undefined, heightM: number, reducedMotion: boolean) {
  const { done } = startFlight(r);
  const here = r.viewer.camera.positionCartographic;
  const lon = at?.lon ?? CesiumMath.toDegrees(here.longitude);
  const lat = at?.lat ?? CesiumMath.toDegrees(here.latitude);
  r.viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(lon, lat, heightM), duration: reducedMotion ? 0 : FLY_SECONDS, complete: done, cancel: done });
}

const GlobeImpl = forwardRef<GlobeHandle, GlobeProps & GlobeDevProps>(function Globe(props, ref) {
  const { farms, selectedId, view, className } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const rt = useRef<Runtime | null>(null);
  const prev = useRef<{ view: string; selectedId: string | null } | null>(null);
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
    if (live.current.view === "farm" && farm) flyToFarm(r, farm, live.current.reducedMotion);
    else flyToGlobe(r, farm, GLOBE_HEIGHT_M, live.current.reducedMotion);
  };
  const resetRef = useRef(resetView);
  useEffect(() => {
    resetRef.current = resetView;
  });
  useImperativeHandle(ref, () => ({ resetView: () => resetRef.current() }), []);

  // Viewer lifecycle: create once, destroy on unmount (safe under strict-mode double mount).
  useEffect(() => {
    let viewer: Viewer;
    try {
      viewer = createViewer(containerRef.current!);
    } catch (e) {
      live.current.onError(toError(e)); // WebGL unavailable
      return;
    }
    const r: Runtime = { viewer, tier: null, pins: new Map(), hoverId: null, flying: false, flightSeq: 0, interacted: false, farmGround: undefined };
    rt.current = r;
    prev.current = null;
    const { scene } = viewer;
    const { camera, canvas } = scene;
    scene.screenSpaceCameraController.maximumZoomDistance = MAX_ZOOM_OUT_M;
    camera.setView({ destination: Cartesian3.fromDegrees(HOME.lon, HOME.lat, GLOBE_HEIGHT_M) });

    let cancelled = false;
    loadTier(viewer, live.current.tierOrder ?? tierOrderFromEnv()).then(
      (tier) => {
        if (cancelled) return;
        r.tier = tier;
        live.current.onReady({ tier: tier.tier });
        live.current.onViewer?.({ viewer, tier });
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
    const pinAt = (p: Cartesian2): string | null => {
      const id: unknown = (scene.pick(p) as { id?: { id?: unknown } } | undefined)?.id?.id;
      return typeof id === "string" && r.pins.has(id) ? id : null;
    };
    const handler = new ScreenSpaceEventHandler(canvas);
    handler.setInputAction((e: { position: Cartesian2 }) => live.current.onSelect(pinAt(e.position)), ScreenSpaceEventType.LEFT_CLICK);
    handler.setInputAction((e: { endPosition: Cartesian2 }) => {
      const id = pinAt(e.endPosition);
      if (id === r.hoverId) return;
      r.hoverId = id;
      canvas.style.cursor = id ? "pointer" : "";
      stylePins(r, live.current.selectedId);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    // Per-frame work. preUpdate fires every animation frame even in requestRenderMode; moving the camera
    // makes Cesium render, so an idle globe costs nothing.
    let last = performance.now();
    const offPreUpdate = scene.preUpdate.addEventListener(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const p = live.current;

      // Pins ignore the depth buffer (so terrain/tiles never bury them); hide the ones behind the Earth.
      const occluder = new EllipsoidalOccluder(Ellipsoid.WGS84, camera.positionWC);
      for (const { entity, position } of r.pins.values()) {
        const visible = occluder.isPointVisible(position);
        if (entity.show !== visible) entity.show = visible;
      }

      if (r.flying) return;
      if (p.view === "globe") {
        if (!r.interacted && !p.reducedMotion && p.selectedId == null) camera.rotate(Cartesian3.UNIT_Z, -AUTO_ROTATE_RAD_S * dt);
        return;
      }
      const farm = p.farms.find((f) => f.id === p.selectedId);
      if (!farm) return;
      // Farm view: ease the camera back inside the farm's radius and height band (clamp.ts).
      const c = camera.positionCartographic;
      const pos = { lon: CesiumMath.toDegrees(c.longitude), lat: CesiumMath.toDegrees(c.latitude), height: c.height };
      const target = clampCamera(pos, farm, r.tier?.groundAt(c) ?? r.farmGround ?? 0);
      if (horizontalDistanceM(pos, target) < 0.01 && Math.abs(pos.height - target.height) < 0.01) return;
      const next = p.reducedMotion ? target : easeToward(pos, target, dt);
      Cartesian3.fromDegrees(next.lon, next.lat, next.height, Ellipsoid.WGS84, camera.position);
    });

    return () => {
      cancelled = true;
      live.current.onViewer?.(null);
      offPreUpdate();
      offRenderError();
      handler.destroy();
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

  // Camera: fly in / out / to the selected pin's region.
  useEffect(() => {
    const r = rt.current;
    if (!r) return;
    const was = prev.current;
    prev.current = { view, selectedId };
    const farm = live.current.farms.find((f) => f.id === selectedId);
    const reduced = live.current.reducedMotion;
    if (view === "farm" && farm) flyToFarm(r, farm, reduced);
    else if (view === "globe" && was?.view === "farm") flyToGlobe(r, farm, GLOBE_HEIGHT_M, reduced);
    else if (view === "globe" && farm && was?.selectedId !== selectedId) flyToGlobe(r, farm, CONTINENT_HEIGHT_M, reduced);
  }, [view, selectedId]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} role="application" aria-label="Interactive 3D globe with research farm pins" />;
});

/** Dev harness variant (extra dev-only props). */
export const GlobeDev = GlobeImpl;
/** The contract component: exactly GlobeProps + ref to GlobeHandle. */
export const Globe: ForwardRefExoticComponent<GlobeProps & RefAttributes<GlobeHandle>> = GlobeImpl;

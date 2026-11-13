"use client";
// Body of /dev/cesium: exercises the Globe (tiers, pins, fly-in, clamp) and the drape + split spike.
// Dev harness only, not product UI. Test pattern only: no real data is shown here.
import type { Viewer } from "cesium";
import { useEffect, useMemo, useRef, useState } from "react";

import { GlobeDev } from "@/components/globe/Globe";
import type { CropLook, Farm, FarmField, GlobeHandle, GlobeView, GroundOverlay, TileTier } from "@/components/globe/types";

import { createDrape, type Drape, type DrapeMethod, type DrapeSource } from "./drape";
import type { LoadedTier } from "./tiles";

const test = (id: string, n: number, lon: number, lat: number, tier: Farm["tier"]): Farm => ({
  id,
  name: `Test location ${n}`,
  owner: "test location (dev page only)",
  country: "test location",
  lon,
  lat,
  tier,
  sourceUrl: "",
  coordsVerified: false,
  radiusM: 1500,
});
const FARMS: Farm[] = [test("test-1", 1, -121.76, 49.24, "twin"), test("test-2", 2, 121.257, 14.17, "explore")];

// Dev-only sample twin around test location 1: a 3 x 2 grid of made-up fields (not real boundaries or crops).
const LOOKS: CropLook[] = ["corn", "cereal", "grass", "legume", "berry", "cover"];
const SAMPLE_FIELDS: FarmField[] = LOOKS.map((crop, i) => {
  const dLon = 0.0034; // ~250 m east-west at 49.24 N
  const dLat = 0.0018; // ~200 m north-south
  const x0 = FARMS[0].lon + (i % 3 - 1.5) * dLon * 1.04;
  const y0 = FARMS[0].lat + (Math.floor(i / 3) - 1) * dLat * 1.06;
  return { id: `f${i + 1}`, name: `Sample field ${i + 1}`, crop, areaHa: 5, ring: [[x0, y0], [x0 + dLon, y0], [x0 + dLon, y0 + dLat], [x0, y0 + dLat]] };
});
/** "Swap crops" override: every field takes the next look (exercises cropByField). */
const SWAPPED: Record<string, CropLook> = Object.fromEntries(SAMPLE_FIELDS.map((f, i) => [f.id, LOOKS[(i + 1) % LOOKS.length]]));

/** Test overlay: a moving blue blob on a 128 px canvas (not data). */
function paintBlob(canvas: HTMLCanvasElement, t: number) {
  const g = canvas.getContext("2d")!;
  g.clearRect(0, 0, 128, 128);
  const cx = 64 + 40 * Math.cos(t);
  const cy = 64 + 40 * Math.sin(t);
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, 40);
  grad.addColorStop(0, "rgba(30,90,220,0.95)");
  grad.addColorStop(1, "rgba(30,90,220,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
}

const W = 256;
const H = 256;
const FRAMES = 60;

/** Generated "water depth" test pattern: a ring spreading from a centre plus a pond that fills. Not data. */
function testFrames(cx: number, cy: number, strength: number): Uint8Array[] {
  return Array.from({ length: FRAMES }, (_, f) => {
    const t = f / (FRAMES - 1);
    const frame = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const r = Math.hypot(x - cx, y - cy) / W;
        const ring = Math.max(0, 1 - Math.abs(r - t * 0.6) / 0.05);
        const pond = Math.max(0, 1 - r / (0.05 + 0.25 * t));
        frame[y * W + x] = Math.round(255 * strength * Math.min(1, Math.max(ring * 0.7, pond)));
      }
    }
    return frame;
  });
}

function bboxAround(f: Farm): DrapeSource["bbox"] {
  const dLat = 0.006; // about 670 m north-south half-height
  const dLon = dLat / Math.cos((f.lat * Math.PI) / 180);
  return [f.lon - dLon, f.lat - dLat, f.lon + dLon, f.lat + dLat];
}

type Live = { viewer: Viewer; tier: LoadedTier };
declare global {
  interface Window {
    __ftCesium?: Live | null;
  }
}

export default function Spike() {
  // ?tier=A|B|C forces a tier on this page without touching env files.
  const [tierOrder] = useState<TileTier[] | undefined>(() => {
    const q = new URLSearchParams(window.location.search).get("tier")?.toUpperCase();
    return q === "A" ? ["A", "B", "C"] : q === "B" ? ["B", "C"] : q === "C" ? ["C"] : undefined;
  });
  const [tier, setTier] = useState<TileTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<GlobeView>("globe");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [drapeOn, setDrapeOn] = useState(false);
  const [method, setMethod] = useState<DrapeMethod>("classification");
  const [frame, setFrame] = useState(20);
  const [playing, setPlaying] = useState(false);
  const [split, setSplit] = useState(false);
  const [divider, setDivider] = useState(0.5);
  const [fps, setFps] = useState<number | null>(null);
  const [fieldsOn, setFieldsOn] = useState(true);
  const [swap, setSwap] = useState(false);
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [photoreal, setPhotoreal] = useState(false);
  const [exaggeration, setExaggeration] = useState(1);
  const [overlayOn, setOverlayOn] = useState(false);
  const [overlayAnim, setOverlayAnim] = useState(false);
  const [opacity, setOpacity] = useState(0.8);
  const [overlay, setOverlay] = useState<GroundOverlay | null>(null);
  const globe = useRef<GlobeHandle>(null);
  const drapes = useRef<Drape[]>([]);
  const patterns = useMemo(() => [testFrames(128, 128, 1), testFrames(90, 150, 0.55)], []);
  const farm = FARMS.find((f) => f.id === selectedId) ?? null;

  useEffect(() => {
    window.__ftCesium = live;
  }, [live]);

  // Sample overlay: redraw the canvas and bump `version`; the globe re-uploads only on a version change.
  useEffect(() => {
    if (!overlayOn) return setOverlay(null);
    const canvas = Object.assign(document.createElement("canvas"), { width: 128, height: 128 });
    let version = 0;
    let t = 0;
    const draw = () => {
      paintBlob(canvas, t);
      setOverlay({ id: "test-blob", bbox: bboxAround(FARMS[0]), canvas, version: ++version, opacity: 0 });
    };
    draw();
    if (!overlayAnim) return;
    const timer = setInterval(() => {
      t += 0.2;
      draw();
    }, 100);
    return () => clearInterval(timer);
  }, [overlayOn, overlayAnim]);
  const overlays = useMemo(() => (overlay ? [{ ...overlay, opacity }] : []), [overlay, opacity]);

  // Build the drape(s) for the selected test location.
  useEffect(() => {
    if (!live || !drapeOn || !farm) return;
    const source = (frames: Uint8Array[]): DrapeSource => ({ frames, width: W, height: H, maxDepthMm: 100, bbox: bboxAround(farm) });
    const make = (i: number, side: "both" | "left" | "right") => createDrape(live.viewer, source(patterns[i]), { method, side, tileset: live.tier.tileset });
    drapes.current = split ? [make(0, "left"), make(1, "right")] : [make(0, "both")];
    return () => {
      drapes.current.forEach((d) => d.destroy());
      drapes.current = [];
    };
  }, [live, drapeOn, farm, method, split, patterns]);

  useEffect(() => {
    drapes.current.forEach((d) => d.setFrame(frame));
  }, [frame, live, drapeOn, farm, method, split]);

  useEffect(() => {
    if (!live) return;
    live.viewer.scene.splitPosition = divider;
    live.viewer.scene.requestRender();
  }, [live, divider]);

  // Play: advance a quarter frame per animation frame (exercises interpolation) and count rendered frames.
  useEffect(() => {
    if (!playing || !live) return;
    let raf = 0;
    let rendered = 0;
    let since = performance.now();
    const off = live.viewer.scene.postRender.addEventListener(() => rendered++);
    const tick = () => {
      setFrame((f) => (f + 0.25) % (FRAMES - 1));
      const now = performance.now();
      if (now - since >= 1000) {
        setFps(Math.round((rendered * 1000) / (now - since)));
        rendered = 0;
        since = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      off();
      setFps(null);
    };
  }, [playing, live]);

  const label = "flex items-center gap-2";
  return (
    <div className="relative h-[calc(100dvh-5.5rem)] min-h-[30rem] bg-black">
      <GlobeDev
        ref={globe}
        farms={FARMS}
        selectedId={selectedId}
        view={view}
        reducedMotion={reducedMotion}
        tierOrder={tierOrder}
        onSelect={(id) => {
          setSelectedId(id);
          if (!id) setView("globe");
        }}
        onReady={(i) => setTier(i.tier)}
        onError={(e) => setError(e.message)}
        onViewer={setLive}
        fields={fieldsOn ? SAMPLE_FIELDS : undefined}
        cropByField={swap ? SWAPPED : undefined}
        selectedFieldId={fieldId}
        onSelectField={setFieldId}
        overlays={overlays}
        photoreal={photoreal}
        exaggeration={exaggeration}
      />
      {split && drapeOn && <div aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/80" style={{ left: `${divider * 100}%` }} />}
      <div className="absolute left-3 top-3 flex max-h-[calc(100%-1.5rem)] max-w-xs flex-col gap-2 overflow-y-auto rounded-md bg-surface/95 p-3 text-sm text-ink shadow">
        <p className="font-semibold">Cesium spike (dev only, test pattern, not data)</p>
        <p data-testid="tier">
          Tier loaded: <strong>{tier ?? "loading…"}</strong> {tierOrder ? `(forced order ${tierOrder.join(">")})` : "(from env)"}
        </p>
        {error && <p className="text-danger">Error: {error}</p>}
        <label className={label}>
          Location
          <select
            className="rounded border border-line bg-surface-2 px-1"
            value={selectedId ?? ""}
            onChange={(e) => {
              setSelectedId(e.target.value || null);
              if (!e.target.value) setView("globe");
            }}
          >
            <option value="">none</option>
            {FARMS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.lon}, {f.lat})
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button className="rounded border border-line px-2" disabled={!selectedId} onClick={() => setView("farm")}>
            Farm view
          </button>
          <button className="rounded border border-line px-2" onClick={() => setView("globe")}>
            Globe view
          </button>
          <button className="rounded border border-line px-2" onClick={() => globe.current?.resetView()}>
            Reset
          </button>
        </div>
        <p className="font-semibold">Farm twin (dev sample fields, made up)</p>
        <label className={label}>
          <input type="checkbox" checked={fieldsOn} onChange={(e) => setFieldsOn(e.target.checked)} /> Fields
        </label>
        <label className={label}>
          <input type="checkbox" checked={swap} onChange={(e) => setSwap(e.target.checked)} /> Swap crops (cropByField)
        </label>
        <p data-testid="field">Selected field: {fieldId ?? "none"}</p>
        <label className={label}>
          <input type="checkbox" checked={photoreal} onChange={(e) => setPhotoreal(e.target.checked)} /> Photoreal (Google tiles, spends quota)
        </label>
        <label className={label}>
          Exaggeration {exaggeration.toFixed(1)}x
          <input type="range" min={1} max={5} step={0.5} value={exaggeration} onChange={(e) => setExaggeration(Number(e.target.value))} />
        </label>
        <label className={label}>
          <input type="checkbox" checked={overlayOn} onChange={(e) => setOverlayOn(e.target.checked)} /> Overlay blob
        </label>
        <label className={label}>
          <input type="checkbox" checked={overlayAnim} onChange={(e) => setOverlayAnim(e.target.checked)} /> Animate overlay (version bumps)
        </label>
        <label className={label}>
          Overlay opacity {opacity.toFixed(2)}
          <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
        </label>
        <label className={label}>
          <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} /> Reduced motion
        </label>
        <label className={label}>
          <input type="checkbox" checked={drapeOn} onChange={(e) => setDrapeOn(e.target.checked)} /> Drape test pattern {farm ? "" : "(pick a location)"}
        </label>
        <label className={label}>
          Method
          <select className="rounded border border-line bg-surface-2 px-1" value={method} onChange={(e) => setMethod(e.target.value as DrapeMethod)}>
            <option value="classification">classification (GroundPrimitive)</option>
            <option value="imagery">imagery (SingleTile layer)</option>
          </select>
        </label>
        <label className={label}>
          Frame {frame.toFixed(2)}
          <input type="range" min={0} max={FRAMES - 1} step={0.25} value={frame} onChange={(e) => setFrame(Number(e.target.value))} />
        </label>
        <label className={label}>
          <input type="checkbox" checked={playing} onChange={(e) => setPlaying(e.target.checked)} /> Play {fps != null && `(${fps} rendered frames/s)`}
        </label>
        <label className={label}>
          <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} /> Split A | B
        </label>
        <label className={label}>
          Divider {divider.toFixed(2)}
          <input type="range" min={0.1} max={0.9} step={0.01} value={divider} onChange={(e) => setDivider(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

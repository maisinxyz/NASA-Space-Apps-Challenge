"use client";
// Homepage body: the full-bleed Earth globe with farm pins, and everything around it (pitch, farm list,
// farm card, farm-view bar, failure fallback). The globe itself is components/globe/Globe.tsx, loaded client-only.
import { useReducedMotion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import dynamic from "next/dynamic";
import { Component, type ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { useScenarioRun } from "@/components/farm/useScenarioRun";
import { TwinPanel } from "@/components/farm/TwinPanel";
import { FARMS, farmById, type TwinConfig, twinConfig } from "@/lib/farms";
import { hasModifier, isTextEntry, RESET_EVENT } from "@/lib/keys";
import { decodeShare } from "@/lib/share";
import type { RunSource } from "@/lib/twin/scenarios/runSource";
import { selectFarm as select, useAppStore, useChrome } from "@/lib/store";
import { cropsForSeason, rotationById } from "@/lib/twin/rotations";

import { EXPLORE_NOTE, FarmCard } from "./FarmCard";
import { FarmList } from "./FarmList";
import type { CameraState, GlobeHandle, TileTier } from "./types";

const Globe = dynamic(() => import("@/components/globe/Globe").then((m) => m.Globe), {
  ssr: false,
  loading: () => <p className="grid h-full place-items-center text-sm text-ink-muted">Loading the 3D globe…</p>,
});

/** The viewport minus the sticky header and banner; in the twin the header is a 2.5rem slim bar (Header.tsx). */
const GLOBE_H = "h-[calc(100dvh-5.5rem)] min-h-[34rem]";
const TWIN_H = "h-[calc(100dvh-2.5rem)] min-h-[34rem]";
/** Share-link camera is applied after the fly-in: ground lookup + 3 s flight (Globe.tsx FLY_SECONDS), with margin. */
// ponytail: fixed wait; switch to a "landed" callback if the contract ever gets one.
const SHARE_CAMERA_DELAY_MS = 4500;
const SPACE_BG = "bg-[radial-gradient(ellipse_at_center,#0c1428_0%,#03050a_75%)]";
const PITCH = "See how the same storm moves across real farmland under different crop rotations.";
const dev = process.env.NODE_ENV !== "production";

// The globe is not mounted below 768 px. Server render counts as small, so the farm list is in the HTML.
const WIDE = "(min-width: 768px)";
const subscribeWide = (cb: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useWide = () =>
  useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );

/** Catches a globe that throws while loading or rendering (missing chunk, no WebGL) so the page falls back to the list. */
class GlobeBoundary extends Component<{ onError(e: Error): void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    this.props.onError(e);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Crop per field for a rotation at (year, month); undefined without a twin or a known rotation. */
function season(twin: TwinConfig | undefined, id: string, year: number, month: number) {
  const r = twin && rotationById(twin.rotations, id);
  return twin && r ? cropsForSeason(twin.fields, twin.phases, r, year, month) : undefined;
}
const btn = "rounded-md border border-line bg-surface-2 px-3 py-1 text-sm hover:bg-line";

/**
 * `runSource` is "none" in the product: the backend delivers no scenario runs yet, so Simulate renders no effect.
 * Only the dev page /dev/scenarios passes "fixture".
 */
export function GlobeHome({ runSource = "none" }: { runSource?: RunSource } = {}) {
  const farmId = useAppStore((s) => s.farmId);
  const view = useAppStore((s) => s.globeView);
  const reducedMotion = !!useReducedMotion();
  const wide = useWide();
  const globe = useRef<GlobeHandle>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [tier, setTier] = useState<TileTier | null>(null);
  const [hint, setHint] = useState(true);
  const [pending, setPending] = useState(0);
  const sharedCamera = useRef<CameraState | null>(null);
  const farm = farmById(farmId);
  const showGlobe = wide && load !== "error";
  const inFarm = showGlobe && view === "farm" && !!farm;
  // Farm twin (only "twin" farms with a twin config): fields + the season of the rotation chosen in Compare.
  const twin = view === "farm" ? twinConfig(farm?.id ?? null) : undefined;
  const fields = twin?.fields;
  const inTwin = inFarm && !!twin;
  const { twinFieldId, twinMode, compareA, compareB, divider, twinYear, twinMonth, exaggeration, twinSurface, look, showCropFills, detail } = useAppStore(
    useShallow((s) => ({ twinFieldId: s.twinFieldId, twinMode: s.twinMode, compareA: s.compareA, compareB: s.compareB, divider: s.divider, twinYear: s.twinYear, twinMonth: s.twinMonth, exaggeration: s.exaggeration, twinSurface: s.twinSurface, look: s.look, showCropFills: s.showCropFills, detail: s.detail })),
  );
  // Compare paints rotation A (left of the split) and B (right) for the chosen season; other modes show current crops.
  const comparing = inTwin && twinMode === "compare";
  const cropA = useMemo(() => (comparing ? season(twin, compareA, twinYear, twinMonth) : undefined), [comparing, twin, compareA, twinYear, twinMonth]);
  const cropB = useMemo(() => (comparing ? season(twin, compareB, twinYear, twinMonth) : undefined), [comparing, twin, compareB, twinYear, twinMonth]);
  const compare = useMemo(() => (comparing ? { right: { cropByField: cropB }, divider } : null), [comparing, cropB, divider]);

  // Scenario effect: only while Simulate is open in a twin AND a run source exists (never in the real twin yet).
  const frame = useScenarioRun({ farmId: farm?.id ?? null, runSource, enabled: inTwin && twinMode === "simulate", reducedMotion });

  // Slim header while the twin workspace is on screen.
  useEffect(() => {
    useChrome.setState({ twinFarm: inTwin ? farm.name : null });
    return () => useChrome.setState({ twinFarm: null });
  }, [inTwin, farm?.name]);

  // Share link (#farm=…): restore the view once on load; the camera follows after the fly-in.
  useEffect(() => {
    const d = decodeShare(window.location.hash);
    if (!d) return;
    sharedCamera.current = d.camera ?? null;
    useAppStore.setState({
      farmId: d.farm,
      globeView: "farm",
      ...(d.mode && { twinMode: d.mode, leftOpen: d.mode === "explore" || d.mode === "simulate" }),
      ...(d.field && { twinFieldId: d.field }),
      ...(d.a && { compareA: d.a }),
      ...(d.b && { compareB: d.b }),
      ...(d.divider !== undefined && { divider: d.divider }),
      ...(d.surface && { twinSurface: d.surface }),
      ...(d.look && { look: d.look }),
      ...(d.detail && { detail: d.detail }),
      ...(d.scenario && { scenarioId: d.scenario, scenarioInputs: { [d.scenario]: d.inputs ?? {} } }),
    });
  }, []);
  useEffect(() => {
    const cam = sharedCamera.current;
    if (!cam || load !== "ready" || !inFarm) return;
    const t = setTimeout(() => {
      sharedCamera.current = null;
      globe.current?.setCamera(cam);
    }, reducedMotion ? 800 : SHARE_CAMERA_DELAY_MS);
    return () => clearTimeout(t);
  }, [load, inFarm, reducedMotion]);

  // Global Reset key: TourController resets the store (back to the globe, no farm); re-centre the camera too.
  useEffect(() => {
    const reset = () => globe.current?.resetView();
    window.addEventListener(RESET_EVENT, reset);
    return () => window.removeEventListener(RESET_EVENT, reset);
  }, []);

  // Escape closes the farm card (not while a dialog such as About is open: it uses Escape itself).
  const cardOpen = !!farm && !inFarm;
  useEffect(() => {
    if (!cardOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !hasModifier(e) && !isTextEntry(e.target) && !document.querySelector("dialog[open]")) select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cardOpen]);

  const status = !wide ? "The 3D globe is not shown on small screens. Use the farm list." : load === "error" ? "The 3D globe could not load. The farm list still works." : load === "ready" ? "3D globe ready." : "Loading the 3D globe.";
  const list = (className: string) => <FarmList farms={FARMS} selectedId={farmId} onSelect={select} className={className} />;
  const live = (
    <p aria-live="polite" className="sr-only">
      {status}
    </p>
  );

  if (!showGlobe) {
    return (
      <div className={`theme-dark min-h-[calc(100dvh-5.5rem)] ${SPACE_BG} px-4 py-8 text-ink`}>
        <div className="mx-auto grid max-w-3xl gap-4">
          <h1 className="font-display text-2xl leading-tight md:text-3xl">{PITCH}</h1>
          {wide ? (
            <div role="alert" className="rounded-lg border border-line bg-surface p-4">
              <p className="font-semibold">The 3D globe could not load</p>
              <p className="mt-1 text-sm text-ink-muted">You can still pick a farm from the list below.</p>
            </div>
          ) : (
            <p className="rounded-lg border border-line bg-surface p-3 text-sm">Best on a larger screen: the 3D globe is shown on screens at least 768 px wide.</p>
          )}
          {farm && <FarmCard farm={farm} onClose={() => select(null)} />}
          {list("")}
        </div>
        {live}
      </div>
    );
  }

  const hideHint = () => setHint(false);
  return (
    <div className={`theme-dark relative overflow-hidden ${inTwin ? TWIN_H : GLOBE_H} ${SPACE_BG} text-ink`} onPointerDownCapture={hideHint} onWheelCapture={hideHint} onKeyDownCapture={hideHint}>
      {inTwin && (
        <a href="#twin-dock" className="sr-only z-50 rounded bg-surface p-2 focus:not-sr-only focus:absolute focus:top-3 focus:left-3">
          Skip the 3D map
        </a>
      )}
      <GlobeBoundary onError={() => setLoad("error")}>
        <Globe
          ref={globe}
          farms={FARMS}
          selectedId={farmId}
          view={view}
          reducedMotion={reducedMotion}
          className="absolute inset-0 h-full w-full"
          onSelect={select}
          onReady={(info) => {
            setTier(info.tier);
            setLoad("ready");
          }}
          onError={() => setLoad("error")}
          fields={fields}
          selectedFieldId={twinFieldId}
          onSelectField={(id) => useAppStore.setState({ twinFieldId: id })}
          cropByField={cropA}
          compare={compare}
          look={inFarm ? look : "none"}
          onLoadProgress={(p) => setPending(p.pending)}
          simBbox={inTwin ? twin.simBbox : undefined}
          exaggeration={inTwin ? exaggeration : 1}
          surface={twinSurface}
          overlayMask={inTwin ? twin.overlayMask : undefined}
          showCropFills={comparing && showCropFills}
          weather={frame?.atmosphere}
          groundLayers={frame?.ground}
          detail={detail}
        />
      </GlobeBoundary>

      {/* Overlays: the layer lets pointer events through to the globe; each panel takes them back. */}
      <div className="pointer-events-none absolute inset-0 p-4 *:pointer-events-auto">
        {inTwin ? (
          <TwinPanel
            farm={farm}
            fields={twin.fields}
            cropA={cropA}
            cropB={cropB}
            pending={pending}
            onBack={() => useAppStore.setState({ globeView: "globe" })}
            onReset={() => globe.current?.resetView()}
            getCamera={() => globe.current?.getCamera() ?? null}
            runSource={runSource}
            frame={frame}
          />
        ) : inFarm ? (
          <div className="absolute top-4 left-4 flex max-w-[calc(100%-22rem)] flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface/90 p-3">
            <button type="button" className={btn} onClick={() => useAppStore.setState({ globeView: "globe" })}>
              ← Back to globe
            </button>
            <button type="button" className={btn} onClick={() => globe.current?.resetView()}>
              Reset view
            </button>
            <h1 className="font-display text-lg">{farm.name}</h1>
            <p className="basis-full text-sm text-ink-muted">Explore only: {EXPLORE_NOTE.toLowerCase()}.</p>
            {farm.note && <p className="basis-full text-xs text-ink-muted">{farm.note.text}</p>}
          </div>
        ) : (
          <div className="!pointer-events-none absolute top-4 left-4 max-w-md">
            <h1 className="font-display text-2xl leading-tight [text-shadow:0_1px_6px_#000]">{PITCH}</h1>
            {hint && <p className="mt-3 inline-block rounded bg-black/70 px-2 py-1 text-sm text-white">Drag to rotate · scroll to zoom · click a pin</p>}
          </div>
        )}

        {!inTwin && list("absolute top-4 right-4 max-h-[calc(100%-2rem)] w-72 overflow-y-auto")}

        {cardOpen && <FarmCard farm={farm} onClose={() => select(null)} onOpen={() => useAppStore.setState({ globeView: "farm" })} className="absolute bottom-10 left-4 w-80 max-w-[calc(100%-22rem)]" />}

        {dev && tier && (
          <p data-dev-only className="!pointer-events-none absolute right-3 bottom-3 rounded bg-black/70 px-2 py-0.5 font-mono text-xs text-white">
            tiles: tier {tier}
          </p>
        )}
      </div>
      {live}
    </div>
  );
}

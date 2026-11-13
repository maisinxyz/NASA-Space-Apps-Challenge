"use client";
// Homepage body: the full-bleed Earth globe with farm pins, and everything around it (pitch, farm list,
// farm card, farm-view bar, failure fallback). The globe itself is components/globe/Globe.tsx, loaded client-only.
import { useReducedMotion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, type ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { TwinPanel, twinFields } from "@/components/farm/TwinPanel";
import { FARMS, farmById } from "@/lib/farms";
import { hasModifier, isTextEntry, RESET_EVENT } from "@/lib/keys";
import { useAppStore } from "@/lib/store";
import { ROTATING_FIELDS } from "@/lib/twin/agassiz";
import { cropsForSeason, rotationById } from "@/lib/twin/rotations";

import { EXPLORE_NOTE, FarmCard, SimLink } from "./FarmCard";
import { FarmList } from "./FarmList";
import type { GlobeHandle, TileTier } from "./types";

const Globe = dynamic(() => import("@/components/globe/Globe").then((m) => m.Globe), {
  ssr: false,
  loading: () => <p className="grid h-full place-items-center text-sm text-ink-muted">Loading the 3D globe…</p>,
});

/** Same idea as ViewerStage's VIEWPORT_H: the viewport minus the sticky header and banner. */
const GLOBE_H = "h-[calc(100dvh-5.5rem)] min-h-[34rem]";
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

const select = (id: string | null) => useAppStore.setState(id ? { farmId: id } : { farmId: null, globeView: "globe" });
const btn = "rounded-md border border-line bg-surface-2 px-3 py-1 text-sm hover:bg-line";

export function GlobeHome() {
  const farmId = useAppStore((s) => s.farmId);
  const view = useAppStore((s) => s.globeView);
  const reducedMotion = !!useReducedMotion();
  const wide = useWide();
  const globe = useRef<GlobeHandle>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [tier, setTier] = useState<TileTier | null>(null);
  const [hint, setHint] = useState(true);
  const farm = farmById(farmId);
  const showGlobe = wide && load !== "error";
  const inFarm = showGlobe && view === "farm" && !!farm;
  // Farm twin (only "twin" farms with field data): fields + the season of the rotation chosen in Compare.
  const fields = view === "farm" && farm?.tier === "twin" ? twinFields(farm.id) : undefined;
  const inTwin = inFarm && !!fields;
  const { twinFieldId, twinRotationId, twinYear, twinMonth, photoreal, exaggeration } = useAppStore(
    useShallow((s) => ({ twinFieldId: s.twinFieldId, twinRotationId: s.twinRotationId, twinYear: s.twinYear, twinMonth: s.twinMonth, photoreal: s.photoreal, exaggeration: s.exaggeration })),
  );
  const cropByField = useMemo(() => {
    const r = rotationById(twinRotationId ?? "");
    return fields && r ? cropsForSeason(fields, ROTATING_FIELDS, r, twinYear, twinMonth) : undefined;
  }, [fields, twinRotationId, twinYear, twinMonth]);

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
              <p className="mt-1 text-sm text-ink-muted">
                You can still pick a farm from the list below.{" "}
                <Link href="/viewer" className="text-accent underline underline-offset-2">
                  Open the offline view
                </Link>
              </p>
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
    <div className={`theme-dark relative overflow-hidden ${GLOBE_H} ${SPACE_BG} text-ink`} onPointerDownCapture={hideHint} onWheelCapture={hideHint} onKeyDownCapture={hideHint}>
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
          cropByField={cropByField}
          photoreal={inTwin && photoreal}
          exaggeration={inTwin ? exaggeration : 1}
        />
      </GlobeBoundary>

      {/* Overlays: the layer lets pointer events through to the globe; each panel takes them back. */}
      <div className="pointer-events-none absolute inset-0 p-4 *:pointer-events-auto">
        {inTwin ? (
          <TwinPanel farm={farm} onBack={() => useAppStore.setState({ globeView: "globe" })} onReset={() => globe.current?.resetView()} />
        ) : inFarm ? (
          <div className="absolute top-4 left-4 flex max-w-[calc(100%-22rem)] flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface/90 p-3">
            <button type="button" className={btn} onClick={() => useAppStore.setState({ globeView: "globe" })}>
              ← Back to globe
            </button>
            <button type="button" className={btn} onClick={() => globe.current?.resetView()}>
              Reset view
            </button>
            <h1 className="font-display text-lg">{farm.name}</h1>
            {farm.tier === "twin" ? <SimLink /> : <p className="basis-full text-sm text-ink-muted">Explore only: {EXPLORE_NOTE.toLowerCase()}</p>}
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
          <p data-dev-only className="absolute right-4 bottom-10 rounded bg-black/70 px-2 py-0.5 font-mono text-xs text-white">
            tiles: tier {tier}
          </p>
        )}
      </div>
      {live}
    </div>
  );
}

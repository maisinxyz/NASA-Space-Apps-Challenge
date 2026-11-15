"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import dynamic from "next/dynamic";
import { Component, type ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { useScenarioRun } from "@/components/farm/useScenarioRun";
import { FarmView } from "@/components/farm-view/FarmView";
import { Non3dFarmWorkspace } from "@/components/farm-view/Non3dFarmWorkspace";
import { cameraBus, hoverBus, loadBus, trackBus } from "@/components/hero/buses";
import { ControlCluster, type HeroSettings } from "@/components/hero/ControlCluster";
import { EarthLoading } from "@/components/hero/EarthLoading";
import { HeroEarth, type HeroEarthApi } from "@/components/hero/HeroEarth";
import { FarmPopup } from "@/components/hero/FarmPopup";
import { MarkerPulse } from "@/components/hero/FarmCard";
import { fvDisplayFont, fvSansFont } from "@/lib/farm-view/fonts";
import { heroMonoFont, heroUiFont, heroWordFont } from "@/components/hero/fonts";
import { PinLabel } from "@/components/hero/PinLabel";
import { GlobeAssistant, GlobeChrome } from "@/components/hero/GlobeChrome";
import { HERO_UNIT, TEXT_OUT_TOTAL_MS } from "@/components/hero/RestingHero";
import { color, hero as HERO, heroIn } from "@/components/hero/tokens";
import { useZoneOverlays, ZoneToggle } from "@/components/rotation/fe2/ZoneOverlay";
import { useFieldColourOverlays } from "@/components/farm-future/FieldColours";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { FARMS, farmById, type TwinConfig, twinConfig } from "@/lib/farms";
import { imageryFor } from "@/lib/map2d/imagery";
import { hasModifier, isTextEntry, RESET_EVENT } from "@/lib/keys";
import { useCopilot } from "@/lib/copilot/copilot";
import type { SearchHit } from "@/lib/globe/search";
import { resetFutureInvestigation } from "@/lib/farm-future/store";
import { decodeShare } from "@/lib/share";
import { selectFarm, useAppStore, useChrome } from "@/lib/store";
import { cropsForSeason, rotationById } from "@/lib/twin/rotations";
import { runSourceFor, type RunSource } from "@/lib/twin/scenarios/runSource";

import { FarmCard } from "./FarmCard";
import { FarmList } from "./FarmList";
import type { CameraState, GlobeHandle, PinHover } from "./types";

/** Project name (screen-reader heading). */
const PROJECT_NAME = "FieldTwin";

/** Resting hero states in globe view (tokens.hero). */
type HeroState = "hero" | "dragging" | "centred" | "ui";

// Cesium's credit line ("Earth API" attribution: logo + data attribution) stays fully visible, as its terms require.
// It is moved into its own slot above every overlay and set in the accent colour; the logo is tinted with a CSS
// filter, nothing is hidden.
const CREDITS_CSS = `
.hero-root .ft-credits .cesium-widget-credits { position: static !important; display: flex !important; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; width: max-content; max-width: 94vw; }
.hero-root .ft-credits .cesium-credit-wrapper { display: inline-flex !important; white-space: nowrap; align-items: center; }

.hero-root .ft-credits { color: ${color.accent} !important; font-size: 11px; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; column-gap: 0.9em; row-gap: 0.2em; width: max-content; max-width: 94vw; line-height: 1.3; }
.hero-root .ft-credits .cesium-credit-logoContainer, .hero-root .ft-credits .cesium-credit-textContainer { display: inline-flex !important; align-items: center; flex-wrap: wrap; justify-content: center; gap: 0.9em; margin: 0 !important; }
.hero-root .ft-credits .cesium-credit-delimiter { margin: 0 0.4em; }
.hero-root .cesium-credit-logoContainer img { max-height: 20px; width: auto; vertical-align: middle; }
.hero-root .ft-credits a, .hero-root .cesium-credit-textContainer, .hero-root .cesium-credit-textContainer * { color: ${color.accent} !important; }
.hero-root .cesium-credit-logoContainer img { filter: brightness(0) saturate(100%) invert(80%) sepia(14%) saturate(900%) hue-rotate(185deg) brightness(98%); opacity: 0.9; }
`;

const Globe = dynamic(() => import("@/components/globe/Globe").then((m) => m.Globe), { ssr: false, loading: () => null });

/** Release the prewarmed farm scene this long after nothing points at a farm any more. */
const PREWARM_RELEASE_MS = 6000;
const SPACE_BG = "bg-[radial-gradient(ellipse_at_center,#0c1428_0%,#03050a_75%)]";
const PITCH = "Explore research farms and compare crop rotations using simulated weather.";

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

const select = selectFarm;
/** Descend: dive from space to the farm. */
const dive = (id: string | null) => {
  selectFarm(id);
  if (id) useAppStore.setState({ globeView: "farm" });
};

/** Crop per field for a rotation at (year, month); undefined without a twin or a known rotation. */
function season(twin: TwinConfig | undefined, id: string, year: number, month: number) {
  const r = twin && rotationById(twin.rotations, id);
  return twin && r ? cropsForSeason(twin.fields, twin.phases, r, year, month) : undefined;
}

/**
 * `runSourceProp` is only the dev page's override. In the product the run source is per farm (runSourceFor): "fixture"
 * (labelled "Synthetic demo data") for full-twin farms, "none" for explore-only farms.
 */
export function GlobeHome({ runSource: runSourceProp }: { runSource?: RunSource } = {}) {
  const farmId = useAppStore((s) => s.farmId);
  const view = useAppStore((s) => s.globeView);
  useEffect(() => resetFutureInvestigation(), [farmId]);
  const reducedMotion = !!useReducedMotion();
  const wide = useWide();
  const globe = useRef<GlobeHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const creditSlot = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [listMode, setListMode] = useState(false);
  const viewButton = useRef<HTMLButtonElement>(null);
  const moveViewFocus = useRef(false);
  const switchView = () => {
    moveViewFocus.current = true;
    setListMode((current) => !current);
  };
  useEffect(() => {
    if (moveViewFocus.current) {
      viewButton.current?.focus();
      moveViewFocus.current = false;
    }
  }, [listMode]);
  const [pending, setPending] = useState(0);
  const sharedCamera = useRef<CameraState | null>(null);
  // The hero Earth's own readiness (textures loaded). The hero shows as soon as it is ready; Cesium loads behind it.
  const [earthReady, setEarthReady] = useState(false);
  const heroEarth = useRef<HeroEarthApi | null>(null);
  const [settings, setSettings] = useState<HeroSettings>({ showPins: true, atmosphere: true, autoRotate: true });

  // ---------- resting hero state machine (globe view) ----------
  const [hs, setHs] = useState<HeroState>("ui");
  const hsRef = useRef<HeroState>("ui");
  hsRef.current = hs;
  // The Earth glides to the centre only after the hero text has faded (no text visible while it moves).
  const [earthCentre, setEarthCentre] = useState(true);
  const timers = useRef<{ glide?: ReturnType<typeof setTimeout>; ui?: ReturnType<typeof setTimeout>; idle?: ReturnType<typeof setTimeout> }>({});
  const clear = (k: "glide" | "ui" | "idle") => {
    clearTimeout(timers.current[k]);
    timers.current[k] = undefined;
  };
  useEffect(() => () => (["glide", "ui", "idle"] as const).forEach((k) => clearTimeout(timers.current[k])), []);
  const cardOpenRef = useRef(false);
  /** Back to the resting hero: map UI out, Earth back to the right, then the text returns (reverse order). */
  const goHero = () => {
    (["glide", "ui", "idle"] as const).forEach(clear);
    // The globe view now always shows the map UI, centred (fromearth-style chrome); idle no longer returns to a text hero.
    setHs("ui");
  };
  /** Restart the idle countdown (any pointer activity while centred or in the map UI). */
  const armIdle = () => {
    clear("idle");
    timers.current.idle = setTimeout(function fire() {
      // A farm card is open: the user is mid-task; check again later instead of tearing the UI down.
      if (cardOpenRef.current) timers.current.idle = setTimeout(fire, HERO.heroAfterMs);
      else goHero();
    }, HERO.heroAfterMs);
  };
  // Effects call the latest armIdle through a ref (it closes over state setters only, but keeps lint honest).
  const armIdleRef = useRef(armIdle);
  armIdleRef.current = armIdle;
  /** Leave the hero: text fades out, then the Earth glides to the centre. */
  const leaveHero = (delayUiMs: number | null) => {
    clear("ui");
    if (!timers.current.glide && !earthCentre) timers.current.glide = setTimeout(() => setEarthCentre(true), reducedMotion ? 0 : TEXT_OUT_TOTAL_MS);
    if (delayUiMs != null) timers.current.ui = setTimeout(() => setHs("ui"), delayUiMs);
    armIdle();
  };
  const press = useRef<{ x: number; y: number } | null>(null);
  const onWorldDown = (e: ReactPointerEvent) => {
    if (view !== "globe") return;
    press.current = { x: e.clientX, y: e.clientY };
  };
  const onWorldMove = (e: ReactPointerEvent) => {
    const p = press.current;
    if (!p || view !== "globe" || hsRef.current === "dragging") return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < HERO.dragThresholdPx) return;
    // Press-and-drag: auto-rotation stops, text and map UI fade, the Earth heads for the centre.
    setHs("dragging");
    leaveHero(null);
    clear("idle");
  };
  const onWorldUp = () => {
    const wasPress = press.current;
    press.current = null;
    // A plain click on the Earth in the resting hero centres it (same as a drag), which also turns scroll-zoom on.
    if (wasPress && hsRef.current === "hero" && view === "globe") return explore();
    if (hsRef.current !== "dragging") return;
    setHs("centred");
    clear("ui");
    timers.current.ui = setTimeout(() => setHs("ui"), HERO.uiAfterMs);
    armIdle();
  };
  /** Pointer or key activity anywhere on the page keeps the map UI up. */
  const onActivity = () => {
    if (hsRef.current === "centred" || hsRef.current === "ui") armIdle();
  };
  /** Keyboard / button path into the map UI (same as a drag, without one). */
  const explore = () => {
    setHs("centred");
    leaveHero(Math.max(HERO.uiAfterMs, TEXT_OUT_TOTAL_MS + HERO.glideMs));
  };
  // Hovered waypoint: the id is React state (changes rarely); its screen position streams through hoverBus.
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  const onHoverPin = (h: PinHover | null) => {
    hoverBus.set(h);
    const id = h?.id ?? null;
    if (id !== hoverIdRef.current) {
      hoverIdRef.current = id;
      setHoverId(id);
    }
  };
  // Prewarm target: the farm the pointer or keyboard is on (hovered pin, open popup, selection). Kept after the pointer
  // leaves, so the parked view stays loaded; Globe parks its hidden camera there (GlobeProps.prewarm).
  const [warmId, setWarmId] = useState<string | null>(null);
  // Selected waypoint in globe view: the card shows once the fly-to has landed, with one confirm pulse.
  const [cardFor, setCardFor] = useState<string | null>(null);
  const [pulseNonce, setPulseNonce] = useState(0);
  const [farmLoad, setFarmLoad] = useState<{ farmId: string; progress: number; done: boolean } | null>(null);
  useEffect(() => {
    if (view === "globe") {
      setHs("ui");
      setEarthCentre(true);
      onHoverPin(null);
      setCardFor(null);
    }
  }, [view]);
  useEffect(() => {
    if (cardFor && cardFor !== farmId) setCardFor(null);
  }, [farmId, cardFor]);
  cardOpenRef.current = !!cardFor;
  useEffect(() => {
    const id = hoverId ?? cardFor ?? (view === "globe" ? farmId : null);
    if (id) return setWarmId(id);
    // Nothing pointed at: release the parked scene after a while (one prewarmed scene at most, and only while wanted).
    const t = setTimeout(() => setWarmId(null), PREWARM_RELEASE_MS);
    return () => clearTimeout(t);
  }, [hoverId, cardFor, farmId, view]);
  const farm = farmById(farmId);
  const runSource = runSourceFor(farm, runSourceProp);
  const showGlobe = wide && !listMode && load !== "error";
  const inFarm = showGlobe && view === "farm" && !!farm;
  const twin = view === "farm" ? twinConfig(farm?.id ?? null) : undefined;
  const fields = twin?.fields;
  const inTwin = !!farm && view === "farm" && !!twin;
  const zoneOverlays = useZoneOverlays(inTwin && showGlobe ? (farm?.id ?? null) : null);
  const fieldOverlays = useFieldColourOverlays();
  const overlays = useMemo(() => (inTwin ? [...zoneOverlays, ...fieldOverlays] : zoneOverlays), [inTwin, zoneOverlays, fieldOverlays]);
  const { twinFieldId, twinMode, compareA, compareB, divider, twinYear, twinMonth, exaggeration, twinSurface, look, showCropFills, detail, map2d } = useAppStore(
    useShallow((s) => ({ twinFieldId: s.twinFieldId, twinMode: s.twinMode, compareA: s.compareA, compareB: s.compareB, divider: s.divider, twinYear: s.twinYear, twinMonth: s.twinMonth, exaggeration: s.exaggeration, twinSurface: s.twinSurface, look: s.look, showCropFills: s.showCropFills, detail: s.detail, map2d: s.map2d })),
  );
  const imageryPending = inFarm && !map2d && (load !== "ready" || farmLoad?.farmId !== farmId || !farmLoad.done);
  const [imagerySlow, setImagerySlow] = useState(false);
  useEffect(() => {
    setImagerySlow(false);
    if (!imageryPending) return;
    const timer = setTimeout(() => setImagerySlow(true), 4500);
    return () => clearTimeout(timer);
  }, [farmId, imageryPending]);
  // Compare paints rotation A (left of the split) and B (right) for the chosen season; other modes show current crops.
  const comparing = inTwin && twinMode === "compare";
  const cropA = useMemo(() => (comparing ? season(twin, compareA, twinYear, twinMonth) : undefined), [comparing, twin, compareA, twinYear, twinMonth]);
  const cropB = useMemo(() => (comparing ? season(twin, compareB, twinYear, twinMonth) : undefined), [comparing, twin, compareB, twinYear, twinMonth]);
  const compare = useMemo(() => (comparing ? { right: { cropByField: cropB }, divider } : null), [comparing, cropB, divider]);

  // Scenario effect: only while Simulate is open in a twin AND a run source exists (never in the real twin yet).
  const frame = useScenarioRun({ farmId: farm?.id ?? null, runSource, enabled: inTwin && twinMode === "simulate", reducedMotion });

  // Slim header while the twin workspace is on screen.
  useEffect(() => {
    useChrome.setState({ twinFarm: inTwin && showGlobe ? farm.name : null });
    return () => useChrome.setState({ twinFarm: null });
  }, [inTwin, showGlobe, farm?.name]);

  // Share link (#farm=…): restore the view once on load; the camera follows after the fly-in.
  useEffect(() => {
    const d = decodeShare(window.location.hash);
    if (!d) return;
    sharedCamera.current = d.camera ?? null;
    const scenarioRotation = d.scenarioRotation ?? d.rotation;
    const scenarioProgress = d.scenarioProgress ?? d.time;
    const twinYear = d.twinYear ?? d.year;
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
      scenarioPlaying: false,
      ...(scenarioRotation && { scenarioRotation }),
      ...(scenarioProgress !== undefined && { scenarioProgress }),
      ...(twinYear !== undefined && { twinYear }),
      ...(d.twinMonth !== undefined && { twinMonth: d.twinMonth }),
      ...(d.showCropFills !== undefined && { showCropFills: d.showCropFills }),
      ...(d.panelsHidden !== undefined && { panelsHidden: d.panelsHidden }),
      ...(d.panel && { leftOpen: d.panel !== "none" }),
      ...(d.leftOpen !== undefined && { leftOpen: d.leftOpen }),
      ...(d.rightOpen !== undefined && { rightOpen: d.rightOpen }),
      ...(d.scenario && { scenarioId: d.scenario, scenarioInputs: { [d.scenario]: d.inputs ?? {} } }),

    });
  }, []);
  useEffect(() => {
    const cam = sharedCamera.current;
    if (!cam || load !== "ready" || !inFarm) return;
    sharedCamera.current = null;
    globe.current?.setCamera(cam);
  }, [load, inFarm]);

  // Global Reset key: TourController resets the store (back to the globe, no farm); re-centre the camera too.
  useEffect(() => {
    const reset = () => globe.current?.resetView();
    window.addEventListener(RESET_EVENT, reset);
    return () => window.removeEventListener(RESET_EVENT, reset);
  }, []);

  // Escape clears the selected farm on the globe (popovers handle their own Escape first).
  const selectedOnGlobe = !!farm && view === "globe";
  useEffect(() => {
    if (!selectedOnGlobe) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && !hasModifier(e) && !isTextEntry(e.target) && !document.querySelector("dialog[open], #hero-popover")) select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedOnGlobe]);

  const status = listMode ? "Farm list view is active." : !wide ? "The 3D globe is not shown on small screens. Choose a farm to open its non-3D workspace." : load === "error" ? "The 3D globe could not load. The non-3D workspace still works." : load === "ready" ? "3D globe ready." : "Loading the 3D globe.";
  const live = (
    <p aria-live="polite" className="sr-only">
      {status}
    </p>
  );

  const openFarm = (id: string, question?: string) => {
    if (!farmById(id)) return;
    if (id !== useAppStore.getState().farmId || view !== "farm") {
      useCopilot.getState().startFarm(id, question);
    }
    dive(id);
  };
  const askAtFarm = (question: string, id: string) => openFarm(id, question);
  const navigation = {
    farms: FARMS,
    includePlaces: showGlobe,
    onPick: (hit: SearchHit) => {
      if (hit.kind === "farm") {
        if (showGlobe || farmById(hit.id)?.tier === "twin") openFarm(hit.id);
        else select(hit.id);
      }
      else {
        useAppStore.setState({ globeView: "globe" });
        heroEarth.current?.faceLonLat(hit.lon, hit.lat);
      }
    },
  };

  if (!showGlobe) {
    return (
      <div className={`theme-dark min-h-[calc(100dvh-5.5rem)] ${SPACE_BG} px-4 py-8 text-ink`}>
        <div className="mx-auto grid max-w-3xl gap-4">
          <h1 className="font-display text-2xl leading-tight md:text-3xl">{PITCH}</h1>
          {wide && listMode ? (
            <button ref={viewButton} type="button" className="min-h-11 w-fit rounded border border-line px-3 py-2" onClick={switchView}>Switch to 3D map</button>
          ) : wide ? (
            <div role="alert" className="rounded-lg border border-line bg-surface p-4">
              <p className="font-semibold">The 3D globe could not load</p>
              <p className="mt-1 text-sm text-ink-muted">You can use scenarios and comparisons without the map. Select a digital twin below.</p>
            </div>
          ) : (
            <p className="rounded-lg border border-line bg-surface p-3 text-sm">The interactive map needs a larger screen. Digital twins still offer scenarios, comparisons, and evidence here.</p>
          )}
          {wide && !listMode && <button type="button" className="w-fit rounded border border-line px-3 py-2" onClick={() => { setLoad("loading"); setEarthReady(false); }}>Retry interactive map</button>}
          <p className="text-sm text-ink-muted">Compare what could happen under different rotations. The demo uses illustrative crops and simulated weather, with no live farm measurements.</p>
          {inTwin && farm && twin ? <Non3dFarmWorkspace key={farm.id} navigation={navigation} sim={{farm,fields:twin.fields,cropA,cropB,pending:0,runSource,frame,getCamera:()=>null}} onBack={()=>{select(null);useAppStore.setState({globeView:"globe"});}}/> : <>
            {farm && <FarmCard farm={farm} onClose={() => select(null)} onOpen={farm.tier === "twin" ? () => openFarm(farm.id) : undefined} />}
            <GlobeAssistant navigation={navigation} onAsk={askAtFarm} />
            <FarmList farms={FARMS} selectedId={farmId} onSelect={(id) => {
              if (id && farmById(id)?.tier === "twin") openFarm(id);
              else select(id);
            }} />
          </>}
        </div>
        {live}
      </div>
    );
  }

  const hoverFarm = hoverId ? farmById(hoverId) : null;
  /** A click on the pin itself: its popup opens in place; the globe stays exactly where it is. */
  const pickPin = (id: string) => {
    if (id !== farmId) select(id);
    setCardFor(id);
  };
  const onGlobe = view === "globe";
  // Hero visuals wait for the hero Earth only; Cesium is needed from the dive on.
  const ready = earthReady;
  const uiShown = onGlobe && hs === "ui";
  const offsetX = !earthCentre ? HERO.restOffsetX : 0;

  return (
    <div
      ref={root}
      className={`hero-root theme-dark fixed inset-0 z-50 overflow-hidden bg-black ${heroUiFont.variable} ${heroWordFont.variable} ${heroMonoFont.variable} ${fvDisplayFont.variable} ${fvSansFont.variable} ${heroUiFont.className} text-ink`}
      onPointerMoveCapture={onActivity}
      onKeyDownCapture={onActivity}
    >
      <style>{CREDITS_CSS}</style>

      {/* World layer: stars + the 3D Earth. Press-and-drag here drives the hero states. */}
      <div
        className="absolute inset-0 touch-none transition-opacity ease-in-out"
        style={{ opacity: ready ? 1 : 0, transitionDuration: `${heroIn.ms}ms` }}
        onPointerDown={onWorldDown}
        onPointerMove={onWorldMove}
        onPointerUp={onWorldUp}
        onPointerCancel={onWorldUp}
        onLostPointerCapture={onWorldUp}
      >
        <GlobeBoundary onError={() => setLoad("error")}>
          {/* Cesium: hidden and idle in globe view (no pins, no spin, nothing selected); the farm view and the dive. */}
          <div
            className="absolute inset-0 transition-opacity duration-300 ease-out"
            style={{ opacity: onGlobe ? 0 : 1, pointerEvents: onGlobe ? "none" : "auto" }}
            {...(onGlobe ? { inert: true, "aria-hidden": true } : {})}
          >
            <Globe
              ref={globe}
              farms={FARMS}
              creditContainer={creditSlot}
              selectedId={onGlobe ? null : farmId}
              view={view}
              reducedMotion={reducedMotion}
              className="absolute inset-0 h-full w-full"
              onSelect={onGlobe ? () => {} : select}
              prewarm={warmId ? { farmId: warmId, simBbox: twinConfig(warmId)?.simBbox } : null}
              onFarmLoad={setFarmLoad}
              onArrive={(id) => {
                const camera = sharedCamera.current;
                if (camera && useAppStore.getState().farmId === id) {
                  sharedCamera.current = null;
                  globe.current?.setCamera(camera);
                }
              }}
              onReady={() => setLoad("ready")}
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
              overlays={overlays}
              showCropFills={comparing && showCropFills}
              weather={frame?.atmosphere}
              groundLayers={frame?.ground}
              detail={detail}
              paused={inFarm && map2d}
            />
          </div>
          {/* Hero Earth: the globe view. Fades out as Cesium takes over the dive, back in on return. */}
          <div
            className="absolute inset-0 transition-opacity ease-out"
            style={{ opacity: onGlobe ? 1 : 0, pointerEvents: onGlobe ? "auto" : "none", transitionDuration: onGlobe ? "600ms" : "300ms" }}
            {...(!onGlobe ? { inert: true, "aria-hidden": true } : {})}
          >
            <HeroEarth
              apiRef={heroEarth}
              farms={FARMS}
              selectedId={farmId}
              offsetX={offsetX}
              autoRotate={onGlobe && settings.autoRotate && !cardFor}
              showPins={settings.showPins && onGlobe}
              atmosphere={settings.atmosphere}
              zoomEnabled={earthCentre && onGlobe}
              reducedMotion={reducedMotion}
              active={onGlobe}
              onReady={() => setEarthReady(true)}
              onProgress={loadBus.set}
              onDragStart={() => {}}
              onDragEnd={() => {}}
              onPinClick={pickPin}
              onHover={onHoverPin}
              onTrack={trackBus.set}
              onFlyDone={(id) => {
                setCardFor(id);
                setPulseNonce((n) => n + 1);
              }}
              onCamera={(c) => cameraBus.set({ ...c, altKm: 20000, headingDeg: 0 })}
            />
          </div>
        </GlobeBoundary>
      </div>

      {onGlobe && (
        <GlobeChrome navigation={navigation} onAsk={askAtFarm} controls={
          <>
            <ControlCluster farms={FARMS} ready={ready} selectedId={farmId} onPickFarm={openFarm} settings={settings} onSettings={setSettings} />
            <p className="mt-3 max-w-52 text-xs text-white/75">Drag to rotate. Click the globe to use arrow keys. Scroll or press + / − to zoom.</p>
            <button ref={viewButton} type="button" onClick={switchView} className="mt-3 rounded border border-white/25 px-3 py-2 text-sm">
              Browse farms without 3D
            </button>
          </>
        } />
      )}

      {/* Map UI: waypoint label, confirm pulse, farm card, controls. Fades in 2 s after a drag; not focusable while hidden. */}
      {onGlobe && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          initial={false}
          animate={{ opacity: uiShown ? 1 : 0 }}
          transition={{ duration: (uiShown ? HERO.uiInMs : HERO.uiOutMs) / 1000, ease: "easeInOut" }}
          {...(!uiShown ? { inert: true } : {})}
        >
          {hoverFarm && hoverFarm.id !== cardFor && <PinLabel key={hoverFarm.id} farm={hoverFarm} />}
          {pulseNonce > 0 && !reducedMotion && <MarkerPulse nonce={pulseNonce} />}
          <div className="pointer-events-auto">
            <FarmPopup farm={cardFor ? farmById(cardFor) : null} reduced={reducedMotion} onClose={() => select(null)} onDescend={openFarm} />
          </div>
        </motion.div>
      )}

      <EarthLoading ready={ready} />

      {/* Earth attribution, centred on the status bar line (one line, no wrap). Globe view: the hero Earth's NASA
          textures (public/hero/earth/SOURCES.md). Farm view: Cesium's credit line, moved here, always visible. */}
      {onGlobe && (
        <p className="absolute z-10 -translate-x-1/2 translate-y-1/2 text-[11px] whitespace-nowrap" style={{ color: color.accent, left: `calc(50% + ${HERO_UNIT} * 48)`, bottom: `calc(${HERO_UNIT} * 28)` }}>
          Earth imagery: NASA Blue Marble &amp; Earth at Night
        </p>
      )}

      <div ref={creditSlot} className="ft-credits absolute z-10 -translate-x-1/2" style={{ left: "50%", bottom: "0.5rem", display: onGlobe ? "none" : undefined }} />

      {inFarm && (
        <div className="pointer-events-none absolute inset-0 p-4">
          <ErrorBoundary fallbackTitle="Farm view error" onReset={() => useAppStore.setState({ globeView: "globe", farmId: null })}>
          <FarmView
            key={farm.id}
            farmId={farm.id}
            farmName={farm.name}
            navigation={navigation}
            place={farm.locality ? `${farm.locality}, ${farm.country}` : farm.country}
            onBack={() => useAppStore.setState({ globeView: "globe" })}
            onReset={() => globe.current?.resetView()}
            onCamera={(action) => globe.current?.moveCamera(action)}
            zoneControl={inTwin ? <ZoneToggle /> : undefined}
            sim={inTwin ? { farm, fields: twin.fields, cropA, cropB, pending, runSource, frame, getCamera: () => globe.current?.getCamera() ?? null } : undefined}
          />
          </ErrorBoundary>
          {imageryPending && (
            <div className="absolute bottom-3 right-4 flex items-center gap-2 rounded bg-[#111a20]/95 px-3 py-2 text-xs">
              <p role="status">Loading 3D imagery…</p>
              {imagerySlow && imageryFor(farm.id) && <button type="button"
                className="pointer-events-auto rounded border border-white/30 px-2 py-1"
                onClick={() => useAppStore.setState({ map2d: true })}>Use 2D map</button>}
            </div>
          )}
        </div>
      )}

      {!onGlobe && (
        <h1 className="sr-only">
          {PROJECT_NAME}: {PITCH}
        </h1>
      )}
      {live}
    </div>
  );
}

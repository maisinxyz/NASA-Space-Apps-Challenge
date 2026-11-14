"use client";
// Homepage body. On screens ≥ 768 px: the resting hero (ORBIT-style layout: text left, Earth right, slow spin), and on
// drag the map UI (Earth centred, waypoints, controls), then the dive and arrival sequence into a farm.
// Two Earths: the hero and map UI use the light Three.js Earth (HeroEarth: smooth, pure black space); the Cesium globe
// stays mounted underneath, hidden and idle, and takes over for the dive and the farm (real terrain and imagery). At
// the hand-over Cesium jumps to the same whole-Earth view over the farm the hero Earth is showing.
//   Hero states (globe view):  hero → dragging → centred → ui → (idle) → hero          (see tokens.hero)
//   Farm phases (farm view):   dive → hold (dive film) → title (in, hold, out) → explore (controls appear)
// Below 768 px, or if WebGL fails: the farm list fallback.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import dynamic from "next/dynamic";
import { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { TwinPanel } from "@/components/farm/TwinPanel";
import { useScenarioRun } from "@/components/farm/useScenarioRun";
import { ArrivalTitle, DiveVeil } from "@/components/hero/Arrival";
import { cameraBus, hoverBus, loadBus, trackBus } from "@/components/hero/buses";
import { ControlCluster, type HeroSettings } from "@/components/hero/ControlCluster";
import { DIVE_FILMS, DiveFilm } from "@/components/hero/DiveFilm";
import { EarthLoading } from "@/components/hero/EarthLoading";
import { HeroEarth, type HeroEarthApi } from "@/components/hero/HeroEarth";
import { MarkerPulse } from "@/components/hero/FarmCard";
import { FarmDetail } from "@/components/hero/FarmDetail";
import { heroMonoFont, heroUiFont, heroWordFont } from "@/components/hero/fonts";
import { PinLabel } from "@/components/hero/PinLabel";
import { HERO_UNIT, RestingHero, TEXT_OUT_TOTAL_MS } from "@/components/hero/RestingHero";
import { color, farmControlsIn, hero as HERO, heroIn } from "@/components/hero/tokens";
import { FARMS, farmById, type TwinConfig, twinConfig } from "@/lib/farms";
import { hasModifier, isTextEntry, RESET_EVENT } from "@/lib/keys";
import { decodeShare } from "@/lib/share";
import { selectFarm, useAppStore, useChrome } from "@/lib/store";
import { cropsForSeason, rotationById } from "@/lib/twin/rotations";
import { runSourceFor, type RunSource } from "@/lib/twin/scenarios/runSource";

import { EXPLORE_NOTE, FarmCard } from "./FarmCard";
import { FarmList } from "./FarmList";
import type { CameraState, GlobeHandle, PinHover, TileTier } from "./types";

/** Project name (screen-reader heading). */
const PROJECT_NAME = "FieldTwin";

/** Resting hero states in globe view (tokens.hero). */
type HeroState = "hero" | "dragging" | "centred" | "ui";

// Cesium's credit line ("Earth API" attribution: logo + data attribution) stays fully visible, as its terms require.
// It is moved into its own slot above every overlay and set in the accent colour; the logo is tinted with a CSS
// filter, nothing is hidden.
const CREDITS_CSS = `
.hero-root .ft-credits { color: ${color.accent} !important; font-size: 11px; white-space: nowrap; display: flex !important; align-items: center; }
.hero-root .ft-credits a, .hero-root .cesium-credit-textContainer, .hero-root .cesium-credit-textContainer * { color: ${color.accent} !important; }
.hero-root .cesium-credit-logoContainer img { filter: brightness(0) saturate(100%) invert(80%) sepia(14%) saturate(900%) hue-rotate(185deg) brightness(98%); opacity: 0.9; }
`;

const Globe = dynamic(() => import("@/components/globe/Globe").then((m) => m.Globe), { ssr: false, loading: () => null });

/** Share-link camera is applied after the fly-in: ground lookup + 3 s flight (Globe.tsx FLY_SECONDS), with margin. */
const SHARE_CAMERA_DELAY_MS = 4500;
const SPACE_BG = "bg-[radial-gradient(ellipse_at_center,#0c1428_0%,#03050a_75%)]";
const dev = process.env.NODE_ENV !== "production";
const PITCH = "See how the same storm moves across real farmland under different crop rotations.";

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
 * Farm view after a dive: the dive (veil, or the dive film for farms that have one), "hold" while a dive film that is
 * still playing covers the landed farm, the arrival title, then free exploration with the farm panels.
 */
type Phase = "dive" | "hold" | "title" | "explore";
const btn = "rounded-md border border-line bg-surface-2 px-3 py-1 text-sm hover:bg-line";

/**
 * `runSourceProp` is only the dev page's override. In the product the run source is per farm (runSourceFor): "fixture"
 * (labelled "Synthetic demo data") for full-twin farms, "none" for explore-only farms.
 */
export function GlobeHome({ runSource: runSourceProp }: { runSource?: RunSource } = {}) {
  const farmId = useAppStore((s) => s.farmId);
  const view = useAppStore((s) => s.globeView);
  const reducedMotion = !!useReducedMotion();
  const wide = useWide();
  const globe = useRef<GlobeHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const creditSlot = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [tier, setTier] = useState<TileTier | null>(null);
  const [pending, setPending] = useState(0);
  const sharedCamera = useRef<CameraState | null>(null);
  // The hero Earth's own readiness (textures loaded). The hero shows as soon as it is ready; Cesium loads behind it.
  const [earthReady, setEarthReady] = useState(false);
  const heroEarth = useRef<HeroEarthApi | null>(null);
  /** A waypoint was clicked while not facing the viewer: the Earth turns to it first, then the dive starts. */
  const pendingDive = useRef<string | null>(null);
  const [settings, setSettings] = useState<HeroSettings>({ showPins: true, atmosphere: false, autoRotate: true });

  // ---------- resting hero state machine (globe view) ----------
  const [hs, setHs] = useState<HeroState>("hero");
  const hsRef = useRef<HeroState>("hero");
  hsRef.current = hs;
  // The Earth glides to the centre only after the hero text has faded (no text visible while it moves).
  const [earthCentre, setEarthCentre] = useState(false);
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
    setHs("hero");
    setEarthCentre(false);
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
    pendingDive.current = null;
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
  // Selected waypoint in globe view: the card shows once the fly-to has landed, with one confirm pulse.
  const [cardFor, setCardFor] = useState<string | null>(null);
  const [pulseNonce, setPulseNonce] = useState(0);
  const [phase, setPhase] = useState<Phase>("explore");
  // Dive film (components/hero/DiveFilm.tsx): buffered while on the globe; used for a dive only if it was ready when
  // the dive began. Otherwise the procedural veil plays, exactly as for farms without a film.
  const [filmReady, setFilmReady] = useState<Record<string, boolean>>({});
  const [filmOn, setFilmOnState] = useState(false);
  // Also a ref: the globe calls onArrive from the props it had when the dive began.
  const filmOnRef = useRef(false);
  const setFilmOn = (on: boolean) => {
    filmOnRef.current = on;
    setFilmOnState(on);
  };
  const filmCan = useRef(false);
  filmCan.current = !reducedMotion && !!farmId && !!filmReady[farmId];
  const lastView = useRef(view);
  useEffect(() => {
    if (view === "farm" && lastView.current === "globe") {
      setPhase("dive");
      setFilmOn(filmCan.current);
    }
    if (view === "globe") {
      setPhase("explore");
      setFilmOn(false);
      // Back from a farm: land in the map UI with the Earth centred; idle returns to the hero as usual.
      if (lastView.current === "farm") {
        setHs("ui");
        setEarthCentre(true);
        armIdleRef.current();
      }
    }
    lastView.current = view;
    onHoverPin(null);
    setCardFor(null);
  }, [view]);
  useEffect(() => {
    if (cardFor && cardFor !== farmId) setCardFor(null);
  }, [farmId, cardFor]);
  cardOpenRef.current = !!cardFor;
  // Arrival title: in, hold (then `titleLeaving`), out; the farm controls mount only when its exit has finished.
  const [titleLeaving, setTitleLeaving] = useState(false);
  const titleHoldEnd = useCallback(() => setTitleLeaving(true), []);
  const titleExited = useCallback(() => {
    setTitleLeaving(false);
    setPhase((p) => (p === "title" ? "explore" : p));
  }, []);
  // The film has begun dissolving into the landed farm: on to the title.
  const filmDone = () => setPhase((p) => (p === "hold" ? "title" : p));
  // The film could not play: the procedural dive takes over (veil if still diving, title if already landed).
  const filmFailed = () => {
    setFilmOn(false);
    filmDone();
  };

  const farm = farmById(farmId);
  const runSource = runSourceFor(farm, runSourceProp);
  const showGlobe = wide && load !== "error";
  const inFarm = showGlobe && view === "farm" && !!farm;
  // Twin fields are built once the camera has landed (building them mid-dive costs frames).
  // (`lastView` still holds the previous view on the render where the dive starts, before the phase effect runs.)
  const diving = phase === "dive" || (view === "farm" && lastView.current === "globe");
  // Farm twin (only "twin" farms with a twin config): fields + the season of the rotation chosen in Compare.
  const twin = view === "farm" && !diving ? twinConfig(farm?.id ?? null) : undefined;
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

  // Escape clears the selected farm on the globe (popovers handle their own Escape first).
  const selectedOnGlobe = !!farm && !inFarm;
  useEffect(() => {
    if (!selectedOnGlobe) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && !hasModifier(e) && !isTextEntry(e.target) && !document.querySelector("dialog[open], #hero-popover")) select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedOnGlobe]);

  const status = !wide ? "The 3D globe is not shown on small screens. Use the farm list." : load === "error" ? "The 3D globe could not load. The farm list still works." : load === "ready" ? "3D globe ready." : "Loading the 3D globe.";
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
          <FarmList farms={FARMS} selectedId={farmId} onSelect={select} />
        </div>
        {live}
      </div>
    );
  }

  const hoverFarm = hoverId ? farmById(hoverId) : null;
  // Picking the farm that is already selected (e.g. after coming back from it) shows its card again with a pulse;
  // any other farm flies there first (the card follows onFlyDone).
  const pickFarm = (id: string) => {
    if (id !== farmId) return select(id);
    setCardFor(id);
    setPulseNonce((n) => n + 1);
  };
  /** Hand-over to Cesium: same whole-Earth view over the farm, then the dive. */
  const startDive = (id: string) => {
    const f = farmById(id);
    if (!f) return;
    pendingDive.current = null;
    heroEarth.current?.resetZoom();
    globe.current?.jumpTo(f.lon, f.lat);
    dive(id);
  };
  /** Waypoint or "descend": dive now if the farm faces the viewer (or a dive film will cover the turn), else turn first. */
  const requestDive = (id: string) => {
    if (reducedMotion || filmReady[id] || heroEarth.current?.isFacing(id)) return startDive(id);
    pendingDive.current = id;
    select(id);
    heroEarth.current?.face(id);
  };
  const onGlobe = view === "globe";
  // Farm controls appear only after the arrival title has completely left (Part 5 ordering).
  const panels = phase === "explore";
  // Hero visuals wait for the hero Earth only; Cesium is needed from the dive on.
  const ready = earthReady;
  const heroShown = onGlobe && hs === "hero";
  const uiShown = onGlobe && hs === "ui";
  // Sidebar number: same as a pick in the map UI, entering it from the hero.
  const pickFromHero = (id: string) => {
    explore();
    pickFarm(id);
  };
  const offsetX = !earthCentre ? HERO.restOffsetX : 0;

  return (
    <div
      ref={root}
      className={`hero-root theme-dark fixed inset-0 z-50 overflow-hidden bg-black ${heroUiFont.variable} ${heroWordFont.variable} ${heroMonoFont.variable} ${heroUiFont.className} text-ink`}
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
              quickDive={filmCan.current}
              onArrive={() => setPhase((p) => (p === "dive" ? (filmOnRef.current ? "hold" : "title") : p))}
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
              autoRotate={heroShown && settings.autoRotate}
              showPins={settings.showPins && onGlobe && hs !== "hero"}
              atmosphere={settings.atmosphere}
              zoomEnabled={earthCentre && onGlobe}
              reducedMotion={reducedMotion}
              active={onGlobe}
              onReady={() => setEarthReady(true)}
              onProgress={loadBus.set}
              onDragStart={() => void (pendingDive.current = null)}
              onDragEnd={() => {}}
              onPinClick={pickFarm}
              onHover={onHoverPin}
              onTrack={trackBus.set}
              onFlyDone={(id) => {
                if (pendingDive.current === id) return startDive(id);
                setCardFor(id);
                setPulseNonce((n) => n + 1);
              }}
              onCamera={(c) => cameraBus.set({ ...c, altKm: 20000, headingDeg: 0 })}
            />
          </div>
        </GlobeBoundary>
      </div>

      {/* Resting hero: text left, Earth right. */}
      {onGlobe && <RestingHero shown={heroShown && ready} reduced={reducedMotion} farms={FARMS} selectedId={farmId} onExplore={explore} onPickFarm={pickFromHero} />}

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
            <FarmDetail farm={cardFor ? farmById(cardFor) : null} reduced={reducedMotion} onClose={() => select(null)} onDescend={requestDive} />
          </div>
          <div className="pointer-events-auto absolute top-1/2 right-8 -translate-y-1/2">
            <ControlCluster farms={FARMS} ready={ready} selectedId={farmId} onPickFarm={pickFarm} settings={settings} onSettings={setSettings} />
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
      <div ref={creditSlot} className="ft-credits absolute z-10 -translate-x-1/2" style={{ left: "50%", bottom: "0.25rem", display: onGlobe ? "none" : undefined }} />

      {/* Dive film: above the globe, below the attribution, the title and the panels. */}
      {ready &&
        !reducedMotion &&
        FARMS.filter((f) => DIVE_FILMS[f.id]).map((f) => (
          <DiveFilm
            key={f.id}
            spec={DIVE_FILMS[f.id]}
            run={inFarm && filmOn && f.id === farmId}
            landed={phase !== "dive"}
            onReady={(ok) => setFilmReady((m) => (!!m[f.id] === ok ? m : { ...m, [f.id]: ok }))}
            onFinish={filmDone}
            onFail={filmFailed}
          />
        ))}
      {inFarm && phase === "dive" && !filmOn && <DiveVeil reducedMotion={reducedMotion} />}
      <AnimatePresence onExitComplete={titleExited}>
        {inFarm && phase === "title" && !titleLeaving && <ArrivalTitle key={farm.id} farm={farm} reducedMotion={reducedMotion} onHoldEnd={titleHoldEnd} />}
      </AnimatePresence>

      {/* Farm view controls: mounted only once the title has gone (phase "explore"), then fade in. */}
      {inFarm && panels && (
        <motion.div
          className="pointer-events-none absolute inset-0 p-4 *:pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: farmControlsIn.ms / 1000, ease: "easeOut" }}
        >
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
          ) : (
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
          )}
        </motion.div>
      )}
      {inFarm && (
        <p className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 text-[11px] whitespace-nowrap text-white/[0.7] [text-shadow:0_1px_6px_#000]">
          This tool supports, and does not replace, local agronomic expertise.
        </p>
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

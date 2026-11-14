// Sky / weather engine. OWNER: Person 1 (sky/weather engine). Globe.tsx only creates, updates and destroys it.
// Contract rules (components/globe/types.ts AtmosphereState):
// - Lightning: at most 1 flash per 3 s; disabled entirely under reduced motion.
// - Clouds are illustrative mood effects. Only `rainRateMmH` is data-driven; label nothing else as data.
// - Budget: about 3 ms GPU for ALL effects together (weather + ground layers); `ctx.detail` scales effect cost.
// - The farm camera looks down at -25 deg or more from 150 m - 1.5 km, so a low broken cloud layer sits 150-350 m
//   above the fields (visible between camera and ground), not at real cloud heights.
// - `update(null)` = clear sky, no objects. Keep `active` true only while something animates; Globe then keeps
//   requesting frames (requestRenderMode) and costs nothing when `active` is false.
//
// How it draws: ONE depth-aware post-process pass (shader.ts) does clouds, cloud shadows, fog, haze, shimmer, frost
// sparkle, rain, grade and the lightning pulse. Cesium 1.147 does have CloudCollection/CumulusCloud, but a cloud
// slab marched in the same pass gives shadows that match the puffs exactly, honours scene.splitPosition per pixel
// and adds no scene objects or draw calls. A second, gated copy of the pass draws the "today" baseline left of the
// split (climate shift, dev toggle ?sky=split; ?sky=today shows the baseline everywhere).
import { Cartesian2, Cartesian3, Cartesian4, DirectionalLight, Matrix4, PostProcessStage, Transforms, type Light, type Viewer } from "cesium";

import type { AtmosphereState, DetailLevel, FarmSurface } from "@/components/globe/types";
import type { AtmosphereWithBaseline } from "@/lib/twin/scenarios/atmosphere";

import { cloudSlab, createAutoTier, createLightning, rainDensity, rainFall, rainSpeed, sunFor, tierSettings, windDir } from "./logic";
import { weatherShader } from "./shader";

export interface WeatherContext {
  detail: DetailLevel;
  reducedMotion: boolean;
  /** Seconds since the previous update (capped at 0.1). */
  dtS: number;
  /** Monotonic clock, seconds. */
  nowS: number;
  surface: FarmSurface;
}

export interface WeatherEngine {
  update(state: AtmosphereState | null, ctx: WeatherContext): void;
  /** True while something animates (Globe keeps requesting frames). */
  readonly active: boolean;
  destroy(): void;
}

type Params = {
  cloud: Cartesian4;
  rain: Cartesian4;
  air: Cartesian4;
  tint: Cartesian4;
  sun: Cartesian4;
  sunColor: Cartesian3;
  fall: Cartesian3;
  gate: Cartesian2;
};
const newParams = (): Params => ({ cloud: new Cartesian4(), rain: new Cartesian4(), air: new Cartesian4(), tint: new Cartesian4(), sun: new Cartesian4(), sunColor: new Cartesian3(1, 1, 1), fall: new Cartesian3(0, 0, -1), gate: new Cartesian2() });

const DEG = Math.PI / 180;
const WIND_M_S = 5; // cloud drift speed (mood)

/** Writes one AtmosphereState into shader params. Reduced motion: no rain/drizzle streaks, shimmer or sparkle. */
function fillParams(p: Params, s: AtmosphereState, drift: { x: number; y: number }, reduced: boolean) {
  const sun = sunFor(s.timeOfDayHours, s.sunIntensity);
  p.cloud.x = s.cloudCover;
  p.cloud.y = s.cloudDarkness;
  p.cloud.z = drift.x;
  p.cloud.w = drift.y;
  p.rain.x = reduced ? 0 : rainDensity(s.rainRateMmH);
  p.rain.y = rainSpeed(s.rainRateMmH);
  p.rain.z = reduced ? 0 : s.drizzle;
  p.rain.w = s.windSlantDeg * DEG;
  const fall = rainFall(windDir(p.rain.w), p.rain.w);
  p.fall.x = fall[0];
  p.fall.y = fall[1];
  p.fall.z = fall[2];
  p.air.x = s.fog;
  p.air.y = s.haze;
  p.air.z = reduced ? 0 : s.heatShimmer;
  p.air.w = reduced ? 0 : s.frostSparkle;
  p.tint.x = s.tint[0];
  p.tint.y = s.tint[1];
  p.tint.z = s.tint[2];
  p.tint.w = s.tint[3];
  p.sun.x = sun.dir[0];
  p.sun.y = sun.dir[1];
  p.sun.z = sun.dir[2];
  p.sun.w = sun.exposure;
  p.sunColor.x = sun.color[0];
  p.sunColor.y = sun.color[1];
  p.sunColor.z = sun.color[2];
  return sun;
}

const animates = (s: AtmosphereState) => s.rainRateMmH > 0 || s.drizzle > 0 || s.cloudCover > 0 || s.heatShimmer > 0 || s.frostSparkle > 0 || s.fog > 0 || s.lightning > 0;

/** Dev perf line (same switches as Globe's readout: dev build or ?perf=1, backtick toggles). */
function perfLine(viewer: Viewer) {
  const params = new URLSearchParams(window.location.search);
  if (process.env.NODE_ENV === "production" && params.get("perf") !== "1") return { set() {}, remove() {}, bypass: () => false, measuring: () => false };
  // Measuring hook: window.__ftWeather.bypass = true keeps the engine animating (frames keep rendering) but skips
  // the effect pass, so effect cost = frame time with it on minus frame time with it off.
  // __ftWeather.measure(n) forces n renders, each followed by a 1-pixel readPixels (GPU-synchronous, independent
  // of requestAnimationFrame, which automation browsers throttle) and returns the median ms per frame.
  const hook = {
    bypass: false,
    measuring: false,
    measure(n = 60) {
      hook.measuring = true; // forced back-to-back renders must not trip the auto step-down
      const { scene } = viewer;
      const gl = (scene as unknown as { context: { _gl: WebGL2RenderingContext } }).context._gl; // not in the typings
      const px = new Uint8Array(4);
      const ms: number[] = [];
      for (let i = 0; i < n; i++) {
        const t = performance.now();
        scene.requestRender();
        scene.render();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        ms.push(performance.now() - t);
      }
      hook.measuring = false;
      ms.sort((a, b) => a - b);
      return +ms[Math.floor(n / 2)].toFixed(2);
    },
  };
  (window as unknown as { __ftWeather?: typeof hook }).__ftWeather = hook;
  const el = document.createElement("pre");
  Object.assign(el.style, { position: "absolute", right: "8px", top: "84px", zIndex: "20", margin: "0", padding: "4px 8px", font: "11px/1.4 ui-monospace, monospace", color: "#d7f3ee", background: "rgba(16,32,30,.82)", borderRadius: "6px", pointerEvents: "none", display: params.get("perf") === "1" ? "block" : "none" });
  viewer.container.appendChild(el);
  const onKey = (e: KeyboardEvent) => {
    if (e.code === "Backquote") el.style.display = el.style.display === "none" ? "block" : "none";
  };
  window.addEventListener("keydown", onKey);
  return {
    set(text: string) {
      el.textContent = text;
    },
    remove() {
      window.removeEventListener("keydown", onKey);
      el.remove();
      delete (window as unknown as { __ftWeather?: unknown }).__ftWeather;
    },
    bypass: () => hook.bypass,
    measuring: () => hook.measuring,
  };
}

export function createWeatherEngine(viewer: Viewer): WeatherEngine {
  const { scene } = viewer;
  const skyMode = new URLSearchParams(window.location.search).get("sky"); // dev toggle: "today" | "split" | null
  const main = newParams();
  const base = newParams();
  const eyeToLocal = new Matrix4();
  const worldToLocal = new Matrix4();
  const localToWorld = new Matrix4();
  const misc = new Cartesian3();
  const slab = new Cartesian2(170, 330);
  const time = { t: 0 };
  let anchor: Cartesian3 | null = null;
  let anchorCheckS = 0;
  let anchorGuess = true;
  let stages: { left: PostProcessStage; right: PostProcessStage } | null = null;
  let builtTier: DetailLevel | null = null;
  let last: AtmosphereState | null = null;
  let active = false;
  const drift = { x: 0, y: 0 };
  const parallax = { heading: 0, lastHeading: null as number | null };
  const originalLight: Light = scene.light;
  const light = new DirectionalLight({ direction: new Cartesian3(0, 0, -1) });
  // Seeded so a replay looks the same within a session; flashes are mood, never data.
  let seed = 0x9e3779b9;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const lightning = createLightning(rand);
  const auto = createAutoTier();
  const perf = perfLine(viewer);
  let perfAt = 0;

  const uniformsFor = (p: Params) => ({
    u_eyeToLocal: () => eyeToLocal,
    u_time: () => time.t,
    u_gate: () => p.gate,
    u_cloud: () => p.cloud,
    u_rain: () => p.rain,
    u_air: () => p.air,
    u_tint: () => p.tint,
    u_sun: () => p.sun,
    u_sunColor: () => p.sunColor,
    u_fall: () => p.fall,
    u_misc: () => misc,
    u_slab: () => slab,
  });

  const removeStages = () => {
    if (!stages) return;
    scene.postProcessStages.remove(stages.left); // remove() also destroys
    scene.postProcessStages.remove(stages.right);
    stages = null;
    builtTier = null;
  };

  const build = (tier: DetailLevel) => {
    removeStages();
    const fragmentShader = weatherShader(tierSettings(tier));
    stages = {
      left: scene.postProcessStages.add(new PostProcessStage({ name: "ft-weather-today", fragmentShader, uniforms: uniformsFor(base) })) as PostProcessStage,
      right: scene.postProcessStages.add(new PostProcessStage({ name: "ft-weather", fragmentShader, uniforms: uniformsFor(main) })) as PostProcessStage,
    };
    builtTier = tier;
  };

  /** Camera height above a ground point, along that point's up direction (m). */
  const heightAbove = (p: Cartesian3) => {
    const up = scene.globe.ellipsoid.geodeticSurfaceNormal(p, new Cartesian3());
    return Cartesian3.dot(Cartesian3.subtract(scene.camera.positionWC, p, new Cartesian3()), up);
  };
  const plausible = (p: Cartesian3) => {
    const h = heightAbove(p);
    return h > 15 && h < 3000 && Cartesian3.distance(p, scene.camera.positionWC) < 4000;
  };

  /**
   * Anchor the local frame on the ground at the screen centre. A depth pick made while tiles still stream can land
   * anywhere, so the anchor is re-checked every second and replaced when the camera is not 15 m - 3 km above it.
   * The ellipsoid is only a stand-in until a plausible depth pick exists.
   */
  const updateAnchor = (nowS: number) => {
    if (anchor && nowS - anchorCheckS < 1) return;
    anchorCheckS = nowS;
    if (anchor && !anchorGuess && plausible(anchor)) return;
    const c = new Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2);
    let p: Cartesian3 | undefined;
    try {
      p = scene.pickPositionSupported ? scene.pickPosition(c) : undefined;
    } catch {
      p = undefined;
    }
    anchorGuess = !p || !plausible(p);
    if (anchorGuess) {
      if (anchor) return; // keep the current stand-in, try again next second
      p = scene.camera.pickEllipsoid(c) ?? undefined;
    }
    if (!p) return;
    anchor = p;
    Transforms.eastNorthUpToFixedFrame(anchor, undefined, localToWorld);
    Matrix4.inverseTransformation(localToWorld, worldToLocal);
  };

  const clear = () => {
    removeStages();
    if (scene.light === light) scene.light = originalLight;
    active = false;
    if (last) scene.requestRender();
    last = null;
    perf.set("sky off");
  };

  return {
    get active() {
      return active;
    },
    update(state, ctx) {
      if (!state) {
        if (last || stages) clear();
        return;
      }
      updateAnchor(ctx.nowS);
      if (!anchor) return;

      const reduced = ctx.reducedMotion;
      const moving = !reduced && animates(state);
      const tier = moving && !perf.measuring() ? auto.update(ctx.detail, ctx.dtS) : ctx.detail;
      if (builtTier !== tier) build(tier);
      if (!stages) return;

      if (!reduced) {
        time.t = ctx.nowS % 3600; // keep float precision in the shader
        // The shader samples the field at xy + drift, so the clouds move along -drift, i.e. with the wind.
        const w = windDir(state.windSlantDeg * DEG);
        drift.x -= WIND_M_S * w[0] * ctx.dtS;
        drift.y -= WIND_M_S * w[1] * ctx.dtS;
      }
      // Camera heading/pitch shift the rain layers a little (parallax); heading is unwrapped so it never jumps.
      const h = scene.camera.heading;
      if (parallax.lastHeading !== null) {
        let d = h - parallax.lastHeading;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        parallax.heading += d;
      }
      parallax.lastHeading = h;
      misc.x = lightning.update(state.lightning, ctx.nowS, reduced);
      misc.y = -parallax.heading * 0.8;
      misc.z = scene.camera.pitch * 0.8;

      Matrix4.multiply(worldToLocal, scene.camera.inverseViewMatrix, eyeToLocal);
      Object.assign(slab, cloudSlab(eyeToLocal[14]));
      const sun = fillParams(main, state, drift, reduced);
      const withBase = state as AtmosphereWithBaseline;
      const baseline = withBase.baseline;
      const split = !!baseline && skyMode === "split";
      if (baseline && skyMode === "today") fillParams(main, baseline, drift, reduced);
      if (split) fillParams(base, baseline, drift, reduced);
      const at = scene.splitPosition > 0 && scene.splitPosition < 1 ? scene.splitPosition : 0.5;
      main.gate.x = split ? 1 : 0;
      main.gate.y = at;
      base.gate.x = -1;
      base.gate.y = at;
      const bypass = perf.bypass();
      stages.left.enabled = split && !bypass;
      stages.right.enabled = !bypass;

      // Sun direction for lit surfaces (terrain, models); Google photogrammetry is unlit, so the grade carries the look.
      const sunWorld = Matrix4.multiplyByPointAsVector(localToWorld, new Cartesian3(...sun.dir), new Cartesian3());
      Cartesian3.negate(Cartesian3.normalize(sunWorld, sunWorld), light.direction);
      light.intensity = 2 * sun.exposure;
      if (scene.light !== light) scene.light = light;

      if (state !== last) scene.requestRender(); // static states (reduced motion) still need a redraw when they change
      last = state;
      active = moving || misc.x > 0;

      if (ctx.nowS - perfAt > 0.5) {
        perfAt = ctx.nowS;
        const stepped = tier !== ctx.detail ? ` (auto-stepped from ${ctx.detail})` : "";
        perf.set(`sky tier ${tier}${stepped}${moving ? `  fx fps ${auto.fps.toFixed(0)}` : "  static"}${split ? "  split" : ""}  cam ${eyeToLocal[14].toFixed(0)} m above anchor`);
      }
    },
    destroy() {
      clear();
      perf.remove();
    },
  };
}

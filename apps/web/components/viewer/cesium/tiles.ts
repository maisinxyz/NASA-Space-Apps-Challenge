// Viewer construction and the imagery/tiles tiers: A = B + Google Photorealistic 3D Tiles in farm view,
// B = ion World Terrain + world imagery + OSM Buildings, C = keyless.
import "./base";
import {
  buildModuleUrl,
  type Cesium3DTileset,
  Cartographic,
  createGooglePhotorealistic3DTileset,
  createOsmBuildingsAsync,
  createWorldImageryAsync,
  createWorldTerrainAsync,
  ImageryLayer,
  Ion,
  IonImageryProvider,
  sampleTerrainMostDetailed,
  ScreenSpaceEventType,
  type TerrainProvider,
  TileMapServiceImageryProvider,
  Viewer,
} from "cesium";
import type { FarmSurface, GlobeView, TileTier } from "@/components/globe/types";
import { qualityFor, type RenderQuality } from "./perf";

const TIERS: readonly TileTier[] = ["A", "B", "C"];
/** ion asset "Google Maps 2D Satellite", id as listed for the team's ion account (see tier B below). */
const ION_GOOGLE_2D_SATELLITE = 3830182;

/**
 * Tiers to try, in order (pure). No token -> only C (no ion calls at all). Otherwise start at the override
 * if valid (A, B or C), else A, and fall back downward. A and B load the same globe (World Terrain + Bing);
 * A additionally allows the Google tileset in farm view (loaded lazily, see pickSurface).
 */
export function selectTierOrder(input: { token?: string | null; override?: string | null }): TileTier[] {
  if (!input.token?.trim()) return ["C"];
  const o = input.override?.trim().toUpperCase();
  const start = TIERS.find((t) => t === o) ?? "A";
  return TIERS.slice(TIERS.indexOf(start));
}

const ionToken = () => process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN?.trim() ?? "";

/** Tier order from the build-time env: NEXT_PUBLIC_CESIUM_ION_TOKEN, NEXT_PUBLIC_TILE_TIER=A|B|C (B or C = no Google). */
export function tierOrderFromEnv(): TileTier[] {
  return selectTierOrder({ token: ionToken(), override: process.env.NEXT_PUBLIC_TILE_TIER });
}

/**
 * How the Google tileset is fetched (pure): "ion" (Cesium ion token; free plan is personal/non-commercial and
 * metered) or "google-key" (Google Map Tiles API key, the commercial path) when NEXT_PUBLIC_GOOGLE_MAPS_KEY is set.
 */
export function googleTilesRoute(key: string | null | undefined = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY): "ion" | "google-key" {
  return key?.trim() ? "google-key" : "ion";
}

/** Minimum gap between onLoadProgress reports, ms (~4/s). */
export const PROGRESS_INTERVAL_MS = 250;

/**
 * Pure throttle for the pending-tile count: report a change at most every PROGRESS_INTERVAL_MS, but report
 * "settled" (0) at once. `last` = what was last reported and when (null = nothing yet). Returns the new `last` or null (skip).
 */
export function progressToReport(last: { pending: number; at: number } | null, pending: number, now: number): { pending: number; at: number } | null {
  if (last && last.pending === pending) return null;
  if (last && pending !== 0 && now - last.at < PROGRESS_INTERVAL_MS) return null;
  return { pending, at: now };
}

/** A Cesium Viewer with every default widget off. The credit container is left in place (required attribution). */
export function createViewer(container: HTMLElement): Viewer {
  const viewer = new Viewer(container, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    vrButton: false,
    baseLayer: false, // layers are added per tier; false also avoids Cesium's default ion imagery request
    scene3DOnly: true,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    showRenderLoopErrors: false, // errors go to onError instead of Cesium's HTML panel
    // skyBox / skyAtmosphere left at their defaults: Cesium's bundled star map and sky atmosphere.
  });
  // Viewer's default double-click handler tracks the clicked entity; we drive the camera ourselves.
  viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  // Cesium renders at CSS pixels by default, which looks soft on HiDPI laptop screens. Capped by detail (perf.ts
  // qualityFor): the demo laptop (Intel Arc 140T) is fill-rate bound on Google tiles at 1080p.
  viewer.resolutionScale = qualityFor("medium", window.devicePixelRatio || 1).resolutionScale;
  // MSAA 4x (Cesium default) multiplies fill cost on a fill-bound GPU; FXAA below keeps edges acceptable.
  viewer.scene.msaaSamples = 1;
  viewer.scene.postProcessStages.fxaa.enabled = true;
  return viewer;
}

/** Apply a RenderQuality (see perf.ts qualityFor): tile screen-space error on Google's tileset, canvas resolution scale. Cheap when unchanged. */
export function applyQuality(viewer: Viewer, tileset: Cesium3DTileset | undefined, q: RenderQuality) {
  if (tileset && tileset.maximumScreenSpaceError !== q.sse) tileset.maximumScreenSpaceError = q.sse;
  if (viewer.resolutionScale !== q.resolutionScale) viewer.resolutionScale = q.resolutionScale;
}

/** Farm-view camera limits: the camera is within 1.5 km of the target looking down, so 3 km of depth is plenty (fewer tiles drawn, better depth precision). */
export const FARM_FAR_M = 3000;
export const FARM_NEAR_M = 1;
const FARM_FOG_DENSITY = 6.0e-4;
const GLOBE_FOG_DENSITY = 2.0e-4; // Cesium default
const GLOBE_NEAR_M = 0.1; // Cesium default
const GLOBE_FAR_M = 500000000; // Cesium default

/** Tighter frustum and fog in farm view (call once landed); `false` restores the globe-view defaults. */
export function setFarmCameraLimits(viewer: Viewer, farm: boolean) {
  const f = viewer.camera.frustum as { near: number; far: number };
  f.near = farm ? FARM_NEAR_M : GLOBE_NEAR_M;
  f.far = farm ? FARM_FAR_M : GLOBE_FAR_M;
  viewer.scene.fog.density = farm ? FARM_FOG_DENSITY : GLOBE_FOG_DENSITY;
  viewer.scene.requestRender();
}

/**
 * What draws the ground: "google" = Google Photorealistic 3D Tiles (globe surface hidden), "terrain" = ion
 * World Terrain + world imagery (+ OSM Buildings), "base" = keyless Natural Earth globe (tier C).
 */
export type Surface = FarmSurface | "base";

/**
 * Pure: which surface to show. Google only in farm view, tier A, when asked for (the whole-Earth globe never
 * loads it: quota). A source that failed falls back google -> terrain -> base. Tier C never touches ion.
 */
export function pickSurface(i: { tier: TileTier; view: GlobeView; want: FarmSurface; failed: ReadonlySet<Surface> }): Surface {
  if (i.tier === "C") return "base";
  if (i.view === "farm" && i.tier === "A" && i.want === "google" && !i.failed.has("google")) return "google";
  return i.failed.has("terrain") ? "base" : "terrain";
}

/** Google tileset cache. God's Eye View and Cesium's default use 1.5 GiB / 1 GiB; the demo laptop has an integrated GPU. */
const GOOGLE_CACHE_BYTES = 512 * 1024 * 1024;
const GOOGLE_CACHE_OVERFLOW_BYTES = 256 * 1024 * 1024;

export type LoadedTier = {
  tier: TileTier;
  /** The Google Photorealistic 3D tileset once loaded (lazily, on the first farm view with surface "google"). */
  readonly tileset?: Cesium3DTileset;
  /** Surface currently shown. */
  readonly surface: Surface;
  /** Surfaces whose sources failed to load (never retried: each source is requested at most once per viewer). */
  readonly failed: ReadonlySet<Surface>;
  /** Load the surface's sources if needed (at most once per viewer) and show it. False if loading failed. */
  setSurface(s: Surface): Promise<boolean>;
  /** Ellipsoid height of the rendered surface at a point, metres; undefined until that area has loaded. Sync. */
  groundAt(c: Cartographic): number | undefined;
  /** Terrain height at a point, metres (async, most detailed). 0 when no terrain source is available (tier C). */
  sampleGround(lonDeg: number, latDeg: number): Promise<number>;
  /** Tiles still loading on what is shown: globe tile queue + pending requests and tiles processing of shown tilesets. */
  pending(): number;
};

/** Try each tier in order and return the first that loads. Rejects only if every tier fails. */
export async function loadTier(viewer: Viewer, order: readonly TileTier[]): Promise<LoadedTier> {
  const { scene } = viewer;
  const alive = () => {
    if (viewer.isDestroyed()) throw new Error("viewer destroyed");
  };

  // Offline backdrop for every tier: Natural Earth II, shipped inside Cesium's Assets (no external service).
  // It is tier C's imagery and what tiers A/B show while their tiles stream in.
  const base = await TileMapServiceImageryProvider.fromUrl(buildModuleUrl("Assets/Textures/NaturalEarthII"));
  alive();
  viewer.imageryLayers.add(new ImageryLayer(base));

  const token = ionToken();
  if (token) Ion.defaultAccessToken = token;

  // Every ion source is requested at most once per viewer (memoised promises, failures included): quota.
  let ionUsable = false;
  let terrainP: Promise<TerrainProvider> | undefined;
  // requestVertexNormals: needed for sun shading of the terrain (globe.enableLighting).
  const worldTerrain = () => (terrainP ??= createWorldTerrainAsync({ requestVertexNormals: true }));
  const sampleGround = async (lon: number, lat: number) => {
    if (!ionUsable) return 0;
    try {
      const [c] = await sampleTerrainMostDetailed(await worldTerrain(), [Cartographic.fromDegrees(lon, lat)]);
      return c.height ?? 0;
    } catch {
      return 0;
    }
  };

  let surface: Surface = "base";
  let osm: Cesium3DTileset | undefined;
  let tileset: Cesium3DTileset | undefined;
  let googleShowing = false; // true once the tileset's first view has loaded: only then hide the globe
  const failed = new Set<Surface>();
  // Load progress from Cesium's events: Globe.tileLoadProgressEvent(queueLength), Cesium3DTileset.loadProgress(requests, processing).
  let globeQueue = 0;
  scene.globe.tileLoadProgressEvent.addEventListener((n: number) => (globeQueue = n));
  const tsPending = new Map<Cesium3DTileset, number>();
  const track = (ts: Cesium3DTileset) => ts.loadProgress.addEventListener((req: number, proc: number) => tsPending.set(ts, req + proc));

  const show = (s: Surface) => {
    surface = s;
    if (tileset) tileset.show = s === "google";
    if (osm) osm.show = s === "terrain";
    // Google's tiles replace the globe surface (keeping both z-fights). The globe stays visible until the
    // tileset's first view has loaded, so the ground is never blank.
    scene.globe.show = !(s === "google" && googleShowing);
    scene.requestRender();
  };

  let googleP: Promise<unknown> | undefined;
  const loadGoogle = () =>
    (googleP ??= (async () => {
      // Cesium resolves the Google asset itself (ion route: no asset id in our code; key route: Google's Map
      // Tiles API). onlyUsingWithGoogleGeocoder: Google's terms forbid pairing these tiles with a non-Google
      // geocoder; this app has no geocoder at all. TODO(verify): confirm "no geocoder" satisfies the terms.
      // enableCollision false: getHeight() is a ray pick and does not need it; it only feeds camera collision (off in
      // farm view, we clamp ourselves) and CLAMP_TO_GROUND entities on the tiles (none). maximumScreenSpaceError 16 (Cesium's
      // default): 8 looked a little sharper but cost ~20 % fps on the demo laptop (Phase 3 note). The streaming
      // optimisations below are Cesium's defaults (engine 26.5), set explicitly so a library change cannot drop them.
      // Google's logo/credits go to Cesium's credit display on both routes.
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY?.trim();
      const api = googleTilesRoute(key) === "google-key" ? { key, onlyUsingWithGoogleGeocoder: true as const } : { onlyUsingWithGoogleGeocoder: true as const };
      const ts = await createGooglePhotorealistic3DTileset(api, {
        enableCollision: false,
        maximumScreenSpaceError: 16,
        dynamicScreenSpaceError: true,
        foveatedScreenSpaceError: true,
        cullRequestsWhileMoving: true,
        preloadWhenHidden: false,
        cacheBytes: GOOGLE_CACHE_BYTES,
        maximumCacheOverflowBytes: GOOGLE_CACHE_OVERFLOW_BYTES,
      });
      alive();
      ts.show = false;
      track(ts);
      scene.primitives.add(ts);
      ts.initialTilesLoaded.addEventListener(() => {
        googleShowing = true;
        if (!viewer.isDestroyed()) show(surface);
      });
      tileset = ts;
    })());

  let terrainBundleP: Promise<unknown> | undefined;
  const loadTerrain = () =>
    (terrainBundleP ??= (async () => {
      // Cesium's documented helpers resolve ion's Cesium World Terrain and default world imagery (Bing Maps
      // Aerial through ion; the account has it as of 2026-11-13 per the lead) without asset ids in our code.
      // Fallback kept for accounts without Bing: "Google Maps 2D Satellite" from the account's asset list
      // (GET https://api.cesium.com/v1/assets, read 2026-11-13).
      // TODO(verify): Google Map Tiles terms for that fallback imagery (overlays, quota) before the demo.
      const [terrainProvider, imagery] = await Promise.all([
        worldTerrain(),
        createWorldImageryAsync().catch(() => IonImageryProvider.fromAssetId(ION_GOOGLE_2D_SATELLITE)),
      ]);
      alive();
      viewer.terrainProvider = terrainProvider;
      viewer.imageryLayers.add(new ImageryLayer(imagery));
      // 3D buildings from OpenStreetMap via ion (Cesium OSM Buildings). Optional: terrain stays usable without it.
      // TODO(verify): the asset is enabled on the team's ion account.
      createOsmBuildingsAsync()
        .then((b) => {
          if (viewer.isDestroyed()) return;
          osm = b;
          track(b);
          scene.primitives.add(b);
          show(surface);
        })
        .catch((e) => console.warn("[globe] OSM Buildings unavailable", e instanceof Error ? e.message : e));
    })());

  // Last request wins when calls overlap.
  let wanted: Surface = "base";
  const setSurface = async (s: Surface): Promise<boolean> => {
    wanted = s;
    try {
      if (s === "google") await loadGoogle();
      else if (s === "terrain") await loadTerrain();
    } catch (e) {
      if (viewer.isDestroyed()) return false;
      failed.add(s);
      console.warn(`[globe] surface ${s} unavailable`, e instanceof Error ? e.message : e);
      return false;
    }
    if (!viewer.isDestroyed() && wanted === s) show(s);
    return true;
  };

  const loaded = (tier: TileTier): LoadedTier => ({
    tier,
    get tileset() {
      return tileset;
    },
    get surface() {
      return surface;
    },
    failed,
    setSurface,
    groundAt: (c) => (surface === "google" && tileset ? tileset.getHeight(c, scene) : scene.globe.getHeight(c)),
    sampleGround,
    pending: () => {
      let n = scene.globe.show ? globeQueue : 0;
      for (const [ts, k] of tsPending) if (ts.show) n += k;
      return n;
    },
  });

  let lastError: unknown;
  for (const tier of order) {
    try {
      if (tier === "A" || tier === "B") {
        // Same globe for A and B; A's Google tileset loads later, on the first farm view (pickSurface).
        await loadTerrain();
        ionUsable = true;
        show("terrain");
      } else {
        failed.add("google").add("terrain"); // tier C: never call ion
        show("base");
      }
      return loaded(tier);
    } catch (e) {
      alive();
      lastError = e;
      if (tier !== "C") failed.add("terrain"); // memoised: B after a failed A fails fast, then C
      console.warn(`[globe] tile tier ${tier} failed, falling back`, e instanceof Error ? e.message : e);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No tile tier could be loaded");
}

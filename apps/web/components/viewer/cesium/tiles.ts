// Viewer construction and the two imagery/tiles tiers (B ion terrain + imagery + OSM Buildings, C keyless).
import "./base";
import {
  buildModuleUrl,
  type Cesium3DTileset,
  Cartographic,
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
import type { TileTier } from "@/components/globe/types";

const TIERS: readonly TileTier[] = ["B", "C"];
/** ion asset "Google Maps 2D Satellite", id as listed for the team's ion account (see tier B below). */
const ION_GOOGLE_2D_SATELLITE = 3830182;

/**
 * Tiers to try, in order (pure). No token -> only C (no ion calls at all). Otherwise start at the override
 * if valid (B or C), else B, and fall back downward.
 */
export function selectTierOrder(input: { token?: string | null; override?: string | null }): TileTier[] {
  if (!input.token?.trim()) return ["C"];
  const o = input.override?.trim().toUpperCase();
  const start = TIERS.find((t) => t === o) ?? "B";
  return TIERS.slice(TIERS.indexOf(start));
}

const ionToken = () => process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN?.trim() ?? "";

/** Tier order from the build-time env: NEXT_PUBLIC_CESIUM_ION_TOKEN, NEXT_PUBLIC_TILE_TIER=B|C. */
export function tierOrderFromEnv(): TileTier[] {
  return selectTierOrder({ token: ionToken(), override: process.env.NEXT_PUBLIC_TILE_TIER });
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
  // Cesium renders at CSS pixels by default, which looks soft on HiDPI laptop screens. Cap at 2x for fps.
  viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 2);
  viewer.scene.postProcessStages.fxaa.enabled = true;
  return viewer;
}

/** What draws the ground: "terrain" = ion World Terrain + world imagery (+ OSM Buildings), "base" = keyless Natural Earth globe (tier C). */
export type Surface = "terrain" | "base";

/** Pure: which surface to show. Tier C never touches ion; a terrain source that failed to load falls back to base. */
export function pickSurface(i: { tier: TileTier; failed: ReadonlySet<Surface> }): Surface {
  return i.tier === "C" || i.failed.has("terrain") ? "base" : "terrain";
}

export type LoadedTier = {
  tier: TileTier;
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
  const failed = new Set<Surface>();

  const show = (s: Surface) => {
    surface = s;
    if (osm) osm.show = s === "terrain";
    scene.requestRender();
  };

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
      if (s === "terrain") await loadTerrain();
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
    get surface() {
      return surface;
    },
    failed,
    setSurface,
    groundAt: (c) => scene.globe.getHeight(c),
    sampleGround,
  });

  let lastError: unknown;
  for (const tier of order) {
    try {
      if (tier === "B") {
        await loadTerrain();
        ionUsable = true;
        show("terrain");
      } else {
        failed.add("terrain"); // tier C: never call ion
        show("base");
      }
      return loaded(tier);
    } catch (e) {
      alive();
      lastError = e;
      if (tier === "B") failed.add("terrain");
      console.warn(`[globe] tile tier ${tier} failed, falling back`, e instanceof Error ? e.message : e);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No tile tier could be loaded");
}

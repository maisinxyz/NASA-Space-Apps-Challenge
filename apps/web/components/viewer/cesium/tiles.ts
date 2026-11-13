// Viewer construction and the three imagery/tiles tiers (A Google photoreal via ion, B ion terrain + imagery, C keyless).
import "./base";
import {
  buildModuleUrl,
  Cartographic,
  type Cesium3DTileset,
  createGooglePhotorealistic3DTileset,
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

const TIERS: readonly TileTier[] = ["A", "B", "C"];
/** ion asset "Google Maps 2D Satellite", id as listed for the team's ion account (see tier B below). */
const ION_GOOGLE_2D_SATELLITE = 3830182;

/**
 * Tiers to try, in order (pure). No token -> only C (no ion calls at all). Otherwise start at the override
 * if valid, else A in production and B in development (the ion free plan meters Google tile sessions,
 * so dev does not spend them by default), and fall back downward.
 */
export function selectTierOrder(input: { token?: string | null; override?: string | null; production: boolean }): TileTier[] {
  if (!input.token?.trim()) return ["C"];
  const o = input.override?.trim().toUpperCase();
  const start = TIERS.find((t) => t === o) ?? (input.production ? "A" : "B");
  return TIERS.slice(TIERS.indexOf(start));
}

const ionToken = () => process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN?.trim() ?? "";

/** Tier order from the build-time env: NEXT_PUBLIC_CESIUM_ION_TOKEN, NEXT_PUBLIC_TILE_TIER=A|B|C, NODE_ENV. */
export function tierOrderFromEnv(): TileTier[] {
  return selectTierOrder({ token: ionToken(), override: process.env.NEXT_PUBLIC_TILE_TIER, production: process.env.NODE_ENV === "production" });
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
  return viewer;
}

export type LoadedTier = {
  tier: TileTier;
  /** Tier A only: the Google Photorealistic 3D tileset (the globe surface is hidden once it has loaded). */
  tileset?: Cesium3DTileset;
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

  let terrain: Promise<TerrainProvider> | undefined;
  const sampleGround = async (lon: number, lat: number) => {
    if (!terrain) return 0;
    const [c] = await sampleTerrainMostDetailed(await terrain, [Cartographic.fromDegrees(lon, lat)]);
    return c.height ?? 0;
  };

  let lastError: unknown;
  for (const tier of order) {
    try {
      if (tier === "A") {
        // Cesium resolves the Google Photorealistic 3D Tiles ion asset itself (no asset id in our code).
        // onlyUsingWithGoogleGeocoder: Google's terms forbid pairing these tiles with a non-Google geocoder;
        // this app has no geocoder at all. TODO(verify): confirm that "no geocoder" satisfies the ion/Google terms.
        // enableCollision: needed for tileset.getHeight() (camera clamp) and for clamping pins to the tiles.
        const tileset = await createGooglePhotorealistic3DTileset({ onlyUsingWithGoogleGeocoder: true }, { enableCollision: true });
        alive();
        scene.primitives.add(tileset);
        // Whole-Earth look: Google's tiles cover the planet at every distance, so they replace the globe
        // surface entirely (keeping both gives z-fighting). The Natural Earth globe stays visible only until
        // the first view of tiles has loaded, so the Earth is never blank.
        tileset.initialTilesLoaded.addEventListener(() => {
          scene.globe.show = false;
          scene.requestRender();
        });
        // Height source for fly-in targets only (not rendered): ion Cesium World Terrain.
        const worldTerrain = createWorldTerrainAsync();
        terrain = worldTerrain;
        worldTerrain.catch(() => (terrain = undefined));
        return { tier, tileset, groundAt: (c) => tileset.getHeight(c, scene), sampleGround };
      }
      if (tier === "B") {
        // Cesium's documented helpers; they resolve ion's Cesium World Terrain and default world imagery
        // (Bing Maps Aerial through ion) without asset ids in our code.
        // Fallback: the team's ion account has no Bing/Sentinel-2 asset (ion answers 404); its asset list
        // (GET https://api.cesium.com/v1/assets, read 2026-11-13) offers "Google Maps 2D Satellite" instead.
        // TODO(verify): Google Map Tiles terms for this imagery (overlays, quota) before the demo.
        const [terrainProvider, imagery] = await Promise.all([
          createWorldTerrainAsync(),
          createWorldImageryAsync().catch(() => IonImageryProvider.fromAssetId(ION_GOOGLE_2D_SATELLITE)),
        ]);
        alive();
        viewer.terrainProvider = terrainProvider;
        viewer.imageryLayers.add(new ImageryLayer(imagery));
        terrain = Promise.resolve(terrainProvider);
      }
      return { tier, groundAt: (c) => scene.globe.getHeight(c), sampleGround };
    } catch (e) {
      alive();
      lastError = e;
      console.warn(`[globe] tile tier ${tier} failed, falling back`, e instanceof Error ? e.message : e);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No tile tier could be loaded");
}

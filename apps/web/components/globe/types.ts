// Shared contract between the Cesium globe (rendering owner) and the shell/UI (product owner).
// Change only by agreement; both sides build against this file.

export type FarmTier = "twin" | "explore";

export type Farm = {
  id: string;
  name: string;
  /**
   * Who operates the site. Public institutions are named; private farmland is described by area only
   * (e.g. "Private working farmland"), never by owner (user decision for Lancaster County).
   */
  owner: string;
  country: string;
  /** Town and region for the arrival title, from the farm's cited source. Omitted when no source gives one. */
  locality?: string;
  lon: number;
  lat: number;
  /** "twin" = full digital twin (simulation available); "explore" = landscape only. */
  tier: FarmTier;
  /** Where the location/ownership claim comes from. */
  sourceUrl: string;
  areaHa?: number;
  /** False when the coordinates are not published by the owner (show "approximate location"). */
  coordsVerified: boolean;
  /** Camera is confined to this radius around the farm centre, metres. */
  radiusM: number;
  /**
   * Farm-view start framing (fly-in end and Reset view): orbit target, distance and angles. Defaults to the
   * simulation-square centre (or the farm point) at the renderer's standard range/pitch when omitted.
   */
  framing?: { lon: number; lat: number; rangeM: number; pitchDeg: number; headingDeg?: number };
  /** Closest allowed camera distance in farm view, metres (privacy for private farmland). Renderer default otherwise. */
  minRangeM?: number;
};

export type GlobeView = "globe" | "farm";

/**
 * Which imagery/tiles tier actually loaded: A Google Photorealistic 3D Tiles via Cesium ion (product direction:
 * God's-eye look, used in farm view), B ion World Terrain + Bing Aerial (+ OSM Buildings), C keyless imagery.
 */
export type TileTier = "A" | "B" | "C";

/** Which surface the farm view draws. "google" falls back to "terrain" when tier A is unavailable. */
export type FarmSurface = "google" | "terrain";

/** Ground cover drawn on a field in the twin. Illustrative look only, not a measured crop map. */
export type CropLook = "grass" | "corn" | "cereal" | "legume" | "cover" | "berry" | "bare";

/** One field of a twin farm. Boundaries are approximate; crops are illustrative (not public data). */
export type FarmField = {
  id: string;
  name: string;
  /** Closed ring of [lon, lat] degrees (first point need not repeat). */
  ring: [number, number][];
  areaHa: number;
  crop: CropLook;
};

/**
 * Generic overlay draped on the farm ground (water depth, heat, frost, risk zones…). Any climate scenario
 * renders into `canvas` (north-up, covering `bbox`) and bumps `version` when the pixels change; the globe
 * re-uploads the texture only when `version` changes. Transparent pixels show the ground underneath.
 */
export type GroundOverlay = {
  id: string;
  /** [west, south, east, north] degrees. */
  bbox: [number, number, number, number];
  canvas: HTMLCanvasElement;
  version: number;
  opacity: number;
};

/** Farm-view inputs. All optional: the globe works without a twin (explore-only farms). */
export type FarmTwinProps = {
  fields?: FarmField[];
  selectedFieldId?: string | null;
  onSelectField?(id: string | null): void;
  /** Per-field crop override, e.g. the season shown for a chosen rotation. Falls back to field.crop. */
  cropByField?: Record<string, CropLook>;
  /** Drapes, bottom first. Empty/undefined = none. */
  overlays?: GroundOverlay[];
  /**
   * The simulation square, [west, south, east, north] degrees: the twin's model area. Inside it the farm is
   * shown in full detail (terrain, aerial imagery, fields, overlays); outside it the land is muted context.
   * The farm-view camera orbits its centre and the screen centre cannot leave it. Undefined = whole farm radius.
   */
  simBbox?: [number, number, number, number];
  /** Farm-view surface. Default "google" (photoreal, real trees/buildings); "terrain" = World Terrain + Bing, overlays only on the ground. */
  surface?: FarmSurface;
  /**
   * Polygons (rings of [lon, lat]) where overlays must NOT draw, e.g. OSM building footprints, so water/risk
   * layers do not cover roofs on the photoreal surface.
   */
  overlayMask?: [number, number][][];
  /** Terrain vertical exaggeration in farm view, 1 = true scale. */
  exaggeration?: number;
  /**
   * A/B comparison: when set, the screen is split at `divider` (0..1 of canvas width, left = A). The left half
   * shows cropByField/overlays (A); the right half shows `right` (B). One shared camera. Null/undefined = no split.
   */
  compare?: { right: { cropByField?: Record<string, CropLook>; overlays?: GroundOverlay[] }; divider: number } | null;
  /** Illustrative look filter over the whole farm view (captioned "illustrative styling" by the UI; not sensor data). */
  look?: LookFilter;
  /**
   * Field crop colour fills (incl. per-side fills in the A/B split). Default false: fields are invisible except a
   * hover label (name + crop) and a faint outline on the selected field, so the real imagery stays visible.
   */
  showCropFills?: boolean;
  /**
   * Sky and air state for the weather engine (clouds, rain, fog, haze, lightning, tint, sun). Null/undefined = clear
   * default sky and no weather objects. Illustrative mood effects; only `rainRateMmH` is data-driven.
   */
  weather?: AtmosphereState | null;
  /** Animated ground layers drawn as materials on the terrain (wetness, water, frost, crop cover, ...). Empty = none. */
  groundLayers?: GroundLayerSpec[];
  /** Effects/render detail. "low" also lowers tile detail and resolution to protect frame rate. Default "medium". */
  detail?: DetailLevel;
};

export type DetailLevel = "high" | "medium" | "low";

/**
 * Sky and air state, evaluated per frame from the scenario. All values 0..1 unless noted.
 * Owned by the weather engine (components/viewer/cesium/weather/**); written by lib/twin/scenarios/atmosphere/**.
 */
export type AtmosphereState = {
  /** 0 clear .. 1 full low cloud deck. */
  cloudCover: number;
  /** 0 white cloud .. 1 dark storm grey. */
  cloudDarkness: number;
  /** Rain rate, mm per hour (0 = none). Drives rain streak density and speed. The one data-driven field. */
  rainRateMmH: number;
  /** Fine slow drizzle, 0..1. */
  drizzle: number;
  /** Lightning likelihood weight 0..1. The engine must cap flashes at one per 3 s and disable them under reduced motion. */
  lightning: number;
  /** Ground fog / mist. */
  fog: number;
  /** Dust or heat haze. */
  haze: number;
  /** Heat shimmer distortion. */
  heatShimmer: number;
  /** Ice sparkle / frost air particles. */
  frostSparkle: number;
  /** Sun brightness, 1 = normal, up to 1.5. */
  sunIntensity: number;
  /** Colour grade [r, g, b] in 0..1 and strength 0..1 (0 = no grade). */
  tint: [number, number, number, number];
  /** Local solar hour 0..24 for sun direction (dawn/dusk/night). */
  timeOfDayHours: number;
  /** Rain slant from vertical, degrees (wind). */
  windSlantDeg: number;
};

export const CLEAR_SKY: AtmosphereState = {
  cloudCover: 0,
  cloudDarkness: 0,
  rainRateMmH: 0,
  drizzle: 0,
  lightning: 0,
  fog: 0,
  haze: 0,
  heatShimmer: 0,
  frostSparkle: 0,
  sunIntensity: 1,
  tint: [1, 1, 1, 0],
  timeOfDayHours: 10,
  windSlantDeg: 0,
};

export type GroundLayerKind =
  | "wetness" // soil darkens / sheen
  | "water" // standing water with ripples
  | "runoff" // muddy runoff streaks on slopes
  | "floodZones" // shallow water rising in low zones
  | "dryness" // drying tan soil, cracks
  | "frost" // white frost over cold-air pooling spots
  | "heatGlow" // heat stress glow on crop fields
  | "cropCover" // crop rows / bare soil by month
  | "vegetation" // greenness (NDVI-style) vs normal
  | "organicMatter" // gentle soil darkening, legume/cover markers
  | "nasaImagery"; // regional NASA GIBS imagery layer for a date (trends); drawn continuously, never clipped to a field

/**
 * One animated ground layer. Owned by the ground renderer (components/viewer/cesium/ground/**); written by
 * lib/twin/scenarios/ground/**. Values are 0..1 unless noted. With no real data, layers come only from the dev
 * fixture page; the real twin shows "waiting for the backend" instead.
 */
export type GroundLayerSpec = {
  id: string;
  kind: GroundLayerKind;
  /** Overall strength 0..1 (e.g. wetness amount, water level, frost cover). */
  intensity: number;
  opacity: number;
  /** Animation clock, seconds (the renderer feeds it to the material time uniform). */
  timeS?: number;
  /** Per-field strength 0..1 keyed by field id; missing = intensity. */
  byField?: Record<string, number>;
  /** Extra numeric parameters per kind (documented by the layer owner). */
  params?: Record<string, number>;
  /** Raster source when real backend data exists (zones, depth frames). */
  overlay?: GroundOverlay;
  /**
   * kind "nasaImagery" only: a NASA GIBS layer. `layerId` must come from the live GIBS capabilities document (never
   * guessed); `date` is YYYY-MM-DD; `credit` is shown on the map (e.g. "NASA Global Imagery Browse Services for EOSDIS").
   */
  imagery?: { layerId: string; date: string; credit: string };
};

export type LookFilter = "none" | "thermal" | "vegetation" | "night";

/** Camera state for share links (degrees, metres). */
export type CameraState = { lon: number; lat: number; height: number; heading: number; pitch: number };

export type GlobeProps = FarmTwinProps & {
  farms: Farm[];
  /** Highlighted farm (card open). */
  selectedId: string | null;
  /** Element that receives Cesium's credit line (attribution stays visible; set at construction). */
  creditContainer?: { current: HTMLElement | null };
  /** "globe" = free orbit of Earth; "farm" = flown in to selectedId and clamped to its radius. */
  view: GlobeView;
  reducedMotion: boolean;
  className?: string;
  onSelect(id: string | null): void;
  onReady(info: { tier: TileTier }): void;
  onError(e: Error): void;
  /** Tile streaming progress in farm view: tiles still loading (0 = settled). Throttled (~4/s). */
  onLoadProgress?(info: { pending: number }): void;
  /**
   * Dive with a film over it: skip the swing and fall and cut the camera to the farm framing once the film covers the
   * globe, so the farm tiles load while the film plays. Read when the dive begins.
   */
  quickDive?: boolean;
  /** Fired once the camera has landed in farm view (after the dive or a reset). */
  onArrive?(farmId: string): void;
};

/** Camera telemetry for the hero status bar (the hero Earth reports it). */
export type CameraTelemetry = { lon: number; lat: number; altKm: number; headingDeg: number };

/** A waypoint and its screen position (CSS px). */
export type PinHover = { id: string; x: number; y: number };

export type GlobeHandle = {
  /** Re-centre: whole Earth in "globe" view, the farm overview in "farm" view. */
  resetView(): void;
  /** Current camera (farm view), for share links. Null before the viewer is ready. */
  getCamera(): CameraState | null;
  /** Move the camera (still clamped to the farm limits). */
  setCamera(c: CameraState): void;
  /** Whole-Earth view straight over a point, instantly (hand-over from the hero Earth before a dive). */
  jumpTo(lon: number, lat: number): void;
};

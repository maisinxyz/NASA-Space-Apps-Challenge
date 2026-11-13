// Shared contract between the Cesium globe (rendering owner) and the shell/UI (product owner).
// Change only by agreement; both sides build against this file.

export type FarmTier = "twin" | "explore";

export type Farm = {
  id: string;
  name: string;
  /** Institution that operates the site. Public research/demonstration farms only, never private farms. */
  owner: string;
  country: string;
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
};

export type GlobeView = "globe" | "farm";

/** Which imagery/tiles tier actually loaded: B ion World Terrain + Bing Aerial (+ OSM Buildings), C keyless imagery. (Google tier A removed by product decision.) */
export type TileTier = "B" | "C";

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
  /** Terrain vertical exaggeration in farm view, 1 = true scale. */
  exaggeration?: number;
};

export type GlobeProps = FarmTwinProps & {
  farms: Farm[];
  /** Highlighted farm (card open). */
  selectedId: string | null;
  /** "globe" = free orbit of Earth; "farm" = flown in to selectedId and clamped to its radius. */
  view: GlobeView;
  reducedMotion: boolean;
  className?: string;
  onSelect(id: string | null): void;
  onReady(info: { tier: TileTier }): void;
  onError(e: Error): void;
};

export type GlobeHandle = {
  /** Re-centre: whole Earth in "globe" view, the farm overview in "farm" view. */
  resetView(): void;
};

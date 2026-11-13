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

/** Which imagery/tiles tier actually loaded: A Google photoreal via ion, B ion terrain + Sentinel-2, C keyless imagery. */
export type TileTier = "A" | "B" | "C";

export type GlobeProps = {
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

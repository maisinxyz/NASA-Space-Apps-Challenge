// Public API of <TwinViewer /> (PRD docs/prd/section1-web-3d.md §4.2). The A/B boundary:
// UI code imports only from "@/components/viewer" and never from viewer internals.
import type { LayerName, SimulationStatus, TerrainPackage } from "@/lib/api/types";

/**
 * Contract REQUEST R1 (PRD §4.4), NOT in openapi v1.0.0. Only ever loaded from the static mock
 * (public/mock-extras/fields.json) behind NEXT_PUBLIC_MOCK_EXTRAS=1. Do not treat as a real API shape.
 */
export interface FieldFeature {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    area_ha: number;
    illustrative_crop: string;
    data_status: "synthetic" | "derived";
  };
  /** WGS84 [lon, lat]; first ring is the outline. */
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

/** Contract layers plus the per-rotation risk grid (from RotationResult.risk; needs `sim`). */
export type ViewerLayerName = LayerName | "risk";

export type ViewerQuality = "auto" | "low" | "high";

export interface ProbeResult {
  lon: number;
  lat: number;
  /** True elevation in meters (not exaggerated). Basis follows the terrain elevation source. */
  elevation_m: number;
  /** Decoded physical layer values keyed by layer name; units are in the layer legends. Nodata is omitted. */
  layer?: Record<string, number>;
}

export interface ViewerPin {
  id: string;
  lon: number;
  lat: number;
  /** Accessible name, also the tooltip. */
  label: string;
  /** Short text drawn inside the pin (e.g. severity "4"), so color is never the only signal. */
  text?: string;
  active?: boolean;
}

/** Legend data for UI panels (the viewer draws no legend itself). */
export interface ViewerLegend {
  name: string;
  title: string;
  kind: "continuous" | "categorical" | "diverging";
  /** Empty string for categorical. */
  unit: string;
  basis: "measured" | "derived" | "modeled" | "assumed" | "relative";
  /** Physical [min, max] for continuous and diverging legends. */
  range?: [number, number];
  /** Color stops, t in 0..1 across `range`. */
  stops?: { t: number; color: string }[];
  classes?: { value: number; label: string; color: string }[];
  /** Non-color signal drawn in 3D (hatch, stripes), in plain words. */
  pattern?: string;
  note?: string;
}

export interface ViewerStats {
  fps: number;
  drawCalls: number;
  /** Measured three.js renderer resource counts; these are not bytes or a VRAM estimate. */
  memory?: { geometries: number; textures: number; programs: number };
  /** Tier actually in use ("auto" resolves to one of these). */
  tier: "low" | "high";
}

export interface TwinViewerProps {
  terrain: TerrainPackage;
  fields?: FieldFeature[];
  /** Visible overlays. Toggling never reloads data. */
  layers: ViewerLayerName[];
  selectedFieldId?: string | null;
  mode: "single" | "split";
  /** Left/only rotation first. In split mode index 0 is the left view, index 1 the right. */
  rotationIds: [string] | [string, string];
  sim?: { simId: string; results: SimulationStatus["results"] };
  /** Minutes from storm start; drives water frames. */
  timeMin: number;
  /** Peak-water-depth difference b - a for rotationIds [a, b], from /simulations/{simId}/diff. */
  showDiff: boolean;
  quality: ViewerQuality;
  reducedMotion: boolean;
  onFieldSelect(id: string | null): void;
  onProbe(p: ProbeResult | null): void;
  onReady(): void;
  onTerraformDone(): void;
  onError(e: Error): void;
  // --- additions to PRD §4.2 (logged in the PRD change log) ---
  /** Split divider position, 0..1 of the canvas width. Default 0.5. */
  divider?: number;
  /** Vertical exaggeration. Default 1.5; UI must show it as "x1.5 exaggerated". */
  exaggeration?: number;
  /** Pins anchored on the terrain (e.g. insights). Rendered as numbered DOM buttons; in split mode on the left view only. */
  pins?: ViewerPin[];
  onPinSelect?(id: string): void;
  /** Dev/perf readout, about once per second. */
  onStats?(s: ViewerStats): void;
  className?: string;
}

export type CameraPreset = "overview" | "field";

/** Imperative handle (ref) of <TwinViewer />. */
export interface TwinViewerHandle {
  /** Replay the terraform animation from the flat plane (used by demo Reset). */
  replay(): void;
  skipTerraform(): void;
  /** "field" focuses the selected field, or falls back to overview when none is selected. */
  setCameraPreset(preset: CameraPreset): void;
}

export const DEFAULT_EXAGGERATION = 1.5;

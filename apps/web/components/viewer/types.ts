// Shared viewer-side types for legends and fields (the r3f <TwinViewer /> was removed in S1-P0).
import type { LayerName } from "@/lib/api/types";

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

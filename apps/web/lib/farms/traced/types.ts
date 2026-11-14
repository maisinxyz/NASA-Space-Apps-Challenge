// Shape of the traced geometry files in this folder (RENDER output, consumed by the multi-farm config).
import type { Farm } from "@/components/globe/types";

export type TracedField = {
  /** Neutral id; PRODUCT assigns names and illustrative crops. */
  id: string;
  /** Closed ring of [lon, lat] degrees, first point not repeated. */
  ring: [number, number][];
  /** Planar area of the ring (components/viewer/cesium/trace.ts ringAreaHa), hectares. */
  areaHa: number;
};

export type TracedFarm = {
  fields: TracedField[];
  /** Simulation square [west, south, east, north] degrees (square in metres). */
  simBbox: [number, number, number, number];
  framing: NonNullable<Farm["framing"]>;
  /** Where the geometry comes from (licence/attribution) and how exact it is. */
  source: string;
};

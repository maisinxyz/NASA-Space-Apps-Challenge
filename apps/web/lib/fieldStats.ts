// Client-side stand-in for contract request R2 (per-field summary): mean of a layer inside a field polygon.
import type { Raster8 } from "@/lib/decode/layer";
import { layerValue } from "@/lib/decode/layer";

/** Ray-casting point-in-polygon on a [lon, lat] ring. */
function inside(lon: number, lat: number, ring: number[][]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Mean physical value of a continuous layer over cells whose centres fall inside `ring`.
 * shortcut: cells are placed linearly inside bbox_wgs84 (the grid is really in the projected CRS); fine at
 * field scale (~20 ha), replace with the server-side R2 summary when it ships.
 * Returns null when no valid cell is inside.
 */
export function meanInPolygon(r: Raster8, bbox: readonly number[], ring: number[][], valueRange: readonly number[]): { mean: number; cells: number } | null {
  const [w, s, e, n] = bbox;
  let sum = 0;
  let cells = 0;
  for (let row = 0; row < r.height; row++) {
    const lat = n - ((row + 0.5) / r.height) * (n - s);
    for (let col = 0; col < r.width; col++) {
      const lon = w + ((col + 0.5) / r.width) * (e - w);
      if (!inside(lon, lat, ring)) continue;
      const v = layerValue(r.data[row * r.width + col], valueRange);
      if (v === null) continue;
      sum += v;
      cells++;
    }
  }
  return cells ? { mean: sum / cells, cells } : null;
}

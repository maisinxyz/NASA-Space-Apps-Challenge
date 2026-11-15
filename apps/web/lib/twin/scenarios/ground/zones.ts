// Vulnerability-zone overlay (F2-4): rasterises Zone.outline polygons into a GroundOverlay canvas, coloured by
// terrain_factor (relative: min-max across the zones given). Pure pixel maths first; the canvas is the only DOM use.
import type { GroundOverlay } from "@/components/globe/types";
import type { Zone } from "@/lib/rotation/draft-types";

type Bbox = [number, number, number, number];
type Rgb = [number, number, number];

/** Low to high relative terrain factor. Direction (which is "worse") is not stated by the contract, so the legend says only low/high. */
export const ZONE_RAMP: { low: Rgb; high: Rgb } = { low: [64, 160, 150], high: [214, 120, 40] };
const ALPHA = 200;

/** Union bbox of all outline vertices, or null when there are none. */
export function zonesBbox(zones: Zone[]): Bbox | null {
  let b: Bbox | null = null;
  for (const z of zones)
    for (const ring of z.outline?.coordinates ?? [])
      for (const [x, y] of ring) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        b = b ? [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)] : [x, y, x, y];
      }
  return b && b[2] > b[0] && b[3] > b[1] ? b : null;
}

/** Even-odd test over all rings (holes work). */
export function inPolygon(x: number, y: number, rings: [number, number][][]): boolean {
  let inside = false;
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  return inside;
}

/** RGBA pixels, north-up, w x h over bbox. Later zones paint over earlier ones. */
export function rasteriseZones(zones: Zone[], bbox: Bbox, w: number, h: number): Uint8ClampedArray<ArrayBuffer> {
  const px = new Uint8ClampedArray(new ArrayBuffer(w * h * 4));
  const tf = zones.map((z) => z.terrain_factor).filter(Number.isFinite);
  const lo = Math.min(...tf);
  const span = Math.max(...tf) - lo;
  for (const z of zones) {
    const t = Number.isFinite(z.terrain_factor) ? (span > 0 ? (z.terrain_factor - lo) / span : 0.5) : 0.5;
    const rgb = ZONE_RAMP.low.map((c, k) => Math.round(c + (ZONE_RAMP.high[k] - c) * t));
    const rings = z.outline?.coordinates ?? [];
    for (let r = 0; r < h; r++) {
      const lat = bbox[3] - ((r + 0.5) / h) * (bbox[3] - bbox[1]);
      for (let c = 0; c < w; c++) {
        if (!inPolygon(bbox[0] + ((c + 0.5) / w) * (bbox[2] - bbox[0]), lat, rings)) continue;
        px.set([rgb[0], rgb[1], rgb[2], ALPHA], (r * w + c) * 4);
      }
    }
  }
  return px;
}

/** Overlay for the zones, or null (no zones, no outlines, or no DOM): the caller then shows nothing and raises no error. */
export function buildZoneOverlay(zones: Zone[] | undefined | null, opacity = 0.7, maxPx = 256): GroundOverlay | null {
  if (!zones?.length || typeof document === "undefined") return null;
  const bbox = zonesBbox(zones);
  if (!bbox) return null;
  // Equirectangular pixel aspect at the bbox mid-latitude.
  const aspect = ((bbox[2] - bbox[0]) * Math.cos((((bbox[1] + bbox[3]) / 2) * Math.PI) / 180)) / (bbox[3] - bbox[1]);
  const w = Math.max(2, Math.round(aspect >= 1 ? maxPx : maxPx * aspect));
  const h = Math.max(2, Math.round(aspect >= 1 ? maxPx / aspect : maxPx));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.putImageData(new ImageData(rasteriseZones(zones, bbox, w, h), w, h), 0, 0);
  return { id: "vulnerability-zones", bbox, canvas, version: 1, opacity };
}

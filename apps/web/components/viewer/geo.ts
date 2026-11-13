// Pure geometry for the viewer (no three.js, unit-tested). Local frame (PRD §4.1): origin at the terrain
// centre, +X east, +Z south, Y up in TRUE meters above elevation.min_m. Exaggeration and the terraform
// rise are one vertical scale applied by the scene, passed here as `yScale`.
import type { TerrainPackage } from "@/lib/api/types";
import type { Heightmap } from "@/lib/decode/heightmap";
import type { FieldFeature } from "./types";

export interface Frame {
  width: number;
  height: number;
  cell: number;
  /** Full raster extent in meters (pixel edges). */
  sizeX: number;
  sizeZ: number;
  bbox: readonly number[];
}

export function makeFrame(t: TerrainPackage): Frame {
  const { width, height, cell_size_m: cell } = t.grid;
  return { width, height, cell, sizeX: width * cell, sizeZ: height * cell, bbox: t.bbox_wgs84 };
}

// shortcut: linear lon/lat <-> meters over bbox_wgs84 instead of a real projection of `crs` (no proj4
// dependency). Error is far below one cell on sub-kilometer sites; upgrade if sites grow past a few km.
export function lonLatToLocal(f: Frame, lon: number, lat: number): [number, number] {
  const [w, s, e, n] = f.bbox;
  return [((lon - w) / (e - w) - 0.5) * f.sizeX, (0.5 - (lat - s) / (n - s)) * f.sizeZ];
}

export function localToLonLat(f: Frame, x: number, z: number): [number, number] {
  const [w, s, e, n] = f.bbox;
  return [w + (x / f.sizeX + 0.5) * (e - w), s + (0.5 - z / f.sizeZ) * (n - s)];
}

/** Fractional [col, row] of a local point; cell centres sit on integers. */
export function localToGrid(f: Frame, x: number, z: number): [number, number] {
  return [x / f.cell + f.width / 2 - 0.5, z / f.cell + f.height / 2 - 0.5];
}

/** Nearest cell index (row * width + col), or -1 outside the raster. */
export function cellIndex(f: Frame, x: number, z: number): number {
  const [c, r] = localToGrid(f, x, z);
  const col = Math.round(c);
  const row = Math.round(r);
  return col < 0 || row < 0 || col >= f.width || row >= f.height ? -1 : row * f.width + col;
}

/** Bilinear height above min_m, true meters. Clamps at the edges. */
export function sampleHeight(f: Frame, hm: Heightmap, x: number, z: number): number {
  const [cf, rf] = localToGrid(f, x, z);
  const c = Math.min(f.width - 1, Math.max(0, cf));
  const r = Math.min(f.height - 1, Math.max(0, rf));
  const c0 = Math.min(f.width - 2, Math.floor(c));
  const r0 = Math.min(f.height - 2, Math.floor(r));
  const fc = c - c0;
  const fr = r - r0;
  const e = hm.elevations;
  const i = r0 * f.width + c0;
  const top = e[i] + (e[i + 1] - e[i]) * fc;
  const bottom = e[i + f.width] + (e[i + f.width + 1] - e[i + f.width]) * fc;
  return top + (bottom - top) * fr - hm.minM;
}

/** Vertex positions (xyz) and uvs for the terrain grid: one vertex per cell centre, y = elevation - min_m. */
export function terrainVertices(f: Frame, hm: Heightmap): { positions: Float32Array; uvs: Float32Array; indices: Uint32Array } {
  const { width: W, height: H, cell } = f;
  const positions = new Float32Array(W * H * 3);
  const uvs = new Float32Array(W * H * 2);
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const i = r * W + c;
      positions[i * 3] = (c + 0.5 - W / 2) * cell;
      positions[i * 3 + 1] = hm.elevations[i] - hm.minM;
      positions[i * 3 + 2] = (r + 0.5 - H / 2) * cell;
      uvs[i * 2] = (c + 0.5) / W;
      uvs[i * 2 + 1] = (r + 0.5) / H;
    }
  }
  const indices = new Uint32Array((W - 1) * (H - 1) * 6);
  let k = 0;
  for (let r = 0; r < H - 1; r++) {
    for (let c = 0; c < W - 1; c++) {
      const a = r * W + c;
      indices[k++] = a;
      indices[k++] = a + W;
      indices[k++] = a + 1;
      indices[k++] = a + 1;
      indices[k++] = a + W;
      indices[k++] = a + W + 1;
    }
  }
  return { positions, uvs, indices };
}

/**
 * First hit of a ray on the heightfield (world y = height * yScale), by marching then bisecting.
 * Returns local x, z and the TRUE height above min_m, or null when the ray misses the terrain.
 */
export function pickHeightfield(
  f: Frame,
  hm: Heightmap,
  yScale: number,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
): { x: number; z: number; height: number } | null {
  const hx = f.sizeX / 2 - f.cell / 2;
  const hz = f.sizeZ / 2 - f.cell / 2;
  const horiz = Math.hypot(dx, dz);
  const step = horiz > 1e-6 ? (f.cell * 0.5) / horiz : f.cell * 0.5;
  const maxT = (Math.hypot(ox, oz) + Math.hypot(f.sizeX, f.sizeZ)) / Math.max(horiz, 1e-3) + Math.abs(oy);
  const above = (t: number) => oy + dy * t - sampleHeight(f, hm, ox + dx * t, oz + dz * t) * yScale;
  const inside = (t: number) => Math.abs(ox + dx * t) <= hx && Math.abs(oz + dz * t) <= hz;
  let prev = 0;
  for (let t = step; t < maxT; t += step) {
    if (inside(t) && above(t) <= 0) {
      if (!inside(prev)) prev = t - step; // entered through a side wall: accept the first inside sample
      let lo = prev;
      let hi = t;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        if (inside(mid) && above(mid) <= 0) hi = mid;
        else lo = mid;
      }
      const x = ox + dx * hi;
      const z = oz + dz * hi;
      return { x, z, height: sampleHeight(f, hm, x, z) };
    }
    prev = t;
  }
  return null;
}

export type Ring = [number, number][];

export function pointInRing(ring: Ring, x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export interface LocalField {
  id: string;
  crop: string;
  /** Outer ring in local meters [x, z]. */
  ring: Ring;
  centroid: [number, number];
  /** Largest distance from the centroid to a vertex, meters. */
  radius: number;
}

export function toLocalFields(f: Frame, fields: FieldFeature[]): LocalField[] {
  return fields.map((feat) => {
    const ring = feat.geometry.coordinates[0].map(([lon, lat]) => lonLatToLocal(f, lon, lat));
    if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const radius = Math.max(...ring.map((p) => Math.hypot(p[0] - cx, p[1] - cz)));
    return { id: feat.properties.id, crop: feat.properties.illustrative_crop, ring, centroid: [cx, cz], radius };
  });
}

/** Index of the field containing a local point, or -1. */
export function fieldAt(fields: LocalField[], x: number, z: number): number {
  return fields.findIndex((fl) => pointInRing(fl.ring, x, z));
}

function segmentDistance(px: number, pz: number, a: readonly number[], b: readonly number[]): number {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.min(1, Math.max(0, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t);
}

/** Outlines are drawn within this many meters of a field edge; the distance raster saturates here. */
export const FIELD_EDGE_RANGE_M = 8;

/**
 * Field rasters (res x res, row 0 = north) that drape the polygons on the terrain in the shader:
 * `ids` RG bytes = [field containing the pixel, field owning the nearest edge] (0 = none, k = fields[k - 1]);
 * `distance` byte = distance to the nearest field edge, 0..255 over 0..FIELD_EDGE_RANGE_M.
 */
export function rasterizeFields(f: Frame, fields: LocalField[], res: number): { ids: Uint8Array; distance: Uint8Array } {
  const ids = new Uint8Array(res * res * 2);
  const distance = new Uint8Array(res * res).fill(255);
  const px = (v: number, size: number) => (v / size + 0.5) * res - 0.5;
  fields.slice(0, 254).forEach((fl, k) => {
    const xs = fl.ring.map((p) => p[0]);
    const zs = fl.ring.map((p) => p[1]);
    const pad = FIELD_EDGE_RANGE_M;
    const c0 = Math.max(0, Math.floor(px(Math.min(...xs) - pad, f.sizeX)));
    const c1 = Math.min(res - 1, Math.ceil(px(Math.max(...xs) + pad, f.sizeX)));
    const r0 = Math.max(0, Math.floor(px(Math.min(...zs) - pad, f.sizeZ)));
    const r1 = Math.min(res - 1, Math.ceil(px(Math.max(...zs) + pad, f.sizeZ)));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const x = ((c + 0.5) / res - 0.5) * f.sizeX;
        const z = ((r + 0.5) / res - 0.5) * f.sizeZ;
        const i = r * res + c;
        if (pointInRing(fl.ring, x, z)) ids[i * 2] = k + 1;
        let d = Infinity;
        for (let e = 0; e < fl.ring.length; e++) d = Math.min(d, segmentDistance(x, z, fl.ring[e], fl.ring[(e + 1) % fl.ring.length]));
        const byte = Math.min(255, Math.round((d / FIELD_EDGE_RANGE_M) * 255));
        if (byte < distance[i]) {
          distance[i] = byte;
          ids[i * 2 + 1] = k + 1;
        }
      }
    }
  });
  return { ids, distance };
}

/**
 * Crop-row sample points [x, z, ...] inside a ring: east-west rows `rowSpacing` apart, a point every
 * `step` meters. The step grows so the count never exceeds `cap` (quality tier budget). Deterministic.
 */
export function cropRowPoints(ring: Ring, rowSpacing: number, step: number, cap: number): { points: Float32Array; step: number } {
  const xs = ring.map((p) => p[0]);
  const zs = ring.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  for (let s = step; ; s *= 1.5) {
    const pts: number[] = [];
    for (let z = z0 + rowSpacing / 2; z < z1 && pts.length / 2 <= cap; z += rowSpacing) {
      for (let x = x0 + s / 2; x < x1; x += s) if (pointInRing(ring, x, z)) pts.push(x, z);
    }
    if (pts.length / 2 <= cap) return { points: new Float32Array(pts), step: s };
  }
}

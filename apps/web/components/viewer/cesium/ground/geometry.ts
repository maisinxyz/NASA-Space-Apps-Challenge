// Pure geometry helpers for the ground renderer (no Cesium, no DOM): bbox uv, mask rings, field raster.
export type Bbox = readonly [number, number, number, number]; // [west, south, east, north] degrees
export type Ring = readonly (readonly [number, number])[]; // [lon, lat]

/** Max fields the shader can slot individually. */
export const MAX_FIELDS = 8;

/**
 * lon/lat -> [u, v] in 0..1 over bbox. u: west->east, v: SOUTH->NORTH, the same orientation as Cesium's
 * GroundPrimitive `materialInput.st` (st.y grows northwards) and as row order of the baked textures (row 0 = south).
 */
export function lonLatToUv(bbox: Bbox, lon: number, lat: number): [number, number] {
  const [w, s, e, n] = bbox;
  return [(lon - w) / (e - w), (lat - s) / (n - s)];
}

const ringBbox = (r: Ring): Bbox => {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of r) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return [w, s, e, n];
};

/** Mask rings whose bounding box intersects bbox (cheap test; clip them with clipRingToBbox before use). */
export function ringsInBbox(rings: readonly Ring[], bbox: Bbox): Ring[] {
  return rings.filter((r) => {
    if (r.length < 3) return false;
    const [w, s, e, n] = ringBbox(r);
    return w <= bbox[2] && e >= bbox[0] && s <= bbox[3] && n >= bbox[1];
  });
}

/** Even-odd point in ring test. */
export function pointInRing(ring: Ring, lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Sutherland-Hodgman clip of a ring to bbox. Fewer than 3 points back = nothing inside. */
export function clipRingToBbox(ring: Ring, bbox: Bbox): [number, number][] {
  const [w, s, e, n] = bbox;
  type P = [number, number];
  const edges: { inside: (p: P) => boolean; cut: (a: P, b: P) => P }[] = [
    { inside: (p) => p[0] >= w, cut: (a, b) => [w, a[1] + ((b[1] - a[1]) * (w - a[0])) / (b[0] - a[0])] },
    { inside: (p) => p[0] <= e, cut: (a, b) => [e, a[1] + ((b[1] - a[1]) * (e - a[0])) / (b[0] - a[0])] },
    { inside: (p) => p[1] >= s, cut: (a, b) => [a[0] + ((b[0] - a[0]) * (s - a[1])) / (b[1] - a[1]), s] },
    { inside: (p) => p[1] <= n, cut: (a, b) => [a[0] + ((b[0] - a[0]) * (n - a[1])) / (b[1] - a[1]), n] },
  ];
  let out: P[] = ring.map((p) => [p[0], p[1]]);
  for (const { inside, cut } of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i];
      const b = input[(i + 1) % input.length];
      if (inside(b)) {
        if (!inside(a)) out.push(cut(a, b));
        out.push(b);
      } else if (inside(a)) out.push(cut(a, b));
    }
    if (!out.length) break;
  }
  return out;
}

/**
 * Field index raster, size x size, row 0 = south (v = 0). 0 = outside every field, i+1 = field i (later fields win
 * overlaps). Only the first MAX_FIELDS fields are rasterised (extra ones are ignored, never throw).
 */
export function rasterizeFieldIndex(fields: readonly { ring: Ring }[], bbox: Bbox, size: number): Uint8Array {
  const out = new Uint8Array(size * size);
  const [w, s, e, n] = bbox;
  fields.slice(0, MAX_FIELDS).forEach((f, i) => {
    if (f.ring.length < 3) return;
    const [fw, fs, fe, fn] = ringBbox(f.ring);
    const x0 = Math.max(0, Math.floor(((fw - w) / (e - w)) * size));
    const x1 = Math.min(size - 1, Math.ceil(((fe - w) / (e - w)) * size));
    const y0 = Math.max(0, Math.floor(((fs - s) / (n - s)) * size));
    const y1 = Math.min(size - 1, Math.ceil(((fn - s) / (n - s)) * size));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const lon = w + ((x + 0.5) / size) * (e - w);
        const lat = s + ((y + 0.5) / size) * (n - s);
        if (pointInRing(f.ring, lon, lat)) out[y * size + x] = i + 1;
      }
  });
  return out;
}

/**
 * Split an index raster into RGBA coverage planes (3 slots per plane in R,G,B; A = 255 so canvases never premultiply).
 * Plane p holds fields 3p..3p+2. Coverage planes survive LINEAR texture filtering (an index would not).
 */
export function indexToCoverage(index: Uint8Array, plane: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(index.length * 4);
  for (let i = 0; i < index.length; i++) {
    const slot = index[i] - 1;
    const c = slot - plane * 3;
    if (slot >= 0 && c >= 0 && c < 3) out[i * 4 + c] = 255;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/**
 * Normalise a heights grid (row 0 = south, metres) to RGBA: R = height 0..1, G/B = downhill direction in uv space
 * (0.5 = none, scaled so the steepest cell is 0/1). Flat or tiny relief (< 0.5 m) gives mid-grey so low-spot layers spread evenly.
 */
export function heightsToRgba(heights: ArrayLike<number>, n: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(n * n * 4);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < heights.length; i++) {
    lo = Math.min(lo, heights[i]);
    hi = Math.max(hi, heights[i]);
  }
  const flat = !(hi - lo >= 0.5);
  const h = (x: number, y: number) => heights[Math.min(n - 1, Math.max(0, y)) * n + Math.min(n - 1, Math.max(0, x))];
  const gx = new Float32Array(n * n);
  const gy = new Float32Array(n * n);
  let gmax = 1e-6;
  if (!flat)
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const dx = -(h(x + 1, y) - h(x - 1, y));
        const dy = -(h(x, y + 1) - h(x, y - 1));
        gx[y * n + x] = dx;
        gy[y * n + x] = dy;
        gmax = Math.max(gmax, Math.hypot(dx, dy));
      }
  for (let i = 0; i < n * n; i++) {
    out[i * 4] = flat ? 128 : ((heights[i] - lo) / (hi - lo)) * 255;
    out[i * 4 + 1] = flat ? 128 : 127.5 + (gx[i] / gmax) * 127.5;
    out[i * 4 + 2] = flat ? 128 : 127.5 + (gy[i] / gmax) * 127.5;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Change key for the baked textures / primitive: bbox, surface, field ids+rings, mask (count + sampled coordinates). */
export function bakeKey(bbox: Bbox, surface: string, fields: readonly { id: string; ring: Ring }[], mask: readonly Ring[] | undefined): string {
  const f = fields.map((x) => `${x.id}:${x.ring.length}:${x.ring[0]?.join(",") ?? ""}`).join("|");
  const m = mask?.length ? `${mask.length}:${mask[0][0]?.join(",")}:${mask[mask.length - 1][0]?.join(",")}` : "0";
  return `${bbox.join(",")};${surface};${f};${m}`;
}

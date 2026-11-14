// NASA GIBS (Global Imagery Browse Services) WMTS helpers. Ids, matrix sets and formats are INPUTS taken from the
// live capabilities document, never guessed.
// Sources (verified 2026-11 on https://nasa-gibs.github.io/gibs-api-docs/access-basics/):
//   REST base (EPSG:3857): https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/
//   REST tile pattern:     {base}{LayerIdentifier}/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.{FormatExt}
//   Capabilities (REST):   https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml
// We use EPSG:3857 because Cesium's WebMapTileServiceImageryProvider defaults to a Web Mercator tiling scheme.
export const GIBS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/";
export const GIBS_CAPABILITIES_URL = `${GIBS_BASE}1.0.0/WMTSCapabilities.xml`;

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpeg", "image/jpg": "jpeg" };
/** File extension for a WMTS Format (image/png -> png, image/jpeg -> jpeg (GIBS ResourceURL templates end in .jpeg)). Unknown formats use the subtype. */
export const formatExt = (format: string) => EXT[format.toLowerCase()] ?? format.split("/")[1] ?? format;

/** REST url template for the imagery provider; {TileMatrix}/{TileRow}/{TileCol} stay for Cesium to fill. */
export function buildGibsTemplate(i: { base: string; layerId: string; tileMatrixSet: string; format: string; date: string }): string {
  const base = i.base.endsWith("/") ? i.base : `${i.base}/`;
  return `${base}${i.layerId}/default/${i.date}/${i.tileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.${formatExt(i.format)}`;
}

export type GibsLayer = {
  id: string;
  tileMatrixSets: string[];
  formats: string[];
  /** Time dimension, if the layer has one: default date and the ranges/values as listed (e.g. "2000-02-24/2025-11-12/P1D"). */
  time?: { default: string; ranges: string[] };
  /** Highest zoom level (TileMatrix count - 1) of each of the layer's tile matrix sets. */
  maxLevels: Record<string, number>;
};

const T = (name: string) => new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, "g");
const all = (xml: string, name: string) => [...xml.matchAll(T(name))].map((m) => m[1].trim());
const first = (xml: string, name: string) => all(xml, name)[0];

/**
 * Pure parser for a WMTS 1.0 capabilities document (Contents > Layer / TileMatrixSet). It is a tolerant tag scanner
 * (the same text works in the browser and in Node tests; DOMParser is not available in the Vitest node environment).
 */
export function parseGibsCapabilities(xml: string): GibsLayer[] {
  const layerBlocks = [...xml.matchAll(/<(?:\w+:)?Layer\b[^>]*>[\s\S]*?<\/(?:\w+:)?Layer>/g)].map((m) => m[0]);
  const levels: Record<string, number> = {};
  for (const set of all(xml.replace(/<(?:\w+:)?Layer\b[\s\S]*?<\/(?:\w+:)?Layer>/g, ""), "TileMatrixSet")) {
    const id = first(set.replace(/<(?:\w+:)?TileMatrix\b[\s\S]*?<\/(?:\w+:)?TileMatrix>/g, ""), "Identifier");
    if (id) levels[id] = Math.max(0, (set.match(/<(?:\w+:)?TileMatrix>/g)?.length ?? 1) - 1);
  }
  return layerBlocks.flatMap((block) => {
    const dim = first(block, "Dimension");
    const rest = block.replace(T("Dimension"), "");
    const id = first(rest, "Identifier");
    if (!id) return [];
    const sets = all(rest, "TileMatrixSetLink").map((l) => first(l, "TileMatrixSet")).filter(Boolean);
    const layer: GibsLayer = {
      id,
      tileMatrixSets: sets,
      formats: all(rest, "Format"),
      maxLevels: Object.fromEntries(sets.filter((s) => s in levels).map((s) => [s, levels[s]])),
    };
    if (dim && /time/i.test(first(dim, "Identifier") ?? "")) layer.time = { default: first(dim, "Default") ?? "", ranges: all(dim, "Value") };
    return [layer];
  });
}

const cache = new Map<string, Promise<GibsLayer[]>>();
/** Fetch + parse once per url (cached, also on failure it is dropped so a later call can retry). */
export function fetchGibsCapabilities(url: string = GIBS_CAPABILITIES_URL): Promise<GibsLayer[]> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`GIBS capabilities ${r.status}`);
        return r.text();
      })
      .then(parseGibsCapabilities);
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

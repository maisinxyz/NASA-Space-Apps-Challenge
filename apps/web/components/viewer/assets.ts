// Fetch + decode + upload. Everything a view needs is loaded once here; later toggles only flip uniforms.
import * as THREE from "three";
import { assetUrl, diffImageUrl, fetchAsset, getLayers } from "@/lib/api/client";
import type { LayerCatalog, RotationResult, TerrainPackage } from "@/lib/api/types";
import { parseFtw1 } from "@/lib/decode/ftw1";
import { decodeHeightmap, type Heightmap } from "@/lib/decode/heightmap";
import { decodeGray8, NODATA, type Raster8 } from "@/lib/decode/layer";
import { decodeNormalMap } from "@/lib/decode/normal";
import { type Frame, makeFrame, terrainVertices } from "./geo";
import { isCoarseImagery } from "./legends";
import { buildLut, LAYER_ORDER, LUT_ROWS } from "./luts";
import { ResourceScope } from "./resources";
import { downsampleFrames } from "./timing";

/** Meters of soil wall drawn below the lowest point so the terrain reads as a solid block. */
export const BASE_DEPTH_M = 3;

function dataTexture(data: Uint8Array, width: number, height: number, format: THREE.PixelFormat, filter: THREE.MagnificationTextureFilter, srgb = false): THREE.DataTexture {
  const t = new THREE.DataTexture(data, width, height, format, THREE.UnsignedByteType);
  t.magFilter = filter;
  t.minFilter = filter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.unpackAlignment = 1; // single-channel rows are not 4-byte aligned
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

const grayTexture = (r: Raster8, filter: THREE.MagnificationTextureFilter) => dataTexture(r.data, r.width, r.height, THREE.RedFormat, filter);

export interface TerrainAssets {
  frame: Frame;
  heightmap: Heightmap;
  /** max_m - min_m, true meters. */
  relief: number;
  geometry: THREE.BufferGeometry;
  skirt: THREE.BufferGeometry;
  imagery: THREE.Texture;
  normal: THREE.Texture;
  layers: THREE.Texture;
  /** RGBA-packed layer bytes in LAYER_ORDER, for probe readouts. */
  layerBytes: Uint8Array;
  catalog: LayerCatalog;
  lut: THREE.Texture;
  coarse: boolean;
  dispose(): void;
}

function skirtGeometry(frame: Frame, positions: Float32Array): THREE.BufferGeometry {
  const { width: W, height: H } = frame;
  const border: number[] = [];
  for (let c = 0; c < W; c++) border.push(c);
  for (let r = 1; r < H; r++) border.push(r * W + W - 1);
  for (let c = W - 2; c >= 0; c--) border.push((H - 1) * W + c);
  for (let r = H - 2; r >= 0; r--) border.push(r * W);
  const v: number[] = [];
  for (let i = 0; i < border.length; i++) {
    const a = border[i] * 3;
    const b = border[(i + 1) % border.length] * 3;
    const [ax, ay, az, bx, by, bz] = [positions[a], positions[a + 1], positions[a + 2], positions[b], positions[b + 1], positions[b + 2]];
    v.push(ax, ay, az, bx, by, bz, ax, -BASE_DEPTH_M, az, bx, by, bz, bx, -BASE_DEPTH_M, bz, ax, -BASE_DEPTH_M, az);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export async function loadTerrainAssets(terrain: TerrainPackage): Promise<TerrainAssets> {
  const owned = new ResourceScope();
  try {
    const frame = makeFrame(terrain);
    const [heightPng, normalPng, imagery, catalog] = await Promise.all([
      fetchAsset(terrain.assets.heightmap),
      fetchAsset(terrain.assets.normal_map),
      new THREE.TextureLoader().loadAsync(assetUrl(terrain.assets.texture)).then((texture) => owned.own(texture)),
      getLayers(terrain.id),
    ]);
    const heightmap = decodeHeightmap(heightPng, terrain.elevation.min_m, terrain.elevation.max_m);
    if (heightmap.width !== frame.width || heightmap.height !== frame.height) throw new Error("Heightmap size does not match TerrainPackage.grid.");

    const { positions, uvs, indices } = terrainVertices(frame, heightmap);
    const geometry = owned.own(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    // Placeholder vertex normals (lighting uses normal.png in the fragment shader).
    const up = new Float32Array(positions.length);
    for (let i = 1; i < up.length; i += 3) up[i] = 1;
    geometry.setAttribute("normal", new THREE.BufferAttribute(up, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    imagery.colorSpace = THREE.SRGBColorSpace;
    imagery.flipY = false; // row 0 = north at v = 0, like every raster
    imagery.anisotropy = 8;
    imagery.needsUpdate = true;

    const n = decodeNormalMap(normalPng);
    const normal = owned.own(dataTexture(n.rgba, n.width, n.height, THREE.RGBAFormat, THREE.LinearFilter));

    const cells = frame.width * frame.height;
    const layerBytes = new Uint8Array(cells * 4).fill(NODATA);
    await Promise.all(
      LAYER_ORDER.map(async (name, k) => {
        const legend = catalog.layers.find((l) => l.name === name);
        if (!legend) return;
        const r = decodeGray8(await fetchAsset(legend.url));
        if (r.data.length !== cells) throw new Error(`Layer ${name} size does not match the terrain grid.`);
        for (let i = 0; i < cells; i++) layerBytes[i * 4 + k] = r.data[i];
      }),
    );
    // Nearest: bytes are lookup indices (nodata 255, class ids), blending them would invent values.
    const layers = owned.own(dataTexture(layerBytes, frame.width, frame.height, THREE.RGBAFormat, THREE.NearestFilter));
    const lut = owned.own(dataTexture(buildLut(catalog.layers), 256, LUT_ROWS, THREE.RGBAFormat, THREE.NearestFilter, true));
    const skirt = owned.own(skirtGeometry(frame, positions));

    return {
      frame,
      heightmap,
      relief: heightmap.maxM - heightmap.minM,
      geometry,
      skirt,
      imagery,
      normal,
      layers,
      layerBytes,
      catalog,
      lut,
      coarse: isCoarseImagery(terrain),
      dispose() {
        owned.dispose();
      },
    };
  } catch (error) {
    owned.dispose();
    throw error;
  }
}

export interface RotationAssets {
  water: THREE.Data3DTexture;
  frameCount: number;
  frameTimes: number[];
  maxDepthMm: number;
  risk: THREE.Texture;
  riskBytes: Uint8Array;
  dispose(): void;
}

/** Frames become ONE 3D texture; linear filtering along depth is the frame-to-frame interpolation. */
export async function loadRotationAssets(result: RotationResult, lowTier: boolean): Promise<RotationAssets> {
  const [bin, riskPng] = await Promise.all([fetchAsset(result.frames), fetchAsset(result.risk)]);
  const f = parseFtw1(bin);
  const grid = lowTier && f.width >= 128 ? downsampleFrames(f.frames, f.width, f.height, f.frameCount) : f;
  const riskRaster = decodeGray8(riskPng);
  const water = new THREE.Data3DTexture(grid.frames, grid.width, grid.height, f.frameCount);
  water.format = THREE.RedFormat;
  water.type = THREE.UnsignedByteType;
  water.minFilter = water.magFilter = THREE.LinearFilter;
  water.wrapS = water.wrapT = water.wrapR = THREE.ClampToEdgeWrapping;
  water.unpackAlignment = 1;
  water.needsUpdate = true;
  const risk = grayTexture(riskRaster, THREE.NearestFilter);
  return {
    water,
    frameCount: f.frameCount,
    frameTimes: result.frame_times_min,
    maxDepthMm: f.maxDepthMm,
    risk,
    riskBytes: riskRaster.data,
    dispose() {
      water.dispose();
      risk.dispose();
    },
  };
}

export async function loadDiffTexture(simId: string, a: string, b: string): Promise<THREE.Texture> {
  const res = await fetch(diffImageUrl(simId, a, b), { headers: { Accept: "image/png" } });
  if (!res.ok) throw new Error(`Difference grid for ${a} vs ${b} is not available (${res.status}).`);
  return grayTexture(decodeGray8(await res.arrayBuffer()), THREE.LinearFilter);
}

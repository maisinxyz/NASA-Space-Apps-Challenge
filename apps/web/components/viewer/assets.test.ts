import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAsset, getLayers } from "@/lib/api/client";
import type { LayerCatalog, TerrainPackage } from "@/lib/api/types";
import { loadTerrainAssets } from "./assets";

vi.mock("@/lib/api/client", () => ({
  assetUrl: (url: string) => url,
  diffImageUrl: vi.fn(),
  fetchAsset: vi.fn(),
  getLayers: vi.fn(),
}));
const fixtures = resolve(__dirname, "../../../../packages/contracts/fixtures");
const terrain = JSON.parse(readFileSync(resolve(fixtures, "terrain/terr_mock_tilted/terrain.json"), "utf8")) as TerrainPackage;
const catalog = JSON.parse(readFileSync(resolve(fixtures, "terrain/terr_mock_tilted/layers.json"), "utf8")) as LayerCatalog;

beforeEach(() => {
  vi.mocked(fetchAsset).mockImplementation(async (url) => Uint8Array.from(readFileSync(resolve(fixtures, url.replace("/api/v1/", "")))).buffer);
  vi.mocked(getLayers).mockResolvedValue(catalog);
});
afterEach(() => vi.restoreAllMocks());

describe("terrain asset ownership on load failure", () => {
  it("disposes imagery even when it arrives after a sibling request failed", async () => {
    let finishImage!: (image: THREE.Texture<HTMLImageElement>) => void;
    vi.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockImplementation(() => new Promise((resolve) => { finishImage = resolve; }));
    vi.mocked(fetchAsset).mockRejectedValueOnce(new Error("heightmap unavailable"));
    await expect(loadTerrainAssets(terrain)).rejects.toThrow("heightmap unavailable");
    const image = new THREE.Texture<HTMLImageElement>();
    const dispose = vi.spyOn(image, "dispose");
    finishImage(image);
    await Promise.resolve();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes allocated mesh, normal and imagery if a later overlay fails", async () => {
    const image = new THREE.Texture<HTMLImageElement>();
    vi.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockResolvedValue(image);
    const textureDisposal = vi.spyOn(THREE.Texture.prototype, "dispose");
    const geometryDisposal = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const validFetch = vi.mocked(fetchAsset).getMockImplementation()!;
    vi.mocked(fetchAsset).mockImplementation((url) => url.includes("/layers/slope.png") ? Promise.reject(new Error("overlay unavailable")) : validFetch(url));
    await expect(loadTerrainAssets(terrain)).rejects.toThrow("overlay unavailable");
    expect(textureDisposal).toHaveBeenCalledTimes(2);
    expect(geometryDisposal).toHaveBeenCalledTimes(1);
  });

  it("successful asset bundles release each resource once even on repeated cleanup", async () => {
    vi.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockResolvedValue(new THREE.Texture<HTMLImageElement>());
    const textureDisposal = vi.spyOn(THREE.Texture.prototype, "dispose");
    const geometryDisposal = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const assets = await loadTerrainAssets(terrain);
    expect(textureDisposal).not.toHaveBeenCalled();
    assets.dispose();
    assets.dispose();
    expect(textureDisposal).toHaveBeenCalledTimes(4);
    expect(geometryDisposal).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it, vi } from "vitest";
import { Rectangle } from "cesium";
import { compositeTiles, createImageryMaterial, setImageryOpacity } from "./index";

describe("Google imagery compositing", () => {
  it("rejects when a tile is unavailable instead of returning a blank composite", async () => {
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }) };
    vi.stubGlobal("document", { createElement: () => canvas });
    const provider = {
      tilingScheme: {
        positionToTileXY: () => ({ x: 0, y: 0 }),
        tileXYToRectangle: () => Rectangle.fromDegrees(0, 0, 1, 1),
      },
      requestImage: () => undefined,
    };
    await expect(compositeTiles(provider as never, Rectangle.fromDegrees(0, 0, 1, 1), 0)).rejects.toThrow("GIBS tile unavailable");
    vi.unstubAllGlobals();
  });
});


it("applies imagery opacity through the Image material color", () => {
  for (const name of ["HTMLCanvasElement", "HTMLImageElement", "ImageBitmap", "OffscreenCanvas"]) vi.stubGlobal(name, class {});
  const material = createImageryMaterial("image.png", 0.4);
  expect(material.uniforms.color.alpha).toBe(0.4);
  expect(material.isTranslucent()).toBe(true);
  setImageryOpacity(material, 0.8);
  expect(material.uniforms.color.alpha).toBe(0.8);
  vi.unstubAllGlobals();
});

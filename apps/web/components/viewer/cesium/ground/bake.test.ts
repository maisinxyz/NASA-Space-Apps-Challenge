import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), sample: vi.fn() }));
vi.mock("cesium", () => ({
  Cartographic: { fromDegrees: (lon: number, lat: number) => ({ lon, lat }) },
  createWorldTerrainAsync: mocks.create,
  sampleTerrainMostDetailed: mocks.sample,
}));

import { bakeCoverage, COVER_PX, heightCanvas, HEIGHT_PX, sampleHeights } from "./bake";

beforeEach(() => {
  mocks.create.mockReset().mockResolvedValue({});
  mocks.sample.mockReset();
});

describe("terrain height baking", () => {
  it("samples the full grid south to north and rejects tile failures", async () => {
    mocks.sample.mockImplementation(async (_terrain, points) => points.map((p: object) => ({ ...p, height: 12 })));
    const result = await sampleHeights([0, 10, 1, 11]);
    expect(result).toHaveLength(HEIGHT_PX * HEIGHT_PX);
    expect(result?.[0]).toBe(12);
    const [, points, rejectOnTileFail] = mocks.sample.mock.calls[0];
    expect(points[0].lat).toBeLessThan(points[points.length - 1].lat);
    expect(rejectOnTileFail).toBe(true);
    expect(COVER_PX).toBe(512);
  });

  it("rejects missing samples and warns once", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.sample.mockImplementationOnce(async (_terrain, points) => points.map((p: object, i: number) => ({ ...p, height: i ? 12 : undefined })));
    expect(await sampleHeights([0, 0, 1, 1])).toBeNull();
    mocks.create.mockRejectedValueOnce(new Error("secret-token"));
    expect(await sampleHeights([0, 0, 1, 1])).toBeNull();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0][0]).toContain("missing or invalid samples");
    expect(JSON.stringify(warning.mock.calls)).not.toContain("secret-token");
    warning.mockRestore();
  });
});


describe("safe failure diagnostics", () => {
  it("reports provider initialization and status without leaking error data", async () => {
    vi.resetModules();
    const { sampleHeights: sample } = await import("./bake");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.create.mockRejectedValueOnce(Object.assign(new Error("secret-token https://example.test/?token=secret"), { statusCode: 403 }));
    expect(await sample([0, 0, 1, 1])).toBeNull();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("provider initialization failed (Error, HTTP 403)"));
    expect(JSON.stringify(warning.mock.calls)).not.toMatch(/secret|https/);
    warning.mockRestore();
  });

  it("identifies a grid sampling failure", async () => {
    vi.resetModules();
    const { sampleHeights: sample } = await import("./bake");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.sample.mockRejectedValueOnce(new TypeError("secret-token"));
    expect(await sample([0, 0, 1, 1])).toBeNull();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("grid sampling failed (TypeError)"));
    expect(JSON.stringify(warning.mock.calls)).not.toContain("secret-token");
    warning.mockRestore();
  });
});


it("writes north-first canvases while retaining south-first height gradient directions", () => {
  const images: Uint8ClampedArray[] = [];
  vi.stubGlobal("ImageData", class { constructor(public data: Uint8ClampedArray) {} });
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ putImageData: (image: { data: Uint8ClampedArray }) => images.push(image.data) }) }) });
  try {
    bakeCoverage([{ ring: [[0, 0], [1, 0], [1, 0.5], [0, 0.5]] }], [0, 0, 1, 1]);
    expect(images[0][0]).toBe(0);
    expect(images[0][(COVER_PX - 1) * COVER_PX * 4]).toBe(255);
    const heights = Float64Array.from({ length: HEIGHT_PX * HEIGHT_PX }, (_, i) => Math.floor(i / HEIGHT_PX));
    heightCanvas(heights);
    const image = images[3];
    expect(image[0]).toBe(255);
    expect(image[(HEIGHT_PX - 1) * HEIGHT_PX * 4]).toBe(0);
    expect(image[Math.floor(HEIGHT_PX / 2) * HEIGHT_PX * 4 + 2]).toBeLessThan(128); // elevation rises north, so downhill remains south
  } finally { vi.unstubAllGlobals(); }
});

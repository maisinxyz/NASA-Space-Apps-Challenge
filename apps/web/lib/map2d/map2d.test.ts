import { describe, expect, it } from "vitest";

import { selectFarm, useAppStore } from "@/lib/store";

import { boxAround, clearCamera, closeRing, ringAreaHa, saveCamera, savedCamera } from "./geo";
import { imageryFor, IMAGERY } from "./imagery";

describe("2D map helpers", () => {
  it("first-open box is about 3 km by 3 km", () => {
    const [[w, s], [e, n]] = boxAround(-123.236786, 49.249786, 3000);
    const widthM = (e - w) * 111_320 * Math.cos((49.25 * Math.PI) / 180);
    const heightM = (n - s) * 110_574;
    expect(widthM).toBeGreaterThan(2900);
    expect(widthM).toBeLessThan(3100);
    expect(heightM).toBeGreaterThan(2900);
    expect(heightM).toBeLessThan(3100);
  });

  it("measures a drawn field and closes its ring", () => {
    // ~51 m x ~56 m box near UBC Farm (Appendix A.3 example)
    const pts: [number, number][] = [[-123.2375, 49.2498], [-123.2368, 49.2498], [-123.2368, 49.2503], [-123.2375, 49.2503]];
    const ha = ringAreaHa(pts);
    expect(ha).toBeGreaterThan(0.25);
    expect(ha).toBeLessThan(0.35);
    const ring = closeRing(pts);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring).toHaveLength(5);
  });

  it("remembers each farm's camera", () => {
    saveCamera("ubc-farm", { center: [1, 2], zoom: 15, bearing: 0, pitch: 0 });
    expect(savedCamera("ubc-farm")?.zoom).toBe(15);
    expect(savedCamera("kpu-langley")).toBeNull();
    clearCamera("ubc-farm");
    expect(savedCamera("ubc-farm")).toBeNull();
  });

  it("has 2022 imagery with attribution for both demo farms only", () => {
    expect(Object.keys(IMAGERY).sort()).toEqual(["kpu-langley", "ubc-farm"]);
    expect(imageryFor("ubc-farm")?.attribution).toBe("City of Vancouver 2022 Orthophoto Imagery");
    expect(imageryFor("kpu-langley")?.tiles).toContain("{bbox-epsg-3857}");
    expect(imageryFor("usda-barc")).toBeNull();
    for (const i of Object.values(IMAGERY)) expect(i.year).toBe(2022);
  });

  it("closes the 2D map when another farm is picked", () => {
    selectFarm("ubc-farm");
    useAppStore.setState({ map2d: true });
    selectFarm("kpu-langley");
    expect(useAppStore.getState().map2d).toBe(false);
  });
});

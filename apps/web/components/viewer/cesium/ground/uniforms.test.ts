import { describe, expect, it } from "vitest";

import type { GroundLayerSpec } from "@/components/globe/types";

import { setAnchor, getAnchor, subscribeAnchor } from "./anchor";
import { layersToUniforms } from "./uniforms";

const L = (p: Partial<GroundLayerSpec> & Pick<GroundLayerSpec, "kind">): GroundLayerSpec => ({ id: p.kind, intensity: 0.5, opacity: 1, ...p });

describe("layersToUniforms", () => {
  it("no layers: nothing, inactive", () => {
    const u = layersToUniforms([], ["a"], "medium", false);
    expect(u.anyProcedural).toBe(false);
    expect(u.active).toBe(false);
  });
  it("clamps intensity/opacity and maps params", () => {
    const u = layersToUniforms([L({ kind: "water", intensity: 3, opacity: -1, params: { lowSpotOnly: 0, ripples: 2 } })], [], "high", false);
    expect(u.kinds.water).toEqual({ intensity: 1, opacity: 0, p1: 0, p2: 1 });
    expect(u.detail).toBe(2);
  });
  it("byField slots by field order; missing field falls back to intensity; extras ignored", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    const u = layersToUniforms([L({ kind: "vegetation", intensity: 0.4, byField: { b: 0.9, c: 7 } })], ids, "medium", false);
    expect(u.fields.vegetation).toEqual([0.4, 0.9, 1, 0.4, 0.4, 0.4, 0.4, 0.4]);
  });
  it("cropCover: params crop_<id> beats fallback; index clamped", () => {
    const u = layersToUniforms([L({ kind: "cropCover", params: { crop_a: 1, crop_b: 99 } })], ["a", "b", "c"], "low", false, ["grass", "grass", "cereal"]);
    expect(u.crops.slice(0, 3)).toEqual([1, 6, 2]);
    expect(u.detail).toBe(0);
  });
  it("floodZones falls back to intensity*2 for levelM", () => {
    expect(layersToUniforms([L({ kind: "floodZones", intensity: 0.5 })], [], "medium", false).kinds.floodZones?.p1).toBe(1);
    expect(layersToUniforms([L({ kind: "floodZones", params: { levelM: 5 } })], [], "medium", false).kinds.floodZones?.p1).toBe(2);
  });
  it("active: animated kinds only, never under reduced motion", () => {
    const runoff = [L({ kind: "runoff" })];
    expect(layersToUniforms(runoff, [], "medium", false).active).toBe(true);
    const rm = layersToUniforms(runoff, [], "medium", true);
    expect(rm.active).toBe(false);
    expect(rm.motion).toBe(0);
    expect(layersToUniforms([L({ kind: "frost" })], [], "medium", false).active).toBe(false);
    expect(layersToUniforms([L({ kind: "water", params: { ripples: 0 } })], [], "medium", false).active).toBe(false);
    expect(layersToUniforms([L({ kind: "water", params: { ripples: 0.5 } })], [], "medium", false).active).toBe(true);
    expect(layersToUniforms([L({ kind: "runoff", opacity: 0 })], [], "medium", false).active).toBe(false);
  });
  it("overlay layers and nasaImagery are not procedural", () => {
    const u = layersToUniforms([L({ kind: "nasaImagery" }), L({ kind: "water", overlay: {} as never })], [], "medium", false);
    expect(u.anyProcedural).toBe(false);
  });
});

describe("anchor", () => {
  it("notifies only on change > 0.5px or visibility flip", () => {
    let n = 0;
    const off = subscribeAnchor(() => n++);
    setAnchor({ x: 10, y: 10, visible: true });
    setAnchor({ x: 10.3, y: 10, visible: true });
    expect(n).toBe(1);
    setAnchor({ x: 11, y: 10, visible: true });
    setAnchor({ x: 11, y: 10, visible: false });
    expect(n).toBe(3);
    setAnchor(null);
    expect(getAnchor()).toBeNull();
    expect(n).toBe(4);
    off();
  });
});

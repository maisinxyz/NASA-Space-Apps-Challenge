import { describe, expect, it } from "vitest";

import { scenarioById } from "@/lib/twin/scenarios/registry";

import { eventStats, eventsFor, stormTotalMm } from "./events";

describe("what-if weather events", () => {
  it("only the BC farms have events, with inputs inside the scenario limits", () => {
    expect(eventsFor("cornell-ruminant")).toEqual([]);
    for (const farm of ["ubc-farm", "kpu-langley"]) {
      const evs = eventsFor(farm);
      expect(evs.map((e) => e.id)).toEqual(["storm", "wet-spell", "drought", "heat-wave", "frost"]);
      for (const e of evs)
        for (const i of scenarioById(e.id)!.inputs) {
          expect(e.inputs[i.id]).toBeGreaterThanOrEqual(i.min);
          expect(e.inputs[i.id]).toBeLessThanOrEqual(i.max);
        }
    }
  });

  it("storm rain accumulates to the total and fields get wetter", () => {
    const storm = eventsFor("ubc-farm")[0];
    const at = (p: number) => eventStats("ubc-farm", "storm", p, storm.inputs);
    const total = stormTotalMm(storm.inputs.peak_rain_mm_h, storm.inputs.duration_h);
    expect(total).toBeGreaterThan(80);
    expect(total).toBeLessThan(160);
    expect(at(0).stats[0].value.startsWith("0 of")).toBe(true);
    expect(at(1).stats[0].value).toBe(`${Math.round(total)} of ${Math.round(total)}`);
    expect(at(0.9).fields.length).toBe(6);
    expect(Math.max(...at(0.9).fields.map((f) => f.level))).toBeGreaterThan(Math.max(...at(0.1).fields.map((f) => f.level)));
  });

  it("is deterministic and every event yields four stats", () => {
    for (const e of eventsFor("kpu-langley")) {
      const a = eventStats("kpu-langley", e.id, 0.6, e.inputs);
      expect(a).toEqual(eventStats("kpu-langley", e.id, 0.6, e.inputs));
      expect(a.stats).toHaveLength(4);
      expect(a.fields).toHaveLength(4);
    }
  });
});

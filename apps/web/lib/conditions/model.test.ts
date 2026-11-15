import { describe, expect, it } from "vitest";

import type { Forecast } from "@/lib/api/types";
import { twinConfig } from "@/lib/farms";

import kpu from "../../public/prebuilt/site_kpu_langley_forecast.json";
import ubc from "../../public/prebuilt/site_ubc_farm_forecast.json";

import { CONDITIONS, conditionView, plotFeats } from "./model";
import { RECS } from "./recommendations";

describe("condition layers", () => {
  for (const [farm, fc] of [["ubc-farm", ubc], ["kpu-langley", kpu]] as const) {
    const ctx = { forecast: fc as unknown as Forecast, engineId: "rot_existing" };
    const feats = plotFeats(twinConfig(farm)!.fields);
    it(`${farm}: every condition colours every plot, plots differ, and years differ`, () => {
      for (const c of CONDITIONS) {
        const years = Array.from({ length: 10 }, (_, i) => conditionView(c, feats, ctx, i + 1));
        const [y1, y10] = [years[0], years[9]];
        // every step of the scrubber changes at least one plot's colour
        for (let i = 1; i < 10; i++) expect(years[i].plots.map((p) => p.colour), `${c.id} year ${i + 1}`).not.toEqual(years[i - 1].plots.map((p) => p.colour));
        expect(y1.plots).toHaveLength(feats.length);
        expect(new Set(y1.plots.map((p) => p.colour)).size).toBeGreaterThan(1);
        expect(y1.plots.map((p) => p.colour)).not.toEqual(y10.plots.map((p) => p.colour));
        for (const p of y1.plots) expect(p.sev >= 0 && p.sev <= 1).toBe(true);
        expect(RECS[c.id].year).toHaveLength(3);
      }
    });
  }
});

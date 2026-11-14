import { describe, expect, it } from "vitest";

import { formatValue, metaLines, sourceLine, type ValueMeta } from "./provenance";

const area: ValueMeta = { basis: "derived", unit: "ha", sourceId: "osm", observedAt: "2026-11-13", qualityNote: "Mapped outline, not a survey." };

describe("provenance formatting", () => {
  it("formats value + unit with a fixed locale", () => {
    expect(formatValue(35.456, "ha")).toBe("35.5 ha");
    expect(formatValue(1234.5, "m", 0)).toBe("1,235 m");
    expect(formatValue("Berries", "")).toBe("Berries");
  });

  it("names source, attribution and licence", () => {
    expect(sourceLine("osm")).toBe("OpenStreetMap field outlines · © OpenStreetMap contributors · ODbL 1.0");
    expect(sourceLine("teamScores")).not.toContain("·");
  });

  it("lists only the meta lines that are set, in order", () => {
    expect(metaLines(area)).toEqual([`Source: ${sourceLine("osm")}`, "Observed: 2026-11-13", "Limitation: Mapped outline, not a survey."]);
  });
});

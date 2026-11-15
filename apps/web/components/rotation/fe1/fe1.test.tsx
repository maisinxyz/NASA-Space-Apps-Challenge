import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CRITERIA, type RotationAnalysis, type RotationScorecard } from "@/lib/rotation/draft-types";
import { MOCK_ROTATIONS } from "@/lib/rotation/draft-fixtures";

import { RotationResults } from "./RotationResults";
import { Scorecard } from "./Scorecard";

const w = (c: (typeof CRITERIA)[number]) => Object.fromEntries(CRITERIA.map((x) => [x, x === c ? 5 : 0]));
const analysis = { site_id: "s", rotations: MOCK_ROTATIONS, warnings: [], limited_data: false, request_echo: { criteria_selected: CRITERIA, weights: w("water_use") } } as unknown as RotationAnalysis;
const render = (weights: Record<string, number>) => renderToStaticMarkup(<RotationResults analysis={analysis} weights={weights} selected={CRITERIA} cropNames={{}} showMock={false} />);
const names = (html: string) => MOCK_ROTATIONS.map((r) => ({ n: r.name, i: html.indexOf(r.name) })).sort((a, b) => a.i - b.i).map((x) => x.n);

describe("Scorecard", () => {
  it("renders unit and basis chip for every row", () => {
    const rows = MOCK_ROTATIONS[0].scorecard;
    const html = renderToStaticMarkup(<Scorecard rows={rows} />);
    expect(rows).toHaveLength(7);
    expect((html.match(/data-basis=/g) ?? []).length).toBe(rows.length);
    for (const r of rows) expect(html).toContain(r.unit.replace(/&/g, "&amp;"));
  });

  it("draws a range bar only when range exists", () => {
    const base = MOCK_ROTATIONS[0].scorecard[0];
    const none = { ...base, range: undefined } as RotationScorecard;
    const some = { ...base, range: { p10: 20, p90: 60 } };
    expect(renderToStaticMarkup(<Scorecard rows={[none]} />)).not.toContain("data-range-bar");
    expect(renderToStaticMarkup(<Scorecard rows={[some]} />)).toContain("data-range-bar");
  });
});

describe("RotationResults", () => {
  it("shows rank_stability only while weights match request_echo, else a muted note", () => {
    const stab = { ...analysis, rotations: MOCK_ROTATIONS.map((r) => ({ ...r, rank_stability: "STABLE-TEXT" })) } as unknown as RotationAnalysis;
    const r = (weights: Record<string, number>) => renderToStaticMarkup(<RotationResults analysis={stab} weights={weights} selected={CRITERIA} cropNames={{}} showMock={false} />);
    expect(r(w("water_use"))).toContain("STABLE-TEXT");
    const moved = r(w("erosion_risk"));
    expect(moved).not.toContain("STABLE-TEXT");
    expect(moved).toContain("Rank stability refers to the weights at the last refresh.");
  });

  it("shows the pre-built badge", () => {
    expect(render(w("water_use"))).toContain("Pre-built");
  });

  it("labels the existing rotation and states scores are relative", () => {
    const html = render(w("water_use"));
    expect(html).toContain("Your current rotation");
    expect(html).toContain("not yield, profit or soil loss");
  });

  it("changing weights changes order but not any rendered score", () => {
    const a = render(w("water_use"));
    const b = render(w("erosion_risk"));
    expect(names(a)).not.toEqual(names(b));
    const scores = (h: string) => MOCK_ROTATIONS.flatMap((r) => r.scorecard.map((s) => `${r.name}|${s.criterion}|${s.score}`)).filter((k) => h.includes(k.split("|")[0]));
    expect(scores(a)).toEqual(scores(b));
    // every per-criterion number appears in both renders in the same count
    const nums = (h: string) => [...h.matchAll(/<b class="tabular-nums">(\d+(?:\.\d+)?)<\/b><span class="text-ink-muted">[^<]*<\/span><span data-basis/g)].map((m) => m[1]).sort();
    expect(nums(a)).toEqual(nums(b));
    expect(nums(a).length).toBe(21);
  });

  it("all-zero weights do not crash and show no overall", () => {
    const html = render(Object.fromEntries(CRITERIA.map((c) => [c, 0])));
    expect(html).not.toContain("Overall for your priorities");
  });
});

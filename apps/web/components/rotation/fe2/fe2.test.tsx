import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { mockFeatureTable, mockHazardCalendar, mockHazards } from "@/lib/rotation/draft-fixtures";
import { initialRotationState, SCENARIO_LABEL, setScenarioPreset, useRotationStore } from "@/lib/rotation/store";

import { FeatureCharts } from "./FeatureCharts";
import { TermTip } from "./Glossary";
import { bareWeeks, HazardTimeline } from "./HazardTimeline";
import { PresetButtons, ScenarioControls } from "./ScenarioControls";
import { weekRuns } from "./charts";

const base = initialRotationState.rotScenario;

function buttons(node: ReactNode, out: ReactElement<{ onClick?: () => void; children?: ReactNode }>[] = []) {
  if (Array.isArray(node)) node.forEach((n) => buttons(n, out));
  else if (node && typeof node === "object" && "props" in node) {
    const el = node as ReactElement<{ onClick?: () => void; children?: ReactNode }>;
    if (el.type === "button") out.push(el);
    buttons(el.props.children, out);
  }
  return out;
}

describe("ScenarioControls", () => {
  beforeEach(() => useRotationStore.getState().reset());
  it("always renders the not-a-forecast label and labelled sliders", () => {
    const html = renderToStaticMarkup(<ScenarioControls />);
    expect(html).toContain(SCENARIO_LABEL);
    expect(html).toContain('for="fe2-rain"');
    expect(html).toContain('for="fe2-temp"');
  });
  it("preset click updates the store", () => {
    const bs = buttons(PresetButtons({ value: "baseline", onPick: setScenarioPreset }));
    expect(bs).toHaveLength(4);
    bs[1].props.onClick!(); // wetter_winters
    expect(useRotationStore.getState().rotScenario.preset).toBe("wetter_winters");
    expect(useRotationStore.getState().rotScenario.rain_scale_pct).toBeGreaterThan(0);
  });
});

describe("charts show unit and basis", () => {
  it("feature charts", () => {
    const t = mockFeatureTable("s", base);
    const html = renderToStaticMarkup(<FeatureCharts table={t} />);
    for (const id of ["soil_moisture_anomaly", "water_balance_mm", "frost_prob", "heat_prob", "extreme_rain_prob"] as const) expect(html).toContain(`Unit: ${t.features[id]!.unit}`);
    expect(html).toContain("data-basis=");
  });
  it("limited data and caveats are shown", () => {
    const t = mockFeatureTable("s", base);
    t.quality.limited_data = true;
    t.caveats = ["a caveat"];
    const html = renderToStaticMarkup(<FeatureCharts table={t} />);
    expect(html).toContain("Limited data");
    expect(html).toContain("a caveat");
  });
  it("hazard timeline", () => {
    const html = renderToStaticMarkup(<HazardTimeline calendar={mockHazardCalendar("s", base)} hazards={mockHazards("s")} />);
    expect(html).toContain("share of years (0–1)");
    expect(html).toContain("data-basis=");
  });
});

describe("bands", () => {
  it("bare weeks come from monthly cover below 0.30", () => {
    const cover = [0.1, 0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const w = bareWeeks(cover);
    expect(w[0]).toBe(1);
    expect(w.length).toBeGreaterThan(8);
    expect(bareWeeks(undefined)).toEqual([]);
  });
  it("groups consecutive weeks", () => expect(weekRuns([3, 1, 2, 7])).toEqual([[1, 3], [7, 7]]));
});

describe("GlossaryTerm tooltip", () => {
  it("is focusable and described by its tooltip", () => {
    const html = renderToStaticMarkup(<TermTip tipId="t1" entry={{ id: "x", term: "X", short: "short", long: "", how_we_use_it: "", source: "" }}>x</TermTip>);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-describedby="t1"');
    expect(html).toContain('id="t1" role="tooltip"');
  });
});

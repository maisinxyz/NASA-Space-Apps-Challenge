import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Forecast } from "@/lib/api/types";
import { condById, conditionView, plotFeats } from "@/lib/conditions/model";
import { twinConfig } from "@/lib/farms";

import ubc from "../../public/prebuilt/site_ubc_farm_forecast.json";

import { ConditionLegend } from "./ConditionLegend";

// SSR reads zustand initial state, so feed the legend a real view built from the prebuilt forecast.
const legend = vi.hoisted(() => ({ open: true }));
vi.mock("@/lib/conditions/useConditionView", () => {
  const cond = condById("heat")!;
  const ctx = { forecast: ubc as unknown as Forecast, engineId: "rot_existing" };
  const feats = plotFeats(twinConfig("ubc-farm")!.fields);
  const view = { ...conditionView(cond, feats, ctx, 3) };
  return { useConditionStore: () => ({ selected: "heat", open: legend.open }), useConditionView: () => view };
});

describe("condition legend", () => {
  it("labels spatial values illustrative and gives no Right now advice", () => {
    const html = renderToStaticMarkup(createElement(ConditionLegend, { embedded: true }));
    expect(html).toContain("condition-detail");
    expect(html).toContain("Illustrative");
    expect(html).toContain("synthetic");
    expect(html).toContain("condition-rec-year");
    expect(html).not.toContain("Right now");
    expect(html).not.toContain("condition-rec-now");
  });

  it("keeps the illustrative cue visible when the legend is collapsed", () => {
    legend.open = false;
    try {
      const html = renderToStaticMarkup(createElement(ConditionLegend, { embedded: true }));
      expect(html).not.toContain("condition-detail");
      expect(html).toContain("· illustrative");
    } finally { legend.open = true; }
  });
});

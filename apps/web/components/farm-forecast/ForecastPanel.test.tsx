import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Forecast } from "@/lib/api/types";

import { ForecastCard, type ForecastCardProps } from "./ForecastPanel";

const forecast = JSON.parse(readFileSync(resolve(__dirname, "../../public/prebuilt/site_ubc_farm_forecast.json"), "utf-8")) as Forecast;

const base = { open: true, status: "ready" as const, forecast, source: "prebuilt" as const, error: null, year: 3, onClose: () => {}, onPickYear: () => {} };
const render = (over: Partial<ForecastCardProps> = {}) => renderToStaticMarkup(<ForecastCard {...base} {...over} />);

describe("ForecastCard", () => {
  it("stays closed until opened", () => {
    expect(render({ open: false })).not.toContain("Engine forecast");
  });

  it("shows the source label, the support sentence, units and basis labels for UBC", () => {
    const html = render();
    expect(html).toContain("Pre-built engine run");
    expect(html).toContain("limited data");
    expect(html).toContain("This tool supports, and does not replace, local agronomic expertise.");
    expect(html).toContain("Whole farm (area-weighted)");
    expect(html).toContain("D3-1 Brassicas");
    expect(html).toContain("Soil organic matter");
    expect(html).toContain("Year 3");
    expect(html).toContain("data-basis=");
    expect(html).not.toContain("Synthetic demo data"); // engine output; the rest of Future mode keeps its own label
  });

  it("labels a mock fixture as mock, never as an engine run", () => {
    const html = render({ source: "mock" });
    expect(html).toContain("Mock fixture");
    expect(html).not.toContain("Pre-built engine run");
  });

  it("shows a loading line while the first forecast runs", () => {
    const html = render({ status: "loading", forecast: null, source: null });
    expect(html).toContain("Running the forecast");
  });

  it("shows the error and no chart when the load failed", () => {
    const html = render({ status: "error", forecast: null, source: null, error: "Cannot reach the FieldTwin API." });
    expect(html).toContain("Cannot reach the FieldTwin API.");
    expect(html).not.toContain('role="img"'); // no chart
  });
});

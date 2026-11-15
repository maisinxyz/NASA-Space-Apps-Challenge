import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Forecast } from "@/lib/api/types";
import { FarmOverview } from "./FarmOverview";

vi.mock("@/lib/farm-future/store", async (original) => {
  const actual = await original<typeof import("@/lib/farm-future/store")>();
  const hook = Object.assign(() => actual.useFutureStore.getState(), actual.useFutureStore);
  return { ...actual, useFutureStore: hook };
});

const mock = vi.hoisted(() => ({ forecast: null as unknown }));
vi.mock("@/lib/store", () => ({ useAppStore: (selector: (state: { farmId: string }) => unknown) => selector({ farmId: "ubc-farm" }) }));
vi.mock("@/lib/forecast/store", () => ({
  useForecastStore: (selector?: (state: { forecast: unknown; source: string; status: string }) => unknown) => {
    const state = { forecast: mock.forecast, source: "prebuilt", status: "ready" };
    return selector ? selector(state) : state;
  },
}));

const forecast = JSON.parse(
  readFileSync(resolve(__dirname, "../../public/prebuilt/site_ubc_farm_forecast.json"), "utf8"),
) as Forecast;
mock.forecast = forecast;

describe("FarmOverview", () => {
  it("labels the soil organic matter value as an index with a 100 starting baseline", () => {
    const html = renderToStaticMarkup(<FarmOverview />);

    expect(html).toContain("Soil organic matter index");
    expect(html).toContain("Soil organic matter index baseline: 100 in the starting year.");
  });
});

it("uses the selected field for the summary", async () => {
  const { useFutureStore } = await import("@/lib/farm-future/store");
  useFutureStore.setState({ focusFieldId: forecast.fields[0].field_id });
  const html = renderToStaticMarkup(<FarmOverview />);
  expect(html).toContain(forecast.fields[0].name);
  useFutureStore.setState({ focusFieldId: null });
});

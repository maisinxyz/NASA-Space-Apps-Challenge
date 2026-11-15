import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Forecast } from "@/lib/api/types";

import { METRICS, seriesOf, strategiesOf, valueAt, yearOfClock, scorecardOf, flagsOf } from "./select";
import { requestFor, siteForFarm } from "./sites";
import { useForecastStore } from "./store";

vi.mock("@/lib/api/client", async (original) => ({ ...await original<Record<string, unknown>>(), apiMode: "mock" }));

const PREBUILT = resolve(__dirname, "../../public/prebuilt/site_ubc_farm_forecast.json");
const prebuilt = () => JSON.parse(readFileSync(PREBUILT, "utf-8")) as Forecast;

afterEach(() => {
  vi.unstubAllGlobals();
  useForecastStore.getState().reset();
});

describe("sites", () => {
  it("maps the UBC farm to its engine site and nothing else", () => {
    expect(siteForFarm("ubc-farm")).toBe("site_ubc_farm");
    expect(siteForFarm("usda-barc")).toBeNull();
    expect(siteForFarm(null)).toBeNull();
  });

  it("applies the what-if sliders as a scenario adjustment, and leaves the base request alone at zero", () => {
    const base = requestFor("site_ubc_farm")!;
    expect(base.scenario).toBe("baseline");
    expect(requestFor("site_ubc_farm", { rainPct: 0, tempC: 0 })).toBe(base);
    const hot = requestFor("site_ubc_farm", { rainPct: -10, tempC: 1.5 })!;
    expect(hot.scenario).toEqual({ preset: "baseline", rain_scale_pct: -10, temp_offset_c: 1.5 });
    expect(requestFor("site_nope")).toBeNull();
  });

  it("asks for OSM plot polygons with real areas, and a crop pool the engine can plan", () => {
    const req = requestFor("site_ubc_farm")!;
    expect(req.fields!.length).toBe(6);
    for (const f of req.fields!) expect(f.polygon).toBeTruthy();
    expect(req.selection.crops.length).toBeGreaterThanOrEqual(2);
    expect(req.horizon_years).toBe(10);
  });
});

describe("pre-built UBC forecast", () => {
  it("is the engine's own response for the UBC request, with the fixed honesty strings", () => {
    const f = prebuilt();
    expect(f.site_id).toBe("site_ubc_farm");
    expect(f.horizon_years).toBe(10);
    expect(f.support_sentence).toBe("This tool supports, and does not replace, local agronomic expertise.");
    expect(f.fields.map((x) => x.field_id)).toEqual(requestFor("site_ubc_farm")!.fields!.map((x) => x.field_id));
  });

  it("lists three strategies with the existing rotation first", () => {
    const s = strategiesOf(prebuilt());
    expect(s).toHaveLength(3);
    expect(s[0].role).toBe("existing");
  });

  it("gives every chart metric a Year 0 to 10 series for the farm and for a field, each with a unit and a basis", () => {
    const f = prebuilt();
    for (const m of METRICS) {
      for (const field of [null, f.fields[0].field_id]) {
        const series = seriesOf(f, f.fields[0].strategies[1].id, m.key, field);
        expect(series, `${m.key} ${field}`).not.toBeNull();
        expect(series!.unit).toBeTruthy();
        expect(series!.basis).toBeTruthy();
        expect(series!.points[0].year).toBe(0);
        expect(series!.points.at(-1)!.year).toBe(10);
      }
    }
  });

  it("reads the value at a year, clamping outside the range", () => {
    const f = prebuilt();
    const s = seriesOf(f, "rot_existing", "soil_organic_index")!;
    expect(valueAt(s, 0).p50).toBe(100);
    expect(valueAt(s, 99).p50).toBe(s.points.at(-1)!.p50);
  });

  it("maps the farm view clock (years since the start) to forecast years 1 to 10", () => {
    expect(yearOfClock(0, 10)).toBe(1);
    expect(yearOfClock(3.4, 10)).toBe(4);
    expect(yearOfClock(9.99, 10)).toBe(10);
    expect(yearOfClock(25, 10)).toBe(10);
  });
});

describe("forecast store (mock/offline mode)", () => {
  it("loads the pre-built file and labels the source", async () => {
    vi.stubGlobal("fetch", async (url: string) => (url === "/prebuilt/site_ubc_farm_forecast.json" ? new Response(readFileSync(PREBUILT)) : new Response("nope", { status: 404 })));
    await useForecastStore.getState().load("site_ubc_farm");
    const s = useForecastStore.getState();
    expect(s.status).toBe("ready");
    expect(s.source).toBe("prebuilt");
    expect(s.forecast?.site_id).toBe("site_ubc_farm");
  });

  it("reports an error for a site with no request, without throwing", async () => {
    await useForecastStore.getState().load("site_nope");
    expect(useForecastStore.getState().status).toBe("error");
    expect(useForecastStore.getState().error).toMatch(/site_nope/);
  });
});


describe("scope correctness and request lifecycle", () => {
  it("uses selected-field scores and all fields' flags for whole farm", () => {
    const f = prebuilt();
    const id = f.fields[0].strategies[0].id;
    f.fields[1].strategies[0].scorecard[0].score = 17;
    f.farm_rollup.strategies[0].scorecard[0].score = 93;
    f.fields[1].strategies[0].review_flags[0].text = "Unique second-field concern";
    expect(scorecardOf(f, id, f.fields[1].field_id)[0].score).toBe(17);
    expect(scorecardOf(f, id, null)[0].score).toBe(93);
    expect(flagsOf(f, id, null).some((x) => x.text === "Unique second-field concern")).toBe(true);
    f.farm_rollup.strategies = [];
    expect(scorecardOf(f, id, null)).toEqual([]);
  });
  it("invalidates an in-flight forecast on reset", async () => {
    let finish!: (r: Response) => void;
    vi.stubGlobal("fetch", () => new Promise<Response>((resolve) => { finish = resolve; }));
    const pending = useForecastStore.getState().load("site_kpu_langley");
    useForecastStore.getState().reset();
    finish(new Response(JSON.stringify(prebuilt())));
    await pending;
    expect(useForecastStore.getState().status).toBe("idle");
    expect(useForecastStore.getState().forecast).toBeNull();
  });
});

  it("clears a previous site's source while the next site loads", async () => {
    useForecastStore.setState({ siteId: "site_ubc_farm", forecast: prebuilt(), source: "prebuilt", status: "ready" });
    vi.stubGlobal("fetch", () => new Promise<Response>(() => {}));
    void useForecastStore.getState().load("site_kpu_langley", { rainPct: -37, tempC: 1 });
    expect(useForecastStore.getState().source).toBeNull();
    expect(useForecastStore.getState().forecast).toBeNull();
    useForecastStore.getState().reset();
  });

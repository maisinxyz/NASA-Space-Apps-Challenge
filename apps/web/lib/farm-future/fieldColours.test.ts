import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { Forecast } from "@/lib/api/types";
import { twinConfig } from "@/lib/farms";

import { fieldValues, rampColour } from "./fieldColours";

const ubc = JSON.parse(readFileSync(resolve(__dirname, "../../public/prebuilt/site_ubc_farm_forecast.json"), "utf-8")) as Forecast;

describe("field colours", () => {
  it("gives every forecast field a value and colour with its unit", () => {
    const r = fieldValues(ubc, "rot_existing", "soil", 5);
    expect(r.values).toHaveLength(ubc.fields.length);
    expect(r.unit).toBeTruthy();
    for (const v of r.values) expect(v.colour).toMatch(/^rgb\(/);
  });

  it("changes colours when the year changes (scale spans years 1..10)", () => {
    const y1 = fieldValues(ubc, "rot_existing", "soil", 1).values.map((v) => v.colour);
    const y10 = fieldValues(ubc, "rot_existing", "soil", 10).values.map((v) => v.colour);
    expect(y10).not.toEqual(y1);
  });

  it("uses the same fields as the 3D twin", () => {
    const twin = twinConfig("ubc-farm")!;
    expect(twin.fields.map((f) => f.id).sort()).toEqual(ubc.fields.map((f) => f.field_id).sort());
    expect(twinConfig("kpu-langley")!.fields.length).toBe(4);
  });

  it("ramps from good to poor", () => {
    expect(rampColour(0)).toBe("rgb(111,168,107)");
    expect(rampColour(1)).toBe("rgb(196,106,82)");
  });
});

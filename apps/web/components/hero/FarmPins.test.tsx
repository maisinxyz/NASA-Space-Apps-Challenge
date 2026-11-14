import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FARMS } from "@/lib/farms";

import { FARM_PIN_BOX, hasFarmPin } from "./FarmPins";
import { Pin3D, pinBox } from "./Pin3D";

describe("per-farm pins", () => {
  it("every farm names a known design", () => {
    for (const f of FARMS) expect(hasFarmPin(f.pin), f.id).toBe(true);
  });
  it("draws the farm design at the shared box, tier colour kept", () => {
    const twin = renderToStaticMarkup(<Pin3D width={22} height={33} tone="twin" design="silo-pair" />);
    const explore = renderToStaticMarkup(<Pin3D width={22} height={33} tone="explore" design="barn" />);
    expect(twin).toContain(`width="${FARM_PIN_BOX.w}"`);
    expect(twin).toContain("#c4685a");
    expect(explore).toContain("#7690b3");
  });
  it("falls back to the satin pin for unknown or missing ids", () => {
    for (const d of [undefined, "nope"]) {
      const html = renderToStaticMarkup(<Pin3D width={22} height={33} design={d} />);
      expect(html).toContain('viewBox="0 0 20 30"');
      expect(pinBox(d, { w: 22, h: 33 })).toEqual({ w: 22, h: 33 });
    }
  });
});

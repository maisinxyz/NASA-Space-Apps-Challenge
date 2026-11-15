import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FARMS } from "@/lib/farms";

import { FARM_PIN_BOX, hasFarmPin } from "./FarmPins";
import { Pin3D, pinBox } from "./Pin3D";

describe("per-farm pins", () => {
  it("every farm names a known design", () => {
    for (const f of FARMS) expect(hasFarmPin(f.pin), f.id).toBe(true);
  });
  it("draws every farm design at the shared box in one colour, whatever the tier", () => {
    const twin = renderToStaticMarkup(<Pin3D width={22} height={33} tone="twin" design="silo-pair" />);
    const explore = renderToStaticMarkup(<Pin3D width={22} height={33} tone="explore" design="grape-cluster" />);
    for (const html of [twin, explore]) {
      expect(html).toContain(`width="${FARM_PIN_BOX.w}"`);
      expect(html).toContain("[--col:#d9443c]");
      expect(html).not.toContain("#c4685a");
      expect(html).not.toContain("#7690b3");
    }
  });
  it("falls back to the satin pin for unknown or missing ids", () => {
    for (const d of [undefined, "nope"]) {
      const html = renderToStaticMarkup(<Pin3D width={22} height={33} design={d} />);
      expect(html).toContain('viewBox="0 0 20 30"');
      expect(pinBox(d, { w: 22, h: 33 })).toEqual({ w: 22, h: 33 });
    }
  });
});

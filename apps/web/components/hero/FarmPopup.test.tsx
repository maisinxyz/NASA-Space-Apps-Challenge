import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { farmById } from "@/lib/farms";
import { FarmPopup } from "./FarmPopup";

const noop = () => {};

describe("FarmPopup", () => {
  it("renders honest copy and action button for explorable farms", () => {
    const farm = farmById("cornell-ruminant")!;
    const html = renderToStaticMarkup(
      <FarmPopup farm={farm} reduced={true} onClose={noop} onDescend={noop} />
    );

    expect(html).toContain("Explorable");
    expect(html).toContain("Enter farm");
    expect(html).toContain(`aria-label="Enter farm view for ${farm.name}"`);
    expect(html).not.toContain("Simulation available on Cornell &amp; Beltsville only");
  });

  it("renders honest disclaimer and non-misleading button for explore-only farms", () => {
    const farm = farmById("ucdavis-oakville")!;
    const html = renderToStaticMarkup(
      <FarmPopup farm={farm} reduced={true} onClose={noop} onDescend={noop} />
    );

    expect(html).toContain("Explore only");
    expect(html).toContain("Explore in 3D (no simulation)");
    expect(html).toContain("Simulation available on Cornell &amp; Beltsville only (2 of 14 farms)");
    expect(html).toContain(`aria-label="Explore ${farm.name} in 3D (simulation unavailable)"`);
    expect(html).not.toContain("Enter farm");
  });

  it("renders tailored action button for Vancouver-area demos", () => {
    const ubc = farmById("ubc-farm")!;
    const ubcHtml = renderToStaticMarkup(
      <FarmPopup farm={ubc} reduced={true} onClose={noop} onDescend={noop} />
    );
    expect(ubcHtml).toContain("Compare rotations");
    expect(ubcHtml).toContain("Explorable · scenarios and comparison");

    const kpu = farmById("kpu-langley")!;
    const kpuHtml = renderToStaticMarkup(
      <FarmPopup farm={kpu} reduced={true} onClose={noop} onDescend={noop} />
    );
    expect(kpuHtml).toContain("Compare rotations");
    expect(kpuHtml).toContain("Explorable · scenarios and comparison");
  });
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { farmById } from "@/lib/farms";
import { FarmPopup } from "./FarmPopup";

const noop = () => {};

describe("FarmPopup", () => {
  it("renders honest copy and action button for full digital twin farms", () => {
    const farm = farmById("cornell-ruminant")!;
    const html = renderToStaticMarkup(
      <FarmPopup farm={farm} reduced={true} onClose={noop} onDescend={noop} />
    );

    expect(html).toContain("Digital twin");
    expect(html).toContain("Enter digital twin");
    expect(html).toContain(`aria-label="Enter digital twin for ${farm.name}"`);
    expect(html).not.toContain("Simulation available on Cornell &amp; Beltsville only");
  });

  it("renders honest disclaimer and non-misleading button for explore-only farms", () => {
    const farm = farmById("ubc-farm")!;
    const html = renderToStaticMarkup(
      <FarmPopup farm={farm} reduced={true} onClose={noop} onDescend={noop} />
    );

    expect(html).toContain("Explore only");
    expect(html).toContain("Explore in 3D (no simulation)");
    expect(html).toContain("Simulation available on Cornell &amp; Beltsville only (2 of 14 farms)");
    expect(html).toContain(`aria-label="Explore ${farm.name} in 3D (simulation unavailable)"`);
    expect(html).not.toContain("Enter digital twin");
  });
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FARMS } from "@/lib/farms";
import { RestingHero } from "./RestingHero";

const noop = () => {};

describe("RestingHero", () => {
  it("uses clamp for body text and stat labels to prevent excessive shrinking at 720px height", () => {
    const html = renderToStaticMarkup(
      <RestingHero
        shown={true}
        reduced={true}
        farms={FARMS}
        selectedId={null}
        onExplore={noop}
        onPickFarm={noop}
      />
    );

    // Body text has min 14px clamp
    expect(html).toContain("clamp(14px");

    // Stat labels have min 10px clamp
    expect(html).toContain("clamp(10px");

    // Eyebrow and stats value clamped
    expect(html).toContain("clamp(10.5px");
    expect(html).toContain("clamp(18px");
  });
});

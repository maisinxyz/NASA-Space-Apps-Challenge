import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FARMS } from "@/lib/farms";
import { RestingHero } from "./RestingHero";

const noop = () => {};

describe("RestingHero", () => {
  it("keeps minimum font sizes for body text and labels", () => {
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

    expect(html).toContain("font-size:max(16px,");
    expect(html).toContain("font-size:max(12px,");
  });
});

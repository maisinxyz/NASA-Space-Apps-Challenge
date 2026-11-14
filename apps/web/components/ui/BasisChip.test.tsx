import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { BasisOrRelative } from "@/lib/api/types";

import { BASIS_DESCRIPTIONS, BasisChip } from "./BasisChip";

describe("BasisChip", () => {
  it.each(Object.keys(BASIS_DESCRIPTIONS) as BasisOrRelative[])("renders %s with its word and description", (basis) => {
    const html = renderToStaticMarkup(<BasisChip basis={basis} />);
    expect(html).toContain(`data-basis="${basis}"`);
    expect(html).toContain(`>${basis}<`);
    expect(html).toContain(BASIS_DESCRIPTIONS[basis]);
    expect(html).not.toContain("tabindex");
  });

  it("covers exactly the contract enum", () => {
    expect(Object.keys(BASIS_DESCRIPTIONS).sort()).toEqual(["assumed", "derived", "measured", "modeled", "relative"]);
  });

  it("renders values outside the enum as a neutral unknown chip", () => {
    const html = renderToStaticMarkup(<BasisChip basis={"estimated" as BasisOrRelative} />);
    expect(html).toContain('data-basis="unknown"');
    expect(html).toContain(">unknown<");
    expect(html).toContain("bg-line");
    expect(html).not.toContain("estimated");
  });
});

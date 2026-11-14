import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ValueMeta } from "@/lib/provenance";

import { BasisChip, SourceFooter, Value } from "./Provenance";

const area: ValueMeta = { basis: "derived", unit: "ha", sourceId: "osm", observedAt: "2026-11-13", qualityNote: "Mapped outline, not a survey." };

describe("provenance components", () => {
  it("Value shows unit, basis word and a described popover", () => {
    const html = renderToStaticMarkup(<Value value={35.5} meta={area} />);
    expect(html).toContain("35.5 ha");
    expect(html).toContain('data-basis="derived"');
    expect(html).toContain('role="tooltip"');
    expect(html).toContain("Limitation: Mapped outline");
    expect(html).toMatch(/aria-describedby="([^"]+)"[\s\S]*id="\1"/);
  });

  it("BasisChip covers synthetic and rejects unknown", () => {
    expect(renderToStaticMarkup(<BasisChip basis="synthetic" />)).toContain(">synthetic<");
    expect(() => renderToStaticMarkup(<BasisChip basis={"guess" as "synthetic"} />)).toThrow(/unknown basis/);
  });

  it("SourceFooter drops duplicate sources", () => {
    const html = renderToStaticMarkup(<SourceFooter ids={["osm", "osm", "illustrativeCrops"]} />);
    expect(html.match(/OpenStreetMap field outlines/g)).toHaveLength(1);
  });
});

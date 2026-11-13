import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { BasisOrRelative } from "@/lib/api/types";

import { MetricValue } from "./MetricValue";

describe("MetricValue", () => {
  it("renders value, unit and basis chip", () => {
    const html = renderToStaticMarkup(<MetricValue label="Relief" value={22.14} unit="m" basis="derived" />);
    expect(html).toContain("Relief");
    expect(html).toContain("22.1");
    expect(html).toContain(">m<");
    expect(html).toContain('data-basis="derived"');
  });

  it("formats with a fixed locale and digits", () => {
    expect(renderToStaticMarkup(<MetricValue value={12345.678} unit="m3" basis="modeled" digits={0} />)).toContain("12,346");
  });

  it("throws in dev when the unit is missing", () => {
    expect(() => renderToStaticMarkup(<MetricValue value={1} unit="" basis="derived" />)).toThrow(/unit and a valid basis/);
  });

  it("throws in dev when the basis is missing or invalid", () => {
    expect(() => renderToStaticMarkup(<MetricValue value={1} unit="m" basis={undefined as unknown as BasisOrRelative} />)).toThrow();
    expect(() => renderToStaticMarkup(<MetricValue value={1} unit="m" basis={"estimated" as BasisOrRelative} />)).toThrow();
  });
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MethodsPage from "@/app/methods/page";

describe("MethodsPage", () => {
  it("renders page header and data methods structure without errors", () => {
    const html = renderToStaticMarkup(<MethodsPage />);

    expect(html).toContain("Data &amp; Methods");
    expect(html).toContain("How to read the numbers");
    expect(html).toContain("Datasets");
    expect(html).toContain("give no farm-specific forecasts");
    for (const name of ["NASA NEX-GDDP-CMIP6", "OpenStreetMap field outlines", "City of Vancouver 2022 orthophoto", "Township of Langley 2022 orthophoto", "NASA HLS vegetation indices", "SoilGrids 2.0"]) expect(html).toContain(name);
    expect(html).toContain("Roadmap");
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MethodsPage from "@/app/methods/page";

describe("Methods page current-feature claims", () => {
  it("does not imply observed storms or photo uploads are available", () => {
    const html = renderToStaticMarkup(createElement(MethodsPage));

    expect(html).toContain("The live UBC and KPU rotation forecasts use NASA POWER.");
    expect(html).not.toContain("synthetic fixtures");
    expect(html).not.toContain("A real storm can be stronger or weaker");
    expect(html).not.toContain("Photos you upload");
    expect(html).toContain("Displayed imagery is visual context");
  });
});

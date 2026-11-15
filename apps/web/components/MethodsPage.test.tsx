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
    expect(html).toContain("Every output is a relative comparison between options, not a prediction");
  });
});

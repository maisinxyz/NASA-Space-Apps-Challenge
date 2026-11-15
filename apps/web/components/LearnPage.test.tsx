import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LearnPage from "@/app/learn/page";

describe("LearnPage", () => {
  it("displays draft educational disclaimer and avoids presenting draft fixtures as authoritative", () => {
    const html = renderToStaticMarkup(<LearnPage />);

    // Educational prototype disclaimer
    expect(html).toContain("Draft educational fixtures");
    expect(html).toContain("Citations marked as pending review are not authoritative agronomic guidance");

    // Placeholder notes on unverified fixtures
    expect(html).toContain("Draft placeholder · Citation pending expert review");
    expect(html).not.toContain("Source: not yet verified");
  });
});

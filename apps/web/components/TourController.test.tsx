import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TourController } from "./TourController";

describe("TourController", () => {
  it("renders without mounting visible elements", () => {
    const html = renderToStaticMarkup(<TourController />);
    expect(html).toBe("");
  });
});

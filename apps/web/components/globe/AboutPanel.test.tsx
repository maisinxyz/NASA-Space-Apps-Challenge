import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AboutPanel } from "./AboutPanel";

describe("AboutPanel", () => {
  it("does not overstate capabilities and accurately describes synthetic scenarios and roadmap", () => {
    const html = renderToStaticMarkup(<AboutPanel />);

    // Honest scenario description
    expect(html).toContain("Simulate weather scenarios");
    expect(html).toContain("Current runs are synthetic fixture inputs");
    expect(html).not.toContain("calibrated against regional historical baselines");
    expect(html).not.toContain("Replay a real storm");
    expect(html).not.toContain("replays storms from the NASA POWER record on it");

    // Roadmap items
    expect(html).toContain("Live NASA POWER replay");
    expect(html).toContain("Replaying historical storms directly from the NASA POWER archive (currently disabled in favour of synthetic scenario models)");
  });
});

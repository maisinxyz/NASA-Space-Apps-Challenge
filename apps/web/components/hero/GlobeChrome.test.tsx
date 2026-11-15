import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DesktopNavigation, GlobeChrome } from "./GlobeChrome";

describe("desktop globe chrome", () => {
  it("exposes the public site navigation on the fullscreen map", () => {
    const html = renderToStaticMarkup(<DesktopNavigation />);

    expect(html).toContain('aria-label="Primary navigation"');
    expect(html).toContain('href="/methods"');
    expect(html).toContain('href="/learn"');
    expect(html).toContain("About");
  });

  it("keeps globe instructions visible alongside the latest title and controls", () => {
    const html = renderToStaticMarkup(
      <GlobeChrome
        controls={<button type="button">Farm controls</button>}
      />,
    );

    expect(html).toContain("Drag to rotate");
    expect(html).toContain("STARDEW EARTH");
    expect(html).not.toContain("Stardew Earth assistant");
  });

});

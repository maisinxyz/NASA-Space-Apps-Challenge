import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DesktopNavigation, GlobeAssistant, GlobeChrome } from "./GlobeChrome";

describe("desktop globe chrome", () => {
  it("exposes the public site navigation on the fullscreen map", () => {
    const html = renderToStaticMarkup(<DesktopNavigation />);

    expect(html).toContain('aria-label="Primary navigation"');
    expect(html).toContain('href="/methods"');
    expect(html).toContain('href="/learn"');
    expect(html).toContain("About");
  });

  it("keeps globe instructions visible outside the menu and clarifies search", () => {
    const html = renderToStaticMarkup(
      <GlobeChrome
        navigation={{ farms: [], onPick: () => {} }}
        onAsk={() => {}}
        controls={<button type="button">Farm controls</button>}
      />,
    );

    expect(html).toContain("Drag to rotate");
    expect(html).toContain("Find a farm or place");
  });

  it("keeps the non-globe fallback assistant copy unchanged", () => {
    const html = renderToStaticMarkup(<GlobeAssistant navigation={{ farms: [], onPick: () => {} }} onAsk={() => {}} />);

    expect(html).not.toContain("Find a farm or place, or ask a farm question.");
  });
});

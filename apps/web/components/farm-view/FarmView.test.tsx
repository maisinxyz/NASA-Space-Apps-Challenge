import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { farmById, twinConfig } from "@/lib/farms";
import { useAppStore } from "@/lib/store";

import { FarmView } from "./FarmView";

const noop = () => {};

describe("FarmView", () => {
  it("renders explore-only farm (UBC Farm) safely without throwing twin errors", () => {
    useAppStore.setState({ farmId: "ubc-farm", globeView: "farm" });
    const farm = farmById("ubc-farm")!;

    expect(() => {
      const html = renderToStaticMarkup(
        <FarmView
          farmName={farm.name}
          place={farm.locality ? `${farm.locality}, ${farm.country}` : farm.country}
          onBack={noop}
          onReset={noop}
        />
      );
      expect(html).toContain("UBC Farm");
      expect(html).toContain("Explore only");
      expect(html).not.toContain("Simulation available");
    }).not.toThrow();
  });

  it("renders sample badge and descriptive period labels on condition pills to avoid misleading mock data", () => {
    useAppStore.setState({ farmId: "ubc-farm", globeView: "farm" });
    const html = renderToStaticMarkup(
      <FarmView farmName="UBC Farm" onBack={noop} onReset={noop} />
    );

    // Visible sample label
    expect(html).toContain("Sample · Past 30 days");

    // All sample condition readings are rendered
    expect(html).toContain("Rainfall");
    expect(html).toContain("64 mm");
    expect(html).toContain("Soil moisture");
    expect(html).toContain("41%");
    expect(html).toContain("Crop vigor");
    expect(html).toContain("0.48");
    expect(html).toContain("Heat &amp; frost");
    expect(html).toContain("9 days");

    // Clear sample notes in pill titles
    expect(html).toContain("sample; not live sensor measurements");
  });

  it("renders analytical layer bar with satellite, vigor, and moisture options", () => {
    useAppStore.setState({ farmId: "cornell", globeView: "farm" });
    const html = renderToStaticMarkup(
      <FarmView farmName="Cornell Musgrave Research Farm" onBack={noop} onReset={noop} />
    );

    expect(html).toContain('data-testid="layer-satellite"');
    expect(html).toContain('data-testid="layer-vigor"');
    expect(html).toContain('data-testid="layer-moisture"');
    expect(html).toContain("Crop vigor (illustrative excess-green layer)");
    expect(html).toContain("Soil moisture (illustrative false-colour thermal layer)");
  });

  it("renders zoneToggle inside reserved header grid preventing 1280x800 layout collision", () => {
    useAppStore.setState({ farmId: "cornell", globeView: "farm" });
    const html = renderToStaticMarkup(
      <FarmView
        farmName="Cornell Musgrave Research Farm"
        onBack={noop}
        onReset={noop}
        zoneToggle={<div data-testid="zone-toggle-mock">Vulnerability zones</div>}
      />
    );

    expect(html).toContain("Vulnerability zones");
    expect(html).toContain("grid-template-columns:minmax(280px, 1fr) auto minmax(280px, 1fr)");
  });

  it("ensures clickable field report rows have tabIndex and role for keyboard users", () => {
    useAppStore.setState({ farmId: "cornell-ruminant", globeView: "farm" });
    const farm = farmById("cornell-ruminant")!;
    const twin = twinConfig("cornell-ruminant")!;
    const simProps = {
      farm,
      fields: twin.fields,
      cropA: undefined,
      cropB: undefined,
      pending: 0,
      runSource: "fixture" as const,
      frame: null,
      getCamera: () => null,
    };

    const html = renderToStaticMarkup(
      <FarmView
        farmName={farm.name}
        onBack={noop}
        onReset={noop}
        sim={simProps}
        initialReportOpen={true}
      />
    );

    expect(html).toContain('tabindex="0"');
    expect(html).toContain('role="button"');
    expect(html).toContain(`aria-label="Select field ${twin.fields[0].name}"`);
  });

  it("renders persistent 'Show panels' button when panelsHidden is true", () => {
    useAppStore.setState({ farmId: "cornell-ruminant", globeView: "farm", panelsHidden: true });
    const html = renderToStaticMarkup(
      <FarmView farmName="Cornell Musgrave Research Farm" onBack={noop} onReset={noop} initialPanelsHidden={true} />
    );

    expect(html).toContain('data-testid="show-panels"');
    expect(html).toContain("Show panels");
    expect(html).toContain('aria-keyshortcuts="H"');
  });

  it("renders accessible WAI-ARIA tab/panel attributes in simulation tab", () => {
    useAppStore.setState({ farmId: "cornell-ruminant", globeView: "farm", panelsHidden: false });
    const farm = farmById("cornell-ruminant")!;
    const twin = twinConfig("cornell-ruminant")!;
    const simProps = {
      farm,
      fields: twin.fields,
      cropA: undefined,
      cropB: undefined,
      pending: 0,
      runSource: "fixture" as const,
      frame: null,
      getCamera: () => null,
    };

    const html = renderToStaticMarkup(
      <FarmView
        farmName={farm.name}
        onBack={noop}
        onReset={noop}
        sim={simProps}
        initialSim={{ open: true, section: "scenarios" }}
      />
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('id="sim-tab-scenarios"');
    expect(html).toContain('aria-controls="sim-panel-scenarios"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('id="sim-panel-scenarios"');
    expect(html).toContain('aria-labelledby="sim-tab-scenarios"');
  });
});

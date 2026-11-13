import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FARMS } from "@/lib/farms";

import { FarmCard } from "./FarmCard";
import { FarmList } from "./FarmList";

const noop = () => {};
const hero = FARMS.find((f) => f.tier === "twin")!;
const explore = FARMS.find((f) => f.tier === "explore" && f.coordsVerified && f.areaHa)!;

describe("FarmCard", () => {
  it("shows the hero farm with an approximate-location note and a safe source link", () => {
    const html = renderToStaticMarkup(<FarmCard farm={hero} onClose={noop} onOpen={noop} />);
    expect(html).toContain(hero.name);
    expect(html).toContain(hero.owner);
    expect(html).toContain("Full digital twin");
    expect(html).toContain("Approximate location");
    expect(html).toContain(`href="${hero.sourceUrl}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Open twin");
    expect(html).not.toContain("Simulation not available");
  });

  it("shows explore farms as explore only, with area and unit", () => {
    const html = renderToStaticMarkup(<FarmCard farm={explore} onClose={noop} onOpen={noop} />);
    expect(html).toContain("Explore only");
    expect(html).toContain("Simulation not available for this farm yet");
    expect(html).toContain(`${explore.areaHa} ha`);
    expect(html).not.toContain("Approximate location");
  });

  it("without a globe: no Open twin; the hero links to the simulation with the synthetic label", () => {
    const html = renderToStaticMarkup(<FarmCard farm={hero} onClose={noop} />);
    expect(html).not.toContain("Open twin");
    expect(html).toContain('href="/simulate"');
    expect(html).toContain("Synthetic storm demo");
    expect(html).not.toContain("data-dev-only");
    expect(renderToStaticMarkup(<FarmCard farm={explore} onClose={noop} />)).not.toContain("/simulate");
  });
});

describe("FarmList", () => {
  it("lists every farm as a button with its tier in words and marks the selection", () => {
    const html = renderToStaticMarkup(<FarmList farms={FARMS} selectedId={hero.id} onSelect={noop} />);
    for (const f of FARMS) expect(html).toContain(f.name);
    expect(html.match(/<button/g)).toHaveLength(FARMS.length);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/Explore only/g)).toHaveLength(FARMS.length - 1);
  });
});

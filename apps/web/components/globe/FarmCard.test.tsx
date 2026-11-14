import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { farmById, FARMS } from "@/lib/farms";

import { FarmCard } from "./FarmCard";
import { FarmList } from "./FarmList";

const noop = () => {};
const hero = FARMS.find((f) => f.tier === "twin")!;
const oakville = farmById("ucdavis-oakville")!;

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

  it("shows explore farms as explore only", () => {
    const html = renderToStaticMarkup(<FarmCard farm={oakville} onClose={noop} onOpen={noop} />);
    expect(html).toContain("Explore only");
    expect(html).toContain("Simulation not available for this farm yet");
    expect(html).toContain("Approximate location");
    expect(html).not.toContain("Open twin");
  });

  it("shows a farm's privacy note and area-only owner", () => {
    const priv = { ...oakville, owner: "Private working farmland (area only)", note: { text: "Private working farmland, area only. No owners or addresses are shown." } };
    const html = renderToStaticMarkup(<FarmCard farm={priv} onClose={noop} onOpen={noop} />);
    expect(html).toContain("Private working farmland, area only. No owners or addresses are shown.");
    expect(html).toContain("Private working farmland (area only)");
    expect(html).toContain("Approximate location");
  });

  it("without a globe: no Open twin and no link to removed pages", () => {
    const html = renderToStaticMarkup(<FarmCard farm={hero} onClose={noop} />);
    expect(html).not.toContain("Open twin");
    expect(html).not.toContain("/simulate");
    expect(html).not.toContain("data-dev-only");
  });
});

describe("FarmList", () => {
  it("lists every farm as a button with its tier in words and marks the selection", () => {
    const html = renderToStaticMarkup(<FarmList farms={FARMS} selectedId={hero.id} onSelect={noop} />);
    for (const f of FARMS) expect(html).toContain(f.name);
    expect(html.match(/<button/g)).toHaveLength(FARMS.length);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/Explore only/g)).toHaveLength(FARMS.filter((f) => f.tier === "explore").length);
  });
});

import { describe, expect, it } from "vitest";

import { normalize, type Place, searchPlaces } from "./search";

const farms = [
  { id: "a", name: "Agassiz Research Farm", country: "Canada", locality: "Agassiz, BC", lat: 49.2, lon: -121.8 },
  { id: "b", name: "Pirque Vineyard", country: "Chile", lat: -33.6, lon: -70.6 },
];
const places: Place[] = [
  { kind: "city", name: "São Paulo", country: "Brazil", lat: -23.5, lon: -46.6, pop: 18_000_000 },
  { kind: "city", name: "Santiago", country: "Chile", lat: -33.4, lon: -70.6, pop: 6_000_000 },
  { kind: "country", name: "Chile", country: "Chile", lat: -33, lon: -71, pop: 19_000_000 },
];

describe("searchPlaces", () => {
  it("ignores accents and case", () => {
    expect(normalize(" São PAULO ")).toBe("sao paulo");
    expect(searchPlaces("sao", farms, places)[0].name).toBe("São Paulo");
  });
  it("puts farms before places", () => {
    const hits = searchPlaces("chile", farms, places);
    expect(hits.map((h) => h.kind)).toEqual(["farm", "country"]);
  });
  it("matches word starts inside a name", () => {
    expect(searchPlaces("research", farms, places).map((h) => h.id)).toEqual(["a"]);
  });
  it("returns nothing for an empty query and respects the limit", () => {
    expect(searchPlaces("  ", farms, places)).toEqual([]);
    expect(searchPlaces("a", farms, places, 2)).toHaveLength(2);
  });
});

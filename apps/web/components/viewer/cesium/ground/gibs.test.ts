import { describe, expect, it } from "vitest";

import { buildGibsTemplate, parseGibsCapabilities } from "./gibs";

// Mirrors the structure of https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml
const XML = `<Capabilities xmlns="http://www.opengis.net/wmts/1.0" xmlns:ows="http://www.opengis.net/ows/1.1"><Contents>
<Layer><ows:Title xml:lang='en'>True Color</ows:Title><ows:Identifier>TestLayer_A</ows:Identifier>
<Style isDefault='true'><ows:Identifier>default</ows:Identifier></Style>
<Dimension><ows:Identifier>Time</ows:Identifier><ows:UOM>ISO8601</ows:UOM><Default>2026-11-14</Default><Value>2000-02-24/2000-04-25/P1D</Value><Value>2000-04-28/2026-11-14/P1D</Value></Dimension>
<TileMatrixSetLink><TileMatrixSet>GoogleMapsCompatible_Level9</TileMatrixSet></TileMatrixSetLink><Format>image/jpeg</Format></Layer>
<Layer><ows:Identifier>TestLayer_B</ows:Identifier><TileMatrixSetLink><TileMatrixSet>GoogleMapsCompatible_Level6</TileMatrixSet></TileMatrixSetLink><Format>image/png</Format></Layer>
<TileMatrixSet><ows:Identifier>GoogleMapsCompatible_Level6</ows:Identifier><TileMatrix><ows:Identifier>0</ows:Identifier></TileMatrix><TileMatrix><ows:Identifier>1</ows:Identifier></TileMatrix><TileMatrix><ows:Identifier>2</ows:Identifier></TileMatrix></TileMatrixSet>
<TileMatrixSet><ows:Identifier>GoogleMapsCompatible_Level9</ows:Identifier><TileMatrix><ows:Identifier>0</ows:Identifier></TileMatrix><TileMatrix><ows:Identifier>1</ows:Identifier></TileMatrix></TileMatrixSet>
</Contents></Capabilities>`;

describe("gibs", () => {
  it("builds the REST template", () => {
    expect(buildGibsTemplate({ base: "https://x.test/wmts/epsg3857/best", layerId: "L", tileMatrixSet: "S", format: "image/jpeg", date: "2024-05-01" })).toBe(
      "https://x.test/wmts/epsg3857/best/L/default/2024-05-01/S/{TileMatrix}/{TileRow}/{TileCol}.jpeg",
    );
    expect(buildGibsTemplate({ base: "https://x.test/", layerId: "L", tileMatrixSet: "S", format: "image/png", date: "d" })).toContain("{TileCol}.png");
  });
  it("parses layers", () => {
    const [a, b] = parseGibsCapabilities(XML);
    expect(a).toMatchObject({ id: "TestLayer_A", tileMatrixSets: ["GoogleMapsCompatible_Level9"], formats: ["image/jpeg"], maxLevels: { GoogleMapsCompatible_Level9: 1 } });
    expect(a.time).toEqual({ default: "2026-11-14", ranges: ["2000-02-24/2000-04-25/P1D", "2000-04-28/2026-11-14/P1D"] });
    expect(b).toMatchObject({ id: "TestLayer_B", formats: ["image/png"], maxLevels: { GoogleMapsCompatible_Level6: 2 } });
    expect(b.time).toBeUndefined();
  });
  it("garbage gives no layers", () => {
    expect(parseGibsCapabilities("<nope/>")).toEqual([]);
  });
});

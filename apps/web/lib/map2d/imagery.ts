// 2D bird's-eye imagery per farm (v4 PRD §5 rows "2D imagery", F3). Both services were tested 2026-11-15:
// HTTP 200 with CORS. The year shown is the capture year of the photo, separate from the forecast period.
// - City of Vancouver 2022 orthophoto, ArcGIS tile cache in EPSG:3857, levels 0-23
//   https://tiles.arcgis.com/tiles/qrcTTRTwUoS8N47o/arcgis/rest/services/Orthophotos_2022/MapServer
//   dataset page: https://opendata.vancouver.ca/explore/dataset/orthophoto-imagery-2022/information/
// - Township of Langley 2022 orthophoto ("Captured Spring 2022"). Its cache is UTM 10N (EPSG:26910), so XYZ tiles 404;
//   the MapServer `export` endpoint reprojects to EPSG:3857 per request.
//   https://mapsvr.tol.ca/arcgisext02/rest/services/CachedServices/Ortho_2022/MapServer

export type Imagery = {
  /** MapLibre raster tile URL template. */
  tiles: string;
  tileSize: number;
  maxzoom: number;
  attribution: string;
  /** Capture year of the photo. */
  year: number;
  source: string;
  url: string;
};

export const IMAGERY: Readonly<Record<string, Imagery>> = {
  "ubc-farm": {
    tiles: "https://tiles.arcgis.com/tiles/qrcTTRTwUoS8N47o/arcgis/rest/services/Orthophotos_2022/MapServer/tile/{z}/{y}/{x}",
    tileSize: 256,
    maxzoom: 21,
    attribution: "City of Vancouver 2022 Orthophoto Imagery",
    year: 2022,
    source: "City of Vancouver Open Data",
    url: "https://opendata.vancouver.ca/explore/dataset/orthophoto-imagery-2022/information/",
  },
  "kpu-langley": {
    tiles:
      "https://mapsvr.tol.ca/arcgisext02/rest/services/CachedServices/Ortho_2022/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=jpg&f=image",
    tileSize: 256,
    maxzoom: 21,
    attribution: "Township of Langley 2022 Orthophoto Imagery",
    year: 2022,
    source: "Township of Langley",
    url: "https://mapsvr.tol.ca/arcgisext02/rest/services/CachedServices/Ortho_2022/MapServer",
  },
};

export const imageryFor = (farmId: string | null): Imagery | null => (farmId ? (IMAGERY[farmId] ?? null) : null);

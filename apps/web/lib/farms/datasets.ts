// Open datasets and the candidate type shared by the dev-only candidate list and the pinned farms (pinned.ts).
import type { FarmInfo } from "./index";

/**
 * Open datasets a candidate farm could use. Every URL appeared in a web search on 2026-11-14; the pages themselves
 * could not be opened from the scouting sandbox (network policy), so each licence is TODO(verify) on its page.
 */
export const CANDIDATE_DATASETS = {
  usgs3dep: { name: "USGS 3DEP 1 m DEM", url: "https://catalog.data.gov/dataset/usgs-1-meter-digital-elevation-model", licence: "Public domain (USGS); attribution requested", attribution: "U.S. Geological Survey" },
  canHrdem: { name: "CanElevation HRDEM (lidar DEM)", url: "https://open.canada.ca/data/en/dataset/957782bf-847c-4644-a757-e383c0057995", licence: "Open Government Licence - Canada (version not yet verified)", attribution: "Natural Resources Canada" },
  copDem30: {
    name: "Copernicus DEM GLO-30",
    url: "https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf",
    licence: "Copernicus DEM licence (free; source notice required)",
    attribution: "Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA",
  },
  ahn4: { name: "AHN4 (Actueel Hoogtebestand Nederland)", url: "https://developers.google.com/earth-engine/datasets/catalog/AHN_AHN4", licence: "CC0 (official ahn.nl page not yet verified)", attribution: "AHN" },
  brp: { name: "BRP Gewaspercelen (Dutch crop parcels)", url: "https://api.pdok.nl/rvo/gewaspercelen/ogc/v1/collections/brpgewas", licence: "CC0 / public domain", attribution: "RVO / PDOK" },
  swissalti3d: { name: "swissALTI3D", url: "https://opendata.swiss/fr/dataset/swissalti3d", licence: "Swiss open government data, free incl. commercial use; source citation required", attribution: "Federal Office of Topography swisstopo" },
  nlsFi2m: { name: "NLS Finland elevation model 2 m", url: "https://maanmittauslaitos.fi/en/node/10715", licence: "NLS open data, CC BY 4.0 not yet verified", attribution: "National Land Survey of Finland" },
  gugikNmt: { name: "GUGiK NMT (Polish digital terrain model)", url: "https://www.geoportal.gov.pl/en/dane/numeryczny-model-terenu", licence: "Free for any use not yet verified", attribution: "GUGiK" },
  cnigMdt05: { name: "CNIG MDT05 (PNOA-LiDAR)", url: "https://inspire-geoportal.ec.europa.eu/srv/api/records/spaignMDT05", licence: "CC BY 4.0", attribution: "CC-BY 4.0 scne.es" },
  maffFude: { name: "MAFF fude polygons (Japanese field parcels)", url: "https://www.maff.go.jp/j/tokei/porigon/index.html", licence: "Use on agreeing to MAFF terms; reuse allowed not yet verified", attribution: "Ministry of Agriculture, Forestry and Fisheries (Japan)" },
  elvis: { name: "Geoscience Australia ELVIS lidar DEMs", url: "https://www.ga.gov.au/scientific-topics/national-location-information/digital-elevation-data", licence: "CC BY 4.0 for GA data; check each dataset", attribution: "Geoscience Australia" },
  linzLidar: { name: "LINZ lidar DEMs (New Zealand)", url: "https://www.linz.govt.nz/products-services/data/licensing-and-using-data/attributing-elevation-or-aerial-imagery-data", licence: "CC BY 4.0; licensor differs by layer", attribution: "LINZ and the layer's licensor" },
  osm: { name: "OpenStreetMap landuse (field outlines)", url: "https://www.openstreetmap.org/copyright", licence: "ODbL 1.0", attribution: "© OpenStreetMap contributors" },
} as const;

export type CandidateDatasetId = keyof typeof CANDIDATE_DATASETS;

/** A scouted farm and what is known about it before the 3D check. */
export type Candidate = {
  farm: FarmInfo;
  /** Public institution (named) or private land (area only, no owner). */
  privacy: "public" | "private";
  /** Google 3D quality expected from public sources only (city/campus proximity). Not measured. */
  expected3d: "high" | "med" | "low";
  elevation: CandidateDatasetId;
  boundaries: CandidateDatasetId;
  /** The 3D check verdict (FARMS.md). Only "pass" puts a pin on the home globe. */
  validation: "not-validated" | "pass" | "weak" | "fail";
};


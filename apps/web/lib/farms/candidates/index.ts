// Scouted candidate farms (docs/farm-scouting/FARMS.md). One file per farm in this folder.
// A candidate becomes a pin on the home globe only when `validation` is "pass": a person ran /dev/farms-check on it
// (stage-1 numbers) and looked at its oblique and top-down views, then recorded the verdict in FARMS.md. Until then
// it is "not-validated" and appears only in /dev/farms-check. All coordinates are TODO(verify) unless a file says so.
import type { FarmInfo } from "../index";

import { AAFC_SASKATOON } from "./aafc-saskatoon";
import { AGROSCOPE_RECKENHOLZ } from "./agroscope-reckenholz";
import { CIAT_PALMIRA } from "./ciat-palmira";
import { CIMMYT_EL_BATAN } from "./cimmyt-el-batan";
import { CIP_LA_MOLINA } from "./cip-la-molina";
import { ESALQ_PIRACICABA } from "./esalq-piracicaba";
import { HELSINKI_VIIKKI } from "./helsinki-viikki";
import { HOKUDAI_FARM } from "./hokudai-farm";
import { IARI_PUSA } from "./iari-pusa";
import { ICRISAT_PATANCHERU } from "./icrisat-patancheru";
import { IITA_IBADAN } from "./iita-ibadan";
import { ILRI_ADDIS } from "./ilri-addis";
import { ILRI_NAIROBI } from "./ilri-nairobi";
import { IMIDRA_ENCIN } from "./imidra-encin";
import { INTA_CASTELAR } from "./inta-castelar";
import { IRRI_LOS_BANOS } from "./irri-los-banos";
import { MASSEY_DAIRY1 } from "./massey-dairy1";
import { PIRQUE_VINEYARDS } from "./pirque-vineyards";
import { SGGW_SKIERNIEWICE } from "./sggw-skierniewice";
import { SU_WELGEVALLEN } from "./su-welgevallen";
import { TAMU_RESEARCH_FARM } from "./tamu-research-farm";
import { UBC_FARM } from "./ubc-farm";
import { UIUC_SOUTH_FARMS } from "./uiuc-south-farms";
import { UP_HATFIELD } from "./up-hatfield";
import { UTOKYO_ISAS } from "./utokyo-isas";
import { WAITE_ADELAIDE } from "./waite-adelaide";
import { WUR_UNIFARM } from "./wur-unifarm";

/**
 * Open datasets a candidate farm could use. Every URL appeared in a web search on 2026-11-14; the pages themselves
 * could not be opened from the scouting sandbox (network policy), so each licence is TODO(verify) on its page.
 */
export const CANDIDATE_DATASETS = {
  usgs3dep: { name: "USGS 3DEP 1 m DEM", url: "https://catalog.data.gov/dataset/usgs-1-meter-digital-elevation-model", licence: "Public domain (USGS); attribution requested", attribution: "U.S. Geological Survey" },
  canHrdem: { name: "CanElevation HRDEM (lidar DEM)", url: "https://open.canada.ca/data/en/dataset/957782bf-847c-4644-a757-e383c0057995", licence: "Open Government Licence - Canada (version TODO(verify))", attribution: "Natural Resources Canada" },
  copDem30: {
    name: "Copernicus DEM GLO-30",
    url: "https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf",
    licence: "Copernicus DEM licence (free; source notice required)",
    attribution: "Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA",
  },
  ahn4: { name: "AHN4 (Actueel Hoogtebestand Nederland)", url: "https://developers.google.com/earth-engine/datasets/catalog/AHN_AHN4", licence: "CC0 (official ahn.nl page TODO(verify))", attribution: "AHN" },
  brp: { name: "BRP Gewaspercelen (Dutch crop parcels)", url: "https://api.pdok.nl/rvo/gewaspercelen/ogc/v1/collections/brpgewas", licence: "CC0 / public domain", attribution: "RVO / PDOK" },
  swissalti3d: { name: "swissALTI3D", url: "https://opendata.swiss/fr/dataset/swissalti3d", licence: "Swiss open government data, free incl. commercial use; source citation required", attribution: "Federal Office of Topography swisstopo" },
  nlsFi2m: { name: "NLS Finland elevation model 2 m", url: "https://maanmittauslaitos.fi/en/node/10715", licence: "NLS open data, CC BY 4.0 TODO(verify)", attribution: "National Land Survey of Finland" },
  gugikNmt: { name: "GUGiK NMT (Polish digital terrain model)", url: "https://www.geoportal.gov.pl/en/dane/numeryczny-model-terenu", licence: "Free for any use TODO(verify)", attribution: "GUGiK" },
  cnigMdt05: { name: "CNIG MDT05 (PNOA-LiDAR)", url: "https://inspire-geoportal.ec.europa.eu/srv/api/records/spaignMDT05", licence: "CC BY 4.0", attribution: "CC-BY 4.0 scne.es" },
  maffFude: { name: "MAFF fude polygons (Japanese field parcels)", url: "https://www.maff.go.jp/j/tokei/porigon/index.html", licence: "Use on agreeing to MAFF terms; reuse allowed TODO(verify)", attribution: "Ministry of Agriculture, Forestry and Fisheries (Japan)" },
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

/** Ranked: expected Google 3D first, then data potential (FARMS.md). */
export const CANDIDATES: Candidate[] = [
  WUR_UNIFARM,
  AGROSCOPE_RECKENHOLZ,
  HELSINKI_VIIKKI,
  UBC_FARM,
  UTOKYO_ISAS,
  HOKUDAI_FARM,
  WAITE_ADELAIDE,
  UIUC_SOUTH_FARMS,
  IARI_PUSA,
  CIMMYT_EL_BATAN,
  CIP_LA_MOLINA,
  INTA_CASTELAR,
  UP_HATFIELD,
  ESALQ_PIRACICABA,
  IMIDRA_ENCIN,
  SGGW_SKIERNIEWICE,
  MASSEY_DAIRY1,
  TAMU_RESEARCH_FARM,
  AAFC_SASKATOON,
  SU_WELGEVALLEN,
  PIRQUE_VINEYARDS,
  ILRI_NAIROBI,
  ILRI_ADDIS,
  IITA_IBADAN,
  CIAT_PALMIRA,
  ICRISAT_PATANCHERU,
  IRRI_LOS_BANOS,
];

/** Candidates that passed the 3D check: these are added to FARMS (pins). */
export const passedCandidates = () => CANDIDATES.filter((c) => c.validation === "pass");

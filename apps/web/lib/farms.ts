// Public research / demonstration farms pinned on the homepage globe. Never private farms.
// Every fact below was read from the cited page on 2026-11-13. `coordsVerified` is true only when the
// coordinates are printed by the operating institution (or CGIAR's own locations directory for its centres);
// otherwise the point is approximate and the UI says "Approximate location".
import type { Farm } from "@/components/globe/types";

const RADIUS_M = 1500;

export const FARMS: Farm[] = [
  {
    // HERO. Name, operator and address (6947 Highway 7, Agassiz, BC) from the sourceUrl page (Government of Canada
    // science profiles; the lead's research, the host refused connections when re-checked on 2026-11-13).
    // Coordinates: NOT published by AAFC. Derived by geocoding "6947 Highway 7, Agassiz, British Columbia" with
    // OpenStreetMap Nominatim (https://nominatim.openstreetmap.org, data (c) OpenStreetMap contributors, ODbL);
    // the hit is the research institute at 6947 Lougheed Highway. Cross-check: ECCC climate station AGASSIZ_CDA
    // (id 1100120) is at 49.25, -121.77 (https://api.weather.gc.ca/collections/ahccd-trends/items/1100120.Spr.total_precip?f=json).
    // TODO(verify): confirm the farm centre and extent with AAFC. Area (310 ha) seen only in one local newspaper: left out.
    id: "agassiz",
    name: "Agassiz Research and Development Centre",
    owner: "Agriculture and Agri-Food Canada",
    country: "Canada",
    lon: -121.7637,
    lat: 49.2482,
    tier: "twin",
    sourceUrl: "https://profils-profiles.science.gc.ca/en/research-centre/agassiz-research-and-development-centre",
    coordsVerified: false,
    radiusM: RADIUS_M,
  },
  {
    // Coordinates "14.16963; 121.25552" and "Owned by our Center" from the sourceUrl page (CGIAR locations directory).
    // Area: "252 hectares (620 acres) experimental farm", https://en.wikipedia.org/wiki/International_Rice_Research_Institute
    // TODO(verify): confirm the 252 ha on an IRRI page (secondary source only).
    id: "irri-los-banos",
    name: "IRRI Los Baños Campus",
    owner: "International Rice Research Institute (IRRI)",
    country: "Philippines",
    lon: 121.25552,
    lat: 14.16963,
    tier: "explore",
    sourceUrl: "https://www.cgiar.org/locations/philippines-irri-los-banos-campus",
    areaHa: 252,
    coordsVerified: true,
    radiusM: RADIUS_M,
  },
  {
    // Coordinates "17.511542784719; 78.275104393394" and address (Patancheru, Hyderabad, Telangana) from the sourceUrl page.
    // TODO(verify): area (about 1,390 ha per the lead's notes) is not stated on that page: left out.
    id: "icrisat-patancheru",
    name: "ICRISAT Hyderabad Campus",
    owner: "International Crops Research Institute for the Semi-Arid Tropics (ICRISAT)",
    country: "India",
    lon: 78.2751,
    lat: 17.51154,
    tier: "explore",
    sourceUrl: "https://www.cgiar.org/locations/india-icrisat-hyderabad-campus",
    coordsVerified: true,
    radiusM: RADIUS_M,
  },
  {
    // Coordinates "51.80946, -0.37301" printed on the sourceUrl page (Rothamsted's electronic archive, Broadbalk experiment).
    id: "rothamsted-broadbalk",
    name: "Rothamsted Research (Broadbalk experiment)",
    owner: "Rothamsted Research",
    country: "United Kingdom",
    lon: -0.37301,
    lat: 51.80946,
    tier: "explore",
    sourceUrl: "https://era.rothamsted.ac.uk/Broadbalk",
    coordsVerified: true,
    radiusM: RADIUS_M,
  },
  {
    // Operator from the sourceUrl page (USDA ARS). ARS prints no coordinates there, so the point is approximate:
    // "39.0319; -76.8844" from https://en.wikipedia.org/wiki/Henry_A._Wallace_Beltsville_Agricultural_Research_Center
    // (OpenStreetMap Nominatim puts the centre at 39.0307, -76.8802, about 400 m away). Published acreage figures
    // disagree (6,500 to 7,000 acres): area left out.
    id: "usda-barc",
    name: "Beltsville Agricultural Research Center",
    owner: "USDA Agricultural Research Service",
    country: "United States",
    lon: -76.8844,
    lat: 39.0319,
    tier: "explore",
    sourceUrl: "https://www.ars.usda.gov/northeast-area/beltsville-md-barc/",
    coordsVerified: false,
    radiusM: RADIUS_M,
  },
  {
    // Coordinates "7.4962304553497; 3.9075594969404" and address (Oyo road, Idi Ose, Ibadan) from the sourceUrl page.
    // TODO(verify): area (about 1,000 ha in search snippets of iita.org) could not be opened on an IITA page: left out.
    id: "iita-ibadan",
    name: "IITA Ibadan Campus",
    owner: "International Institute of Tropical Agriculture (IITA)",
    country: "Nigeria",
    lon: 3.90756,
    lat: 7.49623,
    tier: "explore",
    sourceUrl: "https://www.cgiar.org/locations/nigeria-iita-ibadan-campus",
    coordsVerified: true,
    radiusM: RADIUS_M,
  },
  {
    // Name and address (Rodovia BR-020, Km 18, Planaltina, DF) from the sourceUrl page. Embrapa prints no coordinates
    // there, so the point is approximate: the building mapped as "Embrapa Cerrados" in OpenStreetMap (way 239051656,
    // via Nominatim, data (c) OpenStreetMap contributors, ODbL). Embrapa's 2,130 ha experimental area is split over
    // seven separate areas, so no single-site area is given here.
    id: "embrapa-cerrados",
    name: "Embrapa Cerrados",
    owner: "Embrapa (Brazilian Agricultural Research Corporation)",
    country: "Brazil",
    lon: -47.7121,
    lat: -15.6042,
    tier: "explore",
    sourceUrl: "https://www.embrapa.br/cerrados",
    coordsVerified: false,
    radiusM: RADIUS_M,
  },
  {
    // Name, "290 hectare facility" and address (117 Cunningar Road, Boorowa NSW 2586) from the sourceUrl page.
    // CSIRO prints no coordinates, so the point is approximate: the feature mapped as "Boorowa Agricultural Research
    // Station" in OpenStreetMap (via Nominatim, data (c) OpenStreetMap contributors, ODbL).
    id: "csiro-boorowa",
    name: "Boorowa Agricultural Research Station",
    owner: "CSIRO",
    country: "Australia",
    lon: 148.6937,
    lat: -34.4711,
    tier: "explore",
    sourceUrl: "https://www.csiro.au/en/about/locations/state-locations/NSW/Boorowa",
    areaHa: 290,
    coordsVerified: false,
    radiusM: RADIUS_M,
  },
];

export const farmById = (id: string | null) => FARMS.find((f) => f.id === id) ?? null;

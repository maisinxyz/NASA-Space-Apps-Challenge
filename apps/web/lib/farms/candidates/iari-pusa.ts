// ICAR-IARI Pusa campus fields (India). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: About 500 ha of research fields in central Delhi; monsoon climate, rice-wheat.
// TODO(verify): location 28.64, 77.16 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://education.gov.in/sites/upload_files/mhrd/files/ebook/universirt-compendium/delhi/Indian-Agricultural-Research-Institute-KRISHI-PUSHA-New-Delhi.pdf (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Source is a government compendium, not the institute's own page.
import type { Candidate } from "./index";

export const IARI_PUSA: Candidate = {
  farm: {
    id: "iari-pusa",
    name: "ICAR-IARI Pusa campus fields",
    owner: "ICAR-Indian Agricultural Research Institute",
    country: "India",
    locality: "Pusa, New Delhi", // TODO(verify): from search results, source page not opened
    lon: 77.16,
    lat: 28.64,
    tier: "explore",
    sourceUrl: "https://education.gov.in/sites/upload_files/mhrd/files/ebook/universirt-compendium/delhi/Indian-Agricultural-Research-Institute-KRISHI-PUSHA-New-Delhi.pdf",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "high",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "not-validated",
};

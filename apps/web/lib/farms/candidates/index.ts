// Scouted candidate farms (docs/farm-scouting/FARMS.md). One file per farm in this folder.
// A candidate becomes a pin on the home globe only when `validation` is "pass": a person ran /dev/farms-check on it
// (stage-1 numbers) and looked at its oblique and top-down views, then recorded the verdict in FARMS.md. Until then
// it is "not-validated" and appears only in /dev/farms-check. This list is dev-only: the app registry imports passing
// farms one by one through ../pinned.ts, never this file, so unvalidated farms are not bundled into the app. All coordinates are TODO(verify) unless a file says so.
import type { Candidate } from "../datasets";

export { CANDIDATE_DATASETS, type Candidate, type CandidateDatasetId } from "../datasets";

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


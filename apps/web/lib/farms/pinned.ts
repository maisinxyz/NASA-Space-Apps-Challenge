// Scouted farms that PASSED the 3D check (docs/farm-scouting/FARMS.md): stage-1 numbers measured in /dev/farms-check
// and an oblique screenshot viewed. Only these become home-globe pins. Each is imported by its own file so that the
// unvalidated candidates (candidates/index.ts, dev only) are never bundled into the app. To pin a farm: set its
// `validation` to "pass" and add it here. Order: ranked for full twins first (FARMS.md).
import { AGROSCOPE_RECKENHOLZ } from "./candidates/agroscope-reckenholz";
import { HELSINKI_VIIKKI } from "./candidates/helsinki-viikki";
import { HOKUDAI_FARM } from "./candidates/hokudai-farm";
import { INTA_CASTELAR } from "./candidates/inta-castelar";
import { UBC_FARM } from "./candidates/ubc-farm";
import { UIUC_SOUTH_FARMS } from "./candidates/uiuc-south-farms";
import { UTOKYO_ISAS } from "./candidates/utokyo-isas";
import { WAITE_ADELAIDE } from "./candidates/waite-adelaide";
import { WUR_UNIFARM } from "./candidates/wur-unifarm";
import type { Candidate } from "./datasets";

export const PINNED: Candidate[] = [WUR_UNIFARM, UBC_FARM, HOKUDAI_FARM, UTOKYO_ISAS, AGROSCOPE_RECKENHOLZ, UIUC_SOUTH_FARMS, WAITE_ADELAIDE, HELSINKI_VIIKKI, INTA_CASTELAR];

// University of Nebraska–Lincoln research fields, Mead NE (explore only). AmeriFlux tower sites US-Ne1 / US-Ne3.
// Coordinates 41.1797, -96.4397 printed on https://ameriflux.lbl.gov/sites/siteinfo/US-Ne3 (verified 2026-11-13;
// US-Ne1 is at 41.1651, -96.4766 per https://ameriflux.lbl.gov/sites/siteinfo/US-Ne1). coordsVerified is true for
// that tower point, not for any field boundary. Ground (flux and soil) measurements exist here: the card links them.
// TODO(verify): Google 3D quality at this point before the demo (plan Phase A, Mead screenshot check).
import type { FarmInfo } from "./index";
import { MEAD_FRAMING } from "./traced/framings";

export const MEAD: FarmInfo = {
  id: "unl-mead",
  name: "University of Nebraska–Lincoln research fields, Mead NE",
  owner: "University of Nebraska–Lincoln",
  country: "United States",
  lon: -96.4397,
  lat: 41.1797,
  tier: "explore",
  sourceUrl: "https://ameriflux.lbl.gov/sites/siteinfo/US-Ne3",
  coordsVerified: true,
  radiusM: 1500,
  framing: MEAD_FRAMING,
  note: {
    text: "In-ground data exists here: AmeriFlux tower measurements (flux and soil) for these research fields. The 3D imagery is flat here; it reads best from above.",
    url: "https://ameriflux.lbl.gov/sites/siteinfo/US-Ne3",
    linkText: "AmeriFlux site US-Ne3",
  },
};

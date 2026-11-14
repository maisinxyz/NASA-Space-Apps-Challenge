// Oakville Grade area, Napa Valley CA (explore only), near the UC Davis Oakville Experimental Vineyard.
// The point -122.4121, 38.4201 is a neighbouring vineyard point, not the UC Davis plot (approximate).
// Source: UC Davis "Oakville Vineyard" page, https://wine.ucdavis.edu/node/571 (found by web search 2026-11-13; the
// page returned HTTP 403 to our fetch, so its contents are unread).
// TODO(verify): the UC Davis plot location and boundaries, then move the pin and name the operator.
import type { FarmInfo } from "./index";
import { OAKVILLE_FRAMING } from "./traced/framings";

export const OAKVILLE: FarmInfo = {
  id: "ucdavis-oakville",
  name: "Oakville Grade area, Napa Valley (near the UC Davis Oakville Experimental Vineyard)",
  owner: "Area only (UC Davis plot location not yet verified)",
  country: "United States",
  locality: "Napa Valley, California", // from the source cited above
  lon: -122.4121,
  lat: 38.4201,
  tier: "explore",
  sourceUrl: "https://wine.ucdavis.edu/node/571",
  coordsVerified: false,
  radiusM: 1500,
  framing: OAKVILLE_FRAMING,
};

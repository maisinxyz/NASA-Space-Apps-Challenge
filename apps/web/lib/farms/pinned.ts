// Scouted farms that PASSED the 3D check (docs/farm-scouting/FARMS.md): stage-1 numbers measured in /dev/farms-check
// and screenshots viewed. Only these become home-globe pins. Each is imported by its own file so that the unvalidated
// candidates (candidates/index.ts, dev only) are never bundled into the app. To pin a farm: set its `validation` to
// "pass" and add it here.
import type { Candidate } from "./datasets";

export const PINNED: Candidate[] = [];

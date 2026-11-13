// Guided demo script: the 8 hero beats of PRD section1-web-3d §3, as plain data.
// Each patch sets every key the tour touches, so Back restores that beat exactly; the one exception is
// beat 6, which keeps timeMin so the water stays where the replay stopped.
// Data-dependent choices (which field, storm, rotations) are left to the pages' defaults.
import type { AppState } from "./store";

export interface TourStep {
  beat: number;
  title: string;
  route: string;
  patch: Partial<AppState>;
  durationMs: number;
  caption: string;
}

const still = { playing: false, showDiff: false, mode: "single", timeMin: 0 } as const;

export const TOUR: TourStep[] = [
  { beat: 1, title: "Pick a site", route: "/explore", patch: { ...still }, durationMs: 6000, caption: "Start from a pre-built site, or scan your own land." },
  { beat: 2, title: "Terraform", route: "/viewer", patch: { ...still, selectedFieldId: null, layers: [] }, durationMs: 9000, caption: "A flat plane rises into the terrain shape. Height is exaggerated x1.5 so slopes are visible." },
  { beat: 3, title: "Select a field", route: "/viewer", patch: { ...still, layers: ["slope"] }, durationMs: 9000, caption: "Pick a field to see its area, an illustrative crop, and its mean slope derived from the elevation grid." },
  { beat: 4, title: "Choose a storm", route: "/simulate", patch: { ...still }, durationMs: 9000, caption: "Real storms come from NASA POWER daily data; a flag shows when the hourly profile is synthetic." },
  { beat: 5, title: "A/B replay", route: "/simulate", patch: { ...still, mode: "split", playing: true }, durationMs: 16000, caption: "The same storm replays on two rotations side by side, same camera, same time." },
  { beat: 6, title: "Difference", route: "/simulate", patch: { playing: false, mode: "split", showDiff: true }, durationMs: 10000, caption: "The glow shows where peak water depth differs between B and A. A relative comparison, not a prediction." },
  { beat: 7, title: "Evidence", route: "/lab", patch: { ...still }, durationMs: 12000, caption: "Each rotation gets an evidence card: why, evidence, benefits, gaps, and risks for local review." },
  { beat: 8, title: "Honesty", route: "/methods", patch: { ...still }, durationMs: 8000, caption: "Every dataset is listed with source, licence and basis. This tool supports, and does not replace, local agronomic expertise." },
];

export const tourDurationMs = (steps: TourStep[] = TOUR) => steps.reduce((t, s) => t + s.durationMs, 0);

// Agassiz twin: the three rotations to compare, and the pure logic behind the Compare screen.
// IDs reuse the contract's rotation fixtures (packages/contracts/fixtures/rotations/terr_mock_hills.json):
// rot_existing, rot_cover, rot_forage. Crop timing follows the season windows in packages/contracts/fixtures/crops.json
// (corn planted ~mid-May, harvested ~mid-Sep; winter wheat sown ~early Oct, harvested ~late Jul; rye cover sown
// after harvest, ended ~end of Apr). Those windows are marked `to_verify` in the fixture.
// TODO(verify): Fraser Valley planting/harvest months with a local agronomist or BC Ministry of Agriculture guides.
import type { CropLook, FarmField } from "@/components/globe/types";
import { SUPPORT_SENTENCE } from "@/components/ui/SupportBanner";
import type { EvidenceCard } from "@/lib/api/types";

export const PRIORITIES = ["water", "erosion", "soilCover", "income"] as const;
export type Priority = (typeof PRIORITIES)[number];
export type Weights = Record<Priority, number>;

export const PRIORITY_LABELS: Record<Priority, string> = {
  water: "Water conservation",
  erosion: "Erosion control",
  soilCover: "Soil cover",
  income: "Income suitability",
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export const CROP_LABELS: Record<CropLook, string> = {
  grass: "Grass / forage",
  corn: "Silage corn",
  cereal: "Winter wheat",
  legume: "Alfalfa (legume)",
  cover: "Cereal rye cover crop",
  berry: "Berries",
  bare: "Bare soil",
};

export type TwinRotation = {
  id: `rot_${string}`;
  name: string;
  isExisting: boolean;
  /** One row per rotation year, 12 months each (Jan–Dec): what covers the ground that month. */
  years: CropLook[][];
  /** 1 (weak) to 5 (strong). Our assumption, relative between these three only. */
  scores: Record<Priority, number>;
  card: EvidenceCard;
};

const B = "bare";
// Shared evidence lines: general agronomy principles, no site measurements yet.
const COVER_PRINCIPLE = "General soil-conservation principle: living plants and residue protect the soil surface from raindrop impact and slow runoff, so fewer bare months usually means less erosion risk.";
const ROOTS_PRINCIPLE = "Soil-health principles promoted by USDA NRCS include keeping the soil covered and keeping living roots in the ground as long as possible."; // TODO(verify): wording against an NRCS soil-health page.
const WET_WINTER = "Coastal BC has its wettest months in late autumn and winter, so bare soil in that period is the main concern."; // TODO(verify): check against NASA POWER monthly precipitation for Agassiz (card C6).

export const ROTATIONS: TwinRotation[] = [
  {
    id: "rot_existing",
    name: "Silage corn / winter wheat",
    isExisting: true,
    years: [
      [B, B, B, B, B, "corn", "corn", "corn", "corn", B, "cereal", "cereal"],
      ["cereal", "cereal", "cereal", "cereal", "cereal", "cereal", "cereal", B, B, B, B, B],
    ],
    scores: { water: 2, erosion: 2, soilCover: 2, income: 4 },
    card: {
      rotation_id: "rot_existing",
      why_suggested: "This is the illustrative current rotation: the baseline the other two are compared against.",
      evidence: [COVER_PRINCIPLE, WET_WINTER],
      benefits: ["Familiar crops and equipment.", "Silage corn feeds a dairy or livestock system directly."],
      information_gaps: ["Real crops and dates on this farm are not public: this sequence is illustrative.", "No measured soil, drainage or yield data for these fields."],
      risks_for_local_review: ["Long bare spells after corn harvest and after wheat harvest, overlapping the wet season.", "Nutrients left after corn may be lost over a wet winter without a cover crop."],
      support_not_replace: SUPPORT_SENTENCE,
    },
  },
  {
    id: "rot_cover",
    name: "Silage corn / winter wheat + rye cover",
    isExisting: false,
    years: [
      ["cover", "cover", "cover", "cover", B, "corn", "corn", "corn", "corn", B, "cereal", "cereal"],
      ["cereal", "cereal", "cereal", "cereal", "cereal", "cereal", "cereal", B, "cover", "cover", "cover", "cover"],
    ],
    scores: { water: 3, erosion: 4, soilCover: 5, income: 3 },
    card: {
      rotation_id: "rot_cover",
      why_suggested: "Keeps the same cash crops but fills the bare gap after wheat with a cereal rye cover crop that holds the soil over winter.",
      evidence: [COVER_PRINCIPLE, ROOTS_PRINCIPLE, "Cover crops sown after harvest are a widely used practice to take up leftover nutrients before winter rain."],
      benefits: ["Fewest bare months of the three.", "Same main crops, so little change to feed supply or equipment."],
      information_gaps: ["Whether rye can be sown early enough after wheat harvest in a typical year here.", "Local seed cost and labour for an extra sowing and termination."],
      risks_for_local_review: ["Rye left too long in spring can delay corn planting or tie up nitrogen.", "Extra field passes on wet soil can compact it."],
      support_not_replace: SUPPORT_SENTENCE,
    },
  },
  {
    id: "rot_forage",
    name: "Silage corn / alfalfa / alfalfa",
    isExisting: false,
    years: [
      [B, B, B, B, B, "corn", "corn", "corn", "corn", B, B, B],
      [B, B, B, B, "legume", "legume", "legume", "legume", "legume", "legume", "legume", "legume"],
      Array<CropLook>(12).fill("legume"),
    ],
    scores: { water: 3, erosion: 4, soilCover: 3, income: 3 },
    card: {
      rotation_id: "rot_forage",
      why_suggested: "Adds a two-year perennial legume forage that fixes nitrogen and keeps living roots in the soil, while still supplying feed.",
      evidence: [ROOTS_PRINCIPLE, "Legumes such as alfalfa fix atmospheric nitrogen through root nodules, which can reduce nitrogen needed by the following crop."],
      benefits: ["No bare months in the third year.", "Perennial roots and less tillage can improve soil structure over time.", "Forage fits a dairy system."],
      information_gaps: ["Field drainage: alfalfa does poorly on wet, poorly drained soils.", "Whether the farm needs the corn silage it would give up in years 2 and 3."],
      risks_for_local_review: ["Bare soil after corn and before alfalfa establishes (autumn to spring of year 1).", "Alfalfa stand failure on wet or acidic soils."],
      support_not_replace: SUPPORT_SENTENCE,
    },
  },
];

export const rotationById = (id: string) => ROTATIONS.find((r) => r.id === id);

/** Months with bare soil in each rotation year, and the share of all months that are bare (0–1). Basis: derived. */
export function bareMonths(r: Pick<TwinRotation, "years">) {
  const perYear = r.years.map((y) => y.filter((c) => c === "bare").length);
  const total = perYear.reduce((a, b) => a + b, 0);
  return { perYear, total, share: total / (r.years.length * 12) };
}

/** Weighted sum of the assumed scores; highest first. Ties keep the input order (existing first). */
export function rankRotations<T extends Pick<TwinRotation, "scores">>(rotations: T[], w: Weights) {
  return rotations
    .map((r, i) => ({ r, i, total: PRIORITIES.reduce((s, p) => s + w[p] * r.scores[p], 0) }))
    .sort((a, b) => b.total - a.total || a.i - b.i)
    .map(({ r, total }) => ({ rotation: r, total }));
}

/** Crop look per field for a rotation at (year, month). Rotating fields are offset by their phase; others keep their crop. */
export function cropsForSeason(fields: FarmField[], phases: Record<string, number>, r: Pick<TwinRotation, "years">, year: number, month: number) {
  const out: Record<string, CropLook> = {};
  for (const f of fields) {
    const phase = phases[f.id];
    out[f.id] = phase === undefined ? f.crop : r.years[(year + phase) % r.years.length][month];
  }
  return out;
}

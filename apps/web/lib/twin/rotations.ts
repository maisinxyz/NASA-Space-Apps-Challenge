// Twin rotations: the regional rotation sets each twin farm compares, and the pure logic behind the Compare screen.
// A farm's config (lib/farms/<id>.ts) names its set by `rotationSet`. Every set has exactly three rotations, ids
// rot_existing (baseline), rot_cover, and one regional third option, so the store's defaults work for every farm.
// Crop months are typical regional season windows, not observed on these fields. Scores are team assumptions
// (1 weak .. 5 strong), relative within one set only. No yields, profits or soil-loss figures.
// TODO(verify): planting/harvest months with Cornell Cooperative Extension (NY) and University of Maryland Extension (MD).
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
  // Proxy only: FieldTwin gives no profit figures. Wording not validated with farmers (docs/progress/s1-phase1-3-product.md).
  income: "Economic fit (proxy)",
};

/** Default priority weight (middle of 0–5): equal weights, so no priority is favoured until the user says so. */
export const DEFAULT_WEIGHT = 3;
export const DEFAULT_WEIGHTS: Weights = { water: DEFAULT_WEIGHT, erosion: DEFAULT_WEIGHT, soilCover: DEFAULT_WEIGHT, income: DEFAULT_WEIGHT };

export const PRIORITIES_NOTE = "Priorities change how options are ranked; they do not change scenario results.";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Generic crop names; each farm's config gives its own regional names for the same looks (lib/farms/<id>.ts). */
export const CROP_LABELS: Record<CropLook, string> = {
  grass: "Grass / pasture",
  corn: "Corn",
  cereal: "Small grain",
  legume: "Legume",
  cover: "Cover crop",
  berry: "Berries",
  bare: "Bare soil",
};

export type TwinRotation = {
  id: `rot_${string}`;
  name: string;
  isExisting: boolean;
  /** One row per rotation year, 12 months each (Jan–Dec): what covers the ground that month. */
  years: CropLook[][];
  /** 1 (weak) to 5 (strong). Our assumption, relative between the three rotations of one set only. */
  scores: Record<Priority, number>;
  card: EvidenceCard;
};

const B = "bare";
const C = "corn";
const G = "cereal";
const L = "legume";
const V = "cover";
// Shared evidence lines: general agronomy principles, no site measurements yet.
const COVER_PRINCIPLE = "General soil-conservation principle: living plants and residue protect the soil surface from raindrop impact and slow runoff, so fewer bare months usually means less erosion risk.";
const ROOTS_PRINCIPLE = "Soil-health principles promoted by USDA NRCS include keeping the soil covered and keeping living roots in the ground as long as possible."; // TODO(verify): wording against an NRCS soil-health page.
const LEGUME_PRINCIPLE = "Legumes such as alfalfa and soybean fix nitrogen from the air through root nodules, which can reduce the nitrogen needed by the following crop.";
const NY_SPRING = "In upstate New York, snowmelt and spring rain on thawing, bare soil is a common time for runoff and soil loss."; // TODO(verify): check against NASA POWER monthly precipitation for Harford, NY.
const MD_RAIN = "Central Maryland gets rain in every season, so soil left bare over winter and early spring is exposed to it."; // TODO(verify): check against NASA POWER monthly precipitation for Beltsville, MD.
const NO_RECORDS = "Real crops and dates on this farm are not public: this sequence is illustrative.";
const NO_SITE_DATA = "No measured soil, drainage or slope data for these fields.";

/**
 * Upstate New York dairy (Cornell Ruminant Center, Harford NY). Corn silage ~mid-May to ~mid-Sep, winter rye cover
 * sown after silage harvest, oats as a nurse crop for alfalfa–grass hay.
 */
const NY_DAIRY: TwinRotation[] = [
  {
    id: "rot_existing",
    name: "Corn silage, two years",
    isExisting: true,
    years: [
      [B, B, B, B, B, C, C, C, C, B, B, B],
      [B, B, B, B, B, C, C, C, C, B, B, B],
    ],
    scores: { water: 2, erosion: 1, soilCover: 1, income: 4 },
    card: {
      rotation_id: "rot_existing",
      why_suggested: "This is the illustrative current rotation: the baseline the other two are compared against.",
      evidence: [COVER_PRINCIPLE, NY_SPRING],
      benefits: ["Simple: one crop and one set of equipment.", "Corn silage feeds the dairy herd directly."],
      information_gaps: [NO_RECORDS, NO_SITE_DATA],
      risks_for_local_review: ["Silage harvest removes almost all residue, so the soil is bare from autumn to late spring.", "Bare soil during snowmelt and spring rain."],
      support_not_replace: SUPPORT_SENTENCE,
    },
  },
  {
    id: "rot_cover",
    name: "Corn silage + winter rye cover",
    isExisting: false,
    years: [
      [V, V, V, V, B, C, C, C, C, B, V, V],
      [V, V, V, V, B, C, C, C, C, B, V, V],
    ],
    scores: { water: 3, erosion: 4, soilCover: 4, income: 3 },
    card: {
      rotation_id: "rot_cover",
      why_suggested: "Keeps corn silage but sows winter rye right after harvest, so living plants hold the soil over winter and through snowmelt.",
      evidence: [COVER_PRINCIPLE, ROOTS_PRINCIPLE, "Cover crops sown after harvest are a widely used practice to take up leftover nutrients before winter."],
      benefits: ["Far fewer bare months than the baseline.", "Same main crop, so little change to feed supply."],
      information_gaps: ["Whether rye can be sown early enough after silage harvest in a typical year here.", "Seed cost and labour for an extra sowing and spring termination."],
      risks_for_local_review: ["Rye left too long in spring can delay corn planting or dry out the seedbed.", "Extra field passes on wet spring soil can compact it."],
      support_not_replace: SUPPORT_SENTENCE,
    },
  },
  {
    id: "rot_forage",
    name: "Corn silage / oats + alfalfa–grass / hay",
    isExisting: false,
    years: [
      [B, B, B, B, B, C, C, C, C, B, V, V],
      [V, V, V, B, G, G, G, L, L, L, L, L],
      Array<CropLook>(12).fill(L),
    ],
    scores: { water: 3, erosion: 5, soilCover: 4, income: 3 },
    card: {
      rotation_id: "rot_forage",
      why_suggested: "Rotates corn silage into perennial alfalfa–grass hay, sown under an oat nurse crop, so living roots stay in the soil and the herd still gets forage.",
      evidence: [ROOTS_PRINCIPLE, LEGUME_PRINCIPLE],
      benefits: ["No bare months in the hay year.", "Perennial roots and less tillage can improve soil structure over time.", "Hay and silage both feed a dairy herd."],
      information_gaps: ["Field drainage: alfalfa does poorly on wet, poorly drained soils.", "How much corn silage the herd needs in the years given to hay."],
      risks_for_local_review: ["Bare soil between silage harvest and the cover crop in year 1.", "Alfalfa stand failure on wet or acidic soils."],
      support_not_replace: SUPPORT_SENTENCE,
    },
  },
];

/**
 * Mid-Atlantic grain (Beltsville, MD). Corn ~May to ~Sep, full-season soybean ~Jun to ~Oct, winter wheat sown ~Oct
 * and harvested ~Jun, double-crop soybean after wheat ~Jul to ~Oct, cereal rye cover after harvest.
 */
const MD_GRAIN: TwinRotation[] = [
  {
    id: "rot_existing",
    name: "Corn / soybean",
    isExisting: true,
    years: [
      [B, B, B, B, C, C, C, C, C, B, B, B],
      [B, B, B, B, B, L, L, L, L, L, B, B],
    ],
    scores: { water: 2, erosion: 2, soilCover: 2, income: 4 },
    card: {
      rotation_id: "rot_existing",
      why_suggested: "This is the illustrative current rotation: the baseline the other two are compared against.",
      evidence: [COVER_PRINCIPLE, MD_RAIN],
      benefits: ["Familiar crops and equipment.", "Soybean fixes some of its own nitrogen."],
      information_gaps: [NO_RECORDS, NO_SITE_DATA],
      risks_for_local_review: ["Bare soil from harvest to the next planting, through winter and spring rain.", "Nutrients left after harvest may wash away over winter without a cover crop."],
      support_not_replace: SUPPORT_SENTENCE,
    },
  },
  {
    id: "rot_cover",
    name: "Corn / soybean + rye cover",
    isExisting: false,
    years: [
      [V, V, V, V, C, C, C, C, C, B, V, V],
      [V, V, V, V, B, L, L, L, L, L, V, V],
    ],
    scores: { water: 3, erosion: 4, soilCover: 5, income: 3 },
    card: {
      rotation_id: "rot_cover",
      why_suggested: "Keeps corn and soybean but adds a cereal rye cover crop after each harvest to hold the soil over winter.",
      evidence: [COVER_PRINCIPLE, ROOTS_PRINCIPLE, "Cover crops sown after harvest are a widely used practice to take up leftover nutrients before winter rain."],
      benefits: ["Fewest bare months of the three.", "Same cash crops and equipment."],
      information_gaps: ["Whether rye can be sown early enough after soybean harvest.", "Seed cost and labour for an extra sowing and termination."],
      risks_for_local_review: ["Rye left too long in spring can delay planting or tie up nitrogen.", "Extra field passes on wet soil can compact it."],
      support_not_replace: SUPPORT_SENTENCE,
    },
  },
  {
    id: "rot_wheat",
    name: "Corn / wheat / double-crop soybean",
    isExisting: false,
    years: [
      [B, B, B, B, C, C, C, C, C, G, G, G],
      [G, G, G, G, G, G, L, L, L, L, B, B],
    ],
    scores: { water: 3, erosion: 3, soilCover: 4, income: 4 },
    card: {
      rotation_id: "rot_wheat",
      why_suggested: "Sows winter wheat after corn and a second soybean crop right after the wheat harvest: three crops in two years, with the soil covered most of the time.",
      evidence: [COVER_PRINCIPLE, LEGUME_PRINCIPLE],
      benefits: ["Winter wheat covers the soil from autumn to early summer.", "Three harvests in two years."],
      information_gaps: ["Whether double-crop soybean has enough season left after wheat in a typical year here.", "Local grain prices and contracts for wheat."],
      risks_for_local_review: ["A dry summer can hurt the late-planted soybean.", "Bare soil before corn in spring of year 1 and after soybean in year 2."],
      support_not_replace: SUPPORT_SENTENCE,
    },
  },
];

export const ROTATION_SETS = { "ny-dairy": NY_DAIRY, "md-grain": MD_GRAIN } satisfies Record<string, TwinRotation[]>;
export type RotationSetId = keyof typeof ROTATION_SETS;

/** A rotation of the given set by id. */
export const rotationById = (rotations: TwinRotation[], id: string) => rotations.find((r) => r.id === id);

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

/** A score in words against the existing rotation's score for the same priority. */
export function vsBaseline(score: number, baseline: number): "lower" | "similar" | "higher" {
  return score > baseline ? "higher" : score < baseline ? "lower" : "similar";
}

type Ranked = { rotation: Pick<TwinRotation, "name" | "isExisting" | "scores">; total: number }[];

const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** One sentence saying why the first-ranked rotation is first (compared with the second), from the weights alone. */
export function explainRanking(ranked: Ranked, w: Weights): string {
  const [top, next] = ranked;
  if (!top) return "";
  if (!next) return `${top.rotation.name} is the only option.`;
  if (PRIORITIES.every((p) => w[p] === 0)) return "All priorities are set to 0, so the rotations are not ranked and keep their original order.";
  if (top.total === next.total) {
    const why = top.rotation.isExisting ? "it is the existing rotation" : "it comes first in the list";
    return `${top.rotation.name} and ${next.rotation.name} tie on your priorities; ${top.rotation.name} is listed first only because ${why}.`;
  }
  // The priorities where the top option beats the runner-up, biggest weighted gain first (at most two named).
  const gains = PRIORITIES.map((p) => ({ p, g: w[p] * (top.rotation.scores[p] - next.rotation.scores[p]) }))
    .filter((x) => x.g > 0)
    .sort((a, b) => b.g - a.g)
    .slice(0, 2)
    .map((x) => PRIORITY_LABELS[x.p].toLowerCase());
  return `${top.rotation.name} is first because, with the weights you set, it scores higher than ${next.rotation.name} on ${list(gains)}.`;
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

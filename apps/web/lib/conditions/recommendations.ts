// What a farmer can do about each condition: for the selected forecast year (illustrative spatial values; no current-conditions advice).
// Three bands per condition by how dark the layer is (low < 1/3 <= mid < 2/3 <= high).
import type { CondId } from "./model";

type Bands = [low: string, mid: string, high: string];
export type Rec = { year: Bands };

export const RECS: Record<CondId, Rec> = {
  heat: {
    year: ["Heat is manageable; keep normal planting dates.", "Shift heat-sensitive crops (lettuce, brassicas) to spring and fall slots; use shade cloth in July.", "Plan heat-tolerant varieties, plant earlier, and schedule irrigation for early morning on hot spells."],
  },
  temp: {
    year: ["Season is close to today; keep current crop calendar.", "Expect a slightly longer season; trial one extra late-season planting.", "Warmer seasons: move planting 1–2 weeks earlier and test longer-season varieties."],
  },
  lastFrost: {
    year: ["Spring frost clears early; normal transplant dates are safe.", "Keep row cover on hand for transplants in late April.", "Late frost risk: delay tender transplants until mid-May or protect with row cover."],
  },
  firstFrost: {
    year: ["Fall frost arrives late; there is room for a late crop.", "Time fall plantings so they mature before late October.", "Early fall frost: harvest frost-tender crops by early October and sow cover crops sooner."],
  },
  rain: {
    year: ["Drier year: lean on irrigation and mulch to hold moisture.", "Typical rainfall: keep the normal irrigation plan.", "Wet year: improve drainage, avoid working wet soil, and watch for root disease."],
  },
  extremeRain: {
    year: ["Few downpours expected; normal practice.", "Keep soil covered between crops to absorb heavy rain.", "Frequent downpours: keep living cover, add grassed waterways, and avoid bare beds in fall."],
  },
  et: {
    year: ["Water loss is slow; standard irrigation is fine.", "Mulch beds and water early in the day to cut evaporation.", "Fast water loss: mulch heavily, switch to drip, and irrigate on ET-based schedules."],
  },
  soilMoist: {
    year: ["Soil moisture near normal.", "Root-zone drying in summer: add organic matter and mulch.", "Soil much drier than normal: prioritise drip irrigation and deep-rooted crops."],
  },
  waterBal: {
    year: ["Water balance is close to even; normal irrigation.", "Summer deficit: schedule irrigation for July–August peaks.", "Large deficit: reduce thirsty crops, store winter water, and irrigate by need, not calendar."],
  },
  groundwater: {
    year: ["Regional groundwater steady.", "Groundwater slowly falling; track well levels each season.", "Groundwater falling: cut irrigation demand and favour drought-tolerant rotations."],
  },
  vulnSeason: {
    year: ["Few weeks of crop stress expected.", "Some stress weeks: protect crops at their sensitive stages (flowering, seedling).", "Many stress weeks: change planting dates so sensitive stages miss the worst weeks."],
  },
  bare: {
    year: ["Fields stay covered most of the year.", "Some bare weeks: add a quick cover crop after harvest.", "Long bare windows: sow cover crops right after harvest and consider an under-sown crop."],
  },
  erosion: {
    year: ["Low erosion risk.", "Keep slopes covered and till across the slope.", "High erosion risk on the shaded zones: keep permanent cover or grass strips there."],
  },
  waterStress: {
    year: ["Little water stress.", "Water the shaded zones first in dry spells.", "Hotspots dry out fastest: put drip lines and mulch there first."],
  },
  frostPocket: {
    year: ["Low frost-pocket risk.", "Avoid tender crops in the shaded low spots in spring.", "Cold air pools here: grow hardy crops in these spots and keep tender crops on higher ground."],
  },
  soilOm: {
    year: ["Organic matter is lower: add compost and cover crops.", "Organic matter holding: keep the rotation and cover crops.", "Organic matter rising: the rotation is rebuilding soil; keep it."],
  },
  nitrogen: {
    year: ["Nitrogen is short: add a legume (pea, clover) to the rotation.", "Nitrogen near balanced: fine-tune fertilizer to soil tests.", "Nitrogen surplus: cut synthetic N and watch for leaching."],
  },
  infiltration: {
    year: ["Less rain soaks in: reduce tillage and add organic matter.", "Infiltration steady.", "More rain soaks in: soil structure is improving; keep it."],
  },
  runoff: {
    year: ["Little runoff.", "Some runoff: keep soil covered over winter.", "Heavy runoff: add grass strips and cover crops, avoid bare fall soil."],
  },
  pest: {
    year: ["Pest cycle broken by rotation.", "Pressure building: rotate to a different plant family next year.", "Pest pressure high: break the host cycle with a different crop family and scout weekly."],
  },
  quota: {
    year: ["Water demand within supply.", "Demand close to supply: prioritise water for high-value crops.", "Demand above supply: switch some fields to drought-tolerant crops and use drip."],
  },
};

export const band = (sev: number) => (sev < 1 / 3 ? 0 : sev < 2 / 3 ? 1 : 2);

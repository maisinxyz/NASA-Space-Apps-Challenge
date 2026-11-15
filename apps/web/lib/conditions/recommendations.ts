// What a farmer can do about each condition: for the selected forecast year, and right now (next 12 months).
// Three bands per condition by how dark the layer is (low < 1/3 <= mid < 2/3 <= high).
import type { CondId } from "./model";

type Bands = [low: string, mid: string, high: string];
export type Rec = { year: Bands; now: Bands };

export const RECS: Record<CondId, Rec> = {
  heat: {
    year: ["Heat is manageable; keep normal planting dates.", "Shift heat-sensitive crops (lettuce, brassicas) to spring and fall slots; use shade cloth in July.", "Plan heat-tolerant varieties, plant earlier, and schedule irrigation for early morning on hot spells."],
    now: ["No action needed; note which beds ran hottest last summer.", "Order shade cloth and heat-tolerant seed before spring catalogues sell out.", "Budget for shade cloth and drip lines, and pick heat-tolerant varieties for next season now."],
  },
  temp: {
    year: ["Season is close to today; keep current crop calendar.", "Expect a slightly longer season; trial one extra late-season planting.", "Warmer seasons: move planting 1–2 weeks earlier and test longer-season varieties."],
    now: ["Keep records of planting and harvest dates to track drift.", "Plan one trial bed with an earlier planting date next spring.", "Rework next year's planting calendar earlier and add a trial of longer-season crops."],
  },
  lastFrost: {
    year: ["Spring frost clears early; normal transplant dates are safe.", "Keep row cover on hand for transplants in late April.", "Late frost risk: delay tender transplants until mid-May or protect with row cover."],
    now: ["No action needed.", "Check row-cover stock and repair hoops over winter.", "Buy frost cloth and plan to start tender crops under cover."],
  },
  firstFrost: {
    year: ["Fall frost arrives late; there is room for a late crop.", "Time fall plantings so they mature before late October.", "Early fall frost: harvest frost-tender crops by early October and sow cover crops sooner."],
    now: ["Consider adding a late fall crop next year.", "Mark the fall-frost date on next year's plan.", "Move next year's cover-crop seeding earlier and pick shorter-season fall crops."],
  },
  rain: {
    year: ["Drier year: lean on irrigation and mulch to hold moisture.", "Typical rainfall: keep the normal irrigation plan.", "Wet year: improve drainage, avoid working wet soil, and watch for root disease."],
    now: ["Check irrigation lines and mulch supply before spring.", "No change needed; keep drainage ditches clear.", "Clear drains and plan raised beds for the wettest fields this winter."],
  },
  extremeRain: {
    year: ["Few downpours expected; normal practice.", "Keep soil covered between crops to absorb heavy rain.", "Frequent downpours: keep living cover, add grassed waterways, and avoid bare beds in fall."],
    now: ["No action needed.", "Sow a winter cover crop on any bare beds now.", "Get cover on every bare bed before winter and check where water pools after storms."],
  },
  et: {
    year: ["Water loss is slow; standard irrigation is fine.", "Mulch beds and water early in the day to cut evaporation.", "Fast water loss: mulch heavily, switch to drip, and irrigate on ET-based schedules."],
    now: ["No action needed.", "Stock up on straw or mulch for next summer.", "Plan a drip-irrigation upgrade for the thirstiest beds before next season."],
  },
  soilMoist: {
    year: ["Soil moisture near normal.", "Root-zone drying in summer: add organic matter and mulch.", "Soil much drier than normal: prioritise drip irrigation and deep-rooted crops."],
    now: ["Keep building soil organic matter.", "Add compost this winter to hold more water next summer.", "Add compost now and plan deep-rooted crops for the driest fields."],
  },
  waterBal: {
    year: ["Water balance is close to even; normal irrigation.", "Summer deficit: schedule irrigation for July–August peaks.", "Large deficit: reduce thirsty crops, store winter water, and irrigate by need, not calendar."],
    now: ["No action needed.", "Check how much irrigation water is available for next summer.", "Look into water storage (tanks, pond) and plan lower-water crops for next summer."],
  },
  groundwater: {
    year: ["Regional groundwater steady.", "Groundwater slowly falling; track well levels each season.", "Groundwater falling: cut irrigation demand and favour drought-tolerant rotations."],
    now: ["Note well levels once a season.", "Start logging well or supply levels monthly.", "Talk to the water supplier about future limits and plan lower-water crops."],
  },
  vulnSeason: {
    year: ["Few weeks of crop stress expected.", "Some stress weeks: protect crops at their sensitive stages (flowering, seedling).", "Many stress weeks: change planting dates so sensitive stages miss the worst weeks."],
    now: ["No action needed.", "Mark the stress weeks on next season's calendar.", "Reschedule next year's plantings around the forecast stress weeks."],
  },
  bare: {
    year: ["Fields stay covered most of the year.", "Some bare weeks: add a quick cover crop after harvest.", "Long bare windows: sow cover crops right after harvest and consider an under-sown crop."],
    now: ["Keep current cover-crop practice.", "Order cover-crop seed (fall rye, clover) for after this season's harvest.", "Sow cover crops on bare beds now and plan under-sowing for next year."],
  },
  erosion: {
    year: ["Low erosion risk.", "Keep slopes covered and till across the slope.", "High erosion risk on the shaded zones: keep permanent cover or grass strips there."],
    now: ["No action needed.", "Walk the shaded zones after the next heavy rain and look for rills.", "Put straw or cover on the shaded zones before winter rains."],
  },
  waterStress: {
    year: ["Little water stress.", "Water the shaded zones first in dry spells.", "Hotspots dry out fastest: put drip lines and mulch there first."],
    now: ["No action needed.", "Check soil moisture in the shaded zones in summer.", "Plan drip lines for the shaded zones before next summer."],
  },
  frostPocket: {
    year: ["Low frost-pocket risk.", "Avoid tender crops in the shaded low spots in spring.", "Cold air pools here: grow hardy crops in these spots and keep tender crops on higher ground."],
    now: ["No action needed.", "Note which low spots frost first this winter.", "Move next year's tender crops out of the shaded pockets."],
  },
  soilOm: {
    year: ["Organic matter is lower: add compost and cover crops.", "Organic matter holding: keep the rotation and cover crops.", "Organic matter rising: the rotation is rebuilding soil; keep it."],
    now: ["Add compost or manure this winter and plan cover crops.", "Keep the cover-crop plan.", "Keep current practice; take a soil test to confirm the gain."],
  },
  nitrogen: {
    year: ["Nitrogen is short: add a legume (pea, clover) to the rotation.", "Nitrogen near balanced: fine-tune fertilizer to soil tests.", "Nitrogen surplus: cut synthetic N and watch for leaching."],
    now: ["Plan a legume or clover cover crop for next season.", "Take a fall soil N test.", "Reduce next season's N application and sow a catch crop to hold leftover N."],
  },
  infiltration: {
    year: ["Less rain soaks in: reduce tillage and add organic matter.", "Infiltration steady.", "More rain soaks in: soil structure is improving; keep it."],
    now: ["Avoid working wet soil and plan less tillage.", "No change needed.", "Keep current practice."],
  },
  runoff: {
    year: ["Little runoff.", "Some runoff: keep soil covered over winter.", "Heavy runoff: add grass strips and cover crops, avoid bare fall soil."],
    now: ["No action needed.", "Check where runoff leaves the field after the next storm.", "Seed grass strips along runoff paths this fall."],
  },
  pest: {
    year: ["Pest cycle broken by rotation.", "Pressure building: rotate to a different plant family next year.", "Pest pressure high: break the host cycle with a different crop family and scout weekly."],
    now: ["Keep the rotation.", "Plan next year's bed to a different plant family.", "Change next year's crop family on this field and set up a scouting routine."],
  },
  quota: {
    year: ["Water demand within supply.", "Demand close to supply: prioritise water for high-value crops.", "Demand above supply: switch some fields to drought-tolerant crops and use drip."],
    now: ["No action needed.", "Confirm next season's water allowance.", "Rework next season's plan around a lower-water crop on the thirstiest field."],
  },
};

export const band = (sev: number) => (sev < 1 / 3 ? 0 : sev < 2 / 3 ? 1 : 2);

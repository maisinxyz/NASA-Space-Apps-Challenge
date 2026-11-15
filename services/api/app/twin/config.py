"""Forecast-engine coefficients (PRD §5). Session B owns this file.

Every agronomic number is either copied from a source named in the comment or
marked assumed with TODO(verify). The engine does not treat a null catalog
trait as zero. Callers that need a missing trait get a review note from the
module that looked it up.
"""

from __future__ import annotations

from app.twin.types import SUPPORT_SENTENCE

ENGINE_VERSION = "1.1.0"  # bump when a formula or coefficient below changes

# Distinct from SUPPORT_SENTENCE. types.py keeps the support sentence; this is the forecast disclaimer.
DISCLAIMER = (
    "Scenario forecast for the stated climate path. It is not a prediction of what this farm will harvest. "
    "Absolute estimates carry a unit, a basis, a confidence, and a p10 to p90 range."
)

# ---------------------------------------------------------------- weekly calendar
# Same 365-day year the rotation engine uses (days 358-365 fold into week 51). Leap days are not modeled.
YEAR_DAYS = 365
# Crop-coefficient stage shares of a crop's season. FAO-56 Table 11 uses crop-specific lengths;
# these shares are the simplification already used by app/rotation/config.py. TODO(verify).
KC_STAGE_FRACTIONS = (0.20, 0.45, 0.80)
# Southern-hemisphere windows shift by this many days. Same convention as app/rotation/engine.py.
SOUTH_SHIFT_DAYS = 182
# Overlap allowed when one crop is drilled before the previous harvest. Assumed, same as the rotation engine.
SEASON_SLACK_DAYS = 14

# ---------------------------------------------------------------- FAO-56 bucket
# Reference depletion fraction when crop-specific Table 22 values are not on the catalog row.
# FAO-56 chapter 8 uses p = 0.50 as the value at ETc of about 5 mm/day before the ETc adjustment.
# TODO(verify) a per-crop p from Table 22. https://www.fao.org/4/x0490e/x0490e0e.htm
DEPLETION_FRACTION_P = 0.50
# Bare-soil root stand-in. FAO-56 chapter 7 recommends Ze of 0.10-0.15 m for the evaporating layer.
# The low end is used when no crop root depth is known. https://www.fao.org/4/x0490e/x0490e0e.htm
BARE_ROOT_M = 0.10
# Initial storage is field capacity (depletion 0). Assumed for week 1. TODO(verify) a winter start for UBC.
# FAO-56 Table 19 (θFC − θWP), m3/m3, read from the Allen et al. HTML text on 2026-11-15.
# Midpoints below are (low+high)/2 * 1000 → mm of available water per metre of root.
# https://www.fao.org/4/x0490e/x0490e0e.htm (Table 19 in that chapter).
TAW_MM_PER_M = {
    "sand": 80.0,  # 0.05-0.11
    "sandy_loam": 130.0,  # 0.11-0.15
    "loam": 155.0,  # 0.13-0.18
    "silt_loam": 160.0,  # 0.13-0.19
    "clay": 160.0,  # 0.12-0.20
}
# Class boundaries are a coarse stand-in for the USDA texture triangle. TODO(verify) the triangle.
# Root-depth class → metres. The three numbers are the Zr examples in the FAO-56 chapter 8 box
# (onion 0.4 m, tomato 0.8 m, maize 1.2 m), not a verified mapping of the words shallow/medium/deep.
# TODO(verify) that mapping. https://www.fao.org/4/x0490e/x0490e0e.htm
ROOT_DEPTH_M_BY_CLASS = {"shallow": 0.4, "medium": 0.8, "deep": 1.2}

# Weekly infiltration fraction. All four multipliers are assumed. TODO(verify).
# base = clip(INFIL_BASE_INTERCEPT + INFIL_BASE_CLAY_SLOPE * clay_pct, lo, hi)
INFIL_BASE_INTERCEPT = 0.95
INFIL_BASE_CLAY_SLOPE = -0.005  # per percent clay
INFIL_BASE_MIN = 0.40
INFIL_BASE_MAX = 0.98
# At infiltration index 100 the soil multiplier is 1. Each 100 index points changes it by this fraction.
INFIL_SOC_SLOPE = 0.15
# Bare cover uses the min; full cover uses 1.
INFIL_COVER_MIN = 0.75
INFIL_NO_TILL_MULT = 1.05
INFIL_TILL_MULT = 0.90
# Reported infiltration index is clamped. The clamp is a reporting bound, not a measurement.
INFIL_INDEX_MIN = 0.0
INFIL_INDEX_MAX = 250.0

# ---------------------------------------------------------------- yield (FAO Irrigation and Drainage Paper 33)
# Seasonal Ky from FAO Irrigation and Drainage Paper 66, Table 1, which reprints Paper 33.
# Read from https://www.fao.org/4/i2800e/i2800e.pdf on 2026-11-15. Crops not in that table have no entry.
# Catalog yield_response_factor_ky wins when it is a finite number.
KY_FAO33 = {
    "crop_alfalfa": 1.1,
    "crop_bean_dry": 1.15,
    "crop_bean_green": 1.15,
    "crop_cabbage": 0.95,
    "crop_maize": 1.25,
    "crop_onion": 1.1,
    "crop_pea_field": 1.15,
    "crop_pepper_bell": 1.1,
    "crop_potato": 1.1,
    "crop_sorghum": 0.9,
    "crop_soybean": 0.85,
    "crop_sunflower": 0.95,
    "crop_tomato": 1.05,
    "crop_wheat_spring": 1.15,
    "crop_wheat_winter": 1.05,
}
# Fraction of yield removed per week the crop is in the ground and past its heat or frost limit.
# Assumed. TODO(verify). Not from Paper 33, which is a water-stress relation only.
HEAT_YIELD_LOSS_PER_WEEK = 0.05
FROST_YIELD_LOSS_PER_WEEK = 0.05

# ---------------------------------------------------------------- soil carbon (ICBM)
# Andrén & Kätterer 1997, Table 1: kY = 0.8 yr-1, kO = 0.00605 yr-1, h = 0.125
# for the straw treatments they fitted. Those plots are in Sweden, not Vancouver.
# TODO(verify) before treating the index as anything but a relative scenario comparison.
# http://www.oandren.com/ICBM/1-35.pdf
ICBM_KY = 0.8
ICBM_KO = 0.00605
ICBM_H = 0.125
# Carbon input, t C/ha/year, by class. "medium" is straw 0.19 + roots 0.095 from that table's
# 1N1straw row. "low" and "high" are assumed multiples. TODO(verify) those two.
CARBON_INPUT_T_HA = {"none": 0.0, "low": 0.10, "medium": 0.285, "high": 0.50}
# Extra young-pool decay when the week is bare, as a fraction of kY per full year of bare weeks.
# Assumed. TODO(verify). kY_eff = kY * r * (1 + BARE_DECAY_YEAR * bare_weeks / 52).
BARE_DECAY_YEAR = 0.50
# Tillage multiplier on kY. Assumed. TODO(verify). no-till uses 1.
TILLAGE_DECAY_MULT = 1.15
# r = 2**((T-T_REF)/10) * wetness, then clamped. The Q10 form is not the ICBM re_clim routine.
# T_REF of 5 C is an assumed anchor where the temperature term is 1. TODO(verify).
ICBM_T_REF_C = 5.0
ICBM_R_MIN = 0.2
ICBM_R_MAX = 3.0
# Cover term inside the reported infiltration index. 0.5 is the cover fraction that leaves the
# term at 1 when the soil index is 100. Assumed. TODO(verify).
INFIL_COVER_REFERENCE = 0.5
INFIL_COVER_WEIGHT = 0.15

# ---------------------------------------------------------------- nitrogen (all assumed; confidence stays low)
# TODO(verify) every value against a BC Ministry or university extension guide.
# https://www2.gov.bc.ca/gov/content/industry/agriculture-seafood/agricultural-land-and-environment/soil-nutrients
N_FIX_KG_HA = {"none": 0.0, "low": 40.0, "medium": 90.0, "high": 150.0}
N_UPTAKE_KG_HA = {"low": 40.0, "medium": 90.0, "high": 160.0}
N_RESIDUE_KG_HA = {"low": 5.0, "medium": 15.0, "high": 30.0}
# kg N/ha removed per mm of drainage, and per bare week. Assumed. TODO(verify).
N_LOSS_PER_MM_DRAINAGE = 0.02
N_LOSS_PER_BARE_WEEK = 0.5
# Share of a positive n_pool counted as mineralized soil supply. Assumed. TODO(verify).
N_MINERALIZATION_FRACTION = 0.05
# Index points added to the year-0 value of 100 per kg N/ha of cumulative pool change. Assumed.
N_INDEX_PER_KG = 0.5
# When n_fixing is true and n_fix_class is null, this class is used and a review note is set.
N_FIX_CLASS_WHEN_FLAG_ONLY = "medium"

# ---------------------------------------------------------------- pests
# Default return interval when the catalog value is null. Assumed. TODO(verify) against
# BC Ministry of Agriculture or WSU extension guides. The catalog comment names those guides
# and does not give a number. https://www2.gov.bc.ca/gov/content/industry/agriculture-seafood
PEST_RETURN_INTERVAL_YEARS = 3
PEST_BASE = 10.0  # first host year, index points. Assumed.
PEST_STEP = 25.0  # added times (interval - gap) when the family returns early. Assumed.
PEST_DECAY = 30.0  # removed on a non-host year. Assumed.
PEST_INDEX_MAX = 100.0

# ---------------------------------------------------------------- soil loss (RUSLE-style product A = R * K * LS * C * P)
# K range midpoints from the qualitative ranges on https://iwr.msu.edu/rusle/kfactor.htm
# (clay about 0.05-0.15, sand about 0.05-0.2, medium textures about 0.25-0.4).
# TODO(verify): these are range midpoints, not a K measured for the field.
RUSLE_K = {"sand": 0.12, "sandy_loam": 0.25, "loam": 0.32, "silt_loam": 0.35, "clay": 0.10}
# Representative slope percent for each request class. The request has no percent. TODO(verify).
SLOPE_PERCENT = {"flat": 1.0, "gentle": 3.0, "moderate": 6.0, "steep": 12.0}
# Unit-plot length so L = 1. Field slope length is not on the request.
# RUSLE unit plot is 72.6 ft (22.13 m). https://iwr.msu.edu/rusle/kfactor.htm describes that plot.
RUSLE_SLOPE_LENGTH_M = 22.13
# C = clip(1 - C_COVER_SLOPE * mean cover, C_MIN, 1). Assumed. TODO(verify) a C table.
RUSLE_C_COVER_SLOPE = 0.95
RUSLE_C_MIN = 0.05
# Practice factor. 1 matches the tilled unit plot. 0.5 for no-till is assumed. TODO(verify).
RUSLE_P_TILL = 1.0
RUSLE_P_NO_TILL = 0.5
# Rainfall erosivity stand-in: R = annual rain (mm) * this factor.
# TODO(verify) against Renard et al., USDA Agriculture Handbook 703. The factor is assumed
# so the product has the shape of RUSLE and is not a published erosivity for Vancouver.
# Handbook page that describes RUSLE (the factor itself is not taken from this note):
# https://www.cabq.gov/municipaldevelopment/documents/nm-nrcs-agronomy-technical-note-revised-universal-soil-loss-equation.pdf
RUSLE_R_PER_MM = 1.0

# ---------------------------------------------------------------- strategy search
# Same perennial cap the rotation engine assumed. TODO(verify).
MAX_PERENNIAL_YEARS = 3
CANDIDATE_CAP = 500
SEARCH_NODE_CAP = 20000
# Peak-week counts above the cap are dropped for that labour level. Empty lists pass.
# Assumed. TODO(verify).
LABOUR_PEAK_WEEK_CAP = {"low": 4, "medium": 8, "high": 52}
# water_vs_quota: p50 above this fraction of the quota, or p90 above the quota, is "tight".
# Assumed. TODO(verify).
QUOTA_TIGHT_FRACTION = 0.85

# Weight presets copied from app/rotation/config.py so ranking uses one table.
# They are assumed shortcut weights, not measurements.
WEIGHT_PRESETS = {
    "water": {"water_use": 0.5, "erosion_risk": 0.2, "organic_matter": 0.15, "nutrient_cycling": 0.15},
    "income": {"market_suitability": 0.6, "water_use": 0.2, "pest_disruption": 0.2},
    "soil_structure": {"organic_matter": 0.4, "nutrient_cycling": 0.3, "erosion_risk": 0.3},
    "erosion": {"erosion_risk": 0.6, "organic_matter": 0.2, "nutrient_cycling": 0.2},
    "forage": {"forage_potential": 0.6, "nutrient_cycling": 0.2, "organic_matter": 0.2},
}
CRITERIA = (
    "nutrient_cycling",
    "erosion_risk",
    "organic_matter",
    "pest_disruption",
    "water_use",
    "forage_potential",
    "market_suitability",
)
LOWER_IS_BETTER = frozenset({"erosion_risk", "water_use"})
CLIMATE_DRIVEN = frozenset({"erosion_risk", "water_use"})
SCORE_UNIT = "index 0-100 across these strategies, higher is better"
CRITERION_BASIS = {
    "nutrient_cycling": "relative",
    "erosion_risk": "modeled",
    "organic_matter": "relative",
    "pest_disruption": "assumed",
    "water_use": "modeled",
    "forage_potential": "relative",
    "market_suitability": "assumed",
}
CRITERION_UNIT = {
    "nutrient_cycling": "index, year 0 = 100",
    "erosion_risk": "t/ha/yr",
    "organic_matter": "index, year 0 = 100",
    "pest_disruption": "index, 100 minus pest pressure",
    "water_use": "mm/yr",
    "forage_potential": "index 0-100",
    "market_suitability": "1-5",
}

# Price unit strings the income calculation will multiply by t/ha. Anything else is left null.
PRICE_UNITS_PER_TONNE = frozenset({
    "t", "tonne", "tonnes", "metric tonne", "per tonne", "per t", "/t", "1/t",
})

FORAGE_USES = frozenset({"grazing", "hay", "silage"})


def index_crops(catalog) -> dict[str, dict]:
    """Accept the seed document (`{"crops": [...]}`) or an id → crop dict."""
    if isinstance(catalog, dict) and isinstance(catalog.get("crops"), list):
        return {c["id"]: c for c in catalog["crops"]}
    return dict(catalog)


def texture_row(sand: float, silt: float, clay: float) -> str:
    """Coarse texture row for TAW and K. Boundaries are TODO(verify) against the USDA triangle."""
    if clay >= 40:
        return "clay"
    if silt >= 50 and clay < 27:
        return "silt_loam"
    if sand >= 70:
        return "sand"
    if sand >= 50:
        return "sandy_loam"
    return "loam"


def taw_mm_per_m(sand: float, silt: float, clay: float) -> float:
    """Midpoint of the FAO-56 Table 19 (θFC − θWP) range for the coarse texture row, mm/m."""
    return TAW_MM_PER_M[texture_row(sand, silt, clay)]


def assumption_notes() -> tuple[str, ...]:
    """Short list echoed by callers that build a response. Each line is an assumption, not a measurement."""
    return (
        "Infiltration multipliers, heat and frost yield penalties, and the RUSLE C, P, and R stand-in are assumed. TODO(verify).",
        "ICBM kY, kO, and h are the Andrén & Kätterer 1997 Table 1 values, not fitted at this farm. TODO(verify).",
        "Nitrogen class rates and the pest return interval are assumed. TODO(verify) against a local extension guide.",
        "Ky values used when the catalog is null are the FAO Paper 33 season totals reprinted in FAO Paper 66 Table 1.",
        "A null catalog reference yield is omitted. It is not replaced with a tonne-per-hectare default.",
    )

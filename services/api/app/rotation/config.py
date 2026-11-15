"""Backend B config: every coefficient and threshold of the rotation engine (backend rotation PRD §8.4).

All values here are ASSUMED (stated choices for a relative comparison), so reviewers can see and change them in one place.
"""

from __future__ import annotations

ENGINE_VERSION = "1.0.0"  # bump when any formula or value below changes
SUPPORT = "This tool supports, and does not replace, local agronomic expertise."

CRITERIA = ("nutrient_cycling", "erosion_risk", "organic_matter", "pest_disruption", "water_use", "forage_potential", "market_suitability")
LOWER_IS_BETTER = {"erosion_risk", "water_use"}
CLIMATE_DRIVEN = {"erosion_risk", "water_use"}  # get p10/p90 ranges; the rest are trait-only (PRD §10)
LABELS = {
    "nutrient_cycling": "Nutrient cycling (incl. nitrogen fixing)",
    "erosion_risk": "Erosion risk",
    "organic_matter": "Organic matter",
    "pest_disruption": "Pest-cycle disruption",
    "water_use": "Water use",
    "forage_potential": "Forage potential",
    "market_suitability": "Market suitability",
}
BASIS = {
    "nutrient_cycling": "derived", "erosion_risk": "modeled", "organic_matter": "derived", "pest_disruption": "derived",
    "water_use": "modeled", "forage_potential": "derived", "market_suitability": "assumed",
}
UNIT = "index 0-100 across these three rotations, higher is better"

BARE_COVER = 0.30  # weekly mean cover below this = bare week
HEAVY_RAIN_WEIGHT_K = 1.0  # k in the erosion formula
SLACK_DAYS = 14  # a crop may be drilled up to this many days before the previous one is harvested
PEST_PENALTY = 0.25  # per same-family pair within two cropping seasons
MAX_PERENNIAL_YEARS = 3  # longest stand of one perennial crop
CANDIDATE_CAP = 5000  # PRD §8.3

RESIDUE = {"low": 0.0, "medium": 0.5, "high": 1.0}
MARKET = {"high": 1.0, "medium": 0.5, "low": 0.0}
# TODO(verify): soil-class effects. Finer soils infiltrate less, so more runoff (higher erosion factor) and less retained rain.
INFILTRATION_FACTOR = {"high": 0.8, "medium": 1.0, "low": 1.2}
RAIN_RETAINED = {"high": 0.85, "medium": 0.75, "low": 0.65}
# Crop-coefficient stage shares of a crop's season (FAO-56 uses crop-specific lengths; these shares are a simplification).
KC_STAGES = (0.20, 0.45, 0.80)  # end of initial, end of development, end of mid-season

# Shortcut weights (PRD §9 `weight_preset`). Explicit `weights` override these.
WEIGHT_PRESETS = {
    "water": {"water_use": 0.5, "erosion_risk": 0.2, "organic_matter": 0.15, "nutrient_cycling": 0.15},
    "income": {"market_suitability": 0.6, "water_use": 0.2, "pest_disruption": 0.2},
    "soil_structure": {"organic_matter": 0.4, "nutrient_cycling": 0.3, "erosion_risk": 0.3},
    "erosion": {"erosion_risk": 0.6, "organic_matter": 0.2, "nutrient_cycling": 0.2},
    "forage": {"forage_potential": 0.6, "nutrient_cycling": 0.2, "organic_matter": 0.2},
}

# Existing rotation per curated site (`existing_rotation: "preset"`). Typical regional rotations, not this farm's records.
# TODO(verify) each with the farm or a local extension agronomist (PRD §22).
# BC twins: neither farm publishes its crop list (checked 2026-11-15). The cash-crop order is not a
# quoted rotation. Fall rye after a late vegetable harvest is Table 18 of the Soil Management
# Handbook for the Lower Fraser Valley (BC Ministry of Agriculture, Fisheries and Food, 1991, 2nd ed.):
# https://www2.gov.bc.ca/assets/gov/farming-natural-resources-and-industry/agriculture-and-seafood/agricultural-land-and-environment/soil-nutrients/610000-1_soil_mgmt_handbook_fraservalley.pdf
# Cabbage and lettuce planting months are from WSU Snohomish, Fall and Winter Vegetable Gardens
# for Western Washington (read 2026-11-15): ballhead cabbage uses the Brussels-sprout culture
# (direct seed by 1 July or transplant by 1 August); head and romaine lettuce are sown in July.
# https://extension.wsu.edu/snohomish/2013/12/18/fall-and-winter-vegetable-gardens-for-western-washington/
# TODO(verify) the year order and the Fraser Valley dates with the farms. Western Washington is not Langley.
F = "fallow"
SITE_PRESETS = {
    "site_usda_barc": {"name": "Corn, soybean, winter wheat (no cover crops)", "slots": [
        (1, "crop_maize", F), (2, "crop_soybean", F), (3, "crop_wheat_winter", F)]},
    "site_cornell_ruminant": {"name": "Corn then two years of alfalfa (dairy)", "slots": [
        (1, "crop_maize", F), (2, "crop_alfalfa", F), (3, "crop_alfalfa", F)]},
    "site_ucdavis_oakville": {"name": "Winter wheat then fallow (dryland)", "slots": [
        (1, "crop_wheat_winter", F), (2, F, F)]},
    "site_ubc_farm": {"name": "Typical vegetable rotation (not this farm's records)", "slots": [
        (1, "crop_cabbage", "crop_rye_cover"), (2, "crop_lettuce", "crop_rye_cover")]},
    "site_kpu_langley": {"name": "Typical vegetable rotation (not this farm's records)", "slots": [
        (1, "crop_cabbage", "crop_rye_cover"), (2, "crop_lettuce", "crop_rye_cover")]},
}
DEFAULT_PRESET = {"name": "Corn, soybean (no cover crops)", "slots": [(1, "crop_maize", F), (2, "crop_soybean", F)]}

REVIEW_ALWAYS = [
    "Planting and harvest windows for your area and this season.",
    "A soil test before changing fertility plans.",
    "Whether your equipment can plant, harvest and terminate each crop.",
    "Local prices and buyers for each crop.",
    "Pest and disease history of your fields.",
    "Local frost and heat thresholds for each crop.",
]

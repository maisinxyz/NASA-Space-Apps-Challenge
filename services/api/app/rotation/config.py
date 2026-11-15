"""Backend B config: every coefficient and threshold of the rotation engine (backend rotation PRD §8.4).

All values here are ASSUMED (stated choices for a relative comparison), so reviewers can see and change them in one place.
"""

from __future__ import annotations

ENGINE_VERSION = "1.0.1"  # B4 changes the crop pool and preset cycles
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

# Current rotation per curated site (`existing_rotation: "preset"`). BC presets below are team-defined, not
# claims about recorded farm practice (product decision D11). UBC field blocks use the field IDs from the
# current farm request (d3-brassicas, d4-goosefoots, d6-alliums, d6-nightshades, d7-cucurbits, d5-maya).
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
    "site_ubc_farm": {"name": "Current rotation", "slots": [
        (1, "crop_cabbage", "crop_rye_cover"), (2, "crop_lettuce", "crop_rye_cover")]},
    "site_kpu_langley": {"name": "Current rotation", "slots": [
        (1, "crop_cabbage", "crop_rye_cover"), (2, "crop_lettuce", "crop_rye_cover")]},
}

# Team-defined UBC sequence: Brassica → allium → legume → nightshade → cucurbit
# → goosefoot (chard/beet), with a rye cover crop after each main crop. Each
# field starts at the family suggested by its OpenStreetMap plot name, then
# cycles through the same six phases. UBC Farm describes Maya Garden's Three
# Sisters (corn, beans, squash); green bean is the sourced representative crop
# for the mixed garden's first modeled phase. https://ubcfarm.ubc.ca/saturday-farmers-market-vendor-feature-tal-axin-maya-in-exile-garden/
UBC_ROTATION_PHASES = (
    ("crop_cabbage", "crop_rye_cover"),
    ("crop_onion", "crop_rye_cover"),
    ("crop_bean_green", "crop_rye_cover"),
    ("crop_tomato", "crop_rye_cover"),
    ("crop_zucchini", "crop_rye_cover"),
    ("crop_beet", "crop_rye_cover"),
)
UBC_FIELD_PHASE_START = {
    "d3-brassicas": 0,
    "d4-goosefoots": 5,
    "d6-alliums": 1,
    "d6-nightshades": 3,
    "d7-cucurbits": 4,
    "d5-maya": 0,
}


def _ubc_field_slots(field_id: str, start: int) -> list[tuple[int, str, str]]:
    slots = []
    for year in range(len(UBC_ROTATION_PHASES)):
        phase = (start + year) % len(UBC_ROTATION_PHASES)
        main, cover = UBC_ROTATION_PHASES[phase]
        if field_id == "d5-maya" and year == 0:
            # Tal A'xin's UBC Farm interview identifies the Three Sisters mix;
            # green bean is the sourced representative crop for the field preset.
            main = "crop_bean_green"
        elif field_id == "d6-nightshades" and phase == 1:
            main = "crop_garlic"
        slots.append((year + 1, main, cover))
    return slots


SITE_FIELD_PRESETS = {
    "site_ubc_farm": {
        field_id: {
            "name": "Current rotation",
            "slots": _ubc_field_slots(field_id, start),
            "team_defined": True,
        }
        for field_id, start in UBC_FIELD_PHASE_START.items()
    }
}


def field_preset(site_id: str, field_id: str | None) -> dict | None:
    """Per-field current-rotation preset; explicit user rotations always take precedence."""
    return SITE_FIELD_PRESETS.get(site_id, {}).get(field_id or "")
DEFAULT_PRESET = {"name": "Corn, soybean (no cover crops)", "slots": [(1, "crop_maize", F), (2, "crop_soybean", F)]}

REVIEW_ALWAYS = [
    "Planting and harvest windows for your area and this season.",
    "A soil test before changing fertility plans.",
    "Whether your equipment can plant, harvest and terminate each crop.",
    "Local prices and buyers for each crop.",
    "Pest and disease history of your fields.",
    "Local frost and heat thresholds for each crop.",
]

"""Build data/seed/crops/catalog_v2.json from the v1 trait library plus new rows.

FAO-56 numbers are copied only where the chapter text states them. The HTML
table did not keep its columns, so other Kc values stay null. Run from the
repo root: `uv run --project services/api python scripts/build_catalog_v2.py`.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRAITS = ROOT / "data" / "seed" / "crops" / "traits.json"
OUT = ROOT / "data" / "seed" / "crops" / "catalog_v2.json"

FAO = "https://www.fao.org/4/x0490e/x0490e0b.htm"
FAO_TABLE_UNREAD = (
    "FAO-56 Table 12 (" + FAO + ") was opened on 2026-11-15. The HTML table lost "
    "its columns, so these coefficients were not copied. TODO(verify)"
)
FAO_WHEAT_MID = (
    "FAO-56 chapter text states 'From Table 12 for wheat: Kc mid = 1.15 and h = 1.0 m' ("
    + FAO + "). ini and end are not in that sentence. TODO(verify)"
)
FAO_MAIZE_MID = (
    "FAO-56 chapter text states that Table 12 Kc mid for maize is 1.20 and the height is 2 m ("
    + FAO + "). ini and end on the ported row were not re-read from the table. TODO(verify)"
)
FAO_DRY_BEAN = (
    "FAO-56 dry-bean example (Kimberly, Idaho) selects Table 12 values Kc ini 0.4, "
    "Kc mid 1.15 and Kc end 0.35 before the local humidity adjustment ("
    + FAO + "). Those are the unadjusted table values cited there, not a Vancouver measurement."
)
FAMILY_TODO = "Common botanical family. TODO(verify) against https://plants.usda.gov/"
WINDOW_TODO = (
    "Planting and termination day-of-year are not verified. TODO(verify) against a "
    "British Columbia or Pacific Northwest extension guide before use."
)
COVER_TODO = "No cover curve was sourced. The array is empty on purpose. TODO(verify)"
CLASS_TODO = "Not verified. Null is not a default class. TODO(verify)"
NFIX_NONE = "Restates n_fixing false. Not a measured fixation rate. TODO(verify)"
NFIX_LEGUME = (
    "n_fixing is true because the crop is a legume. The fixation class is not measured. TODO(verify)"
)
CATEGORY_PORTED = "Grouped from the existing crop name for catalog v2. TODO(verify) with an agronomist"
UNVERIFIED = "TODO(verify)"

# id, name, family, category, n_fixing, notes, kc or None, kc_source or None
NEW = [
    ("crop_cabbage", "Cabbage", "Brassicaceae", "vegetable", False, "Heading brassica."),
    ("crop_broccoli", "Broccoli", "Brassicaceae", "vegetable", False, "Heading brassica."),
    ("crop_cauliflower", "Cauliflower", "Brassicaceae", "vegetable", False, "Heading brassica."),
    ("crop_kale", "Kale", "Brassicaceae", "vegetable", False, "Leaf brassica."),
    ("crop_brussels_sprouts", "Brussels sprouts", "Brassicaceae", "vegetable", False, "Heading brassica."),
    ("crop_onion", "Dry onion", "Amaryllidaceae", "vegetable", False, "Allium. Family placement TODO(verify)."),
    ("crop_garlic", "Garlic", "Amaryllidaceae", "vegetable", False, "Allium. Family placement TODO(verify)."),
    ("crop_leek", "Leek", "Amaryllidaceae", "vegetable", False, "Allium. Family placement TODO(verify)."),
    ("crop_tomato", "Tomato", "Solanaceae", "vegetable", False, "Fruiting nightshade."),
    ("crop_pepper_bell", "Bell pepper", "Solanaceae", "vegetable", False, "Fruiting nightshade."),
    ("crop_potato", "Potato", "Solanaceae", "vegetable", False, "Tuber nightshade."),
    ("crop_eggplant", "Eggplant", "Solanaceae", "vegetable", False, "Fruiting nightshade."),
    ("crop_cucumber", "Cucumber", "Cucurbitaceae", "vegetable", False, "Cucurbit."),
    ("crop_zucchini", "Zucchini", "Cucurbitaceae", "vegetable", False, "Summer squash."),
    ("crop_winter_squash", "Winter squash", "Cucurbitaceae", "vegetable", False, "Winter squash and pumpkin are not split here."),
    ("crop_bean_green", "Green bean", "Fabaceae", "vegetable", True, "Snap bean. Fixation rate not measured."),
    ("crop_bean_dry", "Dry bean", "Fabaceae", "grain", True, "Pulse. Kc values are the FAO-56 example's unadjusted Table 12 numbers."),
    ("crop_carrot", "Carrot", "Apiaceae", "vegetable", False, "Root crop."),
    ("crop_beet", "Table beet", "Amaranthaceae", "vegetable", False, "Family placement TODO(verify); older keys use Chenopodiaceae."),
    ("crop_parsnip", "Parsnip", "Apiaceae", "vegetable", False, "Root crop."),
    ("crop_turnip", "Turnip", "Brassicaceae", "vegetable", False, "Root brassica."),
    ("crop_lettuce", "Lettuce", "Asteraceae", "vegetable", False, "Leafy green."),
    ("crop_spinach", "Spinach", "Amaranthaceae", "vegetable", False, "Family placement TODO(verify); older keys use Chenopodiaceae."),
    ("crop_chard", "Chard", "Amaranthaceae", "vegetable", False, "Family placement TODO(verify); older keys use Chenopodiaceae."),
    ("crop_wheat_spring", "Spring wheat", "Poaceae", "grain", False, "Spring-sown wheat. Kc mid is the FAO-56 wheat sentence."),
    ("crop_oat", "Oat", "Poaceae", "grain", False, "Cereal."),
    ("crop_spelt", "Spelt", "Poaceae", "grain", False, "Hulled wheat. Not the same crop as crop_wheat_winter."),
    ("crop_rye_grain", "Cereal rye (grain)", "Poaceae", "grain", False, "Grain harvest. Distinct from crop_rye_cover."),
    ("crop_buckwheat", "Buckwheat", "Polygonaceae", "grain", False, "Not a grass. Family placement TODO(verify)."),
    ("crop_vetch_oat", "Vetch and oat", "mixture", "forage", True, "Two-species mix. Oat does not fix nitrogen. The mix rate is not measured."),
    ("crop_orchardgrass", "Orchardgrass", "Poaceae", "forage", False, "Grass ley stand. Species choice for a local ley is TODO(verify)."),
    ("crop_clover_crimson", "Crimson clover", "Fabaceae", "cover", True, "Winter annual clover. Fixation rate not measured."),
    ("crop_faba", "Faba bean", "Fabaceae", "cover", True, "Also called broad bean. This row is the cover use. Fixation rate not measured."),
    ("crop_phacelia", "Phacelia", "Boraginaceae", "cover", False, "Family placement TODO(verify); some keys use Hydrophyllaceae."),
    ("crop_radish_cover", "Tillage radish", "Brassicaceae", "cover", False, "Cover radish, not a table-radish row."),
    ("crop_mustard_cover", "Cover mustard", "Brassicaceae", "cover", False, "Brassica cover. Species is not pinned."),
    ("crop_apple", "Apple", "Rosaceae", "fruit_perennial", False, "Perennial fruit. No yield or Kc was transcribed."),
]

PORTED_CATEGORY = {
    "crop_maize": "grain",
    "crop_wheat_winter": "grain",
    "crop_barley": "grain",
    "crop_soybean": "grain",
    "crop_pea_field": "grain",
    "crop_alfalfa": "forage",
    "crop_red_clover": "forage",
    "crop_rye_cover": "cover",
    "crop_sorghum": "grain",
    "crop_millet": "grain",
    "crop_sunflower": "grain",
    "crop_canola": "grain",
}

V2_FIELDS = (
    "category", "host_families", "return_interval_years", "root_depth_m", "carbon_input_class",
    "n_uptake_class", "n_fix_class", "waterlogging_tolerance", "forage_use", "reference_yield",
    "yield_response_factor_ky", "typical_n_rate_kg_ha", "erosion_cover_factor_class",
    "needs_equipment", "labour_peak_weeks", "region_fit",
)


def v2_block(n_fixing: bool) -> dict:
    return {
        "host_families": [],
        "return_interval_years": None,
        "root_depth_m": {"ini": None, "mid": None, "end": None},
        "carbon_input_class": None,
        "n_uptake_class": None,
        "n_fix_class": None if n_fixing else "none",
        "waterlogging_tolerance": None,
        "forage_use": None,
        "reference_yield": None,
        "yield_response_factor_ky": None,
        "typical_n_rate_kg_ha": None,
        "erosion_cover_factor_class": None,
        "needs_equipment": [],
        "labour_peak_weeks": [],
        "region_fit": [],
    }


def v2_sources(n_fixing: bool, category_source: str) -> dict:
    sources = {field: UNVERIFIED for field in V2_FIELDS}
    sources["category"] = category_source
    sources["n_fix_class"] = NFIX_LEGUME if n_fixing else NFIX_NONE
    sources["root_depth_m"] = "Metres by stage were not sourced. Null is not zero. TODO(verify)"
    sources["reference_yield"] = "No yield was sourced. Null is not zero. TODO(verify)"
    sources["typical_n_rate_kg_ha"] = "No nitrogen rate was sourced. Null is not zero. TODO(verify)"
    sources["region_fit"] = "No climate-class fit was verified, including UBC Farm. TODO(verify)"
    return sources


def port(crop: dict) -> dict:
    row = dict(crop)
    n_fixing = bool(row["n_fixing"])
    row["category"] = PORTED_CATEGORY[row["id"]]
    row.update(v2_block(n_fixing))
    sources = dict(row.get("trait_sources") or {})
    sources.update(v2_sources(n_fixing, CATEGORY_PORTED))
    if row["id"] == "crop_maize":
        sources["kc_stages"] = FAO_MAIZE_MID
    elif row["id"] == "crop_wheat_winter":
        sources["kc_stages"] = FAO_WHEAT_MID + " The ported ini and end numbers were not confirmed by that sentence."
    row["trait_sources"] = sources
    return row


def blank_kc() -> dict:
    return {"ini": None, "mid": None, "end": None}


# Table 12 and Table 22 were read on 2026-11-15 from a PDF whose columns survived.
# The HTML chapter lost Table 12's columns and was not used for these cells.
# https://www.cse.iitb.ac.in/~pocra/References/FAO_Paper56_Irrigation_Drainage.pdf
FAO_PDF = "https://www.cse.iitb.ac.in/~pocra/References/FAO_Paper56_Irrigation_Drainage.pdf"
BC_COLE = "https://www2.gov.bc.ca/gov/content/industry/agriculture-seafood/animals-and-crops/crop-production/vegetables-production-guides/cole-crops"
BC_LETTUCE = "https://www2.gov.bc.ca/gov/content/industry/agriculture-seafood/animals-and-crops/crop-production/vegetables-production-guides/lettuce"
BC_VEG = "https://www2.gov.bc.ca/gov/content/industry/agriculture-seafood/animals-and-crops/crop-production/vegetables-production-guides"
WSU_FALL = "https://extension.wsu.edu/snohomish/2013/12/18/fall-and-winter-vegetable-gardens-for-western-washington/"
WSU_HOME = "https://wpcdn.web.wsu.edu/wp-extension/uploads/sites/2060/2021/06/Vegetable-Gardening-in-Washington-State.pdf"
VAN_CLIMATE = "https://en.wikipedia.org/wiki/Climate_of_Vancouver"
# Crops named on the BC vegetable-guide index (read 2026-11-15) plus the cole-page list.
BC_INDEX = {
    "crop_beet", "crop_carrot", "crop_cabbage", "crop_broccoli", "crop_cauliflower",
    "crop_brussels_sprouts", "crop_cucumber", "crop_zucchini", "crop_winter_squash",
    "crop_onion", "crop_eggplant", "crop_garlic", "crop_leek", "crop_lettuce",
    "crop_parsnip", "crop_pepper_bell", "crop_potato", "crop_bean_green",
    "crop_spinach", "crop_tomato", "crop_turnip",
}


def _group_kc(group_ini: float, mid: float, end: float | None, label: str, height: float | None) -> tuple[dict, str]:
    height_bit = f" The row also prints maximum height {height} m." if height is not None else ""
    end_bit = "Kc end was not a single number, so it stays null." if end is None else f"Kc end {end}"
    return (
        {"ini": group_ini, "mid": mid, "end": end},
        (
            f"FAO-56 Table 12, read 2026-11-15 from the PDF at {FAO_PDF}. "
            f"The {label} row prints Kc mid {mid} and {end_bit}.{height_bit} "
            f"Kc ini is blank on that row. The group row prints Kc ini {group_ini}. "
            "Footnote 1 calls the group Kc ini a general value for typical irrigation management and soil wetting. "
            "It is not a Fraser Valley measurement."
        ),
    )


def _own_kc(ini: float, mid: float, end: float, sentence: str) -> tuple[dict, str]:
    return {"ini": ini, "mid": mid, "end": end}, sentence


# (kc dict, source) for rows whose Table 12 cells were unambiguous.
KC_OVERLAY: dict[str, tuple[dict, str]] = {
    "crop_broccoli": _group_kc(0.7, 1.05, 0.95, "Broccoli", 0.3),
    "crop_brussels_sprouts": _group_kc(0.7, 1.05, 0.95, "Brussel Sprouts", 0.4),
    "crop_cabbage": _group_kc(0.7, 1.05, 0.95, "Cabbage", 0.4),
    "crop_carrot": _group_kc(0.7, 1.05, 0.95, "Carrots", 0.3),
    "crop_cauliflower": _group_kc(0.7, 1.05, 0.95, "Cauliflower", 0.4),
    "crop_garlic": _group_kc(0.7, 1.00, 0.70, "Garlic", 0.3),
    "crop_lettuce": _group_kc(0.7, 1.00, 0.95, "Lettuce", 0.3),
    "crop_onion": _group_kc(0.7, 1.05, 0.75, "Onions — dry", 0.4),
    "crop_spinach": _group_kc(0.7, 1.00, 0.95, "Spinach", 0.3),
    "crop_radish_cover": _group_kc(0.7, 0.90, 0.85, "Radish", 0.3),
    "crop_eggplant": _group_kc(0.6, 1.05, 0.90, "Egg Plant", 0.8),
    "crop_pepper_bell": _group_kc(0.6, 1.05, 0.90, "Sweet Peppers (bell)", 0.7),
    "crop_tomato": (
        {"ini": 0.6, "mid": 1.15, "end": None},
        (
            f"FAO-56 Table 12, read 2026-11-15 from the PDF at {FAO_PDF}. "
            "The Tomato row prints Kc mid 1.15 (footnote 2: 1.20 if staked to 1.5-2 m) and Kc end 0.70-0.90. "
            "The range was not stored as one number, so Kc end stays null. Height on the row is 0.6 m. "
            "Kc ini is blank. The Solanum group row prints Kc ini 0.6. Footnote 1 calls that a general value. "
            "Not a Fraser Valley measurement."
        ),
    ),
    "crop_winter_squash": _group_kc(0.5, 1.00, 0.80, "Pumpkin, Winter Squash", 0.4),
    "crop_zucchini": _group_kc(0.5, 0.95, 0.75, "Squash, Zucchini", 0.3),
    "crop_beet": _group_kc(0.5, 1.05, 0.95, "Beets, table", 0.4),
    "crop_potato": _group_kc(0.5, 1.15, 0.75, "Potato", 0.6),
    "crop_turnip": _group_kc(0.5, 1.10, 0.95, "Turnip (and Rutabaga)", 0.6),
    "crop_oat": _group_kc(0.3, 1.15, 0.25, "Oats", 1),
    "crop_wheat_spring": (
        {"ini": 0.3, "mid": 1.15, "end": None},
        (
            f"FAO-56 Table 12, read 2026-11-15 from the PDF at {FAO_PDF}. "
            "The Spring Wheat row prints Kc mid 1.15 and Kc end 0.25-0.40 (footnote 10: the higher value is for hand harvest). "
            "The range was not stored as one number, so Kc end stays null. "
            "Kc ini is blank on that row. The Cereals group row prints Kc ini 0.3. "
            "Footnote 1 calls that a general value. It is not a Fraser Valley measurement."
        ),
    ),
    "crop_bean_green": _own_kc(
        0.5, 1.05, 0.90,
        (
            f"FAO-56 Table 12 row 'Beans, green', read 2026-11-15 from the PDF at {FAO_PDF}: "
            "Kc ini 0.5, Kc mid 1.05, Kc end 0.90, height 0.4 m. "
            "Footnote 2 says a staked crop can use Kc mid 1.15. The unstaked table cell is the one stored. "
            "It is not a Fraser Valley measurement."
        ),
    ),
    "crop_parsnip": _own_kc(
        0.5, 1.05, 0.95,
        (
            f"FAO-56 Table 12 row 'Parsnip', read 2026-11-15 from the PDF at {FAO_PDF}: "
            "Kc ini 0.5, Kc mid 1.05, Kc end 0.95, height 0.4 m. Not a Fraser Valley measurement."
        ),
    ),
    "crop_apple": _own_kc(
        0.45, 0.95, 0.70,
        (
            f"FAO-56 Table 12 row 'Apples, Cherries, Pears — no ground cover, killing frost', "
            f"read 2026-11-15 from the PDF at {FAO_PDF}: Kc ini 0.45, Kc mid 0.95, Kc end 0.70, height 4 m. "
            "Footnote 18: that Kc end is prior to leaf drop; after leaf drop Kc end is about 0.20 for bare, dry soil. "
            "The other three apple rows (no frost, or an active ground cover) were not stored. "
            "The killing-frost row is the one that matches a site where frost occurs. Not a Fraser Valley measurement."
        ),
    ),
}

# Table 22 maximum effective root depth, metres. A range is not split into ini/mid/end.
ROOT_RANGE = {
    "crop_broccoli": "0.4-0.6",
    "crop_brussels_sprouts": "0.4-0.6",
    "crop_cabbage": "0.5-0.8",
    "crop_carrot": "0.5-1.0",
    "crop_cauliflower": "0.4-0.7",
    "crop_garlic": "0.3-0.5",
    "crop_lettuce": "0.3-0.5",
    "crop_onion": "0.3-0.6",
    "crop_spinach": "0.3-0.5",
    "crop_radish_cover": "0.3-0.5",
    "crop_eggplant": "0.7-1.2",
    "crop_pepper_bell": "0.5-1.0",
    "crop_tomato": "0.7-1.5",
    "crop_cucumber": "0.7-1.2",
    "crop_winter_squash": "1.0-1.5",
    "crop_zucchini": "0.6-1.0",
    "crop_beet": "0.6-1.0",
    "crop_parsnip": "0.5-1.0",
    "crop_potato": "0.4-0.6",
    "crop_turnip": "0.5-1.0",
    "crop_bean_green": "0.5-0.7",
    "crop_oat": "1.0-1.5",
    "crop_wheat_spring": "1.0-1.5",
    "crop_apple": "1.0-2.0",
}

WINDOW_NO_DOY = (
    "No plant_doy or terminate_doy was stored. The guides that were opened state a month, a deadline, or a days-to-harvest range, "
    "not one planting day and one termination day. Those were not converted into day-of-year. TODO(verify). "
)

WINDOW_BY_CROP = {
    "crop_cabbage": WINDOW_NO_DOY + (
        f"WSU Snohomish: ballhead cabbage for fall harvest uses the Brussels-sprout culture, direct seed by 1 July or transplant by 1 August, "
        f"and can be harvested into early winter ({WSU_FALL}). "
        f"BC cole crops: seed 4 to 6 weeks before transplant; the page does not give a calendar day ({BC_COLE}). "
        "Western Washington is not Langley."
    ),
    "crop_broccoli": WINDOW_NO_DOY + (
        f"BC cole crops: seed and/or transplant every 2 to 3 weeks from early spring until mid-July for a continuous supply of crowns ({BC_COLE})."
    ),
    "crop_brussels_sprouts": WINDOW_NO_DOY + (
        f"WSU Snohomish: direct seed by 1 July or transplant by 1 August ({WSU_FALL}). The BC cole page describes harvest of lower sprouts and a once-over late crop, without a day-of-year ({BC_COLE})."
    ),
    "crop_cauliflower": WINDOW_NO_DOY + (
        f"BC cole crops, overwinter cauliflower: optimum direct-seeding is mid-July; container transplants are seeded in mid-July for transplanting in mid-August; harvest of winter-hardy cole crops is discussed for March to May ({BC_COLE}). "
        "Mid-July was not stored as a day-of-year."
    ),
    "crop_lettuce": WINDOW_NO_DOY + (
        f"BC lettuce: the earliest seedings are started in greenhouse flats in early February and planted out when the fields can be prepared ({BC_LETTUCE}). "
        f"WSU Snohomish: sow head and romaine lettuce in July; leaf lettuce until mid-August ({WSU_FALL})."
    ),
    "crop_carrot": WINDOW_NO_DOY + (
        f"WSU Snohomish: plant a fall carrot crop by mid-July ({WSU_FALL})."
    ),
    "crop_spinach": WINDOW_NO_DOY + (
        f"WSU Snohomish: plant spinach in mid-August for a fall crop, or in September to winter over ({WSU_FALL})."
    ),
}

FROST_COLE = (
    "Not stored. The BC cole-crop guide says over-wintered cauliflower in Abbotsford has tolerated -19°C under snow, "
    f"and that Fraser Valley crops have survived -14°C without snow cover ({BC_COLE}, page updated 2025-06-27). "
    "That paragraph is in the overwinter-cauliflower section. It is a survival note, not this row's frost_tolerance_c. TODO(verify)."
)
HEAT_LETTUCE = (
    "Not stored. The BC lettuce guide says germination may not occur at 21°C and over unless irrigation cools the soil "
    f"({BC_LETTUCE}). That is a germination note, not a heat_limit_c. TODO(verify)."
)
EQUIP_SOURCE = (
    "The list stays empty. WSU EM051E is a home-garden bulletin. It says a trellis or fence is an option for peas, pole beans, and cucumbers, "
    f"and an A-frame for small-fruited pumpkins or winter squash ({WSU_HOME}). "
    "It does not name a required equipment id. TODO(verify) a Fraser Valley small-farm equipment list."
)
REGION_SOURCE = (
    "region_fit is oceanic, the class name in the contract. "
    f"Vancouver is temperate oceanic, Köppen Cfb ({VAN_CLIMATE}, intro read 2026-11-15). "
    f"This crop is on the BC vegetable production guide index ({BC_VEG}). "
    "Langley Township's Wikipedia intro does not state a Köppen class. TODO(verify) before treating oceanic as measured at KPU."
)
ROOT_NOTE = (
    "FAO-56 Table 22 maximum effective root depth is {span} m, read 2026-11-15 from the PDF at "
    + FAO_PDF
    + ". Footnote 1: the smaller value is for irrigation scheduling and the larger for rainfed conditions or for modelling stress. "
    "The table does not give ini, mid, and end, so those three numbers stay null."
)


def new_crop(spec: tuple) -> dict:
    cid, name, family, category, n_fixing, notes = spec
    kc = blank_kc()
    kc_source = FAO_TABLE_UNREAD
    if cid == "crop_bean_dry":
        kc = {"ini": 0.4, "mid": 1.15, "end": 0.35}
        kc_source = FAO_DRY_BEAN
    elif cid in KC_OVERLAY:
        kc, kc_source = KC_OVERLAY[cid]
        if cid == "crop_potato":
            kc_source += " Footnote 4: Kc end is about 0.40 for long-season potatoes with vine kill. That second value was not stored."
        if cid == "crop_radish_cover":
            kc_source += " Table 12 says Radish. This catalog row is the cover use of radish, and no separate cover coefficient was printed."
    sources = {
        "family": FAMILY_TODO,
        "n_fixing": NFIX_LEGUME if n_fixing else "Not a legume in this row. TODO(verify)",
        "season_window": WINDOW_BY_CROP.get(cid, WINDOW_TODO),
        "cover_curve": COVER_TODO,
        "kc_stages": kc_source,
        "residue_class": CLASS_TODO,
        "frost_tolerance_c": FROST_COLE if cid in {"crop_cabbage", "crop_broccoli", "crop_cauliflower", "crop_brussels_sprouts"} else "No frost temperature was sourced. Null is not zero. TODO(verify)",
        "heat_limit_c": HEAT_LETTUCE if cid == "crop_lettuce" else "No heat limit was sourced. Null is not zero. TODO(verify)",
        "drought_tolerance": CLASS_TODO,
        "cover_crop": "True only when category is cover. TODO(verify)",
        "perennial": "True only for apple in the new rows. TODO(verify)",
    }
    sources.update(v2_sources(n_fixing, "Assigned from the catalog group in the forecast PRD. TODO(verify) with an agronomist"))
    if cid in BC_INDEX or cid in WINDOW_BY_CROP:
        sources["needs_equipment"] = EQUIP_SOURCE
    if cid in BC_INDEX:
        sources["region_fit"] = REGION_SOURCE
    if cid in ROOT_RANGE:
        sources["root_depth_m"] = ROOT_NOTE.format(span=ROOT_RANGE[cid])
    block = v2_block(n_fixing)
    if cid in BC_INDEX:
        block["region_fit"] = ["oceanic"]
    return {
        "id": cid,
        "name": name,
        "family": family,
        "n_fixing": n_fixing,
        "season_window": {"plant_doy": None, "terminate_doy": None},
        "cover_curve": [],
        "notes": notes + " Coefficients are filled only where a table cell or a guide sentence was read.",
        "source": "See trait_sources.",
        "category": category,
        "kc_stages": kc,
        "residue_class": None,
        "frost_tolerance_c": None,
        "heat_limit_c": None,
        "drought_tolerance": None,
        "cover_crop": category == "cover",
        "perennial": cid == "crop_apple",
        **block,
        "trait_sources": sources,
    }


def main() -> None:
    ported = [port(crop) for crop in json.loads(TRAITS.read_text(encoding="utf-8"))]
    crops = ported + [new_crop(spec) for spec in NEW]
    ids = [crop["id"] for crop in crops]
    if len(ids) != len(set(ids)):
        raise SystemExit("duplicate crop id")
    if len(crops) < 40:
        raise SystemExit(f"need 40 crops, got {len(crops)}")
    doc = {"data_mode": "seed", "crops": crops, "equipment": []}
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(crops)} crops -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

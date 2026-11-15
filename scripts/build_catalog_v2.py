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


def new_crop(spec: tuple) -> dict:
    cid, name, family, category, n_fixing, notes = spec
    kc = blank_kc()
    kc_source = FAO_TABLE_UNREAD
    if cid == "crop_wheat_spring":
        kc = {"ini": None, "mid": 1.15, "end": None}
        kc_source = FAO_WHEAT_MID
    elif cid == "crop_bean_dry":
        kc = {"ini": 0.4, "mid": 1.15, "end": 0.35}
        kc_source = FAO_DRY_BEAN
    sources = {
        "family": FAMILY_TODO,
        "n_fixing": NFIX_LEGUME if n_fixing else "Not a legume in this row. TODO(verify)",
        "season_window": WINDOW_TODO,
        "cover_curve": COVER_TODO,
        "kc_stages": kc_source,
        "residue_class": CLASS_TODO,
        "frost_tolerance_c": "No frost temperature was sourced. Null is not zero. TODO(verify)",
        "heat_limit_c": "No heat limit was sourced. Null is not zero. TODO(verify)",
        "drought_tolerance": CLASS_TODO,
        "cover_crop": "True only when category is cover. TODO(verify)",
        "perennial": "True only for apple in the new rows. TODO(verify)",
    }
    sources.update(v2_sources(n_fixing, "Assigned from the catalog group in the forecast PRD. TODO(verify) with an agronomist"))
    return {
        "id": cid,
        "name": name,
        "family": family,
        "n_fixing": n_fixing,
        "season_window": {"plant_doy": None, "terminate_doy": None},
        "cover_curve": [],
        "notes": notes + " Window, cover curve, and most coefficients are not verified.",
        "source": "TODO(verify). See trait_sources.",
        "category": category,
        "kc_stages": kc,
        "residue_class": None,
        "frost_tolerance_c": None,
        "heat_limit_c": None,
        "drought_tolerance": None,
        "cover_crop": category == "cover",
        "perennial": cid == "crop_apple",
        **v2_block(n_fixing),
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

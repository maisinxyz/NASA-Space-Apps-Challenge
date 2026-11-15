"""Group 2 exposure. Point hazards from the feature table. No invented zone polygons."""

from __future__ import annotations

from app.core.errors import ApiError
from app.features import config as C
from app.features import seeds
from app.features.pipeline import vulnerable_weeks
from app.features.zones import spatial_limits
from app.rotation.config import DEFAULT_PRESET, SITE_PRESETS
from app.rotation.engine import build
from app.rotation.traits import library
from app.services.features import feature_table, site_info, zones
from app.twin.catalog import load_catalog
from app.twin.types import BARE_COVER_MAX

# Feature-table hazard ids that match ForecastHazard. Extreme rain is not waterlogging.
HAZARD = {"frost_prob": "frost", "heat_prob": "heat", "dry_spell_prob": "drought"}
SUPPORT = "This tool supports, and does not replace, local agronomic expertise."


def _preset(site_id: str) -> dict:
    return SITE_PRESETS.get(site_id, DEFAULT_PRESET)


def _preset_crops(preset: dict) -> list[str]:
    ids: list[str] = []
    for _year, main, off in preset["slots"]:
        for cid in (main, off):
            if cid != "fallow" and cid not in ids:
                ids.append(cid)
    return ids


def parse_crops(site_id: str, raw: str | None) -> tuple[list[str], dict]:
    preset = _preset(site_id)
    if raw is None or not raw.strip():
        return _preset_crops(preset), preset
    ids = [part.strip() for part in raw.split(",") if part.strip()]
    if len(ids) != len(set(ids)):
        raise ApiError("INVALID_INPUT", "Crop ids must be unique.")
    known = {crop["id"] for crop in load_catalog()["crops"]}
    unknown = [cid for cid in ids if cid not in known]
    if unknown:
        raise ApiError("UNKNOWN_CROP", "Unknown crop in the exposure list.", hint=", ".join(unknown))
    return ids, preset


def in_ground_weeks(crop: dict) -> list[int] | None:
    window = crop.get("season_window") or {}
    plant, end = window.get("plant_doy"), window.get("terminate_doy")
    if not isinstance(plant, int) or not isinstance(end, int):
        return None

    def week(doy: int) -> int:
        return min((doy - 1) // 7, 51)

    start, stop = week(plant), week(end)
    if stop >= start:
        return list(range(start, stop + 1))
    return list(range(0, stop + 1)) + list(range(start, 52))


def bare_windows(preset: dict) -> list[dict]:
    """Weeks whose weekly mean cover is under 0.25 on the preset timeline."""
    slots = []
    for year, main, off in preset["slots"]:
        slots.append({"year_index": year, "season": "spring", "crop_id": main})
        slots.append({"year_index": year, "season": "winter", "crop_id": off})
    plan = build(slots)
    windows = []
    for year in range(plan.years):
        weeks = [w for w in range(52) if float(plan.cover_w[year, w]) < BARE_COVER_MAX]
        windows.append({
            "weeks": weeks,
            "source": "rotation_plan",
            "scene_count": None,
            "note": (
                f"Year {year + 1} of the preset {preset['name']}. "
                "Weekly mean cover comes from the trait-library cover curve, which is marked TODO(verify). "
                "NDVI was not cross-checked because load_ndvi returned None."
            ),
        })
    return windows


def exposure_report(site_id: str, crops_query: str | None = None) -> dict:
    site_info(site_id)
    crops, preset = parse_crops(site_id, crops_query)
    table = feature_table(site_id)
    lib = library()
    seasons = []
    caveats = [
        SUPPORT,
        "Planting windows and cover curves used here are marked TODO(verify) in the trait library.",
        "Waterlogging weeks were not computed. Extreme rain was not relabeled as waterlogging.",
        "NDVI, SMAP, ECOSTRESS, GRACE-FO, and a DEM were not retrieved. See the satellite gap records.",
    ]
    for cid in crops:
        crop = lib.get(cid)
        weeks = in_ground_weeks(crop) if crop else None
        if weeks is None:
            caveats.append(f"{cid} has no verified planting window, so no vulnerable weeks were computed.")
            continue
        for item in vulnerable_weeks(table, weeks):
            name = HAZARD.get(item["hazards"][0])
            if name is None:
                continue
            seasons.append({
                "crop_id": cid,
                "growth_stage": "in_ground",
                "weeks": item["weeks"],
                "hazards": [name],
            })
    collection = zones(site_id)
    moisture = seeds.load_smap(site_id) is not None or seeds.load_ecostress(site_id) is not None
    kept = []
    for zone in collection["zones"]:
        if zone.get("kind") == "water_stress" and not moisture:
            continue
        kept.append(zone)
    missing_satellite = any(
        fn(site_id) is None for fn in (seeds.load_ndvi, seeds.load_smap, seeds.load_ecostress, seeds.load_grace, seeds.load_dem)
    )
    notes = [C.POWER_RESOLUTION_NOTE]
    notes += spatial_limits(dem_present=seeds.load_dem(site_id) is not None, moisture_present=moisture)
    return {
        "site_id": site_id,
        "data_mode": "limited_data" if missing_satellite else collection["data_mode"],
        "crops": crops,
        "vulnerable_seasons": seasons,
        "bare_field_windows": bare_windows(preset),
        "zones": kept,
        "resolution_notes": notes,
        "caveats": caveats + list(collection.get("caveats") or []),
    }

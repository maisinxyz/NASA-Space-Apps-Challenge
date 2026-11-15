"""Group 2 exposure. Point hazards from the feature table. No invented zone polygons."""

from __future__ import annotations

import numpy as np

from app.core.errors import ApiError
from app.features import config as C
from app.features import seeds
from app.features.pipeline import vulnerable_weeks, weekly_seed_grid
from app.features.zones import read_elevation, spatial_limits
from app.rotation.config import DEFAULT_PRESET, SITE_PRESETS
from app.rotation.engine import build
from app.rotation.traits import library
from app.services.features import feature_table, site_info, zones
from app.twin.catalog import load_catalog
from app.twin.types import BARE_COVER_MAX

# Feature-table hazard ids that match ForecastHazard. Extreme rain is not waterlogging.
HAZARD = {"frost_prob": "frost", "heat_prob": "heat", "dry_spell_prob": "drought"}
SUPPORT = "This tool supports, and does not replace, local agronomic expertise."
# Weeks below this NDVI are treated as bare. Assumed.
# USGS: barren rock, sand, or snow is often 0.1 or less; sparse vegetation is about 0.2 to 0.5.
# TODO(verify). https://www.usgs.gov/landsat-missions/landsat-normalized-difference-vegetation-index
NDVI_BARE_MAX = 0.2


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


def _ndvi_window(doc: dict | None) -> dict | None:
    """One NDVI cross-check window. None when the loader returned nothing usable."""

    if doc is None:
        return None
    years, grid = weekly_seed_grid(doc)
    if not years:
        return None
    with np.errstate(all="ignore"):
        mean = np.nanmean(grid, axis=0)
    weeks = [w for w in range(52) if np.isfinite(mean[w]) and float(mean[w]) < NDVI_BARE_MAX]
    scene_count = _scene_count(doc, weeks)
    count_note = "n_obs was not stored, so the cloud-free count is null." if scene_count is None else f"Cloud-free count is the sum of n_obs on those weeks ({scene_count})."
    return {
        "weeks": weeks,
        "source": "ndvi",
        "scene_count": scene_count,
        "note": (
            f"Weeks whose mean NDVI over {years[0]}-{years[-1]} is below {NDVI_BARE_MAX}. "
            "That threshold is assumed. TODO(verify). "
            "https://www.usgs.gov/landsat-missions/landsat-normalized-difference-vegetation-index "
            f"{count_note}"
        ),
    }


def _scene_count(doc: dict, weeks: list[int]) -> int | None:
    rows = doc.get("weekly")
    if not isinstance(rows, list) or not weeks:
        return 0 if weeks == [] else None
    total = 0
    for row in rows:
        if not isinstance(row, dict):
            return None
        obs = row.get("n_obs")
        if not isinstance(obs, list) or len(obs) != 52:
            return None
        for week in weeks:
            value = obs[week]
            if value is None:
                continue
            try:
                total += int(value)
            except (TypeError, ValueError):
                return None
    return total


def _seasonal_dry_weeks(doc: dict | None) -> list[int]:
    """Weeks whose mean is below that series' own annual mean. Empty when the loader returned None."""

    years, grid = weekly_seed_grid(doc)
    if not years:
        return []
    with np.errstate(all="ignore"):
        week_mean = np.nanmean(grid, axis=0)
        centre = np.nanmean(week_mean)
    if not np.isfinite(centre):
        return []
    return [w for w in range(52) if np.isfinite(week_mean[w]) and float(week_mean[w]) < float(centre)]


def _support_notes(smap: dict | None, ecostress: dict | None, drought_weeks: set[int]) -> list[str]:
    notes = []
    if smap is not None:
        dry = _seasonal_dry_weeks(smap)
        overlap = sorted(set(dry) & drought_weeks)
        if dry:
            notes.append(
                "SMAP weekly means below that record's own annual mean fall in weeks "
                f"{_week_span(dry)}. Basis derived. "
                + (
                    f"Weeks {_week_span(overlap)} also sit in a POWER drought season. They were not added as a new hazard."
                    if overlap
                    else "None of those weeks sit in a POWER drought season, so no drought week was added."
                )
            )
    if ecostress is not None:
        years, grid = weekly_seed_grid(ecostress)
        if years:
            with np.errstate(all="ignore"):
                week_mean = np.nanmean(grid, axis=0)
                centre = np.nanmean(week_mean)
            high = [w for w in range(52) if np.isfinite(week_mean[w]) and np.isfinite(centre) and float(week_mean[w]) > float(centre)]
            overlap = sorted(set(high) & drought_weeks)
            unit = ecostress.get("unit") if isinstance(ecostress.get("unit"), str) else "the stored unit"
            if high:
                notes.append(
                    f"ECOSTRESS weekly means above that record's own annual mean ({unit}) fall in weeks {_week_span(high)}. "
                    "Basis derived. "
                    + (
                        f"Weeks {_week_span(overlap)} overlap a POWER drought season. They support that season and do not replace it."
                        if overlap
                        else "None of those weeks overlap a POWER drought season."
                    )
                )
    return notes


def _week_span(weeks: list[int]) -> str:
    if not weeks:
        return "none"
    if len(weeks) > 8:
        return f"{weeks[0]}-{weeks[-1]} ({len(weeks)} weeks)"
    return ", ".join(str(w) for w in weeks)


def bare_windows(preset: dict, ndvi_doc: dict | None = None) -> list[dict]:
    """Weeks whose weekly mean cover is under 0.25 on the preset timeline."""
    slots = []
    for year, main, off in preset["slots"]:
        slots.append({"year_index": year, "season": "spring", "crop_id": main})
        slots.append({"year_index": year, "season": "winter", "crop_id": off})
    plan = build(slots)
    cross = "NDVI was not cross-checked because load_ndvi returned None." if ndvi_doc is None else "An NDVI window is listed separately as a cross-check."
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
                f"{cross}"
            ),
        })
    extra = _ndvi_window(ndvi_doc)
    if extra is not None:
        windows.append(extra)
    return windows


def exposure_report(site_id: str, crops_query: str | None = None, *, location: tuple[float, float] | None = None) -> dict:
    site_info(site_id, location)
    crops, preset = parse_crops(site_id, crops_query)
    table = feature_table(site_id, location=location)
    lib = library()
    seasons = []
    ndvi = seeds.load_ndvi(site_id)
    smap = seeds.load_smap(site_id)
    ecostress = seeds.load_ecostress(site_id)
    dem_doc, _which = read_elevation(site_id)
    missing = []
    if ndvi is None:
        missing.append("NDVI")
    if smap is None:
        missing.append("SMAP")
    if ecostress is None:
        missing.append("ECOSTRESS")
    if seeds.load_grace(site_id) is None:
        missing.append("GRACE-FO")
    if dem_doc is None:
        missing.append("a DEM")
    caveats = [
        SUPPORT,
        "Planting windows and cover curves used here are marked TODO(verify) in the trait library.",
        "Waterlogging weeks were not computed. Extreme rain was not relabeled as waterlogging.",
    ]
    if len(missing) == 5:
        caveats.append("NDVI, SMAP, ECOSTRESS, GRACE-FO, and a DEM were not retrieved. See the satellite gap records.")
    elif missing:
        caveats.append("Still not stored: " + ", ".join(missing) + ".")
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
    drought_weeks = {w for row in seasons if "drought" in row["hazards"] for w in row["weeks"]}
    caveats.extend(_support_notes(smap, ecostress, drought_weeks))
    collection = zones(site_id) if location is None else {"zones": [], "data_mode": "limited_data", "caveats": ["No elevation grid for this custom field."]}
    moisture = smap is not None or ecostress is not None
    kept = []
    for zone in collection["zones"]:
        if zone.get("kind") == "water_stress" and not moisture:
            continue
        kept.append(zone)
    notes = [C.POWER_RESOLUTION_NOTE]
    notes += spatial_limits(dem_present=dem_doc is not None, moisture_present=moisture)
    return {
        "site_id": site_id,
        "data_mode": "limited_data" if missing else collection["data_mode"],
        "crops": crops,
        "vulnerable_seasons": seasons,
        "bare_field_windows": bare_windows(preset, ndvi),
        "zones": kept,
        "resolution_notes": notes,
        "caveats": caveats + list(collection.get("caveats") or []),
    }

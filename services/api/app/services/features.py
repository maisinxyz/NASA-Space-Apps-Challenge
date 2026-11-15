"""Feature tables, hazard calendar and catalog (Backend A).

Curated sites read data/seed only (works with OFFLINE=1). Other sites with a `location` run limited-data mode on
NASA POWER through app.weather.power (live, else its cache; OFFLINE=1 = cache only, miss = WEATHER_UNAVAILABLE).
"""

from __future__ import annotations

import json
from functools import lru_cache

import numpy as np

from app.core.errors import ApiError
from app.features import config as C
from app.features import pipeline as P
from app.features import seeds
from app.services import sites as site_svc
from app.services import terrain as terrain_svc
from app.weather import power


def site_info(site_id: str, location: tuple[float, float] | None = None) -> dict:
    """Curated site, else a request `location` ([lon, lat], limited data), else a listed site with a location."""
    if site_id in C.CURATED_SITES:
        return {**C.CURATED_SITES[site_id], "curated": True}
    if location:
        return {"name": site_id, "lat": float(location[1]), "lon": float(location[0]), "curated": False}
    for s in site_svc.list_sites():
        if s["id"] == site_id and s.get("location"):
            lon, lat = s["location"]
            return {"name": s["name"], "lat": lat, "lon": lon, "curated": False}
    raise ApiError("SITE_NOT_FOUND", f"No site '{site_id}' with a known location.", "Pick a curated site or a site with a location.")


@lru_cache(maxsize=32)
def base(site_id: str, location: tuple[float, float] | None = None) -> tuple[P.Daily, str, dict | None, dict]:
    """(baseline daily series, data_mode, soil summary or None, site info)."""
    info = site_info(site_id, location)
    raw = seeds.load_power(site_id) if info["curated"] else None
    if raw is not None:
        result, mode = power._validate(raw), "seed"
    else:
        result = power.get_daily(info["lat"], info["lon"], *C.PERIOD)
        mode = "cached" if result["cached"] else "live"
    soil = seeds.load_soil(site_id) if info["curated"] else None
    return P.daily_from_power(result, info["lat"]), mode, soil, info


@lru_cache(maxsize=64)
def _computed(site_id: str, scenario_key: str, location: tuple[float, float] | None = None) -> P.Computed:
    return P.compute(base(site_id, location)[0], json.loads(scenario_key))


def computed(site_id: str, scenario: dict, location: tuple[float, float] | None = None) -> P.Computed:
    return _computed(site_id, json.dumps(scenario, sort_keys=True), location)


def sources(soil: dict | None) -> list[dict]:
    return [dict(C.POWER_SOURCE)] + ([dict(C.SOILGRIDS_SOURCE)] if soil else [])


def feature_table(site_id: str, scenario: dict | None = None, location: tuple[float, float] | None = None) -> dict:
    """PRD §7.7 FeatureTable. `scenario` from pipeline.resolve_scenario (default baseline); `location` = [lon, lat]
    for a non-curated site (limited data). Cached per (site, scenario, location): treat the dict as read-only."""
    return _table(site_id, json.dumps(scenario or P.resolve_scenario(), sort_keys=True), tuple(location) if location else None)


@lru_cache(maxsize=64)
def _table(site_id: str, scenario_key: str, location: tuple[float, float] | None = None) -> dict:
    return build_table(site_id, base(site_id, location), _computed(site_id, scenario_key, location))


def build_table(site_id: str, b: tuple, c: P.Computed) -> dict:
    """FeatureTable from a base() tuple and its computed grids (scripts reuse this for fixtures)."""
    _, mode, soil, info = b
    scenario = c.scenario
    limited = soil is None  # no NDVI/SMAP seeds exist yet, so soil is the only seeded layer
    used = [{"name": "NASA POWER", "resolution_note": C.POWER_RESOLUTION_NOTE}]
    if soil:
        used.append({"name": "SoilGrids 2.0", "resolution_note": C.SOILGRIDS_RESOLUTION_NOTE})
    caveats = list(C.CAVEATS)
    if scenario["preset"] != "baseline" or scenario["rain_scale_pct"] or scenario["temp_offset_c"] or scenario["rain_scale_by_season"]:
        caveats.append("Modeled scenario, not a forecast: observed years with rain scaled and temperatures shifted. Soil wetness is not re-modeled.")
    if limited:
        caveats.append("Limited data: no seeded soil or satellite data for this location; weather-derived features only.")
    return {
        "schema_version": C.SCHEMA_VERSION,
        "pipeline_version": C.PIPELINE_VERSION,
        "site_id": site_id,
        "location": [info["lon"], info["lat"]],
        "years": {"start": f"{c.years[0]}-01-01", "end": f"{c.years[-1]}-12-31"},
        "weeks": C.WEEKS,
        "scenario": scenario,
        "data_mode": mode,
        "features": {fid: P.series(c.grids[fid], c.years, *P.FEATURE_META[fid]) for fid in P.FEATURE_META},
        "thresholds": c.thresholds,
        "soil": soil,
        "quality": {
            "years_available": c.years_available,
            "missing_fraction": c.missing_fraction,
            "sources_used": used,
            "sources_agree": None,  # no SMAP seed yet
            "resolution_note": "Weekly values per site point; daily series aggregated to 52 weeks. No spatial blending.",
            "interpolated_series": [],
            "limited_data": limited,
        },
        "sources": sources(soil),
        "caveats": caveats,
    }


def _share(grid: np.ndarray) -> np.ndarray:
    """Share of years with the event in each week."""
    return P._stats(grid)["mean"]


def hazard_calendar(site_id: str, preset: str = "baseline") -> dict:
    scenario = P.resolve_scenario(preset)
    _, mode, _, _ = base(site_id)
    c = computed(site_id, scenario)
    t = c.thresholds
    caveats = ["Rain is not bias-corrected.", "Shares of past years, not forecasts.", "Thresholds n_dry_days and q_dry are assumed."]
    if preset != "baseline":
        caveats.append("Modeled scenario, not a forecast; built from observed years.")
    return {
        "site_id": site_id,
        "scenario": preset,
        "scenario_applied": scenario,
        "data_mode": mode,
        "years": {"start": f"{c.years[0]}-01-01", "end": f"{c.years[-1]}-12-31"},
        "j_wet": P._r(_share(c.hazard_grids["heavy_rain_wet_ground"])),
        "j_dry": P._r(_share(c.grids["dry_spell_prob"])),
        "thresholds": {"q_rain": t["extreme_rain_mm"], "q_wet": t["wet_ground_value"], "n_dry_days": t["dry_spell_days"], "q_dry": t["dry_day_mm"]},
        "basis": "derived",
        "sources": [dict(C.POWER_SOURCE)],
        "caveats": caveats,
    }


def hazard_catalog(site_id: str) -> dict:
    d, mode, _, _ = base(site_id)
    c = computed(site_id, P.resolve_scenario())
    t, th = c.thresholds, C.THRESHOLDS
    frost_lo, frost_hi = th["late_frost_doy_north" if d.lat >= 0 else "late_frost_doy_south"]
    defs = {
        "heavy_rain_wet_ground": ("Heavy rain on wet ground", c.hazard_grids["heavy_rain_wet_ground"],
                                  f"A day with at least {t['extreme_rain_mm']} mm rain (wet-day p{t['extreme_rain_percentile']:g}) after a day with top-soil wetness at or above {t['wet_ground_value']} (p{t['wet_ground_percentile']:g})."),
        "multi_day_heavy_rain": ("Multi-day heavy rain", c.hazard_grids["multi_day_heavy_rain"],
                                 f"{th['multi_day_window']} days in a row totalling at least {round(th['multi_day_factor'] * t['extreme_rain_mm'], 1)} mm ({th['multi_day_factor']} x the heavy-rain day, assumed)."),
        "dry_spell": ("Dry spell", c.grids["dry_spell_prob"],
                      f"At least {t['dry_spell_days']} days in a row with less than {t['dry_day_mm']} mm rain (assumed)."),
        "heat_spell": ("Heat spell", c.hazard_grids["heat_spell"],
                       f"At least {th['heat_spell_days']} days in a row reaching {t['heat_c']} degC (assumed)."),
        "late_frost": ("Late frost", c.hazard_grids["late_frost"],
                       f"A day at or below {t['frost_c']} degC in spring (day of year {frost_lo} to {frost_hi}, assumed)."),
    }
    items = []
    for kind, (label, grid, definition) in defs.items():
        per_year = np.nan_to_num(grid).max(axis=1)
        share = np.nan_to_num(_share(grid))
        peaks = sorted((w for w in range(C.WEEKS) if share[w] > 0), key=lambda w: (-round(float(share[w]), 6), w))[:3]
        items.append({
            "id": f"haz_{kind}",
            "kind": kind,
            "label": label,
            "definition": definition,
            "years_with_event": int((per_year > 0).sum()),
            "years_total": len(c.years),
            "peak_weeks": peaks,
            "worst_storm_id": None,
            "basis": "derived",
            "sources": [dict(C.POWER_SOURCE)],
        })
    return {"site_id": site_id, "data_mode": mode, "items": items}


def zones(site_id: str) -> dict:
    """ZoneCollection. Curated sites have no terrain package yet, so they return no zones and say why."""
    from app.features.zones import zones_for_terrain

    if site_id in C.CURATED_SITES:
        return {"site_id": site_id, "terrain_id": None, "data_mode": "seed", "zones": [],
                "caveats": ["No terrain package for this site yet; zones need an elevation grid."]}
    site = next((s for s in site_svc.list_sites() if s["id"] == site_id), None)
    if site is None:
        raise ApiError("SITE_NOT_FOUND", f"No site '{site_id}'.", "Pick a site from the site list.")
    tid = site["terrain_id"]
    mock = "mock_data" in terrain_svc.get_terrain(tid).get("quality_flags", [])
    return {
        "site_id": site_id,
        "terrain_id": tid,
        "data_mode": "mock" if mock else "seed",
        "zones": zones_for_terrain(tid),
        "caveats": ["Derived from terrain and soil data, not field-measured.",
                    "Water-stress hotspots need soil and soil-moisture data on this grid; not available yet."],
    }

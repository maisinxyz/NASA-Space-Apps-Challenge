"""Backend A config: curated sites, thresholds, scenario presets.

Everything marked `assumed` is a stated choice, not a measured fact. It is echoed in every
feature table (`thresholds`) so reviewers can see and change it here. docs/prd: backend rotation PRD §7, §12.
"""

from __future__ import annotations

from datetime import date

SCHEMA_VERSION = "1.1.0"
PIPELINE_VERSION = "1.0.0"  # bump when any formula or threshold below changes
WEEKS = 52

PERIOD = (date(1991, 1, 1), date(2024, 12, 31))  # climatology window; every full year POWER has for these sites

# The three curated sites (PRD §22 open item "pick three sites in different climates").
# Chosen 2026-11-14 from the web app's twin/explore farms (apps/web/lib/farms/): humid subtropical (Beltsville),
# humid continental with cold winters (Harford NY), Mediterranean with dry summers (Napa). Change here if the team picks others.
# Coordinates copied from apps/web/lib/farms/*.ts (Oakville is marked approximate there).
CURATED_SITES: dict[str, dict] = {
    "site_usda_barc": {"name": "USDA Beltsville Agricultural Research Center", "lat": 39.0319, "lon": -76.8844, "farm_id": "usda-barc"},
    "site_cornell_ruminant": {"name": "Cornell Harford ruminant farm", "lat": 42.4409, "lon": -76.2541, "farm_id": "cornell-ruminant"},
    "site_ucdavis_oakville": {"name": "Oakville Grade area, Napa Valley", "lat": 38.4201, "lon": -122.4121, "farm_id": "ucdavis-oakville"},
}

# Thresholds (assumed unless noted). Crop-specific frost/heat limits come from the trait library (Backend B).
THRESHOLDS = {
    "frost_c": 0.0,  # assumed: weekly minimum at or below this counts as a frost week
    "heat_c": 32.0,  # assumed: weekly maximum at or above this counts as a heat week
    "extreme_rain_percentile": 95.0,  # PRD §7.2: 95th percentile of wet-day rain
    "wet_day_mm": 1.0,  # assumed: a day with at least this rain is a wet day
    "dry_day_mm": 1.0,  # assumed: a day below this rain is a dry day
    "dry_spell_days": 10,  # assumed: this many consecutive dry days make a dry spell
    "wet_ground_percentile": 75.0,  # assumed: top-soil wetness above this percentile = wet ground
    "vulnerable_prob": 0.25,  # PRD §7.4: hazard share above which a week is vulnerable
    "heat_spell_days": 3,  # assumed: consecutive days at or above heat_c
    "multi_day_window": 3,  # assumed: window for multi-day heavy rain
    "multi_day_factor": 1.5,  # assumed: window total >= factor * extreme_rain_mm
    "late_frost_doy_north": (91, 151),  # assumed: 1 Apr to 31 May (northern hemisphere)
    "late_frost_doy_south": (274, 334),  # assumed: 1 Oct to 30 Nov (southern hemisphere)
    "smap_agree_share": 0.70,  # PRD §7.6, assumed
}

# Scenario presets (PRD §12.1). TODO(verify) the values with the team (PRD §22 open item).
# Seasonal rain changes so "wetter winters" does not also wet the summer.
SCENARIO_PRESETS: dict[str, dict] = {
    "baseline": {"rain_scale_pct": 0.0, "temp_offset_c": 0.0, "rain_scale_by_season": {}},
    "wetter_winters": {"rain_scale_pct": 0.0, "temp_offset_c": 0.0, "rain_scale_by_season": {"winter": 20.0}},
    "drier_summers": {"rain_scale_pct": 0.0, "temp_offset_c": 1.0, "rain_scale_by_season": {"summer": -20.0}},
    "both": {"rain_scale_pct": 0.0, "temp_offset_c": 1.0, "rain_scale_by_season": {"winter": 20.0, "summer": -20.0}},
}
RAIN_SCALE_RANGE = (-50.0, 50.0)  # assumed slider range, percent
TEMP_OFFSET_RANGE = (-3.0, 5.0)  # assumed slider range, degC

# Meteorological seasons by month, northern hemisphere. Southern hemisphere shifts by six months.
SEASON_MONTHS_NORTH = {"winter": (12, 1, 2), "spring": (3, 4, 5), "summer": (6, 7, 8), "fall": (9, 10, 11)}

# Datasets (PRD §6, A8). Every entry has source, license and attribution.
POWER_SOURCE = {
    "name": "NASA POWER daily point (MERRA-2 meteorology)",
    "role": "weather",
    "url": "https://power.larc.nasa.gov/docs/services/api/",
    # Sources: https://registry.opendata.aws/nasa-power/ ("no restrictions on the use ... we request that you cite"),
    # https://power.larc.nasa.gov/docs/referencing/ . TODO(verify) the exact acknowledgment wording on the referencing page.
    "license": "No restrictions on use; citation requested by the NASA POWER Project",
    "attribution": "Data from the NASA Langley Research Center POWER Project, funded through the NASA Earth Science Directorate Applied Science Program.",
    "basis": "modeled",
    "resolution_m": 55000,  # 0.5 deg x 0.625 deg MERRA-2 grid, about 55 km in latitude
}
SOILGRIDS_SOURCE = {
    "name": "SoilGrids 2.0 (ISRIC)",
    "role": "soil",
    "url": "https://www.isric.org/explore/soilgrids",
    # Source: https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html ("provided under the CC BY 4.0 license").
    "license": "CC BY 4.0",
    "attribution": "SoilGrids 2.0, ISRIC - World Soil Information (Poggio et al. 2021, SOIL 7, 217-240).",
    "basis": "modeled",
    "resolution_m": 250,
}
POWER_RESOLUTION_NOTE = "Regional estimate on a 0.5 x 0.625 degree grid (about 50 km), not a field sensor."
SOILGRIDS_RESOLUTION_NOTE = "250 m modeled soil map, mean of 0-30 cm; not a soil sample."
SOILGRIDS_QUERY_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"

CAVEATS = [
    "Weather is a regional estimate from NASA POWER, not measured on this field.",
    "Rain is not bias-corrected against local gauges.",
    "Reference evapotranspiration is estimated from temperature only (Hargreaves-Samani), so it is modeled.",
    "Probabilities are shares of past years, not forecasts.",
    "Thresholds marked assumed are stated choices; see `thresholds`.",
]

"""Record satellite gaps for a curated site. Never invents a measurement.

NASA Earthdata credentials were not available when this was written
(EARTHDATA_USERNAME, EARTHDATA_PASSWORD, EARTHDATA_TOKEN). Product short names
below were read from the public CMR collection search on 2026-11-15. No granule
was downloaded. Run from the repo root:

    uv run --project services/api python scripts/seed_satellite/extract.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / "data" / "seed"
CMR = "https://cmr.earthdata.nasa.gov/search/collections.json?short_name="
REASON = (
    "NASA Earthdata credentials were not in the environment "
    "(EARTHDATA_USERNAME, EARTHDATA_PASSWORD, EARTHDATA_TOKEN; no .env file). "
    "No granule was downloaded. weekly is null. This file is a gap record, not a measurement."
)

# short_name, version, title: copied from CMR collection search responses on 2026-11-15.
PRODUCTS = {
    "ndvi": [
        ("HLSL30_VI", "2.0", "HLS Operational Land Imager Vegetation Indices Daily Global 30 m V2.0"),
        ("HLSS30_VI", "2.0", "HLS Sentinel-2 Multi-spectral Instrument Vegetation Indices Daily Global 30 m V2.0"),
    ],
    "smap": [
        ("SPL4SMGP", "008", "SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical Data V008"),
        ("SPL3SMP", "009", "SMAP L3 Radiometer Global Daily 36 km EASE-Grid Soil Moisture V009"),
    ],
    "ecostress": [
        ("ECO_L3T_JET", "003", "ECOSTRESS Tiled Evapotranspiration PT-JPL Instantaneous and Daytime L3 Global 70 m v003"),
        ("ECO_L3G_JET", "002", "ECOSTRESS Gridded Evapotranspiration Instantaneous and Daytime L3 Global 70 m V002"),
        ("ECO_L3T_ET_ALEXI", "002", "ECOSTRESS Tiled Evapotranspiration disALEXI 24-Hour L3 CONUS 70 m V002"),
    ],
    "grace": [
        ("TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4", "RL06.3Mv04", "JPL GRACE and GRACE-FO Mascon Ocean, Ice, and Hydrology Equivalent Water Height Coastal Resolution Improvement (CRI) Filtered Release 06.3 Version 04"),
        ("TELLUS_GRAC-GRFO_MASCON_GRID_RL06.3_V4", "RL06.3Mv04", "JPL GRACE and GRACE-FO Mascon Ocean, Ice, and Hydrology Equivalent Water Height JPL Release 06.3 Version 04"),
    ],
    "dem": [
        ("NASADEM_HGT", "001", "NASADEM Merged DEM Global 1 arc second V001"),
    ],
}

# Seen on CMR, not one of the five loader names. Recorded in the progress note only.
IMERG = ("GPM_3IMERGDF", "07", "GPM IMERG Final Precipitation L3 1 day 0.1 degree x 0.1 degree V07 (GPM_3IMERGDF)")

NOTES = {
    "ndvi": "CMR summaries call these vegetation-index collections. The NDVI band name was not in the summary text that was read. TODO(verify) the band list before computing an index. Cloud mask and scene counts were not retrieved.",
    "smap": "Both an L4 9 km root-zone product and an L3 36 km product were listed. Neither was retrieved, and AppEEARS was not called. No choice between L3 and L4 is stored as data.",
    "ecostress": "Three ET collections were listed, including a CONUS disALEXI product. None was retrieved. UBC Farm is outside CONUS, so the CONUS product may not cover it. TODO(verify) coverage.",
    "grace": "Two JPL mascon collections were listed. Grid spacing was not in the titles that were read. TODO(verify) the spacing. No regional anomaly was computed.",
    "dem": "NASADEM_HGT is a 1 arc second elevation model. The CMR summary that was read does not say it is bare earth. The user guide was not opened: https://lpdaac.usgs.gov/documents/2237/NASADEM_User_Guide_V13.pdf DOI https://doi.org/10.5067/MEASURES/NASADEM/NASADEM_HGT.001",
}


def credentials_present() -> bool:
    return any(os.environ.get(key, "").strip() for key in ("EARTHDATA_USERNAME", "EARTHDATA_PASSWORD", "EARTHDATA_TOKEN"))


def write_gap(site_id: str) -> None:
    if credentials_present():
        raise SystemExit(
            "Earthdata credentials are set, but this script does not download. "
            "Refusing to write a measurement. No values were invented."
        )
    out = SEED / site_id
    out.mkdir(parents=True, exist_ok=True)
    for name, candidates in PRODUCTS.items():
        doc = {
            "data_mode": "limited_data",
            "available": False,
            "site_id": site_id,
            "product": name,
            "weekly": None,
            "scene_count": None,
            "candidates": [
                {"short_name": short, "version": version, "title": title, "cmr": CMR + short}
                for short, version, title in candidates
            ],
            "reason": REASON,
        }
        (out / f"{name}.gap.json").write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8")
        first = candidates[0]
        meta = {
            "source_name": first[2],
            "source_url": CMR + first[0],
            "product_version": first[1],
            "retrieved_on": "2026-11-15",
            "license": "Not retrieved. No licence text was copied. TODO(verify) the collection licence before any download.",
            "attribution": "Collection title from a public CMR search. No granules, so no data attribution applies yet.",
            "resolution_spatial": "not retrieved",
            "resolution_temporal": "not retrieved",
            "processing_notes": NOTES[name] + " " + REASON,
        }
        (out / f"{name}.meta.json").write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
    print(f"wrote gap records for {site_id}; IMERG seen but not stored: {IMERG[0]} {IMERG[1]}")


if __name__ == "__main__":
    write_gap("site_ubc_farm")

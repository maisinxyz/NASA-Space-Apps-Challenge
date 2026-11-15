#!/usr/bin/env python3
"""Build small ECCC daily station sidecars for the two BC twins.

Run from the repository root with the API package importable, for example:
    PYTHONPATH=services/api python3 scripts/seed_station_check.py
Only a fixed 1991-2024 comparison interval is seeded, matching NASA POWER.
"""

from __future__ import annotations

import gzip
import json
import math
from pathlib import Path
import urllib.parse
import urllib.request

from app.features.config import CURATED_SITES
from app.twin.station_bias import monthly_comparison

ROOT = Path(__file__).resolve().parents[1]
START = "1991-01-01"
END = "2024-12-31"
API = "https://api.weather.gc.ca/collections"
LICENCE = "https://eccc-msc.github.io/open-data/licence/readme_en/"

# Chosen after checking geometry distance and live daily variables. Distances
# use GeoJSON geometry, not the collection's inconsistent integer coord fields.
STATIONS = {
    "site_ubc_farm": {"name": "VANCOUVER INTL A", "climate_identifier": "1108395"},
    "site_kpu_langley": {"name": "CLOVERDALE EAST", "climate_identifier": "1101708"},
}


def get_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "FieldTwin station verification/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def pages(collection: str, params: dict) -> list[dict]:
    """Fetch all OGC pages using offset/numberMatched; server caps limit at 10k."""
    rows: list[dict] = []
    offset = 0
    while True:
        query = {**params, "limit": 10000, "offset": offset}
        url = f"{API}/{collection}/items?{urllib.parse.urlencode(query)}"
        doc = get_json(url)
        features = doc.get("features") or []
        rows.extend(features)
        if not features or offset + len(features) >= int(doc.get("numberMatched", len(rows))):
            break
        offset += len(features)
    return rows


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat, dlon = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(h))


def load_power(site_id: str) -> dict:
    path = ROOT / "data" / "seed" / site_id / "power_daily.json.gz"
    with gzip.open(path, "rt", encoding="utf-8") as stream:
        return json.load(stream)


def build(site_id: str, selected: dict) -> None:
    metadata_rows = pages("climate-stations", {"f": "json", "CLIMATE_IDENTIFIER": selected["climate_identifier"]})
    if len(metadata_rows) != 1:
        raise RuntimeError(f"Expected one station metadata record for {selected['climate_identifier']}, got {len(metadata_rows)}")
    feature = metadata_rows[0]
    props = feature["properties"]
    coords = feature["geometry"]["coordinates"]
    site = CURATED_SITES[site_id]
    distance = distance_km(site["lat"], site["lon"], coords[1], coords[0])

    features = pages("climate-daily", {
        "f": "json", "CLIMATE_IDENTIFIER": selected["climate_identifier"],
        "datetime": f"{START}/{END}", "sortby": "LOCAL_DATE",
    })
    daily = []
    for feature in features:
        row = feature.get("properties", {})
        # The source publishes local calendar dates without an offset. Preserve
        # the date component rather than coercing midnight to UTC and shifting it.
        local_date = str(row.get("LOCAL_DATE", ""))[:10]
        if len(local_date) != 10:
            continue
        daily.append({
            "local_date": local_date,
            "mean_temperature_c": row.get("MEAN_TEMPERATURE"),
            "total_rain_mm": row.get("TOTAL_RAIN"),
            "total_precipitation_mm": row.get("TOTAL_PRECIPITATION"),
            "temperature_flag": row.get("MEAN_TEMPERATURE_FLAG"),
            "rain_flag": row.get("TOTAL_RAIN_FLAG"),
            "precipitation_flag": row.get("TOTAL_PRECIPITATION_FLAG"),
        })
    daily.sort(key=lambda item: item["local_date"])
    if len({row["local_date"] for row in daily}) != len(daily):
        raise RuntimeError(f"Duplicate local dates for {site_id}")

    comparison = monthly_comparison(load_power(site_id), daily)
    comparison.update({
        "station": {
            "name": props.get("STATION_NAME"),
            "climate_identifier": props.get("CLIMATE_IDENTIFIER"),
            "station_type": props.get("STATION_TYPE"),
            "coordinates_geojson_lon_lat": coords[:2],
            "distance_to_site_km": round(distance, 2),
            "catalog_daily_first_date": str(props.get("DLY_FIRST_DATE", ""))[:10],
            "catalog_daily_last_date": str(props.get("DLY_LAST_DATE", ""))[:10],
        },
        "source_url": f"{API}/climate-daily/items?CLIMATE_IDENTIFIER={selected['climate_identifier']}",
        "licence_url": LICENCE,
        "attribution": "Data Source: Environment and Climate Change Canada",
        "retrieved_on": "2026-11-15",
        "daily_interval": {"start": START, "end": END},
    })
    folder = ROOT / "data" / "seed" / site_id
    folder.mkdir(parents=True, exist_ok=True)
    with gzip.open(folder / "station_daily.json.gz", "wt", encoding="utf-8", newline="\n") as stream:
        json.dump({"site_id": site_id, "station": comparison["station"], "daily": daily}, stream, separators=(",", ":"), sort_keys=True)
    (folder / "station_bias.json").write_text(json.dumps(comparison, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    sidecar = {
        "source_name": "Environment and Climate Change Canada MSC GeoMet climate-daily OGC API",
        "source_url": comparison["source_url"],
        "collection_url": f"{API}/climate-daily",
        "product_version": "MSC GeoMet OGC API; live service at retrieval time",
        "retrieved_on": "2026-11-15",
        "license": "Environment and Climate Change Canada Data Services End-use Licence v2.1.1 (August 2026)",
        "license_url": LICENCE,
        "attribution": comparison["attribution"],
        "resolution_temporal": "daily; LOCAL_DATE is a local calendar date without UTC offset",
        "processing_notes": "Stored MEAN_TEMPERATURE (°C), TOTAL_RAIN (mm), and TOTAL_PRECIPITATION (mm) as published. POWER overlap comparison uses paired local calendar dates. Rain comparison is explicitly against POWER PRECTOTCORR, which is total precipitation and may include frozen precipitation; use the like-for-like total precipitation comparison for precipitation bias.",
        "station": comparison["station"],
        "comparison": "Monthly mean of paired daily differences by calendar month, 1991-2024 POWER seed interval; only overlapping valid pairs count.",
        "resolution_spatial": (
            f"Point station {coords[1]:.6f}, {coords[0]:.6f}; {distance:.2f} km great-circle from configured site point. "
            "The station is a point cross-check, not a field measurement."
        ),
    }
    (folder / "station_daily.meta.json").write_text(json.dumps(sidecar, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    power_meta = json.loads((folder / "power_daily.meta.json").read_text(encoding="utf-8"))
    bias_meta = {
        "source_name": "Derived station comparison: NASA POWER and ECCC MSC GeoMet climate-daily",
        "source_url": comparison["source_url"],
        "source_urls": [power_meta["source_url"], comparison["source_url"], LICENCE],
        "product_version": "NASA POWER Daily API v2.10.3 and ECCC MSC GeoMet OGC API at retrieval time",
        "retrieved_on": "2026-11-15",
        "license": f"NASA POWER: {power_meta['license']}; ECCC: Data Services End-use Licence v2.1.1 (August 2026)",
        "license_url": LICENCE,
        "attribution": f"{power_meta['attribution']} Data Source: Environment and Climate Change Canada. Monthly comparison derived from both sources.",
        "basis": "derived",
        "resolution_spatial": sidecar["resolution_spatial"],
        "resolution_temporal": "Monthly summaries of paired daily values; local calendar dates, 1991-2024 overlap window.",
        "processing_notes": "POWER minus ECCC for all named differences. Temperature bias is MEAN_TEMPERATURE (°C) compared to POWER T2M (°C). The like-for-like precipitation comparison uses ECCC TOTAL_PRECIPITATION (mm/day) and POWER PRECTOTCORR (mm/day). The separate rainfall comparison uses ECCC TOTAL_RAIN (mm/day) against POWER total corrected precipitation and is not a like-for-like rain comparison; POWER may include frozen precipitation. Per-metric paired year spans and paired-day counts are in station_bias.json.",
        "station": comparison["station"],
    }
    (folder / "station_bias.meta.json").write_text(json.dumps(bias_meta, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(site_id, selected["climate_identifier"], "records", len(daily), "valid temp", sum(r["mean_temperature_c"] is not None for r in daily), "valid rain", sum(r["total_rain_mm"] is not None for r in daily), "overlap years", comparison["overlap_years"])


if __name__ == "__main__":
    for _site_id, _station in STATIONS.items():
        build(_site_id, _station)

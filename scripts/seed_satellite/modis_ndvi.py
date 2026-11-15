"""Build 2023–2025 site NDVI seeds using the public ORNL TESViS subset API."""

from __future__ import annotations

import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from edl import _ensure_api_path
from series import SERIES_YEAR_END, SERIES_YEAR_START, weekly_from_observations, write_series

API = "https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset"
DOI = "https://doi.org/10.5067/MODIS/MOD13Q1.061"
SITES = {"ubc": "site_ubc_farm", "kpu": "site_kpu_langley"}
YEARS = list(range(SERIES_YEAR_START, SERIES_YEAR_END + 1))


def observations(payload: dict, lat: float, lon: float, year: int) -> list[tuple[date, float]]:
    if (payload["nrows"], payload["ncols"]) != (1, 1):
        raise ValueError("Expected a single MODIS pixel.")
    if abs(float(payload["latitude"]) - lat) > 1e-5 or abs(float(payload["longitude"]) - lon) > 1e-5:
        raise ValueError("MODIS subset location differs from the site coordinates.")
    bands = {
        (row["calendar_date"], row["band"]): row["data"][0]
        for row in payload["subset"]
    }
    recorded = []
    for (day, band), value in sorted(bands.items()):
        if band != "250m_16_days_NDVI":
            continue
        when = date.fromisoformat(day)
        if when.year != year:
            raise ValueError(f"MODIS subset date outside {year}: {day}")
        summary = bands.get((day, "250m_16_days_pixel_reliability"))
        if summary == 0 and -2000 <= value <= 10000:
            recorded.append((when, value / 10000))
    return recorded


def fetch_window(lat: float, lon: float, year: int, start: int) -> list[tuple[date, float]]:
    end = min(start + 32, 353)
    query = urlencode({
        "latitude": lat, "longitude": lon, "startDate": f"A{year}{start:03d}",
        "endDate": f"A{year}{end:03d}", "kmAboveBelow": 0, "kmLeftRight": 0,
    })
    for attempt in range(2):
        try:
            with urlopen(f"{API}?{query}", timeout=50) as response:
                return observations(json.load(response), lat, lon, year)
        except (URLError, TimeoutError) as exc:
            if attempt or (isinstance(exc, HTTPError) and exc.code < 500):
                raise RuntimeError(f"MODIS subset failed for {lat}, {lon}, {year} days {start}–{end}") from exc


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sites", nargs="+", choices=SITES, default=list(SITES))
    args = parser.parse_args()
    _ensure_api_path()
    from app.features.config import CURATED_SITES

    for site in args.sites:
        site_id = SITES[site]
        lat, lon = (CURATED_SITES[site_id][key] for key in ("lat", "lon"))
        records = []
        with ThreadPoolExecutor(max_workers=2) as pool:
            for year in YEARS:
                # Three composites per request keeps upstream responses small.
                requests = [pool.submit(fetch_window, lat, lon, year, start) for start in range(1, 354, 48)]
                yearly = [record for request in requests for record in request.result()]
                if not yearly:
                    raise ValueError(f"No quality-screened MODIS observations for {site_id} in {year}.")
                records.extend(yearly)

        retrieved = date.today().isoformat()
        method = "One nominal 250 m pixel at the site point, retained only at pixel reliability 0."
        doc = {
            "site_id": site_id, "layer": "ndvi", "variable": "NDVI", "unit": "1", "basis": "measured",
            "product": {"short_name": "MOD13Q1", "version": "061"}, "native_resolution_m": 250,
            "spatial_method": method, "retrieved_on": retrieved,
            "weekly": weekly_from_observations(records, YEARS, ndigits=4),
        }
        meta = {
            "source_name": "NASA MODIS/Terra Vegetation Indices MOD13Q1 via ORNL DAAC TESViS",
            "source_url": DOI, "product_version": "061", "retrieved_on": retrieved,
            "license": "NASA Earth science data, freely available under the NASA Earth Science Data and Information Policy.",
            "attribution": f"Didan, K. (2021), MOD13Q1 v061, NASA LP DAAC. Access via ORNL DAAC TESViS. {DOI}",
            "resolution_spatial": "Nominal 250 m pixel; site-scale context",
            "resolution_temporal": "16-day composites in matching 7-day bins",
            "processing_notes": method + " Raw NDVI scaled by 0.0001. Each composite is assigned to its start-date week. "
            "Empty weeks stay null. Mixed land cover may contribute to the pixel.",
        }
        write_series(site_id, "ndvi", doc, meta)
        print(f"{site_id}: {len(records)} quality-screened composites across {YEARS[0]}–{YEARS[-1]}")


if __name__ == "__main__":
    main()

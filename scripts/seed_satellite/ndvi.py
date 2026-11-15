"""Weekly HLS NDVI for curated sites.

Surface reflectance bands and Fmask are read from HLSL30 v2.0 and HLSS30 v2.0.
NDVI uses L30 B05 (narrow NIR) and B04 (red), and S30 B8A (narrow NIR) and B04.
The footprint is a 150 m radius around the site point. Weeks with no clear
pixel stay null. This script is a seed build: it is not on the request path.

Collection titles were read from the public CMR collection search on 2026-11-15.
DOIs were the doi.org links on public granule records the same day:
https://doi.org/10.5067/HLS/HLSL30.002
https://doi.org/10.5067/HLS/HLSS30.002
LP DAAC's reply that its products are public domain (CC0) is
https://forum.earthdata.nasa.gov/viewtopic.php?t=5421 (read 2026-11-15).
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime

from edl import EarthdataClient, EarthdataRejected, data_hrefs, read_token, select_sites
from sample import RADIUS_M, href_named, read_window, scene_ndvi_mean
from series import RETRIEVED_ON, scrub, weekly_from_observations, write_gap, write_series

# Bounded record. The user guide says L30 starts with Landsat 8 in 2013 and
# S30 with Sentinel-2 in 2015 (HLS User Guide V2, section 2 and section 6).
# The run stops at 2025 so it stays finite. TODO(verify) is closed for the
# product start years by that guide; the 2016 bound is a choice.
YEAR_START = 2016
YEAR_END = 2025
PRODUCTS = (
    ("HLSL30", "2.0", ".B05.tif", "HLS Landsat Operational Land Imager Surface Reflectance and TOA Brightness Daily Global 30m v2.0"),
    ("HLSS30", "2.0", ".B8A.tif", "HLS Sentinel-2 Multi-spectral Instrument Surface Reflectance Daily Global 30m v2.0"),
)
CMR = "https://cmr.earthdata.nasa.gov/search/collections.json?short_name="
LICENSE = (
    "Public domain (CC0), as stated by LP DAAC for its products: "
    "https://forum.earthdata.nasa.gov/viewtopic.php?t=5421 (read 2026-11-15)."
)
ATTRIBUTION = (
    "NASA HLS v2.0 surface reflectance, LP DAAC. "
    "HLSL30 https://doi.org/10.5067/HLS/HLSL30.002 and "
    "HLSS30 https://doi.org/10.5067/HLS/HLSS30.002."
)


def _candidates() -> list[dict]:
    return [
        {"short_name": short, "version": version, "title": title, "cmr": CMR + short}
        for short, version, _nir, title in PRODUCTS
    ]


def _meta(notes: str) -> dict:
    return {
        "source_name": PRODUCTS[0][3],
        "source_url": "https://doi.org/10.5067/HLS/HLSL30.002",
        "product_version": "2.0",
        "retrieved_on": RETRIEVED_ON,
        "license": LICENSE,
        "attribution": ATTRIBUTION,
        "resolution_spatial": "30 m",
        "resolution_temporal": "Daily scenes aggregated to 7-day blocks from 1 January",
        "processing_notes": notes,
    }


def _parse_time(entry: dict) -> date | None:
    raw = entry.get("time_start")
    if not isinstance(raw, str) or len(raw) < 10:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _gdal_config(token: str, url: str) -> dict:
    from urllib.parse import urlparse

    from edl import is_earthdata_host

    parts = urlparse(url)
    if parts.scheme == "https" and is_earthdata_host(parts.hostname):
        return {"GDAL_HTTP_AUTH": "BEARER", "GDAL_HTTP_BEARER": token}
    return {}


def _one_scene(client: EarthdataClient, token: str, entry: dict, nir_suffix: str, lon: float, lat: float) -> float | None:
    hrefs = data_hrefs(entry)
    red_url = href_named(hrefs, ".B04.tif")
    nir_url = href_named(hrefs, nir_suffix)
    qa_url = href_named(hrefs, ".Fmask.tif")
    if not red_url or not nir_url or not qa_url:
        return None
    bands = []
    for url in (red_url, nir_url, qa_url):
        final = client.resolve(url)
        window = read_window(final, lon, lat, RADIUS_M, _gdal_config(token, final))
        if window is None:
            return None
        bands.append(window)
    red, nir, qa = bands
    if red["data"].shape != nir["data"].shape or red["data"].shape != qa["data"].shape:
        return None
    mean, _pixels = scene_ndvi_mean(red["data"], nir["data"], qa["data"], red["east_m"], red["north_m"], RADIUS_M)
    return mean


def build_site(client: EarthdataClient, token: str, site_id: str, info: dict) -> dict:
    """Search both HLS products and return the series document, or raise if Earthdata rejects the token."""
    lon = float(info["lon"])
    lat = float(info["lat"])
    start = date(YEAR_START, 1, 1)
    end = date(YEAR_END, 12, 31)
    observations: list[tuple[date, float]] = []
    counts: dict[int, int] = {year: 0 for year in range(YEAR_START, YEAR_END + 1)}
    considered = 0
    skipped_files = 0
    for short, version, nir_suffix, _title in PRODUCTS:
        entries = client.search_granules(
            short_name=short, version=version, start=start, end=end, point=(lon, lat), page_size=500,
        )
        entries = sorted(entries, key=lambda item: (str(item.get("time_start") or ""), str(item.get("title") or "")))
        for entry in entries:
            when = _parse_time(entry)
            if when is None or when < start or when > end:
                continue
            considered += 1
            try:
                mean = _one_scene(client, token, entry, nir_suffix, lon, lat)
            except EarthdataRejected:
                raise
            except Exception:
                skipped_files += 1
                continue
            if mean is None:
                continue
            observations.append((when, mean))
            counts[when.year] = counts.get(when.year, 0) + 1
    years = list(range(YEAR_START, YEAR_END + 1))
    weekly = weekly_from_observations(observations, years, ndigits=4)
    notes = (
        "NDVI = (NIR - red) / (NIR + red) from HLS v2.0 NBAR surface reflectance. "
        "L30 NIR is B05 and S30 NIR is B8A; red is B04 in both. "
        "Scale 0.0001 cancels. Fill -9999 and stored values >= 12000 are dropped. "
        "Fmask bits 1-5 (cloud, adjacent, shadow, snow/ice, water) and high aerosol "
        "(bits 6 and 7 both set) are dropped. Bit 0 is reserved in HLS V2.0 and is not masked. "
        "https://lpdaac.usgs.gov/documents/1698/HLS_User_Guide_V2.pdf Table 9. "
        f"Spatial method: mean of valid 30 m pixels within {int(RADIUS_M)} m of the site point. "
        "Weekly value is the unweighted mean of scene means. n_obs is the scene count. "
        "No gap fill. HLS-VI was not used: the product page states an NDVI layer but the "
        "equation is an image, so the NDVI filename was not verified. MOD13Q1 was not retrieved. "
        f"Record bounded to {YEAR_START}-{YEAR_END}. L30 temporal coverage starts in 2013 and "
        "S30 in 2015 (same user guide). "
        f"Scenes considered {considered}. Scenes with a clear pixel {sum(counts.values())}. "
        f"Scenes that failed to read {skipped_files}. "
        f"Cloud-free scene counts by year: {counts}."
    )
    doc = {
        "site_id": site_id,
        "layer": "ndvi",
        "variable": "NDVI",
        "unit": "1",
        "basis": "measured",
        "product": {"short_name": "HLSL30,HLSS30", "version": "2.0"},
        "native_resolution_m": 30,
        "spatial_method": f"mean of valid 30 m pixels within {int(RADIUS_M)} m of the site point",
        "retrieved_on": RETRIEVED_ON,
        "cloud_free_scenes_by_year": {str(year): counts[year] for year in years},
        "weekly": weekly,
    }
    return {"doc": doc, "meta": _meta(notes), "counts": counts}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build weekly HLS NDVI seeds. Does not print the token.")
    parser.add_argument("--sites", nargs="*", default=None)
    args = parser.parse_args(argv)
    token = read_token()
    selected, skipped = select_sites(args.sites)
    for site_id in skipped:
        print(f"skip {site_id}: not registered in CURATED_SITES")
    if not selected:
        print("no registered sites selected")
        return 0
    client = EarthdataClient(token)
    from edl import _ensure_api_path
    _ensure_api_path()
    from app.features.config import CURATED_SITES

    failed = False
    for site_id in selected:
        info = CURATED_SITES[site_id]
        try:
            built = build_site(client, token, site_id, info)
        except EarthdataRejected as exc:
            failed = True
            reason = scrub(str(exc), token)
            notes = reason + " No granule was stored. weekly is null. This file is a gap record, not a measurement."
            write_gap(site_id, "ndvi", reason=notes, candidates=_candidates(), meta=_meta(notes), secret=token)
            print(f"{site_id} ndvi gap: Earthdata rejected the request. No value was stored.")
            continue
        write_series(site_id, "ndvi", built["doc"], built["meta"])
        total = sum(built["counts"].values())
        print(f"{site_id} ndvi scenes_with_clear_pixels={total} years={YEAR_START}-{YEAR_END}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

"""Weekly ECOSTRESS evapotranspiration for curated sites.

Source: ECO_L3T_JET version 003, layer ETdaily.
The DOI page lists ETdaily as float32 daily evapotranspiration in mm/day,
fill NaN, no scale factor:
https://doi.org/10.5067/ECOSTRESS/ECO_L3T_JET.003 (read 2026-11-15).
The same page's temporal extent starts 2018-07-09.
The user guide says ETdaily is the median latent-heat flux from the
PT-JPL-SM, STIC-JPL, PM-JPL, and BESS-JPL models, upscaled to mm/day,
and that it is the integral from sunrise to sunset:
https://github.com/ECOSTRESS-Collection-3/ECOv003-L3T-L4T-JET/blob/main/documentation/ECOv003_L3_L4_JET_User_Guide.md
(Table 4 and the L3T JET section, read 2026-11-15).
Cloud and water are uint8 masks. Zero is absence, one is presence, 255 is fill
(user guide, Quality Flags). A float32 NaN is a pixel that was not retrieved.

This script is a seed build. It is not on the request path.
"""

from __future__ import annotations

import argparse
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from urllib.parse import urlparse

import numpy as np

from edl import (
    DEFAULT_MAX_CONCURRENT,
    EarthdataClient,
    EarthdataRejected,
    data_hrefs,
    is_earthdata_host,
    read_token,
    select_sites,
)
from sample import RADIUS_M, href_named, inside_radius, read_window
from series import RETRIEVED_ON, scrub, weekly_from_observations, weeks_with_data, write_gap, write_series

# DOI page temporal extent: 2018-07-09 to Present.
# The search is closed on the day before RETRIEVED_ON so the file does not
# depend on the clock during the run.
SEARCH_START = date(2018, 7, 9)
SEARCH_END = date.fromisoformat(RETRIEVED_ON) - timedelta(days=1)
YEAR_START = SEARCH_START.year
YEAR_END = SEARCH_END.year
SHORT_NAME = "ECO_L3T_JET"
VERSION = "003"
# DOI page and user guide Table 4. Not a measured flux.
VARIABLE = "ETdaily"
UNIT = "mm/day"
NATIVE_RESOLUTION_M = 70
# File naming on the DOI page: Product Iteration Number is the last numeric
# field before the layer name. Example:
# ECOv003_L3T_JET_43166_007_29UMT_20260215T074827_01_ETdaily.tif
_GRANULE_RE = re.compile(
    r"^ECOv003_L3T_JET_(?P<orbit>\d+)_(?P<scene>\d+)_(?P<tile>[0-9A-Z]{5})_"
    r"(?P<acquired>\d{8}T\d{6})_(?P<iteration>\d+)$"
)
# User guide Quality Flags: 0 absence, 1 presence, 255 fill.
CLOUD_CLEAR = 0
WATER_LAND = 0
CMR = "https://cmr.earthdata.nasa.gov/search/collections.json?short_name=ECO_L3T_JET"
SOURCE_URL = "https://doi.org/10.5067/ECOSTRESS/ECO_L3T_JET.003"
USER_GUIDE = (
    "https://github.com/ECOSTRESS-Collection-3/ECOv003-L3T-L4T-JET/blob/main/"
    "documentation/ECOv003_L3_L4_JET_User_Guide.md"
)
LICENSE = (
    "Openly shared, without restriction, per the ECO_L3T_JET.003 DOI page "
    f"({SOURCE_URL}, read 2026-11-15) and the EOSDIS Data Use and Citation Guidance "
    "(https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance). "
    "That guidance says NASA-led mission data are CC0 unless a use restriction is marked. "
    "LP DAAC states its products have no restrictions on reuse, sale, or redistribution "
    "(https://forum.earthdata.nasa.gov/viewtopic.php?t=6891, read 2026-11-15)."
)
ATTRIBUTION = (
    "ECOSTRESS Tiled Evapotranspiration PT-JPL Instantaneous and Daytime L3 Global 70 m v003 "
    "(ECO_L3T_JET). NASA/JPL/ECOSTRESS, distributed by the Land Processes Distributed Active "
    f"Archive Center. {SOURCE_URL}."
)
TITLE = "ECOSTRESS Tiled Evapotranspiration PT-JPL Instantaneous and Daytime L3 Global 70 m v003"


def granule_key(title: str) -> tuple | None:
    """Orbit, scene, tile, and acquisition time. None when the title does not match the DOI naming."""
    match = _GRANULE_RE.match(str(title or ""))
    if match is None:
        return None
    return (match.group("orbit"), match.group("scene"), match.group("tile"), match.group("acquired"))


def granule_iteration(title: str) -> int | None:
    match = _GRANULE_RE.match(str(title or ""))
    if match is None:
        return None
    return int(match.group("iteration"))


def prefer_granules(entries: list[dict]) -> tuple[list[dict], int]:
    """Drop a lower product-iteration of the same orbit, scene, tile, and time.

    The DOI page names that field the product iteration number. It does not say
    a higher number replaces a lower one. Keeping both would count one acquisition
    twice. TODO(verify) the supersession rule. The higher number is kept.
    A title that does not match the pattern is kept on its own.
    """
    chosen: dict[tuple, dict] = {}
    loose: list[dict] = []
    dropped = 0
    ordered = sorted(entries, key=lambda item: (str(item.get("time_start") or ""), str(item.get("title") or "")))
    for entry in ordered:
        title = str(entry.get("title") or "")
        key = granule_key(title)
        if key is None:
            loose.append(entry)
            continue
        previous = chosen.get(key)
        if previous is None:
            chosen[key] = entry
            continue
        new_iter = granule_iteration(title) or 0
        old_iter = granule_iteration(str(previous.get("title") or "")) or 0
        if new_iter >= old_iter:
            chosen[key] = entry
        dropped += 1
    kept = sorted(chosen.values(), key=lambda item: (str(item.get("time_start") or ""), str(item.get("title") or "")))
    return kept + loose, dropped


def scene_et_mean(
    et: np.ndarray,
    cloud: np.ndarray,
    water: np.ndarray,
    east_m: np.ndarray,
    north_m: np.ndarray,
    radius_m: float = RADIUS_M,
) -> tuple[float | None, int]:
    """Mean ETdaily of clear land pixels whose centres lie inside ``radius_m``.

    Returns ``(mean_mm_per_day, n_pixels)``. ``None`` and 0 when no pixel qualifies.
    Finite values are kept. The DOI table gives no valid min or max, so a negative
    finite value is not dropped. NaN, cloud presence (1), water presence (1), and
    mask fill (255) are dropped. Nothing is filled.
    """
    et_a = np.asarray(et, dtype=np.float64)
    cloud_a = np.asarray(cloud)
    water_a = np.asarray(water)
    east = np.asarray(east_m, dtype=np.float64)
    north = np.asarray(north_m, dtype=np.float64)
    if et_a.shape != cloud_a.shape or et_a.shape != water_a.shape or et_a.shape != east.shape:
        raise ValueError("ETdaily, cloud, water, and coordinates must share a shape")
    clear = cloud_a == CLOUD_CLEAR
    land = water_a == WATER_LAND
    inside = inside_radius(east, north, radius_m)
    ok = np.isfinite(et_a) & clear & land & inside
    if not np.any(ok):
        return None, 0
    return float(et_a[ok].mean()), int(np.count_nonzero(ok))


def _parse_time(entry: dict) -> date | None:
    raw = entry.get("time_start")
    if not isinstance(raw, str) or len(raw) < 10:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _gdal_config(token: str, url: str) -> dict:
    parts = urlparse(url)
    if parts.scheme == "https" and is_earthdata_host(parts.hostname):
        return {"GDAL_HTTP_AUTH": "BEARER", "GDAL_HTTP_BEARER": token}
    return {}


def _one_scene(client: EarthdataClient, token: str, entry: dict, lon: float, lat: float) -> tuple[float | None, int]:
    hrefs = data_hrefs(entry)
    et_url = href_named(hrefs, "_ETdaily.tif")
    cloud_url = href_named(hrefs, "_cloud.tif")
    water_url = href_named(hrefs, "_water.tif")
    if not et_url or not cloud_url or not water_url:
        return None, 0

    def read_one(url: str):
        final = client.resolve(url, confirm=False)
        return read_window(final, lon, lat, RADIUS_M, _gdal_config(token, final))

    # Two layer reads at a time. That matches EarthdataClient's concurrency cap.
    # A third layer waits. GDAL's own range fan-out is not part of that cap.
    # TODO(verify) GDAL_HTTP_MULTIRANGE against the cap of DEFAULT_MAX_CONCURRENT.
    with ThreadPoolExecutor(max_workers=DEFAULT_MAX_CONCURRENT) as pool:
        bands = list(pool.map(read_one, (et_url, cloud_url, water_url)))
    if any(window is None for window in bands):
        return None, 0
    et, cloud, water = bands
    if et["data"].shape != cloud["data"].shape or et["data"].shape != water["data"].shape:
        return None, 0
    return scene_et_mean(et["data"], cloud["data"], water["data"], et["east_m"], et["north_m"], RADIUS_M)


def _candidates() -> list[dict]:
    return [{
        "short_name": SHORT_NAME,
        "version": VERSION,
        "title": TITLE,
        "cmr": CMR,
    }]


def _meta(notes: str) -> dict:
    return {
        "source_name": TITLE,
        "source_url": SOURCE_URL,
        "product_version": VERSION,
        "retrieved_on": RETRIEVED_ON,
        "license": LICENSE,
        "attribution": ATTRIBUTION,
        "resolution_spatial": f"{NATIVE_RESOLUTION_M} m",
        "resolution_temporal": "Irregular ISS overpass; ETdaily is one daytime integral; weeks are 7-day blocks from 1 January",
        "processing_notes": notes,
    }


def build_site(client: EarthdataClient, token: str, site_id: str, info: dict) -> dict:
    """Search ECO_L3T_JET 003 at the site point and return the series document."""
    lon = float(info["lon"])
    lat = float(info["lat"])
    entries = client.search_granules(
        short_name=SHORT_NAME,
        version=VERSION,
        start=SEARCH_START,
        end=SEARCH_END,
        point=(lon, lat),
        page_size=500,
    )
    kept, dropped = prefer_granules(entries)
    observations: list[tuple[date, float]] = []
    counts: dict[int, int] = {year: 0 for year in range(YEAR_START, YEAR_END + 1)}
    considered = 0
    no_clear = 0
    failed = 0
    missing_layer = 0
    for entry in kept:
        when = _parse_time(entry)
        if when is None or when < SEARCH_START or when > SEARCH_END:
            continue
        considered += 1
        if considered % 10 == 0:
            print(
                f"{site_id} considered={considered} valid={sum(counts.values())} "
                f"no_clear={no_clear} failed={failed}",
                flush=True,
            )
        try:
            mean, _pixels = _one_scene(client, token, entry, lon, lat)
        except EarthdataRejected:
            raise
        except Exception:
            failed += 1
            continue
        if mean is None:
            hrefs = data_hrefs(entry)
            if not href_named(hrefs, "_ETdaily.tif") or not href_named(hrefs, "_cloud.tif") or not href_named(hrefs, "_water.tif"):
                missing_layer += 1
            else:
                no_clear += 1
            continue
        observations.append((when, mean))
        counts[when.year] = counts.get(when.year, 0) + 1
    years = list(range(YEAR_START, YEAR_END + 1))
    weekly = weekly_from_observations(observations, years, ndigits=4)
    notes = (
        "ETdaily from ECO_L3T_JET 003. Units mm/day. Fill NaN. No scale factor. "
        f"{SOURCE_URL} variable table, read 2026-11-15. "
        "The user guide calls ETdaily the median of PT-JPL-SM, STIC-JPL, PM-JPL, and BESS-JPL "
        f"latent heat, upscaled from W/m2 to a sunrise-to-sunset integral. {USER_GUIDE} "
        "Basis modeled. "
        "A pixel is kept when ETdaily is finite, cloud is 0, and water is 0. "
        "Cloud or water value 1 is presence and 255 is fill (same user guide, Quality Flags). "
        "No valid range is published for ETdaily, so finite negatives are kept. "
        f"Spatial method: mean of valid {NATIVE_RESOLUTION_M} m pixels within {int(RADIUS_M)} m of the site point. "
        "The 150 m radius is the same footprint the HLS NDVI seed uses. "
        "Weekly value is the unweighted mean of scene means. n_obs is the scene count, not the pixel count. "
        "The date is the CMR time_start date (UTC). "
        "When two granules share orbit, scene, MGRS tile, and acquisition time, the higher product "
        "iteration number is kept. TODO(verify) that a higher iteration supersedes a lower one; "
        "the DOI page names the field and does not state the rule. "
        "Nothing is gap-filled. "
        f"Search {SEARCH_START.isoformat()} through {SEARCH_END.isoformat()}. "
        f"Granules returned {len(entries)}. Lower iterations dropped {dropped}. "
        f"Scenes considered {considered}. Scenes with a clear land pixel {sum(counts.values())}. "
        f"Scenes with no clear land pixel {no_clear}. Scenes missing a layer file {missing_layer}. "
        f"Scenes that failed to read {failed}. "
        f"Valid scene counts by year: {counts}. "
        "ETinstUncertainty and ETuncertainty both appear as filenames in this collection. "
        "Neither layer was read. TODO(verify) which uncertainty name is current; the DOI table says Etuncertainty."
    )
    doc = {
        "site_id": site_id,
        "layer": "ecostress",
        "variable": VARIABLE,
        "unit": UNIT,
        "basis": "modeled",
        "product": {"short_name": SHORT_NAME, "version": VERSION},
        "native_resolution_m": NATIVE_RESOLUTION_M,
        "spatial_method": f"mean of valid {NATIVE_RESOLUTION_M} m pixels within {int(RADIUS_M)} m of the site point",
        "retrieved_on": RETRIEVED_ON,
        "valid_scenes_by_year": {str(year): counts[year] for year in years},
        "weekly": weekly,
    }
    return {
        "doc": doc,
        "meta": _meta(notes),
        "counts": counts,
        "weeks": weeks_with_data(weekly),
        "granules": len(entries),
        "dropped": dropped,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build weekly ECOSTRESS ET seeds. Does not print the token.")
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
            write_gap(site_id, "ecostress", reason=notes, candidates=_candidates(), meta=_meta(notes), secret=token)
            print(f"{site_id} ecostress gap: Earthdata rejected the request. No value was stored.")
            continue
        if built["granules"] == 0:
            notes = (
                f"CMR point search for {SHORT_NAME} {VERSION} returned no granules at this point "
                f"from {SEARCH_START.isoformat()} through {SEARCH_END.isoformat()}. "
                "weekly is null. This file is a gap record, not a measurement."
            )
            write_gap(site_id, "ecostress", reason=notes, candidates=_candidates(), meta=_meta(notes), secret=token)
            print(f"{site_id} ecostress gap: no granules at the site point.")
            continue
        write_series(site_id, "ecostress", built["doc"], built["meta"])
        total = sum(built["counts"].values())
        print(
            f"{site_id} ecostress scenes_with_clear_pixels={total} "
            f"weeks_with_data={built['weeks']} years={YEAR_START}-{YEAR_END}"
        )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

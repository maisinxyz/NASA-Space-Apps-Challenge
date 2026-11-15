"""Live custom-field analysis, with per-request data and an offline cache."""
from __future__ import annotations

import json
import math
import os
import tempfile
import threading
import time
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

from pyproj import Geod
from rasterio.io import MemoryFile
from shapely.geometry import Polygon

from app.core.config import REPO_ROOT
from app.core.errors import ApiError
from app.features import config as C, seeds
from app.rotation.config import DEFAULT_PRESET
from app.services.forecast import _assemble, _request, _scenario, prepare
from app.twin.catalog import load_catalog
from app.twin.config import ENGINE_VERSION
from app.twin.types import request_hash

CACHE = REPO_ROOT / "data/cache/custom_field"
WCS = "https://maps.isric.org/mapserv"
PROPS = ("clay", "sand", "silt", "soc", "phh2o")
DEPTHS = (("0-5cm", 0, 5), ("5-15cm", 5, 15), ("15-30cm", 15, 30))
_lock = threading.Lock()
_requests: dict[str, deque] = defaultdict(deque)


def limit(client: str) -> None:
    now = time.monotonic()
    with _lock:
        for key in list(_requests):
            queue = _requests[key]
            while queue and queue[0] <= now - 60:
                queue.popleft()
            if not queue:
                del _requests[key]
        if (client not in _requests and len(_requests) >= 10000) or len(_requests[client]) >= 10:
            raise ApiError("RATE_LIMITED", "Too many field analyses; try again shortly.", retryable=True)
        _requests[client].append(now)


def geometry(raw: object) -> tuple[float, float, float]:
    try:
        if not isinstance(raw, dict) or raw.get("type") != "Polygon":
            raise ValueError
        rings = raw["coordinates"]
        if not isinstance(rings, list) or len(rings) != 1 or not 4 <= len(rings[0]) <= 1000:
            raise ValueError
        ring = rings[0]
        if any(not isinstance(p, list) or len(p) != 2 or any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in p) or not (-180 <= p[0] <= 180 and -90 <= p[1] <= 90) for p in ring):
            raise ValueError
        if ring[0] != ring[-1]:
            raise ValueError
        # Unwrap adjacent longitudes across the antimeridian before planar
        # validity/centroid checks; Geod itself uses WGS84 longitudes.
        unwrapped = [ring[0]]
        for lon, lat in ring[1:]:
            previous = unwrapped[-1][0]
            lon += 360 * round((previous - lon) / 360)
            unwrapped.append([lon, lat])
        if unwrapped[0] != unwrapped[-1]:
            raise ValueError
        shape = Polygon(unwrapped)
        if not shape.is_valid or shape.is_empty:
            raise ValueError
        area, _ = Geod(ellps="WGS84").polygon_area_perimeter([p[0] for p in ring], [p[1] for p in ring])
        area = abs(area) / 10000
        if not 0 < area <= 200:
            raise ValueError
        return ((shape.centroid.x + 180) % 360 - 180), shape.centroid.y, area
    except (KeyError, TypeError, ValueError, IndexError, OverflowError):
        raise ApiError("INVALID_INPUT", "Polygon must be a valid closed WGS84 ring with area at most 200 ha.") from None


def canonical_polygon(raw: dict) -> dict:
    """Stable ring start and winding for the exact same closed polygon."""
    vertices = [tuple(map(float, point)) for point in raw["coordinates"][0][:-1]]
    # Pick the lexicographically least rotation in either winding. A repeated
    # least vertex is handled deterministically as well.
    options = []
    for points in (vertices, list(reversed(vertices))):
        first = min(points)
        options.extend(tuple(points[i:] + points[:i]) for i, point in enumerate(points) if point == first)
    chosen = min(options)
    return {"type": "Polygon", "coordinates": [[list(p) for p in (*chosen, chosen[0])]]}


def _soil_rest(lon: float, lat: float) -> dict:
    params = [("lon", lon), ("lat", lat), *(("property", p) for p in PROPS), *(("depth", d[0]) for d in DEPTHS), ("value", "mean")]
    with urlopen(C.SOILGRIDS_QUERY_URL + "?" + urlencode(params), timeout=12) as response:
        return seeds.soil_summary(json.load(response))


def _soil_wcs(lon: float, lat: float) -> dict:
    # Official SoilGrids WCS: https://docs.isric.org/globaldata/soilgrids/wcs.html
    # Request a small WGS84 raster around the exact point and use its containing cell.
    def fetch(item):
        prop, (depth, top, bottom) = item
        params = [("map", f"/map/{prop}.map"), ("SERVICE", "WCS"), ("VERSION", "2.0.1"), ("REQUEST", "GetCoverage"), ("COVERAGEID", f"{prop}_{depth}_mean"), ("FORMAT", "GEOTIFF_INT16"), ("SUBSET", f"X({lon - .002},{lon + .002})"), ("SUBSET", f"Y({lat - .002},{lat + .002})"), ("SUBSETTINGCRS", "http://www.opengis.net/def/crs/EPSG/0/4326"), ("OUTPUTCRS", "http://www.opengis.net/def/crs/EPSG/0/4326")]
        with urlopen(WCS + "?" + urlencode(params), timeout=12) as response:
            data = response.read()
        with MemoryFile(data) as memory, memory.open() as raster:
            sample = next(raster.sample([(lon, lat)], masked=True))
            if bool(sample.mask[0]) if hasattr(sample.mask, "__len__") else bool(sample.mask):
                raise ValueError("SoilGrids cell unavailable")
            value = int(sample[0])
        return prop, {"label": depth, "range": {"top_depth": top, "bottom_depth": bottom}, "values": {"mean": value}}
    with ThreadPoolExecutor(max_workers=15) as pool:
        result = list(pool.map(fetch, [(p, d) for p in PROPS for d in DEPTHS]))
    # These five conversion factors are specified by ISRIC:
    # https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html
    layers = [{"name": p, "unit_measure": {"d_factor": 10}, "depths": [d for prop, d in result if prop == p]} for p in PROPS]
    return seeds.soil_summary({"properties": {"layers": layers}})


def soil_at(lon: float, lat: float) -> dict:
    try:
        try:
            return {**_soil_rest(lon, lat), "lookup_url": C.SOILGRIDS_QUERY_URL}
        except Exception:
            return {**_soil_wcs(lon, lat), "lookup_url": WCS}
    except Exception:
        raise ApiError("DATA_SOURCE_UNAVAILABLE", "Soil data is unavailable for this field.", retryable=True) from None


def analyze(body: dict, client: str) -> dict:
    limit(client)
    if not isinstance(body, dict) or not all(key in body for key in ("polygon", "rotation", "scenario")):
        raise ApiError("INVALID_INPUT", "Polygon, rotation and scenario are required.")
    geometry(body["polygon"])  # validate before normalizing
    body = {**body, "polygon": canonical_polygon(body["polygon"])}
    lon, lat, area = geometry(body["polygon"])
    rotation = body["rotation"]
    if rotation != "preset" and (not isinstance(rotation, list) or not rotation):
        raise ApiError("INVALID_INPUT", "Rotation must be a preset or non-empty list of slots.")
    selection = body.get("selection")
    if selection is None:
        selection = {"crops": list(dict.fromkeys(c for _, main, off in DEFAULT_PRESET["slots"] for c in (main, off) if c != "fallow")), "pinned": [], "excluded": []}
    if not isinstance(selection, dict):
        raise ApiError("INVALID_INPUT", "Selection must be an object.")
    try:
        digest = request_hash({"version": "B10-v1", "engine": ENGINE_VERSION, "body": body})
    except (TypeError, ValueError):
        raise ApiError("INVALID_INPUT", "The request must contain finite JSON values.") from None
    path = CACHE / f"{digest}.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    if os.getenv("OFFLINE") == "1":
        raise ApiError("DATA_SOURCE_UNAVAILABLE", "No cached analysis is available for this field.", retryable=True)
    field_id, site_id = "custom_" + digest[:12], "site_custom_" + digest[:12]
    forecast_body = {"selection": selection, "scenario": body["scenario"], "fields": [{"field_id": field_id, "name": "Custom field", "area_ha": area, "slope_class": "flat", "irrigation": {"available": True}, "existing_rotation": rotation, "polygon": body["polygon"]}]}
    try:
        _scenario(_request(forecast_body))
        if isinstance(rotation, list):
            known = {crop["id"] for crop in load_catalog()["crops"]} | {"fallow"}
            if any(slot["crop_id"] not in known for slot in rotation):
                raise ApiError("INVALID_INPUT", "The rotation contains an unknown crop.")
        soil = soil_at(lon, lat)
        doc = _assemble(prepare(site_id, forecast_body, location=(lon, lat), soil=soil), 30)
    except ApiError as exc:
        if exc.code in ("WEATHER_UNAVAILABLE", "SITE_NOT_FOUND"):
            raise ApiError("DATA_SOURCE_UNAVAILABLE", "Weather data is unavailable for this field.", retryable=True) from None
        if exc.status_code == 422:
            raise ApiError("INVALID_INPUT", "The rotation, selection or scenario is invalid.") from None
        raise
    except (KeyError, TypeError, ValueError, OverflowError):
        raise ApiError("INVALID_INPUT", "The rotation, selection or scenario is invalid.") from None
    doc["data_mode"] = "limited_data"
    doc["assumptions"].append("Custom field: flat slope and irrigation availability are assumptions; check locally.")
    if rotation == "preset":
        doc["assumptions"].append("The generic corn-soybean preset is not a recorded farm rotation.")
    for source in doc["sources"]:
        if source.get("name") == C.SOILGRIDS_SOURCE.get("name"):
            source["url"] = soil.get("lookup_url", C.SOILGRIDS_QUERY_URL)
    result = {"field_id": field_id, "area_ha": area, "location": {"lat": lat, "lon": lon}, "forecast": doc, "resolution_notes": [C.POWER_RESOLUTION_NOTE, "SoilGrids 2.0 models soil on a 250 m grid; it is not a field soil test."]}
    tmp = None
    try:
        CACHE.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=CACHE, delete=False) as handle:
            tmp = Path(handle.name)
            json.dump(result, handle, separators=(",", ":"))
        os.replace(tmp, path)
    except OSError:
        pass  # A successful live analysis is still useful if cache storage fails.
    finally:
        if tmp is not None:
            try:
                tmp.unlink(missing_ok=True)
            except OSError:
                pass
    return result

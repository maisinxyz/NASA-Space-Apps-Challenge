"""NASA POWER daily weather client.

Source: https://power.larc.nasa.gov/docs/services/api/
Daily values are regional estimates, not field-level observations.
"""

from __future__ import annotations

import json
import math
import os
from datetime import date
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from app.core.errors import ApiError

BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMETERS = (
    "PRECTOTCORR",
    "T2M",
    "T2M_MAX",
    "T2M_MIN",
    "GWETROOT",
    "GWETTOP",
)
CACHE_DIR = Path(__file__).resolve().parents[4] / "data" / "cache" / "weather"


def _unavailable() -> ApiError:
    return ApiError(
        "WEATHER_UNAVAILABLE",
        "NASA POWER weather data is unavailable.",
        "Try again when the data source is available.",
        retryable=True,
    )


def _validate(payload: dict) -> dict:
    """Validate the response and replace missing values with None."""
    if not isinstance(payload, dict):
        raise ValueError("Invalid NASA POWER response")

    header = payload["header"]
    values = payload["properties"]["parameter"]
    missing = header["fill_value"]

    if not isinstance(values, dict):
        raise ValueError("Missing weather parameters")

    cleaned = {}
    for parameter in PARAMETERS:
        daily = values[parameter]
        if not isinstance(daily, dict):
            raise ValueError(f"Invalid parameter: {parameter}")

        cleaned[parameter] = {}
        for day, value in daily.items():
            date.fromisoformat(f"{day[:4]}-{day[4:6]}-{day[6:8]}")
            if (
                not isinstance(value, (int, float))
                or isinstance(value, bool)
                or not math.isfinite(value)
            ):
                raise ValueError("Invalid weather measurement")
            cleaned[parameter][day] = None if value == missing else value

    return {
        "parameters": cleaned,
        "units": {
            name: payload["parameters"][name]["units"]
            for name in PARAMETERS
        },
        "sources": header["sources"],
        "time_standard": header["time_standard"],
        "start": header["start"],
        "end": header["end"],
    }


def get_daily(
    lat: float,
    lon: float,
    start: date,
    end: date,
    cache_dir: Path | None = None,
) -> dict:
    """Fetch daily weather; return cached data when offline or upstream fails.

    The 'cached' flag is True only when a previously saved response is
    used instead of a fresh upstream response.
    """
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("Invalid coordinates")
    if start > end:
        raise ValueError("Start date must not exceed end date")

    directory = Path(cache_dir) if cache_dir is not None else CACHE_DIR
    filename = (
        f"{lat:.3f}_{lon:.3f}_"
        f"{start:%Y%m%d}_{end:%Y%m%d}.json"
    )
    path = directory / filename

    def read_cache() -> dict:
        with path.open(encoding="utf-8") as handle:
            cached = json.load(handle)
        result = _validate(cached)
        result["cached"] = True
        return result

    if os.getenv("OFFLINE") == "1":
        try:
            return read_cache()
        except (OSError, ValueError, KeyError, TypeError):
            raise _unavailable() from None

    query = urlencode({
        "parameters": ",".join(PARAMETERS),
        "community": "AG",
        "latitude": f"{lat:.3f}",
        "longitude": f"{lon:.3f}",
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
    })

    try:
        with urlopen(f"{BASE_URL}?{query}", timeout=30) as response:
            payload = json.load(response)

        result = _validate(payload)
    except (HTTPError, URLError, TimeoutError, OSError, ValueError,
            KeyError, TypeError):
        try:
            return read_cache()
        except (OSError, ValueError, KeyError, TypeError):
            raise _unavailable() from None

    result["cached"] = False

    # Cache writes are best-effort: valid upstream data must still be returned.
    temporary = path.with_suffix(".tmp")
    try:
        directory.mkdir(parents=True, exist_ok=True)
        temporary.write_text(json.dumps(payload), encoding="utf-8")
        temporary.replace(path)
    except OSError:
        pass
    finally:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass

    return result

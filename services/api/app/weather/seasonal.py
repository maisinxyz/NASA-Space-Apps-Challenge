"""Open-Meteo monthly ECMWF SEAS5 anomalies for a POWER climatology overlay."""

import json
import math
import os
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

SOURCE = {
    "name": "Open-Meteo ECMWF SEAS5 monthly anomalies",
    "url": "https://open-meteo.com/en/docs/seasonal-forecast-api",
    "role": "weather",
    "license": "CC BY 4.0 data; public API access subject to Open-Meteo usage terms",
    "attribution": "ECMWF SEAS5 via Open-Meteo",
    "basis": "modeled",
    "resolution_m": 36000,
}


def anomalies(lat: float, lon: float) -> dict[str, tuple[float, float]]:
    if os.getenv("OFFLINE") == "1" or os.getenv("OPEN_METEO_SEASONAL") != "1":
        return {}
    query = urlencode({
        "latitude": lat, "longitude": lon, "models": "ecmwf_seas5",
        "monthly": "temperature_2m_anomaly,precipitation_anomaly",
    })
    try:
        with urlopen(f"https://seasonal-api.open-meteo.com/v1/seasonal?{query}", timeout=5) as response:
            data = json.load(response)
        units = data["monthly_units"]
        if units["temperature_2m_anomaly"] != "K" or units["precipitation_anomaly"] != "mm":
            return {}
        rows = data["monthly"]
        return {
            month[:7]: (temp, rain)
            for month, temp, rain in zip(rows["time"], rows["temperature_2m_anomaly"], rows["precipitation_anomaly"], strict=True)
            if _finite(temp) and _finite(rain)
        }
    except (URLError, OSError, ValueError, TypeError, KeyError):
        return {}


def _finite(value) -> bool:
    return type(value) in (float, int) and math.isfinite(value)

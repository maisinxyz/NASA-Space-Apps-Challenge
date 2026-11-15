"""Offline Environment Canada station/POWER comparisons for seed building."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
import math
from typing import Any


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    result = float(value)
    return result if math.isfinite(result) and result > -900 else None


def monthly_comparison(power_daily: dict, station_daily: list[dict]) -> dict:
    """Compare calendar-month daily means over paired days; dates are source-local.

    ECCC ``LOCAL_DATE`` is a calendar date without a UTC offset. Slicing the ISO
    date (rather than coercing it to UTC) avoids shifting daily observations.
    """
    parameters = power_daily.get("properties", {}).get("parameter", {})
    power: dict[str, dict[str, float | None]] = {}
    dates = set(parameters.get("T2M", {})) | set(parameters.get("PRECTOTCORR", {}))
    for key in dates:
        if len(key) != 8 or not key.isdigit():
            continue
        iso = f"{key[:4]}-{key[4:6]}-{key[6:]}"
        power[iso] = {
            "temperature_c": _number(parameters.get("T2M", {}).get(key)),
            "precipitation_mm": _number(parameters.get("PRECTOTCORR", {}).get(key)),
        }

    buckets: dict[int, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    years_by_metric: dict[str, set[int]] = defaultdict(set)
    for row in station_daily:
        raw_date = str(row.get("local_date", ""))[:10]
        if len(raw_date) != 10 or raw_date not in power:
            continue
        try:
            day = date.fromisoformat(raw_date)
        except ValueError:
            continue
        p = power[raw_date]
        temps = (_number(p.get("temperature_c")), _number(row.get("mean_temperature_c")))
        precip = (_number(p.get("precipitation_mm")), _number(row.get("total_precipitation_mm")))
        rain = (_number(p.get("precipitation_mm")), _number(row.get("total_rain_mm")))
        if all(v is not None for v in temps):
            buckets[day.month]["temperature_power_minus_station_c"].append(temps[0] - temps[1])
            years_by_metric["temperature"].add(day.year)
        if all(v is not None for v in precip):
            buckets[day.month]["precipitation_power_minus_station_mm_day"].append(precip[0] - precip[1])
            years_by_metric["precipitation"].add(day.year)
        if all(v is not None for v in rain):
            buckets[day.month]["power_precipitation_minus_station_rain_mm_day"].append(rain[0] - rain[1])
            years_by_metric["rain"].add(day.year)

    monthly = []
    metric_counts = {
        "temperature_power_minus_station_c": "temperature_n_days",
        "precipitation_power_minus_station_mm_day": "precipitation_n_days",
        "power_precipitation_minus_station_rain_mm_day": "rain_n_days",
    }
    for month in range(1, 13):
        measures = buckets[month]
        entry: dict[str, Any] = {"month": month}
        for name, count_name in metric_counts.items():
            values = measures.get(name, [])
            entry[name] = sum(values) / len(values) if values else None
            entry[count_name] = len(values)
        monthly.append(entry)
    return {
        "basis": "derived",
        "monthly": monthly,
        "overlap_years": [min(years_by_metric["temperature"]), max(years_by_metric["temperature"])] if years_by_metric["temperature"] else None,
        "metric_overlap_years": {
            name: [min(years), max(years)] if years else None for name, years in sorted(years_by_metric.items())
        },
        "metric_n_years": {name: len(years) for name, years in sorted(years_by_metric.items())},
        "n_years": len(years_by_metric["temperature"]),
        "temperature_bias_c": (
            sum(value for values in (buckets[m].get("temperature_power_minus_station_c", []) for m in range(1, 13)) for value in values)
            / sum(len(buckets[m].get("temperature_power_minus_station_c", [])) for m in range(1, 13))
            if sum(len(buckets[m].get("temperature_power_minus_station_c", [])) for m in range(1, 13)) else None
        ),
        "temperature_n_days": sum(len(buckets[m].get("temperature_power_minus_station_c", [])) for m in range(1, 13)),
        "notes": [
            "Temperature is paired-day NASA POWER T2M minus ECCC MEAN_TEMPERATURE, in °C.",
            "Precipitation is paired-day POWER PRECTOTCORR minus ECCC TOTAL_PRECIPITATION, in mm/day.",
            "Rain cross-check is POWER PRECTOTCORR minus ECCC TOTAL_RAIN, in mm/day; POWER includes total precipitation, so this is not a like-for-like rain comparison.",
            "Each monthly figure is the mean of paired daily differences for that calendar month across overlapping years; null means no paired observations.",
        ],
    }

from __future__ import annotations

import gzip
import json
from pathlib import Path

from app.twin.station_bias import monthly_comparison
from app.twin.explain.uncertainty import station_bias, station_context

SEED = Path(__file__).resolve().parents[3] / "data" / "seed"


def test_monthly_station_comparison_uses_only_valid_paired_local_dates():
    power = {
        "properties": {"parameter": {
            "T2M": {"20240101": 10, "20240201": 4, "20240301": -999},
            "PRECTOTCORR": {"20240101": 2, "20240201": 5, "20240301": 1},
        }}
    }
    rows = [
        {"local_date": "2024-01-01", "mean_temperature_c": 12, "total_rain_mm": 0, "total_precipitation_mm": 0},
        {"local_date": "2024-02-01", "mean_temperature_c": None, "total_rain_mm": 2, "total_precipitation_mm": 3},
        {"local_date": "2024-03-01", "mean_temperature_c": 3, "total_rain_mm": 0, "total_precipitation_mm": 0},
    ]
    result = monthly_comparison(power, rows)
    jan, feb, mar = result["monthly"][:3]
    assert jan["temperature_power_minus_station_c"] == -2
    assert jan["power_precipitation_minus_station_rain_mm_day"] == 2
    assert jan["precipitation_power_minus_station_mm_day"] == 2
    assert feb["temperature_n_days"] == 0
    assert feb["rain_n_days"] == 1
    assert mar["temperature_n_days"] == 0
    assert result["overlap_years"] == [2024, 2024]
    assert result["n_years"] == 1


def test_committed_station_seeds_have_sourced_data_and_real_overlap():
    for site_id, station_id in (("site_ubc_farm", "1108395"), ("site_kpu_langley", "1101708")):
        folder = SEED / site_id
        with gzip.open(folder / "station_daily.json.gz", "rt", encoding="utf-8") as stream:
            daily = json.load(stream)
        bias = json.loads((folder / "station_bias.json").read_text(encoding="utf-8"))
        meta = json.loads((folder / "station_daily.meta.json").read_text(encoding="utf-8"))
        bias_meta = json.loads((folder / "station_bias.meta.json").read_text(encoding="utf-8"))
        assert daily["station"]["climate_identifier"] == station_id
        assert daily["daily"]
        assert bias["monthly"] and len(bias["monthly"]) == 12
        assert bias["overlap_years"] is not None
        assert bias["n_years"] > 0
        assert "eccc-msc.github.io/open-data/licence" in meta["license_url"]
        assert "NASA POWER" in bias_meta["source_name"]
        assert "NASA Langley" in bias_meta["attribution"]
        assert "Environment and Climate Change Canada" in bias_meta["attribution"]
        assert bias_meta["resolution_spatial"].startswith("Point station")
        assert "TOTAL_RAIN" in meta["processing_notes"]
        assert "not a like-for-like" in bias["notes"][2]
        assert all(row["temperature_n_days"] > 0 for row in bias["monthly"])
        response_bias = station_bias(site_id)
        context = station_context(site_id)
        assert response_bias["bias"]["basis"] == "derived"
        assert response_bias["bias"]["confidence"] == "low"
        assert response_bias["n_years"] == bias["n_years"]
        assert context["distance_to_site_km"] > 0
        assert context["climate_identifier"] == station_id

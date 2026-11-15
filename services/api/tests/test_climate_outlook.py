"""W3 climate outlook: POWER climatology, no invented satellite series, no cmip6 deltas."""

from __future__ import annotations

import json

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import install_error_handlers
from app.features import pipeline as P
from app.features.pipeline import resolve_scenario
from app.routers import climate_outlook as climate_router
from app.services.climate_outlook import climate_outlook
from app.services.features import base, feature_table
from app.twin.climate import (
    SIGNIFICANCE_ALPHA,
    frost_dates_for_year,
    heat_limits,
    multi_day_event_count,
    preset_crop_ids,
    theil_sen_mann_kendall,
)
from app.weather import power
from fixtures_lib import contract

SITES = ("site_usda_barc", "site_cornell_ruminant", "site_ucdavis_oakville", "site_ubc_farm")


def _walk_numbers(obj, path=""):
    if isinstance(obj, dict) and {"value", "unit", "basis", "confidence"} <= obj.keys():
        yield path, obj
    if isinstance(obj, dict):
        for key, value in obj.items():
            yield from _walk_numbers(value, f"{path}.{key}")
    elif isinstance(obj, list):
        for i, value in enumerate(obj):
            yield from _walk_numbers(value, f"{path}[{i}]")


def test_trend_flags_match_the_p_value():
    slope, p = theil_sen_mann_kendall(np.arange(10), np.arange(10, dtype=float))
    assert slope == pytest.approx(1.0)
    assert p < SIGNIFICANCE_ALPHA
    flat_slope, flat_p = theil_sen_mann_kendall(np.arange(8), np.ones(8))
    assert flat_slope == pytest.approx(0.0)
    assert flat_p == pytest.approx(1.0)


def test_null_heat_limit_is_not_replaced():
    assert heat_limits(["crop_cabbage", "crop_maize"]) == [("crop_maize", 35.0)]
    assert "crop_cabbage" not in {cid for cid, _limit in heat_limits(["crop_cabbage"])}


def test_multi_day_event_is_one_run():
    # Window is 3 days and the factor is 1.5, so a one-day gap still bridges two bursts.
    # Three dry days split them into two events.
    rain = np.array([10.0, 10.0, 10.0, 0.0, 0.0, 0.0, 10.0, 10.0, 10.0])
    assert multi_day_event_count(rain, extreme_mm=10.0) == 2


def test_outlook_matches_the_schema_and_the_feature_table():
    doc = climate_outlook("site_usda_barc", "baseline")
    contract.validate_schema(doc, "ClimateOutlook")
    table = feature_table("site_usda_barc", resolve_scenario("baseline"))
    assert doc["water_balance"]["weekly_mm"] == table["features"]["water_balance_mm"]["mean"]
    assert doc["data_mode"] == "limited_data"
    assert doc["scenario"]["note"] == "built from observed years"
    assert doc["scenario"]["ramp"] == {"shape": "linear", "years": 10, "basis": "assumed"}
    assert doc["et_and_soil_moisture"]["smap_root_zone_anomaly"]["weekly"] is None
    assert doc["et_and_soil_moisture"]["ecostress_et"]["value"] is None
    assert doc["groundwater"]["trend"] is None
    assert doc["groundwater"]["scored"] is False
    assert doc["sources"][0]["license"]
    assert doc["sources"][0]["attribution"]
    for season in ("winter", "spring", "summer", "fall"):
        observed = doc["seasonal_temperature"][season]["observed"]
        assert observed["significant"] is (observed["mk_p_value"]["value"] < doc["seasonal_temperature"]["significance_alpha"]["value"])
    for row in doc["heat_stress_days"]:
        assert [point["year"] for point in row["days"]["points"]] == list(range(1, 11))
        for point in row["days"]["points"]:
            assert point["p10"] <= point["p50"] <= point["p90"]
    assert [row["crop_id"] for row in doc["heat_stress_days"]] == preset_crop_ids("site_usda_barc")
    assert doc["frost_windows"]["last_spring_frost"]["scenario_shift_days"]["value"] == 0.0


def test_drier_summers_shifts_temperature_and_summer_rain():
    base = climate_outlook("site_usda_barc", "baseline")
    dry = climate_outlook("site_usda_barc", "drier_summers")
    for season in ("winter", "spring", "summer", "fall"):
        assert dry["seasonal_temperature"][season]["scenario_mean"]["value"] == pytest.approx(
            base["seasonal_temperature"][season]["scenario_mean"]["value"] + 1.0, abs=0.002
        )
    assert dry["rainfall"]["seasonal_totals"]["summer"]["scenario"]["value"] < base["rainfall"]["seasonal_totals"]["summer"]["scenario"]["value"]
    assert dry["rainfall"]["seasonal_totals"]["winter"]["scenario"]["value"] == pytest.approx(
        base["rainfall"]["seasonal_totals"]["winter"]["scenario"]["value"], abs=0.002
    )


def test_beltsville_2010_frost_matches_an_independent_scan():
    daily, _mode, _soil, _info = base("site_usda_barc")
    sel = daily.year == 2010
    order = np.argsort(daily.doy[sel], kind="mergesort")
    month = daily.month[sel][order]
    tmin = daily.v[P.TMIN][sel][order]
    doy = daily.doy[sel][order]
    cold = np.flatnonzero((month < 7) & np.isfinite(tmin) & (tmin <= 0.0))
    expected = int(doy[cold[-1]])
    got, _fall = frost_dates_for_year(month, tmin, 0.0, 39.03)
    assert got == expected
    # 2010 is not a leap year. Day 86 is 27 March. That day's minimum is below 0
    # and the next day is above 0, so it is the last spring frost in the seed.
    assert expected == 86
    assert float(tmin[cold[-1]]) < 0.0
    assert float(tmin[cold[-1] + 1]) > 0.0


def test_four_sites_are_deterministic_and_do_not_call_the_network(monkeypatch):
    def _boom(*_args, **_kwargs):
        raise AssertionError("climate outlook called the live POWER client")

    monkeypatch.setattr(power, "get_daily", _boom)
    for site_id in SITES:
        first = climate_outlook(site_id, "baseline")
        second = climate_outlook(site_id, "wetter_winters")
        contract.validate_schema(first, "ClimateOutlook")
        contract.validate_schema(second, "ClimateOutlook")
        assert first == climate_outlook(site_id, "baseline")
        assert json.dumps(first, sort_keys=True) == json.dumps(climate_outlook(site_id, "baseline"), sort_keys=True)
        assert second["rainfall"]["seasonal_totals"]["winter"]["scenario"]["value"] > first["rainfall"]["seasonal_totals"]["winter"]["baseline"]["value"]
        for path, number in _walk_numbers(first):
            assert number["unit"]
            assert number["basis"] in {"measured", "derived", "modeled", "assumed", "relative"}
            assert number["confidence"] in {"high", "medium", "low"}
            assert path


def test_route_unknown_site_and_cached_repeat():
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(climate_router.router, prefix="/api/v1")
    client = TestClient(app)
    missing = client.get("/api/v1/sites/site_not_a_site/climate-outlook")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "SITE_NOT_FOUND"
    ok = client.get("/api/v1/sites/site_ubc_farm/climate-outlook", params={"scenario": "both"})
    assert ok.status_code == 200
    body = ok.json()
    contract.validate_schema(body, "ClimateOutlook")
    assert body["scenario"]["preset"] == "both"
    again = client.get("/api/v1/sites/site_ubc_farm/climate-outlook", params={"scenario": "both"})
    assert again.json() == body


def test_offline_budgets_for_every_curated_site(monkeypatch):
    """Cold outlook under 1 s, cold 30-member forecast under 1.5 s, cached forecast under 100 ms."""
    import socket
    import time

    from app.features import config as C
    from app.services.features import _computed, _table, base
    from app.services.forecast import _cache_key, _cache_path, clear_forecast_cache, forecast

    monkeypatch.setenv("OFFLINE", "1")

    def refuse(*_args, **_kwargs):
        raise AssertionError("network call in OFFLINE mode")

    monkeypatch.setattr(socket.socket, "connect", refuse)
    body = {
        "selection": {"crops": ["crop_maize", "crop_soybean"], "pinned": [], "excluded": []},
        "constraints": {
            "equipment": [],
            "max_cycle_years": 4,
            "no_till": False,
            "labour_level": "medium",
            "livestock_on_farm": False,
        },
        "horizon_years": 10,
        "strategy_count": 3,
        "scenario": "baseline",
        "climate_source": "history_resample",
    }
    for site_id in C.CURATED_SITES:
        doc = forecast(site_id, body, members=2)
        assert doc["site_id"] == site_id and doc["data_mode"] != "mock"

    base.cache_clear()
    _computed.cache_clear()
    _table.cache_clear()
    climate_outlook.cache_clear()
    started = time.perf_counter()
    climate_outlook("site_ubc_farm", "baseline")
    assert time.perf_counter() - started < 1.0

    path = _cache_path(_cache_key("forecast", "site_ubc_farm", body, 30))
    path.unlink(missing_ok=True)
    clear_forecast_cache()
    started = time.perf_counter()
    forecast("site_ubc_farm", body, members=30)
    assert time.perf_counter() - started < 1.5
    started = time.perf_counter()
    forecast("site_ubc_farm", body, members=30)
    assert time.perf_counter() - started < 0.1

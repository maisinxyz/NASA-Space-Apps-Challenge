"""Stored cmip6 deltas replace the slider. A missing file keeps it. No seed is written."""

import importlib.util
from pathlib import Path

import numpy as np

from app.twin.climate import build_climate_outlook, season_deltas
from app.twin.types import Ramp, ScenarioApplied, Weather
from app.twin.weather_ensemble import build_members

REPO = Path(__file__).resolve().parents[3]
DOC = {
    "site_id": "site_usda_barc",
    "baseline_period": "1995-2014",
    "future_period": "2031-2040",
    "scenarios": {
        "ssp245": {
            "winter": {"temp_delta_c": {"p10": 0.2, "p50": 0.4, "p90": 0.7}, "precip_delta_pct": {"p50": 5.0}},
            "spring": {"temp_delta_c": {"p50": 0.6}, "precip_delta_pct": {"p50": 0.0}},
            "summer": {"temp_delta_c": {"p50": 1.5}, "precip_delta_pct": {"p50": -10.0}},
            "fall": {"temp_delta_c": {"p50": 0.8}, "precip_delta_pct": {"p50": 1.0}},
        },
        "ssp585": {
            "winter": {"temp_delta_c": {"p50": 0.9}, "precip_delta_pct": {"p50": 8.0}},
            "summer": {"temp_delta_c": {"p50": 2.4}, "precip_delta_pct": {"p50": -18.0}},
        },
    },
}


def _script():
    path = REPO / "scripts" / "seed_cmip6" / "build.py"
    spec = importlib.util.spec_from_file_location("seed_cmip6_build", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_mixed_licence_statements_do_not_allow_a_seed():
    script = _script()
    assert script.licence_is_single_public_grant([script.REGISTRY_CC0]) is True
    assert script.licence_is_single_public_grant([script.REGISTRY_CC0, script.TECH_NOTE_PER_FILE]) is False
    assert script.main() == 2


def test_baseline_and_out_of_range_deltas_are_not_applied():
    assert season_deltas(DOC, "baseline") is None
    hot = {
        "scenarios": {
            "ssp585": {"summer": {"temp_delta_c": {"p50": 9.0}, "precip_delta_pct": {"p50": 0.0}}},
        }
    }
    assert season_deltas(hot, "both") is None
    temp, rain = season_deltas(DOC, "drier_summers")
    assert temp["summer"] == 1.5 and rain["summer"] == -10.0
    high, high_rain = season_deltas(DOC, "both")
    assert high["summer"] == 2.4 and high_rain["summer"] == -18.0


def test_missing_file_keeps_the_slider_and_a_file_replaces_it(monkeypatch):
    from app.twin import climate

    monkeypatch.setattr(climate, "load_cmip6_delta", lambda _site: None)
    missing = build_climate_outlook("site_usda_barc", "drier_summers", climate_source="cmip6_delta")
    assert "linear slider ramp was kept" in missing["scenario"]["note"]
    assert missing["scenario"]["temp_offset_c"] == 1.0
    assert missing["scenario"]["rain_scale_by_season"]["summer"] == -20.0

    monkeypatch.setattr(climate, "load_cmip6_delta", lambda _site: DOC)
    stored = build_climate_outlook("site_usda_barc", "drier_summers", climate_source="cmip6_delta")
    assert stored["scenario"]["rain_scale_by_season"]["summer"] == -10.0
    assert stored["scenario"]["temp_offset_c"] == round((0.4 + 0.6 + 1.5 + 0.8) / 4, 3)
    assert "Stored seasonal deltas" in stored["scenario"]["note"]
    assert stored["scenario"]["preset"] == "drier_summers"


def test_history_resample_does_not_read_the_delta_file(monkeypatch):
    from app.twin import climate

    def boom(_site):
        raise AssertionError("delta file was read")

    monkeypatch.setattr(climate, "load_cmip6_delta", boom)
    doc = build_climate_outlook("site_usda_barc", "baseline")
    assert doc["scenario"]["note"] == "built from observed years"


def test_ensemble_ramps_stored_seasonal_deltas(monkeypatch):
    from app.twin import climate

    monkeypatch.setattr(climate, "load_cmip6_delta", lambda _site: DOC)
    weather = Weather(
        years=np.array([2000]),
        tmax=np.full((1, 52), 20.0),
        tmin=np.full((1, 52), 10.0),
        rain=np.full((1, 52), 10.0),
        et0=np.full((1, 52), 4.0),
    )
    scenario = ScenarioApplied(
        "drier_summers", 0.0, 1.0, {"summer": -20.0},
        "modeled scenario, not a forecast", "built from observed years", Ramp(years=10),
    )
    stored = build_members(
        weather, scenario, 10, 1, "cmip-case", lat=49.0,
        site_id="site_usda_barc", climate_source="cmip6_delta",
    )[0]
    slider = build_members(weather, scenario, 10, 1, "cmip-case", lat=49.0)[0]
    # Year 10 is the full stored delta. Week 0 is northern winter. Week 27 is summer.
    assert stored.tmax[9, 0] == 20.4
    assert stored.tmax[9, 27] == 21.5
    assert stored.tmax[0, 27] == 20.0 + 1.5 * 0.1
    assert stored.rain[9, 27] == 9.0
    assert stored.rain[9, 0] == 10.5
    assert slider.tmax[9, 27] == 21.0
    assert slider.rain[9, 27] == 8.0


def test_bc_seed_changes_year_ten_and_reports_its_pathway():
    from app.twin.climate import load_cmip6_delta

    weather = Weather(
        years=np.array([2000]),
        tmax=np.full((1, 52), 20.0),
        tmin=np.full((1, 52), 10.0),
        rain=np.full((1, 52), 10.0),
        et0=np.full((1, 52), 4.0),
    )
    for site in ("site_ubc_farm", "site_kpu_langley"):
        delta = load_cmip6_delta(site)
        summer = delta["scenarios"]["ssp245"]["summer"]
        baseline = ScenarioApplied("baseline", 0, 0, {}, "", "", Ramp(years=10))
        scenario = ScenarioApplied("drier_summers", 0, 1, {"summer": -20}, "", "", Ramp(years=10))
        common = {"lat": 49, "site_id": site, "climate_source": "cmip6_delta"}
        base = build_members(weather, baseline, 10, 1, "same", **common)[0]
        shifted = build_members(weather, scenario, 10, 1, "same", **common)[0]
        np.testing.assert_allclose(shifted.tmax[9, 27] - base.tmax[9, 27], summer["temp_delta_c"]["p50"])
        np.testing.assert_allclose(shifted.rain[9, 27] / base.rain[9, 27], 1 + summer["precip_delta_pct"]["p50"] / 100)
        outlook = build_climate_outlook(site, "drier_summers", climate_source="cmip6_delta")
        assert "ssp245" in outlook["scenario"]["note"]
        assert "1995–2014" in outlook["scenario"]["note"]
        assert "2031–2040" in outlook["scenario"]["note"]
        assert all(model in outlook["scenario"]["note"] for model in delta["models"]["ssp245"])
        assert any("NEX-GDDP-CMIP6" in source["name"] for source in outlook["sources"])


def test_forecast_uses_seed_in_ensemble_and_outlook(monkeypatch, tmp_path):
    import app.services.forecast as service

    monkeypatch.setattr(service, "_cache_path", lambda key: tmp_path / key)
    build = service.build_members
    calls = []

    def record(*args, **kwargs):
        calls.append(kwargs)
        return build(*args, **kwargs)

    monkeypatch.setattr(service, "build_members", record)
    doc = service.forecast("site_ubc_farm", {
        "selection": {"crops": ["crop_maize", "crop_soybean"]},
        "scenario": "drier_summers",
        "climate_source": "cmip6_delta",
    }, members=1)
    assert calls[0]["site_id"] == "site_ubc_farm"
    assert calls[0]["climate_source"] == "cmip6_delta"
    assert "ssp245" in doc["scenario"]["note"]
    assert doc["scenario"]["rain_scale_by_season"]["summer"] == -9.664
    assert doc["climate_outlook"]["scenario"]["note"] == doc["scenario"]["note"]
    assert any("NEX-GDDP-CMIP6" in source["name"] for source in doc["sources"])

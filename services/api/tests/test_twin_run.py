"""W6c: expand a cycle, aggregate the ensemble, stay inside the forecast budget."""

import time

import numpy as np

from app.twin.run import expand_plan, series_to_dict, simulate
from app.twin.types import (
    ENSEMBLE_MEMBERS,
    WEEK_COUNT,
    FieldCfg,
    IrrigationCfg,
    Plan,
    Ramp,
    ScenarioApplied,
    Slot,
    SoilProps,
    Weather,
    request_hash,
)
from app.twin.weather_ensemble import build_members


def _catalog():
    return {"crops": [{
        "id": "crop_maize",
        "family": "Poaceae",
        "category": "grain",
        "n_fixing": False,
        "n_fix_class": "none",
        "n_uptake_class": "high",
        "typical_n_rate_kg_ha": None,
        "residue_class": "high",
        "carbon_input_class": None,
        "return_interval_years": None,
        "host_families": [],
        "perennial": False,
        "cover_crop": False,
        "season_window": {"plant_doy": 130, "terminate_doy": 280},
        "cover_curve": [[0, 0.1], [40, 0.8], [120, 0.7]],
        "kc_stages": {"ini": 0.3, "mid": 1.2, "end": 0.6},
        "root_depth_class": "deep",
        "root_depth_m": {"ini": None, "mid": None, "end": None},
        "heat_limit_c": 35,
        "frost_tolerance_c": -1,
        "forage_use": None,
        "reference_yield": 8.0,
        "yield_response_factor_ky": None,
    }, {
        "id": "crop_soybean",
        "family": "Fabaceae",
        "category": "grain",
        "n_fixing": True,
        "n_fix_class": "high",
        "n_uptake_class": "medium",
        "typical_n_rate_kg_ha": None,
        "residue_class": "medium",
        "carbon_input_class": None,
        "return_interval_years": 2,
        "host_families": [],
        "perennial": False,
        "cover_crop": False,
        "season_window": {"plant_doy": 140, "terminate_doy": 270},
        "cover_curve": [[0, 0.05], [30, 0.7], [100, 0.6]],
        "kc_stages": {"ini": 0.4, "mid": 1.15, "end": 0.5},
        "root_depth_class": "medium",
        "root_depth_m": {"ini": None, "mid": None, "end": None},
        "heat_limit_c": 35,
        "frost_tolerance_c": -2,
        "forage_use": None,
        "reference_yield": 3.0,
        "yield_response_factor_ky": None,
    }]}


def _field() -> FieldCfg:
    return FieldCfg(
        field_id="field_1", name="North", area_ha=2.5, slope_class="gentle",
        irrigation=IrrigationCfg(available=True, quota_mm_per_season=120.0),
        existing_rotation="preset", no_till=False,
    )


def _soil() -> SoilProps:
    return SoilProps(155.0, 40.0, 40.0, 20.0, 2.5)


def _members(horizon: int, n: int) -> list:
    rain = np.vstack([np.full(WEEK_COUNT, 4.0 + 3.0 * i) for i in range(4)])
    temp = 16.0 + np.linspace(0, 2, 4)[:, None] * np.ones(WEEK_COUNT)
    weather = Weather(
        years=np.array([1991, 1992, 1993, 1994]),
        tmax=temp + 6.0,
        tmin=temp - 4.0,
        rain=rain,
        et0=np.full((4, WEEK_COUNT), 3.5),
    )
    scenario = ScenarioApplied(
        preset="baseline", rain_scale_pct=10.0, temp_offset_c=1.0, rain_scale_by_season={},
        label="modeled scenario, not a forecast", note="built from observed years", ramp=Ramp(years=10),
    )
    return build_members(weather, scenario, horizon, n, request_hash({"case": "golden"}), lat=49.25)


def _plan() -> Plan:
    slots = (
        Slot(1, "summer", "crop_maize"),
        Slot(2, "summer", "crop_soybean"),
    )
    return Plan("rot_existing", slots, cycle_years=2)


def test_expand_plan_repeats_the_cycle():
    expanded = expand_plan(_plan(), 4)
    crops = [slot.crop_id for slot in expanded.slots]
    assert crops == ["crop_maize", "crop_soybean", "crop_maize", "crop_soybean"]
    assert [slot.year_index for slot in expanded.slots] == [1, 2, 3, 4]


def test_ensemble_percentiles_are_ordered_and_deterministic():
    members = _members(5, 8)
    first = simulate(_plan(), members, _soil(), _field(), _catalog(), lat=49.25)
    second = simulate(_plan(), members, _soil(), _field(), _catalog(), lat=49.25)
    organic = first["soil_organic_index"]
    assert organic.points[0].p50 == 100.0
    assert first["n_balance"].points[0].p50 == 100.0
    assert first["n_balance_kg_ha"].points[0].p50 == 0.0
    assert first["pest_pressure_index"].points[0].p50 == 0.0
    assert len(organic.points) == 6
    for series in first.values():
        for point in series.points:
            assert point.p10 <= point.p50 <= point.p90
        again = second[series.metric]
        assert [point.p50 for point in series.points] == [point.p50 for point in again.points]
    assert "crop_maize" in first.yield_by_crop
    assert first.yield_by_crop["crop_maize"].unit == "t/ha"
    assert first.yield_by_crop["crop_maize"].points[1].p10 <= first.yield_by_crop["crop_maize"].points[1].p90
    payload = series_to_dict(first["soil_loss_t_ha_yr"])
    assert payload["unit"] == "t/ha/yr"
    assert set(payload["points"][1]) == {"year", "p50", "p10", "p90"}
    assert first.review_notes


def test_forecast_engine_budget_for_one_strategy():
    """30 members x 10 years is one strategy. Three of these must fit in the 1.5 s cold /forecast budget."""
    members = _members(10, ENSEMBLE_MEMBERS)
    started = time.perf_counter()
    simulate(_plan(), members, _soil(), _field(), _catalog(), lat=49.25)
    elapsed = time.perf_counter() - started
    assert elapsed < 0.5, elapsed

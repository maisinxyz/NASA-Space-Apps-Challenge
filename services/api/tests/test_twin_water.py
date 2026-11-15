"""W6a: water balance, infiltration, weather ensemble, yield."""

import numpy as np

from app.twin.config import KY_FAO33, taw_mm_per_m
from app.twin.types import (
    ENSEMBLE_MEMBERS,
    WEEK_COUNT,
    IrrigationCfg,
    PlanYear,
    Ramp,
    ScenarioApplied,
    Slot,
    SoilProps,
    State,
    Weather,
    WeatherYear,
    request_hash,
)
from app.twin.water import balance_residual, run_water_year
from app.twin.weather_ensemble import build_members

LAT = 49.25


def _soil() -> SoilProps:
    # UBC Farm 0-30 cm means from the seed summary: sand 39.8, silt 42.6, clay 17.7, soc 4.68%.
    return SoilProps(taw_mm_per_m=taw_mm_per_m(39.8, 42.6, 17.7), sand=39.8, silt=42.6, clay=17.7, soc_pct=4.68)


def _state() -> State:
    return State(soc_fast=0.3, soc_slow=5.0, infiltration_idx=100.0, n_pool=0.0, pest={})


def _maize_catalog(reference_yield=None, ky=None):
    return {
        "crops": [{
            "id": "crop_maize",
            "name": "Maize",
            "family": "Poaceae",
            "category": "grain",
            "n_fixing": False,
            "perennial": False,
            "cover_crop": False,
            "season_window": {"plant_doy": 130, "terminate_doy": 280},
            "cover_curve": [[0, 0.0], [30, 0.3], [68, 0.8], [150, 0.85]],
            "kc_stages": {"ini": 0.3, "mid": 1.2, "end": 0.6},
            "root_depth_class": "deep",
            "root_depth_m": {"ini": None, "mid": None, "end": None},
            "heat_limit_c": 35,
            "frost_tolerance_c": -1,
            "forage_use": None,
            "reference_yield": reference_yield,
            "yield_response_factor_ky": ky,
        }]
    }


def _weather_year(rain=2.0, et0=4.0, tmax=24.0, tmin=12.0) -> WeatherYear:
    return WeatherYear(
        year=2000,
        tmax=np.full(WEEK_COUNT, tmax),
        tmin=np.full(WEEK_COUNT, tmin),
        rain=np.full(WEEK_COUNT, rain),
        et0=np.full(WEEK_COUNT, et0),
    )


def _plan() -> PlanYear:
    return PlanYear(1, (Slot(1, "summer", "crop_maize"),))


def test_mass_balance_and_non_negative_storage():
    result = run_water_year(
        _plan(), _weather_year(), _soil(), _state(),
        IrrigationCfg(available=True, quota_mm_per_season=80.0),
        catalog=_maize_catalog(), lat=LAT,
    )
    assert np.max(np.abs(balance_residual(result))) < 1e-6
    assert np.all(result.storage_end_mm >= -1e-9)
    assert np.all(result.runoff_mm >= -1e-12)
    assert np.all(result.irrigation_mm <= result.irrigation_need_mm + 1e-9)
    assert result.irrigation_mm.sum() <= 80.0 + 1e-6


def test_no_irrigation_cannot_drive_storage_negative():
    result = run_water_year(
        _plan(), _weather_year(rain=0.0, et0=25.0), _soil(), _state(),
        IrrigationCfg(available=False),
        catalog=_maize_catalog(), lat=LAT,
    )
    assert np.max(np.abs(balance_residual(result))) < 1e-6
    assert np.all(result.storage_end_mm >= -1e-9)
    assert result.irrigation_mm.sum() == 0.0
    assert result.irrigation_need_mm.sum() > 0.0


def test_yield_uses_fao33_and_skips_a_null_reference_yield():
    stressed = run_water_year(
        _plan(), _weather_year(rain=0.0, et0=6.0), _soil(), _state(),
        IrrigationCfg(available=False),
        catalog=_maize_catalog(reference_yield=10.0), lat=LAT,
    )
    unstressed = run_water_year(
        _plan(), _weather_year(rain=20.0, et0=3.0, tmax=24.0), _soil(), _state(),
        IrrigationCfg(available=False),
        catalog=_maize_catalog(reference_yield=10.0), lat=LAT,
    )
    assert stressed.yield_t_ha["crop_maize"] < unstressed.yield_t_ha["crop_maize"]
    assert unstressed.yield_t_ha["crop_maize"] == 10.0
    assert KY_FAO33["crop_maize"] == 1.25
    omitted = run_water_year(
        _plan(), _weather_year(), _soil(), _state(), IrrigationCfg(available=True),
        catalog=_maize_catalog(reference_yield=None), lat=LAT,
    )
    assert omitted.yield_t_ha == {}
    assert omitted.forage_yield_t_ha == {}


def test_forage_yield_is_separate_from_grain():
    catalog = _maize_catalog(reference_yield=8.0)
    catalog["crops"][0]["category"] = "forage"
    catalog["crops"][0]["forage_use"] = "hay"
    result = run_water_year(
        _plan(), _weather_year(), _soil(), _state(), IrrigationCfg(available=True),
        catalog=catalog, lat=LAT,
    )
    assert result.forage_yield_t_ha["crop_maize"] == result.yield_t_ha["crop_maize"]


def test_ensemble_is_deterministic_and_ramps_to_the_full_scenario_in_the_last_year():
    hist = Weather(
        years=np.array([1991]),
        tmax=np.full((1, WEEK_COUNT), 20.0),
        tmin=np.full((1, WEEK_COUNT), 10.0),
        rain=np.full((1, WEEK_COUNT), 10.0),
        et0=np.full((1, WEEK_COUNT), 3.0),
    )
    scenario = ScenarioApplied(
        preset="baseline", rain_scale_pct=20.0, temp_offset_c=2.0,
        rain_scale_by_season={"summer": -20.0},
        label="modeled scenario, not a forecast", note="built from observed years",
        ramp=Ramp(years=10),
    )
    digest = request_hash({"site": "site_ubc_farm", "scenario": "baseline"})
    first = build_members(hist, scenario, 10, ENSEMBLE_MEMBERS, digest, lat=LAT)
    second = build_members(hist, scenario, 10, ENSEMBLE_MEMBERS, digest, lat=LAT)
    assert len(first) == ENSEMBLE_MEMBERS
    for a, b in zip(first, second):
        assert np.array_equal(a.rain, b.rain)
        assert np.array_equal(a.tmax, b.tmax)
        assert np.array_equal(a.et0, b.et0)
    member = first[0]
    # Year 1 (row 0) is 10% of the slider; year 10 is the full slider.
    # Week 0 is January (winter), so the global +20% applies. Week 26 is early July (summer), so -20% applies.
    assert member.rain[0, 0] == np.float64(10.0 * (1 + 0.20 * 0.1))
    assert member.rain[9, 0] == np.float64(10.0 * 1.20)
    assert member.rain[9, 26] == np.float64(10.0 * 0.80)
    assert member.tmax[9, 0] == np.float64(22.0)
    assert member.tmax[0, 0] == np.float64(20.2)
    assert member.et0[9, 0] > member.et0[0, 0]


def test_southern_hemisphere_flips_the_summer_rain_week():
    hist = Weather(
        years=np.array([1991]),
        tmax=np.zeros((1, WEEK_COUNT)),
        tmin=np.zeros((1, WEEK_COUNT)),
        rain=np.full((1, WEEK_COUNT), 10.0),
        et0=np.ones((1, WEEK_COUNT)),
    )
    scenario = ScenarioApplied(
        preset="drier_summers", rain_scale_pct=0.0, temp_offset_c=0.0,
        rain_scale_by_season={"summer": -20.0},
        label="modeled scenario, not a forecast", note="built from observed years",
        ramp=Ramp(years=10),
    )
    north = build_members(hist, scenario, 10, 1, "abc", lat=49.0)[0]
    south = build_members(hist, scenario, 10, 1, "abc", lat=-33.0)[0]
    assert north.rain[9, 26] < north.rain[9, 0]
    assert south.rain[9, 0] < south.rain[9, 26]

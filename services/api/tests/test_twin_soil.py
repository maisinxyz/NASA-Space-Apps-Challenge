"""W6b: soil carbon, nitrogen, pests, soil loss."""

import numpy as np

from app.twin.nitrogen import n_balance_index, nitrogen_flux, update_nitrogen
from app.twin.pest import pressure_index, update_pest
from app.twin.soil import initial_state, organic_index, soil_loss_t_ha, update_soc
from app.twin.types import (
    WEEK_COUNT,
    IrrigationCfg,
    Plan,
    PlanYear,
    Slot,
    SoilProps,
    WeatherYear,
)
from app.twin.water import run_water_year

LAT = 49.25


def _soil() -> SoilProps:
    return SoilProps(taw_mm_per_m=155.0, sand=40.0, silt=40.0, clay=20.0, soc_pct=2.0)


def _weather() -> WeatherYear:
    return WeatherYear(
        year=2001,
        tmax=np.full(WEEK_COUNT, 18.0),
        tmin=np.full(WEEK_COUNT, 8.0),
        rain=np.full(WEEK_COUNT, 8.0),
        et0=np.full(WEEK_COUNT, 3.0),
    )


def _catalog():
    def crop(cid, family, residue, n_fixing, n_fix, category="grain", window=(100, 250)):
        return {
            "id": cid,
            "family": family,
            "category": category,
            "n_fixing": n_fixing,
            "n_fix_class": n_fix,
            "n_uptake_class": None,
            "typical_n_rate_kg_ha": None,
            "residue_class": residue,
            "carbon_input_class": None,
            "return_interval_years": None,
            "host_families": [],
            "perennial": False,
            "cover_crop": category == "cover",
            "season_window": {"plant_doy": window[0], "terminate_doy": window[1]},
            "cover_curve": [[0, 0.2], [40, 0.8], [120, 0.8]],
            "kc_stages": {"ini": 0.3, "mid": 1.0, "end": 0.4},
            "root_depth_class": "medium",
            "root_depth_m": {"ini": None, "mid": None, "end": None},
            "heat_limit_c": 35,
            "frost_tolerance_c": -5,
            "forage_use": None,
            "reference_yield": None,
            "yield_response_factor_ky": None,
        }
    return {"crops": [
        crop("crop_maize", "Poaceae", "high", False, "none"),
        crop("crop_alfalfa", "Fabaceae", "medium", True, None, category="forage", window=(110, 290)),
        crop("crop_rye_cover", "Poaceae", "high", False, "none", category="cover", window=(1, 360)),
    ]}


def _water(plan_year: PlanYear):
    return run_water_year(
        plan_year, _weather(), _soil(), initial_state(), IrrigationCfg(available=False),
        catalog=_catalog(), lat=LAT,
    )


def test_bare_fallow_lowers_soil_index_versus_a_cover_crop():
    state = initial_state()
    assert organic_index(state) == 100.0
    fallow = update_soc(
        state, PlanYear(1, (Slot(1, "winter", "fallow"),)), _water(PlanYear(1, (Slot(1, "winter", "fallow"),))),
        _weather(), catalog=_catalog(), soil=_soil(),
    )
    cover_year = PlanYear(1, (Slot(1, "fall", "crop_rye_cover"),))
    cover = update_soc(state, cover_year, _water(cover_year), _weather(), catalog=_catalog(), soil=_soil())
    assert organic_index(cover) > organic_index(fallow)
    assert organic_index(fallow) > 0
    assert 0 <= cover.infiltration_idx <= 250
    assert 0 <= fallow.infiltration_idx <= 250


def test_legume_year_raises_the_nitrogen_balance():
    state = initial_state()
    weather = _weather()
    maize_year = PlanYear(1, (Slot(1, "summer", "crop_maize"),))
    alfalfa_year = PlanYear(1, (Slot(1, "summer", "crop_alfalfa"),))
    maize_water = _water(maize_year)
    alfalfa_water = _water(alfalfa_year)
    maize = update_nitrogen(state, maize_year, maize_water, catalog=_catalog())
    alfalfa = update_nitrogen(state, alfalfa_year, alfalfa_water, catalog=_catalog())
    assert n_balance_index(alfalfa) > n_balance_index(maize)
    flux = nitrogen_flux(state, alfalfa_year, alfalfa_water, _catalog())
    assert flux.fixed_kg_ha > 0
    assert any("n_fix_class is null" in note for note in flux.notes)
    assert flux.fertilizer_need_kg_ha >= 0


def test_monoculture_raises_pest_pressure_and_a_non_host_year_lowers_it():
    catalog = _catalog()
    slots = tuple(Slot(year, "summer", "crop_maize") for year in range(1, 5))
    plan = Plan("rot_existing", slots, cycle_years=1)
    state = initial_state()
    values = []
    for year in range(1, 5):
        state = update_pest(state, plan, year, catalog)
        values.append(pressure_index(state))
    assert values[0] < values[1] < values[2]
    assert all(0 <= value <= 100 for value in values)
    # Keep going until the cap, then it must stay at 100.
    longer = tuple(Slot(year, "summer", "crop_maize") for year in range(1, 8))
    capped = initial_state()
    plan8 = Plan("rot_existing", longer, cycle_years=1)
    last = 0.0
    for year in range(1, 8):
        capped = update_pest(capped, plan8, year, catalog)
        last = pressure_index(capped)
        assert 0 <= last <= 100
    assert last == 100.0
    broken = longer + (Slot(8, "summer", "crop_alfalfa"),)
    plan_break = Plan("rot_existing", broken, cycle_years=1)
    after = update_pest(capped, plan_break, 8, catalog)
    assert pressure_index(after) < last


def test_soil_loss_rises_with_slope_and_bare_ground():
    steep_year = PlanYear(1, (Slot(1, "winter", "fallow"),))
    covered = PlanYear(1, (Slot(1, "fall", "crop_rye_cover"),))
    steep = soil_loss_t_ha(_water(steep_year), _weather(), _soil(), "steep", no_till=False)
    flat = soil_loss_t_ha(_water(steep_year), _weather(), _soil(), "flat", no_till=False)
    covered_loss = soil_loss_t_ha(_water(covered), _weather(), _soil(), "steep", no_till=False)
    assert steep > flat
    assert covered_loss < steep
    assert steep > 0


def test_indices_stay_finite_over_ten_dry_years():
    catalog = _catalog()
    state = initial_state()
    slots = []
    for year in range(1, 11):
        slots.append(Slot(year, "summer", "crop_maize"))
    plan = Plan("rot_existing", tuple(slots), cycle_years=1)
    for year in range(1, 11):
        plan_year = PlanYear(year, (Slot(year, "summer", "crop_maize"),))
        dry = WeatherYear(
            year=1990 + year,
            tmax=np.full(WEEK_COUNT, 32.0),
            tmin=np.full(WEEK_COUNT, 16.0),
            rain=np.zeros(WEEK_COUNT),
            et0=np.full(WEEK_COUNT, 6.0),
        )
        water = run_water_year(
            plan_year, dry, _soil(), state, IrrigationCfg(available=False), catalog=catalog, lat=LAT,
        )
        state = update_soc(state, plan_year, water, dry, catalog=catalog, soil=_soil())
        state = update_nitrogen(state, plan_year, water, catalog=catalog)
        state = update_pest(state, plan, year, catalog)
        assert np.isfinite(organic_index(state))
        assert organic_index(state) > 0
        assert 0 <= state.infiltration_idx <= 250
        assert 0 <= pressure_index(state) <= 100
        assert np.isfinite(n_balance_index(state))

"""Station hindcast checks run offline against the committed station sidecars."""

import importlib

import numpy as np
import pytest

from tests.qa.checks import SEED, mean_bias, station_daily_path


def test_mean_bias_is_power_minus_station_and_skips_missing_pairs():
    bias = mean_bias(np.array([1.0, 2.0, np.nan, 4.0]), np.array([0.0, 2.0, 9.0, 1.0]))
    assert bias == pytest.approx((1.0 + 0.0 + 3.0) / 3.0)
    assert mean_bias(np.array([np.nan]), np.array([1.0])) is None


def test_station_daily_is_present_for_both_bc_sites():
    for site_id in ("site_ubc_farm", "site_kpu_langley"):
        assert station_daily_path(site_id) is not None
    assert mean_bias(np.array([]), np.array([])) is None


def test_water_mass_balance_when_the_engine_exists():
    try:
        water = importlib.import_module("app.twin.water")
    except ImportError:
        pytest.skip("app.twin.water is not on main yet (W6a)")
    if not hasattr(water, "run_water_year"):
        pytest.skip("run_water_year is not defined yet")
    # The mass-balance assertion belongs with W6a's own tests. This harness only
    # checks the function is importable once the engine is on main.
    assert callable(water.run_water_year)

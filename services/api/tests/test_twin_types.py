"""Shared forecast types (PRD §6.4): shapes, hash, and ensemble seeds."""

import json
import sys
from pathlib import Path

import numpy as np
import pytest

from app.twin.types import (
    ENSEMBLE_MEMBERS,
    WEEK_COUNT,
    PlanYear,
    Slot,
    State,
    Weather,
    member_seed,
    request_hash,
)

CONTRACTS = Path(__file__).resolve().parents[3] / "packages" / "contracts"
sys.path.insert(0, str(CONTRACTS))
from fixtures_lib.forecast_fixtures import request_body  # noqa: E402


def test_request_hash_is_order_independent_and_matches_the_contract_fixture():
    assert request_hash({"b": 1, "a": {"d": 2, "c": 3}}) == request_hash({"a": {"c": 3, "d": 2}, "b": 1})
    digest = request_hash(request_body())
    forecast = json.loads((CONTRACTS / "fixtures" / "forecast" / "site_usda_barc_forecast.json").read_text())
    assert digest == forecast["request_hash"]
    assert len(digest) == 64


def test_member_seeds_are_stable_and_distinct():
    digest = request_hash({"site": "site_usda_barc"})
    seeds = [member_seed(digest, i) for i in range(ENSEMBLE_MEMBERS)]
    assert seeds == [member_seed(digest, i) for i in range(ENSEMBLE_MEMBERS)]
    assert len(set(seeds)) == ENSEMBLE_MEMBERS
    with pytest.raises(ValueError):
        member_seed(digest, -1)


def test_weather_and_plan_year_shapes():
    weather = Weather(
        years=np.array([1991]),
        tmax=np.zeros((1, WEEK_COUNT)),
        tmin=np.zeros((1, WEEK_COUNT)),
        rain=np.ones((1, WEEK_COUNT)),
        et0=np.ones((1, WEEK_COUNT)),
    )
    assert weather.year_slice(0).rain.shape == (WEEK_COUNT,)
    plan_year = PlanYear(1, (Slot(1, "summer", "crop_maize"),))
    assert plan_year.slots[0].crop_id == "crop_maize"
    with pytest.raises(ValueError):
        PlanYear(1, (Slot(2, "summer", "crop_maize"),))
    state = State(1.0, 1.0, 100.0, 0.0, {"Poaceae": 1})
    assert state.pest["Poaceae"] == 1.0

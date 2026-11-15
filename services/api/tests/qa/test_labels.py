"""Every reported number has a unit, a basis and a confidence. Absolute forecast series are checked when W9 exists."""

import importlib

import pytest

from app.services.climate_outlook import climate_outlook
from app.twin.types import SUPPORT_SENTENCE
from tests.qa.checks import (
    ABSOLUTE_SERIES,
    number_problems,
    series_range_problems,
    source_problems,
)


def test_climate_outlook_numbers_and_sources():
    doc = climate_outlook("site_ubc_farm", "drier_summers")
    assert number_problems(doc) == []
    assert source_problems(doc["sources"]) == []
    for row in doc["heat_stress_days"]:
        assert series_range_problems(row["days"], row["crop_id"]) == []
        assert row["days"]["basis"]
        assert row["days"]["confidence"]


def test_forecast_absolute_estimates_when_the_service_exists():
    """Skeleton until W9. When `app.services.forecast.forecast` exists, this calls it."""

    try:
        forecast_mod = importlib.import_module("app.services.forecast")
    except ImportError:
        pytest.skip("app.services.forecast is not on main yet (W9)")
    build = getattr(forecast_mod, "forecast", None)
    if build is None:
        pytest.skip("forecast() is not defined yet (W9)")
    sample = build("site_usda_barc", {"selection": {"crops": ["crop_maize", "crop_soybean"]}}, members=2)
    assert number_problems(sample) == []
    assert sample.get("support_sentence")
    estimates = sample["fields"][0]["strategies"][0]["estimates"]
    for key in ABSOLUTE_SERIES:
        if key == "yield_t_ha":
            for row in estimates[key]:
                assert series_range_problems(row["series"], key) == []
            continue
        assert series_range_problems(estimates[key], key) == []
    assert estimates["income_estimate"] is None


def test_support_sentence_constant_is_the_prd_sentence():
    assert SUPPORT_SENTENCE == "This tool supports, and does not replace, local agronomic expertise."
    assert ABSOLUTE_SERIES

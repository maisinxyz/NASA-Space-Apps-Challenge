"""Every field PRD section 12 names is on a real engine response, not the mock fixture."""

from app.services.climate_outlook import climate_outlook
from app.services.forecast import forecast
from app.services.sensitivity import sensitivity
from app.twin.exposure import exposure_report
from fixtures_lib import contract
from tests.qa.checks import (
    CLIMATE_FIELDS,
    EXPOSURE_FIELDS,
    FORECAST_FIELDS,
    SENSITIVITY_FIELDS,
    missing_fields,
    number_problems,
    series_range_problems,
)

BODY = {
    "selection": {"crops": ["crop_maize", "crop_soybean"], "pinned": [], "excluded": []},
    "constraints": {
        "equipment": [],
        "max_cycle_years": 3,
        "no_till": False,
        "labour_level": "medium",
        "livestock_on_farm": False,
    },
    "horizon_years": 5,
    "strategy_count": 2,
    "scenario": "baseline",
    "climate_source": "history_resample",
}


def test_section12_fields_are_on_the_engine_response():
    doc = forecast("site_ubc_farm", BODY, members=2)
    contract.validate_schema(doc, "Forecast")
    assert missing_fields(doc, FORECAST_FIELDS) == []
    assert number_problems(doc) == []
    assert doc["data_mode"] != "mock"
    strategy = doc["fields"][0]["strategies"][0]
    assert strategy["estimates"]["income_estimate"] is None
    for key in ("soil_loss_t_ha_yr", "n_fertilizer_need_kg_ha", "n_fertilizer_saved_kg_ha", "forage_yield_t_ha"):
        assert series_range_problems(strategy["estimates"][key], key) == []
    outlook = climate_outlook("site_ubc_farm", "baseline")
    contract.validate_schema(outlook, "ClimateOutlook")
    assert missing_fields(outlook, CLIMATE_FIELDS) == []
    exposure = exposure_report("site_ubc_farm")
    contract.validate_schema(exposure, "ForecastExposure")
    assert missing_fields(exposure, EXPOSURE_FIELDS) == []
    grid = sensitivity("site_ubc_farm", BODY, members=2)
    contract.validate_schema(grid, "SensitivityGrid")
    assert missing_fields(grid, SENSITIVITY_FIELDS) == []

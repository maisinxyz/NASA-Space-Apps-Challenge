"""Contract v1.2.0: forecast fixtures match the schema and the honesty rules."""

import json

import pytest

from fixtures_lib import contract
from fixtures_lib.forecast_fixtures import (
    V2_SOURCE_FIELDS,
    documents,
    request_body,
    request_hash,
)

FIXTURES = contract.OPENAPI_PATH.parent / "fixtures"
ABSOLUTE_METRICS = {
    "yield_t_ha",
    "forage_yield_t_ha",
    "soil_loss_t_ha_yr",
    "n_fertilizer_need_kg_ha",
    "n_fertilizer_saved_kg_ha",
    "n_balance_kg_ha",
    "heat_stress_days",
}
SUPPORT = "This tool supports, and does not replace, local agronomic expertise."
OLD_PATHS = [
    "/sites",
    "/sites/{siteId}/features",
    "/sites/{siteId}/rotation-analysis",
    "/crops",
    "/glossary",
]
NEW_PATHS = [
    "/sites/{siteId}/climate-outlook",
    "/sites/{siteId}/exposure",
    "/sites/{siteId}/forecast",
    "/sites/{siteId}/forecast/sensitivity",
    "/crop-catalog",
]


def walk(obj):
    if isinstance(obj, dict):
        yield obj
        for value in obj.values():
            yield from walk(value)
    elif isinstance(obj, list):
        for value in obj:
            yield from walk(value)


def test_version_and_paths_are_additive():
    spec = contract.openapi()
    assert spec["info"]["version"] == "1.2.0"
    for path in OLD_PATHS + NEW_PATHS:
        assert path in spec["paths"]
    codes = spec["components"]["schemas"]["ErrorCode"]["enum"]
    for code in ("SELECTION_TOO_SMALL", "INVALID_QUOTA", "HORIZON_OUT_OF_RANGE"):
        assert code in codes
    assert "limited_data" in spec["components"]["schemas"]["DataMode"]["enum"]
    # v1.1 feature tables stay on 1.1.0
    assert spec["components"]["schemas"]["FeatureTable"]["properties"]["schema_version"]["const"] == "1.1.0"


def test_fixtures_match_the_generator_and_are_deterministic():
    assert documents() == documents()
    for rel, doc in documents().items():
        on_disk = json.loads((FIXTURES / rel).read_text(encoding="utf-8"))
        assert on_disk == doc


def test_request_validates_and_hash_matches_forecast():
    contract.validate_schema(request_body(), "ForecastRequest")
    forecast = json.loads((FIXTURES / "forecast/site_usda_barc_forecast.json").read_text(encoding="utf-8"))
    assert forecast["request_hash"] == request_hash(request_body())
    assert len(forecast["request_hash"]) == 64


def test_every_number_has_unit_basis_and_confidence():
    for rel in documents():
        doc = json.loads((FIXTURES / rel).read_text(encoding="utf-8"))
        found = 0
        for node in walk(doc):
            if {"value", "unit", "basis", "confidence"} <= node.keys():
                found += 1
                assert node["unit"]
                assert node["basis"] in ("measured", "derived", "modeled", "assumed", "relative")
                assert node["confidence"] in ("high", "medium", "low")
        if rel.endswith(("crop_catalog.json", "exposure.json")):
            continue
        assert found > 0


def test_absolute_estimates_have_a_range_and_support_sentence():
    forecast = json.loads((FIXTURES / "forecast/site_usda_barc_forecast.json").read_text(encoding="utf-8"))
    assert forecast["support_sentence"] == SUPPORT
    assert forecast["disclaimer"]
    seen = set()
    for node in walk(forecast):
        metric = node.get("metric") if isinstance(node, dict) else None
        if metric in ABSOLUTE_METRICS:
            seen.add(metric)
            assert node["unit"] and node["basis"] and node["confidence"]
            for point in node["points"]:
                assert "p10" in point and "p90" in point and "p50" in point
        if isinstance(node, dict) and node.get("metric") and "points" in node:
            for point in node["points"]:
                if point["year"] >= 1:
                    assert "p10" in point and "p90" in point
    missing = ABSOLUTE_METRICS - seen - {"heat_stress_days"}
    assert not missing
    for strategy in forecast["fields"][0]["strategies"]:
        income = strategy["estimates"]["income_estimate"]
        assert income["unit"] == "CAD"
        assert "p10" in income and "p90" in income
    assert forecast["fields"][0]["strategies"][0]["role"] == "existing"
    assert forecast["groundwater"]["scored"] is False if "groundwater" in forecast else forecast["climate_outlook"]["groundwater"]["scored"] is False


def test_sensitivity_axes_match_the_prd_grid():
    grid = json.loads((FIXTURES / "forecast/site_usda_barc_sensitivity.json").read_text(encoding="utf-8"))
    assert grid["axes"]["rain_scale_pct"] == [-30, -15, 0, 15, 30]
    assert grid["axes"]["temp_offset_c"] == [0, 1.5, 3]
    assert len(grid["cells"]) == 15


def test_catalog_traits_are_sourced_and_unverified_numbers_are_null():
    catalog = json.loads((FIXTURES / "crop_catalog.json").read_text(encoding="utf-8"))
    contract.validate_schema(catalog, "CropCatalog")
    assert catalog["data_mode"] == "seed"
    assert len(catalog["crops"]) >= 40
    equipment = {item["id"] for item in catalog["equipment"]}
    for crop in catalog["crops"]:
        for field in V2_SOURCE_FIELDS:
            assert crop["trait_sources"].get(field), field
        # A sourced reference yield is an object. An unsourced one stays null.
        if crop["reference_yield"] is not None:
            assert crop["reference_yield"]["unit"] == "t/ha"
            assert crop["reference_yield"]["basis"] == "derived"
            assert crop["reference_yield"]["source"]
        assert crop["typical_n_rate_kg_ha"] is None or isinstance(crop["typical_n_rate_kg_ha"], (int, float))
        assert crop["return_interval_years"] is None
        assert set(crop["needs_equipment"]) <= equipment


@pytest.mark.parametrize("code", ["SELECTION_TOO_SMALL", "INVALID_QUOTA", "HORIZON_OUT_OF_RANGE"])
def test_new_error_codes_validate(code):
    body = json.loads((FIXTURES / "errors" / f"{code}.json").read_text(encoding="utf-8"))
    contract.validate_schema(body, "Error")
    assert body["error"]["code"] == code

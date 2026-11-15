"""W9: forecast composition, cache, and the sensitivity grid."""

import json

import pytest

from app.core.errors import ApiError
from app.services.forecast import clear_forecast_cache, forecast
from app.services.sensitivity import sensitivity
from tests.qa.checks import canonical_json, number_problems, series_range_problems

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


def setup_function():
    clear_forecast_cache()


def test_forecast_is_deterministic_and_labels_every_number():
    first = forecast("site_usda_barc", BODY, members=2)
    second = forecast("site_usda_barc", BODY, members=2)
    assert canonical_json(first) == canonical_json(second)
    assert first["support_sentence"].startswith("This tool supports")
    assert first["disclaimer"]
    assert first["schema_version"] == "1.2.0"
    assert len(first["request_hash"]) == 64
    assert first["fields"][0]["strategies"][0]["role"] == "existing"
    assert number_problems(first) == []
    for strategy in first["fields"][0]["strategies"]:
        for key in ("soil_loss_t_ha_yr", "n_fertilizer_need_kg_ha", "forage_yield_t_ha", "n_fertilizer_saved_kg_ha"):
            assert series_range_problems(strategy["estimates"][key], key) == []
        assert strategy["estimates"]["income_estimate"] is None
        assert strategy["evidence_card"]["support_not_replace"]
    assert first["uncertainty"]["station_bias"] is None
    assert first["data_mode"] == "limited_data"


def test_two_fields_share_the_depth_quota_and_sum_area():
    body = {
        **BODY,
        "farm_water_quota_mm_per_season": 80,
        "fields": [
            {
                "field_id": "field_a",
                "name": "East",
                "area_ha": 2,
                "slope_class": "flat",
                "irrigation": {"available": True},
                "existing_rotation": "preset",
            },
            {
                "field_id": "field_b",
                "name": "West",
                "area_ha": 1,
                "slope_class": "steep",
                "irrigation": {"available": True},
                "existing_rotation": "preset",
            },
        ],
    }
    doc = forecast("site_usda_barc", body, members=2)
    assert [field["field_id"] for field in doc["fields"]] == ["field_a", "field_b"]
    assert len(doc["farm_rollup"]["strategies"]) == len(doc["fields"][0]["strategies"])
    for field in doc["fields"]:
        quota = field["strategies"][0]["farm_fit"]["water_vs_quota"]["quota_mm_per_season"]
        assert quota == 80
    rolled = doc["farm_rollup"]["strategies"][0]["farm_fit"]["water_vs_quota"]
    assert rolled["quota_mm_per_season"] == 80


def test_validation_errors_use_the_contract_codes():
    with pytest.raises(ApiError) as small:
        forecast("site_usda_barc", {"selection": {"crops": ["crop_maize"]}}, members=1)
    assert small.value.code == "SELECTION_TOO_SMALL"
    with pytest.raises(ApiError) as unknown:
        forecast("site_usda_barc", {"selection": {"crops": ["crop_maize", "crop_not_real"]}}, members=1)
    assert unknown.value.code == "UNKNOWN_CROP"
    with pytest.raises(ApiError) as horizon:
        forecast("site_usda_barc", {**BODY, "horizon_years": 3}, members=1)
    assert horizon.value.code == "HORIZON_OUT_OF_RANGE"
    with pytest.raises(ApiError) as quota:
        forecast("site_usda_barc", {**BODY, "farm_water_quota_mm_per_season": -1}, members=1)
    assert quota.value.code == "INVALID_QUOTA"
    with pytest.raises(ApiError) as weights:
        forecast("site_usda_barc", {**BODY, "priorities": {"weights": {"water_use": 0, "erosion_risk": 0}}}, members=1)
    assert weights.value.code == "INVALID_WEIGHTS"
    with pytest.raises(ApiError) as missing:
        forecast("site_no_such", BODY, members=1)
    assert missing.value.code == "SITE_NOT_FOUND"


def test_sensitivity_grid_shares_sum_to_one():
    grid = sensitivity("site_usda_barc", BODY, members=2)
    assert grid["axes"]["rain_scale_pct"] == [-30.0, -15.0, 0.0, 15.0, 30.0]
    assert grid["axes"]["temp_offset_c"] == [0.0, 1.5, 3.0]
    assert len(grid["cells"]) == 15
    shares = grid["rank_stability"]["share_first_by_strategy"]
    assert abs(sum(shares.values()) - 1.0) < 1e-9
    again = sensitivity("site_usda_barc", BODY, members=2)
    assert canonical_json(grid) == canonical_json(again)
    sample = next(iter(grid["cells"][0]["per_strategy"].values()))
    assert sample["soil_loss_t_ha_yr"]["p10"] <= sample["soil_loss_t_ha_yr"]["p50"] <= sample["soil_loss_t_ha_yr"]["p90"]
    assert number_problems(grid) == []


def test_cache_round_trip_keeps_bytes():
    doc = forecast("site_usda_barc", BODY, members=2)
    raw = json.dumps(doc, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    assert json.loads(raw)["site_id"] == "site_usda_barc"


def test_one_planting_choice_changes_later_soil_without_changing_later_crops(client, monkeypatch):
    from pathlib import Path

    from fixtures_lib.contract import validate_response, validate_schema

    monkeypatch.setenv("OFFLINE", "1")
    root = Path(__file__).resolve().parents[3]
    body = json.loads((root / "apps/web/lib/forecast/ubc-request.json").read_text())
    body["fields"] = body["fields"][:2]
    body["fields"][0]["first_year_planting"] = {"season": "spring", "crop_id": "crop_pea_field"}
    body["fields"][1]["existing_rotation"] = [
        {"year_index": 1, "season": "winter", "crop_id": "crop_wheat_winter"},
    ]
    body["horizon_years"] = 5
    body["scenario"] = "drier_summers"
    validate_schema(body, "ForecastRequest")
    response = client.post("/api/v1/sites/site_ubc_farm/forecast", json=body)
    assert response.status_code == 200, response.text
    doc = response.json()
    validate_response(doc, "/sites/{siteId}/forecast", "post")

    first, second = doc["fields"]
    baseline, *_, planting = first["strategies"]
    assert planting["id"] == "rot_first_year_planting"
    changed = [(before, after) for before, after in zip(baseline["plan"], planting["plan"]) if before != after]
    assert len(baseline["plan"]) == len(planting["plan"])
    assert changed == [(
        {"year_index": 1, "season": "spring", "crop_id": "crop_barley"},
        {"year_index": 1, "season": "spring", "crop_id": "crop_pea_field"},
    )]
    original = baseline["trajectories"]["soil_organic_index"]["points"]
    changed_soil = planting["trajectories"]["soil_organic_index"]["points"]
    assert original[0] == changed_soil[0]
    assert changed_soil[5]["p50"] != pytest.approx(original[5]["p50"])
    evidence = {item["label"]: item["value"] for item in planting["evidence_card"]["evidence_items"]}
    assert evidence["Year 5 soil organic matter index difference from baseline"] == pytest.approx(
        changed_soil[5]["p50"] - original[5]["p50"]
    )
    second_base, *_, second_planting = second["strategies"]
    assert second_base["plan"] != baseline["plan"]
    assert second_base["plan"] == second_planting["plan"]
    assert second_base["trajectories"] == second_planting["trajectories"]
    baseline_weather = forecast("site_ubc_farm", {**body, "scenario": "baseline"})
    baseline_weather_planting = baseline_weather["fields"][0]["strategies"][-1]
    assert baseline_weather_planting["plan"] == planting["plan"]
    assert baseline_weather_planting["trajectories"]["irrigation_need_mm"] != planting["trajectories"]["irrigation_need_mm"]


@pytest.mark.parametrize(("planting", "expected"), [
    ({"season": "spring", "crop_id": "crop_unlisted"}, "UNKNOWN_CROP"),
    ({"season": "monsoon", "crop_id": "crop_soybean"}, "INVALID_INPUT"),
    ({"season": "summer", "crop_id": "crop_soybean"}, "INVALID_INPUT"),
    ({"season": "spring", "crop_id": "crop_maize"}, "INVALID_INPUT"),
])
def test_one_planting_choice_rejects_invalid_replacements(planting, expected):
    body = {
        **BODY,
        "fields": [{
            "field_id": "west", "area_ha": 2, "slope_class": "flat", "irrigation": {"available": True},
            "existing_rotation": [{"year_index": 1, "season": "spring", "crop_id": "crop_maize"}],
            "first_year_planting": planting,
        }],
    }
    with pytest.raises(ApiError) as exc:
        forecast("site_usda_barc", body, members=1)
    assert exc.value.code == expected


@pytest.mark.parametrize("site_id,request_name", [
    ("site_ubc_farm", "ubc-request.json"),
    ("site_kpu_langley", "kpu-request.json"),
])
def test_demo_site_forecasts_use_three_strategies(site_id, request_name, monkeypatch):
    from pathlib import Path

    monkeypatch.setenv("OFFLINE", "1")
    root = Path(__file__).resolve().parents[3]
    body = json.loads((root / "apps/web/lib/forecast" / request_name).read_text())
    clear_forecast_cache()
    doc = forecast(site_id, body, members=1)
    assert all(len(field["strategies"]) == 3 for field in doc["fields"])
    if site_id == "site_kpu_langley":
        assert doc["data_mode"] == "limited_data"
        assert any("nearby SoilGrids proxy" in note for note in doc["assumptions"])
        for field in doc["fields"]:
            for strategy in field["strategies"]:
                assert any(flag["trigger"]["rule"] == "nearby_soil_proxy" for flag in strategy["review_flags"])
                assert strategy["trajectories"]["water_demand_mm"]["basis"] == "assumed"

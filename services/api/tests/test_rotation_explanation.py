"""Rotation explanations use the same cycle rules as alternative generation."""

from app.twin.explain.rotation import explain_rotation, merge_explanations
from app.twin.generate import cycle_conflicts
from app.twin.types import Plan, Slot
from fixtures_lib import contract


def test_custom_cereal_cycle_explains_broken_rule_and_unsourced_trait():
    crops = {
        "crop_wheat": {"id": "crop_wheat", "name": "Wheat", "family": "Poaceae", "n_fixing": False, "cover_crop": False},
        "crop_barley": {"id": "crop_barley", "name": "Barley", "family": "Poaceae", "n_fixing": False, "cover_crop": False},
    }
    years = [["crop_wheat"], ["crop_barley"]]
    plan = Plan("rot_custom_1", (Slot(1, "spring", "crop_wheat"), Slot(2, "spring", "crop_barley")), 2)
    explanation, unverified = explain_rotation(plan, crops, *cycle_conflicts(years, crops))
    rules = {rule["rule_id"]: rule["status"] for rule in explanation["rules"]}
    assert rules == {"break_crop": "broken", "return_interval": "unknown", "legume_in_cycle": "broken", "cover_in_cycle": "broken"}
    assert unverified == ["Wheat", "Barley"]
    contract.validate_schema(explanation, "RotationExplanation")


def test_host_and_known_return_rules_are_cyclic():
    crops = {
        "crop_a": {"id": "crop_a", "family": "A", "return_interval_years": 3},
        "crop_b": {"id": "crop_b", "family": "B", "host_families": ["A"]},
        "crop_c": {"id": "crop_c", "family": "C"},
        "crop_cover": {"id": "crop_cover", "family": "D", "cover_crop": True, "host_families": ["A"]},
    }
    assert cycle_conflicts([["crop_a"], ["crop_b"]], crops) == (False, True)
    assert cycle_conflicts([["crop_a"], ["crop_b", "crop_cover"]], crops) == (False, True)
    assert cycle_conflicts([["crop_a"], ["crop_b"], ["crop_c"]], crops) == (False, True)
    assert cycle_conflicts([["crop_a"], ["crop_c"], ["crop_c"]], crops) == (False, False)
    assert cycle_conflicts([["crop_b"], ["crop_c"]], crops) == (True, False)


def test_rollup_retains_broken_field_and_distinct_crop_roles():
    def explanation(status, crop):
        return {
            "rules": [{"rule_id": "break_crop", "status": status, "text": "Field status"}],
            "crop_roles": [{"crop_id": crop, "role": "cover", "text": "Protects soil"}],
        }
    first = explanation("met", "crop_red_clover")
    second = explanation("broken", "crop_rye_cover")
    merged = merge_explanations([first, second])
    assert merged["rules"][0]["status"] == "broken"
    assert len(merged["crop_roles"]) == 2
    contract.validate_schema(merged, "RotationExplanation")


def test_ubc_vegetable_alternatives_and_custom_explanation(client):
    body = {
        "selection": {
            "crops": ["crop_kale", "crop_lettuce", "crop_chard", "crop_beet", "crop_rye_cover"],
        },
        "scenario": "baseline",
        "constraints": {
            "equipment": [], "max_cycle_years": 4, "no_till": False,
            "labour_level": "medium", "livestock_on_farm": False,
        },
        "custom_strategies": [[
            {"year_index": 1, "season": "spring", "crop_id": "crop_wheat_winter"},
            {"year_index": 2, "season": "spring", "crop_id": "crop_barley"},
        ]],
    }
    response = client.post("/api/v1/sites/site_ubc_farm/forecast", json=body)
    assert response.status_code == 200
    doc = response.json()
    contract.validate_response(doc, "/sites/{siteId}/forecast", "post")
    field = doc["fields"][0]
    assert [strategy["role"] for strategy in field["strategies"]] == ["existing", "alternative", "alternative", "custom"]
    assert any(
        slot["crop_id"] in body["selection"]["crops"][:-1]
        for strategy in field["strategies"][1:3] for slot in strategy["plan"]
    )
    for scope in (field, doc["farm_rollup"]):
        assert all(strategy["rotation_explanation"]["rules"] for strategy in scope["strategies"])
        custom = scope["strategies"][-1]
        assert custom["scorecard"]
        assert any(rule["rule_id"] == "break_crop" and rule["status"] == "broken" for rule in custom["rotation_explanation"]["rules"])
    assert any(flag["trigger"]["rule"] == "uncited_rotation_trait" for flag in field["strategies"][-1]["review_flags"])
    assert client.post("/api/v1/sites/site_ubc_farm/forecast", json=body).json() == doc


def test_every_curated_site_keeps_three_strategies_offline(monkeypatch, tmp_path):
    from app.features.config import CURATED_SITES
    from app.services import forecast as service

    monkeypatch.setenv("OFFLINE", "1")
    monkeypatch.setattr(service, "_cache_path", lambda key: tmp_path / key)
    body = {"selection": {"crops": ["crop_maize", "crop_soybean", "crop_rye_cover"]}}
    for site in CURATED_SITES:
        doc = service.forecast(site, body, members=1)
        assert [strategy["role"] for strategy in doc["fields"][0]["strategies"]] == [
            "existing", "alternative", "alternative",
        ], site

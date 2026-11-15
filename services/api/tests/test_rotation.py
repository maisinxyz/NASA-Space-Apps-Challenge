"""Backend B: trait library, generator, scoring, uncertainty, evidence, scenarios, routes (backend rotation PRD §8-§11, §18)."""

import json
import socket
from pathlib import Path

import pytest

from app.features import config as FC
from app.features import seeds
from app.rotation import config as R
from app.rotation import engine as E
from app.rotation import traits as T
from app.services import features as F
from app.services import rotation as S
from app.weather import power
from fixtures_lib import contract

API = "/api/v1"
FIX = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "fixtures"
SITES = sorted(FC.CURATED_SITES)
URL = API + "/sites/{}/rotation-analysis"


def post(client, site, body=None):
    r = client.post(URL.format(site), json=body or {})
    assert r.status_code == 200, r.text
    return r.json()


def mains(rot):
    lib = T.library()
    return [s["crop_id"] for s in rot["sequence"] if s["crop_id"] == "fallow" or not lib[s["crop_id"]]["cover_crop"]][::1]


# ---------------------------------------------------------------- B1 trait library + glossary
def test_trait_library_is_complete():
    assert len(T.library()) >= 12
    assert T.problems() == []
    for c in T.library().values():
        contract.validate_schema(c, "CropTrait")


def test_glossary_entries_and_route(client):
    g = client.get(f"{API}/glossary").json()
    contract.validate_response(g, "/glossary")
    assert all(e["short"] and e["long"] and e["source"] for e in g)
    assert {"evapotranspiration", "satellite_vs_ground", "nitrogen_fixing_crops", "cover_crops", "deep_rooting_crops", "drought_tolerant_crops"} <= {e["id"] for e in g}


def test_crops_route_serves_traits(client):
    ids = {c["id"] for c in client.get(f"{API}/crops").json()}
    assert set(T.library()) <= ids and "crop_corn_silage" in ids  # old mock crops kept for presets/simulations


# ---------------------------------------------------------------- functional (PRD §18)
@pytest.mark.parametrize("site", SITES)
def test_three_rotations_seven_criteria(client, site):
    r = post(client, site)
    contract.validate_response(r, "/sites/{siteId}/rotation-analysis", "post")
    assert [x["rotation_id"] for x in r["rotations"]] == ["rot_existing", "rot_alt_1", "rot_alt_2"]
    assert [x["is_existing"] for x in r["rotations"]] == [True, False, False]
    assert sorted(x["rank"] for x in r["rotations"]) == [1, 2, 3]
    assert r["disclaimer"] == R.SUPPORT and r["data_mode"] == "seed"
    for rot in r["rotations"]:
        assert [s["criterion"] for s in rot["scorecard"]] == list(R.CRITERIA)
        for s in rot["scorecard"]:
            assert s["unit"] and s["basis"] and s["confidence"] and s["inputs"]
            if s["criterion"] in R.CLIMATE_DRIVEN:
                assert s["range"]["p10"] <= s["range"]["p90"]
            else:
                assert "range" not in s and s["needs_local_review"] is True and s["confidence"] == "low"
        card = rot["evidence_card"]
        assert card["why_suggested"] and card["evidence"] and card["benefits"] and card["information_gaps"]
        assert len(card["risks_for_local_review"]) >= len(R.REVIEW_ALWAYS)
        assert card["support_not_replace"] == R.SUPPORT
        assert "resampled years" in rot["rank_stability"]


def test_limited_data_location_does_not_fabricate(client, monkeypatch):
    raw = seeds.load_power("site_usda_barc")
    monkeypatch.setattr(power, "get_daily", lambda *a, **k: {**power._validate(raw), "cached": True})
    r = post(client, "site_somewhere_else", {"location": [10.0, 50.0]})
    assert r["limited_data"] is True and r["confidence"] == "low" and r["data_mode"] == "cached"
    text = json.dumps(r)
    assert "SoilGrids)" not in text  # no soil class claimed
    assert all(s["needs_local_review"] for rot in r["rotations"] for s in rot["scorecard"])


def test_why_names_weights_and_constraints(client):
    r = post(client, "site_usda_barc", {"weight_preset": "water", "constraints": {"no_specialty_equipment": True}})
    why = r["rotations"][1]["evidence_card"]["why_suggested"]
    assert "water use" in why and "no specialty equipment" in why


# ---------------------------------------------------------------- invariants (PRD §18)
def test_same_request_same_bytes_and_matches_fixture(client):
    a = client.post(URL.format("site_usda_barc"), json={}).content
    b = client.post(URL.format("site_usda_barc"), json={}).content
    assert a == b
    assert json.loads(a) == json.loads((FIX / "rotation_analysis" / "site_usda_barc_default.json").read_text())


def test_request_echo_replays_exactly(client):
    r = post(client, "site_cornell_ruminant", {"weight_preset": "erosion", "scenario": "both"})
    again = post(client, "site_cornell_ruminant", r["request_echo"])
    assert again["request_hash"] == r["request_hash"] and again["rotations"] == r["rotations"]


def test_weights_never_change_criterion_scores():
    plans = [E.build(E._slots(seq)) for seq in ((("crop_maize", "fallow"), ("crop_soybean", "fallow")),
                                                 (("crop_maize", "crop_rye_cover"), ("crop_soybean", "crop_rye_cover")),
                                                 (("crop_sorghum", "fallow"), ("crop_pea_field", "crop_red_clover")))]
    table = F.feature_table("site_usda_barc")
    raws = [{**E.trait_raw(p, False), **E.climate_raw(p, S._climate(table["features"]), "medium", 1.0, 39)} for p in plans]
    scores = {c: E.normalize([r[c] for r in raws], c in R.LOWER_IS_BETTER) for c in R.CRITERIA}
    w1 = {c: 1.0 for c in R.CRITERIA}
    w2 = {**w1, "water_use": 9.0}
    assert S._weighted(scores, w1) != S._weighted(scores, w2)  # overall moves, scores were computed once


def test_all_equal_raw_scores_50_and_note(client):
    assert E.normalize([2.0, 2.0, 2.0], False) == [50.0, 50.0, 50.0]
    r = post(client, "site_usda_barc", {"criteria_selected": ["market_suitability", "water_use"]})
    for i, c in enumerate(R.CRITERIA):
        vals = {rot["scorecard"][i]["score"] for rot in r["rotations"]}
        if vals == {50.0}:
            assert all("No difference" in rot["scorecard"][i]["note"] for rot in r["rotations"])


@pytest.mark.parametrize("constraints", [{"low_water": True}, {"no_specialty_equipment": True}, {"no_local_market": True}])
def test_generated_rotations_respect_allowed_crops_and_constraints(client, constraints):
    allowed = ["crop_maize", "crop_soybean", "crop_wheat_winter", "crop_barley", "crop_sorghum", "crop_alfalfa", "crop_rye_cover", "crop_canola", "crop_sunflower", "crop_pea_field"]
    r = post(client, "site_usda_barc", {"allowed_crops": allowed, "constraints": constraints})
    lib = T.library()
    for rot in r["rotations"][1:]:
        for s in rot["sequence"]:
            cid = s["crop_id"]
            if cid == "fallow":
                continue
            c = lib[cid]
            assert cid in allowed
            assert not (constraints.get("low_water") and c["water_need_class"] == "high")
            assert not (constraints.get("no_specialty_equipment") and c["needs_specialty_equipment"])
            assert not (constraints.get("no_local_market") and c["market_dependent"])


@pytest.mark.parametrize("site", SITES)
def test_no_same_family_in_consecutive_seasons(client, site):
    for rot in post(client, site)["rotations"][1:]:
        assert E.cyclic_family_ok(mains(rot))
        assert E.build(rot["sequence"]).issues == []


def test_scenario_preset_equals_custom_equivalent(client):
    preset = post(client, "site_ucdavis_oakville", {"scenario": "drier_summers"})
    vals = FC.SCENARIO_PRESETS["drier_summers"]
    custom = post(client, "site_ucdavis_oakville", {"scenario": {"preset": "baseline", **vals}})
    assert preset["rotations"] == custom["rotations"]
    assert custom["scenario"]["label"] == "modeled scenario, not a forecast"


def test_no_prediction_words_anywhere():
    for p in list((FIX / "rotation_analysis").glob("*.json")) + [FIX / "glossary.json", FIX / "compare" / "site_usda_barc.json"]:
        text = p.read_text(encoding="utf-8").lower()
        assert "yield" not in text and "profit" not in text, p.name


def test_never_mock_for_curated(client):
    for s in SITES:
        assert post(client, s)["data_mode"] != "mock"


def test_offline_no_network(client, monkeypatch):
    def refuse(*a, **k):
        raise AssertionError("network call in OFFLINE mode")

    monkeypatch.setenv("OFFLINE", "1")
    monkeypatch.setattr(socket.socket, "connect", refuse)
    S._analyze.cache_clear()
    F.base.cache_clear()
    F._computed.cache_clear()
    F._table.cache_clear()
    assert post(client, "site_cornell_ruminant", {"scenario": "wetter_winters"})["rotations"]


# ---------------------------------------------------------------- errors, warnings, compare
@pytest.mark.parametrize("body,code,status", [
    ({"allowed_crops": ["crop_banana"]}, "UNKNOWN_CROP", 422),
    ({"weights": {"water_use": 0, "erosion_risk": 0}}, "INVALID_WEIGHTS", 422),
    ({"scenario": {"rain_scale_pct": 80}}, "SCENARIO_OUT_OF_RANGE", 422),
    ({"surprise": 1}, "INVALID_INPUT", 422),
])
def test_request_errors(client, body, code, status):
    r = client.post(URL.format("site_usda_barc"), json=body)
    assert r.status_code == status and r.json()["error"]["code"] == code


def test_unknown_site(client):
    r = client.post(URL.format("site_nowhere"), json={})
    assert r.status_code == 404 and r.json()["error"]["code"] == "SITE_NOT_FOUND"


def test_ignored_weight_and_no_feasible_warning(client):
    r = post(client, "site_usda_barc", {"criteria_selected": ["water_use"], "weights": {"water_use": 1, "market_suitability": 2}})
    assert r["weights_applied"] == {"water_use": 1.0}
    assert any(w["code"] == "IGNORED_WEIGHT" for w in r["warnings"])
    nf = post(client, "site_usda_barc", {"allowed_crops": ["crop_maize", "crop_soybean"], "constraints": {"low_water": True}})
    w = next(w for w in nf["warnings"] if w["code"] == "NO_FEASIBLE_ALTERNATIVES")
    assert w["level"] == "error" and "low_water" in w["message"] and len(nf["rotations"]) < 3


def test_compare(client):
    r = client.get(f"{API}/sites/site_usda_barc/compare?rotations=rot_existing,rot_alt_1&scenario=both")
    assert r.status_code == 200
    contract.validate_response(r.json(), "/sites/{siteId}/compare")
    assert r.json()["rotations"][0]["rank_stability"] is None
    assert client.get(f"{API}/sites/site_usda_barc/compare?rotations=rot_nope").status_code == 404

"""Every JSON fixture validates against its OpenAPI response schema."""

import json
from pathlib import Path

import pytest

from fixtures_lib import contract

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
STAGE_ORDER = contract.openapi()["components"]["schemas"]["ProgressStage"]["enum"]
TERRAINS = ["terr_mock_hills", "terr_mock_tilted", "terr_mock_bowl"]

# fixture file -> (OpenAPI path, method, status)
RESPONSES = {
    "sites.json": ("/sites", "get", "200"),
    "crops.json": ("/crops", "get", "200"),
    "storms/terr_mock_hills.json": ("/weather/storms", "get", "200"),
    "rotations/terr_mock_hills.json": ("/rotations/presets", "get", "200"),
    "rotations/validate_result.json": ("/rotations/validate", "post", "200"),
    "simulations/sim_mock_001/status.json": ("/simulations/{simId}", "get", "200"),
    "simulations/sim_mock_001/evidence.json": ("/simulations/{simId}/evidence", "get", "200"),
    "weather/summary.json": ("/weather/summary", "get", "200"),
    "scans/scan_created.json": ("/scans", "post", "202"),
    "scans/scan_status.json": ("/scans/{scanId}", "get", "200"),
    "scans/scan_status_failed.json": ("/scans/{scanId}", "get", "200"),
}
for _t in TERRAINS:
    RESPONSES[f"terrain/{_t}/terrain.json"] = ("/terrain/{terrainId}", "get", "200")
    RESPONSES[f"terrain/{_t}/layers.json"] = ("/terrain/{terrainId}/layers", "get", "200")
    RESPONSES[f"terrain/{_t}/provenance.json"] = ("/terrain/{terrainId}/provenance", "get", "200")
    RESPONSES[f"terrain/{_t}/insights.json"] = ("/terrain/{terrainId}/insights", "get", "200")
for _p in (FIXTURES / "simulations" / "sim_mock_001" / "diff").glob("*.json"):
    RESPONSES[str(_p.relative_to(FIXTURES))] = ("/simulations/{simId}/diff", "get", "200")


def load(rel):
    return json.loads((FIXTURES / rel).read_text())


def test_every_json_fixture_is_mapped():
    on_disk = {str(p.relative_to(FIXTURES)) for p in FIXTURES.rglob("*.json")}
    errors = {f"errors/{p.name}" for p in (FIXTURES / "errors").glob("*.json")}
    assert on_disk - errors == set(RESPONSES), "add new fixtures to RESPONSES"


@pytest.mark.parametrize("rel", sorted(RESPONSES))
def test_fixture_matches_response_schema(rel):
    path, method, status = RESPONSES[rel]
    contract.validate_response(load(rel), path, method, status)


def test_one_error_fixture_per_code():
    codes = contract.openapi()["components"]["schemas"]["ErrorCode"]["enum"]
    for code in codes:
        body = load(f"errors/{code}.json")
        contract.validate_schema(body, "Error")
        assert body["error"]["code"] == code


def parse_sse(name):
    events = []
    for block in (FIXTURES / "scans" / name).read_text().strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        assert lines["event"] == "progress"
        events.append(json.loads(lines["data"]))
    return events


def test_sse_success_stream():
    events = parse_sse("sse_success.txt")
    for e in events:
        contract.validate_schema(e, "ProgressEvent")
    assert [e["stage"] for e in events] == STAGE_ORDER[:-1]  # every stage except failed, in order
    assert events[-1]["terrain_id"] == "terr_mock_hills"
    pcts = [e["pct"] for e in events]
    assert pcts == sorted(pcts) and pcts[-1] == 100


def test_sse_failure_stream():
    events = parse_sse("sse_fail_coverage.txt")
    for e in events:
        contract.validate_schema(e, "ProgressEvent")
    stages = [e["stage"] for e in events]
    assert stages[-2:] == ["fetching_elevation", "failed"]
    assert [STAGE_ORDER.index(s) for s in stages] == sorted(STAGE_ORDER.index(s) for s in stages)
    assert events[-1]["error"]["code"] == "TERRAIN_COVERAGE_MISSING"


def test_cover_rotations_have_lower_runoff_and_erosion():
    res = load("simulations/sim_mock_001/status.json")["results"]
    for rot in ("rot_cover", "rot_forage"):
        assert res[rot]["metrics"]["runoff_volume_m3"] < res["rot_existing"]["metrics"]["runoff_volume_m3"]
        assert res[rot]["metrics"]["erosion_index_mean"] < res["rot_existing"]["metrics"]["erosion_index_mean"]
    for r in res.values():
        assert len(r["frame_times_min"]) == 60


def test_evidence_numbers_come_from_metrics():
    res = load("simulations/sim_mock_001/status.json")["results"]
    ev = load("simulations/sim_mock_001/evidence.json")
    assert {c["rotation_id"] for c in ev["evidence_cards"]} == set(res)
    for card in ev["evidence_cards"]:
        m = res[card["rotation_id"]]["metrics"]
        values = {str(v) for k, v in m.items() if k != "basis"}
        first_number = card["evidence"][0].split()[2]  # "Runoff volume <n> m³ ..."
        assert first_number in values
        for section in ("evidence", "benefits", "information_gaps", "risks_for_local_review"):
            assert card[section]


def test_insight_anchors_inside_bbox():
    w, s, e, n = load("terrain/terr_mock_hills/terrain.json")["bbox_wgs84"]
    insights = load("terrain/terr_mock_hills/insights.json") + load("simulations/sim_mock_001/evidence.json")["insights"]
    assert len(insights) == 10
    assert any(i["anchor"]["at_time_min"] is not None for i in insights)
    for i in insights:
        assert w <= i["anchor"]["lon"] <= e and s <= i["anchor"]["lat"] <= n


def test_mock_labels():
    for site in load("sites.json"):
        assert "(mock)" in site["name"]
    for t in TERRAINS:
        assert "mock_data" in load(f"terrain/{t}/terrain.json")["quality_flags"]


def test_validator_rejects_bad_data():
    import jsonschema

    bad_site = load("sites.json")
    bad_site[0]["region"] = "Mars"
    with pytest.raises(jsonschema.ValidationError):
        contract.validate_response(bad_site, "/sites")
    two_rotations = load("rotations/terr_mock_hills.json")[:2]
    with pytest.raises(jsonschema.ValidationError):
        contract.validate_response(two_rotations, "/rotations/presets")
    pkg = load("terrain/terr_mock_hills/terrain.json")
    pkg["created_at"] = "yesterday"
    with pytest.raises(jsonschema.ValidationError):
        contract.validate_response(pkg, "/terrain/{terrainId}")
    status = load("simulations/sim_mock_001/status.json")
    status["results"]["not_a_rot_id"] = status["results"]["rot_cover"]
    with pytest.raises(jsonschema.ValidationError):
        contract.validate_response(status, "/simulations/{simId}")

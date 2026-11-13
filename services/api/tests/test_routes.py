"""Every route serves contract-valid fixture data."""

import json

import pytest

from fixtures_lib import contract
from fixtures_lib.ftw1 import from_bytes

API = "/api/v1"
SIM = "sim_mock_001"
T = "terr_mock_hills"
PNG = b"\x89PNG\r\n\x1a\n"
IMMUTABLE = "public, max-age=31536000, immutable"

# (url, OpenAPI path template)
JSON_GETS = [
    ("/health", "/health"),
    ("/sites", "/sites"),
    ("/sites/site_mock_okanagan", "/sites/{siteId}"),
    ("/scans/scan_mock_001", "/scans/{scanId}"),
    ("/scans/scan_mock_fail", "/scans/{scanId}"),
    (f"/terrain/{T}", "/terrain/{terrainId}"),
    ("/terrain/terr_mock_tilted", "/terrain/{terrainId}"),
    (f"/terrain/{T}/layers", "/terrain/{terrainId}/layers"),
    (f"/terrain/{T}/insights", "/terrain/{terrainId}/insights"),
    (f"/terrain/{T}/provenance", "/terrain/{terrainId}/provenance"),
    ("/weather/summary?lat=49.1&lon=-119.6", "/weather/summary"),
    (f"/weather/storms?terrain_id={T}", "/weather/storms"),
    ("/crops", "/crops"),
    (f"/rotations/presets?terrain_id={T}", "/rotations/presets"),
    (f"/simulations/{SIM}", "/simulations/{simId}"),
    (f"/simulations/{SIM}/evidence", "/simulations/{simId}/evidence"),
    (f"/simulations/{SIM}/diff?a=rot_existing&b=rot_cover", "/simulations/{simId}/diff"),
    (f"/notes?terrain_id={T}", "/notes"),
]

BINARY_GETS = [
    (f"/terrain/{T}/heightmap.png", "image/png"),
    (f"/terrain/{T}/normal.png", "image/png"),
    (f"/terrain/{T}/texture.jpg", "image/jpeg"),
    (f"/terrain/{T}/layers/slope.png", "image/png"),
    (f"/terrain/{T}/layers/flow_accumulation.png", "image/png"),
    (f"/terrain/{T}/layers/depressions.png", "image/png"),
    (f"/terrain/{T}/layers/cover_class.png", "image/png"),
    (f"/simulations/{SIM}/frames/rot_existing.bin", "application/octet-stream"),
    (f"/simulations/{SIM}/risk/rot_cover.png", "image/png"),
]


@pytest.mark.parametrize("url,template", JSON_GETS)
def test_json_get_matches_contract(client, url, template):
    r = client.get(API + url)
    assert r.status_code == 200, r.text
    contract.validate_response(r.json(), template, "get", "200")


@pytest.mark.parametrize("url,media", BINARY_GETS)
def test_binary_get(client, url, media):
    r = client.get(API + url)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(media)
    assert r.headers["cache-control"] == IMMUTABLE
    if media == "image/png":
        assert r.content.startswith(PNG)
    if media == "image/jpeg":
        assert r.content[:2] == b"\xff\xd8"


def test_frames_are_ftw1_and_gzipped(client):
    r = client.get(f"{API}/simulations/{SIM}/frames/rot_cover.bin", headers={"Accept-Encoding": "gzip"})
    assert r.headers.get("content-encoding") == "gzip"
    f = from_bytes(r.content)  # httpx decompresses
    assert (f.width, f.height, f.frame_count) == (256, 256, 60)


def test_diff_png_by_accept(client):
    r = client.get(f"{API}/simulations/{SIM}/diff?a=rot_existing&b=rot_forage", headers={"Accept": "image/png"})
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert r.content.startswith(PNG)


def test_diff_same_rotation_is_invalid(client):
    r = client.get(f"{API}/simulations/{SIM}/diff?a=rot_cover&b=rot_cover")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_INPUT"


@pytest.mark.parametrize(
    "url",
    ["/sites/site_nope", "/terrain/terr_nope", "/terrain/terr_nope/heightmap.png", "/simulations/sim_nope", "/scans/scan_nope", "/nope"],
)
def test_unknown_ids_are_not_found(client, url):
    r = client.get(API + url)
    assert r.status_code == 404
    contract.validate_schema(r.json(), "Error")
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_bad_input_uses_error_format(client):
    r = client.get(f"{API}/weather/summary?lat=200&lon=0")
    assert r.status_code == 422
    contract.validate_schema(r.json(), "Error")
    assert r.json()["error"]["code"] == "INVALID_INPUT"


def test_health_mode(client):
    assert client.get(f"{API}/health").json() == {"status": "ok", "mode": "live", "version": "1.0.0"}


def test_cors_for_localhost_3000(client):
    r = client.get(f"{API}/health", headers={"Origin": "http://localhost:3000"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"


def parse_sse(text):
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        assert lines["event"] == "progress"
        events.append(json.loads(lines["data"]))
    return events


def test_sse_reads_all_events_in_order(client):
    with client.stream("GET", f"{API}/scans/scan_mock_001/events") as r:
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/event-stream")
        events = parse_sse(r.read().decode())
    order = contract.openapi()["components"]["schemas"]["ProgressStage"]["enum"]
    assert [e["stage"] for e in events] == order[:-1]
    for e in events:
        contract.validate_schema(e, "ProgressEvent")
    assert events[-1]["terrain_id"] == T


def test_sse_failure_stream(client):
    with client.stream("GET", f"{API}/scans/scan_mock_fail/events") as r:
        events = parse_sse(r.read().decode())
    assert events[-1]["stage"] == "failed"
    assert events[-1]["error"]["code"] == "TERRAIN_COVERAGE_MISSING"


def test_post_scan(client):
    r = client.post(
        f"{API}/scans",
        data={"lat": "49.1", "lon": "-119.6", "bbox": "-119.6,49.1,-119.59,49.11", "name": "My field"},
        files=[("images", ("a.jpg", b"\xff\xd8fake", "image/jpeg")), ("images", ("b.png", PNG, "image/png"))],
    )
    assert r.status_code == 202, r.text
    contract.validate_response(r.json(), "/scans", "post", "202")


def test_post_scan_without_images(client):
    r = client.post(f"{API}/scans", data={"lat": "49.1", "lon": "-119.6"})
    assert r.status_code == 202, r.text


def test_post_scan_rejects_unsupported_file(client):
    r = client.post(f"{API}/scans", data={"lat": "49.1", "lon": "-119.6"}, files=[("images", ("a.gif", b"GIF89a", "image/gif"))])
    assert r.status_code == 415
    assert r.json()["error"]["code"] == "UNSUPPORTED_FILE"


def test_post_simulation(client):
    body = {"terrain_id": T, "storm_id": "storm_mock_1", "rotation_ids": ["rot_existing", "rot_cover", "rot_forage"]}
    r = client.post(f"{API}/simulations", json=body)
    assert r.status_code == 200, r.text
    contract.validate_response(r.json(), "/simulations", "post", "200")
    assert set(r.json()["results"]) == set(body["rotation_ids"])


def test_post_simulation_unknown_storm(client):
    body = {"terrain_id": T, "storm_id": "storm_nope", "rotation_ids": ["rot_existing"]}
    assert client.post(f"{API}/simulations", json=body).status_code == 404


def test_validate_rotation(client):
    body = {
        "terrain_id": T,
        "rotation": {"name": "Corn / wheat", "sequence": [{"year": 1, "crop_id": "crop_corn_silage"}, {"year": 2, "crop_id": "crop_wheat_winter"}]},
    }
    r = client.post(f"{API}/rotations/validate", json=body)
    assert r.status_code == 200, r.text
    contract.validate_response(r.json(), "/rotations/validate", "post", "200")
    assert r.json()["valid"] is True
    assert r.json()["warnings"][0]["code"] == "same_family_consecutive"


def test_notes_round_trip(client):
    body = {"terrain_id": T, "anchor": [-119.596, 49.102], "body": "Wet corner after rain."}
    r = client.post(f"{API}/notes", json=body)
    assert r.status_code == 201, r.text
    contract.validate_response(r.json(), "/notes", "post", "201")
    listed = client.get(f"{API}/notes?terrain_id={T}").json()
    assert [n["id"] for n in listed] == [r.json()["id"]]


def test_routes_match_openapi_exactly(client):
    import re

    def norm(p):
        return re.sub(r"\{[^}]+\}", "{}", p)

    spec = {(m.upper(), norm(p)) for p, ops in contract.openapi()["paths"].items() for m in ops if m in ("get", "post")}
    app_routes = {
        (m.upper(), norm(path.removeprefix(API)))
        for path, ops in client.app.openapi()["paths"].items()
        for m in ops
    }
    assert app_routes == spec

import copy
import json

import pytest
from fixtures_lib import contract
from app.core.errors import ApiError
from app.features import seeds
from app.services import custom_field, features
from app.weather import power


@pytest.fixture(autouse=True)
def clean(monkeypatch, tmp_path):
    monkeypatch.setattr(custom_field, "CACHE", tmp_path)
    custom_field._requests.clear()
    for fn in (features.base, features._computed, features._table): fn.cache_clear()
    yield
    custom_field._requests.clear()
    for fn in (features.base, features._computed, features._table): fn.cache_clear()


def body():
    return {"polygon": {"type":"Polygon", "coordinates":[[[-123.2375,49.2498],[-123.2368,49.2498],[-123.2368,49.2503],[-123.2375,49.2503],[-123.2375,49.2498]]]}, "rotation":"preset", "scenario":{"preset":"baseline"}}


def test_custom_field_live_inputs_are_isolated_and_cached(client, monkeypatch):
    soil_calls, power_calls = [], []
    def soil(lon, lat):
        soil_calls.append((lon, lat)); return seeds.load_soil("site_ubc_farm")
    def weather(lat, lon, *args, **kwargs):
        power_calls.append((lon, lat)); return {**power._validate(seeds.load_power("site_ubc_farm")), "cached": False}
    monkeypatch.setattr(custom_field, "soil_at", soil)
    monkeypatch.setattr(power, "get_daily", weather)
    response = client.post('/api/v1/field/analyze', json=body())
    assert response.status_code == 200, response.text
    out = response.json()
    contract.validate_response(out, "/field/analyze", "post", "200")
    assert out["forecast"]["data_mode"] == "limited_data"
    assert len(out["forecast"]["fields"]) == 1
    assert soil_calls == power_calls == [(out["location"]["lon"], out["location"]["lat"])]
    monkeypatch.setenv("OFFLINE", "1")
    again = client.post('/api/v1/field/analyze', json=body())
    assert again.json() == out and len(soil_calls) == 1
    equivalent = body()
    ring = equivalent["polygon"]["coordinates"][0][:-1]
    ring = list(reversed(ring[1:] + ring[:1]))
    equivalent["polygon"]["coordinates"][0] = ring + [ring[0]]
    assert client.post('/api/v1/field/analyze', json=equivalent).json() == out
    assert len(soil_calls) == 1
    other = body(); other["scenario"] = {"preset": "drier_summers"}
    assert client.post('/api/v1/field/analyze', json=other).status_code == 503


def test_invalid_polygons_and_rate_limit(client):
    invalid = []
    b = body(); b["polygon"]["coordinates"][0].pop(); invalid.append(b)
    b = body(); b["polygon"]["coordinates"][0][1] = b["polygon"]["coordinates"][0][3]; invalid.append(b)
    b = body(); b["polygon"]["coordinates"] = [[[-123,49],[-122,49],[-122,50],[-123,49]]]; invalid.append(b)
    b = body(); b["polygon"]["coordinates"].append(copy.deepcopy(b["polygon"]["coordinates"][0])); invalid.append(b)
    b = body(); b["polygon"]["coordinates"][0][1][0] = 10 ** 400; invalid.append(b)
    for item in invalid:
        r = client.post('/api/v1/field/analyze', json=item)
        assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_INPUT"
    custom_field._requests.clear()
    for _ in range(10): client.post('/api/v1/field/analyze', json=invalid[0])
    r = client.post('/api/v1/field/analyze', json=body())
    assert r.status_code == 429 and r.json()["error"]["retryable"]


def test_source_failure_is_503(client, monkeypatch):
    monkeypatch.setattr(custom_field, "_soil_rest", lambda *a: (_ for _ in ()).throw(TimeoutError()))
    monkeypatch.setattr(custom_field, "_soil_wcs", lambda *a: (_ for _ in ()).throw(ValueError()))
    r = client.post('/api/v1/field/analyze', json=body())
    assert r.status_code == 503 and r.json()["error"]["code"] == "DATA_SOURCE_UNAVAILABLE"


def test_custom_rotation_is_used(client, monkeypatch):
    monkeypatch.setattr(custom_field, "soil_at", lambda *args: seeds.load_soil("site_ubc_farm"))
    monkeypatch.setattr(power, "get_daily", lambda *args, **kwargs: {**power._validate(seeds.load_power("site_ubc_farm")), "cached": False})
    data = body()
    data["rotation"] = [{"year_index": 1, "season": "spring", "crop_id": "crop_maize"}, {"year_index": 2, "season": "spring", "crop_id": "crop_soybean"}]
    response = client.post('/api/v1/field/analyze', json=data)
    assert response.status_code == 200, response.text
    assert response.json()["forecast"]["fields"][0]["strategies"][0]["plan"][0]["crop_id"] == "crop_maize"


def test_antimeridian_ring_has_local_centroid_and_valid_area():
    ring = [[179.999, 10.0], [-179.999, 10.0], [-179.999, 10.001], [179.999, 10.001], [179.999, 10.0]]
    lon, lat, area = custom_field.geometry({"type": "Polygon", "coordinates": [ring]})
    assert abs(abs(lon) - 180) < 0.001
    assert abs(lat - 10.0005) < 0.0001
    assert 0 < area < 200


def test_cache_write_failure_does_not_discard_live_result(client, monkeypatch, tmp_path):
    monkeypatch.setattr(custom_field, "soil_at", lambda *args: seeds.load_soil("site_ubc_farm"))
    monkeypatch.setattr(power, "get_daily", lambda *args, **kwargs: {**power._validate(seeds.load_power("site_ubc_farm")), "cached": False})
    unavailable = tmp_path / "not_a_directory"
    unavailable.write_text("x")
    monkeypatch.setattr(custom_field, "CACHE", unavailable / "child")
    response = client.post('/api/v1/field/analyze', json=body())
    assert response.status_code == 200, response.text


@pytest.mark.parametrize(("key", "value"), [
    ("scenario", []),
    ("scenario", 1),
    ("scenario", {"temp_offset_c": "bad"}),
    ("selection", {"crops": 1}),
    ("selection", {"crops": ["crop_maize", []]}),
    ("rotation", [None]),
    ("rotation", [{"year_index": 1, "season": "spring", "crop_id": "crop_unknown"}]),
])
def test_malformed_inputs_are_rejected_before_lookup(client, monkeypatch, key, value):
    monkeypatch.setattr(custom_field, "soil_at", lambda *a: pytest.fail("Invalid input reached soil lookup"))
    data = body()
    data[key] = value
    response = client.post("/api/v1/field/analyze", json=data)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_INPUT"

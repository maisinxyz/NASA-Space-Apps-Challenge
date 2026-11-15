"""W4: UBC exposure uses POWER weeks and does not invent zones."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import install_error_handlers
from app.features.zones import spatial_limits
from app.routers import exposure as exposure_router
from app.twin.exposure import exposure_report
from fixtures_lib import contract


def test_spatial_limits_do_not_invent_a_value():
    notes = spatial_limits(dem_present=False, moisture_present=False)
    assert len(notes) == 2
    assert spatial_limits(dem_present=True, moisture_present=True) == []


def test_ubc_exposure_is_limited_and_has_no_zones():
    doc = exposure_report("site_ubc_farm")
    contract.validate_schema(doc, "ForecastExposure")
    assert doc["data_mode"] == "limited_data"
    assert doc["crops"] == ["crop_maize", "crop_soybean"]
    assert doc["zones"] == []
    assert doc["bare_field_windows"]
    assert {w["source"] for w in doc["bare_field_windows"]} == {"rotation_plan"}
    assert all(w["scene_count"] is None for w in doc["bare_field_windows"])
    hazards = {h for row in doc["vulnerable_seasons"] for h in row["hazards"]}
    assert hazards <= {"heat", "drought", "frost"}
    assert "waterlogging" not in hazards
    assert all(row["growth_stage"] == "in_ground" for row in doc["vulnerable_seasons"])
    assert any("not drawn" in note.lower() or "were not drawn" in note for note in doc["resolution_notes"])
    assert any("water-stress" in note for note in doc["resolution_notes"])


def _hill() -> dict:
    import numpy as np

    elev = np.full((8, 8), 40.0)
    elev[6:8, 4:8] = 5.0
    elev[0:3, 0:3] = 80.0
    return {
        "elevation": elev.tolist(),
        "res_m": 30.0,
        "origin": [-76.12, 39.03],
        "crs": "EPSG:4326",
        "bare_earth": False,
        "native_resolution_m": 30,
    }


def _weekly(low_weeks: int, low: float, high: float) -> dict:
    values = [low if week < low_weeks else high for week in range(52)]
    return {
        "unit": "m3/m3",
        "native_resolution_m": 9000,
        "weekly": [{"year": 2020, "values": values, "n_obs": [4] * 52}],
    }


def test_dem_zones_cover_slope_frost_and_one_coarse_moisture_value(monkeypatch):
    from app.features.zones import zones_from_elevation
    from app.services import features as features_svc

    smap = _weekly(12, 0.05, 0.3)
    zones, caveats = zones_from_elevation(_hill(), smap)
    kinds = [zone["kind"] for zone in zones]
    assert "erosion_risk" in kinds and "frost_pocket" in kinds
    water = [zone for zone in zones if zone["kind"] == "water_stress"]
    assert len(water) == 1
    assert "9000" in water[0]["resolution_note"] and "Sub-field" in water[0]["resolution_note"]
    assert water[0]["outline"]["type"] == "Polygon"
    assert any("Canopy or buildings" in line for line in caveats)
    for zone in zones:
        assert zone["id"] and zone["area_ha"] >= 0.05
        ring = zone["outline"]["coordinates"][0]
        assert len(ring) >= 4 and ring[0] == ring[-1]

    monkeypatch.setattr("app.features.seeds.load_dem", lambda _site: _hill())
    monkeypatch.setattr("app.features.seeds.load_smap", lambda _site: smap)
    body = features_svc.zones("site_ubc_farm")
    contract.validate_schema(body, "ZoneCollection")
    assert sum(zone["kind"] == "water_stress" for zone in body["zones"]) == 1


def test_bare_earth_true_has_no_canopy_caveat():
    from app.features.zones import zones_from_elevation

    doc = _hill()
    doc["bare_earth"] = True
    _zones, caveats = zones_from_elevation(doc, None)
    assert not any("Canopy or buildings" in line for line in caveats)
    assert not any(zone["kind"] == "water_stress" for zone in _zones)


def test_ndvi_cross_check_counts_cloud_free_scenes(monkeypatch):
    from app.features import seeds

    values = [0.1 if week < 10 else 0.8 for week in range(52)]
    ndvi = {"unit": "1", "weekly": [{"year": 2020, "values": values, "n_obs": [2] * 52}]}
    monkeypatch.setattr(seeds, "load_ndvi", lambda _site: ndvi)
    doc = exposure_report("site_ubc_farm")
    contract.validate_schema(doc, "ForecastExposure")
    ndvi_windows = [row for row in doc["bare_field_windows"] if row["source"] == "ndvi"]
    assert len(ndvi_windows) == 1
    assert ndvi_windows[0]["weeks"] == list(range(10))
    assert ndvi_windows[0]["scene_count"] == 20
    assert any(row["source"] == "rotation_plan" for row in doc["bare_field_windows"])
    assert doc["zones"] == []


def test_smap_dryness_is_supporting_evidence_only(monkeypatch):
    from app.features import seeds

    monkeypatch.setattr(seeds, "load_smap", lambda _site: _weekly(8, 0.05, 0.4))
    doc = exposure_report("site_ubc_farm")
    assert doc["vulnerable_seasons"]
    assert any("SMAP" in line for line in doc["caveats"])
    assert all("waterlogging" not in row["hazards"] for row in doc["vulnerable_seasons"])
    assert doc["zones"] == []


def test_exposure_route_rejects_unknown_crop_and_site():
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(exposure_router.router, prefix="/api/v1")
    client = TestClient(app)
    unknown = client.get("/api/v1/sites/site_ubc_farm/exposure", params={"crops": "crop_nope"})
    assert unknown.status_code == 422
    assert unknown.json()["error"]["code"] == "UNKNOWN_CROP"
    missing = client.get("/api/v1/sites/site_not_a_site/exposure")
    assert missing.status_code == 404
    one = client.get("/api/v1/sites/site_ubc_farm/exposure", params={"crops": "crop_cabbage"})
    assert one.status_code == 200
    body = one.json()
    assert body["crops"] == ["crop_cabbage"]
    assert body["vulnerable_seasons"] == []
    assert any("crop_cabbage" in c for c in body["caveats"])

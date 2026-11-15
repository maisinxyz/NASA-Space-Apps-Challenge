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

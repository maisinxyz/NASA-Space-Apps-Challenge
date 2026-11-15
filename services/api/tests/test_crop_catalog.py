"""Catalog v2: 40+ crops, sourced traits, selection errors, GET /crop-catalog."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import install_error_handlers
from app.routers import crop_catalog
from app.twin.catalog import catalog_problems, list_catalog, load_catalog, validate_selection
from app.core.errors import ApiError


PORTED = {
    "crop_maize", "crop_wheat_winter", "crop_barley", "crop_soybean", "crop_pea_field",
    "crop_alfalfa", "crop_red_clover", "crop_rye_cover", "crop_sorghum", "crop_millet",
    "crop_sunflower", "crop_canola",
}


def test_catalog_has_forty_sourced_crops():
    doc = load_catalog()
    assert catalog_problems(doc) == []
    assert doc["data_mode"] == "seed"
    assert len(doc["crops"]) >= 40
    assert PORTED <= {crop["id"] for crop in doc["crops"]}
    by_id = {crop["id"]: crop for crop in doc["crops"]}
    assert by_id["crop_wheat_spring"]["kc_stages"]["mid"] == 1.15
    assert by_id["crop_wheat_spring"]["kc_stages"]["ini"] == 0.3
    assert by_id["crop_wheat_spring"]["kc_stages"]["end"] is None
    assert by_id["crop_bean_dry"]["kc_stages"] == {"ini": 0.4, "mid": 1.15, "end": 0.35}
    assert by_id["crop_cabbage"]["kc_stages"] == {"ini": 0.7, "mid": 1.05, "end": 0.95}
    assert by_id["crop_lettuce"]["kc_stages"] == {"ini": 0.7, "mid": 1.0, "end": 0.95}
    assert by_id["crop_cabbage"]["season_window"]["plant_doy"] is None
    assert by_id["crop_cabbage"]["root_depth_m"] == {"ini": None, "mid": None, "end": None}
    assert "0.5-0.8" in by_id["crop_cabbage"]["trait_sources"]["root_depth_m"]
    assert by_id["crop_cabbage"]["region_fit"] == ["oceanic"]
    assert by_id["crop_cabbage"]["needs_equipment"] == []
    assert by_id["crop_tomato"]["kc_stages"]["end"] is None
    assert by_id["crop_cabbage"]["reference_yield"] is None
    assert "TODO(verify)" in by_id["crop_maize"]["trait_sources"]["kc_stages"]
    assert "1.20" in by_id["crop_maize"]["trait_sources"]["kc_stages"]


def test_selection_rules():
    validate_selection(["crop_maize", "crop_barley"])
    try:
        validate_selection(["crop_maize"])
    except ApiError as err:
        assert err.code == "SELECTION_TOO_SMALL"
    else:
        raise AssertionError("expected SELECTION_TOO_SMALL")
    try:
        validate_selection(["crop_maize", "crop_nope"])
    except ApiError as err:
        assert err.code == "UNKNOWN_CROP"
        assert "crop_nope" in (err.hint or "")
    else:
        raise AssertionError("expected UNKNOWN_CROP")


def test_get_crop_catalog_filters_category():
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(crop_catalog.router, prefix="/api/v1")
    client = TestClient(app)
    ok = client.get("/api/v1/crop-catalog", params={"category": "cover", "site_id": "site_ubc_farm"})
    assert ok.status_code == 200
    body = ok.json()
    assert body["crops"]
    assert {crop["category"] for crop in body["crops"]} == {"cover"}
    bad = client.get("/api/v1/crop-catalog", params={"category": "oilseed"})
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "INVALID_INPUT"
    # UBC is oceanic. Crops with that fit, and crops with an empty fit, both stay.
    # KPU has no stored class, so a filled region_fit does not hide a crop there.
    assert len(list_catalog(site_id="site_ubc_farm")["crops"]) == len(load_catalog()["crops"])
    assert len(list_catalog(site_id="site_kpu_langley")["crops"]) == len(load_catalog()["crops"])

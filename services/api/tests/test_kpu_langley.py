"""KPU Langley curated site: offline POWER seed and a SoilGrids null-cell record (EC1)."""

import gzip
import json
import os

from app.features import config as C
from app.features import seeds
from app.services import features as F

API = "/api/v1"


def test_kpu_langley_features_offline(monkeypatch):
    monkeypatch.setenv("OFFLINE", "1")
    assert os.environ["OFFLINE"] == "1"
    for fn in (F.base, F._computed, F._table):
        fn.cache_clear()
    table = F.feature_table("site_kpu_langley")
    assert table["data_mode"] == "seed"
    assert table["site_id"] == "site_kpu_langley"
    site = C.CURATED_SITES["site_kpu_langley"]
    assert table["location"] == [site["lon"], site["lat"]]
    assert site["farm_id"] == "kpu-langley"
    assert site["name"] == "KPU Langley, School of Horticulture"
    assert table["quality"]["years_available"] == 34
    assert table["years"] == {"start": "1991-01-01", "end": "2024-12-31"}
    # SoilGrids returned null means at this point. No texture was assigned.
    assert table["soil"] is None
    from app.features.pipeline import weekly_seed_grid
    satellite = any(
        doc is not None and weekly_seed_grid(doc)[0]
        for doc in (
            seeds.load_ndvi("site_kpu_langley"),
            seeds.load_smap("site_kpu_langley"),
            seeds.load_ecostress("site_kpu_langley"),
        )
    )
    assert table["quality"]["limited_data"] is (not satellite)
    assert seeds.sidecar_problems(seeds.SEED_DIR / "site_kpu_langley") == []
    power = seeds.load_power("site_kpu_langley")
    assert power["header"]["start"] == "19910101"
    assert power["header"]["end"] == "20241231"
    for name, series in power["properties"]["parameter"].items():
        assert len(series) == 12419, name
        assert all(value != -999 for value in series.values()), name


def test_kpu_power_cell_is_not_the_ubc_cell():
    def load(site_id):
        path = seeds.SEED_DIR / site_id / seeds.POWER_FILE
        with gzip.open(path, "rt", encoding="utf-8") as raw:
            return json.load(raw)

    kpu = load("site_kpu_langley")
    ubc = load("site_ubc_farm")
    assert kpu["geometry"]["coordinates"] != ubc["geometry"]["coordinates"]
    kpu_1991 = {day: value for day, value in kpu["properties"]["parameter"]["T2M"].items() if day.startswith("1991")}
    ubc_1991 = {day: value for day, value in ubc["properties"]["parameter"]["T2M"].items() if day.startswith("1991")}
    assert kpu_1991 != ubc_1991
    assert "shares_power_cell_with" not in C.CURATED_SITES["site_kpu_langley"]
    # Soil is not the same record either: UBC has a texture summary, KPU's means were null.
    assert seeds.load_soil("site_ubc_farm") is not None
    assert seeds.load_soil("site_kpu_langley") is None


def test_ubc_forecast_assumption_names_the_vegetable_preset():
    from app.services.forecast import clear_forecast_cache, forecast

    clear_forecast_cache()
    doc = forecast(
        "site_ubc_farm",
        {
            "selection": {"crops": ["crop_cabbage", "crop_lettuce", "crop_rye_cover"]},
            "horizon_years": 5,
            "strategy_count": 2,
            "scenario": "baseline",
            "climate_source": "history_resample",
        },
        members=1,
    )
    assert any("Current rotation" in line for line in doc["assumptions"])
    assert doc["fields"][0]["strategies"][0]["label"] == "Current rotation"


def test_bc_presets_are_a_vegetable_rotation_not_corn():
    from app.rotation.config import SITE_PRESETS

    for site_id in ("site_ubc_farm", "site_kpu_langley"):
        preset = SITE_PRESETS[site_id]
        assert preset["name"] == "Current rotation"
        mains = [main for _year, main, _off in preset["slots"]]
        covers = [off for _year, _main, off in preset["slots"]]
        assert "crop_maize" not in mains and "crop_soybean" not in mains
        assert mains == ["crop_cabbage", "crop_lettuce"]
        assert covers == ["crop_rye_cover", "crop_rye_cover"]


def test_curated_routes_are_not_replaced_by_the_mock_site_card(client):
    # packages/contracts/fixtures/sites.json lists this id as "KPU Langley (mock)".
    # That card wins GET /sites/{id}. Feature and zone routes stay on the curated seed.
    listed = client.get(f"{API}/sites/site_kpu_langley")
    assert listed.status_code == 200
    assert "(mock)" in listed.json()["name"]
    features = client.get(f"{API}/sites/site_kpu_langley/features")
    assert features.status_code == 200
    assert features.json()["data_mode"] == "seed"
    zones = client.get(f"{API}/sites/site_kpu_langley/zones")
    assert zones.status_code == 200
    assert zones.json()["data_mode"] == "seed"

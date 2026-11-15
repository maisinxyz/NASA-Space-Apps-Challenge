"""UBC Farm curated site: offline POWER and SoilGrids seeds (forecast PRD W1)."""

import os

from app.features import config as C
from app.features import seeds
from app.services import features as F


def test_ubc_farm_features_offline(monkeypatch):
    monkeypatch.setenv("OFFLINE", "1")
    assert os.environ["OFFLINE"] == "1"
    for fn in (F.base, F._computed, F._table):
        fn.cache_clear()
    table = F.feature_table("site_ubc_farm")
    assert table["data_mode"] == "seed"
    assert table["site_id"] == "site_ubc_farm"
    assert table["location"] == [C.CURATED_SITES["site_ubc_farm"]["lon"], C.CURATED_SITES["site_ubc_farm"]["lat"]]
    assert table["quality"]["years_available"] == 34
    assert table["years"] == {"start": "1991-01-01", "end": "2024-12-31"}
    assert table["soil"]["texture_class"] == "loam"
    assert table["soil"]["basis"] == "modeled"
    assert seeds.sidecar_problems(seeds.SEED_DIR / "site_ubc_farm") == []
    assert seeds.load_power("site_ubc_farm")["header"]["start"] == "19910101"

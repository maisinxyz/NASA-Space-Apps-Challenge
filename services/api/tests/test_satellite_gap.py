"""W2: satellite loaders return None when nothing was retrieved."""

import json
import pytest

from app.features import seeds


def test_ubc_remaining_satellite_gaps_are_not_series():
    assert seeds.load_smap("site_ubc_farm") is None
    assert seeds.load_grace("site_ubc_farm") is None
    assert seeds.load_dem("site_ubc_farm") is None
    assert seeds.sidecar_problems() == []
    eco = seeds.load_ecostress("site_ubc_farm")
    eco_gap = seeds.SEED_DIR / "site_ubc_farm" / "ecostress.gap.json"
    if eco is None:
        gap = json.loads(eco_gap.read_text(encoding="utf-8"))
        assert gap["data_mode"] == "limited_data"
        assert gap["available"] is False
        assert gap["weekly"] is None
        assert gap["candidates"]
        assert "Earthdata" in gap["reason"]
    else:
        assert eco["layer"] == "ecostress"
        assert isinstance(eco["weekly"], list) and eco["weekly"]
        assert all(len(row["values"]) == 52 and len(row["n_obs"]) == 52 for row in eco["weekly"])
        assert not eco_gap.is_file()
    for name in ("smap", "grace", "dem"):
        gap = json.loads((seeds.SEED_DIR / "site_ubc_farm" / f"{name}.gap.json").read_text(encoding="utf-8"))
        assert gap["data_mode"] == "limited_data"
        assert gap["available"] is False
        assert gap["weekly"] is None
        assert gap["candidates"]
        assert "Earthdata" in gap["reason"]


@pytest.mark.parametrize("site_id", ["site_ubc_farm", "site_kpu_langley"])
def test_modis_seed_contains_only_observed_composite_weeks(site_id):
    doc = seeds.load_ndvi(site_id)
    assert doc["product"] == {"short_name": "MOD13Q1", "version": "061"}
    assert doc["native_resolution_m"] == 250
    assert [row["year"] for row in doc["weekly"]] == [2023, 2024, 2025]
    for row in doc["weekly"]:
        assert len(row["values"]) == len(row["n_obs"]) == 52
        assert 0 < sum(row["n_obs"]) <= 23
        for value, count in zip(row["values"], row["n_obs"]):
            assert (value is None and count == 0) or (-0.2 <= value <= 1 and count == 1)
    assert not (seeds.SEED_DIR / site_id / "ndvi.gap.json").is_file()

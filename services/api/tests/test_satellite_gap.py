"""W2: satellite loaders return None when nothing was retrieved."""

import json

from app.features import seeds


def test_ubc_satellite_loaders_are_none_and_gaps_are_not_series():
    assert seeds.load_ndvi("site_ubc_farm") is None
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
    for name in ("ndvi", "smap", "grace", "dem"):
        gap = json.loads((seeds.SEED_DIR / "site_ubc_farm" / f"{name}.gap.json").read_text(encoding="utf-8"))
        assert gap["data_mode"] == "limited_data"
        assert gap["available"] is False
        assert gap["weekly"] is None
        assert gap["candidates"]
        assert "Earthdata" in gap["reason"]

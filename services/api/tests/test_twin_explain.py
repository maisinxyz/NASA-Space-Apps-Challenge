"""W8: uncertainty rows, review flags, evidence templates, and the sensitivity axes."""

import numpy as np

from app.twin.explain.evidence import evidence_card
from app.twin.explain.flags import clubroot_flags, strategy_flags
from app.twin.explain.grid import RAIN_AXIS, TEMP_AXIS
from app.twin.explain.uncertainty import station_bias, uncertainty_layers
from app.twin.types import SUPPORT_SENTENCE, Plan, Slot


def _week(year: int, values: list[float], n_obs: list[int] | None = None) -> dict:
    return {"year": year, "values": values, "n_obs": n_obs if n_obs is not None else [1] * 52}


def test_uncertainty_layers_from_synthetic_seeds_keep_the_absent_path(monkeypatch):
    """Present, coarse, sparse, and non-bare-earth cases. Nothing is written under data/seed."""
    from app.features import seeds
    from app.features.pipeline import resolve_scenario
    from app.services.features import computed
    from app.twin.explain import uncertainty as U

    plain = {row["layer"] for row in U.uncertainty_layers("site_ubc_farm")}
    assert "smap" not in plain and "dem" not in plain

    years = computed("site_ubc_farm", resolve_scenario()).years
    y0, y1 = int(years[-2]), int(years[-1])
    smap_values = [0.15 + (week % 7) * 0.01 for week in range(52)]
    smap = {
        "unit": "m3/m3", "basis": "modeled", "native_resolution_m": 9000,
        "weekly": [_week(y0, smap_values), _week(y1, smap_values)],
    }
    sparse = [None if week else 0.2 for week in range(52)]
    sparse_obs = [0] * 52
    sparse_obs[0] = 1
    ndvi = {
        "unit": "1", "basis": "measured", "native_resolution_m": 30,
        "weekly": [_week(y0, sparse, sparse_obs), _week(y1, sparse, sparse_obs)],
    }
    eco = {
        "unit": "W/m2", "basis": "measured", "native_resolution_m": 70,
        "weekly": [_week(y0, [100.0] * 52), _week(y1, [140.0] * 52)],
    }
    grace = {
        "unit": "mm", "basis": "modeled", "native_resolution_m": 25000,
        "weekly": [_week(y0, [1.0] * 52), _week(y1, [2.0] * 52)],
    }
    imerg = {
        "unit": "mm", "basis": "measured", "native_resolution_m": 10000,
        "weekly": [_week(y0, [5.0] * 52), _week(y1, [8.0] * 52)],
    }
    dem = {
        "elevation": [[10.0, 12.0], [11.0, 30.0]],
        "res_m": 30.0,
        "native_resolution_m": 30.0,
        "origin": [-123.24, 49.25],
        "bare_earth": False,
    }

    monkeypatch.setattr(seeds, "load_ndvi", lambda _site: ndvi)
    monkeypatch.setattr(seeds, "load_smap", lambda _site: smap)
    monkeypatch.setattr(seeds, "load_ecostress", lambda _site: eco)
    monkeypatch.setattr(seeds, "load_grace", lambda _site: grace)
    monkeypatch.setattr(seeds, "load_dem", lambda _site: dem)
    real_weekly = U._weekly_file

    def weekly(site_id: str, name: str):
        if name == "imerg":
            return imerg
        return real_weekly(site_id, name)

    monkeypatch.setattr(U, "_weekly_file", weekly)
    layers = {row["layer"]: row for row in U.uncertainty_layers("site_ubc_farm")}
    assert layers["smap"]["native_resolution_m"] == 9000
    assert layers["smap"]["record_years"] == f"{y0}-{y1}"
    assert "m3/m3" in layers["smap"]["resolution_note"]
    assert "basis derived" in layers["smap"]["resolution_note"]
    assert "correlation" in layers["smap"]["resolution_note"]
    assert "not converted" in layers["ecostress"]["resolution_note"]
    assert "not scored" in layers["grace"]["resolution_note"]
    assert "correlation" not in layers["grace"]["resolution_note"]
    assert "IMERG" in layers["imerg"]["resolution_note"] and "basis derived" in layers["imerg"]["resolution_note"]
    assert layers["ndvi"]["confidence"] == "low"
    assert layers["dem"]["confidence"] == "low"
    assert "Canopy or buildings" in layers["dem"]["resolution_note"]
    from fixtures_lib import contract
    contract.validate_schema({"layers": list(layers.values()), "station_bias": None}, "ForecastUncertainty")

    from app.twin.explain.flags import site_flags
    rules = {flag["trigger"]["rule"] for flag in site_flags("rot_existing", "site_ubc_farm")}
    assert "coarse_pixel" in rules
    assert "few_cloud_free_scenes" in rules
    assert "non_bare_earth" in rules
    assert "layer_not_retrieved" not in rules


def test_correlation_and_bias_use_overlapping_weeks_only():
    from app.twin.explain.uncertainty import _corr_bias

    corr, bias, n = _corr_bias(
        np.array([1.0, 2.0, np.nan, 4.0]),
        np.array([1.0, 2.0, 9.0, 4.0]),
    )
    assert n == 3 and corr == 1.0 and bias == 0.0


def test_uncertainty_uses_sourced_resolutions_and_station_bias():
    layers = uncertainty_layers("site_ubc_farm")
    by_name = {row["layer"]: row for row in layers}
    assert by_name["nasa_power"]["native_resolution_m"] == 55000
    assert by_name["soilgrids"]["native_resolution_m"] == 250
    assert by_name["nasa_power"]["record_years"] == "1991-2024"
    assert by_name["nasa_power"]["needs_local_validation"] is True
    bias = station_bias("site_ubc_farm")
    assert bias is not None
    assert bias["variable"].startswith("mean_temperature")
    assert bias["bias"]["unit"] == "°C"
    assert bias["bias"]["basis"] == "derived"
    assert bias["n_years"] == 12
    from fixtures_lib import contract
    contract.validate_schema({"layers": list(by_name.values()), "station_bias": bias}, "ForecastUncertainty")
    from app.features import seeds
    if seeds.load_smap("site_ubc_farm") is None:
        assert "smap" not in by_name
    else:
        assert by_name["smap"]["native_resolution_m"] > 0
        assert "basis derived" in by_name["smap"]["resolution_note"]


def test_clubroot_flag_waits_for_catalog_text():
    plan = Plan("rot_alt_1", (Slot(1, "summer", "crop_cabbage"), Slot(2, "summer", "crop_cabbage")), 2)
    quiet = {"crops": [{"id": "crop_cabbage", "family": "Brassicaceae", "notes": "Heading brassica.", "host_families": []}]}
    assert clubroot_flags("rot_alt_1", plan, quiet) == []
    named = {"crops": [{"id": "crop_cabbage", "family": "Brassicaceae", "notes": "Clubroot host in coastal BC.", "host_families": []}]}
    flags = clubroot_flags("rot_alt_1", plan, named)
    assert flags[0]["trigger"] == {"layer": "crop_catalog", "rule": "clubroot_family_repeat"}
    assert flags[0]["severity"] == "caution"


def test_evidence_card_is_a_template_with_the_support_sentence():
    card = [{
        "criterion": "water_use",
        "score": 100.0,
        "unit": "index 0-100 across these strategies, higher is better",
        "basis": "modeled",
        "year10_value": 40.0,
        "inputs": [{"name": "year10", "value": 40.0, "unit": "mm/yr", "basis": "modeled"}],
    }]
    doc = evidence_card("rot_existing", role="existing", rank=1, n_strategies=2, scorecard=card, gaps=["No SMAP seed is stored."], risks=["Check the soil test."])
    assert doc["support_not_replace"] == SUPPORT_SENTENCE
    assert doc["evidence_items"][0]["unit"] == "mm/yr"
    assert doc["evidence_items"][0]["basis"] == "modeled"
    assert doc["information_gaps"] == ["No SMAP seed is stored."]


def test_sensitivity_axes_are_the_prd_grid():
    assert RAIN_AXIS == (-30.0, -15.0, 0.0, 15.0, 30.0)
    assert TEMP_AXIS == (0.0, 1.5, 3.0)


def test_unrated_crop_flag_names_the_rule():
    from app.twin.types import Constraints, ForecastRequest, Selection

    plan = Plan("rot_existing", (Slot(1, "summer", "crop_maize"),), 1)

    class _Sim:
        review_notes = ("Nitrogen rates are assumed.",)

        def __getitem__(self, key):
            from types import SimpleNamespace
            return SimpleNamespace(points=())

    req = ForecastRequest(
        selection=Selection(("crop_maize", "crop_soybean")),
        constraints=Constraints((), 4, False, "medium", False),
        horizon_years=5,
        climate_source="history_resample",
        strategy_count=2,
    )
    flags = strategy_flags("rot_existing", plan, _Sim(), req, {"crops": []}, "site_ubc_farm")
    rules = {flag["trigger"]["rule"] for flag in flags}
    assert "unrated_crop" in rules
    assert "resolution_coarser_than_field" in rules
    assert "layer_not_retrieved" in rules
    assert all(flag["trigger"]["layer"] and flag["text"] for flag in flags)
    missing = uncertainty_layers("site_not_a_curated_seed")
    assert missing[0]["layer"] == "nasa_power"
    assert "soilgrids" not in {row["layer"] for row in missing}

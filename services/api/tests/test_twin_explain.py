"""W8: uncertainty rows, review flags, evidence templates, and the sensitivity axes."""

from app.twin.explain.evidence import evidence_card
from app.twin.explain.flags import clubroot_flags, strategy_flags
from app.twin.explain.grid import RAIN_AXIS, TEMP_AXIS
from app.twin.explain.uncertainty import station_bias, uncertainty_layers
from app.twin.types import SUPPORT_SENTENCE, Plan, Slot


def test_uncertainty_uses_sourced_resolutions_and_skips_a_missing_station():
    layers = uncertainty_layers("site_ubc_farm")
    by_name = {row["layer"]: row for row in layers}
    assert by_name["nasa_power"]["native_resolution_m"] == 55000
    assert by_name["soilgrids"]["native_resolution_m"] == 250
    assert by_name["nasa_power"]["record_years"] == "1991-2024"
    assert by_name["nasa_power"]["needs_local_validation"] is True
    assert station_bias("site_ubc_farm") is None
    assert "smap" not in by_name


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

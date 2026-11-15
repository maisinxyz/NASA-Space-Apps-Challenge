"""Monthly climatology, including offline data and contract behavior."""

from datetime import UTC, date, datetime
from time import perf_counter

import pytest

from app.services.outlook import _number, _outlook
from fixtures_lib import contract

PATH = "/sites/{siteId}/outlook"


@pytest.mark.parametrize("site", ["site_ubc_farm", "site_kpu_langley"])
def test_outlook_is_contract_valid_and_cached(client, site, monkeypatch):
    monkeypatch.setenv("OFFLINE", "1")
    url = f"/api/v1/sites/{site}/outlook"
    first = client.get(url)
    assert first.status_code == 200
    doc = first.json()
    contract.validate_response(doc, PATH, "get", "200")
    assert doc["kind"] == "climatology"
    assert len(doc["months"]) == 12
    assert doc["months"][0]["month"] == doc["start_month"]
    assert doc["months"][0]["water_balance_mm"]["basis"] == "modeled"
    assert all(row["kind"] == "climatology" for row in doc["months"])
    before = perf_counter()
    assert client.get(url).json() == doc
    assert perf_counter() - before < 0.3
    assert client.get(url, params={"months": 1}).json()["months"] == doc["months"][:1]


def test_outlook_scenario_and_lead_time():
    start = date(2026, 12, 1)
    base = _outlook("site_ubc_farm", 2, "baseline", start)
    wetter = _outlook("site_ubc_farm", 2, "wetter_winters", start)
    assert [month["month"] for month in base["months"]] == ["2026-12", "2027-01"]
    assert wetter["months"][0]["rain_mm"]["value"] == pytest.approx(base["months"][0]["rain_mm"]["value"] * 1.2, abs=0.002)
    first = _number([0, 1, 2, 3, 4], "mm", "derived", 0)
    last = _number([0, 1, 2, 3, 4], "mm", "derived", 11)
    assert last["p10"] < first["p10"] < first["p90"] < last["p90"]


def test_outlook_applies_seas5_only_to_matching_months(monkeypatch):
    from app.weather import seasonal

    start = date(2026, 12, 1)
    baseline = _outlook("site_ubc_farm", 2, "baseline", start)
    monkeypatch.setattr(seasonal, "anomalies", lambda *_: {"2026-12": (2.0, 10.0)})
    updated = _outlook("site_ubc_farm", 2, "baseline", start, datetime(2026, 11, 16, tzinfo=UTC))
    contract.validate_response(updated, PATH)
    assert updated["kind"] == "seasonal_forecast"
    assert updated["months"][0]["temperature_mean_c"]["value"] == pytest.approx(
        baseline["months"][0]["temperature_mean_c"]["value"] + 2
    )
    assert updated["months"][1:] == baseline["months"][1:]


@pytest.mark.parametrize(("path", "status", "code"), [
    ("/site_no_such/outlook", 404, "SITE_NOT_FOUND"),
    ("/site_ubc_farm/outlook?months=0", 422, "INVALID_INPUT"),
    ("/site_ubc_farm/outlook?months=13", 422, "INVALID_INPUT"),
    ("/site_ubc_farm/outlook?scenario=unknown", 422, "INVALID_INPUT"),
])
def test_outlook_errors_match_contract(client, path, status, code):
    response = client.get("/api/v1/sites" + path)
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    contract.validate_schema(response.json(), "Error")

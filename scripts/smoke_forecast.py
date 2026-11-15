"""OFFLINE smoke for UBC Farm and the three older curated sites.

Hits climate-outlook, exposure, crop-catalog, forecast, sensitivity, and glossary.
Fails if a section 12 response field is missing, if data_mode is mock, or if the
body does not match the OpenAPI schema.

    OFFLINE=1 python scripts/smoke_forecast.py
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

os.environ["OFFLINE"] = "1"

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))
sys.path.insert(0, str(ROOT / "packages" / "contracts"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402
from app.core.config import Settings  # noqa: E402
from fixtures_lib import contract  # noqa: E402
from tests.qa.checks import (  # noqa: E402
    CLIMATE_FIELDS,
    EXPOSURE_FIELDS,
    FORECAST_FIELDS,
    SENSITIVITY_FIELDS,
    missing_fields,
)

SITES = ("site_ubc_farm", "site_usda_barc", "site_cornell_ruminant", "site_ucdavis_oakville")
BODY = {
    "selection": {"crops": ["crop_maize", "crop_soybean"], "pinned": [], "excluded": []},
    "constraints": {
        "equipment": [],
        "max_cycle_years": 3,
        "no_till": False,
        "labour_level": "medium",
        "livestock_on_farm": False,
    },
    "horizon_years": 5,
    "strategy_count": 2,
    "scenario": "baseline",
    "climate_source": "history_resample",
}


def _fail(problems: list[str]) -> int:
    for line in problems:
        print(f"FAIL {line}")
    return 1


def main() -> int:
    problems: list[str] = []
    client = TestClient(create_app(Settings(sse_delay_s=0)))
    catalog = client.get("/api/v1/crop-catalog", params={"site_id": "site_ubc_farm"})
    if catalog.status_code != 200:
        problems.append(f"crop-catalog {catalog.status_code}")
    else:
        if catalog.json().get("data_mode") == "mock":
            problems.append("crop-catalog data_mode is mock")
        if len(catalog.json().get("crops") or []) < 40:
            problems.append("crop-catalog has fewer than 40 crops")
    glossary = client.get("/api/v1/glossary")
    if glossary.status_code != 200:
        problems.append(f"glossary {glossary.status_code}")
    for site_id in SITES:
        started = time.perf_counter()
        climate = client.get(f"/api/v1/sites/{site_id}/climate-outlook", params={"scenario": "baseline"})
        exposure = client.get(f"/api/v1/sites/{site_id}/exposure")
        forecast = client.post(f"/api/v1/sites/{site_id}/forecast", json=BODY)
        grid = client.post(f"/api/v1/sites/{site_id}/forecast/sensitivity", json=BODY)
        elapsed = time.perf_counter() - started
        print(f"{site_id} {elapsed:.2f}s climate={climate.status_code} exposure={exposure.status_code} forecast={forecast.status_code} sensitivity={grid.status_code}")
        for name, response, schema, paths in (
            ("climate-outlook", climate, "ClimateOutlook", CLIMATE_FIELDS),
            ("exposure", exposure, "ForecastExposure", EXPOSURE_FIELDS),
            ("forecast", forecast, "Forecast", FORECAST_FIELDS),
            ("sensitivity", grid, "SensitivityGrid", SENSITIVITY_FIELDS),
        ):
            if response.status_code != 200:
                problems.append(f"{site_id} {name} HTTP {response.status_code} {response.text[:200]}")
                continue
            body = response.json()
            if body.get("data_mode") == "mock":
                problems.append(f"{site_id} {name} data_mode is mock")
            try:
                contract.validate_schema(body, schema)
            except Exception as exc:  # jsonschema.ValidationError
                problems.append(f"{site_id} {name} schema: {exc}")
            absent = missing_fields(body, paths)
            if absent:
                problems.append(f"{site_id} {name} missing {absent}")
        if forecast.status_code == 200:
            income = forecast.json()["fields"][0]["strategies"][0]["estimates"]["income_estimate"]
            if income is not None:
                problems.append(f"{site_id} income_estimate was filled without a farmer price")
            sentence = forecast.json().get("support_sentence")
            if sentence != "This tool supports, and does not replace, local agronomic expertise.":
                problems.append(f"{site_id} support_sentence {sentence!r}")
    if problems:
        return _fail(problems)
    print("smoke ok: 4 sites, offline, section 12 fields present")
    return 0


if __name__ == "__main__":
    sys.exit(main())

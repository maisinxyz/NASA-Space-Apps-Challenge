"""Write an engine forecast and a sensitivity grid for each curated site that has soil.

The contract fixtures under packages/contracts/fixtures/forecast/ stay the shape
examples. This script writes the real response beside the cache, which is gitignored.
site_kpu_langley is skipped while its SoilGrids summary is null, because forecast()
raises DATA_SOURCE_UNAVAILABLE.

    python scripts/build_forecast_fixtures.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))

from app.core.errors import ApiError  # noqa: E402
from app.features import seeds  # noqa: E402
from app.services.forecast import forecast  # noqa: E402
from app.services.sensitivity import sensitivity  # noqa: E402

SITES = ("site_usda_barc", "site_cornell_ruminant", "site_ucdavis_oakville", "site_ubc_farm", "site_kpu_langley")

OUT = ROOT / "data" / "cache" / "forecast" / "engine"
BODY = {
    "selection": {"crops": ["crop_maize", "crop_soybean"], "pinned": [], "excluded": []},
    "constraints": {
        "equipment": [],
        "max_cycle_years": 3,
        "no_till": False,
        "labour_level": "medium",
        "livestock_on_farm": False,
    },
    "horizon_years": 10,
    "strategy_count": 3,
    "scenario": "baseline",
    "climate_source": "history_resample",
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for site in SITES:
        if seeds.load_soil(site) is None:
            print(f"{site}: skipped, soil summary is null")
            continue
        try:
            forecast_doc = forecast(site, BODY)
            grid = sensitivity(site, BODY)
        except ApiError as exc:
            print(f"{site}: {exc.code} {exc.message}")
            continue
        (OUT / f"{site}_forecast.json").write_text(json.dumps(forecast_doc, indent=1) + "\n", encoding="utf-8")
        (OUT / f"{site}_sensitivity.json").write_text(json.dumps(grid, indent=1) + "\n", encoding="utf-8")
        print(f"wrote {site}")
    print(f"output {OUT}")


if __name__ == "__main__":
    main()

"""Write one engine forecast and one sensitivity grid.

The contract fixtures under packages/contracts/fixtures/forecast/ stay the shape
examples. Their generator test requires a yield series and a CAD income, and the
catalog's reference yields are null, so the engine correctly omits those.
This script writes the real response beside the cache, which is gitignored.

    python scripts/build_forecast_fixtures.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))

from app.services.forecast import forecast  # noqa: E402
from app.services.sensitivity import sensitivity  # noqa: E402

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
    site = "site_usda_barc"
    forecast_doc = forecast(site, BODY)
    grid = sensitivity(site, BODY)
    (OUT / f"{site}_forecast.json").write_text(json.dumps(forecast_doc, indent=1) + "\n", encoding="utf-8")
    (OUT / f"{site}_sensitivity.json").write_text(json.dumps(grid, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()

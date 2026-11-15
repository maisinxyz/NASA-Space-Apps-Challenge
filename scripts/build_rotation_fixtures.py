"""Saved demo requests and responses for the rotation engine (backend rotation PRD §19). Deterministic, offline-safe.

Writes packages/contracts/fixtures/{rotation_analysis,compare}/*.json and glossary.json. Run after build_seed.py.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))

from app.features.config import CURATED_SITES  # noqa: E402
from app.rotation import traits  # noqa: E402
from app.services import rotation as S  # noqa: E402

FIX = ROOT / "packages" / "contracts" / "fixtures"
DEMO_REQUESTS = {
    "default": {},
    "water_no_equipment": {"weight_preset": "water", "constraints": {"no_specialty_equipment": True}},
    "drier_summers": {"scenario": "drier_summers"},
}
NO_FEASIBLE = {"allowed_crops": ["crop_maize", "crop_soybean"], "constraints": {"low_water": True}}


def dump(rel: str, data) -> None:
    p = FIX / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    for site in CURATED_SITES:
        for name, body in DEMO_REQUESTS.items():
            dump(f"rotation_analysis/{site}_{name}.json", S.public(S.analyze(site, body)))
    dump("rotation_analysis/site_usda_barc_no_feasible.json", S.public(S.analyze("site_usda_barc", NO_FEASIBLE)))
    dump("compare/site_usda_barc.json", S.compare("site_usda_barc", list(S.IDS)))
    dump("glossary.json", traits.glossary())
    print("rotation fixtures written")


if __name__ == "__main__":
    main()

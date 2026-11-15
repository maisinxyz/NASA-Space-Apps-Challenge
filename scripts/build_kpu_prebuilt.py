"""Write the pre-built KPU Langley forecast the web app serves in mock/offline mode.

Real engine output (services/api/app/services/forecast.py) for the request in
apps/web/lib/forecast/kpu-request.json, built from the seeded NASA POWER and SoilGrids files in
data/seed/site_kpu_langley. Deterministic: same request, same bytes. The web app labels it "Pre-built".

    services/api/.venv/Scripts/python.exe scripts/build_kpu_prebuilt.py     (or: uv run --project services/api python scripts/build_ubc_prebuilt.py)
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))
os.environ.setdefault("OFFLINE", "1")  # seeds only, no network

from app.services.forecast import forecast  # noqa: E402

SITE = "site_kpu_langley"
REQUEST = ROOT / "apps" / "web" / "lib" / "forecast" / "kpu-request.json"
OUT = ROOT / "apps" / "web" / "public" / "prebuilt" / f"{SITE}_forecast.json"


def main() -> None:
    body = json.loads(REQUEST.read_text(encoding="utf-8"))
    doc = forecast(SITE, body)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB), data_mode={doc['data_mode']}, request_hash={doc['request_hash'][:12]}")


if __name__ == "__main__":
    main()

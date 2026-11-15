# Person B integration pass (partial) — 2026-11-15

Run against the local API (FastAPI TestClient, same app as `make dev`), using the web app's own request files.

| Check | Result |
| --- | --- |
| UBC `POST /forecast` (`lib/forecast/ubc-request.json`) | 200, 3 strategies (existing + 2 alternatives), 0.29 s |
| Same request again | 0.14 s, byte-identical (deterministic) |
| UBC slider request (rain −10 %, +1.5 °C), uncached | 200 in 2.5 s — above the 1 s target (acceptance 5) |
| UBC with `custom_strategies` | 200, strategies `existing, alternative, alternative, custom` — custom rotation scored beside the others |
| `GET /crop-catalog?site_id=site_ubc_farm` | 200 |
| KPU `POST /forecast` (`lib/forecast/kpu-request.json`) | 503 `DATA_SOURCE_UNAVAILABLE` "No soil seed and no soil override for this site." (B6) |
| `/outlook`, `/copilot/chat`, `/field/analyze` | not mounted yet (B7, B9, B10); web uses the contract fixtures in mock mode |
| `rotation_explanation` | not in engine output yet (B8); web renders it when present |

Web quality gates: `pnpm test` 566 passed, `pnpm typecheck` clean, `pnpm lint` 0 errors (34 warnings, pre-existing kinds).
`pnpm build` could not run here: `next/font` cannot reach Google Fonts from this machine (network), unrelated to these changes.

Not done in this session: a browser walk-through (2D map ten open/close cycles, visual check of field colours). Run it once the backend endpoints are live.
